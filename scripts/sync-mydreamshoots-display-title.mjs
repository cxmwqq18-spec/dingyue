#!/usr/bin/env node
import { readPlatformStateFromSql, writePlatformStateToSql } from "./lib/platform-state-sql.mjs";

const state = await readPlatformStateFromSql();

const SITE_ID = "site_dreamshoot";
const SITE_SLUG = "mydreamshoots";
const DISPLAY_TITLE = "myᕲreamshoots";
const SEO_TITLE = "MyDreamShoots";
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

for (const settings of [site.themeSettings?.draftJson].filter(Boolean)) {
  setString(settings.globalSections?.header?.settings, "title", DISPLAY_TITLE);
  setString(settings.globalSections?.footer?.settings, "title", DISPLAY_TITLE);
  if (settings.seo) {
    setString(settings.seo, "siteTitle", SEO_TITLE);
    setString(settings.seo, "titleTemplate", `%s | ${SEO_TITLE}`);
  }
}

for (const page of state.themePages ?? []) {
  if (page.siteId !== site.id) continue;
  for (const pageJson of [page.draftJson].filter(Boolean)) {
    if (pageJson.seo?.title) {
      const nextTitle = pageJson.seo.title.replace(/myᕲreamshoots/g, SEO_TITLE);
      setString(pageJson.seo, "title", nextTitle);
    }
  }
}

await writePlatformStateToSql(state);
console.log(`Synced MyDreamShoots display title: ${changeCount} field(s) updated.`);
