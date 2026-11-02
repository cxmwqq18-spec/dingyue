"use client";

import "../../app/aidreamcapes-account-surfaces.css";
// Customer media URLs are private account endpoints, so keep them as direct browser requests.
/* eslint-disable @next/next/no-img-element */

import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  ImageIcon,
  ImageOff,
  KeyRound,
  Layers3,
  LockKeyhole,
  PackageCheck,
  PlayCircle,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  WalletCards
} from "lucide-react";
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { csrfHeader, customerJsonHeaders } from "@/lib/client-csrf";
import { dispatchCustomerBootstrapInvalidation } from "@/components/storefront/customer-bootstrap-events";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import type { PublicCustomer, ThemeRuntimeAsset, ThemeRuntimeData, ThemeRuntimeDownloadEntry, ThemeRuntimePagination } from "@/lib/types";
import { storefrontAccessibleMediaAlt, storefrontMeaningfulAlt } from "@/lib/storefront-media-alt";
import { storefrontLocaleForRequestIdentity } from "@/lib/storefront-locale";
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

type AccountList =
  | "subscriptions"
  | "orders"
  | "ledger"
  | "jobs"
  | "downloads"
  | "albums"
  | "models"
  | "assets"
  | "avatars";

type PageState = {
  page: number;
  pageSize: number;
};

type LoadState =
  | { status: "loading"; runtime?: undefined; error?: undefined }
  | { status: "ready"; runtime: ThemeRuntimeData; error?: undefined }
  | { status: "error"; runtime?: undefined; error: string };

type ToastState = { tone: "success" | "error"; message: string } | undefined;

const SECTION_CACHE_TTL_MS = 60_000;
const defaultPageState: PageState = { page: 1, pageSize: 20 };
const pageSizeOptions = [10, 20, 50] as const;
const sectionCache = new Map<string, { cachedAt: number; runtime: ThemeRuntimeData }>();
const sectionInflight = new Map<string, Promise<ThemeRuntimeData>>();
const accountPrefetchTargets: Array<{ list?: AccountList; section: AccountSection }> = [
  { section: "profile", list: "avatars" },
  { section: "credits", list: "ledger" },
  { section: "purchases", list: "orders" },
  { section: "generation", list: "jobs" },
  { section: "downloads", list: "downloads" },
  { section: "downloads", list: "assets" },
  { section: "albums", list: "albums" },
  { section: "models", list: "models" },
  { section: "subscription", list: "subscriptions" }
];

/**
 * The AIVideosUGC account center (site_aidreamcapes) drops the legacy albums
 * and private-model panels, records timestamps to the second, and can remove
 * download history rows. Every other storefront keeps the account surface
 * unchanged.
 */
const AIVIDEOSUGC_ACCOUNT_SITE_ID = "site_aidreamcapes";
type AccountTimeMode = "date" | "precise-utc" | "precise-device";
const AccountTimeModeContext = createContext<AccountTimeMode>("date");

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

function loadSectionRuntime(params: {
  bust?: string;
  cacheKey: string;
  list?: AccountList;
  page: number;
  pageSize: number;
  section: AccountSection;
  siteId: string;
}): Promise<ThemeRuntimeData> {
  const cached = readCachedSection(params.cacheKey);
  if (cached) return Promise.resolve(cached);
  const inflightKey = params.bust ? `${params.cacheKey}:${params.bust}` : params.cacheKey;
  const inflight = sectionInflight.get(inflightKey);
  if (inflight) return inflight;
  const query = new URLSearchParams({
    profile: "account",
    section: params.section,
    page: String(params.page),
    pageSize: String(params.pageSize)
  });
  if (params.list) query.set("list", params.list);
  // After a mutation the runtime GET is requested with a unique URL so the
  // browser does not answer it from its private 20s HTTP cache. The refresh
  // parameter also bypasses the server-side runtime cache.
  if (params.bust) {
    query.set("ts", params.bust);
    query.set("refresh", params.bust);
  }
  const request = (async () => {
    let lastError: unknown = new Error("account_data_unavailable");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`/api/sites/${params.siteId}/customer/runtime?${query.toString()}`, {
          credentials: "same-origin"
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          pagination?: ThemeRuntimePagination;
          runtime?: ThemeRuntimeData;
          error?: string;
        };
        if (!response.ok || !data.ok || !data.runtime) throw new Error(data.error || "account_data_unavailable");
        const runtime = data.pagination && !data.runtime.pagination
          ? { ...data.runtime, pagination: data.pagination }
          : data.runtime;
        writeCachedSection(params.cacheKey, runtime);
        return runtime;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("account_data_unavailable");
  })()
    .finally(() => {
      sectionInflight.delete(inflightKey);
    });
  sectionInflight.set(inflightKey, request);
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

function dateLabel(value: string | undefined, mode: AccountTimeMode) {
  if (!value) return "Not started";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not started";
  // Server rendering always resolves in UTC so the same record prints the same
  // time before and after hydration. The AIVideosUGC account center switches
  // to the viewer's own timezone once the browser is mounted (see the island).
  if (mode === "precise-device") {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
  }
  if (mode === "precise-utc") {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC"
    });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Timestamp formatter scoped to the current account center render, never a module global. */
function useAccountDateLabel() {
  const mode = useContext(AccountTimeModeContext);
  return (value: string | undefined) => dateLabel(value, mode);
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

function listCacheKey(section: AccountSection, list?: AccountList) {
  return `${section}:${list ?? "default"}`;
}

function useAccountSectionRuntime(params: {
  customerId: string;
  initialRuntime?: ThemeRuntimeData;
  list?: AccountList;
  page: number;
  pageSize: number;
  reloadNonce?: number;
  retryNonce: number;
  section: AccountSection;
  siteId: string;
}): LoadState {
  const cacheKey = `${params.siteId}:${params.customerId}:${params.section}:${params.list ?? "default"}:${params.page}:${params.pageSize}`;
  const [state, setState] = useState<LoadState>(() => {
    if (params.initialRuntime) return { status: "ready", runtime: params.initialRuntime };
    const cached = readCachedSection(cacheKey);
    return cached ? { status: "ready", runtime: cached } : { status: "loading" };
  });

  useEffect(() => {
    if (params.initialRuntime) {
      writeCachedSection(cacheKey, params.initialRuntime);
      setState({ status: "ready", runtime: params.initialRuntime });
      return;
    }
    const cached = readCachedSection(cacheKey);
    if (cached) {
      setState({ status: "ready", runtime: cached });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    loadSectionRuntime({
      bust: params.reloadNonce ? `${params.reloadNonce}-${Date.now()}` : undefined,
      cacheKey,
      list: params.list,
      page: params.page,
      pageSize: params.pageSize,
      section: params.section,
      siteId: params.siteId
    })
      .then((runtime) => {
        if (!cancelled) setState({ status: "ready", runtime });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", error: error instanceof Error ? error.message : "account_data_unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, params.initialRuntime, params.list, params.page, params.pageSize, params.reloadNonce, params.retryNonce, params.section, params.siteId]);

  return state;
}

function AccountCard({
  children,
  customerId,
  id,
  initialRuntime,
  list,
  loadingTitle,
  onPageChange,
  pageState,
  reloadNonce = 0,
  section,
  siteId
}: {
  children: (runtime: ThemeRuntimeData, pagination?: ThemeRuntimePagination) => ReactNode;
  customerId: string;
  id: string;
  initialRuntime?: ThemeRuntimeData;
  list?: AccountList;
  loadingTitle: string;
  onPageChange?: (next: PageState) => void;
  pageState?: PageState;
  /** Bumped by the island after a mutation so the section reloads fresh data. */
  reloadNonce?: number;
  section: AccountSection;
  siteId: string;
}) {
  const [retryNonce, setRetryNonce] = useState(0);
  const state = useAccountSectionRuntime({
    customerId,
    initialRuntime,
    list,
    page: pageState?.page ?? 1,
    pageSize: pageState?.pageSize ?? 20,
    reloadNonce,
    retryNonce,
    section,
    siteId
  });
  return (
    <div className={`ac-account-module-card ac-classic-module-card ${section === "overview" ? "ac-classic-overview-card" : "ac-classic-module-card-panel"} scroll-mt-28 rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface)] p-4 shadow-[var(--account-shadow)] sm:p-5`} id={id}>
      {state.status === "loading" ? <LoadingBlock title={loadingTitle} /> : null}
      {state.status === "error" ? <ErrorBlock onRetry={() => setRetryNonce((current) => current + 1)} /> : null}
      {state.status === "ready" ? children(state.runtime, state.runtime.pagination) : null}
      {state.status === "ready" && state.runtime.pagination && onPageChange ? (
        <PaginationControls onChange={onPageChange} pagination={state.runtime.pagination} />
      ) : null}
    </div>
  );
}

function LoadingBlock({ title }: { title: string }) {
  return (
    <div aria-busy="true">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--account-faint)]">{title}</p>
      <div className="mt-5 grid gap-3">
        <div className="h-6 w-32 rounded-full bg-[var(--account-skeleton)]" />
        <div className="h-20 rounded-[8px] bg-[var(--account-skeleton-soft)]" />
        <div className="h-20 rounded-[8px] bg-[var(--account-skeleton-soft)]" />
      </div>
    </div>
  );
}

function ErrorBlock({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="ac-account-load-error rounded-[8px] border border-dashed border-[var(--account-border)] bg-[var(--account-panel)] p-4 text-sm text-[var(--account-muted)]">
      <p>This account module could not load. Try again or sign in again if the session has expired.</p>
      <button className="mt-3 inline-flex min-h-9 items-center rounded-[8px] border border-[var(--account-button-border)] bg-[var(--account-button-bg)] px-3 text-sm font-semibold text-white" onClick={onRetry} type="button">Try again</button>
    </div>
  );
}

function SectionHeader({ icon: Icon, kicker, title, subtitle }: { icon: LucideIcon; kicker: string; title: string; subtitle: string }) {
  return (
    <div className="ac-island-section-head flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-[var(--account-accent-bg)] text-[var(--account-accent-strong)]">
        <Icon className="h-5 w-5" strokeWidth={1.9} />
      </span>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--account-faint)]">{kicker}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-normal text-[var(--account-strong)] sm:text-2xl">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--account-muted)]">{subtitle}</p>
      </div>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-[8px] border border-[var(--account-border)] bg-[var(--account-panel)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--account-faint)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--account-strong)]">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-[var(--account-muted)]">{hint}</p> : null}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[8px] border border-dashed border-[var(--account-border)] bg-[var(--account-panel)] p-4 text-sm leading-6 text-[var(--account-muted)]">{children}</p>
  );
}

