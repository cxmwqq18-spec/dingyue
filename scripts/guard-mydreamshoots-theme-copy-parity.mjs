#!/usr/bin/env node
import assert from "node:assert/strict";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const state = await readPlatformStateFromSql();
const site = state.sites.find((item) => item.id === "site_dreamshoot");
assert(site, "missing_site:site_dreamshoot");
const snapshot = site.activePublication?.snapshot;
assert(snapshot, "missing_active_publication_snapshot");
const sourceField = process.env.CHECK_DRAFT === "1" ? "draftJson" : "publishedJson";

const pagePaths = [
  "/ai-save-the-date/engagement", "/ai-save-the-date/proposal",
  "/ai-save-the-date/save-the-date", "/ai-save-the-date/wedding-ceremony",
  "/ai-save-the-date/christmas", "/ai-save-the-date/halloween",
  "/ai-save-the-date/thanksgiving", "/ai-save-the-date/new-year",
  "/ai-save-the-date/easter",
  "/ai-save-the-date/mothers-day", "/ai-save-the-date/fathers-day"
];
const forbidden = /SEO\s*(?:page|copy)|page should|search intent|primary keyword|indexation|evidence gate|supplied taxonomy|belongs on the .* page|commercial use terms included|current evidence/i;
const visibleKeys = new Set(["title", "intro", "support", "text", "question", "answer", "label", "caption", "description", "eyebrow", "primaryCta", "secondaryCta"]);
const collect = (value, key = "") => {
  if (!value || typeof value !== "object") return [];
  if (value.type === "editorial_evidence") return [];
  if (Array.isArray(value)) return value.flatMap((item) => collect(item, key));
  return Object.entries(value).flatMap(([childKey, child]) => {
    if (childKey === "seo" || childKey === "contentContract" || childKey === "mediaManifest" || childKey === "relatedLinks") return [];
    if (childKey === "type" && child === "editorial_evidence") return [];
    if (visibleKeys.has(childKey) && typeof child === "string") return [{ key: childKey, text: child }];
    return collect(child, childKey);
  });
};

const findings = [];
for (const path of pagePaths) {
  const page = site.pages.find((item) => item.slug === path);
  const pageJson = page?.[sourceField];
  if (!pageJson) continue;
  for (const record of collect(pageJson.sections)) {
    if (forbidden.test(record.text)) findings.push(`${path}:${record.key}:${record.text}`);
  }
}
assert.deepEqual(findings, [], `internal editorial terms leaked into customer copy: ${findings.join(" | ")}`);

const saveDate = pagePaths.map((path) => site.pages.find((item) => item.slug === path)).find((page) => page?.[sourceField]?.contentContract?.pageKey === "save_date");
assert(saveDate, "missing_save_date_page");
assert.equal(saveDate[sourceField].seo?.index, false, "Save the Date must remain noindex until evidence review passes");
assert.equal(saveDate[sourceField].seo?.robots?.index, false, "Save the Date robots index must remain false");

const anniversary = site.pages.find((item) => item.slug === "/holidays-events/wedding-anniversary" || item.slug === "/ai-save-the-date/wedding-anniversary");
if (anniversary?.[sourceField]) {
  assert.equal(anniversary[sourceField].seo?.index, false, "Wedding Anniversary must be noindex while no independent package exists");
  assert.notEqual(anniversary[sourceField].contentContract?.sourceRevision, "save-the-date-plan-20260824", "Wedding Anniversary cannot publish Save the Date source revision");
}

console.log(JSON.stringify({ ok: true, sourceField, checkedPages: pagePaths.filter((path) => site.pages.some((page) => page.slug === path)).length, saveDateNoindex: true, anniversaryIsolated: Boolean(anniversary) }, null, 2));
