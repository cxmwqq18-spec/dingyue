"use client";

import { useState } from "react";
import { MailCheck, Save, Send } from "lucide-react";
import { ErpField, ErpFormGrid, ErpInput, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarField } from "@/components/admin/erp-primitives";
import { StatusPill } from "@/components/ui";

type SiteEmailStatus = {
  config: {
    id: string;
    label: string;
    apiKeyConfigured: boolean;
    apiKeyPreview: string;
    fromEmail: string;
    fromDomain: string;
    replyTo: string;
    usingTestingSender: boolean;
    source: "platform" | "env" | "missing";
  };
  domainStatus: string;
  candidateFromEmail: string;
  candidateDomain: string;
  readyForProduction: boolean;
  blockingReasons: string[];
  resendDomain?: { id?: string; name?: string; status?: string };
  dnsRecords?: Array<{ type?: string; name?: string; content?: string }>;
};

type TestState = "passed" | "failed" | "sending" | "idle";

function csrfTokenFromCookie(siteId: string): string {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`site_admin_csrf_${siteId}=`))
    ?.split("=")[1] ?? "";
}

function reasonLabel(code: string): string {
  const labels: Record<string, string> = {
    missing_resend_api_key: "缺少 Resend API Key。",
    missing_resend_from_email: "缺少 From Email。",
    resend_testing_sender: "当前仍使用 Resend 测试发件人。",
    sender_domain_not_found_in_resend: "发件域名没有出现在 Resend Domains。",
    sender_domain_not_verified: "发件域名尚未在 Resend 完成 DNS 验证。",
    local_domain_not_verifiable: "本地域名不能作为 Resend 发件域名。",
    invalid_email: "请输入有效邮箱。",
    invalid_from_email: "请输入有效 From Email。",
    invalid_reply_to: "请输入有效 Reply-To。",
    invalid_resend_api_key_format: "请输入完整有效的 Resend API Key。",
    email_config_not_found: "邮件配置不存在。",
    network_error: "网络请求失败。"
  };
  return labels[code] ?? code;
}

function testStateLabel(state: TestState): string {
  return {
    passed: "测试通过",
    failed: "测试失败",
    sending: "发送中",
    idle: "未测试"
  }[state];
}

function testStateTone(state: TestState): "good" | "warn" | "bad" | "neutral" {
  if (state === "passed") return "good";
  if (state === "failed") return "bad";
  if (state === "sending") return "warn";
  return "neutral";
}

