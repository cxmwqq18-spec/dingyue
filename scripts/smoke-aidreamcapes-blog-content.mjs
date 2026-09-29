#!/usr/bin/env node

import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget } from "./lib/database-target.mjs";
import { BLOG_ARTICLE_PATHS, LEGACY_ARTICLE_PATH, MIGRATED_ARTICLE_PATH, articleLinkHrefs, validateAidreamcapesBlogArticle } from "./lib/aidreamcapes-blog-route-contract.mjs";

const ORIGIN = String(argumentValue("--origin") || process.env.AIDREAMCAPES_AUDIT_ORIGIN || "http://127.0.0.1:3002").replace(/\/$/, "");
const THEME_ORIGIN = String(argumentValue("--theme-origin") || ORIGIN).replace(/\/$/, "");
const CANONICAL_ORIGIN = String(argumentValue("--canonical-origin") || "https://aidreamcapes.com").replace(/\/$/, "");
const REQUEST_HOST = String(argumentValue("--request-host") || process.env.AIDREAMCAPES_REQUEST_HOST || "").trim();
const REQUEST_PROTO = String(argumentValue("--request-proto") || process.env.AIDREAMCAPES_REQUEST_PROTO || "").trim();
const DB_TARGET = String(argumentValue("--db-target") || process.env.DATABASE_TARGET || "local").trim().toLowerCase();
const SITE_ID = "site_aidreamcapes";

function requestHeaders(origin) {
  if (!origin.startsWith("http://127.0.0.1") && !origin.startsWith("http://localhost")) return {};
  return {
    ...(REQUEST_HOST ? { host: REQUEST_HOST, "x-forwarded-host": REQUEST_HOST } : { "x-forwarded-host": "aidreamcapes.com" }),
    ...(REQUEST_PROTO ? { "x-forwarded-proto": REQUEST_PROTO } : { "x-forwarded-proto": "https" }),
    "Cache-Control": "no-cache"
  };
}

async function fetchPage(origin, pathname) {
  const response = await fetch(`${origin}${pathname}`, { redirect: "manual", headers: requestHeaders(origin) });
  return { response, html: await response.text() };
}

function decode(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function attr(tag, name) {
  return decode(tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, "i"))?.[1] || "");
}

function titleText(html) {
  return decode((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || ["", ""])[1]).replace(/<[^>]+>/g, "").trim();
}

function canonicalFromHtml(html) {
  const tag = (html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i) || [""])[0];
  return attr(tag, "href");
}

