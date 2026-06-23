import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { prisma } from "@/lib/prisma";
import { createSiteAdminRelational, updateSiteAdminRelational } from "@/lib/stores/site-store";
import type { SiteAdmin } from "@/lib/types";
import type { NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; customerId: string }> }
) {
  const { siteId, customerId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:customer-admin-role` });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { role?: SiteAdmin["role"]; temporaryPassword?: string };
  const requestedRole = body.role === "owner" ? "owner" : body.role === "support" ? "support" : "admin";
  if (requestedRole === "owner" && guard.current.siteAdmin.role !== "owner") {
    return NextResponse.json({ error: "owner_role_requires_owner_actor" }, { status: 403 });
  }
  const role = requestedRole;

  try {
    const customer = await prisma.customer.findFirst({
      where: { siteId, id: customerId },
      select: { id: true, email: true, name: true }
    });
    if (!customer) throw new StoreError("customer_not_found_for_site", 404);

    const existing = await prisma.siteAdmin.findUnique({
      where: { siteId_email: { siteId, email: customer.email.trim().toLowerCase() } }
    });

    if (existing) {
      const result = await updateSiteAdminRelational({
        siteId,
        adminId: existing.id,
        displayName: existing.displayName || customer.name,
        role,
        actor: guard.current.siteAdmin.id
      });
      return NextResponse.json({ ok: true, admin: result.admin, created: false });
    }

    const temporaryPassword = body.temporaryPassword?.trim() || `admin${Date.now().toString(36)}`;
    const result = await createSiteAdminRelational({
      siteId,
      email: customer.email,
      displayName: customer.name || customer.email.split("@")[0],
      password: temporaryPassword,
      role,
      actor: guard.current.siteAdmin.id
    });
    return NextResponse.json({ ok: true, admin: result.admin, created: true, temporaryPassword });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "customer_admin_role_update_failed" }, { status });
  }
}
