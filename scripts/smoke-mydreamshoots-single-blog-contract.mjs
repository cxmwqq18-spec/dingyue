#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const route = fs.readFileSync(path.resolve("src/app/[...path]/page.tsx"), "utf8");

assert.match(route, /"video-photo-package-guide": "\/blog\/talking-photo-video-guide"/,
  "the retired photo-package URL must permanently redirect to Talking Photo");
assert.match(route, /"ai-video-add-ons": "\/blog\/motion-generator-video-guide"/,
  "the valid legacy video category alias must point to Motion Generator");
assert.match(route, /"image-to-video": "\/blog\/motion-generator-video-guide"/,
  "the image-to-video alias must point to Motion Generator");
assert.doesNotMatch(
  route,
  /MDS_SOCCER_MIGRATION_APPROVED/,
  "the deleted World Cup article must not retain an environment-dependent redirect"
);

console.log(JSON.stringify({ ok: true, contract: "mydreamshoots-single-blog-404" }, null, 2));
