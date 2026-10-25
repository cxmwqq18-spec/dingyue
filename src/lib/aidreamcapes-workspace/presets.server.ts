import "server-only";
import { prisma } from "@/lib/prisma";
import { parseWorkspaceSceneRouteSlug, pickerPresetId, presetSourcePage, type PickerPresetCard, type WorkspacePreset, type WorkspacePresetRequest, type WorkspaceTemplateGallery } from "./preset-contract";
import { AIVIDEOSUGC_SITE_ID, WORKSPACE_PROMPT_MAX_LENGTH, type SceneId, type TaskInput } from "./types";
import { parseStaticCreateSegments } from "./static-routes";
import { canonicalWorkspaceTool } from "./tool-aliases";

type RecordValue = Record<string, unknown>;
const SCENES = new Set<SceneId>(["presenter_showcase", "process_demo", "texture_closeup", "text_to_video"]);
const ASPECTS = new Set<TaskInput["options"]["aspect"]>(["9:16", "1:1", "16:9"]);
const DURATIONS = new Set<TaskInput["options"]["duration"]>([6, 10, 15, 30]);
const IMAGE_TOOLS = new Set(["custom", "white-background", "change-background", "lifestyle-photos", "model-photos"]);
const IMAGE_TOOL_ALIASES: Record<string, WorkspacePreset["imageTool"]> = {
  "ecommerce-main-image": "white-background", "lifestyle-scene": "lifestyle-photos",
  "on-model-generation": "model-photos", "background-remove-replace": "change-background",
};
const SAFE_PREVIEW_PATH = /^(?:\/(?:media\/site_aidreamcapes|assets\/sites\/site_aidreamcapes)\/[A-Za-z0-9_./@%+-]+|\/ai-(?:image|video)-generation\/(?:actors\/)?[A-Za-z0-9_.@%+-]+)(?:\.(?:avif|gif|jpe?g|png|webp|mp4|webm))?$/i;

function record(value: unknown): RecordValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : undefined;
}

function safePreviewPath(value: string): boolean {
  if (!SAFE_PREVIEW_PATH.test(value)) return false;
  try {
    const decoded = decodeURIComponent(value);
    return !decoded.includes("\\") && decoded.split("/").every((part) => part !== "." && part !== "..");
  } catch { return false; }
}

/**
 * Public render assets a card was built from. A card may list them explicitly
 * (`referenceImages`, `referenceVideos`); the card's own image is the visible
 * asset every card carries. The finished example video is never a reference,
 * so `card.video` is deliberately not read here.
 */
function cardReferenceUrls(card: RecordValue, keys: readonly string[]): string[] {
  const urls: string[] = [];
  for (const key of keys) {
    const value = card[key];
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      const candidate = typeof item === "string" ? item : record(item)?.src;
      const src = typeof candidate === "string" ? candidate.trim() : "";
      if (src && safePreviewPath(src)) urls.push(src);
    }
  }
  return urls;
}

function sceneFromCard(card: RecordValue, href: URL, prompt: string, label: string, tool: string): SceneId {
  if (typeof card.sceneId === "string" && SCENES.has(card.sceneId as SceneId)) return card.sceneId as SceneId;
  const explicitTool = [card.videoTool, card.tool, tool, href.searchParams.get("tool")].filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
  const direction = `${explicitTool} ${label} ${prompt}`.toLowerCase();
  if (/\b(?:close.?up|texture|material|detail|finish|macro)\b/.test(direction)) return "texture_closeup";
  if (/\b(?:creator|ugc|presenter|spokesperson|talk(?:s|ing)? to camera|introduc(?:e|es|ing))\b/.test(direction)) return "presenter_showcase";
  if (/\b(?:demo|demonstrat|how.?to|step.?by.?step|show(?:s|ing)? how|before.?and.?after|use it)\b/.test(direction)) return "process_demo";
  return "process_demo";
}

function cardAspect(card: RecordValue, href: URL): TaskInput["options"]["aspect"] {
  const requested = typeof card.aspect === "string" ? card.aspect : href.searchParams.get("size");
  if (requested && ASPECTS.has(requested as TaskInput["options"]["aspect"])) return requested as TaskInput["options"]["aspect"];
  const image = record(card.image);
  const width = typeof image?.w === "number" && Number.isFinite(image.w) && image.w > 0 ? image.w : undefined;
  const height = typeof image?.h === "number" && Number.isFinite(image.h) && image.h > 0 ? image.h : undefined;
  if (width && height) {
    if (height / width > 1.15) return "9:16";
    if (width / height > 1.15) return "16:9";
  }
  return "1:1";
}

