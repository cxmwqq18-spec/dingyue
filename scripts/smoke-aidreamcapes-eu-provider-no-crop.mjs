#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const files = [
  "scripts/generate-aidreamcapes-eu-save-the-date-vendor-assets.mjs",
  "scripts/generate-aidreamcapes-eu-valentines-vendor-assets.mjs",
  "scripts/generate-aidreamcapes-eu-wedding-invitation-vendor-assets.mjs",
  "scripts/normalize-aidreamcapes-eu-image-pack-assets-local.mjs",
  "scripts/repair-aidreamcapes-eu-provider-media-local.mjs"
];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  assert.equal(/fit:\s*["']cover["']/.test(source), false, `${file} must not crop provider assets`);
}

const helper = fs.readFileSync("scripts/lib/provider-image-output.mjs", "utf8");
assert.match(helper, /writeFile\(originalPath, buffer, \{ flag: "wx" \}\)/);
assert.match(helper, /fit: "inside"/);
assert.match(helper, /provider_image_unknown_format/);
console.log(`aidreamcapes-eu provider no-crop guard passed (${files.length} scripts)`);
