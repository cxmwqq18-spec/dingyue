#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const types = read("src/lib/types.ts");
const themeStore = read("src/lib/stores/theme-store.ts");
const renderer = read("src/components/theme-renderer.tsx");
const templates = read("src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");

assert.match(types, /publishedHomepageShowcases:\s*PublishedHomepageShowcaseItem\[\]/, "publication snapshot must expose homepage showcases");
assert.match(types, /homepageShowcaseRevision\?:\s*string/, "homepage showcase revision must be tracked");
assert.match(themeStore, /function buildHomepageShowcases/, "publication compiler must build homepage showcases");
assert.match(themeStore, /item\.status === "published"/, "Save the Date projection must gate on published status");
assert.match(themeStore, /publishedStandardPageMedia/, "Save the Date projection must require published media");
assert.match(renderer, /homepageShowcases/, "renderer must consume the publication projection");
assert.match(renderer, /Featured AI Video Generators/, "homepage must render the video-first heading");
assert.match(renderer, /AI Save the Date Videos/, "homepage must support the Save the Date module");
assert.match(renderer, /Featured AI Photo Generators/, "homepage must retain the photo module");
const homeShowcaseTemplate = templates.match(/generation_showcase_1:[\s\S]*?\n  \),\n  flow_bridge_1:/)?.[0] ?? "";
assert.ok(homeShowcaseTemplate, "homepage showcase template must be present");
assert.doesNotMatch(homeShowcaseTemplate, /imageSlugs\s*:/, "homepage template must not persist static image slugs");
assert.doesNotMatch(homeShowcaseTemplate, /videoSlugs\s*:/, "homepage template must not persist static video slugs");

const statePath = path.join(root, "data/platform-state.json");
if (fs.existsSync(statePath)) {
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const publications = (state.themePublications ?? []).filter((item) => item.siteId === "site_dreamshoot");
  const latest = publications.sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0))[0];
  const rows = latest?.snapshot?.publishedHomepageShowcases;
  if (rows !== undefined) {
    assert.ok(Array.isArray(rows), "publishedHomepageShowcases must be an array");
    const ids = new Set();
    for (const item of rows) {
      assert.ok(["video", "save_the_date", "photo"].includes(item.kind), `unsupported showcase kind: ${item.kind}`);
      assert.ok(item.status === "published" && item.indexable === true && item.sitemapEligible === true, `unpublished showcase leaked: ${item.id}`);
      assert.ok(item.canonicalPath?.startsWith("/"), `showcase canonical must be a path: ${item.id}`);
      assert.ok(item.imageUrl && item.imageAlt, `showcase media metadata is incomplete: ${item.id}`);
      assert.ok(!ids.has(item.id), `duplicate showcase id: ${item.id}`);
      ids.add(item.id);
    }
    const kinds = rows.map((item) => item.kind);
    const firstPhoto = kinds.indexOf("photo");
    const firstSaveDate = kinds.indexOf("save_the_date");
    assert.ok(firstPhoto === -1 || firstSaveDate === -1 || firstSaveDate < firstPhoto, "Save the Date must precede photo showcases");
  }
}

console.log(JSON.stringify({ ok: true, check: "homepage-showcase-publication" }, null, 2));
