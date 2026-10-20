import type { SceneId, TaskInput } from "./types";
import type { WorkspaceImageTool } from "@/components/aidreamcapes-workspace/image-tool-picker";

export interface PickerPresetCard {
  image: { src: string; w?: number; h?: number };
  label: string;
  prompt: string;
  href: string;
  kind: "photo" | "video";
  sceneSlug?: string;
  publicSlug?: string;
  tool?: string;
  sceneId?: SceneId;
}
export interface WorkspacePresetRequest { sourcePage: string; presetId: string }
export interface WorkspacePreset extends WorkspacePresetRequest {
  sceneSlug?: string;
  publicSlug?: string;
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
export interface WorkspaceTemplateOption extends WorkspacePreset {
  imageAlt: string;
  categoryIds: string[];
}
export interface WorkspaceTemplateGallery {
  categories: { id: string; label: string }[];
  options: WorkspaceTemplateOption[];
}

export function presetSourcePage(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 300 || !value.startsWith("/") || value.startsWith("//") || /[\\?#\u0000-\u0020]/.test(value)) return;
  if (value.split("/").some((part) => part === "." || part === ".." || /%2f|%5c|%2e/i.test(part))) return;
  return value.length > 1 ? value.replace(/\/+$/, "") : "/";
}

/** Identity comes from the current relational card, not its array position. */
export function pickerPresetId(card: Pick<PickerPresetCard, "image" | "kind" | "label">): string {
  const value = JSON.stringify([card.kind, card.image.src, card.label]);
  const hash = (seed: number) => {
    let result = seed;
    for (let index = 0; index < value.length; index += 1) {
      result = Math.imul(result ^ value.charCodeAt(index), 0x01000193);
    }
    return (result >>> 0).toString(16).padStart(8, "0");
  };
  // This is an opaque, stable locator shared by SSR and the browser. The
  // server still resolves every request against the current relational card.
  return `p_${hash(0x811c9dc5)}${hash(0x9e3779b9)}${hash(0x85ebca6b)}`;
}

const SCENE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,159}$/;

function encodePageToken(page: string): string {
  const bytes = new TextEncoder().encode(page);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodePageToken(token: string): string | undefined {
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(token)) return undefined;
  try {
    const base64 = token.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const page = new TextDecoder().decode(bytes);
    return encodePageToken(page) === token ? page : undefined;
  } catch { return undefined; }
}

/** A route locator carries the source LivePage path and its persisted card slug. */
export function workspaceSceneRouteSlug(sourcePage: string | undefined, sceneSlug: string | undefined): string | undefined {
  const source = presetSourcePage(sourcePage);
  if (!source || !sceneSlug || !SCENE_SLUG_PATTERN.test(sceneSlug)) return undefined;
  return `${encodePageToken(source)}.${sceneSlug}`;
}

export function parseWorkspaceSceneRouteSlug(value: string): { sourcePage: string; sceneSlug: string } | undefined {
  if (value.length > 720) return undefined;
  const separator = value.indexOf(".");
  if (separator <= 0 || separator !== value.lastIndexOf(".")) return undefined;
  const sourcePage = presetSourcePage(decodePageToken(value.slice(0, separator)));
  const sceneSlug = value.slice(separator + 1);
  if (!sourcePage || !SCENE_SLUG_PATTERN.test(sceneSlug)) return undefined;
  return { sourcePage, sceneSlug };
}

export const PUBLIC_SCENE_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/i;

export function workspaceMediaRoutePath(kind: "photo" | "video", publicSlug: string | undefined): string | undefined {
  if (!publicSlug || !PUBLIC_SCENE_SLUG_RE.test(publicSlug)) return undefined;
  return `/${kind === "photo" ? "ai-image-generation" : "ai-video-generation"}/${publicSlug}`;
}

/** Called during public SSR. Only the small identity crosses into the app URL. */
export function pickerPresetHref(card: PickerPresetCard, sourcePage: string | undefined): string {
  const source = presetSourcePage(sourcePage);
  if (!source) return card.href;
  let target: URL;
  try { target = new URL(card.href, "https://www.aivideosugc.com"); } catch { return card.href; }
  if (!["https:", "http:"].includes(target.protocol) || target.username || target.password || !["www.aivideosugc.com", "aivideosugc.com", "aidreamcapes.com", "www.aidreamcapes.com"].includes(target.hostname)) return card.href;
  const mediaPath = workspaceMediaRoutePath(card.kind, card.publicSlug);
  if (mediaPath) return mediaPath;
  const sceneRouteSlug = workspaceSceneRouteSlug(source, card.sceneSlug);
  if (sceneRouteSlug) return `/app/create/scene/${sceneRouteSlug}`;
  // Fixed tool paths carry only tool/template; the case data (prompt, scene,
  // aspect, duration) must reach the workspace through the server-side preset
  // wrapper, so both the legacy query form and the static tool path collapse
  // into the same opaque identity link.
  const toolPathMatch = target.pathname.match(/^\/app\/create\/tool\/([a-z0-9][a-z0-9-]{0,60})(?:\/([a-z0-9][a-z0-9-]{0,40}))?$/);
  const isCreateEntry = target.pathname === "/app/create" || Boolean(toolPathMatch);
  if (!isCreateEntry) return card.href;
  const query = new URLSearchParams({ source, preset: pickerPresetId(card) });
  return `/app/create?${query.toString()}`;
}

export function presetRequestFromQuery(query: Record<string, string | string[] | undefined>): WorkspacePresetRequest | undefined {
  const sourcePage = presetSourcePage(query.source);
  const presetId = typeof query.preset === "string" && /^p_[a-f0-9]{24}$/.test(query.preset) ? query.preset : undefined;
  return sourcePage && presetId ? { sourcePage, presetId } : undefined;
}
