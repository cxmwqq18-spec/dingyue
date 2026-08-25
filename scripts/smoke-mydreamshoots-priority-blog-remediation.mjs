import fs from "node:fs";
import path from "node:path";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const repoRoot = process.cwd();
const state = await readPlatformStateFromSql();
const routeSource = fs.readFileSync(path.join(repoRoot, "src", "app", "[...path]", "page.tsx"), "utf8");
const rendererSource = fs.readFileSync(path.join(repoRoot, "src", "components", "theme-renderer.tsx"), "utf8");
const jsonLdSource = fs.readFileSync(path.join(repoRoot, "src", "lib", "theme", "json-ld.ts"), "utf8");

const expected = [
  {
    slug: "/blog/cyberpunk-photo-package-guide",
    title: "Cyberpunk AI Photos: Neon Styles, Source Photos, and a Review Checklist",
    targetLabel: "Open Cyberpunk",
    targetHref: "/ai-image-generation/cyberpunk",
    relatedLinks: [
      ["Read the Mafia-style photo guide", "/blog/mafia-photo-package-guide"],
      ["Read the Gala Photos guide", "/blog/gala-photos-photo-package-guide"],
      ["Explore Nightlife portraits", "/ai-image-generation/nightlife"]
    ]
  },
  {
    slug: "/blog/mafia-photo-package-guide",
    title: "Mafia-Style AI Photos: Wardrobe, Lighting, and Scene Guide",
    targetLabel: "Open Mafia",
    targetHref: "/ai-image-generation/mafia",
    relatedLinks: [
      ["Read the Cyberpunk photo guide", "/blog/cyberpunk-photo-package-guide"],
      ["Read the Gala Photos guide", "/blog/gala-photos-photo-package-guide"],
      ["Explore Nightlife portraits", "/ai-image-generation/nightlife"]
    ]
  },
  {
    slug: "/blog/magic-upscaler-photo-package-guide",
    title: "Magic Upscaler Guide: Improve Clarity Without Overprocessing Your Photo",
    targetLabel: "Open Photo Enhancer",
    targetHref: "/ai-image-generation/photo-enhancer",
    relatedLinks: [
      ["Open Photo Enhancer", "/ai-image-generation/photo-enhancer"],
      ["Compare Unblur Image", "/ai-image-generation/unblur-image"],
      ["Compare Old Photo Restoration", "/ai-image-generation/old-photo-restoration"]
    ]
  },
  {
    slug: "/blog/nature-photo-package-guide",
    title: "Nature AI Portraits: Plan Forest, Mountain, and Lakeside Scenes",
    targetLabel: "Open Travel and choose a nature setting",
    targetHref: "/ai-image-generation/travel",
    relatedLinks: [
      ["Open Travel portraits", "/ai-image-generation/travel"],
      ["Read the Outdoor Creator guide", "/blog/outdoor-creator-scenes-photo-package-guide"],
      ["Explore Urban portraits", "/ai-image-generation/urban"]
    ]
  },
  {
    slug: "/blog/outdoor-creator-scenes-photo-package-guide",
    title: "Outdoor Creator Photos: Urban Streets vs Scenic Locations",
    targetLabel: "Explore Urban creator scenes",
    targetHref: "/ai-image-generation/urban",
    secondaryTargetLabel: "Explore scenic Travel portraits",
    secondaryTargetHref: "/ai-image-generation/travel",
    relatedLinks: [
      ["Explore Urban creator scenes", "/ai-image-generation/urban"],
      ["Explore scenic Travel portraits", "/ai-image-generation/travel"],
      ["Read the Nature portrait guide", "/blog/nature-photo-package-guide"]
    ]
  },
  {
    slug: "/blog/valentine-photos-photo-package-guide",
    title: "Valentine's Day AI Photos: Couple Portraits, Cards, and Gifts",
    targetLabel: "Open Valentine's Day Photos",
    targetHref: "/ai-image-generation/valentines-photo",
    relatedLinks: [
      ["Read the Engagement photo guide", "/blog/engagement-photo-package-guide"],
      ["Read the Wedding portrait guide", "/blog/wedding-portraits-photo-package-guide"],
      ["Open Valentine's Day Photos", "/ai-image-generation/valentines-photo"]
    ]
  },
  {
    slug: "/blog/virtual-try-on-photo-package-guide",
    title: "AI Virtual Try-On Guide: Plan Outfits Without Treating the Preview as Exact Fit",
    targetLabel: "Open Virtual Try-On",
    targetHref: "/ai-image-generation/virtual-try-on",
    relatedLinks: [
      ["Open Virtual Try-On", "/ai-image-generation/virtual-try-on"],
      ["Read the Hairstyle photo guide", "/blog/hairstyle-photo-package-guide"],
      ["Compare Portrait Retouch", "/ai-image-generation/portrait-retouch"]
    ]
  },
  {
    slug: "/blog/wedding-portraits-photo-package-guide",
    title: "AI Wedding Portraits: Plan Save-the-Dates, Moodboards, and Keepsakes",
    targetLabel: "Open Wedding Photo",
    targetHref: "/ai-image-generation/wedding-photo",
    relatedLinks: [
      ["Read the Engagement photo guide", "/blog/engagement-photo-package-guide"],
      ["Read the Valentine's Day photo guide", "/blog/valentine-photos-photo-package-guide"],
      ["Open Wedding Photo", "/ai-image-generation/wedding-photo"]
    ]
  },
  {
    slug: "/blog/world-cup-fan-photos-photo-package-guide",
    title: "AI Soccer Fan Photos: Match-Day Posters Without Official Marks",
    targetLabel: "Open Soccer",
    targetHref: "/ai-image-generation/soccer",
    relatedLinks: [
      ["Open Soccer fan photos", "/ai-image-generation/soccer"],
      ["Explore Avatar profile formats", "/ai-image-generation/avatar"],
      ["Read the content policy", "/policies/content"]
    ]
  }
];

