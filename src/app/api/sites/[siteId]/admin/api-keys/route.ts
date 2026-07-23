import { NextRequest, NextResponse } from "next/server";
import { getCurrentSiteAdmin, requireSiteMutation } from "@/lib/api-auth";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { StoreError } from "@/lib/server-store";
import { createSiteApiKey, listSiteApiKeys, setSiteApiKeyEnabled } from "@/lib/site-api-keys";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const current = await getCurrentSiteAdmin(siteId);
  if (!current) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  const result = await listSiteApiKeys({ siteId });
  return NextResponse.json({ ok: true, apiKeys: result.apiKeys });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, {
    roles: ["owner", "admin"],
    rateLimit: RATE_LIMITS.adminMutation,
    key: `${siteId}:api-keys`
  });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as { label?: string; scopes?: unknown };
  try {
    const result = await createSiteApiKey({
      siteId,
      label: body.label ?? "External API",
      scopes: body.scopes
    });
    return NextResponse.json({
      ok: true,
      apiKey: result.apiKey,
      token: result.token,
      note: "Store this token now. It will not be shown again."
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "site_api_key_create_failed" }, { status });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, {
    roles: ["owner", "admin"],
    rateLimit: RATE_LIMITS.adminMutation,
    key: `${siteId}:api-keys`
  });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as { apiKeyId?: string; enabled?: boolean };
  if (!body.apiKeyId) return NextResponse.json({ error: "site_api_key_required" }, { status: 400 });
  try {
    const result = await setSiteApiKeyEnabled({
      siteId,
      apiKeyId: body.apiKeyId,
      enabled: body.enabled !== false
    });
    return NextResponse.json({ ok: true, apiKey: result.apiKey });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "site_api_key_update_failed" }, { status });
  }
}
