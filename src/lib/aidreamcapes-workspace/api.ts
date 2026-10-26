import "server-only";
import { NextResponse } from "next/server";
import { getCustomerAssetsRelational, toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";
import { WorkspaceError, WORKSPACE_PROMPT_MAX_LENGTH, type TaskInput, type Storyboard, type ActorAsset, type SceneId } from "./types";
import { listActors, type StoredTask } from "./store";
import { compileStoryboard } from "./pipeline";
import { getWorkspaceActors, getWorkspaceCatalog } from "./provider";
import { createHash } from "node:crypto";
import { AIVIDEOSUGC_SITE_ID, type WorkspaceTask } from "./types";
import { customerAssetIdFromDownloadUrl, isBuiltinActorCatalogReference, workspaceAssetHasMedia } from "./asset-contracts";
import { assertWorkspaceSite } from "./catalogs";

export async function catalogForCustomer(siteId: string, customerId?: string, catalogPromise?: ReturnType<typeof getWorkspaceCatalog>) {
  const [catalog, customerActors] = await Promise.all([
    catalogPromise ?? getWorkspaceCatalog(siteId),
    customerId ? listActors(siteId, customerId) : Promise.resolve([]),
  ]);
  catalog.actors.push(...customerActors);
  return catalog;
}

export async function imageTask(customerId: string, body: Record<string, unknown>): Promise<WorkspaceTask> {
  const tools: Record<string, string> = {
    custom: "",
    "white-background": "Isolate the product from the uploaded reference on a clean, uniform pure-white background (RGB 255,255,255). Preserve the actual product's shape, colors, label and visible details.",
    "change-background": "Replace the background of the uploaded product photo using the user's description. Preserve the actual product's appearance and visible details.",
    "lifestyle-photos": "Place the actual uploaded product in a natural lifestyle setting described by the user. Preserve its appearance and visible details. Do not invent product claims.",
    "model-photos": "Create a model presentation of the actual uploaded product using the user's description. Preserve product appearance and details. Do not invent product functionality or claim a specific person's identity.",
  };
  const toolId = body.toolId ?? "custom";
  if (typeof toolId !== "string" || !Object.hasOwn(tools, toolId)) throw new WorkspaceError("image_tool_invalid");
  if (typeof body.prompt !== "string" || body.prompt.length > WORKSPACE_PROMPT_MAX_LENGTH || (toolId === "custom" && !body.prompt.trim())) throw new WorkspaceError("image_prompt_required");
  const urls = body.assetUrls === undefined ? [] : body.assetUrls;
  if (!Array.isArray(urls) || urls.length > 4 || urls.some(url => typeof url !== "string" || url.length > 2048)) throw new WorkspaceError("invalid_images");
  if (!urls.length) throw new WorkspaceError("image_reference_required");
  const aspect = body.aspect ?? "1:1";
  if (!["1:1", "9:16", "16:9"].includes(String(aspect))) throw new WorkspaceError("invalid_aspect");
  const direction = [tools[toolId], body.prompt.trim()].filter(Boolean).join("\n");
  const input: TaskInput = { fields: { detail: direction, toolId }, images: { productImages: urls }, options: { aspect: aspect as TaskInput["options"]["aspect"], duration: 15, style: "natural", language: "en", subtitle: false } };
  await assertOwnedImages(AIVIDEOSUGC_SITE_ID, customerId, input, []);
  const id = createHash("sha256").update(JSON.stringify({ customerId, input })).digest("hex");
  const now = new Date().toISOString();
  return { taskId: `image-${id}`, siteId: AIVIDEOSUGC_SITE_ID, customerId, sceneId: "texture_closeup", title: "Image generation", status: "draft", createdAt: now, updatedAt: now, revision: 1, input, storyboardStale: false, storyboardHistory: [], revisions: [], videoHistory: [] };
}

export function workspaceResponse(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function workspaceFailure(error: unknown) {
  if (error instanceof WorkspaceError) return workspaceResponse({ error: error.code, details: error.details }, error.status);
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "P2022" && String(error).includes("PlatformAiProvider")) return workspaceResponse({
    error: "workspace_provider_runtime_configuration_required",
    message: "Generation is unavailable while the model connection is being updated. You can keep editing your draft.",
  }, 503);
  if (code === "P2010") return workspaceResponse({ error: "workspace_database_unavailable", message: "The video workspace database needs setup or recovery." }, 503);
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  console.error("[aivideosugc-workspace]", error);
  return workspaceResponse({ error: status < 500 && error instanceof Error ? error.message : "workspace_request_failed" }, status);
}
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > 512_000) throw new WorkspaceError("request_too_large", 413);
  try { const value = JSON.parse(text); if (!value || Array.isArray(value) || typeof value !== "object") throw new Error(); return value; }
  catch { throw new WorkspaceError("invalid_json", 400); }
}
export function expectedRevision(request: Request, body?: Record<string, unknown>): number {
  const header = request.headers.get("if-match")?.replace(/^W\//, "").replaceAll('"', "");
  const revision = Number(header || body?.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) throw new WorkspaceError("revision_required", 428);
  return revision;
}
export function parseInput(value: unknown): TaskInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkspaceError("invalid_input");
  const raw = value as Record<string, unknown>;
  if (!raw.images || typeof raw.images !== "object" || Array.isArray(raw.images) || !raw.fields || typeof raw.fields !== "object" || Array.isArray(raw.fields) || !raw.options || typeof raw.options !== "object") throw new WorkspaceError("invalid_input");
  const images: Record<string, string[]> = {};
  for (const [key, urls] of Object.entries(raw.images)) {
    if (!Array.isArray(urls) || urls.length > 12 || urls.some(url => typeof url !== "string" || url.length > 2048)) throw new WorkspaceError("invalid_images");
    images[key] = urls;
  }
  const fields: TaskInput["fields"] = {};
  for (const [key, field] of Object.entries(raw.fields)) {
    if (typeof field === "string" && field.length <= WORKSPACE_PROMPT_MAX_LENGTH) fields[key] = field;
    else if (Array.isArray(field) && field.length <= 30 && field.every(v => typeof v === "string" && v.length <= 200)) fields[key] = field;
    else throw new WorkspaceError("invalid_field");
  }
  const opt = raw.options as TaskInput["options"];
  if (![6, 10, 15, 30].includes(opt.duration) || !["9:16", "1:1", "16:9"].includes(opt.aspect) || !["zh", "en", "es", "pt", "ja", "ko", "th", "vi", "id"].includes(opt.language) || typeof opt.style !== "string" || typeof opt.subtitle !== "boolean" || (opt.subtitleStyle !== undefined && !["classic", "bold", "minimal"].includes(opt.subtitleStyle))) throw new WorkspaceError("invalid_options");
  if (opt.resolution !== undefined && (typeof opt.resolution !== "string" || !/^\d{3,4}p$/.test(opt.resolution))) throw new WorkspaceError("invalid_options");
  const referenceList = (value: unknown, limit: number): string[] | undefined => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.length > limit || value.some(url => typeof url !== "string" || url.length > 2048)) throw new WorkspaceError("invalid_images");
    return value;
  };
  const referenceVideos = referenceList(raw.referenceVideos, 8);
  const referenceAudios = referenceList(raw.referenceAudios, 8);
  const input: TaskInput = { images, fields, options: { duration: opt.duration, aspect: opt.aspect, ...(opt.resolution ? { resolution: opt.resolution } : {}), style: opt.style, language: opt.language, subtitle: opt.subtitle, subtitleStyle: opt.subtitleStyle ?? "classic" }, ...(referenceVideos?.length ? { referenceVideos } : {}), ...(referenceAudios?.length ? { referenceAudios } : {}) };
  if (raw.creativeDirection !== undefined) {
    if (typeof raw.creativeDirection !== "string" || raw.creativeDirection.length > WORKSPACE_PROMPT_MAX_LENGTH) throw new WorkspaceError("invalid_creative_direction");
    input.creativeDirection = raw.creativeDirection.trim();
  }
  if (raw.direct !== undefined) {
    if (typeof raw.direct !== "boolean") throw new WorkspaceError("invalid_input");
    input.direct = raw.direct;
  }
  for (const key of ["actorId", "modelId"] as const) if (raw[key] !== undefined) { if (typeof raw[key] !== "string" || raw[key].length > 2048) throw new WorkspaceError("invalid_input"); input[key] = raw[key]; }
  if (raw.musicUrl !== undefined) { if (typeof raw.musicUrl !== "string" || raw.musicUrl.length > 2048) throw new WorkspaceError("invalid_music_url"); input.musicUrl = raw.musicUrl; }
  return input;
}
export async function assertOwnedImages(siteId: string, customerId: string, input: TaskInput, actors: ActorAsset[], storyboard?: Storyboard) {
  assertWorkspaceSite(siteId);
  const builtinActors = await getWorkspaceActors(siteId);
  const { assets } = await getCustomerAssetsRelational({ siteId, customerId });
  const ownedAssets = assets.filter((asset) => asset.siteId === siteId && asset.customerId === customerId && !asset.deletedAt);
  const findOwnedPreview = (url: string) => ownedAssets.find((asset) =>
    workspaceAssetHasMedia(asset, { siteId, customerId, kind: "image" }) && toThemeRuntimeAssetRelational(asset).previewUrl === url);

  const selectedActor = input.actorId ? actors.find((actor) => actor.actorId === input.actorId) : undefined;
  if (input.actorId && !selectedActor) throw new WorkspaceError("workspace_actor_selection_required", 403);
  if (selectedActor) {
    const builtin = builtinActors.find((actor) => actor.actorId === selectedActor.actorId);
    if (builtin) {
      if (selectedActor.imageUrl !== builtin.imageUrl || selectedActor.voice.refAudio !== builtin.voice.refAudio ||
          !isBuiltinActorCatalogReference(selectedActor.imageUrl, "image", builtinActors) ||
          (selectedActor.voice.refAudio && !isBuiltinActorCatalogReference(selectedActor.voice.refAudio, "audio", builtinActors))) {
        throw new WorkspaceError("workspace_actor_reference_not_owned", 403);
      }
    } else if (!findOwnedPreview(selectedActor.imageUrl) ||
        (selectedActor.voice.refAudio && !ownedAssets.some((asset) => workspaceAssetHasMedia(asset, { siteId, customerId, kind: "audio" }) &&
          toThemeRuntimeAssetRelational(asset).previewUrl === selectedActor.voice.refAudio))) {
      throw new WorkspaceError("workspace_actor_reference_not_owned", 403);
    }
  }

  const inputUrls = Object.values(input.images).flat();
  if (inputUrls.some((url) => typeof url !== "string" || !url || !findOwnedPreview(url))) throw new WorkspaceError("asset_not_owned", 403);
  const storyboardUrls = storyboard?.shots.flatMap((shot) => [
    ...Object.entries(shot.refImgs).map(([kind, url]) => ({ kind, url })),
    ...(shot.firstFrame ? [{ kind: "frame", url: shot.firstFrame }] : []),
    ...(shot.lastFrame ? [{ kind: "frame", url: shot.lastFrame }] : []),
  ]) ?? [];
  if (storyboardUrls.some(({ kind, url }) => {
    if (!url) return true;
    if (kind === "actor" && selectedActor && url === selectedActor.imageUrl &&
        isBuiltinActorCatalogReference(url, "image", builtinActors)) return false;
    return !findOwnedPreview(url);
  })) throw new WorkspaceError("asset_not_owned", 403);

  if (input.musicUrl) {
    const assetId = customerAssetIdFromDownloadUrl(input.musicUrl, { siteId, customerId });
    const asset = assetId ? ownedAssets.find((item) => item.id === assetId) : undefined;
    if (!asset || !workspaceAssetHasMedia(asset, { siteId, customerId, kind: "music" })) throw new WorkspaceError("music_asset_not_owned", 403);
  }
}
export function patchStoryboard(task: StoredTask, value: unknown, actors: ActorAsset[]): Storyboard {
  if (!task.storyboard || !value || typeof value !== "object") throw new WorkspaceError("storyboard_required");
  const candidate = value as Storyboard;
  if (!Array.isArray(candidate.shots) || candidate.shots.length < 1 || candidate.shots.length > 30 || new Set(candidate.shots.map(s => s.shotId)).size !== candidate.shots.length) throw new WorkspaceError("invalid_shots");
  const shots = candidate.shots.map(edit => {
    const old = task.storyboard!.shots.find(s => s.shotId === edit.shotId);
    if (typeof edit.shotId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(edit.shotId)) throw new WorkspaceError("invalid_shot_id");
    // A new/duplicated shot may carry editable input, never claimed videos or
    // historical versions supplied by a browser.
    const next = old ? { ...old } : { ...task.storyboard!.shots[0], shotId: edit.shotId, versions: [], curVer: undefined,
      genStatus: "pending" as const, error: undefined, compositeGenerationJobId: undefined, compositeStatus: undefined, compositeError: undefined };
    for (const key of ["visual", "voiceover", "environment", "camera", "framing", "lighting", "expression"] as const) {
      if (typeof edit[key] !== "string" || edit[key].length > 6000) throw new WorkspaceError("invalid_shot");
      next[key] = edit[key];
    }
    for (const key of ["start", "end", "duration"] as const) { if (!Number.isFinite(edit[key]) || edit[key] < 0 || edit[key] > 30) throw new WorkspaceError("invalid_shot_timing"); next[key] = edit[key]; }
    if (typeof edit.locked !== "boolean" || !Array.isArray(edit.refKinds) || !edit.refImgs || typeof edit.refImgs !== "object" || Array.isArray(edit.refImgs)) throw new WorkspaceError("invalid_shot");
    if (edit.refKinds.some(k => !["actor", "product", "texture", "composite"].includes(k))) throw new WorkspaceError("invalid_reference_kind");
    if (new Set(edit.refKinds).size !== edit.refKinds.length || Object.entries(edit.refImgs).some(([key, url]) => !["actor", "product", "texture", "composite"].includes(key) || typeof url !== "string" || !url || url.length > 2048)) throw new WorkspaceError("invalid_references");
    next.locked = edit.locked; next.refKinds = [...edit.refKinds]; next.refImgs = { ...edit.refImgs };
    // Generated actor/product composites may only be attached by the server.
    if (next.refImgs.composite && next.refImgs.composite !== old?.refImgs.composite) throw new WorkspaceError("composite_generation_required", 403);
    next.firstFrame = typeof edit.firstFrame === "string" ? edit.firstFrame : undefined;
    next.lastFrame = typeof edit.lastFrame === "string" ? edit.lastFrame : undefined;
    return next;
  });
  return compileStoryboard({ sceneId: task.sceneId as SceneId, input: task.input, storyboard: { ...task.storyboard, shots, source: "user_edited" }, actors,
    voiceSnapshot: task.voiceSnapshot, requireVoiceSnapshot: true });
}
