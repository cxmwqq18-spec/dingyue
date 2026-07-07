import fs from "node:fs";
import path from "node:path";
import {
  readStorefrontPlatformState,
  readStorefrontPublicCollectionDirectoryStateBySlugFromDatabase,
  readStorefrontPublicPageMetadataStateBySlugFromDatabase,
  readStorefrontPublicRuntimeStateBySlugFromDatabase
} from "@/lib/storefront-state";
import { publicSiteSlug } from "@/lib/domain-routing";
import type { PlatformState } from "@/lib/types";

const localPlatformStateFile = path.join(process.cwd(), "data", "platform-state.json");
let localJsonStateCache: { mtimeMs: number; state: PlatformState } | null = null;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readLocalJsonPlatformState(): PlatformState | undefined {
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
  const clonedSite = cloneJson(site);
  return {
    ...state,
    sites: [clonedSite, ...state.sites.filter((item) => item.id !== site.id)]
  };
}

async function readLocalState(siteSlug: string): Promise<PlatformState | undefined> {
  const localJsonState = readLocalJsonPlatformState();
  if (localJsonState) return stateWithSiteFirst(localJsonState, siteSlug);
  return stateWithSiteFirst(await readStorefrontPlatformState(), siteSlug);
}

export function preferLocalPathModeState(): boolean {
  return process.env.STOREFRONT_PATH_MODE_READS !== "database" && process.env.NODE_ENV !== "production";
}

export async function readPathModePublicRuntimeState(siteSlug: string, pageSlug: string, contextSlug?: string): Promise<PlatformState | undefined> {
  if (preferLocalPathModeState()) return readLocalState(siteSlug);
  try {
    const state = pageSlug === "/collections"
      ? await readStorefrontPublicCollectionDirectoryStateBySlugFromDatabase(siteSlug)
      : await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, pageSlug, contextSlug);
    if (state?.sites[0]) return state;
  } catch {
    // Local development can exhaust or cold-start relational reads; JSON state keeps /site previews responsive.
  }
  return readLocalState(siteSlug);
}

export async function readPathModePublicMetadataState(siteSlug: string, pageSlug: string): Promise<PlatformState | undefined> {
  if (preferLocalPathModeState()) return readLocalState(siteSlug);
  try {
    const state = await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, pageSlug);
    if (state?.sites[0]) return state;
  } catch {
    // Fall back to the local storefront preview state.
  }
  return readLocalState(siteSlug);
}
