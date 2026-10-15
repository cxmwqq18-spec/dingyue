import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import "../load-runtime-env.mjs";
import { assertDatabaseTarget } from "../lib/database-target.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const siteId = "site_aidreamcapes";
const customerId = "browser-smoke-customer";
const apiPrefix = `/api/sites/${siteId}/aivideosugc`;
const actorFixturePath = path.join(root, "src/lib/aidreamcapes-workspace/actors.json");
const actors = JSON.parse(fs.readFileSync(actorFixturePath, "utf8")).actors;
const apiCalls = [];
const apiUnexpected = [];
const apiHandlerErrors = [];
const disallowedApiRequests = [];
const externalAttempts = [];
const unexpectedExternalAttempts = [];
const blockedExternalFailures = [];
const failedRequests = [];
const applicationConsoleErrors = [];
const devHarnessConsoleMessages = [];
const pageErrors = [];
const htmlFixtureSeams = [];
const tasks = new Map();
const requestCounts = new Map();
const videoPayloads = new Map();
let serverProcess;
let serverDistPath;
let originalTsconfig;
let originalNextEnv;
let browser;
let context;

function count(key) {
  requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1);
}

function sceneFixture(sceneId = "presenter_showcase") {
  if (sceneId === "process_demo") return {
    id: "process_demo", name: "Product demo", summary: "Show how your product works, step by step.",
    tags: ["How to", "Product demo"], needsActor: false, structureField: "steps", productNoun: "product",
    styleDefault: "professional", styleOptions: [{ value: "professional", label: "Professional & clear" }],
    sections: [{ id: "product", label: "Your product", fields: [{ id: "productImages", label: "Product images", hint: "Add a product reference photo.", type: "images", required: true, refKind: "product", min: 1, max: 4 }, { id: "steps", label: "How to use it", hint: "Write the steps.", type: "textarea", required: true }] }],
    refImagePolicy: ["product", "texture"], cover: "product", version: "1",
  };
  if (sceneId === "texture_closeup") return {
    id: "texture_closeup", name: "Product close-up", summary: "Show the product details.", tags: ["Close-up"],
    needsActor: false, structureField: "pace", productNoun: "product", styleDefault: "natural",
    styleOptions: [{ value: "natural", label: "Natural daylight" }],
    sections: [{ id: "product", label: "Your product", fields: [{ id: "productImages", label: "Product images", hint: "Add a product photo.", type: "images", required: true, refKind: "product", min: 1, max: 4 }, { id: "detail", label: "The detail to highlight", hint: "Describe a product detail.", type: "textarea", required: true }] }],
    refImagePolicy: ["product"], cover: "product", version: "1",
  };
  return {
    id: "presenter_showcase", name: "Presenter showcase", summary: "An on-camera creator introduces your product and its benefits.",
    tags: ["Creator", "Product showcase"], needsActor: true, structureField: "occasions", productNoun: "product",
    styleDefault: "relaxed_daily", styleOptions: [{ value: "relaxed_daily", label: "Relaxed & everyday" }],
    sections: [{ id: "product", label: "Your product", fields: [
      { id: "productImages", label: "Product images", hint: "Add product photos.", type: "images", required: true, refKind: "product", min: 1, max: 4 },
      { id: "sellingPoints", label: "Key benefits", hint: "Use facts you can support.", type: "textarea", required: true },
      { id: "occasions", label: "Where it is used", hint: "Add settings.", type: "tags", required: false },
      { id: "tone", label: "Speaking tone", hint: "Choose a tone.", type: "select", required: false, options: [{ value: "natural", label: "Natural" }] },
    ] }],
    refImagePolicy: ["actor", "product", "composite"], cover: "product", version: "1",
  };
}

