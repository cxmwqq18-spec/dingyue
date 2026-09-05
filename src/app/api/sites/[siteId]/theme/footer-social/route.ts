import { NextRequest, NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import {
  updateThemeFooterSocialLinksRelational,
  type ThemeFooterSocialLinks
} from "@/lib/stores/theme-store";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanUrl(value: unknown) {
  const url = cleanText(value, 500);
  return url && /^https:\/\/[^\s]+$/i.test(url) ? url : "";
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:footer-social` });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => null)) as Partial<ThemeFooterSocialLinks> | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_footer_social_payload" }, { status: 400 });
  }

  const socialLinks: ThemeFooterSocialLinks = {
    socialHeading: cleanText(body.socialHeading, 80) || "Follow Us",
    socialBody: cleanText(body.socialBody, 240),
    instagramUrl: cleanUrl(body.instagramUrl),
    facebookUrl: cleanUrl(body.facebookUrl),
    threadsUrl: cleanUrl(body.threadsUrl),
    pinterestUrl: cleanUrl(body.pinterestUrl),
    youtubeUrl: cleanUrl(body.youtubeUrl),
    xUrl: cleanUrl(body.xUrl),
    tiktokUrl: cleanUrl(body.tiktokUrl)
  };

  try {
    const result = await updateThemeFooterSocialLinksRelational({
      siteId,
      actor: guard.current.siteAdmin.id,
      socialLinks
    });
    return NextResponse.json({ ok: true, site: result.site, socialLinks });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "footer_social_update_failed" }, { status });
  }
}
