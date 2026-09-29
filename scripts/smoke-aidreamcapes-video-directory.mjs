#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { validateAidreamcapesVideoDirectoryContent } from "./lib/aidreamcapes-video-directory-content.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const PAGE_ID = "aidreamcapes_mirror_page_04ef54dc4085da57";
const PAGE_SLUG = "/ai-video-generation";
const LOCAL_URL = "http://127.0.0.1:3002/site/aidreamcapes/ai-video-generation";
const COMPONENT_PATH = path.resolve("src/components/storefront/aidreamcapes-video-directory.tsx");

assertDatabaseTarget({ expectedTarget: "local" });

function jsonLdFromHtml(html) {
  return Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => {
      try {
        return JSON.parse(match[1]);
      } catch {
        return undefined;
      }
    })
    .filter(Boolean);
}

function graphNodes(html) {
  return jsonLdFromHtml(html).flatMap((item) => Array.isArray(item?.["@graph"]) ? item["@graph"] : [item]);
}

function visibleHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
}

function htmlAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const prisma = new PrismaClient();
try {
  const [page, settings, componentSource] = await Promise.all([
    prisma.livePage.findUnique({
      where: { id: PAGE_ID },
      select: { id: true, siteId: true, slug: true, contentJson: true }
    }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { publishedJson: true } }),
    fs.readFile(COMPONENT_PATH, "utf8")
  ]);

  assert(page, `${PAGE_ID}: LivePage is missing`);
  assert.equal(page.siteId, SITE_ID, "directory page must belong to site_aidreamcapes");
  assert.equal(page.slug, PAGE_SLUG, "directory page route changed unexpectedly");
  assert(!componentSource.includes("fetch("), "directory component must remain SSR-only");

  const content = page.contentJson;
  const copy = validateAidreamcapesVideoDirectoryContent();
  const section = content?.sections?.video_theme_directory_1;
  const navigation = settings?.publishedJson?.aidreamcapesZipNavigation;
  const groups = navigation?.video?.groups ?? [];
  const items = groups.flatMap((group) => group.items ?? []);

  assert.equal(content?.contentContract?.siteId, SITE_ID, "content contract site isolation");
  assert.equal(content?.contentContract?.source, "LivePage.contentJson", "directory content source");
  assert.equal(section?.settings?.layout, "aidreamcapes_video_directory", "dedicated directory layout");
  assert.equal(content?.sectionsOrder?.[0], "video_theme_directory_1", "directory section order");
  assert.equal(groups.length, 4, "ZIP video directory must contain four top-level groups");
  assert.equal(items.length, 35, "ZIP video directory must contain 35 public themes");
  assert.equal(content?.contentContract?.expectedThemeCount, items.length, "theme count contract");
  assert.equal(copy.seo.canonical, "https://aidreamcapes.com/ai-video-generation", "canonical source");

  const ogImagePath = path.resolve("public", copy.seo.ogImage.slice(1));
  await fs.access(ogImagePath);

  const response = await fetch(LOCAL_URL, { headers: { accept: "text/html" }, cache: "no-store" });
  assert.equal(response.status, 200, "directory SSR response");
  const html = await response.text();
  const renderedHtml = visibleHtml(html);
  const directoryStart = renderedHtml.indexOf('data-aidreamcapes-video-directory="true"');
  const footerStart = renderedHtml.indexOf("<footer", directoryStart);
  const directoryHtml = renderedHtml.slice(directoryStart, footerStart > directoryStart ? footerStart : undefined);

  assert(html.includes(`<title>${htmlAttribute(copy.seo.title)}</title>`), "SQL title missing from head");
  assert(html.includes(`<link rel="canonical" href="${htmlAttribute(copy.seo.canonical)}"`), "SQL canonical missing from head");
  assert(html.includes(`name="description" content="${htmlAttribute(copy.seo.description)}"`), "SQL description missing from head");
  assert(html.includes('data-aidreamcapes-video-directory="true"'), "dedicated directory renderer marker");
  assert.equal((renderedHtml.match(/data-video-directory-group=/g) ?? []).length, 4, "rendered group count");
  assert.equal((renderedHtml.match(/data-video-directory-workflow/g) ?? []).length, 1, "rendered workflow block");
  assert.equal((renderedHtml.match(/data-video-directory-cta/g) ?? []).length, 1, "rendered CTA block");
  for (const group of groups) {
    assert(renderedHtml.includes(`data-video-directory-group="${group.label}"`), `${group.label}: group missing`);
    for (const item of group.items) {
      assert(renderedHtml.includes(htmlAttribute(item.label)), `${item.label}: label missing`);
      assert(renderedHtml.includes(`href="/site/aidreamcapes${item.href}"`), `${item.label}: scoped route missing`);
    }
  }
  assert(!directoryHtml.includes('href="#"'), "visible directory contains href hash");
  assert(!/<a[^>]+href=["']https?:\/\//i.test(directoryHtml), "visible directory contains cross-site external link");
  assert(!/mydreamshoots\.(com|eu)|mydreamshoots\.xyz/i.test(directoryHtml), "visible directory leaks another storefront");
  assert(!/[\u4e00-\u9fff]/.test(directoryHtml), "visible directory contains Chinese customer copy");
  assert(html.includes('lang="en"'), "document language must remain English");

  const nodes = graphNodes(html);
  assert(nodes.some((node) => node?.["@type"] === "BreadcrumbList"), "BreadcrumbList JSON-LD missing");
  assert(nodes.some((node) => node?.["@type"] === "CollectionPage" || node?.["@type"] === "WebPage"), "page JSON-LD missing");

  console.log(JSON.stringify({
    ok: true,
    siteId: SITE_ID,
    pageId: PAGE_ID,
    route: PAGE_SLUG,
    http: response.status,
    groups: groups.length,
    themes: items.length,
    seo: "PASS",
    jsonLd: "PASS",
    bodyFetch: "PASS",
    storefrontIsolation: "PASS"
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
