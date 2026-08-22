import { NextResponse } from "next/server";
import { getCurrentSiteAdmin } from "@/lib/api-auth";
import { getAsyncJob } from "@/lib/async-jobs";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string; jobId: string }> }) {
  const { siteId, jobId } = await params;
  const admin = await getCurrentSiteAdmin(siteId);
  if (!admin) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  const job = await getAsyncJob(jobId);
  if (!job || job.kind !== "video_theme_prompt_generation") return NextResponse.json({ error: "async_job_not_found" }, { status: 404 });
  const metadata = job.metadata as { siteId?: string };
  if (metadata.siteId !== siteId || (job.actorId && job.actorId !== admin.siteAdmin.id)) return NextResponse.json({ error: "site_admin_forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true, job });
}
