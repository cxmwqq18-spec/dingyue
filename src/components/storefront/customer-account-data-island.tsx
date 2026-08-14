"use client";

import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Download,
  ImageIcon,
  KeyRound,
  Layers3,
  LockKeyhole,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  WalletCards
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { csrfHeader, customerJsonHeaders } from "@/lib/client-csrf";
import { dispatchCustomerBootstrapInvalidation } from "@/components/storefront/customer-bootstrap-events";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import type { PublicCustomer, ThemeRuntimeAsset, ThemeRuntimeData } from "@/lib/types";
import type { LucideIcon } from "lucide-react";

export type AccountSection =
  | "overview"
  | "profile"
  | "security"
  | "subscription"
  | "credits"
  | "purchases"
  | "generation"
  | "downloads"
  | "albums"
  | "models";

type LoadState =
  | { status: "loading"; runtime?: undefined; error?: undefined }
  | { status: "ready"; runtime: ThemeRuntimeData; error?: undefined }
  | { status: "error"; runtime?: undefined; error: string };

type ToastState = { tone: "success" | "error"; message: string } | undefined;

const SECTION_CACHE_TTL_MS = 60_000;
const sectionCache = new Map<string, { cachedAt: number; runtime: ThemeRuntimeData }>();
const sectionInflight = new Map<string, Promise<ThemeRuntimeData>>();

function readCachedSection(cacheKey: string): ThemeRuntimeData | undefined {
  const cached = sectionCache.get(cacheKey);
  if (!cached) return undefined;
  if (Date.now() - cached.cachedAt > SECTION_CACHE_TTL_MS) {
    sectionCache.delete(cacheKey);
    return undefined;
  }
  return cached.runtime;
}

function writeCachedSection(cacheKey: string, runtime: ThemeRuntimeData) {
  sectionCache.set(cacheKey, { cachedAt: Date.now(), runtime });
}

function loadSectionRuntime(cacheKey: string, siteId: string, section: AccountSection): Promise<ThemeRuntimeData> {
  const cached = readCachedSection(cacheKey);
  if (cached) return Promise.resolve(cached);
  const inflight = sectionInflight.get(cacheKey);
  if (inflight) return inflight;
  const request = fetch(`/api/sites/${siteId}/customer/runtime?profile=account&section=${section}`, {
    credentials: "same-origin"
  })
    .then(async (response) => {
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; runtime?: ThemeRuntimeData; error?: string };
      if (!response.ok || !data.ok || !data.runtime) throw new Error(data.error || "account_data_unavailable");
      writeCachedSection(cacheKey, data.runtime);
      return data.runtime;
    })
    .finally(() => {
      sectionInflight.delete(cacheKey);
    });
  sectionInflight.set(cacheKey, request);
  return request;
}

function money(amountCents: number | undefined, currency: string | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format((amountCents ?? 0) / 100);
}

