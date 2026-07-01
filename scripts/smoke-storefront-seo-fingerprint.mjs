import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data", "platform-state.json");
const jsonLdPath = path.join(repoRoot, "src", "lib", "theme", "json-ld.ts");

const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const failures = [];

const sites = [
  {
    id: "site_dreamshoot",
    label: "MyDreamShoots",
    brandPatterns: [/mydreamshoots/i, /dreamshootai/i, /dreamshoot/i, /mydreamshoots\.com/i],
    forbiddenPatterns: [/aidreamcapes/i, /aidreamcapes\.com/i, /site_aidreamcapes/i]
  },
  {
    id: "site_aidreamcapes",
    label: "Aidreamcapes",
    brandPatterns: [/aidreamcapes/i, /aidreamcapes\.com/i],
    forbiddenPatterns: [/mydreamshoots/i, /dreamshootai/i, /mydreamshoots\.com/i, /support@mydreamshoots\.com/i]
  }
];

const visibleTextKeys = new Set([
  "answer",
  "body",
  "caption",
  "description",
  "eyebrow",
  "headline",
  "heading",
  "label",
  "name",
  "question",
  "subheading",
  "subheadline",
  "subtitle",
  "text",
  "title"
]);

const titleKeys = ["headline", "heading", "title", "name", "question"];
const descriptionKeys = ["description", "subheadline", "subtitle", "text", "caption", "answer", "body"];

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForCompare(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/mydreamshoots|dreamshootai|dreamshoot|aidreamcapes/g, "{brand}")
    .replace(/www\.mydreamshoots\.com|mydreamshoots\.com|www\.aidreamcapes\.com|aidreamcapes\.com/g, "{domain}")
    .replace(/[^a-z0-9{} ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  const normalized = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!normalized) return new Set();
  return new Set(normalized.split(/\s+/).filter((token) => token.length > 1));
}

function jaccard(left, right) {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? intersection / union : 0;
}

function getSite(siteId) {
  const site = (state.sites ?? []).find((item) => item.id === siteId);
  if (!site) throw new Error(`missing_${siteId}`);
  return site;
}

function pageIdentity(page) {
  return `${page.slug || "(no slug)"}:${page.pageType || "(no pageType)"}`;
}

function extractSeoValue(seo, key) {
  if (!seo || typeof seo !== "object") return "";
  if (key === "title") return cleanText(seo.title ?? seo.seoTitle ?? seo.metaTitle);
  if (key === "description") return cleanText(seo.description ?? seo.seoDescription ?? seo.metaDescription);
  if (key === "keywords") return cleanText(Array.isArray(seo.keywords) ? seo.keywords.join(", ") : seo.keywords);
  return "";
}

function addSeoRecord(records, siteId, page, seo, source) {
  const title = extractSeoValue(seo, "title");
  const description = extractSeoValue(seo, "description");
  const keywords = extractSeoValue(seo, "keywords");
  if (!title && !description && !keywords) return;
  records.push({
    siteId,
    source,
    pageId: page.id,
    slug: page.slug || seo?.canonicalPath || seo?.canonical || "",
    pageType: page.pageType || seo?.pageType || "",
    title,
    description,
    keywords
  });
}

function pageJsonsForSite(siteId) {
  const site = getSite(siteId);
  const entries = [];

  for (const page of site.pages ?? []) {
    if (page.publishedJson) entries.push({ page, pageJson: page.publishedJson, source: `site.pages:${page.id}:publishedJson` });
    if (page.draftJson) entries.push({ page, pageJson: page.draftJson, source: `site.pages:${page.id}:draftJson` });
  }

  for (const publication of state.themePublications ?? []) {
    if (publication.siteId !== siteId) continue;
    for (const page of publication.snapshot?.pages ?? []) {
      const basePage = (site.pages ?? []).find((item) => item.id === page.id || item.slug === page.slug) ?? page;
      const mergedPage = {
        ...basePage,
        ...page,
        pageType: page.pageType ?? page.publishedJson?.pageType ?? basePage.pageType,
        slug: page.slug ?? basePage.slug
      };
      if (page.publishedJson) entries.push({ page: mergedPage, pageJson: page.publishedJson, source: `themePublications:${publication.id}:${page.id}` });
    }
  }

  return entries;
}

function publishedPageJsonsForSite(siteId) {
  const site = getSite(siteId);
  return (site.pages ?? [])
    .filter((page) => page.publishedJson)
    .map((page) => ({ page, pageJson: page.publishedJson, source: `site.pages:${page.id}:publishedJson` }));
}

