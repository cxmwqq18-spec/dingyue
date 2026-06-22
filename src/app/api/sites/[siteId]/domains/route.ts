import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { addSiteDomainRelational } from "@/lib/stores/site-store";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { domain?: string; isPrimary?: boolean };
  if (!body.domain) {
    return NextResponse.json({ error: "missing_domain" }, { status: 400 });
  }

  try {
    const result = await addSiteDomainRelational({ siteId, domain: body.domain, isPrimary: body.isPrimary });
    return NextResponse.json({ ok: true, domain: result.domain, site: result.site });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "domain_create_failed" }, { status });
  }
}
