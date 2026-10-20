import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const workspace = path.join(root, "src/lib/aidreamcapes-workspace");
const nativeRequire = createRequire(path.join(root, "package.json"));
const cache = new Map();
const options = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } };

function load(name) {
  if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(workspace, `${name}.ts`);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, options).outputText;
  const fixtureModule = { exports: {} };
  cache.set(name, fixtureModule);
  const scopedRequire = (id) => {
    if (id.startsWith("./")) return load(id.slice(2).replace(/\.ts$/, ""));
    if (id === "server-only") return {};
    return nativeRequire(id);
  };
  new Function("require", "module", "exports", "__filename", "__dirname", output)(scopedRequire, fixtureModule, fixtureModule.exports, filename, path.dirname(filename));
  return fixtureModule.exports;
}

const catalogs = load("catalogs");
const capabilities = load("capabilities");
const pipeline = load("pipeline");
const legacy = capabilities.toWorkspaceModelCapability({
  id: "legacy-veo", label: "Legacy model", modelType: "veo-3.1", maxImagesPerRequest: 1,
});
assert.deepEqual(legacy.durations, [15, 30], "Legacy rows serve the two workspace length tiers");
assert.deepEqual(legacy.aspects, ["9:16", "1:1", "16:9"], "Legacy rows retain the prior workspace aspect defaults");
assert.equal(legacy.nativeSpeech, true, "Legacy native speech keeps its model-name compatibility inference");
assert.deepEqual(legacy.features, { output4k: false, videoExtension: false, actorReplacement: false, advancedShotTools: false }, "Legacy provider rows never infer the planned features");

const configured = capabilities.toWorkspaceModelCapability({
  id: "vertical-only", label: "Vertical only", modelType: "fixture-video", maxImagesPerRequest: 2,
  videoDurations: [10, 6, 10, -1], videoAspectRatios: ["9:16", "unknown", "9:16"], videoNativeSpeech: false,
});
assert.deepEqual(configured.durations, [], "A provider that cannot produce a 15 second shot serves no workspace tier");
const tiered = capabilities.toWorkspaceModelCapability({
  id: "tiered", label: "Tiered", modelType: "fixture-video", maxImagesPerRequest: 1,
  videoDurations: [6, 10, 15], videoAspectRatios: ["9:16", "1:1", "16:9"], videoNativeSpeech: false,
});
assert.deepEqual(tiered.durations, [15, 30], "A 15 second capable provider serves both workspace length tiers");
assert.deepEqual(configured.aspects, ["9:16"], "Unknown aspects are never surfaced as workspace options");
assert.equal(configured.nativeSpeech, false, "An explicit false value overrides legacy model inference");
assert.deepEqual(configured.features, { output4k: false, videoExtension: false, actorReplacement: false, advancedShotTools: false }, "Unrelated provider limits do not imply planned feature support");
const noOutput = capabilities.toWorkspaceModelCapability({
  id: "no-output", label: "No output", modelType: "fixture-video", maxImagesPerRequest: 1,
  videoDurations: [], videoAspectRatios: [], videoNativeSpeech: false,
});
assert.deepEqual(noOutput.durations, [], "An explicit empty duration capability fails closed");
assert.deepEqual(noOutput.aspects, [], "An explicit empty aspect capability fails closed");
const unavailable = capabilities.toWorkspaceModelCapability({
  id: "unavailable-wide", label: "Unavailable wide", modelType: "fixture-video", maxImagesPerRequest: 1,
  videoDurations: [15], videoAspectRatios: ["16:9"], videoNativeSpeech: true,
}, "provider_disabled");
assert.equal(unavailable.available, false);
assert.deepEqual(capabilities.workspaceOutputOptions([configured, unavailable]), {
  aspects: ["9:16"], durations: [],
}, "Unavailable models cannot widen the catalog options");
assert.deepEqual(capabilities.workspaceOutputOptions([tiered]), {
  aspects: ["9:16", "1:1", "16:9"], durations: [15, 30],
}, "A runnable provider offers exactly the two workspace length tiers");
assert.deepEqual(capabilities.workspaceOutputOptions([unavailable]), {
  aspects: ["9:16", "1:1", "16:9"], durations: [15, 30],
}, "No-runnable-provider drafts retain the existing workspace defaults");

const input = catalogs.defaultTaskInput("process_demo");
input.modelId = tiered.id;
input.options.duration = 15;
assert.equal(capabilities.workspaceCapabilityError({ sceneId: "process_demo", input, models: [tiered] }), undefined);
input.options.duration = 30;
assert.equal(capabilities.workspaceCapabilityError({ sceneId: "process_demo", input, models: [tiered] }), undefined, "A 30 second video is planned as two 15 second shots");
const vertical = capabilities.toWorkspaceModelCapability({
  id: "vertical", label: "Vertical", modelType: "fixture-video", maxImagesPerRequest: 1,
  videoDurations: [15], videoAspectRatios: ["9:16"], videoNativeSpeech: false,
});
input.modelId = vertical.id;
input.options.aspect = "16:9";
assert.equal(capabilities.workspaceCapabilityError({ sceneId: "process_demo", input, models: [vertical] }), "workspace_video_aspect_unsupported");
input.modelId = tiered.id;
input.options.aspect = "9:16";
input.modelId = configured.id;
input.options.duration = 15;
assert.equal(capabilities.workspaceCapabilityError({ sceneId: "process_demo", input, models: [configured] }), "workspace_shot_duration_unsupported", "A provider that serves no workspace tier cannot run a clip");
input.modelId = tiered.id;
input.options.duration = 15;
input.modelId = unavailable.id;
assert.equal(capabilities.workspaceCapabilityError({ sceneId: "process_demo", input, models: [tiered, unavailable] }), "workspace_video_provider_unavailable");
input.modelId = undefined;
assert.equal(capabilities.workspaceCapabilityError({ sceneId: "presenter_showcase", input, models: [tiered] }), "workspace_native_speech_unsupported");
assert.equal(capabilities.workspaceCapabilityError({ sceneId: "process_demo", input, models: [unavailable], requireAvailable: true }), "workspace_video_provider_unavailable");
assert.throws(() => pipeline.validateTaskInput("process_demo", input, [], false, [configured]), (error) => error.code === "workspace_shot_duration_unsupported");

const invalidLanguage = catalogs.defaultTaskInput("process_demo");
invalidLanguage.options.language = "fr";
assert.throws(() => pipeline.validateTaskInput("process_demo", invalidLanguage, [], false), (error) => error.code === "workspace_language_invalid");
assert.equal(capabilities.isKnownWorkspaceLanguage("en"), true);
assert.equal(capabilities.isKnownWorkspaceLanguage("fr"), false, "Only the workspace's existing language allowlist is accepted");

console.log("PASS: Aidreamcapes capability catalog and input contracts cover available/unavailable providers, legacy defaults, explicit empty/narrow capabilities, unavailable planned features, stable output/language/speech errors, and language allowlisting.");
