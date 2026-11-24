#!/usr/bin/env node
// AIVideosUGC /guides SEO and internal-link rework — 2026-11-24.
//
// Field-level update of current relational LivePage rows for site_aidreamcapes:
//   * 8 how-to guides get a "How do <Tool>" H1, an outcome H2 subtitle, one
//     commercial tool-page CTA, and inline tool-name links pointed at the
//     public tool page instead of another guide.
//   * 5 field-guide articles get intent-specific H1/subtitle and a tool-page
//     primary CTA.
//   * /guides/workspace-guide gets the same H1/subtitle/CTA treatment.
//   * /guides hub cards use guide-type tags and the new titles.
//   * Seven tool pages get one reverse link after their FAQ. Before & After
//     Video and AI Twin intentionally stay unchanged (no guide exists).
//
// URLs are not changed; the existing how-do-* slugs already match the new H1
// wording, so there is no indexed-URL churn and no redirect surface.
//
//   dry run:  node scripts/apply-aivideosugc-guides-seo-2026-11-24.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-guides-seo-2026-11-24.mjs --target=local --apply
//   production additionally requires the explicit confirm name and the
//   combined base hash printed by a fresh production dry run.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";
import { ARTICLES, COPY_REPLACEMENTS, GUIDES, HUB_CARDS, HUB_FIELD_GUIDES, HUB_WORKSPACE_TITLE, LINK_REPLACEMENTS, OWN_LINKS, REMOVED_TOOL_LINKS, TOOL_LINKS, WORKSPACE } from "./lib/aivideosugc-guides-seo-2026-11-24.mjs";

const CONFIRM_NAME = "aivideosugc-guides-seo-2026-11-24";
const HUB_SLUG = "/guides";
const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);

const slugs = [
  ...GUIDES.map((item) => item.slug),
  ...ARTICLES.map((item) => item.slug),
  WORKSPACE.slug,
  HUB_SLUG,
  ...TOOL_LINKS.map((item) => item.slug),
  ...REMOVED_TOOL_LINKS
];

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

/** Replace a literal substring in every JSON string, returning the count. */
function replaceInStrings(value, from, to) {
  let count = 0;
  function walk(node) {
    if (typeof node === "string") {
      if (!node.includes(from)) return node;
      count += node.split(from).length - 1;
      return node.split(from).join(to);
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      for (const key of Object.keys(node)) node[key] = walk(node[key]);
      return node;
    }
    return node;
  }
  walk(value);
  return count;
}

/** Keep Article/HowTo structured-data names aligned with the visible H1. */
/** Keep only links to the guide's own module/tool; other anchors lose their href. */
function stripForeignMarkdownLinks(value, slug) {
  const allowed = new Set(OWN_LINKS[slug] ?? []);
  function keep(href) {
    return allowed.has(href) || href === "/" || href === "/guides" || href.startsWith("/app/create");
  }
  function walk(node) {
    if (typeof node === "string") {
      return node.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (full, label, href) => keep(href) ? full : label);
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      for (const key of Object.keys(node)) node[key] = walk(node[key]);
      return node;
    }
    return node;
  }
  return walk(value);
}

function alignJsonLdHeadline(seo, h1) {
  const graph = seo?.jsonLd?.["@graph"];
  if (!Array.isArray(graph)) return;
  for (const node of graph) {
    if (!node || typeof node !== "object") continue;
    if (node["@type"] === "Article" && typeof node.headline === "string") node.headline = h1;
    if (node["@type"] === "HowTo" && typeof node.name === "string") node.name = h1;
  }
}

