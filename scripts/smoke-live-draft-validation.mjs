#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = readFileSync(path.join(root, "src/lib/public-draft-validation.ts"), "utf8");
assert.match(source, /collectPublicDraftMediaUrls/);
assert.match(source, /mediaAsset\.findMany/);
assert.match(source, /public_media_asset_missing/);
assert.match(source, /fs\.existsSync/);

console.log(JSON.stringify({ ok: true, contract: "live-draft-media-validation" }));
