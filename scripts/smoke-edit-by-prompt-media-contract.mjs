#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
const taxonomy = readJson("src/lib/mydreamshoots-theme-taxonomy.json");
const packProfiles = readJson("src/lib/dreamshoot-pack-profiles.json");
const item = taxonomy.items.find((candidate) => candidate.slug === "edit-by-prompt");
const profile = packProfiles["edit-by-prompt"];
const expectedPackId = "pack_dreamshoot_edit_by_prompt";

assert.ok(item, "Edit By Prompt taxonomy item must exist");
assert.equal(item.sourceCategorySlug, "edit-by-prompt");
assert.equal(item.reusePackId, expectedPackId);
assert.ok(profile, "Edit By Prompt operational profile must exist");
assert.equal(profile.packId, expectedPackId);
assert.equal(profile.toolRef, `/app/create?pack_id=${expectedPackId}`);
assert.equal(profile.mediaRef, expectedPackId);

const mediaRoot = path.join(repoRoot, "public/assets/dreamshoot/generated");
const coverPath = path.join(mediaRoot, "pack-covers/edit-by-prompt/edit-by-prompt-cover.webp");
const galleryRoot = path.join(mediaRoot, "pack-galleries/edit-by-prompt");
const galleryFiles = fs.existsSync(galleryRoot)
  ? fs.readdirSync(galleryRoot).filter((file) => /^edit-by-prompt-\d{2}\.webp$/.test(file)).sort()
  : [];
const independentMediaReady = fs.existsSync(coverPath) && galleryFiles.length === 12;
if (independentMediaReady) {
  assert.equal(new Set(galleryFiles).size, 12, "Edit By Prompt gallery filenames must be unique");
} else {
  console.warn("Edit By Prompt independent media is not installed; route must remain review_required/noindex and excluded from sitemap.");
}

const syncSource = fs.readFileSync(path.join(repoRoot, "scripts/sync-mydreamshoots-theme-taxonomy.mjs"), "utf8");
assert.match(syncSource, /item\.slug === "edit-by-prompt"/);
assert.match(syncSource, /pack_dreamshoot_edit_by_prompt/);
assert.match(syncSource, /edit-by-prompt.*slugOwnedMediaThemes|slugOwnedMediaThemes.*edit-by-prompt/s);

const altSource = fs.readFileSync(path.join(repoRoot, "src/lib/storefront-media-alt.ts"), "utf8");
assert.doesNotMatch(altSource, /edit-by-prompt[\\s\\S]{0,180}Social profile portrait/);
assert.match(altSource, /AI photo edit preview/);

const generatorSource = fs.readFileSync(path.join(repoRoot, "scripts/generate-mydreamshoots-theme-galleries.mjs"), "utf8");
assert.match(generatorSource, /"edit-by-prompt":\s*"prompt-directed photo editing previews/);
assert.match(generatorSource, /maxPaidCreates/);

console.log(JSON.stringify({
  ok: true,
  expectedPackId,
  independentMediaReady,
  galleryCount: galleryFiles.length,
  routePolicy: independentMediaReady ? "eligible-for-full-contract-check" : "review_required-noindex-sitemap-excluded"
}, null, 2));
