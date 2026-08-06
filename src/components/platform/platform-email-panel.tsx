"use client";

import { useMemo, useState } from "react";
import { Download, MailCheck, Save, Send } from "lucide-react";
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

type TestState = "passed" | "failed" | "sending" | "idle";

type EmailTestResult = {
  state: "passed" | "failed";
  to?: string;
  messageId?: string;
  configId?: string;
  configLabel?: string;
  testedAt: string;
  testedBy?: string;
  error?: string;
  providerStatus?: number;
  providerMessage?: string;
};

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
  testResult?: EmailTestResult;
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

function formatAdminDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

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

function configLabel(config: PlatformResendConfig, index: number): string {
  return config.label || (config.isDefault ? "默认 Resend" : `Resend ${index + 1}`);
}

function testStateLabel(state: TestState): string {
  return {
    passed: "测试通过",
    failed: "测试失败",
    sending: "发送中",
    idle: "未测试"
  }[state];
}

function testStateTone(state: TestState): EmailTone {
  if (state === "passed") return "good";
  if (state === "failed") return "bad";
  if (state === "sending") return "warn";
  return "neutral";
}

function testStateForMessage(message?: string): TestState {
  if (!message) return "idle";
  if (message.includes("发送中")) return "sending";
  if (message.includes("测试通过") || message.includes("测试邮件已发送")) return "passed";
  if (message.includes("失败")) return "failed";
  return "idle";
}

function testStateForRow(row: PlatformEmailSiteRow, transientMessage?: string): TestState {
  const transientState = testStateForMessage(transientMessage);
  if (transientState !== "idle") return transientState;
  return row.testResult?.state ?? "idle";
}

