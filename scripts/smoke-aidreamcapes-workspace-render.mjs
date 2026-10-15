import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync, spawnSync } from "node:child_process";
import ts from "typescript";

// These synthetic audiovisual fixtures are strictly temporary test inputs, never customer output or demo media.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aivideosugc-render-test-"));
const previousRoot = process.env.AIVIDEOSUGC_RENDER_ROOT;
process.env.AIVIDEOSUGC_RENDER_ROOT = path.join(temp, "renders");
try {
  const fixture = path.join(temp, "synthetic-test-fixture.mp4");
  execFileSync(process.env.AIVIDEOSUGC_FFMPEG_BIN || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "6", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y", fixture], { timeout: 30_000 });
  const source = path.join(process.cwd(), "src/lib/aidreamcapes-workspace");
  for (const name of ["types", "catalogs", "asset-contracts"]) {
    const result = ts.transpileModule(fs.readFileSync(path.join(source, `${name}.ts`), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    fs.writeFileSync(path.join(temp, `${name}.js`), result.outputText);
  }
  const localRequire = createRequire(path.join(temp, "entry.cjs"));
  const mediaSource = ts.transpileModule(fs.readFileSync(path.join(source, "media-render.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const fixtureModule = { exports: {} };
  const fixtureAsset = { id: "asset_fixture", siteId: "site_aidreamcapes", customerId: "customer_test", mimeType: "video/mp4", role: "output", storageKey: "sites/site_aidreamcapes/customers/customer_test/assets/test-fixture.mp4" };
  const scopedRequire = (id) => {
    if (id === "server-only") return {};
    if (id === "./provider") return { workspaceAsrProvider: () => { throw new Error("No ASR should be needed for subtitles disabled"); } };
    if (id === "./captions") return { confirmedCaptionEdits: () => [] };
    if (id === "./stability") return { isWorkspaceStabilityMockMode: () => false, mockSpeechCues: () => [] };
    if (id === "./mock-runtime") return { mockShotClipUrl: () => "", readMockShotClip: async () => undefined };
    if (id === "./music-catalog") return { assertTaskMusicSelectionRights: async () => undefined };
    if (id === "./music-catalog-preview") return { aidreamcapesMusicPreviewRoot: () => "", MusicPreviewPathError: class extends Error {} };
    if (id === "@/lib/stores/asset-store") return {
      getCustomerAssetRelational: async ({ siteId, customerId, assetId }) => {
        assert.equal(siteId, fixtureAsset.siteId); assert.equal(customerId, fixtureAsset.customerId); assert.equal(assetId, fixtureAsset.id);
        return { asset: fixtureAsset };
      },
      readCustomerAssetFileByStorageKey: async () => ({ asset: fixtureAsset, bytes: fs.readFileSync(fixture), mimeType: "video/mp4" })
    };
    return localRequire(id);
  };
  new Function("require", "module", "exports", mediaSource)(scopedRequire, fixtureModule, fixtureModule.exports);
  const { renderTaskVideo, resolveTaskRenderFile } = fixtureModule.exports;
  const clipUrl = "/api/sites/site_aidreamcapes/customers/customer_test/assets/asset_fixture/download?preview=1";
  const shots = [0, 1, 2].map((index) => {
    const snapshot = { visual: "Synthetic test fixture", voiceover: "", environment: "Test fixture", refKinds: ["product"], refImgs: {}, start: index * 5, end: (index + 1) * 5, duration: 5, camera: "static", framing: "close", lighting: "professional", expression: "" };
    return { ...snapshot, shotId: `shot_${index}`, genStatus: "done", locked: false, prompt: "Test only", curVer: `version_${index}`,
      versions: [{ ...snapshot, vid: `version_${index}`, ts: new Date().toISOString(), prompt: "Test only", clipUrl, origin: "auto", status: "done" }] };
  });
  const task = { taskId: "task_test", siteId: "site_aidreamcapes", customerId: "customer_test", sceneId: "process_demo", title: "Synthetic renderer test", status: "storyboard_ready", revision: 1,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), input: { images: {}, fields: {}, options: { duration: 15, aspect: "9:16", language: "en", style: "professional", subtitle: false } },
    storyboard: { shots, lang: "en", source: "auto", colorGrade: "professional", musicGenre: "none", version: "1", scenePlan: { strategy: "single", scenes: ["Test fixture"], mainScene: "Test fixture", reason: "Test" } },
    storyboardStale: false, storyboardHistory: [], revisions: [], videoHistory: [] };
  await assert.rejects(renderTaskVideo({ task: { ...task, siteId: "site_dreamshoot" } }), /workspace_site_not_allowed/);
  const stale = structuredClone(task); stale.storyboard.shots[0].visual = "Changed after generation";
  await assert.rejects(renderTaskVideo({ task: stale }), /workspace_shot_version_stale/);
  const steps = [];
  const video = await renderTaskVideo({ task, onProgress: (progress) => { steps.push(structuredClone(progress)); } });
  assert.equal(video.status, "done", JSON.stringify(video));
  assert.equal(video.steps[2].status, "skipped"); assert.equal(video.steps[2].reason, "Subtitles are turned off.");
  assert.equal(video.steps[3].status, "done");
  assert(steps.some((progress) => progress.steps[1].status === "run"));
  const output = resolveTaskRenderFile({ ...task, video }, "video");
  assert(output.path.startsWith(temp)); assert.equal(output.contentType, "video/mp4");
  assert.throws(() => resolveTaskRenderFile({ ...task, video }, "subtitles"), /workspace_subtitles_not_available/);
  const inspected = JSON.parse(execFileSync(process.env.AIVIDEOSUGC_FFPROBE_BIN || "ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", output.path], { encoding: "utf8" }));
  const picture = inspected.streams.find((stream) => stream.codec_type === "video");
  assert.equal(picture.width, 720); assert.equal(picture.height, 1280);
  assert(inspected.streams.some((stream) => stream.codec_type === "audio"));
  assert(Math.abs(Number(inspected.format.duration) - 15) < 0.25);
  const analysis = spawnSync(process.env.AIVIDEOSUGC_FFMPEG_BIN || "ffmpeg", ["-hide_banner", "-i", output.path, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8", timeout: 30_000 });
  assert.equal(analysis.status, 0);
  const loudness = /"input_i"\s*:\s*"([\d.-]+)"/.exec(analysis.stderr);
  assert(loudness, "Measure the actual output's integrated loudness");
  assert(Math.abs(Number(loudness[1]) + 16) < 2, `Expected roughly -16 LUFS, received ${loudness[1]}`);
  console.log("PASS: real FFmpeg concat/trim/portrait composition, original audio retained and normalized, secure output, explicit subtitle skip, stale-version and cross-store rejection.");
} finally {
  if (previousRoot === undefined) delete process.env.AIVIDEOSUGC_RENDER_ROOT; else process.env.AIVIDEOSUGC_RENDER_ROOT = previousRoot;
  fs.rmSync(temp, { recursive: true, force: true });
}
