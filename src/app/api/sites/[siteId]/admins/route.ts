import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { createSiteAdmin, StoreError, toPublicSiteAdmin } from "@/lib/server-store";
import type { SiteAdmin } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        email?: string;
        password?: string;
        displayName?: string;
        role?: SiteAdmin["role"];
        actor?: string;
      }
    | null;

  if (!body?.email || !body?.password || !body?.displayName || !body?.role) {
    return NextResponse.json({ error: "invalid_site_admin_payload" }, { status: 400 });
  }

  try {
    const result = createSiteAdmin({
      siteId,
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      role: body.role,
      actor: body.actor
    });
    return NextResponse.json({ ok: true, admin: toPublicSiteAdmin(result.admin) });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "site_admin_create_failed" }, { status });
  }
}