function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" }) {
  const toneClass = tone === "good"
    ? "border-[var(--account-success-border)] bg-[var(--account-success-bg)] text-[var(--account-success-text)]"
    : tone === "warn"
    ? "border-[var(--account-warn-border)] bg-[var(--account-warn-bg)] text-[var(--account-warn-text)]"
    : "border-[var(--account-border)] bg-[var(--account-panel-soft)] text-[var(--account-muted)]";
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

function AccountToast({ state }: { state: ToastState }) {
  if (!state) return null;
  const className = state.tone === "success"
    ? "border-[var(--account-success-border)] bg-[var(--account-success-bg)] text-[var(--account-success-text)]"
    : "border-[var(--account-danger-border)] bg-[var(--account-danger-bg)] text-[var(--account-danger-text)]";
  return <p className={`rounded-[8px] border p-3 text-sm ${className}`}>{state.message}</p>;
}

function paginationItems(page: number, totalPages: number): Array<number | "ellipsis-start" | "ellipsis-end"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set<number>([1, totalPages]);
  for (let offset = -1; offset <= 1; offset += 1) {
    const value = page + offset;
    if (value > 1 && value < totalPages) pages.add(value);
  }
  if (page <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (page >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }
  const sorted = Array.from(pages)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right);
  const items: Array<number | "ellipsis-start" | "ellipsis-end"> = [];
  sorted.forEach((value, index) => {
    const previous = sorted[index - 1];
    if (previous && value - previous > 1) {
      items.push(previous === 1 ? "ellipsis-start" : "ellipsis-end");
    }
    items.push(value);
  });
  return items;
}

function PaginationControls({
  onChange,
  pagination
}: {
  onChange: (next: PageState) => void;
  pagination: ThemeRuntimePagination;
}) {
  const items = paginationItems(pagination.page, pagination.totalPages);
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-[var(--account-border)] pt-4 text-sm text-[var(--account-muted)] sm:flex-row sm:items-center sm:justify-between">
      <p>
        Showing {pagination.firstItem}-{pagination.lastItem} of {pagination.total}
      </p>
      <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1">
        <select
          aria-label="Rows per page"
          className="h-9 shrink-0 rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-field)] px-2 text-sm font-semibold text-[var(--account-text)] outline-none transition focus:border-[var(--account-accent)]"
          onChange={(event) => onChange({ page: 1, pageSize: Number(event.target.value) })}
          value={pagination.pageSize}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>{size} / page</option>
          ))}
        </select>
        <button
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-field)] px-3 text-sm font-semibold text-[var(--account-text)] transition hover:bg-[var(--account-hover-bg)] disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!pagination.hasPrevious}
          onClick={() => onChange({ page: Math.max(1, pagination.page - 1), pageSize: pagination.pageSize })}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
          Prev
        </button>
        <div className="flex shrink-0 items-center gap-1" aria-label="Page numbers">
          {items.map((item, index) => typeof item === "number" ? (
            <button
              aria-current={item === pagination.page ? "page" : undefined}
              className={`grid h-9 min-w-9 place-items-center rounded-[8px] border px-2 text-sm font-semibold transition ${item === pagination.page ? "border-[var(--account-accent)] bg-[var(--account-accent-bg)] text-[var(--account-accent-strong)]" : "border-[var(--account-border-strong)] bg-[var(--account-field)] text-[var(--account-text)] hover:bg-[var(--account-hover-bg)]"}`}
              key={item}
              onClick={() => onChange({ page: item, pageSize: pagination.pageSize })}
              type="button"
            >
              {item}
            </button>
          ) : (
            <span className="grid h-9 min-w-7 place-items-center text-xs font-semibold text-[var(--account-faint)]" key={`${item}-${index}`}>...</span>
          ))}
        </div>
        <button
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-field)] px-3 text-sm font-semibold text-[var(--account-text)] transition hover:bg-[var(--account-hover-bg)] disabled:cursor-not-allowed disabled:opacity-45"
          disabled={!pagination.hasNext}
          onClick={() => onChange({ page: Math.min(pagination.totalPages, pagination.page + 1), pageSize: pagination.pageSize })}
          type="button"
        >
          Next
          <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

function accountCustomer(runtime: ThemeRuntimeData, fallback: PublicCustomer): PublicCustomer {
  return runtime.customer ?? fallback;
}

function isVideoMime(mimeType?: string) {
  return Boolean(mimeType?.startsWith("video/"));
}

function isImageMime(mimeType?: string) {
  return !mimeType || mimeType.startsWith("image/");
}

