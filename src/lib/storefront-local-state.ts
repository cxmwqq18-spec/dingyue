import fs from "node:fs";
import path from "node:path";
import {
  readStorefrontPlatformState,
  readStorefrontPublicCollectionDirectoryStateBySlugFromDatabase,
  readStorefrontPublicPageMetadataStateBySlugFromDatabase,
  readStorefrontPublicRuntimeStateBySlugFromDatabase
} from "@/lib/storefront-state";
import { publicSiteSlug } from "@/lib/domain-routing";
import {
  isAnyLocalStorefrontReadPreference,
  isDatabaseStorefrontReadPreference,
  isExplicitLocalPreviewReadPreference,
  isLegacyLocalStorefrontReadPreference,
  isMydreamshootsContentSourceSlug,
  requiresMydreamshootsPublishedSource
} from "@/lib/storefront-content-source-policy";
import type { CreativePackCategory, PlatformState, ToolCategory } from "@/lib/types";

const localPlatformStateFile = path.join(process.cwd(), "data", "platform-state.json");
let localJsonStateCache: { mtimeMs: number; state: PlatformState } | null = null;
let warnedIgnoredMydreamshootsLocalPreference = false;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function readLocalJsonPlatformState(): PlatformState | undefined {
  try {
    const stat = fs.statSync(localPlatformStateFile);
    if (localJsonStateCache?.mtimeMs === stat.mtimeMs) return localJsonStateCache.state;
    const state = JSON.parse(fs.readFileSync(localPlatformStateFile, "utf8")) as PlatformState;
    localJsonStateCache = { mtimeMs: stat.mtimeMs, state };
    return state;
  } catch {
    return undefined;
  }
}

function stateWithSiteFirst(state: PlatformState, siteSlug: string): PlatformState | undefined {
  const canonicalSlug = publicSiteSlug(siteSlug);
  const site = state.sites.find((item) => publicSiteSlug(item.slug) === canonicalSlug || item.slug === siteSlug);
  if (!site) return undefined;
  const stateWithRelations = hydrateLocalStateRelationsForSite(state, site.id);
  const clonedSite = cloneJson(site);
  return {
    ...stateWithRelations,
    sites: [clonedSite, ...stateWithRelations.sites.filter((item) => item.id !== site.id)]
  };
}

function hydrateCategoryParents<T extends CreativePackCategory | ToolCategory>(categories: T[]): Map<string, T> {
  const source = new Map(categories.map((category) => [category.id, cloneJson(category)]));
  const hydrated = new Map<string, T>();
  const visiting = new Set<string>();

  const hydrate = (category: T | undefined): T | undefined => {
    if (!category) return undefined;
    const cached = hydrated.get(category.id);
    if (cached) return cached;
    if (visiting.has(category.id)) {
      const selfReferenceSafe = { ...category, parent: undefined } as T;
      hydrated.set(category.id, selfReferenceSafe);
      return selfReferenceSafe;
    }
    visiting.add(category.id);
    const parentId = category.parentId;
    const parent = parentId && parentId !== category.id ? hydrate(source.get(parentId) as T | undefined) : undefined;
    const next = { ...category, parent } as T;
    visiting.delete(category.id);
    hydrated.set(category.id, next);
    return next;
  };

  for (const category of source.values()) hydrate(category as T);
  return hydrated;
}

function hydrateLocalStateRelationsForSite(state: PlatformState, siteId: string): PlatformState {
  const creativePackCategories = (state.creativePackCategories ?? []).filter((category) => category.siteId === siteId);
  const toolCategories = (state.toolCategories ?? []).filter((category) => category.siteId === siteId);
  if (!creativePackCategories.length && !toolCategories.length) return state;

  const creativeCategoryById = hydrateCategoryParents(creativePackCategories);
  const toolCategoryById = hydrateCategoryParents(toolCategories);

  return {
    ...state,
    creativePacks: (state.creativePacks ?? []).map((pack) => {
      if (pack.siteId !== siteId) return pack;
      const categoryRecord = pack.categoryId ? creativeCategoryById.get(pack.categoryId) : pack.categoryRecord;
      return categoryRecord ? { ...pack, categoryRecord } : pack;
    }),
    toolMenuItems: (state.toolMenuItems ?? []).map((item) => {
      if (item.siteId !== siteId) return item;
      const category = item.categoryId ? toolCategoryById.get(item.categoryId) : item.category;
      return category ? { ...item, category } : item;
    })
  };
}

async function readLocalState(siteSlug: string): Promise<PlatformState | undefined> {
  const localJsonState = readLocalJsonPlatformState();
  if (localJsonState) return stateWithSiteFirst(localJsonState, siteSlug);
  return stateWithSiteFirst(await readStorefrontPlatformState(), siteSlug);
}

