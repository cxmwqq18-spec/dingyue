"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CustomerAccountShell } from "@/components/storefront/customer-account-shell";
import { CUSTOMER_BOOTSTRAP_INVALIDATE_EVENT, type CustomerBootstrapInvalidationDetail } from "@/components/storefront/customer-bootstrap-events";
import { CustomerSignOutButton } from "@/components/storefront/customer-sign-out-button";
import { CustomerWorkspaceShell, type CustomerWorkspacePanel } from "@/components/storefront/customer-workspace-shell";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";
import { UserRound } from "lucide-react";
import type { CreativePack, CreativePackCategory, PublicCustomer, Site, SiteAiApp, ThemeRuntimeData, ToolMenuItem, VideoTheme } from "@/lib/types";

type CustomerBootstrapSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;
export type CustomerBootstrap = {
  authenticated?: boolean;
  site?: CustomerBootstrapSite;
  customer?: PublicCustomer;
  siteAiApps: SiteAiApp[];
  creativePackCategories?: CreativePackCategory[];
  creativePacks: CreativePack[];
  toolMenuItems?: ToolMenuItem[];
  videoThemes?: VideoTheme[];
  accountRuntime?: ThemeRuntimeData;
  workspaceRuntime?: ThemeRuntimeData;
};
type LoadState =
  | { status: "loading"; data?: undefined; error?: undefined; loginPath?: undefined }
  | { status: "ready"; data: CustomerBootstrap; error?: undefined; loginPath?: undefined }
  | { status: "error"; data?: undefined; error: string; loginPath?: string };
type BootstrapMode = "workspace" | "shell" | "account";
type AuthenticatedCustomerBootstrap = CustomerBootstrap & {
  site: CustomerBootstrapSite;
  customer: PublicCustomer;
};
type BootstrapErrorPayload = Partial<CustomerBootstrap> & {
  ok?: boolean;
  error?: string;
  loginPath?: string;
};
const workspaceRuntimeWarmCache = new Set<string>();
const workspaceRuntimeWarmRequests = new Map<string, Promise<void>>();

const bootstrapCache = new Map<string, CustomerBootstrap>();
const bootstrapRequests = new Map<string, Promise<CustomerBootstrap>>();
let bootstrapCacheEpoch = 0;

function bootstrapCacheKey(siteSlug: string, mode: BootstrapMode): string {
  return mode === "workspace" ? siteSlug : `${siteSlug}:${mode}`;
}

function isAuthenticatedBootstrap(bootstrap: CustomerBootstrap): bootstrap is AuthenticatedCustomerBootstrap {
  return Boolean(bootstrap.site && bootstrap.customer);
}

function isLoginRequiredBootstrapError(response: Response, data: BootstrapErrorPayload): boolean {
  return response.status === 401 || data.error === "auth_required" || data.error === "customer_login_required" || Boolean(data.loginPath);
}

function bootstrapArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function customerBootstrapAbortError() {
  return Object.assign(new Error("customer_bootstrap_aborted"), { name: "AbortError" });
}

function clearCustomerBootstrapCache(siteSlug?: string) {
  bootstrapCacheEpoch += 1;
  if (!siteSlug) {
    bootstrapCache.clear();
    bootstrapRequests.clear();
    workspaceRuntimeWarmCache.clear();
    workspaceRuntimeWarmRequests.clear();
    return;
  }
  [siteSlug, bootstrapCacheKey(siteSlug, "shell"), bootstrapCacheKey(siteSlug, "account")].forEach((key) => {
    bootstrapCache.delete(key);
    bootstrapRequests.delete(key);
  });
  Array.from(workspaceRuntimeWarmCache).forEach((key) => {
    if (key.endsWith(`:${siteSlug}`)) workspaceRuntimeWarmCache.delete(key);
  });
  Array.from(workspaceRuntimeWarmRequests.keys()).forEach((key) => {
    if (key.endsWith(`:${siteSlug}`)) workspaceRuntimeWarmRequests.delete(key);
  });
}

