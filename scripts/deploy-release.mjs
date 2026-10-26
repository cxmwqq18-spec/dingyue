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
  const rootQ = shellQuote(config.root);
  const appQ = shellQuote(app);
  const releaseQ = shellQuote(release);
  const commitQ = shellQuote(commit);
  const envQ = shellQuote(`${release}/.env.local`);
  const candidateHtmlQ = shellQuote(`${release}/.candidate.html`);
  const candidateLogQ = shellQuote(`${release}/.candidate.log`);
  const command = [
    "set -eu",
    `COMMIT=${commitQ}`,
    `command -v git >/dev/null 2>&1 || { echo 'Remote deployment requires git on the app host.' >&2; exit 127; }`,
    `test -d ${appQ}/.git`,
    `git -C ${appQ} fetch --prune origin main`,
    `git -C ${appQ} cat-file -e ${commitQ}^{commit}`,
    `test "$(git -C ${appQ} rev-parse origin/main)" = ${commitQ}`,
    `mkdir -p ${rootQ}/releases`,
    `if [ ! -e ${releaseQ} ]; then git -C ${appQ} worktree add --detach ${releaseQ} ${commitQ}; fi`,
    `cp ${appQ}/.env.local ${releaseQ}/.env.local`,
    `cp ${releaseQ}/.env.local ${releaseQ}/.env`,
    `cd ${releaseQ}`,
    `if [ ! -d node_modules ]; then if [ -d ${appQ}/node_modules ] && cmp -s package-lock.json ${appQ}/package-lock.json; then cp -a ${appQ}/node_modules node_modules; else npm ci --prefer-offline; fi; fi`,
    `DINGYUE_ENV=${shellQuote(target)} DATABASE_TARGET=${shellQuote(target)} npx prisma generate`,
    `DINGYUE_ENV=${shellQuote(target)} DATABASE_TARGET=${shellQuote(target)} npm run build`,
    `DINGYUE_ENV=${shellQuote(target)} DATABASE_TARGET=${shellQuote(target)} npx prisma migrate deploy`,
    `printf '%s\\n' ${commitQ} > ${releaseQ}/.deployed-commit`,
    `DINGYUE_ENV=${shellQuote(target)} DATABASE_TARGET=${shellQuote(target)} NEXT_DIST_DIR=.next-build ${releaseQ}/node_modules/.bin/next start -p ${config.validationPort} >${candidateLogQ} 2>&1 & CANDIDATE_PID=$!`,
    `trap 'kill "$CANDIDATE_PID" 2>/dev/null || true' EXIT`,
    `READY=0; for ATTEMPT in $(seq 1 30); do if curl -fsS --max-time 3 -H ${shellQuote(`Host: ${config.domain}`)} "http://127.0.0.1:${config.validationPort}/" > ${candidateHtmlQ}; then READY=1; break; fi; sleep 1; done; test "$READY" = 1`,
    `test "$(readlink -f /proc/$CANDIDATE_PID/cwd)" = ${releaseQ}`,
    `test "$(cat ${releaseQ}/.deployed-commit)" = ${commitQ}`,
    `grep -E -o '<title[^>]*>[^<]+</title>' ${candidateHtmlQ}`,
    `grep -E -o '<link[^>]+rel="canonical"[^>]*>' ${candidateHtmlQ}`,
    `kill "$CANDIDATE_PID" 2>/dev/null || true; wait "$CANDIDATE_PID" 2>/dev/null || true; trap - EXIT`,
    `SERVICE_FILE=${shellQuote(`/etc/systemd/system/${service}`)}`,
    `SERVICE_DROPIN=${shellQuote(`/etc/systemd/system/${service}.d/release.conf`)}`,
    `if [ -f "$SERVICE_DROPIN" ]; then SERVICE_FILE="$SERVICE_DROPIN"; fi`,
    `SERVICE_NEXT=${releaseQ}/${service}.next`,
    `cp "$SERVICE_FILE" "$SERVICE_NEXT"`,
    `sed -i -E "s#^WorkingDirectory=.*#WorkingDirectory=${config.root}/releases/${commit}#; s#^EnvironmentFile=.+#EnvironmentFile=${config.root}/releases/${commit}/.env.local#; s#^ExecStart=.+#ExecStart=${config.root}/releases/${commit}/node_modules/.bin/next start -p ${config.port} -H 127.0.0.1#" "$SERVICE_NEXT"`,
    // A systemd drop-in needs the empty ExecStart= reset before its command.
    // Replacing that reset would leave two commands and invalidate the unit.
    `test "$(grep -Ec '^ExecStart=.+' "$SERVICE_NEXT")" = 1`,
    `test "$(grep -Ec '^EnvironmentFile=.+' "$SERVICE_NEXT")" = 1`,
    `grep -Fx ${shellQuote(`WorkingDirectory=${release}`)} "$SERVICE_NEXT"`,
    `grep -Fx ${shellQuote(`EnvironmentFile=${release}/.env.local`)} "$SERVICE_NEXT"`,
    `OLD_RELEASE=$(readlink -f ${rootQ}/current 2>/dev/null || true)`,
    `cp "$SERVICE_FILE" ${releaseQ}/${service}.previous`,
    `SWITCHED=0; rollback() { STATUS=$?; if [ "$STATUS" -ne 0 ] && [ "$SWITCHED" = 1 ]; then cp ${releaseQ}/${service}.previous "$SERVICE_FILE"; if [ -n "$OLD_RELEASE" ]; then ln -sfn "$OLD_RELEASE" ${rootQ}/current; fi; systemctl daemon-reload; systemctl restart ${shellQuote(service)} || true; fi; exit "$STATUS"; }; trap rollback EXIT`,
    `cp "$SERVICE_NEXT" "$SERVICE_FILE"`,
    `ln -sfn ${releaseQ} ${rootQ}/current`,
    `SWITCHED=1`,
    `systemctl daemon-reload`,
    `systemctl restart ${shellQuote(service)}`,
    `test "$(systemctl is-active ${shellQuote(service)})" = active`,
    `test "$(systemctl show -p WorkingDirectory ${shellQuote(service)} | sed -n 's/^WorkingDirectory=//p')" = ${releaseQ}`,
    `test "$(cat ${rootQ}/current/.deployed-commit)" = ${commitQ}`,
    `PUBLIC_READY=0; for ATTEMPT in $(seq 1 12); do if curl -fsSL --max-time 20 https://${config.domain}/ | grep -E -o '<title[^>]*>[^<]+</title>'; then PUBLIC_READY=1; break; fi; sleep 2; done;`,
    `# A storefront domain can sit behind Cloudflare and return edge 502s (e.g. the`,
    `# mydreamshoots.com zone) while the store itself is healthy on the platform`,
    `# domain that nginx proxies to the same service. Fall back to that domain so a`,
    `# good release is not rolled back because of an unrelated edge outage.`,
    `if [ "$PUBLIC_READY" != 1 ] && curl -fsSL --max-time 20 https://www.mydreamshoots.xyz/ | grep -E -o '<title[^>]*>[^<]+</title>'; then PUBLIC_READY=1; fi;`,
    `test "$PUBLIC_READY" = 1`,
    `SWITCHED=0; trap - EXIT`,
    `printf '%s\\n' ${shellQuote(`deployed_commit=${commit}`)} "service=$(systemctl is-active ${shellQuote(service)})" "current=$(readlink -f ${rootQ}/current)"`
  ].join("\n");
  const sshArgs = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=30", "-o", "ServerAliveInterval=20", "-p", process.env.AI_PROJECT_SSH_PORT || "11765"];
  if (process.env.AI_PROJECT_SSH_CONTROL_PATH) sshArgs.push("-o", `ControlPath=${process.env.AI_PROJECT_SSH_CONTROL_PATH}`);
  const keyPath = process.env.AI_PROJECT_SSH_KEY_PATH;
  if (keyPath) sshArgs.push("-i", keyPath);
  sshArgs.push(`${process.env.AI_PROJECT_SSH_USER || "root"}@${process.env.AI_PROJECT_SSH_HOST || "204.77.130.125"}`, command);
  const result = spawnSync("ssh", sshArgs, { stdio: "inherit" });
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
