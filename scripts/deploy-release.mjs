#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import "./load-runtime-env.mjs";
import { argumentValue, hasArgument } from "./lib/database-target.mjs";

const target = argumentValue("--target") || "";
const commit = argumentValue("--commit") || "";
const isPrecheck = hasArgument("--precheck");
const apply = hasArgument("--apply");
const confirm = argumentValue("--confirm");
const configs = {
  test: {
    domain: "test.grownstride.com",
    root: "/www/wwwroot/grownstride-test.com",
    service: "grownstride-test.service",
    port: "3011",
    validationPort: "3911",
    siteId: "site_grownstride_test"
  },
  production: {
    domain: "www.mydreamshoots.com",
    root: "/www/wwwroot/mydreamshoots.com",
    service: "mydreamshoots.service",
    port: "3010",
    validationPort: "3910",
    siteId: "site_dreamshoot"
  }
};
function fail(message) { throw new Error(message); }
function git(args) { return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
function shellQuote(value) { return `'${String(value).replaceAll("'", "'\\''")}'`; }
function localPrecheck() {
  if (!configs[target]) fail("--target=test|production is required.");
  if (!/^[0-9a-f]{40}$/i.test(commit)) fail("--commit must be a full 40-character commit SHA.");
  const status = git(["status", "--porcelain"]);
  const unsafe = status.split("\n").filter(Boolean).filter((line) => {
    const code = line.slice(0, 2);
    const file = line.slice(3);
    if (code === "??") return !/^(docs\/|releases\/|\.codex\/)/.test(file);
    return true;
  });
  if (unsafe.length) fail(`Deployment refuses uncommitted code or tracked changes:\n${unsafe.join("\n")}`);
  execFileSync("git", ["fetch", "origin", "main"], { cwd: process.cwd(), stdio: "inherit" });
  if (git(["rev-parse", commit]) !== commit) fail(`Commit ${commit} does not exist locally.`);
  const remoteHead = git(["rev-parse", "origin/main"]);
  if (remoteHead !== commit) fail(`Commit ${commit} is not the latest origin/main (${remoteHead}).`);
  console.log(JSON.stringify({ ok: true, mode: "precheck", target, domain: configs[target].domain, siteId: configs[target].siteId, commit, remoteHead }, null, 2));
}
function runRemote(config) {
  const release = `${config.root}/releases/${commit}`;
  const app = `${config.root}/app`;
  const service = config.service;
  const command = [
    "set -eu",
    `ROOT=${shellQuote(config.root)}`,
    `APP=${shellQuote(app)}`,
    `RELEASE=${shellQuote(release)}`,
    `COMMIT=${shellQuote(commit)}`,
    `test -d "$APP/.git"`,
    `git -C "$APP" fetch --prune origin main`,
    `git -C "$APP" cat-file -e "$COMMIT^{commit}"`,
    `test "$(git -C "$APP" rev-parse origin/main)" = "$COMMIT"`,
    `mkdir -p "$ROOT/releases"`,
    `if [ ! -e "$RELEASE" ]; then git -C "$APP" worktree add --detach "$RELEASE" "$COMMIT"; fi`,
    `cp "$APP/.env.local" "$RELEASE/.env.local"`,
    `cp "$RELEASE/.env.local" "$RELEASE/.env"`,
    `cd "$RELEASE"`,
    `DINGYUE_ENV=${shellQuote(target)} DATABASE_TARGET=${shellQuote(target)} npx prisma generate`,
    `DINGYUE_ENV=${shellQuote(target)} DATABASE_TARGET=${shellQuote(target)} NEXT_PUBLIC_RELEASE_COMMIT="$COMMIT" npm run build`,
    `DINGYUE_ENV=${shellQuote(target)} DATABASE_TARGET=${shellQuote(target)} npx prisma migrate deploy`,
    `printf '%s\\n' "$COMMIT" > "$RELEASE/.deployed-commit"`,
    `VALIDATION_LOG="$RELEASE/.candidate.log"`,
    `DINGYUE_ENV=${shellQuote(target)} DATABASE_TARGET=${shellQuote(target)} NEXT_PUBLIC_RELEASE_COMMIT="$COMMIT" "$RELEASE/node_modules/.bin/next" start -p ${config.validationPort} >"$VALIDATION_LOG" 2>&1 & CANDIDATE_PID=$!`,
    `trap 'kill "$CANDIDATE_PID" 2>/dev/null || true' EXIT`,
    `READY=0; for ATTEMPT in $(seq 1 30); do if curl -fsS --max-time 3 -H ${shellQuote(`Host: ${config.domain}`)} "http://127.0.0.1:${config.validationPort}/" > "$RELEASE/.candidate.html"; then READY=1; break; fi; sleep 1; done; test "$READY" = 1`,
    `grep -F ${shellQuote(`<meta name="release-commit" content="${commit}"`)} "$RELEASE/.candidate.html"`,
    `kill "$CANDIDATE_PID" 2>/dev/null || true; wait "$CANDIDATE_PID" 2>/dev/null || true; trap - EXIT`,
    `SERVICE_FILE="/etc/systemd/system/$service"`,
    `SERVICE_NEXT="$RELEASE/$service.next"`,
    `cp "$SERVICE_FILE" "$SERVICE_NEXT"`,
    `sed -i -E "s#^WorkingDirectory=.*#WorkingDirectory=$RELEASE#; s#^EnvironmentFile=.*#EnvironmentFile=$RELEASE/.env.local#; s#^ExecStart=.*next start -p [0-9]+#ExecStart=$RELEASE/node_modules/.bin/next start -p ${config.port}#" "$SERVICE_NEXT"`,
    `grep -Fx "WorkingDirectory=$RELEASE" "$SERVICE_NEXT"`,
    `grep -Fx "EnvironmentFile=$RELEASE/.env.local" "$SERVICE_NEXT"`,
    `OLD_RELEASE=$(readlink -f "$ROOT/current" 2>/dev/null || true)`,
    `cp "$SERVICE_FILE" "$RELEASE/$service.previous"`,
    `SWITCHED=0; rollback() { STATUS=$?; if [ "$STATUS" -ne 0 ] && [ "$SWITCHED" = 1 ]; then cp "$RELEASE/$service.previous" "$SERVICE_FILE"; if [ -n "$OLD_RELEASE" ]; then ln -sfn "$OLD_RELEASE" "$ROOT/current"; fi; systemctl daemon-reload; systemctl restart ${shellQuote(service)} || true; fi; exit "$STATUS"; }; trap rollback EXIT`,
    `cp "$SERVICE_NEXT" "$SERVICE_FILE"`,
    `ln -sfn "$RELEASE" "$ROOT/current"`,
    `SWITCHED=1`,
    `systemctl daemon-reload`,
    `systemctl restart ${shellQuote(service)}`,
    `test "$(systemctl is-active ${shellQuote(service)})" = active`,
    `test "$(cat "$ROOT/current/.deployed-commit")" = "$COMMIT"`,
    `curl -fsS --max-time 20 https://${config.domain}/ | grep -F ${shellQuote(`<meta name="release-commit" content="${commit}"`)}`,
    `SWITCHED=0; trap - EXIT`,
    `printf '%s\\n' "deployed_commit=$COMMIT" "service=$(systemctl is-active ${shellQuote(service)})" "current=$(readlink -f "$ROOT/current")"`
  ].join(" && ");
  const result = spawnSync("ssh", ["-p", "11765", "root@204.77.130.125", command], { stdio: "inherit" });
  if (result.status !== 0) fail("Remote deployment failed; current release was not switched after the failing step.");
}

try {
  localPrecheck();
  if (isPrecheck) process.exit(0);
  if (target === "production" && confirm !== "deploy-production") fail("Production deployment requires --confirm=deploy-production.");
  if (!apply) fail("Deployment is dry-run by default. Add --apply and the target confirmation.");
  console.log(JSON.stringify({ target, domain: configs[target].domain, appRoot: configs[target].root, service: configs[target].service, port: configs[target].port, siteId: configs[target].siteId, productionAffected: target === "production", commit }, null, 2));
  runRemote(configs[target]);
} catch (error) {
  console.error(error?.stack || error);
  process.exitCode = 1;
}
