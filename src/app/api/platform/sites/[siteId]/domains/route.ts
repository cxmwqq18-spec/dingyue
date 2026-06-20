import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { addSiteDomain, getPlatformAdminBySessionFromState, readPlatformState, StoreError } from "@/lib/server-store";
import { platformSessionCookie } from "@/lib/session";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const state = readPlatformState();
  const sessionId = (await cookies()).get(platformSessionCookie())?.value;
  if (!getPlatformAdminBySessionFromState(state, sessionId)) {
    return NextResponse.json({ error: "platform_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { domain?: string; isPrimary?: boolean };
  if (!body.domain) {
    return NextResponse.json({ error: "missing_domain" }, { status: 400 });
  }
  try {
    const result = addSiteDomain({ siteId, domain: body.domain, isPrimary: body.isPrimary });
    return NextResponse.json({ ok: true, domain: result.domain, site: result.site });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "domain_create_failed" }, { status });
  }
}
