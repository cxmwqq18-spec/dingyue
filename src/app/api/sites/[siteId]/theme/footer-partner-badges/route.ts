import { NextRequest, NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import {
  FOOTER_PARTNER_BADGES_LIMIT,
  listFooterPartnerBadgesRelational,
  updateFooterPartnerBadgesRelational
} from "@/lib/stores/footer-partner-badges-store";
import type { AidreamcapesPartnerBadge } from "@/lib/types";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanBadgeUrl(value: unknown) {
  const url = cleanText(value, 500);
  return url && /^(?:https:\/\/[^\s]+|\/assets\/[^\s]+)$/i.test(url) ? url : "";
}

function cleanBadgeKey(value: unknown, index: number) {
  const key = cleanText(value, 40).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return key || `badge-${index + 1}`;
}

function parseBadges(value: unknown): { badges?: AidreamcapesPartnerBadge[]; error?: string } {
  if (!Array.isArray(value)) return { error: "invalid_partner_badges_payload" };
  if (value.length > FOOTER_PARTNER_BADGES_LIMIT) {
    return { error: `too_many_partner_badges:max_${FOOTER_PARTNER_BADGES_LIMIT}` };
  }
  const seenKeys = new Set<string>();
  const badges: AidreamcapesPartnerBadge[] = [];
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object") return { error: "invalid_partner_badge_entry" };
    const record = item as Record<string, unknown>;
    const label = cleanText(record.label, 60);
    const href = cleanBadgeUrl(record.href);
    const imageUrl = cleanBadgeUrl(record.imageUrl);
    if (!label) return { error: `partner_badge_label_required:index_${index}` };
    if (!href) return { error: `partner_badge_href_required:index_${index}` };
    if (!imageUrl) return { error: `partner_badge_image_url_required:index_${index}` };
    const key = cleanBadgeKey(record.key, index);
    if (seenKeys.has(key)) return { error: `partner_badge_key_duplicated:${key}` };
    seenKeys.add(key);
    const rawHeight = typeof record.imageHeight === "number" ? Math.round(record.imageHeight) : 40;
    badges.push({
      key,
      label,
      href,
      imageUrl,
      imageHeight: Math.min(120, Math.max(24, Number.isFinite(rawHeight) ? rawHeight : 40))
    });
  }
  return { badges };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:footer-partner-badges` });
  if (!guard.ok) return guard.response;
  const badges = await listFooterPartnerBadgesRelational(siteId);
  return NextResponse.json({ ok: true, badges });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:footer-partner-badges` });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => null)) as { badges?: unknown } | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_partner_badges_payload" }, { status: 400 });
  }
  const parsed = parseBadges(body.badges);
  if (!parsed.badges) {
    return NextResponse.json({ error: parsed.error ?? "invalid_partner_badges_payload" }, { status: 400 });
  }

  try {
    const result = await updateFooterPartnerBadgesRelational({ siteId, badges: parsed.badges });
    return NextResponse.json({ ok: true, badges: result.badges, homePageId: result.homePageId });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "footer_partner_badges_update_failed" }, { status });
  }
}
