import { NextRequest, NextResponse } from "next/server";
import { requirePlatformMutation } from "@/lib/api-auth";
import { getPlatformStateCountsRelational } from "@/lib/stores/platform-store";

function stateErrorResponse(error: unknown, fallback: string) {
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : fallback }, { status: 500 });
}

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      ...(await getPlatformStateCountsRelational())
    });
  } catch (error) {
    return stateErrorResponse(error, "platform_state_read_failed");
  }
}

export async function POST(request: NextRequest) {
  try {
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
    return NextResponse.json({
      ok: true,
      reset: false,
      ...(await getPlatformStateCountsRelational())
    });
  } catch (error) {
    return stateErrorResponse(error, "platform_state_reset_failed");
  }
}
