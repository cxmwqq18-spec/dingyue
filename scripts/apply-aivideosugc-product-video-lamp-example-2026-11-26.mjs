#!/usr/bin/env node
// Add the 15-second orange glass ring lamp clip to the Product Video tool page
// as a public video example.
//
// The clip lives beside the page as a committed public asset:
//   public/assets/sites/site_aidreamcapes/examples/orange-glass-ring-lamp-glow.mp4
// and the page receives one `examples` group in LivePage.contentJson. Nothing
// else in the page changes; the detail/watch pages are derived from this card.
//
//   node scripts/apply-aivideosugc-product-video-lamp-example-2026-11-26.mjs
//   node scripts/apply-aivideosugc-product-video-lamp-example-2026-11-26.mjs --apply-production \
//     --confirm=product-video-lamp-example-2026-11-26
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=product-video-lamp-example-2026-11-26");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUG = "/ai-video-generation/product-video";
const TITLE = "Orange Glass Ring Lamp Glow";
const MEDIA_SLUG = "orange-glass-ring-lamp-glow";
const ASSET_BASE = `/assets/sites/site_aidreamcapes/examples/${MEDIA_SLUG}`;
const POSTER = `${ASSET_BASE}-poster.webp`;
const PROMPT = `15 seconds, 9:16 vertical, realistic handheld phone UGC. A single 12-inch round orange glass ring lamp with a glossy translucent shell and a rear cord rests on a dark wood sideboard in a softly lit room. Keep the ring shape, orange glass, gloss, rear cord and single-lamp quantity identical in every shot; never add a second lamp or change the design. Same adult demonstrator in cream sleeves, cool dusk light from the right, cabinet-height table scene.

00-03 s At cabinet height, establish the unlit ring flat on the surface. Left hand rests beside it, right hand reaches behind the lower housing toward the rear cord area. Voiceover "This corner felt a little flat."

03-07 s Drop lower on the same side, matching the same hands. Slide the switch by the rear cord exit; the orange light comes on, base and cord fixed, exposure locked. No dialogue.

07-12 s Cut to a three-quarter medium close-up with the lit ring and both hands in place. Withdraw the hands to reveal the warm spill on the wall and table. Voiceover "That orange glow is the whole point."

12-15 s Hold the glowing ring from the same angle, ending on two seconds of room tone. No dialogue.

Use a natural English pace. Sync action sounds to contact and leave audible gaps. Keep music low. No captions, overlays, price stickers, watermark or end card.`;

const ALT = "Warm orange glass ring lamp glowing on a dark wood sideboard in a softly lit room.";
const DESCRIPTION = "A 15-second vertical product demo: an orange glass ring lamp is switched on and casts a warm pool of light across a dark wood sideboard.";

const card = {
  key: `example-product-video-${MEDIA_SLUG}`,
  title: TITLE,
  product: "Orange glass ring lamp",
  kind: "clip",
  href: `/ai-video-generation/${MEDIA_SLUG}`,
  mediaRef: MEDIA_SLUG,
  image: { src: POSTER, alt: ALT, w: 640, h: 1138 },
  prompt: PROMPT,
  aspect: "9:16",
  duration: 15,
  video: {
    src: `${ASSET_BASE}.mp4`,
    width: 720,
    height: 1280,
    duration: 15,
    previewSrc: `${ASSET_BASE}-p10.mp4`,
    poster: { src: POSTER, alt: ALT },
    name: TITLE,
    description: DESCRIPTION,
    publishedAt: "2026-11-26T14:50:00.000Z"
  }
};

const examples = {
  h2: "Product Video examples",
  lead: "One clear product action can carry a short vertical demo. This clip switches a lamp on and lets the warm light do the rest.",
  groups: [{ label: "Product demo", items: [card] }]
};

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

const prisma = new PrismaClient();
try {
  const row = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: SLUG } } });
  assert.ok(row, `${SLUG} is missing`);
  const content = row.contentJson;
  const data = content?.sections?.v2_main?.settings?.data;
  assert.ok(data, `${SLUG} has no v2_main settings data`);
  assert.equal(data.h1, "AI Product Video Generator From a Link or Photo", `${SLUG} h1 drifted`);
  assert.equal(data.examples ?? null, null, `${SLUG} already has an examples block; refusing to overwrite`);

  const next = structuredClone(content);
  next.sections.v2_main.settings.data.examples = examples;
  const before = hash(content);
  const after = hash(next);

  console.log(JSON.stringify({
    slug: SLUG,
    title: TITLE,
    card: { key: card.key, href: card.href, video: card.video.src },
    applying,
    before,
    after
  }, null, 2));

  if (!applying) process.exit(0);

  const updated = await prisma.livePage.updateMany({
    where: { siteId: SITE_ID, id: row.id, updatedAt: row.updatedAt },
    data: { contentJson: next }
  });
  assert.equal(updated.count, 1, `${SLUG} changed while applying; retry`);

  const readback = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: SLUG } }, select: { contentJson: true } });
  assert.equal(hash(readback.contentJson), after, `${SLUG} readback does not match the manifest`);
  console.log(JSON.stringify({ ok: true, slug: SLUG, examples: readback.contentJson.sections.v2_main.settings.data.examples.groups[0].items.length }));
} finally {
  await prisma.$disconnect();
}