function dateLabel(value: string | undefined) {
  if (!value) return "Not started";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not started";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusLabel(value: string | undefined) {
  if (!value) return "None";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function jobStatusLabel(status: string) {
  if (status === "queued") return "Waiting";
  if (status === "running") return "Creating";
  if (status === "succeeded") return "Delivered";
  if (status === "failed") return "Needs review";
  return "Credits returned";
}

function ledgerLabel(type: string) {
  if (type === "grant") return "Credits added";
  if (type === "reserve") return "Credits held";
  if (type === "consume") return "Credits used";
  if (type === "release") return "Credits returned";
  return "Balance adjusted";
}

function albumStatusLabel(status: string) {
  if (status === "ready") return "Ready";
  if (status === "processing") return "Preparing";
  return "Archived";
}

function requestTitle(jobId: string, index: number) {
  const suffix = jobId.split("_").filter(Boolean).at(-1);
  return `Request ${suffix ? suffix.toUpperCase() : String(index + 1).padStart(2, "0")}`;
}

function apiErrorMessage(error: string) {
  const messages: Record<string, string> = {
    asset_file_required: "Choose an image before uploading.",
    asset_file_must_be_image: "Profile avatars must be image files.",
    asset_file_too_large: "That image is too large for this account.",
    current_password_incorrect: "The current password is not correct.",
    current_password_required: "Enter your current password.",
    customer_name_required: "Enter a display name.",
    password_confirmation_mismatch: "The password confirmation does not match.",
    password_confirmation_required: "Confirm your new password.",
    password_min_6_chars: "Password must be at least 6 characters.",
    password_required: "Enter a new password.",
    profile_avatar_asset_invalid: "Upload a profile avatar image before saving it."
  };
  return messages[error] ?? "The update could not be saved. Please try again.";
}

function useAccountSectionRuntime(customerId: string, siteId: string, section: AccountSection, initialRuntime?: ThemeRuntimeData): LoadState {
  const cacheKey = `${siteId}:${customerId}:${section}`;
  const [state, setState] = useState<LoadState>(() => {
    if (initialRuntime) return { status: "ready", runtime: initialRuntime };
    const cached = readCachedSection(cacheKey);
    return cached ? { status: "ready", runtime: cached } : { status: "loading" };
  });

  useEffect(() => {
    if (initialRuntime) {
      writeCachedSection(cacheKey, initialRuntime);
      setState({ status: "ready", runtime: initialRuntime });
      return;
    }
    const cached = readCachedSection(cacheKey);
    if (cached) {
      setState({ status: "ready", runtime: cached });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    loadSectionRuntime(cacheKey, siteId, section)
      .then((runtime) => {
        if (!cancelled) setState({ status: "ready", runtime });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", error: error instanceof Error ? error.message : "account_data_unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, initialRuntime, section, siteId]);

  return state;
}

function AccountCard({
  children,
  customerId,
  id,
  initialRuntime,
  loadingTitle,
  section,
  siteId
}: {
  children: (runtime: ThemeRuntimeData) => ReactNode;
  customerId: string;
  id: string;
  initialRuntime?: ThemeRuntimeData;
  loadingTitle: string;
  section: AccountSection;
  siteId: string;
}) {
  const state = useAccountSectionRuntime(customerId, siteId, section, initialRuntime);
  return (
    <div className="scroll-mt-28 rounded-[8px] border border-white/10 bg-[#0c1018] p-4 shadow-[0_28px_90px_-60px_rgba(0,0,0,0.95)] sm:p-5" id={id}>
      {state.status === "loading" ? <LoadingBlock title={loadingTitle} /> : null}
      {state.status === "error" ? <ErrorBlock /> : null}
      {state.status === "ready" ? children(state.runtime) : null}
    </div>
  );
}

function LoadingBlock({ title }: { title: string }) {
  return (
    <div aria-busy="true">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/42">{title}</p>
      <div className="mt-5 grid gap-3">
        <div className="h-6 w-32 rounded-full bg-white/10" />
        <div className="h-20 rounded-[8px] bg-white/[0.055]" />
        <div className="h-20 rounded-[8px] bg-white/[0.055]" />
      </div>
    </div>
  );
}

function ErrorBlock() {
  return (
    <p className="rounded-[8px] border border-dashed border-white/14 bg-white/[0.045] p-4 text-sm text-white/68">
      This account module could not load. Refresh the page or sign in again.
    </p>
  );
}

function SectionHeader({ icon: Icon, kicker, title, subtitle }: { icon: LucideIcon; kicker: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-white text-[#0b0d12]">
        <Icon className="h-5 w-5" strokeWidth={1.9} />
      </span>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/42">{kicker}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-normal text-white sm:text-2xl">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-white/62">{subtitle}</p>
      </div>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-[8px] border border-white/10 bg-white/[0.045] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-white/48">{hint}</p> : null}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[8px] border border-dashed border-white/14 bg-white/[0.035] p-4 text-sm leading-6 text-white/58">{children}</p>
  );
}

function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const toneClass = tone === "good"
    ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
    : tone === "warn"
    ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
    : "border-white/12 bg-white/[0.055] text-white/70";
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

function AccountToast({ state }: { state: ToastState }) {
  if (!state) return null;
  const className = state.tone === "success"
    ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-50"
    : "border-rose-300/25 bg-rose-300/10 text-rose-50";
  return <p className={`rounded-[8px] border p-3 text-sm ${className}`}>{state.message}</p>;
}

function accountCustomer(runtime: ThemeRuntimeData, fallback: PublicCustomer): PublicCustomer {
  return runtime.customer ?? fallback;
}

function OverviewCard({ basePath, fallbackCustomer, runtime }: { basePath: string; fallbackCustomer: PublicCustomer; runtime: ThemeRuntimeData }) {
  const customer = accountCustomer(runtime, fallbackCustomer);
  const activeSubscription = (runtime.subscriptions ?? []).find((subscription) => subscription.status === "active" || subscription.status === "trialing") ?? runtime.subscriptions?.[0];
  const latestJob = runtime.jobs[0];
  const latestOrder = runtime.orders?.[0];
  const balance = customer.balance.available ?? 0;
  return (
    <div className="grid gap-5">
      <SectionHeader icon={WalletCards} kicker="Overview" title="Account command center" subtitle="Review your plan, credit balance, private requests, and delivered work from one place." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Available credits" value={balance} hint={`${customer.balance.reserved ?? 0} credits reserved`} />
        <StatTile label="Plan" value={activeSubscription?.productName ?? activeSubscription?.priceLabel ?? "No plan"} hint={activeSubscription ? `${statusLabel(activeSubscription.status)} - renews ${dateLabel(activeSubscription.currentPeriodEnd)}` : "Choose a package or subscription when ready"} />
        <StatTile label="Recent request" value={latestJob ? jobStatusLabel(latestJob.status) : "None"} hint={latestJob ? dateLabel(latestJob.updatedAt) : "Generated photos will appear after your first request"} />
        <StatTile label="Last checkout" value={latestOrder ? money(latestOrder.amountCents, latestOrder.currency) : "$0"} hint={latestOrder ? `${statusLabel(latestOrder.status)} - ${dateLabel(latestOrder.createdAt)}` : "No purchases yet"} />
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <StorefrontInstantLink className="inline-flex items-center justify-between rounded-[8px] border border-white/10 bg-white text-[#0b0d12] px-4 py-3 text-sm font-semibold transition hover:bg-white/90" href={`${basePath}/app/create`}>
          Open workspace
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
        </StorefrontInstantLink>
        <StorefrontInstantLink className="inline-flex items-center justify-between rounded-[8px] border border-white/12 bg-white/[0.055] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.09]" href={`${basePath}/pricing`}>
          View pricing
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
        </StorefrontInstantLink>
        <StorefrontInstantLink className="inline-flex items-center justify-between rounded-[8px] border border-white/12 bg-white/[0.055] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.09]" href={`${basePath}/tools`}>
          Explore tools
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
        </StorefrontInstantLink>
      </div>
    </div>
  );
}

function ProfileAvatar({ customer, size = "large" }: { customer: PublicCustomer; size?: "large" | "small" }) {
  const className = size === "large"
    ? "h-20 w-20 rounded-[8px]"
    : "h-11 w-11 rounded-[8px]";
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden border border-white/12 bg-white/[0.08] text-white ${className}`}>
      {customer.profile?.avatarUrl ? (
        <img className="h-full w-full object-cover" src={customer.profile.avatarUrl} alt="" />
      ) : (
        <UserRound className={size === "large" ? "h-8 w-8" : "h-5 w-5"} strokeWidth={1.8} />
      )}
    </span>
  );
}

function ProfileCard({ fallbackCustomer, runtime, siteId, siteSlug }: { fallbackCustomer: PublicCustomer; runtime: ThemeRuntimeData; siteId: string; siteSlug: string }) {
  const customer = accountCustomer(runtime, fallbackCustomer);
  const profileAssets = runtime.assets.filter((asset) => asset.subjectRole === "profile_avatar");
  const [name, setName] = useState(customer.name);
  const [avatarUrl, setAvatarUrl] = useState(customer.profile?.avatarUrl);
  const [file, setFile] = useState<File | undefined>();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>();
  const displayCustomer = {
    ...customer,
    name,
    profile: {
      ...customer.profile,
      avatarUrl
    }
  };

  useEffect(() => {
    setName(customer.name);
    setAvatarUrl(customer.profile?.avatarUrl);
  }, [customer.name, customer.profile?.avatarUrl]);

  async function uploadAvatar(): Promise<ThemeRuntimeAsset | undefined> {
    if (!file) return undefined;
    const formData = new FormData();
    formData.set("file", file);
    formData.set("label", file.name.replace(/\.[^.]+$/, "") || "Profile avatar");
    formData.set("role", "input");
    formData.set("subjectRole", "profile_avatar");
    const response = await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets`, {
      method: "POST",
      credentials: "same-origin",
      headers: csrfHeader(`customer_csrf_${siteId}`),
      body: formData
    });
    const data = (await response.json().catch(() => ({}))) as { ok?: boolean; asset?: ThemeRuntimeAsset; error?: string };
    if (!response.ok || !data.ok || !data.asset) throw new Error(data.error || "asset_create_failed");
    return data.asset;
  }

  async function saveProfile(nextAvatarAssetId?: string | null) {
    setSaving(true);
    setToast(undefined);
    try {
      const uploaded = nextAvatarAssetId === undefined ? await uploadAvatar() : undefined;
      const avatarAssetId = nextAvatarAssetId === undefined ? uploaded?.id : nextAvatarAssetId;
      const response = await fetch(`/api/sites/${siteId}/customer/profile`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: customerJsonHeaders(siteId),
        body: JSON.stringify({
          name,
          ...(avatarAssetId !== undefined ? { avatarAssetId } : {})
        })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "profile_update_failed");
      if (uploaded?.previewUrl) setAvatarUrl(uploaded.previewUrl);
      if (typeof nextAvatarAssetId === "string") {
        const selectedAvatar = profileAssets.find((asset) => asset.id === nextAvatarAssetId);
        if (selectedAvatar) setAvatarUrl(selectedAvatar.previewUrl);
      }
      if (nextAvatarAssetId === null) setAvatarUrl(undefined);
      setFile(undefined);
      setToast({ tone: "success", message: "Profile updated." });
      sectionCache.clear();
      dispatchCustomerBootstrapInvalidation({ reason: "manual", siteSlug });
    } catch (error) {
      setToast({ tone: "error", message: apiErrorMessage(error instanceof Error ? error.message : "profile_update_failed") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      <SectionHeader icon={UserRound} kicker="Profile" title="Basic account information" subtitle="Update the name and avatar shown across your private workspace. Email changes are read-only in this version." />
      <AccountToast state={toast} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          className="grid gap-4 rounded-[8px] border border-white/10 bg-white/[0.035] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void saveProfile();
          }}
        >
          <div className="flex items-center gap-4">
            <ProfileAvatar customer={displayCustomer} />
            <label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold text-white">
              Profile avatar
              <input
                accept="image/*"
                className="block w-full rounded-[8px] border border-white/12 bg-[#070a10] px-3 py-2 text-sm font-medium text-white file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#0b0d12]"
                onChange={(event) => setFile(event.currentTarget.files?.[0])}
                type="file"
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-white">
            Display name
            <input className="rounded-[8px] border border-white/12 bg-[#070a10] px-3 py-2 text-sm font-medium text-white outline-none transition focus:border-white/40" maxLength={80} onChange={(event) => setName(event.target.value)} value={name} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-white/56">
            Email address
            <input className="rounded-[8px] border border-white/10 bg-white/[0.035] px-3 py-2 text-sm font-medium text-white/58" readOnly value={customer.email} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-[8px] bg-white px-4 py-2 text-sm font-semibold text-[#0b0d12] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} type="submit">
              <Upload className="h-4 w-4" strokeWidth={1.8} />
              {saving ? "Saving..." : "Save profile"}
            </button>
            {displayCustomer.profile?.avatarUrl ? (
              <button className="rounded-[8px] border border-white/12 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} onClick={() => void saveProfile(null)} type="button">
                Remove avatar
              </button>
            ) : null}
          </div>
        </form>
        <div className="rounded-[8px] border border-white/10 bg-white/[0.035] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">Saved avatars</p>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {profileAssets.length ? profileAssets.slice(0, 8).map((asset) => (
              <button className="aspect-square overflow-hidden rounded-[8px] border border-white/12 bg-white/[0.04] transition hover:border-white/45" key={asset.id} onClick={() => void saveProfile(asset.id)} type="button">
                <img className="h-full w-full object-cover" src={asset.previewUrl} alt={asset.altText || asset.label} />
              </button>
            )) : (
              <p className="col-span-4 text-sm leading-6 text-white/56">Uploaded profile avatars will appear here for quick reuse.</p>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs leading-5 text-white/42">Need to change your email? Contact support so ownership can be verified before the address is updated.</p>
    </div>
  );
}

function SecurityCard({ basePath, fallbackCustomer, runtime, siteId }: { basePath: string; fallbackCustomer: PublicCustomer; runtime: ThemeRuntimeData; siteId: string }) {
  const customer = accountCustomer(runtime, fallbackCustomer);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>();

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setToast(undefined);
    try {
      const response = await fetch(`/api/sites/${siteId}/customer/profile/password`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: customerJsonHeaders(siteId),
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; reauthRequired?: boolean };
      if (!response.ok || !data.ok) throw new Error(data.error || "password_update_failed");
      setToast({ tone: "success", message: "Password updated. Redirecting you to sign in again." });
      window.setTimeout(() => {
        window.location.href = `${basePath}/login?next=${encodeURIComponent(`${basePath}/account`)}`;
      }, 900);
    } catch (error) {
      setToast({ tone: "error", message: apiErrorMessage(error instanceof Error ? error.message : "password_update_failed") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      <SectionHeader icon={LockKeyhole} kicker="Security" title="Password and session protection" subtitle={`Change the password for ${customer.email}. For safety, all active sessions sign out after a password update.`} />
      <AccountToast state={toast} />
      <form className="grid max-w-xl gap-4 rounded-[8px] border border-white/10 bg-white/[0.035] p-4" onSubmit={changePassword}>
        <label className="grid gap-2 text-sm font-semibold text-white">
          Current password
          <input autoComplete="current-password" className="rounded-[8px] border border-white/12 bg-[#070a10] px-3 py-2 text-sm font-medium text-white outline-none transition focus:border-white/40" onChange={(event) => setCurrentPassword(event.target.value)} type="password" value={currentPassword} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-white">
          New password
          <input autoComplete="new-password" className="rounded-[8px] border border-white/12 bg-[#070a10] px-3 py-2 text-sm font-medium text-white outline-none transition focus:border-white/40" onChange={(event) => setNewPassword(event.target.value)} type="password" value={newPassword} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-white">
          Confirm new password
          <input autoComplete="new-password" className="rounded-[8px] border border-white/12 bg-[#070a10] px-3 py-2 text-sm font-medium text-white outline-none transition focus:border-white/40" onChange={(event) => setConfirmPassword(event.target.value)} type="password" value={confirmPassword} />
        </label>
        <button className="inline-flex w-fit items-center gap-2 rounded-[8px] bg-white px-4 py-2 text-sm font-semibold text-[#0b0d12] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} type="submit">
          <KeyRound className="h-4 w-4" strokeWidth={1.8} />
          {saving ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
}

function SubscriptionCard({ basePath, runtime }: { basePath: string; runtime: ThemeRuntimeData }) {
  const subscriptions = runtime.subscriptions ?? [];
  const activeSubscription = subscriptions.find((subscription) => subscription.status === "active" || subscription.status === "trialing") ?? subscriptions[0];
  return (
    <div className="grid gap-5">
      <SectionHeader icon={PackageCheck} kicker="Subscription" title="Plan and billing status" subtitle="View the current subscription tier, renewal window, and credits granted by the plan." />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Current plan" value={activeSubscription?.productName ?? activeSubscription?.priceLabel ?? "No plan"} hint={activeSubscription ? statusLabel(activeSubscription.status) : "No active subscription"} />
        <StatTile label="Credits per cycle" value={activeSubscription?.creditsPerCycle ?? 0} hint={activeSubscription?.interval ? `${statusLabel(activeSubscription.interval)} billing` : "Subscription credits"} />
        <StatTile label="Period end" value={dateLabel(activeSubscription?.currentPeriodEnd)} hint={activeSubscription?.currentPeriodStart ? `Started ${dateLabel(activeSubscription.currentPeriodStart)}` : undefined} />
      </div>
      <div className="rounded-[8px] border border-white/10 bg-white/[0.035] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Payment method</p>
            <p className="mt-1 text-sm leading-6 text-white/58">Cards are handled through secure checkout. This account center does not store or edit card numbers.</p>
          </div>
          <StorefrontInstantLink className="inline-flex items-center gap-2 rounded-[8px] border border-white/12 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]" href={`${basePath}/pricing`}>
            Manage through pricing
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </StorefrontInstantLink>
        </div>
      </div>
      <div className="grid gap-3">
        {subscriptions.length ? subscriptions.map((subscription) => (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-white/10 bg-white/[0.035] p-4" key={subscription.id}>
            <div>
              <p className="font-semibold text-white">{subscription.productName ?? subscription.priceLabel ?? "Subscription"}</p>
              <p className="mt-1 text-xs text-white/48">{subscription.creditsPerCycle} credits - {money(subscription.amountCents, subscription.currency)} - renews {dateLabel(subscription.currentPeriodEnd)}</p>
            </div>
            <StatusPill tone={subscription.status === "active" || subscription.status === "trialing" ? "good" : "neutral"}>{statusLabel(subscription.status)}</StatusPill>
          </div>
        )) : <EmptyState>No subscription is connected to this account yet.</EmptyState>}
      </div>
    </div>
  );
}

function CreditsCard({ fallbackCustomer, runtime }: { fallbackCustomer: PublicCustomer; runtime: ThemeRuntimeData }) {
  const customer = accountCustomer(runtime, fallbackCustomer);
  const ledger = runtime.ledger ?? [];
  return (
    <div className="grid gap-5">
      <SectionHeader icon={CreditCard} kicker="Credits" title="Credit balance and activity" subtitle="Track credits added, held for generation, consumed, released, or adjusted by support." />
      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Available credits" value={customer.balance.available ?? 0} />
        <StatTile label="Reserved credits" value={customer.balance.reserved ?? 0} hint="Reserved credits are held while a request is queued or running." />
      </div>
      <div className="grid gap-3">
        {ledger.length ? ledger.map((entry) => (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-white/10 bg-white/[0.035] p-4 text-sm" key={entry.id}>
            <div>
              <p className="font-semibold text-white">{ledgerLabel(entry.type)}</p>
              <p className="mt-1 text-xs text-white/48">{entry.sourceLabel ?? entry.sourceId ?? "Account activity"} - {dateLabel(entry.createdAt)}</p>
            </div>
            <span className={`font-mono text-sm font-semibold ${entry.amount >= 0 ? "text-emerald-100" : "text-rose-100"}`}>
              {entry.amount >= 0 ? "+" : ""}{entry.amount}
            </span>
          </div>
        )) : <EmptyState>Credit activity will appear here after checkout or generation.</EmptyState>}
      </div>
    </div>
  );
}

function PurchasesCard({ runtime }: { runtime: ThemeRuntimeData }) {
  const orders = runtime.orders ?? [];
  return (
    <div className="grid gap-5">
      <SectionHeader icon={ReceiptText} kicker="Purchases" title="Recharge and checkout history" subtitle="Review top-ups, subscription checkout starts, credits purchased, and payment status." />
      <div className="grid gap-3">
        {orders.length ? orders.map((order) => (
          <div className="grid gap-3 rounded-[8px] border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={order.id}>
            <div>
              <p className="font-semibold text-white">{money(order.amountCents, order.currency)}</p>
              <p className="mt-1 text-xs text-white/48">{order.credits} credits - {dateLabel(order.createdAt)}</p>
              <p className="mt-1 truncate text-xs text-white/34">Source {order.sourceId}</p>
            </div>
            <StatusPill tone={order.status === "paid" || order.status === "fulfilled" ? "good" : order.status === "checkout_started" ? "warn" : "neutral"}>{statusLabel(order.status)}</StatusPill>
          </div>
        )) : <EmptyState>No recharge or subscription checkout history yet.</EmptyState>}
      </div>
    </div>
  );
}

function GenerationCard({ basePath, runtime }: { basePath: string; runtime: ThemeRuntimeData }) {
  const jobs = runtime.jobs ?? [];
  return (
    <div className="grid gap-5">
      <SectionHeader icon={Sparkles} kicker="Generation" title="AI photoshoot requests" subtitle="Follow queued, running, delivered, failed, and refunded generation work." />
      <div className="grid gap-3">
        {jobs.length ? jobs.map((job, index) => (
          <StorefrontInstantLink className="grid gap-2 rounded-[8px] border border-white/10 bg-white/[0.035] p-4 text-sm transition hover:bg-white/[0.07] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" href={`${basePath}/app/jobs/${job.id}`} key={job.id}>
            <div>
              <p className="font-semibold text-white">{requestTitle(job.id, index)}</p>
              <p className="mt-1 text-xs text-white/48">{job.creditsReserved} credits held - updated {dateLabel(job.updatedAt)}</p>
            </div>
            <StatusPill tone={job.status === "succeeded" ? "good" : job.status === "failed" ? "warn" : "neutral"}>{jobStatusLabel(job.status)}</StatusPill>
          </StorefrontInstantLink>
        )) : <EmptyState>No AI photoshoot requests yet.</EmptyState>}
      </div>
    </div>
  );
}

function DownloadsCard({ runtime }: { runtime: ThemeRuntimeData }) {
  const downloads = runtime.downloads ?? [];
  const downloadableAssets = runtime.assets.filter((asset) => asset.role === "output" && asset.downloadUrl);
  return (
    <div className="grid gap-5">
      <SectionHeader icon={Download} kicker="Downloads" title="Download history" subtitle="Review files downloaded from this account and quickly access recently delivered assets." />
      <div className="grid gap-3">
        {downloads.length ? downloads.map((entry) => (
          <div className="grid gap-3 rounded-[8px] border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={entry.id}>
            <div className="flex min-w-0 items-center gap-3">
              {entry.previewUrl ? <img className="h-12 w-12 rounded-[8px] object-cover" src={entry.previewUrl} alt="" /> : <span className="grid h-12 w-12 place-items-center rounded-[8px] bg-white/[0.08]"><ImageIcon className="h-5 w-5 text-white/60" /></span>}
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{entry.label}</p>
                <p className="mt-1 text-xs text-white/48">{dateLabel(entry.createdAt)} - {entry.mimeType ?? "asset"}</p>
              </div>
            </div>
            {entry.downloadUrl ? (
              <a className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-white/12 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.08]" download href={entry.downloadUrl}>
                Download
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </a>
            ) : null}
          </div>
        )) : <EmptyState>No downloads recorded yet. Full asset downloads will be logged here.</EmptyState>}
      </div>
      <div className="rounded-[8px] border border-white/10 bg-white/[0.035] p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">Ready assets</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {downloadableAssets.length ? downloadableAssets.slice(0, 9).map((asset) => (
            <a className="group overflow-hidden rounded-[8px] border border-white/10 bg-[#070a10] transition hover:border-white/35" download href={asset.downloadUrl} key={asset.id}>
              <img className="aspect-[4/3] w-full object-cover opacity-90 transition group-hover:opacity-100" src={asset.previewUrl} alt={asset.altText || asset.label} />
              <div className="flex items-center justify-between gap-2 p-3">
                <p className="truncate text-sm font-semibold text-white">{asset.label}</p>
                <Download className="h-4 w-4 shrink-0 text-white/58" strokeWidth={1.8} />
              </div>
            </a>
          )) : <p className="text-sm leading-6 text-white/56">Delivered downloadable assets will appear here.</p>}
        </div>
      </div>
    </div>
  );
}

function AlbumsCard({ runtime }: { runtime: ThemeRuntimeData }) {
  const albums = runtime.albums ?? [];
  return (
    <div className="grid gap-5">
      <SectionHeader icon={Layers3} kicker="Albums" title="Delivered photo sets" subtitle="Browse completed private albums and the output count for each delivery." />
      <div className="grid gap-3">
        {albums.length ? albums.map((album) => (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-white/10 bg-white/[0.035] p-4 text-sm" key={album.id}>
            <div>
              <p className="font-semibold text-white">{album.title}</p>
              <p className="mt-1 text-xs text-white/48">{album.outputCount} outputs - updated {dateLabel(album.updatedAt)}</p>
            </div>
            <StatusPill tone={album.status === "ready" ? "good" : "neutral"}>{albumStatusLabel(album.status)}</StatusPill>
          </div>
        )) : <EmptyState>Albums will appear here after your first photo set is delivered.</EmptyState>}
      </div>
    </div>
  );
}

function ModelsCard({ runtime }: { runtime: ThemeRuntimeData }) {
  const models = runtime.customerModels ?? [];
  return (
    <div className="grid gap-5">
      <SectionHeader icon={ShieldCheck} kicker="Models" title="Private AI models" subtitle="Review trained or collecting models connected to this customer account." />
      <div className="grid gap-3">
        {models.length ? models.map((model) => (
          <div className="grid gap-3 rounded-[8px] border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={model.id}>
            <div>
              <p className="font-semibold text-white">{model.label}</p>
              <p className="mt-1 text-xs text-white/48">{model.inputAssetCount}/{model.minInputAssets} inputs - updated {dateLabel(model.updatedAt)}</p>
            </div>
            <StatusPill tone={model.status === "ready" ? "good" : model.status === "failed" ? "warn" : "neutral"}>{statusLabel(model.status)}</StatusPill>
          </div>
        )) : <EmptyState>No private model has been trained for this account yet.</EmptyState>}
      </div>
    </div>
  );
}

export function CustomerAccountDataIsland({
  activeSection,
  basePath,
  customer,
  initialRuntime,
  siteId,
  siteSlug
}: {
  activeSection: AccountSection;
  basePath: string;
  customer: PublicCustomer;
  initialRuntime?: ThemeRuntimeData;
  siteId: string;
  siteSlug: string;
}) {
  const [checkoutNotice, setCheckoutNotice] = useState<{ success: boolean; order: string }>({ success: false, order: "" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCheckoutNotice({
      success: params.get("checkout") === "success",
      order: params.get("order") ?? ""
    });
  }, []);

  return (
    <div className="min-w-0">
      {checkoutNotice.success ? (
        <div className="mb-4 rounded-[8px] border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-50">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.8} />
            <p>
              Checkout is complete. Credits and subscriptions update after the payment webhook finishes{checkoutNotice.order ? ` for order ${checkoutNotice.order}` : ""}.
            </p>
          </div>
        </div>
      ) : null}
      {activeSection === "overview" ? (
        <AccountCard customerId={customer.id} id="account-overview" initialRuntime={initialRuntime} loadingTitle="Overview" section="overview" siteId={siteId}>
          {(runtime) => <OverviewCard basePath={basePath} fallbackCustomer={customer} runtime={runtime} />}
        </AccountCard>
      ) : null}
      {activeSection === "profile" ? (
        <AccountCard customerId={customer.id} id="account-profile" initialRuntime={initialRuntime} loadingTitle="Profile" section="profile" siteId={siteId}>
          {(runtime) => <ProfileCard fallbackCustomer={customer} runtime={runtime} siteId={siteId} siteSlug={siteSlug} />}
        </AccountCard>
      ) : null}
      {activeSection === "security" ? (
        <AccountCard customerId={customer.id} id="account-security" initialRuntime={initialRuntime} loadingTitle="Security" section="security" siteId={siteId}>
          {(runtime) => <SecurityCard basePath={basePath} fallbackCustomer={customer} runtime={runtime} siteId={siteId} />}
        </AccountCard>
      ) : null}
      {activeSection === "subscription" ? (
        <AccountCard customerId={customer.id} id="account-subscription" initialRuntime={initialRuntime} loadingTitle="Subscription" section="subscription" siteId={siteId}>
          {(runtime) => <SubscriptionCard basePath={basePath} runtime={runtime} />}
        </AccountCard>
      ) : null}
      {activeSection === "credits" ? (
        <AccountCard customerId={customer.id} id="account-credits" initialRuntime={initialRuntime} loadingTitle="Credits" section="credits" siteId={siteId}>
          {(runtime) => <CreditsCard fallbackCustomer={customer} runtime={runtime} />}
        </AccountCard>
      ) : null}
      {activeSection === "purchases" ? (
        <AccountCard customerId={customer.id} id="account-purchases" initialRuntime={initialRuntime} loadingTitle="Purchases" section="purchases" siteId={siteId}>
          {(runtime) => <PurchasesCard runtime={runtime} />}
        </AccountCard>
      ) : null}
      {activeSection === "generation" ? (
        <AccountCard customerId={customer.id} id="account-generation" initialRuntime={initialRuntime} loadingTitle="Generation" section="generation" siteId={siteId}>
          {(runtime) => <GenerationCard basePath={basePath} runtime={runtime} />}
        </AccountCard>
      ) : null}
      {activeSection === "downloads" ? (
        <AccountCard customerId={customer.id} id="account-downloads" initialRuntime={initialRuntime} loadingTitle="Downloads" section="downloads" siteId={siteId}>
          {(runtime) => <DownloadsCard runtime={runtime} />}
        </AccountCard>
      ) : null}
      {activeSection === "albums" ? (
        <AccountCard customerId={customer.id} id="account-albums" initialRuntime={initialRuntime} loadingTitle="Albums" section="albums" siteId={siteId}>
          {(runtime) => <AlbumsCard runtime={runtime} />}
        </AccountCard>
      ) : null}
      {activeSection === "models" ? (
        <AccountCard customerId={customer.id} id="account-models" initialRuntime={initialRuntime} loadingTitle="Models" section="models" siteId={siteId}>
          {(runtime) => <ModelsCard runtime={runtime} />}
        </AccountCard>
      ) : null}
    </div>
  );
}
