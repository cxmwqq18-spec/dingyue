#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import "./load-runtime-env.mjs";

const args = process.argv.slice(2);
const value = (key) => args.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1);
const commit = value("--commit");
assert(/^[a-f0-9]{40}$/.test(commit || ""), "Supply the exact pushed --commit=<40-character SHA>");
const git = (...argv) => execFileSync("git", argv, { encoding: "utf8" }).trim();
assert.equal(git("rev-parse", "origin/main"), commit, "Release must equal origin/main");
assert.equal(git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0], commit, "GitHub main must contain this exact commit");
const sourcePaths = ["package.json", "package-lock.json", "next.config.mjs", "next-env.d.ts", "postcss.config.mjs", "tailwind.config.ts", "tsconfig.json", "tsconfig.typecheck.json", "eslint.config.mjs", "server.mjs", "prisma", "scripts", "src"];
const root = "/www/wwwroot/aidreamcapes.com";
const release = `${root}/releases/${commit}-seo`;
const quote = (s) => `'${String(s).replaceAll("'", "'\\''")}'`;
const connection = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15"];
if (process.env.SSH_CONFIG_PATH) connection.push("-F", process.env.SSH_CONFIG_PATH);
if (process.env.AI_PROJECT_SSH_KEY_PATH) connection.push("-i", process.env.AI_PROJECT_SSH_KEY_PATH);
const port = process.env.AI_PROJECT_SSH_PORT || "11765";
const host = `root@${process.env.AI_PROJECT_SSH_HOST || "204.77.130.125"}`;
function run(command, argv) {
  const result = spawnSync(command, argv, { stdio: "inherit" });
  assert.equal(result.status, 0, `${command} failed (${result.status})`);
}
console.log(JSON.stringify({ domain: "aidreamcapes.com", service: "aidreamcapes.service", commit, release, databaseWrites: false }));
if (!args.includes("--apply")) process.exit(0);
assert.equal(value("--confirm"), "deploy-aidreamcapes", "Explicit target confirmation is required");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-release-"));
const archive = path.join(temp, "source.tar");
const remoteArchive = `/tmp/aidreamcapes-${commit}.tar`;
try {
  execFileSync("git", ["archive", "--format=tar", `--output=${archive}`, commit, "--", ...sourcePaths]);
  run("scp", ["-P", port, ...connection, archive, `${host}:${remoteArchive}`]);
  const command = `set -eu
ROOT=${quote(root)}
RELEASE=${quote(release)}
COMMIT=${quote(commit)}
BASE=$(systemctl show aidreamcapes.service -p WorkingDirectory | sed -n 's/^WorkingDirectory=//p')
OTHER_SERVICES=$(systemctl show mydreamshoots.service aidreamcapes-eu.service aidreamshoots.service -p MainPID -p WorkingDirectory)
test -d "$BASE/public"
test -f "$BASE/.env.local"
test ! -e "$RELEASE"
mkdir -p "$RELEASE"
tar -xf ${quote(remoteArchive)} -C "$RELEASE"
rm -f ${quote(remoteArchive)}
cp -a --reflink=auto "$BASE/public" "$RELEASE/public"
cp "$BASE/.env.local" "$RELEASE/.env.local"
cp "$BASE/.env.local" "$RELEASE/.env"
chmod 600 "$RELEASE/.env.local"
chmod 600 "$RELEASE/.env"
cd "$RELEASE"
npm ci --no-audit --no-fund
DINGYUE_ENV=production DATABASE_TARGET=production node ./node_modules/prisma/build/index.js generate
DINGYUE_ENV=production DATABASE_TARGET=production DINGYUE_BUILD_MAX_OLD_SPACE_SIZE=6144 npm run build
printf '%s\n' "$COMMIT" > .deployed-commit
HOSTNAME=127.0.0.1 PORT=3913 NODE_ENV=production NEXT_DIST_DIR=.next-build DINGYUE_ENV=production DATABASE_TARGET=production node server.mjs > .candidate.log 2>&1 &
CANDIDATE=$!
trap 'kill "$CANDIDATE" 2>/dev/null || true' EXIT
READY=0
for ATTEMPT in $(seq 1 60); do
  if curl -fsS --max-time 5 -H 'X-Forwarded-Host: aidreamcapes.com' -H 'X-Forwarded-Proto: https' http://127.0.0.1:3913/ > .candidate.html; then READY=1; break; fi
  sleep 2
done
test "$READY" = 1
AIDREAMCAPES_SEO_ORIGIN=http://127.0.0.1:3913 node scripts/smoke-aidreamcapes-seo-contract.mjs > .candidate-contract.json
cat .candidate-contract.json
kill "$CANDIDATE"; wait "$CANDIDATE" 2>/dev/null || true
trap - EXIT
DROPIN=/etc/systemd/system/aidreamcapes.service.d/release.conf
cp "$DROPIN" .previous-release.conf
OLD_CURRENT=$(readlink -f "$ROOT/current")
printf '%s\n' '[Service]' "WorkingDirectory=$RELEASE" "EnvironmentFile=$RELEASE/.env.local" 'Environment=NODE_ENV=production' 'Environment=DINGYUE_ENV=production' 'Environment=DATABASE_TARGET=production' 'Environment=PLATFORM_STATE_POSTGRES_STRICT=1' 'Environment=NEXT_DIST_DIR=.next-build' 'Environment=HOSTNAME=127.0.0.1' 'Environment=PORT=3013' "Environment=GIT_COMMIT_SHA=$COMMIT" "Environment=NEXT_PUBLIC_RELEASE_COMMIT=$COMMIT" 'ExecStart=' "ExecStart=/usr/local/bin/node $RELEASE/server.mjs" > .next-release.conf
rollback() { STATUS=$?; cp "$RELEASE/.previous-release.conf" "$DROPIN"; ln -sfn "$OLD_CURRENT" "$ROOT/current"; systemctl daemon-reload; systemctl restart aidreamcapes.service || true; exit "$STATUS"; }
trap rollback EXIT
cp .next-release.conf "$DROPIN"
ln -sfn "$RELEASE" "$ROOT/current.next"
mv -Tf "$ROOT/current.next" "$ROOT/current"
systemctl daemon-reload
systemctl restart aidreamcapes.service
test "$(systemctl is-active aidreamcapes.service)" = active
READY=0
for ATTEMPT in $(seq 1 30); do
  if curl -fsS --max-time 5 -H 'X-Forwarded-Host: aidreamcapes.com' -H 'X-Forwarded-Proto: https' http://127.0.0.1:3013/ > .origin.html; then READY=1; break; fi
  sleep 2
done
test "$READY" = 1
AIDREAMCAPES_SEO_ORIGIN=http://127.0.0.1:3013 node scripts/smoke-aidreamcapes-seo-contract.mjs > .origin-contract.json
cat .origin-contract.json
test "$(cat "$ROOT/current/.deployed-commit")" = "$COMMIT"
test "$(systemctl show aidreamcapes.service -p WorkingDirectory | sed -n 's/^WorkingDirectory=//p')" = "$RELEASE"
test "$(systemctl show mydreamshoots.service aidreamcapes-eu.service aidreamshoots.service -p MainPID -p WorkingDirectory)" = "$OTHER_SERVICES"
trap - EXIT
printf '%s\n' "deployed_commit=$COMMIT" "current=$RELEASE" 'service=aidreamcapes.service'
`;
  run("ssh", ["-p", port, ...connection, host, command]);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
