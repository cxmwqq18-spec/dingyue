import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const file = "src/components/aidreamcapes-workspace/home-composer.tsx";
const context = vm.createContext({ exports: {}, require: (name) => name === "@/lib/aidreamcapes-workspace/catalogs" ? { WORKSPACE_ASPECTS: ["9:16", "1:1", "16:9"] } : name.endsWith(".css") ? { default: new Proxy({}, { get: (_target, key) => `hc-${String(key)}` }) } : require(name) });
vm.runInContext(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { HomeComposer, homeComposerVideoOptions } = context.exports;
const calls = [];
const model = { id: "fixture", label: "Fixture model", model: "fixture", available: true, aspects: ["16:9"], durations: [6], multiReference: false };
const catalog = { models: [model], aspects: ["9:16", "16:9", "1:1"], durations: [{ value: 6, label: "6s" }, { value: 15, label: "15s" }], actors: [], scenes: [] };
const props = {
  tab: "Video Agent", onTabChange: (value) => calls.push(["tab", value]), prompt: "A product demonstration", onPromptChange: (value) => calls.push(["prompt", value]),
  catalog, modelId: "fixture", onModelChange() {}, aspect: "9:16", onAspectChange() {}, duration: 15, onDurationChange() {},
  products: [], onOpenProduct: () => calls.push(["product"]), onOpenAvatar: () => calls.push(["avatar"]),
  videoReferenceUrls: [], onVideoReferenceUpload() {}, onVideoReferenceRemove() {},
  imageInput: { prompt: "A ceramic mug on a wooden table", assetUrls: [], aspect: "1:1", toolId: "custom" }, onImageInputChange: (value) => calls.push(["image", value]),
  onImageReferenceUpload() {}, onImageReferenceRemove() {}, onContinue: (...args) => calls.push(["continue", ...args]), canUpload: true,
};
function find(tree, predicate) {
  if (!tree || typeof tree !== "object") return undefined;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) { const item = find(child, predicate); if (item) return item; }
}
const isContinueButton = (node) => node.type === "button" && node.props.className?.split(" ").includes("hc-continue") && !node.props.className?.split(" ").includes("hc-continueWithLabel");
const options = homeComposerVideoOptions(catalog, "fixture", "9:16", 15);
assert.equal(options.selectedAspect, "16:9"); assert.equal(options.selectedDuration, 6);
assert.equal(options.aspects.length, 1); assert.equal(options.durations.length, 1);
const videoTree = HomeComposer({ ...props, tab: "AI Video" });
find(videoTree, isContinueButton).props.onClick();
assert.equal(calls.at(-1)[1], "AI Video"); assert.equal(calls.at(-1)[2].aspect, "16:9"); assert.equal(calls.at(-1)[2].duration, 6);
const invalidTree = HomeComposer({ ...props, tab: "AI Video", videoReferenceUrls: ["one", "two"] });
assert.equal(find(invalidTree, isContinueButton).props.disabled, true);
const imageTree = HomeComposer({ ...props, tab: "AI Image" });
find(imageTree, (node) => node.type === "textarea").props.onChange({ target: { value: "Changed image prompt" } });
assert.equal(calls.at(-1)[0], "image"); assert.equal(calls.at(-1)[1].prompt, "Changed image prompt"); assert.equal(props.prompt, "A product demonstration");
find(imageTree, isContinueButton).props.onClick();
assert.equal(calls.at(-1)[1], "AI Image");
let imageGenerations = 0;
const imagePageTree = HomeComposer({ ...props, tab: "AI Image", showTabs: false, onImageGenerate: () => imageGenerations++ });
const generateButton = find(imagePageTree, (node) => node.type === "button" && node.props.className.includes("hc-continueWithLabel"));
assert.equal(generateButton.props["aria-label"], "Generate image"); generateButton.props.onClick(); assert.equal(imageGenerations, 1);
const quotePendingTree = HomeComposer({ ...props, tab: "AI Image", onImageGenerate() {}, imageGenerateDisabled: true });
assert.equal(find(quotePendingTree, (node) => node.type === "button" && node.props.className.includes("hc-continueWithLabel")).props.disabled, true);

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-home-composer-"));
const css = fs.readFileSync("src/components/aidreamcapes-workspace/home-composer.module.css", "utf8").replace(/\.([a-zA-Z][\w-]*)/g, ".hc-$1");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route("**/*", (route) => route.abort());
  for (const width of [1120, 390]) {
    await page.setViewportSize({ width, height: 920 });
    for (const tab of ["Video Agent", "AI Video", "AI Image"]) {
      await page.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f3f4f6;font-family:Arial;color:#101623}button,input,select,textarea{font:inherit}h2,p{margin:0}${css}</style></head><body>${renderToStaticMarkup(HomeComposer({ ...props, tab }))}</body></html>`);
      await page.waitForLoadState("networkidle");
      assert.equal(await page.getByRole("tab", { name: tab, exact: true }).getAttribute("aria-selected"), "true");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${tab} fits ${width}px`);
      assert.equal(await page.getByRole("combobox", { name: "Video model", exact: true }).count(), tab === "AI Image" ? 0 : 1);
      assert.equal(await page.getByRole("combobox", { name: "Image style", exact: true }).count(), tab === "AI Image" ? 1 : 0);
      if (tab === "AI Video") assert.equal(await page.getByRole("option", { name: "15s", exact: true }).count(), 0);
      await page.screenshot({ path: path.join(directory, `${width}-${tab.replaceAll(" ", "-")}.png`), fullPage: true });
    }
  }
  console.log(`PASS HomeComposer: three distinct panels, model capability constraints, independent image input, continue callbacks, mobile/desktop layouts. Screenshots: ${directory}`);
} finally { await browser.close(); }
