"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerAccountShell } from "@/components/storefront/customer-account-shell";
import { CustomerWorkspaceShell } from "@/components/storefront/customer-workspace-shell";
import type { CreativePack, PublicCustomer, Site, SiteAiApp } from "@/lib/types";

type CustomerBootstrapSite = Pick<Site, "id" | "slug" | "name" | "branding">;
type CustomerBootstrap = {
  site: CustomerBootstrapSite;
  customer: PublicCustomer;
  siteAiApps: SiteAiApp[];
  creativePacks: CreativePack[];
};
type LoadState =
  | { status: "loading"; data?: undefined; error?: undefined; loginPath?: undefined }
  | { status: "ready"; data: CustomerBootstrap; error?: undefined; loginPath?: undefined }
  | { status: "error"; data?: undefined; error: string; loginPath?: string };

const bootstrapCache = new Map<string, CustomerBootstrap>();

async function loadCustomerBootstrap(siteSlug: string, signal?: AbortSignal): Promise<CustomerBootstrap> {
  const cached = bootstrapCache.get(siteSlug);
  if (cached) return cached;

  const response = await fetch(`/api/site-slugs/${encodeURIComponent(siteSlug)}/customer/bootstrap`, {
    credentials: "same-origin",
    signal
  });
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
    creativePacks: data.creativePacks
  };
  bootstrapCache.set(siteSlug, bootstrap);
  return bootstrap;
}

function CustomerPageLocalLoading({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-[#f4ede2] px-5 py-6 text-[#171514]">
      <main className="mx-auto max-w-6xl">
        <div className="rounded-[32px] border border-[#eadfce] bg-[#fffaf3] p-6">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#b17b47]">Loading</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="h-40 rounded-[24px] bg-[#efe5d8]" />
            <div className="h-40 rounded-[24px] bg-[#efe5d8]" />
          </div>
        </div>
      </main>
    </div>
  );
}

function CustomerPageError({ message, loginPath }: { message: string; loginPath?: string }) {
  return (
    <div className="min-h-screen bg-[#f4ede2] px-5 py-6 text-[#171514]">
      <main className="mx-auto max-w-3xl rounded-[32px] border border-[#eadfce] bg-[#fffaf3] p-6">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#b17b47]">Account access</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to continue.</h1>
        <p className="mt-3 text-sm leading-7 text-[#625d56]">{message}</p>
        {loginPath ? (
          <a className="mt-5 inline-flex rounded-full bg-[#171514] px-5 py-3 text-sm font-semibold text-white" href={loginPath}>
            Open sign in
          </a>
        ) : null}
      </main>
    </div>
  );
}

function useCustomerBootstrap(siteSlug: string): LoadState {
  const cacheKey = useMemo(() => siteSlug, [siteSlug]);
  const [state, setState] = useState<LoadState>(() => {
    const cached = bootstrapCache.get(cacheKey);
    return cached ? { status: "ready", data: cached } : { status: "loading" };
  });

  useEffect(() => {
    const cached = bootstrapCache.get(cacheKey);
    if (cached) {
      setState({ status: "ready", data: cached });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });
    loadCustomerBootstrap(siteSlug, controller.signal)
      .then((bootstrap) => setState({ status: "ready", data: bootstrap }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        const loginPath = typeof error === "object" && error && "loginPath" in error && typeof error.loginPath === "string" ? error.loginPath : undefined;
        setState({ status: "error", error: error instanceof Error ? error.message : "customer_bootstrap_unavailable", loginPath });
      });
    return () => controller.abort();
  }, [cacheKey, siteSlug]);

  return state;
}

export function CustomerBootstrapPrefetch({ siteSlug }: { siteSlug: string }) {
  useEffect(() => {
    if (bootstrapCache.has(siteSlug)) return;
    const controller = new AbortController();
    const prefetch = () => {
      loadCustomerBootstrap(siteSlug, controller.signal).catch(() => undefined);
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
  }, [siteSlug]);

  return null;
}

export function CustomerAccountClientPage({ siteSlug }: { siteSlug: string }) {
  const state = useCustomerBootstrap(siteSlug);
  if (state.status === "loading") return <CustomerPageLocalLoading title="Opening your account center." />;
  if (state.status === "error") return <CustomerPageError loginPath={state.loginPath} message="Your account session could not be verified from this browser." />;
  return <CustomerAccountShell customer={state.data.customer} site={state.data.site} />;
}

export function CustomerWorkspaceClientPage({
  initialCreativePackId,
  siteSlug
}: {
  initialCreativePackId?: string;
  siteSlug: string;
}) {
  const state = useCustomerBootstrap(siteSlug);
  if (state.status === "loading") return <CustomerPageLocalLoading title="Opening your private workspace." />;
  if (state.status === "error") return <CustomerPageError loginPath={state.loginPath} message="Your workspace session could not be verified from this browser." />;
  return (
    <CustomerWorkspaceShell
      assets={[]}
      creativePacks={state.data.creativePacks}
      customer={state.data.customer}
      initialCreativePackId={initialCreativePackId}
      site={state.data.site}
      siteAiApps={state.data.siteAiApps}
    />
  );
}
