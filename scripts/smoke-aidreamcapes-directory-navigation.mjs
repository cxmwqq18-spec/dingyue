import assert from "node:assert/strict";
import { buildSiteV2 } from "./lib/aidreamcapes-site-v2-content.mjs";
import { withAidreamcapesDirectoryNavigation } from "./lib/aidreamcapes-directory-navigation.mjs";

const navigation = buildSiteV2().navigation;
const video = navigation.menus.find((menu) => menu.label === "Video");
for (const href of ["/text-to-video", "/ai-twin"]) {
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
missing.menus[0].groups[0].items = missing.menus[0].groups[0].items.filter((item) => item.href !== "/ai-twin");
const result = withAidreamcapesDirectoryNavigation(missing);
assert.equal(result.menus[0].groups[0].items.length, current.menus[0].groups[0].items.length);
assert.equal(result.menus[0].groups[0].items[0].description, "An online edit to preserve.");
assert.deepEqual(result.menus.slice(1), current.menus.slice(1));
console.log("PASS: generated and incremental Aidreamcapes navigation retain Text to Video, AI Twin and top-level AI Actors without replacing online edits.");
