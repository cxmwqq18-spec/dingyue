import { createHash } from "node:crypto";
import type { SceneId, TaskInput } from "./types";
import type { WorkspaceImageTool } from "@/components/aidreamcapes-workspace/image-tool-picker";

export interface PickerPresetCard {
  image: { src: string; w?: number; h?: number };
  label: string;
  prompt: string;
  href: string;
  kind: "photo" | "video";
  tool?: string;
  sceneId?: SceneId;
}
export interface WorkspacePresetRequest { sourcePage: string; presetId: string }
export interface WorkspacePreset extends WorkspacePresetRequest {
  title: string;
  kind: "photo" | "video";
  prompt: string;
  previewUrl: string;
  sceneId: SceneId;
  aspect: TaskInput["options"]["aspect"];
  duration: TaskInput["options"]["duration"];
  imageTool: WorkspaceImageTool;
  sourceUpdatedAt: string;
}

export function presetSourcePage(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 300 || !value.startsWith("/") || value.startsWith("//") || /[\\?#\u0000-\u0020]/.test(value)) return;
  if (value.split("/").some((part) => part === "." || part === ".." || /%2f|%5c|%2e/i.test(part))) return;
  return value.length > 1 ? value.replace(/\/+$/, "") : "/";
}

/** Identity comes from the current relational card, not its array position. */
export function pickerPresetId(card: Pick<PickerPresetCard, "image" | "kind" | "label">): string {
  return `p_${createHash("sha256").update(JSON.stringify([card.kind, card.image.src, card.label])).digest("hex").slice(0, 24)}`;
}

/** Called during public SSR. Only the small identity crosses into the app URL. */
export function pickerPresetHref(card: PickerPresetCard, sourcePage: string | undefined): string {
  const source = presetSourcePage(sourcePage);
  if (!source) return card.href;
  let target: URL;
  try { target = new URL(card.href, "https://www.aivideosugc.com"); } catch { return card.href; }
  if (!["www.aivideosugc.com", "aivideosugc.com", "aidreamcapes.com", "www.aidreamcapes.com"].includes(target.hostname) || target.pathname !== "/app/create") return card.href;
  const query = new URLSearchParams({ source, preset: pickerPresetId(card) });
  return `/app/create?${query.toString()}`;
}

export function presetRequestFromQuery(query: Record<string, string | string[] | undefined>): WorkspacePresetRequest | undefined {
  const sourcePage = presetSourcePage(query.source);
  const presetId = typeof query.preset === "string" && /^p_[a-f0-9]{24}$/.test(query.preset) ? query.preset : undefined;
  return sourcePage && presetId ? { sourcePage, presetId } : undefined;
}
