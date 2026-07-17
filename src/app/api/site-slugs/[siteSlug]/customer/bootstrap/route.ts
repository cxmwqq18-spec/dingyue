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
import { cookies } from "next/headers";
import type { ThemeRuntimeData } from "@/lib/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function hasAnyCustomerSessionCookie(): Promise<boolean> {
  return (await cookies()).getAll().some((cookie) => cookie.name.startsWith("customer_session_") && Boolean(cookie.value));
}

function emptyRuntime(runtime: Partial<ThemeRuntimeData> = {}): ThemeRuntimeData {
  return {
    jobs: [],
    assets: [],
    albums: [],
    ledger: [],
    subscriptions: [],
    orders: [],
    customerModels: [],
    ...runtime
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const includeMode = new URL(request.url).searchParams.get("include");
  if (!(await hasAnyCustomerSessionCookie())) {
    if (includeMode === "shell") {
      return NextResponse.json(
        {
          ok: true,
          authenticated: false,
          site: undefined,
          siteAiApps: [],
          creativePackCategories: [],
          creativePacks: [],
          toolMenuItems: []
        },
        { headers: { "Cache-Control": "private, max-age=8" } }
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
          toolMenuItems: []
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
        toolMenuItems: bootstrap?.toolMenuItems ?? []
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
        accountRuntime
      },
      { headers: { "Cache-Control": "private, max-age=8" } }
    ), request, siteId, current);
  }

  const [bootstrap, workspaceState, adminAccess] = await Promise.all([
    getCustomerWorkspaceBootstrapRelational(siteSlug),
    readStorefrontCustomerRuntimeStateForSiteFromDatabase({
      siteId,
      sessionId: current.sessionId,
      profile: "workspace"
    }).catch(() => undefined),
    getCustomerAdminAccessForSite({ siteId, customer: current.customer })
  ]);
  if (!bootstrap) {
    return NextResponse.json({ ok: false, error: "site_not_found" }, { status: 404 });
  }
  const workspaceRuntime = workspaceState
    ? getThemeRuntimeForCustomer(workspaceState, siteId, current.customer.id)
    : emptyRuntime({ customer: current.customer });

  return ensureCustomerCsrfCookie(NextResponse.json(
    {
      ok: true,
      site: bootstrap.site,
      customer: current.customer,
      siteAiApps: bootstrap.siteAiApps,
      creativePackCategories: bootstrap.creativePackCategories,
      creativePacks: bootstrap.creativePacks,
      toolMenuItems: bootstrap.toolMenuItems,
      workspaceRuntime: {
        ...workspaceRuntime,
        customer: current.customer,
        adminAccess
      }
    },
    { headers: { "Cache-Control": "private, max-age=8" } }
  ), request, siteId, current);
}
