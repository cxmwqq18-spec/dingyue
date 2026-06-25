"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import type { ThemeRuntimeData } from "@/lib/types";

type LoadState =
  | { status: "loading"; runtime?: undefined; error?: undefined }
  | { status: "ready"; runtime: ThemeRuntimeData; error?: undefined }
  | { status: "error"; runtime?: undefined; error: string };

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

function LoadingCard({ title }: { title: string }) {
  return (
    <div className="rounded-[24px] border border-[#dfd3c4] bg-white p-5" aria-busy="true">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">{title}</p>
      <div className="mt-5 grid gap-3">
        <div className="h-6 w-32 rounded-full bg-[#eee5d9]" />
        <div className="h-16 rounded-[18px] bg-[#fbf7f0]" />
        <div className="h-16 rounded-[18px] bg-[#fbf7f0]" />
      </div>
    </div>
  );
}

export function CustomerAccountDataIsland({ siteId, siteSlug }: { siteId: string; siteSlug: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch(`/api/sites/${siteId}/customer/runtime?profile=account`, {
      credentials: "same-origin",
      signal: controller.signal
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { ok?: boolean; runtime?: ThemeRuntimeData; error?: string };
        if (!response.ok || !data.ok || !data.runtime) {
          throw new Error(data.error || "account_data_unavailable");
        }
        setState({ status: "ready", runtime: data.runtime });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", error: error instanceof Error ? error.message : "account_data_unavailable" });
      });
    return () => controller.abort();
  }, [siteId]);

  const content = useMemo(() => {
    if (state.status !== "ready") return undefined;
    const runtime = state.runtime;
    const subscriptions = runtime.subscriptions ?? [];
    const orders = runtime.orders ?? [];
    const jobs = runtime.jobs ?? [];
    const albums = runtime.albums ?? [];
    const ledger = runtime.ledger ?? [];
    const activeSubscription = subscriptions.find((subscription) => subscription.status === "active" || subscription.status === "trialing") ?? subscriptions[0];
    return { runtime, subscriptions, orders, jobs, albums, ledger, activeSubscription };
  }, [state]);

  if (state.status === "loading") {
    return (
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <LoadingCard title="Plan" />
        <LoadingCard title="Orders" />
        <LoadingCard title="Generation progress" />
        <LoadingCard title="Albums and ledger" />
      </div>
    );
  }

  if (state.status === "error" || !content) {
    return (
      <div className="mt-6 rounded-[24px] border border-dashed border-[#d8cab9] bg-white p-5 text-sm text-[#706961]">
        Account activity could not load. Refresh the page or sign in again.
      </div>
    );
  }

  const { runtime, orders, jobs, albums, ledger, activeSubscription } = content;
  const balance = runtime.customer?.balance.available ?? 0;
  const reserved = runtime.customer?.balance.reserved ?? 0;

  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-2">
      <div className="scroll-mt-28 rounded-[24px] border border-[#dfd3c4] bg-white p-5" id="account-plan">
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
      </div>

      <div className="scroll-mt-28 rounded-[24px] border border-[#dfd3c4] bg-white p-5" id="account-orders">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">Orders</p>
        <div className="mt-4 grid gap-3">
          {orders.length ? orders.slice(0, 4).map((order) => (
            <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[#eadfce] bg-[#fbf7f0] p-4 text-sm" key={order.id}>
              <div>
                <p className="font-semibold text-[#171514]">{money(order.amountCents, order.currency)}</p>
                <p className="mt-1 text-xs text-[#7d7064]">{order.credits} credits · {dateLabel(order.createdAt)}</p>
              </div>
              <span className="rounded-full border border-[#e2d6c8] bg-white px-3 py-1 text-xs font-semibold text-[#7d6e61]">{orderStatusLabel(order.status)}</span>
            </div>
          )) : (
            <p className="rounded-[18px] border border-dashed border-[#d8cab9] bg-[#fbf7f0] p-4 text-sm text-[#706961]">No orders recorded for this account yet.</p>
          )}
        </div>
      </div>

      <div className="scroll-mt-28 rounded-[24px] border border-[#dfd3c4] bg-white p-5" id="account-progress">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">Generation progress</p>
          <StorefrontInstantLink className="inline-flex items-center gap-1 text-xs font-semibold text-[#171514]" href={`/site/${siteSlug}/app/jobs/progress`}>
            View all
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          </StorefrontInstantLink>
        </div>
        <div className="mt-4 grid gap-3">
          {jobs.length ? jobs.slice(0, 4).map((job, index) => (
            <StorefrontInstantLink className="rounded-[18px] border border-[#eadfce] bg-[#fbf7f0] p-4 text-sm transition hover:bg-white" href={`/site/${siteSlug}/app/jobs/${job.id}`} key={job.id}>
              <p className="font-semibold text-[#171514]">{requestTitle(job.id, index)}</p>
              <p className="mt-1 text-xs text-[#7d7064]">{jobStatusLabel(job.status)} · {job.creditsReserved} credits held</p>
            </StorefrontInstantLink>
          )) : (
            <p className="rounded-[18px] border border-dashed border-[#d8cab9] bg-[#fbf7f0] p-4 text-sm text-[#706961]">No generation jobs yet.</p>
          )}
        </div>
      </div>

      <div className="scroll-mt-28 rounded-[24px] border border-[#dfd3c4] bg-white p-5" id="account-albums">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9b8a79]">Albums and ledger</p>
          <StorefrontInstantLink className="inline-flex items-center gap-1 text-xs font-semibold text-[#171514]" href={`/site/${siteSlug}/album`}>
            Gallery
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          </StorefrontInstantLink>
        </div>
        <div className="mt-4 grid gap-3">
          {albums.length ? albums.slice(0, 3).map((album) => (
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
            <p className="rounded-[18px] border border-dashed border-[#d8cab9] bg-[#fbf7f0] p-4 text-sm text-[#706961]">Albums and ledger activity will appear here after the first request.</p>
          )}
        </div>
      </div>
    </div>
  );
}
