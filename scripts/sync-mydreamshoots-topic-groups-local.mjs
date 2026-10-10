#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const apply = process.argv.includes("--apply");
assertDatabaseTarget({ expectedTarget: "local" });

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  let resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) resolved = `${resolved}.ts`;
  return originalResolveFilename.call(this, resolved, ...args);
};

const jiti = createJiti(import.meta.url);
const { MYDREAMSHOOTS_TOPIC_GROUPS } = jiti("../src/lib/mydreamshoots-topic-groups.ts");
const { buildPublicationSnapshot } = jiti("../src/lib/stores/theme-store.ts");
const { sitemapEntriesForSite } = jiti("../src/lib/seo-indexing.ts");
const taxonomy = JSON.parse(fs.readFileSync(path.join(sourceRoot, "lib/mydreamshoots-theme-taxonomy.json"), "utf8"));
const db = new PrismaClient();

const ROOT_PATH_LABELS = {
  "/": "Home",
  "/ai-image-generation": "AI Photo Themes",
  "/ai-video-generation": "AI Video Themes",
  "/best-save-the-date": "Save the Date Videos"
};

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function routePath(route) {
  return route?.canonicalPath || "";
}

function descriptionForImage(item, category) {
  return String(item?.description || category?.description || "Browse this photo theme and choose a visual direction that fits your next private collection.").trim();
}

function publishedRoutes(snapshot, kind, sitemapPaths) {
  return snapshot.publishedRoutes.filter((route) => route.disposition === "render" && route.status === "published" && route.indexable && route.sitemapEligible && route.routeKind === kind && sitemapPaths.has(routePath(route)));
}

function imageMediaForPath(snapshot, route) {
  const media = snapshot.publishedPageMedia.find((candidate) => candidate.pageEntityId === route.pageEntityId && candidate.status === "ready");
  return media?.primaryImage && media.imageAlts?.[0]
    ? { src: media.primaryImage, alt: media.imageAlts[0] }
    : undefined;
}

function topicMediaForPath(snapshot, route) {
  const media = snapshot.publishedPageMedia.find((candidate) => candidate.pageEntityId === route.pageEntityId && candidate.status === "ready");
  return media?.primaryImage && media.imageAlts?.[0]
    ? { src: media.primaryImage, alt: media.imageAlts[0] }
    : undefined;
}

function standardMediaForPath(snapshot, route, site) {
  const media = snapshot.publishedStandardPageMedia.find((candidate) => candidate.canonicalPath === route.canonicalPath && candidate.status === "ready");
  const sourcePage = site.pages.find((page) => page.slug === route.canonicalPath || page.publishedJson.seo?.canonicalPath === route.canonicalPath);
  const item = sourcePage?.publishedJson.mediaManifest?.[0];
  const src = media?.primaryImage || item?.src || sourcePage?.publishedJson.seo?.ogImage || "";
  const alt = media?.primaryImageAlt || item?.alt || sourcePage?.publishedJson.seo?.ogImageAlt || "";
  return src && alt ? { src, alt } : undefined;
}

function rootCategoryBySlug(categories, slug) {
  return categories.find((category) => category.slug === slug && !category.parentId && category.status === "active");
}

function buildImageMembers(group, site, snapshot, taxonomyItems, routes, categories) {
  const root = rootCategoryBySlug(categories, group.categorySlug);
  if (!root) return [];
  const validRoutes = new Map(routes.map((route) => [route.canonicalPath, route]));
  const categoryBySlug = new Map(categories.filter((category) => category.status === "active").map((category) => [category.slug, category]));
  return taxonomyItems
    .filter((item) => item.groupSlug === group.categorySlug)
    .flatMap((item) => {
      const category = categoryBySlug.get(item.slug);
      const route = validRoutes.get(`/ai-image-generation/${item.slug}`);
      if (!category || !route) return [];
      return [{
        path: route.canonicalPath,
        label: item.label || category.label,
        description: descriptionForImage(item, category),
        linkLabel: `Explore ${item.label || category.label} photo themes`,
        media: imageMediaForPath(snapshot, route),
        route
      }];
    });
}

