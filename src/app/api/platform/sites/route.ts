import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSite, getPlatformAdminBySessionFromState, readPlatformState, StoreError, toPublicSiteAdmin } from "@/lib/server-store";
import { platformSessionCookie } from "@/lib/session";

async function requirePlatformAdmin() {
  const state = readPlatformState();
  const sessionId = (await cookies()).get(platformSessionCookie())?.value;
  return getPlatformAdminBySessionFromState(state, sessionId);
}

export async function GET() {
  const current = await requirePlatformAdmin();
  if (!current) return NextResponse.json({ error: "platform_login_required" }, { status: 401 });
  const state = readPlatformState();
  return NextResponse.json({
    ok: true,
    sites: state.sites.map((site) => ({
      ...site,
      domains: state.siteDomains.filter((domain) => domain.siteId === site.id),
      admins: state.siteAdmins.filter((admin) => admin.siteId === site.id).map(toPublicSiteAdmin),
      gatewayGroups: state.aiGatewayGroups.filter((group) => group.siteId === site.id)
    }))
  });
}

export async function POST(request: Request) {
  const current = await requirePlatformAdmin();
  if (!current) return NextResponse.json({ error: "platform_login_required" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    ownerEmail?: string;
    ownerPassword?: string;
    sourceSiteId?: string;
    domain?: string;
  };
  if (!body.name || !body.ownerEmail) {
    return NextResponse.json({ error: "missing_site_name_or_owner_email" }, { status: 400 });
  }

  try {
    const result = createSite({
      name: body.name,
      slug: body.slug,
      ownerEmail: body.ownerEmail,
      ownerPassword: body.ownerPassword,
      sourceSiteId: body.sourceSiteId,
      domain: body.domain
    });
    return NextResponse.json({ ok: true, ...result, admin: toPublicSiteAdmin(result.admin) });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "site_create_failed" }, { status });
  }
}
