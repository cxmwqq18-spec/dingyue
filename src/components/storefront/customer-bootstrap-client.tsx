"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerAccountShell } from "@/components/storefront/customer-account-shell";
import { CustomerWorkspaceShell, type CustomerWorkspacePanel } from "@/components/storefront/customer-workspace-shell";
import type { CreativePack, PublicCustomer, Site, SiteAiApp, ThemeRuntimeData } from "@/lib/types";

type CustomerBootstrapSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;
export type CustomerBootstrap = {
  site: CustomerBootstrapSite;
  customer: PublicCustomer;
  siteAiApps: SiteAiApp[];
  creativePacks: CreativePack[];
  accountRuntime?: ThemeRuntimeData;
};
type LoadState =
  | { status: "loading"; data?: undefined; error?: undefined; loginPath?: undefined }
  | { status: "ready"; data: CustomerBootstrap; error?: undefined; loginPath?: undefined }
  | { status: "error"; data?: undefined; error: string; loginPath?: string };
type BootstrapMode = "workspace" | "shell" | "account";

const bootstrapCache = new Map<string, CustomerBootstrap>();
const bootstrapRequests = new Map<string, Promise<CustomerBootstrap>>();

function bootstrapCacheKey(siteSlug: string, mode: BootstrapMode): string {
  return mode === "workspace" ? siteSlug : `${siteSlug}:${mode}`;
}

async function loadCustomerBootstrap(siteSlug: string, signal?: AbortSignal, mode: BootstrapMode = "workspace"): Promise<CustomerBootstrap> {
  const cacheKey = bootstrapCacheKey(siteSlug, mode);
  const cached = bootstrapCache.get(cacheKey);
  if (cached) return cached;
  const shellCached = mode !== "workspace" ? bootstrapCache.get(siteSlug) : undefined;
  if (mode === "shell" && shellCached) return shellCached;
  if (mode === "account" && shellCached?.accountRuntime) return shellCached;
  const inFlight = bootstrapRequests.get(cacheKey);
  if (inFlight) return inFlight;

  const query = mode === "workspace" ? "" : `?include=${mode}`;
  const request = fetch(`/api/site-slugs/${encodeURIComponent(siteSlug)}/customer/bootstrap${query}`, {
    credentials: "same-origin",
    signal
  })
    .then(async (response) => {
      const data = (await response.json().catch(() => ({}))) as Partial<CustomerBootstrap> & {
        ok?: boolean;
        error?: string;
        loginPath?: string;
      };
      if (!response.ok || !data.ok || !data.site || !data.customer || !data.siteAiApps || !data.creativePacks) {
        throw Object.assign(new Error(data.error || "customer_bootstrap_unavailable"), { loginPath: data.loginPath });
      }
      const bootstrap = {
        site: data.site,
        customer: data.customer,
        siteAiApps: data.siteAiApps,
        creativePacks: data.creativePacks,
        accountRuntime: data.accountRuntime
      };
      bootstrapCache.set(cacheKey, bootstrap);
      if (mode === "workspace") bootstrapCache.set(siteSlug, bootstrap);
      return bootstrap;
    })
    .finally(() => {
      bootstrapRequests.delete(cacheKey);
    });
  bootstrapRequests.set(cacheKey, request);
  return request;
}

function CustomerPageLocalLoading({ title }: { title: string }) {
  return (
    <div className="min-h-[40vh] bg-[#f6f1e8] px-5 py-10 text-[#171514]">
      <div
        aria-label={title}
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[2400]"
        role="status"
      >
        <div className="h-[3px] w-full overflow-hidden bg-transparent">
          <div className="h-full w-1/3 animate-[admin-progress_1.05s_ease-in-out_infinite] bg-[#171514]/80" />
        </div>
      </div>
      <main className="mx-auto max-w-3xl rounded-[24px] border border-[#eadfce] bg-[#fffaf3] p-5 shadow-[0_14px_36px_-30px_rgba(20,22,26,0.45)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b6b42]">Loading private data</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-[#625d56]">The page shell is ready. Your private account data is loading in this panel.</p>
      </main>
    </div>
  );
}

function CustomerPageRedirect({ loginPath }: { loginPath: string }) {
  useEffect(() => {
    window.location.replace(loginPath);
  }, [loginPath]);

  return null;
}

function CustomerPageError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#f4ede2] px-5 py-6 text-[#171514]">
      <main className="mx-auto max-w-3xl rounded-[32px] border border-[#eadfce] bg-[#fffaf3] p-6">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#b17b47]">Account access</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to continue.</h1>
        <p className="mt-3 text-sm leading-7 text-[#625d56]">{message}</p>
      </main>
    </div>
  );
}

