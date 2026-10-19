import "server-only";
import { prisma } from "@/lib/prisma";
import { parseWorkspaceSceneRouteSlug, pickerPresetId, presetSourcePage, type PickerPresetCard, type WorkspacePreset, type WorkspacePresetRequest, type WorkspaceTemplateGallery } from "./preset-contract";
import { AIVIDEOSUGC_SITE_ID, type SceneId, type TaskInput } from "./types";
import { parseStaticCreateSegments } from "./static-routes";

type RecordValue = Record<string, unknown>;
const SCENES = new Set<SceneId>(["presenter_showcase", "process_demo", "texture_closeup"]);
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

function sceneFromCard(card: RecordValue, href: URL, prompt: string, label: string): SceneId {
  if (typeof card.sceneId === "string" && SCENES.has(card.sceneId as SceneId)) return card.sceneId as SceneId;
  const explicitTool = [card.videoTool, card.tool, href.searchParams.get("tool")].filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
  const direction = `${explicitTool} ${label} ${prompt}`.toLowerCase();
  if (/\b(?:close.?up|texture|material|detail|finish|macro)\b/.test(direction)) return "texture_closeup";
  if (/\b(?:creator|ugc|presenter|spokesperson|talk(?:s|ing)? to camera|introduc(?:e|es|ing))\b/.test(direction)) return "presenter_showcase";
  if (/\b(?:demo|demonstrat|how.?to|step.?by.?step|show(?:s|ing)? how|before.?and.?after|use it)\b/.test(direction)) return "process_demo";
  return "process_demo";
}

function cardAspect(card: RecordValue, href: URL): TaskInput["options"]["aspect"] {
  const requested = href.searchParams.get("size");
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

function cardDuration(href: URL): TaskInput["options"]["duration"] {
  const duration = Number(href.searchParams.get("length"));
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
    if (picker && Array.isArray(picker.cards)) pickers.push(picker);
  }
  return pickers;
}

function presetFromCard(page: { updatedAt: Date }, sourcePage: string, value: unknown): WorkspacePreset | undefined {
  const card = record(value);
  const image = record(card?.image);
  if (!card || !image || typeof image.src !== "string" || typeof card.kind !== "string" || typeof card.label !== "string") return undefined;
  if (card.kind !== "video" && card.kind !== "photo") return undefined;
  const typedCard = card as unknown as PickerPresetCard;
  const src = image.src.trim();
  const title = card.label.trim();
  const prompt = typeof card.prompt === "string" ? card.prompt.trim() : "";
  if (!title || !prompt || prompt.length > 4000 || !safePreviewPath(src)) return undefined;
  let href: URL;
  try { href = new URL(typeof card.href === "string" ? card.href : "/app/create", "https://www.aivideosugc.com"); }
  catch { return undefined; }
  const staticTarget = href.pathname.startsWith("/app/create/")
    ? parseStaticCreateSegments(href.pathname.slice("/app/create/".length).split("/")) : undefined;
  if (!["https:", "http:"].includes(href.protocol) || href.username || href.password || !["www.aivideosugc.com", "aivideosugc.com", "www.aidreamcapes.com", "aidreamcapes.com"].includes(href.hostname) || (href.pathname !== "/app/create" && staticTarget?.kind !== "tool")) return undefined;
  const rawTool = typeof card.tool === "string" ? card.tool : staticTarget?.kind === "tool" ? staticTarget.tool : href.searchParams.get("tool") ?? "";
  const imageTool = IMAGE_TOOLS.has(rawTool) ? rawTool as WorkspacePreset["imageTool"] : IMAGE_TOOL_ALIASES[rawTool] ?? "custom";
  return {
    sourcePage,
    presetId: pickerPresetId(typedCard),
    ...(typeof card.sceneSlug === "string" ? { sceneSlug: card.sceneSlug } : {}),
    ...(typeof card.publicSlug === "string" && /^[a-z0-9][a-z0-9-]{0,119}$/.test(card.publicSlug) ? { publicSlug: card.publicSlug } : {}),
    title: title.slice(0, 160),
    kind: card.kind,
    prompt,
    previewUrl: src,
    sceneId: sceneFromCard(card, href, prompt, title),
    aspect: cardAspect(card, href),
    duration: cardDuration(href),
    imageTool,
    sourceUpdatedAt: page.updatedAt.toISOString(),
  };
}

/** Resolve a clean image/video route against current Aidreamcapes LivePage data. */
export async function resolveWorkspacePublicScenePreset(siteId: string, kind: "photo" | "video", publicSlug: string): Promise<WorkspacePreset | undefined> {
  if (siteId !== AIVIDEOSUGC_SITE_ID || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(publicSlug)) return undefined;
  const pages = await prisma.$queryRaw<Array<{ slug: string; contentJson: unknown; updatedAt: Date }>>`
    SELECT "slug", "contentJson", "updatedAt"
    FROM "LivePage"
    WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID}
      AND jsonb_path_exists(
        "contentJson",
        '$.sections.*.settings.data.visual.picker.cards[*] ? (@.publicSlug == $slug && @.kind == $kind)'::jsonpath,
        jsonb_build_object('slug', ${publicSlug}, 'kind', ${kind})
      )
    LIMIT 3
  `;
  if (pages.length !== 1) return undefined;
  const page = pages[0];
  for (const picker of pickersFromContent(page.contentJson)) {
    const cards = Array.isArray(picker.cards) ? picker.cards : [];
    for (const card of cards) {
      const candidate = record(card);
      if (candidate?.publicSlug !== publicSlug || candidate.kind !== kind) continue;
      return presetFromCard(page, page.slug, card);
    }
  }
  return undefined;
}

/** Read the current homepage picker cards from Aidreamcapes' relational LivePage row. */
export async function getWorkspaceTemplateGallery(siteId: string): Promise<WorkspaceTemplateGallery | undefined> {
  if (siteId !== AIVIDEOSUGC_SITE_ID) return undefined;
  const page = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId: AIVIDEOSUGC_SITE_ID, slug: "/" } },
    select: { contentJson: true, updatedAt: true },
  });
  if (!page) return undefined;
  const picker = pickerFromContent(page.contentJson);
  if (!picker || !Array.isArray(picker.cards)) return undefined;
  const categories = (Array.isArray(picker.chips) ? picker.chips : []).flatMap((value) => {
    const category = record(value);
    const id = typeof category?.id === "string" ? category.id.trim() : "";
    const label = typeof category?.label === "string" ? category.label.trim() : "";
    return /^[a-z0-9-]{1,80}$/.test(id) && label ? [{ id, label: label.slice(0, 100) }] : [];
  });
  const categoryIds = new Set(categories.map((category) => category.id));
  const options = picker.cards.flatMap((value) => {
    const preset = presetFromCard(page, "/", value);
    if (!preset) return [];
    const card = record(value);
    const image = record(card?.image);
    const tags = Array.isArray(card?.chips) ? card.chips.filter((item): item is string => typeof item === "string" && categoryIds.has(item)) : [];
    return [{
      ...preset,
      imageAlt: typeof image?.alt === "string" && image.alt.trim() ? image.alt.trim().slice(0, 300) : preset.title,
      categoryIds: [...new Set(tags)],
    }];
  });
  return { categories, options };
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
  const cards = pickerFromContent(page.contentJson)?.cards;
  if (!Array.isArray(cards)) return undefined;
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
