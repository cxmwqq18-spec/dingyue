import "./load-runtime-env.mjs";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  MYDREAMSHOOTS_BLOG_SEO_REMEDIATION_SLUGS,
  mydreamshootsBlogSeoRemediationArticles
} from "./mydreamshoots-blog-seo-remediation-articles.mjs";
import {
  MYDREAMSHOOTS_SEASONAL_OCCASION_BLOG_SEO_SLUGS,
  mydreamshootsSeasonalOccasionBlogSeoArticles
} from "./mydreamshoots-seasonal-occasion-blog-seo-articles.mjs";

const statePath = path.join(process.cwd(), "data/platform-state.json");
const mydreamshootsTaxonomyPath = path.join(process.cwd(), "src", "lib", "mydreamshoots-theme-taxonomy.json");
const MYDREAMSHOOTS_SITE_ID = "site_dreamshoot";
const MYDREAMSHOOTS_PRIORITY_BLOG_SLUGS = [
  "/blog/cyberpunk-photo-package-guide",
  "/blog/mafia-photo-package-guide",
  "/blog/magic-upscaler-photo-package-guide",
  "/blog/nature-photo-package-guide",
  "/blog/outdoor-creator-scenes-photo-package-guide",
  "/blog/valentine-photos-photo-package-guide",
  "/blog/virtual-try-on-photo-package-guide",
  "/blog/wedding-portraits-photo-package-guide",
  "/blog/world-cup-fan-photos-photo-package-guide"
];
const SOCCER_MIGRATION_APPROVED = process.env.MDS_SOCCER_MIGRATION_APPROVED === "1";
const mydreamshootsPriorityBlogSlugSet = new Set([
  ...MYDREAMSHOOTS_PRIORITY_BLOG_SLUGS,
  ...MYDREAMSHOOTS_BLOG_SEO_REMEDIATION_SLUGS,
  ...MYDREAMSHOOTS_SEASONAL_OCCASION_BLOG_SEO_SLUGS
]);

function cliOption(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.slice(2).find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? "" : "";
}

const cliFlags = new Set(process.argv.slice(2));
const dryRun = cliFlags.has("--dry-run");
const updateDb = cliFlags.has("--db");
const requestedSiteId = cliOption("site-id");
const requestedSlugs = cliOption("slugs")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const scopedRun = Boolean(requestedSiteId || requestedSlugs.length || updateDb);

if (scopedRun) {
  if (requestedSiteId !== MYDREAMSHOOTS_SITE_ID) {
    throw new Error(`Scoped blog sync requires --site-id=${MYDREAMSHOOTS_SITE_ID}.`);
  }
  if (!requestedSlugs.length) {
    throw new Error(`Scoped blog sync requires --slugs=${MYDREAMSHOOTS_PRIORITY_BLOG_SLUGS.join(",")}.`);
  }
  const unsupportedSlugs = requestedSlugs.filter((slug) => !mydreamshootsPriorityBlogSlugSet.has(slug));
  if (unsupportedSlugs.length) {
    throw new Error(`Scoped blog sync refuses non-priority slugs: ${unsupportedSlugs.join(", ")}`);
  }
}

const sourceState = JSON.parse(fs.readFileSync(statePath, "utf8"));
const mydreamshootsTaxonomy = JSON.parse(fs.readFileSync(mydreamshootsTaxonomyPath, "utf8"));

function slugifySegment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

const mydreamshootsCollectionHrefBySlug = new Map([
  ["", "/ai-image-generation"],
  ...mydreamshootsTaxonomy.roots.map((root) => [root.slug, `/ai-image-generation/${root.slug}`]),
  ...mydreamshootsTaxonomy.items.map((item) => [item.slug, `/ai-image-generation/${item.groupSlug}/${item.slug}`]),
  ["creator", "/ai-image-generation/portrait-photo"],
  ["creator-portraits", "/ai-image-generation/portrait-photo"],
  ["profile-cards", "/ai-image-generation/avatar"],
  ["wedding", "/ai-image-generation/wedding-photo"],
  ["wedding-portraits", "/ai-image-generation/wedding-photo"],
  ["cultural", "/ai-image-generation/wedding-photo"],
  ["couple", "/ai-image-generation/engagement-photo"],
  ["creative", "/ai-image-generation"],
  ["beauty", "/ai-image-generation/hairstyle-generator"],
  ["sports", "/ai-image-generation/soccer"],
  ["world-cup-fan-photos", "/ai-image-generation/soccer"],
  ["video", "/ai-image-generation/motion-generator"],
  ["ai-video-add-ons", "/ai-image-generation/motion-generator"],
  ["utility", "/ai-image-generation/photo-enhancer"],
  ["headshots", "/ai-image-generation/headshot"],
  ["professional-headshots", "/ai-image-generation/headshot"],
  ["seasonal", "/ai-image-generation/holiday"]
]);

