"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { authMessageForCode } from "@/lib/auth-messages";
import { customerPasswordPolicyMessage, getCustomerPasswordPolicyError } from "@/lib/customer-password-policy";

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
    tab: "Log in",
    submit: "Log in",
    pending: "Signing in",
    helper: "Already have an account? Sign in with your email and password.",
    message: "Enter your email and password to open this site.",
    codeSubmit: ""
  },
  register: {
    tab: "Register",
    submit: "Send registration code",
    pending: "Sending",
    helper: "New visitors verify email first, then set a password to finish registration.",
    message: "Enter your email and new password. We will send a registration code.",
    codeSubmit: "Complete registration"
  },
  password_reset: {
    tab: "Reset password",
    submit: "Send reset code",
    pending: "Sending",
    helper: "Forgot your password? Verify your email, then set a new password.",
    message: "Enter your account email and new password. We will send a reset code.",
    codeSubmit: "Reset password and sign in"
  }
};

export function LoginForm({
  siteId,
  siteSlug,
  storefrontBasePath,
  defaultEmail,
  defaultName = "Mara Voss",
  initialMessage,
  returnTo
}: {
  siteId: string;
  siteSlug: string;
  storefrontBasePath?: string;
  defaultEmail?: string;
  defaultName?: string;
  initialMessage?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const sitePath = (path = "/") => {
    const normalizedPath = !path || path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
    const basePath = storefrontBasePath ?? `/site/${siteSlug}`;
    if (!basePath) return normalizedPath;
    return normalizedPath === "/" ? basePath : `${basePath}${normalizedPath}`;
  };
  const [mode, setMode] = useState<CustomerAuthMode>("login");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name] = useState(defaultName);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState(initialMessage ?? modeCopy.login.message);
  const [pending, setPending] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [codeCooldownUntil, setCodeCooldownUntil] = useState(0);
  const [now, setNow] = useState(0);

  const cooldownKey = useMemo(() => {
    const normalizedEmail = email.trim().toLowerCase();
    return normalizedEmail && mode !== "login" ? `customer-email-code:${siteId}:${mode}:${normalizedEmail}` : "";
  }, [email, mode, siteId]);
  const cooldownSeconds = Math.max(0, Math.ceil((codeCooldownUntil - now) / 1000));

  function switchMode(nextMode: CustomerAuthMode) {
    setMode(nextMode);
    setCode("");
    setCodeSent(false);
    setDevCode("");
    setConfirmPassword("");
    setMessage(modeCopy[nextMode].message);
  }

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!cooldownKey) {
      setCodeCooldownUntil(0);
      return;
    }
    const stored = Number(window.localStorage.getItem(cooldownKey) ?? "0");
    setCodeCooldownUntil(Number.isFinite(stored) ? stored : 0);
  }, [cooldownKey]);

  function startCodeCooldown(seconds = 60) {
    const until = Date.now() + seconds * 1000;
    setCodeCooldownUntil(until);
    if (cooldownKey) window.localStorage.setItem(cooldownKey, String(until));
  }

  function openCustomerWorkspace() {
    const href = returnTo && returnTo.startsWith(sitePath("/")) ? returnTo : sitePath("/app");
    window.dispatchEvent(new CustomEvent("storefront:navigation-start", { detail: { href } }));
    router.replace(href);
  }

  function validateNewPassword() {
    const error = getCustomerPasswordPolicyError(password, confirmPassword || undefined);
    if (error) {
      setMessage(authMessageForCode("customer", error));
      return false;
    }
    return true;
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("Checking your email and password...");
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
      openCustomerWorkspace();
    } catch {
      setPending(false);
      setMessage("Network error. We could not complete sign-in. Please try again.");
    }
  }

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateNewPassword()) return;
    if (cooldownSeconds > 0) {
      setMessage(`Please wait ${cooldownSeconds}s before sending another verification code.`);
      return;
    }
    setPending(true);
    setMessage(mode === "register" ? "Sending your registration code..." : "Sending your reset code...");
    try {
      const response = await fetch(`/api/sites/${siteId}/auth/email-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: mode })
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        if (response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) startCodeCooldown(retryAfter);
        setPending(false);
        setMessage(authMessageForCode("customer", error.error));
        return;
      }
      const result = (await response.json()) as { devCode?: string; deliveryStatus?: string; deliveryError?: string };
      setDevCode(result.devCode ?? "");
      setCodeSent(true);
      startCodeCooldown(60);
      setPending(false);
      setMessage(
        result.deliveryStatus === "sent"
          ? "Code sent. Please check your email."
          : result.devCode
            ? `Email delivery is not fully configured. Development code: ${result.devCode}`
            : `Code generated, but email delivery failed: ${result.deliveryError ?? "email_send_failed"}`
      );
    } catch {
      setPending(false);
      setMessage("Network error. We could not send the code. Please try again.");
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateNewPassword()) return;
    setPending(true);
    setMessage(mode === "register" ? "Completing registration..." : "Resetting your password...");
    try {
      const response = await fetch(`/api/sites/${siteId}/auth/email-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword, code, name, purpose: mode })
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        setPending(false);
        setMessage(authMessageForCode("customer", error.error));
        return;
      }
      openCustomerWorkspace();
    } catch {
      setPending(false);
      setMessage("Network error. We could not verify the code. Please try again.");
    }
  }

  const isEmailCodeMode = mode !== "login";
  const submitHandler = mode === "login" ? login : codeSent ? verifyCode : requestCode;

  return (
    <form action={sitePath("/login/submit")} className="mx-auto grid w-full max-w-[420px] min-w-0 gap-3 text-white" method="post" onSubmit={submitHandler}>
      <button
        className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-[6px] border border-white/20 bg-transparent px-4 text-base font-semibold text-white transition hover:border-white/42 hover:bg-white/[0.06] active:scale-[0.99]"
        type="button"
        onClick={() => setMessage("Google is reserved for the production OAuth entry. Use email login in this build.")}
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
        placeholder="Email address"
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
        placeholder={mode === "login" ? "Password" : "Set a new password"}
        required
        type="password"
        value={password}
      />
      {isEmailCodeMode ? (
        <>
          <label className="sr-only" htmlFor={`${siteSlug}-customer-confirm-password`}>
            Confirm password
          </label>
          <input
            autoComplete="new-password"
            className="min-h-[48px] min-w-0 rounded-[6px] border border-white bg-white px-4 text-base text-gray-900 shadow-sm outline-none transition placeholder:text-gray-500 focus:border-white focus:ring-2 focus:ring-white/24"
            id={`${siteSlug}-customer-confirm-password`}
            name="confirmPassword"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm new password"
            required
            type="password"
            value={confirmPassword}
          />
          <p className="text-xs leading-5 text-white/58">{customerPasswordPolicyMessage}</p>
        </>
      ) : null}
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
            placeholder="Enter 6-digit code"
            required
            type="text"
            value={code}
          />
        </>
      ) : null}
      <button className="inline-flex min-h-[48px] items-center justify-center rounded-[6px] bg-white px-5 text-base font-semibold text-black transition hover:bg-gray-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-white/60 disabled:text-black/60" disabled={pending || (isEmailCodeMode && !codeSent && cooldownSeconds > 0)} type="submit">
        {pending
          ? (isEmailCodeMode && !codeSent ? modeCopy[mode].pending : "Verifying")
          : isEmailCodeMode && !codeSent && cooldownSeconds > 0
            ? `Send again in ${cooldownSeconds}s`
            : isEmailCodeMode && codeSent
              ? modeCopy[mode].codeSubmit
              : modeCopy[mode].submit}
      </button>
      <p className="text-center text-xs leading-5 text-gray-400">{modeCopy[mode].helper}</p>
      {isEmailCodeMode && codeSent ? (
        <button
          className="text-center text-xs font-medium leading-5 text-white/72 underline decoration-white/28 underline-offset-4 transition hover:text-white"
          disabled={pending}
          onClick={() => {
            setCodeSent(false);
            setCode("");
            setMessage("You can resend the code or use a different email address.");
          }}
          type="button"
        >
          Change email or resend code
        </button>
      ) : null}
      {mode !== "login" ? (
        <p className="text-center text-xs leading-5 text-gray-400">
          By registering, you agree to our{" "}
          <Link className="text-white underline decoration-white/38 underline-offset-4 hover:text-gray-200" href={sitePath("/policies/terms")}>
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link className="text-white underline decoration-white/38 underline-offset-4 hover:text-gray-200" href={sitePath("/policies/privacy")}>
            Privacy Policy
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
