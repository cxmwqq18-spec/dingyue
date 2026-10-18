import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure, jsonBody } from "@/lib/aidreamcapes-workspace/api";
import { createActor, listActors } from "@/lib/aidreamcapes-workspace/store";
import { getCustomerAssetsRelational, toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";
import { getWorkspaceActors } from "@/lib/aidreamcapes-workspace/provider";
import { WORKSPACE_LANGUAGES } from "@/lib/aidreamcapes-workspace/catalogs";
import { workspaceAssetHasMedia } from "@/lib/aidreamcapes-workspace/asset-contracts";
import { WorkspaceError, type ActorAsset, type VideoLanguage } from "@/lib/aidreamcapes-workspace/types";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  try { const { siteId } = await params; const auth = await workspaceAuth(request, siteId); if (!auth.ok) return auth.response; return workspaceResponse({ actors: [...await getWorkspaceActors(siteId), ...await listActors(siteId, auth.current.customer.id)] }); }
  catch (error) { return workspaceFailure(error); }
}
export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params; const auth = await workspaceAuth(request, siteId, true); if (!auth.ok) return auth.response;
    const body = await jsonBody(request);
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 80 || !["male", "female"].includes(String(body.gender)) || typeof body.ageRange !== "string" || !/^\d{2}[-–]\d{2}$/.test(body.ageRange)) throw new WorkspaceError("actor_identity_required");
    const [minimumAge, maximumAge] = body.ageRange.split(/[-–]/).map(Number);
    if (minimumAge < 18 || maximumAge > 90 || minimumAge > maximumAge) throw new WorkspaceError("actor_age_range_invalid");
    if (!Array.isArray(body.languages) || !body.languages.length || body.languages.some(v => !WORKSPACE_LANGUAGES.some(l => l.value === v))) throw new WorkspaceError("actor_language_required");
    const { assets } = await getCustomerAssetsRelational({ siteId, customerId: auth.current.customer.id });
    const image = assets.find(a => a.siteId === siteId && a.customerId === auth.current.customer.id &&
      workspaceAssetHasMedia(a, { siteId, customerId: auth.current.customer.id, kind: "image" }) && toThemeRuntimeAssetRelational(a).previewUrl === body.imageUrl);
    if (!image) throw new WorkspaceError("actor_image_not_owned", 403);
    let refAudio = "";
    if (body.refAudio) {
      const audio = assets.find(a => a.siteId === siteId && a.customerId === auth.current.customer.id &&
        workspaceAssetHasMedia(a, { siteId, customerId: auth.current.customer.id, kind: "audio" }) && toThemeRuntimeAssetRelational(a).previewUrl === body.refAudio);
      if (!audio) throw new WorkspaceError("actor_audio_not_owned", 403);
      refAudio = String(body.refAudio);
    }
    const actorId = `custom-${randomUUID()}`;
    const voice = body.gender === "female"
      ? { timbre: "warm", label: "Warm & friendly", vocalProfile: "A female voice with a warm, friendly tone, medium-slow pace and moderate breathiness." }
      : { timbre: "low", label: "Deep & resonant", vocalProfile: "A low, resonant male voice with a slower pace and clear chest resonance." };
    const actor: ActorAsset = { actorId, name: body.name.trim(), gender: body.gender as ActorAsset["gender"], ageRange: body.ageRange, imageUrl: String(body.imageUrl),
      identityPrompt: `One ${body.gender} adult, age ${body.ageRange}, exactly matching the supplied actor reference's face, hairstyle, clothing and natural skin texture.`,
      voice: { voiceId: `mock:aidreamcapes:${body.gender}:${actorId}:v1`, gender: body.gender as ActorAsset["gender"], timbre: voice.timbre, label: voice.label,
        language: body.languages[0] as VideoLanguage, languages: Array.from(new Set(body.languages)) as VideoLanguage[], vocalProfile: voice.vocalProfile, refAudio, speed: 1, pitch: 0 } };
    return workspaceResponse({ actor: await createActor(siteId, auth.current.customer.id, actor) }, 201);
  } catch (error) { return workspaceFailure(error); }
}
