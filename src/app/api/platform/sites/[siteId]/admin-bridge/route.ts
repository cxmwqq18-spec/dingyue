import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createSiteAdminSessionByAdminId,
  getPlatformAdminBySessionFromState,
  readPlatformState,
  StoreError,
  toPublicSiteAdmin
} from "@/lib/server-store";
import { platformSessionCookie, siteAdminSessionCookie } from "@/lib/session";

function normalizeAdminPath(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) return "/admin";
  if (!trimmed.startsWith("/admin")) return "/admin";
  return trimmed;
}

async function buildBridgeResponse(siteId: string, requestedPath?: string | null) {
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
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    return response;
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "site_admin_bridge_failed" }, { status });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const path = new URL(request.url).searchParams.get("path");
  const response = await buildBridgeResponse(siteId, path);
  if (!response.ok) return response;
  const body = (await response.json()) as { redirectTo: string };
  const redirect = NextResponse.redirect(new URL(body.redirectTo, request.url));
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const body = (await request.json().catch(() => ({}))) as { path?: string };
  return buildBridgeResponse(siteId, body.path);
}
