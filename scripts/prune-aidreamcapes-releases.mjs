#!/usr/bin/env node
/**
 * Keep the Aidreamcapes release directory bounded.
 *
 * Every deploy writes a complete release under
 * /www/wwwroot/aidreamcapes.com/releases/<commit>-seo (about 10GB). Without a
 * retention rule those directories accumulate until the disk is full, so this
 * command keeps the newest N releases plus anything the running service points
 * at and deletes the rest.
 *
 * Dry run by default. Deleting requires --apply --confirm=prune-aidreamcapes-releases.
 *
 *   node scripts/prune-aidreamcapes-releases.mjs
 *   node scripts/prune-aidreamcapes-releases.mjs --keep=5
 *   node scripts/prune-aidreamcapes-releases.mjs --apply --confirm=prune-aidreamcapes-releases
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import "./load-runtime-env.mjs";
import { assertSafeReleaseName, planReleaseRetention } from "./lib/aidreamcapes-release-retention.mjs";

const args = process.argv.slice(2);
const value = (key) => args.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1);
const root = value("--root") || "/www/wwwroot/aidreamcapes.com";
assert(/^\/[A-Za-z0-9._/-]+$/.test(root), "root must be an absolute path");
const keepCount = Number(value("--keep") || process.env.AIDREAMCAPES_RELEASE_RETENTION || "3");
const apply = args.includes("--apply");
const asJson = args.includes("--json");
assert(args.every((arg) => !arg.startsWith("--confirm=")) || args.includes("--confirm=prune-aidreamcapes-releases"), "Unsupported confirmation value; expected --confirm=prune-aidreamcapes-releases");

const connection = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=6", "-o", "Compression=yes"];
if (process.env.SSH_CONFIG_PATH) connection.push("-F", process.env.SSH_CONFIG_PATH);
if (process.env.AI_PROJECT_SSH_KEY_PATH) connection.push("-i", process.env.AI_PROJECT_SSH_KEY_PATH);
const port = process.env.AI_PROJECT_SSH_PORT || "11765";
const host = `root@${process.env.AI_PROJECT_SSH_HOST || "204.77.130.125"}`;

function ssh(script) {
  const result = spawnSync("ssh", ["-p", port, ...connection, host, "bash -s"], { input: script, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`ssh failed (${result.status}): ${(result.stderr || "").trim()}`);
  }
  return result.stdout;
}

function listingScript() {
  return `set -eu
ROOT=${JSON.stringify(root)}
test -d "$ROOT/releases"
CURRENT=$(readlink -f "$ROOT/current" 2>/dev/null || true)
printf '{"current":"%s","systemd":[' "$CURRENT"
SEP=''
for REFERENCE in $(systemctl cat aidreamcapes.service 2>/dev/null | grep -o "$ROOT/releases/[^\\" ]*" | sort -u); do
  printf '%s"%s"' "$SEP" "$REFERENCE"
  SEP=','
done
printf '],"releases":['
SEP=''
for DIRECTORY in "$ROOT"/releases/*/; do
  test -d "$DIRECTORY" || continue
  NAME=$(basename "$DIRECTORY")
  MTIME=$(stat -c %Y "$DIRECTORY")
  MARKER=0
  test -f "$DIRECTORY/.keep" && MARKER=1
  printf '%s{"name":"%s","mtime":%s,"keepMarker":%s}' "$SEP" "$NAME" "$MTIME" "$MARKER"
  SEP=','
done
printf ']}\n'
`;
}

function deleteScript(names) {
  const lines = names.map((name) => {
    assertSafeReleaseName(name);
    // Safety guard: releases are disposable, runtime customer data is not. If
    // a customer render or asset storage root ever lands inside the release
    // directory (storage-root misconfiguration), abort the prune instead of
    // deleting finished videos with it. Static build data (saas-*.json) is
    // fine to remove.
    return `for RUNTIME_DIR in aidreamcapes-workspace-render customer-assets; do
  if find "$ROOT/releases/${name}/data/$RUNTIME_DIR" -type f -print -quit 2>/dev/null | grep -q .; then
    echo "REFUSING to delete $ROOT/releases/${name}: it still contains customer data under data/$RUNTIME_DIR. Migrate it (e.g. to $ROOT/data/$RUNTIME_DIR) before pruning." >&2
    exit 1
  fi
done
test -d "$ROOT/releases/${name}" && rm -rf -- "$ROOT/releases/${name}" && echo "removed ${name}" || echo "skipped ${name}"`;
  });
  return `set -eu
ROOT=${JSON.stringify(root)}
test -d "$ROOT/releases"
${lines.join("\n")}
`;
}

const listing = JSON.parse(ssh(listingScript()).trim());
const plan = planReleaseRetention({
  releases: listing.releases ?? [],
  keepCount,
  currentRelease: listing.current ?? "",
  systemdReleases: listing.systemd ?? []
});

if (asJson) {
  console.log(JSON.stringify(plan));
} else {
  console.log(`releases on disk : ${(listing.releases ?? []).length}`);
  console.log(`keep (${plan.keep.length})        : ${plan.keep.join(", ")}`);
  console.log(`delete (${plan.delete.length})      : ${plan.delete.length ? plan.delete.join(", ") : "-"}`);
}

if (!plan.delete.length) {
  if (!asJson) console.log("nothing to prune");
  process.exit(0);
}
if (!apply) {
  if (!asJson) console.log(`dry run: re-run with --apply --confirm=prune-aidreamcapes-releases to delete ${plan.delete.length} release(s)`);
  process.exit(0);
}
assert(args.includes("--confirm=prune-aidreamcapes-releases"), "Deleting releases requires --confirm=prune-aidreamcapes-releases");
const output = ssh(deleteScript(plan.delete));
if (!asJson) process.stdout.write(output);
