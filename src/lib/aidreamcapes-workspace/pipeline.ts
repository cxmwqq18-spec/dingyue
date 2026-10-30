import { CAMERA_FRAGMENTS, FRAMING_FRAGMENTS, STYLE_FRAGMENTS, WORKSPACE_ASPECTS, WORKSPACE_DURATIONS, WORKSPACE_LANGUAGES, sceneSchema } from "./catalogs";
import { WorkspaceError, WORKSPACE_PROMPT_MAX_LENGTH, type ActorAsset, type ActorGender, type ActorVoiceSnapshot, type ModelCapability, type RefKind, type SceneId, type ShotSnapshot, type Storyboard, type StoryboardShot, type TaskInput, type VideoLanguage } from "./types";
import { assertWorkspaceCapabilitySupport } from "./capabilities";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const genderPattern = (gender: ActorGender) => gender === "female"
  ? { expected: /\b(female|woman|women|girl|feminine)\b/i, opposite: /\b(male|man|men|boy|masculine)\b/i }
  : { expected: /\b(male|man|men|boy|masculine)\b/i, opposite: /\b(female|woman|women|girl|feminine)\b/i };

export function assertActorVoiceSnapshot(snapshot: ActorVoiceSnapshot | undefined, expectedActorId?: string): ActorVoiceSnapshot {
  if (!snapshot) throw new WorkspaceError("workspace_actor_voice_snapshot_missing", 409);
  if (!snapshot.actorId || !snapshot.actorName || !["female", "male"].includes(snapshot.actorGender) || !snapshot.profile) {
    throw new WorkspaceError("workspace_actor_voice_snapshot_invalid", 400, { actorId: snapshot.actorId });
  }
  if (expectedActorId && snapshot.actorId !== expectedActorId) {
    throw new WorkspaceError("workspace_actor_voice_snapshot_actor_mismatch", 409, { expectedActorId, actorId: snapshot.actorId });
  }
  if (snapshot.profile.gender !== snapshot.actorGender) {
    throw new WorkspaceError("workspace_actor_voice_gender_mismatch", 400, { actorId: snapshot.actorId, actorGender: snapshot.actorGender, voiceGender: snapshot.profile.gender });
  }
  const expectedVoiceId = `mock:aidreamcapes:${snapshot.actorGender}:${snapshot.actorId}:v1`;
  if (snapshot.voiceId !== expectedVoiceId) {
    const mappedGender = /^mock:aidreamcapes:(female|male):/.exec(snapshot.voiceId)?.[1];
    if (mappedGender && mappedGender !== snapshot.actorGender) {
      throw new WorkspaceError("workspace_actor_voice_gender_mismatch", 400, { actorId: snapshot.actorId, actorGender: snapshot.actorGender, voiceGender: mappedGender });
    }
    throw new WorkspaceError("workspace_actor_voice_mapping_invalid", 400, { actorId: snapshot.actorId });
  }
  const profileText = `${snapshot.profile.label ?? ""} ${snapshot.profile.vocalProfile ?? ""}`;
  const genderWords = genderPattern(snapshot.actorGender);
  if (genderWords.opposite.test(profileText)) {
    throw new WorkspaceError("workspace_actor_voice_gender_mismatch", 400, { actorId: snapshot.actorId, actorGender: snapshot.actorGender });
  }
  if (!genderWords.expected.test(snapshot.profile.vocalProfile)) {
    throw new WorkspaceError("workspace_actor_voice_profile_gender_missing", 400, { actorId: snapshot.actorId, actorGender: snapshot.actorGender });
  }
  if (typeof snapshot.profile.timbre !== "string" || !snapshot.profile.timbre.trim() ||
      typeof snapshot.profile.vocalProfile !== "string" || !snapshot.profile.vocalProfile.trim() ||
      typeof snapshot.profile.refAudio !== "string" || !Number.isFinite(snapshot.profile.speed) || !Number.isFinite(snapshot.profile.pitch) ||
      !WORKSPACE_LANGUAGES.some((language) => language.value === snapshot.profile.language) ||
      (snapshot.profile.languages !== undefined && (!Array.isArray(snapshot.profile.languages) || snapshot.profile.languages.some((language) => !WORKSPACE_LANGUAGES.some((entry) => entry.value === language))))) {
    throw new WorkspaceError("workspace_actor_voice_mapping_invalid", 400, { actorId: snapshot.actorId });
  }
  return structuredClone(snapshot);
}

