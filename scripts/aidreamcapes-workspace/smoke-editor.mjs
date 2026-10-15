import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-video-editor-"));
const previous = {
  renderRoot: process.env.AIVIDEOSUGC_RENDER_ROOT,
  stabilityMode: process.env.AIVIDEOSUGC_STABILITY_MODE,
  ffmpeg: process.env.AIVIDEOSUGC_FFMPEG_BIN,
  ffprobe: process.env.AIVIDEOSUGC_FFPROBE_BIN,
  fetch: globalThis.fetch,
};
const renderRoot = path.join(temp, "renders");
const musicFixture = path.join(temp, "music.mp3");
process.env.AIVIDEOSUGC_RENDER_ROOT = renderRoot;
process.env.AIVIDEOSUGC_STABILITY_MODE = "mock";
let externalRequestCount = 0;
let forbiddenServiceCalls = 0;
let storeWriteCount = 0;
globalThis.fetch = async (input) => {
  const value = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const url = new URL(value, "http://localhost");
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return new Response(null, { status: 204 });
  externalRequestCount++;
  throw new Error(`External request blocked by video editor smoke: ${url.origin}`);
};

const root = process.cwd();
const workspaceRoot = path.join(root, "src/lib/aidreamcapes-workspace");
const nativeRequire = createRequire(path.join(root, "package.json"));
const moduleCache = new Map();
const taskStore = new Map();
const clone = (value) => structuredClone(value);
const error = (code, status = 400, details) => Object.assign(new Error(code), { code, status, details });
const persistentStore = {
  async getTask(siteId, customerId, taskId) {
    const current = taskStore.get(taskId);
    if (siteId !== "site_aidreamcapes" || !current || current.siteId !== siteId || current.customerId !== customerId) throw error("task_not_found", 404);
    return clone(current);
  },
  async saveTask(task, expectedRevision) {
    const current = taskStore.get(task.taskId);
    if (!current || current.customerId !== task.customerId || current.revision !== expectedRevision) throw error("revision_conflict", 409);
    const saved = { ...clone(task), revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
    taskStore.set(task.taskId, saved);
    storeWriteCount++;
    return clone(saved);
  },
};
const apiStub = {
  workspaceResponse(value, status = 200) { return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } }); },
  workspaceFailure(caught) { return Response.json({ error: caught?.code || "workspace_request_failed" }, { status: caught?.status || 500 }); },
  async jsonBody(request) { return JSON.parse(await request.text()); },
  expectedRevision(request, body) {
    const header = request.headers.get("if-match")?.replace(/^W\//, "").replaceAll('"', "");
    const revision = Number(header || body?.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) throw error("revision_required", 428);
    return revision;
  },
};
const authStub = {
  async workspaceAuth(request, siteId) {
    if (siteId !== "site_aidreamcapes") return { ok: false, response: Response.json({ error: "workspace_site_not_found" }, { status: 404 }) };
    const customerId = request.headers.get("x-fixture-customer");
    if (!customerId) return { ok: false, response: Response.json({ error: "customer_auth_required" }, { status: 401 }) };
    return { ok: true, current: { customer: { id: customerId, siteId } } };
  },
};

const transpileOptions = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } };
function loadWorkspace(name) {
  if (moduleCache.has(name)) return moduleCache.get(name).exports;
  const filename = path.join(workspaceRoot, `${name}.ts`);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), transpileOptions).outputText;
  const fixtureModule = { exports: {} };
  moduleCache.set(name, fixtureModule);
  const scopedRequire = (id) => {
    if (id === "server-only") return {};
    if (id === "./media-render") {
      return {
        async readClip() { forbiddenServiceCalls++; throw new Error("Unexpected provider asset read in synthetic mock render."); },
        async readMusic() { return fs.readFileSync(musicFixture); },
        async readTaskMusic() { return fs.readFileSync(musicFixture); },
      };
    }
    if (id === "./music-catalog") return { assertTaskMusicSelectionRights: async () => undefined };
    if (["./provider", "./quote", "./runner", "./dispatch", "./ledger"].includes(id)) {
      forbiddenServiceCalls++;
      throw new Error(`Unexpected provider or ledger dependency: ${id}`);
    }
    if (id === "./catalogs") return { assertWorkspaceSite(siteId) { if (siteId !== "site_aidreamcapes") throw error("workspace_site_not_found", 404); } };
    if (id === "./store") return persistentStore;
    if (id === "./api") return apiStub;
    if (id.startsWith("./")) return loadWorkspace(id.slice(2).replace(/\.ts$/, ""));
    return nativeRequire(id);
  };
  new Function("require", "module", "exports", "__filename", "__dirname", output)(scopedRequire, fixtureModule, fixtureModule.exports, filename, path.dirname(filename));
  return fixtureModule.exports;
}

