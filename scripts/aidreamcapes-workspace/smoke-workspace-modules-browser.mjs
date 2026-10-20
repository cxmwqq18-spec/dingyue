import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

// Mounts the real client workspace with fixture props and asserts the module
// contracts: photo and video templates stay in their own module, the template
// gallery only offers the current module's templates, the length control
// offers the two workspace tiers, and the settings controls are accessible
// dropdowns instead of native select controls.
const require = createRequire(import.meta.url);
const root = process.cwd();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "aidreamcapes-workspace-modules-"));
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
    const videoPreset = {
      sourcePage: "/templates", presetId: "p_111111111111111111111111", sourceUpdatedAt: "2026-10-20T00:00:00.000Z",
      title: "Canvas Tote Creator Look", kind: "video", prompt: "A creator turns the canvas tote toward the camera.",
      previewUrl: "/media/site_aidreamcapes/template-video.jpg", sceneId: "presenter_showcase", aspect: "9:16", duration: 15, imageTool: "custom"
    };
    const photoPreset = {
      sourcePage: "/templates", presetId: "p_222222222222222222222222", sourceUpdatedAt: "2026-10-20T00:00:00.000Z",
      title: "Canvas Tote Lifestyle Photo", kind: "photo", prompt: "A canvas tote on a sunlit wooden table.",
      previewUrl: "/media/site_aidreamcapes/template-photo.jpg", sceneId: "texture_closeup", aspect: "1:1", duration: 15, imageTool: "lifestyle-photos"
    };
    const catalog = {
      scenes: SCENES, actors: actorData.actors,
      models: [{ id: "fixture-video", label: "Fixture video model", model: "fixture-video", available: true, aspects: ["9:16", "1:1"], durations: [15, 30], multiReference: false, nativeSpeech: true }],
      languages: [{ value: "en", label: "English" }], aspects: ["9:16", "1:1"],
      durations: [{ value: 15, label: "15s", generationAvailable: true }, { value: 30, label: "30s", generationAvailable: true }],
      subtitles: { available: false }, quickStarts: []
    };
    const gallery = {
      categories: [{ id: "photo", label: "Photo templates" }, { id: "video", label: "Video templates" }],
      options: [
        { ...videoPreset, publicSlug: "canvas-tote-creator-look", categoryIds: ["video"], imageAlt: "Canvas Tote Creator Look" },
        { ...photoPreset, publicSlug: "canvas-tote-lifestyle-photo", categoryIds: ["photo"], imageAlt: "Canvas Tote Lifestyle Photo" }
      ]
    };
    createRoot(document.getElementById("root")).render(<AidreamcapesWorkspace
      siteId="site_aidreamcapes" basePath="/site/aidreamcapes" initialCatalog={catalog}
      initialView="home" presenterStudioEnabled={true} initialTemplateGallery={gallery}
      customer={{ id: "browser-fixture", name: "Browser Fixture", email: "fixture@example.invalid", balance: 100 }}
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
  const errors = [];
  await context.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin !== origin) return route.abort();
    if (!requestUrl.pathname.startsWith("/api/")) return route.continue();
    if (requestUrl.pathname.endsWith("/balance")) return route.fulfill({ json: { customerBalance: { balance: 100, reserved: 0 } } });
    if (requestUrl.pathname.endsWith("/tasks") && route.request().method() === "GET") return route.fulfill({ json: { tasks: [] } });
    if (requestUrl.pathname.endsWith("/images")) return route.fulfill({ json: { jobs: [], assets: [] } });
    return route.fulfill({ json: { ok: true } });
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: "networkidle" });

  const summary = page.locator('[data-testid="workspace-template"]');
  assert.equal(await summary.count(), 0, "no template is selected before the customer picks one");

  // The home module is the video module, so the gallery only offers video
  // templates there.
  await page.getByRole("button", { name: "Choose a template", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Choose a product template" });
  await dialog.waitFor();
  assert.equal(await dialog.getByRole("button", { name: "Use Canvas Tote Creator Look" }).count(), 1, "the video module offers the video template");
  assert.equal(await dialog.getByRole("button", { name: "Use Canvas Tote Lifestyle Photo" }).count(), 0, "the video module never offers a photo template");
  await dialog.getByRole("button", { name: "Use Canvas Tote Creator Look" }).click();
  await summary.waitFor();
  assert.equal(await summary.locator("h2").textContent(), "Canvas Tote Creator Look");
  assert.equal(await summary.locator("span").first().textContent(), "Video template");

  // The image module keeps its own template state: the video template must not
  // follow the customer into the image workspace.
  await page.getByRole("link", { name: "AI Image", exact: true }).click();
  await page.getByRole("heading", { name: "AI Image", exact: true }).waitFor();
  assert.equal(await summary.count(), 0, "the video template never appears in the image module");

  await page.getByRole("button", { name: "Choose a template", exact: true }).first().click();
  await dialog.waitFor();
  assert.equal(await dialog.getByRole("button", { name: "Use Canvas Tote Lifestyle Photo" }).count(), 1, "the image module offers the photo template");
  assert.equal(await dialog.getByRole("button", { name: "Use Canvas Tote Creator Look" }).count(), 0, "the image module never offers a video template");
  await dialog.getByRole("button", { name: "Use Canvas Tote Lifestyle Photo" }).click();
  await summary.waitFor();
  assert.equal(await summary.locator("h2").textContent(), "Canvas Tote Lifestyle Photo");
  assert.equal(await summary.locator("span").first().textContent(), "Image template");

  // Each module keeps its own template.
  await page.getByRole("link", { name: "AI Video", exact: true }).click();
  await page.getByRole("heading", { name: "AI Video", exact: true }).waitFor();
  assert.equal(await summary.locator("h2").textContent(), "Canvas Tote Creator Look", "the video module keeps its own template");

  // The length control offers exactly the two workspace tiers.
  const duration = page.getByRole("combobox", { name: "Video duration", exact: true });
  assert.equal(await duration.getAttribute("data-value"), "15");
  await duration.click();
  const options = page.getByRole("listbox", { name: "Video duration" });
  await options.waitFor();
  assert.deepEqual(await options.getByRole("option").allTextContents(), ["15s", "30s"], "only the 15 and 30 second tiers are offered");
  await options.getByRole("option", { name: "30s", exact: true }).click();
  assert.equal(await duration.getAttribute("data-value"), "30");

  // The model control is the same accessible dropdown, not a native select.
  const model = page.getByRole("combobox", { name: "Video model", exact: true });
  assert.equal(await page.locator("main select").count(), 0, "the composer no longer renders native select controls");
  await model.click();
  assert.equal(await page.getByRole("listbox", { name: "Video model" }).getByRole("option").count(), 1);

  assert.deepEqual(errors, []);
  console.log("PASS: workspace module contracts keep photo and video templates apart, scope the template gallery to the module, offer only the 15 and 30 second tiers, and render the settings controls as accessible dropdowns.");
} finally {
  if (browser) await browser.close();
  if (server) server.close();
}
