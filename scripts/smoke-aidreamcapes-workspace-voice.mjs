import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const source = path.join(root, "src/lib/aidreamcapes-workspace");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-voice-"));
try {
  for (const name of ["types", "catalogs", "capabilities", "pipeline"]) {
    const result = ts.transpileModule(fs.readFileSync(path.join(source, `${name}.ts`), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    });
    fs.writeFileSync(path.join(temp, `${name}.js`), result.outputText);
  }
  const require = createRequire(path.join(temp, "entry.cjs"));
  const catalogs = require("./catalogs.js");
  const pipeline = require("./pipeline.js");
  const actors = JSON.parse(fs.readFileSync(path.join(source, "actors.json"), "utf8")).actors;
  assert.equal(actors.length, 53, "All existing actor cards remain present");
  assert.equal(new Set(actors.map((actor) => actor.actorId)).size, 53, "Actor IDs remain unique");

  const snapshots = actors.map((actor) => pipeline.createActorVoiceSnapshot(actor));
  assert.equal(new Set(snapshots.map((snapshot) => snapshot.voiceId)).size, 53, "Each actor has a stable mock voice ID");
  for (const snapshot of snapshots) {
    assert.equal(snapshot.profile.gender, snapshot.actorGender);
    assert.equal(snapshot.voiceId, `mock:aidreamcapes:${snapshot.actorGender}:${snapshot.actorId}:v1`);
  }

  const actor = structuredClone(actors.find((entry) => entry.gender === "female"));
  const taskVoiceSnapshot = pipeline.createActorVoiceSnapshot(actor);
  const originalProfile = structuredClone(taskVoiceSnapshot.profile);
  actor.voice.vocalProfile = "A clearly different female voice with a fast pace.";
  const editedCatalogSnapshot = pipeline.createActorVoiceSnapshot(actor);
  assert.notEqual(editedCatalogSnapshot.profile.vocalProfile, originalProfile.vocalProfile);
  assert.deepEqual(taskVoiceSnapshot.profile, originalProfile, "Catalog edits cannot mutate a task snapshot");

  const input = catalogs.defaultTaskInput("presenter_showcase");
  input.actorId = actor.actorId;
  input.images.productImages = ["/product.png"];
  const shot = { shotId: "shot-1", start: 0, end: 15, duration: 15, environment: "A bright room", visual: "The actor presents the product.",
    voiceover: "Meet the product.", locked: false, refKinds: ["actor", "product"], refImgs: {}, actorId: actor.actorId,
    voiceSnapshot: taskVoiceSnapshot, camera: "static", framing: "medium", lighting: "relaxed_daily", expression: "natural",
    genStatus: "pending", versions: [], prompt: "" };
  const storyboard = { scenePlan: { strategy: "single", scenes: ["A bright room"], mainScene: "A bright room", reason: "One setting" },
    lang: "en", source: "auto", shots: [shot], colorGrade: "relaxed_daily", musicGenre: "none", version: "1" };
  const prompt = pipeline.compileShot({ sceneId: "presenter_showcase", input, shot, storyboard, actors: [actor], voiceSnapshot: taskVoiceSnapshot });
  assert(prompt.includes(originalProfile.vocalProfile), "Shot prompt uses the frozen task voice profile");
  assert(!prompt.includes(editedCatalogSnapshot.profile.vocalProfile), "A catalog edit cannot rewrite an old task's voice profile");
  const compiled = pipeline.compileStoryboard({ sceneId: "presenter_showcase", input, storyboard, actors: [actor], voiceSnapshot: taskVoiceSnapshot, requireVoiceSnapshot: true });
  assert.deepEqual(compiled.shots[0].voiceSnapshot, taskVoiceSnapshot, "Storyboard shot keeps the task voice snapshot");

  const request = pipeline.buildMockVoiceProviderRequest(taskVoiceSnapshot, shot.voiceover, "en");
  assert.equal(request.contract, "aidreamcapes.mock-voice.v1");
  assert.equal(request.provider, "mock-only");
  assert.equal(request.voiceId, taskVoiceSnapshot.voiceId);
  assert.deepEqual(request.profile, taskVoiceSnapshot.profile);
  assert.equal(request.text, shot.voiceover);

  const missing = structuredClone(actor);
  missing.voice.voiceId = "";
  assert.throws(() => pipeline.createActorVoiceSnapshot(missing), /workspace_actor_voice_mapping_missing/);
  const mismatched = structuredClone(actor);
  mismatched.voice.gender = "male";
  assert.throws(() => pipeline.createActorVoiceSnapshot(mismatched), /workspace_actor_voice_gender_mismatch/);
  const wrongVoiceIdGender = structuredClone(actor);
  wrongVoiceIdGender.voice.voiceId = `mock:aidreamcapes:male:${actor.actorId}:v1`;
  assert.throws(() => pipeline.createActorVoiceSnapshot(wrongVoiceIdGender), /workspace_actor_voice_gender_mismatch/);

  const storeSource = fs.readFileSync(path.join(source, "store.ts"), "utf8");
  assert.match(storeSource, /createActorVoiceSnapshot\(actors\.find/);
  assert.match(storeSource, /revision: 1, input, voiceSnapshot/);
  assert.match(storeSource, /storyboardStale: false/);
  const runnerSource = fs.readFileSync(path.join(source, "runner.ts"), "utf8");
  assert.match(runnerSource, /voiceSnapshot: voiceSnapshot \? structuredClone\(voiceSnapshot\)/);
  assert.match(runnerSource, /shot\.versions\.push\(\{ \.\.\.shotSnapshot\(shot\)/);

  console.log("Aidreamcapes actor voice snapshot contract passed (53 actors, immutable task/shot bindings, gender validation, mock-only request).");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
