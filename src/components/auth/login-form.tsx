"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { authMessageForCode } from "@/lib/auth-messages";

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
  const [email, setEmail] = useState(defaultEmail ?? "mara@northpier.studio");
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [message, setMessage] = useState(initialMessage ?? "输入邮箱后，我们会发送 6 位验证码用于注册或登录。");
  const [pending, setPending] = useState(false);
  const [devCode, setDevCode] = useState("");

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("正在发送邮箱验证码...");
    try {
      const response = await fetch(`/api/sites/${siteId}/auth/email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        setPending(false);
        setMessage(authMessageForCode("customer", error.error));
        return;
      }
      const result = (await response.json()) as { devCode?: string; deliveryStatus?: string; deliveryError?: string };
      setDevCode(result.devCode ?? "");
      setStep("code");
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
    setMessage("正在验证邮箱并创建当前站点会话...");
    try {
      const response = await fetch(`/api/sites/${siteId}/auth/email-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, name })
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

  return (
    <form action={sitePath("/login/submit")} className="mx-auto grid w-full max-w-[420px] min-w-0 gap-3 text-white" method="post" onSubmit={step === "email" ? requestCode : verifyCode}>
      <button
        className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-[6px] border border-white/20 bg-transparent px-4 text-base font-semibold text-white transition hover:border-white/42 hover:bg-white/[0.06] active:scale-[0.99]"
        type="button"
        onClick={() => setMessage("Google sign-in is a production OAuth entry. Use email in this demo build.")}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white shadow-[0_6px_18px_-12px_rgba(255,255,255,0.9)]">
          <img className="h-5 w-5" src="/assets/brand/google-g.svg" alt="" aria-hidden="true" />
        </span>
        <span>Continue with Google</span>
      </button>
      <div className="flex items-center justify-center gap-4 py-2">
        <div className="h-px flex-1 bg-white/22" />
        <span className="text-sm text-white/58">or</span>
        <div className="h-px flex-1 bg-white/22" />
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
        placeholder="Enter your email"
        required
        type="email"
        value={email}
      />
      {step === "code" ? (
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
            placeholder="Enter 6-digit code"
            required
            type="text"
            value={code}
          />
        </>
      ) : null}
      <button className="inline-flex min-h-[48px] items-center justify-center rounded-[6px] bg-white px-5 text-base font-semibold text-black transition hover:bg-gray-200 active:scale-[0.99]" disabled={pending} type="submit">
        {pending ? (step === "email" ? "Sending code" : "Verifying") : step === "email" ? "Send Email Code" : "Verify & Continue"}
      </button>
      {step === "code" ? (
        <button
          className="text-center text-xs font-medium leading-5 text-white/72 underline decoration-white/28 underline-offset-4 transition hover:text-white"
          disabled={pending}
          onClick={() => {
            setStep("email");
            setCode("");
            setMessage("可以重新发送验证码，或更换邮箱地址。");
          }}
          type="button"
        >
          Use a different email or resend code
        </button>
      ) : (
        <p className="text-center text-xs leading-5 text-gray-400">New visitors register here; returning customers sign in with the same email.</p>
      )}
      <p className="text-center text-xs leading-5 text-gray-400">
        By signing up, you agree to our{" "}
        <Link className="text-white underline decoration-white/38 underline-offset-4 hover:text-gray-200" href={sitePath("/policies/terms")} prefetch={false}>
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link className="text-white underline decoration-white/38 underline-offset-4 hover:text-gray-200" href={sitePath("/policies/privacy")} prefetch={false}>
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-1 rounded-[8px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/62">
        <div className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-white/70" strokeWidth={1.8} />
          <span>{message}{devCode && step === "code" ? ` (${devCode})` : ""}</span>
        </div>
      </div>
    </form>
  );
}
