import { NextRequest, NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/api-auth";
import { listAsyncJobs } from "@/lib/async-jobs";

function asyncJobsErrorResponse(error: unknown, fallback: string) {
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : fallback }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const current = await getCurrentPlatformAdmin();
    if (!current) return NextResponse.json({ error: "platform_login_required" }, { status: 401 });

    const searchParams = new URL(request.url).searchParams;
    const kind = searchParams.get("kind")?.trim() || undefined;
    const limit = Number(searchParams.get("limit") ?? "50") || 50;
    const actorId = current.platformAdmin.role === "super_admin"
      ? searchParams.get("actorId")?.trim() || undefined
      : current.platformAdmin.id;

    return NextResponse.json({
      ok: true,
      jobs: await listAsyncJobs({ actorId, kind, limit })
    });
  } catch (error) {
    return asyncJobsErrorResponse(error, "async_jobs_list_failed");
  }
}
