import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { deleteSiteAdminRelational, updateSiteAdminRelational } from "@/lib/stores/site-store";
import type { SiteAdmin } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string; adminId: string }> }
) {
  const { siteId, adminId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        displayName?: string;
        role?: SiteAdmin["role"];
        password?: string;
        actor?: string;
      }
    | null;

  if (!body || (!("displayName" in body) && !("role" in body) && !("password" in body))) {
    return NextResponse.json({ error: "site_admin_update_empty" }, { status: 400 });
  }

  try {
    const result = await updateSiteAdminRelational({
      siteId,
      adminId,
      displayName: body.displayName,
      role: body.role,
      password: body.password,
      actor: body.actor
    });
    return NextResponse.json({ ok: true, admin: result.admin });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "site_admin_update_failed" }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ siteId: string; adminId: string }> }
) {
  const { siteId, adminId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { actor?: string };

  try {
    const result = await deleteSiteAdminRelational({
      siteId,
      adminId,
      actor: body.actor
    });
    return NextResponse.json({ ok: true, deletedAdmin: result.deletedAdmin });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "site_admin_delete_failed" }, { status });
  }
}
