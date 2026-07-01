import fs from "fs";
import path from "path";

const repoRoot = process.cwd();

const expectedTools = [
  ["Professional headshot maker", "headshot"],
  ["Creator portrait studio", "creator-portrait"],
  ["World Cup fan photos", "world-cup-fan-photos"],
  ["Cyberpunk portrait maker", "cyberpunk-portrait"],
  ["Gala photo maker", "gala-photo"],
  ["Noir character portraits", "noir-portrait"],
  ["Anime avatar builder", "anime-avatar"],
  ["Nature adventure photos", "nature-adventure"],
  ["Fashion editorial set", "fashion-editorial"],
  ["Product lifestyle photos", "product-lifestyle"],
  ["Background changer", "background-changer"],
  ["Background remover", "background-remover"],
  ["Magic eraser", "magic-eraser"],
  ["Photo enhancer", "photo-enhancer"],
  ["Portrait retouch", "portrait-retouch"],
  ["Unblur image", "unblur-image"],
  ["Color correction", "color-correction"],
  ["Old photo restoration", "old-photo-restoration"],
  ["Edit by prompt", "edit-by-prompt"],
  ["Magic upscaler", "magic-upscaler"],
  ["Image to video concept", "image-to-video"],
  ["Profile clip maker", "profile-clip"],
  ["Fan poster motion", "fan-poster-motion"],
  ["Creator intro video", "creator-intro-video"],
  ["Product teaser clip", "product-teaser-clip"],
  ["Animated avatar preview", "animated-avatar"],
  ["Fashion reel starter", "fashion-reel"],
  ["Album story video", "album-story-video"]
];

function fail(message, details = {}) {
  console.error(`MyDreamShoots tool-link smoke failed: ${message}`);
  if (Object.keys(details).length) console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

function assert(condition, message, details) {
  if (!condition) fail(message, details);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function lowercaseBrandCopyHits(text) {
  return [...text.matchAll(/\bmydreamshoots\b/g)].filter((match) => {
    const index = match.index ?? 0;
    const before = text.slice(Math.max(0, index - 1), index);
    const after = text.slice(index + match[0].length, index + match[0].length + 2);
    return before !== "@" && before !== "." && after !== ".";
  });
}

const templates = readText("src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");
const renderer = readText("src/components/theme-renderer.tsx");
const schema = readText("src/lib/section-schema.ts");
const storefrontRender = readText("src/lib/storefront-render.tsx");
const platformState = JSON.parse(readText("data/platform-state.json"));

const missingTemplateLinks = [];
const missingSchemaLinks = [];
const missingAliases = [];

for (const [title, slug] of expectedTools) {
  if (!templates.includes(`title: "${title}"`) || !templates.includes(`href: toolHref("${slug}")`)) {
    missingTemplateLinks.push({ title, slug });
  }
  if (!storefrontRender.includes(`"${slug}"`)) {
    missingAliases.push(slug);
  }
}

const schemaPresetSlugs = [
  "headshot",
  "world-cup-fan-photos",
  "background-changer",
  "photo-enhancer",
  "image-to-video",
  "fan-poster-motion"
];

for (const slug of schemaPresetSlugs) {
  if (!schema.includes(`href: "/tools/${slug}"`)) {
    missingSchemaLinks.push(`/tools/${slug}`);
  }
}

assert(templates.includes("function toolHref(slug: string)"), "template package must use the shared toolHref helper");
assert(countMatches(templates, /href: toolHref\("/g) >= expectedTools.length, "template package must expose semantic hrefs for all mega tools");
assert(new Set(expectedTools.map((item) => item[1])).size === expectedTools.length, "expected tool slugs must be unique");
assert(!missingTemplateLinks.length, "template package is missing expected semantic tool links", { missingTemplateLinks });
assert(!missingSchemaLinks.length, "section schema preset is missing expected semantic links", { missingSchemaLinks });
assert(!missingAliases.length, "tool resolver is missing MyDreamShoots semantic aliases", { missingAliases });
assert(renderer.includes("function toolActionHref"), "renderer must route tool links through toolActionHref");
assert(!renderer.includes("?tool="), "renderer must not generate query-param tool URLs");
assert(!renderer.includes("?pack="), "renderer must not generate query-param pack URLs");
assert(!renderer.includes("/tools/image_generator"), "renderer must not generate legacy underscore tool URLs");
assert(!templates.includes("/tools/image-studio"), "template package must use static semantic tool paths");
assert(!templates.includes("/tools/image_generator"), "template package must not use legacy underscore tool paths");
assert(!templates.includes("/collections?category="), "template package must use static collection paths");
assert(!schema.includes("/tools/image-studio"), "section schema presets must use static semantic tool paths");
assert(!schema.includes("/tools/image_generator"), "section schema presets must not use legacy underscore tool paths");
assert(!schema.includes("/collections?category="), "section schema presets must use static collection paths");
const staleRuntimeLinks = [];
function collectStaleRuntimeLinks(value, pathLabel = "$") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${pathLabel}.${key}`;
    if (
      (key === "href" || key === "canonicalPath" || key === "primaryHref" || key === "secondaryHref" || key === "slug") &&
      (child === "/tools/image-studio" || child === "/tools/ai-image-studio" || child === "/tools/image_generator")
    ) {
      staleRuntimeLinks.push({ path: childPath, value: child });
    }
    if (key === "slug" && child === "dreamshoot") staleRuntimeLinks.push({ path: childPath, value: child });
    collectStaleRuntimeLinks(child, childPath);
  }
}
collectStaleRuntimeLinks(platformState);
assert(!staleRuntimeLinks.length, "runtime state must not expose old tool paths or old site slug", { staleRuntimeLinks: staleRuntimeLinks.slice(0, 20) });
assert(templates.includes("MyDreamShoots"), "template package must use the MyDreamShoots brand casing");
assert(!lowercaseBrandCopyHits(templates).length, "template package customer copy must not use lowercase mydreamshoots");
assert(!schema.includes("DreamShootAI") && !schema.includes("Mydreamshoots") && !schema.includes("MydreamShoots"), "section schema customer defaults must not expose old brand casing");
assert(storefrontRender.includes('"ai-image-studio"'), "tool resolver must support the static image studio alias");
assert(storefrontRender.includes('"virtual-try-on"'), "tool resolver must support the static virtual try-on alias");
assert(renderer.includes("focus-visible:ring-2 focus-visible:ring-[#16DCF0]/70"), "mega tool links must keep a visible keyboard focus style");
assert(storefrontRender.includes("normalizeToolLookup"), "tool resolver must normalize incoming tool slugs");
assert(storefrontRender.includes("image-studio") && storefrontRender.includes("image_generator"), "legacy image-studio and image_generator slugs must remain compatible");
assert(storefrontRender.includes("/dreamshoot/i.test"), "MyDreamShoots semantic aliases must stay scoped to MyDreamShoots sites");

console.log(JSON.stringify({
  ok: true,
  semanticToolLinks: expectedTools.length,
  uniqueSemanticSlugs: expectedTools.length,
  legacySlugs: ["image-studio", "image_generator"],
  dataFilesRequired: false
}, null, 2));
