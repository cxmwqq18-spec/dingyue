"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, MailCheck, RefreshCcw, Save, Send } from "lucide-react";
import { downloadCsv } from "@/components/admin/export-utils";
import {
  WorkbenchActionButton,
  WorkbenchSearchInput,
  WorkbenchSearchRow,
  WorkbenchSelect,
  WorkbenchTableHeader,
  WorkbenchTableRow,
  WorkbenchTableShell
} from "@/components/admin/design-workbench";
import {
  ErpField,
  ErpFormGrid,
  ErpInput,
  ErpSection,
  ErpSelect,
  ErpStatGrid,
  ErpToolbar,
  ErpToolbarField
} from "@/components/admin/erp-primitives";
import { StatusPill } from "@/components/ui";

type EmailTone = "good" | "warn" | "bad" | "neutral";

type PlatformEmailConfig = {
  apiKeyConfigured: boolean;
  apiKeyPreview: string;
  fromConfigured: boolean;
  fromEmail: string;
  fromDomain: string;
  replyToConfigured: boolean;
  replyTo: string;
  usingTestingSender: boolean;
  source: "platform" | "env" | "missing";
  updatedAt?: string;
  updatedBy?: string;
};

type PlatformResendConfig = PlatformEmailConfig & {
  id: string;
  label?: string;
  isDefault?: boolean;
  domains?: Array<{ id?: string; name?: string; status?: string; region?: string }>;
};

type PlatformEmailSiteRow = {
  site: {
    id: string;
    name: string;
    slug: string;
    status: string;
    primaryDomain: string;
  };
  domains: Array<{ id: string; domain: string; isPrimary: boolean; status: string }>;
  provider: "resend";
  candidateFromEmail: string;
  candidateDomain: string;
  resendDomain?: { id?: string; name?: string; status?: string; region?: string };
  domainStatus: string;
  readyForProduction: boolean;
  blockingReasons: string[];
  emailConfigId?: string;
  emailConfigLabel?: string;
  resendConfigId?: string;
};

type PlatformEmailPayload = {
  ok: boolean;
  config: PlatformEmailConfig;
  configs?: PlatformResendConfig[];
  resendConfigs?: PlatformResendConfig[];
  domains: Array<{ id?: string; name?: string; status?: string; region?: string }>;
  domainCheckError?: {
    error: string;
    providerStatus?: number;
    providerMessage?: string;
  };
  senderDomain?: { id?: string; name?: string; status?: string; region?: string };
  blockingReasons: string[];
  readyForProduction: boolean;
  summary: {
    totalSites: number;
    readySites: number;
    blockedSites: number;
    verifiedDomains: number;
  };
  sites: PlatformEmailSiteRow[];
  note?: string;
};

function csrfTokenFromCookie(): string {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("platform_csrf="))
    ?.slice("platform_csrf=".length) ?? "";
}

function reasonLabel(code: string): string {
  const labels: Record<string, string> = {
    missing_resend_api_key: "缺少 RESEND_API_KEY。",
    missing_resend_from_email: "缺少 RESEND_FROM_EMAIL。",
    resend_testing_sender: "当前仍使用 Resend 测试发件人。",
    sender_domain_not_found_in_resend: "发件域名没有出现在 Resend Domains。",
    sender_domain_not_verified: "发件域名尚未在 Resend 验证。",
    domain_check_not_run: "尚未执行 Resend 域名检测。",
    local_domain_not_verifiable: "localhost / 127.0.0.1 不能作为 Resend 发件域名。",
    invalid_email: "请输入有效的测试邮箱。",
    invalid_from_email: "请输入有效的发件邮箱。",
    invalid_reply_to: "请输入有效的 Reply-To 邮箱。",
    email_provider_not_configured: "Resend API Key 或发件人地址未配置。",
    resend_domain_not_verified: "Resend 还没有验证发送域名，测试模式只能发到供应商账号自己的邮箱。",
    resend_invalid_api_key: "Resend API Key 无效或已失效。",
    invalid_resend_api_key_format: "请输入完整有效的 Resend API Key，不要使用占位或掩码内容。",
    resend_invalid_from_email: "Resend 拒绝当前发件邮箱，请使用已验证域名邮箱。",
    resend_rate_limited: "Resend 触发限流，请稍后再试。",
    resend_domain_api_failed: "读取 Resend Domains 失败，请检查 API Key 是否属于当前 Resend 账号。",
    resend_domain_not_found: "Resend 没有找到该发送域名。",
    email_send_failed: "测试邮件发送失败，请稍后重试。",
    platform_login_required: "当前平台后台登录已失效，请重新登录。",
    platform_forbidden: "当前平台账号没有权限修改邮箱服务。",
    csrf_token_required: "安全校验已失效，请刷新页面后重试。",
    csrf_token_mismatch: "安全校验不匹配，请刷新页面后重试。",
    rate_limited: "发送太频繁，请稍后再试。",
    site_not_found: "测试站点不存在，请刷新页面后重试。",
    network_error: "网络请求失败，请检查服务状态后重试。"
  };
  return labels[code] ?? code;
}

