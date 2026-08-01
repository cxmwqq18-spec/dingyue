"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { dispatchCustomerBootstrapInvalidation } from "@/components/storefront/customer-bootstrap-events";
import { authMessageForCode } from "@/lib/auth-messages";
import { customerPasswordPolicyMessage, getCustomerPasswordPolicyError } from "@/lib/customer-password-policy";

type CustomerAuthMode = "login" | "register" | "password_reset";
type LoginLocale = "en" | "es";

type LoginModeCopy = Record<CustomerAuthMode, {
  tab: string;
  submit: string;
  pending: string;
  helper: string;
  message: string;
  codeSubmit: string;
}>;

const modeCopyByLocale: Record<LoginLocale, LoginModeCopy> = {
  en: {
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
  },
  es: {
    login: {
      tab: "Entrar",
      submit: "Entrar",
      pending: "Entrando",
      helper: "Si ya tienes cuenta, entra con tu email y contrasena.",
      message: "Introduce tu email y contrasena para abrir este sitio.",
      codeSubmit: ""
    },
    register: {
      tab: "Registro",
      submit: "Enviar codigo",
      pending: "Enviando",
      helper: "Los nuevos visitantes verifican el email y despues crean una contrasena.",
      message: "Introduce tu email y una nueva contrasena. Te enviaremos un codigo de registro.",
      codeSubmit: "Completar registro"
    },
    password_reset: {
      tab: "Restablecer",
      submit: "Enviar codigo",
      pending: "Enviando",
      helper: "Si olvidaste la contrasena, verifica tu email y crea una nueva.",
      message: "Introduce el email de tu cuenta y una nueva contrasena. Te enviaremos un codigo.",
      codeSubmit: "Restablecer y entrar"
    }
  }
};

const loginCopyByLocale: Record<LoginLocale, {
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  newPasswordPlaceholder: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  passwordPolicy: string;
  codeLabel: string;
  codePlaceholder: string;
  verifying: string;
  sendAgain: (seconds: number) => string;
  changeEmail: string;
  resendReady: string;
  termsPrefix: string;
  terms: string;
  and: string;
  privacy: string;
  checking: string;
  networkLogin: string;
  cooldown: (seconds: number) => string;
  sendingRegister: string;
  sendingReset: string;
  codeSent: string;
  emailDevCode: (code: string) => string;
  emailFailed: (reason: string) => string;
  networkCode: string;
  completingRegister: string;
  resettingPassword: string;
  networkVerify: string;
}> = {
  en: {
    emailLabel: "Email",
    emailPlaceholder: "Email address",
    passwordLabel: "Password",
    passwordPlaceholder: "Password",
    newPasswordPlaceholder: "Set a new password",
    confirmPasswordLabel: "Confirm password",
    confirmPasswordPlaceholder: "Confirm new password",
    passwordPolicy: customerPasswordPolicyMessage,
    codeLabel: "Verification code",
    codePlaceholder: "Enter 6-digit code",
    verifying: "Verifying",
    sendAgain: (seconds) => `Send again in ${seconds}s`,
    changeEmail: "Change email or resend code",
    resendReady: "You can resend the code or use a different email address.",
    termsPrefix: "By registering, you agree to our",
    terms: "Terms of Service",
    and: "and",
    privacy: "Privacy Policy",
    checking: "Checking your email and password...",
    networkLogin: "Network error. We could not complete sign-in. Please try again.",
    cooldown: (seconds) => `Please wait ${seconds}s before sending another verification code.`,
    sendingRegister: "Sending your registration code...",
    sendingReset: "Sending your reset code...",
    codeSent: "Code sent. Please check your email.",
    emailDevCode: (code) => `Email delivery is not fully configured. Development code: ${code}`,
    emailFailed: (reason) => `Code generated, but email delivery failed: ${reason}`,
    networkCode: "Network error. We could not send the code. Please try again.",
    completingRegister: "Completing registration...",
    resettingPassword: "Resetting your password...",
    networkVerify: "Network error. We could not verify the code. Please try again."
  },
  es: {
    emailLabel: "Email",
    emailPlaceholder: "Direccion de email",
    passwordLabel: "Contrasena",
    passwordPlaceholder: "Contrasena",
    newPasswordPlaceholder: "Crea una nueva contrasena",
    confirmPasswordLabel: "Confirmar contrasena",
    confirmPasswordPlaceholder: "Confirma la nueva contrasena",
    passwordPolicy: "La contrasena debe tener al menos 6 caracteres.",
    codeLabel: "Codigo de verificacion",
    codePlaceholder: "Introduce el codigo de 6 digitos",
    verifying: "Verificando",
    sendAgain: (seconds) => `Enviar de nuevo en ${seconds}s`,
    changeEmail: "Cambiar email o reenviar codigo",
    resendReady: "Puedes reenviar el codigo o usar otro email.",
    termsPrefix: "Al registrarte, aceptas nuestros",
    terms: "Terminos del servicio",
    and: "y",
    privacy: "Politica de privacidad",
    checking: "Comprobando email y contrasena...",
    networkLogin: "Error de red. No pudimos completar el acceso. Intentalo de nuevo.",
    cooldown: (seconds) => `Espera ${seconds}s antes de enviar otro codigo de verificacion.`,
    sendingRegister: "Enviando tu codigo de registro...",
    sendingReset: "Enviando tu codigo de restablecimiento...",
    codeSent: "Codigo enviado. Revisa tu email.",
    emailDevCode: (code) => `El envio de email no esta configurado del todo. Codigo de desarrollo: ${code}`,
    emailFailed: (reason) => `Codigo generado, pero fallo el envio por email: ${reason}`,
    networkCode: "Error de red. No pudimos enviar el codigo. Intentalo de nuevo.",
    completingRegister: "Completando registro...",
    resettingPassword: "Restableciendo tu contrasena...",
    networkVerify: "Error de red. No pudimos verificar el codigo. Intentalo de nuevo."
  }
};

