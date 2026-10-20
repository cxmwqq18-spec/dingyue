import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

// Render the real workspace and React DOM, with HTTP fixtures only. No Next
// server, environment files, database, customer records or providers are used.
const require = createRequire(import.meta.url);
const root = process.cwd();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "aidreamcapes-dom-"));
const webpackRuntime = require("next/dist/compiled/webpack/webpack");
webpackRuntime.init();
const webpack = webpackRuntime.webpack;
let server;
let browser;

export const simulateTranslation = (selector = "main") => {
  const root = document.querySelector(selector);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.textContent.trim() && !node.parentElement.closest("script,style,textarea,option,svg,font")) nodes.push(node);
  }
  for (const node of nodes) {
    const translated = document.createElement("font");
    translated.style.verticalAlign = "inherit";
    const inner = document.createElement("font");
    inner.style.verticalAlign = "inherit";
    inner.textContent = node.textContent;
    translated.appendChild(inner);
    node.parentNode.replaceChild(translated, node);
  }
  return nodes.length;
};

try {
  await fs.writeFile(path.join(temp, "typescript-loader.cjs"), `const ts = require(${JSON.stringify(require.resolve("typescript"))}); module.exports = function(source) { return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText; };`);
  await fs.writeFile(path.join(temp, "css-loader.cjs"), `const path = require("node:path"); module.exports = function(source) { const prefix = path.basename(this.resourcePath).replace(/\\W/g, "_") + "__"; const names = Object.fromEntries([...source.matchAll(/\\.([a-zA-Z_][\\w-]*)/g)].map(match => [match[1], prefix + match[1]])); const css = source.replace(/\\.([a-zA-Z_][\\w-]*)/g, (_, name) => "." + names[name]); return 'const style = document.createElement("style"); style.textContent = ' + JSON.stringify(css) + '; document.head.appendChild(style); export default ' + JSON.stringify(names); };`);
  await fs.writeFile(path.join(temp, "entry.tsx"), `
    import { createRoot } from "react-dom/client";
    import { AidreamcapesWorkspace } from ${JSON.stringify(path.join(root, "src/components/aidreamcapes-workspace/workspace.tsx"))};
    import { SCENES } from ${JSON.stringify(path.join(root, "src/lib/aidreamcapes-workspace/catalogs.ts"))};
    import actorData from ${JSON.stringify(path.join(root, "src/lib/aidreamcapes-workspace/actors.json"))};
    const catalog = { scenes: SCENES, actors: actorData.actors, models: [{id:"dom-model",label:"Fixture video model",model:"dom-model",available:true,aspects:["9:16"],durations:[15],multiReference:false,nativeSpeech:false}], languages: [{value:"en",label:"English"}], aspects:["9:16","1:1"], durations:[{value:15,label:"15s",generationAvailable:false}], subtitles:{available:false}, quickStarts:[] };
    window.fixtureCatalog = catalog;
    createRoot(document.getElementById("root")).render(<AidreamcapesWorkspace siteId="site_aidreamcapes" basePath="/site/aidreamcapes" initialView="library" initialCatalog={catalog} customer={{id:"dom-fixture",name:"DOM Fixture",email:"fixture@example.invalid",balance:50}} />);
  `);
  const compiler = webpack({
    mode: "development", target: "web", devtool: false, context: root,
    entry: path.join(temp, "entry.tsx"), output: { path: temp, filename: "bundle.js" },
    resolve: { extensions: [".tsx", ".ts", ".js", ".json"], alias: { "@": path.join(root, "src") }, modules: [path.join(root, "node_modules"), "node_modules"] },
    module: { rules: [
      { test: /\.tsx?$/, use: path.join(temp, "typescript-loader.cjs") },
      { test: /\.css$/, use: path.join(temp, "css-loader.cjs") },
    ] },
    plugins: [new webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) }), new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
    optimization: { minimize: false },
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => {
    compiler.close(() => {});
    if (error || stats.hasErrors()) reject(error || new Error(stats.toString({ all: false, errors: true })));
    else resolve();
  }));
  const bundle = await fs.readFile(path.join(temp, "bundle.js"));
  server = createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "text/javascript"); response.end(bundle); }
    else if (request.url.startsWith("/api/")) { response.writeHead(501); response.end("Unmocked API request"); }
    else if (request.url.startsWith("/media/")) { response.writeHead(204); response.end(); }
    else { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><html lang="en" translate="yes"><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  if (process.argv.includes("--serve")) {
    console.log(origin);
    await new Promise((resolve) => { process.once("SIGTERM", resolve); process.once("SIGINT", resolve); });
  } else {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], lists = [], unexpected = [], createdTasks = [], uploads = [];
    let currentTask;
    page.on("pageerror", (error) => errors.push(error.stack || error.message));
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/tasks") && route.request().method() === "GET") { lists.push(route); return; }
      if (url.pathname.endsWith("/tasks") && route.request().method() === "POST") {
        const body = route.request().postDataJSON(); createdTasks.push(body);
        currentTask = { ...body, taskId: "dom-task", siteId: "site_aidreamcapes", customerId: "dom-fixture", title: "DOM draft", revision: 1, status: "draft", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), storyboardHistory: [], revisions: [], videoHistory: [] };
        return route.fulfill({ json: { task: currentTask } });
      }
      if (url.pathname.endsWith("/tasks/dom-task") && route.request().method() === "PATCH") {
        currentTask = { ...currentTask, ...route.request().postDataJSON(), revision: currentTask.revision + 1 };
        return route.fulfill({ json: { task: currentTask } });
      }
      if (url.pathname.endsWith("/customers/dom-fixture/assets")) {
        const previewUrl = `/media/dom-reference-${uploads.length}.png`; uploads.push(previewUrl);
        return route.fulfill({ json: { asset: { id: `fixture-${uploads.length}`, previewUrl } } });
      }
      if (url.pathname.endsWith("/images")) return route.fulfill({ json: { jobs: [], assets: [] } });
      if (url.pathname.endsWith("/music")) return route.fulfill({ json: { tracks: [] } });
      if (url.pathname.endsWith("/images/quote")) return route.fulfill({ json: { quote: { available: false, credits: null, reason: "workspace_composition_provider_unavailable" } } });
      if (url.pathname.endsWith("/music/catalog")) return route.fulfill({ json: { tracks: [] } });
      if (url.pathname.endsWith("/balance")) return route.fulfill({ json: { customerBalance: { balance: 50, reserved: 0 } } });
      unexpected.push(url.pathname);
      return route.fulfill({ status: 501, json: { error: "unhandled_fixture" } });
    });
    const settleList = async () => {
      await page.waitForFunction(() => document.querySelector("main")?.textContent.includes("Loading your videos"));
      assert.ok(await page.evaluate(simulateTranslation), "fixture must replace React's original text nodes");
      assert.ok(lists.length, "task list must be pending");
      await lists.shift().fulfill({ json: { tasks: [] } });
      await page.waitForFunction(() => document.querySelector("main h3")?.textContent.includes("No videos here yet"), null, { timeout: 5000 }).catch((error) => { throw new Error(errors.join("\n") || error.message); });
      assert.deepEqual(errors, []);
    };
    await page.goto(`${origin}/?view=library`, { waitUntil: "domcontentloaded" });
    await settleList();
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.evaluate(simulateTranslation, '[aria-label="Workspace navigation"]');
      await page.getByRole("link", { name: "Home", exact: true }).click();
      await page.getByRole("heading", { name: "Hello, DOM" }).waitFor();
      await page.evaluate(simulateTranslation);
      await page.getByRole("link", { name: "Library", exact: true }).click();
      await settleList();
    }
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page.getByRole("tab", { name: "Text to Video", exact: true }).waitFor();
    await page.evaluate(simulateTranslation);
    await page.getByRole("tab", { name: "AI Video", exact: true }).click();
    await page.getByLabel("Upload video reference photo").waitFor();
    if (process.env.AIVIDEOSUGC_BROWSER_ARTIFACTS) {
      await fs.mkdir(process.env.AIVIDEOSUGC_BROWSER_ARTIFACTS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.AIVIDEOSUGC_BROWSER_ARTIFACTS, "video-desktop.png"), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(process.env.AIVIDEOSUGC_BROWSER_ARTIFACTS, "video-mobile.png"), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    assert.equal(await page.getByRole("combobox", { name: "Image style", exact: true }).count(), 0);
    await page.getByLabel("Describe your video idea").fill("A hand turns the product slowly beside a window.");
    await page.getByRole("tab", { name: "AI Image", exact: true }).click();
    await page.getByLabel("Describe your image idea").fill("A product on a clean white background.");
    await page.getByRole("combobox", { name: "Image style", exact: true }).click();
    await page.getByRole("option", { name: "White background", exact: true }).click();
    if (process.env.AIVIDEOSUGC_BROWSER_ARTIFACTS) await page.screenshot({ path: path.join(process.env.AIVIDEOSUGC_BROWSER_ARTIFACTS, "image-desktop.png"), fullPage: true });
    await page.evaluate(simulateTranslation);
    await page.getByRole("button", { name: "Continue to image", exact: true }).click();
    await page.getByRole("heading", { name: "AI Image", exact: true }).waitFor();
    assert.equal(await page.getByLabel("Describe your image idea").inputValue(), "A product on a clean white background.");
    assert.equal(await page.getByRole("button", { name: "Generate image", exact: true }).isDisabled(), true, "image generation stays unavailable in the fixture");
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page.getByRole("tab", { name: "AI Video", exact: true }).click();
    assert.equal(await page.getByLabel("Describe your video idea").inputValue(), "A hand turns the product slowly beside a window.");
    await page.getByLabel("Upload video reference photo").setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6M9sAAAAASUVORK5CYII=", "base64") });
    await page.getByRole("button", { name: "Remove video reference 1", exact: true }).waitFor();
    await page.evaluate(simulateTranslation);
    await page.getByRole("button", { name: "Continue to video", exact: true }).click();
    await page.getByRole("button", { name: "Save draft and open storyboard", exact: true }).click();
    await page.getByRole("textbox", { name: "Video title", exact: true }).waitFor();
    assert.equal(createdTasks.length, 1);
    assert.equal(createdTasks[0].sceneId, "process_demo");
    assert.equal(createdTasks[0].input.fields.steps, "A hand turns the product slowly beside a window.");
    assert.deepEqual(createdTasks[0].input.images.productImages, [uploads[0]]);
    assert.equal(createdTasks[0].input.modelId, "dom-model");
    await page.evaluate(simulateTranslation);
    const saved = page.waitForRequest((request) => request.method() === "PATCH" && request.url().endsWith("/tasks/dom-task"));
    await page.getByRole("textbox", { name: "Describe your video in one sentence", exact: true }).fill("Open the package, then show the product.");
    assert.equal((await saved).postDataJSON().input.fields.steps, "Open the package, then show the product.");
    await page.getByRole("link", { name: "AI Avatar", exact: true }).click();
    await page.getByRole("group", { name: "Filter avatars by gender" }).waitFor();
    for (const gender of ["Women", "Men", "All"]) {
      await page.evaluate(simulateTranslation);
      await page.getByRole("group", { name: "Filter avatars by gender" }).getByRole("button", { name: new RegExp(`^${gender}`) }).click();
    }
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await page.getByRole("tab", { name: "Text to Video", exact: true }).click();
    await page.getByRole("button", { name: /^Product/ }).click();
    await page.getByRole("dialog", { name: "Add your product" }).waitFor();
    await page.evaluate(simulateTranslation, '[role="dialog"]');
    await page.getByRole("button", { name: "Close dialog", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "Create draft copies", exact: true }).count(), 0, "Batch draft shortcut is hidden while unavailable.");
    assert.deepEqual(errors, [], `page errors: ${JSON.stringify(errors)}; unexpected API paths: ${JSON.stringify(unexpected)}`);
    assert.deepEqual(unexpected, [], `unexpected API paths: ${JSON.stringify(unexpected)}`);
    console.log("PASS: real React DOM survives translated Library and tab transitions; separate image/video prompts and uploaded references reach their corresponding editors/draft API. No DB/provider traffic.");
  }
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await fs.rm(temp, { recursive: true, force: true });
}
