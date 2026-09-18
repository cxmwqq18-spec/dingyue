export const AIDREAMCAPES_IMAGE_THEME_ROOT_PATH = "/ai-image-generation";

export const AIDREAMCAPES_IMAGE_THEME_DEFINITIONS = [
  { slug: "ecommerce-main-image", label: "Ecommerce Main Image", layoutVariant: "ecommerce-main-image-detail" },
  { slug: "lifestyle-scene", label: "Lifestyle Scene", layoutVariant: "lifestyle-scene-detail" },
  { slug: "packshot-multi-angle", label: "Packshot Multi-angle", layoutVariant: "packshot-multi-angle-detail" },
  { slug: "macro-details", label: "Macro Details", layoutVariant: "macro-details-detail" },
  { slug: "bundle-sets", label: "Bundle Sets", layoutVariant: "bundle-sets-detail" },
  { slug: "size-reference", label: "Size Reference", layoutVariant: "size-reference-detail" },
  { slug: "feature-infographic", label: "Feature Infographic", layoutVariant: "feature-infographic-detail" },
  { slug: "comparison-chart", label: "Comparison Chart", layoutVariant: "comparison-chart-detail" },
  { slug: "feed-ad-still", label: "Feed Ad Still", layoutVariant: "feed-ad-still-detail" },
  { slug: "ugc-still-ad", label: "UGC Still Ad", layoutVariant: "ugc-still-ad-detail" },
  { slug: "story-ad-vertical", label: "Story 9:16 Ad", layoutVariant: "story-ad-vertical-detail" },
  { slug: "carousel-set", label: "Carousel Set", layoutVariant: "carousel-set-detail" },
  { slug: "sale-campaign-key-visual", label: "Sale / BF Key Visual", layoutVariant: "sale-campaign-key-visual-detail" },
  { slug: "lookbook-cover", label: "Lookbook Cover", layoutVariant: "lookbook-cover-detail" },
  { slug: "on-model-generation", label: "On-Model Generation", layoutVariant: "on-model-generation-detail" },
  { slug: "virtual-try-on", label: "Virtual Try-On", layoutVariant: "virtual-try-on-detail" },
  { slug: "hair-makeup-preview", label: "Hair / Makeup Preview", layoutVariant: "hair-makeup-preview-detail" },
  { slug: "jewelry-positioning", label: "Jewelry Positioning", layoutVariant: "jewelry-positioning-detail" },
  { slug: "ghost-mannequin", label: "Ghost Mannequin", layoutVariant: "ghost-mannequin-detail" },
  { slug: "colorway-variations", label: "Colorway Variations", layoutVariant: "colorway-variations-detail" },
  { slug: "background-remove-replace", label: "Background Remove / Replace", layoutVariant: "background-remove-replace-detail" },
  { slug: "enhance-upscale", label: "Enhance / Upscale", layoutVariant: "enhance-upscale-detail" },
  { slug: "old-photo-restore", label: "Old Photo Restore", layoutVariant: "old-photo-restore-detail" },
  { slug: "commercial-lighting", label: "Commercial Lighting", layoutVariant: "commercial-lighting-detail" },
  { slug: "packaging-mockup", label: "Packaging Mockup", layoutVariant: "packaging-mockup-detail" },
  { slug: "professional-headshot", label: "Professional Headshot", layoutVariant: "professional-headshot-detail" },
  { slug: "creator-portrait", label: "Creator Portrait", layoutVariant: "creator-portrait-detail" },
  { slug: "team-directory", label: "Team Directory", layoutVariant: "team-directory-detail" },
  { slug: "social-profile-photo", label: "Social / Dating Profile", layoutVariant: "social-profile-photo-detail" },
  { slug: "fashion-editorial", label: "Fashion Editorial", layoutVariant: "fashion-editorial-detail" }
] as const;

export type AidreamcapesImageThemeDefinition = typeof AIDREAMCAPES_IMAGE_THEME_DEFINITIONS[number];
export type AidreamcapesImageThemeLayoutVariant = AidreamcapesImageThemeDefinition["layoutVariant"];

export const AIDREAMCAPES_ECOMMERCE_MAIN_IMAGE_PATH = "/ai-image-generation/ecommerce-main-image";
export const AIDREAMCAPES_ECOMMERCE_MAIN_IMAGE_CANONICAL = `https://aidreamcapes.com${AIDREAMCAPES_ECOMMERCE_MAIN_IMAGE_PATH}`;

const retiredImageThemePaths = [
  "/ai-image-generation/rich-lifestyle",
  "/ai-image-generation/social-cards",
  "/ai-image-generation/black-friday",
  "/ai-image-generation/street-style",
  "/ai-image-generation/hairstyle-generator",
  "/ai-image-generation/edit-by-prompt",
  "/ai-image-generation/background-remover",
  "/ai-image-generation/photo-enhancer",
  "/ai-image-generation/old-photo-restoration",
  "/ai-image-generation/headshot",
  "/ai-image-generation/avatar",
  "/ai-image-generation/portrait-photo",
  "/tools/product-reverie",
  "/tools/permission-safe-photo-planner"
] as const;

export const AIDREAMCAPES_RETIRED_IMAGE_TOOL_PATHS = new Set<string>(retiredImageThemePaths);

const imageThemeByPath = new Map(
  AIDREAMCAPES_IMAGE_THEME_DEFINITIONS.map((definition) => [
    `${AIDREAMCAPES_IMAGE_THEME_ROOT_PATH}/${definition.slug}`,
    definition
  ])
);

export function aidreamcapesImageThemePath(slug: string): string {
  return `${AIDREAMCAPES_IMAGE_THEME_ROOT_PATH}/${slug}`;
}

export function aidreamcapesImageThemeDefinitionForPath(path: string): AidreamcapesImageThemeDefinition | undefined {
  return imageThemeByPath.get(path.replace(/\/$/, ""));
}

export function isAidreamcapesImageThemePath(siteSlug: string | undefined, path: string): boolean {
  return siteSlug === "aidreamcapes" && Boolean(aidreamcapesImageThemeDefinitionForPath(path));
}

export function isAidreamcapesEcommerceMainImagePath(siteSlug: string | undefined, path: string): boolean {
  return siteSlug === "aidreamcapes" && path === AIDREAMCAPES_ECOMMERCE_MAIN_IMAGE_PATH;
}

export function isRetiredAidreamcapesImageToolPath(siteSlug: string | undefined, path: string): boolean {
  return siteSlug === "aidreamcapes" && AIDREAMCAPES_RETIRED_IMAGE_TOOL_PATHS.has(path.replace(/\/$/, ""));
}