export function createActorVoiceSnapshot(actor: ActorAsset | undefined): ActorVoiceSnapshot {
  if (!actor) throw new WorkspaceError("workspace_actor_selection_required");
  if (!actor.voice || typeof actor.voice.voiceId !== "string" || !actor.voice.voiceId.trim()) {
    throw new WorkspaceError("workspace_actor_voice_mapping_missing", 422, { actorId: actor.actorId });
  }
  const { voiceId, ...profile } = actor.voice;
  return assertActorVoiceSnapshot({ actorId: actor.actorId, actorName: actor.name, actorGender: actor.gender, voiceId, profile }, actor.actorId);
}

export interface MockVoiceProviderRequest {
  contract: "aidreamcapes.mock-voice.v1"; provider: "mock-only"; actorId: string; voiceId: string;
  gender: ActorGender; language: VideoLanguage; text: string; profile: ActorVoiceSnapshot["profile"];
}
export function buildMockVoiceProviderRequest(snapshot: ActorVoiceSnapshot, value: string, language: VideoLanguage): MockVoiceProviderRequest {
  const voice = assertActorVoiceSnapshot(snapshot);
  if (typeof value !== "string" || !value.trim()) throw new WorkspaceError("workspace_voiceover_required");
  if (!(voice.profile.languages ?? [voice.profile.language]).includes(language)) throw new WorkspaceError("workspace_actor_language_unsupported");
  return { contract: "aidreamcapes.mock-voice.v1", provider: "mock-only", actorId: voice.actorId, voiceId: voice.voiceId,
    gender: voice.actorGender, language, text: value, profile: structuredClone(voice.profile) };
}