function invalidationSiteSlug(event: Event): string | undefined {
  if (!(event instanceof CustomEvent)) return undefined;
  const detail = event.detail as CustomerBootstrapInvalidationDetail | undefined;
  return typeof detail?.siteSlug === "string" && detail.siteSlug ? detail.siteSlug : undefined;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function loadCustomerBootstrap(siteSlug: string, signal?: AbortSignal, mode: BootstrapMode = "workspace"): Promise<CustomerBootstrap> {
  if (signal?.aborted) throw customerBootstrapAbortError();
  const cacheKey = bootstrapCacheKey(siteSlug, mode);
  const cached = bootstrapCache.get(cacheKey);
  if (cached) return cached;
  const shellCached = mode !== "workspace" ? bootstrapCache.get(siteSlug) : undefined;
  if (mode === "shell" && shellCached) return shellCached;
  if (mode === "account" && shellCached?.accountRuntime) return shellCached;
  const inFlight = bootstrapRequests.get(cacheKey);
  if (inFlight) return inFlight;

  const query = mode === "workspace" ? "" : `?include=${mode}`;
  const requestEpoch = bootstrapCacheEpoch;
  const request = fetch(`/api/site-slugs/${encodeURIComponent(siteSlug)}/customer/bootstrap${query}`, {
    credentials: "same-origin",
    signal
  })
    .then(async (response) => {
      if (signal?.aborted || requestEpoch !== bootstrapCacheEpoch) throw customerBootstrapAbortError();
      const data = (await response.json().catch(() => ({}))) as BootstrapErrorPayload;
      if (signal?.aborted || requestEpoch !== bootstrapCacheEpoch) throw customerBootstrapAbortError();
      const siteAiApps = bootstrapArray(data.siteAiApps);
      const creativePackCategories = bootstrapArray(data.creativePackCategories);
      const creativePacks = bootstrapArray(data.creativePacks);
      const toolMenuItems = bootstrapArray(data.toolMenuItems);
      const videoThemes = bootstrapArray(data.videoThemes);
      if (mode === "shell" && isLoginRequiredBootstrapError(response, data)) {
        const bootstrap = {
          authenticated: false,
          siteAiApps,
          creativePackCategories,
          creativePacks,
          toolMenuItems,
          videoThemes
        };
        bootstrapCache.set(cacheKey, bootstrap);
        return bootstrap;
      }
      if (!response.ok || !data.ok) {
        throw Object.assign(new Error(data.error || "customer_bootstrap_unavailable"), { loginPath: data.loginPath });
      }
      if (mode !== "shell" && (!data.site || !data.customer)) {
        throw Object.assign(new Error(data.error || "customer_bootstrap_unavailable"), { loginPath: data.loginPath });
      }
      const bootstrap = {
        authenticated: data.authenticated ?? Boolean(data.customer),
        site: data.site,
        customer: data.customer,
        siteAiApps,
        creativePackCategories,
        creativePacks,
        toolMenuItems,
        videoThemes,
        accountRuntime: data.accountRuntime,
        workspaceRuntime: data.workspaceRuntime
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

function useCustomerBootstrap(siteSlug: string, mode: BootstrapMode = "workspace", enabled = true, delayMs = 0): LoadState {
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
    const cancelBootstrap = () => {
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
    const invalidateBootstrap = (event: Event) => {
      const targetSiteSlug = invalidationSiteSlug(event);
      if (targetSiteSlug && targetSiteSlug !== siteSlug) return;
      clearCustomerBootstrapCache(siteSlug);
      cancelBootstrap();
    };
    const load = () => {
      setState({ status: "loading" });
      loadCustomerBootstrap(siteSlug, controller.signal, mode)
        .then((bootstrap) => {
          if (controller.signal.aborted) return;
          setState({ status: "ready", data: bootstrap });
        })
        .catch((error) => {
          if (controller.signal.aborted || isAbortError(error)) return;
          const loginPath = typeof error === "object" && error && "loginPath" in error && typeof error.loginPath === "string" ? error.loginPath : undefined;
          setState({ status: "error", error: error instanceof Error ? error.message : "customer_bootstrap_unavailable", loginPath });
        });
    };
    const timer = delayMs > 0 ? window.setTimeout(load, delayMs) : undefined;
    if (!timer) load();
    window.addEventListener("storefront:navigation-start", invalidateBootstrap);
    window.addEventListener(CUSTOMER_BOOTSTRAP_INVALIDATE_EVENT, invalidateBootstrap);
    return () => {
      window.removeEventListener("storefront:navigation-start", invalidateBootstrap);
      window.removeEventListener(CUSTOMER_BOOTSTRAP_INVALIDATE_EVENT, invalidateBootstrap);
      cancelBootstrap();
    };
  }, [cacheKey, delayMs, enabled, mode, siteSlug]);

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
    const delayMs = mode === "shell" ? 3200 : 400;
    const idleId = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(prefetch, { timeout: 1200 });
        return;
      }
      prefetch();
    }, delayMs);
    const cancelBootstrapPrefetch = () => {
      controller.abort();
      window.clearTimeout(idleId);
    };
    const invalidateBootstrapPrefetch = (event: Event) => {
      const targetSiteSlug = invalidationSiteSlug(event);
      if (targetSiteSlug && targetSiteSlug !== siteSlug) return;
      clearCustomerBootstrapCache(siteSlug);
      cancelBootstrapPrefetch();
    };
    window.addEventListener("storefront:navigation-start", invalidateBootstrapPrefetch);
    window.addEventListener(CUSTOMER_BOOTSTRAP_INVALIDATE_EVENT, invalidateBootstrapPrefetch);
    return () => {
      window.removeEventListener("storefront:navigation-start", invalidateBootstrapPrefetch);
      window.removeEventListener(CUSTOMER_BOOTSTRAP_INVALIDATE_EVENT, invalidateBootstrapPrefetch);
      cancelBootstrapPrefetch();
    };
  }, [mode, siteSlug]);

  return null;
}

