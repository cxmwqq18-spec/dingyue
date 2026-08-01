import fs from "node:fs";
import path from "node:path";
import {
  readStorefrontPlatformState,
  readStorefrontPublicCollectionDirectoryStateBySlugFromDatabase,
  readStorefrontPublicPageMetadataStateBySlugFromDatabase,
  readStorefrontPublicRuntimeStateBySlugFromDatabase
} from "@/lib/storefront-state";
import { publicSiteSlug } from "@/lib/domain-routing";
import type { CreativePackCategory, PlatformState, ToolCategory } from "@/lib/types";

const localPlatformStateFile = path.join(process.cwd(), "data", "platform-state.json");
let localJsonStateCache: { mtimeMs: number; state: PlatformState } | null = null;

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
  if (["database", "db", "relational"].includes(preference)) return false;
  if (["local", "json", "legacy", "file"].includes(preference)) return true;
  if (prefersLocalPersistenceBackend()) return true;
  if (process.env.NODE_ENV === "production") return false;
  return !isSynchronizedDreamshootSite(siteSlug);
}

function legacyPageSlugForSite(siteSlug: string, pageSlug: string): string | undefined {
  if (pageSlug !== "/faq") return undefined;
  return /mydreamshoots|dreamshoot|aidreamcapes/i.test(siteSlug) ? "/help" : undefined;
}

export async function readPathModePublicRuntimeState(siteSlug: string, pageSlug: string, contextSlug?: string): Promise<PlatformState | undefined> {
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
  } catch {
    // Local development can exhaust or cold-start relational reads; JSON state keeps /site previews responsive.
  }
  return readLocalState(siteSlug);
}

export async function readPathModePublicMetadataState(siteSlug: string, pageSlug: string): Promise<PlatformState | undefined> {
  if (preferLocalPathModeState(siteSlug)) return readLocalState(siteSlug);
  try {
    const state = await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, pageSlug);
    if (state?.sites[0]) return state;
    const legacyPageSlug = legacyPageSlugForSite(siteSlug, pageSlug);
    if (legacyPageSlug) {
      const legacyState = await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, legacyPageSlug);
      if (legacyState?.sites[0]) return legacyState;
    }
  } catch {
    // Fall back to the local storefront preview state.
  }
  return readLocalState(siteSlug);
}
