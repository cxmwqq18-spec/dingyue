#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "src/lib/mydreamshoots-homepage-showcase.ts"), "utf8");
const entries = [...source.matchAll(/"(\/ai-video-generation\/[^"]+)":\s*"(\/assets\/[^"]+)"/g)]
  .map(([, canonicalPath, imageUrl]) => ({ canonicalPath, imageUrl }));

assert.equal(entries.length, 9, "homepage must lock exactly nine video covers");
assert.equal(new Set(entries.map((entry) => entry.canonicalPath)).size, entries.length, "homepage video paths must be unique");
assert.equal(new Set(entries.map((entry) => entry.imageUrl)).size, entries.length, "homepage video covers must be unique");

for (const entry of entries) {
  assert.ok(fs.existsSync(path.join(root, "public", entry.imageUrl)), `${entry.canonicalPath} cover must exist: ${entry.imageUrl}`);
}

console.log(JSON.stringify({ ok: true, check: "mydreamshoots-homepage-video-covers", entries }, null, 2));
