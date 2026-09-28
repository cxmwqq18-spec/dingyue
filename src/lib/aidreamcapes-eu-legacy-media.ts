const legacyMirrorCoverPattern = /^\/assets\/sites\/site_aidreamcapes_eu\/mirror\/aidreamcapes\/dreamshoot\/generated\/pack-covers\/([^/]+)\/\1-cover\.(?:png|jpe?g|webp|avif)$/i;
const legacyMirrorGalleryPattern = /^\/assets\/sites\/site_aidreamcapes_eu\/mirror\/aidreamcapes\/dreamshoot\/generated\/pack-galleries\/([^/]+)\/\1-01\.(?:png|jpe?g|webp|avif)$/i;

const euImagePackRoot = "/assets/sites/site_aidreamcapes_eu/generated/recovered/aidreamcapes-eu-image-pack-4k-20260916-v1";
const euProviderPackRoot = "/assets/sites/site_aidreamcapes_eu/generated/recovered/aidreamcapes-eu-provider-4k-20260916-v1";

// The published no-crop rows for the two highest-traffic EU detail pages
// still point at an external mirror. Their current, site-local equivalents
// are the generated image-pack files below. Resolve them before rendering so
// the detail gallery does not wait on a slow mirror or fall back to a missing
// source URL. Directory cards use their own unique cover resolver; this map is
// intentionally limited to detail-gallery slots.
const noCropGalleryReplacements: Record<string, string> = {
  ...Object.fromEntries([
    ["gallery-01-occasion-5052c2f0be.webp", "gallery-01-eabba4a2efef-occasion-5052c2f0be.jpg"],
    ["gallery-02-occasion-68a6e16a3e.webp", "gallery-02-16cb447c5854-occasion-68a6e16a3e.jpg"],
    ["gallery-03-occasion-1bd237fc3f.webp", "gallery-03-45ba56e2cbe6-occasion-1bd237fc3f.jpg"],
    ["gallery-04-occasion-759e3b3626.webp", "gallery-04-940a9f372bb8-occasion-759e3b3626.jpg"],
    ["gallery-05-occasion-68b6d595be.webp", "gallery-05-ef84a1e37d86-occasion-68b6d595be.jpg"],
    ["gallery-06-occasion-3b3eb72fa4.webp", "gallery-06-3a609cc1ccba-occasion-3b3eb72fa4.jpg"],
    ["gallery-07-occasion-63f6dfd229.webp", "gallery-07-9c25e405da14-occasion-63f6dfd229.jpg"],
    ["gallery-08-occasion-0b84b051a6.webp", "gallery-08-42303d19827c-occasion-0b84b051a6.jpg"],
    ["gallery-09-occasion-4f48e44c8c.webp", "gallery-09-be562067823e-occasion-4f48e44c8c.jpg"],
    ["gallery-10-occasion-2c36dcd1bc.webp", "gallery-10-339cacf44ae2-occasion-2c36dcd1bc.jpg"],
    ["gallery-11-occasion-e8f84629de.webp", "gallery-11-a676c73b88e0-occasion-e8f84629de.jpg"],
    ["gallery-12-occasion-3021c5800d.webp", "gallery-12-e35e4615c170-occasion-3021c5800d.jpg"]
  ].map(([source, target]) => [
    `/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/engagement-photo/${source}`,
    `${euImagePackRoot}/engagement-photo/${target}`
  ])),
  ...Object.fromEntries([
    ["gallery-01-occasion-ad1354f9a1.webp", "gallery-01-b7e85001d26f-occasion-ad1354f9a1.jpg"],
    ["gallery-02-occasion-0f24f72a39.webp", "gallery-02-2aaaf5436d24-occasion-0f24f72a39.jpg"],
    ["gallery-03-occasion-e9d0e234a7.webp", "gallery-03-68cd9180096c-occasion-e9d0e234a7.jpg"],
    ["gallery-04-occasion-1b23cb461f.webp", "gallery-04-11b505719ac0-occasion-1b23cb461f.jpg"],
    ["gallery-05-occasion-c19b271be4.webp", "gallery-05-a9ee5f13ded8-occasion-c19b271be4.jpg"],
    ["gallery-06-occasion-a41a70f28b.webp", "gallery-06-557e57f505c1-occasion-a41a70f28b.jpg"],
    ["gallery-07-occasion-293b634881.webp", "gallery-07-3316556383fe-occasion-293b634881.jpg"],
    ["gallery-08-occasion-bd993fccae.webp", "gallery-08-f940bc5b1fc6-occasion-bd993fccae.jpg"],
    ["gallery-09-occasion-409540fb66.webp", "gallery-09-e4d903840507-occasion-409540fb66.jpg"],
    ["gallery-10-occasion-684e0688f3.webp", "gallery-10-663e1da9b7ff-occasion-684e0688f3.jpg"],
    ["gallery-11-occasion-0b04ade9dd.webp", "gallery-11-1d13e2c7b840-occasion-0b04ade9dd.jpg"],
    ["gallery-12-occasion-8a05728e0c.webp", "gallery-12-53809bb00af1-occasion-8a05728e0c.jpg"]
  ].map(([source, target]) => [
    `/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/wedding-photo/${source}`,
    `${euImagePackRoot}/wedding-photo/${target}`
  ]))
};

