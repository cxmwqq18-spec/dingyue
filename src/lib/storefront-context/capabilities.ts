import type { Site } from "@/lib/types";
import type { SiteCapability } from "./types";

const AI_GENERATION_SITE_IDS = new Set([
  "site_dreamshoot",
  "site_aidreamcapes",
  "site_mydreamshoots_xby",
  "site_aidreamcapes_xby"
]);

const AI_GENERATION_SLUGS = new Set([
  "mydreamshoots",
  "aidreamcapes",
  "aidreamshoots",
  "aidreamcapes-eu",
  "mydreamshoots-eu"
]);

export function resolveSiteCapability(site: Pick<Site, "id" | "slug">): SiteCapability {
  const canonicalSlug = site.slug.trim().toLowerCase();
  const usesAiGenerationPublicRoutes = AI_GENERATION_SITE_IDS.has(site.id) || AI_GENERATION_SLUGS.has(canonicalSlug);
  return {
    usesAiGenerationPublicRoutes,
    usesCollectionDirectory: usesAiGenerationPublicRoutes,
    usesPricingDirectory: usesAiGenerationPublicRoutes
  };
}

export function usesAiGenerationPublicRoutes(site: Pick<Site, "id" | "slug">): boolean {
  return resolveSiteCapability(site).usesAiGenerationPublicRoutes;
}
