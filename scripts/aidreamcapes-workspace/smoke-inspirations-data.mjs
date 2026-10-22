import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

// Offline regression for tenant ownership and immediate relational media edits.
// The loader runs unchanged; only its database is replaced with current rows.
const require = createRequire(import.meta.url);
const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.join(root, "scripts/data/aidreamcapes-site-v2/media-catalog.json"), "utf8"));
const ref = `n:${Object.keys(catalog.gen)[0]}`;
const page = (slug, cards) => ({ slug, title: "Product examples", contentJson: {
  sectionsOrder: ["examples"], sections: { examples: { type: "aidreamcapes_v2_page", settings: {
    data: { visual: { picker: { lead: "Explore product looks.", cards } } },
  } } },
} });
const original = { ref, label: "Current product look", prompt: "Generation instructions stay out of visible copy.", image: { src: "/media/site_aidreamcapes/current-look.webp", alt: "Current product reference" }, publicSlug: "current-product-look" };
let rows = [page("/ai-video-generation/product-video", [original])];
let reads = 0;
const compiled = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(path.join(root, "src/lib/aidreamcapes-inspirations.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const scopedRequire = (id) => {
  if (id === "@/lib/prisma") return { prisma: { livePage: { findMany: async (query) => {
    reads++;
    assert.equal(query.where.siteId, "site_aidreamcapes", "Every read has an explicit Aidreamcapes owner");
    assert.deepEqual(query.select, { slug: true, title: true, contentJson: true });
    assert.deepEqual(query.orderBy, { slug: "asc" }, "Shared references have a stable source order");
    return rows;
  } } } };
  if (id === "@/lib/aidreamcapes-inspirations-types") return {};
  return require(id);
};
new Function("require", "module", "exports", code)(scopedRequire, compiled, compiled.exports);
const { getAidreamcapesInspirationCards } = compiled.exports;
const first = await getAidreamcapesInspirationCards();
assert.equal(first.length, 1);
assert.equal(first[0].imageSrc, original.image.src, "Current LivePage image wins over the older media catalog reference");
assert.equal(first[0].imageAlt, original.image.alt);
assert.equal(first[0].description, "Explore product looks.");
assert.equal(first[0].kind, "video");
assert.equal(first[0].publicSlug, original.publicSlug);
rows = [page("/ai-video-generation/product-video", [{ ...original, image: { src: "/media/site_aidreamcapes/edited-now.webp", alt: "Edited now" } }])];
const updated = await getAidreamcapesInspirationCards();
assert.equal(updated[0].imageSrc, "/media/site_aidreamcapes/edited-now.webp", "The next request sees a committed current image without publication/cache refresh");
assert.equal(reads, 2);
rows = [page("/ai-image-generation/product-photos", [{ ...original, ref: undefined }]), ...rows];
assert.equal((await getAidreamcapesInspirationCards()).some((card) => card.kind === "photo" && card.imageSrc === original.image.src), true, "Current image-only rows need no historical/catalog fallback");
rows = [];
assert.deepEqual(await getAidreamcapesInspirationCards(), [], "Missing current rows stay empty");
rows = [page("/ai-image-generation/product-photos", [{ ...original, kind: "video" }])];
assert.equal((await getAidreamcapesInspirationCards())[0].kind, "video", "A current video example reused on a photo page keeps its own media kind and creation route");
rows = [page("/ai-video-generation/product-video", [{ ...original, kind: "photo" }])];
assert.equal((await getAidreamcapesInspirationCards())[0].kind, "photo", "A current photo example reused on a video page keeps its own media kind");
console.log("PASS: independent gallery reads only site_aidreamcapes LivePage rows; current images override catalog references and update on the next read.");