function cardDuration(href: URL, card: RecordValue): TaskInput["options"]["duration"] {
  const duration = Number(card.duration ?? href.searchParams.get("length"));
  return DURATIONS.has(duration as TaskInput["options"]["duration"]) ? duration as TaskInput["options"]["duration"] : 15;
}

function pickerFromContent(contentJson: unknown): RecordValue | undefined {
  return pickersFromContent(contentJson)[0];
}

function pickersFromContent(contentJson: unknown): RecordValue[] {
  const content = record(contentJson);
  const sections = record(content?.sections);
  const order = Array.isArray(content?.sectionsOrder) ? content.sectionsOrder : [];
  const pickers: RecordValue[] = [];
  for (const sectionId of order) {
    if (typeof sectionId !== "string") continue;
    const section = record(sections?.[sectionId]);
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const settings = record(section.settings);
    const data = record(settings?.data);
    const visual = record(data?.visual);
    const picker = record(visual?.picker);
    const definition = record(data?.templateDefinition);
    if (record(definition?.card)) pickers.push({ cards: [definition!.card] });
    if (picker && Array.isArray(picker.cards)) pickers.push(picker);
    if (Array.isArray(data?.workspaceCases)) pickers.push({ cards: data.workspaceCases });
    const groups = record(data?.examples)?.groups;
    if (Array.isArray(groups)) {
      const items = groups.flatMap((group) => {
        const list = record(group)?.items;
        return Array.isArray(list) ? list : [];
      });
      if (items.length) pickers.push({ cards: items });
    }
  }
  return pickers;
}

/** Photo stays photo; clips and scenes are moving pictures. */
function presetKind(value: unknown): "photo" | "video" | undefined {
  if (value === "photo") return "photo";
  if (value === "video" || value === "clip" || value === "scene") return "video";
  return undefined;
}

export function presetFromCard(page: { updatedAt: Date }, sourcePage: string, value: unknown): WorkspacePreset | undefined {
  const card = record(value);
  const image = record(card?.image);
  if (!card || !image || typeof image.src !== "string") return undefined;
  const kind = presetKind(card.kind);
  if (!kind) return undefined;
  const label = typeof card.label === "string" ? card.label : typeof card.title === "string" ? card.title : "";
  const src = image.src.trim();
  const title = label.trim();
  // Legacy example cards carry no prompt; the workspace then opens the tool
  // with the template preview and an empty prompt instead of guessing copy.
  const prompt = typeof card.prompt === "string" ? card.prompt.trim() : "";
  if (!title || prompt.length > WORKSPACE_PROMPT_MAX_LENGTH || !safePreviewPath(src)) return undefined;
  const presetCard = { ...card, kind, label: title };
  let href: URL;
  try { href = new URL(typeof card.href === "string" ? card.href : "/app/create", "https://www.aivideosugc.com"); }
  catch { return undefined; }
  const staticTarget = href.pathname.startsWith("/app/create/")
    ? parseStaticCreateSegments(href.pathname.slice("/app/create/".length).split("/")) : undefined;
  if (!["https:", "http:"].includes(href.protocol) || href.username || href.password || !["www.aivideosugc.com", "aivideosugc.com", "www.aidreamcapes.com", "aidreamcapes.com"].includes(href.hostname) || (href.pathname !== "/app/create" && staticTarget?.kind !== "tool")) return undefined;
  const rawTool = typeof card.tool === "string" ? card.tool : staticTarget?.kind === "tool" ? staticTarget.tool : href.searchParams.get("tool") ?? "";
  const imageTool = IMAGE_TOOLS.has(rawTool) ? rawTool as WorkspacePreset["imageTool"] : IMAGE_TOOL_ALIASES[rawTool] ?? "custom";
  // The example's own image is the asset a visitor sees on the card; explicit
  // reference lists extend it. `card.video` (the finished result) is excluded.
  const referenceImageUrls = [...new Set([src, ...cardReferenceUrls(card, ["referenceImages", "referenceImageUrls", "referenceAssets"])])];
  const referenceVideoUrls = [...new Set(cardReferenceUrls(card, ["referenceVideos", "referenceVideoUrls"]))];
  return {
    sourcePage,
    presetId: pickerPresetId(presetCard as unknown as PickerPresetCard),
    ...(typeof card.sceneSlug === "string" ? { sceneSlug: card.sceneSlug } : {}),
    ...(typeof card.publicSlug === "string" && /^[a-z0-9][a-z0-9-]{0,119}$/.test(card.publicSlug) ? { publicSlug: card.publicSlug } : {}),
    title: title.slice(0, 160),
    kind,
    prompt,
    previewUrl: src,
    sceneId: sceneFromCard(card, href, prompt, title, rawTool),
    aspect: cardAspect(card, href),
    duration: cardDuration(href, card),
    imageTool,
    sourceUpdatedAt: page.updatedAt.toISOString(),
    ...(referenceImageUrls.length ? { referenceImageUrls: referenceImageUrls.slice(0, 4) } : {}),
    ...(referenceVideoUrls.length ? { referenceVideoUrls: referenceVideoUrls.slice(0, 4) } : {}),
  };
}