const failures = [];
const metrics = [];

function assert(condition, label, detail = "") {
  if (!condition) failures.push(`${label}${detail ? `: ${detail}` : ""}`);
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .replace(/mydreamshoots/g, " brand ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ngrams(value, size = 5) {
  const words = normalizeText(value).split(" ").filter(Boolean);
  const values = new Set();
  for (let index = 0; index <= words.length - size; index += 1) {
    values.add(words.slice(index, index + size).join(" "));
  }
  return values;
}

function jaccard(left, right) {
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union ? intersection / union : 0;
}

function relatedLinkPairs(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => [item?.label ?? "", item?.href ?? ""]);
}

function imageFile(imageUrl) {
  const pathname = new URL(imageUrl, "https://local.invalid").pathname;
  return path.join(repoRoot, "public", decodeURIComponent(pathname).replace(/^\/+/, ""));
}

const site = state.sites.find((item) => item.id === "site_dreamshoot");
assert(Boolean(site), "MyDreamShoots site exists");

const routeMap = routeSource.match(/const DREAMSHOOT_LEGACY_BLOG_CATEGORY_REDIRECTS[\s\S]*?\n};/)?.[0] ?? "";
const legacyKeys = expected.map((item) => item.slug.replace(/^\/blog\//, "").replace(/-photo-package-guide$/, ""));
for (const key of legacyKeys) {
  assert(!new RegExp(`["']?${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']?\\s*:`).test(routeMap), `${key} does not redirect`);
}

assert(rendererSource.includes("function blogArticleRelatedLinks"), "renderer reads explicit related links");
assert(rendererSource.includes('data-blog-article-actions="true"'), "renderer supports paired article CTAs");
assert(jsonLdSource.includes('articleSectionValue(pageJson, "authorType") === "Organization"'), "BlogPosting supports Organization authors");
assert(jsonLdSource.includes('if (section?.type !== "faq") return [];'), "FAQPage remains limited to FAQ sections");

const pages = [];
const paragraphOwner = new Map();
for (const item of expected) {
  const page = site?.pages.find((candidate) => candidate.slug === item.slug);
  assert(Boolean(page), `${item.slug} exists`);
  if (!page) continue;
  pages.push(page);
  const section = page.publishedJson?.sections?.blog_detail_1;
  const settings = section?.settings ?? {};
  const seo = page.publishedJson?.seo ?? {};
  const mappedSeo = site.themeSettings?.publishedJson?.seo?.pages?.[page.id] ?? {};
  const body = typeof settings.body === "string" ? settings.body : "";
  const headingIds = Array.from(body.matchAll(/<h[23]\s+id="([^"]+)"/g), (match) => match[1]);
  const hrefs = Array.from(body.matchAll(/<a\s+href="([^"]+)"/g), (match) => match[1]);
  const paragraphs = Array.from(body.matchAll(/<p>([\s\S]*?)<\/p>/g), (match) => normalizeText(match[1])).filter((text) => text.length >= 140);

  assert(section?.type === "blog_article", `${item.slug} uses blog_article`);
  assert(page.publishedJson.sectionsOrder.length === 1 && page.publishedJson.sectionsOrder[0] === "blog_detail_1", `${item.slug} has one detail section`);
  assert(JSON.stringify(page.draftJson) === JSON.stringify(page.publishedJson), `${item.slug} local draft and published JSON match`);
  assert(settings.title === item.title, `${item.slug} H1 matches`, settings.title);
  assert(settings.headingLevel === "h1", `${item.slug} heading level is h1`);
  assert(settings.targetLabel === item.targetLabel && settings.targetHref === item.targetHref, `${item.slug} primary CTA matches`);
  assert((settings.secondaryTargetLabel ?? "") === (item.secondaryTargetLabel ?? ""), `${item.slug} secondary CTA label matches`);
  assert((settings.secondaryTargetHref ?? "") === (item.secondaryTargetHref ?? ""), `${item.slug} secondary CTA href matches`);
  assert(JSON.stringify(relatedLinkPairs(settings.relatedLinks)) === JSON.stringify(item.relatedLinks), `${item.slug} related links match`);
  assert(settings.author === "myDreamshoots editorial team" && settings.authorType === "Organization", `${item.slug} uses Organization author`);
  assert(settings.authorUrl === "/about-us" && settings.reviewOwner === "myDreamshoots editorial team", `${item.slug} declares author and review owner`);
  assert(settings.evidenceType === "editorial-guidance" && settings.evidenceDate === "2026-08-18", `${item.slug} declares evidence boundary`);
  assert(typeof settings.entityName === "string" && settings.entityName.length > 0, `${item.slug} declares entityName`);
  for (const field of ["productSlug", "userIntent", "suitableUses", "unsuitableUses", "inputRequirements", "verifiedLimitations", "comparisonTargets", "reviewChecklist", "rightsWarnings", "relatedGuides"]) {
    const value = settings[field];
    assert((Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.length > 0), `${item.slug} declares ${field}`);
  }
  assert(settings.publishedAt === "2026-07-28" && settings.updatedAt === "2026-08-18", `${item.slug} dates match remediation policy`);
  assert(typeof settings.imageAlt === "string" && settings.imageAlt.length >= 45, `${item.slug} has descriptive image alt`);
  assert(fs.existsSync(imageFile(settings.imageUrl)), `${item.slug} cover asset exists`, settings.imageUrl);
  assert(seo.canonicalPath === item.slug, `${item.slug} self-canonical path matches`);
  assert(seo.robots?.index === true && seo.robots?.follow === true, `${item.slug} remains index, follow`);
  assert(mappedSeo.canonicalPath === item.slug && mappedSeo.index === true && mappedSeo.follow === true, `${item.slug} theme SEO map matches`);
  assert(typeof seo.title === "string" && seo.title.length >= 41 && seo.title.length <= 70, `${item.slug} SEO title is concise`, seo.title);
  assert(typeof seo.description === "string" && seo.description.length >= 120 && seo.description.length <= 160, `${item.slug} SEO description is concise`, String(seo.description?.length));
  assert(body.length >= 3400, `${item.slug} body is substantial`, String(body.length));
  assert(new Set(headingIds).size === headingIds.length && headingIds.length >= 8, `${item.slug} heading anchors are unique`);
  assert(hrefs.every((href) => href.startsWith("/") && !href.startsWith("//")), `${item.slug} body links are local and absolute-path based`);
  assert(!/photo package category|start with headshot|open avatar theme/i.test(body), `${item.slug} removes generic template leakage`);
  assert(!/several unrelated fan, game-day, premiere, or holiday scenes/i.test(body), `${item.slug} removes cross-topic leakage`);
  assert(!/\b(?:fixed|guaranteed)\s+(?:credits?|outputs?|results?)\b/i.test(body), `${item.slug} avoids fixed catalog promises`);
  assert(!page.publishedJson.sectionsOrder.some((id) => page.publishedJson.sections[id]?.type === "faq"), `${item.slug} does not add FAQPage section`);
  if (item.slug.includes("world-cup")) {
    const visibleEntityText = JSON.stringify({
      pageTitle: page.title,
      title: settings.title,
      summary: settings.summary,
      body,
      seoTitle: seo.title,
      seoDescription: seo.description,
      targetLabel: settings.targetLabel
    });
    assert(!/world cup|fifa/i.test(visibleEntityText), `${item.slug} visible content stays generic Soccer`);
  }

  for (const paragraph of paragraphs) {
    const previous = paragraphOwner.get(paragraph);
    assert(!previous, `${item.slug} has no repeated substantive paragraph`, previous ?? "");
    paragraphOwner.set(paragraph, item.slug);
  }

  metrics.push({
    slug: item.slug,
    bodyCharacters: body.length,
    h2: (body.match(/<h2 id=/g) ?? []).length,
    h3: (body.match(/<h3 id=/g) ?? []).length,
    relatedLinks: relatedLinkPairs(settings.relatedLinks).length
  });
}

const profileCardsPage = site?.pages.find((page) => page.slug === "/blog/profile-cards-photo-package-guide");
const profileCardsSection = profileCardsPage?.publishedJson?.sections?.blog_detail_1;
assert(Boolean(profileCardsPage), "/blog/profile-cards-photo-package-guide exists as an independent article");
assert(profileCardsSection?.settings?.title === "Profile Card Photos for Consistent Bios and Social Profiles", "profile cards has an independent title");
assert(typeof profileCardsSection?.settings?.body === "string" && profileCardsSection.settings.body.length >= 3400, "profile cards has independent substantive guidance");
assert(!/anime avatar|photo package category|start with headshot/i.test(String(profileCardsSection?.settings?.body ?? "")), "profile cards avoids the old duplicate template");
assert(profileCardsSection?.settings?.targetHref === "/ai-image-generation/avatar", "profile cards maps to Avatar");

let maximumSimilarity = { score: 0, pair: [] };
for (let leftIndex = 0; leftIndex < pages.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < pages.length; rightIndex += 1) {
    const left = pages[leftIndex];
    const right = pages[rightIndex];
    const leftBody = left.publishedJson.sections.blog_detail_1.settings.body;
    const rightBody = right.publishedJson.sections.blog_detail_1.settings.body;
    const score = jaccard(ngrams(leftBody), ngrams(rightBody));
    if (score > maximumSimilarity.score) maximumSimilarity = { score, pair: [left.slug, right.slug] };
    assert(score < 0.7, `${left.slug} and ${right.slug} stay below similarity warning`, score.toFixed(4));
  }
}

const activePublication = state.sites?.find((site) => site.id === "site_dreamshoot")?.latestPublication;
if (activePublication) {
  for (const item of expected) {
    const livePage = pages.find((page) => page.slug === item.slug);
    const snapshotPage = activePublication.snapshot?.pages?.find((page) => page.slug === item.slug);
    assert(Boolean(snapshotPage), `${activePublication.id} contains ${item.slug}`);
    assert(JSON.stringify(snapshotPage?.publishedJson) === JSON.stringify(livePage?.publishedJson), `${activePublication.id} snapshot matches ${item.slug}`);
  }
}

if (failures.length) {
  console.error("MyDreamShoots priority blog remediation smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    status: "local-only-not-published",
    pageCount: pages.length,
    maximumFiveGramJaccard: Number(maximumSimilarity.score.toFixed(4)),
    maximumSimilarityPair: maximumSimilarity.pair,
    metrics
  }, null, 2));
}
