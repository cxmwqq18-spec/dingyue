import { NextResponse } from "next/server";
import { publicSiteSlug } from "@/lib/domain-routing";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { getCustomerWorkspaceBootstrapRelational } from "@/lib/stores/site-store";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const bootstrap = await getCustomerWorkspaceBootstrapRelational(siteSlug);
  if (!bootstrap) {
    return NextResponse.json({ ok: false, error: "site_not_found" }, { status: 404 });
  }

  const current = await getCurrentCustomerForSite(bootstrap.site.id);
  if (!current) {
    return NextResponse.json(
      { ok: false, error: "customer_login_required", loginPath: `/site/${publicSiteSlug(siteSlug)}/login` },
      { status: 401 }
    );
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