function collectSeoRecords(siteId) {
  const site = getSite(siteId);
  const records = [];

  for (const { page, pageJson, source } of pageJsonsForSite(siteId)) {
    addSeoRecord(records, siteId, page, pageJson?.seo, `${source}:seo`);
  }

  const settingsSeo = site.themeSettings?.publishedJson?.seo;
  for (const page of site.pages ?? []) {
    const seo = settingsSeo?.pages?.[page.id] ?? settingsSeo?.pages?.[page.slug];
    addSeoRecord(records, siteId, page, seo, `themeSettings.publishedJson.seo:${page.id}`);
  }

  for (const theme of state.siteThemes ?? []) {
    if (theme.siteId !== siteId) continue;
    const themeSeo = theme.settings?.settings_data?.current?.seo ?? theme.settings?.seo;
    for (const page of site.pages ?? []) {
      const seo = themeSeo?.pages?.[page.id] ?? themeSeo?.pages?.[page.slug];
      addSeoRecord(records, siteId, page, seo, `siteThemes:${theme.id}:seo:${page.id}`);
    }
  }

  const grouped = new Map();
  for (const record of records) {
    const key = `${record.siteId}:${record.pageId}:${record.slug}:${record.pageType}:${record.title}:${record.description}:${record.keywords}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.source = `${existing.source}, ${record.source}`;
      continue;
    }
    grouped.set(key, { ...record });
  }
  return [...grouped.values()];
}

function splitVisibleText(value) {
  return cleanText(value)
    .split(/\s*\|\s*|\n+/)
    .map(cleanText)
    .filter(Boolean);
}

function addVisibleRecord(records, siteId, source, key, value) {
  for (const text of splitVisibleText(value)) {
    if (text.length < 3) continue;
    if (/^https?:\/\//i.test(text) || text.startsWith("/assets/")) continue;
    if (/^#[0-9a-f]{3,8}$/i.test(text) || text.includes("linear-gradient(")) continue;
    records.push({ siteId, source, key, text });
  }
}

function collectVisibleRecordsFromNode(records, siteId, source, value) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectVisibleRecordsFromNode(records, siteId, `${source}[${index}]`, item));
    return;
  }

  const settings = value.settings && typeof value.settings === "object" ? value.settings : value;
  for (const [key, entry] of Object.entries(settings)) {
    if (!visibleTextKeys.has(key) || typeof entry !== "string") continue;
    addVisibleRecord(records, siteId, source, key, entry);
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === "settings") continue;
    collectVisibleRecordsFromNode(records, siteId, `${source}.${key}`, entry);
  }
}

function collectTitleDescriptionPairs(siteId) {
  const pairs = [];
  const visit = (source, value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(`${source}[${index}]`, item));
      return;
    }

    const settings = value.settings && typeof value.settings === "object" ? value.settings : value;
    const title = titleKeys.map((key) => cleanText(settings[key])).find(Boolean) ?? "";
    const description = descriptionKeys.map((key) => cleanText(settings[key])).find(Boolean) ?? "";
    if (title && description) pairs.push({ siteId, source, title, description });

    for (const [key, entry] of Object.entries(value)) {
      if (key === "settings") continue;
      visit(`${source}.${key}`, entry);
    }
  };

  for (const { page, pageJson, source } of publishedPageJsonsForSite(siteId)) {
    visit(`${source}:${page.slug || page.id}`, pageJson);
  }

  return pairs;
}

function collectVisibleRecords(siteId) {
  const records = [];
  for (const record of collectSeoRecords(siteId)) {
    addVisibleRecord(records, siteId, record.source, "seo.title", record.title);
    addVisibleRecord(records, siteId, record.source, "seo.description", record.description);
    addVisibleRecord(records, siteId, record.source, "seo.keywords", record.keywords);
  }
  for (const { page, pageJson, source } of publishedPageJsonsForSite(siteId)) {
    collectVisibleRecordsFromNode(records, siteId, `${source}:${page.slug || page.id}`, pageJson);
  }
  return records;
}

function homeSectionsOrder(siteId) {
  const site = getSite(siteId);
  const home = (site.pages ?? []).find((page) => page.slug === "/" || page.pageType === "home");
  return home?.publishedJson?.sectionsOrder ?? [];
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function samePageComparable(left, right) {
  if (left.slug && right.slug && left.slug === right.slug) return true;
  if (left.pageType && right.pageType && left.pageType === right.pageType) return true;
  return false;
}

const seoBySite = Object.fromEntries(sites.map((site) => [site.id, collectSeoRecords(site.id)]));
const visibleBySite = Object.fromEntries(sites.map((site) => [site.id, collectVisibleRecords(site.id)]));
const pairsBySite = Object.fromEntries(sites.map((site) => [site.id, collectTitleDescriptionPairs(site.id)]));

for (const site of sites) {
  const records = visibleBySite[site.id] ?? [];
  for (const record of records) {
    for (const pattern of site.forbiddenPatterns) {
      if (pattern.test(record.text)) {
        failures.push(`brand_leak:${site.id}:${record.source}:${record.key}:${record.text}`);
      }
    }
  }
}

const [dreamshootHomeOrder, aidreamcapesHomeOrder] = sites.map((site) => homeSectionsOrder(site.id));
if (
  dreamshootHomeOrder.length > 0 &&
  aidreamcapesHomeOrder.length > 0 &&
  JSON.stringify(dreamshootHomeOrder) === JSON.stringify(aidreamcapesHomeOrder)
) {
  failures.push(`home_sections_order_identical:${dreamshootHomeOrder.join(" > ")}`);
}

for (const left of seoBySite.site_dreamshoot ?? []) {
  for (const right of seoBySite.site_aidreamcapes ?? []) {
    if (!samePageComparable(left, right)) continue;

    const titleScore = jaccard(left.title, right.title);
    const descriptionScore = jaccard(left.description, right.description);
    const combinedScore = jaccard(`${left.title} ${left.description}`, `${right.title} ${right.description}`);

    if ((left.title && right.title && titleScore >= 0.78) || (left.description && right.description && descriptionScore >= 0.72) || combinedScore >= 0.74) {
      failures.push(
        [
          `seo_similarity:${pageIdentity(left)}:${formatPercent(combinedScore)}`,
          `title=${formatPercent(titleScore)} "${left.title}" <> "${right.title}"`,
          `description=${formatPercent(descriptionScore)} "${left.description}" <> "${right.description}"`,
          `sources=${left.source} <> ${right.source}`
        ].join(" | ")
      );
    }
  }
}

const phraseGroups = new Map();
for (const site of sites) {
  for (const record of visibleBySite[site.id] ?? []) {
    if (!["title", "headline", "heading", "subheading", "subheadline", "subtitle", "description", "caption", "question", "answer"].includes(record.key)) continue;
    const normalized = normalizeForCompare(record.text);
    const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
    if (tokenCount < 3 || tokenCount > 18 || normalized.length < 18 || normalized.length > 160) continue;
    const group = phraseGroups.get(normalized) ?? [];
    group.push(record);
    phraseGroups.set(normalized, group);
  }
}

for (const [phrase, records] of phraseGroups) {
  const siteIds = new Set(records.map((record) => record.siteId));
  if (siteIds.size < 2) continue;
  if (records.length < 4) continue;
  const examples = sites
    .map((site) => records.find((record) => record.siteId === site.id))
    .filter(Boolean)
    .map((record) => `${record.siteId}:${record.source}:${record.key}`)
    .join(" <> ");
  failures.push(`repeated_visible_phrase:${records.length}x:${phrase}:${examples}`);
}

const pairGroups = new Map();
for (const site of sites) {
  for (const pair of pairsBySite[site.id] ?? []) {
    const normalized = `${normalizeForCompare(pair.title)} :: ${normalizeForCompare(pair.description)}`;
    const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
    if (tokenCount < 6 || normalized.length < 35) continue;
    const group = pairGroups.get(normalized) ?? [];
    group.push(pair);
    pairGroups.set(normalized, group);
  }
}

for (const [pair, records] of pairGroups) {
  const siteIds = new Set(records.map((record) => record.siteId));
  if (siteIds.size < 2) continue;
  const sourceKeys = new Set(records.map((record) => `${record.siteId}:${record.source}`));
  if (sourceKeys.size < 2) continue;
  const examples = sites
    .map((site) => records.find((record) => record.siteId === site.id))
    .filter(Boolean)
    .map((record) => `${record.siteId}:${record.source}`)
    .join(" <> ");
  failures.push(`repeated_title_description_pair:${records.length}x:${pair}:${examples}`);
}

if (fs.existsSync(jsonLdPath)) {
  const source = fs.readFileSync(jsonLdPath, "utf8");
  if (/serviceType:\s*["']AI photo editing tool["']/.test(source) && !/aidreamcapes[\s\S]{0,240}serviceType/i.test(source)) {
    failures.push("aidreamcapes_jsonld_generic_service_type:src/lib/theme/json-ld.ts uses static serviceType \"AI photo editing tool\" for /tools/ pages");
  }
}

const checkedCounts = {
  seoRecords: Object.values(seoBySite).reduce((sum, records) => sum + records.length, 0),
  visibleTextRecords: Object.values(visibleBySite).reduce((sum, records) => sum + records.length, 0),
  titleDescriptionPairs: Object.values(pairsBySite).reduce((sum, records) => sum + records.length, 0),
  homeSectionsOrders: Number(dreamshootHomeOrder.length > 0) + Number(aidreamcapesHomeOrder.length > 0),
  sourceFiles: fs.existsSync(jsonLdPath) ? 1 : 0
};

if (failures.length > 0) {
  console.error("Storefront SEO fingerprint smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(`Checked counts: ${JSON.stringify(checkedCounts)}`);
  process.exit(1);
}

console.log(`Storefront SEO fingerprint smoke passed: ${JSON.stringify(checkedCounts)}`);
