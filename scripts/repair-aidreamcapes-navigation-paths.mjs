#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import {
  argumentValue,
  assertDatabaseTarget,
  assertNonProductionWriteTarget,
  buildTunneledDatabaseUrl,
  hasArgument
} from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const CONFIRMATION = "site_aidreamcapes-navigation-paths";
const target = argumentValue("--target") ?? "local";
const apply = hasArgument("--apply");

const PATH_RENAMES = [
  { id: "aidreamcapes_mirror_page_738da1c3aeee6bfa", from: "/ai-video-generation/ugc-ad-video", to: "/ai-video-generation/video-ads" },
  // 2026-10-22: the public tool names dropped the plural "s". These entries now
  // point at the singular canonical so rerunning this historical repair cannot
  // silently revert the newer route names.
  { id: "aidreamcapes_mirror_page_bf80d4528b76f1ef", from: "/ai-video-generation/product-videos", to: "/ai-video-generation/product-video" },
  { id: "aidreamcapes_ads_testing_before_after_showcases", from: "/ai-video-generation/before-after-showcases", to: "/ai-video-generation/before-after-video" },
  { id: "aidreamcapes_ads_testing_ai_actor_product_ads", from: "/ai-video-generation/ai-actor-product-ads", to: "/ai-video-generation/spokesperson-video" },
  { id: "site_aidreamcapes_text_to_video", from: "/text-to-video", to: "/ai-video-generation/text-to-video" },
  { id: "site_aidreamcapes_ai_twin", from: "/ai-twin", to: "/ai-video-generation/ai-twin" },
  { id: "aidreamcapes_image_theme_ecommerce_main_image", from: "/ai-image-generation/ecommerce-main-image", to: "/ai-image-generation/white-background-photos" },
  { id: "aidreamcapes_image_theme_lifestyle_scene", from: "/ai-image-generation/lifestyle-scene", to: "/ai-image-generation/lifestyle-photos" },
  { id: "aidreamcapes_image_theme_on_model_generation", from: "/ai-image-generation/on-model-generation", to: "/ai-image-generation/model-photos" },
  { id: "aidreamcapes_image_theme_background_remove_replace", from: "/ai-image-generation/background-remove-replace", to: "/ai-image-generation/change-background" },
  { id: "aidreamcapes_image_theme_feed_ad_still", from: "/ai-image-generation/feed-ad-still", to: "/ai-image-generation/social-ad-photos" }
];
const PATH_MAP = new Map(PATH_RENAMES.map(({ from, to }) => [from, to]));
const PAGE_IDS = new Set(PATH_RENAMES.map(({ id }) => id));

assert(["local", "production"].includes(target), `Unsupported database target: ${target}`);
if (target === "production") {
  if (process.env.DATABASE_TARGET !== "production" || process.env.DINGYUE_ENV !== "production") {
    assert(process.env.REMOTE_DB_DATABASE_URL, "Production update requires REMOTE_DB_DATABASE_URL.");
    process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 });
    process.env.DATABASE_TARGET = "production";
    process.env.DINGYUE_ENV = "production";
  }
  const confirmed = argumentValue("--confirm") === CONFIRMATION;
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: apply, productionConfirmed: confirmed });
  if (apply) assert(confirmed, `Use --confirm=${CONFIRMATION}.`);
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) assertNonProductionWriteTarget();
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function mapPublicPathValue(value) {
  if (typeof value !== "string") return value;
  if (PATH_MAP.has(value)) return PATH_MAP.get(value);
  for (const [from, to] of PATH_MAP) {
    if (value.startsWith(`${from}?`) || value.startsWith(`${from}#`)) return `${to}${value.slice(from.length)}`;
    const originPath = value.match(/^(https?:\/\/[^/]+)(\/.*)$/);
    if (originPath && originPath[2] === from) return `${originPath[1]}${to}`;
    if (originPath && (originPath[1] === "https://www.aivideosugc.com" || originPath[1] === "https://aivideosugc.com" || originPath[1] === "https://aidreamcapes.com" || originPath[1] === "https://www.aidreamcapes.com") && (originPath[2].startsWith(`${from}?`) || originPath[2].startsWith(`${from}#`))) {
      return `${originPath[1]}${to}${originPath[2].slice(from.length)}`;
    }
  }
  return value;
}

function mapPublicPaths(value) {
  if (Array.isArray(value)) return value.map(mapPublicPaths);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapPublicPaths(item)]));
  return mapPublicPathValue(value);
}

