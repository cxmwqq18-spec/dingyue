import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const SITE_ID = "site_aidreamcapes";
const HOME_PAGE_ID = "site_aidreamcapes_home";
const CONFIRMATION = "site_aidreamcapes-footer-social-links";
const args = new Set(process.argv.slice(2));
const target = [...args].find((arg) => arg.startsWith("--target="))?.split("=")[1];
const apply = args.has("--apply");

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function collectLinks(settings) {
  const definitions = [
    ["facebook", "Facebook", settings.facebookUrl],
    ["instagram", "Instagram", settings.instagramUrl],
    ["threads", "Threads", settings.threadsUrl],
    ["pinterest", "Pinterest", settings.pinterestUrl],
    ["x", "X", settings.xUrl || settings.twitterUrl],
    ["youtube", "YouTube", settings.youtubeUrl],
    ["tiktok", "TikTok", settings.tiktokUrl]
  ];
  const seen = new Set();
  return definitions.flatMap(([key, label, href]) => {
    if (typeof href !== "string" || !href.trim() || seen.has(href)) return [];
    const url = new URL(href);
    assert.equal(url.protocol, "https:", `Expected a public HTTPS social URL for ${label}`);
    assert.equal(url.username, "", `Unexpected URL credentials for ${label}`);
    assert.equal(url.password, "", `Unexpected URL credentials for ${label}`);
    seen.add(href);
    return [{ key, label, href }];
  });
}

function navigationWithoutSocialLinks(contentJson) {
  const copy = structuredClone(contentJson);
  const navigation = copy?.siteNavigation;
  if (navigation?.footer) delete navigation.footer.socialLinks;
  return copy;
}

assert.equal(target, "production", "This migration is limited to the production Aidreamcapes database.");
assert.equal(process.env.DATABASE_TARGET, "production", "Set DATABASE_TARGET=production explicitly.");
assert.equal(process.env.DINGYUE_ENV, "production", "Set DINGYUE_ENV=production explicitly.");
if (apply) assert(args.has(`--confirm=${CONFIRMATION}`), `Add --confirm=${CONFIRMATION} to apply.`);

const db = new PrismaClient();
try {
  const [legacy, home] = await Promise.all([
    db.themeSettings.findUnique({
      where: { siteId: SITE_ID },
      select: { siteId: true, updatedAt: true, publishedJson: true }
    }),
    db.livePage.findUnique({
      where: { id: HOME_PAGE_ID },
      select: { id: true, siteId: true, slug: true, updatedAt: true, contentJson: true }
    })
  ]);

  assert(legacy && legacy.siteId === SITE_ID, "Aidreamcapes legacy migration row was not found.");
  assert(home && home.siteId === SITE_ID && home.slug === "/", "Aidreamcapes home LivePage was not found.");

  const sourceSettings = legacy.publishedJson?.globalSections?.footer?.settings;
  assert(sourceSettings && typeof sourceSettings === "object", "Legacy footer settings were not found.");
  const links = collectLinks(sourceSettings);
  assert.equal(links.length, 7, "Expected the seven distinct public social links present in current relational data.");

  const priorNavigation = home.contentJson?.siteNavigation;
  assert(priorNavigation?.footer && Array.isArray(priorNavigation.footer.groups), "Current home LivePage navigation footer is malformed.");
  const priorLinks = priorNavigation.footer.socialLinks;
  if (Array.isArray(priorLinks) && priorLinks.length > 0) {
    assert.deepEqual(priorLinks, links, "The current LivePage already has social links; refusing to overwrite online edits.");
  }

  const beforeHash = hash(navigationWithoutSocialLinks(home.contentJson));
  const updatedContent = structuredClone(home.contentJson);
  updatedContent.siteNavigation.footer.socialLinks = links;
  const plan = {
    target: "production",
    siteId: SITE_ID,
    owner: `LivePage:${HOME_PAGE_ID}`,
    publicPath: home.slug,
    targetField: "contentJson.siteNavigation.footer.socialLinks",
    source: "ThemeSettings.publishedJson.globalSections.footer.settings (current relational migration data)",
    sourceUpdatedAt: legacy.updatedAt,
    targetUpdatedAt: home.updatedAt,
    existingTargetCount: Array.isArray(priorLinks) ? priorLinks.length : 0,
    links,
    linkedValuesHash: hash(links),
    nonTargetContentHash: beforeHash,
    mode: apply ? "apply" : "plan-only"
  };
  console.log(JSON.stringify(plan, null, 2));
  if (apply && !(Array.isArray(priorLinks) && priorLinks.length > 0)) {
    const result = await db.livePage.updateMany({
      where: { id: HOME_PAGE_ID, siteId: SITE_ID, slug: "/", updatedAt: home.updatedAt },
      data: { contentJson: updatedContent }
    });
    assert.equal(result.count, 1, "LivePage changed during migration; no update was applied.");

    const readback = await db.livePage.findUnique({
      where: { id: HOME_PAGE_ID },
      select: { id: true, siteId: true, slug: true, updatedAt: true, contentJson: true }
    });
    assert.deepEqual(readback.contentJson?.siteNavigation?.footer?.socialLinks, links, "LivePage social link readback failed.");
    assert.equal(hash(navigationWithoutSocialLinks(readback.contentJson)), beforeHash, "A non-target LivePage field changed.");
    console.log(JSON.stringify({ result: "applied-and-read-back", siteId: readback.siteId, livePageId: readback.id, publicPath: readback.slug, updatedAt: readback.updatedAt, linkCount: links.length, nonTargetContentUnchanged: true }, null, 2));
  }
} finally {
  await db.$disconnect();
}
