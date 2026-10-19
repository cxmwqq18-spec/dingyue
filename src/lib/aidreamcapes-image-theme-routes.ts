import aidreamcapesSiteV2Redirects from "@/lib/aidreamcapes-site-v2-redirects.json";

export const AIDREAMCAPES_IMAGE_THEME_ROOT_PATH = "/ai-image-generation";

export const AIDREAMCAPES_IMAGE_THEME_DEFINITIONS = [
  { slug: "white-background-photos", label: "White Background Photos", layoutVariant: "ecommerce-main-image-detail" },
  { slug: "lifestyle-photos", label: "Lifestyle Photos", layoutVariant: "lifestyle-scene-detail" },
  { slug: "packshot-multi-angle", label: "Packshot Multi-angle", layoutVariant: "packshot-multi-angle-detail" },
  { slug: "macro-details", label: "Macro Details", layoutVariant: "macro-details-detail" },
  { slug: "bundle-sets", label: "Bundle Sets", layoutVariant: "bundle-sets-detail" },
  { slug: "size-reference", label: "Size Reference", layoutVariant: "size-reference-detail" },
  { slug: "feature-infographic", label: "Feature Infographic", layoutVariant: "feature-infographic-detail" },
  { slug: "comparison-chart", label: "Comparison Chart", layoutVariant: "comparison-chart-detail" },
  { slug: "social-ad-photos", label: "Social Ad Photos", layoutVariant: "feed-ad-still-detail" },
  { slug: "ugc-still-ad", label: "UGC Still Ad", layoutVariant: "ugc-still-ad-detail" },
  { slug: "story-ad-vertical", label: "Story 9:16 Ad", layoutVariant: "story-ad-vertical-detail" },
  { slug: "carousel-set", label: "Carousel Set", layoutVariant: "carousel-set-detail" },
  { slug: "sale-campaign-key-visual", label: "Sale / BF Key Visual", layoutVariant: "sale-campaign-key-visual-detail" },
  { slug: "lookbook-cover", label: "Lookbook Cover", layoutVariant: "lookbook-cover-detail" },
  { slug: "model-photos", label: "Model Photos", layoutVariant: "on-model-generation-detail" },
  { slug: "virtual-try-on", label: "Virtual Try-On", layoutVariant: "virtual-try-on-detail" },
  { slug: "hair-makeup-preview", label: "Hair / Makeup Preview", layoutVariant: "hair-makeup-preview-detail" },
  { slug: "jewelry-positioning", label: "Jewelry Positioning", layoutVariant: "jewelry-positioning-detail" },
  { slug: "ghost-mannequin", label: "Ghost Mannequin", layoutVariant: "ghost-mannequin-detail" },
  { slug: "colorway-variations", label: "Colorway Variations", layoutVariant: "colorway-variations-detail" },
  { slug: "change-background", label: "Change Background", layoutVariant: "background-remove-replace-detail" },
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

export const AIDREAMCAPES_ECOMMERCE_MAIN_IMAGE_PATH = "/ai-image-generation/white-background-photos";
export const AIDREAMCAPES_ECOMMERCE_MAIN_IMAGE_CANONICAL = `https://aidreamcapes.com${AIDREAMCAPES_ECOMMERCE_MAIN_IMAGE_PATH}`;

// These catalogue landing pages were inherited from the old CreativePack
// gallery. They are still useful as migration targets, but are no longer
// standalone Aidreamcapes documents. Keep the redirect map separate from the
// retired/404 paths so an old backlink receives the relevant new directory
// instead of a soft 404.
export const AIDREAMCAPES_LEGACY_GALLERY_REDIRECTS = new Map<string, string>([
  ["/best-ai-image", AIDREAMCAPES_IMAGE_THEME_ROOT_PATH],
  ["/best-ai-video", "/ai-video-generation"],
  ["/best-packages", AIDREAMCAPES_IMAGE_THEME_ROOT_PATH]
]);

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

// These are legacy collection/fallback paths that were still being exposed by
// the shared catalogue projection. They are retired for Aidreamcapes only;
// the same slugs remain available to other storefronts where they are valid.
const retiredImageCollectionPaths = [
  // The old shared collection alias is no longer a public Aidreamcapes page.
  // Keep this site-scoped so other storefronts can retain their own alias
  // behavior while this host returns a real 404.
  "/collections",
  // Legacy catalogue group pages. These paths were rendered by the shared
  // collection fallback rather than by a dedicated published page, so keep
  // them in the site-scoped retirement allowlist to stop the fallback from
  // recreating them.
  "/ai-image-generation/best-themes-presets",
  "/ai-image-generation/lifestyle-creative",
  "/ai-image-generation/magic",
  "/ai-image-generation/photo-tools",
  "/ai-image-generation/professional",
  "/ai-image-generation/background-changer",
  "/ai-image-generation/bikini",
  "/ai-image-generation/boudoir",
  "/ai-image-generation/cannes",
  "/ai-image-generation/christmas-photo",
  "/ai-image-generation/color-correction",
  "/ai-image-generation/cyberpunk",
  "/ai-image-generation/engagement-photo",
  "/ai-image-generation/gala-photo",
  "/ai-image-generation/halloween-photo",
  "/ai-image-generation/holiday",
  "/ai-image-generation/mafia",
  "/ai-image-generation/magic-eraser",
  "/ai-image-generation/nightlife",
  "/ai-image-generation/only-fans",
  "/ai-image-generation/portrait-retouch",
  "/ai-image-generation/singles-awareness-day",
  "/ai-image-generation/soccer",
  "/ai-image-generation/swimsuit",
  "/ai-image-generation/thanksgiving-photo",
  "/ai-image-generation/travel",
  "/ai-image-generation/unblur-image",
  "/ai-image-generation/urban",
  "/ai-image-generation/valentines-photo",
  "/ai-image-generation/wedding-photo",
  "/ai-image-generation/premiere-style-portraits"
] as const;

export const AIDREAMCAPES_RETIRED_IMAGE_TOOL_PATHS = new Set<string>(retiredImageThemePaths);
export const AIDREAMCAPES_RETIRED_PUBLIC_PATHS = new Set<string>([
  ...retiredImageThemePaths,
  ...retiredImageCollectionPaths
]);

export const AIDREAMCAPES_GONE_PUBLIC_PATHS = new Set<string>([
  "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/valentines-day",
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/proposal",
  "/ai-image-generation/unblur-image",
  "/ai-image-generation/best-themes-presets",
  "/ai-image-generation/lifestyle-creative",
  "/ai-image-generation/magic",
  "/ai-image-generation/photo-tools",
  "/ai-image-generation/professional"
]);

const imageThemeByPath = new Map(
  AIDREAMCAPES_IMAGE_THEME_DEFINITIONS.map((definition) => [
    `${AIDREAMCAPES_IMAGE_THEME_ROOT_PATH}/${definition.slug}`,
    definition
  ])
);
const aidreamcapesSiteV2RedirectSources = new Set<string>((aidreamcapesSiteV2Redirects as [string, string][]).map(([from]) => from));

export function aidreamcapesImageThemePath(slug: string): string {
  return `${AIDREAMCAPES_IMAGE_THEME_ROOT_PATH}/${slug}`;
}

export function aidreamcapesImageThemeDefinitionForPath(path: string): AidreamcapesImageThemeDefinition | undefined {
  const pathname = path.split("?")[0]?.split("#")[0] ?? path;
  return imageThemeByPath.get(pathname.replace(/\/$/, ""));
}

/**
 * Resolve an Aidreamcapes image-theme request before any collection or legacy
 * route fallback can reinterpret it. Returning the registered path also
 * gives metadata and rendering one immutable path key to use.
 */
export function aidreamcapesImageThemePathForRequest(siteSlug: string | undefined, path: string): string | undefined {
  if (siteSlug !== "aidreamcapes") return undefined;
  const definition = aidreamcapesImageThemeDefinitionForPath(path);
  return definition ? `${AIDREAMCAPES_IMAGE_THEME_ROOT_PATH}/${definition.slug}` : undefined;
}

export function isAidreamcapesImageThemePath(siteSlug: string | undefined, path: string): boolean {
  return Boolean(aidreamcapesImageThemePathForRequest(siteSlug, path));
}

export function isAidreamcapesV2RedirectPath(siteSlug: string | undefined, path: string): boolean {
  if (siteSlug !== "aidreamcapes") return false;
  const normalizedPath = path.split("?")[0]?.split("#")[0]?.replace(/\/$/, "") || "/";
  return aidreamcapesSiteV2RedirectSources.has(normalizedPath);
}

export function isAidreamcapesEcommerceMainImagePath(siteSlug: string | undefined, path: string): boolean {
  return siteSlug === "aidreamcapes" && path === AIDREAMCAPES_ECOMMERCE_MAIN_IMAGE_PATH;
}

export function isRetiredAidreamcapesImageToolPath(siteSlug: string | undefined, path: string): boolean {
  return siteSlug === "aidreamcapes" && AIDREAMCAPES_RETIRED_IMAGE_TOOL_PATHS.has(path.replace(/\/$/, ""));
}

export function isRetiredAidreamcapesPublicPath(siteSlug: string | undefined, path: string): boolean {
  if (siteSlug !== "aidreamcapes") return false;
  const normalizedPath = path.replace(/\/$/, "");
  // Aidreamcapes.com no longer offers the Save the Date product. Keep this
  // site-scoped so myDreamShoots and Aidreamcapes EU retain their routes.
  if (normalizedPath === "/best-save-the-date" || normalizedPath.startsWith("/ai-save-the-date/") || normalizedPath.startsWith("/holidays-events/")) {
    return true;
  }
  return AIDREAMCAPES_RETIRED_PUBLIC_PATHS.has(normalizedPath);
}

export function aidreamcapesLegacyGalleryRedirectForPath(siteSlug: string | undefined, path: string): string | undefined {
  if (siteSlug !== "aidreamcapes") return undefined;
  return AIDREAMCAPES_LEGACY_GALLERY_REDIRECTS.get(path.replace(/\/$/, ""));
}

export function isAidreamcapesGonePublicPath(siteSlug: string | undefined, path: string): boolean {
  if (siteSlug !== "aidreamcapes") return false;
  return AIDREAMCAPES_GONE_PUBLIC_PATHS.has(path.replace(/\/$/, ""));
}
