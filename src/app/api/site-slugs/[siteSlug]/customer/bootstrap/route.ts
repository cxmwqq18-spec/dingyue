import { NextResponse } from "next/server";
import { publicSiteSlug } from "@/lib/domain-routing";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import {
  getCustomerWorkspaceBootstrapRelational,
  getCustomerWorkspaceSiteShellRelational,
  getSiteIdBySlugRelational
} from "@/lib/stores/site-store";
import { getThemeRuntimeForCustomer } from "@/lib/server-store";
import { readStorefrontCustomerRuntimeStateForSiteFromDatabase } from "@/lib/storefront-state";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const includeMode = new URL(request.url).searchParams.get("include");
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
          creativePacks: []
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
    const site = await getCustomerWorkspaceSiteShellRelational(siteSlug);
    if (!site) {
      return NextResponse.json({ ok: false, error: "site_not_found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: true,
        site,
        customer: current.customer,
        siteAiApps: [],
        creativePacks: []
      },
      { headers: { "Cache-Control": "private, max-age=8" } }
    );
  }

  if (includeMode === "account") {
    const [site, accountState] = await Promise.all([
      getCustomerWorkspaceSiteShellRelational(siteSlug),
      readStorefrontCustomerRuntimeStateForSiteFromDatabase({
        siteId,
        sessionId: current.sessionId,
        profile: "account"
      })
    ]);
    if (!site) {
      return NextResponse.json({ ok: false, error: "site_not_found" }, { status: 404 });
    }
    const accountRuntime = accountState
      ? getThemeRuntimeForCustomer(accountState, site.id, current.customer.id)
      : undefined;

    return NextResponse.json(
      {
        ok: true,
        site,
        customer: current.customer,
        siteAiApps: [],
        creativePacks: [],
        accountRuntime
      },
      { headers: { "Cache-Control": "private, max-age=8" } }
    );
  }

  const bootstrap = await getCustomerWorkspaceBootstrapRelational(siteSlug);
  if (!bootstrap) {
    return NextResponse.json({ ok: false, error: "site_not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      site: bootstrap.site,
      customer: current.customer,
      siteAiApps: bootstrap.siteAiApps,
      creativePacks: bootstrap.creativePacks
    },
    { headers: { "Cache-Control": "private, max-age=8" } }
  );
}