function providerDetailSuffix(result: { providerStatus?: number; providerMessage?: string }): string {
  const parts = [
    result.providerStatus ? `HTTP ${result.providerStatus}` : "",
    result.providerMessage?.trim() ?? ""
  ].filter(Boolean);
  return parts.length ? `（${parts.join("：")}）` : "";
}

function domainStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    verified: "已验证",
    unchecked: "未检测",
    pending: "待验证",
    not_found: "未添加",
    local: "本地域名",
    failed: "失败"
  };
  return labels[status] ?? (status || "未知");
}

function statusTone(status: string): EmailTone {
  if (status === "verified" || status === "ready") return "good";
  if (status === "local" || status === "failed" || status === "blocked") return "bad";
  if (status === "pending" || status === "not_found" || status === "unchecked") return "warn";
  return "neutral";
}

function configLabel(config: PlatformResendConfig, index: number): string {
  return config.label || (config.isDefault ? "默认 Resend" : `Resend ${index + 1}`);
}

function selectedConfigForSite(
  row: PlatformEmailSiteRow,
  configChoices: PlatformResendConfig[],
  selectedConfigBySite: Record<string, string>
): PlatformResendConfig {
  const selectedId = selectedConfigBySite[row.site.id] || row.emailConfigId || row.resendConfigId || configChoices[0]?.id;
  return configChoices.find((config) => config.id === selectedId) ?? configChoices[0] ?? {
    apiKeyConfigured: false,
    apiKeyPreview: "missing",
    fromConfigured: false,
    fromEmail: "",
    fromDomain: "",
    replyToConfigured: false,
    replyTo: "",
    usingTestingSender: false,
    source: "missing",
    id: "default",
    label: "默认 Resend"
  };
}

