/**
 * Frozen Aidreamcapes placement vocabulary + inference engine.
 *
 * The directory pages are the taxonomy (see
 * docs/aivideosugc-tagging-examples-rectification-plan.md §2.2, 2026-10-30).
 * This module is the single registry for:
 *   - INDUSTRY_FACETS: tool-page filter chip id -> industry facet path;
 *   - LABEL_KEYWORDS / OCCASION_KEYWORDS: deterministic keyword fallbacks;
 *   - CHIPS_REPLACE / PICKER_CHIP_*: chips normalization constants;
 *   - inferTags(basisRows): slug-level placement inference.
 *
 * Client-safe: no Prisma, no server-only imports.
 */

/** Chip id -> industry facet. Existing 8 facets + 11 planned pages (2026-10-30 拍板). */
export const INDUSTRY_FACETS = {
  // existing facet pages
  clothing: "/industries/fashion-clothing",
  apparel: "/industries/fashion-clothing",
  footwear: "/industries/shoes",
  "health-fitness": "/industries/health-wellness",
  fitness: "/industries/health-wellness",
  "jewelry-accessories": "/industries/jewelry-accessories",
  accessories: "/industries/jewelry-accessories",
  "tech-electronics": "/industries/electronics",
  "food-beverage": "/industries/food-drinks",
  "beauty-personal-care": "/industries/beauty-skincare",
  fashion: "/industries/fashion-clothing",
  // new facet pages (phase 4). Runtime drops placement values whose directory
  // page does not exist yet, so writing these early is dead-link safe.
  pet: "/industries/pet",
  "kids-toy": "/industries/kids-toy",
  "e-commerce": "/industries/e-commerce",
  education: "/industries/education",
  "financial-services": "/industries/financial-services",
  "sports-gym": "/industries/sports-gym",
  apps: "/industries/apps",
  ugc: "/industries/ugc",
  viral: "/industries/viral",
  explainer: "/industries/explainer",
  // catch-all for assets without a determinable product industry
  // (spokesperson scene openers etc.) — 2026-10-30 拍板
  other: "/industries/other"
};

/**
 * Label/slug keyword -> industry facet. Deterministic, conservative; only
 * runs for assets with no template/chip source. Plural-tolerant.
 */
export const LABEL_KEYWORDS = [
  [/\b(dress|gown|hoodie|sweater|knit|shirt|tee|t-?shirt|jacket|coat|jeans|denim|outfit|wear|wardrobe|linen|clothes|clothing|apparel|skirt|blouse|cardigan|pajama|sleepwear|swimsuit|bikini|activewear|tracksuit|socks|scarf|gloves|hat|cap|beanie|tote|handbag|bag|backpack|wallet|belt|sweatshirt|weekender|overshirt)(?:s|es)?\b/i, "/industries/fashion-clothing"],
  [/\b(shoe|sneaker|boot|sandal|heel|loafer|slipper|footwear)(?:s|es)?\b/i, "/industries/shoes"],
  [/\b(ring|necklace|earring|bracelet|pendant|jewel|watch|sunglasses|chain|anklet)(?:s|es)?\b/i, "/industries/jewelry-accessories"],
  [/\b(serum|cream|cleanser|moisturizer|shampoo|lipstick|mascara|makeup|cosmetic|skincare|beauty|foundation|concealer|blush|toner|perfume|fragrance|deodorant|lotion|spa|balm|jar|soap|dispenser|canister)(?:s|es)?\b/i, "/industries/beauty-skincare"],
  [/\b(phone|laptop|tablet|earbuds|headphone|speaker|camera|keyboard|mouse|monitor|charger|cable|gadget|device|smartwatch|drone|console|controller|screen|lunchbox)(?:s|es)?\b/i, "/industries/electronics"],
  [/\b(coffee|tea|juice|drink|soda|snack|chocolate|candy|sauce|wine|beer|cocktail|smoothie|protein|supplement|food|meal|bottle|tumbler|mug|kettle|blender|lunch)(?:s|es)?\b/i, "/industries/food-drinks"],
  [/\b(couch|sofa|chair|lamp|desk|shelf|drawer|organizer|storage|bathroom|kitchen|bedroom|living room|household|laundry|mop|vacuum|curtain|pillow|blanket|towel|planter|vase|candle|decor|plant|garden|greenhouse|entryway)(?:s|es)?\b/i, "/industries/home-living"],
  [/\b(dog|cat|puppy|kitten|pet|leash|collar|litter|aquarium)(?:s|es)?\b/i, "/industries/pet"],
  [/\b(toy|lego|puzzle|doll|stuffed|plush|kids|toddler|children)(?:s|es)?\b/i, "/industries/kids-toy"],
  [/\b(course|class|lesson|tutorial|study|school|student|learn|education|textbook|language|classroom)(?:s|es)?\b/i, "/industries/education"],
  [/\b(bank|banking|finance|financial|insurance|credit|investment|trading|payment|fintech|crypto)(?:s|es)?\b/i, "/industries/financial-services"],
  [/\b(cart|checkout|store|shop|listing|marketplace|order|delivery|package|haul|e-?commerce|catalog)(?:s|es)?\b/i, "/industries/e-commerce"],
  [/\b(gym|workout|fitness|yoga|run|running|cycling|bike|bicycle|sport|athlete|training|exercise|dumbbell|treadmill|sweat)(?:s|es)?\b/i, "/industries/sports-gym"],
  [/\b(app\b|apps|software|saas|dashboard|interface|walkthrough)(?:s|es)?\b/i, "/industries/apps"]
];

