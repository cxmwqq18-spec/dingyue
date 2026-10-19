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
  [videoItems, "Product Videos", "/ai-video-generation/product-videos"],
  [videoItems, "Before & After Videos", "/ai-video-generation/before-after-videos"],
  [videoItems, "Spokesperson Videos", "/ai-video-generation/spokesperson-videos"],
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
assert(navigation.links.some((item) => item.href === "/ai-actors"));
assert(!video.groups.flatMap((group) => group.items).some((item) => item.href === "/ai-actors"));
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
