#!/usr/bin/env node
// Plan the Aidreamcapes /templates example gallery (Step 3 of
// docs/aivideosugc-template-cases-navigation-plan.md).
//
// Reviewed operations, all field-level with CAS:
//  1. /templates row: v2 data becomes an example gallery (exampleDirectory)
//     replacing the template catalog (templateDirectory); h1/lead/copy and
//     seo updated; stored jsonLd ItemList (18 templates) and FAQPage dropped.
//  2. Every remaining templateDirectory row (facet pages): the directory
//     links chips become All examples / By industry / By platform / By occasion.
//  3. Homepage siteNavigation menus: the Video / Image / Templates footer
//     links point to the gallery (kind-filtered for Video / Image).
//  4. /templates/photo and /templates/video rows are deleted; the runtime
//     redirect helper sends those paths to /templates.
//
//   node --env-file=.env.local scripts/plan-aidreamcapes-template-gallery.mjs --target=local
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const { PrismaClient } = require("@prisma/client");

const SITE_ID = "site_aidreamcapes";
const CONTRACT = "aidreamcapes-template-gallery-2026-10-30-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] || "local";
assert.ok(["local", "production"].includes(target), "--target must be local or production");

const NEW_LINKS = [
  { href: "/templates", label: "All examples" },
  { href: "/industries", label: "By industry" },
  { href: "/platforms", label: "By platform" },
  { href: "/occasions", label: "By occasion" }
];
const GALLERY = {
  h1: "Browse Every Example",
  lead: "Every AI product video and photo example in one place. Open any example to see the full prompt behind it, then recreate it with your own product.",
  eyebrow: "All examples",
  label: "Examples",
  seoTitle: "AI UGC and Product Ad Examples | AIVideosUGC",
  seoDescription: "Browse every AI product video and photo example on AIVideosUGC. Open any example to see the prompt behind it and recreate it with your own product.",
  rowTitle: "Browse Every Example",
  breadcrumbs: [{ href: "/", label: "Home" }, { href: "/templates", label: "Examples" }]
};
const FOOTER_LINKS = {
  Video: { href: "/templates?kind=video", label: "Browse all video examples →" },
  Image: { href: "/templates?kind=photo", label: "Browse all image examples →" },
  Templates: { href: "/templates", label: "Browse all examples →" }
};
const DELETE_SLUGS = ["/templates/photo", "/templates/video"];

function stable(value) {
  if (value === undefined) return '"<undefined>"';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}
