#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./generate-mydreamshoots-theme-galleries.mjs", import.meta.url), "utf8");

assert.match(source, /THEME_GALLERY_MAX_PAID_CREATES \?\? "1"/, "paid image generation must default to one create");
assert.match(source, /const maxAttempts = 1;/, "paid image generation must not retry creates");
assert.match(source, /Idempotency-Key/, "paid image generation must send an idempotency key");
assert.match(source, /one continuous edge-to-edge photograph/, "each gallery asset must be independently generated");
assert.match(source, /Avoid: contact sheets, collages, grids, split screens/, "prompts must forbid collages and split layouts");
assert.doesNotMatch(source, /function cropContactSheet/, "gallery generation must not crop contact sheets into fake images");
assert.doesNotMatch(source, /Layout: exactly four distinct image examples/, "gallery prompts must not request contact sheets");
assert.match(source, /stagedGalleryPath/, "paid results must be staged for recovery before replacing live assets");
assert.match(source, /createReceipts/, "paid create request ids must be persisted in the generation manifest");
assert.match(source, /stagedReceiptPath/, "paid create request ids must be persisted incrementally");
assert.match(source, /Refusing to exceed estimated budget/, "paid generation must enforce the approved estimated budget");
assert.match(source, /if \(applyDb\)/, "database media URLs must only change through an explicit apply flag");

console.log(JSON.stringify({ ok: true, createsPerTheme: 12, maxAttemptsPerCreate: 1, defaultPaidCreateCap: 1 }, null, 2));
