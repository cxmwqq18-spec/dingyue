"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import type { ThemeRuntimeData } from "@/lib/types";

export type AccountSection = "plan" | "orders" | "jobs" | "albums" | "credits";
type LoadState =
  | { status: "loading"; runtime?: undefined; error?: undefined }
  | { status: "ready"; runtime: ThemeRuntimeData; error?: undefined }
  | { status: "error"; runtime?: undefined; error: string };

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

function emptyRuntime(): ThemeRuntimeData {
  return {
    jobs: [],
    assets: [],
    albums: [],
    ledger: [],
    subscriptions: [],
    orders: [],
    customerModels: []
  };
}

function money(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amountCents / 100);
}

function dateLabel(value: string | undefined) {
  if (!value) return "Not started";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not started";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function jobStatusLabel(status: string) {
  if (status === "queued") return "Waiting";
  if (status === "running") return "Creating";
  if (status === "succeeded") return "Delivered";
  if (status === "failed") return "Needs review";
  return "Credits returned";
}

function orderStatusLabel(status: string) {
  if (status === "paid") return "Paid";
  if (status === "fulfilled") return "Fulfilled";
  if (status === "checkout_started") return "Checkout started";
  if (status === "refunded") return "Refunded";
  if (status === "expired") return "Expired";
  return "Created";
}

function albumStatusLabel(status: string) {
  if (status === "ready") return "Ready";
  if (status === "processing") return "Preparing";
  return "Archived";
}

function ledgerLabel(type: string) {
  if (type === "grant") return "Credits added";
  if (type === "reserve") return "Credits held";
  if (type === "consume") return "Credits used";
  if (type === "release") return "Credits returned";
  return "Balance adjusted";
}

function requestTitle(jobId: string, index: number) {
  const suffix = jobId.split("_").filter(Boolean).at(-1);
  return `Album request ${suffix ? suffix.toUpperCase() : String(index + 1).padStart(2, "0")}`;
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
  initialRuntime,
  id,
  loadingTitle,
  section,
  siteId,
  customerId
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
    <div className="scroll-mt-28 rounded-[18px] border border-[#dfd3c4] bg-white p-5" id={id}>
      {state.status === "loading" ? <LoadingBlock title={loadingTitle} /> : null}
      {state.status === "error" ? <ErrorBlock /> : null}
      {state.status === "ready" ? children(state.runtime) : null}
    </div>
  );
}

function LoadingBlock({ title }: { title: string }) {
  return (
    <div aria-busy="true">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">{title}</p>
      <div className="mt-5 grid gap-3">
        <div className="h-6 w-32 rounded-full bg-[#eee5d9]" />
        <div className="h-16 rounded-[18px] bg-[#fbf7f0]" />
        <div className="h-16 rounded-[18px] bg-[#fbf7f0]" />
      </div>
    </div>
  );
}

function ErrorBlock() {
  return (
    <p className="rounded-[18px] border border-dashed border-[#d8cab9] bg-[#fbf7f0] p-4 text-sm text-[#706961]">
      This account module could not load. Refresh the page or sign in again.
    </p>
  );
}