export function validateTaskInput(sceneId: SceneId, input: TaskInput, actors: ActorAsset[] = [], complete = true, modelCapabilities?: ModelCapability[]): TaskInput {
  const schema = sceneSchema(sceneId);
  if (!input || typeof input !== "object" || !input.options || !input.fields || !input.images) throw new WorkspaceError("workspace_input_invalid");
  if (input.creativeDirection !== undefined && (typeof input.creativeDirection !== "string" || input.creativeDirection.length > WORKSPACE_PROMPT_MAX_LENGTH)) throw new WorkspaceError("workspace_creative_direction_invalid");
  if (!(WORKSPACE_DURATIONS as readonly number[]).includes(input.options.duration)) throw new WorkspaceError("workspace_duration_invalid");
  if (input.options.subtitleStyle !== undefined && !["classic", "bold", "minimal"].includes(input.options.subtitleStyle)) throw new WorkspaceError("workspace_subtitle_style_invalid");
  if (!(WORKSPACE_ASPECTS as readonly string[]).includes(input.options.aspect)) throw new WorkspaceError("workspace_aspect_invalid");
  if (input.options.resolution !== undefined && !/^\d{3,4}p$/.test(input.options.resolution)) throw new WorkspaceError("workspace_resolution_invalid");
  if (input.options.resolution && modelCapabilities) {
    const selected = input.modelId ? modelCapabilities.find((model) => model.id === input.modelId) : undefined;
    if (selected && selected.resolutions.length && !selected.resolutions.includes(input.options.resolution)) throw new WorkspaceError("workspace_resolution_unsupported");
  }
  if (modelCapabilities && (input.referenceVideos?.length || input.referenceAudios?.length)) {
    const selected = input.modelId ? modelCapabilities.find((model) => model.id === input.modelId) : modelCapabilities.find((model) => model.available);
    if (selected) {
      if ((input.referenceVideos?.length ?? 0) > selected.videoReferenceMax) throw new WorkspaceError("workspace_video_reference_unsupported");
      if ((input.referenceAudios?.length ?? 0) > selected.audioReferenceMax) throw new WorkspaceError("workspace_audio_reference_unsupported");
    }
  }
  if (!WORKSPACE_LANGUAGES.some((language) => language.value === input.options.language)) throw new WorkspaceError("workspace_language_invalid");
  if (modelCapabilities) assertWorkspaceCapabilitySupport({ sceneId, input, models: modelCapabilities });
  if (!schema.styleOptions.some((style) => style.value === input.options.style)) throw new WorkspaceError("workspace_style_invalid");
  if (typeof input.options.subtitle !== "boolean") throw new WorkspaceError("workspace_subtitle_invalid");
  if (input.musicUrl !== undefined && (typeof input.musicUrl !== "string" || input.musicUrl.length > 2048)) throw new WorkspaceError("workspace_music_url_invalid");
  if (!schema.needsActor && input.actorId) throw new WorkspaceError("workspace_scene_has_no_actor");
  const selectedActor = schema.needsActor && input.actorId ? actors.find((actor) => actor.actorId === input.actorId) : undefined;
  if (schema.needsActor && input.actorId) {
    const voice = createActorVoiceSnapshot(selectedActor);
    if (!(voice.profile.languages ?? [voice.profile.language]).includes(input.options.language)) throw new WorkspaceError("workspace_actor_language_unsupported");
  }
  const fields = schema.sections.flatMap((section) => section.fields);
  for (const [key, value] of Object.entries(input.images)) {
    const field = fields.find((field) => field.id === key && field.type === "images");
    // Direct mode has no per-scene storyboard limit; the provider capability
    // already caps the upload control at eight references.
    const imageLimit = input.direct ? 8 : (field?.max ?? 4);
    if (!field || !Array.isArray(value) || value.some((url) => typeof url !== "string" || !url.trim() || url.length > 2048) || value.length > imageLimit) throw new WorkspaceError("workspace_images_invalid", 400, { field: key });
  }
  for (const [key, value] of Object.entries(input.fields)) {
    const field = fields.find((field) => field.id === key && field.type !== "images");
    if (!field || !(typeof value === "string" || (field.type === "tags" && Array.isArray(value) && value.every((item) => typeof item === "string")))) throw new WorkspaceError("workspace_field_invalid", 400, { field: key });
    if ((typeof value === "string" ? value.length : JSON.stringify(value).length) > WORKSPACE_PROMPT_MAX_LENGTH) throw new WorkspaceError("workspace_field_too_long", 400, { field: key });
    if (field.type === "select" && value && !field.options?.some((option) => option.value === value)) throw new WorkspaceError("workspace_field_option_invalid", 400, { field: key });
  }
  if (complete) {
    for (const field of fields.filter((field) => field.required)) {
      const value = field.type === "images" ? input.images[field.id] : input.fields[field.id];
      if (Array.isArray(value) ? value.length < (field.min ?? 1) : !text(value)) throw new WorkspaceError("workspace_required_field_missing", 400, { field: field.id });
    }
    if (schema.needsActor) {
      const actor = selectedActor;
      if (!actor) throw new WorkspaceError("workspace_actor_selection_required");
      if (!actor.gender || !actor.ageRange || !actor.identityPrompt || !actor.imageUrl) throw new WorkspaceError("workspace_actor_incomplete");
    }
  }
  return structuredClone(input);
}
export function speechUnitCount(value: string, language: VideoLanguage): number {
  return ["zh", "ja", "ko"].includes(language) ? Array.from(value.replace(/[\s\p{P}\p{S}]/gu, "")).length : value.trim().split(/\s+/u).filter(Boolean).length;
}
export function referencePool(sceneId: SceneId, input: TaskInput, actors: ActorAsset[] = []): Partial<Record<RefKind, string[]>> {
  const pool: Partial<Record<RefKind, string[]>> = {};
  for (const field of sceneSchema(sceneId).sections.flatMap((section) => section.fields)) {
    if (field.refKind && input.images[field.id]?.length) pool[field.refKind] = [...(pool[field.refKind] ?? []), ...input.images[field.id]];
  }
  const actor = actors.find((actor) => actor.actorId === input.actorId);
  if (actor) pool.actor = [actor.imageUrl];
  return pool;
}
export function resolveShotReferences(args: { sceneId: SceneId; input: TaskInput; shot: ShotSnapshot; actors?: ActorAsset[] }): { kind: RefKind; url: string }[] {
  const schema = sceneSchema(args.sceneId), pool = referencePool(args.sceneId, args.input, args.actors);
  if (new Set(args.shot.refKinds).size !== args.shot.refKinds.length) throw new WorkspaceError("workspace_reference_order_invalid");
  if (schema.needsActor && (args.shot.refKinds[0] !== "actor" || !args.shot.refKinds.includes("product"))) throw new WorkspaceError("workspace_actor_product_references_required");
  return args.shot.refKinds.flatMap((kind) => {
    if (!schema.refImagePolicy.includes(kind)) throw new WorkspaceError("workspace_reference_kind_invalid");
    // Direct prompt mode ships every uploaded image of a reference kind in the
    // order the customer uploaded it. The fused composite is never transported:
    // the actor portrait and the product photos already cover both subjects
    // upstream, so a missing composite is expected and simply skipped.
    if (args.input.direct) {
      if (kind === "composite") return [];
      const available = pool[kind];
      if (!available?.length) throw new WorkspaceError("workspace_reference_missing", 400, { kind });
      return available.map((url) => ({ kind, url }));
    }
    const override = args.shot.refImgs[kind];
    const available = pool[kind];
    // A composite must be supplied by the authenticated composition service, never substituted with text-to-image or another kind.
    if (!available?.length && !(kind === "composite" && override)) throw new WorkspaceError("workspace_reference_missing", 400, { kind });
    if (override && kind !== "composite" && !available?.includes(override)) throw new WorkspaceError("workspace_reference_not_in_task", 400, { kind });
    return [{ kind, url: override ?? available![0] }];
  });
}
export function snapshotShot(shot: ShotSnapshot): ShotSnapshot {
  return structuredClone({ visual: shot.visual, voiceover: shot.voiceover, refKinds: shot.refKinds, refImgs: shot.refImgs,
    firstFrame: shot.firstFrame, lastFrame: shot.lastFrame, actorId: shot.actorId, voiceSnapshot: shot.voiceSnapshot,
    environment: shot.environment, start: shot.start, end: shot.end, duration: shot.duration, camera: shot.camera, framing: shot.framing, lighting: shot.lighting, expression: shot.expression });
}
export function compileShot(args: { sceneId: SceneId; input: TaskInput; shot: StoryboardShot; storyboard: Storyboard; actors?: ActorAsset[]; voiceSnapshot?: ActorVoiceSnapshot }): string {
  const { input, shot, storyboard } = args, schema = sceneSchema(args.sceneId);
  // Direct composer mode sends the customer's prompt verbatim. No template,
  // style fragment, reference label or language sentence is appended. The only
  // backend-only addition is the voice-binding hard spec: when a voice
  // reference audio rides with the task, the upstream model must be told to
  // clone the presenter's voice from it. Never rendered in the frontend prompt.
  if (input.direct) {
    const prompt = text(shot.visual);
    if (!(input.referenceAudios ?? []).some((url) => typeof url === "string" && url)) return prompt;
    return `${prompt}\n\nVoice requirement: the on-camera presenter must speak with the exact voice from the supplied voice reference audio. Clone that speaker's timbre, pitch, accent, pace and speaking style, and deliver every spoken line with this single cloned voice. Do not add a narrator, background music, sound-effect vocals or any other voice.`;
  }
  if (!text(shot.visual) || !text(shot.environment) || !Number.isFinite(shot.duration) || shot.duration <= 0 || Math.abs(shot.end - shot.start - shot.duration) > 0.01) throw new WorkspaceError("workspace_shot_invalid");
  if (storyboard.lang !== input.options.language) throw new WorkspaceError("workspace_language_rewrite_required");
  const style = STYLE_FRAGMENTS[input.options.style];
  if (!style || storyboard.colorGrade !== input.options.style) throw new WorkspaceError("workspace_style_boundary_invalid");
  if (!CAMERA_FRAGMENTS[shot.camera] || !FRAMING_FRAGMENTS[shot.framing]) throw new WorkspaceError("workspace_shot_style_invalid");
  const pool = referencePool(args.sceneId, input, args.actors);
  // Compile can preview an uncomposed actor shot; execution requires the actual composite.
  const refs = shot.refKinds.filter((kind) => kind !== "composite" || shot.refImgs.composite).map((kind, index) => {
    if (!schema.refImagePolicy.includes(kind) || (!pool[kind]?.length && !(kind === "composite" && shot.refImgs.composite))) throw new WorkspaceError("workspace_reference_missing", 400, { kind });
    return `Image ${index + 1}: ${kind === "actor" ? "the person's identity, face, hair, clothing and real skin texture" : kind === "product" ? "the exact product appearance, shape, colors and structure" : kind === "texture" ? "the uploaded product detail" : "the same actor and product together"}.`;
  });
  if (schema.needsActor && (shot.refKinds[0] !== "actor" || !shot.refKinds.includes("product"))) throw new WorkspaceError("workspace_actor_product_references_required");
  const actorId = shot.actorId ?? input.actorId;
  const actor = args.actors?.find((actor) => actor.actorId === actorId);
  let voice = "";
  if (schema.needsActor) {
    if (shot.actorId && shot.actorId !== input.actorId) throw new WorkspaceError("workspace_actor_change_requires_storyboard", 409);
    if (!actor) throw new WorkspaceError("workspace_actor_selection_required");
    const voiceSnapshot = assertActorVoiceSnapshot(args.voiceSnapshot ?? shot.voiceSnapshot ?? createActorVoiceSnapshot(actor), actorId);
    if (!(voiceSnapshot.profile.languages ?? [voiceSnapshot.profile.language]).includes(input.options.language)) throw new WorkspaceError("workspace_actor_language_unsupported");
    if (!shot.voiceover.trim()) throw new WorkspaceError("workspace_voiceover_required");
    if (speechUnitCount(shot.voiceover, input.options.language) / (["zh", "ja", "ko"].includes(input.options.language) ? 5 : 2.8) > shot.duration * 0.9) throw new WorkspaceError("workspace_voiceover_too_long");
    voice = `Identity: ${actor.identityPrompt}. Voice: ${voiceSnapshot.profile.vocalProfile}; speaking rate ${voiceSnapshot.profile.speed}, pitch ${voiceSnapshot.profile.pitch}. Say exactly {${JSON.stringify(shot.voiceover)}} with synchronized lip movement.`;
  } else if (shot.voiceover.trim()) throw new WorkspaceError("workspace_scene_has_no_voiceover");
  const language = WORKSPACE_LANGUAGES.find((lang) => lang.value === input.options.language)!.label;
  const frames = shot.firstFrame || shot.lastFrame ? "Use the provided first and/or last frame as fixed endpoints and interpolate naturally between them." : CAMERA_FRAGMENTS[shot.camera];
  return [
    `A ${shot.duration}-second ${input.options.aspect} product video. ${style.colorGrade}.`,
    `0–${shot.duration}s. Environment: ${shot.environment}. ${FRAMING_FRAGMENTS[shot.framing]} ${style.lighting}.`,
    shot.visual, frames, shot.expression ? `Performance: ${shot.expression}.` : "", voice,
    `Language: ${language}. Speak and preserve the dialogue in ${language} exactly as supplied, without translation.`,
    ...refs,
    input.options.subtitle && shot.voiceover ? `【${shot.voiceover}】` : "No on-screen subtitles.",
    "(Retain natural environmental sound and subtle product sound effects. No background music.)",
    "Keep the product consistent with the uploaded references. Use physically plausible motion, anatomically correct hands, a single consistent identity, real skin texture and natural expressions. No watermarks or added interface text."
  ].filter(Boolean).join("\n");
}
export function compileStoryboard(args: { sceneId: SceneId; input: TaskInput; storyboard: Storyboard; actors?: ActorAsset[]; voiceSnapshot?: ActorVoiceSnapshot; requireVoiceSnapshot?: boolean }): Storyboard {
  const storyboard = structuredClone(args.storyboard);
  let cursor = 0;
  if (!storyboard.shots.length || storyboard.shots.length > 30 || new Set(storyboard.shots.map((shot) => shot.shotId)).size !== storyboard.shots.length) throw new WorkspaceError("workspace_storyboard_invalid");
  for (const shot of storyboard.shots) {
    if (Math.abs(shot.start - cursor) > 0.01) throw new WorkspaceError("workspace_timeline_discontinuous");
    if (sceneSchema(args.sceneId).needsActor) {
      const actorId = shot.actorId ?? args.input.actorId;
      const actor = args.actors?.find((entry) => entry.actorId === actorId);
      const snapshot = args.voiceSnapshot ?? shot.voiceSnapshot ?? (args.requireVoiceSnapshot ? undefined : actor ? createActorVoiceSnapshot(actor) : undefined);
      shot.voiceSnapshot = assertActorVoiceSnapshot(snapshot, actorId);
    } else {
      shot.voiceSnapshot = undefined;
    }
    shot.prompt = compileShot({ ...args, storyboard, shot, voiceSnapshot: shot.voiceSnapshot }); cursor = shot.end;
  }
  if (Math.abs(cursor - args.input.options.duration) > 0.01) throw new WorkspaceError("workspace_timeline_duration_mismatch");
  return storyboard;
}
