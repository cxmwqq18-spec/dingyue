#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const siteId = process.env.SOCIAL_SITE_ID?.trim() || "site_dreamshoot";
const apply = process.argv.includes("--apply");
const confirm = process.argv.includes("--confirm-footer-social-links");
const links = {
  instagramUrl: "https://www.instagram.com/mydreamshoots/",
  facebookUrl: "https://www.facebook.com/mydreamshoots/",
  threadsUrl: "https://www.threads.com/@mydreamshoots",
  pinterestUrl: "https://www.pinterest.com/myDreamshoots/",
  youtubeUrl: "https://www.youtube.com/@myDreamshoots"
};

if (apply && !confirm) throw new Error("Refusing to write without --confirm-footer-social-links");
const prisma = new PrismaClient();

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
}

function snapshotHash(snapshot) {
  const unhashed = { ...snapshot, snapshotHash: undefined, revisions: { ...(snapshot.revisions ?? {}), snapshotHash: undefined } };
  return crypto.createHash("sha256").update(JSON.stringify(stable(unhashed))).digest("hex");
}

function withLinks(settings) {
  const next = structuredClone(settings ?? {});
  next.globalSections ??= {};
  next.globalSections.footer ??= { type: "footer", settings: {}, blocks: [] };
  next.globalSections.footer.settings = { ...(next.globalSections.footer.settings ?? {}), ...links };
  return next;
}

try {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { settings: true, activePublication: { include: { publication: true } } }
  });
  assert(site?.settings, `site settings not found: ${siteId}`);
  const draftJson = withLinks(site.settings.draftJson);
  const publishedJson = withLinks(site.settings.publishedJson);
  const active = site.activePublication?.publication;
  const oldSnapshot = active?.snapshot && typeof active.snapshot === "object" ? active.snapshot : null;
  const nextSnapshot = oldSnapshot ? { ...structuredClone(oldSnapshot), themeSettings: publishedJson } : null;
  if (nextSnapshot) {
    const hash = snapshotHash(nextSnapshot);
    nextSnapshot.snapshotHash = hash;
    nextSnapshot.revisions = { ...(nextSnapshot.revisions ?? {}), snapshotHash: hash };
  }
  console.log(JSON.stringify({ siteId, links, hasActivePublication: Boolean(active), mode: apply ? "apply" : "dry-run" }, null, 2));
  if (!apply) {
    await prisma.$disconnect();
    process.exit(0);
  }
  await prisma.$transaction(async (tx) => {
    await tx.themeSettings.update({ where: { siteId }, data: { draftJson, publishedJson } });
    if (!active || !nextSnapshot) throw new Error("active publication snapshot is required");
    const version = active.version + 1;
    const publication = await tx.themePublication.create({
      data: {
        id: `pub_${siteId}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
        siteId,
        version,
        snapshot: nextSnapshot,
        pageCount: active.pageCount,
        sectionCount: active.sectionCount,
        snapshotBytes: Buffer.byteLength(JSON.stringify(nextSnapshot)),
        scope: { type: "site", pageIds: [], includeThemeSettings: true, includeStorefrontProfile: false },
        manifestHash: nextSnapshot.snapshotHash,
        factsRevision: nextSnapshot.revisions?.factsRevision ?? null,
        publishedBy: "footer-social-links-sync"
      }
    });
    await tx.activeThemePublication.update({ where: { siteId }, data: { publicationId: publication.id, activatedBy: "footer-social-links-sync" } });
  });
  console.log(`Updated ${siteId} footer social links and activated publication.`);
} finally {
  await prisma.$disconnect();
}
