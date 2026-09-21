#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "./load-runtime-env.mjs";
import { argumentValue, hasArgument } from "./lib/database-target.mjs";

const commit = argumentValue("--commit") || "";
const base = argumentValue("--base") || "";
const fullSource = hasArgument("--full-source");
const apply = hasArgument("--apply");
const confirm = argumentValue("--confirm");
const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();

const allowedReleaseFiles = [
  "package.json",
  "scripts/deploy-aidreamshoots-eu-release.mjs",
  "scripts/build-production.mjs",
  "scripts/restore-next-env.mjs",
  "scripts/generate-storefront-responsive-image-variants.mjs",
  "scripts/repair-aidreamshoots-livepage-seo-production.mjs",
  "scripts/smoke-aidreamshoots-seo-browser.mjs",
  "scripts/smoke-aidreamshoots-seo-remediation.mjs",
  "scripts/smoke-storefront-media-alt.mjs",
  "src/app/[...path]/page.tsx",
  "src/components/storefront/save-the-date-directory.tsx",
  "src/components/theme-renderer.tsx",
  "src/lib/aidreamshoots-xby-seo-content.ts",
  "src/lib/aidreamcapes-eu-retired-routes.ts",
  "src/lib/dreamshoot-seo-content.ts",
  "src/lib/seo-indexing.ts",
  "src/lib/spanish-storefronts.ts",
  "src/lib/storefront-context/snapshot.ts",
  "src/lib/storefront-metadata.ts",
  "src/lib/storefront-render.tsx",
  "src/lib/storefront-responsive-image-manifest.json",
  "src/lib/stores/prisma-mappers.ts",
  "src/lib/stores/site-store.ts",
  "src/lib/theme/json-ld.ts",
  "src/lib/types.ts",
  "src/middleware.ts"
];
const fullSourcePaths = [
  "package.json",
  "package-lock.json",
  "next.config.mjs",
  "next-env.d.ts",
  "postcss.config.mjs",
  "tailwind.config.ts",
  "tsconfig.json",
  "tsconfig.typecheck.json",
  "eslint.config.mjs",
  "server.mjs",
  "prisma",
  "scripts",
  "src"
];

const config = {
  domain: "aidreamshoots.eu",
  root: "/www/wwwroot/aidreamshoots.eu",
  service: "aidreamshoots.service",
  port: "3012",
  validationPort: "3912",
  siteId: "site_mydreamshoots_xby"
};

function fail(message) {
  throw new Error(message);
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  }).trim();
}

function shellQuote(value) {
  return "'" + String(value).replaceAll("'", "'\\''") + "'";
}

function sshArgs(command) {
  const args = [];
  if (process.env.SSH_CONFIG_PATH) args.push("-F", process.env.SSH_CONFIG_PATH);
  args.push("-p", process.env.AI_PROJECT_SSH_PORT || "11765");
  if (process.env.AI_PROJECT_SSH_KEY_PATH) args.push("-i", process.env.AI_PROJECT_SSH_KEY_PATH);
  args.push(
    (process.env.AI_PROJECT_SSH_USER || "root") + "@" + (process.env.AI_PROJECT_SSH_HOST || "204.77.130.125"),
    command
  );
  return args;
}

function scpArgs(source, destination) {
  const args = [];
  if (process.env.SSH_CONFIG_PATH) args.push("-F", process.env.SSH_CONFIG_PATH);
  args.push("-P", process.env.AI_PROJECT_SSH_PORT || "11765");
  if (process.env.AI_PROJECT_SSH_KEY_PATH) args.push("-i", process.env.AI_PROJECT_SSH_KEY_PATH);
  args.push(
    source,
    (process.env.AI_PROJECT_SSH_USER || "root") + "@" + (process.env.AI_PROJECT_SSH_HOST || "204.77.130.125") + ":" + destination
  );
  return args;
}

function changedFilesForCommit() {
  const output = git(["diff-tree", "--no-commit-id", "--name-only", "-r", "--diff-filter=ACMRT", commit, commit + "^"]);
  return output ? output.split("\n").filter(Boolean) : [];
}

