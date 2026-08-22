import type { Site } from "@/lib/types";
import type { SiteCapability } from "./types";

const AI_GENERATION_SITE_IDS = new Set([
  "site_dreamshoot",
  "site_grownstride_test",
  "site_aidreamcapes",
  "site_mydreamshoots_xby",
  "site_aidreamcapes_xby"
]);

const AI_GENERATION_SLUGS = new Set([
  "mydreamshoots",
  "grownstride",
  "aidreamcapes",
  "aidreamshoots",
  "aidreamcapes-eu",
  "mydreamshoots-eu"
]);

const PRIMARY_MYDREAMSHOOTS_SITE_IDS = new Set(["site_dreamshoot", "site_grownstride_test"]);
const PRIMARY_MYDREAMSHOOTS_SLUGS = new Set(["mydreamshoots", "grownstride"]);
const AIDREAMCAPES_SITE_IDS = new Set(["site_aidreamcapes", "site_aidreamcapes_xby"]);
const AIDREAMCAPES_SLUGS = new Set(["aidreamcapes", "aidreamcapes-eu"]);

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

export function usesAiGenerationPublicSlug(slug: string): boolean {
  return AI_GENERATION_SLUGS.has(slug.trim().toLowerCase());
}

export function isPrimaryMydreamshootsSite(site: Pick<Site, "id" | "slug">): boolean {
  return PRIMARY_MYDREAMSHOOTS_SITE_IDS.has(site.id) || PRIMARY_MYDREAMSHOOTS_SLUGS.has(site.slug.trim().toLowerCase());
}

export function isPrimaryMydreamshootsSlug(slug: string): boolean {
  return PRIMARY_MYDREAMSHOOTS_SLUGS.has(slug.trim().toLowerCase());
}

export function isAidreamcapesSite(site: Pick<Site, "id" | "slug">): boolean {
  return AIDREAMCAPES_SITE_IDS.has(site.id) || AIDREAMCAPES_SLUGS.has(site.slug.trim().toLowerCase());
}