function accountAssetAlt(asset: Pick<ThemeRuntimeAsset, "altText" | "label" | "mimeType" | "previewUrl">, siteSlug: string): string {
  const locale = storefrontLocaleForRequestIdentity(siteSlug);
  const label = asset.label.replace(/^mydreamshoots\s+/i, "").trim();
  const fallback = locale === "fr"
    ? label ? `${label} dans un album client privé` : asset.mimeType.startsWith("video/") ? "Vidéo livrée dans un album client privé" : "Image livrée dans un album client privé"
    : locale === "es"
    ? label ? `${label} en un album privado del cliente` : asset.mimeType.startsWith("video/") ? "Video entregado en un album privado del cliente" : "Imagen entregada en un album privado del cliente"
    : label ? `${label} in a private customer album` : asset.mimeType.startsWith("video/") ? "Video delivered to a private customer album" : "Image delivered to a private customer album";
  return storefrontAccessibleMediaAlt({ fallback, imageUrl: asset.previewUrl, locale, value: storefrontMeaningfulAlt(asset.altText) || undefined });
}

function MediaThumb({
  alt,
  className,
  mimeType,
  previewStatus,
  previewUrl
}: {
  alt: string;
  className: string;
  mimeType?: string;
  previewStatus?: ThemeRuntimeAsset["previewStatus"];
  previewUrl?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [previewUrl]);
  const unavailable = !previewUrl || previewStatus === "loading" || failed;
  if (unavailable) {
    return (
      <span className={`grid place-items-center bg-[var(--account-panel-soft)] text-[var(--account-subtle)] ${className}`}>
        <span className="grid gap-1 text-center">
          <ImageOff className="mx-auto h-5 w-5" strokeWidth={1.8} />
          <span className="text-[11px] font-semibold">Preview unavailable</span>
        </span>
      </span>
    );
  }
  return (
    <span className={`relative block overflow-hidden bg-[var(--account-panel-soft)] ${className}`}>
      <img alt={alt} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} src={previewUrl} />
      {isVideoMime(mimeType) ? (
        <span className="absolute inset-0 grid place-items-center bg-[#111827]/18 text-white">
          <PlayCircle className="h-8 w-8 drop-shadow" strokeWidth={1.7} />
        </span>
      ) : null}
    </span>
  );
}

function OverviewCard({ basePath, fallbackCustomer, runtime }: { basePath: string; fallbackCustomer: PublicCustomer; runtime: ThemeRuntimeData }) {
  const formatDate = useAccountDateLabel();
  const account = accountCustomer(runtime, fallbackCustomer);
  const latestOrder = runtime.orders?.[0];
  const latestJob = runtime.jobs[0];
  const downloads = runtime.downloads ?? [];
  const albums = runtime.albums ?? [];
  const activeSubscription = runtime.subscriptions?.find((subscription) => subscription.status === "active" || subscription.status === "trialing") ?? runtime.subscriptions?.[0];
  const planLabel = activeSubscription?.productName ?? activeSubscription?.priceLabel ?? "No plan";
  const activity = [
    {
      title: "Photo profile request",
      subtitle: latestJob ? `${jobStatusLabel(latestJob.status)} · request history is ready` : "No request submitted yet",
      time: latestJob ? formatDate(latestJob.updatedAt) : "—",
      active: Boolean(latestJob)
    },
    {
      title: "Download center",
      subtitle: downloads.length ? `${downloads.length} delivered file${downloads.length === 1 ? "" : "s"} in history` : "No delivered assets yet",
      time: downloads[0] ? formatDate(downloads[0].createdAt) : "—",
      active: false
    },
    {
      title: "Private album",
      subtitle: albums.length ? `${albums.length} album${albums.length === 1 ? "" : "s"} connected to this account` : "No published albums yet",
      time: albums[0] ? formatDate(albums[0].updatedAt) : "—",
      active: false
    }
  ];
  return (
    <div className="ac-classic-overview">
      <div className="ac-classic-section-header">
        <div className="ac-classic-section-header-left">
          <span className="ac-classic-section-icon"><WalletCards aria-hidden="true" strokeWidth={1.8} /></span>
          <div><h2>Account command center</h2><p>Review your plan, credit balance, private requests, and delivered work from one place.</p></div>
        </div>
        <a className="ac-classic-section-link" href="#account-generation">View all →</a>
      </div>
      <div className="ac-classic-stat-grid">
        <article className="ac-classic-stat"><span>Available credits</span><strong>{account.balance.available ?? 0}</strong><small>Ready for your next request</small></article>
        <article className="ac-classic-stat"><span>Current plan</span><strong>{planLabel}</strong><small>{activeSubscription ? `Status: ${statusLabel(activeSubscription.status)}` : "Choose a package when ready"}</small></article>
        <article className="ac-classic-stat"><span>Recent request</span><strong>{latestJob ? jobStatusLabel(latestJob.status) : "None yet"}</strong><small>{latestJob ? `Submitted ${formatDate(latestJob.updatedAt)}` : "No request history yet"}</small></article>
        <article className="ac-classic-stat"><span>Last checkout</span><strong>{latestOrder ? money(latestOrder.amountCents, latestOrder.currency) : "$0"}</strong><small>{latestOrder ? "Latest purchase recorded" : "No purchase history yet"}</small></article>
      </div>
      <div className="ac-classic-quick-actions">
        <StorefrontInstantLink className="ac-classic-button ac-classic-button-primary" href={`${basePath}/app/create`}>Open workspace <span>→</span></StorefrontInstantLink>
        <StorefrontInstantLink className="ac-classic-button ac-classic-button-secondary" href={`${basePath}/pricing`}>View pricing <span>→</span></StorefrontInstantLink>
        <StorefrontInstantLink className="ac-classic-button ac-classic-button-secondary" href={`${basePath}/tools`}>Explore tools <span>→</span></StorefrontInstantLink>
      </div>
      <div className="ac-classic-activity" id="account-activity">
          {activity.map((item, index) => (
            <div className="ac-classic-activity-row" key={item.title}>
              <span className="ac-classic-activity-icon">{index === 0 ? <Sparkles aria-hidden="true" strokeWidth={1.8} /> : index === 1 ? <Download aria-hidden="true" strokeWidth={1.8} /> : <Layers3 aria-hidden="true" strokeWidth={1.8} />}</span>
              <div><strong>{item.title}</strong><span>{item.subtitle}</span></div>
              <time>{item.time}</time>
            </div>
          ))}
      </div>
      <div className="ac-classic-library">
        <section className="ac-classic-card ac-classic-library-panel">
          <h3>Recent creations</h3>
          <p>Delivered assets and private albums stay connected to this account.</p>
          <div className="ac-classic-visual-preview" aria-label="Private library preview"><div className="ac-classic-preview-card" aria-hidden="true" /></div>
          <div className="ac-classic-privacy-strip"><ShieldCheck aria-hidden="true" strokeWidth={1.8} /><span><b>Private by design.</b> Only this customer session can see these records.</span></div>
        </section>
        <section className="ac-classic-card ac-classic-library-panel">
          <h3>First studio request</h3>
          <p>Choose a package, confirm your photos, and start your first private profile.</p>
          <div className="ac-classic-module-meta">
            <div><span>Progress</span><strong>{latestJob ? jobStatusLabel(latestJob.status) : "Ready"}</strong></div>
            <div><span>Output</span><strong>{latestJob ? "1" : "—"}</strong></div>
            <div><span>Photos</span><strong>{latestJob ? "Attached" : "1/15"}</strong></div>
          </div>
          <StorefrontInstantLink className="ac-classic-button ac-classic-button-primary ac-classic-library-action" href={`${basePath}/app/create`}>Continue in workspace <span>↗</span></StorefrontInstantLink>
        </section>
      </div>
    </div>
  );
}