function loadRoute() {
  const filename = path.join(root, "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/edit/route.ts");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), transpileOptions).outputText;
  const fixtureModule = { exports: {} };
  const scopedRequire = (id) => {
    if (id === "server-only") return {};
    if (id === "@/lib/aidreamcapes-workspace/auth") return authStub;
    if (id === "@/lib/aidreamcapes-workspace/api") return apiStub;
    if (id === "@/lib/aidreamcapes-workspace/store") return persistentStore;
    if (id === "@/lib/aidreamcapes-workspace/editor") return loadWorkspace("editor");
    if (id === "@/lib/aidreamcapes-workspace/types") return loadWorkspace("types");
    return nativeRequire(id);
  };
  new Function("require", "module", "exports", "__filename", "__dirname", output)(scopedRequire, fixtureModule, fixtureModule.exports, filename, path.dirname(filename));
  return fixtureModule.exports;
}

function request(method, customerId, body, revision) {
  const url = `http://localhost/api/sites/site_aidreamcapes/aivideosugc/tasks/task_edit/edit`;
  const headers = new Headers({ "x-fixture-customer": customerId });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (revision !== undefined) headers.set("if-match", `"${revision}"`);
  const value = new Request(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  Object.defineProperty(value, "nextUrl", { value: new URL(url) });
  return value;
}

function probe(file) {
  return JSON.parse(execFileSync(process.env.AIVIDEOSUGC_FFPROBE_BIN || "ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { encoding: "utf8", timeout: 20_000 }));
}

try {
  const ffmpeg = nativeRequire("ffmpeg-static");
  if (typeof ffmpeg !== "string" || !ffmpeg) throw new Error("The video editor smoke requires ffmpeg-static.");
  const ffmpegOutput = execFileSync(ffmpeg, ["-hide_banner", "-filters"], { encoding: "utf8", timeout: 15_000 });
  assert.match(ffmpegOutput, /\bdrawtext\s+V->V\b/, "The bundled FFmpeg must support safe drawtext overlays.");
  process.env.AIVIDEOSUGC_FFMPEG_BIN = ffmpeg;
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=48000", "-t", "2", "-c:a", "libmp3lame", "-q:a", "5", "-y", musicFixture], { timeout: 30_000 });

  const mockRuntime = loadWorkspace("mock-runtime");
  const editor = loadWorkspace("editor");
  const route = loadRoute();
  const customerId = "customer_edit_owner";
  const taskId = "task_edit";
  const outputUrl = (kind) => `/api/sites/site_aidreamcapes/aivideosugc/tasks/${taskId}/output?kind=${kind}`;
  const task = {
    taskId,
    siteId: "site_aidreamcapes",
    customerId,
    sceneId: "process_demo",
    title: "Editor synthetic fixture",
    status: "completed",
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
    revision: 7,
    input: { images: {}, fields: {}, musicUrl: "/fixtures/music.mp3", options: { duration: 4, aspect: "16:9", style: "natural", language: "en", subtitle: false, subtitleStyle: "classic" } },
    storyboard: {
      scenePlan: { strategy: "multiple", scenes: ["Fixture A", "Fixture B"], mainScene: "Fixture A", reason: "Synthetic test" },
      lang: "en",
      source: "auto",
      shots: [],
      colorGrade: "natural",
      musicGenre: "none",
      version: "1",
    },
    storyboardStale: false,
    storyboardHistory: [],
    revisions: [],
    videoHistory: [],
  };
  const clips = [];
  for (const [index, shotId] of ["shot_a", "shot_b"].entries()) {
    const vid = `version_${shotId}`;
    const clipUrl = mockRuntime.mockShotClipUrl(task, shotId, vid);
    const snapshot = { visual: `Synthetic shot ${index + 1}`, voiceover: "", refKinds: [], refImgs: {}, environment: "Fixture", start: index * 2, end: index * 2 + 2, duration: 2,
      camera: "static", framing: "medium", lighting: "even", expression: "" };
    const version = { ...clone(snapshot), vid, ts: "2026-10-14T00:00:00.000Z", prompt: "Synthetic", clipUrl, origin: "auto", status: "done", modelId: "aivideosugc-stability-mock", mock: true };
    task.storyboard.shots.push({ ...clone(snapshot), shotId, locked: false, genStatus: "done", curVer: vid, versions: [version], prompt: "Synthetic" });
    clips.push({ shotId, vid, clipUrl });
    await mockRuntime.createMockShotClip(task, shotId, vid, 2);
  }
  const sourceRenderId = "render_source";
  const sourceDirectory = path.join(renderRoot, task.siteId, customerId, taskId, sourceRenderId);
  fs.mkdirSync(sourceDirectory, { recursive: true });
  const sourceFinal = path.join(sourceDirectory, "final.mp4");
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30", "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000", "-t", "4", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y", sourceFinal], { timeout: 30_000 });
  task.video = {
    renderId: sourceRenderId,
    storyboardHash: "synthetic-hash",
    clips,
    status: "done",
    steps: [{ id: "confirm", status: "done" }, { id: "concat", status: "done" }, { id: "subtitles", status: "skipped" }, { id: "audio", status: "done" }],
    finalUrl: outputUrl("video"),
    stale: false,
    mock: true,
    createdAt: "2026-10-14T00:00:00.000Z",
    completedAt: "2026-10-14T00:00:04.000Z",
  };
  taskStore.set(taskId, clone(task));

  const firstEdits = {
    clips: [
      { shotId: "shot_a", inPoint: 0.5, outPoint: 2, speed: 2 },
      { shotId: "shot_b", inPoint: 0.25, outPoint: 1.75, speed: 0.5 },
    ],
    order: ["shot_b", "shot_a"],
    overlay: { text: `Try "Nova": 50% \\ now`, cta: "Shop now & save" },
    audio: { nativeGain: 0.8, musicGain: 0.2, mixMusic: true },
  };
  const compiled = editor.compileVideoEdit(clone(task), firstEdits);
  assert.equal(compiled.duration, 3.75, "Trim and speed math is deterministic.");
  assert.deepEqual(compiled.clips.map((clip) => clip.shotId), ["shot_b", "shot_a"], "The compiler applies clip ordering.");
  assert.equal(compiled.aspect, "16:9");
  assert.equal(compiled.settings.overlay.text, firstEdits.overlay.text, "Special overlay characters remain literal text.");
  assert.equal(compiled.settings.audio.mixMusic, true);
  assert.equal(compiled.settings.audio.musicGain, 0.2);
  assert.throws(() => editor.compileVideoEdit(clone(task), { clips: [{ shotId: "shot_a", inPoint: -0.1 }] }), /workspace_edit_clip_range_invalid/);
  assert.throws(() => editor.compileVideoEdit(clone(task), { clips: [{ shotId: "shot_a", speed: 2.01 }] }), /workspace_edit_speed_invalid/);
  assert.throws(() => editor.compileVideoEdit(clone(task), { order: ["shot_a", "shot_a"] }), /workspace_edit_order_invalid/);
  assert.throws(() => editor.compileVideoEdit(clone(task), { overlay: { text: "x".repeat(141) } }), /workspace_edit_text_invalid/);
  assert.throws(() => editor.compileVideoEdit(clone(task), { overlay: { cta: "bad\nline" } }), /workspace_edit_cta_invalid/);
  assert.throws(() => editor.compileVideoEdit(clone(task), { audio: { nativeGain: 2.1 } }), /workspace_edit_audio_invalid/);
  const withoutMusic = clone(task);
  delete withoutMusic.input.musicUrl;
  assert.throws(() => editor.compileVideoEdit(withoutMusic, { audio: { mixMusic: true } }), /workspace_edit_audio_invalid/);
  const tooLongTask = clone(task);
  for (const shot of tooLongTask.storyboard.shots) shot.versions[0].duration = 20;
  assert.throws(() => editor.compileVideoEdit(tooLongTask, { clips: tooLongTask.storyboard.shots.map((shot) => ({ shotId: shot.shotId, outPoint: 20, speed: 0.5 })) }), /workspace_edit_duration_invalid/);
  assert.throws(() => editor.compileVideoEdit({ ...clone(task), siteId: "site_dreamshoot" }, {}), /workspace_site_not_found/);
  assert.throws(() => editor.editedRenderDirectory({ ...task, customerId: "../other-customer" }, "safe_render"), /workspace_render_identifier_invalid/);
  assert.throws(() => editor.editedRenderDirectory({ ...task, taskId: "../other-task" }, "safe_render"), /workspace_render_identifier_invalid/);

  const routeFirst = await route.PATCH(request("PATCH", customerId, { revision: 7, edits: firstEdits }), { params: Promise.resolve({ siteId: task.siteId, taskId }) });
  assert.equal(routeFirst.status, 200, JSON.stringify(await routeFirst.clone().json()));
  const firstBody = await routeFirst.json();
  const afterFirst = taskStore.get(taskId);
  const firstRender = afterFirst.video;
  assert.equal(firstBody.revision, 8);
  assert.equal(firstBody.duration, 3.75);
  assert.equal(firstBody.aspect, "16:9");
  assert.equal(firstRender.editSettings.order[0], "shot_b");
  assert.equal(firstRender.editSettings.overlay.cta, firstEdits.overlay.cta);
  assert.equal(firstRender.editSettings.audio.nativeGain, 0.8);
  assert.equal(firstRender.editSettings.audio.musicGain, 0.2);
  assert.equal(firstRender.editSettings.audio.mixMusic, true);
  assert.equal(firstRender.sourceRenderId, sourceRenderId);
  assert.notEqual(firstRender.renderId, sourceRenderId);
  assert.deepEqual(afterFirst.videoHistory.map((render) => render.renderId), [sourceRenderId]);
  assert(fs.existsSync(sourceFinal), "The original completed render remains on disk.");
  const firstPath = path.join(renderRoot, task.siteId, customerId, taskId, firstRender.renderId, "final.mp4");
  const firstInfo = probe(firstPath);
  assert.equal(firstInfo.streams.find((stream) => stream.codec_type === "video").width, 1280);
  assert.equal(firstInfo.streams.find((stream) => stream.codec_type === "video").height, 720);
  assert(Math.abs(Number(firstInfo.format.duration) - 3.75) <= 0.12, "Rendered duration matches compiled trim/speed math.");
  assert(firstInfo.streams.some((stream) => stream.codec_type === "audio"), "The local output retains a mixed audio stream.");

  const staleWrite = await route.PATCH(request("PATCH", customerId, { revision: 7, edits: { overlay: { cta: "Stale" } } }), { params: Promise.resolve({ siteId: task.siteId, taskId }) });
  assert.equal(staleWrite.status, 409, "The endpoint rejects stale revisions.");
  const foreignWrite = await route.PATCH(request("PATCH", "customer_other", { revision: 8, edits: { overlay: { cta: "Foreign" } } }), { params: Promise.resolve({ siteId: task.siteId, taskId }) });
  assert.equal(foreignWrite.status, 404, "The endpoint denies a different task owner.");
  assert.equal(taskStore.get(taskId).revision, 8, "Rejected writes leave task state unchanged.");

  const routeSecond = await route.PATCH(request("PATCH", customerId, { revision: 8, edits: { overlay: { cta: "Book today" } } }), { params: Promise.resolve({ siteId: task.siteId, taskId }) });
  assert.equal(routeSecond.status, 200, JSON.stringify(await routeSecond.clone().json()));
  const secondBody = await routeSecond.json();
  const afterSecond = taskStore.get(taskId);
  const secondRender = afterSecond.video;
  assert.equal(secondBody.revision, 9);
  assert.notEqual(secondRender.renderId, firstRender.renderId, "Each edit creates a distinct render version.");
  assert.equal(secondRender.editSettings.overlay.text, firstEdits.overlay.text, "Unchanged persisted settings survive a partial edit.");
  assert.equal(secondRender.editSettings.overlay.cta, "Book today");
  assert.deepEqual(afterSecond.videoHistory.map((render) => render.renderId), [sourceRenderId, firstRender.renderId]);
  assert(fs.existsSync(sourceFinal), "The original source render remains available after repeated edits.");
  assert(fs.existsSync(firstPath), "The prior edited render remains available after repeated edits.");
  const secondPath = path.join(renderRoot, task.siteId, customerId, taskId, secondRender.renderId, "final.mp4");
  const secondInfo = probe(secondPath);
  assert.equal(secondInfo.streams.find((stream) => stream.codec_type === "video").width, 1280);
  assert.equal(secondInfo.streams.find((stream) => stream.codec_type === "video").height, 720);
  assert(Math.abs(Number(secondInfo.format.duration) - 3.75) <= 0.12);

  const getRoute = await route.GET(request("GET", customerId), { params: Promise.resolve({ siteId: task.siteId, taskId }) });
  assert.equal(getRoute.status, 200);
  assert.equal((await getRoute.json()).renderId, secondRender.renderId);
  assert.equal(externalRequestCount, 0, "The edit route made no external HTTP requests.");
  assert.equal(forbiddenServiceCalls, 0, "The edit route did not import or call provider, runner, or ledger services.");
  assert.equal(storeWriteCount, 2, "Only accepted revision-guarded edits wrote the task.");

  console.log("PASS: pure compiler validates trim, ordering, speed, overlay/CTA escaping, audio mix, and duration; the owner-scoped edit endpoint guards revisions and keeps source/history versions.");
  console.log("FFMPEG: synthetic local clips produced distinct 16:9 MP4 versions with measured duration, overlays, and mixed audio.");
  console.log(`COUNTS: ${JSON.stringify({ externalRequestCount, forbiddenServiceCalls, storeWriteCount, renderIds: [sourceRenderId, firstRender.renderId, secondRender.renderId] })}`);
} finally {
  globalThis.fetch = previous.fetch;
  for (const [key, value] of [["AIVIDEOSUGC_RENDER_ROOT", previous.renderRoot], ["AIVIDEOSUGC_STABILITY_MODE", previous.stabilityMode],
    ["AIVIDEOSUGC_FFMPEG_BIN", previous.ffmpeg], ["AIVIDEOSUGC_FFPROBE_BIN", previous.ffprobe]]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(temp, { recursive: true, force: true });
}
