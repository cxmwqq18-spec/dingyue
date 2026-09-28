#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const deployScript = fs.readFileSync("scripts/deploy-aidreamshoots-eu-release.mjs", "utf8");
const targets = [
  "public/assets/sites/site_aidreamcapes_eu/",
  "public/assets/sites/site_aidreamshoots/"
];

assert.match(deployScript, /const fullAssets = hasArgument\("--full-assets"\)/, "deploy script must expose --full-assets");
assert.match(deployScript, /if \(fullAssets\) archivePaths\.push\(config\.assetPrefix\)/, "--full-assets must include the target asset root in the archive");

const reports = targets.map((prefix) => {
  const options = { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 };
  const tracked = execFileSync("git", ["ls-files", "--", prefix], options).trim().split("\n").filter(Boolean);
  // `git archive HEAD -- <prefix>` uses the same path selection as this tree listing,
  // without materializing a multi-gigabyte archive just to inspect its entries.
  const archive = execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD", "--", prefix], options).trim().split("\n").filter(Boolean);
  assert(tracked.length > 0, `${prefix}: no tracked assets`);
  assert.equal(archive.length, tracked.length, `${prefix}: git archive does not contain every tracked asset`);
  return { prefix, trackedFiles: tracked.length, archiveFiles: archive.length };
});

console.log(JSON.stringify({ ok: true, targets: reports }, null, 2));
