#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "./load-runtime-env.mjs";
import { argumentValue, hasArgument } from "./lib/database-target.mjs";

const source = process.env.PUBLIC_STATIC_ASSET_SOURCE_ROOT?.trim() || argumentValue("--source") || "";
const apply = hasArgument("--apply");
const requestedSite = argumentValue("--site") || "all";
const sourceRoot = source ? path.resolve(source) : "";
const mediaPattern = /\.(?:avif|gif|ico|jpe?g|m4a|m4v|mov|mp3|mp4|ogg|png|svg|wav|webm|webp)$/i;
const filesPerSync = 500;

const targets = {
  mydreamshoots: {
    domain: "www.mydreamshoots.com",
    root: "/www/wwwroot/mydreamshoots.com/shared/public-static"
  },
  aidreamshootsEu: {
    domain: "aidreamshoots.eu",
    root: "/www/wwwroot/aidreamshoots.eu/shared/public-static"
  },
  aidreamcapesEu: {
    domain: "aidreamcapes.eu",
    root: "/www/wwwroot/aidreamcapes.eu/shared/public-static"
  }
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!sourceRoot) fail("Set PUBLIC_STATIC_ASSET_SOURCE_ROOT or pass --source=/absolute/path/to/public.");
if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
  fail("External public static root does not exist: " + sourceRoot);
}
if (!fs.existsSync(path.join(sourceRoot, "assets"))) {
  fail("External public static root must contain an assets/ directory: " + sourceRoot);
}

const selected = requestedSite === "all"
  ? Object.entries(targets)
  : [[requestedSite, targets[requestedSite]]];
if (!selected[0]?.[1]) {
  fail(`Unknown --site=${requestedSite}; use all, mydreamshoots, aidreamshootsEu, or aidreamcapesEu.`);
}

function sshArgs(command) {
  const args = [];
  if (process.env.SSH_CONFIG_PATH) args.push("-F", process.env.SSH_CONFIG_PATH);
  args.push("-p", process.env.AI_PROJECT_SSH_PORT || "11765");
  if (process.env.AI_PROJECT_SSH_KEY_PATH) args.push("-i", process.env.AI_PROJECT_SSH_KEY_PATH);
  args.push("-o", "ServerAliveInterval=20", "-o", "ServerAliveCountMax=3");
  args.push(
    `${process.env.AI_PROJECT_SSH_USER || "root"}@${process.env.AI_PROJECT_SSH_HOST || "204.77.130.125"}`,
    command
  );
  return args;
}

function rsyncArgs(target) {
  const ssh = ["ssh"];
  if (process.env.SSH_CONFIG_PATH) ssh.push("-F", `'${process.env.SSH_CONFIG_PATH.replaceAll("'", "'\\''")}'`);
  ssh.push("-p", `'${process.env.AI_PROJECT_SSH_PORT || "11765"}'`);
  if (process.env.AI_PROJECT_SSH_KEY_PATH) ssh.push("-i", `'${process.env.AI_PROJECT_SSH_KEY_PATH.replaceAll("'", "'\\''")}'`);
  ssh.push("-o", "ServerAliveInterval=20", "-o", "ServerAliveCountMax=3");
  const args = ["-a", "--checksum", "--stats", "--timeout=300", "--no-owner", "--no-group"];
  if (!apply) args.push("--dry-run");
  args.push("-e", ssh.join(" "), sourceRoot + path.sep, `${process.env.AI_PROJECT_SSH_USER || "root"}@${process.env.AI_PROJECT_SSH_HOST || "204.77.130.125"}:${target.root}/`);
  return args;
}

function collectPublicStaticFiles(root) {
  const files = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isDirectory()) {
        pending.push(absolute);
      } else if (entry.isFile() && (relative.startsWith("assets/") || relative.startsWith("site-media/") || mediaPattern.test(entry.name))) {
        files.push(relative);
      }
    }
  }
  return files.sort();
}

function syncTarget(target, mediaFiles) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "dingyue-public-media-"));
  try {
    for (let offset = 0, part = 1; offset < mediaFiles.length; offset += filesPerSync, part += 1) {
      const chunk = mediaFiles.slice(offset, offset + filesPerSync);
      const listPath = path.join(workDir, `part-${String(part).padStart(4, "0")}.txt`);
      fs.writeFileSync(listPath, chunk.join("\n") + "\n");
      const prepared = apply
        ? spawnSync("ssh", sshArgs("mkdir -p " + `'${target.root.replaceAll("'", "'\\''")}'`), { stdio: "inherit" })
        : { status: 0 };
      if (prepared.status !== 0) fail(`Could not prepare ${target.domain} public static root.`);
      console.log(`${apply ? "Applying" : "Dry-run"} ${target.domain} media batch ${part} (${chunk.length} files)`);
      const result = spawnSync("rsync", [
        ...rsyncArgs(target).slice(0, -2),
        "--files-from=" + listPath,
        ...rsyncArgs(target).slice(-2)
      ], { stdio: "inherit" });
      if (result.status !== 0) fail(`Public media sync failed for ${target.domain} batch ${part}.`);
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

const mediaFiles = collectPublicStaticFiles(sourceRoot);
if (!mediaFiles.length) fail("No supported public media files found under " + sourceRoot);
console.log(`Found ${mediaFiles.length} public static media files under ${sourceRoot}.`);

for (const [name, target] of selected) {
  syncTarget(target, mediaFiles);
}
