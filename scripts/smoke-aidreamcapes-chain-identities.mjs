import assert from "node:assert/strict";
import { aidreamcapesAuditLoader } from "./lib/aidreamcapes-typescript-audit-loader.mjs";

const rows = [];
const load = aidreamcapesAuditLoader({
  "@/lib/prisma": { prisma: { $queryRaw: async (_sql, ...args) => {
    const slug = args.find((arg) => typeof arg === "string" && arg !== "site_aidreamcapes");
    return rows.filter((row) => row.contentJson.sections.main.settings.data.visual.picker.cards.some((card) => card.publicSlug === slug));
  } } },
  "@/lib/stores/storefront-profile-store": {}
});
const { latestAidreamcapesArticles } = load("src/components/storefront/aidreamcapes-v2/latest-articles.ts");
const content = { sectionsOrder: ["main"], sections: { main: { type: "aidreamcapes_v2_page", settings: { layout: "article", data: { h1: "A current article" } } } } };
const current = { slug: "/blog/current-article", title: "Current", pageType: "article", liveContentJson: content };
assert.deepEqual(latestAidreamcapesArticles([
  { ...current, slug: "/blog/motion-generator-video-guide" },
  { ...current, slug: "/blog/ai-content-disclosure-safe-usage" },
  { ...current, slug: "/blog/empty", liveContentJson: {} }, current, current
]), [{ href: current.slug, title: "A current article" }]);

const { resolveMediaDetail } = load("src/lib/aidreamcapes-workspace/media-detail.server.ts");
const row = (slug, card) => ({ slug, updatedAt: new Date("2026-10-22"), contentJson: { sectionsOrder: ["main"], sections: { main: { type: "aidreamcapes_v2_page", settings: { data: { visual: { picker: { cards: [card] } } } } } } } });
const card = { kind: "video", label: "App demo", prompt: "Demonstrate the app", href: "/app/create/tool/video-ads", image: { src: "/ai-image-generation/app.webp", w: 640, h: 640 }, publicSlug: "app-demo" };
rows.push(row("/owner", card), row("/copy", { ...card, publicSlug: "app-demo-copy", sceneSlug: "old-scene", detailAliasOf: "app-demo" }));
assert.equal((await resolveMediaDetail("video", "app-demo-copy"))?.slug, "app-demo");
const copy = rows[1].contentJson.sections.main.settings.data.visual.picker.cards[0];
copy.prompt = "An online edit with a different prompt";
assert.equal((await resolveMediaDetail("video", "app-demo-copy"))?.slug, "app-demo-copy");
copy.prompt = card.prompt;
copy.video = { src: "/ai-video-generation/different.mp4" };
assert.equal((await resolveMediaDetail("video", "app-demo-copy"))?.slug, "app-demo-copy");
delete copy.video;
card.detailAliasOf = "app-demo-copy";
assert.equal((await resolveMediaDetail("video", "app-demo-copy"))?.slug, "app-demo-copy");
card.detailAliasOf = "nonexistent";
assert.equal((await resolveMediaDetail("video", "app-demo"))?.slug, "app-demo");
console.log(JSON.stringify({ ok: true, checks: ["retired article exclusions", "renderable articles only", "unique article links", "reviewed equivalent alias", "online edit keeps original preset", "different video is not merged", "cycles rejected", "missing target keeps original"] }, null, 2));
