import assert from "node:assert/strict";
import {
  AIDREAMCAPES_EU_HOMEPAGE_IMAGE_SLUGS,
  AIDREAMCAPES_EU_HOMEPAGE_REVIEW_BLOCKS,
  AIDREAMCAPES_EU_HOMEPAGE_REVIEW_BLOCK_IDS,
  AIDREAMCAPES_EU_HOMEPAGE_SECTION_ORDER,
  AIDREAMCAPES_EU_HOMEPAGE_VIDEO_SLUGS,
  DEFAULT_EU_HOMEPAGE_FAQ_IMAGES
} from "./aidreamcapes-eu-homepage-copy.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_SLUG = "aidreamcapes-eu";
const SITE_DOMAIN = "aidreamcapes.eu";
const CANONICAL_LOGO = "/assets/sites/site_aidreamcapes_eu/brand/aidreamcapes-logo-refined.svg?v=20260717a";
const NO_CROP_PREFIX = "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/";

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function section(pageJson, id) {
  const value = pageJson?.sections?.[id];
  assert.ok(value && typeof value === "object", `homepage section is missing: ${id}`);
  return value;
}

function assertReviewContract(proof) {
  assert.equal(proof.type, "testimonial_wall", "homepage proof section must use testimonial_wall");
  assert.equal(stringValue(proof.settings?.mode), "reviews", "homepage proof section must use reviews mode");
  const reviewBlocks = (proof.blocks ?? []).filter((block) => /^review_/i.test(String(block?.id ?? "")));
  assert.deepEqual(reviewBlocks.map((block) => block.id), AIDREAMCAPES_EU_HOMEPAGE_REVIEW_BLOCK_IDS, "homepage review block order/count drifted");
  for (const blockId of AIDREAMCAPES_EU_HOMEPAGE_REVIEW_BLOCK_IDS) {
    const block = reviewBlocks.find((candidate) => candidate.id === blockId);
    const expected = AIDREAMCAPES_EU_HOMEPAGE_REVIEW_BLOCKS[blockId];
    assert.ok(block, `homepage review block is missing: ${blockId}`);
    assert.equal(block.settings?.name, expected.name, `homepage review name drifted: ${blockId}`);
    assert.equal(block.settings?.avatarUrl, expected.avatarUrl, `homepage review avatar drifted: ${blockId}`);
    assert.equal(block.settings?.resultImageUrl, expected.resultImageUrl, `homepage review result image drifted: ${blockId}`);
    assert.notEqual(block.settings?.avatarUrl, block.settings?.resultImageUrl, `homepage review avatar/result must be distinct: ${blockId}`);
    assert.match(stringValue(block.settings?.resultImageUrl), /\/vendor-[^/]+\//, `homepage review result must be a vendor theme image: ${blockId}`);
  }
}

function assertFaqContract(faq) {
  const imageList = stringValue(faq.settings?.imageList).split("|").filter(Boolean);
  assert.ok(imageList.length >= DEFAULT_EU_HOMEPAGE_FAQ_IMAGES.length, "homepage FAQ image list is incomplete");
  assert.ok(imageList.every((value) => value.startsWith(NO_CROP_PREFIX)), "homepage FAQ contains a crop-prone image source");
  assert.equal(stringValue(faq.settings?.imageUrl), imageList[0], "homepage FAQ cover must match the canonical image list");
  for (const block of faq.blocks ?? []) {
    if (!/^faq_(about|uploads|couples|photo_generator|video|styling)$/.test(String(block?.id ?? ""))) continue;
    assert.ok(stringValue(block.settings?.imageUrl).startsWith(NO_CROP_PREFIX), `homepage FAQ block image drifted: ${block.id}`);
  }
}

export function assertAidreamcapesEuHomepageJsonContract(pageJson, label = "homepage") {
  assert.ok(pageJson && typeof pageJson === "object", `${label} JSON is missing`);
  assert.deepEqual(pageJson.sectionsOrder, AIDREAMCAPES_EU_HOMEPAGE_SECTION_ORDER, `${label} section order drifted`);
  const showcase = section(pageJson, "generation_showcase_1");
  assert.equal(showcase.type, "dreamshoot_generation_showcase", `${label} showcase type drifted`);
  assert.equal(stringValue(showcase.settings?.imageSlugs), AIDREAMCAPES_EU_HOMEPAGE_IMAGE_SLUGS.join("|"), `${label} photo showcase drifted`);
  assert.equal(stringValue(showcase.settings?.videoSlugs), AIDREAMCAPES_EU_HOMEPAGE_VIDEO_SLUGS.join("|"), `${label} video showcase drifted`);
  assert.equal(showcase.settings?.imageTitle, "Générateurs photo IA à découvrir", `${label} photo showcase title drifted`);
  assert.equal(showcase.settings?.videoTitle, "Générateurs vidéo IA à découvrir", `${label} video showcase title drifted`);
  assertReviewContract(section(pageJson, "proof_1"));
  assertFaqContract(section(pageJson, "faq_1"));
  const serialized = JSON.stringify(pageJson);
  assert.equal(serialized.includes("fan-holiday-theme/categories"), false, `${label} contains legacy fan-holiday category assets`);
  return {
    version: pageJson.version ?? null,
    sectionOrder: [...pageJson.sectionsOrder],
    reviewBlockCount: AIDREAMCAPES_EU_HOMEPAGE_REVIEW_BLOCK_IDS.length,
    faqImageCount: stringValue(pageJson.sections.faq_1.settings?.imageList).split("|").filter(Boolean).length,
    showcaseImageSlugs: [...AIDREAMCAPES_EU_HOMEPAGE_IMAGE_SLUGS]
  };
}

export async function assertAidreamcapesEuHomepageIntegrity(prisma) {
  const [site, livePage, themePage] = await Promise.all([
    prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true, branding: true } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/" } } }),
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/" } } })
  ]);
  assert.ok(site, `site is missing: ${SITE_ID}`);
  assert.equal(site.slug, SITE_SLUG, "Aidreamcapes EU site slug drifted");
  assert.equal(site.primaryDomain, SITE_DOMAIN, "Aidreamcapes EU primary domain drifted");
  assert.equal(site.branding?.logoImageUrl, CANONICAL_LOGO, "Aidreamcapes EU logo drifted");
  assert.ok(livePage, "Aidreamcapes EU LivePage homepage is missing");
  assert.ok(themePage, "Aidreamcapes EU ThemePage homepage is missing");

  const liveReport = assertAidreamcapesEuHomepageJsonContract(livePage.contentJson, "LivePage homepage");
  const draftReport = assertAidreamcapesEuHomepageJsonContract(themePage.draftJson, "ThemePage draft homepage");
  const publishedReport = assertAidreamcapesEuHomepageJsonContract(themePage.publishedJson, "ThemePage published homepage");
  assert.deepEqual(livePage.contentJson, themePage.draftJson, "LivePage and ThemePage draft homepage diverged");
  assert.deepEqual(themePage.draftJson, themePage.publishedJson, "ThemePage draft and published homepage diverged");
  return { siteId: SITE_ID, slug: SITE_SLUG, live: liveReport, draft: draftReport, published: publishedReport };
}