function buildCategoryMembers(group, site, snapshot, videoRoutes, standardRoutes, sitemapPaths, categories, themes) {
  const siteCategories = categories.filter((category) => category.siteId === site.id);
  const siteThemes = themes.filter((theme) => theme.siteId === site.id);
  const root = rootCategoryBySlug(siteCategories, group.categorySlug);
  if (!root) return [];
  const activeChildren = siteCategories.filter((category) => category.parentId === root.id && category.status === "active");
  if (group.categorySlug === "save-the-date") {
    const activeChildIds = new Set(activeChildren.map((category) => category.id));
    const themesForGroup = siteThemes.filter((theme) => theme.status === "active" && theme.categoryId && activeChildIds.has(theme.categoryId));
    const routesBySlug = new Map(standardRoutes.filter((route) => route.canonicalPath.startsWith("/ai-save-the-date/")).map((route) => [route.canonicalPath.split("/").at(-1), route]));
    return themesForGroup.flatMap((theme) => {
      const route = routesBySlug.get(theme.slug);
      if (!route || !sitemapPaths.has(route.canonicalPath)) return [];
      return [{ path: route.canonicalPath, label: theme.name, description: theme.description, linkLabel: `Explore ${theme.name} celebration videos`, media: standardMediaForPath(snapshot, route, site), route }];
    }).filter((member, index, all) => all.findIndex((candidate) => candidate.path === member.path) === index);
  }
  const routesBySlug = new Map(videoRoutes.map((route) => [route.canonicalPath.split("/").at(-1), route]));
  return activeChildren.flatMap((category) => {
    const route = routesBySlug.get(category.slug);
    if (!route || !sitemapPaths.has(route.canonicalPath)) return [];
    const entity = snapshot.publishedPageEntities.find((candidate) => candidate.pageEntityId === route.pageEntityId);
    const label = category.label || entity?.metadata.title || displayNameForPath(route.canonicalPath);
    return [{ path: route.canonicalPath, label, description: category.description || entity?.metadata.description || "", linkLabel: `Explore ${label} video themes`, media: topicMediaForPath(snapshot, route), route }];
  }).filter((member, index, all) => all.findIndex((candidate) => candidate.path === member.path) === index);
}

function buildSaveDateMembers(group, site, standardRoutes, snapshot, sitemapPaths, categories, themes) {
  const siteCategories = categories.filter((category) => category.siteId === site.id);
  const siteThemes = themes.filter((theme) => theme.siteId === site.id);
  const root = rootCategoryBySlug(siteCategories, "save-the-date");
  if (!root) return [];
  const child = siteCategories.find((category) => category.parentId === root.id && category.slug === group.categorySlug && category.status === "active");
  if (!child) return [];
  const themeBySlug = new Map(siteThemes.filter((theme) => theme.status === "active" && theme.categoryId === child.id).map((theme) => [theme.slug, theme]));
  return standardRoutes
    .filter((route) => route.canonicalPath.startsWith("/ai-save-the-date/") && sitemapPaths.has(route.canonicalPath))
    .flatMap((route) => {
      const slug = route.canonicalPath.split("/").at(-1);
      const theme = themeBySlug.get(slug);
      if (!theme) return [];
      return [{
        path: route.canonicalPath,
        label: theme.name,
        description: theme.description,
        linkLabel: `Explore ${theme.name} celebration videos`,
        media: standardMediaForPath(snapshot, route, site),
        route
      }];
    });
}

function displayNameForPath(path, fallback = "Related theme") {
  return path.split("/").at(-1)?.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || fallback;
}

function groupNavigationCopy(group) {
  const noun = group.kind === "image" ? "photo themes" : "video themes";
  return {
    label: `Explore ${group.label} ${noun}`,
    description: group.description
  };
}