const spanishAuthMessages: Record<string, string> = {
  "Enter your email and password to open this site.": "Introduce tu email y contrasena para abrir este sitio.",
  invalid_customer_credentials: "El email o la contrasena del cliente no son correctos.",
  missing_email: "Introduce tu direccion de email.",
  missing_email_or_code: "Introduce tu email y codigo de verificacion.",
  missing_email_or_password: "Introduce email y contrasena.",
  invalid_email: "Introduce un email valido.",
  invalid_verification_code: "El codigo de verificacion no es correcto. Revisalo e intentalo de nuevo.",
  verification_code_expired: "Este codigo ha caducado. Envia uno nuevo.",
  customer_already_exists: "Este email ya esta registrado. Entra con tu cuenta.",
  customer_not_found_for_site: "No se encontro una cuenta de cliente con este email en este sitio.",
  email_code_send_failed: "No pudimos enviar el email de verificacion. Intentalo de nuevo.",
  email_code_verify_failed: "No pudimos verificar el codigo de email. Intentalo de nuevo.",
  email_provider_not_configured: "El envio de email aun no esta configurado del todo.",
  resend_invalid_api_key: "La clave API del servicio de email no es valida.",
  resend_domain_not_verified: "El dominio de envio de email no esta verificado.",
  resend_rate_limited: "El servicio de email tiene limite temporal. Intentalo mas tarde.",
  rate_limited: "Espera antes de intentarlo de nuevo.",
  password_min_6_chars: "La contrasena debe tener al menos 6 caracteres.",
  password_required: "Introduce una contrasena.",
  password_complexity_required: "La contrasena debe tener al menos 6 caracteres.",
  password_confirmation_required: "Introduce de nuevo la contrasena para confirmarla.",
  password_confirmation_mismatch: "Las dos contrasenas no coinciden.",
  site_not_found: "Este sitio no existe o fue eliminado.",
  customer_login_failed: "No se pudo iniciar sesion. Intentalo de nuevo."
};

function authMessageForLocale(locale: LoginLocale, code?: string) {
  if (locale !== "es") return authMessageForCode("customer", code);
  if (!code) return modeCopyByLocale.es.login.message;
  return spanishAuthMessages[code] ?? spanishAuthMessages[authMessageForCode("customer", code)] ?? code.replaceAll("_", " ");
}

