import { NextRequest, NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { checkRateLimitOrResponse, RATE_LIMITS } from "@/lib/security/rate-limit";
import { shouldUseSecureCookie, siteAdminSessionCookie } from "@/lib/session";
import { requireCsrfToken, setCsrfCookie } from "@/lib/security/csrf";
import { createSiteAdminSessionByAdminIdRelational, getSiteAdminBridgeTargetRelational } from "@/lib/stores/site-store";

function normalizeAdminPath(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) return "/admin";
  if (!trimmed.startsWith("/admin")) return "/admin";
  return trimmed;
}

async function buildBridgeResponse(request: NextRequest, siteId: string, requestedPath?: string | null) {
  const current = await getCurrentPlatformAdmin();
  if (!current) {
    return NextResponse.json({ error: "platform_login_required" }, { status: 401 });
  }

  try {
    const { site, admin: targetAdmin } = await getSiteAdminBridgeTargetRelational(siteId);
    const result = await createSiteAdminSessionByAdminIdRelational({
      siteId,
      siteAdminId: targetAdmin.id
    });
    const redirectPath = normalizeAdminPath(requestedPath);
    const redirectTo = `/site/${site.slug}${redirectPath}`;
    const response = NextResponse.json({
      ok: true,
      siteSlug: site.slug,
      siteAdmin: result.siteAdmin,
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

async function requireAdminBridge(request: NextRequest, siteId: string) {
  const current = await getCurrentPlatformAdmin();
  if (!current) return { ok: false as const, response: NextResponse.json({ error: "platform_login_required" }, { status: 401 }) };
  if (!["super_admin", "ops"].includes(current.platformAdmin.role)) {
    return { ok: false as const, response: NextResponse.json({ error: "platform_forbidden" }, { status: 403 }) };
  }
  const csrf = requireCsrfToken(request, "platform", current.sessionId);
  if (csrf) return { ok: false as const, response: csrf };
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.adminBridge, `platform:${current.platformAdmin.id}:admin-bridge:${siteId}`);
  if (!limited.allowed) return { ok: false as const, response: limited.response };
  return { ok: true as const, current };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const guard = await requireAdminBridge(request, siteId);
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
  const guard = await requireAdminBridge(request, siteId);
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { path?: string };
  return buildBridgeResponse(request, siteId, body.path);
}
