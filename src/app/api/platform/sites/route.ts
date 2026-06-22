import { NextRequest, NextResponse } from "next/server";
import { getCurrentPlatformAdmin, requirePlatformMutation } from "@/lib/api-auth";
import { createSiteRelational } from "@/lib/stores/site-store";
import { StoreError } from "@/lib/server-store";
import { getPlatformSitesRelational } from "@/lib/stores/platform-store";

async function requirePlatformAdmin() {
  return getCurrentPlatformAdmin();
}

export async function GET() {
  const current = await requirePlatformAdmin();
  if (!current) return NextResponse.json({ error: "platform_login_required" }, { status: 401 });
  return NextResponse.json({
    ok: true,
    sites: await getPlatformSitesRelational()
  });
}

export async function POST(request: NextRequest) {
  const guard = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: "platform:site-create" });
  if (!guard.ok) return guard.response;
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
    const result = await createSiteRelational({
      name: body.name,
      slug: body.slug,
      ownerEmail: body.ownerEmail,
      ownerPassword: body.ownerPassword,
      sourceSiteId: body.sourceSiteId,
      domain: body.domain
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "site_create_failed" }, { status });
  }
}