function pageHash(row) {
  return hash({
    id: row.id,
    siteId: row.siteId,
    slug: row.slug,
    title: row.title,
    pageType: row.pageType,
    templateKey: row.templateKey,
    contentJson: row.contentJson,
    updatedAt: row.updatedAt
  });
}
const select = { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true };

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { startsWith: "/templates" } },
    select
  });
  const templates = rows.find((row) => row.slug === "/templates");
  assert(templates, "/templates LivePage row is missing");
  const deleteRows = DELETE_SLUGS.map((slug) => {
    const row = rows.find((entry) => entry.slug === slug);
    assert(row, `${slug} LivePage row is missing`);
    return row;
  });

  // The v2 data of /templates must currently be a template catalog.
  const beforeData = templates.contentJson?.sections?.v2_main?.settings?.data;
  assert(beforeData?.templateDirectory, "/templates v2 data has no templateDirectory; refusing to plan");
  assert(beforeData?.templateDirectory?.links, "/templates templateDirectory.links missing");

  // 1. /templates rewrite (targeted transforms, unknown keys preserved).
  const afterData = structuredClone(beforeData);
  afterData.h1 = GALLERY.h1;
  afterData.lead = GALLERY.lead;
  afterData.eyebrow = GALLERY.eyebrow;
  afterData.label = GALLERY.label;
  afterData.breadcrumbs = GALLERY.breadcrumbs;
  afterData.faq = [];
  delete afterData.templateDirectory;
  afterData.exampleDirectory = { links: NEW_LINKS, pageSize: 20 };
  for (const key of ["mediaHeading", "mediaLead", "templateHeading", "filters"]) delete afterData[key];

  const afterContentJson = structuredClone(templates.contentJson);
  afterContentJson.sections.v2_main.settings.data = afterData;
  const seo = afterContentJson.seo;
  seo.title = GALLERY.seoTitle;
  seo.description = GALLERY.seoDescription;
  assert(Array.isArray(seo.jsonLd?.["@graph"]), "/templates stored jsonLd @graph missing");
  const graph = structuredClone(seo.jsonLd["@graph"]);
  const kept = [];
  for (const node of graph) {
    if (node["@type"] === "ItemList") continue; // 18-template ItemList would be stale
    if (node["@type"] === "FAQPage") continue; // template FAQ copy leaves with the gallery
    if (node["@type"] === "CollectionPage") {
      node.name = GALLERY.seoTitle;
      node.description = GALLERY.seoDescription;
    }
    if (node["@type"] === "BreadcrumbList") {
      node.itemListElement = GALLERY.breadcrumbs.map((crumb, index) => ({
        item: `https://www.aivideosugc.com${crumb.href}`,
        name: crumb.label,
        "@type": "ListItem",
        position: index + 1
      }));
    }
    kept.push(node);
  }
  seo.jsonLd["@graph"] = kept;

  const galleryOperation = {
    slug: "/templates",
    type: "update-row",
    fields: ["title", "contentJson.sections.v2_main.settings.data", "contentJson.seo"],
    before: {
      title: templates.title,
      data: beforeData,
      seo: templates.contentJson.seo,
      pageHash: pageHash(templates)
    },
    after: {
      title: GALLERY.rowTitle,
      data: afterData,
      seo
    }
  };

  // 2. Directory links on every other templateDirectory row.
  const linkRows = await db.livePage.findMany({
    where: {
      siteId: SITE_ID,
      slug: { notIn: ["/templates", ...DELETE_SLUGS] },
      // Only rows whose v2 data carries a templateDirectory with links.
      AND: [{ contentJson: { path: ["sections"], not: {} } }]
    },
    select
  });
  const linkOperations = [];
  for (const row of linkRows) {
    const sections = row.contentJson?.sections;
    if (!sections || typeof sections !== "object") continue;
    let touched = false;
    for (const section of Object.values(sections)) {
      const data = section?.settings?.data;
      if (data && data.templateDirectory && Array.isArray(data.templateDirectory.links)) {
        if (JSON.stringify(data.templateDirectory.links) !== JSON.stringify(NEW_LINKS)) touched = true;
      }
    }
    if (!touched) continue;
    const beforeLinks = row.contentJson.sections.v2_main?.settings?.data?.templateDirectory?.links ?? null;
    const beforeHash = pageHash(row); // hash BEFORE any transform below
    const after = structuredClone(row.contentJson);
    for (const section of Object.values(after.sections)) {
      const data = section?.settings?.data;
      if (data && data.templateDirectory && Array.isArray(data.templateDirectory.links)) {
        data.templateDirectory.links = structuredClone(NEW_LINKS);
      }
    }
    linkOperations.push({
      slug: row.slug,
      type: "update-links",
      before: { links: beforeLinks, pageHash: beforeHash },
      after: { contentJson: after }
    });
  }
  assert(linkOperations.length > 0, "No templateDirectory links rows found");

  // 3. Homepage footer links.
  const home = await db.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/" } }, select });
  assert(home, "Homepage row is missing");
  const menus = home.contentJson?.siteNavigation?.menus;
  assert(Array.isArray(menus), "siteNavigation.menus missing");
  const footerOperations = [];
  const homeAfter = structuredClone(home.contentJson);
  for (const menu of homeAfter.siteNavigation.menus) {
    const next = FOOTER_LINKS[menu?.label];
    if (!next) continue;
    footerOperations.push({
      menu: menu.label,
      before: menu.footerLink ?? null,
      after: next
    });
    menu.footerLink = next;
  }
  assert.equal(footerOperations.length, Object.keys(FOOTER_LINKS).length, `Expected 3 footer link ops, found ${footerOperations.length}`);

  const manifest = {
    ok: true,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    newLinks: NEW_LINKS,
    gallery: GALLERY,
    footerLinks: FOOTER_LINKS,
    deleteSlugs: DELETE_SLUGS,
    operations: {
      gallery: galleryOperation,
      links: linkOperations,
      homeFooter: { pageHash: pageHash(home), operations: footerOperations, afterContentJson: homeAfter },
      deleteRows: deleteRows.map((row) => ({ slug: row.slug, id: row.id, row, pageHash: pageHash(row) }))
    }
  };
  manifest.planHash = hash({
    gallery: galleryOperation,
    links: linkOperations,
    homeFooter: { pageHash: manifest.operations.homeFooter.pageHash, operations: footerOperations },
    deleteRows: manifest.operations.deleteRows.map((entry) => ({ slug: entry.slug, pageHash: entry.pageHash }))
  });

  const manifestPath = path.resolve(process.cwd(), `scripts/manifests/aidreamcapes-template-gallery-${target}-2026-10-30.json`);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    manifestPath,
    planHash: manifest.planHash,
    counts: { links: linkOperations.length, footer: footerOperations.length, deletes: deleteRows.length }
  }, null, 2));
} finally {
  await db.$disconnect();
}