const catalogFixture = {
  scenes: [sceneFixture("presenter_showcase"), sceneFixture("process_demo"), sceneFixture("texture_closeup")],
  actors,
  models: [{ id: "browser-mock-model", label: "Browser fixture", model: "mock-browser-video", available: false, reason: "workspace_stability_mock_video_dispatch_disabled", durations: [6, 10, 15], aspects: ["9:16", "1:1", "16:9"], nativeSpeech: false, audioReference: false, firstFrame: false, lastFrame: false, multiReference: false, features: { output4k: false, videoExtension: false, actorReplacement: false, advancedShotTools: false } }],
  languages: [{ value: "en", label: "English" }, { value: "zh", label: "Chinese" }],
  aspects: ["9:16", "1:1", "16:9"],
  durations: [6, 10, 15, 30].map((value) => ({ value, label: `${value}s`, credits: null, generationAvailable: false, reason: "workspace_stability_mock_video_dispatch_disabled" })),
  limitations: ["Browser acceptance fixtures disable generation and provider dispatch."],
  composition: { available: false, credits: null, reason: "workspace_stability_mock_image_dispatch_disabled" },
  subtitles: { available: false, reason: "workspace_speech_timing_provider_required" },
  quickStarts: [{ label: "UGC testimonial for your product", sceneId: "presenter_showcase" }],
};

function outputUrl(taskId, kind) {
  return `${apiPrefix}/tasks/${encodeURIComponent(taskId)}/output?kind=${kind}`;
}

function buildTask(body, taskId = `browser-mock-${Date.now()}`) {
  const sceneId = ["presenter_showcase", "process_demo", "texture_closeup"].includes(body.sceneId) ? body.sceneId : "presenter_showcase";
  const postedInput = body.input && typeof body.input === "object" ? body.input : {};
  const postedOptions = postedInput.options && typeof postedInput.options === "object" ? postedInput.options : {};
  const now = new Date().toISOString();
  const shotId = "browser-mock-shot-1";
  const versionId = "browser-mock-version-1";
  const clipUrl = `${apiPrefix}/tasks/${encodeURIComponent(taskId)}/output?kind=clip&shotId=${shotId}&versionId=${versionId}`;
  const oldBoard = {
    scenePlan: { strategy: "single", scenes: ["Product setting"], mainScene: "Product setting", reason: "Mock history fixture." },
    lang: "en", source: "auto", colorGrade: "relaxed_daily", musicGenre: "none", version: "1",
    shots: [],
  };
  const version = {
    vid: versionId, ts: now, prompt: "A simple product presentation using the supplied facts.",
    clipUrl, origin: "auto", status: "done", visual: "A creator presents the product in a bright room.",
    voiceover: "This sample keeps the routine simple.", refKinds: ["actor", "product"], refImgs: {},
    environment: "Bright room", start: 0, end: 6, duration: 6, camera: "static", framing: "medium",
    lighting: "soft daylight", expression: "natural", speechCues: [{ start: 0, end: 1.8, text: "This sample keeps the routine simple." }],
    speechTimingVerified: true, modelId: "browser-mock-model", nativeAudioVerified: true,
  };
  const shot = {
    shotId, start: 0, end: 6, duration: 6, environment: "Bright room",
    visual: version.visual, voiceover: version.voiceover, locked: false,
    refKinds: ["actor", "product"], refImgs: {}, actorId: actors[0]?.actorId,
    camera: "static", framing: "medium", lighting: "soft daylight", expression: "natural",
    genStatus: "done", versions: [version], curVer: versionId, prompt: version.prompt,
  };
  const storyboard = {
    scenePlan: { strategy: "single", scenes: ["Bright room"], mainScene: "Bright room", reason: "Browser fixture." },
    lang: "en", source: "auto", shots: [shot], colorGrade: "relaxed_daily", musicGenre: "none", version: "1",
  };
  const video = {
    renderId: "browser-mock-render-1", storyboardHash: "browser-fixture-hash", status: "done",
    steps: [{ id: "confirm", status: "done" }, { id: "concat", status: "done" }, { id: "subtitles", status: "done" }, { id: "audio", status: "skipped" }],
    clips: [{ shotId, vid: versionId, clipUrl }], finalUrl: outputUrl(taskId, "video"),
    subtitleUrl: outputUrl(taskId, "subtitles"),
    captionLines: [{ start: 0, end: 1.8, text: "This sample keeps the routine simple." }],
    stale: false, createdAt: now, completedAt: now,
  };
  const task = {
    taskId, siteId, customerId, sceneId, title: String(body.title || "Browser mock task"),
    status: "completed", createdAt: now, updatedAt: now, revision: 1,
    input: {
      images: postedInput.images && typeof postedInput.images === "object" ? structuredClone(postedInput.images) : {},
      fields: postedInput.fields && typeof postedInput.fields === "object" ? structuredClone(postedInput.fields) : {},
      options: { duration: 15, aspect: "9:16", style: sceneFixture(sceneId).styleDefault, language: "en", subtitleStyle: "classic", ...postedOptions, subtitle: false },
      ...(typeof postedInput.actorId === "string" ? { actorId: postedInput.actorId } : {}),
      ...(typeof postedInput.modelId === "string" ? { modelId: postedInput.modelId } : {}),
    },
    storyboard, storyboardStale: false, storyboardHistory: [oldBoard],
    revisions: [], video, videoHistory: [{ ...structuredClone(video), renderId: "browser-mock-render-previous" }],
    captionEdits: { renderId: video.renderId, lines: structuredClone(video.captionLines), updatedAt: now },
  };
  tasks.set(taskId, task);
  return task;
}

