#!/usr/bin/env node
import assert from "node:assert/strict";
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
  youtubeUrl: "https://www.youtube.com/@myDreamshoots",
  xUrl: "https://x.com/myDreamshoots"
};

if (apply && !confirm) throw new Error("Refusing to write without --confirm-footer-social-links");
const prisma = new PrismaClient();

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
  console.log(JSON.stringify({ siteId, links, mode: apply ? "draft-only" : "dry-run", publicationRequired: true }, null, 2));
  if (!apply) {
    await prisma.$disconnect();
    process.exit(0);
  }
  await prisma.themeSettings.update({ where: { siteId }, data: { draftJson } });
  console.log(`Updated ${siteId} footer social links in draft; formal publication approval is required.`);
} finally {
  await prisma.$disconnect();
}