function guidePlan(row, spec) {
  const content = JSON.parse(JSON.stringify(row.contentJson));
  const settings = content?.sections?.v2_main?.settings;
  assert(settings && typeof settings === "object", `${spec.slug}: missing v2_main settings.`);
  assert(settings.layout === "guides-howto", `${spec.slug}: expected guides-howto layout, found ${settings.layout}.`);
  const data = settings.data;
  assert(data?.howto, `${spec.slug}: missing howto data.`);
  data.howto.h1 = spec.h1;
  data.howto.subtitle = spec.subtitle;
  data.howto.toolCta = spec.toolCta;
  data.howto.cta = { ...(data.howto.cta ?? {}), href: spec.toolCta.href, title: spec.ctaTitle };
  content.seo = content.seo ?? {};
  content.seo.title = spec.seoTitle;
  if (spec.seoDescription) content.seo.description = spec.seoDescription;
  alignJsonLdHeadline(content.seo, spec.h1);
  let replacements = 0;
  for (const rule of LINK_REPLACEMENTS) replacements += replaceInStrings(content, rule.from, rule.to);
  data.howto.related = [];
  stripForeignMarkdownLinks(data.howto, spec.slug);
  for (const rule of COPY_REPLACEMENTS.filter((item) => item.slug === spec.slug)) {
    replacements += replaceInStrings(data, rule.from, rule.to);
  }
  assert(!JSON.stringify(data).includes("](/guides/"), `${spec.slug}: a guide-to-guide markdown link remains after cleanup.`);
  return { content, replacements };
}

function articlePlan(row, spec) {
  const content = JSON.parse(JSON.stringify(row.contentJson));
  const settings = content?.sections?.v2_main?.settings;
  assert(settings?.layout === "article", `${spec.slug}: expected article layout, found ${settings?.layout}.`);
  const data = settings.data;
  assert(data, `${spec.slug}: missing article data.`);
  data.h1 = spec.h1;
  data.subtitle = spec.subtitle;
  data.tryBox = {
    ...(data.tryBox ?? {}),
    href: spec.toolCta.href,
    label: spec.toolCta.label,
    title: spec.toolCta.label,
    more: { href: spec.appHref, label: "Open the workspace" }
  };
  data.related = [];
  stripForeignMarkdownLinks(data, spec.slug);
  content.seo = content.seo ?? {};
  content.seo.title = spec.seoTitle;
  alignJsonLdHeadline(content.seo, spec.h1);
  return { content, replacements: 0 };
}

function workspacePlan(row, spec) {
  const content = JSON.parse(JSON.stringify(row.contentJson));
  const settings = content?.sections?.v2_main?.settings;
  assert(settings?.layout === "guides", `${spec.slug}: expected guides layout, found ${settings?.layout}.`);
  const guide = settings.data?.guide;
  assert(guide, `${spec.slug}: missing guide data.`);
  guide.h1 = spec.h1;
  guide.subtitle = spec.subtitle;
  guide.toolCta = spec.toolCta;
  content.seo = content.seo ?? {};
  content.seo.title = spec.seoTitle;
  alignJsonLdHeadline(content.seo, spec.h1);
  return { content, replacements: 0 };
}

function hubPlan(row) {
  const content = JSON.parse(JSON.stringify(row.contentJson));
  const settings = content?.sections?.v2_main?.settings;
  assert(settings?.layout === "guides-hub", `${HUB_SLUG}: expected guides-hub layout, found ${settings?.layout}.`);
  const hub = settings.data?.hub;
  assert(hub?.howTos?.items?.length, `${HUB_SLUG}: missing how-to cards.`);
  const cards = new Map(HUB_CARDS.map((card) => [card.href, card]));
  let updatedCards = 0;
  for (const item of hub.howTos.items) {
    const card = cards.get(item.href);
    if (!card) continue;
    item.title = card.title;
    item.kind = card.kind;
    updatedCards += 1;
  }
  assert.equal(updatedCards, HUB_CARDS.length, `${HUB_SLUG}: expected ${HUB_CARDS.length} how-to cards, updated ${updatedCards}.`);
  const fields = new Map(HUB_FIELD_GUIDES.map((item) => [item.href, item.label]));
  let updatedFields = 0;
  for (const item of hub.fieldGuides?.items ?? []) {
    if (!fields.has(item.href)) continue;
    item.label = fields.get(item.href);
    updatedFields += 1;
  }
  assert.equal(updatedFields, HUB_FIELD_GUIDES.length, `${HUB_SLUG}: expected ${HUB_FIELD_GUIDES.length} field-guide labels.`);
  if (hub.workspaceGuide) hub.workspaceGuide.title = HUB_WORKSPACE_TITLE;
  return { content, replacements: 0 };
}