function buildGroupContent(group, members, relatedGroup) {
  const heroMedia = members.find((member) => member.media)?.media;
  const parentLabel = ROOT_PATH_LABELS[group.parentPath] || "Explore themes";
  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: parentLabel, href: group.parentPath },
    { label: group.label, href: "" }
  ];
  const primaryCta = `Browse all ${group.kind === "image" ? "photo" : "video"} themes`;
  const childIntro = `Choose a theme to explore its format, visual direction, and the details you can shape before creating a private result.`;
  const contextualLinks = [
    { before: "Return to", label: parentLabel, href: group.parentPath, after: "to compare the full directory." },
    ...(relatedGroup ? [{ before: "You can also explore", label: relatedGroup.label, href: relatedGroup.path, after: "for another related set of ideas." }] : []),
    ...(group.id === "save-the-date-love-wedding" ? [{ before: "For a coordinated announcement", label: "wedding invitation reveal videos", href: "/ai-save-the-date/wedding-invitation", after: "." }] : [])
  ];
  const relatedLinks = relatedGroup ? [{ label: `Explore ${relatedGroup.label} themes`, href: relatedGroup.path }] : [];
  const sectionsOrder = ["topic_group_breadcrumb", "topic_group_hero", "topic_group_topics", "topic_group_details"];
  return {
    pageType: "standard-content",
    version: 1,
    sectionsOrder,
    sections: {
      topic_group_breadcrumb: {
        type: "topic_group_breadcrumb",
        settings: { breadcrumbs }
      },
      topic_group_hero: {
        type: "editorial_hero",
        settings: {
          anchor: "overview",
          eyebrow: group.kind === "image" ? "AI PHOTO THEMES" : "AI VIDEO THEMES",
          title: group.title,
          intro: group.description,
          support: "Review each theme and choose the style or story format that fits what you want to share.",
          primaryCta,
          primaryHref: group.parentPath,
          secondaryCta: "See how it works",
          secondaryHref: "/workflow",
          ...(heroMedia ? { imageUrl: heroMedia.src, imageAlt: heroMedia.alt, imageWidth: 1600, imageHeight: 1000 } : {})
        }
      },
      topic_group_topics: {
        type: "topic_group_links",
        settings: {
          anchor: "themes",
          title: `${group.label} themes`,
          intro: childIntro,
          links: members.map((member) => ({ href: member.path, label: member.linkLabel, description: member.description || `Explore ${member.label} and compare it with related ${group.kind === "image" ? "photo" : "video"} ideas.` }))
        }
      },
      topic_group_details: {
        type: "editorial_rich_text",
        settings: {
          anchor: "choosing-a-theme",
          title: "Choose a direction that fits your moment",
          intro: group.kind === "image"
            ? "A clear source photo and a focused style choice make it easier to compare the options in this collection."
            : "A clear subject, a simple story, and a format suited to your audience make each video direction easier to review."
        },
        blocks: [
          { id: "topic_group_detail_1", type: "editorial_paragraph", settings: { text: "Open a theme to see its workflow and examples. Before sharing a finished result, review names, dates, text, and other details that matter to you." } },
          { id: "topic_group_detail_2", type: "editorial_paragraph", settings: { text: "You can return to the parent directory at any time to compare this collection with other photo and video themes." } }
        ]
      }
    },
    relatedLinks,
    contextualLinks,
    mediaManifest: heroMedia ? [{ src: heroMedia.src, alt: `${group.label} theme example: ${heroMedia.alt}`, role: "hero", loading: "eager", fetchPriority: "high", width: 1600, height: 1000 }] : [],
    seo: {
      title: group.seoTitle,
      description: group.description,
      canonicalPath: group.path,
      canonical: `https://www.mydreamshoots.com${group.path}`,
      ogImage: heroMedia?.src,
      ogImageAlt: heroMedia ? `${group.label} theme example: ${heroMedia.alt}` : undefined,
      index: true,
      follow: true,
      robots: { index: true, follow: true, maxImagePreview: "large" }
    }
  };
}

function groupEntryForParent(group, members) {
  const copy = groupNavigationCopy(group);
  return { href: group.path, label: copy.label, description: `${members.length} current ${group.kind === "image" ? "photo" : "video"} themes, including ${members.slice(0, 3).map((member) => member.label).join(", ")}.` };
}

function insertTopicGroupLinks(page, parentGroups) {
  const json = structuredClone(page.publishedJson);
  const sectionId = "topic_groups_navigation";
  const firstContentSection = json.sectionsOrder.find((id) => json.sections[id]?.type !== "topic_group_links");
  json.sections[sectionId] = {
    type: "topic_group_links",
    settings: {
      anchor: "topic-groups",
      title: "Explore themes by topic",
      intro: "Use these collections to compare focused themes before opening an individual photo or video page.",
      links: parentGroups.map(({ group, members }) => groupEntryForParent(group, members))
    }
  };
  const withoutExisting = json.sectionsOrder.filter((id) => id !== sectionId);
  const insertAt = firstContentSection ? Math.max(1, withoutExisting.indexOf(firstContentSection) + 1) : 0;
  withoutExisting.splice(insertAt, 0, sectionId);
  json.sectionsOrder = withoutExisting;
  return json;
}