function useCustomerBootstrap(siteSlug: string, mode: BootstrapMode = "workspace", enabled = true): LoadState {
  const cacheKey = useMemo(() => bootstrapCacheKey(siteSlug, mode), [mode, siteSlug]);
  const [state, setState] = useState<LoadState>(() => {
    const cached = bootstrapCache.get(cacheKey) ?? (mode === "shell" ? bootstrapCache.get(siteSlug) : undefined);
    return cached ? { status: "ready", data: cached } : { status: "loading" };
  });

  useEffect(() => {
    if (!enabled) return;
    const cached = bootstrapCache.get(cacheKey) ?? (mode === "shell" ? bootstrapCache.get(siteSlug) : undefined);
    if (cached) {
      setState({ status: "ready", data: cached });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });
    loadCustomerBootstrap(siteSlug, controller.signal, mode)
      .then((bootstrap) => setState({ status: "ready", data: bootstrap }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        const loginPath = typeof error === "object" && error && "loginPath" in error && typeof error.loginPath === "string" ? error.loginPath : undefined;
        setState({ status: "error", error: error instanceof Error ? error.message : "customer_bootstrap_unavailable", loginPath });
      });
    return () => controller.abort();
  }, [cacheKey, enabled, mode, siteSlug]);

  return state;
}

export function CustomerBootstrapPrefetch({ mode = "workspace", siteSlug }: { mode?: BootstrapMode; siteSlug: string }) {
  useEffect(() => {
    const cacheKey = bootstrapCacheKey(siteSlug, mode);
    if (bootstrapCache.has(cacheKey) || bootstrapCache.has(siteSlug)) return;
    const controller = new AbortController();
    const prefetch = () => {
      loadCustomerBootstrap(siteSlug, controller.signal, mode).catch(() => undefined);
    };
    const idleId = typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(prefetch, { timeout: 1200 })
      : window.setTimeout(prefetch, 400);
    return () => {
      controller.abort();
      if (typeof idleId === "number") {
        window.clearTimeout(idleId);
        return;
      }
      window.cancelIdleCallback?.(idleId);
    };
  }, [mode, siteSlug]);

  return null;
}

export function CustomerAccountClientPage({
  initialCustomer,
  initialSite,
  siteSlug
}: {
  initialCustomer?: PublicCustomer;
  initialSite?: CustomerBootstrapSite;
  siteSlug: string;
}) {
  const hasInitialAccountData = Boolean(initialCustomer && initialSite);
  const state = useCustomerBootstrap(siteSlug, "shell", !hasInitialAccountData);
  if (initialCustomer && initialSite) return <CustomerAccountShell customer={initialCustomer} site={initialSite} />;
  if (state.status === "loading") return <CustomerPageLocalLoading title="Opening your account center." />;
  if (state.status === "error" && state.loginPath) return <CustomerPageRedirect loginPath={state.loginPath} />;
  if (state.status === "error") return <CustomerPageError message="Your account session could not be verified from this browser." />;
  return <CustomerAccountShell customer={state.data.customer} site={state.data.site} />;
}

export function CustomerWorkspaceClientPage({
  initialBootstrap,
  initialCreativePackId,
  initialToolId,
  initialPanel = "overview",
  siteSlug
}: {
  initialBootstrap?: CustomerBootstrap;
  initialCreativePackId?: string;
  initialToolId?: string;
  initialPanel?: CustomerWorkspacePanel;
  siteSlug: string;
}) {
  const state = useCustomerBootstrap(siteSlug, "workspace", !initialBootstrap);
  if (initialBootstrap) {
    return (
      <CustomerWorkspaceShell
        assets={[]}
        creativePacks={initialBootstrap.creativePacks}
        customer={initialBootstrap.customer}
        initialCreativePackId={initialCreativePackId}
        initialPanel={initialPanel}
        initialToolId={initialToolId}
        site={initialBootstrap.site}
        siteAiApps={initialBootstrap.siteAiApps}
      />
    );
  }
  if (state.status === "loading") return <CustomerPageLocalLoading title="Opening your private workspace." />;
  if (state.status === "error" && state.loginPath) return <CustomerPageRedirect loginPath={state.loginPath} />;
  if (state.status === "error") return <CustomerPageError message="Your workspace session could not be verified from this browser." />;
  return (
    <CustomerWorkspaceShell
      assets={[]}
      creativePacks={state.data.creativePacks}
      customer={state.data.customer}
      initialCreativePackId={initialCreativePackId}
      initialPanel={initialPanel}
      initialToolId={initialToolId}
      site={state.data.site}
      siteAiApps={state.data.siteAiApps}
    />
  );
}
