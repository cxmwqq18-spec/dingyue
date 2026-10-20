import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// In-memory presentation checks only: no database, content generator, network or asset writes.
const root = process.cwd();
const require = createRequire(path.join(root, "package.json"));
const modules = new Map();
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText;
const manifest = JSON.parse(fs.readFileSync("src/lib/storefront-responsive-image-manifest.json", "utf8"));

function load(relativePath) {
  const exports = {};
  vm.runInNewContext(compile(fs.readFileSync(relativePath, "utf8")), {
    exports,
    require: name => modules.has(name) ? modules.get(name)
      : name.endsWith("storefront-responsive-image-manifest.json") ? manifest : require(name)
  });
  return exports;
}

modules.set("@/lib/storefront-responsive-images", load("src/lib/storefront-responsive-images.ts"));
const client = load("src/components/storefront/aidreamcapes-projected-image.client.tsx");
modules.set("./aidreamcapes-projected-image.client", client);
const original = load("src/components/storefront/aidreamcapes-responsive-image.tsx").AidreamcapesResponsiveImage;
const projection = load("src/components/storefront/aidreamcapes-responsive-image-projection.tsx").AidreamcapesImageProjection;
let comparisons = 0;
for (const src of [...Object.keys(manifest), "/missing-test.webp", `${Object.keys(manifest)[0]}?v=1#cover`]) {
  for (const explicitSize of [false, true]) {
    const props = { src, alt: "Product preview", loading: "lazy", decoding: "async", sizes: "(max-width: 767px) 100vw, 33vw", ...(explicitSize ? { width: 333, height: 222 } : {}) };
    const expected = renderToStaticMarkup(React.createElement(original, props));
    const actual = renderToStaticMarkup(React.createElement(projection, { value: { nested: [{ src }] } }, React.createElement(client.AidreamcapesProjectedImage, props)));
    assert.equal(actual, expected, `Image HTML changed: ${src}`);
    comparisons += 1;
  }
}

const draftSource = compile(fs.readFileSync("src/components/aidreamcapes-workspace/use-image-draft.ts", "utf8"));
function restoredDrafts(hasEntryInput, search = "") {
  const effects = [];
  const restored = [];
  const exports = {};
  const saved = { version: 1, savedAt: Date.now(), input: { prompt: "Previous draft", assetUrls: [], aspect: "1:1", toolId: "custom" } };
  vm.runInNewContext(draftSource, {
    exports, Date, URLSearchParams,
    require: () => ({ useEffect: fn => effects.push(fn), useState: () => ["", () => {}] }),
    window: { location: { search } },
    sessionStorage: { getItem: () => JSON.stringify(saved), setItem() {} }
  });
  exports.useImageDraft("site_aidreamcapes", undefined, {}, input => restored.push(input), hasEntryInput);
  effects[0]();
  return restored;
}
assert.equal(restoredDrafts(false)[0].prompt, "Previous draft", "Ordinary revisits must retain the draft");
assert.equal(restoredDrafts(true).length, 0, "An SSR case selection must win over the old draft");
assert.equal(restoredDrafts(false, "?prompt=current").length, 0, "Explicit URL input must win");
assert.equal(restoredDrafts(false, "?source=current&preset=one").length, 0, "Explicit presets must win");
console.log(JSON.stringify({ ok: true, imageComparisons: comparisons, draftPriorityChecks: 4 }));