function OverviewStatement({ basePath, fallbackCustomer, runtime }: { basePath: string; fallbackCustomer: PublicCustomer; runtime: ThemeRuntimeData }) {
  const formatDate = useAccountDateLabel();
  const account = accountCustomer(runtime, fallbackCustomer);
  const jobs = runtime.jobs ?? [];
  const orders = runtime.orders ?? [];
  const downloads = runtime.downloads ?? [];
  const activity = [
    ...orders.map((order) => ({
      key: `order-${order.id}`,
      sortAt: new Date(order.createdAt).getTime(),
      when: formatDate(order.createdAt),
      title: `Purchase ${money(order.amountCents, order.currency)}`,
      detail: `${order.credits} credits · ${statusLabel(order.status)}`,
      amount: order.credits > 0 ? `+${order.credits}` : undefined,
      tone: "pos" as const
    })),
    ...jobs.map((job) => ({
      key: `job-${job.id}`,
      sortAt: new Date(job.updatedAt).getTime(),
      when: formatDate(job.updatedAt),
      title: requestTitle(job.id, 0),
      detail: jobStatusLabel(job.status),
      amount: job.creditsReserved > 0 ? `−${job.creditsReserved}` : undefined,
      tone: "neg" as const
    })),
    ...downloads.map((entry) => ({
      key: `download-${entry.id}`,
      sortAt: new Date(entry.createdAt).getTime(),
      when: formatDate(entry.createdAt),
      title: entry.label,
      detail: "Downloaded",
      amount: undefined,
      tone: undefined
    }))
  ]
    .sort((left, right) => right.sortAt - left.sortAt)
    .slice(0, 6);
  const inProgress = jobs.filter((job) => job.status !== "succeeded" && job.status !== "failed").slice(0, 3);
  const activeSubscription = runtime.subscriptions?.find((subscription) => subscription.status === "active" || subscription.status === "trialing") ?? runtime.subscriptions?.[0];
  const planLabel = activeSubscription?.productName ?? activeSubscription?.priceLabel ?? "No plan";

  return (
    <div className="cc-statement">
      <div className="cc-block">
        <div className="cc-block-head">
          <h3>Account details</h3>
          <a href="#account-profile">Edit profile →</a>
        </div>
        <dl className="cc-facts">
          <div><dt>Name</dt><dd>{account.name}</dd></div>
          <div><dt>Email</dt><dd className="cc-fact-break">{account.email}</dd></div>
          <div><dt>Status</dt><dd>{statusLabel(account.status)}</dd></div>
          <div><dt>Plan</dt><dd>{planLabel}</dd></div>
        </dl>
      </div>

      <div className="cc-block">
        <div className="cc-block-head">
          <h3>Recent activity</h3>
          <a href="#account-credits">All credits →</a>
        </div>
        {activity.length ? (
          <table className="cc-ledger">
            <thead><tr><th>Date</th><th>Activity</th><th>Credits</th></tr></thead>
            <tbody>
              {activity.map((row) => (
                <tr key={row.key}>
                  <td className="cc-when">{row.when}</td>
                  <td className="cc-what"><strong>{row.title}</strong><span>{row.detail}</span></td>
                  <td className={`cc-amount ${row.tone === "pos" ? "is-pos" : row.tone === "neg" ? "is-neg" : ""}`}>{row.amount ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="cc-empty">Activity appears here after your first purchase or generation.</p>}
      </div>

      <div className="cc-block">
        <div className="cc-block-head">
          <h3>In progress</h3>
          <span className="cc-count">{inProgress.length ? `${inProgress.length} running` : "Nothing running"}</span>
        </div>
        {inProgress.length ? inProgress.map((job, index) => (
          <div className="cc-job" key={job.id}>
            <div>
              <strong>{requestTitle(job.id, index)}</strong>
              <span>{job.creditsReserved} credits held · updated {formatDate(job.updatedAt)}</span>
            </div>
            <span className="cc-pill is-warn">{jobStatusLabel(job.status)}</span>
          </div>
        )) : <p className="cc-empty">No request is running right now. Start one from the workspace whenever you are ready.</p>}
      </div>

      <div className="cc-block">
        <div className="cc-block-head"><h3>Continue in the studio</h3></div>
        <div className="cc-links">
          <StorefrontInstantLink href={`${basePath}/app/create`}><strong>Create a video</strong><span>Start from a prompt or product photo</span></StorefrontInstantLink>
          <StorefrontInstantLink href={`${basePath}/templates`}><strong>Browse templates</strong><span>Reuse a scene that already works</span></StorefrontInstantLink>
          <StorefrontInstantLink href={`${basePath}/pricing`}><strong>View plans</strong><span>Compare monthly and annual credits</span></StorefrontInstantLink>
        </div>
      </div>
    </div>
  );
}

function ProfileAvatar({ customer, size = "large" }: { customer: PublicCustomer; size?: "large" | "small" }) {
  const className = size === "large"
    ? "h-20 w-20 rounded-[8px]"
    : "h-11 w-11 rounded-[8px]";
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden border border-[var(--account-border-strong)] bg-[var(--account-panel)] text-[var(--account-muted)] ${className}`}>
      {customer.profile?.avatarUrl ? (
        <img className="h-full w-full object-cover" src={customer.profile.avatarUrl} alt="" />
      ) : (
        <UserRound className={size === "large" ? "h-8 w-8" : "h-5 w-5"} strokeWidth={1.8} />
      )}
    </span>
  );
}

function ProfileCard({
  fallbackCustomer,
  pagination,
  runtime,
  siteId,
  siteSlug
}: {
  fallbackCustomer: PublicCustomer;
  pagination?: ThemeRuntimePagination;
  runtime: ThemeRuntimeData;
  siteId: string;
  siteSlug: string;
}) {
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
          className="grid gap-4 rounded-[8px] border border-[var(--account-border)] bg-[var(--account-panel)] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void saveProfile();
          }}
        >
          <div className="flex items-center gap-4">
            <ProfileAvatar customer={displayCustomer} />
            <label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold text-[var(--account-text)]">
              Profile avatar
              <input
                accept="image/*"
                className="block w-full rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-field)] px-3 py-2 text-sm font-medium text-[var(--account-text)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--account-button-bg)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                onChange={(event) => setFile(event.currentTarget.files?.[0])}
                type="file"
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-[var(--account-text)]">
            Display name
            <input className="rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-field)] px-3 py-2 text-sm font-medium text-[var(--account-text)] outline-none transition focus:border-[var(--account-accent)]" maxLength={80} onChange={(event) => setName(event.target.value)} value={name} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[var(--account-muted)]">
            Email address
            <input className="rounded-[8px] border border-[var(--account-border)] bg-[var(--account-panel-soft)] px-3 py-2 text-sm font-medium text-[var(--account-muted)]" readOnly value={customer.email} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--account-button-border)] bg-[var(--account-button-bg)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--account-button-hover)] disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} type="submit">
              <Upload className="h-4 w-4" strokeWidth={1.8} />
              {saving ? "Saving..." : "Save profile"}
            </button>
            {displayCustomer.profile?.avatarUrl ? (
              <button className="rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-field)] px-4 py-2 text-sm font-semibold text-[var(--account-text)] transition hover:bg-[var(--account-hover-bg)] disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} onClick={() => void saveProfile(null)} type="button">
                Remove avatar
              </button>
            ) : null}
          </div>
        </form>
        <div className="rounded-[8px] border border-[var(--account-border)] bg-[var(--account-panel)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--account-faint)]">Saved avatars</p>
            {pagination ? <span className="text-xs font-semibold text-[var(--account-muted)]">{pagination.total} total</span> : null}
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {profileAssets.length ? profileAssets.map((asset) => (
              <button className="aspect-square overflow-hidden rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-field)] transition hover:border-[var(--account-accent)]" key={asset.id} onClick={() => void saveProfile(asset.id)} type="button">
                <MediaThumb alt={accountAssetAlt(asset, siteSlug)} className="h-full w-full" mimeType={asset.mimeType} previewStatus={asset.previewStatus} previewUrl={asset.previewUrl} />
              </button>
            )) : (
              <p className="col-span-4 text-sm leading-6 text-[var(--account-muted)]">Uploaded profile avatars will appear here for quick reuse.</p>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs leading-5 text-[var(--account-faint)]">Need to change your email? Contact support so ownership can be verified before the address is updated.</p>
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
      <form className="grid max-w-xl gap-4 rounded-[8px] border border-[var(--account-border)] bg-[var(--account-panel)] p-4" onSubmit={changePassword}>
        <label className="grid gap-2 text-sm font-semibold text-[var(--account-text)]">
          Current password
          <input autoComplete="current-password" className="rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-field)] px-3 py-2 text-sm font-medium text-[var(--account-text)] outline-none transition focus:border-[var(--account-accent)]" onChange={(event) => setCurrentPassword(event.target.value)} type="password" value={currentPassword} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[var(--account-text)]">
          New password
          <input autoComplete="new-password" className="rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-field)] px-3 py-2 text-sm font-medium text-[var(--account-text)] outline-none transition focus:border-[var(--account-accent)]" onChange={(event) => setNewPassword(event.target.value)} type="password" value={newPassword} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[var(--account-text)]">
          Confirm new password
          <input autoComplete="new-password" className="rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-field)] px-3 py-2 text-sm font-medium text-[var(--account-text)] outline-none transition focus:border-[var(--account-accent)]" onChange={(event) => setConfirmPassword(event.target.value)} type="password" value={confirmPassword} />
        </label>
        <button className="inline-flex w-fit items-center gap-2 rounded-[8px] border border-[var(--account-button-border)] bg-[var(--account-button-bg)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--account-button-hover)] disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} type="submit">
          <KeyRound className="h-4 w-4" strokeWidth={1.8} />
          {saving ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
}

function SubscriptionCard({ basePath, runtime }: { basePath: string; runtime: ThemeRuntimeData }) {
  const formatDate = useAccountDateLabel();
  const subscriptions = runtime.subscriptions ?? [];
  const activeSubscription = subscriptions.find((subscription) => subscription.status === "active" || subscription.status === "trialing") ?? subscriptions[0];
  return (
    <div className="grid gap-5">
      <SectionHeader icon={PackageCheck} kicker="Subscription" title="Plan and billing status" subtitle="View the current subscription tier, renewal window, and credits granted by the plan." />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Current plan" value={activeSubscription?.productName ?? activeSubscription?.priceLabel ?? "No plan"} hint={activeSubscription ? statusLabel(activeSubscription.status) : "No active subscription"} />
        <StatTile label="Credits per cycle" value={activeSubscription?.creditsPerCycle ?? 0} hint={activeSubscription?.interval ? `${statusLabel(activeSubscription.interval)} billing` : "Subscription credits"} />
        <StatTile label="Period end" value={formatDate(activeSubscription?.currentPeriodEnd)} hint={activeSubscription?.currentPeriodStart ? `Started ${formatDate(activeSubscription.currentPeriodStart)}` : undefined} />
      </div>
      <div className="rounded-[8px] border border-[var(--account-border)] bg-[var(--account-panel)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--account-strong)]">Payment method</p>
            <p className="mt-1 text-sm leading-6 text-[var(--account-muted)]">Cards are handled through secure checkout. This account center does not store or edit card numbers.</p>
          </div>
          <StorefrontInstantLink className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-field)] px-4 py-2 text-sm font-semibold text-[var(--account-text)] transition hover:bg-[var(--account-hover-bg)]" href={`${basePath}/pricing`}>
            Manage through pricing
            <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
          </StorefrontInstantLink>
        </div>
      </div>
      <div className="grid gap-3">
        {subscriptions.length ? subscriptions.map((subscription) => (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface-elevated)] p-4" key={subscription.id}>
            <div>
              <p className="font-semibold text-[var(--account-strong)]">{subscription.productName ?? subscription.priceLabel ?? "Subscription"}</p>
              <p className="mt-1 text-xs text-[var(--account-muted)]">{subscription.creditsPerCycle} credits - {money(subscription.amountCents, subscription.currency)} - renews {formatDate(subscription.currentPeriodEnd)}</p>
            </div>
            <StatusPill tone={subscription.status === "active" || subscription.status === "trialing" ? "good" : "neutral"}>{statusLabel(subscription.status)}</StatusPill>
          </div>
        )) : <EmptyState>No subscription is connected to this account yet.</EmptyState>}
      </div>
    </div>
  );
}

function CreditsCard({ fallbackCustomer, runtime, variant = "classic" }: { fallbackCustomer: PublicCustomer; runtime: ThemeRuntimeData; variant?: "classic" | "statement" }) {
  const formatDate = useAccountDateLabel();
  const customer = accountCustomer(runtime, fallbackCustomer);
  const ledger = runtime.ledger ?? [];
  if (variant === "statement") {
    return (
      <div className="cc-statement">
        <div className="cc-credits-summary">
          <div><span>Available</span><strong>{customer.balance.available ?? 0}</strong></div>
          <div><span>Reserved</span><strong>{customer.balance.reserved ?? 0}</strong></div>
          <div><span>Entries</span><strong>{ledger.length}</strong></div>
        </div>
        <div className="cc-block">
          <div className="cc-block-head">
            <h3>Ledger</h3>
            <span className="cc-count">{ledger.length} {ledger.length === 1 ? "entry" : "entries"}</span>
          </div>
          {ledger.length ? (
            <table className="cc-ledger">
              <thead><tr><th>Date</th><th>Entry</th><th>Credits</th></tr></thead>
              <tbody>
                {ledger.map((entry) => (
                  <tr key={entry.id}>
                    <td className="cc-when">{formatDate(entry.createdAt)}</td>
                    <td className="cc-what"><strong>{ledgerLabel(entry.type)}</strong><span>{entry.sourceLabel ?? entry.sourceId ?? "Account activity"}</span></td>
                    <td className={`cc-amount ${entry.amount >= 0 ? "is-pos" : "is-neg"}`}>{entry.amount >= 0 ? "+" : ""}{entry.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="cc-empty">Credit activity will appear here after checkout or generation.</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-5">
      <SectionHeader icon={CreditCard} kicker="Credits" title="Credit balance and activity" subtitle="Track credits added, held for generation, consumed, released, or adjusted by support." />
      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Available credits" value={customer.balance.available ?? 0} />
        <StatTile label="Reserved credits" value={customer.balance.reserved ?? 0} hint="Reserved credits are held while a request is queued or running." />
      </div>
      <div className="grid gap-3">
        {ledger.length ? ledger.map((entry) => (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface-elevated)] p-4 text-sm" key={entry.id}>
            <div>
              <p className="font-semibold text-[var(--account-strong)]">{ledgerLabel(entry.type)}</p>
              <p className="mt-1 text-xs text-[var(--account-muted)]">{entry.sourceLabel ?? entry.sourceId ?? "Account activity"} - {formatDate(entry.createdAt)}</p>
            </div>
            <span className={`font-mono text-sm font-semibold ${entry.amount >= 0 ? "text-[var(--account-success-text)]" : "text-[var(--account-danger-text)]"}`}>
              {entry.amount >= 0 ? "+" : ""}{entry.amount}
            </span>
          </div>
        )) : <EmptyState>Credit activity will appear here after checkout or generation.</EmptyState>}
      </div>
    </div>
  );
}

function PurchasesCard({ runtime }: { runtime: ThemeRuntimeData }) {
  const formatDate = useAccountDateLabel();
  const orders = runtime.orders ?? [];
  return (
    <div className="grid gap-5">
      <SectionHeader icon={ReceiptText} kicker="Purchases" title="Recharge and checkout history" subtitle="Review top-ups, subscription checkout starts, credits purchased, and payment status." />
      <div className="grid gap-3">
        {orders.length ? orders.map((order) => (
          <div className="grid gap-3 rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface-elevated)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={order.id}>
            <div>
              <p className="font-semibold text-[var(--account-strong)]">{money(order.amountCents, order.currency)}</p>
              <p className="mt-1 text-xs text-[var(--account-muted)]">{order.credits} credits - {formatDate(order.createdAt)}</p>
              <p className="mt-1 truncate text-xs text-[var(--account-subtle)]">Source {order.sourceId}</p>
            </div>
            <StatusPill tone={order.status === "paid" || order.status === "fulfilled" ? "good" : order.status === "checkout_started" ? "warn" : "neutral"}>{statusLabel(order.status)}</StatusPill>
          </div>
        )) : <EmptyState>No recharge or subscription checkout history yet.</EmptyState>}
      </div>
    </div>
  );
}

function GenerationCard({ basePath, runtime }: { basePath: string; runtime: ThemeRuntimeData }) {
  const formatDate = useAccountDateLabel();
  const jobs = runtime.jobs ?? [];
  return (
    <div className="grid gap-5">
      <SectionHeader icon={Sparkles} kicker="Generation" title="AI photoshoot requests" subtitle="Follow queued, running, delivered, failed, and refunded generation work." />
      <div className="grid gap-3">
        {jobs.length ? jobs.map((job, index) => (
          <StorefrontInstantLink className="grid gap-2 rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface-elevated)] p-4 text-sm transition hover:border-[var(--account-border-strong)] hover:bg-[var(--account-hover-bg)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" href={`${basePath}/app/jobs/${job.id}`} key={job.id}>
            <div>
              <p className="font-semibold text-[var(--account-strong)]">{requestTitle(job.id, index)}</p>
              <p className="mt-1 text-xs text-[var(--account-muted)]">{job.creditsReserved} credits held - updated {formatDate(job.updatedAt)}</p>
            </div>
            <StatusPill tone={job.status === "succeeded" ? "good" : job.status === "failed" ? "warn" : "neutral"}>{jobStatusLabel(job.status)}</StatusPill>
          </StorefrontInstantLink>
        )) : <EmptyState>No AI photoshoot requests yet.</EmptyState>}
      </div>
    </div>
  );
}

function DownloadsHistoryCard({
  onRemoveRecord,
  removingRecordId,
  runtime
}: {
  onRemoveRecord?: (entry: ThemeRuntimeDownloadEntry) => void;
  removingRecordId?: string | null;
  runtime: ThemeRuntimeData;
}) {
  const formatDate = useAccountDateLabel();
  const downloads = runtime.downloads ?? [];
  return (
    <div className="grid gap-5">
      <SectionHeader icon={Download} kicker="Downloads" title="Download history" subtitle="Review files downloaded from this account. Preview, poster, and Range requests are not logged here." />
      <div className="grid gap-3">
        {downloads.length ? downloads.map((entry) => {
          const fileAvailable = entry.fileAvailable !== false && Boolean(entry.downloadUrl);
          return (
            <div className="grid gap-3 rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface-elevated)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={entry.id}>
              <div className="flex min-w-0 items-center gap-3">
                <MediaThumb alt="" className="h-14 w-14 rounded-[8px]" mimeType={entry.mimeType} previewStatus={entry.previewStatus} previewUrl={entry.previewUrl} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--account-strong)]">{entry.label}</p>
                  <p className="mt-1 text-xs text-[var(--account-muted)]">{formatDate(entry.createdAt)} - {entry.mimeType ?? "asset"}</p>
                </div>
              </div>
              {onRemoveRecord ? (
                <div className="flex items-center gap-2">
                  {fileAvailable && entry.downloadUrl ? (
                    <a className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-field)] px-3 py-2 text-xs font-semibold text-[var(--account-text)] transition hover:bg-[var(--account-hover-bg)]" download href={entry.downloadUrl}>
                      Download
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </a>
                  ) : (
                    <span className="inline-flex items-center justify-center rounded-[8px] border border-[var(--account-border)] bg-[var(--account-panel-soft)] px-3 py-2 text-xs font-semibold text-[var(--account-subtle)]">
                      File unavailable
                    </span>
                  )}
                  <button
                    aria-label={`Remove ${entry.label} from download history`}
                    className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--account-muted)] transition hover:border-[var(--account-border-strong)] hover:text-[var(--account-text)] disabled:opacity-60"
                    disabled={removingRecordId === entry.id}
                    onClick={() => onRemoveRecord(entry)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Remove
                  </button>
                </div>
              ) : fileAvailable && entry.downloadUrl ? (
                <a className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-[var(--account-border-strong)] bg-[var(--account-field)] px-3 py-2 text-xs font-semibold text-[var(--account-text)] transition hover:bg-[var(--account-hover-bg)]" download href={entry.downloadUrl}>
                  Download
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                </a>
              ) : (
                <span className="inline-flex items-center justify-center rounded-[8px] border border-[var(--account-border)] bg-[var(--account-panel-soft)] px-3 py-2 text-xs font-semibold text-[var(--account-subtle)]">
                  File unavailable
                </span>
              )}
            </div>
          );
        }) : <EmptyState>No downloads recorded yet. Full asset downloads will be logged here.</EmptyState>}
      </div>
    </div>
  );
}

function ReadyAssetsCard({
  onRemoveAsset,
  removingAssetId,
  runtime,
  siteSlug
}: {
  onRemoveAsset?: (asset: ThemeRuntimeAsset) => void;
  removingAssetId?: string | null;
  runtime: ThemeRuntimeData;
  siteSlug: string;
}) {
  const downloadableAssets = runtime.assets.filter((asset) => asset.role === "output");
  return (
    <div className="grid gap-5">
      <SectionHeader icon={ImageIcon} kicker="Ready assets" title="Delivered files" subtitle="Download recently delivered images and videos from your private account." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {downloadableAssets.length ? downloadableAssets.map((asset) => {
          const fileAvailable = asset.previewStatus === "ready" && Boolean(asset.downloadUrl);
          const content = (
            <>
              <MediaThumb alt={accountAssetAlt(asset, siteSlug)} className="aspect-[4/3] w-full" mimeType={asset.mimeType} previewStatus={asset.previewStatus} previewUrl={asset.previewUrl} />
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--account-strong)]">{asset.label}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--account-muted)]">{isVideoMime(asset.mimeType) ? "Video asset" : isImageMime(asset.mimeType) ? "Image asset" : asset.mimeType}</p>
                </div>
                {fileAvailable ? (
                  <Download className="h-4 w-4 shrink-0 text-[var(--account-muted)]" strokeWidth={1.8} />
                ) : (
                  <span className="shrink-0 rounded-full bg-[var(--account-panel-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--account-subtle)]">Unavailable</span>
                )}
              </div>
            </>
          );
          if (!onRemoveAsset) {
            return fileAvailable && asset.downloadUrl ? (
              <a className="group overflow-hidden rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface-elevated)] transition hover:border-[var(--account-border-strong)] hover:bg-[var(--account-hover-bg)]" download href={asset.downloadUrl} key={asset.id}>
                {content}
              </a>
            ) : (
              <div className="overflow-hidden rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface-elevated)] opacity-80" key={asset.id}>
                {content}
              </div>
            );
          }
          return (
            <div className="group relative overflow-hidden rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface-elevated)] transition hover:border-[var(--account-border-strong)] hover:bg-[var(--account-hover-bg)]" key={asset.id}>
              {fileAvailable && asset.downloadUrl ? (
                <a className="block" download href={asset.downloadUrl}>
                  {content}
                </a>
              ) : (
                <div className="opacity-80">{content}</div>
              )}
              <button
                aria-label={`Remove ${asset.label}`}
                className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--account-border)] bg-[var(--account-surface-elevated)] text-[var(--account-muted)] transition hover:border-[var(--account-border-strong)] hover:text-[var(--account-text)] disabled:opacity-60"
                disabled={removingAssetId === asset.id}
                onClick={() => onRemoveAsset(asset)}
                title="Remove this asset"
                type="button"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          );
        }) : <p className="rounded-[8px] border border-dashed border-[var(--account-border)] bg-[var(--account-panel)] p-4 text-sm leading-6 text-[var(--account-muted)] sm:col-span-2 xl:col-span-3">Delivered downloadable assets will appear here.</p>}
      </div>
    </div>
  );
}

function AlbumsCard({ runtime }: { runtime: ThemeRuntimeData }) {
  const formatDate = useAccountDateLabel();
  const albums = runtime.albums ?? [];
  return (
    <div className="grid gap-5">
      <SectionHeader icon={Layers3} kicker="Albums" title="Delivered photo sets" subtitle="Browse completed private albums and the output count for each delivery." />
      <div className="grid gap-3">
        {albums.length ? albums.map((album) => (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface-elevated)] p-4 text-sm" key={album.id}>
            <div>
              <p className="font-semibold text-[var(--account-strong)]">{album.title}</p>
              <p className="mt-1 text-xs text-[var(--account-muted)]">{album.outputCount} outputs - updated {formatDate(album.updatedAt)}</p>
            </div>
            <StatusPill tone={album.status === "ready" ? "good" : "neutral"}>{albumStatusLabel(album.status)}</StatusPill>
          </div>
        )) : <EmptyState>Albums will appear here after your first photo set is delivered.</EmptyState>}
      </div>
    </div>
  );
}

function ModelsCard({ runtime }: { runtime: ThemeRuntimeData }) {
  const formatDate = useAccountDateLabel();
  const models = runtime.customerModels ?? [];
  return (
    <div className="grid gap-5">
      <SectionHeader icon={ShieldCheck} kicker="Models" title="Private AI models" subtitle="Review trained or collecting models connected to this customer account." />
      <div className="grid gap-3">
        {models.length ? models.map((model) => (
          <div className="grid gap-3 rounded-[8px] border border-[var(--account-border)] bg-[var(--account-surface-elevated)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={model.id}>
            <div>
              <p className="font-semibold text-[var(--account-strong)]">{model.label}</p>
              <p className="mt-1 text-xs text-[var(--account-muted)]">{model.inputAssetCount}/{model.minInputAssets} inputs - updated {formatDate(model.updatedAt)}</p>
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
  siteSlug,
  variant = "classic"
}: {
  activeSection: AccountSection;
  basePath: string;
  customer: PublicCustomer;
  initialRuntime?: ThemeRuntimeData;
  siteId: string;
  siteSlug: string;
  variant?: "classic" | "statement";
}) {
  const [checkoutNotice, setCheckoutNotice] = useState<{ success: boolean; order: string }>({ success: false, order: "" });
  const [pages, setPages] = useState<Record<string, PageState>>({});
  const [downloadsReload, setDownloadsReload] = useState(0);
  const [removingRecordId, setRemovingRecordId] = useState<string | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<string | null>(null);
  const [removeNotice, setRemoveNotice] = useState<{ error?: string; removed: number } | null>(null);
  // Timestamps render in UTC until the browser mounts, then reformat with the
  // viewer's own timezone for the AIVideosUGC account center only.
  const [deviceTimeReady, setDeviceTimeReady] = useState(false);
  const aivideosUgcAccount = siteId === AIVIDEOSUGC_ACCOUNT_SITE_ID;
  const hideStudioExtras = aivideosUgcAccount;
  // Server HTML and the first client render both use UTC (to the second); the
  // effect below then switches Aidreamcapes to the viewer's own timezone.
  const accountTimeMode: AccountTimeMode = aivideosUgcAccount ? (deviceTimeReady ? "precise-device" : "precise-utc") : "date";

  useEffect(() => {
    if (!aivideosUgcAccount) return;
    setDeviceTimeReady(true);
  }, [aivideosUgcAccount]);

  useEffect(() => {
    setRemoveNotice(null);
    setRemovingRecordId(null);
    setRemovingAssetId(null);
  }, [activeSection]);

  function pageState(section: AccountSection, list?: AccountList): PageState {
    return pages[listCacheKey(section, list)] ?? defaultPageState;
  }

  function updatePageState(section: AccountSection, list: AccountList | undefined, next: PageState) {
    setPages((current) => ({
      ...current,
      [listCacheKey(section, list)]: next
    }));
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCheckoutNotice({
      success: params.get("checkout") === "success",
      order: params.get("order") ?? ""
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let activeLoads = 0;
    let targetIndex = 0;
    const idleWindow = window as Window & {
      cancelIdleCallback?: (handle: number) => void;
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };
    const canUseIdleCallback = typeof idleWindow.requestIdleCallback === "function";
    const hiddenSections = hideStudioExtras ? new Set(["albums", "models"]) : new Set([]);
    const targets = accountPrefetchTargets.filter((target) => target.section !== activeSection).filter((target) => !hiddenSections.has(target.section));
    const pump = () => {
      if (cancelled) return;
      while (activeLoads < 2 && targetIndex < targets.length) {
        const target = targets[targetIndex];
        targetIndex += 1;
        const cacheKey = `${siteId}:${customer.id}:${target.section}:${target.list ?? "default"}:${defaultPageState.page}:${defaultPageState.pageSize}`;
        if (readCachedSection(cacheKey)) continue;
        activeLoads += 1;
        loadSectionRuntime({
          cacheKey,
          list: target.list,
          page: defaultPageState.page,
          pageSize: defaultPageState.pageSize,
          section: target.section,
          siteId
        })
          .catch(() => undefined)
          .finally(() => {
            activeLoads -= 1;
            pump();
          });
      }
    };
    const run = () => pump();
    const handle = canUseIdleCallback && idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(run, { timeout: 1400 })
      : window.setTimeout(run, 650);
    return () => {
      cancelled = true;
      if (canUseIdleCallback && idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [activeSection, customer.id, hideStudioExtras, siteId]);

  /** Forget cached section data so the next render refetches from the server. */
  function purgeCachedSections(sections: AccountSection[]) {
    const prefixes = sections.map((section) => `${siteId}:${customer.id}:${section}:`);
    for (const key of Array.from(sectionCache.keys())) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) sectionCache.delete(key);
    }
  }

  async function removeCustomerAsset(asset: ThemeRuntimeAsset) {
    if (!window.confirm(`Remove “${asset.label}”? This permanently removes this file from your account.`)) return;
    setRemovingAssetId(asset.id);
    setRemoveNotice(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets/${encodeURIComponent(asset.id)}`, {
        credentials: "same-origin",
        headers: customerJsonHeaders(siteId),
        method: "DELETE"
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "asset_delete_unavailable");
      purgeCachedSections(["downloads", "overview"]);
      setDownloadsReload((current) => current + 1);
      setRemoveNotice({ removed: 1 });
    } catch (error) {
      setRemoveNotice({ error: error instanceof Error ? error.message : "asset_delete_unavailable", removed: 0 });
    } finally {
      setRemovingAssetId(null);
    }
  }

  async function removeDownloadRecord(entryId: string, label: string) {
    if (!window.confirm(`Remove “${label}” from your download history? Your files and account data are not affected.`)) return;
    setRemovingRecordId(entryId);
    setRemoveNotice(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/customer/downloads/${encodeURIComponent(entryId)}`, {
        credentials: "same-origin",
        headers: customerJsonHeaders(siteId),
        method: "DELETE"
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; removed?: number; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "download_record_unavailable");
      purgeCachedSections(["downloads", "overview"]);
      setDownloadsReload((current) => current + 1);
      setRemoveNotice({ removed: 1 });
    } catch (error) {
      setRemoveNotice({ error: error instanceof Error ? error.message : "download_record_unavailable", removed: 0 });
    } finally {
      setRemovingRecordId(null);
    }
  }

  return (
    <AccountTimeModeContext.Provider value={accountTimeMode}>
    <div className={`ac-account-data-island ac-classic-data-island grid min-w-0 gap-5${variant === "statement" ? " ac-data-island--statement" : ""}`}>
      {checkoutNotice.success ? (
        <div className="rounded-[8px] border border-[var(--account-success-border)] bg-[var(--account-success-bg)] p-4 text-sm text-[var(--account-success-text)]">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.8} />
            <p>
              Checkout is complete. Credits and subscriptions update after the payment webhook finishes{checkoutNotice.order ? ` for order ${checkoutNotice.order}` : ""}.
            </p>
          </div>
        </div>
      ) : null}
      {removeNotice && removeNotice.error ? (
        <div className="rounded-[8px] border border-[var(--account-warn-border,rgba(180,35,24,0.35))] bg-[var(--account-warn-bg,rgba(253,236,236,0.75))] p-4 text-sm text-[var(--account-warn-text,#b42318)]">
          That item could not be removed. Please try again.
        </div>
      ) : null}
      {removeNotice && !removeNotice.error && removeNotice.removed > 0 ? (
        <div className="rounded-[8px] border border-[var(--account-success-border)] bg-[var(--account-success-bg)] p-4 text-sm text-[var(--account-success-text)]">
          Item removed.
        </div>
      ) : null}
      {activeSection === "overview" ? (
        <AccountCard customerId={customer.id} id="account-overview" initialRuntime={initialRuntime} loadingTitle="Overview" section="overview" siteId={siteId}>
          {(runtime) => variant === "statement" ? <OverviewStatement basePath={basePath} fallbackCustomer={customer} runtime={runtime} /> : <OverviewCard basePath={basePath} fallbackCustomer={customer} runtime={runtime} />}
        </AccountCard>
      ) : null}
      {activeSection === "profile" ? (
        <AccountCard
          customerId={customer.id}
          id="account-profile"
          list="avatars"
          loadingTitle="Profile"
          onPageChange={(next) => updatePageState("profile", "avatars", next)}
          pageState={pageState("profile", "avatars")}
          section="profile"
          siteId={siteId}
        >
          {(runtime, pagination) => <ProfileCard fallbackCustomer={customer} pagination={pagination} runtime={runtime} siteId={siteId} siteSlug={siteSlug} />}
        </AccountCard>
      ) : null}
      {activeSection === "security" ? (
        <AccountCard customerId={customer.id} id="account-security" loadingTitle="Security" section="security" siteId={siteId}>
          {(runtime) => <SecurityCard basePath={basePath} fallbackCustomer={customer} runtime={runtime} siteId={siteId} />}
        </AccountCard>
      ) : null}
      {activeSection === "subscription" ? (
        <AccountCard
          customerId={customer.id}
          id="account-subscription"
          list="subscriptions"
          loadingTitle="Subscription"
          onPageChange={(next) => updatePageState("subscription", "subscriptions", next)}
          pageState={pageState("subscription", "subscriptions")}
          section="subscription"
          siteId={siteId}
        >
          {(runtime) => <SubscriptionCard basePath={basePath} runtime={runtime} />}
        </AccountCard>
      ) : null}
      {activeSection === "credits" ? (
        <AccountCard
          customerId={customer.id}
          id="account-credits"
          list="ledger"
          loadingTitle="Credits"
          onPageChange={(next) => updatePageState("credits", "ledger", next)}
          pageState={pageState("credits", "ledger")}
          section="credits"
          siteId={siteId}
        >
          {(runtime) => <CreditsCard fallbackCustomer={customer} runtime={runtime} variant={variant} />}
        </AccountCard>
      ) : null}
      {activeSection === "purchases" ? (
        <AccountCard
          customerId={customer.id}
          id="account-purchases"
          list="orders"
          loadingTitle="Purchases"
          onPageChange={(next) => updatePageState("purchases", "orders", next)}
          pageState={pageState("purchases", "orders")}
          section="purchases"
          siteId={siteId}
        >
          {(runtime) => <PurchasesCard runtime={runtime} />}
        </AccountCard>
      ) : null}
      {activeSection === "generation" ? (
        <AccountCard
          customerId={customer.id}
          id="account-generation"
          list="jobs"
          loadingTitle="Generation"
          onPageChange={(next) => updatePageState("generation", "jobs", next)}
          pageState={pageState("generation", "jobs")}
          section="generation"
          siteId={siteId}
        >
          {(runtime) => <GenerationCard basePath={basePath} runtime={runtime} />}
        </AccountCard>
      ) : null}
      {activeSection === "downloads" ? (
        <>
          <AccountCard
            customerId={customer.id}
            id="account-downloads"
            list="downloads"
            loadingTitle="Download history"
            onPageChange={(next) => updatePageState("downloads", "downloads", next)}
            pageState={pageState("downloads", "downloads")}
            reloadNonce={downloadsReload}
            section="downloads"
            siteId={siteId}
          >
            {(runtime) => (
              <DownloadsHistoryCard
                onRemoveRecord={aivideosUgcAccount ? (entry) => void removeDownloadRecord(entry.id, entry.label) : undefined}
                removingRecordId={removingRecordId}
                runtime={runtime}
              />
            )}
          </AccountCard>
          <AccountCard
            customerId={customer.id}
            id="account-ready-assets"
            list="assets"
            loadingTitle="Ready assets"
            onPageChange={(next) => updatePageState("downloads", "assets", next)}
            pageState={pageState("downloads", "assets")}
            reloadNonce={downloadsReload}
            section="downloads"
            siteId={siteId}
          >
            {(runtime) => (
              <ReadyAssetsCard
                onRemoveAsset={aivideosUgcAccount ? (asset) => void removeCustomerAsset(asset) : undefined}
                removingAssetId={removingAssetId}
                runtime={runtime}
                siteSlug={siteSlug}
              />
            )}
          </AccountCard>
        </>
      ) : null}
      {activeSection === "albums" && !hideStudioExtras ? (
        <AccountCard
          customerId={customer.id}
          id="account-albums"
          list="albums"
          loadingTitle="Albums"
          onPageChange={(next) => updatePageState("albums", "albums", next)}
          pageState={pageState("albums", "albums")}
          section="albums"
          siteId={siteId}
        >
          {(runtime) => <AlbumsCard runtime={runtime} />}
        </AccountCard>
      ) : null}
      {activeSection === "models" && !hideStudioExtras ? (
        <AccountCard
          customerId={customer.id}
          id="account-models"
          list="models"
          loadingTitle="Models"
          onPageChange={(next) => updatePageState("models", "models", next)}
          pageState={pageState("models", "models")}
          section="models"
          siteId={siteId}
        >
          {(runtime) => <ModelsCard runtime={runtime} />}
        </AccountCard>
      ) : null}
    </div>
    </AccountTimeModeContext.Provider>
  );
}
