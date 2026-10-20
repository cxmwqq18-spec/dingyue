import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const source = path.join(process.cwd(), "src/lib/aidreamcapes-workspace");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "static-routes-"));
const require = createRequire(path.join(temp, "entry.cjs"));
const transpile = (name) => ts.transpileModule(fs.readFileSync(path.join(source, `${name}.ts`), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const compile = (name, localRequire = require) => {
  const module = { exports: {} };
  new Function("require", "module", "exports", transpile(name))(localRequire, module, module.exports);
  return module.exports;
};
const localRequireShim = (id) => {
  if (id === "./navigation") return compile("navigation", localRequireShim);
  if (id === "./types") return { AIVIDEOSUGC_SITE_ID: "site_aidreamcapes" };
  return require(id);
};
const routes = compile("static-routes", localRequireShim);

// Legacy query links map to fixed paths under the canonical public directory naming.
const cases = [
  ["/app/create?tool_id=image_generator&tool=photo-hub&template=color", "/app/create/ai-image-generation/photo-hub/color"],
  ["/app/create?tool=video-ads&template=creator", "/app/create/ai-video-generation/video-ads/creator"],
  ["/app/create?tool=spokesperson-videos", "/app/create/ai-video-generation/spokesperson-videos"],
  ["/app/create?tool=unboxing-videos", "/app/create/ai-video-generation/unboxing-videos"],
  ["/app/create?tool_id=image_generator&tool=white-background", "/app/create/ai-image-generation/white-background"],
  ["/app/create?tool_id=image_generator", "/app/create/ai-image-generation"],
  ["/app/create?tool=image-to-video&size=9:16&length=10", "/app/create/ai-video-generation/image-to-video?size=9%3A16&length=10"],
  ["/app/create?plan=pro", "/app/create"],
  ["/app/create?", "/app/create"],
  ["/app/create?videoMode=product-video", "/app/create/ai-video-generation/product-videos"],
  ["/app/create?view=video", "/app/create/ai-video-generation"],
  ["/app/create?view=images", "/app/create/ai-image-generation"],
  ["/app/create?view=actors", "/app/create/ai-actors"],
  ["/app/create?view=product", "/app/create/ai-video-generation/url-to-video"],
  ["/app/create?view=library&filter=completed", "/app/create/library/completed"],
  ["/app/create?view=home&templates=1&category=tech-electronics", "/app/create/templates/tech-electronics"],
  ["/app/create?view=home&templates=1", "/app/create/templates"],
  ["/app/create?view=library", "/app/create/library"],
];
for (const [from, to] of cases) assert.equal(routes.legacyCreateHrefToStatic(from), to, from);

// Superseded fixed paths redirect to their canonical group path.
const legacyPaths = [
  [["video"], "/app/create/ai-video-generation"],
  [["images"], "/app/create/ai-image-generation"],
  [["actors"], "/app/create/ai-actors"],
  [["product"], "/app/create/ai-video-generation/url-to-video"],
  [["agent"], "/app/create/ai-video-generation/text-to-video"],
  [["tool", "image-to-video"], "/app/create/ai-video-generation/image-to-video"],
  [["tool", "lifestyle-photos"], "/app/create/ai-image-generation/lifestyle-photos"],
  [["tool", "video-ads", "creator"], "/app/create/ai-video-generation/video-ads/creator"],
  [["tool", "text-to-video"], "/app/create/ai-video-generation/text-to-video"],
  [["tool", "unknown-tool"], undefined],
  [["scene", "garden"], undefined],
  [["demo", "serum-15s-video"], undefined],
];
for (const [segments, to] of legacyPaths) assert.equal(routes.legacyStaticCreateRedirect(segments), to, JSON.stringify(segments));

// Curated demos resolve by (view, prompt) even when link variants omit scene/tool.
const demo = routes.staticDemoForHref(
  "/app/create?view=batch&prompt=" + encodeURIComponent(routes.STATIC_DEMOS.find((d) => d.slug === "product-demonstration").prompt)
  + "&scene=process_demo&aspect=9%3A16&duration=15"
);
assert.equal(demo?.slug, "product-demonstration");

// Functional state never becomes a static redirect.
for (const negative of [
  "/app/create?task=t_1&step=input",
  "/app/create?next=/account",
  "/app/create?tool=url-to-video&url=https://example.com/product",
  "/app/create?resumeDraft=1",
  "/app/create?view=library&filter=completed&q=x",
]) {
  assert.equal(routes.legacyCreateHrefToStatic(negative), undefined, negative);
}

// Segment parsing and query synthesis. Canonical group paths parse to their view;
// legacy tool paths keep parsing so stored card hrefs still resolve.
assert.equal(routes.parseStaticCreateSegments(["ai-video-generation"])?.view, "video");
assert.equal(routes.parseStaticCreateSegments(["ai-image-generation"])?.view, "images");
assert.equal(routes.parseStaticCreateSegments(["ai-actors"])?.view, "actors");
assert.equal(routes.parseStaticCreateSegments(["ai-video-generation", "text-to-video"])?.view, "agent");
assert.equal(routes.parseStaticCreateSegments(["ai-video-generation", "image-to-video"])?.tool, "image-to-video");
assert.equal(routes.parseStaticCreateSegments(["ai-image-generation", "white-background"])?.tool, "white-background");
assert.equal(routes.parseStaticCreateSegments(["ai-image-generation", "white-background", "white"])?.template, "white");
// A tool filed under the wrong directory does not parse.
assert.equal(routes.parseStaticCreateSegments(["ai-image-generation", "video-ads"])?.kind ?? undefined, undefined);
assert.equal(routes.parseStaticCreateSegments(["tool", "video-ads", "creator"])?.kind, "tool");
assert.equal(routes.parseStaticCreateSegments(["templates", "beauty"])?.category, "beauty");
assert.equal(routes.parseStaticCreateSegments(["library", "all"])?.filter, "all");
assert.equal(routes.parseStaticCreateSegments(["demo", "product-demonstration"])?.slug, "product-demonstration");
assert.equal(routes.parseStaticCreateSegments(["scene", "x"])?.kind ?? undefined, undefined);
const toolQuery = routes.staticCreateQuery(routes.parseStaticCreateSegments(["ai-image-generation", "photo-hub", "color"]));
assert.equal(toolQuery.tool, "photo-hub");
assert.equal(toolQuery.tool_id, "image_generator");
assert.equal(toolQuery.template, "color");
const videoQuery = routes.staticCreateQuery(routes.parseStaticCreateSegments(["ai-video-generation", "video-ads"]));
assert.equal(videoQuery.tool, "video-ads");
assert.equal(videoQuery.tool_id, undefined);
const demoQuery = routes.staticCreateQuery(routes.parseStaticCreateSegments(["demo", "mug-car-morning"]));
assert.equal(demoQuery.view, "images");
assert.match(demoQuery.prompt, /travel mug/);

// Location helper for client bootstrap.
const sp = routes.staticCreateSearchFromPath("/app/create/ai-video-generation/video-ads/creator");
assert.equal(sp?.get("tool"), "video-ads");
const imageView = routes.staticCreateSearchFromPath("/app/create/ai-image-generation");
assert.equal(imageView?.get("view"), "images");
const actorsView = routes.staticCreateSearchFromPath("/site/aidreamcapes/app/create/ai-actors");
assert.equal(actorsView?.get("view"), "actors");
const libView = routes.staticCreateSearchFromPath("/site/aidreamcapes/app/create/library");
assert.equal(libView?.get("view"), "library");
assert.equal(routes.staticCreateSearchFromPath("/site/aidreamcapes/app/create/library/completed")?.get("filter"), "completed");

// View hrefs carry the canonical directory segments.
assert.equal(routes.staticViewHref("", "video"), "/app/create/ai-video-generation");
assert.equal(routes.staticViewHref("", "images"), "/app/create/ai-image-generation");
assert.equal(routes.staticViewHref("", "actors"), "/app/create/ai-actors");
assert.equal(routes.staticToolHref("", "url-to-video"), "/app/create/ai-video-generation/url-to-video");
assert.equal(routes.staticToolHref("/site/aidreamcapes", "model-photos"), "/site/aidreamcapes/app/create/ai-image-generation/model-photos");

console.log("Aidreamcapes static create route smoke passed.");
