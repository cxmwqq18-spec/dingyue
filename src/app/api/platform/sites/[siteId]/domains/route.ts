import { NextRequest, NextResponse } from "next/server";
import { requirePlatformMutation } from "@/lib/api-auth";
import { addSiteDomain, StoreError } from "@/lib/server-store";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: `platform:domain:${siteId}:create` });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { domain?: string; isPrimary?: boolean };
  if (!body.domain) {
    return NextResponse.json({ error: "missing_domain" }, { status: 400 });
  }
  try {
    const result = addSiteDomain({ siteId, domain: body.domain, isPrimary: body.isPrimary });
    return NextResponse.json({ ok: true, domain: result.domain, site: result.site });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "domain_create_failed" }, { status });
  }
}