function jsonResult(route, value, status = 200) {
  return route.fulfill({ status, contentType: "application/json; charset=utf-8", body: JSON.stringify(value), headers: { "cache-control": "no-store" } });
}

async function downloadFromVisibleLink(page, link, filename) {
  await link.evaluate((anchor, suggestedName) => {
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      window.__aivideosugcSmokeDownload = null;
      void fetch(anchor.href, { credentials: "same-origin", cache: "no-store" }).then(async (response) => {
        const blob = await response.blob();
        window.__aivideosugcSmokeDownload = { status: response.status, contentType: response.headers.get("content-type"), size: blob.size };
        if (!response.ok) throw new Error(`Mock output request failed with ${response.status}`);
        const objectUrl = URL.createObjectURL(blob);
        const download = document.createElement("a");
        download.href = objectUrl;
        download.download = suggestedName;
        download.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }).catch((error) => {
        window.__aivideosugcSmokeDownload = { error: error instanceof Error ? error.message : String(error) };
      });
    }, { once: true });
  }, filename);
  const downloadPromise = page.waitForEvent("download");
  await link.click();
  const download = await downloadPromise;
  const response = await page.evaluate(() => window.__aivideosugcSmokeDownload);
  assert.equal(response?.error, undefined, response?.error);
  assert.equal(response?.status, 200, "Visible download link resolves through the mocked output API.");
  return { download, response };
}

