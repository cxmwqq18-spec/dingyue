#!/usr/bin/env node
import assert from "node:assert/strict";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const state = await readPlatformStateFromSql();
const site = state.sites.find((candidate) => candidate.id === "site_dreamshoot");
assert(site, "missing_mydreamshoots_site");

const snapshot = site.activePublication?.snapshot;
assert(snapshot, "missing_active_publication_snapshot");
const saveTheDateShowcases = (snapshot.publishedHomepageShowcases ?? [])
  .filter((item) => item.kind === "save_the_date" && item.status === "published" && item.indexable && item.sitemapEligible);
assert.equal(new Set(saveTheDateShowcases.map((item) => item.canonicalPath)).size, saveTheDateShowcases.length, "Save the Date projection must not duplicate a theme route");

const videoTopics = snapshot.publishedVideoNavigation ?? [];
assert(videoTopics.length > 0, "AI Video must expose published topics");
const publishedVideoRoutes = (snapshot.publishedRoutes ?? []).filter((item) => item.disposition === "render" && item.status === "published" && item.routeKind === "ai-video-topic-leaf");
const publishedVideoPaths = new Set(publishedVideoRoutes.map((item) => item.canonicalPath));
const expectedVideoTopics = videoTopics.filter((item) => publishedVideoPaths.has(item.canonicalPath));
const expectedPublishedVideoPaths = new Set(publishedVideoRoutes.map((item) => item.canonicalPath));
assert.equal(expectedVideoTopics.length, expectedPublishedVideoPaths.size, "AI Video navigation count must derive from published routes");
assert.deepEqual(new Set(expectedVideoTopics.map((item) => item.canonicalPath)), expectedPublishedVideoPaths, "AI Video navigation and published route projection must agree");
assert.equal(new Set(expectedVideoTopics.map((item) => item.canonicalPath)).size, expectedVideoTopics.length, "AI Video must not duplicate a published topic route");
const publishedImageRoutes = (snapshot.publishedRoutes ?? []).filter((item) => item.disposition === "render" && item.status === "published" && item.routeKind === "ai-image-theme-leaf");
const imageMediaByPage = new Map((snapshot.publishedPageMedia ?? []).map((item) => [item.pageEntityId, item]));
const imagePackIds = new Set(publishedImageRoutes.map((route) => imageMediaByPage.get(route.pageEntityId)?.packId).filter(Boolean));
assert.equal(imagePackIds.size, publishedImageRoutes.length, "AI Image published themes must map one-to-one to media packs");
const videoCounts = Object.fromEntries(
  Array.from(expectedVideoTopics.reduce((counts, item) => {
    const key = String(item.parentLabel || item.parentSlug || "Uncategorized").trim() || "Uncategorized";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map()).entries())
);
const saveTheDateCounts = Object.fromEntries(
  Array.from(saveTheDateShowcases.reduce((counts, item) => {
    const key = item.category || "Uncategorized";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map()).entries())
);

assert.equal(new Set(expectedVideoTopics.map((item) => item.canonicalPath)).size, expectedVideoTopics.length, "AI Video must not duplicate a published topic route");
assert.equal(Object.values(videoCounts).reduce((sum, count) => sum + count, 0), expectedVideoTopics.length, "AI Video category counts must add up to the rendered cards");
assert.equal(new Set(saveTheDateShowcases.map((item) => item.id)).size, saveTheDateShowcases.length, "Save the Date must not duplicate a published showcase");
assert.equal(Object.values(saveTheDateCounts).reduce((sum, count) => sum + count, 0), saveTheDateShowcases.length, "Save the Date category counts must add up to the rendered cards");

console.log(JSON.stringify({
  publicationId: site.activePublication?.id,
  publicationVersion: site.activePublication?.version,
  snapshotHash: snapshot.snapshotHash,
  aiVideo: { total: expectedVideoTopics.length, categories: videoCounts },
  aiImage: { total: publishedImageRoutes.length, mediaPacks: imagePackIds.size },
  saveTheDate: { total: saveTheDateShowcases.length, categories: saveTheDateCounts }
}, null, 2));
