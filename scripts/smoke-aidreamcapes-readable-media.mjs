import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readableMediaTarget, READABLE_STATIC_RE } from "./lib/aidreamcapes-readable-media.mjs";
import { updateConfig } from "./configure-aidreamcapes-static-media-nginx.mjs";

const names = new Set();
const image = readableMediaTarget("/assets/sites/site_aidreamcapes/public-media/site-v2/guide/img1-home-steps-result-r1--640--sha256-6264784c9739e4cd93648cf7aad9daf7a2f61b2eff003073ad55f8dc58aad401.webp", "webp", false, names);
assert.deepEqual(image, { targetUrl: "/ai-image-generation/img1-home-steps-result-r1-640.webp", relativeOutput: "image/img1-home-steps-result-r1-640.webp" });
const collision = readableMediaTarget("/assets/sites/site_aidreamcapes/public-media/other/IMG1 home steps result r1 640.webp", "webp", false, names);
assert.equal(collision.targetUrl, "/ai-image-generation/img1-home-steps-result-r1-640-2.webp");
const video = readableMediaTarget("/assets/sites/site_aidreamcapes/public-media/site-v2/clips/black-friday-countdown--sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.mp4", "mp4", false, names);
assert.deepEqual(video, { targetUrl: "/ai-video-generation/black-friday-countdown.mp4", relativeOutput: "video/black-friday-countdown.mp4" });
const actor = readableMediaTarget("/assets/sites/site_aidreamcapes/public-media/site-v2/actors/maya-avatar--sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp", "webp", true, names);
assert.deepEqual(actor, { targetUrl: "/ai-image-generation/actors/maya-avatar.webp", relativeOutput: "actor/maya-avatar.webp" });
const actorAudio = readableMediaTarget("/assets/sites/site_aidreamcapes/workspace/actors/voices/maya--sha256-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.mp3", "mp3", true, names);
assert.deepEqual(actorAudio, { targetUrl: "/ai-actors/maya.mp3", relativeOutput: "actor/maya.mp3" });
assert.equal(READABLE_STATIC_RE.test(image.targetUrl), true);
assert.equal(READABLE_STATIC_RE.test(video.targetUrl), true);
assert.equal(READABLE_STATIC_RE.test(actor.targetUrl), true);
assert.equal(/sha256|[a-f0-9]{32,}/i.test(`${image.targetUrl}${video.targetUrl}${actor.targetUrl}${actorAudio.targetUrl}`), false);
const fixture = `server {\n    listen 443 ssl;\n    server_name www.aivideosugc.com;\n    location /assets/ { proxy_pass http://127.0.0.1:3010; }\n    location / { proxy_pass http://127.0.0.1:3010; }\n}\n`;
const configured = updateConfig(fixture);
assert.equal(configured.changed, true);
for (const fragment of [
  "/ai-image-generation/actors/", "/ai-image-generation/", "/ai-video-generation/actors/",
  "/ai-video-generation/", "/ai-actors/", "/shared/sites/public-media/actor/$1",
  "/shared/sites/public-media/image/$1", "/shared/sites/public-media/video/$1",
]) assert.equal(configured.source.includes(fragment), true, `missing Nginx route: ${fragment}`);
assert.equal(updateConfig(configured.source).changed, false, "Nginx readable routes should be idempotent");
const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.join(root, "src/lib/aidreamcapes-workspace/actors.json"), "utf8"));
assert.equal(catalog.actors.length, 53);
for (const entry of catalog.actors) {
  assert.equal(entry.imageUrl, `/ai-image-generation/actors/${entry.actorId}.webp`);
  assert.equal(entry.voice.refAudio, `/ai-actors/${entry.actorId}.mp3`);
  assert.equal(fs.existsSync(path.join(root, "public/media/site_aidreamcapes/workspace/actors/library", `${entry.actorId}.webp`)), true);
  assert.equal(fs.existsSync(path.join(root, "public/assets/sites/site_aidreamcapes/workspace/actors/voices", `${entry.actorId}.mp3`)), true);
}
console.log(JSON.stringify({ ok: true, cases: 70, builtinActors: catalog.actors.length }));
