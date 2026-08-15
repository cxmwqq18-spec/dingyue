#!/usr/bin/env node
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    shell: false,
    ...options
  });
  if (result.status !== 0) fail(`${command} ${args.join(" ")} failed.`);
}

function git(args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function assertCleanGit() {
  const status = git(["status", "--porcelain"]);
  if (status) {
    fail("Release precheck requires a clean git working tree. Commit code and manifest before releasing.");
  }
}

function readManifest(filePath) {
  if (!filePath) fail("release:precheck requires --manifest=releases/manifests/<release>.json.");
  if (!fs.existsSync(filePath)) fail(`Release manifest not found: ${filePath}`);
  const manifest = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (manifest.workingTreeDirty) {
    fail("Release manifest was exported from a dirty working tree. Re-export it from a committed baseline.");
  }
  const currentCommit = git(["rev-parse", "HEAD"]);
  if (manifest.codeCommit !== currentCommit) {
    fail(`Release manifest codeCommit ${manifest.codeCommit} does not match current HEAD ${currentCommit}.`);
  }
  if (!Array.isArray(manifest.sites) || manifest.sites.length !== 1) {
    fail("Release manifest must target exactly one site.");
  }
  if (!Array.isArray(manifest.scope) || !manifest.scope.includes("public-content")) {
    fail("Release manifest must include public-content scope.");
  }
  return manifest;
}

const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const manifestPath = argumentValue("--manifest");
const skipLive = hasArgument("--skip-live");

assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: target === "production",
  productionConfirmed: hasArgument("--confirm-production")
});

if (target !== "local") {
  fail("release:precheck is a local release gate. Use release:content-plan/apply explicitly for test or production.");
}

assertCleanGit();
const manifest = readManifest(manifestPath);

run(process.execPath, ["scripts/release-content.mjs", "--mode=plan", "--target=local", `--manifest=${manifestPath}`]);
run("npm", ["run", "typecheck"]);
run("npm", ["run", "build"]);
run("npm", ["run", "smoke:database-target-isolation"]);
run(process.execPath, ["scripts/smoke-mydreamshoots-video-framework.mjs"]);

if (!skipLive) {
  if (!process.env.SMOKE_BASE_URL) {
    fail("Set SMOKE_BASE_URL for live storefront smoke checks or pass --skip-live for local-only precheck.");
  }
  run(process.execPath, ["scripts/smoke-storefront-header-layout.mjs"]);
  run(process.execPath, ["scripts/smoke-storefront-public-routes.mjs"]);
  run(process.execPath, ["scripts/smoke-storefront-navigation-data.mjs"]);
}

console.log(JSON.stringify({
  ok: true,
  target,
  releaseId: manifest.releaseId,
  codeCommit: manifest.codeCommit,
  manifestHash: manifest.manifestHash,
  liveSmokes: !skipLive
}, null, 2));
