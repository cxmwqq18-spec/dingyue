#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const output = process.env.SEASONAL_BUILD_OUTPUT || "/tmp/seasonal-remediation.json";
execFileSync(process.execPath, ["scripts/sync-seasonal-theme-pages.mjs"], { env: { ...process.env, SEASONAL_BUILD_ONLY: "1", SEASONAL_BUILD_OUTPUT: output }, stdio: "inherit" });
const build = JSON.parse(fs.readFileSync(output, "utf8"));
const expected = {
  "mothers-day": {
    path: "/holidays-events/mothers-day", hero: "hero-ai-mothers-day-family-breakfast.jpg", sceneCount: 11, faq: 8,
    title: "AI Mother's Day Photo & Video Generator | Family Content"
  },
  "fathers-day": {
    path: "/holidays-events/fathers-day", hero: "hero-ai-fathers-day-family-portrait.jpg", sceneCount: 9, faq: 6,
    title: "AI Father's Day Photo & Video Maker | Family Visuals"
  }
};
for (const page of build.pages.filter((item) => expected[item.key])) {
  const contract = expected[page.key];
  const json = page.pageJson;
  assert.equal(page.pagePath, contract.path);
  assert.equal(json.seo.title, contract.title);
  assert(json.seo.title.length <= 60, `${page.key}: title exceeds 60 characters`);
  assert(json.seo.description.length >= 120 && json.seo.description.length <= 160, `${page.key}: meta description length`);
  assert.equal(json.seo.robots.maxImagePreview, "large");
  assert.equal(json.seo.index, true);
  assert.equal(json.seo.follow, true);
  const sections = json.sections;
  const hero = sections[json.sectionsOrder[0]];
  assert.equal(hero.blocks.length, 1, `${page.key}: hero must be single image`);
  assert(hero.settings.imageUrl.endsWith(contract.hero), `${page.key}: hero mapping`);
  const scene = sections[`${json.contentContract.pageKey}_scene_ideas`];
  assert.equal(scene.blocks.length, contract.sceneCount, `${page.key}: scene count`);
  assert(scene.blocks.every((block) => block.settings.imageUrl && block.settings.imageAlt), `${page.key}: scene media metadata`);
  const faq = sections[`${json.contentContract.pageKey}_faq`];
  assert.equal(faq.blocks.length, contract.faq, `${page.key}: faq count`);
  assert(faq.blocks.every((block) => block.settings.question && block.settings.answer), `${page.key}: faq fields`);
  if (page.key === "mothers-day") {
    assert.equal(sections.mothers_day_quality.blocks.length, 2);
    assert.deepEqual(sections.mothers_day_quality.blocks.map((block) => block.settings.items.length), [4, 4]);
    assert.equal(sections.mothers_day_workflow.blocks.length, 6);
    assert(sections.mothers_day_formats.settings.imageUrl.endsWith("ai-mothers-day-spring-walk.jpg"));
    assert(sections.mothers_day_family_match.settings.imageUrl.endsWith("ai-mothers-day-pet-portrait.jpg"));
  } else {
    assert.equal(sections.fathers_day_definition.blocks.length, 6);
    assert.equal(sections.fathers_day_quality.blocks.length, 4);
    assert.equal(sections.fathers_day_workflow.blocks.length, 8);
    assert.equal(sections.fathers_day_use_cases.blocks.length, 4);
    assert(sections.fathers_day_gallery.blocks[0].settings.imageUrl.endsWith("ai-fathers-day-family-dinner-toast.jpg"));
  }
}
assert.equal(build.pages.filter((page) => expected[page.key]).length, 2);
console.log(JSON.stringify({ ok: true, pages: Object.keys(expected) }, null, 2));
