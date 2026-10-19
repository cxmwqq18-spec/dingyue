import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contract = await import(path.join(root, "src/lib/aidreamcapes-workspace/preset-contract.ts"));
const { pickerPresetHref, pickerPresetId, presetSourcePage } = contract;

function card({ kind = "video", src = "/media/site_aidreamcapes/demo/tote.jpg", label = "Canvas tote creator ad", prompt = "A creator shows this canvas tote on a sunny walk." } = {}) {
  return { kind, image: { src, w: 900, h: 1200 }, label, prompt, href: "https://www.aivideosugc.com/app/create?tool=video-ads&template=creator&nextHash=step-video" };
}

const videoCard = card();
const photoCard = card({ kind: "photo", src: "/media/site_aidreamcapes/demo/tote-photo.jpg", label: "Canvas tote lifestyle photo", prompt: "A canvas tote rests on a sunlit table." });
const shortVideoCard = { ...videoCard, publicSlug: "canvas-tote-creator-ad" };
const shortPhotoCard = { ...photoCard, publicSlug: "canvas-tote-lifestyle-photo" };
const videoHref = pickerPresetHref(videoCard, "/");
const photoHref = pickerPresetHref(photoCard, "/ai-image-generation/lifestyle-scene/");
const videoUrl = new URL(videoHref, "https://www.aivideosugc.com");
const photoUrl = new URL(photoHref, "https://www.aivideosugc.com");

assert.equal(videoUrl.origin, "https://www.aivideosugc.com");
assert.equal(videoUrl.pathname, "/app/create");
assert.deepEqual([...videoUrl.searchParams.keys()].sort(), ["preset", "source"]);
assert.equal(videoUrl.searchParams.get("source"), "/");
assert.equal(videoUrl.searchParams.get("preset"), pickerPresetId(videoCard));
assert.doesNotMatch(videoHref, /creator|nextHash|prompt|sunny|tote/i);

assert.equal(photoUrl.origin, "https://www.aivideosugc.com");
assert.equal(photoUrl.pathname, "/app/create");
assert.equal(photoUrl.searchParams.get("source"), "/ai-image-generation/lifestyle-scene");
assert.equal(photoUrl.searchParams.get("preset"), pickerPresetId(photoCard));
assert.notEqual(pickerPresetId(videoCard), pickerPresetId(photoCard));
assert.equal(pickerPresetHref(shortVideoCard, "/"), "/videos/canvas-tote-creator-ad");
assert.equal(pickerPresetHref(shortPhotoCard, "/ai-image-generation/lifestyle-scene/"), "/images/canvas-tote-lifestyle-photo");
assert.equal(pickerPresetHref({ ...shortVideoCard, publicSlug: "bad/slug" }, "/"), videoHref);

const otherCardWithSameLegacyHref = card({ src: "/media/site_aidreamcapes/demo/shoes.jpg", label: "Trail shoe street ad" });
assert.equal(otherCardWithSameLegacyHref.href, videoCard.href);
assert.notEqual(pickerPresetId(otherCardWithSameLegacyHref), pickerPresetId(videoCard));
const otherPresetHref = new URL(pickerPresetHref(otherCardWithSameLegacyHref, "/"), "https://www.aivideosugc.com");
assert.notEqual(otherPresetHref.searchParams.get("preset"), videoUrl.searchParams.get("preset"));

assert.equal(pickerPresetHref(videoCard, undefined), videoCard.href);
assert.equal(pickerPresetHref({ ...videoCard, href: "/templates" }, "/"), "/templates");
assert.equal(pickerPresetHref({ ...videoCard, href: "https://example.com/app/create?tool=video-ads" }, "/"), "https://example.com/app/create?tool=video-ads");
assert.equal(pickerPresetHref({ ...videoCard, href: "https://aivideosugc.com/app/other" }, "/"), "https://aivideosugc.com/app/other");

for (const invalid of ["https://evil.example/path", "//evil.example/path", "/a/../b", "/a/%2e%2e/b", "/a%2fb", "/a%5cb", "/a?x=1", "/a#part", "/a b", "\\evil.example\\x"]) {
  assert.equal(presetSourcePage(invalid), undefined, `unsafe source should be rejected: ${invalid}`);
}
assert.equal(presetSourcePage("/catalog/category///"), "/catalog/category");
assert.equal(presetSourcePage("/"), "/");

const pageSource = await readFile(path.join(root, "src/components/storefront/aidreamcapes-v2/page.tsx"), "utf8");
const visualSource = await readFile(path.join(root, "src/components/storefront/aidreamcapes-v2/visual.tsx"), "utf8");
assert.match(pageSource, /if \(data\.id === "home"\) return "\/"/);
assert.match(pageSource, /data\.breadcrumbs\.at\(-1\)\?\.href/);
assert.match(pageSource, /return presetSourcePage\(lastHref\)/);
assert.match(visualSource, /<a className="v-pick-card"[^\n]*href=\{r\.href\(pickerPresetHref\(card, sourcePage\)\)\}/);
assert.doesNotMatch(visualSource, /use client/);

console.log("Aidreamcapes template-link smoke passed (video/photo IDs, privacy, legacy links, source safety, first-party targets, SSR anchors).");
