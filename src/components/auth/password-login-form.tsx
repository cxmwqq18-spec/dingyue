"use client";

import { useState } from "react";
import { ArrowRight, LogIn, ShieldCheck } from "lucide-react";
import { authMessageForCode, type AuthScope } from "@/lib/auth-messages";

export function PasswordLoginForm({
  endpoint,
  redirectTo,
  defaultEmail,
  defaultPassword,
  emailLabel = "Email",
  passwordLabel = "Password",
  submitLabel = "Sign in",
  demoLabel,
  fallbackAction,
  initialMessage,
  authScope,
  variant = "default"
}: {
  endpoint: string;
  redirectTo: string;
  defaultEmail: string;
  defaultPassword: string;
  emailLabel?: string;
  passwordLabel?: string;
  submitLabel?: string;
  demoLabel?: string;
  fallbackAction?: string;
  initialMessage?: string;
  authScope?: AuthScope;
  variant?: "default" | "erp";
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [message, setMessage] = useState(initialMessage ?? "请输入账号和密码后登录。");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("正在校验账号信息...");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        setPending(false);
        setMessage(authMessageForCode(authScope ?? "site_admin", error.error));
        return;
      }
      window.location.replace(redirectTo);
    } catch {
      setPending(false);
      setMessage("网络异常，未能完成登录，请稍后重试。");
    }
  }

  if (variant === "erp") {
    return (
      <form action={fallbackAction} className="saas-login-form" method={fallbackAction ? "post" : undefined} onSubmit={submit}>
        {demoLabel ? (
          <div className="login-demo">
            <span>默认账号</span>
            <strong>{demoLabel.replace(/^Seed account:\s*/i, "")}</strong>
          </div>
        ) : null}
        <label className="login-field-block">
          <span className="login-field-label">{emailLabel}</span>
          <input
            autoComplete="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="请输入登录账号"
            type="email"
            value={email}
          />
        </label>
        <label className="login-field-block">
          <span className="login-field-label">{passwordLabel}</span>
          <input
            autoComplete="current-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="请输入登录密码"
            type="password"
            value={password}
          />
        </label>
        <button className="login_btn" disabled={pending} type="submit">
          <span className="login_btn_icon">
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </span>
          {pending ? "登录中" : submitLabel}
        </button>
        <p className="login-message">
          <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          <span>{message}</span>
        </p>
        <p className="login-form-footnote">当前为本地工作区环境，登录成功后会进入当前平台或站点的独立后台。</p>
      </form>
    );
  }

  return (
    <form action={fallbackAction} className="grid gap-4" method={fallbackAction ? "post" : undefined} onSubmit={submit}>
      {demoLabel ? (
        <div className="rounded-2xl border border-black/10 bg-zinc-50 p-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Access account</p>
          <p className="mt-2 text-sm font-medium text-zinc-800">{demoLabel.replace(/^Seed account:\s*/i, "")}</p>
        </div>
      ) : null}
      <label className="grid gap-2 text-sm font-medium">
        {emailLabel}
        <input
          autoComplete="email"
          className="rounded-xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-zinc-500"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          value={email}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {passwordLabel}
        <input
          autoComplete="current-password"
          className="rounded-xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-zinc-500"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </label>
      <button
        className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white active:scale-[0.98]"
        disabled={pending}
        type="submit"
      >
        <LogIn className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
        {pending ? "登录中" : submitLabel}
      </button>
      <p className="flex gap-2 text-sm leading-6 text-zinc-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-clay" strokeWidth={1.8} />
        <span>{message}</span>
      </p>
    </form>
  );
}
