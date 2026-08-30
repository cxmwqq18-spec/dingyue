#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import createJiti from "jiti";

const siteId = "site_dreamshoot";
const jiti = createJiti(import.meta.url);
const {
  mydreamshootsVideoGenerationCategoriesForSite,
  mydreamshootsVideoGenerationParentCategoriesForSite,
  mydreamshootsVideoGenerationThemeSeedsForSite,
  parentVideoGenerationCategorySlugForChild
} = jiti("../src/lib/mydreamshoots-video-framework.ts");
const { validateVideoPrompt, videoThemePromptForEditor } = jiti("../src/lib/video-prompt-format.ts");

const expectedLove = ["valentines-day", "engagement", "proposal", "save-the-date", "wedding-invitation", "wedding-ceremony"];
const expectedSeasonal = ["christmas", "halloween", "thanksgiving", "new-year", "mothers-day", "fathers-day"];
const categories = mydreamshootsVideoGenerationCategoriesForSite(siteId);
const parents = mydreamshootsVideoGenerationParentCategoriesForSite(siteId);
const themes = mydreamshootsVideoGenerationThemeSeedsForSite(siteId);
const saveRoot = parents.find((category) => category.slug === "save-the-date");
const love = categories.find((category) => category.slug === "love-wedding");
const seasonal = categories.find((category) => category.slug === "seasonal-holidays");

assert.ok(saveRoot, "Save the Date root category is missing");
assert.ok(love, "Love & Wedding category is missing");
assert.ok(seasonal, "Seasonal Holidays category is missing");
assert.equal(parentVideoGenerationCategorySlugForChild(love.slug), saveRoot.slug);
assert.equal(parentVideoGenerationCategorySlugForChild(seasonal.slug), saveRoot.slug);

const saveThemes = themes.filter((theme) => expectedLove.includes(theme.slug) || expectedSeasonal.includes(theme.slug));
assert.equal(saveThemes.length, 12, "Save the Date must have exactly 12 leaf themes");
assert.equal(new Set(saveThemes.map((theme) => theme.slug)).size, 12, "Save the Date theme slugs must be unique");
for (const theme of saveThemes) {
  assert.equal(theme.categorySlug, expectedLove.includes(theme.slug) ? love.slug : seasonal.slug, `${theme.slug} has the wrong category`);
  assert.equal(theme.durationSeconds, 15, `${theme.slug} must default to 15 seconds`);
  assert.match(theme.prompt, /15 seconds/i, `${theme.slug} prompt must describe 15 seconds`);
  const validation = validateVideoPrompt(theme.prompt);
  assert.equal(validation.valid, true, `${theme.slug}: ${validation.errors.join("; ")}`);
  assert.equal(Object.keys(validation.sections).length, 10, `${theme.slug} must contain all 10 prompt sections`);
  assert.ok(theme.imageUrl, `${theme.slug} must use a cover image`);
  assert.ok(fs.existsSync(path.join(process.cwd(), "public", theme.imageUrl)), `${theme.slug} cover image is missing: ${theme.imageUrl}`);
}

for (const theme of themes) {
  const validation = validateVideoPrompt(theme.prompt);
  assert.equal(validation.valid, true, `${theme.slug}: ${validation.errors.join("; ")}`);
  assert.match(theme.prompt, /15 seconds/i, `${theme.slug} prompt must default to 15 seconds`);
  assert.ok(theme.prompt.length < 3200, `${theme.slug} provider prompt should stay concise while retaining cover-specific people, objects, dialogue, and direction`);
  const editorPrompt = videoThemePromptForEditor(theme.prompt);
  assert.equal(editorPrompt.split("\n").length, 6, `${theme.slug} editor prompt should expose six focused fields`);
  assert.ok(editorPrompt.length < 1800, `${theme.slug} editor prompt should stay focused while carrying visible cover details`);
  assert.match(editorPrompt, /\[[^\]]+\]/, `${theme.slug} editor prompt should expose replaceable details`);
  assert.match(editorPrompt, /Action: .*\b0-\d+s/, `${theme.slug} editor prompt should expose concrete time beats`);
  assert.doesNotMatch(editorPrompt, /Duration \/ Aspect Ratio|Negative Constraints/i, `${theme.slug} editor prompt should hide output and safety boilerplate`);
}

const distinctScenes = new Set(themes.map((theme) => validateVideoPrompt(theme.prompt).sections["Scene / Environment"]));
assert.equal(distinctScenes.size, themes.length, "each current theme must have its own scene direction");

console.log(JSON.stringify({ ok: true, hierarchy: { roots: 1, groups: 2, themes: saveThemes.length }, validatedFrameworkThemes: themes.length }, null, 2));