/** Occasion keywords: gift/holiday/sale cues in labels or slugs. */
export const OCCASION_KEYWORDS = [
  [/\bblack\s?friday\b/i, "/occasions/black-friday"],
  [/\b(black\s?friday|sale|deal|discount|promo|offer|bargain)\b/i, "/occasions/sale-discount"],
  [/\b(gift|holiday|christmas|xmas|seasonal)\b/i, "/occasions/holidays"]
];

/**
 * Chips normalization (2026-10-30 拍板 §2.4): synonym ids converge so each
 * category owns one filter chip. Card chips and picker.chips rows move
 * together — the filter row must never keep an id no card carries.
 */
export const CHIPS_REPLACE = {
  apparel: "clothing",
  accessories: "jewelry-accessories",
  trending: "viral"
};

/** Picker filter rows that carry the shared 19-category vocabulary. */
export const PICKER_CHIP_PAGES = [
  "/",
  "/ai-video-generation",
  "/ai-video-generation/video-ads",
  "/templates",
  "/templates/photo",
  "/templates/video"
];

/** Filter chip ids removed from the shared rows (synonyms merged away). */
export const PICKER_CHIP_REMOVE_IDS = ["apparel", "accessories"];

/** Filter chip ids renamed in place (hub Viral filter bug). */
export const PICKER_CHIP_RENAME_IDS = { trending: "viral" };

/** Public placement value pattern (mirrors media-placement.ts). */
export const MEDIA_PLACEMENT_PATTERN = /^\/(industries|platforms|occasions)\/[a-z0-9][a-z0-9-]*$/;

function uniqSorted(values) {
  return [...new Set(values)].sort();
}

/**
 * Slug-level placement inference.
 * Input basis rows: { slug, shape, owner_slug, label, prompt, chips,
 * placement, is_video, has_vsrc, facets } — one per canonical card copy.
 * Priority: template inherit -> chip map -> keyword fallback -> occasion
 * keywords -> other catch-all. Existing placement values are preserved.
 */
export function inferTags(rows) {
  const bySlug = new Map();
  for (const row of rows) {
    if (!row.slug) continue;
    const entry = bySlug.get(row.slug) ?? {
      slug: row.slug,
      isVideo: row.is_video,
      shapes: new Set(),
      owners: new Set(),
      industries: new Set(),
      platforms: new Set(),
      occasions: new Set(),
      basis: [],
      existing: new Set(),
      labels: new Set(),
      chips: new Set()
    };
    entry.shapes.add(row.shape);
    entry.owners.add(row.owner_slug);
    if (row.label) entry.labels.add(row.label);
    entry.labels.add(row.slug.replace(/-/g, " "));
    for (const chip of row.chips ?? []) entry.chips.add(chip);
    for (const value of row.placement ?? []) entry.existing.add(value);
    const facets = row.facets;
    if (facets) {
      for (const value of facets.industries ?? []) { entry.industries.add(value); entry.basis.push(`template-inherit:${facets.path}`); }
      for (const value of facets.platforms ?? []) entry.platforms.add(value);
      for (const value of facets.occasions ?? []) entry.occasions.add(value);
    }
    bySlug.set(row.slug, entry);
  }

  for (const entry of bySlug.values()) {
    for (const chip of entry.chips) {
      const facet = INDUSTRY_FACETS[chip];
      if (facet) { entry.industries.add(facet); entry.basis.push(`chip:${chip}`); }
    }
  }

  for (const entry of bySlug.values()) {
    if (entry.industries.size) continue;
    const textValue = [...entry.labels].join(" ");
    for (const [pattern, facet] of LABEL_KEYWORDS) {
      if (pattern.test(textValue)) { entry.industries.add(facet); entry.basis.push(`keyword:${pattern.source.slice(2, 30)}`); }
    }
  }

  for (const entry of bySlug.values()) {
    const textValue = [...entry.labels].join(" ");
    for (const [pattern, facet] of OCCASION_KEYWORDS) {
      if (pattern.test(textValue)) { entry.occasions.add(facet); entry.basis.push(`occasion:${pattern.source.slice(2, 24)}`); }
    }
  }

  // Catch-all: slugs still without any industry go to /industries/other
  // (2026-10-30 拍板，后续再细分).
  for (const entry of bySlug.values()) {
    if (!entry.industries.size) { entry.industries.add("/industries/other"); entry.basis.push("other-catchall"); }
  }

  const report = [];
  for (const entry of [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const placement = uniqSorted([...entry.existing, ...entry.industries, ...entry.platforms, ...entry.occasions]);
    report.push({
      slug: entry.slug,
      isVideo: entry.isVideo,
      shapes: [...entry.shapes].sort(),
      owners: [...entry.owners].sort(),
      existing: uniqSorted(entry.existing),
      placement,
      added: uniqSorted(placement.filter((value) => !entry.existing.has(value))),
      basis: uniqSorted(entry.basis).slice(0, 8),
      kinds: {
        industry: uniqSorted(placement.filter((v) => v.startsWith("/industries/"))),
        platform: uniqSorted(placement.filter((v) => v.startsWith("/platforms/"))),
        occasion: uniqSorted(placement.filter((v) => v.startsWith("/occasions/")))
      }
    });
  }
  return report;
}