function pathModeReadPreference(): string {
  return (process.env.STOREFRONT_PATH_MODE_READS ?? "").trim().toLowerCase();
}

function prefersLocalPersistenceBackend(): boolean {
  const backend = (process.env.PERSISTENCE_BACKEND ?? "").trim().toLowerCase();
  return Boolean(backend && backend !== "postgres");
}

function isSynchronizedDreamshootSite(siteSlug?: string): boolean {
  if (!siteSlug) return false;
  return /mydreamshoots|dreamshoot|aidreamcapes/i.test(publicSiteSlug(siteSlug));
}

export function preferLocalPathModeState(siteSlug?: string): boolean {
  const preference = pathModeReadPreference();
  if (isMydreamshootsContentSourceSlug(siteSlug)) {
    if (isLegacyLocalStorefrontReadPreference(preference) && !warnedIgnoredMydreamshootsLocalPreference && process.env.NODE_ENV !== "production") {
      warnedIgnoredMydreamshootsLocalPreference = true;
      console.warn(
        `[storefront-content-source] Ignoring STOREFRONT_PATH_MODE_READS=${preference} for synchronized storefront content. ` +
        "Use local-preview only for an intentional data/platform-state.json preview."
      );
    }
    return isExplicitLocalPreviewReadPreference(preference);
  }
  if (isDatabaseStorefrontReadPreference(preference)) return false;
  if (isAnyLocalStorefrontReadPreference(preference)) return true;
  if (prefersLocalPersistenceBackend()) return true;
  if (process.env.NODE_ENV === "production") return false;
  return !isSynchronizedDreamshootSite(siteSlug);
}

function databaseSourceError(kind: "runtime" | "metadata", siteSlug: string, pageSlug: string, error?: unknown): Error {
  const original = error instanceof Error && error.message ? ` Original error: ${error.message}` : "";
  return new Error(
    `Synchronized storefront ${kind} for ${siteSlug}${pageSlug} must read Postgres published content. ` +
    "Refusing to fall back to data/platform-state.json because that can reintroduce stale copy. " +
    "Check DATABASE_URL/DB tunnel, or set STOREFRONT_PATH_MODE_READS=local-preview for an intentional JSON preview." +
    original
  );
}

function legacyPageSlugForSite(siteSlug: string, pageSlug: string): string | undefined {
  if (pageSlug !== "/faq") return undefined;
  return /mydreamshoots|dreamshoot|aidreamcapes/i.test(siteSlug) ? "/help" : undefined;
}

export async function readPathModePublicRuntimeState(siteSlug: string, pageSlug: string, contextSlug?: string): Promise<PlatformState | undefined> {
  const requiresPublishedSource = requiresMydreamshootsPublishedSource(siteSlug, pathModeReadPreference());
  if (preferLocalPathModeState(siteSlug)) return readLocalState(siteSlug);
  try {
    const state = pageSlug === "/collections"
      ? await readStorefrontPublicCollectionDirectoryStateBySlugFromDatabase(siteSlug)
      : await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, pageSlug, contextSlug);
    if (state?.sites[0]) return state;
    const legacyPageSlug = legacyPageSlugForSite(siteSlug, pageSlug);
    if (legacyPageSlug) {
      const legacyState = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, legacyPageSlug, contextSlug);
      if (legacyState?.sites[0]) return legacyState;
    }
  } catch (error) {
    if (requiresPublishedSource) throw databaseSourceError("runtime", siteSlug, pageSlug, error);
    // Local development can exhaust or cold-start relational reads; JSON state keeps non-protected /site previews responsive.
  }
  if (requiresPublishedSource) throw databaseSourceError("runtime", siteSlug, pageSlug);
  return readLocalState(siteSlug);
}

export async function readPathModePublicMetadataState(siteSlug: string, pageSlug: string): Promise<PlatformState | undefined> {
  const requiresPublishedSource = requiresMydreamshootsPublishedSource(siteSlug, pathModeReadPreference());
  if (preferLocalPathModeState(siteSlug)) return readLocalState(siteSlug);
  try {
    const state = await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, pageSlug);
    if (state?.sites[0]) return state;
    const legacyPageSlug = legacyPageSlugForSite(siteSlug, pageSlug);
    if (legacyPageSlug) {
      const legacyState = await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, legacyPageSlug);
      if (legacyState?.sites[0]) return legacyState;
    }
  } catch (error) {
    if (requiresPublishedSource) throw databaseSourceError("metadata", siteSlug, pageSlug, error);
    // Fall back to the local storefront preview state for non-protected sites.
  }
  if (requiresPublishedSource) throw databaseSourceError("metadata", siteSlug, pageSlug);
  return readLocalState(siteSlug);
}
