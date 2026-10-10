#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import * as cheerio from "cheerio";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

assertDatabaseTarget({ expectedTarget: "local" });

const sourceRoot = path.join(process.cwd(), "src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  return originalResolveFilename.call(this, request.startsWith("@/") && fs.existsSync(`${resolved}.ts`) ? `${resolved}.ts` : resolved, ...args);
};

const jiti = createJiti(import.meta.url);
const { MYDREAMSHOOTS_TOPIC_GROUPS, mydreamshootsTopicGroupForPath, isMydreamshootsSaveDateTopicGroupPathRequest, isMydreamshootsTopicGroupActive, isMydreamshootsVideoTopicGroupPathRequest } = jiti("../src/lib/mydreamshoots-topic-groups.ts");
const { buildPublicationSnapshot } = jiti("../src/lib/stores/theme-store.ts");
const { sitemapEntriesForSite } = jiti("../src/lib/seo-indexing.ts");
const db = new PrismaClient();

function groupLinks(page, sectionId) {
  const section = page?.publishedJson?.sections?.[sectionId];
  const links = section?.settings?.links;
  return Array.isArray(links) ? links : [];
}

function normalizePath(href, origin, originPathPrefix) {
  try {
    const pathname = new URL(href, origin).pathname.replace(/\/$/, "") || "/";
    return originPathPrefix && (pathname === originPathPrefix || pathname.startsWith(`${originPathPrefix}/`))
      ? pathname.slice(originPathPrefix.length) || "/"
      : pathname;
  } catch {
    return "";
  }
}

async function checkRenderedRoutes(origin, groups, parentPaths, homeDirectoryPaths) {
  const root = origin.replace(/\/$/, "");
  const originPathPrefix = new URL(root).pathname.replace(/\/+$/, "");
  const htmlFor = async (path) => {
    const response = await fetch(`${root}${path}`, { redirect: "manual", headers: { accept: "text/html" }, signal: AbortSignal.timeout(90000) });
    return { response, html: await response.text() };
  };
  const groupResponses = await Promise.all(groups.map(async ({ group, children }) => {
    const { response, html } = await htmlFor(group.path);
    assert.equal(response.status, 200, `SSR route ${group.path} returned ${response.status}.`);
    const $ = cheerio.load(html);
    const canonicalPath = normalizePath($('link[rel="canonical"]').attr("href"), root, originPathPrefix);
    assert.equal(canonicalPath, group.path, `${group.path} must emit a self canonical.`);
    assert.equal($('meta[name="robots"]').attr("content")?.includes("noindex"), false, `${group.path} must be indexable.`);
    assert.equal($("h1").first().text().trim().replace(/\s+/g, " "), group.title, `${group.path} must SSR its unique H1.`);
    assert.ok($('[data-topic-group-breadcrumb][aria-label="Breadcrumb"]').length, `${group.path} must SSR its breadcrumb.`);
    const childAnchors = $('[data-topic-group-links] a[href]').map((i, element) => normalizePath($(element).attr("href"), root, originPathPrefix)).get();
    assert.equal(childAnchors.length, children.length, `${group.path} must SSR every planned child link.`);
    assert.deepEqual(new Set(childAnchors), new Set(children.map((child) => child.href)), `${group.path} SSR child links must match the active sitemap children.`);
    return { path: group.path, status: response.status, canonicalPath, h1: $("h1").first().text().trim(), childLinks: childAnchors.length };
  }));

  const directoryResponses = await Promise.all(parentPaths.map(async (parentPath) => {
    const { response, html } = await htmlFor(parentPath);
    assert.equal(response.status, 200, `SSR directory ${parentPath} returned ${response.status}.`);
    const $ = cheerio.load(html);
    const groupPaths = $('[data-topic-group-links] a[href]').map((i, element) => normalizePath($(element).attr("href"), root, originPathPrefix)).get();
    const expected = groups.filter(({ group }) => group.parentPath === parentPath).map(({ group }) => group.path);
    assert.deepEqual(new Set(groupPaths), new Set(expected), `${parentPath} must SSR all of its group links.`);
    return { path: parentPath, status: response.status, groupLinks: groupPaths.length };
  }));

  const home = await htmlFor("/");
  assert.equal(home.response.status, 200, `Homepage SSR returned ${home.response.status}.`);
  const $home = cheerio.load(home.html);
  const homeBodyLinks = new Set($home("body a[href]").filter((i, element) => !$home(element).closest("header,footer").length).map((i, element) => normalizePath($home(element).attr("href"), root, originPathPrefix)).get());
  for (const directoryPath of homeDirectoryPaths) assert.ok(homeBodyLinks.has(directoryPath), `Homepage body must link to ${directoryPath}.`);

  for (const [path, routeName] of [
    ["/ai-image-generation/not-a-current-theme", "unknown image group/theme"],
    ["/ai-video-generation/group/not-a-current-category", "unknown video group"],
    ["/best-save-the-date/group/not-a-current-category", "unknown Save the Date group"]
  ]) {
    const { response } = await htmlFor(path);
    assert.equal(response.status, 404, `${routeName} must return 404.`);
    assert.match(response.headers.get("x-robots-tag") || "noindex", /noindex/i, `${routeName} must be noindex.`);
  }
  return { groups: groupResponses, directories: directoryResponses, homepageBodyDirectories: homeDirectoryPaths, unknownRoutes: 3 };
}

