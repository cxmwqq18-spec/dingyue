#!/usr/bin/env node
import fs from "node:fs";

const statePath = new URL("../data/platform-state.json", import.meta.url);
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

const SITE_ID = "site_dreamshoot";
const SITE_SLUG = "mydreamshoots";
const DISPLAY_TITLE = "ʍʏƉʀɛǟʍֆhoots";
let changeCount = 0;

function setString(target, key, value) {
  if (!target || typeof target !== "object") return;
  if (target[key] !== value) {
    target[key] = value;
    changeCount += 1;
  }
}

const site = state.sites?.find((item) => item.id === SITE_ID || item.slug === SITE_SLUG);
if (!site) throw new Error("MyDreamShoots site not found");

site.branding ??= {};
setString(site.branding, "logoText", DISPLAY_TITLE);

for (const settings of [site.themeSettings?.draftJson, site.themeSettings?.publishedJson].filter(Boolean)) {
  setString(settings.globalSections?.header?.settings, "title", DISPLAY_TITLE);
  setString(settings.globalSections?.footer?.settings, "title", DISPLAY_TITLE);
  if (settings.seo) {
    setString(settings.seo, "siteTitle", DISPLAY_TITLE);
    setString(settings.seo, "titleTemplate", `%s | ${DISPLAY_TITLE}`);
  }
}

for (const page of state.themePages ?? []) {
  if (page.siteId !== site.id) continue;
  for (const pageJson of [page.draftJson, page.publishedJson].filter(Boolean)) {
    if (pageJson.seo?.title) {
      const nextTitle = pageJson.seo.title.replace(/\bMyDreamShoots\b/g, DISPLAY_TITLE);
      setString(pageJson.seo, "title", nextTitle);
    }
  }
}

fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
console.log(`Synced MyDreamShoots display title: ${changeCount} field(s) updated.`);