function PlanCard({ runtime }: { runtime: ThemeRuntimeData }) {
  const subscriptions = runtime.subscriptions ?? [];
  const activeSubscription = subscriptions.find((subscription) => subscription.status === "active" || subscription.status === "trialing") ?? subscriptions[0];
  const balance = runtime.customer?.balance.available ?? 0;
  const reserved = runtime.customer?.balance.reserved ?? 0;
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">Plan</p>
          <h3 className="mt-2 text-xl font-semibold text-[#171514]">{activeSubscription ? "Active photo plan" : "No active plan"}</h3>
        </div>
        <span className="rounded-full border border-[#e2d6c8] bg-[#fbf7f0] px-3 py-1 text-xs font-semibold text-[#7d6e61]">
          {activeSubscription?.status ?? "none"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[18px] border border-[#eadfce] bg-[#fbf7f0] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">Available</p>
          <p className="mt-2 text-2xl font-semibold">{balance}</p>
        </div>
        <div className="rounded-[18px] border border-[#eadfce] bg-[#fbf7f0] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">Reserved</p>
          <p className="mt-2 text-2xl font-semibold">{reserved}</p>
        </div>
        <div className="rounded-[18px] border border-[#eadfce] bg-[#fbf7f0] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">Period end</p>
          <p className="mt-2 text-sm font-semibold">{dateLabel(activeSubscription?.currentPeriodEnd)}</p>
        </div>
      </div>
    </>
  );
}

function OrdersCard({ runtime, siteSlug }: { runtime: ThemeRuntimeData; siteSlug: string }) {
  const orders = runtime.orders ?? [];
  const jobs = runtime.jobs ?? [];
  return (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">Orders</p>
      <div className="mt-4 grid gap-3">
        {orders.length ? orders.slice(0, 12).map((order) => (
          <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[#eadfce] bg-[#fbf7f0] p-4 text-sm" key={order.id}>
            <div>
              <p className="font-semibold text-[#171514]">{money(order.amountCents, order.currency)}</p>
              <p className="mt-1 text-xs text-[#7d7064]">{order.credits} credits · {dateLabel(order.createdAt)}</p>
            </div>
            <span className="rounded-full border border-[#e2d6c8] bg-white px-3 py-1 text-xs font-semibold text-[#7d6e61]">{orderStatusLabel(order.status)}</span>
          </div>
        )) : jobs.length ? jobs.slice(0, 12).map((job, index) => (
          <StorefrontInstantLink className="flex items-center justify-between gap-3 rounded-[18px] border border-[#eadfce] bg-[#fbf7f0] p-4 text-sm transition hover:bg-white" href={`/site/${siteSlug}/app/jobs/${job.id}`} key={job.id}>
            <div>
              <p className="font-semibold text-[#171514]">{requestTitle(job.id, index)}</p>
              <p className="mt-1 text-xs text-[#7d7064]">{job.creditsReserved} credits · {dateLabel(job.createdAt)}</p>
            </div>
            <span className="rounded-full border border-[#e2d6c8] bg-white px-3 py-1 text-xs font-semibold text-[#7d6e61]">{jobStatusLabel(job.status)}</span>
          </StorefrontInstantLink>
        )) : (
          <p className="rounded-[18px] border border-dashed border-[#d8cab9] bg-[#fbf7f0] p-4 text-sm text-[#706961]">No orders recorded for this account yet.</p>
        )}
      </div>
    </>
  );
}

function JobsCard({ runtime, siteSlug }: { runtime: ThemeRuntimeData; siteSlug: string }) {
  const jobs = runtime.jobs ?? [];
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">Generation progress</p>
        <StorefrontInstantLink className="inline-flex items-center gap-1 text-xs font-semibold text-[#171514]" href={`/site/${siteSlug}/app/jobs/progress`}>
          View all
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
        </StorefrontInstantLink>
      </div>
      <div className="mt-4 grid gap-3">
        {jobs.length ? jobs.slice(0, 12).map((job, index) => (
          <StorefrontInstantLink className="rounded-[18px] border border-[#eadfce] bg-[#fbf7f0] p-4 text-sm transition hover:bg-white" href={`/site/${siteSlug}/app/jobs/${job.id}`} key={job.id}>
            <p className="font-semibold text-[#171514]">{requestTitle(job.id, index)}</p>
            <p className="mt-1 text-xs text-[#7d7064]">{jobStatusLabel(job.status)} · {job.creditsReserved} credits held</p>
          </StorefrontInstantLink>
        )) : (
          <p className="rounded-[18px] border border-dashed border-[#d8cab9] bg-[#fbf7f0] p-4 text-sm text-[#706961]">No album requests yet.</p>
        )}
      </div>
    </>
  );
}

function AlbumsCard({ runtime, siteSlug }: { runtime: ThemeRuntimeData; siteSlug: string }) {
  const albums = runtime.albums ?? [];
  const ledger = runtime.ledger ?? [];
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">Albums</p>
        <StorefrontInstantLink className="inline-flex items-center gap-1 text-xs font-semibold text-[#171514]" href={`/site/${siteSlug}/album`}>
          Gallery
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
        </StorefrontInstantLink>
      </div>
      <div className="mt-4 grid gap-3">
        {albums.length ? albums.slice(0, 12).map((album) => (
          <div className="rounded-[18px] border border-[#eadfce] bg-[#fbf7f0] p-4 text-sm" key={album.id}>
            <p className="font-semibold text-[#171514]">{album.title}</p>
            <p className="mt-1 text-xs text-[#7d7064]">{albumStatusLabel(album.status)} · {album.outputCount} images</p>
          </div>
        )) : ledger.length ? ledger.slice(0, 3).map((entry) => (
          <div className="rounded-[18px] border border-[#eadfce] bg-[#fbf7f0] p-4 text-sm" key={entry.id}>
            <p className="font-semibold text-[#171514]">{ledgerLabel(entry.type)}</p>
            <p className="mt-1 text-xs text-[#7d7064]">{entry.amount} credits · {dateLabel(entry.createdAt)}</p>
          </div>
        )) : (
          <p className="rounded-[18px] border border-dashed border-[#d8cab9] bg-[#fbf7f0] p-4 text-sm text-[#706961]">Albums will appear here after your first photo set.</p>
        )}
      </div>
    </>
  );
}