function deletedFilesForCommit() {
  const output = base
    ? git(["diff", "--name-only", "--diff-filter=D", base, commit])
    : git(["diff-tree", "--no-commit-id", "--name-only", "-r", "--diff-filter=D", commit, commit + "^"]);
  return output ? output.split("\n").filter(Boolean) : [];
}

function releaseFiles() {
  const output = base
    ? git(["diff", "--name-only", base, commit])
    : git(["diff-tree", "--no-commit-id", "--name-only", "-r", "--diff-filter=ACMRT", commit, commit + "^"]);
  const files = output ? output.split("\n").filter(Boolean) : [];
  if (!base) return files;
  const selected = files.filter((file) => allowedReleaseFiles.includes(file) || file.startsWith("public/assets/sites/site_aidreamshoots/"));
  for (const required of [
    "scripts/build-production.mjs",
    "scripts/restore-next-env.mjs",
    "src/components/storefront/save-the-date-directory.tsx",
    "src/lib/aidreamcapes-eu-retired-routes.ts"
  ]) {
    if (!selected.includes(required)) selected.push(required);
  }
  return selected;
}

function localPrecheck() {
  if (!branch) fail("The deployment must run from a named git branch.");
  if (!/^[0-9a-f]{40}$/i.test(commit)) fail("--commit must be a full 40-character commit SHA.");
  if (git(["rev-parse", "--verify", commit + "^{commit}"]) !== commit) {
    fail("Commit " + commit + " does not exist locally.");
  }
  if (git(["rev-parse", "HEAD"]) !== commit) {
    fail("Deployment commit " + commit + " must be the current HEAD.");
  }
  try {
    execFileSync("git", ["fetch", "origin", branch], { stdio: "inherit" });
  } catch {
    fail("Could not refresh origin/" + branch + "; deployment stopped before touching the server.");
  }
  const remoteHead = git(["rev-parse", "origin/" + branch]);
  if (remoteHead !== commit) {
    fail("Commit " + commit + " is not the latest origin/" + branch + " (" + remoteHead + "). Push it before deploying.");
  }
  if (base) {
    try {
      git(["rev-parse", "--verify", base + "^{commit}"]);
    } catch {
      fail("Base commit " + base + " does not exist locally.");
    }
  }
  const deleted = deletedFilesForCommit().filter((file) => !base || allowedReleaseFiles.includes(file) || file.startsWith("public/assets/sites/site_aidreamshoots/"));
  if (deleted.length) {
    fail("Incremental release refuses deleted files because the remote release must be reviewed explicitly:\n" + deleted.join("\n"));
  }
  const changed = releaseFiles();
  if (!changed.length && !fullSource) fail("Commit " + commit + " has no changed files to release.");
  return { changed, remoteHead };
}

