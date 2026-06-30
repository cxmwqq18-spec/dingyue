import fs from "fs/promises";
import path from "path";

const workspaceRoot = process.cwd();
const statePath = path.join(workspaceRoot, "data", "platform-state.json");
const state = JSON.parse(await fs.readFile(statePath, "utf8"));

const aidreamcapesSite = (state.sites ?? []).find((site) => site.id === "site_aidreamcapes" || site.slug === "aidreamcapes");
const mydreamshootsSite = (state.sites ?? []).find((site) => site.id === "site_dreamshoot" || site.slug === "mydreamshoots");
if (!aidreamcapesSite) throw new Error("missing_site_aidreamcapes");

const forbiddenPatterns = [
  /MydreamShoots/i,
  /mydreamshoots/i,
  /support@mydreamshoots\.com/i,
  /World Cup/i,
  /cyberpunk/i,
  /background changer/i,
  /background-changer/i,
  /mafia/i,
  /noir/i,
  /gala photo/i,
  /free AI tools/i,
  /\/tools\/headshot/i,
  /\/tools\/world-cup-fan-photos/i,
  /\/tools\/cyberpunk-portrait/i,
  /\/tools\/background-changer/i,
  /\/tools\/gala-photo/i,
  /\/tools\/noir-portrait/i
];

const allowedAidreamcapesRoutes = new Set([
  "/",
  "/pricing",
  "/collections",
  "/tools",
  "/tools/portrait-generator",
  "/tools/portrait-maker",
  "/tools/headshot",
  "/tools/route-portrait-engine",
  "/tools/coastal-portrait",
  "/tools/island-resort-scenes",
  "/tools/scenic-overlook-story",
  "/tools/golden-hour-route-story",
  "/tools/celestial-profile-story",
  "/tools/travel-profile-story",
  "/tools/editorial-getaway",
  "/tools/cafe-street-story",
  "/tools/cinematic-travel",
  "/tools/route-moodboard",
  "/tools/social-keepsake",
  "/tools/lagoon-portrait-mixer",
  "/tools/desert-road-portraits",
  "/tools/rail-journey-frames",
  "/tools/market-morning-portraits",
  "/tools/rooftop-skyline-set",
  "/tools/rainy-city-album",
  "/tools/private-villa-portraits",
  "/tools/wellness-retreat-scenes",
  "/tools/snow-lodge-portraits",
  "/tools/lake-house-weekend",
  "/tools/shared-route-album",
  "/tools/family-travel-keepsakes",
  "/tools/honeymoon-itinerary-portraits",
  "/tools/solo-traveler-profile-set",
  "/tools/travel-journal-cover-maker",
  "/tools/private-album-curator",
  "/collections/coastal-light-sets",
  "/collections/golden-hour-route-stories",
  "/collections/celestial-profile-stories",
  "/collections/editorial-getaways",
  "/collections/cafe-corner-stories",
  "/collections/cinematic-travel",
  "/collections/route-moodboard",
  "/collections/social-keepsakes",
  "/collections/route-portrait-albums",
  "/collections/coastal-getaways",
  "/collections/old-city-walks",
  "/collections/island-resort-scenes",
  "/collections/cafe-street-stories",
  "/collections/scenic-overlooks",
  "/collections/mountain-trails",
  "/collections/road-trip-frames",
  "/collections/itinerary-moodboards",
  "/collections/postcard-social-sets",
  "/help",
  "/about-us",
  "/contact-us",
  "/blog",
  "/blog/planning-dreamscape-source-photos",
  "/search",
  "/cart",
  "/login",
  "/account",
  "/app",
  "/app/jobs/progress",
  "/app/jobs/detail",
  "/privacy",
  "/terms",
  "/refunds",
  "/content",
  "/cookies",
  "/policies/privacy",
  "/policies/shipping",
  "/policies/refunds",
  "/policies/terms",
  "/policies/content",
  "/policies/cookies",
  "/tools/destination-portrait-engine",
  "/tools/soft-glam",
  "/tools/product-reverie",
  "/tools/couple-escape-album",
  "/collections/destination-portrait-albums"
]);

function stableStringify(value) {
  return JSON.stringify(value, null, 2);
}

function collectText(value, out = []) {
  if (typeof value === "string") {
    const trimmed = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (trimmed) out.push(trimmed);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) collectText(entry, out);
  }
  return out;
}

