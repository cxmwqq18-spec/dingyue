import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RelationalStoreError } from "@/lib/stores/prisma-mappers";
import type { AidreamcapesPartnerBadge } from "@/lib/types";

const MAX_PARTNER_BADGES = 12;
const HOME_SLUG = "/";

type BadgeRecord = {
  id: string;
  siteId: string;
  slug: string;
  updatedAt: Date;
  contentJson: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Site-local /assets/… badge artwork must resolve to a known media asset and file; external HTTPS hotlinks are allowed. */
async function assertBadgeImageUrlsResolvable(siteId: string, badges: AidreamcapesPartnerBadge[]): Promise<void> {
  const localUrls = Array.from(
    new Set(
      badges
        .map((badge) => badge.imageUrl.split(/[?#]/, 1)[0] ?? "")
        .filter((url) => url.startsWith("/"))
    )
  );
  if (!localUrls.length) return;
  const assets = await prisma.mediaAsset.findMany({
    where: { siteId },
    select: { storageKey: true, previewUrl: true, originUrl: true }
  });
  const known = new Set(
    assets.flatMap((asset) => [asset.storageKey, asset.previewUrl, asset.originUrl].filter((item): item is string => Boolean(item)).map((item) => item.split(/[?#]/, 1)[0] ?? ""))
  );
  for (const url of localUrls) {
    const relative = url.replace(/^\/+/, "");
    const fileExists = fs.existsSync(path.join(process.cwd(), "public", relative)) || fs.existsSync(path.join(process.cwd(), relative));
    if (!known.has(url) || !fileExists) {
      throw new RelationalStoreError(`footer_partner_badge_image_missing:${url}`, 422);
    }
  }
}

async function readHomeLivePage(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], siteId: string): Promise<BadgeRecord> {
  const home = await tx.livePage.findFirst({
    where: { siteId, slug: HOME_SLUG },
    select: { id: true, siteId: true, slug: true, updatedAt: true, contentJson: true }
  });
  if (!home) throw new RelationalStoreError("aidreamcapes_home_live_page_not_found", 404);
  return home as BadgeRecord;
}

function partnerBadgesFromContent(contentJson: unknown): AidreamcapesPartnerBadge[] {
  const navigation = isRecord(contentJson) ? contentJson.siteNavigation : undefined;
  const footer = isRecord(navigation) ? navigation.footer : undefined;
  const badges = isRecord(footer) ? footer.partnerBadges : undefined;
  if (!Array.isArray(badges)) return [];
  return badges.filter(isRecord).map((badge) => ({
    key: String(badge.key ?? ""),
    label: String(badge.label ?? ""),
    href: String(badge.href ?? ""),
    imageUrl: String(badge.imageUrl ?? ""),
    imageHeight: typeof badge.imageHeight === "number" ? badge.imageHeight : undefined
  }));
}

export async function listFooterPartnerBadgesRelational(siteId: string): Promise<AidreamcapesPartnerBadge[]> {
  const home = await prisma.livePage.findFirst({
    where: { siteId, slug: HOME_SLUG },
    select: { contentJson: true }
  });
  if (!home) return [];
  return partnerBadgesFromContent(home.contentJson);
}

/**
 * Persist the footer friend-link badges on the homepage LivePage. Public SSR
 * reads LivePage.contentJson on every request and the site content revision
 * trigger invalidates the optional runtime cache, so a committed write is live
 * on the next request without any deployment or publish step.
 */
export async function updateFooterPartnerBadgesRelational(params: {
  siteId: string;
  badges: AidreamcapesPartnerBadge[];
}): Promise<{ badges: AidreamcapesPartnerBadge[]; homePageId: string }> {
  await assertBadgeImageUrlsResolvable(params.siteId, params.badges);
  return prisma.$transaction(async (tx) => {
    const home = await readHomeLivePage(tx, params.siteId);
    const contentJson = isRecord(home.contentJson) ? structuredClone(home.contentJson) : {};
    const navigation = isRecord(contentJson.siteNavigation) ? contentJson.siteNavigation : {};
    const footer = isRecord(navigation.footer) ? navigation.footer : {};
    footer.partnerBadges = params.badges;
    navigation.footer = footer;
    contentJson.siteNavigation = navigation;

    const result = await tx.livePage.updateMany({
      where: { id: home.id, siteId: params.siteId, slug: HOME_SLUG, updatedAt: home.updatedAt },
      data: { contentJson: contentJson as unknown as Prisma.InputJsonValue }
    });
    if (result.count !== 1) throw new RelationalStoreError("footer_partner_badges_write_conflict", 409);

    const readback = await tx.livePage.findUnique({
      where: { id: home.id },
      select: { contentJson: true }
    });
    const persisted = readback ? partnerBadgesFromContent(readback.contentJson) : [];
    if (JSON.stringify(persisted) !== JSON.stringify(params.badges)) {
      throw new RelationalStoreError("footer_partner_badges_readback_failed", 500);
    }
    return { badges: persisted, homePageId: home.id };
  });
}

export const FOOTER_PARTNER_BADGES_LIMIT = MAX_PARTNER_BADGES;