export function SiteEmailPanel({
  initialStatus,
  siteId,
  siteName
}: {
  initialStatus: SiteEmailStatus;
  siteId: string;
  siteName: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState(initialStatus.config.fromEmail);
  const [replyTo, setReplyTo] = useState(initialStatus.config.replyTo);
  const [testTo, setTestTo] = useState("");
  const [message, setMessage] = useState("本站后台只维护当前站点的一套 Resend 参数；发送测试邮件成功即视为通过。");
  const [testState, setTestState] = useState<TestState>("idle");
  const [busy, setBusy] = useState(false);

  async function request(method: "GET" | "PUT" | "POST", body?: Record<string, unknown>) {
    const response = await fetch(`/api/sites/${siteId}/email`, {
      method,
      credentials: "same-origin",
      headers: method === "GET" ? undefined : {
        "Content-Type": "application/json",
        "x-csrf-token": csrfTokenFromCookie(siteId)
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
    const result = (await response.json().catch(() => ({}))) as SiteEmailStatus & { error?: string; messageId?: string };
    if (!response.ok) throw new Error(result.error ?? "email_request_failed");
    return result;
  }

  async function refreshStatus() {
    setBusy(true);
    try {
      const result = await request("GET");
      setStatus(result);
      setFromEmail(result.config.fromEmail);
      setReplyTo(result.config.replyTo);
      setMessage("配置已刷新。请发送测试邮件到目标邮箱，发送成功即视为通过。");
    } catch (error) {
      setMessage(`刷新失败：${reasonLabel(error instanceof Error ? error.message : "network_error")}`);
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    setBusy(true);
    try {
      const result = await request("PUT", {
        apiKey: apiKey.trim() || undefined,
        fromEmail,
        replyTo
      });
      setApiKey("");
      setStatus(result);
      setMessage("本站 Resend 配置已保存。请发送测试邮件到目标邮箱验证。");
    } catch (error) {
      setMessage(`保存失败：${reasonLabel(error instanceof Error ? error.message : "network_error")}`);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!testTo.trim().includes("@")) {
      setMessage(`测试失败：${reasonLabel("invalid_email")}`);
      setTestState("failed");
      return;
    }
    setBusy(true);
    setTestState("sending");
    try {
      const result = await request("POST", { action: "send_test", to: testTo.trim() });
      setMessage(`测试通过：邮件已发送到 ${testTo.trim()}，message id: ${result.messageId ?? "provider accepted"}。`);
      setTestState("passed");
    } catch (error) {
      setMessage(`测试失败：${reasonLabel(error instanceof Error ? error.message : "network_error")}`);
      setTestState("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <ErpStatGrid
        items={[
          { label: "测试状态", value: testStateLabel(testState), detail: "以发送测试邮件成功为准", icon: MailCheck, tone: testStateTone(testState) },
          { label: "测试收件人", value: testTo || "未填写", detail: "发送到目标邮箱即通过", icon: Send, tone: testTo ? "good" : "neutral" },
          { label: "From", value: status.candidateDomain || "missing", detail: status.candidateFromEmail || "未配置发件邮箱", icon: Send, tone: status.config.fromEmail ? "good" : "warn" },
          { label: "配置", value: status.config.apiKeyConfigured ? "configured" : "missing", detail: status.config.apiKeyConfigured ? status.config.apiKeyPreview : "缺少 API Key", icon: Save, tone: status.config.apiKeyConfigured ? "good" : "warn" }
        ]}
      />

      <ErpSection
        description="单站后台只维护当前站点的一套 Resend 参数；保存后会自动绑定到本站，不影响其他站点。"
        eyebrow="site resend"
        title="本站 Resend 配置"
      >
        <div className="grid gap-4">
          <ErpToolbar>
            <div className="flex flex-wrap gap-2">
              <ErpToolbarField label="站点" value={siteName} />
              <ErpToolbarField label="配置" value={status.config.label} />
              <ErpToolbarField label="域名" value={status.candidateDomain || "-"} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="admin_btn inline-flex h-[34px] items-center justify-center gap-1 whitespace-nowrap px-3 disabled:opacity-55" disabled={busy} onClick={refreshStatus} type="button">
                <MailCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                刷新
              </button>
            </div>
          </ErpToolbar>
          <ErpFormGrid>
            <ErpField label="Resend API Key">
              <ErpInput autoComplete="off" onChange={(event) => setApiKey(event.target.value)} placeholder={status.config.apiKeyConfigured ? "留空保留当前密钥" : "re_..."} type="password" value={apiKey} />
            </ErpField>
            <ErpField label="From Email">
              <ErpInput onChange={(event) => setFromEmail(event.target.value)} placeholder={`verify@${status.candidateDomain || "yourdomain.com"}`} value={fromEmail} />
            </ErpField>
            <ErpField label="Reply-To">
              <ErpInput onChange={(event) => setReplyTo(event.target.value)} placeholder={`support@${status.candidateDomain || "yourdomain.com"}`} value={replyTo} />
            </ErpField>
            <ErpField label="测试收件邮箱">
              <ErpInput onChange={(event) => setTestTo(event.target.value)} placeholder="you@example.com" type="email" value={testTo} />
            </ErpField>
          </ErpFormGrid>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="tixing min-w-[260px] flex-1 break-words [overflow-wrap:anywhere]">{message}</div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button className="admin_btn inline-flex h-[38px] items-center justify-center gap-1 whitespace-nowrap px-4 disabled:opacity-55" disabled={busy || !testTo.trim()} onClick={sendTest} type="button">
                <Send className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                发送测试
              </button>
              <button className="input_btn inline-flex h-[38px] items-center justify-center gap-1 whitespace-nowrap px-4 disabled:opacity-55" disabled={busy} onClick={saveSettings} type="button">
                <Save className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                保存配置
              </button>
            </div>
          </div>
          <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] p-3 text-[12px] leading-5 text-[#667085]">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill label={testStateLabel(testState)} tone={testStateTone(testState)} />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">这里以真实邮件发送为准。测试按钮能把邮件发到目标邮箱，就当作测试通过。</span>
            </div>
          </div>
        </div>
      </ErpSection>
    </div>
  );
}
