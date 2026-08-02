import { NextResponse } from "next/server";
import path from "path";
import { hasSiteAdminSession, requireSiteMutation } from "@/lib/api-auth";
import { DEFAULT_MEDIA_WATERMARK_OPACITY, MEDIA_WATERMARK_VERSION } from "@/lib/media-watermark";
import {
  batchWatermarkSitePublicMedia,
  publicMediaWatermarkPlanForSite
} from "@/lib/storefront-public-media-watermark";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function boundedLimit(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.min(10_000, Math.floor(parsed));
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const plan = publicMediaWatermarkPlanForSite(siteId);
  if (!plan) {
    return NextResponse.json({ error: "public_media_watermark_site_not_configured" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    siteId,
    text: plan.text,
    version: MEDIA_WATERMARK_VERSION,
    opacity: DEFAULT_MEDIA_WATERMARK_OPACITY,
    roots: plan.roots.map((root) => path.relative(process.cwd(), root).split(path.sep).join("/"))
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, {
    roles: ["owner", "admin"],
    key: `${siteId}:public-media-watermark`
  });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as {
    dryRun?: unknown;
    force?: unknown;
    limit?: unknown;
  };

  try {
    const summary = await batchWatermarkSitePublicMedia({
      siteId,
      dryRun: body.dryRun === true,
      force: body.force === true,
      limit: boundedLimit(body.limit)
    });
    return NextResponse.json(summary, { status: summary.ok ? 200 : 207 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "public_media_watermark_failed";
    const status = message === "public_media_watermark_site_not_configured" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
