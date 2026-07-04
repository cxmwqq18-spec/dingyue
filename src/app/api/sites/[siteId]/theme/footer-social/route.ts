import { NextRequest, NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import {
  updateThemeFooterSocialLinksRelational,
  type ThemeFooterSocialLinks
} from "@/lib/stores/theme-store";

const socialUrlKeys = ["instagramUrl", "facebookUrl", "pinterestUrl", "youtubeUrl", "twitterUrl"] as const;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanSocialUrl(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
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
    instagramUrl: "",
    facebookUrl: "",
    pinterestUrl: "",
    youtubeUrl: "",
    twitterUrl: ""
  };

  for (const key of socialUrlKeys) {
    const url = cleanSocialUrl(body[key]);
    if (url === null) {
      return NextResponse.json({ error: `invalid_${key}` }, { status: 400 });
    }
    socialLinks[key] = url;
  }

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