function toolPlan(row, spec) {
  const content = JSON.parse(JSON.stringify(row.contentJson));
  const settings = content?.sections?.v2_main?.settings;
  assert(settings?.data, `${spec.slug}: missing tool data.`);
  settings.data.guideLink = { label: spec.label, href: spec.href };
  return { content, replacements: 0 };
}

function removeGuideLinkPlan(row, slug) {
  const content = JSON.parse(JSON.stringify(row.contentJson));
  const settings = content?.sections?.v2_main?.settings;
  assert(settings?.data, `${slug}: missing tool data.`);
  delete settings.data.guideLink;
  return { content, replacements: 0 };
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId, slug: { in: slugs } },
    select: { id: true, slug: true, title: true, contentJson: true }
  });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  for (const slug of slugs) assert(bySlug.has(slug), `LivePage ${slug} does not exist on ${target}.`);

  const plans = new Map();
  let totalReplacements = 0;
  for (const spec of GUIDES) {
    const { content, replacements } = guidePlan(bySlug.get(spec.slug), spec);
    plans.set(spec.slug, content);
    totalReplacements += replacements;
  }
  for (const spec of ARTICLES) plans.set(spec.slug, articlePlan(bySlug.get(spec.slug), spec).content);
  plans.set(WORKSPACE.slug, workspacePlan(bySlug.get(WORKSPACE.slug), WORKSPACE).content);
  plans.set(HUB_SLUG, hubPlan(bySlug.get(HUB_SLUG)).content);
  for (const spec of TOOL_LINKS) plans.set(spec.slug, toolPlan(bySlug.get(spec.slug), spec).content);
  for (const slug of REMOVED_TOOL_LINKS) plans.set(slug, removeGuideLinkPlan(bySlug.get(slug), slug).content);

  const base = Object.fromEntries([...plans.keys()].sort().map((slug) => [slug, bySlug.get(slug).contentJson]));
  const next = Object.fromEntries([...plans.keys()].sort().map((slug) => [slug, plans.get(slug)]));
  const baseHash = hash(base);
  const nextHash = hash(next);
  const changed = [...plans.keys()].filter((slug) => hash(bySlug.get(slug).contentJson) !== hash(plans.get(slug)));

  console.log(`[guides-seo] target: ${target}; mode: ${apply ? "apply" : "dry run"}`);
  console.log(`[guides-seo] rows: ${slugs.length}; changed: ${changed.length}; inline link replacements: ${totalReplacements}`);
  console.log(`[guides-seo] base hash: ${baseHash}`);
  console.log(`[guides-seo] next hash: ${nextHash}`);
  console.log(`[guides-seo] changed rows: ${changed.join(", ")}`);

  if (argumentValue("--base-hash")) {
    assert.equal(baseHash, argumentValue("--base-hash"), "LivePage content changed since the reviewed dry run; refusing to apply.");
  }

  if (!changed.length) {
    console.log("[guides-seo] already applied; nothing to write.");
  } else if (!apply) {
    console.log("[guides-seo] dry run only. Re-run with --apply to write the relational rows.");
  } else {
    for (const slug of changed) {
      const row = bySlug.get(slug);
      await db.livePage.update({ where: { id: row.id }, data: { contentJson: plans.get(slug) } });
      const readback = await db.livePage.findUnique({ where: { id: row.id }, select: { contentJson: true } });
      assert.equal(hash(readback.contentJson), hash(plans.get(slug)), `${slug}: readback hash mismatch.`);
      console.log(`[guides-seo] wrote ${slug}`);
    }
    console.log("[guides-seo] readback verified for every changed row.");
  }
} finally {
  await db.$disconnect();
}