function mockTaskApi(route, relativePath) {
  const request = route.request();
  const method = request.method();
  const url = new URL(request.url());
  const key = `${method} ${relativePath}${url.search}`;
  apiCalls.push(key);
  count(key);
  const body = (() => {
    try { return request.postDataJSON(); } catch { return {}; }
  })();

  if (relativePath === "/catalog" && method === "GET") return jsonResult(route, { catalog: catalogFixture });
  if (relativePath === "/actors" && method === "GET") return jsonResult(route, { actors });
  if (relativePath === "/music" && method === "GET") return jsonResult(route, { tracks: [] });
  if (relativePath === "/tasks" && method === "GET") return jsonResult(route, { tasks: [...tasks.values()].map((task) => structuredClone(task)) });
  if (relativePath === "/tasks" && method === "POST") {
    assert.equal(request.headers()["idempotency-key"]?.length > 0, true, "Task creation includes an idempotency key.");
    const task = buildTask(body);
    return jsonResult(route, { task }, 201);
  }
  if (relativePath === "/balance" && method === "GET") return jsonResult(route, { customerBalance: { balance: 1250, reserved: 0 } });

  const taskMatch = relativePath.match(/^\/tasks\/([^/]+)(?:\/(.*))?$/);
  if (taskMatch) {
    const taskId = decodeURIComponent(taskMatch[1]);
    const suffix = taskMatch[2] ?? "";
    const task = tasks.get(taskId);
    if (suffix === "output" && method === "GET") {
      const kind = url.searchParams.get("kind");
      if (kind === "subtitles") return route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", headers: { "content-disposition": 'attachment; filename="browser-mock-captions.srt"' }, body: "1\n00:00:00,000 --> 00:00:01,800\nThis sample keeps the routine simple.\n" });
      if (kind === "video" || kind === "clip") {
        const payload = videoPayloads.get("mp4");
        const disposition = request.resourceType() === "media" ? "inline" : 'attachment; filename="browser-mock-video.mp4"';
        const range = request.headers().range?.match(/^bytes=(\d+)-(\d*)$/);
        if (range) {
          const start = Number(range[1]);
          const end = range[2] ? Math.min(Number(range[2]), payload.length - 1) : payload.length - 1;
          if (start >= payload.length || end < start) return route.fulfill({ status: 416, headers: { "content-range": `bytes */${payload.length}` } });
          return route.fulfill({ status: 206, contentType: "video/mp4", body: payload.subarray(start, end + 1), headers: {
            "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${payload.length}`,
            "content-length": String(end - start + 1), "content-disposition": disposition,
          } });
        }
        return route.fulfill({ status: 200, contentType: "video/mp4", body: payload, headers: {
          "accept-ranges": "bytes", "content-length": String(payload.length),
          "content-disposition": disposition,
        } });
      }
      apiUnexpected.push(key);
      return jsonResult(route, { error: "unexpected_output_kind" }, 400);
    }
    if (!task) return jsonResult(route, { error: "task_not_found" }, 404);
    if (!suffix && method === "GET") return jsonResult(route, { task: structuredClone(task) });
    if (!suffix && method === "PATCH") {
      if (body.title !== undefined) task.title = body.title;
      if (body.input !== undefined) task.input = { ...task.input, ...structuredClone(body.input) };
      if (body.storyboard !== undefined) task.storyboard = structuredClone(body.storyboard);
      task.revision += 1;
      task.updatedAt = new Date().toISOString();
      return jsonResult(route, { task: structuredClone(task) });
    }
    if (suffix === "captions" && method === "GET") return jsonResult(route, {
      taskId, revision: task.revision,
      renderId: task.captionEdits?.renderId ?? task.video?.renderId,
      lines: structuredClone(task.captionEdits?.lines ?? task.video?.captionLines ?? []),
      edited: Boolean(task.captionEdits),
    });
    if (suffix === "captions" && method === "PATCH") {
      task.captionEdits = { renderId: task.video?.renderId ?? "browser-mock-render-1", lines: structuredClone(body.lines ?? []), updatedAt: new Date().toISOString() };
      task.revision += 1;
      return jsonResult(route, { taskId, revision: task.revision, renderId: task.captionEdits.renderId, lines: task.captionEdits.lines, edited: true });
    }
    if (suffix.startsWith("quote") && method === "GET") return jsonResult(route, { quote: { available: false, credits: null, currency: "credits", reason: "workspace_stability_mock_video_dispatch_disabled" } });
  }

  apiUnexpected.push(key);
  return jsonResult(route, { error: "browser_smoke_unhandled_mock_api" }, 501);
}

function isLoopbackUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function seedPageFixture(html, url) {
  const unsetCustomer = String.raw`\"customer\":\"$undefined\"`;
  const fixtureCustomer = String.raw`\"customer\":{\"id\":\"browser-smoke-customer\",\"name\":\"Browser Smoke\",\"email\":\"browser-smoke@example.invalid\"}`;
  if (!html.includes(unsetCustomer)) {
    const hasLogin = html.includes("Log In") || html.includes("Log in to create a saved task");
    if (hasLogin) throw new Error(`Could not inject the browser-only customer fixture into ${new URL(url).pathname}; app-auth component seam changed.`);
    htmlFixtureSeams.push({ path: new URL(url).pathname, customer: "existing-session" });
    return html;
  }
  html = html.replace(unsetCustomer, fixtureCustomer);
  let headerPatched = false;
  html = html.replace(/<a class="([^"]*workspace_button[^"]*)" href="[^"]*\/login[^\"]*">Log In<\/a>/, (_match, cssClass) => {
    headerPatched = true;
    return `<button class="${cssClass}">Log Out</button>`;
  });
  html = html.replace(/<h1>Good Evening<\/h1>/g, "<h1>Hello, Browser</h1>");
  html = html.replace(/<div class="[^"]*workspace_notice[^"]*"><a href="[^"]*\/login[^\"]*">Log in<\/a> to create a saved task and start making your video\.<\/div>/, "");
  assert.equal(headerPatched, true, "The fixture customer is reflected in the server-rendered sign-in control.");
  htmlFixtureSeams.push({ path: new URL(url).pathname, customer: "browser-smoke-customer" });
  return html;
}

