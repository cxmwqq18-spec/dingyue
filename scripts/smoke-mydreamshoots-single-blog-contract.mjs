#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const route = fs.readFileSync(path.resolve("src/app/[...path]/page.tsx"), "utf8");

assert.match(route, /"ai-video-add-ons": "\/blog\/video-photo-package-guide"/,
  "the valid legacy category alias must still point to the retained article");
assert.doesNotMatch(
  route,
  /MDS_SOCCER_MIGRATION_APPROVED/,
  "the deleted World Cup article must not retain an environment-dependent redirect"
);

console.log(JSON.stringify({ ok: true, contract: "mydreamshoots-single-blog-404" }, null, 2));