async function main() {
  try {
    const state = await readPlatformStateFromSql(db, { pageSource: "live" });
    const site = state.sites.find((candidate) => candidate.id === "site_dreamshoot");
    assert.ok(site, "Local site_dreamshoot relational records are required.");
    assert.equal(MYDREAMSHOOTS_TOPIC_GROUPS.length, 13, "The approved plan defines 13 group routes.");
    assert.equal(new Set(MYDREAMSHOOTS_TOPIC_GROUPS.map((group) => group.path)).size, 13, "Group paths must be unique.");

    const snapshot = buildPublicationSnapshot(site, undefined, state.creativePacks.filter((row) => row.siteId === site.id), state.products.filter((row) => row.siteId === site.id));
    const sitemapPaths = new Set(sitemapEntriesForSite(state, site).map((entry) => new URL(entry.loc).pathname));
    const results = [];

    for (const group of MYDREAMSHOOTS_TOPIC_GROUPS) {
      const page = site.pages.find((candidate) => candidate.slug === group.path || candidate.publishedJson?.seo?.canonicalPath === group.path);
      assert.ok(page, `Missing local LivePage for ${group.path}`);
      assert.equal(page.publishedJson?.seo?.canonicalPath, group.path, `${group.path} must use a self canonical.`);
      assert.equal(page.publishedJson?.seo?.index, true, `${group.path} must be indexable.`);
      assert.equal(page.publishedJson?.seo?.follow, true, `${group.path} must allow crawling.`);
      assert.ok(sitemapPaths.has(group.path), `${group.path} must be in the current sitemap.`);
      assert.ok(isMydreamshootsTopicGroupActive(state, site.id, group), `${group.path} must map to an active category.`);
      const inactiveState = structuredClone(state);
      const inactiveCategories = group.kind === "image" ? inactiveState.creativePackCategories : inactiveState.videoThemeCategories;
      const categoryToDisable = group.kind === "save-the-date"
        ? inactiveCategories.find((category) => category.siteId === site.id && category.slug === group.categorySlug)
        : inactiveCategories.find((category) => category.siteId === site.id && category.slug === group.categorySlug && !category.parentId);
      assert.ok(categoryToDisable, `${group.path} must have a matching active taxonomy category.`);
      categoryToDisable.status = "inactive";
      assert.equal(isMydreamshootsTopicGroupActive(inactiveState, site.id, group), false, `${group.path} must stop resolving when its category is disabled.`);

      const hero = page.publishedJson.sections?.topic_group_hero;
      assert.equal(hero?.type, "editorial_hero", `${group.path} needs an SSR hero/H1.`);
      assert.equal(hero?.settings?.title, group.title, `${group.path} needs its own public title.`);
      assert.ok(hero?.settings?.intro?.trim(), `${group.path} needs useful introductory copy.`);
      assert.ok(page.publishedJson.mediaManifest?.[0]?.src && page.publishedJson.mediaManifest?.[0]?.alt, `${group.path} needs an image and descriptive alt text.`);

      const topicLinks = groupLinks(page, "topic_group_topics");
      assert.ok(topicLinks.length > 0, `${group.path} needs at least one child theme link.`);
      assert.ok(page.publishedJson.contextualLinks?.some((link) => link.href === group.parentPath), `${group.path} needs a body link back to its parent directory.`);
      const relatedGroup = MYDREAMSHOOTS_TOPIC_GROUPS.find((candidate) => candidate.id === group.relatedGroupId);
      assert.ok(relatedGroup, `${group.path} references a missing related group.`);
      assert.ok(page.publishedJson.relatedLinks?.some((link) => link.href === relatedGroup.path), `${group.path} needs its semantically related group link.`);
      for (const link of topicLinks) {
        assert.ok(typeof link.href === "string" && link.href.startsWith("/"), `${group.path} has an invalid child href.`);
        assert.ok(typeof link.label === "string" && link.label.trim().length >= 12, `${group.path} has a non-descriptive child anchor.`);
        assert.ok(link.description?.trim(), `${group.path} has a child link without descriptive context.`);
        assert.ok(sitemapPaths.has(link.href), `${group.path} links to a non-sitemap child: ${link.href}`);
      }

      const breadcrumb = page.publishedJson.sections?.topic_group_breadcrumb;
      const crumbs = breadcrumb?.settings?.breadcrumbs;
      assert.equal(breadcrumb?.type, "topic_group_breadcrumb", `${group.path} needs a breadcrumb section.`);
      assert.ok(Array.isArray(crumbs) && crumbs.length === 3, `${group.path} needs Home → directory → group breadcrumbs.`);
      assert.equal(crumbs[1]?.href, group.parentPath, `${group.path} breadcrumb must link to its directory.`);
      assert.equal(crumbs[2]?.label, group.label, `${group.path} breadcrumb must identify the current group.`);

      const parent = site.pages.find((candidate) => candidate.slug === group.parentPath);
      const parentLinks = groupLinks(parent, "topic_groups_navigation");
      assert.ok(parentLinks.some((link) => link.href === group.path && link.label?.trim()), `${group.parentPath} needs a descriptive body link to ${group.path}.`);

      for (const child of topicLinks) {
        if (group.kind === "image") {
          const backlinks = parent.publishedJson.contextualLinksByPath?.[child.href];
          assert.ok(Array.isArray(backlinks) && backlinks.some((link) => link.href === group.path), `${child.href} must link back to ${group.path}.`);
        } else {
          const childPage = site.pages.find((candidate) => candidate.slug === child.href || candidate.publishedJson?.seo?.canonicalPath === child.href);
          assert.ok(childPage?.publishedJson?.contextualLinks?.some((link) => link.href === group.path), `${child.href} must link back to ${group.path}.`);
        }
      }

      const route = snapshot.publishedRoutes.find((candidate) => candidate.canonicalPath === group.path && candidate.disposition === "render" && candidate.indexable);
      assert.ok(route, `${group.path} must resolve as a current published indexable route.`);
      results.push({ path: group.path, parent: group.parentPath, children: topicLinks.length, canonical: group.path, sitemap: true, indexable: true });
    }

    for (const parentPath of ["/ai-image-generation", "/ai-video-generation", "/best-save-the-date"]) {
      const parent = site.pages.find((candidate) => candidate.slug === parentPath);
      assert.ok(parent, `Missing parent directory ${parentPath}`);
      assert.ok(parent.publishedJson.sectionsOrder.includes("topic_groups_navigation"), `${parentPath} must render group links in its page body.`);
    }

    assert.equal(mydreamshootsTopicGroupForPath("/ai-video-generation/group/not-a-live-category"), undefined, "Unknown group paths must not resolve as public pages.");
    assert.equal(isMydreamshootsVideoTopicGroupPathRequest("mydreamshoots", ["ai-video-generation", "group", "not-a-live-category"]), true, "Unknown video group shapes must reach the route's 404/noindex guard.");
    assert.equal(isMydreamshootsSaveDateTopicGroupPathRequest("mydreamshoots", ["best-save-the-date", "group", "not-a-live-category"]), true, "Unknown Save the Date group shapes must reach the route's 404/noindex guard.");
    assert.equal(isMydreamshootsVideoTopicGroupPathRequest("other-store", ["ai-video-generation", "group", "not-a-live-category"]), false, "Video group handling must remain isolated to MyDreamShoots.");

    const originArgument = process.argv.find((value) => value.startsWith("--origin="))?.slice("--origin=".length);
    const renderedRoutes = originArgument
      ? await checkRenderedRoutes(originArgument, MYDREAMSHOOTS_TOPIC_GROUPS.map((group) => ({
          group,
          children: groupLinks(site.pages.find((page) => page.slug === group.path || page.publishedJson?.seo?.canonicalPath === group.path), "topic_group_topics")
        })), ["/ai-image-generation", "/ai-video-generation", "/best-save-the-date"], ["/ai-image-generation", "/ai-video-generation", "/best-save-the-date"])
      : undefined;
    console.log(JSON.stringify({ ok: true, siteId: site.id, sitemapPages: sitemapPaths.size, topicGroupPages: results.length, children: results.reduce((sum, row) => sum + row.children, 0), groups: results, ...(renderedRoutes ? { renderedRoutes } : {}) }, null, 2));
  } finally {
    await db.$disconnect();
    Module._resolveFilename = originalResolveFilename;
    Module._load = originalLoad;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