async function warmCustomerWorkspaceRuntime(siteSlug: string, siteId: string, signal?: AbortSignal): Promise<void> {
  const cacheKey = `${siteId}:${siteSlug}`;
  if (workspaceRuntimeWarmCache.has(cacheKey)) return;
  const inFlight = workspaceRuntimeWarmRequests.get(cacheKey);
  if (inFlight) return inFlight;
  const request = loadCustomerBootstrap(siteSlug, signal, "shell")
    .then(async (bootstrap) => {
      if (!bootstrap.customer) return;
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/customer/runtime?profile=workspace`, {
        cache: "no-store",
        credentials: "same-origin",
        signal
      });
      if (response.ok) workspaceRuntimeWarmCache.add(cacheKey);
    })
    .catch(() => undefined)
    .finally(() => {
      workspaceRuntimeWarmRequests.delete(cacheKey);
    });
  workspaceRuntimeWarmRequests.set(cacheKey, request);
  return request;
}

export function CustomerWorkspaceRuntimePrefetch({ siteId, siteSlug }: { siteId: string; siteSlug: string }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STOREFRONT_WORKSPACE_RUNTIME_PREFETCH === "0") return;
    const cacheKey = `${siteId}:${siteSlug}`;
    if (workspaceRuntimeWarmCache.has(cacheKey)) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData) return;
    if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType)) return;
    const controller = new AbortController();
    let idleId: number | undefined;
    const prefetch = () => {
      void warmCustomerWorkspaceRuntime(siteSlug, siteId, controller.signal);
    };
    const timerId = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(prefetch, { timeout: 2200 });
        return;
      }
      prefetch();
    }, Number(process.env.NEXT_PUBLIC_STOREFRONT_WORKSPACE_RUNTIME_PREFETCH_DELAY_MS ?? 1200));
    const cancel = () => {
      controller.abort();
      window.clearTimeout(timerId);
      if (idleId !== undefined && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
    };
    window.addEventListener("storefront:navigation-start", cancel);
    return () => {
      window.removeEventListener("storefront:navigation-start", cancel);
      cancel();
    };
  }, [siteId, siteSlug]);

  return null;
}

export function CustomerHeaderBootstrapControls({
  children,
  dark = false,
  accountHref,
  loginHref,
  logoutHref,
  siteId,
  siteSlug,
  variant = "desktop",
  signOutLabel = "Sign out",
  signingOutLabel = "Signing out...",
  signedInClassName,
  signOutClassName
}: {
  children: ReactNode;
  dark?: boolean;
  accountHref: string;
  loginHref: string;
  logoutHref: string;
  siteId: string;
  siteSlug: string;
  variant?: "desktop" | "mobile";
  signOutLabel?: string;
  signingOutLabel?: string;
  signedInClassName: string;
  signOutClassName: string;
}) {
  const state = useCustomerBootstrap(siteSlug, "shell", true, Number(process.env.NEXT_PUBLIC_STOREFRONT_HEADER_BOOTSTRAP_DELAY_MS ?? 1800));
  if (state.status !== "ready") return <>{children}</>;
  if (!state.data.customer) return <>{children}</>;
  const customer = state.data.customer;
  if (variant === "mobile") {
    return (
      <div className={signedInClassName}>
        <p className="truncate text-sm font-semibold">{customer.name}</p>
        <p className={dark ? "mt-0.5 truncate text-xs text-white/58" : "mt-0.5 truncate text-xs text-[#64605a]"}>{customer.email}</p>
        <div className="mt-3 grid gap-2">
          <StorefrontInstantLink className={dark ? "inline-flex justify-center whitespace-nowrap rounded-[14px] border border-white/14 px-3 py-2 text-xs font-semibold text-white" : "inline-flex justify-center whitespace-nowrap rounded-[14px] border border-[#ded5ca] px-3 py-2 text-xs font-semibold text-[#171514]"} href={accountHref} prefetch>
            {signOutLabel === "Sign out" ? "Account" : "Cuenta"}
          </StorefrontInstantLink>
        </div>
        <CustomerSignOutButton className={`${signOutClassName} mt-3`} label={signOutLabel} logoutHref={logoutHref} pendingLabel={signingOutLabel} redirectHref={loginHref} siteId={siteId} />
      </div>
    );
  }
  const accountLabel = signOutLabel === "Sign out" ? "Open account" : "Abrir cuenta";
  const avatarUrl = customer.profile?.avatarUrl;
  return (
    <div className={signedInClassName}>
      <StorefrontInstantLink aria-label={accountLabel} className="inline-flex min-w-0 items-center gap-3 rounded-full pr-1 transition hover:opacity-80" href={accountHref} prefetch>
        <span className={dark ? "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#101114]" : "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#15171a] text-white"}>
          {avatarUrl ? <img className="h-full w-full rounded-full object-cover" src={avatarUrl} alt="" /> : <UserRound className="h-4 w-4" strokeWidth={1.8} />}
        </span>
        <span className="hidden min-w-0 text-left lg:block">
          <span className="block max-w-[8.5rem] truncate text-sm font-semibold xl:max-w-[10rem]">{customer.name}</span>
          <span className={dark ? "block max-w-[8.5rem] truncate text-xs text-white/62 xl:max-w-[11rem]" : "block max-w-[8.5rem] truncate text-xs text-[#64605a] xl:max-w-[11rem]"}>
            {customer.email}
          </span>
        </span>
      </StorefrontInstantLink>
      <CustomerSignOutButton className={signOutClassName} label={signOutLabel} logoutHref={logoutHref} pendingLabel={signingOutLabel} redirectHref={loginHref} siteId={siteId} />
    </div>
  );
}

export function CustomerAccountClientPage({
  initialCustomer,
  initialCreativePackCategories = [],
  initialRuntime,
  initialSite,
  initialCreativePacks = [],
  initialToolMenuItems = [],
  siteSlug
}: {
  initialCustomer?: PublicCustomer;
  initialCreativePackCategories?: CreativePackCategory[];
  initialRuntime?: ThemeRuntimeData;
  initialSite?: CustomerBootstrapSite;
  initialCreativePacks?: CreativePack[];
  initialToolMenuItems?: ToolMenuItem[];
  siteSlug: string;
}) {
  const hasInitialAccountData = Boolean(initialCustomer && initialSite);
  const state = useCustomerBootstrap(siteSlug, "account", !hasInitialAccountData);
  if (initialCustomer && initialSite) return <CustomerAccountShell creativePackCategories={initialCreativePackCategories} creativePacks={initialCreativePacks} customer={initialCustomer} initialRuntime={initialRuntime} site={initialSite} toolMenuItems={initialToolMenuItems} />;
  if (state.status === "loading") return <CustomerPageLocalLoading title="Opening your account center." />;
  if (state.status === "error" && state.loginPath) return <CustomerPageRedirect loginPath={state.loginPath} />;
  if (state.status === "error") return <CustomerPageError message="Your account session could not be verified from this browser." />;
  if (!state.data.customer || !state.data.site) return <CustomerPageRedirect loginPath={`/site/${siteSlug}/login`} />;
  return <CustomerAccountShell creativePackCategories={state.data.creativePackCategories} creativePacks={state.data.creativePacks} customer={state.data.customer} initialRuntime={state.data.accountRuntime} site={state.data.site} toolMenuItems={state.data.toolMenuItems} />;
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
  if (initialBootstrap && isAuthenticatedBootstrap(initialBootstrap)) {
    return (
      <CustomerWorkspaceShell
        assets={initialBootstrap.workspaceRuntime?.assets ?? []}
        creativePackCategories={initialBootstrap.creativePackCategories}
        creativePacks={initialBootstrap.creativePacks}
        customer={initialBootstrap.customer}
        initialCreativePackId={initialCreativePackId}
        initialPanel={initialPanel}
        initialRuntime={initialBootstrap.workspaceRuntime}
        initialToolId={initialToolId}
        site={initialBootstrap.site}
        siteAiApps={initialBootstrap.siteAiApps}
        toolMenuItems={initialBootstrap.toolMenuItems}
        videoThemes={initialBootstrap.videoThemes}
      />
    );
  }
  if (state.status === "loading") return <CustomerPageLocalLoading title="Opening your private workspace." />;
  if (state.status === "error" && state.loginPath) return <CustomerPageRedirect loginPath={state.loginPath} />;
  if (state.status === "error") return <CustomerPageError message="Your workspace session could not be verified from this browser." />;
  if (!isAuthenticatedBootstrap(state.data)) return <CustomerPageRedirect loginPath={`/site/${siteSlug}/login`} />;
  return (
    <CustomerWorkspaceShell
      assets={state.data.workspaceRuntime?.assets ?? []}
      creativePackCategories={state.data.creativePackCategories}
      creativePacks={state.data.creativePacks}
      customer={state.data.customer}
      initialCreativePackId={initialCreativePackId}
      initialPanel={initialPanel}
      initialRuntime={state.data.workspaceRuntime}
      initialToolId={initialToolId}
      site={state.data.site}
      siteAiApps={state.data.siteAiApps}
      toolMenuItems={state.data.toolMenuItems}
      videoThemes={state.data.videoThemes}
    />
  );
}
