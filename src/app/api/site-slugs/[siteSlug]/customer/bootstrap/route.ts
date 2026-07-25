import { NextResponse } from "next/server";
import { publicSiteSlug } from "@/lib/domain-routing";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { getCustomerAdminAccessForSite } from "@/lib/customer-admin-access";
import { ensureCustomerCsrfCookie } from "@/lib/customer-csrf";
import {
  getCustomerWorkspaceBootstrapRelational,
  getCustomerWorkspaceSiteShellRelational,
  getSiteIdBySlugRelational
} from "@/lib/stores/site-store";
import { getThemeRuntimeForCustomer } from "@/lib/server-store";
import { readStorefrontCustomerRuntimeStateForSiteFromDatabase } from "@/lib/storefront-state";
import type { ThemeRuntimeData } from "@/lib/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const PUBLIC_EMPTY_SHELL_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=1800";

function hasAnyCustomerSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("customer_session_") && Boolean(cookie.value));
}

function workspaceRuntimePreloadTimeoutMs(): number {
  const configured = Number.parseInt(process.env.STOREFRONT_WORKSPACE_INITIAL_RUNTIME_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(configured) && configured >= 500 ? configured : 2_500;
}

function withWorkspaceRuntimePreloadTimeout<T>({
  label,
  promise,
  timeoutMs
}: {
  label: string;
  promise: Promise<T | undefined>;
  timeoutMs: number;
}): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => {
      timer = setTimeout(() => {
        console.warn(`[customer-bootstrap] ${label} timed out after ${timeoutMs}ms; deferring to client runtime refresh.`);
        resolve(undefined);
      }, timeoutMs);
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const includeMode = new URL(request.url).searchParams.get("include");
  if (!hasAnyCustomerSessionCookie(request)) {
    if (includeMode === "shell") {
      return NextResponse.json(
        {
          ok: true,
          authenticated: false,
          site: undefined,
          siteAiApps: [],
          creativePackCategories: [],
          creativePacks: [],
          toolMenuItems: [],
          videoThemes: []
        },
        { headers: { "Cache-Control": PUBLIC_EMPTY_SHELL_CACHE_CONTROL, Vary: "Cookie" } }
      );
    }
    return NextResponse.json(
      { ok: false, error: "customer_login_required", loginPath: `/site/${publicSiteSlug(siteSlug)}/login` },
      { status: 401 }
    );
  }
  const siteId = await getSiteIdBySlugRelational(siteSlug);
  if (!siteId) {
    return NextResponse.json({ ok: false, error: "site_not_found" }, { status: 404 });
  }

  const current = await getCurrentCustomerForSite(siteId);
  if (!current) {
    if (includeMode === "shell") {
      return NextResponse.json(
        {
          ok: true,
          authenticated: false,
          site: undefined,
          siteAiApps: [],
          creativePackCategories: [],
          creativePacks: [],
          toolMenuItems: [],
          videoThemes: []
        },
        { headers: { "Cache-Control": "private, max-age=8" } }
      );
    }
    return NextResponse.json(
      { ok: false, error: "customer_login_required", loginPath: `/site/${publicSiteSlug(siteSlug)}/login` },
      { status: 401 }
    );
  }

  if (includeMode === "shell") {
    const [site, bootstrap] = await Promise.all([
      getCustomerWorkspaceSiteShellRelational(siteSlug),
      getCustomerWorkspaceBootstrapRelational(siteSlug)
    ]);
    if (!site) {
      return NextResponse.json({ ok: false, error: "site_not_found" }, { status: 404 });
    }

    return ensureCustomerCsrfCookie(NextResponse.json(
      {
        ok: true,
        site,
        customer: current.customer,
        siteAiApps: bootstrap?.siteAiApps ?? [],
        creativePackCategories: bootstrap?.creativePackCategories ?? [],
        creativePacks: bootstrap?.creativePacks ?? [],
        toolMenuItems: bootstrap?.toolMenuItems ?? [],
        videoThemes: bootstrap?.videoThemes ?? []
      },
      { headers: { "Cache-Control": "private, max-age=8" } }
    ), request, siteId, current);
  }

  if (includeMode === "account") {
    const [site, accountState, bootstrap] = await Promise.all([
      getCustomerWorkspaceSiteShellRelational(siteSlug),
      readStorefrontCustomerRuntimeStateForSiteFromDatabase({
        siteId,
        sessionId: current.sessionId,
        profile: "account"
      }),
      getCustomerWorkspaceBootstrapRelational(siteSlug)
    ]);
    if (!site) {
      return NextResponse.json({ ok: false, error: "site_not_found" }, { status: 404 });
    }
    const accountRuntime = accountState
      ? getThemeRuntimeForCustomer(accountState, site.id, current.customer.id)
      : undefined;

    return ensureCustomerCsrfCookie(NextResponse.json(
      {
        ok: true,
        site,
        customer: current.customer,
        siteAiApps: [],
        creativePackCategories: bootstrap?.creativePackCategories ?? [],
        creativePacks: bootstrap?.creativePacks ?? [],
        toolMenuItems: bootstrap?.toolMenuItems ?? [],
        videoThemes: bootstrap?.videoThemes ?? [],
        accountRuntime
      },
      { headers: { "Cache-Control": "private, max-age=8" } }
    ), request, siteId, current);
  }

  const preloadTimeoutMs = workspaceRuntimePreloadTimeoutMs();
  const [bootstrap, workspaceState, adminAccess] = await Promise.all([
    getCustomerWorkspaceBootstrapRelational(siteSlug),
    withWorkspaceRuntimePreloadTimeout({
      label: "workspace runtime preload",
      timeoutMs: preloadTimeoutMs,
      promise: readStorefrontCustomerRuntimeStateForSiteFromDatabase({
        siteId,
        sessionId: current.sessionId,
        profile: "workspace"
      }).catch(() => undefined)
    }),
    withWorkspaceRuntimePreloadTimeout({
      label: "admin access preload",
      timeoutMs: preloadTimeoutMs,
      promise: getCustomerAdminAccessForSite({ siteId, customer: current.customer })
        .catch(() => ({ canBypassBilling: false }))
    }).then((access) => access ?? { canBypassBilling: false })
  ]);
  if (!bootstrap) {
    return NextResponse.json({ ok: false, error: "site_not_found" }, { status: 404 });
  }
  const workspaceRuntime = workspaceState
    ? getThemeRuntimeForCustomer(workspaceState, siteId, current.customer.id)
    : undefined;

  return ensureCustomerCsrfCookie(NextResponse.json(
    {
      ok: true,
      site: bootstrap.site,
      customer: current.customer,
      siteAiApps: bootstrap.siteAiApps,
      creativePackCategories: bootstrap.creativePackCategories,
      creativePacks: bootstrap.creativePacks,
      toolMenuItems: bootstrap.toolMenuItems,
      videoThemes: bootstrap.videoThemes,
      ...(workspaceRuntime ? { workspaceRuntime: {
        ...workspaceRuntime,
        customer: current.customer,
        adminAccess
      } } : {})
    },
    { headers: { "Cache-Control": "private, max-age=8" } }
  ), request, siteId, current);
}