function ensureContextualLinks(existing, additions) {
  const current = Array.isArray(existing) ? existing.filter((item) => item && typeof item.href === "string" && typeof item.label === "string") : [];
  const seen = new Set(current.map((item) => item.href));
  return [...current, ...additions.filter((item) => !seen.has(item.href) && seen.add(item.href))];
}

function leafContextualLinks(group, relatedGroup) {
  const noun = group.kind === "image" ? "photo" : "video";
  return [
    { before: "Explore more", label: `${group.label} ${noun} themes`, href: group.path, after: "and compare the full collection." },
    ...(relatedGroup ? [{ before: "Related ideas are also available in", label: `${relatedGroup.label} themes`, href: relatedGroup.path, after: "." }] : [])
  ];
}

function normalizePageLocalSectionAnchors(pagePath, value) {
  if (Array.isArray(value)) return value.map((item) => normalizePageLocalSectionAnchors(pagePath, item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (/Href$/.test(key) && typeof item === "string" && /^#[a-z0-9_-]+$/i.test(item)) return [key, `${pagePath}${item}`];
    return [key, normalizePageLocalSectionAnchors(pagePath, item)];
  }));
}

function addLeafLinks(rootPages, groupData, baseUpdates = new Map()) {
  const updates = new Map(baseUpdates);
  const updateRoot = (rootPath, callback) => {
    const page = rootPages.find((candidate) => candidate.slug === rootPath);
    if (!page) throw new Error(`Required directory LivePage is missing: ${rootPath}`);
    const current = updates.get(page.slug) || structuredClone(page.publishedJson);
    updates.set(page.slug, callback(current));
  };
  for (const { group, members } of groupData) {
    const relatedGroup = groupData.find((candidate) => candidate.group.id === group.relatedGroupId)?.group;
    if (!relatedGroup) throw new Error(`Related topic group is missing for ${group.path}: ${group.relatedGroupId}`);
    if (group.kind === "image") {
      updateRoot("/ai-image-generation", (json) => {
        const contextualLinksByPath = { ...plainObject(json.contextualLinksByPath) };
        for (const member of members) {
          contextualLinksByPath[member.path] = ensureContextualLinks(contextualLinksByPath[member.path], leafContextualLinks(group, relatedGroup));
        }
        return { ...json, contextualLinksByPath };
      });
    } else {
      for (const member of members) {
        const page = rootPages.find((candidate) => candidate.slug === member.path || candidate.publishedJson.seo?.canonicalPath === member.path);
        if (!page) throw new Error(`Required linked LivePage is missing: ${member.path}`);
        const current = updates.get(page.slug) || structuredClone(page.publishedJson);
        updates.set(page.slug, {
          ...normalizePageLocalSectionAnchors(current.seo?.canonicalPath || page.slug, current),
          contextualLinks: ensureContextualLinks(current.contextualLinks, leafContextualLinks(group, relatedGroup))
        });
      }
    }
  }
  return updates;
}

function summarizeOperation(operation) {
  return {
    slug: operation.slug,
    operation: operation.create ? "create" : "update",
    title: operation.title,
    sections: operation.contentJson.sectionsOrder?.length || 0,
    links: operation.contentJson.sections?.topic_group_topics?.settings?.links?.length || 0,
    indexable: operation.contentJson.seo?.index !== false
  };
}

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}

