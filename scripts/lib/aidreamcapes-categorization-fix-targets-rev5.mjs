// Reviewed placement reconcile targets (rev5, 2026-11-02).
//
// Context: the rev4 pass fixed 76 reviewed slugs across every copy, but
// placement-carrying copies on wall/strip pages (colorway-variations,
// sale-campaign-key-visual, hub pickers, /templates alias cards) whose slugs
// were not in the rev4 list still carry legacy bundle tags
// ([fashion, shoes, e-commerce, amazon, shopify] ...) that were never reviewed
// per subject. Those bundles leak into facet grids through the placement index.
//
// Rev5 rule (single invariant, enforced site-wide):
//   every placement-carrying copy of a published slug carries exactly the
//   reviewed placement of that slug;
//   an alias detail slug (a card with both publicSlug and detailAliasOf —
//   the second URL of the same video) carries exactly the reviewed placement
//   of its detailAliasOf target.
//
// CANONICAL_TWEAKS: subject re-review verdicts for canonical slugs whose
// current tags fail the subject rule. Each value is the complete final set.
export const CANONICAL_TWEAKS = new Map([
  // Prompt evidence: the product is a kraft coffee bag (grind/pour ritual) —
  // it was tagged electronics; it is a food & drinks subject.
  ["studio-speaking-to-camera", ["/industries/food-drinks"]],
  // Freeze-dried snack pouch on a study desk: food product + study scene;
  // home-living added nothing the scene facets already cover.
  ["study-room-desk-study-chat", ["/industries/education", "/industries/food-drinks"]],
  // Notes-app demo: the product is an app, not a device.
  ["notes-app-chaos-to-calm", ["/industries/apps", "/platforms/tiktok-ads", "/platforms/youtube-shorts-ads"]],
  // Magnetic phone-grip rings: electronics accessories, not jewelry and not
  // a home-living subject.
  ["silver-magnetic-ring-desk-demo", ["/industries/electronics", "/platforms/tiktok-ads", "/platforms/youtube-shorts-ads"]],
  ["silver-magnetic-ring-snap-on-demo", ["/industries/electronics", "/platforms/tiktok-ads", "/platforms/youtube-shorts-ads"]],
  // Over-ear headphones product demo (hands only, UGC style): electronics.
  ["headphone-product-demo", ["/industries/electronics", "/industries/ugc"]],
  // White supplement jar mixed at a gym bench: same convention as
  // gym-protein-scoop-demo (sports-gym), plus the ugc style facet.
  ["supplement-creator-demo", ["/industries/sports-gym", "/industries/ugc"]],
  // Amber fragrance bottle reveal: beauty subject.
  ["fragrance-reveal-reaction", ["/industries/beauty-skincare", "/industries/viral"]],
  // Silicone phone cases compared: electronics subject.
  ["phone-case-compare", ["/industries/electronics", "/industries/viral"]],
  // Folding city bike commute: sports/commuting subject; e-commerce was a
  // format tag, not a subject.
  ["folding-bike-commute", ["/industries/sports-gym"]],
  // Shower speaker: electronics; the bathroom is the scene, not the industry.
  ["mint-shower-speaker-bathroom-concert", ["/industries/electronics", "/platforms/instagram-ads", "/platforms/tiktok-ads"]],
  // Lunchbox leak tutorial in a kitchen: education scene + home product.
  ["lunchbox-leak-tutorial", ["/industries/education", "/industries/home-living"]],
  // Linen-shirt 360 showcase: fashion subject; e-commerce was a format tag.
  ["360-showcase-linen-shirt", ["/industries/fashion-clothing"]],
  // Fitness-gear street interview: sports subject; e-commerce was a format tag.
  ["street-interview-fitness-gear", ["/industries/health-wellness", "/industries/sports-gym"]],
  // Silicone phone-case compare ad: electronics subject.
  ["silicone-case-compare-ad", ["/industries/electronics"]],
  // Kitchen appliance demos (frother/espresso/grater): the catch-all "other"
  // tag duplicated the home-living subject.
  ["black-milk-frother-morning-demo", ["/industries/home-living", "/platforms/instagram-ads", "/platforms/tiktok-ads"]],
  ["black-espresso-machine-counter-demo", ["/industries/home-living", "/platforms/facebook-ads", "/platforms/tiktok-ads"]],
  ["four-side-box-grater-demo", ["/industries/home-living", "/platforms/facebook-ads", "/platforms/tiktok-ads"]]
]);

export const CONTRACT = "aidreamcapes-placement-reconcile-2026-11-02-v1";
export const CONFIRMATION = {
  production: "site_aidreamcapes-placement-reconcile-production",
  local: "site_aidreamcapes-placement-reconcile"
};
