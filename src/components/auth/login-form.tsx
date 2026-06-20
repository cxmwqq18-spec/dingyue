"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { authMessageForCode } from "@/lib/auth-messages";

export function LoginForm({
  siteId,
  siteSlug,
  defaultEmail,
  defaultPassword = "mara123",
  defaultName = "Mara Voss",
  initialMessage
}: {
  siteId: string;
  siteSlug: string;
  defaultEmail?: string;
  defaultPassword?: string;
  defaultName?: string;
  initialMessage?: string;
}) {
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
      window.location.replace(`/site/${siteSlug}/app`);
    } catch {
      setPending(false);
      setMessage("网络异常，未能完成登录，请稍后重试。");
    }
  }

  return (
    <form action={`/site/${siteSlug}/login/submit`} className="mx-auto grid w-full max-w-[420px] min-w-0 gap-3 text-white" method="post" onSubmit={submit}>
      <button
        className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-[6px] border border-white/20 bg-transparent px-4 text-base font-semibold text-white transition hover:border-white/42 hover:bg-white/[0.06] active:scale-[0.99]"
        type="button"
        onClick={() => setMessage("Google sign-in is a production OAuth entry. Use email in this demo build.")}
      >
        <GoogleMark />
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
        <Link className="text-white underline decoration-white/38 underline-offset-4 hover:text-gray-200" href={`/site/${siteSlug}/terms-of-service`}>
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link className="text-white underline decoration-white/38 underline-offset-4 hover:text-gray-200" href={`/site/${siteSlug}/privacy-policy`}>
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

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