function updateNavigation(contentJson) {
  const next = structuredClone(contentJson);
  const navigation = next.siteNavigation;
  assert(navigation?.version === 2, "Aidreamcapes homepage is missing current v2 navigation data.");
  for (const menu of navigation.menus ?? []) {
    if (menu.label === "Photo") menu.label = "Image";
    if (menu.label === "Image") {
      if (menu.hubLink?.label === "All photo tools →") menu.hubLink.label = "All image tools →";
      if (menu.footerLink?.label === "Browse all photo templates →") menu.footerLink.label = "Browse all image templates →";
    }
    for (const group of menu.groups ?? []) {
      for (const item of group.items ?? []) {
        if (item.label === "Examples" && item.href === "/inspiration") {
          item.label = "Templates";
          item.href = "/templates";
        }
      }
    }
  }
  for (const group of navigation.footer?.groups ?? []) {
    if (group.label === "Photo") group.label = "Image";
    for (const item of group.items ?? []) if (item.label === "All Photo Tools") item.label = "All Image Tools";
  }
  return next;
}

const db = new PrismaClient();
try {
  const [derivedRelation] = await db.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS relation`;
  const readDerivedState = async () => derivedRelation?.relation
    ? await db.sitePublishedState.findUnique({ where: { siteId: SITE_ID }, select: { revision: true, contentHash: true, publishedAt: true } })
    : null;
  const derivedStateBefore = await readDerivedState();
  const pages = await db.livePage.findMany({
    where: { siteId: SITE_ID },
    select: { id: true, siteId: true, slug: true, title: true, updatedAt: true, contentJson: true }
  });
  assert(pages.length > 0, `No current LivePage rows found for ${SITE_ID}.`);
  assert(pages.every((page) => page.siteId === SITE_ID), "Cross-site row encountered; refusing to continue.");
  const byId = new Map(pages.map((page) => [page.id, page]));
  const missing = [...PAGE_IDS].filter((id) => !byId.has(id));
  assert.equal(missing.length, 0, `Expected Aidreamcapes LivePage rows are missing: ${missing.join(", ")}`);

  const occupied = new Map(pages.map((page) => [page.slug, page.id]));
  for (const rename of PATH_RENAMES) {
    const page = byId.get(rename.id);
    assert(page.slug === rename.from || page.slug === rename.to, `Unexpected current route for ${rename.id}: ${page.slug}`);
    const collisionId = occupied.get(rename.to);
    assert(!collisionId || collisionId === rename.id, `New public route is already owned by another LivePage: ${rename.to}`);
    const canonical = page.contentJson?.seo?.canonicalPath ?? page.contentJson?.seo?.canonical;
    assert(canonical === rename.from || canonical === rename.to, `Unexpected canonical URL for ${rename.id}: ${canonical}`);
  }

  const home = pages.find((page) => page.slug === "/" && page.id === "site_aidreamcapes_home");
  assert(home, "Current Aidreamcapes homepage is missing.");
  const beforeHomeNavigation = home.contentJson.siteNavigation;
  const nextHome = updateNavigation(mapPublicPaths(home.contentJson));
  const afterHomeNavigation = nextHome.siteNavigation;
  const imageMenu = afterHomeNavigation.menus.find((menu) => menu.label === "Image");
  const resources = afterHomeNavigation.menus.find((menu) => menu.label === "Resources");
  assert(imageMenu, "Image navigation menu was not produced.");
  assert(resources?.groups?.some((group) => group.items?.some((item) => item.label === "Templates" && item.href === "/templates")), "Resources menu is missing the Templates link.");

  const transformed = pages.map((page) => {
    let contentJson = mapPublicPaths(page.contentJson);
    if (page.id === home.id) contentJson = updateNavigation(contentJson);
    const rename = PATH_RENAMES.find((item) => item.id === page.id);
    if (rename) {
      contentJson.seo ??= {};
      if (contentJson.seo.canonicalPath === rename.from) contentJson.seo.canonicalPath = rename.to;
      if (contentJson.seo.canonical === rename.from) contentJson.seo.canonical = rename.to;
      contentJson = mapPublicPaths(contentJson);
    }
    if (page.id === "site_aidreamcapes_text_to_video" || page.id === "site_aidreamcapes_ai_twin") {
      contentJson.seo ??= {};
      const graph = contentJson.seo.jsonLd?.["@graph"];
      if (!Array.isArray(graph)) {
        const canonicalPath = rename?.to ?? page.slug;
        const canonicalUrl = `https://www.aivideosugc.com${canonicalPath}`;
        contentJson.seo.jsonLd = {
          ...(contentJson.seo.jsonLd && typeof contentJson.seo.jsonLd === "object" ? contentJson.seo.jsonLd : {}),
          "@graph": [{
            "@type": "WebPage",
            "@id": `${canonicalUrl}#webpage`,
            url: canonicalUrl,
            name: contentJson.seo.title,
            description: contentJson.seo.description
          }]
        };
      }
    }
    const slug = rename?.from === page.slug ? rename.to : page.slug;
    return { page, slug, contentJson };
  });
  const changes = transformed.filter(({ page, slug, contentJson }) => slug !== page.slug || hash(contentJson) !== hash(page.contentJson));
  const expectedOldPaths = PATH_RENAMES.filter(({ id }) => byId.get(id).slug !== PATH_RENAMES.find((item) => item.id === id)?.to).length;
  const report = {
    target,
    siteId: SITE_ID,
    owner: "Current relational LivePage.slug and LivePage.contentJson",
    pageCount: pages.length,
    routeCount: PATH_RENAMES.length,
    routesAlreadyCurrent: PATH_RENAMES.length - expectedOldPaths,
    changedRows: changes.length,
    derivedState: {
      relation: derivedRelation?.relation ?? null,
      revisionBefore: derivedStateBefore?.revision ?? null,
      contentHashBefore: derivedStateBefore?.contentHash ?? null,
      usedAsPublicSource: false
    },
    menuChanges: ["Photo → Image", "Examples → Templates (/templates)"],
    routeRenames: PATH_RENAMES.map(({ from, to }) => ({ from, to })),
    mode: apply ? "apply" : "plan-only"
  };
  console.log(JSON.stringify(report, null, 2));

  if (apply && changes.length) {
    await db.$transaction(async (tx) => {
      for (const { page, slug, contentJson } of changes) {
        const updated = await tx.livePage.updateMany({
          where: { id: page.id, siteId: SITE_ID, slug: page.slug, updatedAt: page.updatedAt },
          data: { slug, contentJson }
        });
        assert.equal(updated.count, 1, `LivePage ${page.id} changed concurrently; no unsafe overwrite was applied.`);
      }
    });
  }

  if (apply) {
    const readback = await db.livePage.findMany({ where: { siteId: SITE_ID }, select: { id: true, siteId: true, slug: true, title: true, updatedAt: true, contentJson: true } });
    const readById = new Map(readback.map((page) => [page.id, page]));
    for (const rename of PATH_RENAMES) {
      const page = readById.get(rename.id);
      assert.equal(page?.slug, rename.to, `Route readback failed for ${rename.id}.`);
      assert.equal(page?.contentJson?.seo?.canonicalPath ?? page?.contentJson?.seo?.canonical, rename.to, `Canonical readback failed for ${rename.id}.`);
    }
    for (const id of ["site_aidreamcapes_text_to_video", "site_aidreamcapes_ai_twin"]) {
      const page = readById.get(id);
      const canonicalUrl = `https://www.aivideosugc.com${page.slug}`;
      const webPage = page.contentJson?.seo?.jsonLd?.["@graph"]?.find((node) => node["@type"] === "WebPage");
      assert.equal(webPage?.url, canonicalUrl, `WebPage schema URL readback failed for ${page.slug}.`);
      assert.equal(webPage?.name, page.contentJson.seo.title, `WebPage schema title readback failed for ${page.slug}.`);
      assert.equal(webPage?.description, page.contentJson.seo.description, `WebPage schema description readback failed for ${page.slug}.`);
    }
    const nav = readById.get(home.id)?.contentJson?.siteNavigation;
    assert(nav?.menus?.some((menu) => menu.label === "Image"));
    assert(nav?.menus?.find((menu) => menu.label === "Resources")?.groups?.some((group) => group.items?.some((item) => item.label === "Templates" && item.href === "/templates")));
    assert(readback.every((page) => page.siteId === SITE_ID));
    const derivedStateAfter = await readDerivedState();
    assert.equal(derivedStateAfter?.revision ?? null, derivedStateBefore?.revision ?? null, "A navigation path repair must not activate or rewrite a derived publication.");
    assert.equal(derivedStateAfter?.contentHash ?? null, derivedStateBefore?.contentHash ?? null, "A navigation path repair must not import or rebuild a derived publication.");
    report.readback = "passed";
    report.latestUpdatedAt = changes
      .map(({ page }) => readById.get(page.id)?.updatedAt)
      .filter(Boolean)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    report.updatedRoutes = PATH_RENAMES
      .map(({ id, from, to }) => ({ id, from: byId.get(id).slug, to }))
      .filter(({ from, to }) => from !== to);
    report.derivedState.revisionAfter = derivedStateAfter?.revision ?? null;
    report.derivedState.contentHashAfter = derivedStateAfter?.contentHash ?? null;
    console.log(JSON.stringify({ result: "readback", ...report }, null, 2));
  }
} finally {
  await db.$disconnect();
}
