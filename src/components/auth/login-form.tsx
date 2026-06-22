"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { authMessageForCode } from "@/lib/auth-messages";

type CustomerAuthMode = "login" | "register" | "password_reset";

const modeCopy: Record<CustomerAuthMode, {
  tab: string;
  submit: string;
  pending: string;
  helper: string;
  message: string;
  codeSubmit: string;
}> = {
  login: {
    tab: "登录",
    submit: "登录",
    pending: "登录中",
    helper: "已有账号请直接输入邮箱和密码登录。",
    message: "请输入邮箱和密码后进入当前站点。",
    codeSubmit: ""
  },
  register: {
    tab: "注册",
    submit: "发送注册验证码",
    pending: "发送中",
    helper: "新访客先验证邮箱，再设置密码完成注册。",
    message: "请输入邮箱和新密码，我们会发送注册验证码。",
    codeSubmit: "完成注册"
  },
  password_reset: {
    tab: "找回密码",
    submit: "发送找回验证码",
    pending: "发送中",
    helper: "忘记密码时，先验证邮箱，再设置新密码。",
    message: "请输入注册邮箱和新密码，我们会发送找回验证码。",
    codeSubmit: "重置密码并登录"
  }
};

export function LoginForm({
  siteId,
  siteSlug,
  storefrontBasePath,
  defaultEmail,
  defaultName = "Mara Voss",
  initialMessage
}: {
  siteId: string;
  siteSlug: string;
  storefrontBasePath?: string;
  defaultEmail?: string;
  defaultName?: string;
  initialMessage?: string;
}) {
  const sitePath = (path = "/") => {
    const normalizedPath = !path || path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
    const basePath = storefrontBasePath ?? `/site/${siteSlug}`;
    if (!basePath) return normalizedPath;
    return normalizedPath === "/" ? basePath : `${basePath}${normalizedPath}`;
  };
  const [mode, setMode] = useState<CustomerAuthMode>("login");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [name] = useState(defaultName);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState(initialMessage ?? modeCopy.login.message);
  const [pending, setPending] = useState(false);
  const [devCode, setDevCode] = useState("");

  function switchMode(nextMode: CustomerAuthMode) {
    setMode(nextMode);
    setCode("");
    setCodeSent(false);
    setDevCode("");
    setMessage(modeCopy[nextMode].message);
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("正在校验邮箱和密码...");
    try {
      const response = await fetch(`/api/sites/${siteId}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        setPending(false);
        setMessage(authMessageForCode("customer", error.error));
        return;
      }
      window.location.replace(sitePath("/app"));
    } catch {
      setPending(false);
      setMessage("网络异常，未能完成登录，请稍后重试。");
    }
  }

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(mode === "register" ? "正在发送注册验证码..." : "正在发送找回验证码...");
    try {
      const response = await fetch(`/api/sites/${siteId}/auth/email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: mode })
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        setPending(false);
        setMessage(authMessageForCode("customer", error.error));
        return;
      }
      const result = (await response.json()) as { devCode?: string; deliveryStatus?: string; deliveryError?: string };
      setDevCode(result.devCode ?? "");
      setCodeSent(true);
      setPending(false);
      setMessage(
        result.deliveryStatus === "sent"
          ? "验证码已发送，请查看邮箱。"
          : result.devCode
            ? `邮件服务未完成配置，开发验证码：${result.devCode}`
            : `验证码已生成，但邮件发送失败：${result.deliveryError ?? "email_send_failed"}`
      );
    } catch {
      setPending(false);
      setMessage("网络异常，未能发送验证码，请稍后重试。");
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(mode === "register" ? "正在完成注册..." : "正在重置密码...");
    try {
      const response = await fetch(`/api/sites/${siteId}/auth/email-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, code, name, purpose: mode })
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        setPending(false);
        setMessage(authMessageForCode("customer", error.error));
        return;
      }
      window.location.replace(sitePath("/app"));
    } catch {
      setPending(false);
      setMessage("网络异常，未能完成验证，请稍后重试。");
    }
  }

  const isEmailCodeMode = mode !== "login";
  const submitHandler = mode === "login" ? login : codeSent ? verifyCode : requestCode;

  return (
    <form action={sitePath("/login/submit")} className="mx-auto grid w-full max-w-[420px] min-w-0 gap-3 text-white" method="post" onSubmit={submitHandler}>
      <button
        className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-[6px] border border-white/20 bg-transparent px-4 text-base font-semibold text-white transition hover:border-white/42 hover:bg-white/[0.06] active:scale-[0.99]"
        type="button"
        onClick={() => setMessage("Google 登录是生产 OAuth 入口；当前演示版本请使用邮箱登录。")}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_18px_-12px_rgba(255,255,255,0.9)]">
          <img className="h-5 w-5" src="/assets/brand/google-g.svg" alt="" aria-hidden="true" />
        </span>
        <span>继续使用 Google</span>
      </button>
      <div className="flex items-center justify-center gap-4 py-2">
        <div className="h-px flex-1 bg-white/22" />
        <span className="text-sm text-white/58">或者</span>
        <div className="h-px flex-1 bg-white/22" />
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-[8px] border border-white/10 bg-white/[0.04] p-1">
        {(["login", "register", "password_reset"] as CustomerAuthMode[]).map((item) => (
          <button
            className={`min-h-[36px] rounded-[6px] px-2 text-sm font-semibold transition ${mode === item ? "bg-white text-black" : "text-white/64 hover:bg-white/[0.06] hover:text-white"}`}
            key={item}
            onClick={() => switchMode(item)}
            type="button"
          >
            {modeCopy[item].tab}
          </button>
        ))}
      </div>
      <input name="name" type="hidden" value={name} />
      <label className="sr-only" htmlFor={`${siteSlug}-customer-email`}>
        Email
      </label>
      <input
        autoComplete="email"
        className="min-h-[48px] min-w-0 rounded-[6px] border border-white bg-white px-4 text-base text-gray-900 shadow-sm outline-none transition placeholder:text-gray-500 focus:border-white focus:ring-2 focus:ring-white/24"
        id={`${siteSlug}-customer-email`}
        name="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="请输入邮箱"
        required
        type="email"
        value={email}
      />
      <label className="sr-only" htmlFor={`${siteSlug}-customer-password`}>
        Password
      </label>
      <input
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        className="min-h-[48px] min-w-0 rounded-[6px] border border-white bg-white px-4 text-base text-gray-900 shadow-sm outline-none transition placeholder:text-gray-500 focus:border-white focus:ring-2 focus:ring-white/24"
        id={`${siteSlug}-customer-password`}
        name="password"
        onChange={(event) => setPassword(event.target.value)}
        placeholder={mode === "login" ? "请输入密码" : "设置新密码"}
        required
        type="password"
        value={password}
      />
      {isEmailCodeMode && codeSent ? (
        <>
          <label className="sr-only" htmlFor={`${siteSlug}-customer-code`}>
            Verification code
          </label>
          <input
            autoComplete="one-time-code"
            className="min-h-[48px] min-w-0 rounded-[6px] border border-white bg-white px-4 text-center font-mono text-lg tracking-[0.28em] text-gray-900 shadow-sm outline-none transition placeholder:text-center placeholder:text-base placeholder:tracking-normal placeholder:text-gray-500 focus:border-white focus:ring-2 focus:ring-white/24"
            id={`${siteSlug}-customer-code`}
            inputMode="numeric"
            maxLength={6}
            name="code"
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="请输入 6 位验证码"
            required
            type="text"
            value={code}
          />
        </>
      ) : null}
      <button className="inline-flex min-h-[48px] items-center justify-center rounded-[6px] bg-white px-5 text-base font-semibold text-black transition hover:bg-gray-200 active:scale-[0.99]" disabled={pending} type="submit">
        {pending ? (isEmailCodeMode && !codeSent ? modeCopy[mode].pending : "验证中") : isEmailCodeMode && codeSent ? modeCopy[mode].codeSubmit : modeCopy[mode].submit}
      </button>
      <p className="text-center text-xs leading-5 text-gray-400">{modeCopy[mode].helper}</p>
      {isEmailCodeMode && codeSent ? (
        <button
          className="text-center text-xs font-medium leading-5 text-white/72 underline decoration-white/28 underline-offset-4 transition hover:text-white"
          disabled={pending}
          onClick={() => {
            setCodeSent(false);
            setCode("");
            setMessage("可以重新发送验证码，或更换邮箱地址。");
          }}
          type="button"
        >
          更换邮箱或重新发送验证码
        </button>
      ) : null}
      {mode !== "login" ? (
        <p className="text-center text-xs leading-5 text-gray-400">
          注册即表示您同意我们的{" "}
          <Link className="text-white underline decoration-white/38 underline-offset-4 hover:text-gray-200" href={sitePath("/policies/terms")} prefetch={false}>
            服务条款
          </Link>{" "}
          和{" "}
          <Link className="text-white underline decoration-white/38 underline-offset-4 hover:text-gray-200" href={sitePath("/policies/privacy")} prefetch={false}>
            隐私政策
          </Link>
          .
        </p>
      ) : null}
      <div className="mt-1 rounded-[8px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/62">
        <div className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-white/70" strokeWidth={1.8} />
          <span>{message}{devCode && isEmailCodeMode && codeSent ? ` (${devCode})` : ""}</span>
        </div>
      </div>
    </form>
  );
}