function visibleStringsForSite(site) {
  const parts = [
    site.name,
    site.primaryDomain,
    site.branding,
    site.themeSettings?.publishedJson,
    ...(site.pages ?? []).map((page) => page.publishedJson)
  ];
  const sitePacks = (state.creativePacks ?? []).filter((pack) => pack.siteId === site.id);
  const siteCategories = (state.creativePackCategories ?? []).filter((category) => category.siteId === site.id);
  const siteToolCategories = (state.toolCategories ?? []).filter((category) => category.siteId === site.id);
  const siteToolMenuItems = (state.toolMenuItems ?? []).filter((item) => item.siteId === site.id);
  parts.push(sitePacks, siteCategories, siteToolCategories, siteToolMenuItems);
  return collectText(parts)
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter((text) => text.length >= 12)
    .filter((text) => !text.startsWith("/assets/"))
    .filter((text) => !text.startsWith("@font-face"))
    .filter((text) => !text.includes("var(--font"))
    .filter((text) => !text.includes("linear-gradient("))
    .filter((text) => !/^[a-z0-9_:-]+$/.test(text))
    .filter((text) => !/^#[0-9a-f]{3,8}$/i.test(text));
}

function normalizeForDupes(text) {
  return text
    .toLowerCase()
    .replace(/aidreamcapes|mydreamshoots|dreamshootai|dreamshoot/g, "{brand}")
    .replace(/www\.aidreamcapes\.com|aidreamcapes\.com|www\.mydreamshoots\.com|mydreamshoots\.com/g, "{domain}")
    .replace(/[^a-z0-9{} ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHrefs(value, out = []) {
  if (typeof value === "string") {
    const hrefMatches = value.matchAll(/href=["']([^"']+)["']/g);
    for (const match of hrefMatches) out.push(match[1]);
    if (/^\/(tools|collections|blog|help|pricing|policies|cart|login|account|app|search)(\/|$|\?)/.test(value)) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) extractHrefs(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (key === "href" && typeof entry === "string") out.push(entry);
      extractHrefs(entry, out);
    }
  }
  return out;
}

const failures = [];
const aidreamcapesJson = stableStringify({
  site: aidreamcapesSite,
  packs: (state.creativePacks ?? []).filter((pack) => pack.siteId === aidreamcapesSite.id),
  categories: (state.creativePackCategories ?? []).filter((category) => category.siteId === aidreamcapesSite.id),
  toolCategories: (state.toolCategories ?? []).filter((category) => category.siteId === aidreamcapesSite.id),
  toolMenuItems: (state.toolMenuItems ?? []).filter((item) => item.siteId === aidreamcapesSite.id)
});

for (const pattern of forbiddenPatterns) {
  if (pattern.test(aidreamcapesJson)) failures.push(`forbidden_content:${pattern}`);
}

const hrefs = [...new Set(extractHrefs(aidreamcapesSite).map((href) => href.split("#")[0].split("?")[0]).filter((href) => href.startsWith("/")))];
for (const href of hrefs) {
  if (!allowedAidreamcapesRoutes.has(href)) {
    failures.push(`unexpected_internal_link:${href}`);
  }
}

if (mydreamshootsSite) {
  const mydreamText = new Set(visibleStringsForSite(mydreamshootsSite).map(normalizeForDupes).filter((text) => text.length >= 24));
  const duplicates = visibleStringsForSite(aidreamcapesSite)
    .map((text) => ({ raw: text, normalized: normalizeForDupes(text) }))
    .filter((item) => item.normalized.length >= 24 && mydreamText.has(item.normalized))
    .filter((item) => !/privacy|terms|cookie|refund|credits|checkout|account|gallery|upload|download|subscription|source photos|all rights reserved|plans start|customers|private|secure|help center|pricing|company address|mailing address|business correspondence|8 THE GREEN|contact .*support|support or sales/i.test(item.raw))
    .slice(0, 30);
  if (duplicates.length) {
    failures.push(`visible_copy_duplicates:${duplicates.map((item) => item.raw).join(" || ")}`);
  }
}

if (failures.length) {
  console.error("Aidreamcapes brand/link smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Aidreamcapes brand/link smoke passed. Checked ${hrefs.length} internal links and ${visibleStringsForSite(aidreamcapesSite).length} text strings.`);
