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
  defaultPassword = "mara123",
  defaultName = "Mara Voss",
  initialMessage
}: {
  siteId: string;
  siteSlug: string;
  storefrontBasePath?: string;
  defaultEmail?: string;
  defaultPassword?: string;
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
  const [password, setPassword] = useState(defaultPassword);
  const [name, setName] = useState(defaultName);
  const [message, setMessage] = useState(initialMessage ?? "登录后进入当前站点的私人照片工作台。");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("正在校验密码并创建当前站点会话...");
    try {
      const response = await fetch(`/api/sites/${siteId}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name })
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

  return (
    <form action={sitePath("/login/submit")} className="mx-auto grid w-full max-w-[420px] min-w-0 gap-3 text-white" method="post" onSubmit={submit}>
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
      <input name="password" type="hidden" value={password} />
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
      <button className="inline-flex min-h-[48px] items-center justify-center rounded-[6px] bg-white px-5 text-base font-semibold text-black transition hover:bg-gray-200 active:scale-[0.99]" disabled={pending} type="submit">
        {pending ? "Signing in" : "Get Started with Email"}
      </button>
      <p className="text-center text-xs leading-5 text-gray-400">Already have an account? You will be logged in automatically.</p>
      <p className="text-center text-xs leading-5 text-gray-400">
        By signing up, you agree to our{" "}
        <Link className="text-white underline decoration-white/38 underline-offset-4 hover:text-gray-200" href={sitePath("/terms-of-service")}>
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link className="text-white underline decoration-white/38 underline-offset-4 hover:text-gray-200" href={sitePath("/privacy-policy")}>
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-1 rounded-[8px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white/62">
        <div className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-white/70" strokeWidth={1.8} />
          <span>{message}</span>
        </div>
      </div>
    </form>
  );
}
