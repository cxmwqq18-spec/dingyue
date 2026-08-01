"use client";

import { useId, useRef, useState, type MouseEvent } from "react";
import { platformJsonHeaders } from "@/lib/client-csrf";

const adminBridgeTimeoutMs = 15000;

function adminBridgeErrorLabel(error?: string): string {
  return {
    platform_login_required: "平台登录已失效，请重新登录后再进入后台。",
    platform_forbidden: "当前平台账号没有进入该站点后台的权限。",
    csrf_token_required: "安全令牌缺失，请刷新页面后重试。",
    csrf_token_mismatch: "安全令牌不匹配，请刷新页面后重试。",
    site_not_found: "站点不存在或已被删除。",
    site_admin_not_found: "该站点还没有可桥接的后台管理员。",
    site_admin_bridge_timeout: "进入后台超时，已恢复当前页面操作，请稍后重试。",
    site_admin_bridge_failed: "进入后台失败，请稍后重试。"
  }[error ?? ""] ?? error ?? "进入后台失败，请稍后重试。";
}

function writeAdminBridgeLoadingPage(adminWindow: Window) {
  try {
    adminWindow.document.open();
    adminWindow.document.write(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>正在进入后台</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
        background: #f6f8fb;
        color: #172033;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
      }
      main {
        width: min(420px, calc(100vw - 48px));
        border: 1px solid #dce5f2;
        border-radius: 18px;
        background: #ffffff;
        box-shadow: 0 20px 55px rgba(19, 40, 68, 0.12);
        padding: 32px;
        text-align: center;
      }
      .spinner {
        width: 34px;
        height: 34px;
        margin: 0 auto 18px;
        border: 3px solid #dbe7f7;
        border-top-color: #2f73f6;
        border-radius: 999px;
        animation: spin 0.8s linear infinite;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 20px;
        line-height: 1.3;
      }
      p {
        margin: 0;
        color: #64748b;
        font-size: 14px;
        line-height: 1.7;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="spinner" aria-hidden="true"></div>
      <h1>正在进入后台</h1>
      <p>正在创建站点后台会话，稍后会自动跳转。</p>
    </main>
  </body>
</html>`);
    adminWindow.document.close();
    adminWindow.focus();
  } catch {
    // Some browser policies can block writing to the popup; navigation still works.
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function writeAdminBridgeErrorPage(adminWindow: Window, message: string) {
  try {
    const safeMessage = escapeHtml(message);
    adminWindow.document.open();
    adminWindow.document.write(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>进入后台失败</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
        background: #fff7ed;
        color: #172033;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
      }
      main {
        width: min(460px, calc(100vw - 48px));
        border: 1px solid #fed7aa;
        border-radius: 18px;
        background: #ffffff;
        box-shadow: 0 20px 55px rgba(154, 52, 18, 0.14);
        padding: 32px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 20px;
        line-height: 1.3;
      }
      p {
        margin: 0;
        color: #9a3412;
        font-size: 14px;
        line-height: 1.7;
      }
      button {
        margin-top: 20px;
        border: 1px solid #fed7aa;
        border-radius: 10px;
        background: #fff7ed;
        color: #9a3412;
        cursor: pointer;
        font: inherit;
        font-size: 13px;
        padding: 10px 14px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>进入后台失败</h1>
      <p>${safeMessage}</p>
      <button onclick="window.close()" type="button">关闭窗口</button>
    </main>
  </body>
</html>`);
    adminWindow.document.close();
    adminWindow.focus();
  } catch {
    // Some browser policies can block writing to the popup; the inline message remains visible.
  }
}

export function PlatformSiteAdminLink({
  siteId,
  path = "/admin",
  label = "后台",
  className
}: {
  siteId: string;
  path?: string;
  label?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackId = useId();
  const pendingRef = useRef(false);
  const bridgeHref = `/api/platform/sites/${encodeURIComponent(siteId)}/admin-bridge?path=${encodeURIComponent(path)}`;

  function reportFailure(adminWindow: Window | null, message: string) {
    setFeedback(message);
    if (adminWindow && !adminWindow.closed) {
      writeAdminBridgeErrorPage(adminWindow, message);
    }
  }

  async function openAdmin(event: MouseEvent<HTMLAnchorElement>) {
    if (pendingRef.current) {
      event.preventDefault();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    setFeedback(null);
    const adminWindow = window.open("about:blank", "_blank");
    if (!adminWindow) {
      const message = "浏览器拦截了新窗口，请允许弹出窗口后再进入后台。";
      setFeedback(message);
      return;
    }
    event.preventDefault();
    writeAdminBridgeLoadingPage(adminWindow);
    pendingRef.current = true;
    setPending(true);
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, adminBridgeTimeoutMs);
    try {
      const response = await fetch(`/api/platform/sites/${encodeURIComponent(siteId)}/admin-bridge`, {
        method: "POST",
        headers: platformJsonHeaders(),
        body: JSON.stringify({ path }),
        signal: controller.signal
      });
      const result = (await response.json().catch(() => ({}))) as { redirectTo?: string; error?: string };
      if (!response.ok || !result.redirectTo) {
        const message = response.status === 429 ? "操作太频繁，请稍后再试。" : adminBridgeErrorLabel(result.error);
        reportFailure(adminWindow, message);
        return;
      }
      setFeedback(null);
      adminWindow.location.replace(result.redirectTo);
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError"
        ? "进入后台等待时间过长，本地服务可能仍在冷启动，请稍后重试。"
        : !timedOut && error instanceof TypeError && error.message.toLowerCase().includes("failed to fetch")
          ? "后台桥接请求未完成，请确认本地服务仍在运行后重试。"
          : error instanceof Error
          ? `进入后台失败：${error.message}`
          : "进入后台失败，请稍后重试。";
      reportFailure(adminWindow, message);
    } finally {
      window.clearTimeout(timeout);
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <span className="relative inline-flex">
      <a
        aria-busy={pending}
        aria-describedby={feedback ? feedbackId : undefined}
        aria-disabled={pending}
        className={className}
        href={bridgeHref}
        onClick={openAdmin}
        rel="noopener noreferrer"
        target="_blank"
      >
        {pending ? "进入中" : label}
      </a>
      {feedback ? (
        <span
          className="absolute left-1/2 top-[calc(100%+6px)] z-30 w-64 -translate-x-1/2 rounded-[8px] border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-left text-[12px] leading-5 text-[#9a3412] shadow-[0_14px_30px_-18px_rgba(154,52,18,0.45)]"
          id={feedbackId}
          role="alert"
        >
          {feedback}
        </span>
      ) : null}
    </span>
  );
}