function assertIndexablePage(pathname, html, expectedCanonical, requireBlogPosting = false) {
  assert(titleText(html), `${pathname}: title missing`);
  assert.equal(canonicalFromHtml(html), expectedCanonical, `${pathname}: canonical mismatch`);
  const robots = (html.match(/<meta\b(?=[^>]*name=["']robots["'])[^>]*>/i) || [""])[0];
  assert(/index\s*,?\s*follow/i.test(attr(robots, "content")), `${pathname}: page is not index,follow`);
  const ogUrl = (html.match(/<meta\b(?=[^>]*property=["']og:url["'])[^>]*>/i) || [""])[0];
  const ogTitle = (html.match(/<meta\b(?=[^>]*property=["']og:title["'])[^>]*>/i) || [""])[0];
  const ogDescription = (html.match(/<meta\b(?=[^>]*property=["']og:description["'])[^>]*>/i) || [""])[0];
  assert.equal(attr(ogUrl, "content"), expectedCanonical, `${pathname}: og:url mismatch`);
  assert(attr(ogTitle, "content"), `${pathname}: og:title missing`);
  assert(attr(ogDescription, "content"), `${pathname}: og:description missing`);
  assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${pathname}: expected one H1`);
  if (requireBlogPosting) {
    const jsonLd = (html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []).join(" ");
    assert(/BlogPosting/i.test(jsonLd), `${pathname}: BlogPosting JSON-LD missing`);
    const normalizedJsonLd = jsonLd.replace(/\s/g, "");
    assert(normalizedJsonLd.includes(`"url":"${expectedCanonical}"`) || normalizedJsonLd.includes(`"mainEntityOfPage":"${expectedCanonical}"`), `${pathname}: BlogPosting URL mismatch`);
  }
}

async function main() {
  assertDatabaseTarget({ expectedTarget: DB_TARGET });
  const prisma = new PrismaClient();
  try {
    const pages = await prisma.livePage.findMany({
      where: { siteId: SITE_ID, slug: { in: BLOG_ARTICLE_PATHS } },
      select: { slug: true, title: true, contentJson: true },
      orderBy: { slug: "asc" }
    });
    assert.equal(pages.length, BLOG_ARTICLE_PATHS.length, "Aidreamcapes blog article row count mismatch");
    const oldPage = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: LEGACY_ARTICLE_PATH } }, select: { id: true } });
    assert.equal(oldPage, null, "legacy Aidreamcapes blog LivePage still exists");

    const home = await fetchPage(ORIGIN, "/blog");
    assert.equal(home.response.status, 200, `/blog: HTTP ${home.response.status}`);
    assertIndexablePage("/blog", home.html, `${CANONICAL_ORIGIN}/blog`);
    for (const pathname of BLOG_ARTICLE_PATHS) assert(home.html.includes(`href="${pathname}"`), `/blog: missing article link ${pathname}`);
    assert(!home.html.includes(`href="${LEGACY_ARTICLE_PATH}"`), "/blog: legacy article link remains");

    const articleResults = [];
    for (const page of pages) {
      const pathname = page.slug;
      const responsePage = await fetchPage(ORIGIN, pathname);
      assert.equal(responsePage.response.status, 200, `${pathname}: HTTP ${responsePage.response.status}`);
      assertIndexablePage(pathname, responsePage.html, `${CANONICAL_ORIGIN}${pathname}`, true);
      const settings = page.contentJson?.sections?.blog_detail_1?.settings;
      assert(settings, `${pathname}: blog settings missing`);
      validateAidreamcapesBlogArticle({
        slug: pathname,
        title: settings.title,
        description: page.contentJson?.seo?.description || "",
        relatedLinks: settings.relatedLinks.map((link) => [link.href, link.label]),
        targetHref: settings.targetHref,
        primaryHref: settings.primaryHref,
        body: settings.body
      });
      const links = [...new Set(articleLinkHrefs({
        relatedLinks: settings.relatedLinks.map((link) => [link.href, link.label]),
        targetHref: settings.targetHref,
        primaryHref: settings.primaryHref,
        body: settings.body
      }))];
      assert(links.length >= 3 && links.length <= 5, `${pathname}: expected 3-5 unique internal theme links, received ${links.length}`);
      for (const href of links) {
        const linkedPage = await fetchPage(THEME_ORIGIN, href);
        assert.equal(linkedPage.response.status, 200, `${pathname}: linked page ${href} returned ${linkedPage.response.status}`);
        assertIndexablePage(href, linkedPage.html, `${CANONICAL_ORIGIN}${href}`);
      }
      articleResults.push({ path: pathname, linkCount: links.length });
    }

    const legacy = await fetchPage(ORIGIN, LEGACY_ARTICLE_PATH);
    assert([301, 308].includes(legacy.response.status), `${LEGACY_ARTICLE_PATH}: expected permanent redirect, received ${legacy.response.status}`);
    assert.equal(legacy.response.headers.get("location"), `${CANONICAL_ORIGIN}${MIGRATED_ARTICLE_PATH}`, `${LEGACY_ARTICLE_PATH}: redirect target mismatch`);
    const sitePrefixedLegacy = await fetchPage(ORIGIN, `/site/aidreamcapes${LEGACY_ARTICLE_PATH}`);
    assert.equal(sitePrefixedLegacy.response.status, 308, `site-prefixed legacy article: expected 308, received ${sitePrefixedLegacy.response.status}`);
    assert.equal(sitePrefixedLegacy.response.headers.get("location"), `${CANONICAL_ORIGIN}${MIGRATED_ARTICLE_PATH}`, "site-prefixed legacy article: redirect target mismatch");

    const sitemap = await fetchPage(ORIGIN, "/sitemap.xml");
    assert.equal(sitemap.response.status, 200, `/sitemap.xml: HTTP ${sitemap.response.status}`);
    const locs = [...sitemap.html.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => decode(match[1]));
    assert(locs.includes(`${CANONICAL_ORIGIN}/blog`), "sitemap missing blog home");
    assert(locs.includes(`${CANONICAL_ORIGIN}${MIGRATED_ARTICLE_PATH}`), "sitemap missing migrated blog article");
    assert(!locs.includes(`${CANONICAL_ORIGIN}${LEGACY_ARTICLE_PATH}`), "sitemap contains legacy blog article");

    console.log(JSON.stringify({ ok: true, siteId: SITE_ID, articleCount: pages.length, articleResults, migratedFrom: LEGACY_ARTICLE_PATH, migratedTo: MIGRATED_ARTICLE_PATH, themeOrigin: THEME_ORIGIN }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
