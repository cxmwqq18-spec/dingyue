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
  ErpInfoList,
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
};

type PlatformEmailPayload = {
  ok: boolean;
  config: PlatformEmailConfig;
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
  if (status === "pending" || status === "not_found") return "warn";
  return "neutral";
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
  const [message, setMessage] = useState(initialStatus.note ?? "统一配置 Resend API Key 后，平台会按各站点主域名匹配 Resend Domains 验证状态。");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [provisioningSiteId, setProvisioningSiteId] = useState("");

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

  async function sendTest() {
    const to = testTo.trim();
    if (!to || !to.includes("@")) {
      setMessage(`测试邮件发送失败：${reasonLabel("invalid_email")}`);
      return;
    }
    setTesting(true);
    setMessage("测试邮件发送中...");
    try {
      const response = await fetch("/api/platform/email", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfTokenFromCookie()
        },
        body: JSON.stringify({ to, siteId: testSiteId })
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
    setProvisioningSiteId(row.site.id);
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
        verify: true
      })
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      resend?: { verificationStatus?: string };
      dnsRecords?: Array<{ type?: string; name?: string; content?: string }>;
    };
    setProvisioningSiteId("");
    if (!response.ok) {
      setMessage(`Resend 验证检测失败：${reasonLabel(result.error ?? "email_domain_provision_failed")}`);
      return;
    }
    const dnsCount = result.dnsRecords?.length ?? 0;
    setMessage(`Resend 验证检测已执行：当前状态 ${result.resend?.verificationStatus ?? "pending"}；DNS 记录 ${dnsCount} 条可用于手动核对。`);
    await refreshStatus();
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
          description="这里保存平台统一 Resend 配置。API Key 只会回显掩码；各站点是否可用由 Resend Domains 的 DNS 验证状态决定。"
          eyebrow="email provider"
          title="全局发信配置"
        >
          <div className="grid gap-4">
            <ErpInfoList
              items={[
                { label: "API Key", value: status.config.apiKeyConfigured ? status.config.apiKeyPreview : "missing", tone: status.config.apiKeyConfigured ? "good" : "warn" },
                { label: "From", value: status.config.fromEmail || "missing", tone: status.config.fromConfigured ? "good" : "warn" },
                { label: "From domain", value: status.config.fromDomain || "missing", tone: status.senderDomain?.status === "verified" ? "good" : "warn" },
                { label: "Reply-To", value: status.config.replyToConfigured ? status.config.replyTo : "missing", tone: status.config.replyToConfigured ? "good" : "neutral" },
                { label: "Sender mode", value: status.config.usingTestingSender ? "testing sender" : status.config.fromConfigured ? "domain sender" : "missing", tone: status.config.usingTestingSender ? "warn" : status.config.fromConfigured ? "good" : "warn" },
                { label: "Production", value: status.readyForProduction ? "ready" : "blocked", tone: status.readyForProduction ? "good" : "warn" }
              ]}
            />
            <ErpFormGrid>
              <ErpField label="Resend API Key">
                <ErpInput autoComplete="off" onChange={(event) => setApiKey(event.target.value)} placeholder={status.config.apiKeyConfigured ? "留空则保留当前密钥" : "re_..."} type="password" value={apiKey} />
              </ErpField>
              <ErpField label="From Email">
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
            <button className="input_btn inline-flex h-[40px] items-center justify-center gap-1 disabled:opacity-55" disabled={testing || !testTo.trim()} onClick={sendTest} type="button">
              <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
              {testing ? "发送中" : "发送测试"}
            </button>
            <p className="text-[12px] leading-5 text-[#667085]">
              如果仍使用 Resend 测试发件人，只能发给 Resend 账号自己的邮箱；生产发信必须使用已验证域名。
            </p>
          </div>
        </ErpSection>
      </div>

      <ErpSection description="按每个站点主域名推导候选发件邮箱，并匹配 Resend Domains 验证状态；DNS 记录由你在域名服务商里手动维护。" eyebrow="cross-site readiness" title="跨站发送域名">
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
          <WorkbenchTableHeader className="md:grid-cols-[minmax(200px,1fr)_minmax(210px,1fr)_minmax(150px,0.62fr)_minmax(130px,0.55fr)_minmax(220px,1fr)_minmax(130px,0.55fr)]" columns={["店铺 / 主域名", "候选发件邮箱", "Resend 域名", "Production", "阻断原因", "操作"]} />
          {filteredSites.length ? (
            filteredSites.map((row) => (
              <WorkbenchTableRow className="md:grid-cols-[minmax(200px,1fr)_minmax(210px,1fr)_minmax(150px,0.62fr)_minmax(130px,0.55fr)_minmax(220px,1fr)_minmax(130px,0.55fr)]" key={row.site.id}>
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
                  <StatusPill label={domainStatusLabel(row.domainStatus)} tone={statusTone(row.domainStatus)} />
                  <div className="mt-2 truncate font-mono text-[11px] text-[#98a2b3]">{row.resendDomain?.id ?? row.resendDomain?.name ?? "not found"}</div>
                </div>
                <div>
                  <StatusPill label={row.readyForProduction ? "就绪" : "阻断"} tone={row.readyForProduction ? "good" : "warn"} />
                  <div className="mt-2 text-[12px] text-[#667085]">Resend / {status.config.source}</div>
                </div>
                <div className="min-w-0 text-[12px] leading-5 text-[#667085]">
                  {row.blockingReasons.length ? row.blockingReasons.map(reasonLabel).join(" ") : "当前站点发件域名已通过检测。"}
                </div>
                <div>
                  <button
                    className="admin_btn inline-flex h-[32px] items-center justify-center px-3 text-[12px] disabled:opacity-55"
                    disabled={provisioningSiteId === row.site.id}
                    onClick={() => provisionDomain(row)}
                    type="button"
                  >
                    {provisioningSiteId === row.site.id ? "检测中" : "检测 Resend"}
                  </button>
                </div>
              </WorkbenchTableRow>
            ))
          ) : (
            <div className="px-5 py-10 text-center text-[13px] text-[#98a2b3]">没有匹配的邮箱检测记录。</div>
          )}
        </WorkbenchTableShell>
      </ErpSection>
    </div>
  );
}
