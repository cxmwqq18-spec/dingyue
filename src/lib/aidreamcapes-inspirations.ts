import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { InspirationCard } from "@/lib/aidreamcapes-inspirations-types";

export type { InspirationCard } from "@/lib/aidreamcapes-inspirations-types";
export { inspirationCreateHref } from "@/lib/aidreamcapes-inspirations-types";

// In-site inspiration library (AIVideosUGC only). Cards come from the visual
// picker blocks already published on the public tool/template pages, read
// straight from LivePage relational rows. Nothing here is hardcoded copy: the
// page section is the only content source, and the browser never fetches
// public page data to build this view.

export const AIDREAMCAPES_INSPIRATIONS_SITE_ID = "site_aidreamcapes";
export const AIDREAMCAPES_INSPIRATIONS_SITE_SLUG = "aidreamcapes";

const V2_SECTION_TYPE = "aidreamcapes_v2_page";

// Media references in page content (n:..., g:..., f:...) are resolved with the
// same media catalog the build-time compiler uses. Only the fields needed for
// card rendering are read.
const MEDIA_CATALOG_PATH = path.join(process.cwd(), "scripts/data/aidreamcapes-site-v2/media-catalog.json");
const CATEGORY_OVERRIDES_PATH = path.join(process.cwd(), "scripts/data/aidreamcapes-site-v2/inspiration-categories.json");
const ASSET_ROOT = "/assets/sites/site_aidreamcapes/site-v2";

type CatalogMeta = { file?: string; w: number; h: number; alt: string; variants?: number[] };
type CatalogGallery = { dir: string; variants: number[]; items: Record<string, CatalogMeta> };
type MediaCatalog = {
  site: Record<string, unknown>;
  galleries: Record<string, CatalogGallery>;
  ugc: { dir: string; variants: number[]; items: Record<string, CatalogMeta> };
  frames: { dir: string; variants?: number[] };
  gen: Record<string, CatalogMeta>;
  gen2: Record<string, CatalogMeta>;
  guide: { dir: string; items: Record<string, CatalogMeta> };
  clipFrames?: Record<string, CatalogMeta>;
};

type PickerCardJson = {
  ref?: unknown;
  image?: unknown;
  label?: unknown;
  prompt?: unknown;
  sceneSlug?: unknown;
  chips?: unknown;
  kind?: unknown;
};

type V2PageSectionSettings = {
  layout?: unknown;
  data?: {
    id?: unknown;
    visual?: unknown;
  } & Record<string, unknown>;
};

type PageLike = {
  slug: string;
  contentJson: unknown;
};

let mediaCatalogCache: MediaCatalog | undefined;
let categoryOverridesCache: Record<string, string> | undefined;

function readMediaCatalog(): MediaCatalog | undefined {
  if (mediaCatalogCache) return mediaCatalogCache;
  try {
    mediaCatalogCache = JSON.parse(fs.readFileSync(MEDIA_CATALOG_PATH, "utf8")) as MediaCatalog;
  } catch {
    mediaCatalogCache = undefined;
  }
  return mediaCatalogCache;
}

export function readInspirationCategoryOverrides(): Record<string, string> {
  if (categoryOverridesCache) return categoryOverridesCache;
  try {
    const parsed = JSON.parse(fs.readFileSync(CATEGORY_OVERRIDES_PATH, "utf8")) as unknown;
    const overrides: Record<string, string> = {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string") overrides[key] = value;
      }
    }
    categoryOverridesCache = overrides;
  } catch {
    categoryOverridesCache = {};
  }
  return categoryOverridesCache ?? {};
}