function normalizeInitialMessage(locale: LoginLocale, initialMessage: string | undefined, initialMode: CustomerAuthMode) {
  if (!initialMessage) return modeCopyByLocale[locale][initialMode].message;
  if (locale !== "es") return initialMessage;
  return spanishAuthMessages[initialMessage] ?? initialMessage;
}

export function LoginForm({
  siteId,
  siteSlug,
  storefrontBasePath,
  defaultEmail,
  defaultName = "",
  initialMode = "login",
  initialMessage,
  locale = "en",
  returnTo
}: {
  siteId: string;
  siteSlug: string;
  storefrontBasePath?: string;
  defaultEmail?: string;
  defaultName?: string;
  initialMode?: CustomerAuthMode;
  initialMessage?: string;
  locale?: LoginLocale;
  returnTo?: string;
}) {
  const modeCopy = modeCopyByLocale[locale];
  const copy = loginCopyByLocale[locale];
  const sitePath = (path = "/") => {
    const normalizedPath = !path || path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
    const basePath = storefrontBasePath ?? `/site/${siteSlug}`;
    if (!basePath) return normalizedPath;
    return normalizedPath === "/" ? basePath : `${basePath}${normalizedPath}`;
  };
  const [mode, setMode] = useState<CustomerAuthMode>(initialMode);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name] = useState(defaultName);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState(() => normalizeInitialMessage(locale, initialMessage, initialMode));
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
    const fallbackHref = sitePath("/app/create");
    const href = returnTo && returnTo.startsWith(sitePath("/")) ? returnTo : fallbackHref;
    dispatchCustomerBootstrapInvalidation({ reason: "login", siteSlug });
    window.dispatchEvent(new CustomEvent("storefront:navigation-start", { detail: { href } }));
    window.location.assign(href);
  }

  function validateNewPassword() {
    const error = getCustomerPasswordPolicyError(password, confirmPassword || undefined);
    if (error) {
      setMessage(authMessageForLocale(locale, error));
      return false;
    }
    return true;
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(copy.checking);
    try {
      const response = await fetch(`/api/sites/${siteId}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        setPending(false);
        setMessage(authMessageForLocale(locale, error.error));
        return;
      }
      openCustomerWorkspace();
    } catch {
      setPending(false);
      setMessage(copy.networkLogin);
    }
  }

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateNewPassword()) return;
    if (cooldownSeconds > 0) {
      setMessage(copy.cooldown(cooldownSeconds));
      return;
    }
    setPending(true);
    setMessage(mode === "register" ? copy.sendingRegister : copy.sendingReset);
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
        setMessage(authMessageForLocale(locale, error.error));
        return;
      }
      const result = (await response.json()) as { devCode?: string; deliveryStatus?: string; deliveryError?: string };
      setDevCode(result.devCode ?? "");
      setCodeSent(true);
      startCodeCooldown(60);
      setPending(false);
      setMessage(
        result.deliveryStatus === "sent"
          ? copy.codeSent
          : result.devCode
            ? copy.emailDevCode(result.devCode)
            : copy.emailFailed(result.deliveryError ?? "email_send_failed")
      );
    } catch {
      setPending(false);
      setMessage(copy.networkCode);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateNewPassword()) return;
    setPending(true);
    setMessage(mode === "register" ? copy.completingRegister : copy.resettingPassword);
    try {
      const response = await fetch(`/api/sites/${siteId}/auth/email-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword, code, name, purpose: mode })
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        setPending(false);
        setMessage(authMessageForLocale(locale, error.error));
        return;
      }
      openCustomerWorkspace();
    } catch {
      setPending(false);
      setMessage(copy.networkVerify);
    }
  }

  const isEmailCodeMode = mode !== "login";
  const submitHandler = mode === "login" ? login : codeSent ? verifyCode : requestCode;
  const passwordRuleInvalid = isEmailCodeMode && password.trim().length > 0 && password.trim().length < 6;

  return (
    <form action={sitePath("/login/submit")} className="mx-auto grid w-full max-w-[420px] min-w-0 gap-3 text-white" method="post" onSubmit={submitHandler}>
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
        {copy.emailLabel}
      </label>
      <input
        autoComplete="email"
        className="min-h-[48px] min-w-0 rounded-[6px] border border-white bg-white px-4 text-base text-gray-900 shadow-sm outline-none transition placeholder:text-gray-500 focus:border-white focus:ring-2 focus:ring-white/24"
        id={`${siteSlug}-customer-email`}
        name="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder={copy.emailPlaceholder}
        required
        type="email"
        value={email}
      />
      <label className="sr-only" htmlFor={`${siteSlug}-customer-password`}>
        {copy.passwordLabel}
      </label>
      <input
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        className="min-h-[48px] min-w-0 rounded-[6px] border border-white bg-white px-4 text-base text-gray-900 shadow-sm outline-none transition placeholder:text-gray-500 focus:border-white focus:ring-2 focus:ring-white/24"
        id={`${siteSlug}-customer-password`}
        name="password"
        onChange={(event) => setPassword(event.target.value)}
        placeholder={mode === "login" ? copy.passwordPlaceholder : copy.newPasswordPlaceholder}
        required
        minLength={isEmailCodeMode ? 6 : undefined}
        type="password"
        value={password}
      />
      {isEmailCodeMode ? (
        <>
          <label className="sr-only" htmlFor={`${siteSlug}-customer-confirm-password`}>
            {copy.confirmPasswordLabel}
          </label>
          <input
            autoComplete="new-password"
            className="min-h-[48px] min-w-0 rounded-[6px] border border-white bg-white px-4 text-base text-gray-900 shadow-sm outline-none transition placeholder:text-gray-500 focus:border-white focus:ring-2 focus:ring-white/24"
            id={`${siteSlug}-customer-confirm-password`}
            name="confirmPassword"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder={copy.confirmPasswordPlaceholder}
            required
            type="password"
            value={confirmPassword}
          />
          <p className={`text-xs font-medium leading-5 ${passwordRuleInvalid ? "text-red-400" : "text-white/58"}`}>{copy.passwordPolicy}</p>
        </>
      ) : null}
      {isEmailCodeMode && codeSent ? (
        <>
          <label className="sr-only" htmlFor={`${siteSlug}-customer-code`}>
            {copy.codeLabel}
          </label>
          <input
            autoComplete="one-time-code"
            className="min-h-[48px] min-w-0 rounded-[6px] border border-white bg-white px-4 text-center font-mono text-lg tracking-[0.28em] text-gray-900 shadow-sm outline-none transition placeholder:text-center placeholder:text-base placeholder:tracking-normal placeholder:text-gray-500 focus:border-white focus:ring-2 focus:ring-white/24"
            id={`${siteSlug}-customer-code`}
            inputMode="numeric"
            maxLength={6}
            name="code"
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder={copy.codePlaceholder}
            required
            type="text"
            value={code}
          />
        </>
      ) : null}
      <button className="inline-flex min-h-[48px] items-center justify-center rounded-[6px] bg-white px-5 text-base font-semibold text-black transition hover:bg-gray-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-white/60 disabled:text-black/60" disabled={pending || (isEmailCodeMode && !codeSent && cooldownSeconds > 0)} type="submit">
        {pending
          ? (isEmailCodeMode && !codeSent ? modeCopy[mode].pending : copy.verifying)
          : isEmailCodeMode && !codeSent && cooldownSeconds > 0
            ? copy.sendAgain(cooldownSeconds)
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
            setMessage(copy.resendReady);
          }}
          type="button"
        >
          {copy.changeEmail}
        </button>
      ) : null}
      {mode !== "login" ? (
        <p className="text-center text-xs leading-5 text-gray-400">
          {copy.termsPrefix}{" "}
          <Link className="text-white underline decoration-white/38 underline-offset-4 hover:text-gray-200" href={sitePath("/terms")}>
            {copy.terms}
          </Link>{" "}
          {copy.and}{" "}
          <Link className="text-white underline decoration-white/38 underline-offset-4 hover:text-gray-200" href={sitePath("/privacy")}>
            {copy.privacy}
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