async function unusedLocalPort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function startApp() {
  const environment = {
    ...process.env,
    DINGYUE_ENV: "local",
    DATABASE_TARGET: "local",
    PERSISTENCE_BACKEND: "postgres",
    PLATFORM_STATE_POSTGRES_STRICT: "1",
    STOREFRONT_PATH_MODE_READS: "database",
    AIVIDEOSUGC_STABILITY_MODE: "mock",
    AIVIDEOSUGC_TEXT_PROVIDER_ID: "browser-smoke-provider-blocked",
    AIVIDEOSUGC_ASR_PROVIDER_ID: "browser-smoke-provider-blocked",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  environment.DATABASE_URL ||= "postgresql://local:local@127.0.0.1:15433/dingyue_local";
  assertDatabaseTarget({ expectedTarget: "local", env: environment });

  const port = await unusedLocalPort();
  const distName = `.next-aivideosugc-browser-smoke-${process.pid}`;
  serverDistPath = path.join(root, distName);
  assert.equal(fs.existsSync(serverDistPath), false, `Refusing to reuse an existing test build directory: ${distName}`);
  originalTsconfig = fs.readFileSync(path.join(root, "tsconfig.json"));
  originalNextEnv = fs.readFileSync(path.join(root, "next-env.d.ts"));
  environment.NEXT_DIST_DIR = distName;
  const nextBin = path.join(root, "node_modules/next/dist/bin/next");
  assert.equal(fs.existsSync(nextBin), true, "Next.js is installed in this checkout.");
  serverProcess = spawn(process.execPath, [nextBin, "dev", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: root,
    env: environment,
    stdio: "inherit",
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 120_000;
  let lastError = "server did not respond";
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) throw new Error(`Next.js exited during startup with code ${serverProcess.exitCode}.`);
    try {
      const response = await fetch(`${baseUrl}/site/aidreamcapes/app/create?view=agent`, { signal: AbortSignal.timeout(5_000) });
      if (response.status === 200 && (response.headers.get("content-type") ?? "").includes("text/html")) return baseUrl;
      lastError = `startup response status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error(`Aidreamcapes local app did not start within 120s (${lastError}).`);
}

async function stopApp() {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => serverProcess.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
    if (serverProcess.exitCode === null) serverProcess.kill("SIGKILL");
  }
  if (serverDistPath && fs.existsSync(serverDistPath)) fs.rmSync(serverDistPath, { recursive: true, force: true });
  if (originalTsconfig) {
    const tsconfigPath = path.join(root, "tsconfig.json");
    const currentText = fs.readFileSync(tsconfigPath);
    if (!currentText.equals(originalTsconfig)) {
      const original = JSON.parse(originalTsconfig.toString("utf8"));
      const current = JSON.parse(currentText.toString("utf8"));
      const tempTypeInclude = `${path.basename(serverDistPath ?? "")}/types/**/*.ts`;
      const clean = structuredClone(current);
      clean.include = (clean.include ?? []).filter((entry) => entry !== tempTypeInclude);
      const normalize = (value) => {
        if (value && typeof value === "object" && !Array.isArray(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
        if (Array.isArray(value)) return value.map(normalize);
        return value;
      };
      const sortIncludes = (value) => ({ ...value, include: [...(value.include ?? [])].sort() });
      if (JSON.stringify(normalize(sortIncludes(clean))) === JSON.stringify(normalize(sortIncludes(original)))) {
        fs.writeFileSync(tsconfigPath, originalTsconfig);
      }
    }
  }
  if (originalNextEnv) {
    const nextEnvPath = path.join(root, "next-env.d.ts");
    const currentText = fs.readFileSync(nextEnvPath, "utf8");
    const originalText = originalNextEnv.toString("utf8");
    const originalRouteReference = originalText.match(/\/\/\/ <reference path="([^"]+\/types\/routes\.d\.ts)" \/>/)?.[1];
    const generatedRouteReference = `./${path.basename(serverDistPath ?? "")}/types/routes.d.ts`;
    if (originalRouteReference && currentText === originalText.replace(originalRouteReference, generatedRouteReference)) {
      fs.writeFileSync(nextEnvPath, originalNextEnv);
    }
  }
}

async function prepareMockMp4() {
  const ffmpegPath = await import("ffmpeg-static").then((module) => module.default ?? module).catch(() => null);
  if (typeof ffmpegPath !== "string" || !ffmpegPath) throw new Error("The local ffmpeg-static binary is required to create the mock MP4 fixture.");
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-browser-smoke-"));
  const fixturePath = path.join(fixtureDir, "browser-mock.mp4");
  try {
    spawnSync(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=320x180:r=24:d=1", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", fixturePath], { stdio: "pipe", timeout: 20_000 });
    const bytes = fs.readFileSync(fixturePath);
    assert.equal(bytes.subarray(4, 8).toString("ascii"), "ftyp", "Mock video has an MP4 file type box.");
    videoPayloads.set("mp4", bytes);
    return fixtureDir;
  } catch (error) {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    throw new Error(`Unable to create a local mock MP4 without a provider: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  const fixtureDir = await prepareMockMp4();
  let baseUrl = process.env.AIVIDEOSUGC_SMOKE_BASE_URL;
  if (baseUrl) {
    assert.equal(isLoopbackUrl(baseUrl), true, "A configured base URL must be loopback HTTP.");
    baseUrl = new URL(baseUrl).origin;
  } else {
    baseUrl = await startApp();
  }

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, serviceWorkers: "block" });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const value = message.text();
      if (value.includes("ERR_BLOCKED_BY_CLIENT.Inspector")) { devHarnessConsoleMessages.push(value); return; }
      if (value.includes("/_next/webpack-hmr") && value.includes("WebSocket")) { devHarnessConsoleMessages.push(value); return; }
      applicationConsoleErrors.push(value);
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      const record = { url: request.url(), error: request.failure()?.errorText ?? "unknown" };
      if (isLoopbackUrl(request.url())) failedRequests.push(record);
      else blockedExternalFailures.push(record);
    });

    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (!isLoopbackUrl(url.href)) {
        const attempt = { method: request.method(), url: url.href };
        externalAttempts.push(attempt);
        if (!["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname)) unexpectedExternalAttempts.push(attempt);
        await route.abort("blockedbyclient");
        return;
      }

      const siteApiMatch = url.pathname.match(/^\/api\/sites\/([^/]+)\/aivideosugc(?:\/|$)/);
      if (siteApiMatch) {
        if (siteApiMatch[1] !== siteId) {
          disallowedApiRequests.push({ method: request.method(), path: url.pathname });
          await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "workspace_site_not_allowed" }) });
          return;
        }
        const relativePath = url.pathname.slice(apiPrefix.length) || "/";
        try {
          await mockTaskApi(route, relativePath);
        } catch (error) {
          apiHandlerErrors.push({ method: request.method(), path: url.pathname, message: error instanceof Error ? error.message : String(error) });
          await jsonResult(route, { error: "browser_smoke_mock_handler_failed" }, 500);
        }
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        disallowedApiRequests.push({ method: request.method(), path: url.pathname });
        await route.abort("blockedbyclient");
        return;
      }

      if (request.isNavigationRequest() && request.method() === "GET" && url.pathname.startsWith("/site/aidreamcapes/app")) {
        const upstream = await route.fetch();
        const contentType = upstream.headers()["content-type"] ?? "";
        if (contentType.includes("text/html") && upstream.status() === 200) {
          const html = seedPageFixture(await upstream.text(), url.href);
          const headers = { ...upstream.headers() };
          delete headers["content-length"];
          delete headers["content-encoding"];
          delete headers["transfer-encoding"];
          await route.fulfill({ status: upstream.status(), headers, body: html });
          return;
        }
        await route.fulfill({ response: upstream });
        return;
      }

      await route.continue();
    });

    const outputPath = new RegExp(`${apiPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/tasks/[^/]+/output(?:\\?.*)?$`);
    await page.route(outputPath, async (route) => {
      const url = new URL(route.request().url());
      try {
        await mockTaskApi(route, url.pathname.slice(apiPrefix.length));
      } catch (error) {
        apiHandlerErrors.push({ method: route.request().method(), path: url.pathname, message: error instanceof Error ? error.message : String(error) });
        await jsonResult(route, { error: "browser_smoke_mock_handler_failed" }, 500);
      }
    });

    await page.goto(`${baseUrl}/site/aidreamcapes/app/create?view=actors`, { waitUntil: "networkidle", timeout: 120_000 });
    assert.match(new URL(page.url()).pathname, /\/site\/aidreamcapes\/app\/create$/);
    await page.getByRole("heading", { name: "AI Avatars" }).waitFor({ state: "visible" });
    const actorArticles = page.locator("main article");
    assert((await actorArticles.count()) > 0, "Aidreamcapes built-in actors are listed in the existing workspace UI.");
    const allFilter = page.getByRole("group", { name: "Filter avatars by gender" }).getByRole("button", { name: /^All/ });
    const maleFilter = page.getByRole("group", { name: "Filter avatars by gender" }).getByRole("button", { name: /^Men/ });
    await maleFilter.click();
    assert((await actorArticles.count()) > 0, "Gender filtering returns matching actors.");
    await allFilter.click();
    const search = page.getByRole("textbox", { name: "Search actors" });
    await search.fill(actors[0].name);
    assert.equal(await actorArticles.count(), 1, "Accessible actor search returns the matching actor.");
    await search.fill("");

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileWidth = await page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth }));
    assert(mobileWidth.page <= mobileWidth.viewport + 1, `Narrow workspace has no horizontal overflow (${mobileWidth.page}px > ${mobileWidth.viewport}px).`);
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("button", { name: "AI Video Agent" }).click();
    await page.getByRole("heading", { name: "Create your next video" }).waitFor({ state: "visible" });
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.getByRole("button", { name: /Presenter showcase/ }).click();
    await page.getByLabel("Video title").waitFor({ state: "visible" });
    const createdTaskId = [...tasks.keys()][0];
    assert(createdTaskId, "A mocked task was created through the existing workspace UI.");
    assert.equal(requestCounts.get("POST /tasks"), 1, "Exactly one mocked task creation request was made.");

    const actorSave = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes(`${apiPrefix}/tasks/${createdTaskId}`));
    await page.getByRole("button", { name: "Choose avatar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Use this avatar" }).first().click();
    await actorSave;
    const captions = page.getByLabel("Captions");
    const withCaptions = captions.locator('option[value="true"]');
    if (await withCaptions.isDisabled()) {
      await page.getByText("Captions are not available for this connection yet.").waitFor({ state: "visible" });
    } else {
      const captionSave = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes(`${apiPrefix}/tasks/${createdTaskId}`));
      await captions.selectOption("true");
      await page.getByText("Caption style").waitFor({ state: "visible" });
      await captionSave;
      assert(apiCalls.some((call) => call.startsWith(`PATCH /tasks/${createdTaskId}`)), "Caption settings were saved through the mocked task API.");
      assert.equal(tasks.get(createdTaskId).input.options.subtitle, true, "Mock task state records the caption setting.");
    }

    await page.getByRole("button", { name: "Delivery" }).click();
    await page.getByRole("heading", { name: "Your finished video" }).waitFor({ state: "visible" });
    await page.getByRole("link", { name: "Download video" }).waitFor({ state: "visible" });
    await page.getByText("Export script and captions", { exact: true }).click();
    const { download: videoDownload, response: videoResponse } = await downloadFromVisibleLink(page, page.getByRole("link", { name: "Download video" }), "browser-mock-video.mp4");
    assert.match(videoDownload.suggestedFilename(), /browser-mock-video\.mp4$/);
    assert.equal(videoResponse.contentType, "video/mp4");
    const videoPath = await videoDownload.path();
    assert.equal(fs.readFileSync(videoPath).subarray(4, 8).toString("ascii"), "ftyp", "Downloaded mock video is an MP4.");

    const { download: captionDownload, response: captionResponse } = await downloadFromVisibleLink(page, page.getByRole("link", { name: "Captions" }), "browser-mock-captions.srt");
    assert.match(captionDownload.suggestedFilename(), /browser-mock-captions\.srt$/);
    assert.match(captionResponse.contentType, /text\/plain/);
    const captionPath = await captionDownload.path();
    assert.match(fs.readFileSync(captionPath, "utf8"), /00:00:00,000 --> 00:00:01,800[\s\S]*This sample keeps the routine simple\./);

    await page.getByRole("button", { name: "Library", exact: true }).click();
    await page.getByRole("heading", { name: "Your Library" }).waitFor({ state: "visible" });
    await page.getByRole("heading", { name: "Browser mock task" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "View video" }).click();
    await page.getByRole("heading", { name: "Your finished video" }).waitFor({ state: "visible" });
    await page.reload({ waitUntil: "networkidle", timeout: 120_000 });
    await page.getByRole("heading", { name: "Your finished video" }).waitFor({ state: "visible" });
    assert(apiCalls.some((call) => call === `GET /tasks/${createdTaskId}`), "Refresh reloads the mocked task from workspace history.");

    const narrowChecks = await page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth }));
    assert(narrowChecks.page <= narrowChecks.viewport + 1, `Workspace remains within the current viewport (${narrowChecks.page}px > ${narrowChecks.viewport}px).`);
    assert.deepEqual(apiUnexpected, [], "All AIVideosUGC browser API requests matched explicit mock handlers.");
    assert.deepEqual(disallowedApiRequests, [], "No non-Aidreamcapes or non-workspace app API was requested.");
    assert.deepEqual(unexpectedExternalAttempts, [], "No non-local AI, payment, provider or other side-effect request was attempted.");
    assert.deepEqual(failedRequests, [], "Browser requests completed without failures.");
    assert.deepEqual(blockedExternalFailures.length, externalAttempts.length, "Every blocked external request was recorded as an intentional Playwright abort.");
    assert.deepEqual(applicationConsoleErrors, [], "The workspace has no application console errors.");
    assert.deepEqual(pageErrors, [], "Browser has no uncaught page errors.");

    console.log(JSON.stringify({
      result: "passed",
      origin: baseUrl,
      viewportChecks: [{ width: 1440, height: 1000 }, { width: 390, height: 844 }],
      assertions: [
        "Aidreamcapes AI Avatar list, gender filter and accessible search",
        "Narrow viewport navigation without horizontal overflow",
        "Mocked task creation and actor selection through the existing workspace UI",
        "Caption setting save or the app's clear unavailable state",
        "Mocked MP4 and SRT downloads",
        "Library history reload and task refresh",
        "No application console errors, failed local requests, unsafe external requests, or unhandled APIs; blocked font and dev-server messages are reported separately",
      ],
      requestCounts: Object.fromEntries(requestCounts),
      mockedTaskCount: tasks.size,
      fixtureCustomerInjected: htmlFixtureSeams.some((item) => item.customer === customerId),
      externalAttempts,
      blockedExternalFailures,
      devHarnessConsoleMessages,
      failedRequests,
      applicationConsoleErrors,
      pageErrors,
    }, null, 2));
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    await stopApp();
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
}

main().catch(async (error) => {
  console.error(JSON.stringify({
    result: "failed",
    error: error instanceof Error ? error.stack ?? error.message : String(error),
    apiUnexpected,
    apiHandlerErrors,
    apiCalls,
    disallowedApiRequests,
    externalAttempts,
    unexpectedExternalAttempts,
    blockedExternalFailures,
    failedRequests,
    applicationConsoleErrors,
    devHarnessConsoleMessages,
    pageErrors,
    htmlFixtureSeams,
  }, null, 2));
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  await stopApp().catch(() => {});
  process.exitCode = 1;
});
