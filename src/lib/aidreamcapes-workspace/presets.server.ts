import "server-only";
import { prisma } from "@/lib/prisma";
import { pickerPresetId, presetSourcePage, type PickerPresetCard, type WorkspacePreset, type WorkspacePresetRequest } from "./preset-contract";
import { AIVIDEOSUGC_SITE_ID, type SceneId, type TaskInput } from "./types";

type RecordValue = Record<string, unknown>;
const SCENES = new Set<SceneId>(["presenter_showcase", "process_demo", "texture_closeup"]);
const ASPECTS = new Set<TaskInput["options"]["aspect"]>(["9:16", "1:1", "16:9"]);
const DURATIONS = new Set<TaskInput["options"]["duration"]>([6, 10, 15, 30]);
const IMAGE_TOOLS = new Set(["custom", "white-background", "change-background", "lifestyle-photos", "model-photos"]);
const IMAGE_TOOL_ALIASES: Record<string, WorkspacePreset["imageTool"]> = {
  "ecommerce-main-image": "white-background", "lifestyle-scene": "lifestyle-photos",
  "on-model-generation": "model-photos", "background-remove-replace": "change-background",
};
const SAFE_PREVIEW_PATH = /^\/(?:media\/site_aidreamcapes|assets\/sites\/site_aidreamcapes)\/[A-Za-z0-9_./@%+-]+(?:\.(?:avif|gif|jpe?g|png|webp|mp4|webm))?$/i;

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
  const content = record(page.contentJson);
  const sections = record(content?.sections);
  const order = Array.isArray(content?.sectionsOrder) ? content.sectionsOrder : [];
  for (const sectionId of order) {
    if (typeof sectionId !== "string") continue;
    const section = record(sections?.[sectionId]);
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const settings = record(section.settings);
    const data = record(settings?.data);
    const visual = record(data?.visual);
    const picker = record(visual?.picker);
    if (!Array.isArray(picker?.cards)) continue;
    for (const rawCard of picker.cards) {
      const card = record(rawCard);
      const image = record(card?.image);
      if (!card || !image || typeof image.src !== "string" || typeof card.kind !== "string" || typeof card.label !== "string") continue;
      if (card.kind !== "video" && card.kind !== "photo") continue;
      const typedCard = card as unknown as PickerPresetCard;
      if (pickerPresetId(typedCard) !== request.presetId) continue;
      const src = image.src.trim();
      const label = card.label.trim();
      const prompt = typeof card.prompt === "string" ? card.prompt.trim() : "";
      if (!label || !prompt || prompt.length > 4000 || !safePreviewPath(src)) return undefined;
      let href: URL;
      try { href = new URL(typeof card.href === "string" ? card.href : "/app/create", "https://www.aivideosugc.com"); }
      catch { return undefined; }
      if (!["https:", "http:"].includes(href.protocol) || !["www.aivideosugc.com", "aivideosugc.com", "www.aidreamcapes.com", "aidreamcapes.com"].includes(href.hostname) || href.pathname !== "/app/create") return undefined;
      const rawTool = typeof card.tool === "string" ? card.tool : href.searchParams.get("tool") ?? "";
      const imageTool = IMAGE_TOOLS.has(rawTool) ? rawTool as WorkspacePreset["imageTool"] : IMAGE_TOOL_ALIASES[rawTool] ?? "custom";
      return {
        sourcePage,
        presetId: request.presetId,
        title: label.slice(0, 160),
        kind: card.kind,
        prompt,
        previewUrl: src,
        sceneId: sceneFromCard(card, href, prompt, label),
        aspect: cardAspect(card, href),
        duration: cardDuration(href),
        imageTool,
        sourceUpdatedAt: page.updatedAt.toISOString(),
      };
    }
  }
  return undefined;
}
