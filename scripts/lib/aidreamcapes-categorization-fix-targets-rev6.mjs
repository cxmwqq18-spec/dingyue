// Reviewed placement reconcile targets (rev6, 2026-11-02).
//
// Context: after rev5 (site-wide placement reconcile), the user re-reviewed
// the industry facet pages from screenshots and flagged remaining
// subject errors plus one presentation defect:
//
//   1. Subject errors on facet grids (canonical tweaks below):
//      - food-drinks grid listed a studio talking-head clip and a study-room
//        chat that are not recognizable food subjects.
//      - education grid listed tutorial-packaged product demos (coffee maker,
//        kitchen tool, fabric cleaner, lunchbox). Reviewed verdict: a lesson
//        wrapper is not a learning scene; product demos belong to the
//        product's industry (home-living). Education keeps real learning
//        scenes only (classroom, study rooms, spoken lessons, tutor demos).
//      - apps grid listed a bento-box making video.
//      - jewelry-accessories grid listed a stemless earbud product detail
//        (electronics subject) and a cufflink demo (reviewed verdict:
//        shirt-cuff scene → fashion-clothing).
//      - fashion-clothing grid listed canvas-tote carry/pack videos; bags stay
//        in jewelry-accessories per the reviewed bag/cap convention.
//
//   2. Duplicate cards on facet grids: an alias detail slug (a card with both
//      publicSlug and detailAliasOf — the second URL of the same video)
//      mirrored its target's placement since rev5, so facet grids rendered the
//      same video twice under two slugs (e.g. mint-face-mist-hook and
//      mint-face-mist-hook-templates on /industries/viral). Rev6 rule: alias
//      slugs carry NO placement at all; each video appears in facet grids once
//      via its canonical slug. Alias detail pages keep resolving (200) and the
//      /templates filter is unaffected (it reads templateDefinition facets,
//      not card placement).
//
// CANONICAL_TWEAKS: complete final placement sets for canonical slugs.
export const CANONICAL_TWEAKS = new Map([
  // Studio talking-head demo (coffee-bag grind/pour visible but the subject is
  // a person speaking to camera): generic spokesperson scene, not a food grid
  // entry.
  ["studio-speaking-to-camera", ["/industries/other"]],
  // Study-room desk chat: real learning scene; the freeze-dried snack pouch is
  // set dressing, not a food-grid subject.
  ["study-room-desk-study-chat", ["/industries/education"]],
  // Tutorial-packaged product demos → the product's industry (home-living).
  ["coffee-maker-how-to-demo", ["/industries/home-living"]],
  ["kitchen-tool-lesson-demo", ["/industries/home-living"]],
  ["fabric-cleaner-lesson-demo", ["/industries/home-living"]],
  ["lunchbox-leak-tutorial", ["/industries/home-living"]],
  // Bento-box making walkthrough: kitchen/home product, not an app subject.
  ["bento-box-walkthrough", ["/industries/home-living"]],
  // Stemless earbud product detail: electronics subject, not jewelry.
  ["stemless-earbud-product-detail", ["/industries/electronics"]],
  // Cufflink detail demo: reviewed verdict — shirt-cuff scene reads as
  // fashion, not jewelry.
  ["cufflink-detail-demo", ["/industries/fashion-clothing"]],
  // Canvas totes: bags stay in jewelry-accessories (reviewed bag/cap
  // convention); fashion-clothing is for garments.
  ["canvas-tote-everyday-carry", ["/industries/jewelry-accessories", "/platforms/instagram-ads", "/platforms/tiktok-ads"]],
  ["canvas-tote-pack-with-me", ["/industries/jewelry-accessories", "/platforms/instagram-ads", "/platforms/tiktok-ads"]]
]);

export const CONTRACT = "aidreamcapes-placement-reconcile-rev6-2026-11-02-v1";
export const CONFIRMATION = {
  production: "site_aidreamcapes-placement-reconcile-rev6-production",
  local: "site_aidreamcapes-placement-reconcile-rev6"
};
