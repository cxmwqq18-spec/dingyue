import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import Module from "node:module";
import ts from "typescript";

// Contract smoke for the URL-to-Video page extractor. It covers the parsing
// half of the product brief preview (JSON-LD and Open Graph extraction) with
// an inline fixture, because real storefront fetches cannot run from every
// development workstation.
const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-product-parse-"));
const originalLoad = Module._load;

const compile = (sourcePath) => {
  const result = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  });
  const target = path.join(temp, `${path.basename(sourcePath, ".ts")}.js`);
  fs.writeFileSync(target, result.outputText);
  return target;
};

Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/lib/aidreamcapes-create-intent") {
    return { cleanProductUrl: (value) => value };
  }
  return originalLoad.call(this, request, parent, isMain);
};

try {
  compile(path.join(root, "src/lib/product-url-import.ts"));
  const require = createRequire(path.join(temp, "entry.cjs"));
  const { productDetailsFromHtml } = require(path.join(temp, "product-url-import.js"));

  const pageUrl = new URL("https://shop.example/products/item");
  const html = `<!doctype html><html><head>
    <title>Wrong generic title</title>
    <meta property="og:title" content="Sample Item"/>
    <meta property="og:image" content="https://cdn.shop.example/images/item_small.jpg"/>
    <script type="application/ld+json">{"@type":"Product","name":"Sample Item JSON-LD","image":["https://cdn.shop.example/images/item_main.jpg"],"offers":{"price":"49.95","priceCurrency":"USD"}}</script>
    </head><body></body></html>`;

  const details = productDetailsFromHtml(html, pageUrl);
  assert.equal(details.title, "Sample Item JSON-LD", "JSON-LD product name should win over Open Graph and generic titles");
  assert.deepEqual(
    details.imageUrls.map((url) => url.toString()),
    ["https://cdn.shop.example/images/item_main.jpg", "https://cdn.shop.example/images/item_small.jpg"],
    "JSON-LD images should lead and Open Graph images should follow, relative to the page URL"
  );

  const ogOnly = productDetailsFromHtml(
    '<html><head><title>Fallback Title</title><meta property="og:title" content="OG Title"/><meta property="og:image:secure_url" content="/images/fallback.jpg"/></head></html>',
    pageUrl
  );
  assert.equal(ogOnly.title, "OG Title", "Open Graph title should be extracted when JSON-LD is absent");
  assert.deepEqual(
    ogOnly.imageUrls.map((url) => url.toString()),
    ["https://shop.example/images/fallback.jpg"],
    "relative Open Graph images should resolve against the page URL"
  );

  const empty = productDetailsFromHtml("<html><head></head></html>", pageUrl);
  assert.equal(empty.title, undefined, "a page without product markers should not invent a title");
  assert.deepEqual(empty.imageUrls, [], "a page without product markers should not invent images");
  console.log("PASS: product page parsing extracts sourced titles and images from JSON-LD and Open Graph fixtures");
} finally {
  Module._load = originalLoad;
}
