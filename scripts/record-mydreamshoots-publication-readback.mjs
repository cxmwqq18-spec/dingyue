#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const state = await readPlatformStateFromSql();
const site = state.sites.find((candidate) => candidate.id === "site_dreamshoot");
if (!site) throw new Error("missing_active_mydreamshoots_site");

const prisma = new PrismaClient();
const currentStateRow = await prisma.sitePublishedState.findUnique({ where: { siteId: site.id } });
await prisma.$disconnect();
if (!currentStateRow?.payload) throw new Error("missing_current_mydreamshoots_published_state");

const snapshot = currentStateRow.payload;
const saveTheDate = (snapshot.publishedHomepageShowcases ?? []).filter((item) => item.kind === "save_the_date" && item.status === "published" && item.indexable && item.sitemapEligible);
const video = snapshot.publishedVideoNavigation ?? [];
const blogSlugs = ["/blog/anime-avatar-photo-package-guide", "/blog/profile-cards-photo-package-guide"];
const blog = blogSlugs.map((slug) => {
  const page = site.pages.find((candidate) => candidate.slug === slug);
  const article = page?.publishedJson?.sections?.blog_detail_1;
  const settings = article?.settings ?? {};
  const title = typeof settings.title === "string" ? settings.title : page?.title ?? "";
  const summary = typeof settings.summary === "string" ? settings.summary : page?.publishedJson?.seo?.description ?? "";
  const contentId = typeof page?.publishedJson?.contentId === "string"
    ? page.publishedJson.contentId
    : typeof settings.contentId === "string" ? settings.contentId : null;
  return { slug, pageId: page?.id ?? null, contentId, canonicalPath: page?.publishedJson?.seo?.canonicalPath ?? null, title, summary };
});