/** Compare effective generation options, never page-local locator IDs. */
export function presetGenerationIdentity(preset: WorkspacePreset | undefined): string | undefined {
  if (!preset) return undefined;
  return JSON.stringify([preset.kind, preset.prompt, preset.previewUrl, preset.sceneId,
    preset.aspect, preset.duration, preset.imageTool]);
}

/** Resolve a clean image/video route against current Aidreamcapes LivePage data. */
export async function resolveWorkspacePublicScenePreset(siteId: string, kind: "photo" | "video", publicSlug: string): Promise<WorkspacePreset | undefined> {
  if (siteId !== AIVIDEOSUGC_SITE_ID || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(publicSlug)) return undefined;
  const pages = await prisma.$queryRaw<Array<{ slug: string; contentJson: unknown; updatedAt: Date }>>`
    SELECT "slug", "contentJson", "updatedAt"
    FROM "LivePage"
    WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID}
      AND (jsonb_path_exists(
        "contentJson",
        '$.sections.*.settings.data.visual.picker.cards[*] ? (@.publicSlug == $slug)'::jsonpath,
        jsonb_build_object('slug', ${publicSlug})
      ) OR jsonb_path_exists(
        "contentJson",
        '$.sections.*.settings.data.workspaceCases[*] ? (@.publicSlug == $slug)'::jsonpath,
        jsonb_build_object('slug', ${publicSlug})
      ) OR jsonb_path_exists(
        "contentJson",
        '$.sections.*.settings.data.examples.groups[*].items[*] ? (@.publicSlug == $slug)'::jsonpath,
        jsonb_build_object('slug', ${publicSlug})
      ) OR jsonb_path_exists(
        "contentJson",
        '$.sections.*.settings.data.templateDefinition.card ? (@.publicSlug == $slug)'::jsonpath,
        jsonb_build_object('slug', ${publicSlug})
      ))
    LIMIT 3
  `;
  if (pages.length !== 1) return undefined;
  const page = pages[0];
  for (const picker of pickersFromContent(page.contentJson)) {
    const cards = Array.isArray(picker.cards) ? picker.cards : [];
    for (const card of cards) {
      const candidate = record(card);
      if (candidate?.publicSlug !== publicSlug || presetKind(candidate.kind) !== kind) continue;
      return presetFromCard(page, page.slug, card);
    }
  }
  return undefined;
}

/** One relational template registry, shared by storefront directories and the workspace. */
export async function getWorkspaceTemplateGallery(siteId: string): Promise<WorkspaceTemplateGallery | undefined> {
  if (siteId !== AIVIDEOSUGC_SITE_ID) return undefined;
  const page = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId: AIVIDEOSUGC_SITE_ID, slug: "/templates" } },
    select: { contentJson: true },
  });
  const sections = record(record(page?.contentJson)?.sections);
  const directory = Object.values(sections ?? {}).map(section => record(record(record(section)?.settings)?.data)?.templateDirectory).map(record).find(Boolean);
  const paths = Array.isArray(directory?.paths) ? directory.paths.filter((path): path is string => typeof path === "string") : [];
  if (!paths.length) return undefined;
  const pages = await prisma.livePage.findMany({ where: { siteId: AIVIDEOSUGC_SITE_ID, slug: { in: paths } }, select: { slug: true, contentJson: true, updatedAt: true } });
  const options = paths.flatMap(path => {
    const owner = pages.find(item => item.slug === path);
    if (!owner) return [];
    const sections = record(record(owner.contentJson)?.sections);
    const definition = Object.values(sections ?? {}).map(section => record(record(record(section)?.settings)?.data)?.templateDefinition).map(record).find(Boolean);
    const card = record(definition?.card);
    if (!card) return [];
    const preset = presetFromCard(owner, owner.slug, card);
    if (!preset) return [];
    const image = record(card.image);
    return [{ ...preset, imageAlt: typeof image?.alt === "string" ? image.alt : preset.title, categoryIds: [preset.kind] }];
  });
  return { categories: [{ id: "photo", label: "Photo templates" }, { id: "video", label: "Video templates" }], options };
}