function runRemote(changedFiles) {
  const shortCommit = commit.slice(0, 8);
  const release = config.root + "/releases/" + commit + "-" + config.domain.replaceAll(".", "-");
  const stage = release + ".install";
  const patch = "/tmp/" + commit + "-aidreamshoots-eu-patch";
  const patchTar = patch + ".tar";
  const rootQ = shellQuote(config.root);
  const releaseQ = shellQuote(release);
  const stageQ = shellQuote(stage);
  const patchQ = shellQuote(patch);
  const command = [
    "set -eu",
    "COMMIT=" + shellQuote(commit),
    "ROOT=" + rootQ,
    "RELEASE=" + releaseQ,
    "STAGE=" + stageQ,
    "PATCH=" + patchQ,
    "PATCH_TAR=" + shellQuote(patchTar),
    "BASE=$(readlink -f \"$ROOT/current\")",
    "if [ -f \"$RELEASE/.deployed-commit\" ] && [ \"$(cat \"$RELEASE/.deployed-commit\")\" = \"$COMMIT\" ] && [ \"$(readlink -f \"$ROOT/current\")\" = \"$RELEASE\" ]; then echo 'already deployed'; exit 0; fi",
    "test ! -e \"$RELEASE\"",
    "test ! -e \"$STAGE\"",
    "test -d \"$BASE\"",
    "test -f \"$BASE/.env.local\"",
    "mkdir -p \"$STAGE\" \"$PATCH\"",
    "trap 'rm -rf \"$STAGE\" \"$PATCH\"; rm -f \"$PATCH_TAR\"' EXIT",
    "rsync -a --link-dest=\"$BASE/\" --exclude='.next*' --exclude='node_modules' \"$BASE/\" \"$STAGE/\"",
    "cp -a \"$BASE/node_modules\" \"$STAGE/node_modules\"",
    "rm -f \"$STAGE/.env.local\" \"$STAGE/.env\" \"$STAGE/.deployed-commit\"",
    "cp \"$BASE/.env.local\" \"$STAGE/.env.local\"",
    "cp \"$BASE/.env.local\" \"$STAGE/.env\"",
    "test -f \"$PATCH_TAR\"",
    "tar -xf \"$PATCH_TAR\" -C \"$PATCH\"",
    "rsync -a \"$PATCH/\" \"$STAGE/\"",
    "cd \"$STAGE\"",
    "DINGYUE_ENV=production DATABASE_TARGET=production NEXT_DIST_DIR=.next-build ./node_modules/.bin/prisma generate",
    "DINGYUE_ENV=production DATABASE_TARGET=production npm run build",
    "DINGYUE_ENV=production DATABASE_TARGET=production ./node_modules/.bin/prisma migrate deploy",
    "printf '%s\\n' \"$COMMIT\" > \"$STAGE/.deployed-commit\"",
    "DINGYUE_ENV=production DATABASE_TARGET=production NEXT_DIST_DIR=.next-build ./node_modules/.bin/next start -p " + config.validationPort + " -H 127.0.0.1 >\"$STAGE/.candidate.log\" 2>&1 & CANDIDATE_PID=$!",
    "trap 'kill \"$CANDIDATE_PID\" 2>/dev/null || true; rm -rf \"$STAGE\" \"$PATCH\"; rm -f \"$PATCH_TAR\"' EXIT",
    "READY=0; for ATTEMPT in $(seq 1 40); do if curl -fsS --max-time 3 -H " + shellQuote("Host: " + config.domain) + " \"http://127.0.0.1:" + config.validationPort + "/\" > \"$STAGE/.candidate.html\"; then READY=1; break; fi; sleep 1; done; test \"$READY\" = 1",
    "grep -E '<title[^>]*>[^<]+</title>' \"$STAGE/.candidate.html\"",
    "grep -F 'lang=\"es\"' \"$STAGE/.candidate.html\"",
    "grep -F 'https://" + config.domain + "/' \"$STAGE/.candidate.html\"",
    "kill \"$CANDIDATE_PID\" 2>/dev/null || true; wait \"$CANDIDATE_PID\" 2>/dev/null || true",
    "mv \"$STAGE\" \"$RELEASE\"",
    "trap 'rm -rf \"$STAGE\" \"$PATCH\"; rm -f \"$PATCH_TAR\"' EXIT",
    "SERVICE_DROPIN=/etc/systemd/system/" + config.service + ".d/release.conf",
    "SERVICE_NEXT=\"$RELEASE/" + config.service + ".next\"",
    "cp \"$SERVICE_DROPIN\" \"$RELEASE/" + config.service + ".previous\"",
    "cat > \"$SERVICE_NEXT\" <<EOF\n[Service]\nWorkingDirectory=$RELEASE\nEnvironmentFile=$RELEASE/.env.local\nEnvironment=NODE_ENV=production\nEnvironment=DINGYUE_ENV=production\nEnvironment=DATABASE_TARGET=production\nEnvironment=PLATFORM_STATE_POSTGRES_STRICT=1\nEnvironment=NEXT_DIST_DIR=.next-build\nEnvironment=PORT=" + config.port + "\nEnvironment=GIT_COMMIT_SHA=" + shortCommit + "\nEnvironment=NEXT_PUBLIC_RELEASE_COMMIT=" + shortCommit + "\nExecStart=\nExecStart=$RELEASE/node_modules/.bin/next start -p " + config.port + " -H 127.0.0.1\nEOF",
    "grep -Fx 'WorkingDirectory=$RELEASE' \"$SERVICE_NEXT\"",
    "grep -Fx 'EnvironmentFile=$RELEASE/.env.local' \"$SERVICE_NEXT\"",
    "OLD_RELEASE=$(readlink -f \"$ROOT/current\")",
    "SWITCHED=0",
    "rollback() { STATUS=$?; if [ \"$SWITCHED\" = 1 ]; then cp \"$RELEASE/" + config.service + ".previous\" \"$SERVICE_DROPIN\"; ln -sfn \"$OLD_RELEASE\" \"$ROOT/current\"; systemctl daemon-reload; systemctl restart " + config.service + " || true; fi; exit \"$STATUS\"; }",
    "trap rollback EXIT",
    "cp \"$SERVICE_NEXT\" \"$SERVICE_DROPIN\"",
    "ln -sfn \"$RELEASE\" \"$ROOT/current\"",
    "SWITCHED=1",
    "systemctl daemon-reload",
    "systemctl restart " + config.service,
    "test \"$(systemctl is-active " + config.service + ")\" = active",
    "test \"$(systemctl show -p WorkingDirectory " + config.service + " | sed -n 's/^WorkingDirectory=//p')\" = \"$RELEASE\"",
    "test \"$(cat \"$ROOT/current/.deployed-commit\")\" = \"$COMMIT\"",
    "PUBLIC_READY=0; for ATTEMPT in $(seq 1 15); do if curl -fsS --max-time 20 https://" + config.domain + "/ | grep -E '<title[^>]*>[^<]+</title>'; then PUBLIC_READY=1; break; fi; sleep 2; done; test \"$PUBLIC_READY\" = 1",
    "SWITCHED=0; trap - EXIT",
    "rm -rf \"$PATCH\"; rm -f \"$PATCH_TAR\"",
    "printf '%s\\n' 'deployed_commit='$COMMIT 'service='$(systemctl is-active " + config.service + ") 'current='$(readlink -f \"$ROOT/current\")"
  ].join("\n");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamshoots-eu-release-"));
  const archivePath = path.join(tempDir, commit + ".tar");
  try {
    const archivePaths = fullSource
      ? [...new Set([...fullSourcePaths, ...changedFiles])]
      : changedFiles;
    execFileSync("git", ["archive", "--format=tar", "--output=" + archivePath, commit, "--", ...archivePaths], {
      cwd: process.cwd(),
      stdio: ["ignore", "inherit", "inherit"]
    });
    const upload = spawnSync("scp", scpArgs(archivePath, patchTar), { stdio: "inherit" });
    if (upload.status !== 0) fail("Patch upload failed before the remote release was touched.");
    const remote = spawnSync("ssh", sshArgs(command), { stdio: "inherit" });
    if (remote.status !== 0) {
      fail("Remote deployment exited with " + remote.status + "; current release was not switched after the failing step.");
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  const { changed, remoteHead } = localPrecheck();
  console.log(JSON.stringify({
    target: "production",
    domain: config.domain,
    appRoot: config.root,
    service: config.service,
    port: config.port,
    siteId: config.siteId,
    productionAffected: true,
    commit,
    branch,
    remoteHead,
    changedFiles: changed.length
  }, null, 2));
  if (!apply) {
    console.log("Dry-run only. Add --apply --confirm=deploy-aidreamshoots-eu to release this exact commit.");
    process.exit(0);
  }
  if (confirm !== "deploy-aidreamshoots-eu") {
    fail("Spanish production deployment requires --confirm=deploy-aidreamshoots-eu.");
  }
  await runRemote(changed);
} catch (error) {
  console.error(error?.stack || error);
  process.exitCode = 1;
}
