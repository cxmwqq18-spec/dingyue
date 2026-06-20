import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSiteDomain, getPlatformAdminBySessionFromState, readPlatformState, StoreError, updateSiteDomain } from "@/lib/server-store";
import type { SiteDomain } from "@/lib/types";
import { platformSessionCookie } from "@/lib/session";

async function requirePlatformAdmin() {
  const state = readPlatformState();
  const sessionId = (await cookies()).get(platformSessionCookie())?.value;
  return getPlatformAdminBySessionFromState(state, sessionId);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string; domainId: string }> }
) {
  const current = await requirePlatformAdmin();
  if (!current) return NextResponse.json({ error: "platform_login_required" }, { status: 401 });
  const { siteId, domainId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    isPrimary?: boolean;
    status?: SiteDomain["status"];
  };

  try {
    const result = updateSiteDomain({
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
  _request: Request,
  { params }: { params: Promise<{ siteId: string; domainId: string }> }
) {
  const current = await requirePlatformAdmin();
  if (!current) return NextResponse.json({ error: "platform_login_required" }, { status: 401 });
  const { siteId, domainId } = await params;

  try {
    const result = deleteSiteDomain({ siteId, domainId });
    return NextResponse.json({ ok: true, deletedDomain: result.deletedDomain, site: result.site });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "domain_delete_failed" }, { status });
  }
}