export function PlatformEmailPanel({
  initialStatus
}: {
  initialStatus: PlatformEmailPayload;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState(initialStatus.config.fromEmail);
  const [replyTo, setReplyTo] = useState(initialStatus.config.replyTo);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testSiteId, setTestSiteId] = useState(initialStatus.sites[0]?.site.id ?? "");
  const [selectedConfigBySite, setSelectedConfigBySite] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialStatus.sites.map((row) => [row.site.id, row.emailConfigId ?? row.resendConfigId ?? "default"]))
  );
  const [message, setMessage] = useState(initialStatus.note ?? "统一配置 Resend API Key 后，平台会按各站点主域名匹配 Resend Domains 验证状态。");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [provisioningSiteId, setProvisioningSiteId] = useState("");

  const resendConfigChoices = useMemo<PlatformResendConfig[]>(() => {
    if (status.configs?.length) return status.configs;
    if (status.resendConfigs?.length) return status.resendConfigs;
    return [{
      ...status.config,
      id: "default",
      label: "默认 Resend",
      isDefault: true,
      domains: status.domains
    }];
  }, [status.config, status.configs, status.domains, status.resendConfigs]);

  const filteredSites = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return status.sites.filter((row) => {
      if (filter === "ready" && !row.readyForProduction) return false;
      if (filter === "blocked" && row.readyForProduction) return false;
      if (filter === "verified" && row.domainStatus !== "verified") return false;
      if (filter === "pending" && row.domainStatus !== "pending") return false;
      if (filter === "local" && row.domainStatus !== "local") return false;
      if (!normalized) return true;
      return [
        row.site.name,
        row.site.slug,
        row.site.primaryDomain,
        row.candidateFromEmail,
        row.candidateDomain,
        row.resendDomain?.id ?? "",
        row.domainStatus
      ].join(" ").toLowerCase().includes(normalized);
    });
  }, [filter, query, status.sites]);

  async function refreshStatus() {
    setLoading(true);
    const response = await fetch("/api/platform/email", { cache: "no-store", credentials: "same-origin" });
    const result = (await response.json().catch(() => ({}))) as PlatformEmailPayload & { error?: string };
    setLoading(false);
    if (!response.ok) {
      setMessage(`检测失败：${reasonLabel(result.error ?? "email_status_fetch_failed")}`);
      return;
    }
    setStatus(result);
    setFromEmail(result.config.fromEmail);
    setReplyTo(result.config.replyTo);
    setSelectedConfigBySite((current) => ({
      ...Object.fromEntries(result.sites.map((row) => [row.site.id, current[row.site.id] || row.resendConfigId || "default"]))
    }));
    const domainCheckDetail = result.domainCheckError
      ? ` Resend 检测提示：${reasonLabel(result.domainCheckError.error)}${providerDetailSuffix(result.domainCheckError)}`
      : "";
    setMessage(`检测完成：${result.summary.readySites} 个站点就绪，${result.summary.blockedSites} 个站点阻断。${domainCheckDetail}`);
    router.refresh();
  }

  async function saveSettings() {
    setSaving(true);
    const response = await fetch("/api/platform/email", {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfTokenFromCookie()
      },
      body: JSON.stringify({
        apiKey: apiKey.trim() || undefined,
        fromEmail,
        replyTo
      })
    });
    const result = (await response.json().catch(() => ({}))) as PlatformEmailPayload & { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(`保存失败：${reasonLabel(result.error ?? "email_send_failed")}`);
      return;
    }
    setApiKey("");
    setStatus(result);
    setMessage("邮箱服务配置已保存，并已重新检测 Resend Domains。");
    router.refresh();
  }

  async function saveSiteConfigBinding(siteId: string, configId: string) {
    setSelectedConfigBySite((current) => ({ ...current, [siteId]: configId }));
    const response = await fetch("/api/platform/email", {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfTokenFromCookie()
      },
      body: JSON.stringify({
        action: "bind_site",
        siteId,
        resendConfigId: configId
      })
    });
    const result = (await response.json().catch(() => ({}))) as PlatformEmailPayload & { error?: string };
    if (!response.ok) {
      setMessage(`绑定失败：${reasonLabel(result.error ?? "email_send_failed")}`);
      await refreshStatus();
      return;
    }
    setStatus(result);
    const siteName = result.sites.find((row) => row.site.id === siteId)?.site.name ?? "当前站点";
    const configName = result.configs?.find((config) => config.id === configId)?.label
      ?? result.resendConfigs?.find((config) => config.id === configId)?.label
      ?? configId;
    setMessage(`${siteName} 已绑定到 ${configName}。`);
    router.refresh();
  }

  async function sendTest(siteIdOverride?: string) {
    const to = testTo.trim();
    if (!to || !to.includes("@")) {
      setMessage(`测试邮件发送失败：${reasonLabel("invalid_email")}`);
      return;
    }
    const siteId = siteIdOverride || testSiteId;
    const row = status.sites.find((item) => item.site.id === siteId);
    const selectedConfig = row ? selectedConfigForSite(row, resendConfigChoices, selectedConfigBySite) : resendConfigChoices[0];
    setTesting(true);
    setTestSiteId(siteId);
    setMessage(`测试邮件发送中：${row?.site.name ?? "当前站点"} / ${configLabel(selectedConfig, resendConfigChoices.indexOf(selectedConfig))}`);
    try {
      const response = await fetch("/api/platform/email", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfTokenFromCookie()
        },
        body: JSON.stringify({ to, siteId, resendConfigId: selectedConfig.id })
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        messageId?: string;
        providerStatus?: number;
        providerMessage?: string;
      };
      if (!response.ok) {
        setMessage(`测试邮件发送失败：${reasonLabel(result.error ?? "email_send_failed")}${providerDetailSuffix(result)}`);
        return;
      }
      setMessage(`测试邮件已发送，Resend message id: ${result.messageId ?? "provider accepted"}。`);
    } catch {
      setMessage(`测试邮件发送失败：${reasonLabel("network_error")}`);
    } finally {
      setTesting(false);
    }
  }

  async function provisionDomain(row: PlatformEmailSiteRow) {
    const selectedConfig = selectedConfigForSite(row, resendConfigChoices, selectedConfigBySite);
    setProvisioningSiteId(row.site.id);
    try {
      const response = await fetch("/api/platform/email/domains", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfTokenFromCookie()
        },
        body: JSON.stringify({
          siteId: row.site.id,
          domain: row.site.primaryDomain,
          resendConfigId: selectedConfig.id,
          verify: true
        })
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        resend?: { verificationStatus?: string };
        dnsRecords?: Array<{ type?: string; name?: string; content?: string }>;
      };
      if (!response.ok) {
        setMessage(`Resend 验证检测失败：${reasonLabel(result.error ?? "email_domain_provision_failed")}`);
        return;
      }
      const dnsCount = result.dnsRecords?.length ?? 0;
      setMessage(`Resend 验证检测已执行：${row.site.name} 使用 ${configLabel(selectedConfig, resendConfigChoices.indexOf(selectedConfig))}，当前状态 ${result.resend?.verificationStatus ?? "pending"}；DNS 记录 ${dnsCount} 条可用于手动核对。`);
      await refreshStatus();
    } catch {
      setMessage(`Resend 验证检测失败：${reasonLabel("network_error")}`);
    } finally {
      setProvisioningSiteId("");
    }
  }

  function exportCsv() {
    downloadCsv(
      "platform-email-readiness.csv",
      filteredSites.map((row) => ({
        店铺ID: row.site.id,
        店铺名称: row.site.name,
        slug: row.site.slug,
        主域名: row.site.primaryDomain,
        候选发件邮箱: row.candidateFromEmail,
        发件域名: row.candidateDomain,
        Resend状态: domainStatusLabel(row.domainStatus),
        生产就绪: row.readyForProduction ? "是" : "否",
        阻断原因: row.blockingReasons.map(reasonLabel).join(" ")
      })),
      ["店铺ID", "店铺名称", "slug", "主域名", "候选发件邮箱", "发件域名", "Resend状态", "生产就绪", "阻断原因"]
    );
  }

  return (
    <div className="grid gap-4">
      <ErpToolbar>
        <div className="flex flex-wrap gap-2">
          <ErpToolbarField label="Provider" value="Resend" />
          <ErpToolbarField label="API Key" value={status.config.apiKeyConfigured ? status.config.apiKeyPreview : "missing"} />
          <ErpToolbarField label="From" value={status.config.fromEmail || "missing"} />
          <ErpToolbarField label="Ready" value={`${status.summary.readySites}/${status.summary.totalSites}`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="admin_btn inline-flex h-[34px] items-center gap-1 px-3 disabled:opacity-55" disabled={loading} onClick={refreshStatus} type="button">
            <RefreshCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
            {loading ? "检测中" : "检测配置"}
          </button>
          <button className="admin_btn inline-flex h-[34px] items-center gap-1 px-3" onClick={exportCsv} type="button">
            <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
            导出 CSV
          </button>
        </div>
      </ErpToolbar>

      <ErpStatGrid
        columns={4}
        items={[
          { label: "生产就绪", value: `${status.summary.readySites}/${status.summary.totalSites}`, detail: "已验证发件域名", icon: MailCheck, tone: status.summary.readySites === status.summary.totalSites ? "good" : "warn" },
          { label: "待处理", value: String(status.summary.blockedSites), detail: "缺少配置或域名未验证", icon: RefreshCcw, tone: status.summary.blockedSites ? "warn" : "good" },
          { label: "Resend Domains", value: String(status.domains.length), detail: `${status.summary.verifiedDomains} 个已验证`, icon: MailCheck, tone: status.summary.verifiedDomains ? "good" : "warn" },
          { label: "配置来源", value: status.config.source, detail: status.config.updatedAt ? `更新于 ${new Date(status.config.updatedAt).toLocaleString()}` : "环境变量或默认状态", icon: Save, tone: status.config.source === "missing" ? "warn" : "good" }
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <ErpSection
          description="这里维护平台 Resend 发信账号。API Key 只回显掩码；站点可在下方域名行选择账号并执行 DNS 检测或单封测试。"
          eyebrow="email provider"
          title="Resend 账号配置"
        >
          <div className="grid gap-4">
            <WorkbenchTableShell className="rounded-[8px]">
              <WorkbenchTableHeader className="md:grid-cols-[minmax(150px,0.8fr)_minmax(210px,1fr)_minmax(160px,0.8fr)_minmax(130px,0.55fr)]" columns={["账号", "默认 From / Reply-To", "Domains", "状态"]} />
              {resendConfigChoices.map((config, index) => {
                const domains = config.domains ?? (config.id === "default" ? status.domains : []);
                const verifiedCount = domains.filter((domain) => domain.status === "verified").length;
                return (
                  <WorkbenchTableRow className="md:grid-cols-[minmax(150px,0.8fr)_minmax(210px,1fr)_minmax(160px,0.8fr)_minmax(130px,0.55fr)]" key={config.id}>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-[#18212f]">{configLabel(config, index)}</div>
                      <div className="mt-1 truncate font-mono text-[11px] text-[#98a2b3]">{config.apiKeyConfigured ? config.apiKeyPreview : "missing api key"}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[12px] text-[#18212f]">{config.fromEmail || "missing from email"}</div>
                      <div className="mt-1 truncate font-mono text-[11px] text-[#98a2b3]">{config.replyToConfigured ? config.replyTo : "no reply-to"}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] text-[#475467]">{domains.length} 个域名 / {verifiedCount} 个已验证</div>
                      <div className="mt-1 truncate font-mono text-[11px] text-[#98a2b3]">{config.fromDomain || "missing sender domain"}</div>
                    </div>
                    <div>
                      <StatusPill
                        label={config.apiKeyConfigured && config.fromConfigured && !config.usingTestingSender ? "可用于生产" : "需配置"}
                        tone={config.apiKeyConfigured && config.fromConfigured && !config.usingTestingSender ? "good" : "warn"}
                      />
                    </div>
                  </WorkbenchTableRow>
                );
              })}
            </WorkbenchTableShell>
            <ErpFormGrid>
              <ErpField label="Resend API Key">
                <ErpInput autoComplete="off" onChange={(event) => setApiKey(event.target.value)} placeholder={status.config.apiKeyConfigured ? "留空则保留当前密钥" : "re_..."} type="password" value={apiKey} />
              </ErpField>
              <ErpField label="默认 From Email">
                <ErpInput onChange={(event) => setFromEmail(event.target.value)} placeholder="Verify <verify@yourdomain.com>" value={fromEmail} />
              </ErpField>
              <ErpField label="Reply-To">
                <ErpInput onChange={(event) => setReplyTo(event.target.value)} placeholder="support@yourdomain.com" value={replyTo} />
              </ErpField>
            </ErpFormGrid>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="tixing min-w-0 flex-1">{message}</div>
              <button className="input_btn inline-flex h-[38px] items-center gap-1 px-4 disabled:opacity-55" disabled={saving} onClick={saveSettings} type="button">
                <Save className="h-3.5 w-3.5" strokeWidth={1.8} />
                {saving ? "保存中" : "保存配置"}
              </button>
            </div>
          </div>
        </ErpSection>

        <ErpSection description="只发送单封验证码测试，避免批量误发。" eyebrow="test delivery" title="测试验证码邮件">
          <div className="grid gap-3">
            <ErpField label="收件邮箱">
              <ErpInput onChange={(event) => setTestTo(event.target.value)} placeholder="you@example.com" type="email" value={testTo} />
            </ErpField>
            <ErpField label="测试站点">
              <ErpSelect onChange={(event) => setTestSiteId(event.target.value)} value={testSiteId}>
                {status.sites.map((row) => (
                  <option key={row.site.id} value={row.site.id}>
                    {row.site.name} / {row.site.primaryDomain}
                  </option>
                ))}
              </ErpSelect>
            </ErpField>
            <button className="input_btn inline-flex h-[40px] items-center justify-center gap-1 disabled:opacity-55" disabled={testing || !testTo.trim()} onClick={() => sendTest()} type="button">
              <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
              {testing ? "发送中" : "发送测试"}
            </button>
            <p className="text-[12px] leading-5 text-[#667085]">
              也可以在下方站点域名行直接发送测试；如果仍使用 Resend 测试发件人，只能发给 Resend 账号自己的邮箱。
            </p>
          </div>
        </ErpSection>
      </div>

      <ErpSection description="每个站点域名行可选择 Resend 配置，随后执行 Resend DNS 检测或使用同一行发送单封测试邮件；DNS 记录仍由你在域名服务商里手动维护。" eyebrow="cross-site readiness" title="站点域名发信矩阵">
        <WorkbenchSearchRow
          actions={
            <>
              <WorkbenchActionButton label="重置" onClick={() => { setQuery(""); setFilter(""); }} quiet />
              <WorkbenchActionButton label="检测配置" onClick={refreshStatus} />
            </>
          }
          controls={
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
              <WorkbenchSearchInput onChange={setQuery} placeholder="搜索店铺、发件域名、From 邮箱" value={query} />
              <WorkbenchSelect
                onChange={setFilter}
                options={[
                  { value: "", label: "全部状态" },
                  { value: "ready", label: "就绪" },
                  { value: "blocked", label: "阻断" },
                  { value: "verified", label: "域名已验证" },
                  { value: "pending", label: "待验证" },
                  { value: "local", label: "本地域名" }
                ]}
                value={filter}
              />
            </div>
          }
        />
        <WorkbenchTableShell>
          <WorkbenchTableHeader className="md:grid-cols-[minmax(190px,0.95fr)_minmax(190px,0.9fr)_minmax(150px,0.72fr)_minmax(150px,0.65fr)_minmax(190px,1fr)_minmax(170px,0.76fr)]" columns={["店铺 / 主域名", "发件邮箱", "Resend 配置", "DNS 状态", "阻断原因", "操作"]} />
          {filteredSites.length ? (
            filteredSites.map((row) => {
              const selectedConfig = selectedConfigForSite(row, resendConfigChoices, selectedConfigBySite);
              return (
                <WorkbenchTableRow className="md:grid-cols-[minmax(190px,0.95fr)_minmax(190px,0.9fr)_minmax(150px,0.72fr)_minmax(150px,0.65fr)_minmax(190px,1fr)_minmax(170px,0.76fr)]" key={row.site.id}>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-[#18212f]">{row.site.name}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-[#98a2b3]">{row.site.slug} / {row.site.primaryDomain}</div>
                  <div className="mt-2 text-[12px] text-[#667085]">{row.domains.length} 个域名</div>
                </div>
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12px] text-[#18212f]">{row.candidateFromEmail}</div>
                  <div className="mt-2 truncate text-[12px] text-[#667085]">{row.candidateDomain}</div>
                </div>
                <div className="min-w-0">
                  <ErpSelect
                    aria-label={`${row.site.name} Resend 配置`}
                    onChange={(event) => void saveSiteConfigBinding(row.site.id, event.target.value)}
                    value={selectedConfig.id}
                  >
                    {resendConfigChoices.map((config, index) => (
                      <option key={config.id} value={config.id}>
                        {configLabel(config, index)}
                      </option>
                    ))}
                  </ErpSelect>
                  <div className="mt-2 truncate font-mono text-[11px] text-[#98a2b3]">{selectedConfig.apiKeyConfigured ? selectedConfig.apiKeyPreview : "missing"}</div>
                </div>
                <div className="min-w-0">
                  <StatusPill label={domainStatusLabel(row.domainStatus)} tone={statusTone(row.domainStatus)} />
                  <div className="mt-2 truncate font-mono text-[11px] text-[#98a2b3]">{row.resendDomain?.id ?? row.resendDomain?.name ?? "not found"}</div>
                  <StatusPill label={row.readyForProduction ? "就绪" : "阻断"} tone={row.readyForProduction ? "good" : "warn"} />
                  <div className="mt-2 text-[12px] text-[#667085]">Resend / {status.config.source}</div>
                </div>
                <div className="min-w-0 text-[12px] leading-5 text-[#667085]">
                  {row.blockingReasons.length ? row.blockingReasons.map(reasonLabel).join(" ") : "当前站点发件域名已通过检测。"}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="admin_btn inline-flex h-[32px] items-center justify-center gap-1 px-3 text-[12px] disabled:opacity-55"
                    disabled={provisioningSiteId === row.site.id}
                    onClick={() => provisionDomain(row)}
                    type="button"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
                    {provisioningSiteId === row.site.id ? "检测中" : "DNS 检测"}
                  </button>
                  <button
                    className="input_btn inline-flex h-[32px] items-center justify-center gap-1 px-3 text-[12px] disabled:opacity-55"
                    disabled={testing || !testTo.trim()}
                    onClick={() => sendTest(row.site.id)}
                    type="button"
                  >
                    <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
                    测试
                  </button>
                </div>
                </WorkbenchTableRow>
              );
            })
          ) : (
            <div className="px-5 py-10 text-center text-[13px] text-[#98a2b3]">没有匹配的邮箱检测记录。</div>
          )}
        </WorkbenchTableShell>
      </ErpSection>
    </div>
  );
}
