#!/usr/bin/env node
// Adds readable /images/:slug and /videos/:slug locators to current
// site_aidreamcapes LivePage picker cards and moves AI Actors to /ai-actors.
// The default run is read-only. Every write is scoped to the Aidreamcapes site
// and guarded by each row's current updatedAt value.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assignPublicSceneSlugs, buildSiteV2 } from "./lib/aidreamcapes-site-v2-content.mjs";
import { withAidreamcapesDirectoryNavigation } from "./lib/aidreamcapes-directory-navigation.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const OLD_ACTOR_PATH = "/ai-video-generation/ai-actors";
const NEW_ACTOR_PATH = "/ai-actors";
const target = argumentValue("--target") ?? String(process.env.DATABASE_TARGET || "local").trim().toLowerCase();
const apply = hasArgument("--apply");
const confirmation = argumentValue("--confirm") ?? "";
assert(["local", "production"].includes(target), "Use --target=local or --target=production.");
if (target === "production") {
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: apply, productionConfirmed: confirmation === "site_aidreamcapes-production" });
  if (apply) assert.equal(confirmation, "site_aidreamcapes-production", "Production writes require --confirm=site_aidreamcapes-production.");
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) {
    assert.equal(confirmation, SITE_ID, `Local writes require --confirm=${SITE_ID}.`);
    assertNonProductionWriteTarget();
  }
}

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return structuredClone(value ?? {});
}

function actorNavigationFrom(current, generated) {
  if (!isRecord(current) || current.version !== 2) return clone(generated);
  const next = clone(current);
  const generatedActor = generated.links.find((item) => item.href === NEW_ACTOR_PATH);
  assert(generatedActor, "Generated AI Actors navigation link is missing.");
  next.menus = (Array.isArray(next.menus) ? next.menus : []).map((menu) => ({
    ...menu,
    groups: (Array.isArray(menu.groups) ? menu.groups : []).map((group) => ({
      ...group,
      items: (Array.isArray(group.items) ? group.items : [])
        .filter((item) => !(item?.label === "AI Actors" || item?.href === OLD_ACTOR_PATH || item?.href === NEW_ACTOR_PATH))
        .map((item) => item?.href === OLD_ACTOR_PATH ? { ...item, href: NEW_ACTOR_PATH } : item)
    }))
  }));
  const links = (Array.isArray(next.links) ? next.links : [])
    .filter((item) => !(item?.label === "AI Actors" || item?.href === OLD_ACTOR_PATH || item?.href === NEW_ACTOR_PATH))
    .map((item) => item?.href === OLD_ACTOR_PATH ? { ...item, href: NEW_ACTOR_PATH } : item);
  const pricingIndex = links.findIndex((item) => item?.href === "/pricing");
  links.splice(pricingIndex < 0 ? links.length : pricingIndex, 0, generatedActor);
  next.links = links;
  return withAidreamcapesDirectoryNavigation(next);
}

function replaceActorPath(value) {
  if (typeof value === "string") {
    return value
      .replaceAll(`https://www.aivideosugc.com${OLD_ACTOR_PATH}`, `https://www.aivideosugc.com${NEW_ACTOR_PATH}`)
      .replaceAll(OLD_ACTOR_PATH, NEW_ACTOR_PATH);
  }
  if (Array.isArray(value)) return value.map(replaceActorPath);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceActorPath(item)]));
  return value;
}

function setActorBreadcrumbs(contentJson) {
  const sections = isRecord(contentJson?.sections) ? contentJson.sections : {};
  const matches = Object.values(sections).filter((section) => isRecord(section) && section.type === "aidreamcapes_v2_page");
  assert.equal(matches.length, 1, "AI Actors page must have exactly one v2 section.");
  const settings = isRecord(matches[0].settings) ? matches[0].settings : {};
  const data = isRecord(settings.data) ? settings.data : {};
  data.breadcrumbs = [{ label: "Home", href: "/" }, { label: "AI Actors", href: NEW_ACTOR_PATH }];
  settings.data = data;
  matches[0].settings = settings;
}

