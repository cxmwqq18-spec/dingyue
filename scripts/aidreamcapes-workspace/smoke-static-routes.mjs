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
  if (id === "./tool-aliases") return compile("tool-aliases", localRequireShim);
  if (id === "./types") return { AIVIDEOSUGC_SITE_ID: "site_aidreamcapes" };
  return require(id);
};
const routes = compile("static-routes", localRequireShim);

// Legacy query links map to the canonical short tool paths.
const cases = [
  ["/app/create?tool_id=image_generator&tool=photo-hub&template=color", "/app/create/photo-hub/color"],
  ["/app/create?tool=video-ads&template=creator", "/app/create/video-ads/creator"],
  ["/app/create?tool=spokesperson-videos", "/app/create/spokesperson-video"],
  ["/app/create?tool=unboxing-videos", "/app/create/unboxing-videos"],
  ["/app/create?tool_id=image_generator&tool=white-background", "/app/create/white-background"],
  ["/app/create?tool_id=image_generator", "/app/create/ai-image-generation"],
  ["/app/create?tool=image-to-video&size=9:16&length=10", "/app/create/image-to-video?size=9%3A16&length=10"],
  ["/app/create?plan=pro", "/app/create"],
  ["/app/create?", "/app/create"],
  ["/app/create?videoMode=product-video", "/app/create/product-video"],
  ["/app/create?view=video", "/app/create/ai-video-generation"],
  ["/app/create?view=images", "/app/create/ai-image-generation"],
  ["/app/create?view=actors", "/app/create/ai-actors"],
  ["/app/create?view=product", "/app/create/url-to-video"],
  ["/app/create?view=library&filter=completed", "/app/create/library/completed"],
  ["/app/create?view=home&templates=1&category=tech-electronics", "/app/create/templates/tech-electronics"],
  ["/app/create?view=home&templates=1", "/app/create/templates"],
  ["/app/create?view=library", "/app/create/library"],
];
for (const [from, to] of cases) assert.equal(routes.legacyCreateHrefToStatic(from), to, from);

// Superseded view aliases redirect to the canonical short path. Legacy case
// URLs render once and are normalized by the workspace so their selection is
// not lost in a redirect.
const legacyPaths = [
  [["video"], "/app/create/ai-video-generation"],
  [["images"], "/app/create/ai-image-generation"],
  [["actors"], "/app/create/ai-actors"],
  [["product"], "/app/create/url-to-video"],
  [["agent"], "/app/create/text-to-video"],
  [["tool", "image-to-video"], undefined],
  [["tool", "lifestyle-photos"], undefined],
  [["tool", "video-ads", "creator"], undefined],
  [["tool", "text-to-video"], "/app/create/text-to-video"],
  [["tool", "unknown-tool"], undefined],
  [["ai-video-generation", "url-to-video"], undefined],
  [["ai-video-generation", "text-to-video"], "/app/create/text-to-video"],
  [["ai-image-generation", "photo-hub", "color"], undefined],
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
assert.equal(routes.parseStaticCreateSegments(["url-to-video"])?.tool, "url-to-video");
assert.equal(routes.parseStaticCreateSegments(["photo-hub", "color"])?.tool, "photo-hub");
// Legacy plural tool links keep working and normalize to the singular id.
assert.equal(routes.parseStaticCreateSegments(["product-videos"])?.tool, "product-video");
assert.equal(routes.parseStaticCreateSegments(["tool", "spokesperson-videos"])?.tool, "spokesperson-video");
assert.equal(routes.parseStaticCreateSegments(["ai-video-generation", "before-after-videos", "demo"])?.tool, "before-after-video");
assert.equal(routes.staticToolHref("", "product-videos"), "/app/create/product-video");
assert.equal(routes.staticCreateSearchFromPath("/app/create/spokesperson-videos")?.get("tool"), "spokesperson-video");
assert.equal(routes.parseStaticCreateSegments(["text-to-video"])?.view, "agent");
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
const sp = routes.staticCreateSearchFromPath("/app/create/video-ads/creator");
assert.equal(sp?.get("tool"), "video-ads");
const imageView = routes.staticCreateSearchFromPath("/app/create/ai-image-generation");
assert.equal(imageView?.get("view"), "images");
assert.equal(routes.staticCreateSearchFromPath("/app/create/url-to-video")?.get("tool"), "url-to-video");
assert.equal(routes.staticCreateSearchFromPath("/app/create/text-to-video")?.get("view"), "agent");
const actorsView = routes.staticCreateSearchFromPath("/site/aidreamcapes/app/create/ai-actors");
assert.equal(actorsView?.get("view"), "actors");
const libView = routes.staticCreateSearchFromPath("/site/aidreamcapes/app/create/library");
assert.equal(libView?.get("view"), "library");
assert.equal(routes.staticCreateSearchFromPath("/site/aidreamcapes/app/create/library/completed")?.get("filter"), "completed");

// Base views keep their directory segments; individual tools use short paths.
assert.equal(routes.staticViewHref("", "video"), "/app/create/ai-video-generation");
assert.equal(routes.staticViewHref("", "images"), "/app/create/ai-image-generation");
assert.equal(routes.staticViewHref("", "actors"), "/app/create/ai-actors");
assert.equal(routes.staticViewHref("", "product"), "/app/create/url-to-video");
assert.equal(routes.staticViewHref("", "agent"), "/app/create/text-to-video");
assert.equal(routes.staticToolHref("", "url-to-video"), "/app/create/url-to-video");
assert.equal(routes.staticToolHref("/site/aidreamcapes", "model-photos"), "/site/aidreamcapes/app/create/model-photos");

console.log("Aidreamcapes static create route smoke passed.");
