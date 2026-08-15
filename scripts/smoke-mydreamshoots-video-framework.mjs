import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const state = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "platform-state.json"), "utf8"));
const targetSiteIds = ["site_dreamshoot", "site_grownstride_test"];
const expectedCategories = [
  ["text-to-video", "Text to video", 10],
  ["image-to-video", "Image to Video", 20]
];

function fail(message, details) {
  console.error(`myDreamShoots video framework smoke failed: ${message}`);
  if (details) console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

function assert(condition, message, details) {
  if (!condition) fail(message, details);
}

for (const siteId of targetSiteIds) {
  const toolCategories = (state.toolCategories ?? []).filter((row) => row.siteId === siteId);
  const toolMenuItems = (state.toolMenuItems ?? []).filter((row) => row.siteId === siteId);
  const videoThemes = (state.videoThemes ?? []).filter((row) => row.siteId === siteId);
  const videoCategories = (state.videoThemeCategories ?? [])
    .filter((row) => row.siteId === siteId && row.status === "active")
    .sort((left, right) => left.sortOrder - right.sortOrder);
  assert(toolCategories.length === 0, `${siteId} should have no legacy tool categories`, { count: toolCategories.length });
  assert(toolMenuItems.length === 0, `${siteId} should have no legacy tool menu items`, { count: toolMenuItems.length });
  assert(videoThemes.length === 0, `${siteId} should start with no video themes`, { count: videoThemes.length });
  assert(videoCategories.length === expectedCategories.length, `${siteId} should have exactly two video categories`, { categories: videoCategories });
  assert(
    JSON.stringify(videoCategories.map((row) => [row.slug, row.label, row.sortOrder])) === JSON.stringify(expectedCategories),
    `${siteId} video categories do not match the framework`,
    { categories: videoCategories }
  );
}

for (const siteId of ["site_aidreamcapes", "site_aidreamcapes_xby", "site_mydreamshoots_xby"]) {
  const toolCount = (state.toolMenuItems ?? []).filter((row) => row.siteId === siteId).length;
  assert(toolCount > 0, `${siteId} should remain outside the MyDreamShoots reset`, { toolCount });
}

console.log(JSON.stringify({
  ok: true,
  targetSites: targetSiteIds,
  categories: expectedCategories.map(([slug, label]) => ({ slug, label })),
  legacyTools: 0,
  videoThemes: 0
}, null, 2));
