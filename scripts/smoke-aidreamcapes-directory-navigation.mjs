import assert from "node:assert/strict";
import { buildSiteV2 } from "./lib/aidreamcapes-site-v2-content.mjs";
import { withAidreamcapesDirectoryNavigation } from "./lib/aidreamcapes-directory-navigation.mjs";
import { aidreamcapesActorBreadcrumbJsonLd } from "./lib/aidreamcapes-breadcrumb-taxonomy.mjs";

const navigation = buildSiteV2().navigation;
const video = navigation.menus.find((menu) => menu.label === "Video");
const image = navigation.menus.find((menu) => menu.label === "Image");
const resources = navigation.menus.find((menu) => menu.label === "Resources");
const videoItems = video.groups.flatMap((group) => group.items);
const imageItems = image.groups.flatMap((group) => group.items);
for (const [items, label, href] of [
  [videoItems, "Video Ads", "/ai-video-generation/video-ads"],
  [videoItems, "Product Video", "/ai-video-generation/product-video"],
  [videoItems, "Before & After Video", "/ai-video-generation/before-after-video"],
  [videoItems, "Spokesperson Video", "/ai-video-generation/spokesperson-video"],
  [imageItems, "White Background Photos", "/ai-image-generation/white-background-photos"],
  [imageItems, "Lifestyle Photos", "/ai-image-generation/lifestyle-photos"],
  [imageItems, "Model Photos", "/ai-image-generation/model-photos"],
  [imageItems, "Change Background", "/ai-image-generation/change-background"],
  [imageItems, "Social Ad Photos", "/ai-image-generation/social-ad-photos"]
]) assert(items.some((item) => item.label === label && item.href === href), `${label} must use ${href}`);
assert(resources.groups.flatMap((group) => group.items).some((item) => item.label === "Templates" && item.href === "/templates"));
assert.equal(image.hubLink.label, "All image tools →");
assert.equal(image.footerLink.label, "Browse all image templates →");
for (const href of ["/ai-video-generation/text-to-video", "/ai-video-generation/ai-twin"]) {
  assert.equal(video.groups.flatMap((group) => group.items).filter((item) => item.href === href).length, 1);
  assert.equal(navigation.footer.groups.find((group) => group.label === "Video").items.filter((item) => item.href === href).length, 1);
}
// The AI Actors mega-menu mirrors the Templates menu; the flat top-level link is gone.
const actorsMenu = navigation.menus.find((menu) => menu.label === "AI Actors");
assert(actorsMenu, "The AI Actors menu must exist");
assert.deepEqual(actorsMenu.groups.map((group) => group.items.length), [31, 2, 5], "The AI Actors menu shows 31 scenes, 2 genders and 5 age ranges.");
assert.equal(actorsMenu.groups[0].columns, "2", "The scene column renders in two sub-columns.");
assert.deepEqual(actorsMenu.groups[1].items.map((item) => item.href), ["/ai-actors/women", "/ai-actors/men"]);
assert.equal(actorsMenu.footerLink.href, "/ai-actors");
assert(!navigation.links.some((item) => item.href === "/ai-actors"), "AI Actors is a menu now, not a flat top-level link.");
assert(!video.groups.flatMap((group) => group.items).some((item) => item.href === "/ai-actors"));
// Every menu link opens a page that exists in the generated site.
const routeSet = new Set(buildSiteV2().pages.map((page) => page.slug));
for (const item of [...actorsMenu.groups.flatMap((group) => group.items), actorsMenu.footerLink]) {
  assert(routeSet.has(item.href), `AI Actors menu link opens a real page: ${item.href}`);
}
assert.deepEqual(actorsMenu.groups[0].items.map((item) => item.href).slice(0, 3), ["/ai-actors/scene/indoor", "/ai-actors/scene/home", "/ai-actors/scene/outdoor"]);
const current = structuredClone(navigation);
current.menus[0].groups[0].items[0].description = "An online edit to preserve.";
const repaired = withAidreamcapesDirectoryNavigation(current);
assert.deepEqual(repaired, current, "The repair is idempotent and preserves existing online fields.");
const missing = structuredClone(current);
missing.menus[0].groups[0].items = missing.menus[0].groups[0].items.filter((item) => item.href !== "/ai-video-generation/ai-twin");
const result = withAidreamcapesDirectoryNavigation(missing);
assert.equal(result.menus[0].groups[0].items.length, current.menus[0].groups[0].items.length);
assert.equal(result.menus[0].groups[0].items[0].description, "An online edit to preserve.");
assert.deepEqual(result.menus.slice(1), current.menus.slice(1));
const graph = { "@graph": [{ "@type": "Organization", name: "AIVideosUGC" }, { "@type": "BreadcrumbList", itemListElement: [{ name: "Home" }, { name: "AI Video Generation" }, { name: "AI Actors" }] }] };
const repairedGraph = aidreamcapesActorBreadcrumbJsonLd(graph);
assert.deepEqual(repairedGraph["@graph"][0], graph["@graph"][0]);
assert.deepEqual(repairedGraph["@graph"][1].itemListElement.map((item) => item.item), ["https://www.aivideosugc.com/", "https://www.aivideosugc.com/ai-actors"]);
assert.equal(graph["@graph"][1].itemListElement.length, 3, "The JSON-LD repair does not mutate its input.");
console.log("PASS: generated Aidreamcapes menu labels match their canonical routes, and navigation updates preserve online edits.");
