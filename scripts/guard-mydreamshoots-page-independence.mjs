#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const taxonomy = readJson("src/lib/mydreamshoots-theme-taxonomy.json");
const profiles = readJson("src/lib/photo-package-use-case-profiles.json").mydreamshootsCategories ?? {};
const contractSource = fs.readFileSync(path.join(root, "src/lib/mydreamshoots-published-contract.ts"), "utf8");

const genericPatterns = [
  ["galleryIntro", /^Review .+ examples before opening the .+ workflow\.$/i],
  ["ctaTitle", /^Create .+ images in your private studio\.$/i],
  ["ctaSubtitle", /^Turn approved source photos into .+ with visible credit cost and private gallery review\.$/i],
  ["relatedTitle", /^More .+ and nearby themes$/i],
  ["relatedSubtitle", /^Compare .+ and adjacent themes before opening (?:a|an) .+ set\.$/i]
];
const contentFields = [
  "headline", "cardDescription", "detailIntro", "whatCreates", "bestFor", "workflow", "reviewPoints",
  "styleNotes", "galleryTitle", "galleryIntro", "ctaTitle", "ctaSubtitle", "faqTitle", "faqItems",
  "relatedTitle", "relatedSubtitle"
];

function words(value) {
  return JSON.stringify(value)
    .toLowerCase()
    .replace(/mydreamshoots|ai|photo|photos|image|images|private|gallery|workflow|theme|themes/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token));
}

function ngrams(tokens, size = 5) {
  const values = new Set();
  for (let index = 0; index <= tokens.length - size; index += 1) values.add(tokens.slice(index, index + size).join(" "));
  return values;
}

function jaccard(left, right) {
  if (!left.size && !right.size) return 1;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

const rows = [];
const invalid = [];
const faqGroups = new Map();
for (const item of taxonomy.items ?? []) {
  const slug = String(item.slug ?? "").trim();
  const profile = profiles[slug];
  if (!profile) {
    invalid.push({ slug, reason: "PAGE_COPY_MISSING" });
    continue;
  }
  const reasons = [];
  if (profile.pageEntityId !== `mydreamshoots:ai-image-theme:${slug}`) reasons.push("PAGE_ENTITY_MISMATCH");
  if (profile.copyRevision !== `2026-08-18.${slug}`) reasons.push("COPY_REVISION_MISMATCH");
  for (const [field, pattern] of genericPatterns) {
    if (pattern.test(String(profile[field] ?? "").trim())) reasons.push(`GENERIC_${field.toUpperCase()}`);
  }
  if (!Array.isArray(profile.bestFor) || profile.bestFor.length < 3) reasons.push("USE_CASES_INCOMPLETE");
  if (!Array.isArray(profile.workflow) || profile.workflow.length < 3) reasons.push("WORKFLOW_INCOMPLETE");
  if (!Array.isArray(profile.reviewPoints ?? profile.styleNotes) || (profile.reviewPoints ?? profile.styleNotes).length < 3) reasons.push("REVIEW_CRITERIA_INCOMPLETE");
  if (!Array.isArray(profile.faqItems) || profile.faqItems.length < 3) reasons.push("FAQ_INCOMPLETE");
  if (!String(profile.ctaHref ?? "").startsWith("/")) reasons.push("CTA_HREF_MISSING");
  if (!Array.isArray(profile.relatedLinks) || profile.relatedLinks.length < 2) reasons.push("RELATED_LINKS_INCOMPLETE");
  const faqSignature = JSON.stringify((profile.faqItems ?? []).map((faq) => [faq.question?.trim().toLowerCase(), faq.answer?.trim().toLowerCase()]));
  faqGroups.set(faqSignature, [...(faqGroups.get(faqSignature) ?? []), slug]);
  const normalized = ngrams(words(Object.fromEntries(contentFields.map((field) => [field, profile[field]]))));
  rows.push({ slug, reasons, normalized });
}

for (const slugs of faqGroups.values()) {
  if (slugs.length > 1) for (const slug of slugs) rows.find((row) => row.slug === slug)?.reasons.push(`DUPLICATE_FAQ_GROUP:${slugs.join("|")}`);
}

const similarityWarnings = [];
const similarityFailures = [];
for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
    const score = jaccard(rows[leftIndex].normalized, rows[rightIndex].normalized);
    const pair = { left: rows[leftIndex].slug, right: rows[rightIndex].slug, score: Number(score.toFixed(3)) };
    if (score >= 0.7) similarityFailures.push(pair);
    else if (score >= 0.35) similarityWarnings.push(pair);
  }
}

assert.equal(rows.length, 38, "page independence guard must inspect all 38 taxonomy leaves");
assert.equal(invalid.length, 0, "page entity identity and copy revisions must be exact", { invalid });
assert.equal(similarityFailures.length, 0, "normalized page content must remain below 0.70 Jaccard", { similarityFailures });
assert.match(contractSource, /assessMydreamshootsPageIndependence\(copy, canonicalSlug\)/, "published routes must apply the same page-independence contract");
assert.match(contractSource, /const indexable = copyReady && copyIndependent && mediaReady/, "non-independent pages must fail closed before indexing");
assert.match(contractSource, /ctaLinkEntityId: publishedLinkEntityId\(route\.pageEntityId, "cta"\)/, "published page entities must own the CTA link entity");
assert.match(contractSource, /relatedLinkEntityIds: \(copy\.relatedLinks \?\? \[\]\)\.map/, "published page entities must own related link entities");

const reviewRows = rows.filter((row) => row.reasons.length).map(({ slug, reasons }) => ({ slug, reasons }));
console.log(JSON.stringify({
  ok: true,
  checkedRows: rows.length,
  independentRows: rows.length - reviewRows.length,
  reviewRows: reviewRows.length,
  reviewPages: reviewRows,
  similarityFailures,
  similarityWarnings
}, null, 2));
