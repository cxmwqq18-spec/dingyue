import { NextRequest, NextResponse } from "next/server";
import { requirePlatformMutation } from "@/lib/api-auth";
import { readPlatformState } from "@/lib/server-store";

export async function GET() {
  const state = readPlatformState();
  return NextResponse.json({
    ok: true,
    sites: state.sites.length,
    customers: state.customers.length,
    products: state.products.length,
    jobs: state.jobs.length,
    customerModels: state.customerModels.length,
    albums: state.albums.length
  });
}

export async function POST(request: NextRequest) {
  const legacyResetEnabled = process.env.PLATFORM_STATE_LEGACY_RESET_ENABLED === "1";
  if (!legacyResetEnabled) {
    return NextResponse.json(
      {
        error: "platform_state_write_disabled",
        note: "Platform state writes are legacy-only. Use db:import-relational-state -- --replace for resets."
      },
      { status: 410 }
    );
  }
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (isProduction) {
    const secret = process.env.PLATFORM_STATE_RESET_SECRET;
    if (!secret || secret.length < 32 || request.headers.get("x-platform-state-reset-secret") !== secret) {
      return NextResponse.json({ error: "state_reset_secret_required" }, { status: 403 });
    }
    const guard = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: "platform:state-reset" });
    if (!guard.ok) return guard.response;
  } else if (request.headers.get("x-smoke-reset") !== "true") {
    return NextResponse.json({ error: "smoke_reset_header_required" }, { status: 403 });
  }
  const state = readPlatformState();
  return NextResponse.json({
    ok: true,
    reset: false,
    sites: state.sites.length,
    customers: state.customers.length,
    products: state.products.length,
    jobs: state.jobs.length,
    customerModels: state.customerModels.length,
    albums: state.albums.length
  });
}
