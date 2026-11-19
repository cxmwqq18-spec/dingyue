#!/usr/bin/env node
/**
 * Build the Aidreamcapes storefront on this machine and mark it for the
 * prebuilt release path.
 *
 * Why this exists: the release host shares 15.9GB of RAM with five live
 * storefront services, and the current storefront build needs more heap than
 * the host can back. Building here (with the production env values inlined)
 * and uploading the artifact keeps releases possible without putting memory
 * pressure on production traffic.
 *
 *   node scripts/build-aidreamcapes-prebuilt.mjs --commit=<40-character SHA>
 *
 * Then:
 *
 *   node scripts/deploy-aidreamcapes-release.mjs --commit=<SHA> \
 *     --prebuilt-build=.next-build --apply --confirm=deploy-aidreamcapes
 *
 * The production env file is read over SSH and only kept in memory, so
 * NEXT_PUBLIC_* values and the database URL match what the server build uses.
 * The tracked tree must be clean: the artifact is built from this checkout, so
 * an uncommitted edit would otherwise ship code that is not in the commit.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import "./load-runtime-env.mjs";

const args = process.argv.slice(2);
const value = (key) => args.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1);
const root = "/www/wwwroot/aidreamcapes.com";
const connection = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=6", "-o", "Compression=yes"];
if (process.env.SSH_CONFIG_PATH) connection.push("-F", process.env.SSH_CONFIG_PATH);
if (process.env.AI_PROJECT_SSH_KEY_PATH) connection.push("-i", process.env.AI_PROJECT_SSH_KEY_PATH);
if (process.env.AI_PROJECT_SSH_CONTROL_PATH) connection.push("-o", `ControlPath=${process.env.AI_PROJECT_SSH_CONTROL_PATH}`);
const port = process.env.AI_PROJECT_SSH_PORT || "11765";
const host = `root@${process.env.AI_PROJECT_SSH_HOST || "204.77.130.125"}`;
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
const git = (...argv) => execFileSync("git", argv, { encoding: "utf8" }).trim();

const commit = value("--commit") || git("rev-parse", "HEAD");
assert(/^[a-f0-9]{40}$/.test(commit), "Supply the exact pushed --commit=<40-character SHA>");
assert.equal(git("rev-parse", "HEAD"), commit, "The checkout is not at the requested commit");
assert.equal(git("rev-parse", "origin/main"), commit, "The requested commit must be origin/main");
assert.equal(git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0], commit, "GitHub main must contain this exact commit");
assert.equal(git("status", "--porcelain", "--untracked-files=no"), "", "A prebuilt artifact is built from this checkout; commit or stash tracked changes first");

function parseEnv(source) {
  const env = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const index = normalized.indexOf("=");
    if (index <= 0) continue;
    const key = normalized.slice(0, index).trim();
    let entry = normalized.slice(index + 1).trim();
    if ((entry.startsWith('"') && entry.endsWith('"')) || (entry.startsWith("'") && entry.endsWith("'"))) entry = entry.slice(1, -1);
    if (key) env[key] = entry;
  }
  return env;
}

const remote = spawnSync("ssh", ["-p", port, ...connection, host, `cat ${quote(`${root}/current/.env.local`)}`], { encoding: "utf8" });
assert.equal(remote.status, 0, `Unable to read the production env file: ${(remote.stderr || "").trim()}`);
const productionEnv = parseEnv(remote.stdout);
assert(Object.keys(productionEnv).length > 10, "The production env file did not parse; refusing to build with partial configuration");

const heapMb = process.env.DINGYUE_BUILD_MAX_OLD_SPACE_SIZE || "16384";
const buildDir = path.resolve(".next-build");
console.log(JSON.stringify({ commit, buildDir, heapMb, productionEnvKeys: Object.keys(productionEnv).length }));
const build = spawnSync(process.execPath, ["scripts/build-production.mjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...productionEnv,
    NEXT_DIST_DIR: ".next-build",
    DINGYUE_ENV: "production",
    DATABASE_TARGET: "production",
    DINGYUE_BUILD_MAX_OLD_SPACE_SIZE: heapMb,
    NODE_OPTIONS: `--max-old-space-size=${heapMb}`
  }
});
assert.equal(build.status, 0, "The production build failed");
assert(fs.existsSync(path.join(buildDir, "BUILD_ID")), "The build did not produce a BUILD_ID");
fs.writeFileSync(path.join(buildDir, ".build-commit"), `${commit}\n`);
console.log(JSON.stringify({ prebuilt: buildDir, buildCommit: commit, next: `node scripts/deploy-aidreamcapes-release.mjs --commit=${commit} --prebuilt-build=${buildDir} --apply --confirm=deploy-aidreamcapes` }));