// The database still contains a number of pre-EU mirror keys. These are
// compatibility replacements, not new content: each target is a file in the
// current EU image pack that is deployed with the storefront release.
const legacyPackCoverReplacements: Record<string, string> = {
  "profile-cards": `${euImagePackRoot}/avatar/cover-333df83b69eb-avatar-cover-cobalt-studio.jpg`,
  "professional-headshots": `${euImagePackRoot}/headshot/cover-6360dd7e005c-headshot-cover-architect-office.jpg`,
  "gala-photos": `${euImagePackRoot}/gala-photo/cover-5b9863721f87-gala-photo-cover-red-carpet-steps.jpg`,
  "creator-portraits": `${euImagePackRoot}/portrait-photo/cover-19ef724d7001-portrait-photo-cover-analog-cafe.jpg`,
  "black-friday": `${euImagePackRoot}/black-friday/cover-d7b389e574c5-black-friday-cover-white-studio-bag.jpg`,
  "only-fans": `${euImagePackRoot}/only-fans/cover-751be524992d-only-fans-cover-home-musician.jpg`,
  "singles-awareness-day": `${euImagePackRoot}/singles-awareness-day/cover-8967392ff7ad-singles-awareness-day-cover-sunrise-run.jpg`,
  "product-style": `${euImagePackRoot}/background-changer/cover-background-changer-00-quiet-city-walk-2cb0da1f20fa.jpg`,
  "background-remover": `${euImagePackRoot}/background-remover/cover-background-remover-00-quiet-city-walk-d85ac6d2b2af.jpg`,
  "magic-eraser": `${euImagePackRoot}/magic-eraser/cover-magic-eraser-00-quiet-city-walk-6e842a44c57a.jpg`,
  "magic-upscaler": `${euImagePackRoot}/photo-enhancer/cover-photo-enhancer-00-quiet-city-walk-7603f9a29b46.jpg`,
  "portrait-retouch": `${euImagePackRoot}/portrait-retouch/cover-portrait-retouch-00-quiet-city-walk-93973d530e01.jpg`,
  "unblur-image": `${euImagePackRoot}/unblur-image/cover-unblur-image-00-quiet-city-walk-cb790273c6f2.jpg`,
  "color-correction": `${euImagePackRoot}/color-correction/cover-color-correction-00-quiet-city-walk-edf1177e9ab4.jpg`,
  "old-photo-restoration": `${euImagePackRoot}/old-photo-restoration/cover-old-photo-restoration-00-quiet-city-walk-2a1bf9ddd8f9.jpg`,
  "social-cards": `${euImagePackRoot}/social-cards/cover-social-cards-00-quiet-city-walk-30a15cc73c01.jpg`,
  "edit-by-prompt": `${euImagePackRoot}/edit-by-prompt/cover-edit-by-prompt-00-quiet-city-walk-4b0d75e03717.jpg`,
  cyberpunk: `${euImagePackRoot}/cyberpunk/cover-6d00c84382e7-cyberpunk-cover-rain-alley.jpg`,
  boudoir: `${euImagePackRoot}/boudoir/cover-8498408a3477-boudoir-cover-silk-window.jpg`,
  holiday: `${euImagePackRoot}/holiday/cover-893fb697d662-holiday-cover-winter-window.jpg`,
  cannes: `${euImagePackRoot}/cannes/cover-3dd2cb8ed69a-cannes-cover-red-carpet-sunset.jpg`,
  nightlife: `${euImagePackRoot}/nightlife/cover-4c08f56660a5-nightlife-cover-jazz-club.jpg`,
  "rich-lifestyle": `${euImagePackRoot}/rich-lifestyle/cover-45d7051cc443-rich-lifestyle-cover-villa-breakfast.jpg`,
  bikini: `${euImagePackRoot}/bikini/cover-ad43fd8d7ca2-bikini-cover-coral-beach.jpg`,
  swimsuit: `${euImagePackRoot}/swimsuit/cover-492eb58413b6-swimsuit-cover-red-one-piece.jpg`,
  nature: `${euImagePackRoot}/travel/cover-4cc6a7986820-travel-cover-lisbon-tram.jpg`,
  "world-cup-fan-photos": `${euImagePackRoot}/soccer/cover-a21c7b9b1ad1-soccer-cover-stadium-scarf.jpg`,
  "outdoor-creator-scenes": `${euImagePackRoot}/travel/cover-4cc6a7986820-travel-cover-lisbon-tram.jpg`,
  "fashion-editorial": `${euImagePackRoot}/portrait-photo/cover-19ef724d7001-portrait-photo-cover-analog-cafe.jpg`,
  mafia: `${euImagePackRoot}/mafia/cover-98242376be30-mafia-cover-1940s-diner.jpg`,
  hairstyle: `${euImagePackRoot}/hairstyle-generator/cover-hairstyle-generator-00-quiet-city-walk-c452820dc22d.jpg`,
  "virtual-try-on": `${euImagePackRoot}/virtual-try-on/cover-virtual-try-on-00-quiet-city-walk-e431078651ef.jpg`,
  "ai-video-add-ons": `${euImagePackRoot}/motion-generator/cover-motion-generator-00-quiet-city-walk-b7fec8e17439.jpg`,
  engagement: `${euImagePackRoot}/wedding-photo/cover-fa9197c1a667-occasion-b7af762a69.jpg`,
  "wedding-photo": `${euImagePackRoot}/wedding-photo/cover-fa9197c1a667-occasion-b7af762a69.jpg`,
  "valentine-photos": `${euImagePackRoot}/valentines-photo/cover-54ae0fb62bf7-occasion-3cf2a1d4ea.jpg`,
  "christmas-photos": `${euImagePackRoot}/christmas-photo/cover-414936c66db4-seasonal-be76f6d3ee.jpg`,
  "halloween-party-photos": `${euImagePackRoot}/halloween-photo/cover-e45b5bb0a588-seasonal-fd5c22148e.jpg`,
  "thanksgiving-group-photos": `${euImagePackRoot}/thanksgiving-photo/cover-0787b71b581c-seasonal-2b3549dc37.jpg`
};

