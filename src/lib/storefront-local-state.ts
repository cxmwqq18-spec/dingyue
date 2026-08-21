import {
  readStorefrontPublicCollectionDirectoryStateBySlugFromDatabase,
  readStorefrontPublicPageMetadataStateBySlugFromDatabase,
  readStorefrontPublicRuntimeStateBySlugFromDatabase
} from "@/lib/storefront-state";
import { usesAiGenerationPublicSlug } from "@/lib/storefront-context/capabilities";
import type { PlatformState } from "@/lib/types";

export function preferLocalPathModeState(siteSlug?: string): boolean {
  void siteSlug;
  return false;
}

function databaseSourceError(kind: "runtime" | "metadata", siteSlug: string, pageSlug: string, error?: unknown): Error {
  const original = error instanceof Error && error.message ? ` Original error: ${error.message}` : "";
  return new Error(
    `Storefront ${kind} for ${siteSlug}${pageSlug} must read PostgreSQL published content. ` +
    "JSON fallback and local preview sources are disabled. Check DATABASE_URL and database availability." +
    original
  );
}

function legacyPageSlugForSite(siteSlug: string, pageSlug: string): string | undefined {
  if (pageSlug !== "/faq") return undefined;
  return usesAiGenerationPublicSlug(siteSlug) ? "/help" : undefined;
}

export async function readPathModePublicRuntimeState(siteSlug: string, pageSlug: string, contextSlug?: string): Promise<PlatformState | undefined> {
  try {
    const state = pageSlug === "/collections" || pageSlug === "/ai-image-generation"
      ? await readStorefrontPublicCollectionDirectoryStateBySlugFromDatabase(siteSlug)
      : await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, pageSlug, contextSlug);
    if (state?.sites[0]) return state;
    const legacyPageSlug = legacyPageSlugForSite(siteSlug, pageSlug);
    if (legacyPageSlug) {
      const legacyState = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, legacyPageSlug, contextSlug);
      if (legacyState?.sites[0]) return legacyState;
    }
  } catch (error) {
    throw databaseSourceError("runtime", siteSlug, pageSlug, error);
  }
  throw databaseSourceError("runtime", siteSlug, pageSlug);
}

export async function readPathModePublicMetadataState(siteSlug: string, pageSlug: string): Promise<PlatformState | undefined> {
  try {
    const state = await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, pageSlug);
    if (state?.sites[0]) return state;
    const legacyPageSlug = legacyPageSlugForSite(siteSlug, pageSlug);
    if (legacyPageSlug) {
      const legacyState = await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, legacyPageSlug);
      if (legacyState?.sites[0]) return legacyState;
    }
  } catch (error) {
    throw databaseSourceError("metadata", siteSlug, pageSlug, error);
  }
  throw databaseSourceError("metadata", siteSlug, pageSlug);
}
