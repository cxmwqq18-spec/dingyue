import { NextRequest, NextResponse } from "next/server";
import { requirePlatformMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { deleteSiteDomainRelational, updateSiteDomainRelational } from "@/lib/stores/site-store";
import type { SiteDomain } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; domainId: string }> }
) {
  const { siteId, domainId } = await params;
  const guard = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: `platform:domain:${siteId}:${domainId}` });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as {
    isPrimary?: boolean;
    status?: SiteDomain["status"];
  };

  try {
    const result = await updateSiteDomainRelational({
      siteId,
      domainId,
      isPrimary: body.isPrimary,
      status: body.status
    });
    return NextResponse.json({ ok: true, domain: result.domain, site: result.site });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "domain_update_failed" }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; domainId: string }> }
) {
  const { siteId, domainId } = await params;
  const guard = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: `platform:domain:${siteId}:${domainId}` });
  if (!guard.ok) return guard.response;

  try {
    const result = await deleteSiteDomainRelational({ siteId, domainId });
    return NextResponse.json({ ok: true, deletedDomain: result.deletedDomain, site: result.site });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "domain_delete_failed" }, { status });
  }
}
