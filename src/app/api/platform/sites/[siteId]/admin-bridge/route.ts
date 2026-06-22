import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformMutation } from "@/lib/api-auth";
import {
  createSiteAdminSessionByAdminId,
  getPlatformAdminBySessionFromState,
  readPlatformState,
  StoreError,
  toPublicSiteAdmin
} from "@/lib/server-store";
import { platformSessionCookie, shouldUseSecureCookie, siteAdminSessionCookie } from "@/lib/session";
import { setCsrfCookie } from "@/lib/security/csrf";

function normalizeAdminPath(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) return "/admin";
  if (!trimmed.startsWith("/admin")) return "/admin";
  return trimmed;
}

async function buildBridgeResponse(request: NextRequest, siteId: string, requestedPath?: string | null) {
  const state = readPlatformState();
  const platformSessionId = (await cookies()).get(platformSessionCookie())?.value;
  const current = getPlatformAdminBySessionFromState(state, platformSessionId);
  if (!current) {
    return NextResponse.json({ error: "platform_login_required" }, { status: 401 });
  }

  const site = state.sites.find((item) => item.id === siteId);
  if (!site) {
    return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }

  const targetAdmin =
    state.siteAdmins.find((admin) => admin.siteId === siteId && admin.role === "owner") ??
    state.siteAdmins.find((admin) => admin.siteId === siteId);

  if (!targetAdmin) {
    return NextResponse.json({ error: "site_admin_not_found" }, { status: 404 });
  }

  try {
    const result = createSiteAdminSessionByAdminId({
      siteId,
      siteAdminId: targetAdmin.id
    });
    const redirectPath = normalizeAdminPath(requestedPath);
    const redirectTo = `/site/${site.slug}${redirectPath}`;
    const response = NextResponse.json({
      ok: true,
      siteSlug: site.slug,
      siteAdmin: toPublicSiteAdmin(targetAdmin),
      redirectTo
    });
    response.cookies.set(siteAdminSessionCookie(siteId), result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(request),
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    setCsrfCookie(response, `site-admin:${siteId}`, result.session.id, result.session.expiresAt, request);
    return response;
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "site_admin_bridge_failed" }, { status });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const guard = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: `platform:admin-bridge:${siteId}` });
  if (!guard.ok) return guard.response;

  const path = new URL(request.url).searchParams.get("path");
  const response = await buildBridgeResponse(request, siteId, path);
  if (!response.ok) return response;
  const body = (await response.json()) as { redirectTo: string };
  const redirect = NextResponse.redirect(new URL(body.redirectTo, request.url));
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const guard = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: `platform:admin-bridge:${siteId}` });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { path?: string };
  return buildBridgeResponse(request, siteId, body.path);
}