function mediaRefFromSrc(catalog: MediaCatalog, src: string): string | undefined {
  const normalized = src.trim().split(/[?#]/, 1)[0];
  if (!normalized) return undefined;
  const guidePrefix = `${catalog.guide?.dir ?? ""}/`;
  if (guidePrefix && normalized.startsWith(guidePrefix)) {
    const file = normalized.slice(guidePrefix.length).replace(/--\d+\.webp$/, "");
    const match = Object.entries(catalog.guide.items ?? {}).find(([, meta]) => meta.file === file);
    if (match) return `n:guide:${match[0]}`;
  }
  for (const [tool, gallery] of Object.entries(catalog.galleries ?? {})) {
    const prefix = `${gallery.dir}/_responsive/`;
    if (!normalized.startsWith(prefix)) continue;
    const file = normalized.slice(prefix.length).replace(/--\d+\.webp$/, "");
    if (gallery.items[file]) return `g:${tool}/${file}`;
  }
  if (catalog.ugc) {
    const prefix = `${catalog.ugc.dir}/_responsive/`;
    if (normalized.startsWith(prefix)) {
      const file = normalized.slice(prefix.length).replace(/--\d+\.webp$/, "");
      const match = Object.entries(catalog.ugc.items ?? {}).find(([key, meta]) => (meta.file ?? key) === file);
      if (match) return `u:${match[0]}`;
    }
  }
  const genPrefix = `${ASSET_ROOT}/gen/`;
  if (normalized.startsWith(genPrefix)) {
    const file = normalized.slice(genPrefix.length).replace(/--\d+\.webp$/, "");
    if (catalog.gen[file]) return `n:${file}`;
  }
  const gen2Prefix = `${ASSET_ROOT}/gen2/`;
  if (normalized.startsWith(gen2Prefix)) {
    const file = normalized.slice(gen2Prefix.length).replace(/--\d+\.webp$/, "");
    const key = Object.keys(catalog.gen2 ?? {}).find((candidate) => candidate.replace(/:/g, "") === file);
    if (key) return `n:${key}`;
  }
  const framesPrefix = `${ASSET_ROOT}/frames/`;
  if (normalized.startsWith(framesPrefix)) {
    const file = normalized.slice(framesPrefix.length).replace(/--\d+\.webp$/, "");
    const frames = catalog.frames as unknown as Record<string, CatalogMeta>;
    if (frames[file] || catalog.clipFrames?.[file]) return `f:${file}`;
  }
  const clipPrefix = `${ASSET_ROOT}/clips/`;
  if (normalized.startsWith(clipPrefix)) {
    const file = normalized.slice(clipPrefix.length).replace(/--\d+\.webp$/, "");
    if (catalog.clipFrames?.[file]) return `f:${file}`;
    const frames = catalog.frames as unknown as Record<string, CatalogMeta>;
    if (frames[file]) return `f:${file}`;
  }
  for (const [key, meta] of Object.entries(catalog.site ?? {})) {
    if (normalized === `${ASSET_ROOT}/${key}.webp` && meta) return `s:${key}`;
  }
  return undefined;
}

// 640px card variant, matching the compiler's card media mode.
// Pick the smallest available responsive width (640px card variant when it exists).
function smallestCardWidth(variants?: number[]): number {
  const available = variants && variants.length ? variants : [640];
  return Math.min(...available);
}

function resolveMediaRef(catalog: MediaCatalog, ref: string): { src: string; alt: string } | undefined {
  const kind = ref.slice(0, 2);
  const rest = ref.slice(2);
  if (kind === "s:") {
    const key = rest;
    const siteEntry = catalog.site[key] as { alt?: string } | undefined;
    if (!siteEntry) return undefined;
    return { src: `/assets/sites/site_aidreamcapes/site-v2/${key}.webp`, alt: String(siteEntry.alt ?? "") };
  }
  if (kind === "g:") {
    const [tool, file] = rest.split("/");
    const gallery = catalog.galleries[tool];
    const meta = gallery?.items[file];
    if (!meta) return undefined;
    const width = smallestCardWidth(gallery.variants);
    return { src: `${gallery.dir}/_responsive/${file}--${width}.webp`, alt: meta.alt };
  }
  if (kind === "u:") {
    const group = catalog.ugc;
    const meta = group.items[rest];
    if (!meta) return undefined;
    const width = smallestCardWidth(group.variants);
    return { src: `${group.dir}/_responsive/${meta.file ?? rest}--${width}.webp`, alt: meta.alt };
  }
  if (kind === "n:") {
    const guideId = rest.startsWith("guide:") ? rest.slice("guide:".length) : "";
    const guideMeta = guideId ? catalog.guide?.items?.[guideId] : undefined;
    if (guideMeta) {
      const width = smallestCardWidth(guideMeta.variants);
      return { src: `${catalog.guide.dir}/${guideMeta.file}--${width}.webp`, alt: guideMeta.alt };
    }
    const isGen2 = Boolean(catalog.gen2?.[rest]);
    const meta = isGen2 ? catalog.gen2[rest] : catalog.gen[rest];
    if (!meta) return undefined;
    const folder = isGen2 ? "gen2" : "gen";
    const file = isGen2 ? rest.replace(/:/g, "") : rest;
    const width = smallestCardWidth(meta.variants);
    return { src: `${ASSET_ROOT}/${folder}/${file}--${width}.webp`, alt: meta.alt };
  }
  if (kind === "f:") {
    const frames = catalog.frames as unknown as Record<string, CatalogMeta>;
    const clipFrame = catalog.clipFrames?.[rest] ?? frames[rest];
    if (clipFrame) {
      const folder = catalog.clipFrames?.[rest] ? "clips" : "frames";
      const width = smallestCardWidth(clipFrame.variants);
      return { src: `${ASSET_ROOT}/${folder}/${rest}--${width}.webp`, alt: clipFrame.alt };
    }
    return undefined;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickerCardsFromContent(contentJson: unknown): PickerCardJson[] {
  if (!isRecord(contentJson)) return [];
  const sectionsOrder = Array.isArray(contentJson.sectionsOrder) ? contentJson.sectionsOrder : [];
  const sections = isRecord(contentJson.sections) ? contentJson.sections : {};
  for (const sectionId of sectionsOrder) {
    const section = sections[String(sectionId)];
    if (!isRecord(section) || section.type !== V2_SECTION_TYPE) continue;
    const settings = section.settings;
    if (!isRecord(settings)) continue;
    const data = (settings as V2PageSectionSettings).data;
    if (!isRecord(data) || !isRecord(data.visual)) continue;
    const picker = (data.visual as { picker?: unknown }).picker;
    if (isRecord(picker) && Array.isArray(picker.cards)) return picker.cards as PickerCardJson[];
  }
  return [];
}

function cardImageSrc(card: PickerCardJson): string | undefined {
  const image = isRecord(card.image) ? card.image : undefined;
  return typeof image?.src === "string" ? image.src.trim() : undefined;
}

// The last URL segment is the workspace tool slug (page.id for tool pages),
// e.g. /ai-video-generation/ugc-ad-video -> "ugc-ad-video".
function toolSlugFromPageSlug(slug: string): string | undefined {
  const normalized = slug.split("?")[0].split("#")[0];
  const segments = normalized.split("/").filter(Boolean);
  if (segments[0] !== "ai-video-generation" && segments[0] !== "ai-image-generation") return undefined;
  return segments[1];
}

function mediaKindFromSlug(slug: string): "video" | "photo" {
  return slug.startsWith("/ai-video-generation") ? "video" : "photo";
}

const CATEGORY_FALLBACK = "All";

// Categories come only from the reviewed mapping file
// (scripts/data/aidreamcapes-site-v2/inspiration-categories.json). Unmapped
// cards stay under "All" and are exported for reporting; categories are never
// guessed from product nouns.
function categoryForRef(overrides: Record<string, string>, ref: string): string {
  const override = overrides[ref];
  return override && override.trim() ? override.trim() : CATEGORY_FALLBACK;
}

export type InspirationUnmappedCard = {
  ref: string;
  label: string;
  toolSlug: string;
  pageSlug: string;
  kind: "video" | "photo";
};

export function getAidreamcapesInspirationUnmappedRefs(
  cards: Array<Pick<InspirationCard, "ref" | "category">>
): string[] {
  return cards.filter((card) => card.category === CATEGORY_FALLBACK).map((card) => card.ref);
}

// One-sentence card description. Uses only text already written for the tool
// page (the picker lead); no new marketing copy is introduced.
function cardDescription(pickerLead: string | undefined, pageTitle: string): string {
  if (pickerLead && pickerLead.trim()) return pickerLead.trim();
  return pageTitle;
}

export async function getAidreamcapesInspirationCards(): Promise<InspirationCard[]> {
  const catalog = readMediaCatalog();
  if (!catalog) return [];
  const overrides = readInspirationCategoryOverrides();
  const pages = await prisma.livePage.findMany({
    where: {
      siteId: AIDREAMCAPES_INSPIRATIONS_SITE_ID,
      OR: [
        { slug: { startsWith: "/ai-video-generation/" } },
        { slug: { startsWith: "ai-video-generation/" } },
        { slug: { startsWith: "/ai-image-generation/" } },
        { slug: { startsWith: "ai-image-generation/" } }
      ]
    },
    select: { slug: true, title: true, contentJson: true }
  });
  const cards: InspirationCard[] = [];
  const seenRefs = new Set<string>();
  for (const page of pages as Array<PageLike & { title?: string }>) {
    const toolSlug = toolSlugFromPageSlug(page.slug);
    if (!toolSlug) continue;
    const rawCards = pickerCardsFromContent(page.contentJson);
    if (!rawCards.length) continue;
    // Pull the picker lead for descriptions and confirm card kind via the
    // same section data.
    let pickerLead: string | undefined;
    {
      const sections = isRecord(page.contentJson) && isRecord(page.contentJson.sections) ? page.contentJson.sections : {};
      const order = isRecord(page.contentJson) && Array.isArray(page.contentJson.sectionsOrder) ? page.contentJson.sectionsOrder : [];
      for (const sectionId of order) {
        const section = sections[String(sectionId)];
        if (!isRecord(section) || section.type !== V2_SECTION_TYPE) continue;
        const settings = section.settings;
        if (isRecord(settings) && isRecord(settings.data) && isRecord(settings.data.visual) && isRecord(settings.data.visual.picker)) {
          const lead = settings.data.visual.picker.lead;
          if (typeof lead === "string" && lead.trim()) pickerLead = lead.trim();
        }
      }
    }
    const pageTitle = typeof page.title === "string" && page.title.trim() ? page.title.trim() : toolSlug;
    const kind = mediaKindFromSlug(page.slug);
    for (const raw of rawCards) {
      const imageSrc = cardImageSrc(raw);
      const ref = typeof raw.ref === "string" ? raw.ref.trim() : (imageSrc ? mediaRefFromSrc(catalog, imageSrc) ?? "" : "");
      const label = typeof raw.label === "string" ? raw.label.trim() : "";
      const prompt = typeof raw.prompt === "string" ? raw.prompt.trim() : "";
      if (!ref || !label) continue;
      if (seenRefs.has(ref)) continue;
      const media = resolveMediaRef(catalog, ref) ?? (imageSrc ? {
        src: imageSrc,
        alt: isRecord(raw.image) && typeof raw.image.alt === "string" ? raw.image.alt : label
      } : undefined);
      if (!media) continue;
      seenRefs.add(ref);
      cards.push({
        ref,
        label,
        prompt,
        imageSrc: media.src,
        imageAlt: media.alt,
        toolSlug,
        pageSlug: page.slug,
        sceneSlug: typeof raw.sceneSlug === "string" ? raw.sceneSlug : undefined,
        pageTitle,
        kind: typeof raw.kind === "string" && raw.kind === "photo" && kind === "photo" ? "photo" : kind,
        description: cardDescription(pickerLead, pageTitle),
        category: categoryForRef(overrides, ref)
      });
    }
  }
  cards.sort((left, right) => left.label.localeCompare(right.label));
  return cards;
}

export { CATEGORY_OVERRIDES_PATH };