const fingerprint = (value) => crypto.createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 20);
const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : (!value || typeof value !== "object" ? value : Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item)])));
const currentPayloadHash = crypto.createHash("sha256").update(JSON.stringify(stable(snapshot))).digest("hex");
const expectedRevision = crypto.createHash("sha256").update(`${site.id}:${currentPayloadHash}`).digest("hex").slice(0, 24);
const baseUrl = (process.env.READBACK_BASE_URL?.trim() || "http://localhost:3002").replace(/\/$/, "");
const publicHost = site.primaryDomain || "www.mydreamshoots.com";
async function readHttp(pathname, { host = publicHost, parseHtml = false, parseText = false } = {}) {
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      headers: { Host: host, "x-forwarded-host": host },
      redirect: "manual"
    });
    const body = parseHtml || parseText ? await response.text() : undefined;
    const htmlMeta = (name, attribute = "property") => {
      if (!body) return null;
      const match = body.match(new RegExp(`<meta[^>]+${attribute}=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"));
      return match?.[1] ?? null;
    };
    const canonical = body?.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i)?.[1] ?? null;
    return {
      status: response.status,
      location: response.headers.get("location"),
      finalUrl: response.url,
      contentType: response.headers.get("content-type"),
      ...(parseHtml ? {
        canonical,
        robots: htmlMeta("robots", "name"),
        ogImage: htmlMeta("og:image"),
        twitterImage: htmlMeta("twitter:image"),
        bodySha: fingerprint(body)
      } : parseText ? { bodySha: fingerprint(body), containsWorkspace: /(?:^|["'/>])\/workspace(?:["'<#?]|$)/i.test(body || "") } : {})
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

const http = {
  workspace: await readHttp("/workspace"),
  appCreate: await readHttp("/app/create"),
  aiImage: await readHttp("/ai-image-generation", { parseHtml: true }),
  blog: Object.fromEntries(await Promise.all(blogSlugs.map(async (slug) => [slug, await readHttp(slug, { parseHtml: true })]))),
  sitemap: await readHttp("/sitemap.xml", { parseText: true })
};
const output = process.env.READBACK_OUTPUT?.trim() || path.join("releases", "manifests", `mydreamshoots-readback-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
const evidence = {
  recordedAt: new Date().toISOString(),
  siteId: site.id,
  publicDomain: site.primaryDomain,
  publication: {
    id: `current-state:${site.id}`,
    version: null,
    snapshotHash: snapshot.snapshotHash ?? null,
    buildId: snapshot.buildId,
    publicationRevision: currentStateRow.revision,
    contentHash: currentStateRow.contentHash,
    computedContentHash: currentPayloadHash,
    hashValid: currentStateRow.contentHash === currentPayloadHash,
    revisionValid: currentStateRow.revision === expectedRevision
  },
  routes: {
    workspace: { expectedStatus: 301, expectedLocation: "/app/create", http: http.workspace },
    appCreate: { expectedUnauthenticatedStatus: 307, http: http.appCreate },
    aiImage: { path: "/ai-image-generation", pageEntityIds: (snapshot.publishedRoutes ?? []).filter((route) => route.canonicalPath === "/ai-image-generation").map((route) => route.pageEntityId) },
    blog: blog.map((item) => ({ ...item, titleFingerprint: fingerprint(item.title), summaryFingerprint: fingerprint(item.summary), http: http.blog[item.slug] }))
  },
  socialImage: {
    approvedPublicationUrl: snapshot.publishedStandardPageMedia?.find((item) => item.canonicalPath === "/ai-image-generation")?.ogImage ?? null,
    ssr: http.aiImage
  },
  sitemap: { http: http.sitemap, workspaceExcluded: http.sitemap.containsWorkspace === false },
  saveTheDate: saveTheDate.map((item) => ({ slug: item.canonicalPath.split("/").at(-1), canonicalPath: item.canonicalPath, pageEntityId: item.pageEntityId, mediaUrl: item.imageUrl, mediaFingerprint: fingerprint(item.imageUrl), descriptionFingerprint: fingerprint(item.subtitle), altFingerprint: fingerprint(item.imageAlt) })),
  counts: {
    aiVideo: { total: video.length, categories: video.reduce((result, item) => { const key = item.parentLabel || item.parentSlug || "Uncategorized"; result[key] = (result[key] ?? 0) + 1; return result; }, {}) },
    saveTheDate: { total: saveTheDate.length, categories: saveTheDate.reduce((result, item) => { const key = item.category || "Uncategorized"; result[key] = (result[key] ?? 0) + 1; return result; }, {}) }
  }
};

const expectedVideoCategories = { "Core AI Creation": 3, "Social & Creator": 6, "Marketing & Commerce": 6, "Creative & Lifestyle": 4, "Professional": 2 };
const expectedSaveTheDateCategories = { "Love & Wedding": 5, "Seasonal Holidays": 6 };
const normalizedVideoCategories = Object.fromEntries(Object.entries(evidence.counts.aiVideo.categories).map(([key, value]) => [key.toLowerCase().includes("professional") ? "Professional" : key, value]));
const sameCounts = (actual, expected) => JSON.stringify(Object.fromEntries(Object.entries(actual).sort())) === JSON.stringify(Object.fromEntries(Object.entries(expected).sort()));
evidence.acceptance = {
  currentStateHash: evidence.publication.hashValid,
  currentStateRevision: evidence.publication.revisionValid,
  workspace301: http.workspace.status === 301 && http.workspace.location?.endsWith("/app/create") === true,
  appCreateAuth: http.appCreate.status === 307 && (http.appCreate.location || "").startsWith("/login?next="),
  aiImageSocialMetadata: Boolean(evidence.socialImage.approvedPublicationUrl && http.aiImage.ogImage === evidence.socialImage.approvedPublicationUrl && http.aiImage.twitterImage === evidence.socialImage.approvedPublicationUrl),
  sitemapWorkspaceExcluded: evidence.sitemap.workspaceExcluded,
  aiVideoCounts: evidence.counts.aiVideo.total === 21 && sameCounts(normalizedVideoCategories, expectedVideoCategories),
  saveTheDateCounts: evidence.counts.saveTheDate.total === 11 && sameCounts(evidence.counts.saveTheDate.categories, expectedSaveTheDateCategories)
};
const acceptancePassed = Object.values(evidence.acceptance).every(Boolean);

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ ok: acceptancePassed, output, publication: evidence.publication, acceptance: evidence.acceptance, counts: evidence.counts }, null, 2));
if (!acceptancePassed) process.exitCode = 1;