const legacyStandaloneMediaReplacements: Record<string, string> = {
  "generated/20260622-homepage-unique/hero-grid-business.png": legacyPackCoverReplacements["professional-headshots"],
  "generated/20260622-homepage-unique/hero-grid-upscale.png": legacyPackCoverReplacements["magic-upscaler"],
  "generated/20260622-homepage-unique/hero-grid-beauty.png": legacyPackCoverReplacements["virtual-try-on"],
  "generated/category-covers/aidreamcapes/creative-cover.png": legacyPackCoverReplacements.cyberpunk,
  "holiday-card-gpt2.png": legacyPackCoverReplacements["christmas-photos"]
};

const legacyVideoHeroReplacements: Record<string, string> = {
  "explainer-video/hero-explainer-video-product-concept.jpg": `${euProviderPackRoot}/video-topic-015-explainer-video-hero-explainer-video-product-concept.jpg`,
  "how-to-video/hero-how-to-video-hands-on-step.jpg": `${euProviderPackRoot}/video-topic-048-how-to-video-hero-how-to-video-hands-on-step.jpg`,
  "talking-head-video/hero-talking-head-video-professional-presenter.jpg": `${euProviderPackRoot}/video-topic-133-talking-head-video-hero-talking-head-video-professional-presenter.jpg`
};

