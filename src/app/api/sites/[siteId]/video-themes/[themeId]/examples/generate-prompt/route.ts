import { NextResponse } from "next/server";
import { getCurrentSiteAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { generateVideoThemePromptCandidate } from "@/lib/video-theme-prompt-provider";
import { createAsyncJob, toAsyncJobAcceptedPayload } from "@/lib/async-jobs";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string; themeId: string }> }) {
  const { siteId, themeId } = await params;
  const currentAdmin = await getCurrentSiteAdmin(siteId);
  if (!currentAdmin) return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  const theme = await prisma.videoTheme.findFirst({ where: { id: themeId, siteId }, select: { id: true } });
  if (!theme) return NextResponse.json({ error: "video_theme_not_found" }, { status: 404 });
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey) return NextResponse.json({ error: "idempotency_key_required" }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const input = {
      themeName: typeof body.themeName === "string" ? body.themeName : "Video theme",
      themeDescription: typeof body.themeDescription === "string" ? body.themeDescription : undefined,
      exampleName: typeof body.exampleName === "string" ? body.exampleName : undefined,
      referencePrompt: typeof body.referencePrompt === "string" ? body.referencePrompt : undefined
    };
    const job = await createAsyncJob({
      kind: "video_theme_prompt_generation",
      actorId: currentAdmin.siteAdmin.id,
      idempotencyKey: `${siteId}:${themeId}:${idempotencyKey}`,
      metadata: { siteId, themeId, input },
      ttlMs: 15 * 60 * 1000,
      run: async () => generateVideoThemePromptCandidate({ idempotencyKey: `${siteId}:${themeId}:${idempotencyKey}`, input })
    });
    return NextResponse.json(toAsyncJobAcceptedPayload(job), { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "video_theme_prompt_generation_failed" }, { status: 502 });
  }
}