async function main() {
  try {
    const state = await readPlatformStateFromSql(db, { pageSource: "live" });
    const site = state.sites.find((candidate) => candidate.id === "site_dreamshoot");
    assert.ok(site, "local MyDreamShoots relational data is required");
    const packs = state.creativePacks.filter((pack) => pack.siteId === site.id);
    const products = state.products.filter((product) => product.siteId === site.id);
    const snapshot = buildPublicationSnapshot(site, undefined, packs, products);
    const currentSitemapPaths = new Set(sitemapEntriesForSite(state, site).map((entry) => new URL(entry.loc).pathname));
    const imageRoutes = publishedRoutes(snapshot, "ai-image-theme-leaf", currentSitemapPaths);
    const videoRoutes = publishedRoutes(snapshot, "ai-video-topic-leaf", currentSitemapPaths);
    const standardRoutes = publishedRoutes(snapshot, "standard-content", currentSitemapPaths);
    const taxonomyItems = taxonomy.items || [];
    const activeImageCategories = state.creativePackCategories.filter((category) => category.siteId === site.id && category.status === "active");
    const groupData = MYDREAMSHOOTS_TOPIC_GROUPS.map((group) => {
      let members = [];
      if (group.kind === "image") members = buildImageMembers(group, site, snapshot, taxonomyItems, imageRoutes, activeImageCategories);
      else if (group.kind === "save-the-date") members = buildSaveDateMembers(group, site, standardRoutes, snapshot, currentSitemapPaths, state.videoThemeCategories, state.videoThemes);
      else members = buildCategoryMembers(group, site, snapshot, videoRoutes, standardRoutes, currentSitemapPaths, state.videoThemeCategories, state.videoThemes);
      members = members.filter((member) => member.media?.src && member.media?.alt && currentSitemapPaths.has(member.path));
      return { group, members };
    });
    const emptyGroups = groupData.filter(({ members }) => !members.length).map(({ group }) => group.path);
    if (emptyGroups.length) throw new Error(`Active topic groups have no current indexable children: ${emptyGroups.join(", ")}`);

    const updates = new Map();
    for (const [parentPath, children] of [
      ["/ai-image-generation", groupData.filter(({ group }) => group.kind === "image")],
      ["/ai-video-generation", groupData.filter(({ group }) => group.kind === "video")],
      ["/best-save-the-date", groupData.filter(({ group }) => group.kind === "save-the-date")]
    ]) {
      const page = site.pages.find((candidate) => candidate.slug === parentPath);
      assert.ok(page, `Required parent directory page is missing: ${parentPath}`);
      updates.set(page.slug, insertTopicGroupLinks(page, children));
    }
    for (const [slug, contentJson] of addLeafLinks(site.pages, groupData, updates)) updates.set(slug, contentJson);

    const pageOperations = [];
    for (const { group, members } of groupData) {
      const relatedGroup = groupData.find((candidate) => candidate.group.id === group.relatedGroupId)?.group;
      if (!relatedGroup) throw new Error(`Related topic group is missing for ${group.path}: ${group.relatedGroupId}`);
      const existing = site.pages.find((page) => page.slug === group.path || page.publishedJson.seo?.canonicalPath === group.path);
      const contentJson = buildGroupContent(group, members, relatedGroup);
      if (existing && stable(existing.publishedJson) === stable(contentJson)) continue;
      pageOperations.push({
        id: existing?.id || `mydreamshoot_topic_group_${group.id}`,
        siteId: site.id,
        pageType: "standard-content",
        templateKey: "mydreamshoots-topic-group",
        slug: group.path,
        title: group.title,
        contentJson,
        create: !existing
      });
    }
    for (const [slug, contentJson] of updates) {
      const page = site.pages.find((candidate) => candidate.slug === slug);
      if (!page) throw new Error(`Link owner LivePage is missing: ${slug}`);
      if (stable(page.publishedJson) !== stable(contentJson)) {
        pageOperations.push({ id: page.id, siteId: site.id, pageType: page.pageType, templateKey: page.templateKey, slug: page.slug, title: page.title, contentJson, create: false });
      }
    }

    const summary = {
      ok: true,
      mode: apply ? "apply-local" : "plan-local",
      siteId: site.id,
      currentSitemapPages: currentSitemapPaths.size,
      eligibleImageLeaves: imageRoutes.length,
      eligibleVideoLeaves: videoRoutes.length,
      eligibleStandardLeaves: standardRoutes.length,
      topicGroupPages: groupData.map(({ group, members }) => ({ path: group.path, label: group.label, children: members.length, sampleChildren: members.slice(0, 4).map(({ path: href }) => href) })),
      operations: pageOperations.map(summarizeOperation)
    };

    if (apply) {
      await db.$transaction(async (tx) => {
        for (const operation of pageOperations) {
          await tx.livePage.upsert({
            where: { siteId_slug: { siteId: operation.siteId, slug: operation.slug } },
            create: { id: operation.id, siteId: operation.siteId, pageType: operation.pageType, templateKey: operation.templateKey, slug: operation.slug, title: operation.title, contentJson: operation.contentJson },
            update: { pageType: operation.pageType, templateKey: operation.templateKey, title: operation.title, contentJson: operation.contentJson }
          });
        }
      }, { timeout: 60000, maxWait: 10000 });
    }
    console.log(JSON.stringify(summary, null, 2));
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