// Some legacy mirror rows are editorial gallery slots whose original
// filename has no one-to-one regenerated counterpart. They still must never
// escape into EU HTML, JSON-LD, sitemap media or responsive srcsets. Resolve
// those rows to current, site-owned EU pack media selected by the source
// path's subject instead of returning the historical mirror URL.
const legacyMirrorSemanticFallbacks: Array<[RegExp, string]> = [
  [/valentine|engagement|proposal|wedding|save-the-date/i, legacyPackCoverReplacements["wedding-photo"]],
  [/christmas/i, legacyPackCoverReplacements["christmas-photos"]],
  [/halloween/i, legacyPackCoverReplacements["halloween-party-photos"]],
  [/thanksgiving/i, legacyPackCoverReplacements["thanksgiving-group-photos"]],
  [/new-year|holiday|mother|father/i, legacyPackCoverReplacements.holiday],
  [/video|motion|cinematic|talking|tiktok|reels/i, legacyPackCoverReplacements["ai-video-add-ons"]],
  [/product|commerce/i, legacyPackCoverReplacements["product-style"]],
  [/social|creator/i, legacyPackCoverReplacements["social-cards"]],
  [/travel|nature|route/i, legacyPackCoverReplacements.nature],
  [/beauty|hairstyle|portrait|headshot|profile/i, legacyPackCoverReplacements["professional-headshots"]]
];
const legacyMirrorDefaultFallback = legacyPackCoverReplacements["rich-lifestyle"];

function withoutQuery(value: string | undefined): string {
  return String(value ?? "").trim().split(/[?#]/, 1)[0] ?? "";
}

/**
 * The first EU legacy gallery slot was exported from the same source frame as
 * the dedicated cover. The files have different paths/aspect ratios, so URL
 * de-duplication alone cannot protect the public detail page from showing the
 * same visual twice.
 */
export function isAidreamcapesEuLegacyCoverGalleryDerivative(
  coverUrl: string | undefined,
  galleryUrl: string | undefined
): boolean {
  const coverMatch = withoutQuery(coverUrl).match(legacyMirrorCoverPattern);
  const galleryMatch = withoutQuery(galleryUrl).match(legacyMirrorGalleryPattern);
  return Boolean(coverMatch && galleryMatch && coverMatch[1] === galleryMatch[1]);
}

export function replaceAidreamcapesEuLegacyMedia(value: string | undefined): string {
  const clean = withoutQuery(value);
  const mirrorPrefix = "/assets/sites/site_aidreamcapes_eu/mirror/";
  const noCropGalleryReplacement = noCropGalleryReplacements[clean];
  if (noCropGalleryReplacement) return noCropGalleryReplacement;
  if (!clean.startsWith(mirrorPrefix)) return String(value ?? "");
  const relativePath = clean
    .slice(mirrorPrefix.length)
    .replace(/^aidreamcapes\/(?:dreamshoot|aidreamcapes)\//i, "");
  const coverMatch = relativePath.match(/^generated\/pack-covers\/([^/]+)\/\1-cover\.(?:png|jpe?g|webp|avif)$/i);
  if (coverMatch) return legacyPackCoverReplacements[coverMatch[1].toLowerCase()] ?? clean;
  const mapped = legacyStandaloneMediaReplacements[relativePath]
    ?? legacyVideoHeroReplacements[relativePath]
    ?? clean;
  if (mapped !== clean) return mapped;
  return legacyMirrorSemanticFallbacks.find(([pattern]) => pattern.test(relativePath))?.[1]
    ?? legacyMirrorDefaultFallback;
}