/** Resolve a picker card exclusively from the current Aidreamcapes LivePage row. */
export async function resolveWorkspacePreset(siteId: string, request: WorkspacePresetRequest): Promise<WorkspacePreset | undefined> {
  if (siteId !== AIVIDEOSUGC_SITE_ID) return undefined;
  const sourcePage = presetSourcePage(request.sourcePage);
  if (!sourcePage || !/^p_[a-f0-9]{24}$/.test(request.presetId)) return undefined;
  const page = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId: AIVIDEOSUGC_SITE_ID, slug: sourcePage } },
    select: { contentJson: true, updatedAt: true },
  });
  if (!page) return undefined;
  const cards = pickersFromContent(page.contentJson).flatMap(picker => Array.isArray(picker.cards) ? picker.cards : []);
  for (const card of cards) {
    const typedCard = record(card);
    const image = record(typedCard?.image);
    if (!typedCard || !image || typeof image.src !== "string" || typeof typedCard.kind !== "string" || typeof typedCard.label !== "string") continue;
    if (typedCard.kind !== "video" && typedCard.kind !== "photo") continue;
    if (pickerPresetId(typedCard as unknown as PickerPresetCard) !== request.presetId) continue;
    return presetFromCard(page, sourcePage, card);
  }
  return undefined;
}

/** Resolve a short-lived workspace scene request against its current LivePage card. */
export async function resolveWorkspaceScenePreset(siteId: string, routeSlug: string): Promise<WorkspacePreset | undefined> {
  if (siteId !== AIVIDEOSUGC_SITE_ID) return undefined;
  const locator = parseWorkspaceSceneRouteSlug(routeSlug);
  if (!locator) return undefined;
  const page = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId: AIVIDEOSUGC_SITE_ID, slug: locator.sourcePage } },
    select: { contentJson: true, updatedAt: true },
  });
  if (!page) return undefined;
  for (const picker of pickersFromContent(page.contentJson)) {
    const cards = Array.isArray(picker.cards) ? picker.cards : [];
    for (const card of cards) {
      const candidate = record(card);
      if (candidate?.sceneSlug !== locator.sceneSlug) continue;
      return presetFromCard(page, locator.sourcePage, card);
    }
  }
  return undefined;
}

/** Compatibility for published tool/template links, using the current detail owner. */
export async function resolveWorkspaceLegacyTemplatePreset(tool: string, template: string): Promise<WorkspacePreset | undefined> {
  const canonicalTool = canonicalWorkspaceTool(tool);
  const pages = await prisma.$queryRaw<Array<{ slug: string; contentJson: unknown; updatedAt: Date }>>`
    SELECT "slug", "contentJson", "updatedAt" FROM "LivePage"
    WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID}
      AND jsonb_path_exists("contentJson", '$.sections.*.settings.data.templateDefinition')
  `;
  for (const page of pages) {
    const sections = record(record(page.contentJson)?.sections);
    for (const section of Object.values(sections ?? {})) {
      const definition = record(record(record(section)?.settings)?.data)?.templateDefinition;
      const card = record(record(definition)?.card);
      if (typeof card?.href !== "string") continue;
      const path = new URL(card.href, "https://www.aivideosugc.com").pathname;
      const target = parseStaticCreateSegments(path.slice("/app/create/".length).split("/"));
      if (target?.kind === "tool" && target.tool === canonicalTool && target.template === template) return presetFromCard(page, page.slug, card);
    }
  }
  return undefined;
}