function CreditsCard({ runtime }: { runtime: ThemeRuntimeData }) {
  const ledger = runtime.ledger ?? [];
  const balance = runtime.customer?.balance.available ?? 0;
  const reserved = runtime.customer?.balance.reserved ?? 0;
  return (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">Credits</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-[#eadfce] bg-[#fbf7f0] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">Available credits</p>
          <p className="mt-2 text-2xl font-semibold">{balance}</p>
        </div>
        <div className="rounded-[18px] border border-[#eadfce] bg-[#fbf7f0] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">Reserved credits</p>
          <p className="mt-2 text-2xl font-semibold">{reserved}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {ledger.length ? ledger.slice(0, 8).map((entry) => (
          <div className="rounded-[18px] border border-[#eadfce] bg-[#fbf7f0] p-4 text-sm" key={entry.id}>
            <p className="font-semibold text-[#171514]">{ledgerLabel(entry.type)}</p>
            <p className="mt-1 text-xs text-[#7d7064]">{entry.amount} credits · {dateLabel(entry.createdAt)}</p>
          </div>
        )) : (
          <p className="rounded-[18px] border border-dashed border-[#d8cab9] bg-[#fbf7f0] p-4 text-sm text-[#706961]">Credit activity will appear here after checkout or generation.</p>
        )}
      </div>
    </>
  );
}

export function CustomerAccountDataIsland({
  activeSection,
  customerId,
  initialRuntime,
  siteId,
  siteSlug
}: {
  activeSection: AccountSection;
  customerId: string;
  initialRuntime?: ThemeRuntimeData;
  siteId: string;
  siteSlug: string;
}) {
  return (
    <div className="min-w-0">
      {activeSection === "plan" ? (
        <AccountCard customerId={customerId} id="account-plan" initialRuntime={initialRuntime} loadingTitle="Plan" section="plan" siteId={siteId}>
          {(runtime) => <PlanCard runtime={runtime} />}
        </AccountCard>
      ) : null}
      {activeSection === "orders" ? (
        <AccountCard customerId={customerId} id="account-orders" initialRuntime={initialRuntime} loadingTitle="Orders" section="orders" siteId={siteId}>
          {(runtime) => <OrdersCard runtime={runtime} siteSlug={siteSlug} />}
        </AccountCard>
      ) : null}
      {activeSection === "jobs" ? (
        <AccountCard customerId={customerId} id="account-progress" initialRuntime={initialRuntime} loadingTitle="Generation progress" section="jobs" siteId={siteId}>
          {(runtime) => <JobsCard runtime={runtime} siteSlug={siteSlug} />}
        </AccountCard>
      ) : null}
      {activeSection === "albums" ? (
        <AccountCard customerId={customerId} id="account-albums" initialRuntime={initialRuntime} loadingTitle="Albums" section="albums" siteId={siteId}>
          {(runtime) => <AlbumsCard runtime={runtime} siteSlug={siteSlug} />}
        </AccountCard>
      ) : null}
      {activeSection === "credits" ? (
        <AccountCard customerId={customerId} id="account-credits" initialRuntime={initialRuntime} loadingTitle="Credits" section="credits" siteId={siteId}>
          {(runtime) => <CreditsCard runtime={runtime} />}
        </AccountCard>
      ) : null}
    </div>
  );
}