function testMessageForRow(row: PlatformEmailSiteRow, transientMessage?: string): string {
  if (transientMessage) return transientMessage;
  if (!row.testResult) return "未发送测试邮件。输入目标邮箱后点击测试，发送成功即通过。";
  const testedAt = formatAdminDateTime(row.testResult.testedAt);
  if (row.testResult.state === "passed") {
    return `测试通过：${testedAt} 已发送到 ${row.testResult.to ?? "目标邮箱"}，message id: ${row.testResult.messageId ?? "provider accepted"}。`;
  }
  return `测试失败：${testedAt} ${reasonLabel(row.testResult.error ?? "email_send_failed")}${providerDetailSuffix(row.testResult)}。`;
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
  const [configMessage, setConfigMessage] = useState(initialStatus.note ?? "统一配置 Resend API Key 后，用测试按钮向目标邮箱发送验证码邮件。发送成功即视为测试通过。");
  const [testMessage, setTestMessage] = useState("");
  const [rowMessageBySite, setRowMessageBySite] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingSiteId, setTestingSiteId] = useState("");
  const [_loading, setLoading] = useState(false);

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
      const testState = testStateForRow(row, rowMessageBySite[row.site.id]);
      if (filter === "passed" && testState !== "passed") return false;
      if (filter === "failed" && testState !== "failed") return false;
      if (filter === "idle" && testState !== "idle") return false;
      const testMessage = testMessageForRow(row, rowMessageBySite[row.site.id]);
      if (!normalized) return true;
      return [
        row.site.name,
        row.site.slug,
        row.site.primaryDomain,
        row.candidateFromEmail,
        row.candidateDomain,
        testMessage
      ].join(" ").toLowerCase().includes(normalized);
    });
  }, [filter, query, rowMessageBySite, status.sites]);

  async function refreshStatus(options: { silent?: boolean } = {}) {
    setLoading(true);
    const response = await fetch("/api/platform/email", { cache: "no-store", credentials: "same-origin" });
    const result = (await response.json().catch(() => ({}))) as PlatformEmailPayload & { error?: string };
    setLoading(false);
    if (!response.ok) {
      if (!options.silent) setConfigMessage(`检测失败：${reasonLabel(result.error ?? "email_status_fetch_failed")}`);
      return;
    }
    setStatus(result);
    setFromEmail(result.config.fromEmail);
    setReplyTo(result.config.replyTo);
    setSelectedConfigBySite((current) => ({
      ...Object.fromEntries(result.sites.map((row) => [row.site.id, current[row.site.id] || row.emailConfigId || row.resendConfigId || "default"]))
    }));
    const domainCheckDetail = result.domainCheckError
      ? ` Resend 检测提示：${reasonLabel(result.domainCheckError.error)}${providerDetailSuffix(result.domainCheckError)}`
      : "";
    if (!options.silent) setConfigMessage(`配置已刷新：${result.summary.totalSites} 个站点可进行发送测试。${domainCheckDetail}`);
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
      setConfigMessage(`保存失败：${reasonLabel(result.error ?? "email_send_failed")}`);
      return;
    }
    setApiKey("");
    setStatus(result);
    setConfigMessage("邮箱服务配置已保存。请使用测试按钮向目标邮箱发送验证码邮件，发送成功即表示测试通过。");
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
      setConfigMessage(`绑定失败：${reasonLabel(result.error ?? "email_send_failed")}`);
      await refreshStatus();
      return;
    }
    setStatus(result);
    const siteName = result.sites.find((row) => row.site.id === siteId)?.site.name ?? "当前站点";
    const configName = result.configs?.find((config) => config.id === configId)?.label
      ?? result.resendConfigs?.find((config) => config.id === configId)?.label
      ?? configId;
    setConfigMessage(`${siteName} 已绑定到 ${configName}。`);
  }

  async function sendTest(siteIdOverride?: string) {
    const to = testTo.trim();
    if (!to || !to.includes("@")) {
      setTestMessage(`测试邮件发送失败：${reasonLabel("invalid_email")}`);
      return;
    }
    const siteId = siteIdOverride || testSiteId;
    const row = status.sites.find((item) => item.site.id === siteId);
    const selectedConfig = row ? selectedConfigForSite(row, resendConfigChoices, selectedConfigBySite) : resendConfigChoices[0];
    setTesting(true);
    setTestingSiteId(siteIdOverride ? siteId : "");
    setTestSiteId(siteId);
    const sendingMessage = `测试邮件发送中：${row?.site.name ?? "当前站点"} / ${configLabel(selectedConfig, resendConfigChoices.indexOf(selectedConfig))}`;
    if (siteIdOverride) {
      setRowMessageBySite((current) => ({ ...current, [siteId]: sendingMessage }));
    } else {
      setTestMessage(sendingMessage);
    }
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
        const failureMessage = `测试邮件发送失败：${reasonLabel(result.error ?? "email_send_failed")}${providerDetailSuffix(result)}`;
        if (siteIdOverride) {
          setRowMessageBySite((current) => ({ ...current, [siteId]: failureMessage }));
        } else {
          setTestMessage(failureMessage);
        }
        return;
      }
      const successMessage = `测试通过：邮件已发送到 ${to}，Resend message id: ${result.messageId ?? "provider accepted"}。`;
      const nextTestResult: EmailTestResult = {
        state: "passed",
        to,
        messageId: result.messageId,
        configId: selectedConfig.id,
        configLabel: configLabel(selectedConfig, resendConfigChoices.indexOf(selectedConfig)),
        testedAt: new Date().toISOString()
      };
      setStatus((current) => ({
        ...current,
        sites: current.sites.map((item) => item.site.id === siteId ? { ...item, testResult: nextTestResult } : item)
      }));
      if (siteIdOverride) {
        setRowMessageBySite((current) => ({ ...current, [siteId]: successMessage }));
      } else {
        setTestMessage(successMessage);
      }
    } catch {
      const networkMessage = `测试邮件发送失败：${reasonLabel("network_error")}`;
      if (siteIdOverride) {
        setRowMessageBySite((current) => ({ ...current, [siteId]: networkMessage }));
      } else {
        setTestMessage(networkMessage);
      }
    } finally {
      setTesting(false);
      setTestingSiteId("");
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
        测试结果: testMessageForRow(row, rowMessageBySite[row.site.id]),
        基础配置: row.blockingReasons.filter((reason) => reason === "missing_resend_api_key" || reason === "missing_resend_from_email").map(reasonLabel).join(" ")
      })),
      ["店铺ID", "店铺名称", "slug", "主域名", "候选发件邮箱", "发件域名", "测试结果", "基础配置"]
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
          <button className="admin_btn inline-flex h-[34px] items-center gap-1 px-3" onClick={exportCsv} type="button">
            <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
            导出 CSV
          </button>
        </div>
      </ErpToolbar>

      <ErpStatGrid
        columns={4}
        items={[
          { label: "可测试站点", value: String(status.summary.totalSites), detail: "每个站点可发送单封测试", icon: MailCheck, tone: status.summary.totalSites ? "good" : "neutral" },
          { label: "已配置账号", value: String(resendConfigChoices.filter((config) => config.apiKeyConfigured && config.fromConfigured).length), detail: `${resendConfigChoices.length} 个 Resend 配置`, icon: MailCheck, tone: resendConfigChoices.some((config) => config.apiKeyConfigured && config.fromConfigured) ? "good" : "warn" },
          { label: "测试通过", value: String(status.sites.filter((row) => testStateForRow(row, rowMessageBySite[row.site.id]) === "passed").length), detail: "以测试邮件发送成功为准", icon: Send, tone: status.sites.some((row) => testStateForRow(row, rowMessageBySite[row.site.id]) === "passed") ? "good" : "neutral" },
          { label: "配置来源", value: status.config.source, detail: status.config.updatedAt ? `更新于 ${formatAdminDateTime(status.config.updatedAt)}` : "环境变量或默认状态", icon: Save, tone: status.config.source === "missing" ? "warn" : "good" }
        ]}
      />

      <div className="grid gap-4">
        <ErpSection
          description="这里维护平台 Resend 发信账号。API Key 只回显掩码；站点可在下方域名行选择账号并发送单封测试邮件。"
          eyebrow="email provider"
          title="Resend 账号配置"
        >
          <div className="grid gap-4">
            <WorkbenchTableShell className="rounded-[8px]">
              <WorkbenchTableHeader className="md:grid-cols-[minmax(150px,0.8fr)_minmax(210px,1fr)_minmax(160px,0.8fr)_minmax(130px,0.55fr)]" columns={["账号", "默认 From / Reply-To", "Domains", "状态"]} />
              {resendConfigChoices.map((config, index) => {
                const domains = config.domains ?? (config.id === "default" ? status.domains : []);
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
                      <div className="text-[12px] text-[#475467]">{domains.length} 个域名记录</div>
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
              <div className="tixing min-w-0 flex-1">{configMessage}</div>
              <button className="input_btn inline-flex h-[38px] shrink-0 items-center justify-center gap-1 whitespace-nowrap px-4 disabled:opacity-55" disabled={saving} onClick={saveSettings} type="button">
                <Save className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                {saving ? "保存中" : "保存配置"}
              </button>
            </div>
          </div>
        </ErpSection>

        <ErpSection description="只发送单封验证码测试，避免批量误发。发送到目标邮箱成功，即视为测试通过。" eyebrow="test delivery" title="测试验证码邮件">
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
            <button className="input_btn inline-flex h-[40px] items-center justify-center gap-1 whitespace-nowrap px-4 disabled:opacity-55" disabled={testing || !testTo.trim()} onClick={() => sendTest()} type="button">
              <Send className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
              {testing ? "发送中" : "发送测试"}
            </button>
            {testMessage ? <div className="tixing">{testMessage}</div> : null}
            <p className="text-[12px] leading-5 text-[#667085]">
              也可以在下方站点行直接发送测试。测试按钮会真实调用 Resend 发信接口，成功返回 message id 即为通过。
            </p>
          </div>
        </ErpSection>
      </div>

      <ErpSection description="每个站点行可选择 Resend 配置，并向上方目标邮箱发送单封测试邮件。测试邮件发送成功即表示该站点发信流程通过。" eyebrow="test matrix" title="站点发信测试">
        <WorkbenchSearchRow
          actions={
            <>
              <WorkbenchActionButton label="重置" onClick={() => { setQuery(""); setFilter(""); }} quiet />
            </>
          }
          controls={
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
              <WorkbenchSearchInput onChange={setQuery} placeholder="搜索店铺、发件域名、From 邮箱" value={query} />
              <WorkbenchSelect
                onChange={setFilter}
                options={[
                  { value: "", label: "全部状态" },
                  { value: "passed", label: "测试通过" },
                  { value: "failed", label: "测试失败" },
                  { value: "idle", label: "未测试" }
                ]}
                value={filter}
              />
            </div>
          }
        />
        <WorkbenchTableShell>
          <WorkbenchTableHeader className="md:grid-cols-[minmax(190px,0.95fr)_minmax(190px,0.9fr)_minmax(150px,0.72fr)_minmax(150px,0.65fr)_minmax(260px,1fr)_minmax(110px,max-content)]" columns={["店铺 / 主域名", "发件邮箱", "Resend 配置", "测试状态", "测试结果", "操作"]} />
          {filteredSites.length ? (
            filteredSites.map((row) => {
              const selectedConfig = selectedConfigForSite(row, resendConfigChoices, selectedConfigBySite);
              const rowTestState = testingSiteId === row.site.id ? "sending" : testStateForRow(row, rowMessageBySite[row.site.id]);
              const rowTestMessage = testMessageForRow(row, rowMessageBySite[row.site.id]);
              return (
                <WorkbenchTableRow className="md:grid-cols-[minmax(190px,0.95fr)_minmax(190px,0.9fr)_minmax(150px,0.72fr)_minmax(150px,0.65fr)_minmax(260px,1fr)_minmax(110px,max-content)]" key={row.site.id}>
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
                  <StatusPill label={testStateLabel(rowTestState)} tone={testStateTone(rowTestState)} />
                  <div className="mt-2 text-[12px] text-[#667085]">Resend / {configLabel(selectedConfig, resendConfigChoices.indexOf(selectedConfig))}</div>
                </div>
                <div className="min-w-0 text-[12px] leading-5 text-[#667085]">
                  {rowTestMessage}
                </div>
                <div className="grid min-w-[110px] gap-2">
                  <div className="flex flex-nowrap items-center gap-2">
                    <button
                      className="input_btn inline-flex h-[32px] min-w-[72px] shrink-0 items-center justify-center gap-1 whitespace-nowrap px-3 text-[12px] disabled:opacity-55"
                      disabled={(testing && testingSiteId !== row.site.id) || !testTo.trim()}
                      onClick={() => sendTest(row.site.id)}
                      type="button"
                    >
                      <Send className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                      {testingSiteId === row.site.id ? "发送中" : "测试"}
                    </button>
                  </div>
                  {rowMessageBySite[row.site.id] ? <div className="tixing text-[11px] leading-5">{rowMessageBySite[row.site.id]}</div> : null}
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
