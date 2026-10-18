import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

// Compile and mount the real client workspace with fixture props. All API calls
// are intercepted below; this smoke has no Next server, DB, account or provider.
const require = createRequire(import.meta.url);
const root = process.cwd();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "aidreamcapes-template-browser-"));
const webpackRuntime = require("next/dist/compiled/webpack/webpack");
webpackRuntime.init();
const webpack = webpackRuntime.webpack;
let server;
let browser;

try {
  await fs.writeFile(path.join(temp, "typescript-loader.cjs"), `const ts = require(${JSON.stringify(require.resolve("typescript"))}); module.exports = function(source) { return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText; };`);
  await fs.writeFile(path.join(temp, "css-loader.cjs"), `const path = require("node:path"); module.exports = function(source) { const prefix = path.basename(this.resourcePath).replace(/\\W/g, "_") + "__"; const names = Object.fromEntries([...source.matchAll(/\\.([a-zA-Z_][\\w-]*)/g)].map(match => [match[1], prefix + match[1]])); const css = source.replace(/\\.([a-zA-Z_][\\w-]*)/g, (_, name) => "." + names[name]); return 'const style = document.createElement("style"); style.textContent = ' + JSON.stringify(css) + '; document.head.appendChild(style); export default ' + JSON.stringify(names); };`);
  await fs.writeFile(path.join(temp, "entry.tsx"), `
    import { createRoot } from "react-dom/client";
    import { AidreamcapesWorkspace } from ${JSON.stringify(path.join(root, "src/components/aidreamcapes-workspace/workspace.tsx"))};
    import { SCENES } from ${JSON.stringify(path.join(root, "src/lib/aidreamcapes-workspace/catalogs.ts"))};
    import actorData from ${JSON.stringify(path.join(root, "src/lib/aidreamcapes-workspace/actors.json"))};
    const params = new URLSearchParams(window.location.search);
    const kind = params.get("kind") === "photo" ? "photo" : "video";
    const customerMode = params.get("customer") === "yes";
    const taskId = params.get("task") || undefined;
    const initialPreset = {
      sourcePage: "/examples", presetId: "p_0123456789abcdef01234567", sourceUpdatedAt: "2026-10-15T00:00:00.000Z",
      title: kind === "video" ? "Canvas Tote Creator Look" : "Canvas Tote Lifestyle Photo",
      kind, prompt: kind === "video" ? "A creator turns the canvas tote toward the camera beside a sunny window." : "A canvas tote on a sunlit wooden table.",
      previewUrl: kind === "video" ? "/media/site_aidreamcapes/template-video.jpg" : "/media/site_aidreamcapes/template-photo.jpg",
      sceneId: "presenter_showcase", aspect: "9:16", duration: 15, imageTool: kind === "photo" ? "lifestyle-photos" : "custom"
    };
    const catalog = {
      scenes: SCENES, actors: actorData.actors,
      models: [{ id: "fixture-video", label: "Fixture video model", model: "fixture-video", available: true, aspects: ["9:16", "1:1"], durations: [15], multiReference: false, nativeSpeech: true }],
      languages: [{ value: "en", label: "English" }], aspects: ["9:16", "1:1"],
      durations: [{ value: 15, label: "15s", generationAvailable: true }], subtitles: { available: false }, quickStarts: []
    };
    window.fixture = { kind, customerMode, initialPreset };
    createRoot(document.getElementById("root")).render(<AidreamcapesWorkspace
      siteId="site_aidreamcapes" basePath="/site/aidreamcapes" initialCatalog={catalog}
      initialView={taskId ? "agent" : kind === "photo" ? "images" : "home"} initialTaskId={taskId} initialPreset={taskId ? undefined : initialPreset}
      presenterStudioEnabled={params.get("templates") === "yes"}
      initialTemplateGallery={params.get("templates") === "yes" ? { categories: [], options: [
        { ...initialPreset, kind: "video", title: "Canvas Tote Creator Look", publicSlug: "canvas-tote-creator-look", categoryIds: [] },
        { ...initialPreset, kind: "photo", title: "Canvas Tote Lifestyle Photo", prompt: "A canvas tote on a sunlit wooden table.", publicSlug: "canvas-tote-lifestyle-photo", imageTool: "lifestyle-photos", categoryIds: [] },
      ] } : undefined}
      customer={customerMode ? { id: "browser-fixture", name: "Browser Fixture", email: "fixture@example.invalid", balance: 100 } : null}
    />);
  `);
  const compiler = webpack({
    mode: "development", target: "web", devtool: false, context: root,
    entry: path.join(temp, "entry.tsx"), output: { path: temp, filename: "bundle.js" },
    resolve: { extensions: [".tsx", ".ts", ".js", ".json"], alias: { "@": path.join(root, "src") }, modules: [path.join(root, "node_modules"), "node_modules"] },
    module: { rules: [
      { test: /\.tsx?$/, use: path.join(temp, "typescript-loader.cjs") },
      { test: /\.css$/, use: path.join(temp, "css-loader.cjs") },
    ] },
    plugins: [new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
    optimization: { minimize: false },
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => {
    compiler.close(() => {});
    if (error || stats.hasErrors()) reject(error || new Error(stats.toString({ all: false, errors: true })));
    else resolve();
  }));
  const bundle = await fs.readFile(path.join(temp, "bundle.js"));
  server = createServer(async (request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "text/javascript"); response.end(bundle); }
    else if (/^\/[A-Za-z0-9_.-]+\.js$/.test(request.url)) {
      try { response.setHeader("Content-Type", "text/javascript"); response.end(await fs.readFile(path.join(temp, request.url.slice(1)))); }
      catch { response.writeHead(404); response.end("Missing fixture chunk"); }
    }
    else if (request.url.startsWith("/api/")) { response.writeHead(501); response.end("Unmocked API request"); }
    else if (request.url.startsWith("/media/")) { response.writeHead(204); response.end(); }
    else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const unexpected = [];
  const apiLog = [];
  let uploadedProductUrl;
  await context.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin !== origin) { unexpected.push(requestUrl.href); return route.abort(); }
    if (!requestUrl.pathname.startsWith("/api/")) return route.continue();
    const method = route.request().method();
    apiLog.push(`${method} ${requestUrl.pathname}`);
    if (requestUrl.pathname.endsWith("/tasks") && method === "GET") return route.fulfill({ json: { tasks: [] } });
    if (requestUrl.pathname.endsWith("/tasks") && method === "POST") {
      const body = route.request().postDataJSON();
      createdTask = {
        ...body, taskId: "fixture-template-task", siteId: "site_aidreamcapes", customerId: "browser-fixture",
        title: body.title || "Canvas Tote Creator Look", revision: 1, status: "draft", createdAt: "2026-10-15T00:00:00.000Z", updatedAt: "2026-10-15T00:00:00.000Z",
        storyboardHistory: [], revisions: [], videoHistory: [], sourceTemplate: contextInitialPreset,
      };
      return route.fulfill({ json: { task: createdTask } });
    }
    if (requestUrl.pathname.endsWith("/tasks/fixture-template-task") && method === "GET") {
      if (!createdTask) return route.fulfill({ status: 404, json: { error: "fixture_task_missing" } });
      return route.fulfill({ json: { task: createdTask } });
    }
    if (requestUrl.pathname.endsWith("/tasks/fixture-template-task") && method === "PATCH") {
      createdTask = { ...createdTask, ...route.request().postDataJSON(), revision: createdTask.revision + 1 };
      return route.fulfill({ json: { task: createdTask } });
    }
    if (requestUrl.pathname.endsWith("/customers/browser-fixture/assets") && method === "POST") {
      uploadedProductUrl = "/media/site_aidreamcapes/product-upload-fixture.png";
      return route.fulfill({ json: { asset: { id: "fixture-product", previewUrl: uploadedProductUrl, label: "user-product", mimeType: "image/png", role: "input" } } });
    }
    if (requestUrl.pathname.endsWith("/balance")) return route.fulfill({ json: { customerBalance: { balance: 100, reserved: 0 } } });
    return route.fulfill({ status: 501, json: { error: "unhandled_fixture" } });
  });
  let createdTask;
  let contextInitialPreset;

  async function openCase(kind, customer) {
    createdTask = undefined;
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/?kind=${kind}&customer=${customer ? "yes" : "no"}`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-testid="workspace-template"]').waitFor();
    const preset = await page.evaluate(() => window.fixture.initialPreset);
    contextInitialPreset = preset;
    assert.equal(await page.locator('[data-testid="workspace-template"] h2').textContent(), preset.title);
    const previewSrc = await page.locator('[data-testid="workspace-template"] img').getAttribute("src");
    assert.equal(previewSrc, preset.previewUrl);
    return { page, errors, preset };
  }

  for (const customer of [false, true]) {
    const { page, errors, preset } = await openCase("video", customer);
    assert.equal(await page.getByLabel("Describe your video idea").inputValue(), preset.prompt);
    assert.equal(await page.getByRole("combobox", { name: "Video scene", exact: true }).inputValue(), preset.sceneId);
    assert.equal(await page.locator('[data-testid="workspace-template"] img').count(), 1, "template preview is displayed without uploading it as a product asset");
    if (!customer) {
      assert.equal(await page.getByLabel("Upload video reference photo").isDisabled(), true);
      assert.equal(await page.getByRole("link", { name: "Log in to add photos", exact: true }).count(), 1);
      await page.getByRole("button", { name: "Continue to video", exact: true }).click();
      await page.getByRole("heading", { name: "Presenter showcase", exact: true }).waitFor();
      assert.equal(await page.getByLabel("Describe your video in one sentence").inputValue(), preset.prompt);
      assert.equal(await page.getByLabel("Upload product photos").isDisabled(), true);
      await page.close();
      continue;
    }
    await page.getByLabel("Describe your video idea").fill("Edited direction: show the canvas handles and lining.");
    await page.getByRole("button", { name: "Continue to video", exact: true }).click();
    await page.getByLabel("Describe your video in one sentence").waitFor();
    assert.equal(await page.getByRole("heading", { name: "Presenter showcase", exact: true }).count(), 1);
    await page.getByLabel("Upload product photos").setInputFiles({ name: "product.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6M9sAAAAASUVORK5CYII=", "base64") });
    await page.getByAltText("Product photo 1").waitFor();
    await page.getByRole("button", { name: "Save draft and open storyboard", exact: true }).click();
    await page.getByText("More details and settings", { exact: true }).click();
    const directionEditor = page.locator('textarea[aria-label="Creative direction"], textarea[aria-label="Additional visual direction"]');
    await directionEditor.waitFor({ timeout: 5000 }).catch(async (error) => {
      const alert = await page.getByRole("alert").allTextContents();
      throw new Error(`Draft editor did not open: ${JSON.stringify({ apiLog, alert, createdTask, screen: (await page.locator("main").innerText()).slice(0, 1200) })}\n${error.message}`);
    });
    assert.equal(createdTask.sceneId, preset.sceneId);
    assert.equal(createdTask.preset.sourcePage, preset.sourcePage);
    assert.equal(createdTask.preset.presetId, preset.presetId);
    assert.equal(createdTask.preset.sourceUpdatedAt, preset.sourceUpdatedAt);
    assert.equal(createdTask.input.creativeDirection, "Edited direction: show the canvas handles and lining.");
    assert.deepEqual(createdTask.input.images.productImages, [uploadedProductUrl], "only the user's uploaded product image may enter task assets");
    assert.equal(Object.hasOwn(createdTask.input.fields, "sellingPoints"), false, "visual direction must not be put in sellingPoints");
    assert.equal(await directionEditor.inputValue(), createdTask.input.creativeDirection);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText("More details and settings", { exact: true }).click();
    await directionEditor.waitFor();
    assert.equal(await page.locator('[data-testid="workspace-template"] h2').textContent(), preset.title, "task reload restores its source template");
    assert.equal(await page.locator('[data-testid="workspace-template"] img').getAttribute("src"), preset.previewUrl);
    assert.deepEqual(errors, []);
    await page.close();
  }

  for (const customer of [false, true]) {
    const { page, errors, preset } = await openCase("photo", customer);
    assert.equal(await page.getByLabel("Describe your image idea").inputValue(), preset.prompt);
    assert.equal(await page.getByRole("combobox", { name: "Image style" }).inputValue(), "lifestyle-photos");
    assert.equal(await page.locator('[data-testid="workspace-template"] img').getAttribute("src"), preset.previewUrl);
    assert.equal(await page.locator("form img").count(), 0, "template preview is not inserted into image assetUrls");
    assert.equal(await page.getByLabel("Upload image reference photo").isDisabled(), !customer);
    assert.deepEqual(errors, []);
    await page.close();
  }

  const pickerPage = await context.newPage();
  await pickerPage.goto(`${origin}/?kind=video&customer=no&templates=yes`, { waitUntil: "networkidle" });
  await pickerPage.getByRole("button", { name: "Choose a template", exact: true }).first().click();
  await pickerPage.getByRole("button", { name: "Use Canvas Tote Lifestyle Photo", exact: true }).click();
  assert.equal(new URL(pickerPage.url()).pathname, "/site/aidreamcapes/images/canvas-tote-lifestyle-photo");
  assert.equal(new URL(pickerPage.url()).search, "", "Image template URLs do not expose internal source or preset IDs.");
  assert.equal(await pickerPage.getByLabel("Describe your image idea").inputValue(), "A canvas tote on a sunlit wooden table.");
  await pickerPage.getByRole("button", { name: "Choose a template", exact: true }).first().click();
  await pickerPage.getByRole("button", { name: "Use Canvas Tote Creator Look", exact: true }).click();
  assert.equal(new URL(pickerPage.url()).pathname, "/site/aidreamcapes/videos/canvas-tote-creator-look");
  assert.equal(new URL(pickerPage.url()).search, "", "Video template URLs do not expose internal source or preset IDs.");
  await pickerPage.close();

  assert.deepEqual(unexpected, [], `unexpected real or cross-origin requests: ${JSON.stringify(unexpected)}`);
  console.log("PASS Aidreamcapes template browser smoke: video/photo guest and signed-in presets, preview and prompt hydration, scene selection, task provenance and reload. All APIs fixture-mocked.");
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await fs.rm(temp, { recursive: true, force: true });
}