function packageDirectoryHrefForSite(siteId, slug = "") {
  const normalizedSlug = slugifySegment(slug);
  if (siteId === MYDREAMSHOOTS_SITE_ID) {
    return mydreamshootsCollectionHrefBySlug.get(normalizedSlug) ?? "/ai-image-generation";
  }
  return normalizedSlug ? `/collections/${normalizedSlug}` : "/collections";
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function section(type, settings, blocks = []) {
  return { type, settings, blocks };
}

function html(strings, ...values) {
  return strings.reduce((result, part, index) => `${result}${part}${values[index] ?? ""}`, "").replace(/\n\s+/g, "");
}

function readableList(items) {
  const values = items.map((item) => item.trim()).filter(Boolean);
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function searchFriendlySeoTitle(label, brand, category = "private galleries") {
  const compactLabel = String(label ?? "").trim();
  const candidates = category === "video themes"
    ? [
      `${compactLabel} video theme guide for ${brand}`,
      `${compactLabel} motion theme guide | ${brand}`,
      `${compactLabel} video guide | ${brand}`
    ]
    : [
      `${compactLabel} guide for ${brand} private galleries`,
      `${compactLabel} private gallery guide | ${brand}`,
      `${compactLabel} planning guide | ${brand}`,
      `${compactLabel} guide | ${brand}`
    ];
  const exactFit = candidates.find((title) => title.length >= 45 && title.length <= 70);
  if (exactFit) return exactFit;

  const shortFit = candidates.find((title) => title.length < 45);
  if (shortFit) {
    const padded = `${shortFit} for AI photo planning`;
    if (padded.length <= 70) return padded;
  }

  const suffix = ` guide | ${brand}`;
  const maxLabelLength = Math.max(12, 70 - suffix.length);
  const truncatedLabel = compactLabel.slice(0, maxLabelLength).replace(/\s+\S*$/, "").trim() || compactLabel.slice(0, maxLabelLength);
  return `${truncatedLabel}${suffix}`;
}

function cleanPlainText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function seoTitleFromCandidates(candidates, brand) {
  const exactFit = candidates.find((title) => title.length >= 45 && title.length <= 70);
  if (exactFit) return exactFit;
  const shortFit = candidates.find((title) => title.length < 45);
  if (shortFit) {
    const padded = `${shortFit} for private planning`;
    if (padded.length <= 70) return padded;
  }
  const fallback = candidates[0] ?? `${brand} private gallery guide`;
  if (fallback.length <= 70) return fallback;
  const suffixMatch = fallback.match(/\s\|\s[^|]+$/);
  const suffix = suffixMatch?.[0] ?? ` | ${brand}`;
  const maxPrefixLength = Math.max(16, 70 - suffix.length);
  const prefix = fallback
    .replace(/\s\|\s[^|]+$/, "")
    .slice(0, maxPrefixLength)
    .replace(/\s+\S*$/, "")
    .trim();
  return `${prefix}${suffix}`;
}

function packageSeoTitle(label, brand) {
  const compactLabel = String(label ?? "").trim();
  if (brand === "Aidreamcapes") {
    const noun = /\balbums?\b/i.test(compactLabel) ? "planning guide" : "private album guide";
    return seoTitleFromCandidates([
      `${compactLabel} ${noun} | ${brand}`,
      `${compactLabel} private planning guide | ${brand}`,
      `${compactLabel} guide | ${brand}`
    ], brand);
  }
  return seoTitleFromCandidates([
    `${compactLabel} private AI photo guide | ${brand}`,
    `${compactLabel} AI photo package guide | ${brand}`,
    `${compactLabel} AI photo planning guide | ${brand}`,
    `${compactLabel} source photo guide | ${brand}`
  ], brand);
}

function firstSentence(value) {
  const text = cleanPlainText(value);
  const match = text.match(/^(.+?[.!?])(?:\s|$)/);
  return (match?.[1] ?? text).trim();
}

function sentenceTrim(value, maxLength) {
  const clean = cleanPlainText(value).replace(/[.;:,\s]+$/, "");
  if (!clean) return "";
  if (clean.length <= maxLength - 1) return `${clean}.`;
  const limited = clean.slice(0, Math.max(20, maxLength - 1));
  const phraseCandidate = clean
    .slice(0, Math.max(20, maxLength - 1))
    .replace(/[,;:]\s+[^,;:]*$/, "")
    .replace(/[.;:,\s]+$/, "")
    .trim();
  if (phraseCandidate.length >= 48 && phraseCandidate.length < limited.trim().length) return `${phraseCandidate}.`;

  const danglingWords = new Set([
    "a", "an", "and", "as", "at", "before", "by", "for", "from", "in", "into", "of", "on", "or", "the", "that",
    "to", "while", "which", "who", "with", "without"
  ]);
  let trimmed = clean
    .slice(0, Math.max(20, maxLength - 1))
    .replace(/\s+\S*$/, "")
    .replace(/[.;:,\s]+$/, "")
    .trim();
  for (const pattern of [
    /\s+(?:without|before|after|while|because|that|which|who|where|when)\s+[^,.!?;:]{0,52}$/i,
    /\s+(?:and|or|with|for|to|in|on|from|into|of)\s+[^,.!?;:]{0,36}$/i
  ]) {
    const candidate = trimmed.replace(pattern, "").replace(/[.;:,\s]+$/, "").trim();
    if (candidate.length >= 48) trimmed = candidate;
  }
  while (danglingWords.has(trimmed.split(/\s+/).pop()?.toLowerCase())) {
    trimmed = trimmed.replace(/\s+\S+$/, "").replace(/[.;:,\s]+$/, "").trim();
  }
  return `${trimmed || clean.slice(0, Math.max(20, maxLength - 1)).trim()}.`;
}

function packageSeoDescription({ brand, label, description, headline }) {
  const fallbackLead = brand === "Aidreamcapes"
    ? `${label} helps plan a focused fan or holiday album from approved portraits.`
    : `${label} helps plan a focused AI photo set from source photos.`;
  const lead = firstSentence(description || headline || fallbackLead) || fallbackLead;
  const suffix = brand === "Aidreamcapes"
    ? "Review credit cost, approved uploads, and private album delivery."
    : "Review credit cost, source quality, and private downloads.";
  const trimmedLead = sentenceTrim(lead, 160 - suffix.length - 1);
  const result = `${trimmedLead} ${suffix}`;
  if (result.length >= 120) return result;
  const expandedSuffix = brand === "Aidreamcapes"
    ? "Review credit cost, approved uploads, permission fit, and private album delivery."
    : "Review credit cost, source quality, identity fit, and private downloads.";
  const expanded = `${trimmedLead} ${expandedSuffix}`;
  if (expanded.length <= 160) return expanded;
  return result;
}

function makeCategoryArticle(input) {
  const label = input.label;
  const lowerLabel = label.toLowerCase();
  const brand = input.brand;
  const isAidreamcapes = brand === "Aidreamcapes";
  const kind = input.kind;
  const isTool = kind === "tool";
  const isVideoTheme = kind === "video-theme";
  const articleKind = isTool ? "tool category" : isVideoTheme ? "video theme category" : "package category";
  const pluralKind = isTool ? "tools" : isVideoTheme ? "video themes" : "packages";
  const directoryHref = isTool || isVideoTheme ? "/tools" : isAidreamcapes ? "/collections" : packageDirectoryHrefForSite(input.sitePrefix, "headshot");
  const directoryLabel = isTool || isVideoTheme ? "Tools" : isAidreamcapes ? "Browse packages" : "Headshot";
  const sourceTerm = input.sourceTerm ?? (isVideoTheme ? "source frames" : isAidreamcapes ? "source portraits" : "source photos");
  const setTerm = isVideoTheme ? "video clip" : isAidreamcapes ? "album" : "photo set";
  const brandNiche = isAidreamcapes ? "fan and holiday" : "AI photo";
  const examples = input.examples.length ? input.examples : [label];
  const examplesText = readableList(examples);
  const anchorPrefix = input.blogSlug.replace(/^\/blog\//, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const summary = input.summary ?? `Use this ${brand} guide to decide when ${label} fits, which ${sourceTerm} or references help, what to compare before spending credits, and how to review finished images privately.`;
  const seoTitle = input.seoTitle ?? searchFriendlySeoTitle(label, brand, isVideoTheme ? "video themes" : "private galleries");
  const seoDescription = input.seoDescription ?? `Plan ${label} in ${brand}: choose ${sourceTerm}, compare fit, review credit cost, and check the private gallery before downloads.`;
  const faqIntro = input.faqIntro ?? `${label} questions usually come down to source quality, scope, credit planning, and whether the finished images match the intended use.`;
  const targetHref = input.targetHref ?? directoryHref;
  const targetLabel = input.targetLabel ?? (isTool ? `Open ${label} tool` : isVideoTheme ? `Open ${label} video themes` : `Open ${label} package`);
  const primaryCta = input.primaryCta ?? (isTool || isVideoTheme ? "Open Tools" : isAidreamcapes ? "Browse packages" : "Open Headshot");
  const primaryHref = input.primaryHref ?? (isTool || isVideoTheme || isAidreamcapes ? directoryHref : packageDirectoryHrefForSite(input.sitePrefix, "headshot"));
  const openingLead = isAidreamcapes
    ? `The ${label} ${articleKind} gives ${brand} customers one clear private album direction to compare before credits are spent.`
    : `The ${label} ${articleKind} helps ${brand} customers choose a clear package direction before they spend credits.`;
  const fitLead = isAidreamcapes
    ? `Use ${label} when ${examplesText} are the clearest match for the next ${setTerm}.`
    : `Use ${label} when ${examplesText} are the nearest match for the next ${setTerm}.`;
  const secondLead = isAidreamcapes
    ? `The strongest ${lowerLabel} requests keep one occasion, one scene, and one review goal in the same lane. A customer who wants a private fan or holiday album should not judge the set by the standards of a work profile or a broader editorial brief.`
    : `The strongest ${lowerLabel} requests keep the brief and the result aligned. A customer who needs a calm work portrait should not judge the same set by the standards of a dramatic scene package.`;
  const sourceLead = isAidreamcapes
    ? `${input.sourceFocus} Start with approved source portraits and one album cue that matters most to the gallery. Treat the ${sourceTerm} as identity evidence first. Style references, outfit notes, fan details, holiday cues, or movement ideas should support the request after the person is already clear.`
    : `${input.sourceFocus} Start with sharp source photos and one style cue that matters most to the package. Treat the ${sourceTerm} as identity evidence first. Style references, outfit notes, fan details, holiday cues, or movement ideas should support the request after the person is already clear.`;
  const compareLead = isAidreamcapes
    ? `Compare ${lowerLabel} against neighboring ${pluralKind} by the private outcome it supports, not by the strongest cover image. The table below turns the category into a practical choice before credit cost is confirmed.`
    : `Compare ${lowerLabel} against neighboring ${pluralKind} by the job it solves, not by which cover image looks strongest. The table below turns the category into a practical choice before credit cost is confirmed.`;
  const creditsLead = isAidreamcapes
    ? `Before the job starts, review the visible credit cost and the permission boundary. If you only need to test ${lowerLabel}, a smaller request can teach you what works. If the final use is already clear, a broader album may be easier to judge because it gives more crops and expressions to compare.`
    : `Before the job starts, review the visible credit cost and ask whether the category is carrying the right amount of work. If you only need to test ${lowerLabel}, a smaller request can teach you what works. If the final use is already clear, a broader gallery may be easier to judge because it gives more crops and expressions to compare.`;
  const reviewLead = isAidreamcapes
    ? `${input.reviewFocus} Also check whether the gallery still feels original, private, and easy to explain to someone who was not part of the request.`
    : `${input.reviewFocus} Also check small visual details that often decide whether a result is ready for a profile, card, post, or archive: face consistency, hand and hair edges, clothing lines, background distractions, and whether the image still reads well at the crop size where you will use it.`;
  const moodLead = `${input.elementStory} This is where ${label} becomes more than a menu label. The visible mood should explain why the category was chosen, while the private gallery keeps the customer in control of what stays personal and what becomes a downloaded favorite.`;
  const avoidLead = isAidreamcapes
    ? `${input.avoid} The fastest way to weaken ${lowerLabel} results is to overload the request with unrelated goals. Keep one occasion, one mood, and one review standard at a time, then run a second request when the next direction is different enough to need its own review.`
    : `${input.avoid} The fastest way to weaken ${lowerLabel} results is to overload the request with unrelated goals. Do not ask one job to be a professional portrait, a themed album, a restoration pass, and a motion concept at the same time. Keep the category honest, then run a second request when the next direction is different enough to need its own review.`;
  const planningHeading = isAidreamcapes ? "A planning pass before credits" : "A planning pass before you spend credits";
  const planningIntro = isAidreamcapes && targetHref && targetHref !== directoryHref
    ? `Open <a href="${targetHref}">${label}</a> for the focused theme page, or browse <a href="${directoryHref}">${directoryLabel}</a> to compare it with nearby choices. The best choice is the one that makes the review criteria obvious before the first image is generated.`
    : !isAidreamcapes && !isTool && !isVideoTheme
      ? `Start with <a href="${directoryHref}">${directoryLabel}</a>, then compare ${label} with nearby categories before generating. The best choice is the one that makes the review criteria obvious before the first image is generated.`
    : `For broader browsing, open <a href="${directoryHref}">${directoryLabel}</a> and compare ${label} with the categories around it. The best choice is the one that makes the review criteria obvious before the first image is generated.`;
  const planningBullets = isAidreamcapes
    ? [
      "Name the exact private album use for the finished images.",
      `Choose the clearest ${sourceTerm} before adding style references.`,
      `Match the request to ${examplesText}, not every nearby category.`,
      "Review credit cost and permission boundaries before generation starts.",
      "Use the private gallery to compare results before downloading favorites."
    ]
    : [
      "Name the exact use for the finished images.",
      `Choose the clearest ${sourceTerm} before adding style references.`,
      `Match the request to ${examplesText}, not every nearby category.`,
      "Review credit cost before generation starts.",
      "Use the private gallery to compare results before downloading favorites."
    ];
  const closingLead = isAidreamcapes
    ? `${label} works best when it is treated as a focused private album choice. Prepare the right inputs, review the cost, and let the private gallery show what should happen next.`
    : `${label} works best when it is treated as a focused planning choice. Prepare the right inputs, review the cost, and let the private gallery show what should happen next.`;

  return {
    id: `${input.sitePrefix}_blog_${kind}_${anchorPrefix.replace(/-/g, "_")}`,
    slug: input.blogSlug,
    pageTitle: input.pageTitle ?? `${label} guide`,
    title: input.title ?? `${label}: how to plan this ${brand} ${isTool ? "tool workflow" : isVideoTheme ? "video theme workflow" : "photo package category"}`,
    summary,
    author: `${brand} editorial team`,
    publishedAt: "2026-07-28",
    updatedAt: "2026-07-28",
    readMinutes: input.readMinutes ?? "6",
    imageUrl: input.imageUrl,
    imageAlt: input.imageAlt ?? `${brand} ${label} ${articleKind} cover`,
    tags: input.tags ?? `${label}|${isTool ? "Tools" : isVideoTheme ? "Video themes" : "Photo packages"}|Credits|Private gallery`,
    primaryCta,
    primaryHref,
    secondaryCta: input.secondaryCta ?? "View pricing",
    secondaryHref: "/pricing",
    targetLabel,
    targetHref,
    seoTitle,
    seoDescription,
    seoKeywords: input.seoKeywords ?? `${label} guide, ${brand} ${pluralKind}, ${brandNiche} planning, ${sourceTerm}, private gallery credits`,
    body: html`
      <p>${openingLead}</p>
      <h2 id="${anchorPrefix}-fit">${isAidreamcapes ? `Where ${label} fits` : `When ${label} is the right fit`}</h2>
      <p>${fitLead} If the goal is still vague, start by naming the final use: profile update, creator album, keepsake, announcement, social draft, or a short motion test.</p>
      <p>${secondLead}</p>
      <h2 id="${anchorPrefix}-source">${isAidreamcapes ? "What to upload first" : "What to prepare before choosing it"}</h2>
      <p>${sourceLead}</p>
      <p>For a first pass, keep the input set smaller and cleaner than a social camera roll. Use current images, avoid heavy filters, and separate unrelated goals into different private jobs. ${brand} can follow a focused brief more reliably than a folder that asks for several looks at once.</p>
      <h2 id="${anchorPrefix}-compare">${isAidreamcapes ? `How ${label} compares` : `How to compare ${label} with nearby choices`}</h2>
      <p>${compareLead}</p>
      <table><thead><tr><th>Decision point</th><th>Use ${label} when</th><th>Review after generation</th></tr></thead><tbody><tr><td>Final use</td><td>${input.bestFor}</td><td>${input.reviewFocus}</td></tr><tr><td>${sourceTerm}</td><td>${input.sourceFocus}</td><td>Check whether the clearest input details carried through the best images.</td></tr><tr><td>Category examples</td><td>${examplesText}</td><td>Keep the outputs that match the chosen example instead of mixing several directions.</td></tr><tr><td>Credit plan</td><td>Use a focused first pass when the style is new.</td><td>Decide whether the next request should repeat, expand, or change direction.</td></tr></tbody></table>
      <h2 id="${anchorPrefix}-credits">${isAidreamcapes ? "Credit and permission planning" : "Credit and private gallery planning"}</h2>
      <p>${creditsLead}</p>
      <p>Finished outputs belong in the signed-in private gallery first. Use that space to compare identity, crop, expression, background detail, and whether the ${articleKind} actually delivered the mood you selected. Download favorites only after separating public-use images from experiments.</p>
      <h2 id="${anchorPrefix}-review">${isAidreamcapes ? "What to review privately" : "Details to review before download"}</h2>
      <p>${reviewLead}</p>
      <p>${moodLead}</p>
      <h2 id="${anchorPrefix}-avoid">${isAidreamcapes ? "What to avoid" : "Mistakes to avoid"}</h2>
      <p>${avoidLead}</p>
      <h2 id="${anchorPrefix}-planning-pass">${planningHeading}</h2>
      <ul>${planningBullets.map((item) => `<li>${item}</li>`).join("")}</ul>
      <p>${planningIntro}</p>
      <h2 id="${anchorPrefix}-faq">${label} FAQ</h2>
      <p>${faqIntro}</p>
      <h3 id="${anchorPrefix}-first-request">Is ${label} good for a first request?</h3>
      <p>Yes, if the intended use is clear and the ${sourceTerm} are current, sharp, and permission-safe. If you are testing a dramatic change, start narrower so the first private gallery can show whether the direction deserves a larger credit spend.</p>
      <h3 id="${anchorPrefix}-source-count">How many ${sourceTerm} should I prepare?</h3>
      <p>Use enough images to show identity, angle, and expression without adding confusion. A small set of clear portraits usually beats a large group of old, filtered, or mixed-purpose images.</p>
      <h3 id="${anchorPrefix}-next-category">When should I choose another category instead?</h3>
      <p>Choose another category when the review criteria change. If ${label} is being judged by a different use case, style world, or motion need, split the work into a separate private job so credits support a clearer outcome.</p>
      <p>${closingLead}</p>
    `
  };
}

const mydreamshootsThemeArticles = [
  {
    label: "Creator",
    blogSlug: "/blog/creator-photo-package-guide",
    description: "Creator portraits, profile cards, product-style scenes, social cards, and private personal-brand albums.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/creator-portraits/creator-portraits-01.webp?v=20260715b",
    targetHref: packageDirectoryHrefForSite("site_dreamshoot", "portrait-photo"),
    examples: ["creator portraits", "profile cards", "product-style scenes", "social cards"],
    bestFor: "Use Creator when the finished images need to support a personal brand, creator profile, campaign draft, or social-facing album.",
    sourceFocus: "Prepare clear face photos plus one or two frames that show posture, shoulders, and the kind of outfit tone you want the creator set to follow.",
    reviewFocus: "Review crop variety, face consistency, personal-brand tone, and whether the images can work as headers, avatars, or social posts.",
    elementStory: "Creator images depend on recognizable personality cues: expression, gesture, color, and crop shape.",
    avoid: "Avoid mixing product lifestyle shots with unrelated portrait goals unless the request is explicitly about creator-commerce imagery."
  },
  {
    label: "Avatar",
    blogSlug: "/blog/avatar-photo-package-guide",
    description: "Stylized avatar, anime-inspired profile, and character-concept packages for playful private galleries.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/anime-avatar/anime-avatar-01.webp?v=20260715b",
    targetHref: packageDirectoryHrefForSite("site_dreamshoot", "avatar"),
    examples: ["anime avatars", "stylized profile icons", "character concepts", "playful social crops"],
    bestFor: "Use Avatar when the image can be more stylized than a normal portrait while still staying recognizable as the person.",
    sourceFocus: "Use sharp, recent portraits without heavy filters so the stylized result has a stable identity base before character details are added.",
    reviewFocus: "Review whether the avatar crop is readable, the style is intentional, and the face still feels connected to the source person.",
    elementStory: "Avatar sets lean on graphic shape, color mood, and expressive framing more than everyday realism.",
    avoid: "Avoid using avatar packages for official IDs, impersonation, or any use where a playful visual could be mistaken for a verified document."
  },
  {
    label: "Wedding",
    blogSlug: "/blog/wedding-photo-package-guide",
    description: "Wedding portraits, couple albums, save-the-date concepts, and announcement-ready visuals.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/wedding-portraits/wedding-portraits-01.webp?v=20260715b",
    targetHref: packageDirectoryHrefForSite("site_dreamshoot", "wedding"),
    examples: ["wedding portraits", "save-the-date concepts", "couple albums", "announcement visuals"],
    bestFor: "Use Wedding when the finished images need a romantic, announcement-ready, or keepsake mood for a couple or ceremony-inspired album.",
    sourceFocus: "Prepare clear portraits for each person and include simple notes about formal tone, outfit direction, and whether the set should feel quiet or celebratory.",
    reviewFocus: "Review both identities, shared expression, clothing lines, hand detail, and whether the mood feels suitable for a card or private keepsake.",
    elementStory: "Wedding images often work through soft light, paired posture, formal clothing cues, and a sense of occasion.",
    avoid: "Avoid mixing wedding, engagement, holiday card, and unrelated fashion goals in one request unless you want a broad test gallery."
  },
  {
    label: "Cultural",
    blogSlug: "/blog/cultural-wedding-photo-guide",
    description: "Indian and Desi Wedding-inspired portraits with respectful styling and private gallery delivery.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/desi-wedding/desi-wedding-01.webp?v=20260715b",
    targetHref: packageDirectoryHrefForSite("site_dreamshoot", "cultural"),
    examples: ["Indian wedding looks", "Desi wedding portraits", "formal celebration images", "private cultural keepsakes"],
    bestFor: "Use Cultural when the customer wants a celebration-inspired portrait direction with clear styling notes and careful private review.",
    sourceFocus: "Prepare current portraits and write respectful styling notes around outfit tone, color, formality, and album use without inventing personal traditions.",
    reviewFocus: "Review identity, styling fit, jewelry or fabric edges, hand detail, and whether the result feels respectful enough for the intended private use.",
    elementStory: "Color, formality, fabric shape, and ceremonial posture can carry emotional weight when the brief stays grounded in visible styling.",
    avoid: "Avoid claiming religious meaning, family history, or cultural details that were not supplied by the customer."
  },
  {
    label: "Couple",
    blogSlug: "/blog/couple-photo-package-guide",
    description: "Keepsake couple portraits, engagement concepts, Valentine visuals, and festive relationship keepsakes.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/engagement/engagement-01.webp?v=20260715b",
    targetHref: packageDirectoryHrefForSite("site_dreamshoot", "couple"),
    examples: ["couple portraits", "engagement concepts", "Valentine visuals", "relationship keepsakes"],
    bestFor: "Use Couple when the finished set should read as a shared portrait, private keepsake, or relationship announcement.",
    sourceFocus: "Use permission-safe photos for both people, ideally with clear faces and at least one frame that shows how they look together.",
    reviewFocus: "Review both identities, shared eye line, gesture, spacing, crop balance, and whether the image feels warm without becoming overly staged.",
    elementStory: "Couple images depend on spacing, matching light, paired expression, and small posture cues that make two people feel connected.",
    avoid: "Avoid uploading a second person's image without consent or asking one request to cover several unrelated relationship occasions."
  },
  {
    label: "Creative",
    blogSlug: "/blog/creative-photo-package-guide",
    description: "Cinematic worlds, noir portraits, cyberpunk scenes, gala looks, nature images, and editorial private albums.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/cyberpunk/cyberpunk-01.webp?v=20260715b",
    targetHref: packageDirectoryHrefForSite("site_dreamshoot", "lifestyle-creative"),
    examples: ["cyberpunk scenes", "noir portraits", "gala looks", "nature images"],
    bestFor: "Use Creative when the gallery can carry stronger mood, scene design, and dramatic styling than a work profile or simple social crop.",
    sourceFocus: "Start with stable identity photos, then add one clear story world such as neon city, formal night, outdoor portrait, or noir character mood.",
    reviewFocus: "Review whether the scene supports the person, whether the style is consistent, and whether artifacts appear around hair, hands, clothing, or background edges.",
    elementStory: "Creative sets are built from visible atmosphere: light, color contrast, wardrobe shape, scene texture, and cinematic framing.",
    avoid: "Avoid asking one request to combine several story worlds, because the private gallery becomes harder to judge."
  },
  {
    label: "Beauty",
    blogSlug: "/blog/beauty-style-photo-guide",
    description: "Hairstyle previews, try-on directions, soft glam portraits, and private style-planning galleries.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/hairstyle/hairstyle-01.webp?v=20260715b",
    targetHref: packageDirectoryHrefForSite("site_dreamshoot", "hairstyle-generator"),
    examples: ["hairstyle previews", "virtual try-on looks", "soft glam portraits", "style-planning galleries"],
    bestFor: "Use Beauty when the customer wants to compare style direction, hair mood, makeup tone, or outfit framing in a private gallery.",
    sourceFocus: "Use current portraits with visible hairline, face shape, and natural lighting so style changes have a clear person to follow.",
    reviewFocus: "Review face consistency, hair edges, color tone, outfit lines, and whether the result is useful as a visual preview rather than a fit promise.",
    elementStory: "Beauty images often turn on texture, shine, silhouette, and color balance rather than a complex scene.",
    avoid: "Avoid medical, skin-care, or exact-fit claims; keep the article focused on visual planning and private review."
  },
  {
    label: "Sports",
    blogSlug: "/blog/sports-fan-photo-guide",
    description: "Personal fan portraits, match-day posters, profile avatars, and stadium-inspired images.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-01.webp?v=20260715b",
    targetHref: packageDirectoryHrefForSite("site_dreamshoot", "soccer"),
    examples: ["fan portraits", "match-day posters", "profile avatars", "stadium-inspired images"],
    bestFor: "Use Sports when the finished images should feel like personal fan content, match-day profile material, or a private themed keepsake.",
    sourceFocus: "Use a clear portrait and describe fan mood, colors, crop need, and personal use without relying on official logos or player likenesses.",
    reviewFocus: "Review face consistency, poster crop, background energy, and whether the final image stays suitable for personal fan use.",
    elementStory: "Sports fan images work through color, stadium scale, match-day expression, and poster-style composition.",
    avoid: "Avoid official logos, player likenesses, or claims of affiliation unless the customer has the rights to use them."
  },
  {
    label: "Video",
    blogSlug: "/blog/video-photo-package-guide",
    description: "Motion-ready image frames and short-video add-on directions for private albums.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-01.webp?v=20260715b",
    targetHref: packageDirectoryHrefForSite("site_dreamshoot", "motion-generator"),
    examples: ["motion-ready frames", "image-to-video concepts", "profile clips", "album story videos"],
    bestFor: "Use Video when a finished image should become a short motion concept, profile clip, fan poster motion, or private album add-on.",
    sourceFocus: "Choose the clearest finished image or frame sequence, then define one movement idea such as slow camera drift, soft reveal, or profile clip pacing.",
    reviewFocus: "Review motion crop, face stability, hand and hair movement, background artifacts, and whether the clip still suits the original image use.",
    elementStory: "Video categories add time and pacing to a still image, so gesture, crop, and background rhythm matter.",
    avoid: "Avoid using a video request to solve source-photo problems that should be fixed before the frame is animated."
  },
  {
    label: "Utility",
    blogSlug: "/blog/utility-image-prep-guide",
    description: "Upscaling and image-prep packages for cleaner private gallery downloads.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/magic-upscaler/magic-upscaler-01.webp?v=20260715b",
    targetHref: packageDirectoryHrefForSite("site_dreamshoot", "utility"),
    examples: ["magic upscaling", "image prep", "cleaner downloads", "gallery finishing"],
    bestFor: "Use Utility when the main job is preparing, enlarging, or cleaning an image rather than changing the whole portrait style.",
    sourceFocus: "Start with the best available image and decide whether the goal is clarity, crop readiness, or download quality before spending credits.",
    reviewFocus: "Review edges, texture, face clarity, compression marks, and whether the final file is suitable for the place it will be used.",
    elementStory: "Utility work is quiet, but it protects the finished image by keeping detail, crop, and file quality readable.",
    avoid: "Avoid expecting a utility pass to invent missing identity detail from a weak source photo."
  },
  {
    label: "Headshots",
    blogSlug: "/blog/headshot-photo-package-guide",
    description: "Professional headshots for LinkedIn, resumes, teams, founders, and polished work profiles.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/professional-headshots/professional-headshots-01.webp?v=20260715b",
    targetHref: packageDirectoryHrefForSite("site_dreamshoot", "headshot"),
    examples: ["LinkedIn portraits", "resume photos", "founder profiles", "team-ready headshots"],
    bestFor: "Use Headshots when the finished images need to feel clear, restrained, current, and appropriate for work-facing profiles.",
    sourceFocus: "Use recent face-forward portraits with neutral lighting, readable hair and shoulders, and clothing that does not distract from the person.",
    reviewFocus: "Review expression, eye line, background restraint, crop, clothing edges, and whether the image feels professional at avatar size.",
    elementStory: "A good headshot is built from restraint: clean light, calm posture, simple background, and a readable expression.",
    avoid: "Avoid using headshot outputs for passports, official IDs, impersonation, or representing someone without permission."
  },
  {
    label: "Seasonal",
    blogSlug: "/blog/seasonal-photo-package-guide",
    description: "Holiday portraits, Christmas cards, festive social visuals, and private seasonal albums.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-01.webp?v=20260715b",
    targetHref: packageDirectoryHrefForSite("site_dreamshoot", "seasonal"),
    examples: ["holiday portraits", "Christmas cards", "festive social visuals", "seasonal private albums"],
    bestFor: "Use Seasonal when the finished set should carry a holiday, greeting-card, or festive keepsake mood.",
    sourceFocus: "Use clear portraits and name the season, card crop, warmth level, and whether the result is for one person, a couple, or a small group.",
    reviewFocus: "Review expression, seasonal props, card framing, hand detail, and whether the image feels personal rather than generic decoration.",
    elementStory: "Seasonal images use color, warmth, lights, clothing, and card-like framing to signal occasion.",
    avoid: "Avoid mixing several holidays or celebration types in one request unless the goal is a broad private test."
  }
].map((item) => makeCategoryArticle({
  sitePrefix: "site_dreamshoot",
  brand: "MyDreamShoots",
  kind: "theme",
  ...item
}));

const aidreamcapesThemeArticles = [
  {
    label: "Fan-Scene Albums",
    blogSlug: "/blog/private-fan-scene-album-photo-package-guide",
    description: "Private fan-scene album categories for original supporter moments, meetup-style portraits, photo walls, and keepsake cards.",
    imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/fan-scene-albums.webp?v=20260731assetfix1",
    targetHref: "/collections/fan-scene-albums",
    examples: ["private fan-scene albums", "backstage meetup portraits", "supporter photo walls", "fan keepsake card sets"],
    bestFor: "Use Fan-Scene Albums when the finished gallery should feel like an original supporter moment without copying real celebrities or official marks.",
    sourceFocus: "Prepare approved portraits, name the fan-scene mood, and note any people, logos, teams, events, or protected materials that must stay out.",
    reviewFocus: "Review identity, scene originality, permission boundaries, expression, and whether the private album feels celebratory without implying affiliation.",
    elementStory: "Fan-scene albums rely on spotlight mood, supporter color, private-event atmosphere, and careful boundaries around recognizable public material.",
    avoid: "Avoid asking for real celebrity recreation, official team branding, protected event marks, or photos you do not have permission to use."
  },
  {
    label: "Game-Day Group Portraits",
    blogSlug: "/blog/game-day-group-portraits-photo-package-guide",
    description: "Game-day group photo categories for arena-inspired portraits, stadium night sets, and watch party albums.",
    imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/game-day-group-photos.webp?v=20260731assetfix1",
    targetHref: "/collections/game-day-group-photos",
    examples: ["game-day group portraits", "stadium night fan sets", "watch party albums"],
    bestFor: "Use Game-Day Group Portraits when the gallery needs supporter energy, group composition, and arena-like atmosphere without official branding.",
    sourceFocus: "Use clear approved portraits for each person and describe colors, celebration level, crop needs, and any team or event marks to avoid.",
    reviewFocus: "Review each face, group spacing, hand detail, background energy, and whether the result stays identity-safe and brand-safe.",
    elementStory: "Game-day portraits work through crowd energy, light flare, poster crop, group gesture, and color hints that do not depend on logos.",
    avoid: "Avoid official logos, real athlete likenesses, protected event names, or a crowded prompt that makes group identity hard to review."
  },
  {
    label: "Premiere-Inspired Portrait Sets",
    blogSlug: "/blog/premiere-flash-portraits-photo-package-guide",
    description: "Premiere-inspired categories for flash portraits, VIP arrivals, and award-night private albums.",
    imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/premiere-style-portraits.webp?v=20260731assetfix1",
    targetHref: "/collections/premiere-style-portraits",
    examples: ["premiere flash portraits", "VIP arrival photo sets", "award night keepsake albums"],
    bestFor: "Use Premiere-Inspired Portrait Sets when the private gallery should feel polished, formal, and event-ready without copying public figures.",
    sourceFocus: "Prepare clear portraits plus outfit and formality notes, then keep the brief focused on original arrival energy and camera-flash mood.",
    reviewFocus: "Review face consistency, formal styling, flash balance, background restraint, and whether the gallery avoids celebrity or brand confusion.",
    elementStory: "Premiere-style images use flash, dark venue contrast, formal posture, and arrival framing to create a private VIP mood.",
    avoid: "Avoid requesting a real public figure, protected red-carpet branding, official event marks, or a look that implies endorsement."
  },
  {
    label: "Christmas Holiday Albums",
    blogSlug: "/blog/christmas-group-album-photo-package-guide",
    description: "Christmas holiday album categories for group cards, cozy portraits, and winter fan greeting albums.",
    imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/christmas-holiday-albums.webp?v=20260731assetfix1",
    targetHref: "/collections/christmas-holiday-albums",
    examples: ["Christmas group albums", "cozy card portrait sets", "winter fan greeting albums"],
    bestFor: "Use Christmas Holiday Albums when the finished gallery should feel warm, greeting-card ready, and private enough for family or fan keepsakes.",
    sourceFocus: "Use approved portraits and note card crop, warmth level, group size, winter details, and any protected decorations or characters to avoid.",
    reviewFocus: "Review each face, card framing, seasonal props, hand detail, and whether the image feels personal rather than generic holiday decor.",
    elementStory: "Christmas holiday albums depend on warm light, card composition, winter texture, small gestures, and safe seasonal styling.",
    avoid: "Avoid protected characters, branded decorations, unapproved group photos, or mixing too many holiday scenes into one request."
  },
  {
    label: "Thanksgiving Keepsake Sets",
    blogSlug: "/blog/thanksgiving-keepsake-table-set-photo-package-guide",
    description: "Thanksgiving keepsake categories for table scenes, gratitude portraits, and Friendsgiving memory sets.",
    imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/thanksgiving-memory-sets.webp?v=20260731assetfix1",
    targetHref: "/collections/thanksgiving-memory-sets",
    examples: ["Thanksgiving table keepsakes", "gratitude group portraits", "Friendsgiving memory sets"],
    bestFor: "Use Thanksgiving Keepsake Sets when the private album should feel warm, grateful, group-friendly, and suitable for seasonal sharing.",
    sourceFocus: "Prepare approved portraits and describe table light, group size, card use, outfit tone, and any family details that should stay private.",
    reviewFocus: "Review group identity, expression, table or room details, crop warmth, and whether the gallery respects private context.",
    elementStory: "Thanksgiving sets are carried by table light, shared posture, warm color, subtle seasonal detail, and private-album restraint.",
    avoid: "Avoid inventing family relationships, using unapproved group photos, or overloading the request with several holidays at once."
  },
  {
    label: "Halloween Party Portraits",
    blogSlug: "/blog/halloween-party-portrait-set-photo-package-guide",
    description: "Halloween party portrait categories for costume-friendly albums, party scenes, and cast-style private galleries.",
    imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/halloween-party-portraits.webp?v=20260731assetfix1",
    targetHref: "/collections/halloween-party-portraits",
    examples: ["Halloween party portrait sets", "costume cast photo albums", "spooky fan card portraits"],
    bestFor: "Use Halloween Party Portraits when the gallery can be playful, moody, and costume-friendly while staying original and permission-safe.",
    sourceFocus: "Use clear approved portraits, name the costume mood in general terms, and avoid protected characters, masks, or branded costume details.",
    reviewFocus: "Review face visibility, costume originality, party lighting, hand detail, and whether the mood stays fun without becoming a trademark copy.",
    elementStory: "Halloween portraits use color, shadow, costume shape, group energy, and original party atmosphere to carry the theme.",
    avoid: "Avoid protected characters, branded costumes, gore-heavy prompts, or anything that hides identity so much the private gallery is hard to review."
  },
  {
    label: "Seasonal Celebration Photos",
    blogSlug: "/blog/seasonal-celebration-photo-set-photo-package-guide",
    description: "Seasonal celebration categories for birthdays, New Year countdowns, family occasions, and rotating private albums.",
    imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/seasonal-celebration-photos.webp?v=20260731assetfix1",
    targetHref: "/collections/seasonal-celebration-photos",
    examples: ["birthday fan moment sets", "New Year countdown albums", "family occasion portraits"],
    bestFor: "Use Seasonal Celebration Photos when the event is specific but does not fit only Christmas, Thanksgiving, Halloween, or game-day categories.",
    sourceFocus: "Prepare approved portraits, name the occasion, choose the card or album use, and keep fan or family references permission-safe.",
    reviewFocus: "Review event clarity, expression, crop, source-photo identity, and whether the finished images match the intended private use.",
    elementStory: "Seasonal celebration images work through occasion cues: countdown light, birthday warmth, family-card framing, and private keepsake polish.",
    avoid: "Avoid vague celebration prompts, protected brand references, or mixing unrelated occasions that need separate review criteria."
  }
].map((item) => makeCategoryArticle({
  sitePrefix: "site_aidreamcapes",
  brand: "Aidreamcapes",
  kind: "theme",
  ...item
}));

function activeItems(state, key, siteId) {
  return (state[key] ?? []).filter((item) => item.siteId === siteId && item.status === "active");
}

const blogCoverageExclusions = {
  site_dreamshoot: {
    creativeCategorySlugs: new Set(["travel-scene-pack"]),
    videoCategorySlugs: new Set(["travel-story"])
  }
};

function isExcludedBlogCoverage(siteId, kind, slug) {
  const exclusions = blogCoverageExclusions[siteId];
  if (!exclusions) return false;
  if (kind === "creative-category") return exclusions.creativeCategorySlugs.has(slug);
  if (kind === "video-category") return exclusions.videoCategorySlugs.has(slug);
  return false;
}

function articleSlugs(articles) {
  return new Set(articles.map((article) => article.slug));
}

function compactList(items, fallback) {
  const values = Array.from(new Set(items.map((item) => String(item ?? "").trim()).filter(Boolean)));
  return values.length ? values.slice(0, 4) : [fallback];
}

function defaultSiteImage(brand) {
  return brand === "Aidreamcapes"
    ? "/assets/sites/site_aidreamcapes/fan-holiday-theme/showcase/fan-scene-albums.webp"
    : "/assets/dreamshoot/generated/20260622-homepage-unique/hero-package-wall.webp";
}

const mydreamshootsBlogSafeImageOverrides = new Map([
  ["holiday", "/assets/dreamshoot/generated/homepage-showcase/images/holiday.webp?v=20260803blogsafe1"],
  ["magic-upscaler", "/assets/dreamshoot/generated/20260622-pack-fill/magic-upscaler-pack.webp?v=20260803blogsafe1"]
]);

const mydreamshootsArticleFacts = {
  "/blog/cyberpunk-photo-package-guide": {
    entityName: "Cyberpunk AI photos",
    productSlug: "cyberpunk",
    userIntent: "Plan a neon, fictional cyberpunk portrait and review it before download.",
    suitableUses: ["fictional portraits", "creative moodboards", "private social drafts"],
    unsuitableUses: ["proof of a real venue or event", "official brand advertising without permission"],
    inputRequirements: ["clear current portrait", "one focused lighting direction", "permission to use source photos"],
    verifiedLimitations: ["Generated neon, text, reflections, and accessories require visual review."],
    comparisonTargets: ["Urban", "Nightlife", "Headshot"],
    reviewChecklist: ["identity", "neon spill", "background text", "hands and accessories", "final crop"],
    rightsWarnings: ["Do not imply affiliation with fictional or real brands, venues, or events."],
    relatedGuides: ["Mafia", "Gala Photos", "Nightlife"]
  },
  "/blog/mafia-photo-package-guide": {
    entityName: "Mafia-style AI photos",
    productSlug: "mafia",
    userIntent: "Plan a fictional noir character portrait without suggesting real criminal activity.",
    suitableUses: ["fictional character concepts", "cinematic moodboards", "private creative portraits"],
    unsuitableUses: ["evidence of real criminal ties", "threats, impersonation, or unlawful promotion"],
    inputRequirements: ["clear current portrait", "wardrobe and lighting direction", "permission to use source photos"],
    verifiedLimitations: ["Generated props, signage, hands, and facial details require review."],
    comparisonTargets: ["Cyberpunk", "Gala Photos", "Nightlife"],
    reviewChecklist: ["identity", "wardrobe joins", "hands", "props and signage", "fictional framing"],
    rightsWarnings: ["Keep the scene clearly fictional and do not attach it to a real crime or organization."],
    relatedGuides: ["Cyberpunk", "Gala Photos", "Nightlife"]
  },
  "/blog/magic-upscaler-photo-package-guide": {
    entityName: "Magic Upscaler workflow",
    productSlug: "photo-enhancer",
    userIntent: "Improve perceived clarity while preserving the original as the reference file.",
    suitableUses: ["cleaner personal downloads", "larger display copies", "reviewable edited derivatives"],
    unsuitableUses: ["proof that missing detail was recovered exactly", "official identity or historical evidence"],
    inputRequirements: ["highest-quality source available", "known intended crop", "original retained beside the derivative"],
    verifiedLimitations: ["Enhancement may interpret missing detail and cannot guarantee exact recovery."],
    comparisonTargets: ["Photo Enhancer", "Unblur Image", "Old Photo Restoration"],
    reviewChecklist: ["face identity", "halos", "false texture", "text and straight edges", "normal-size crop"],
    rightsWarnings: ["Use only images you own or have permission to edit."],
    relatedGuides: ["Photo Enhancer", "Unblur Image", "Old Photo Restoration"]
  },
  "/blog/nature-photo-package-guide": {
    entityName: "Nature AI portrait direction",
    productSlug: "travel",
    userIntent: "Plan a forest, mountain, lake, or meadow portrait through the Travel package.",
    suitableUses: ["creative outdoor portraits", "travel moodboards", "private lifestyle drafts"],
    unsuitableUses: ["proof of a real trip or location", "documentary evidence of wildlife or weather"],
    inputRequirements: ["clear current portrait", "one landscape, season, and time of day", "permission to use source photos"],
    verifiedLimitations: ["Generated landscapes, weather, scale, and reflections require review."],
    comparisonTargets: ["Travel", "Outdoor Creator", "Urban"],
    reviewChecklist: ["horizon", "subject scale", "shadows", "hair and clothing edges", "weather consistency"],
    rightsWarnings: ["Do not present a generated landscape as proof of visiting a real place."],
    relatedGuides: ["Travel", "Outdoor Creator", "Urban"]
  },
  "/blog/outdoor-creator-scenes-photo-package-guide": {
    entityName: "Outdoor Creator scene comparison",
    productSlug: "urban|travel",
    userIntent: "Choose Urban streets or Travel scenery for a creator image with a usable crop.",
    suitableUses: ["profile and story drafts", "creator moodboards", "campaign concept images"],
    unsuitableUses: ["undisclosed brand endorsement", "proof of a real destination or sponsorship"],
    inputRequirements: ["publishing channel", "crop and text-safe space", "permission to use source photos"],
    verifiedLimitations: ["Generated logos, text, location details, and brand context require review."],
    comparisonTargets: ["Urban", "Travel", "Nature"],
    reviewChecklist: ["channel crop", "negative space", "identity", "brand marks", "disclosure context"],
    rightsWarnings: ["Remove or disclose unapproved marks and do not imply sponsorship."],
    relatedGuides: ["Urban", "Travel", "Nature"]
  },
  "/blog/valentine-photos-photo-package-guide": {
    entityName: "Valentine's Day AI photos",
    productSlug: "valentines-photo",
    userIntent: "Plan a consent-aware couple or single-person Valentine card and keepsake image.",
    suitableUses: ["personal cards", "private couple portraits", "gift and keepsake drafts"],
    unsuitableUses: ["using another person without consent", "official relationship or event proof"],
    inputRequirements: ["permission-safe source photos for each person", "single or couple brief", "card crop and text space"],
    verifiedLimitations: ["Hands, paired identity, lettering, and card composition require review."],
    comparisonTargets: ["Engagement", "Wedding", "Valentine's Day Photos"],
    reviewChecklist: ["both identities", "consent", "hands", "card-safe space", "relationship context"],
    rightsWarnings: ["Obtain consent from every depicted person and do not imply a real engagement or wedding."],
    relatedGuides: ["Engagement", "Wedding", "Valentine's Day Photos"]
  },
  "/blog/virtual-try-on-photo-package-guide": {
    entityName: "AI Virtual Try-On preview",
    productSlug: "virtual-try-on",
    userIntent: "Compare outfit direction visually without treating the preview as an exact fit or product guarantee.",
    suitableUses: ["outfit moodboards", "private style comparisons", "creative wardrobe planning"],
    unsuitableUses: ["size, fit, fabric, or color guarantee", "retail product proof without checking the real item"],
    inputRequirements: ["clear person source", "authorized garment reference", "intended crop and pose"],
    verifiedLimitations: ["The preview cannot guarantee size, drape, material, color, or final retail appearance."],
    comparisonTargets: ["Virtual Try-On", "Hairstyle", "Portrait Retouch"],
    reviewChecklist: ["body and garment edges", "hands", "fabric joins", "color", "fit disclaimer"],
    rightsWarnings: ["Use person and garment references only with permission or a valid license."],
    relatedGuides: ["Virtual Try-On", "Hairstyle", "Portrait Retouch"]
  },
  "/blog/wedding-portraits-photo-package-guide": {
    entityName: "AI Wedding Portraits",
    productSlug: "wedding-photo",
    userIntent: "Plan save-the-date, moodboard, and keepsake concepts without presenting them as a real wedding record.",
    suitableUses: ["save-the-date concepts", "moodboards", "private keepsake drafts"],
    unsuitableUses: ["official marriage or event records", "depicting someone without consent"],
    inputRequirements: ["permission-safe source photos", "intended stationery or keepsake use", "cultural and styling notes"],
    verifiedLimitations: ["Paired identity, hands, text, attire, and cultural details require careful review."],
    comparisonTargets: ["Engagement", "Valentine", "Wedding Photo"],
    reviewChecklist: ["both identities", "consent", "hands and rings", "text-safe space", "cultural fit"],
    rightsWarnings: ["Obtain consent and avoid implying that generated imagery documents a real ceremony."],
    relatedGuides: ["Engagement", "Valentine", "Wedding Photo"]
  },
  "/blog/world-cup-fan-photos-photo-package-guide": {
    entityName: "AI soccer fan photos",
    productSlug: "soccer",
    userIntent: "Plan a generic soccer match-day poster without official marks or player likenesses.",
    suitableUses: ["personal supporter portraits", "generic match-day posters", "private fan concepts"],
    unsuitableUses: ["official tournament or club promotion", "unapproved team, sponsor, or player depiction"],
    inputRequirements: ["clear supporter portrait", "generic colors or invented details", "poster crop and text-safe space"],
    verifiedLimitations: ["Generated crests, text, uniforms, and player-like faces require review and removal when unauthorized."],
    comparisonTargets: ["Soccer", "Avatar", "Content policy"],
    reviewChecklist: ["generic wording", "no crests", "no sponsors", "no player likeness", "poster crop"],
    rightsWarnings: ["Use generic Soccer language and obtain written brand/IP approval before any migration or release."],
    relatedGuides: ["Soccer", "Avatar", "Content policy"]
  },
  "/blog/profile-cards-photo-package-guide": {
    entityName: "Profile card photo workflow",
    productSlug: "avatar",
    userIntent: "Create a consistent profile-card image set for approved personal or creator uses.",
    suitableUses: ["profile cards", "creator introductions", "private identity moodboards"],
    unsuitableUses: ["government IDs", "impersonation", "representing another person without permission"],
    inputRequirements: ["clear current portrait", "target card crop", "approved name or role copy added separately"],
    verifiedLimitations: ["Generated text, identity details, and crop suitability require review."],
    comparisonTargets: ["Avatar", "Headshot", "Portrait Retouch"],
    reviewChecklist: ["face consistency", "card crop", "text-safe space", "hands and hair", "disclosure"],
    rightsWarnings: ["Use only approved portraits and add factual profile copy in a separate design step."],
    relatedGuides: ["Avatar", "Headshot", "Portrait Retouch"]
  }
};

function articleFactsFor(slug) {
  const facts = mydreamshootsArticleFacts[slug] ?? {};
  return {
    authorUrl: "/about-us",
    reviewOwner: "myDreamshoots editorial team",
    reviewedAt: "2026-08-18",
    evidenceDate: "2026-08-18",
    evidenceType: "editorial-guidance",
    ...clone(facts)
  };
}

function makePriorityBlogArticle(input) {
  const idSlug = input.slug.replace(/^\/blog\//, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return {
    id: `${MYDREAMSHOOTS_SITE_ID}_blog_theme_${idSlug}`,
    pageTitle: input.pageTitle,
    author: "myDreamshoots editorial team",
    authorType: "Organization",
    publishedAt: "2026-07-28",
    updatedAt: "2026-08-18",
    readMinutes: input.readMinutes ?? "7",
    primaryCta: "Browse AI photo packages",
    primaryHref: "/ai-image-generation",
    secondaryCta: "View pricing",
    secondaryHref: "/pricing",
    ...articleFactsFor(input.slug),
    ...input
  };
}

const mydreamshootsPriorityArticleOverrides = new Map([
  makePriorityBlogArticle({
    slug: "/blog/profile-cards-photo-package-guide",
    pageTitle: "Profile card photo guide",
    title: "Profile Card Photos: Plan a Consistent Image Set for Personal and Creator Uses",
    summary: "Plan profile-card portraits around one approved identity, a clear crop, and factual copy added after image review. Use the Avatar package for visual concepts, not official identification.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/profile-cards/profile-cards-01.webp?v=20260715b",
    imageAlt: "Profile-card portrait concept with a clear face, simple background, and crop-ready framing.",
    tags: "Profile card photos|Avatar package|Creator profiles|Identity-safe planning",
    targetLabel: "Open Avatar",
    targetHref: "/ai-image-generation/avatar",
    relatedLinks: [
      { label: "Explore Avatar profile formats", href: "/ai-image-generation/avatar" },
      { label: "Read the Headshot guide", href: "/blog/headshot-photo-package-guide" },
      { label: "Compare Portrait Retouch", href: "/ai-image-generation/portrait-retouch" }
    ],
    seoTitle: "Profile card photo planning guide | myDreamshoots",
    seoDescription: "Plan consistent profile-card portraits through Avatar, then review identity, crop, text-safe space, permissions, and disclosure before publishing.",
    seoKeywords: "profile card photos, Avatar profile portraits, creator profile image, identity-safe AI photos, profile crop guide",
    body: html`
      <p>A profile card has a narrow job: help a viewer recognize the approved person and understand the context around the image. Use this guide when you need a small set of consistent portrait concepts for a creator introduction, personal profile, or private moodboard. The Avatar package supplies the visual direction; factual name, role, and contact copy should be added separately after review.</p>
      <h2 id="profile-card-define-use">Define the profile-card use first</h2>
      <p>Write down where the image will appear before choosing a crop. A square profile card needs immediate face recognition. A vertical creator card can show more shoulder or wardrobe context. A website header may need negative space for approved copy. The same generated portrait can fail one format and work well in another, so the card dimensions belong in the brief.</p>
      <p>Keep the use personal or creator-focused. Do not treat an AI portrait as a government ID, identity verification document, employment credential, or proof that another person approved the profile. If the card represents a team or organization, confirm the depicted person's permission and add factual text outside the image workflow.</p>
      <h2 id="profile-card-source-photos">Prepare one stable identity base</h2>
      <p>Use current, clear portraits with a visible face, hairline, and natural expression. A close portrait supports identity review; a half-body image can help with shoulders, posture, and clothing. Avoid mixing heavily filtered selfies, old life stages, sunglasses, group photos, and different people in one request. The profile-card workflow is easier to judge when the source evidence points to one person.</p>
      <p>Choose only photos you own or have permission to use. If a creator or teammate supplies the source, keep the approval record with the project. The page does not verify ownership for you, and a private gallery does not remove the need for consent.</p>
      <h2 id="profile-card-crop-and-background">Plan the crop and background together</h2>
      <table><thead><tr><th>Card need</th><th>Planning cue</th><th>Review focus</th></tr></thead><tbody><tr><td>Square profile</td><td>Face-forward framing and quiet background.</td><td>Recognition at small size, eye line, and edge crop.</td></tr><tr><td>Creator introduction</td><td>Shoulder or half-body room for personality.</td><td>Expression, wardrobe, and text-safe area.</td></tr><tr><td>Website header</td><td>Wide composition with approved negative space.</td><td>Subject placement, readability, and responsive crop.</td></tr><tr><td>Private moodboard</td><td>Several related crops with one visual identity.</td><td>Consistency across background, light, and expression.</td></tr></tbody></table>
      <p>Keep background detail subordinate to the face. A busy scene can make the card look energetic, but it can also make the person hard to identify or leave no space for factual copy. If the image will carry text, generate clean space and add the final words in a design tool rather than trusting generated lettering.</p>
      <h2 id="profile-card-avatar-comparison">Choose Avatar, Headshot, or Portrait Retouch</h2>
      <p>Use <a href="/ai-image-generation/avatar">Avatar</a> when the profile image needs a recognizable but stylized format. Use <a href="/ai-image-generation/headshot">Headshot</a> when professional restraint matters more than a card concept. Use <a href="/ai-image-generation/portrait-retouch">Portrait Retouch</a> when the source is already sharp and the main need is controlled cleanup. Review the live product cards for current outputs and credit cost before starting.</p>
      <h2 id="profile-card-review">Review identity and card safety</h2>
      <p>Review the full image at the final card size, then inspect it at 100 percent. Attractive lighting cannot compensate for a changed face, invented text, or a crop that removes the recognisable features a profile needs.</p>
      <ul><li>Compare eyes, face shape, hairline, expression, and skin tone with the approved source.</li><li>Check hands, glasses, jewelry, collars, and hair edges for impossible joins.</li><li>Inspect background text, logos, badges, and invented credentials.</li><li>Confirm the crop leaves room for approved name or role copy if the design needs it.</li><li>Make sure the image does not imply an official ID, employer endorsement, or identity verification.</li><li>Keep the original source and note which output was selected for the card.</li></ul>
      <h2 id="profile-card-copy-boundary">Add factual copy after image review</h2>
      <p>Keep generated imagery and factual profile information separate. Add a verified name, role, link, or contact detail in the layout system after the portrait passes review. Do not ask the image model to invent a company title, credential, phone number, or brand mark. If the profile is sponsored or materially AI-edited, follow the destination's disclosure rules.</p>
      <h2 id="profile-card-faq">Profile card photo FAQ</h2>
      <h3 id="profile-card-faq-id">Can I use the image as an official ID?</h3>
      <p>No. Treat it as a creative profile image, not an identity document or verification record. Follow the receiving service's real-photo requirements.</p>
      <h3 id="profile-card-faq-text">Should I generate the words inside the image?</h3>
      <p>Use generated space for the layout and add final names, roles, dates, and links in a design tool. Generated text can be inaccurate or unreadable.</p>
      <h3 id="profile-card-faq-people">Can I make a card for another person?</h3>
      <p>Only with that person's permission and an approved source photo. Do not use the workflow to impersonate someone or imply that they endorsed a profile.</p>
      <p>A strong profile-card workflow is a small editorial system: approved source, clear format, visual review, and factual copy added with care. Use the private gallery to compare options before publishing any card.</p>
    `
  }),
  makePriorityBlogArticle({
    slug: "/blog/cyberpunk-photo-package-guide",
    pageTitle: "Cyberpunk AI photo guide",
    title: "Cyberpunk AI Photos: Neon Styles, Source Photos, and a Review Checklist",
    summary: "Learn how to plan a cyberpunk portrait with neon city lighting, futuristic wardrobe cues, and a focused set of source photos. Compare nearby city styles, then review the result before downloading.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/cyberpunk/cyberpunk-01.webp?v=20260715b",
    imageAlt: "Neon-lit cyberpunk portrait with magenta and cyan city lighting.",
    tags: "Cyberpunk AI photos|Neon portrait|Source photo planning|Private gallery",
    targetLabel: "Open Cyberpunk",
    targetHref: "/ai-image-generation/cyberpunk",
    relatedLinks: [
      { label: "Read the Mafia-style photo guide", href: "/blog/mafia-photo-package-guide" },
      { label: "Read the Gala Photos guide", href: "/blog/gala-photos-photo-package-guide" },
      { label: "Explore Nightlife portraits", href: "/ai-image-generation/nightlife" }
    ],
    seoTitle: "Cyberpunk private AI photo guide | myDreamshoots",
    seoDescription: "Plan neon cyberpunk portraits with focused source photos, futuristic wardrobe cues, nearby style comparisons, and a practical artifact review checklist.",
    seoKeywords: "cyberpunk AI photos, neon portrait guide, futuristic portrait, cyberpunk source photos, neon city portrait checklist",
    body: html`
      <p>Cyberpunk works when the person remains recognizable while the scene makes a deliberate jump into a futuristic city. The strongest brief does not ask for every science-fiction idea at once. It chooses a visible story world, supports it with suitable source photos, and gives you a clear standard for deciding which results are ready to keep.</p>
      <h2 id="cyberpunk-choose-direction">Choose one visible cyberpunk direction</h2>
      <p>Choose Cyberpunk when you want a high-contrast portrait built around neon signs, rain-lit streets, metallic textures, holographic accents, or dramatic magenta-and-cyan lighting. A natural professional portrait or a daylight lifestyle image needs a less stylized package. Naming the visual direction first prevents the scene from becoming a random collection of futuristic details.</p>
      <p>Useful directions include a neon alley, futuristic skyline, techwear portrait, holographic studio, or cinematic night scene. Pick one as the main idea. A restrained palette, one lighting reference, and one wardrobe cue usually make the request easier to judge than several competing references.</p>
      <h2 id="cyberpunk-source-photos">Prepare source photos and wardrobe cues</h2>
      <p>Start with current, unfiltered portraits that clearly show the face, hairline, and useful angles. Avoid sunglasses, strong beauty filters, heavy colored light, or deep shadows that hide identity before the cyberpunk treatment begins. Use only photos you own or have permission to use.</p>
      <p>Then add a wardrobe direction that belongs to the chosen world: clean techwear layers, metallic accents, a structured jacket, or a simple dark silhouette. The clothing reference should support the portrait instead of competing with it. Do not combine neon streetwear, corporate headshots, fantasy armor, and vintage film in one brief.</p>
      <h2 id="cyberpunk-compare-city-styles">Compare Cyberpunk with nearby city styles</h2>
      <table><thead><tr><th>Choice</th><th>Main visual idea</th><th>Choose it when</th></tr></thead><tbody><tr><td>Cyberpunk</td><td>Futuristic city scenes, neon contrast, and techwear details</td><td>The science-fiction layer is central to the portrait.</td></tr><tr><td>Urban</td><td>Contemporary streets, rooftops, alleys, and transit settings</td><td>You want a modern city portrait without futuristic styling.</td></tr><tr><td>Nightlife</td><td>Present-day club, event, or evening light</td><td>The mood should feel social and current rather than fictional.</td></tr><tr><td>Headshot</td><td>Clean professional framing with minimal scene narrative</td><td>Professional presentation matters more than the setting.</td></tr></tbody></table>
      <p>Compare <a href="/ai-image-generation/cyberpunk">Cyberpunk</a> with <a href="/ai-image-generation/urban">Urban</a> and <a href="/ai-image-generation/nightlife">Nightlife</a> before starting. The live product card shows the current output count and credit cost, so the guide does not preserve numbers that may later change.</p>
      <h2 id="cyberpunk-review-checklist">Review neon, identity, and scene artifacts</h2>
      <p>A convincing result should keep the person recognizable while making the selected futuristic direction visible. Review the full image and then zoom in. Neon can create believable atmosphere, but it can also hide errors or introduce colored edges that look unnatural against skin and clothing.</p>
      <ul><li>Check neon spill across the face, teeth, eyes, and hair.</li><li>Inspect signs and background text for invented or broken lettering.</li><li>Review eyewear, jewelry, cables, and metallic accessories for impossible joins.</li><li>Check fingers, garment closures, reflective surfaces, and repeated architecture.</li><li>Confirm that the final crop still reads clearly at the size where you will use it.</li></ul>
      <h2 id="cyberpunk-keep-claims-clear">Keep the fictional scene easy to explain</h2>
      <p>Treat the city and technology as generated creative elements. Do not present a fictional venue, brand, product, or event as real. If you publish the image in a context where material AI edits must be disclosed, follow the destination platform's rules. Keep the original source photos and review the private gallery before downloading favorites.</p>
      <h2 id="cyberpunk-faq">Cyberpunk photo FAQ</h2>
      <h3 id="cyberpunk-faq-first-photo">What source photo works best?</h3>
      <p>Use a sharp, recent portrait with a readable face and hairline. Neutral or simple light gives the generated neon direction room to work without fighting an existing filter.</p>
      <h3 id="cyberpunk-faq-neon">Should I provide several neon references?</h3>
      <p>One focused lighting reference is easier to follow and review. Several references with different color palettes, eras, and scene types can pull the image in competing directions.</p>
      <h3 id="cyberpunk-faq-download">What should I check before downloading?</h3>
      <p>Check identity first, then neon spill, hands, accessories, garment edges, reflections, background text, and the intended crop. Keep only images whose futuristic scene remains coherent at normal viewing size.</p>
    `
  }),
  makePriorityBlogArticle({
    slug: "/blog/mafia-photo-package-guide",
    pageTitle: "Mafia-style AI photo guide",
    title: "Mafia-Style AI Photos: Wardrobe, Lighting, and Scene Guide",
    summary: "Plan a fictional cinematic character portrait with tailored wardrobe, low-key interior lighting, and a restrained noir scene. Prepare source photos and review the details that make the result believable.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/mafia/mafia-01.webp?v=20260715b",
    imageAlt: "Moody noir portrait of a man in a dark suit seated beside window blinds.",
    tags: "Mafia-style AI photos|Noir portrait|Wardrobe planning|Permission-safe portraits",
    targetLabel: "Open Mafia",
    targetHref: "/ai-image-generation/mafia",
    relatedLinks: [
      { label: "Read the Cyberpunk photo guide", href: "/blog/cyberpunk-photo-package-guide" },
      { label: "Read the Gala Photos guide", href: "/blog/gala-photos-photo-package-guide" },
      { label: "Explore Nightlife portraits", href: "/ai-image-generation/nightlife" }
    ],
    seoTitle: "Mafia AI photo planning guide | myDreamshoots",
    seoDescription: "Plan a fictional Mafia-style noir portrait with tailored wardrobe, controlled interior light, permission-safe source photos, and a detailed review checklist.",
    seoKeywords: "Mafia-style AI photos, noir portrait guide, cinematic character portrait, tailored suit AI portrait, fictional noir scene",
    body: html`
      <p>This guide treats Mafia as a fictional, cinematic style rather than a statement about a real person. The goal is a restrained noir portrait: tailored clothing, controlled interior light, a believable setting, and enough visual discipline that the person remains more important than the props.</p>
      <h2 id="mafia-build-fictional-noir">Build a fictional noir character, not a real-world claim</h2>
      <p>Choose the Mafia style when you want a character portrait built around dark interiors, controlled window light, serious posture, and classic tailoring. The image can borrow the visual language of crime films without claiming that the source person belongs to a criminal organization. Do not use the finished image as evidence of real affiliation, conduct, or history.</p>
      <p>Keep the concept simple enough to explain in one sentence, such as a private-room portrait beside window blinds or an understated evening character in a wood-paneled interior. A neutral business image belongs in Headshot. Contemporary luxury without crime-film framing belongs closer to Rich Lifestyle.</p>
      <h2 id="mafia-wardrobe-scene">Coordinate wardrobe, light, and interior</h2>
      <p>Use current, unfiltered portraits with a clear view of the face and hairline. Then choose one wardrobe direction: three-piece suit, overcoat, or understated evening tailoring. Pair it with one interior cue such as wood paneling, window blinds, a dim private room, or a quiet bar-like setting. Keep props secondary to the person.</p>
      <p>Low-key lighting should still leave enough detail around the eyes, hands, lapels, and background objects to review the result. Multiple hero props, several historical eras, or conflicting hat and suit references can turn a focused portrait into an inconsistent costume scene.</p>
      <h2 id="mafia-nearby-styles">Decide between noir, luxury, nightlife, and headshots</h2>
      <table><thead><tr><th>Direction</th><th>Defining cues</th><th>Best fit</th></tr></thead><tbody><tr><td>Mafia style</td><td>Fictional noir character, tailored wardrobe, moody interiors</td><td>A cinematic portrait with a clear period-film mood.</td></tr><tr><td>Rich Lifestyle</td><td>Contemporary luxury, polished spaces, modern status cues</td><td>Luxury is the goal without crime-film framing.</td></tr><tr><td>Nightlife</td><td>Modern club or event light and social energy</td><td>The scene should feel current and event-led.</td></tr><tr><td>Headshot</td><td>Neutral background and professional restraint</td><td>The image needs to support work-facing identity.</td></tr></tbody></table>
      <p>Open the live <a href="/ai-image-generation/mafia">Mafia package</a> to review its current output count and credit cost. Those values stay on the product card rather than being copied into this guide.</p>
      <h2 id="mafia-private-review">Review tailoring, props, and shadow detail</h2>
      <p>Start with identity and expression. Then check the visual details that make a dark interior believable. Deep contrast can conceal errors, so compare the face and hands at normal size and close up before selecting a favorite.</p>
      <ul><li>Inspect lapels, ties, buttons, pockets, and hat brims for broken geometry.</li><li>Check fingers around glasses, chairs, cards, or other props.</li><li>Review smoke, glass, mirrors, and window reflections for repeated or impossible shapes.</li><li>Confirm that both eyes remain readable and that shadows do not change identity.</li><li>Look for warped furniture, duplicated objects, and inconsistent light direction.</li></ul>
      <h2 id="mafia-faq">Mafia-style portrait FAQ</h2>
      <h3 id="mafia-faq-identity">Can the image imply a real criminal identity?</h3>
      <p>No. Keep the request fictional and style-led. A generated character portrait should not be used to claim that a real person belongs to an organization or took part in criminal activity.</p>
      <h3 id="mafia-faq-props">How many props should I request?</h3>
      <p>Use as few as the scene needs. One restrained prop can support the noir direction; several hero props compete with the person and create more places for visual artifacts.</p>
      <h3 id="mafia-faq-source">What source photos should I use?</h3>
      <p>Choose clear, recent photos you are authorized to use. A readable face, hairline, and natural expression provide a stronger identity base than filtered or heavily shadowed images.</p>
    `
  }),
  makePriorityBlogArticle({
    slug: "/blog/magic-upscaler-photo-package-guide",
    pageTitle: "Magic Upscaler and Photo Enhancer guide",
    title: "Magic Upscaler Guide: Improve Clarity Without Overprocessing Your Photo",
    summary: "Magic Upscaler is available in myDreamshoots as the Photo Enhancer package. Learn which original file to use, what enhancement cannot recover, and how to spot false detail before downloading.",
    imageUrl: "/assets/dreamshoot/generated/20260622-pack-fill/magic-upscaler-pack.webp?v=20260803blogsafe1",
    imageAlt: "Before-and-after portrait preview comparing a softer source image with an enhanced result.",
    tags: "Magic Upscaler|Photo Enhancer|Image clarity|Artifact review",
    targetLabel: "Open Photo Enhancer",
    targetHref: "/ai-image-generation/photo-enhancer",
    relatedLinks: [
      { label: "Open Photo Enhancer", href: "/ai-image-generation/photo-enhancer" },
      { label: "Compare Unblur Image", href: "/ai-image-generation/unblur-image" },
      { label: "Compare Old Photo Restoration", href: "/ai-image-generation/old-photo-restoration" }
    ],
    seoTitle: "Magic Upscaler and Photo Enhancer | myDreamshoots",
    seoDescription: "Use Magic Upscaler through Photo Enhancer, choose the cleanest original, understand enhancement limits, and check halos, false texture, and identity changes.",
    seoKeywords: "Magic Upscaler, Photo Enhancer guide, improve photo clarity, image enhancement artifacts, upscaling review checklist",
    body: html`
      <p>Use Magic Upscaler when a valuable photo is soft, dark, compressed, or too small for its intended display. In myDreamshoots, this workflow is available through the Photo Enhancer package. The job is not to invent a new scene; it is to improve perceived clarity while protecting identity and believable detail.</p>
      <h2 id="upscaler-choose-original">Start with the cleanest available original</h2>
      <p>Choose the original camera file or highest-quality export you can find. A screenshot, messaging-app copy, or social-media download may already contain compression, resizing, and sharpening artifacts. Enhancement can make those defects more visible. Keep an untouched copy so every result can be compared against the same source.</p>
      <p>Check that the face or subject still contains real edges and tonal variation. Crop only when the final use requires it. If the image is severely blurred, physically damaged, or already sharp but needs portrait cleanup, another tool may match the defect more closely.</p>
      <h2 id="upscaler-capability-boundary">Understand what enhancement cannot recover</h2>
      <p>Enhancement can improve perceived clarity and readability, but it cannot guarantee recovery of detail that is absent from the source. Newly sharpened facial features, text, jewelry, hair, fabric, and background patterns may be generated interpretation. Compare them with the original instead of assuming that every crisp edge is historically or physically accurate.</p>
      <blockquote>Use the result as an enhanced version for review, not as proof that missing source detail was recovered exactly.</blockquote>
      <h2 id="upscaler-compare-tools">Match the tool to the source defect</h2>
      <table><thead><tr><th>Tool</th><th>Use it when</th><th>Review closely</th></tr></thead><tbody><tr><td>Photo Enhancer</td><td>General clarity, brightness, and download quality need improvement.</td><td>Overall sharpness, tone, noise, and natural texture.</td></tr><tr><td>Unblur Image</td><td>Motion or focus blur is the main visible defect.</td><td>Face edges, double contours, and invented fine detail.</td></tr><tr><td>Old Photo Restoration</td><td>Age-related damage, fading, scratches, or missing areas are central.</td><td>Whether repaired areas remain plausible and clearly interpreted.</td></tr><tr><td>Portrait Retouch</td><td>The original is already sharp and needs controlled portrait cleanup.</td><td>Skin texture, identity, and signs of over-smoothing.</td></tr></tbody></table>
      <p>Review the live <a href="/ai-image-generation/photo-enhancer">Photo Enhancer package card</a> for the current output count and credit cost before starting. Do not rely on a number copied from an older article.</p>
      <h2 id="upscaler-compare-at-100">Compare the result at 100 percent and normal size</h2>
      <p>Inspect at 100 percent to find local artifacts, then return to the normal display size to judge whether the image actually looks better. Excess sharpening can seem impressive while zoomed in but create harsh skin, glowing edges, or noisy backgrounds in normal use.</p>
      <ul><li>Compare skin texture, eyelashes, teeth, hair strands, and expression.</li><li>Inspect text, jewelry, straight edges, and repeating background patterns.</li><li>Look for ringing halos, false texture, oversharpened noise, and color shifts.</li><li>Confirm that identity and facial proportions did not change.</li><li>Review the exact crop and display size where the file will be used.</li></ul>
      <h2 id="upscaler-keep-original">Keep the original and record the intended use</h2>
      <p>Do not overwrite the only source file. Store the original beside the enhanced version and name the intended use, such as profile crop, larger display, personal archive, or cleaner download. If factual detail matters, treat the original as the reference and the enhanced file as an edited derivative.</p>
      <h2 id="upscaler-faq">Photo enhancement FAQ</h2>
      <h3 id="upscaler-faq-suitable">When is a photo suitable for enhancement?</h3>
      <p>A photo is a reasonable candidate when the subject remains identifiable and real edges or tonal detail are still present. A severely damaged or missing subject may require restoration rather than general enhancement.</p>
      <h3 id="upscaler-faq-original">Should I upload the original or a social-media copy?</h3>
      <p>Upload the highest-quality original available. Social copies and screenshots often contain compression artifacts that become more visible after sharpening.</p>
      <h3 id="upscaler-faq-review">What details should I compare afterward?</h3>
      <p>Compare identity, skin, hair, eyes, teeth, text, straight edges, repeating textures, noise, and halos. Keep the original open during review so new detail is not mistaken for recovered fact.</p>
    `
  }),
  makePriorityBlogArticle({
    slug: "/blog/nature-photo-package-guide",
    pageTitle: "Nature AI portrait guide",
    title: "Nature AI Portraits: Plan Forest, Mountain, and Lakeside Scenes",
    summary: "Nature scenes are available through the Travel package. Plan one believable outdoor setting, prepare portraits that fit the intended light and clothing, and review the generated landscape before sharing.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/nature/nature-01.webp?v=20260715b",
    imageAlt: "Outdoor portrait on a mountain trail with warm backlight at golden hour.",
    tags: "Nature AI portraits|Travel package|Outdoor portrait planning|Generated landscape",
    targetLabel: "Open Travel and choose a nature setting",
    targetHref: "/ai-image-generation/travel",
    relatedLinks: [
      { label: "Open Travel portraits", href: "/ai-image-generation/travel" },
      { label: "Read the Outdoor Creator guide", href: "/blog/outdoor-creator-scenes-photo-package-guide" },
      { label: "Explore Urban portraits", href: "/ai-image-generation/urban" }
    ],
    seoTitle: "Nature AI portrait planning guide | myDreamshoots",
    seoDescription: "Plan forest, mountain, lakeside, or meadow portraits through Travel, coordinate source photos with outdoor light, and review generated landscape artifacts.",
    seoKeywords: "nature AI portraits, forest portrait guide, mountain portrait, lakeside AI photo, Travel nature setting, outdoor portrait checklist",
    body: html`
      <p>Nature scenes are available in myDreamshoots through the Travel package. Use this guide when a forest path, alpine trail, mountain lake, or open meadow should lead the mood of a portrait. The setting is generated creative imagery, so the page focuses on visual planning rather than claiming a real trip or location.</p>
      <h2 id="nature-pick-setting">Pick one landscape, season, and time of day</h2>
      <p>Choose one natural environment as the main idea. A forest path can support soft filtered light and close framing. An alpine trail calls for open scale, practical clothing, and a readable horizon. A mountain lake adds reflections that require careful review. A meadow can support wider poses and warm evening light.</p>
      <p>Then choose one season and one time of day. Clothing, hair, shadows, and apparent weather should agree. A heavy coat in a bright summer meadow or dry ground beneath a rainy sky can make the person and landscape feel assembled from unrelated sources.</p>
      <h2 id="nature-source-light">Prepare portraits that fit outdoor light</h2>
      <p>Use clear, current portraits with natural expression and enough shoulder or body framing for the intended composition. Avoid strong indoor color casts, clipped hair, or heavy portrait filters. Select simple clothing whose color and weight make sense for the terrain and weather. Use only source photos you own or have permission to use.</p>
      <p>Nature is landscape-led. If the purpose is a destination or route story across cities, coastlines, and resorts, use Travel more broadly. If the setting mainly supports a personal brand or publishing format, the Outdoor Creator guide provides a different decision process.</p>
      <h2 id="nature-compare-intent">Separate landscape, destination, and creator intent</h2>
      <table><thead><tr><th>Direction</th><th>Primary idea</th><th>Use it for</th></tr></thead><tbody><tr><td>Nature</td><td>The landscape and outdoor mood lead the portrait.</td><td>Forest, mountain, lake, or meadow imagery.</td></tr><tr><td>Travel</td><td>The image tells a destination or route story.</td><td>City, coast, resort, old-town, or scenic route concepts.</td></tr><tr><td>Outdoor Creator</td><td>The setting supports a publishing channel or personal brand.</td><td>Profiles, stories, feed portraits, headers, and campaign drafts.</td></tr><tr><td>Urban</td><td>A contemporary city environment is the visual anchor.</td><td>Streets, rooftops, alleys, transit, and modern creator scenes.</td></tr></tbody></table>
      <p>Open <a href="/ai-image-generation/travel">Travel</a> and choose a nature setting. Check the live product card for current outputs and credit cost before generating.</p>
      <h2 id="nature-location-boundary">Treat the landscape as generated</h2>
      <p>Do not present a generated mountain, trail, lake, resort, landmark, or wildlife encounter as proof that the person visited a real place. For documentary or commercial location claims, use a real photograph and disclose material AI edits where the context requires it. Avoid naming a specific real location unless the workflow and source material support that claim.</p>
      <h2 id="nature-review-landscape">Review how the person and landscape meet</h2>
      <ul><li>Check horizon level, path continuity, and believable subject scale.</li><li>Inspect repeated trees, rocks, flowers, snow, and shoreline patterns.</li><li>Review water reflections, shadows under the person, and light direction.</li><li>Check hair and clothing edges against detailed foliage.</li><li>Inspect hands around backpacks, rails, walking poles, or other outdoor gear.</li><li>Confirm that clothing and apparent weather make sense together.</li></ul>
      <h2 id="nature-faq">Nature portrait FAQ</h2>
      <h3 id="nature-faq-travel">Why does the Nature guide open Travel?</h3>
      <p>Nature is a setting direction available through the Travel package. The live Travel card is the source for current package details and credit cost.</p>
      <h3 id="nature-faq-location">Can I name the generated landscape as a real place?</h3>
      <p>Not unless a verified workflow supports that location. Treat the background as generated and avoid using it as evidence of a real visit, booking, or wildlife encounter.</p>
      <h3 id="nature-faq-source">What source photos work for outdoor portraits?</h3>
      <p>Use clear, current portraits with natural expression and enough framing for the intended scene. Clothing, light, season, and apparent weather should support the same outdoor direction.</p>
    `
  }),
  makePriorityBlogArticle({
    slug: "/blog/outdoor-creator-scenes-photo-package-guide",
    pageTitle: "Outdoor creator photo guide",
    title: "Outdoor Creator Photos: Urban Streets vs Scenic Locations",
    summary: "Choose an outdoor direction based on the content you need: Urban for city creator profiles or Travel for scenic locations. Plan the crop, background space, wardrobe, and disclosure before generating.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/outdoor-creator-scenes/outdoor-creator-scenes-01.webp?v=20260715b",
    imageAlt: "Outdoor creator portrait of a woman on a beach with sea and cliffs behind her.",
    tags: "Outdoor creator photos|Urban portraits|Travel portraits|Creator content planning",
    targetLabel: "Explore Urban creator scenes",
    targetHref: "/ai-image-generation/urban",
    secondaryTargetLabel: "Explore scenic Travel portraits",
    secondaryTargetHref: "/ai-image-generation/travel",
    relatedLinks: [
      { label: "Explore Urban creator scenes", href: "/ai-image-generation/urban" },
      { label: "Explore scenic Travel portraits", href: "/ai-image-generation/travel" },
      { label: "Read the Nature portrait guide", href: "/blog/nature-photo-package-guide" }
    ],
    seoTitle: "Outdoor creator photos: Urban vs Travel | myDreamshoots",
    seoDescription: "Compare Urban streets with scenic Travel locations for creator photos, then plan channel, crop, negative space, brand safety, and publication review.",
    seoKeywords: "outdoor creator photos, Urban vs Travel portraits, creator profile photos, scenic creator portraits, social media crop planning",
    body: html`
      <p>Outdoor Creator Scenes is a comparison guide, not a separate product package. Choose Urban when city streets and modern creator profiles are central. Choose Travel when coast, mountain, resort, or route-story scenery should shape the image. Start with the publishing destination so the scene and crop serve a real use.</p>
      <h2 id="outdoor-name-channel">Name the publishing channel before choosing a scene</h2>
      <p>Decide whether the image is for a profile avatar, vertical story, feed portrait, newsletter header, landing-page hero, or campaign draft. A square avatar needs immediate face recognition and a quiet background. A vertical story needs body framing that survives interface overlays. A header needs width and safe negative space for approved copy.</p>
      <p>Choose whether the final frame needs face-forward impact, full-body context, or room for text. This decision belongs before generation because a visually strong portrait can still fail when the subject is covered by navigation, captions, or platform controls.</p>
      <h2 id="outdoor-urban-travel">Choose Urban or Travel based on the main promise</h2>
      <table><thead><tr><th>Direction</th><th>Scene language</th><th>Creator use</th></tr></thead><tbody><tr><td>Urban</td><td>City street, rooftop, subway, alley, and contemporary architecture</td><td>Modern profiles, editorial posts, streetwear, and city-led campaigns.</td></tr><tr><td>Travel</td><td>Coast, mountain route, resort, old city, and scenic location</td><td>Destination-style stories, lifestyle headers, and scenic personal-brand concepts.</td></tr><tr><td>Nature guide</td><td>Forest, mountain, lake, or meadow where landscape leads</td><td>Outdoor portraits whose environment matters more than a campaign format.</td></tr></tbody></table>
      <p>Use the live <a href="/ai-image-generation/urban">Urban</a> or <a href="/ai-image-generation/travel">Travel</a> product card to review current outputs and credit cost. The guide does not copy those changing values.</p>
      <h2 id="outdoor-source-brand">Prepare source photos and remove unapproved brand claims</h2>
      <p>Use current portraits with the expression and body framing required by the destination channel. Choose one setting and simple wardrobe that separates clearly from the background. Remove unlicensed logos, venue marks, product labels, or campaign claims from references unless you have permission to use them.</p>
      <p>Do not imply that a generated scene documents a real trip, venue booking, brand partnership, or city endorsement. Signs, landmarks, products, and background text need review before publication. Follow the destination platform's AI disclosure rules when material edits must be identified.</p>
      <h2 id="outdoor-review-size">Review the image at its real publishing size</h2>
      <ul><li>Check face and hand detail at the final crop size.</li><li>Review subject-to-background scale, perspective, horizon, and shadows.</li><li>Inspect hair edges, repeated architecture, foliage, signs, and logos.</li><li>Confirm there is safe space for copy without covering the subject.</li><li>Preview the image behind expected interface overlays.</li><li>Check that a generated location or partnership is not implied as real.</li></ul>
      <h2 id="outdoor-copy-later">Add verified text after generation</h2>
      <p>Generate a clean scene first. Add headlines, dates, calls to action, and campaign copy later in a design tool where spelling and placement can be controlled. This also separates the visual concept from factual or commercial claims that require approval.</p>
      <h2 id="outdoor-faq">Outdoor creator FAQ</h2>
      <h3 id="outdoor-faq-product">Is Outdoor Creator Scenes a separate product?</h3>
      <p>No. Use this page to decide between Urban and Travel based on whether a city or scenic location better supports the final creator use.</p>
      <h3 id="outdoor-faq-avatar">Which direction works for a profile avatar?</h3>
      <p>Either can work if the face remains legible at square size. Choose the scene whose background stays quiet enough to support recognition rather than competing with it.</p>
      <h3 id="outdoor-faq-claim">Can I describe the scene as a real trip or partnership?</h3>
      <p>Do not make that claim from a generated image. Use real evidence for travel, venue, or partnership statements and disclose material AI edits where required.</p>
      <h3 id="outdoor-faq-review">What should I preview before publishing?</h3>
      <p>Preview the final crop, interface overlays, text-safe space, face and hands, background signs, logos, landmarks, perspective, and any detail that could imply a real endorsement.</p>
    `
  }),
  makePriorityBlogArticle({
    slug: "/blog/valentine-photos-photo-package-guide",
    pageTitle: "Valentine's Day AI photo guide",
    title: "Valentine's Day AI Photos: Couple Portraits, Cards, and Gifts",
    summary: "Plan a Valentine's Day portrait for a private gift, date-night card, anniversary note, or social post. Choose one person or a couple, use approved photos, and leave message space for later.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/valentine-photos/valentine-photos-01.webp?v=20260715b",
    imageAlt: "Close Valentine's Day portrait of a smiling couple with a glowing red heart decoration.",
    tags: "Valentine's Day photos|Couple portraits|Romantic cards|Consent",
    targetLabel: "Open Valentine's Day Photos",
    targetHref: "/ai-image-generation/valentines-photo",
    relatedLinks: [
      { label: "Read the Engagement photo guide", href: "/blog/engagement-photo-package-guide" },
      { label: "Read the Wedding portrait guide", href: "/blog/wedding-portraits-photo-package-guide" },
      { label: "Open Valentine's Day Photos", href: "/ai-image-generation/valentines-photo" }
    ],
    seoTitle: "Valentine's Day AI photo guide | myDreamshoots",
    seoDescription: "Plan Valentine's Day couple portraits, cards, gifts, or social posts with approved source photos, clear consent, text-safe crops, and a focused review.",
    seoKeywords: "Valentine's Day AI photos, couple portrait guide, romantic AI card, Valentine's gift photo, consent for couple photos",
    body: html`
      <p>Plan a Valentine's Day portrait around one purpose: a private gift, date-night card, anniversary note, or social post. Decide whether the image features one person or a couple, confirm that every source photo is approved, and leave space for any message that will be added after generation.</p>
      <h2 id="valentine-one-purpose">Choose one relationship context and final format</h2>
      <p>A warm seasonal portrait can be playful, candlelit, floral, studio-based, or outdoors. Pick one mood and one crop. A card needs text-safe space. A gift image may favor a close composition. A social post must remain readable at a smaller size. Combining an engagement announcement, wedding keepsake, date-night portrait, and generic holiday card in one request creates conflicting claims.</p>
      <p>Use standard public English such as Valentine's Day and Valentine's Day Photos. The technical URL can remain unchanged without carrying the unpunctuated form into headings, buttons, or body copy.</p>
      <h2 id="valentine-source-consent">Prepare both people and confirm consent</h2>
      <p>For a couple image, use clear, current photos of both people with compatible face angles and natural expressions. Confirm that each person approves the source images, generated pairing, intended audience, and final use. Do not use a romantic image to imply a relationship, engagement, or endorsement that the other person has not approved.</p>
      <p>Choose one mood after the source photos are settled: candlelit, floral, studio, outdoor, or playful. Describe wardrobe and color direction simply. Add long messages, names, or dates later in a design tool so spelling and placement can be verified.</p>
      <h2 id="valentine-compare-relationship">Compare seasonal, announcement, and ceremony-led images</h2>
      <table><thead><tr><th>Theme</th><th>Primary purpose</th><th>Claim to review</th></tr></thead><tbody><tr><td>Valentine's Day</td><td>Seasonal cards, date-night portraits, romantic gifts, or warm social posts</td><td>The image is seasonal and approved by everyone shown.</td></tr><tr><td>Engagement</td><td>Proposal or announcement imagery where ring and message details matter</td><td>The relationship announcement is real and approved.</td></tr><tr><td>Wedding</td><td>Formal couple portraits and ceremony-led concepts or keepsakes</td><td>The image is wedding-inspired and not false event documentation.</td></tr></tbody></table>
      <p>Review the live <a href="/ai-image-generation/valentines-photo">Valentine's Day Photos</a> card for current outputs and credit cost before starting.</p>
      <h2 id="valentine-review-couple">Review both identities and the card crop</h2>
      <ul><li>Check both faces, eye direction, expression, and relative scale.</li><li>Inspect overlapping arms, hands, fingers, jewelry, flowers, and gifts.</li><li>Review heart-shaped props, reflections, and background text.</li><li>Confirm that the card crop leaves usable space without covering either face.</li><li>Check the image at the final gift, card, or social-post size.</li><li>Confirm that everyone shown approves the selected result and audience.</li></ul>
      <h2 id="valentine-faq">Valentine's Day photo FAQ</h2>
      <h3 id="valentine-faq-one-person">Can the image feature one person?</h3>
      <p>Yes. Choose a purpose and mood that make sense for a single portrait, gift, or card rather than forcing a couple composition.</p>
      <h3 id="valentine-faq-consent">What approval is needed for a couple image?</h3>
      <p>Each person should approve the source photos, generated romantic pairing, final audience, and intended use. Do not use the image to make an unapproved relationship claim.</p>
      <h3 id="valentine-faq-text">Should the message be generated inside the image?</h3>
      <p>Generate a clean composition with text-safe space, then add verified copy in a design tool. This gives you control over spelling, dates, and placement.</p>
    `
  }),
  makePriorityBlogArticle({
    slug: "/blog/virtual-try-on-photo-package-guide",
    pageTitle: "AI Virtual Try-On guide",
    title: "AI Virtual Try-On Guide: Plan Outfits Without Treating the Preview as Exact Fit",
    summary: "Use Virtual Try-On to compare outfit direction, color, silhouette, and creator styling. Prepare a clear portrait and approved clothing reference, then treat the result as a visual concept rather than a fit guarantee.",
    imageUrl: "/assets/dreamshoot/generated/blog/virtual-try-on-workflow-cover.webp?v=20260818local1",
    imageAlt: "Three-panel virtual try-on workflow example showing a source portrait, an outfit reference, and an AI preview.",
    tags: "AI Virtual Try-On|Outfit planning|Clothing references|Fit limitation",
    targetLabel: "Open Virtual Try-On",
    targetHref: "/ai-image-generation/virtual-try-on",
    relatedLinks: [
      { label: "Open Virtual Try-On", href: "/ai-image-generation/virtual-try-on" },
      { label: "Read the Hairstyle photo guide", href: "/blog/hairstyle-photo-package-guide" },
      { label: "Compare Portrait Retouch", href: "/ai-image-generation/portrait-retouch" }
    ],
    seoTitle: "AI Virtual Try-On planning guide | myDreamshoots",
    seoDescription: "Plan outfits with AI Virtual Try-On using approved person and garment references, clear fit limits, and checks for body, fabric, logo, and identity artifacts.",
    seoKeywords: "AI Virtual Try-On guide, outfit planning AI, garment reference photo, virtual try-on fit limitation, fashion image review",
    body: html`
      <p>Use Virtual Try-On to compare outfit direction, color, silhouette, and creator styling before shopping, packing, or planning a shoot. Prepare a clearly framed portrait and a clothing reference you are allowed to use. Treat every result as a visual concept, not a promise of exact size, fabric, color, or fit.</p>
      <h2 id="tryon-prepare-person">Prepare a clear person photo</h2>
      <p>Use a front or three-quarter portrait with enough body framing to show the garment area. Prefer simple lighting, an unobstructed pose, and clothing that does not hide the shoulders, waist, or other area being changed. Hair, hands, bags, and jewelry can overlap fabric, so make sure those elements are readable in the source.</p>
      <p>Use current photos you own or have permission to use. A heavily filtered face, extreme pose, cropped garment area, or deep shadow makes it harder to judge whether the preview preserved the person and placed the clothing coherently.</p>
      <h2 id="tryon-prepare-garment">Use one approved clothing reference and styling direction</h2>
      <p>Add one clothing reference that you own or have permission to use. Describe one direction such as casual, formal, streetwear, travel, or event styling. Avoid combining several garments whose cut, layers, or branding compete. Protected logos and branded product images need appropriate rights before they are used or published.</p>
      <h2 id="tryon-not-fit-guarantee">Treat the output as a moodboard, not a fit guarantee</h2>
      <p>The preview may not reproduce a garment's exact size, cut, fabric weight, texture, transparency, color, pattern placement, closures, or drape. It cannot confirm comfort, inventory, tailoring, or how the physical item will fit. Check the seller's product page, size chart, materials, product photos, and return policy before making a purchase decision.</p>
      <table><thead><tr><th>Workflow</th><th>What changes</th><th>Use it when</th></tr></thead><tbody><tr><td>Virtual Try-On</td><td>Wardrobe direction on a person</td><td>You want a visual outfit concept, not a measurement.</td></tr><tr><td>Street Style</td><td>Clothing and a complete fashion scene</td><td>The setting matters as much as the outfit.</td></tr><tr><td>Portrait Retouch</td><td>An existing portrait without replacing the outfit</td><td>The source is already dressed correctly and needs controlled cleanup.</td></tr><tr><td>Hairstyle Generator</td><td>Hair direction rather than wardrobe</td><td>The clothing should stay secondary to a hairstyle decision.</td></tr></tbody></table>
      <p>Review the live <a href="/ai-image-generation/virtual-try-on">Virtual Try-On package card</a> for current outputs and credit cost before starting.</p>
      <h2 id="tryon-review-garment">Review garment, body, and identity artifacts</h2>
      <ul><li>Check neckline, shoulders, sleeves, cuffs, waist, hem, and closures.</li><li>Inspect pattern continuity, fabric edges, transparency, and repeated texture.</li><li>Review logos, labels, jewelry overlap, fingers, and hair over fabric.</li><li>Confirm body shape, pose, proportions, shadows, and skin remain believable.</li><li>Check that the outfit did not change identity, age, or expression.</li><li>Compare the preview with both the person photo and garment reference.</li></ul>
      <h2 id="tryon-brand-boundary">Avoid product and brand misrepresentation</h2>
      <p>Do not present a generated try-on as an exact image of a retailer's product, a verified brand collaboration, or proof of how a garment will fit. Disclose material AI changes when the publishing context requires it. The current local cover shows outfit planning beside a clothing rack; a verified source-reference-preview workflow asset remains required before this page is approved for publication.</p>
      <h2 id="tryon-faq">Virtual Try-On FAQ</h2>
      <h3 id="tryon-faq-fit">Does Virtual Try-On show exact garment fit?</h3>
      <p>No. The result is a visual planning image, not a measurement, material, color, or fit guarantee. Confirm purchase details using the physical product and seller information.</p>
      <h3 id="tryon-faq-reference">What person photo and garment reference work best?</h3>
      <p>Use a clear, simply lit portrait with enough body framing and one unobstructed clothing reference that you are authorized to use.</p>
      <h3 id="tryon-faq-retailer">Can I use a retailer's product image?</h3>
      <p>Only when you have the rights or permission required for that image and use. Do not imply an official product rendering or brand partnership from a generated preview.</p>
    `
  }),
  makePriorityBlogArticle({
    slug: "/blog/wedding-portraits-photo-package-guide",
    pageTitle: "AI Wedding portrait guide",
    title: "AI Wedding Portraits: Plan Save-the-Dates, Moodboards, and Keepsakes",
    summary: "Use Wedding Photo for save-the-date concepts, ceremony moodboards, invitation-friendly portraits, website visuals, or private keepsakes. Treat the results as creative imagery, not event documentation.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/wedding-portraits/wedding-portraits-01.webp?v=20260715b",
    imageAlt: "Close wedding portrait of a couple in formal attire with veil, bouquet, and soft daylight.",
    tags: "AI Wedding portraits|Save-the-date concepts|Couple consent|Wedding moodboard",
    targetLabel: "Open Wedding Photo",
    targetHref: "/ai-image-generation/wedding-photo",
    relatedLinks: [
      { label: "Read the Engagement photo guide", href: "/blog/engagement-photo-package-guide" },
      { label: "Read the Valentine's Day photo guide", href: "/blog/valentine-photos-photo-package-guide" },
      { label: "Open Wedding Photo", href: "/ai-image-generation/wedding-photo" }
    ],
    seoTitle: "AI Wedding portrait planning guide | myDreamshoots",
    seoDescription: "Plan AI wedding portraits for save-the-dates, moodboards, invitations, websites, or keepsakes with couple consent, verified text, and careful detail review.",
    seoKeywords: "AI wedding portraits, save-the-date concept, wedding moodboard, wedding couple photo guide, AI wedding keepsake",
    body: html`
      <p>Use Wedding Photo for save-the-date concepts, ceremony moodboards, invitation-friendly portraits, wedding website visuals, or private keepsakes. Prepare approved photos of both people, choose one ceremony direction, and treat every result as wedding-inspired creative imagery rather than proof of a real event.</p>
      <h2 id="wedding-choose-use">Choose the wedding use before the visual style</h2>
      <p>A save-the-date needs text-safe composition. A ceremony moodboard can explore atmosphere, clothing, floral direction, and light. An invitation portrait should leave room for verified copy. A website header needs a wide crop that survives navigation overlays. A private keepsake can favor emotion and close detail.</p>
      <p>Choose Wedding Photo when formal couple styling, ceremony atmosphere, floral details, or card-ready framing is central. Choose Engagement for a proposal or ring-led announcement. Choose Valentine's Day for a seasonal romantic card that does not make a ceremony claim.</p>
      <h2 id="wedding-prepare-couple">Prepare both people and one ceremony direction</h2>
      <p>Use recent, clear portraits of both people with similar lighting and useful face angles. Confirm that each person approves the source images, generated pairing, intended audience, and final use. Then choose one direction: ceremony, formal studio, outdoor romance, or card-ready portrait.</p>
      <p>Include only cultural, floral, wardrobe, jewelry, and ceremonial details that knowledgeable participants can review accurately. Do not invent family traditions, religious meaning, or event facts that were not supplied.</p>
      <h2 id="wedding-compare-nearby">Match the theme to the relationship claim</h2>
      <table><thead><tr><th>Theme</th><th>Primary format</th><th>Boundary</th></tr></thead><tbody><tr><td>Wedding Photo</td><td>Ceremony-led concepts, formal portraits, save-the-dates, and keepsakes</td><td>Do not present generated imagery as event documentation.</td></tr><tr><td>Engagement Photo</td><td>Proposal, ring, and announcement-led imagery</td><td>The announcement and relationship claim must be real and approved.</td></tr><tr><td>Valentine's Day</td><td>Seasonal romantic cards, date-night portraits, and gifts</td><td>Use seasonal language without implying a ceremony.</td></tr></tbody></table>
      <p>Review the live <a href="/ai-image-generation/wedding-photo">Wedding Photo package card</a> for current outputs and credit cost.</p>
      <h2 id="wedding-add-text-later">Add names, dates, and venue copy later</h2>
      <p>Leave names, dates, venue details, invitation copy, and schedules out of the generated scene. Add verified text later in a design tool where spelling, hierarchy, and date accuracy can be controlled. A clean text-safe crop is more reliable than generated lettering that appears correct at first glance.</p>
      <h2 id="wedding-trust-review">Review consent, ceremony details, and pair anatomy</h2>
      <p>Use generated wedding images as concepts or keepsakes, not as proof that a ceremony, venue booking, marriage, or cultural rite occurred. Share couple images only with both people's approval.</p>
      <ul><li>Check both faces, eye direction, expression, and relative scale.</li><li>Inspect overlapping hands and arms, rings, jewelry, and bouquet stems.</li><li>Review veil and hair edges, suit and dress fabric, and floral repetition.</li><li>Check ceremonial objects, cultural details, background guests, and venue cues.</li><li>Confirm the final card or website crop preserves text-safe spacing.</li><li>Have knowledgeable participants review meaningful attire, symbols, and rituals.</li></ul>
      <h2 id="wedding-faq">AI wedding portrait FAQ</h2>
      <h3 id="wedding-faq-documentary">Can a generated wedding portrait document a real ceremony?</h3>
      <p>No. Use it as a concept, moodboard, invitation-friendly visual, or keepsake. Real event claims require real documentation.</p>
      <h3 id="wedding-faq-consent">Who should approve a couple image?</h3>
      <p>Both people should approve the source photos, generated pairing, relationship claim, intended audience, and final use.</p>
      <h3 id="wedding-faq-text">Where should names and dates be added?</h3>
      <p>Add verified copy after generation in a design tool so spelling, dates, hierarchy, and placement can be controlled.</p>
      <h3 id="wedding-faq-culture">How should cultural details be reviewed?</h3>
      <p>Include only details supplied by the participants and ask knowledgeable people to review attire, symbols, rituals, and ceremonial objects before publication.</p>
    `
  }),
  makePriorityBlogArticle({
    slug: "/blog/world-cup-fan-photos-photo-package-guide",
    pageTitle: "AI Soccer fan photo guide",
    title: "AI Soccer Fan Photos: Match-Day Posters Without Official Marks",
    summary: "Create a personal soccer supporter portrait, match-day poster, profile avatar, social banner, or watch-party image without official tournament marks, team crests, player likenesses, or affiliation claims.",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-01.webp?v=20260715b",
    imageAlt: "Excited soccer supporter in generic blue, white, and red fan colors with a stadium crowd behind her.",
    tags: "AI Soccer fan photos|Match-day poster|Generic supporter colors|Brand safety",
    targetLabel: "Open Soccer",
    targetHref: "/ai-image-generation/soccer",
    relatedLinks: [
      { label: "Open Soccer fan photos", href: "/ai-image-generation/soccer" },
      { label: "Explore Avatar profile formats", href: "/ai-image-generation/avatar" },
      { label: "Read the content policy", href: "/policies/content" }
    ],
    seoTitle: "AI Soccer fan photo and poster guide | myDreamshoots",
    seoDescription: "Plan soccer supporter portraits, avatars, banners, and match-day posters with generic colors, approved photos, no official marks, and brand-safety checks.",
    seoKeywords: "AI soccer fan photos, match-day poster, soccer supporter portrait, generic fan colors, sports logo safety, supporter avatar",
    body: html`
      <p>Create a personal soccer supporter portrait, match-day poster, profile avatar, social banner, or watch-party image from approved photos. Plan the crop and fan mood without using official tournament marks, team crests, sponsor logos, player likenesses, or language that implies an official partnership.</p>
      <h2 id="soccer-choose-format">Choose one personal fan format</h2>
      <p>Choose Soccer for personal fan creativity: a face-led avatar, dramatic vertical poster, wide social banner, supporter portrait, or approved group scene. Use personal portraits or group references that you have permission to use. Pick one generic color direction and one format so the result has a clear job.</p>
      <table><thead><tr><th>Format</th><th>Composition</th><th>Review priority</th></tr></thead><tbody><tr><td>Profile avatar</td><td>Square, face-led, minimal background</td><td>Recognition at small size and no accidental marks.</td></tr><tr><td>Match-day poster</td><td>Vertical, energetic light, clean space for later copy</td><td>Hands, jersey details, stadium geometry, and text-safe area.</td></tr><tr><td>Social banner</td><td>Wide, subject placed away from interface overlays</td><td>Crop resilience, crowd repetition, and background signs.</td></tr><tr><td>Supporter group</td><td>Only approved people, with clear spacing</td><td>Every face, hand, garment, and relationship between figures.</td></tr></tbody></table>
      <h2 id="soccer-use-generic-elements">Use generic supporter colors and invented scene details</h2>
      <p>Use generic colors, unbranded clothing, invented stadium details, and personal fan expressions. Do not include official competition names or marks, team crests, sponsor logos, player or celebrity likenesses, protected trophy designs, tickets, or branded venue assets unless you hold the required rights.</p>
      <p>Do not describe the output as official, licensed, sponsored, endorsed, or affiliated. The historical URL is being retained locally, but the visible Title, H1, Meta, CTA, and body use generic Soccer language. Brand and legal review remains required before any future publication.</p>
      <h2 id="soccer-add-copy-later">Add verified match copy later</h2>
      <p>Generate a clean poster image first. Add verified match names, dates, scores, and other copy later in a design tool. Do not rely on generated text, and do not use protected event branding without permission. If a score or date is factual, verify it independently before publishing.</p>
      <p>Review the live <a href="/ai-image-generation/soccer">Soccer package card</a> for current outputs and credit cost. This guide intentionally avoids hardcoded catalog values.</p>
      <h2 id="soccer-review-marks">Inspect every detail that could imply a real team or event</h2>
      <ul><li>Check every face, hand, finger, and interaction in group scenes.</li><li>Inspect jersey numbers, names, stripes, seams, flags, and face paint.</li><li>Review balls, goal lines, crowd repetition, and stadium geometry.</li><li>Look for signs, sponsor-like shapes, accidental crests, and invented text.</li><li>Remove details that resemble a real player, tournament, team, trophy, or venue.</li><li>Confirm the crop works without implying official affiliation.</li></ul>
      <h2 id="soccer-personal-use">Keep personal fan creativity separate from commercial rights</h2>
      <p>A personal supporter image does not automatically grant rights for advertising, merchandise, ticketing, sponsorship, or commercial campaigns. Obtain the permissions required for people, marks, brands, and commercial use. Review the <a href="/policies/content">content policy</a> before sharing material that may involve protected identities or branding.</p>
      <h2 id="soccer-faq">Soccer fan photo FAQ</h2>
      <h3 id="soccer-faq-crests">Can I request an official crest or tournament mark?</h3>
      <p>Do not include protected marks unless you hold the required rights. Use generic colors and invented supporter details for a personal fan concept.</p>
      <h3 id="soccer-faq-player">Can the image feature a real player?</h3>
      <p>Avoid player and celebrity likenesses unless you have the necessary permission. A personal supporter portrait should focus on the approved person in the source photo.</p>
      <h3 id="soccer-faq-poster">How should poster text be handled?</h3>
      <p>Generate a clean image with text-safe space, then add verified names, dates, scores, and copy in a design tool. Keep protected event branding out unless authorized.</p>
    `
  })
].map((article) => [article.slug, article]));

const mydreamshootsPriorityBlogSlugByPackSlug = new Map([
  ["profile-cards", "/blog/profile-cards-photo-package-guide"],
  ["avatar", "/blog/profile-cards-photo-package-guide"],
  ["cyberpunk", "/blog/cyberpunk-photo-package-guide"],
  ["mafia", "/blog/mafia-photo-package-guide"],
  ["photo-enhancer", "/blog/magic-upscaler-photo-package-guide"],
  ["travel", "/blog/nature-photo-package-guide"],
  ["urban", "/blog/outdoor-creator-scenes-photo-package-guide"],
  ["valentines-photo", "/blog/valentine-photos-photo-package-guide"],
  ["virtual-try-on", "/blog/virtual-try-on-photo-package-guide"],
  ["wedding-photo", "/blog/wedding-portraits-photo-package-guide"],
  ["soccer", "/blog/world-cup-fan-photos-photo-package-guide"]
]);

function publicAssetExists(imageUrl) {
  const pathname = imagePathnameForUrl(imageUrl);
  if (!pathname.startsWith("/assets/")) return false;
  return fs.existsSync(path.join(process.cwd(), "public", decodeURIComponent(pathname).replace(/^\/+/, "")));
}

function mydreamshootsBlogGalleryImage(slug) {
  const imageUrl = `/assets/dreamshoot/generated/pack-galleries/${slug}/${slug}-01.webp?v=20260715b`;
  return publicAssetExists(imageUrl) ? imageUrl : "";
}

function blogSafeImageUrlForPack({ brand, slug, pack, category, parent }) {
  if (brand !== "MyDreamShoots") {
    return pack.imageUrl || category?.imageUrl || parent?.imageUrl || defaultSiteImage(brand);
  }
  const override = mydreamshootsBlogSafeImageOverrides.get(slug);
  if (override && publicAssetExists(override)) return override;
  const galleryImage = mydreamshootsBlogGalleryImage(slug);
  if (galleryImage) return galleryImage;
  return category?.imageUrl || pack.imageUrl || parent?.imageUrl || defaultSiteImage(brand);
}

function makeCreativeCategoryArticle(state, siteId, brand, category, parent, packs) {
  const label = category.label || category.slug;
  const parentLabel = parent?.label || "the main catalog";
  const examples = compactList([
    ...packs.map((pack) => pack.name || pack.category),
    label,
    parentLabel
  ], label);
  const routeNoun = brand === "Aidreamcapes" ? "private album" : "private gallery";
  return makeCategoryArticle({
    sitePrefix: siteId,
    brand,
    kind: "theme",
    label,
    blogSlug: `/blog/${slugifySegment(category.slug || label)}-photo-package-guide`,
    description: category.description || `${label} sits under ${parentLabel} and gives shoppers a narrower ${routeNoun} direction to compare before spending credits.`,
    imageUrl: category.imageUrl || packs.find((pack) => pack.imageUrl)?.imageUrl || parent?.imageUrl || defaultSiteImage(brand),
    imageAlt: `${brand} ${label} package category cover`,
    targetLabel: `Open ${label} package`,
    targetHref: packageDirectoryHrefForSite(siteId, category.slug || label),
    examples,
    bestFor: `Use ${label} when ${parentLabel} is the right broad direction but the next ${routeNoun} needs a more specific mood, format, or use case.`,
    sourceFocus: brand === "Aidreamcapes"
      ? `Prepare clear source portraits, then add one album cue that matches ${label}: light, scene texture, season, outfit tone, or album format.`
      : `Prepare clear source photos, then add one style cue that matches ${label}: expression, outfit tone, background mood, crop need, or final use.`,
    reviewFocus: `Review whether the finished images match ${label} instead of drifting back into a generic ${parentLabel} result.`,
    elementStory: `${label} should have visible cues that explain the category choice: color, posture, crop, scene texture, styling, or movement readiness.`,
    avoid: `Avoid treating ${label} as interchangeable with every nearby ${parentLabel} option; a narrower category should make the review criteria clearer.`,
    seoTitle: packageSeoTitle(label, brand),
    seoDescription: packageSeoDescription({ brand, label, description: category.description }),
    seoKeywords: brand === "Aidreamcapes"
      ? `${label}, ${brand} ${parentLabel}, private album planning, permission-safe portraits, credit review`
      : `${label}, ${brand} ${parentLabel}, AI photo package guide, source photo planning, private gallery`
  });
}

function numericSortValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function dateSortValue(value) {
  const timestamp = new Date(value ?? "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function packCategoryContext(pack, categoriesById) {
  const category = pack.categoryRecord ?? categoriesById.get(pack.categoryId);
  const parent = category?.parent ?? (category?.parentId ? categoriesById.get(category.parentId) : undefined);
  return { category, parent };
}

function buildCreativePackCoverageArticles(state, siteId, brand) {
  const categories = activeItems(state, "creativePackCategories", siteId);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const packs = activeItems(state, "creativePacks", siteId);
  return packs
    .slice()
    .sort((left, right) => {
      const leftContext = packCategoryContext(left, categoriesById);
      const rightContext = packCategoryContext(right, categoriesById);
      return numericSortValue(leftContext.parent?.sortOrder) - numericSortValue(rightContext.parent?.sortOrder) ||
        numericSortValue(leftContext.category?.sortOrder) - numericSortValue(rightContext.category?.sortOrder) ||
        dateSortValue(left.createdAt) - dateSortValue(right.createdAt) ||
        String(left.name ?? "").localeCompare(String(right.name ?? ""));
    })
    .map((pack) => {
      const { category, parent } = packCategoryContext(pack, categoriesById);
      const label = pack.name || category?.label || pack.category || "Photo package";
      const slug = slugifySegment(label);
      const categoryLabel = category?.label || pack.category || label;
      const parentLabel = parent?.label || categoryLabel || "fan and holiday albums";
      const examples = compactList([label, categoryLabel, parentLabel], label);
      const targetHref = packageDirectoryHrefForSite(siteId, slug);
      const blogSlug = brand === "MyDreamShoots"
        ? mydreamshootsPriorityBlogSlugByPackSlug.get(slug) ?? `/blog/${slug}-photo-package-guide`
        : `/blog/${slug}-photo-package-guide`;
      const priorityOverride = brand === "MyDreamShoots" ? mydreamshootsPriorityArticleOverrides.get(blogSlug) : undefined;
      if (priorityOverride) return clone(priorityOverride);
      return makeCategoryArticle({
        sitePrefix: siteId,
        brand,
        kind: "theme",
        label,
        blogSlug,
        description: pack.description || pack.headline || `${label} gives shoppers a focused ${parentLabel} direction to compare before starting a private album.`,
        imageUrl: blogSafeImageUrlForPack({ brand, slug, pack, category, parent }),
        imageAlt: `${brand} ${label} collection cover showing the visual direction, scene, and intended private album use for this AI photo package.`,
        targetLabel: `Open ${label} theme`,
        targetHref,
        examples,
        bestFor: `Use ${label} when ${parentLabel} is the right broad direction and the private album needs the specific look, scene, or keepsake format described by ${categoryLabel}.`,
        sourceFocus: `Prepare clear approved source portraits, then add one cue that belongs to ${label}: light, scene texture, outfit tone, occasion, group size, or card-ready crop.`,
        reviewFocus: `Review whether the finished images look like ${label} instead of drifting into a generic ${parentLabel} album.`,
        elementStory: `${label} should be recognizable through visible details such as color, posture, card framing, scene texture, seasonal cues, supporter energy, or private keepsake mood.`,
        avoid: `Avoid asking ${label} to cover several unrelated fan, game-day, premiere, or holiday scenes at once; the narrower theme should make review easier.`,
        seoTitle: packageSeoTitle(label, brand),
        seoDescription: packageSeoDescription({ brand, label, description: pack.description, headline: pack.headline }),
        seoKeywords: brand === "Aidreamcapes"
          ? `${label}, ${brand} ${categoryLabel}, ${parentLabel}, private album planning, permission-safe portraits, credit review`
          : `${label}, ${brand} ${categoryLabel}, ${parentLabel}, AI photo package guide, source photo planning, private gallery`
      });
    });
}

function buildCreativeCategoryCoverageArticles(state, siteId, brand, existingArticles) {
  const existing = articleSlugs(existingArticles);
  const existingTargets = new Set(existingArticles.map((article) => article.targetHref).filter(Boolean));
  const categories = activeItems(state, "creativePackCategories", siteId);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const packs = activeItems(state, "creativePacks", siteId);
  return categories
    .filter((category) => !isExcludedBlogCoverage(siteId, "creative-category", category.slug))
    .filter((category) => !category.parentId)
    .map((category) => {
      const parent = category.parentId ? byId.get(category.parentId) : undefined;
      const categoryPacks = packs.filter((pack) => pack.categoryId === category.id || pack.category === category.slug);
      return makeCreativeCategoryArticle(state, siteId, brand, category, parent, categoryPacks);
    })
    .filter((article) => !existing.has(article.slug) && !existingTargets.has(article.targetHref));
}

function buildCoverageArticles(state, siteId, brand, existingArticles) {
  const articles = [
    ...buildCreativeCategoryCoverageArticles(state, siteId, brand, existingArticles)
  ];
  const seen = new Set(existingArticles.map((article) => article.slug));
  return articles.filter((article) => {
    if (seen.has(article.slug)) return false;
    seen.add(article.slug);
    return true;
  });
}

function imagePathnameForUrl(imageUrl) {
  return new URL(String(imageUrl ?? ""), "https://local.invalid").pathname;
}

function normalizedImageUrlForUniqueness(imageUrl) {
  return decodeURIComponent(imagePathnameForUrl(imageUrl)).replace(/\/+/g, "/").toLowerCase();
}

function imageFilePathForUrl(imageUrl) {
  return path.join(process.cwd(), "public", decodeURIComponent(imagePathnameForUrl(imageUrl)).replace(/^\/+/, ""));
}

function imageShaForUrl(imageUrl) {
  const filePath = imageFilePathForUrl(imageUrl);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Blog cover image is missing from public assets: ${imageUrl}`);
  }
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function assertUniqueArticleCovers(config) {
  const articlesToCheck = config.siteId === MYDREAMSHOOTS_SITE_ID
    ? config.articles.filter((article) => mydreamshootsPriorityBlogSlugSet.has(article.slug))
    : config.articles;
  const seenUrls = new Map();
  const seenShas = new Map();
  for (const article of articlesToCheck) {
    if (!article.imageUrl) {
      throw new Error(`${config.slug}${article.slug} is missing imageUrl`);
    }
    const normalizedUrl = normalizedImageUrlForUniqueness(article.imageUrl);
    const previousUrlArticle = seenUrls.get(normalizedUrl);
    if (previousUrlArticle) {
      throw new Error(`${config.slug} blog cover URL reused by ${previousUrlArticle} and ${article.slug}: ${normalizedUrl}`);
    }
    seenUrls.set(normalizedUrl, article.slug);

    const imageSha = imageShaForUrl(article.imageUrl);
    const previousShaArticle = seenShas.get(imageSha);
    if (previousShaArticle) {
      throw new Error(`${config.slug} blog cover file reused by ${previousShaArticle} and ${article.slug}: ${normalizedUrl}`);
    }
    seenShas.set(imageSha, article.slug);
  }
}

function assertMyDreamShootsArticleFacts(config) {
  if (config.siteId !== MYDREAMSHOOTS_SITE_ID) return;
  const seoProfileSlugs = new Set([
    ...MYDREAMSHOOTS_BLOG_SEO_REMEDIATION_SLUGS,
    ...MYDREAMSHOOTS_SEASONAL_OCCASION_BLOG_SEO_SLUGS
  ]);
  for (const slug of mydreamshootsPriorityBlogSlugSet) {
    const article = config.articles.find((item) => item.slug === slug);
    if (!article) continue;
    const required = [
      "entityName",
      ...(seoProfileSlugs.has(slug) ? ["primaryKeyword", "searchIntent"] : []),
      "productSlug",
      "userIntent",
      "inputRequirements",
      "verifiedLimitations",
      "reviewChecklist",
      "rightsWarnings",
      "evidenceType",
      "evidenceDate"
    ];
    const missing = required.filter((key) => {
      const value = article[key];
      return Array.isArray(value) ? value.length === 0 : !String(value ?? "").trim();
    });
    if (missing.length) throw new Error(`${slug} is missing entity facts: ${missing.join(", ")}`);
    if (article.evidenceType !== "editorial-guidance") {
      throw new Error(`${slug} must declare evidenceType=editorial-guidance until controlled evidence is recorded.`);
    }
    if (!Array.isArray(article.relatedLinks) || !article.relatedLinks.length || !Array.isArray(article.relatedGuides) || !article.relatedGuides.length) {
      throw new Error(`${slug} must declare related guides through the editorial whitelist.`);
    }
    for (const link of article.relatedLinks) {
      if (!link || typeof link.href !== "string" || !/^\/(?:ai-image-generation(?:\/|$)|blog\/|policies\/|content$)/.test(link.href)) {
        throw new Error(`${slug} has a non-local related guide href: ${String(link?.href ?? "")}`);
      }
    }
  }
}

const siteConfigs = [
  {
    slug: "mydreamshoots",
    siteId: "site_dreamshoot",
    brand: "MyDreamShoots",
    coverageMode: "creative-packs",
    blogTitle: "Guides",
    footerLabel: "Blog",
    guideType: "AI photo guide",
    homeIntroTitle: "AI photo guides for better source photos, credits, and private albums.",
    homeIntroBody:
      "Use these MyDreamShoots guides to choose source photos, compare package fit, understand credits, and review finished images inside a private gallery.",
    homeListTitle: "AI photo guides",
    homeListBody:
      "Practical guidance for source-photo preparation, package planning, visible credits, private gallery delivery, and stronger AI portrait results.",
    relatedTitle: "Related guides",
    relatedBody:
      "Read more about source photos, package selection, credit planning, private albums, and delivery review before starting another AI photo set.",
    homeSeo: {
      title: "MyDreamShoots Guides for AI photo packages and private albums",
      description:
        "Read MyDreamShoots guides for source photos, AI photo package planning, visible credits, private galleries, downloads, and delivery review.",
      keywords:
        "AI photo guides, source photo tips, AI photo packages, private AI gallery, MyDreamShoots credits"
    },
    articles: [
      {
        id: "site_dreamshoot_blog_detail",
        slug: "/blog/preparing-source-photos",
        pageTitle: "Preparing source photos",
        title: "How to prepare source photos for cleaner AI photo packages",
        summary:
          "A practical guide to choosing the selfies, angles, lighting, wardrobe variety, and permission checks that help MyDreamShoots produce cleaner private photo sets.",
        author: "MyDreamShoots editorial team",
        publishedAt: "2026-07-28",
        updatedAt: "2026-07-28",
        readMinutes: "7",
        imageUrl: "/assets/dreamshoot/generated/20260622-homepage-unique/flow-before-upload.webp",
        imageAlt: "Private source photo upload workspace for MyDreamShoots",
        tags: "Source photos|AI portraits|Photo packages|Private albums",
        primaryCta: "Create my first photo set",
        primaryHref: "/login",
        secondaryCta: "Compare packages",
        secondaryHref: packageDirectoryHrefForSite("site_dreamshoot"),
        seoTitle: "How to prepare source photos for better AI photo packages",
        seoDescription:
          "Learn how to choose selfies, lighting, angles, wardrobe variety, and permission-safe uploads before starting MyDreamShoots AI photo packages.",
        seoKeywords:
          "source photos for AI portraits, AI photo package tips, selfie upload guide, private AI photo gallery",
        body: html`
          <p>Better AI photo results usually start with calmer inputs. MyDreamShoots can follow a package direction more reliably when the source photos show the person clearly, from a few natural angles, without filters that hide face shape, hairline, skin tone, or expression.</p>
          <h2 id="what-the-generator-needs">What the generator needs from you</h2>
          <p>Use source photos that show the same person in simple lighting. A good set includes one close portrait, one half-body frame, one relaxed expression, and one different angle. The goal is not a perfect studio shoot. The goal is enough consistent information for the private request to understand identity before it builds a new scene.</p>
          <h2 id="choose-clear-inputs">Choose clear inputs before stylish ones</h2>
          <p>Start with sharp, recent images where the face is visible and the background is not competing for attention. Avoid heavy beauty filters, extreme crops, sunglasses, busy group photos, and pictures where the face is partly covered. A stylish photo can be useful later, but a clear photo should lead the set.</p>
          <h2 id="add-range-without-confusion">Add range without confusing the brief</h2>
          <p>Variation helps when it stays organized. Include different expressions, lighting, and camera distances, but avoid mixing many hairstyles, costume changes, or old photos from different life stages in the same request. If you want a new hairstyle, fantasy scene, fan poster, or business headshot, let the package brief carry the change instead of forcing every source image to show a different version of you.</p>
          <h2 id="match-the-package-outcome">Match photos to the package outcome</h2>
          <p>Professional headshot packages benefit from clean face detail and neutral clothing. Creator portraits can use more personality, gestures, and outfit notes. Fan posters and cinematic worlds can handle stronger mood references, but still need a stable identity base. When in doubt, choose the photos that make the person easiest to recognize.</p>
          <h2 id="keep-permissions-simple">Keep privacy and permissions simple</h2>
          <p>Only upload photos you own or have permission to use. If the package involves another person, make sure they expect their image to be used in a private AI photo workflow. Finished results stay tied to the signed-in MyDreamShoots account, where you can review, download, and decide what belongs outside the private gallery.</p>
          <h2 id="source-photo-checklist">Source-photo checklist</h2>
          <table><thead><tr><th>Check</th><th>Why it matters</th></tr></thead><tbody><tr><td>Recent, sharp portraits</td><td>Helps the result preserve identity and current details.</td></tr><tr><td>Natural expressions</td><td>Gives packages more usable options for professional, social, or cinematic scenes.</td></tr><tr><td>Simple lighting</td><td>Reduces shadows and color shifts before generation begins.</td></tr><tr><td>Permission-safe uploads</td><td>Keeps private albums and account records easier to manage.</td></tr></tbody></table>
          <h2 id="mistakes-that-lower-result-quality">Mistakes that lower result quality</h2>
          <p>The weakest source sets usually have the same pattern: one very polished selfie, one filtered social post, and several photos where the face is small or turned away. That combination asks the system to guess too much. It may still produce attractive images, but the person can drift between outputs because the identity evidence is uneven.</p>
          <p>Another common issue is mixing different life stages in one upload. A current photo, an older casual photo, and a heavily edited formal image can all be meaningful to the customer, but they are not equally useful for generation. If your goal is a photo package that looks like you now, make the current images the base set.</p>
          <h2 id="how-many-photos-to-upload">How many photos should you upload?</h2>
          <p>More photos are not automatically better. A smaller group of clear, consistent portraits usually beats a large folder of mixed screenshots. For a first MyDreamShoots set, think in terms of coverage: front-facing, slight side angle, different expression, and one frame that shows hair and shoulders clearly. If a photo repeats the same angle and lighting as another, keep the sharper one.</p>
          <h2 id="source-photo-faq">Source photo FAQ</h2>
          <h3 id="can-i-use-phone-selfies">Can I use phone selfies?</h3>
          <p>Yes. Phone selfies can work well when they are sharp, recent, and naturally lit. The main thing to avoid is a selfie that has been softened by filters or compressed through multiple apps before upload.</p>
          <h3 id="should-i-upload-professional-photos">Should I upload professional photos?</h3>
          <p>Professional portraits can help if they still look like the person and do not rely on extreme retouching. A clean studio photo is useful for headshots, while relaxed everyday photos often help lifestyle and creator packages feel more natural.</p>
          <h3 id="what-if-i-want-a-different-style">What if I want a different hairstyle or outfit?</h3>
          <p>Use source photos for identity and use the package choice or style notes for transformation. If every source photo shows a different hairstyle, the request has less stable information to follow.</p>
          <p>Once the source set is ready, compare the package direction and visible credit cost before generation. That small pause is often what turns a random upload into a cleaner finished gallery.</p>
        `
      },
      {
        id: "site_dreamshoot_blog_choose_packages",
        slug: "/blog/choosing-ai-photo-packages",
        pageTitle: "Choosing AI photo packages",
        title: "How to choose the right AI photo package before spending credits",
        summary:
          "Use the final use case, source-photo needs, style risk, output count, and visible credit cost to decide which MyDreamShoots package belongs in your next private set.",
        author: "MyDreamShoots editorial team",
        publishedAt: "2026-07-28",
        updatedAt: "2026-07-28",
        readMinutes: "6",
        imageUrl: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-package-wall.webp",
        imageAlt: "MyDreamShoots package wall with AI portrait styles",
        tags: "Photo packages|Credits|Portrait planning|Private workflow",
        primaryCta: "Compare packages",
        primaryHref: packageDirectoryHrefForSite("site_dreamshoot"),
        secondaryCta: "View pricing",
        secondaryHref: "/pricing",
        targetLabel: "Browse photo packages",
        targetHref: packageDirectoryHrefForSite("site_dreamshoot"),
        seoTitle: "How to choose AI photo packages before spending credits",
        seoDescription:
          "Compare MyDreamShoots AI photo packages by final use, source-photo fit, style risk, output needs, private delivery, and visible credit cost.",
        seoKeywords:
          "AI photo packages, choose AI portraits, photo package credits, MyDreamShoots package guide",
        body: html`
          <p>Choosing a package is easier when you start with the job the images need to do. A headshot, a creator profile, a fan poster, and a cinematic portrait can all use the same account credits, but they ask different things from your source photos and your review process.</p>
          <h2 id="start-with-final-use">Start with the final use</h2>
          <p>Pick the package that matches where the finished images will live. LinkedIn-style portraits need clarity and restraint. Social profile sets can use stronger expression and crop variety. Holiday cards, fan posters, and cinematic scenes can carry more atmosphere because the final image is meant to feel themed.</p>
          <h2 id="compare-source-photo-needs">Compare source-photo needs</h2>
          <p>If you only have a few clean selfies, start with a package that does not depend on complex poses or dramatic costumes. If you have several clear angles, you can choose a more expressive package because the workflow has more identity context to work from.</p>
          <h2 id="check-credit-cost">Check the credit cost before generation</h2>
          <p>MyDreamShoots shows the credit cost before a private job starts. Use that moment to decide whether you want a focused set now or a broader gallery later. If you are testing a new look, a smaller package can help you learn what works before spending more credits on a larger album.</p>
          <h2 id="decide-how-much-style-risk">Decide how much style risk you want</h2>
          <p>Cleaner professional packages usually carry less visual risk because the scene is restrained. Fantasy, sports, event, and cinematic packages can be more dramatic, which also means you should review outputs carefully before using them publicly. Choose the package that matches your comfort with transformation.</p>
          <h2 id="decide-where-the-photos-will-be-used">Decide where the photos will be used</h2>
          <p>A package feels easier to judge when you name the final use for the finished images. A resume portrait needs a calmer crop and a face-forward expression. A creator profile can accept more gesture, color, and crop variety. A fan poster or holiday scene can be judged by mood, but it still needs enough identity consistency that friends recognize the person without reading the caption.</p>
          <p>Write the intended use in plain language before choosing the package. "Three profile options for LinkedIn" leads to a different choice than "a private album of cinematic portraits for a birthday surprise." That short sentence helps you avoid buying a style because it looks exciting while missing the use case that actually matters.</p>
          <h2 id="quick-comparison">Quick comparison</h2>
          <table><thead><tr><th>Package goal</th><th>Best source-photo match</th><th>Review focus</th></tr></thead><tbody><tr><td>Professional headshots</td><td>Clear face detail, neutral clothing, low visual clutter.</td><td>Identity, crop, expression, and background restraint.</td></tr><tr><td>Creator portraits</td><td>Several expressions, some outfit variety, natural body posture.</td><td>Personality, usable crops, and social profile fit.</td></tr><tr><td>Themed albums</td><td>Stable identity photos plus one clear mood direction.</td><td>Scene consistency, costume fit, and artifact checks.</td></tr><tr><td>Small test set</td><td>Your sharpest two or three current portraits.</td><td>Whether the direction is worth a larger credit spend.</td></tr></tbody></table>
          <h2 id="use-related-guides">Use related guides as planning tools</h2>
          <p>Before starting, read source-photo guidance and private gallery notes. Then open <a href="${packageDirectoryHrefForSite("site_dreamshoot")}">packages</a> and compare the package description, credit cost, and intended output. That creates a simple decision path: purpose first, source-photo fit second, credits third.</p>
          <h2 id="package-choice-framework">A simple package-choice framework</h2>
          <ul><li><strong>Need one polished identity look?</strong> Choose headshots or profile portraits.</li><li><strong>Need expressive social content?</strong> Choose creator, lifestyle, beauty, or themed album sets.</li><li><strong>Need a specific event mood?</strong> Choose holiday, sports, wedding, fan, or cinematic packages.</li><li><strong>Need to test first?</strong> Start smaller, review privately, then spend more credits when the direction is clear.</li></ul>
          <h2 id="package-planning-faq">Package planning FAQ</h2>
          <h3 id="should-i-start-with-the-cheapest-package">Should I start with the smallest package?</h3>
          <p>Start small when you are testing a new look, a new source-photo set, or a dramatic style. Choose a larger package when the intended use is clear and you already know the source photos represent you well.</p>
          <h3 id="how-do-i-avoid-wasting-credits">How do I avoid wasting credits?</h3>
          <p>Check three things before generation: whether the package matches the final use, whether the source photos are clear enough, and whether the visible credit cost feels right for the number of images you expect to review.</p>
          <h3 id="can-one-package-cover-every-style">Can one package cover every style?</h3>
          <p>Usually no. A focused package creates a cleaner gallery. If you want professional headshots and cinematic posters, treat them as separate requests so each set has a clear visual job.</p>
          <p>The best package is not always the biggest one. It is the one that fits your source photos, your intended use, and the amount of review you want before downloading favorites.</p>
        `
      },
      {
        id: "site_dreamshoot_blog_gallery_credits",
        slug: "/blog/private-gallery-and-credits-guide",
        pageTitle: "Private gallery and credits guide",
        title: "Private galleries, credits, and downloads: what to check after generation",
        summary:
          "Understand how MyDreamShoots customers review finished images, track credit use, compare outputs, and keep private albums organized after generation.",
        author: "MyDreamShoots editorial team",
        publishedAt: "2026-07-28",
        updatedAt: "2026-07-28",
        readMinutes: "6",
        imageUrl: "/assets/dreamshoot/generated/20260622-homepage-unique/flow-private-album-workspace.webp",
        imageAlt: "MyDreamShoots private gallery workspace for reviewing generated images",
        tags: "Private gallery|Credits|Downloads|Account workflow",
        primaryCta: "Open my studio",
        primaryHref: "/login",
        secondaryCta: "View pricing",
        secondaryHref: "/pricing",
        targetLabel: "View pricing",
        targetHref: "/pricing",
        seoTitle: "MyDreamShoots private gallery, credits, and download guide",
        seoDescription:
          "Learn how MyDreamShoots private galleries, credit history, generation review, downloads, and account-scoped albums work after AI photo delivery.",
        seoKeywords:
          "private AI gallery, MyDreamShoots credits, AI photo downloads, generated photo review",
        body: html`
          <p>Generation is only one part of the customer workflow. After a private job finishes, the gallery helps you compare images, download favorites, and understand how credits moved through the request.</p>
          <h2 id="where-finished-images-land">Where finished images land</h2>
          <p>Finished MyDreamShoots images return to the signed-in account that started the job. Keeping outputs account-scoped makes it easier to review a set later, revisit downloads, and separate personal albums from public sharing choices.</p>
          <h2 id="how-credit-history-stays-readable">How credit history stays readable</h2>
          <p>Credits are designed to be visible before generation begins. A request may reserve credits while it runs, settle them after successful delivery, or release them when a failed request cannot complete. Reviewing account history helps you connect a finished album to the package that created it.</p>
          <p>That record is also useful when several people in the same household are comparing different looks. The gallery title, package choice, and credit movement give each set a simple paper trail, so a test run does not get confused with a polished request you meant to download later.</p>
          <h2 id="review-before-sharing">Review before sharing</h2>
          <p>Look at face consistency, hand detail, background artifacts, crop quality, and whether the scene matches the package promise. Some images may be better for profile use, while others work better as private keepsakes or social drafts.</p>
          <p>For public-facing downloads, also test the image at the size where it will actually appear. A portrait that looks strong in the gallery may reveal edge artifacts once cropped into a small avatar, while a quieter frame can work better for a resume, booking profile, or team page because the face stays readable.</p>
          <h2 id="organize-downloads">Organize downloads by purpose</h2>
          <p>Download favorites into folders that match their use: profile, professional, holiday, creator, event, or archive. This small habit helps you avoid mixing experimental images with polished images you plan to use publicly.</p>
          <h2 id="when-to-run-another-set">When to run another set</h2>
          <p>Start another request when the first gallery shows a clear direction to improve. If expressions are strong but lighting feels off, adjust package mood or source-photo notes. If identity is inconsistent, improve the source photo set before spending more credits.</p>
          <h2 id="turn-gallery-review-into-feedback">Turn gallery review into feedback</h2>
          <p>A useful gallery review is specific. Instead of deciding that a set is simply good or bad, note what worked: the best lighting, the strongest expression, the most believable crop, and the package mood that felt closest to the goal. Then note what should change before another request. Maybe the next set needs clearer source photos, fewer dramatic costume cues, or a tighter brief around professional use.</p>
          <p>This record does not need a formal spreadsheet. A few notes beside the downloaded favorites are enough. The point is to make the next credit spend more informed than the last one, especially when you are testing a new visual direction.</p>
          <h2 id="what-to-check-before-downloading">What to check before downloading favorites</h2>
          <table><thead><tr><th>Review point</th><th>What to look for</th><th>What to do next</th></tr></thead><tbody><tr><td>Identity</td><td>The face should feel consistent across the best images.</td><td>If it drifts, improve source-photo clarity before another run.</td></tr><tr><td>Hands and edges</td><td>Check fingers, hair edges, glasses, jewelry, and clothing lines.</td><td>Use cleaner crops publicly and keep experiments private.</td></tr><tr><td>Scene promise</td><td>The image should match the package mood you selected.</td><td>If the mood is close but not exact, refine the next brief.</td></tr><tr><td>Download use</td><td>Profile crops need different checks than keepsake images.</td><td>Save separate folders for profile, social, archive, and tests.</td></tr></tbody></table>
          <h2 id="private-gallery-checklist">Private gallery checklist</h2>
          <ul><li>Confirm the finished set belongs to the right account.</li><li>Review identity, crop, and background quality before downloading.</li><li>Check credit movement in account history.</li><li>Save public-use favorites separately from experiments.</li><li>Use what you learned before choosing the next package.</li></ul>
          <h2 id="private-gallery-faq">Private gallery FAQ</h2>
          <h3 id="are-finished-images-public">Are finished images public by default?</h3>
          <p>No. The article flow is built around account-scoped review. You decide which downloads are suitable for public profiles, social posts, or private keepsakes.</p>
          <h3 id="why-does-credit-history-matter">Why does credit history matter?</h3>
          <p>Credit history helps connect a finished album to the package and generation request that produced it. That is useful when comparing tests, planning a second pass, or reviewing billing questions.</p>
          <h3 id="what-should-i-do-with-imperfect-results">What should I do with imperfect results?</h3>
          <p>Do not treat every output as a final image. Use imperfect frames as feedback: they can show whether the next request needs clearer source photos, a calmer package, or a more specific style note.</p>
          <p>A private gallery is most useful when it becomes a review space, not just a download folder. Treat each set as feedback for the next one.</p>
        `
      },
      ...mydreamshootsThemeArticles
    ]
  },
  {
    slug: "aidreamcapes",
    siteId: "site_aidreamcapes",
    brand: "Aidreamcapes",
    coverageMode: "creative-packs",
    blogTitle: "Field Notes",
    footerLabel: "Blog",
    guideType: "Fan and holiday guide",
    homeIntroTitle: "Fan and holiday field notes for better private albums.",
    homeIntroBody:
      "Use Aidreamcapes Field Notes to plan source portraits, fan-scene references, holiday album briefs, visible credits, and private gallery review.",
    homeListTitle: "Aidreamcapes fan and holiday guides",
    homeListBody:
      "Field Notes for source portraits, fan-scene moods, holiday references, credit planning, private delivery, and more intentional AI private albums.",
    relatedTitle: "More field notes",
    relatedBody:
      "Continue with guides on source portraits, fan-scene references, holiday planning, credit planning, and private album review.",
    homeSeo: {
      title: "Aidreamcapes Field Notes for private fan and holiday albums",
      description:
        "Read Aidreamcapes Field Notes for source portraits, fan-scene references, holiday album briefs, visible credits, and private gallery delivery.",
      keywords:
        "fan-scene references, holiday album planning, private gallery credits, Aidreamcapes",
      ogImage: "/assets/sites/site_aidreamcapes/fan-holiday-theme/showcase/fan-scene-albums.webp"
    },
    articles: [
      {
        id: "site_aidreamcapes_blog_detail",
        slug: "/blog/approved-source-photo-planning",
        pageTitle: "Approved source photo planning",
        title: "How to plan approved source photos for private fan and holiday albums",
        summary:
          "Choose clear portraits, note permission boundaries, and keep fan-scene or holiday references focused so Aidreamcapes can build cleaner private albums.",
        author: "Aidreamcapes editorial team",
        publishedAt: "2026-07-28",
        updatedAt: "2026-07-28",
        readMinutes: "7",
        imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/showcase/fan-scene-albums.webp",
        imageAlt: "Aidreamcapes fan-scene album cover",
        tags: "Source portraits|Fan scenes|Holiday planning|Private albums",
        primaryCta: "Start a fan set",
        primaryHref: "/login",
        secondaryCta: "Browse albums",
        secondaryHref: "/collections",
        seoTitle: "How to plan approved source photos for Aidreamcapes private albums",
        seoDescription:
          "Learn how to choose source photos, note permission boundaries, and keep fan-scene or holiday references focused for Aidreamcapes private albums.",
        seoKeywords:
          "approved source photos, fan-scene album planning, private holiday albums, Aidreamcapes",
        body: html`
          <p>Strong Aidreamcapes results begin before the album is generated. The private workflow needs clear portraits first, then fan-scene or holiday cues that support the gallery direction without overwhelming it.</p>
          <h2 id="start-with-identity-clarity">Start with identity clarity</h2>
          <p>Choose recent portraits where the face is sharp, naturally lit, and easy to recognize. Avoid heavy filters, sunglasses, harsh shadows, and group photos when the request needs consistent solo albums.</p>
          <p>For paired or family-style albums, keep the same rule for every person in the set. One clear portrait for each subject is better than a folder where one person appears in crisp light and another is only visible in distant group shots.</p>
          <h2 id="add-context-intentionally">Add context intentionally</h2>
          <p>A cozy table set may need warm light, linen textures, and relaxed posture notes. A fan-scene album can use poster color, supporter energy, backstage cues, or watch-party references. A holiday set benefits from season, gesture, and card-ready framing.</p>
          <p>Helpful context can also include what should stay out of the scene. If the album should feel like a quiet private keepsake, say that instead of leaving room for crowded backgrounds or overdone styling. Boundaries keep the result believable and make the finished gallery easier to review.</p>
          <h2 id="match-wardrobe-to-the-theme">Match wardrobe notes to the theme</h2>
          <p>Wardrobe does not need to be complicated. Light neutrals can work for holiday cards. Structured jackets can fit fan-scene portraits. Soft layers support family keepsakes or event albums. Use wardrobe notes to make the gallery believable, not to rewrite every detail of the person.</p>
          <h2 id="keep-the-request-focused">Keep the request focused</h2>
          <p>One clear theme usually works better than five mixed ideas in the same job. If you want both a fan-scene album and a holiday album, run them as separate package choices so each private gallery has a coherent mood.</p>
          <h2 id="choose-photos-for-the-theme">Choose photos for the theme, not just the face</h2>
          <p>An album needs identity, but it also needs enough body and wardrobe context to feel believable in a themed scene. A close crop can help with face detail, while a half-body source image helps the request understand posture, shoulders, and how clothing should sit in the album.</p>
          <p>If the theme involves movement, such as a watch-party frame or a card-ready pose, include one relaxed standing shot. If the theme is more polished, such as a table keepsake or a quiet studio-style set, a calmer portrait with clean lighting may be enough.</p>
          <h2 id="balance-real-person-and-theme">Balance the real person and the theme</h2>
          <p>The best Aidreamcapes requests do not let the theme swallow the person. A dramatic backdrop, party corner, or holiday prop should support the portrait rather than turn the subject into a background detail. When choosing source photos, keep one image where the face is unmistakable and one image that shows posture or wardrobe. When writing notes, describe the visible scene instead of asking for a vague fantasy.</p>
          <p>This balance is especially useful for shared albums or profile refreshes. The image should feel like a believable themed portrait of the person, not an anonymous stock scene with a face added later.</p>
          <h2 id="review-outputs-privately">Review outputs privately before sharing</h2>
          <p>Finished albums return to the Aidreamcapes account gallery. Compare identity, lighting, crop, and theme consistency before downloading favorites for profiles, cards, social posts, or personal keepsakes.</p>
          <h2 id="source-planning-checklist">Source planning checklist</h2>
          <ul><li>Use clear recent portraits before expressive references.</li><li>Pick one theme for the first request.</li><li>Add outfit notes that support the album.</li><li>Check the visible credit cost before generation.</li><li>Review the private gallery before sharing images elsewhere.</li></ul>
          <h2 id="source-photo-faq">Source photo FAQ</h2>
          <h3 id="do-i-need-real-reference-photos">Do I need real reference photos?</h3>
          <p>No. The source photos should mainly identify the person. Fan-scene references and album choice can describe the mood. Real reference photos can help as references only when you own them and they support the scene clearly.</p>
          <h3 id="should-i-include-full-body-photos">Should I include full-body photos?</h3>
          <p>A full-body photo is useful for albums with walking, greeting, or group scenes, but it should still be clear and current. If the face becomes too small, pair it with a sharper portrait.</p>
          <h3 id="what-if-my-photos-have-different-outfits">What if my photos have different outfits?</h3>
          <p>Some variety is fine, but avoid making wardrobe the main signal. Use outfit notes to guide the album look, then let the clearest current portraits carry identity.</p>
          <p>Source planning does not need a professional shoot. It needs clear portraits and an album brief that knows what kind of private gallery you want.</p>
        `
      },
      {
        id: "site_aidreamcapes_blog_fan_scene_references",
        slug: "/blog/permission-safe-fan-scene-reference-planning",
        pageTitle: "Permission-safe fan-scene references",
        title: "How to choose permission-safe fan-scene references for private albums",
        summary:
          "A guide to choosing original mood references, holiday cues, and safe boundaries that keep Aidreamcapes requests focused and private.",
        author: "Aidreamcapes editorial team",
        publishedAt: "2026-07-28",
        updatedAt: "2026-07-28",
        readMinutes: "6",
        imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/posters/permission-safe-story-clip.webp?v=20260731assetfix1",
        imageAlt: "Aidreamcapes fan-scene reference cover",
        tags: "Fan-scene references|Holiday cues|Private albums|Permission-safe planning",
        primaryCta: "Plan a fan scene",
        primaryHref: "/collections",
        secondaryCta: "View pricing",
        secondaryHref: "/pricing",
        targetLabel: "Fan and holiday albums",
        targetHref: "/collections",
        seoTitle: "How to choose permission-safe fan-scene references for Aidreamcapes",
        seoDescription:
          "Choose better fan-scene references, holiday cues, and private album notes so Aidreamcapes can keep each request focused, original, and private.",
        seoKeywords:
          "permission-safe references, fan-scene mood boards, holiday cues, Aidreamcapes",
        body: html`
          <p>Fan-scene references work best when they behave like a compass. They should point Aidreamcapes toward light, texture, season, and album mood without asking one private job to become every idea at once.</p>
          <h2 id="choose-one-primary-scene">Choose one primary scene</h2>
          <p>Start by naming the main feeling of the album: supporter energy, holiday warmth, quiet card set, table keepsake, backstage moment, or a small celebration. A precise mood helps every generated image feel like part of the same gallery.</p>
          <p>The primary mood should be specific enough that you could reject a wrong image quickly. If the brief says "quiet table morning," a loud party frame is clearly off-scene. If the brief only says "fan vibe," almost anything can pass, which makes the final gallery harder to judge.</p>
          <h2 id="use-observable-reference-details">Use observable reference details</h2>
          <p>Useful references describe what the viewer can see: warm lamp light, table settings, backstage color, cardigan layers, card-friendly spacing, soft party glow, or golden-hour warmth. Avoid vague instructions that sound good but do not tell the scene what to show.</p>
          <p>Good reference notes often combine one texture, one light direction, and one wardrobe signal. For example, a warm table surface, late-afternoon side light, and relaxed neutral layers give the album a practical direction without forcing every frame to copy the same background.</p>
          <h2 id="limit-the-number-of-references">Limit the number of references</h2>
          <p>Two or three focused references are usually easier to follow than a large mixed board. If one reference is for lighting, one for scene texture, and one for wardrobe tone, the package has a cleaner brief.</p>
          <h2 id="separate-conflicting-scenes">Separate conflicting scenes</h2>
          <p>A watch-party set and a formal holiday album can both be beautiful, but they should not fight inside the same generation request. Split them into separate private albums so credits support a clear outcome.</p>
          <h2 id="turn-references-into-a-short-brief">Turn references into a short brief</h2>
          <p>A strong brief can be one sentence: "Warm fan-scene portraits with relaxed styling, soft evening light, and a private keepsake mood." That gives the workflow a scene, visual texture, and wardrobe direction.</p>
          <h2 id="reference-quality-check">Reference quality check</h2>
          <table><thead><tr><th>Reference type</th><th>Useful detail</th></tr></thead><tbody><tr><td>Light</td><td>Golden hour, soft overcast, warm table light, bright celebration glow.</td></tr><tr><td>Scene texture</td><td>Card stock, backdrop rail, table setting, market color, party space.</td></tr><tr><td>Wardrobe tone</td><td>Neutral layers, card-friendly linen, structured jacket, soft party shell.</td></tr><tr><td>Album use</td><td>Profile, keepsake, card crop, family set, creator story.</td></tr></tbody></table>
          <h2 id="bad-references-to-leave-out">Bad references to leave out</h2>
          <p>Leave out references that conflict with the scene. A holiday card, fan-scene wall, party backdrop, and family table can all be attractive, but together they create a confused request. Also avoid references where the subject is hidden, the lighting is too stylized to read, or the main value is a celebrity pose rather than observable scene details.</p>
          <p>When a reference is mostly about mood, translate it into visible words. Instead of "make it cinematic," name the thing that creates the mood: warm light, soft shadow, quiet backdrop, table color, glow from a window, or a clean frame edge.</p>
          <h2 id="make-references-work-together">Make references work together</h2>
          <p>Think of each reference as having a job. One image can define light, another can define scene texture, and a third can suggest wardrobe tone. If two references are doing the same job, keep the clearer one. If a reference introduces a new season, color palette, or camera mood, ask whether it helps the album or simply adds noise.</p>
          <p>A focused reference board often feels quieter than a social media moodboard. That is a strength. Aidreamcapes can follow a small set of visible cues more easily than a collage of beautiful but conflicting ideas.</p>
          <h2 id="reference-faq">Reference FAQ</h2>
          <h3 id="can-i-use-a-moodboard">Can I use a moodboard?</h3>
          <p>Yes, but keep it small. Two or three references with different jobs are stronger than a large board where every image competes for attention.</p>
          <h3 id="should-references-show-people">Should references show people?</h3>
          <p>They can, but they do not have to. A scene, color palette, lighting condition, or table texture can be more useful than another person's pose, especially when your own source portraits already carry identity.</p>
          <h3 id="how-specific-should-the-brief-be">How specific should the brief be?</h3>
          <p>Specific enough to guide the album, but short enough to stay readable. One scene, one lighting direction, one wardrobe tone, and one intended use are usually enough for a first request.</p>
          <p>Good references make the final gallery feel planned. They give the album a visual language before the first image is generated.</p>
        `
      },
      {
        id: "site_aidreamcapes_blog_private_album_credit",
        slug: "/blog/private-album-credit-planning-guide",
        pageTitle: "Private album credit planning",
        title: "How to plan private album credits for Aidreamcapes",
        summary:
          "Plan output count, review time, visible credit cost, and how much iteration you want before starting a fan or holiday album.",
        author: "Aidreamcapes editorial team",
        publishedAt: "2026-07-28",
        updatedAt: "2026-07-28",
        readMinutes: "6",
        imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/showcase/thanksgiving-memory-sets.webp",
        imageAlt: "Aidreamcapes private album credit cover",
        tags: "Private albums|Credits|Fan scenes|Holiday planning",
        primaryCta: "Plan credits",
        primaryHref: "/login",
        secondaryCta: "Browse albums",
        secondaryHref: "/collections",
        seoTitle: "Aidreamcapes private album credits and planning guide",
        seoDescription:
          "Plan Aidreamcapes album credits by output count, visible cost, private gallery review, and whether the next request is a fan scene or holiday set.",
        seoKeywords:
          "private album credits, fan-scene planning, holiday album pricing, Aidreamcapes",
        body: html`
          <p>A private album is more than a single portrait. It is a small visual story, so the best credit plan starts with scope: how many scenes you need, how experimental the theme is, and how much review you want before sharing favorites.</p>
          <h2 id="define-the-album-scope">Define the album scope</h2>
          <p>Decide whether you need one polished profile set, a wider fan-scene story, or a keepsake album with multiple crops. A focused profile refresh may need fewer outputs than a theme album that covers arrival, greeting, pose, close-up, and card-ready frames.</p>
          <p>Scope also affects how you review the results. A profile refresh can be judged by one or two strong hero images. A theme album needs continuity: similar light, believable wardrobe, and enough variety that the gallery feels like a short story rather than repeated versions of the same frame.</p>
          <h2 id="review-credit-cost-before-starting">Review credit cost before starting</h2>
          <p>Aidreamcapes shows credit cost before a private generation request begins. Use that step to decide whether the album should be a first test, a full theme set, or a follow-up after improving source portraits and references.</p>
          <h2 id="budget-for-iteration">Budget for iteration</h2>
          <p>Theme mood can be sensitive to lighting, wardrobe, and scene details. If you are testing a new look, leave room for a second pass. The first gallery can teach you which source photos, outfit notes, or reference details to refine.</p>
          <h2 id="keep-private-review-in-the-plan">Keep private review in the plan</h2>
          <p>Finished images return to the account gallery, where you can compare consistency before downloading. Review time matters because some frames may become profile images, while others belong in a private keepsake album.</p>
          <h2 id="avoid-spending-credits-on-mixed-albums">Avoid spending credits on mixed albums</h2>
          <p>The easiest way to waste a private album is to ask for several moods at once. A fan-scene morning, holiday table, spotlight portrait, and party night can all belong in the larger imagination, but they compete when one request needs a coherent gallery. Pick the theme that best fits the source photos and save the other ideas for later.</p>
          <p>This does not make the album less creative. It makes the review clearer. When the theme is focused, you can judge whether identity, lighting, clothing, and scene texture improved together instead of trying to untangle too many changes at once.</p>
          <h2 id="match-album-size-to-use">Match album size to the use</h2>
          <table><thead><tr><th>Album use</th><th>Credit planning approach</th><th>Private review focus</th></tr></thead><tbody><tr><td>Profile refresh</td><td>Choose a tighter set with one theme.</td><td>Face consistency, crop, and clean background detail.</td></tr><tr><td>Theme story</td><td>Plan for several scenes in the same visual language.</td><td>Whether the album feels connected from image to image.</td></tr><tr><td>Gift or keepsake</td><td>Leave room for a second pass if the mood is personal.</td><td>Expression, warmth, and whether the image feels believable.</td></tr><tr><td>Creator content</td><td>Budget for crop variety and a few stronger scene options.</td><td>Which images can work as headers, posts, or thumbnails.</td></tr></tbody></table>
          <h2 id="choose-the-next-album">Choose the next album from what worked</h2>
          <p>If holiday light fits the subject well, build a second album around warm cards, table scenes, or winter keepsakes. If fan-scene texture works better, try supporter walls, backstage moments, or watch-party sets. Let the first private gallery guide the next credit spend.</p>
          <h2 id="credit-planning-checklist">Credit planning checklist</h2>
          <ul><li>Name the album mood before choosing the package.</li><li>Match source-photo quality to the ambition of the album.</li><li>Check credit cost before generation starts.</li><li>Save room for a second pass when testing a new look.</li><li>Use the private gallery to decide what to download and what to improve.</li></ul>
          <h2 id="album-credit-faq">Album credit FAQ</h2>
          <h3 id="should-i-run-one-large-album-first">Should I run one large album first?</h3>
          <p>Run a larger album when the direction is already clear. If you are testing a new look, a focused first pass can show whether the source photos and references are working before you spend more credits.</p>
          <h3 id="what-counts-as-a-good-first-pass">What counts as a good first pass?</h3>
          <p>A good first pass does not need every image to be final. It should show stable identity, a believable mood, and enough usable frames to decide whether the next request should expand, repeat, or change direction.</p>
          <h3 id="how-should-i-compare-two-ideas">How should I compare two ideas?</h3>
          <p>Compare one variable at a time. If both source photos and album mood change between requests, it becomes harder to know what improved the gallery.</p>
          <p>Credits are easiest to manage when each request has a clear purpose. Plan the album, review the cost, then let the private gallery show you what the next set should become.</p>
        `
      },
      ...aidreamcapesThemeArticles
    ]
  }
];

for (const config of siteConfigs) {
  config.articles = config.coverageMode === "creative-packs"
    ? buildCreativePackCoverageArticles(sourceState, config.siteId, config.brand)
    : [
        ...config.articles,
        ...buildCoverageArticles(sourceState, config.siteId, config.brand, config.articles)
      ];
  if (config.siteId === MYDREAMSHOOTS_SITE_ID) {
    const remediationSlugs = new Set([
      ...MYDREAMSHOOTS_BLOG_SEO_REMEDIATION_SLUGS,
      ...MYDREAMSHOOTS_SEASONAL_OCCASION_BLOG_SEO_SLUGS
    ]);
    config.articles = [
      ...config.articles.filter((article) => !remediationSlugs.has(article.slug)),
      ...mydreamshootsBlogSeoRemediationArticles.map((article) => makePriorityBlogArticle(article)),
      ...mydreamshootsSeasonalOccasionBlogSeoArticles.map((article) => makePriorityBlogArticle(article))
    ];
  }
  if (config.siteId === MYDREAMSHOOTS_SITE_ID && SOCCER_MIGRATION_APPROVED && !config.articles.some((article) => article.slug === "/blog/soccer-fan-photo-guide")) {
    const legacySoccerArticle = config.articles.find((article) => article.slug === "/blog/world-cup-fan-photos-photo-package-guide");
    if (legacySoccerArticle) {
      config.articles.push({
        ...clone(legacySoccerArticle),
        id: `${MYDREAMSHOOTS_SITE_ID}_blog_theme_soccer_fan_photo_guide`,
        slug: "/blog/soccer-fan-photo-guide",
        pageTitle: "Soccer fan photo guide",
        imageUrl: "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-02.webp?v=20260715b",
        imageAlt: "Personal soccer supporter portrait in generic colors with a clean poster crop.",
        seoTitle: "Soccer fan photo planning guide | myDreamshoots",
        seoDescription: "Plan personal soccer supporter portraits and generic match-day posters with approved source photos, clean crops, and no official marks."
      });
    }
  }
  assertUniqueArticleCovers(config);
  assertMyDreamShootsArticleFacts(config);
}

function toTemplate(pageJson) {
  const sections = {};
  for (const [id, value] of Object.entries(pageJson.sections ?? {})) {
    sections[id] = {
      type: value.type,
      version: "1",
      card_name: value.type,
      settings: clone(value.settings ?? {}),
      blocks: clone(value.blocks ?? [])
    };
  }
  return {
    content_for_page: clone(pageJson.sectionsOrder ?? []),
    sections
  };
}

function ensureFooter(settings, label) {
  settings.navigation ??= { headerLinks: [], footerLinks: [] };
  settings.navigation.footerLinks ??= [];
  const navLinks = settings.navigation.footerLinks;
  const existingNav = navLinks.find((link) => link.href === "/blog");
  if (existingNav) {
    existingNav.label = label;
    existingNav.group = "company";
  } else {
    navLinks.push({ label, href: "/blog", group: "company" });
  }
  settings.navigation.footerLinks = navLinks.filter((link, index, links) => links.findIndex((item) => item.href === link.href) === index);

  settings.globalSections ??= {};
  settings.globalSections.footer ??= { type: "footer", settings: {}, blocks: [] };
  settings.globalSections.footer.blocks ??= [];
  const blocks = settings.globalSections.footer.blocks;
  const existingBlock = blocks.find((block) => block.settings?.href === "/blog");
  if (existingBlock) {
    existingBlock.type = "menu_link";
    existingBlock.settings = { ...(existingBlock.settings ?? {}), label, href: "/blog", group: "company" };
  } else {
    blocks.push({
      id: `global_footer_blog_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "guides"}`,
      type: "menu_link",
      settings: { label, href: "/blog", group: "company" }
    });
  }
  settings.globalSections.footer.blocks = blocks.filter((block, index, allBlocks) => {
    const href = block.settings?.href;
    if (href !== "/blog") return true;
    return allBlocks.findIndex((item) => item.settings?.href === href) === index;
  });
}

function insertOrMoveLink(links, link, beforeHrefs = []) {
  const normalizedHref = link.href;
  const existingIndex = links.findIndex((item) => item.href === normalizedHref);
  const nextLinks = existingIndex >= 0 ? links.filter((_, index) => index !== existingIndex) : [...links];
  const insertIndex = nextLinks.findIndex((item) => beforeHrefs.includes(item.href));
  nextLinks.splice(insertIndex >= 0 ? insertIndex : nextLinks.length, 0, existingIndex >= 0 ? { ...links[existingIndex], ...link } : link);
  return nextLinks.filter((item, index, allItems) => allItems.findIndex((candidate) => candidate.href === item.href) === index);
}

function ensureHeader(settings) {
  const blogLink = { label: "Blog", href: "/blog" };
  settings.navigation ??= { headerLinks: [], footerLinks: [] };
  settings.navigation.headerLinks ??= [];
  settings.navigation.headerLinks = insertOrMoveLink(settings.navigation.headerLinks, blogLink, ["/pricing", "/faq"]);

  settings.globalSections ??= {};
  settings.globalSections.header ??= { type: "header", settings: {}, blocks: [] };
  settings.globalSections.header.blocks ??= [];
  const blocks = settings.globalSections.header.blocks;
  const blogBlock = {
    id: "global_header_blog",
    type: "menu_link",
    settings: { label: "Blog", href: "/blog" }
  };
  const existingIndex = blocks.findIndex((block) => block.type === "menu_link" && block.settings?.href === "/blog");
  const nextBlocks = existingIndex >= 0 ? blocks.filter((_, index) => index !== existingIndex) : [...blocks];
  const insertIndex = nextBlocks.findIndex((block) => block.type === "menu_link" && ["/pricing", "/faq"].includes(block.settings?.href));
  nextBlocks.splice(insertIndex >= 0 ? insertIndex : nextBlocks.length, 0, existingIndex >= 0 ? { ...blocks[existingIndex], settings: { ...(blocks[existingIndex].settings ?? {}), label: "Blog", href: "/blog" } } : blogBlock);
  settings.globalSections.header.blocks = nextBlocks.filter((block, index, allBlocks) => {
    const href = block.settings?.href;
    if (href !== "/blog") return true;
    return allBlocks.findIndex((item) => item.settings?.href === href) === index;
  });
}

function makeBlogHomeJson(config, existingPage) {
  const existing = existingPage?.publishedJson ?? {};
  const sections = clone(existing.sections ?? {});
  sections.blog_intro_1 = section("rich_text", {
    eyebrow: config.blogTitle,
    title: config.homeIntroTitle,
    body: config.homeIntroBody,
    headingLevel: "h1"
  });
  sections.blog_list_1 = section("blog_list", {
    title: config.homeListTitle,
    headingLevel: "h2",
    body: config.homeListBody,
    guideType: config.guideType
  });
  const sectionsOrder = ["blog_intro_1", "blog_list_1", "packages_strip_1", "conversion_1"].filter((id) => sections[id]);
  return {
    pageType: "blog",
    version: existing.version ?? 1,
    sectionsOrder,
    sections,
    seo: {
      title: config.homeSeo.title,
      description: config.homeSeo.description,
      keywords: config.homeSeo.keywords,
      ogImage: config.homeSeo.ogImage ?? config.articles[0]?.imageUrl ?? "",
      canonicalPath: "/blog",
      robots: { index: true, follow: true }
    }
  };
}

function makeArticleJson(config, article, existingPage, sourceArticlePage) {
  const sourceJson = existingPage?.publishedJson ?? sourceArticlePage?.publishedJson ?? {};
  const sections = clone(sourceJson.sections ?? {});
  const targetHref = article.targetHref ?? article.secondaryHref ?? article.primaryHref ?? "/collections";
  const targetLabel = article.targetLabel ?? article.secondaryCta ?? article.primaryCta ?? "Open related page";
  sections.blog_detail_1 = section("blog_article", {
    eyebrow: article.slug === config.articles[0].slug ? config.guideType : "Guide",
    title: article.title,
    headingLevel: "h1",
    summary: article.summary,
    author: article.author,
    authorType: article.authorType,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    readMinutes: article.readMinutes,
    imageUrl: article.imageUrl,
    imageAlt: article.imageAlt,
    tags: article.tags,
    primaryCta: article.primaryCta,
    primaryHref: article.primaryHref,
    secondaryCta: article.secondaryCta,
    secondaryHref: article.secondaryHref,
    targetLabel,
    targetHref,
    secondaryTargetLabel: article.secondaryTargetLabel,
    secondaryTargetHref: article.secondaryTargetHref,
    entityName: article.entityName,
    primaryKeyword: article.primaryKeyword,
    searchIntent: article.searchIntent,
    productSlug: article.productSlug,
    userIntent: article.userIntent,
    suitableUses: clone(article.suitableUses ?? []),
    unsuitableUses: clone(article.unsuitableUses ?? []),
    inputRequirements: clone(article.inputRequirements ?? []),
    verifiedLimitations: clone(article.verifiedLimitations ?? []),
    comparisonTargets: clone(article.comparisonTargets ?? []),
    reviewChecklist: clone(article.reviewChecklist ?? []),
    rightsWarnings: clone(article.rightsWarnings ?? []),
    relatedGuides: clone(article.relatedGuides ?? []),
    authorUrl: article.authorUrl,
    reviewOwner: article.reviewOwner,
    reviewedAt: article.reviewedAt,
    evidenceDate: article.evidenceDate,
    evidenceType: article.evidenceType,
    relatedLinks: clone(article.relatedLinks ?? []),
    body: article.body
  });
  for (const sectionId of ["packages_1", "packages_strip_1", "blog_list_1", "conversion_1"]) {
    delete sections[sectionId];
  }
  const sectionsOrder = ["blog_detail_1"];
  return {
    pageType: "article",
    version: sourceJson.version ?? 1,
    sectionsOrder,
    sections,
    seo: {
      title: article.seoTitle,
      description: article.seoDescription,
      keywords: article.seoKeywords,
      canonicalPath: article.slug,
      ogImage: article.imageUrl,
      robots: { index: true, follow: true }
    }
  };
}

function upsertPage(site, page) {
  const index = site.pages.findIndex((item) => item.slug === page.slug);
  if (index >= 0) {
    site.pages[index] = { ...site.pages[index], ...page };
    return;
  }
  const lastBlogIndex = site.pages.reduce((lastIndex, item, itemIndex) => item.slug === "/blog" || item.slug.startsWith("/blog/") ? itemIndex : lastIndex, -1);
  site.pages.splice(lastBlogIndex >= 0 ? lastBlogIndex + 1 : site.pages.length, 0, page);
}

function syncSiteThemes(state, site) {
  const firstArticle = site.pages.find((page) => page.slug.startsWith("/blog/"));
  for (const theme of state.siteThemes ?? []) {
    if (theme.siteId !== site.id) continue;
    if (theme.status === "active") continue;
    theme.settings ??= {};
    theme.settings.settings_data ??= {};
    theme.settings.settings_data.current = clone(site.themeSettings.draftJson);
    if (!theme.templates) continue;
    const blogHome = site.pages.find((page) => page.slug === "/blog");
    if (blogHome) theme.templates.blog = toTemplate(blogHome.draftJson);
    if (firstArticle) theme.templates["blog-detail"] = toTemplate(firstArticle.draftJson);
  }
}

function removeStaleBlogArticles(site, expectedArticleSlugs) {
  site.pages = site.pages.filter((page) => {
    if (!page.slug.startsWith("/blog/")) return true;
    return expectedArticleSlugs.has(page.slug);
  });
}

function syncSeoFallbacks() {
  return {
    updated: false,
    skipped: true,
    reason: "sitemap_is_derived_from_published_snapshot_pages"
  };
}

function syncSite(state, config) {
  const site = state.sites.find((item) => item.id === config.siteId || item.slug === config.slug);
  if (!site) throw new Error(`Missing site ${config.slug}`);
  if (!String(site.primaryDomain ?? "").includes(".com")) return;

  site.themeSettings ??= {};
  site.themeSettings.draftJson ??= {};
  ensureHeader(site.themeSettings.draftJson);
    ensureFooter(site.themeSettings.draftJson, config.footerLabel);

  const existingBlogHome = site.pages.find((page) => page.slug === "/blog");
  const blogHomeJson = makeBlogHomeJson(config, existingBlogHome);
  upsertPage(site, {
    id: existingBlogHome?.id ?? `${site.id}_blog`,
    siteId: site.id,
    pageType: "blog",
    templateKey: "blog",
    slug: "/blog",
    title: config.blogTitle,
    draftJson: clone(blogHomeJson),
    ...(existingBlogHome?.publishedJson ? { publishedJson: existingBlogHome.publishedJson } : {})
  });

  const sourceArticlePage = site.pages.find((page) => page.slug.startsWith("/blog/"));
  for (const article of config.articles) {
    const existingPage = site.pages.find((page) => page.slug === article.slug);
    const articleJson = makeArticleJson(config, article, existingPage, sourceArticlePage);
    upsertPage(site, {
      id: existingPage?.id ?? article.id,
      siteId: site.id,
      pageType: "article",
      templateKey: "blog-detail",
      slug: article.slug,
      title: article.pageTitle,
      draftJson: clone(articleJson),
      ...(existingPage?.publishedJson ? { publishedJson: existingPage.publishedJson } : {})
    });
  }

  removeStaleBlogArticles(site, new Set(config.articles.map((article) => article.slug)));
  syncSiteThemes(state, site);
}

function seoSettingsForPage(page) {
  const seo = page.publishedJson?.seo ?? {};
  return {
    title: seo.title ?? page.title,
    description: seo.description ?? "",
    keywords: seo.keywords ?? "",
    ogImage: seo.ogImage ?? "",
    canonicalPath: seo.canonicalPath ?? page.slug,
    index: seo.robots?.index ?? true,
    follow: seo.robots?.follow ?? true
  };
}

function mergeScopedSeoPages(settings) {
  // Page SEO belongs to ThemePage JSON; the legacy settings map is compatibility-only.
  return clone(settings ?? {});
}

function syncScopedSite(state, config, slugs) {
  const site = state.sites.find((item) => item.id === config.siteId || item.slug === config.slug);
  if (!site) throw new Error(`Missing site ${config.slug}`);
  const selectedArticles = config.articles.filter((article) => slugs.has(article.slug));
  const missingSlugs = Array.from(slugs).filter((slug) => !selectedArticles.some((article) => article.slug === slug));
  if (missingSlugs.length) throw new Error(`Missing generated priority articles: ${missingSlugs.join(", ")}`);

  const sourceArticlePage = site.pages.find((page) => page.slug.startsWith("/blog/"));
  const pages = selectedArticles.map((article) => {
    const existingPage = site.pages.find((page) => page.slug === article.slug);
    const articleJson = makeArticleJson(config, article, existingPage, sourceArticlePage);
    const page = {
      id: existingPage?.id ?? article.id,
      siteId: site.id,
      pageType: "article",
      templateKey: "blog-detail",
      slug: article.slug,
      title: article.pageTitle,
      draftJson: clone(articleJson),
      ...(existingPage?.publishedJson ? { publishedJson: existingPage.publishedJson } : {})
    };
    upsertPage(site, page);
    return page;
  });

  site.themeSettings.draftJson = mergeScopedSeoPages(site.themeSettings.draftJson, pages);
  return pages;
}

function assertLocalDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl) throw new Error("--db requires DATABASE_URL.");
  const parsed = new URL(databaseUrl);
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(parsed.hostname)) {
    throw new Error(`Refusing scoped blog sync against non-local database host: ${parsed.hostname}`);
  }
  if (process.env.ALLOW_LOCAL_BLOG_DB_SYNC !== "1") {
    throw new Error("--db requires ALLOW_LOCAL_BLOG_DB_SYNC=1 after confirming the database is local and disposable.");
  }
  if (["15432", "15433"].includes(parsed.port) && process.env.LOCAL_BLOG_DB_CONTAINER_CONFIRMED !== "1") {
    throw new Error(`Refusing mapped database port ${parsed.port} until LOCAL_BLOG_DB_CONTAINER_CONFIRMED=1 confirms the local disposable container.`);
  }
}

function toPrismaJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function updateScopedDatabase(state, pages) {
  assertLocalDatabaseUrl();
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      const databasePages = [];
      for (const page of pages) {
        const existing = await tx.themePage.findUnique({
          where: { siteId_slug: { siteId: MYDREAMSHOOTS_SITE_ID, slug: page.slug } },
          select: { id: true }
        });
        if (!existing) throw new Error(`ThemePage ${MYDREAMSHOOTS_SITE_ID}:${page.slug} must exist before draft content can be imported.`);
        const id = existing.id;
        const data = {
          siteId: MYDREAMSHOOTS_SITE_ID,
          pageType: page.pageType,
          templateKey: page.templateKey,
          slug: page.slug,
          title: page.title,
          draftJson: toPrismaJson(page.draftJson)
        };
        await tx.themePage.update({ where: { id }, data });
        databasePages.push({ ...page, id });
      }

      const themeSettings = await tx.themeSettings.findUnique({ where: { siteId: MYDREAMSHOOTS_SITE_ID } });
      if (!themeSettings) throw new Error(`Missing ThemeSettings for ${MYDREAMSHOOTS_SITE_ID}.`);
      await tx.themeSettings.update({
        where: { siteId: MYDREAMSHOOTS_SITE_ID },
        data: {
          draftJson: toPrismaJson(mergeScopedSeoPages(themeSettings.draftJson, databasePages))
        }
      });

      const stateDocument = await tx.platformStateDocument.findUnique({ where: { id: "platform" } });
      if (stateDocument?.state && Array.isArray(stateDocument.state.sites)) {
        const nextState = clone(stateDocument.state);
        const stateSite = nextState.sites.find((item) => item.id === MYDREAMSHOOTS_SITE_ID);
        if (stateSite) {
          stateSite.pages ??= [];
          for (const page of databasePages) {
            const index = stateSite.pages.findIndex((item) => item?.slug === page.slug || item?.id === page.id);
            if (index < 0) throw new Error(`Platform state ThemePage ${page.slug} must exist before draft content can be imported.`);
            const entry = {
              id: page.id,
              siteId: MYDREAMSHOOTS_SITE_ID,
              pageType: page.pageType,
              templateKey: page.templateKey,
              slug: page.slug,
              title: page.title,
              draftJson: clone(page.draftJson)
            };
            stateSite.pages[index] = { ...stateSite.pages[index], ...entry };
          }
          stateSite.themeSettings = {
            ...stateSite.themeSettings,
            draftJson: mergeScopedSeoPages(stateSite.themeSettings?.draftJson, databasePages)
          };
          await tx.platformStateDocument.update({ where: { id: "platform" }, data: { state: toPrismaJson(nextState) } });
        }
      }
    }, { timeout: 120_000 });
  } finally {
    await prisma.$disconnect();
  }
}

const state = clone(sourceState);
let updatedPages = [];
let updatedSites = [];
let seoFallbacks = { updated: false, skipped: scopedRun };

if (scopedRun) {
  const config = siteConfigs.find((item) => item.siteId === requestedSiteId);
  if (!config) throw new Error(`Missing config for ${requestedSiteId}`);
  updatedPages = syncScopedSite(state, config, new Set(requestedSlugs));
  updatedSites = [config.slug];
} else {
  for (const config of siteConfigs) syncSite(state, config);
  updatedSites = siteConfigs.map((config) => config.slug);
  seoFallbacks = syncSeoFallbacks(state, { write: !dryRun });
}

if (updateDb && !dryRun) {
  await updateScopedDatabase(state, updatedPages);
} else if (!dryRun) {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

console.log(JSON.stringify({
  ok: true,
  dryRun,
  updateDb,
  scopedRun,
  updatedSites,
  updatedSlugs: updatedPages.map((page) => page.slug),
  articlesPerSite: Object.fromEntries(siteConfigs.map((config) => [config.slug, config.articles.length])),
  seoFallbacks
}, null, 2));
