#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const actors = JSON.parse(await fs.readFile(path.join(root, "src/lib/aidreamcapes-workspace/actors.json"), "utf8")).actors;
const manifest = JSON.parse(await fs.readFile(path.join(root, "scripts/aidreamcapes-workspace/actor-voice-assets.json"), "utf8")).actors;
const prefix = "/assets/sites/site_aidreamcapes/workspace/actors/voices/";
assert.equal(actors.length, 53, "Expected exactly 53 Aidreamcapes actor records.");
assert.equal(Object.keys(manifest).length, actors.length, "Voice manifest must cover every actor.");
const ids = new Set();
let totalBytes = 0;
for (const actor of actors) {
  assert(!ids.has(actor.actorId), `Duplicate actor ID: ${actor.actorId}`);
  ids.add(actor.actorId);
  const url = actor.voice?.refAudio;
  assert.equal(url, `${prefix}${actor.actorId}.mp3`, `${actor.actorId}: expected stable static voice URL.`);
  assert.equal(manifest[actor.actorId]?.assetUrl, url, `${actor.actorId}: voice manifest URL mismatch.`);
  const audioPath = path.join(root, "public", url.slice(1));
  const bytes = await fs.readFile(audioPath);
  assert(bytes.length > 4096, `${actor.actorId}: audio file is empty or truncated.`);
  assert.equal(bytes.subarray(0, 3).toString("ascii"), "ID3", `${actor.actorId}: expected MP3 ID3 header.`);
  assert.equal(bytes.length, manifest[actor.actorId].bytes, `${actor.actorId}: manifest byte size mismatch.`);
  totalBytes += bytes.length;
}
console.log(`PASS: ${actors.length} Aidreamcapes voice assets use public /assets URLs; ${totalBytes} bytes verified.`);