function pickerCards(page) {
  const content = page.contentJson;
  const sections = isRecord(content?.sections) ? content.sections : {};
  const order = Array.isArray(content?.sectionsOrder) ? content.sectionsOrder : Object.keys(sections);
  return order.flatMap((sectionId) => {
    const section = sections[sectionId];
    if (!isRecord(section) || section.type !== "aidreamcapes_v2_page") return [];
    const cards = section?.settings?.data?.visual?.picker?.cards;
    return Array.isArray(cards) ? cards : [];
  });
}

const build = buildSiteV2();
const generatedNavigation = build.pages.find((page) => page.slug === "/")?.contentJson?.siteNavigation ?? build.navigation;
const prisma = new PrismaClient();
try {
  const currentPages = await prisma.livePage.findMany({
    where: { siteId: SITE_ID },
    select: { id: true, siteId: true, slug: true, title: true, contentJson: true, updatedAt: true },
    orderBy: { slug: "asc" }
  });
  assert(currentPages.length > 0, `No current LivePage rows found for ${SITE_ID}.`);
  assert(currentPages.every((page) => page.siteId === SITE_ID), "Unexpected site row in the explicitly scoped query.");
  const actorRows = currentPages.filter((page) => page.slug === OLD_ACTOR_PATH || page.slug === NEW_ACTOR_PATH);
  const actorPage = actorRows.find((page) => page.slug === OLD_ACTOR_PATH || page.id === "aidreamcapes_v2_ai_actors");
  assert(actorPage, "Current AI Actors LivePage is missing.");
  const routeCollision = currentPages.find((page) => page.slug === NEW_ACTOR_PATH && page.id !== actorPage.id);
  assert(!routeCollision, `The target route ${NEW_ACTOR_PATH} belongs to another LivePage (${routeCollision?.id}).`);

  const plans = currentPages.map((page) => ({ ...page, contentJson: clone(page.contentJson) }));
  const slugCountsBefore = new Map();
  for (const page of currentPages) for (const card of pickerCards(page)) {
    if (typeof card?.publicSlug === "string") slugCountsBefore.set(page.slug, (slugCountsBefore.get(page.slug) ?? 0) + 1);
  }
  assignPublicSceneSlugs(plans);
  const home = plans.find((page) => page.slug === "/");
  assert(home, `Current homepage LivePage is missing for ${SITE_ID}.`);
  home.contentJson.siteNavigation = actorNavigationFrom(home.contentJson.siteNavigation, generatedNavigation);

  const plannedActorPage = plans.find((page) => page.id === actorPage.id);
  plannedActorPage.contentJson = replaceActorPath(plannedActorPage.contentJson);
  plannedActorPage.contentJson.seo ??= {};
  plannedActorPage.contentJson.seo.canonicalPath = NEW_ACTOR_PATH;
  plannedActorPage.contentJson.seo.canonical = `https://www.aivideosugc.com${NEW_ACTOR_PATH}`;
  setActorBreadcrumbs(plannedActorPage.contentJson);
  plannedActorPage.slug = NEW_ACTOR_PATH;

  const cardRows = plans.flatMap((page) => pickerCards(page).flatMap((card) =>
    typeof card?.publicSlug === "string" && (card.kind === "photo" || card.kind === "video")
      ? [{ page: page.slug, kind: card.kind, publicSlug: card.publicSlug }]
      : []
  ));
  const publicRoutes = new Set(cardRows.map((card) => `${card.kind}:${card.publicSlug}`));
  assert.equal(publicRoutes.size, cardRows.length, "Image/video short routes must be unique within each route family.");
  assert(cardRows.every((card) => !/(?:^|-)sha256-[a-f0-9]{8,}$/i.test(card.publicSlug)), "A generated public route exposes a content hash.");
  const changed = plans.filter((page, index) => {
    const oldPage = currentPages[index];
    return page.slug !== oldPage.slug || JSON.stringify(page.contentJson) !== JSON.stringify(oldPage.contentJson);
  });
  const summary = {
    generatedAt: new Date().toISOString(),
    target,
    siteId: SITE_ID,
    source: "current PostgreSQL LivePage.contentJson",
    mode: apply ? "apply" : "dry-run",
    livePages: currentPages.length,
    pickerCards: cardRows.length,
    existingPublicSlugs: [...slugCountsBefore.values()].reduce((sum, value) => sum + value, 0),
    newPublicSlugs: cardRows.length - [...slugCountsBefore.values()].reduce((sum, value) => sum + value, 0),
    publicImageRoutes: cardRows.filter((card) => card.kind === "photo").length,
    publicVideoRoutes: cardRows.filter((card) => card.kind === "video").length,
    movedActorPage: { id: actorPage.id, from: actorPage.slug, to: plannedActorPage.slug },
    homeNavigationSource: "LivePage.contentJson.siteNavigation",
    changedPages: changed.map((page) => ({ id: page.id, from: currentPages.find((row) => row.id === page.id)?.slug, to: page.slug, baseUpdatedAt: currentPages.find((row) => row.id === page.id)?.updatedAt.toISOString() }))
  };

  if (apply && changed.length) {
    await prisma.$transaction(async (tx) => {
      for (const page of changed) {
        const base = currentPages.find((row) => row.id === page.id);
        const result = await tx.livePage.updateMany({
          where: { id: page.id, siteId: SITE_ID, updatedAt: base.updatedAt },
          data: { slug: page.slug, contentJson: page.contentJson }
        });
        if (result.count !== 1) throw new Error(`live_page_revision_conflict:${page.slug}`);
      }
    });
    const readback = await prisma.livePage.findMany({ where: { siteId: SITE_ID }, select: { id: true, slug: true, contentJson: true } });
    const readbackActor = readback.find((page) => page.id === actorPage.id);
    assert.equal(readbackActor?.slug, NEW_ACTOR_PATH, "AI Actors route readback");
    assert.equal(readbackActor?.contentJson?.seo?.canonicalPath, NEW_ACTOR_PATH, "AI Actors canonical path readback");
    const actorV2Section = Object.values(readbackActor.contentJson.sections ?? {}).find((section) => section?.type === "aidreamcapes_v2_page");
    assert.deepEqual(actorV2Section?.settings?.data?.breadcrumbs, [{ label: "Home", href: "/" }, { label: "AI Actors", href: NEW_ACTOR_PATH }], "AI Actors breadcrumb readback");
    const readbackHome = readback.find((page) => page.slug === "/");
    assert.equal(readbackHome?.contentJson?.siteNavigation?.version, 2, "Current LivePage navigation readback");
    assert(readbackHome.contentJson.siteNavigation.links.some((item) => item.href === NEW_ACTOR_PATH), "Top-level AI Actors navigation link readback");
    const readbackCards = readback.flatMap(pickerCards).filter((card) => card.kind === "photo" || card.kind === "video");
    assert.equal(readbackCards.length, cardRows.length, "Picker card readback count");
    assert(readbackCards.every((card) => typeof card.publicSlug === "string" && /^[a-z0-9][a-z0-9-]{0,119}$/.test(card.publicSlug)), "Every current picker route must read back as a clean slug.");
    const readbackRoutes = new Set(readbackCards.map((card) => `${card.kind}:${card.publicSlug}`));
    assert.equal(readbackRoutes.size, readbackCards.length, "Picker route uniqueness readback");
    summary.readback = "passed";
  }

  const outPath = argumentValue("--out");
  if (outPath) {
    const resolved = path.resolve(outPath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ written: resolved, ...summary }, null, 2));
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
