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
const prebuiltBuild = value("--prebuilt-build");
const reuseBuildCommit = value("--reuse-build");
const reusePublicCommit = value("--reuse-public-from-commit");
const reuseDependenciesCommit = value("--reuse-dependencies-from-commit");
if (reusePublicCommit) {
  assert(/^[a-f0-9]{40}$/.test(reusePublicCommit), "Public asset reuse requires an exact source commit");
  assert.equal(gitPublicTree(reusePublicCommit), gitPublicTree(commit), "Public asset reuse requires unchanged tracked public assets");
}
function gitPublicTree(sha) { return execFileSync("git", ["ls-tree", "-r", sha, "--", "public"], { encoding: "utf8" }).trim(); }
if (reuseDependenciesCommit) {
  assert(/^[a-f0-9]{40}$/.test(reuseDependenciesCommit), "Dependency reuse requires an exact source commit");
  const dependencyTree = (sha) => execFileSync("git", ["ls-tree", "-r", sha, "--", "package.json", "package-lock.json", "prisma"], { encoding: "utf8" }).trim();
  assert.equal(dependencyTree(reuseDependenciesCommit), dependencyTree(commit), "Dependency reuse requires identical package files and Prisma schema/migrations");
}
assert(!(prebuiltBuild && reuseBuildCommit), "Choose either --prebuilt-build or --reuse-build");
if (prebuiltBuild) {
  const buildDir = path.resolve(prebuiltBuild);
  assert(fs.existsSync(path.join(buildDir, "BUILD_ID")), "Prebuilt directory must contain a completed Next.js BUILD_ID");
  assert.equal(fs.readFileSync(path.join(buildDir, ".build-commit"), "utf8").trim(), commit, "Prebuilt build must be marked with the exact release commit");
}
const git = (...argv) => execFileSync("git", argv, { encoding: "utf8" }).trim();
assert.equal(git("rev-parse", "origin/main"), commit, "Release must equal origin/main");
assert.equal(git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0], commit, "GitHub main must contain this exact commit");
const sourcePaths = ["package.json", "package-lock.json", "next.config.mjs", "next-env.d.ts", "postcss.config.mjs", "tailwind.config.ts", "tsconfig.json", "tsconfig.typecheck.json", "eslint.config.mjs", "server.mjs", "data/saas-fonts.json", "data/saas-theme-packages.json", "data/saas-theme1-package.json", "prisma", "scripts", "src"];
const productionAssetPaths = ["public/assets/sites/site_aidreamcapes/workspace/actors/voices"];
const archivePaths = [...sourcePaths, ...productionAssetPaths];
const root = "/www/wwwroot/aidreamcapes.com";
if (reuseBuildCommit) {
  assert(/^[a-f0-9]{40}$/.test(reuseBuildCommit), "Reuse requires an exact --reuse-build=<40-character SHA>");
  const buildInputs = (sha) => git("ls-tree", "-r", sha, "--", ...sourcePaths)
    .split("\n").filter((line) => !line.endsWith("\tscripts/deploy-aidreamcapes-release.mjs")).join("\n");
  assert.equal(buildInputs(reuseBuildCommit), buildInputs(commit), "Reused build must have identical tracked build inputs; only this deployment script may differ");
}
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
console.log(JSON.stringify({
  domain: "www.aivideosugc.com",
  service: "aidreamcapes.service",
  commit,
  release,
  appliesAidreamcapesLivePagePathMigration: args.includes("--apply")
}));
if (!args.includes("--apply")) process.exit(0);
assert.equal(value("--confirm"), "deploy-aidreamcapes", "Explicit target confirmation is required");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-release-"));
const archive = path.join(temp, "source.tar");
const buildArchive = path.join(temp, "build.tar");
const remoteArchive = `/tmp/aidreamcapes-${commit}.tar`;
const remoteBuildArchive = `/tmp/aidreamcapes-build-${commit}.tar`;
try {
  execFileSync("git", ["archive", "--format=tar", `--output=${archive}`, commit, "--", ...archivePaths]);
  if (prebuiltBuild) execFileSync("tar", ["-cf", buildArchive, "--exclude=./cache", "-C", path.resolve(prebuiltBuild), "."]);
  run("scp", ["-P", port, ...connection, archive, `${host}:${remoteArchive}`]);
  if (prebuiltBuild) run("scp", ["-P", port, ...connection, buildArchive, `${host}:${remoteBuildArchive}`]);
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
${reusePublicCommit ? `test "$(cat "$BASE/.deployed-commit")" = ${quote(reusePublicCommit)}
mkdir -p "$RELEASE/public"; cp -aln "$BASE/public/." "$RELEASE/public/"
printf '%s\\n' ${quote(reusePublicCommit)} > "$RELEASE/.public-asset-source-commit"` : 'mkdir -p "$RELEASE/public"; cp -a --reflink=auto -n "$BASE/public/." "$RELEASE/public/"'}
cp "$BASE/.env.local" "$RELEASE/.env.local"
cp "$BASE/.env.local" "$RELEASE/.env"
chmod 600 "$RELEASE/.env.local"
chmod 600 "$RELEASE/.env"
cd "$RELEASE"
${reuseDependenciesCommit ? `test "$(cat "$BASE/.deployed-commit")" = ${quote(reuseDependenciesCommit)}
test -d "$BASE/node_modules/.prisma/client"
cmp -s "$BASE/package.json" "$RELEASE/package.json"
cmp -s "$BASE/package-lock.json" "$RELEASE/package-lock.json"
cp -al "$BASE/node_modules" "$RELEASE/node_modules"
printf '%s\\n' ${quote(reuseDependenciesCommit)} > "$RELEASE/.dependency-source-commit"` : `npm ci --no-audit --no-fund
DINGYUE_ENV=production DATABASE_TARGET=production node ./node_modules/prisma/build/index.js generate`}
${prebuiltBuild ? `mkdir -p .next-build
tar -xf ${quote(remoteBuildArchive)} -C .next-build
rm -f ${quote(remoteBuildArchive)}
test -f .next-build/BUILD_ID
test "$(cat .next-build/.build-commit)" = ${quote(commit)}
DINGYUE_ENV=production DATABASE_TARGET=production npm run sync:aidreamcapes-trusted-logos` : reuseBuildCommit ? `REUSE=${quote(`${root}/releases/${reuseBuildCommit}-seo`)}
test "$(cat "$REUSE/.deployed-commit")" = ${quote(reuseBuildCommit)}
test -f "$REUSE/.next-build/BUILD_ID"
cp -a --reflink=auto "$REUSE/.next-build" "$RELEASE/.next-build"
DINGYUE_ENV=production DATABASE_TARGET=production npm run sync:aidreamcapes-trusted-logos` : "nice -n 10 env DINGYUE_ENV=production DATABASE_TARGET=production DINGYUE_BUILD_MAX_OLD_SPACE_SIZE=8192 npm run build"}
printf '%s\n' "$COMMIT" > .deployed-commit
CANDIDATE_PORT=$(node -e 'const server=require("node:net").createServer(); server.listen(0,"127.0.0.1",()=>{process.stdout.write(String(server.address().port));server.close();});')
HOSTNAME=127.0.0.1 PORT="$CANDIDATE_PORT" NODE_ENV=production NEXT_DIST_DIR=.next-build DINGYUE_ENV=production DATABASE_TARGET=production node server.mjs > .candidate.log 2>&1 &
CANDIDATE=$!
trap 'kill "$CANDIDATE" 2>/dev/null || true' EXIT
READY=0
for ATTEMPT in $(seq 1 60); do
  if ! kill -0 "$CANDIDATE" 2>/dev/null; then cat .candidate.log; exit 1; fi
  if grep -Fq "> Ready on http://127.0.0.1:$CANDIDATE_PORT" .candidate.log && curl -fsS --max-time 15 -H 'X-Forwarded-Host: www.aivideosugc.com' -H 'X-Forwarded-Proto: https' "http://127.0.0.1:$CANDIDATE_PORT/" > .candidate.html; then READY=1; break; fi
  sleep 2
done
test "$READY" = 1
AIDREAMCAPES_SEO_ORIGIN="http://127.0.0.1:$CANDIDATE_PORT" AIDREAMCAPES_SEO_PRE_NAV_MIGRATION=1 node scripts/smoke-aidreamcapes-seo-contract.mjs > .candidate-contract.json
cat .candidate-contract.json
kill "$CANDIDATE"; wait "$CANDIDATE" 2>/dev/null || true
trap - EXIT
# Apply the exact release's forward-only schema migrations after the built
# candidate passes its SSR contract and before it receives production traffic.
DINGYUE_ENV=production DATABASE_TARGET=production node ./node_modules/prisma/build/index.js migrate deploy
DROPIN=/etc/systemd/system/aidreamcapes.service.d/release.conf
cp "$DROPIN" .previous-release.conf
OLD_CURRENT=$(readlink -f "$ROOT/current")
printf '%s\n' '[Service]' "WorkingDirectory=$RELEASE" 'EnvironmentFile=' "EnvironmentFile=$RELEASE/.env.local" 'Environment=NODE_ENV=production' 'Environment=DINGYUE_ENV=production' 'Environment=DATABASE_TARGET=production' 'Environment=PLATFORM_STATE_POSTGRES_STRICT=1' 'Environment=NEXT_DIST_DIR=.next-build' 'Environment=HOSTNAME=127.0.0.1' 'Environment=PORT=3013' "Environment=GIT_COMMIT_SHA=$COMMIT" "Environment=NEXT_PUBLIC_RELEASE_COMMIT=$COMMIT" 'ExecStart=' "ExecStart=/usr/local/bin/node $RELEASE/server.mjs" > .next-release.conf
MIGRATION_APPLIED=0
rollback() {
  STATUS=$?
  if [ "$MIGRATION_APPLIED" = 1 ]; then
    echo 'Aidreamcapes LivePage migration committed; keeping the new release active for forward repair.' >&2
    exit "$STATUS"
  fi
  cp "$RELEASE/.previous-release.conf" "$DROPIN"
  ln -sfn "$OLD_CURRENT" "$ROOT/current"
  systemctl daemon-reload
  systemctl restart aidreamcapes.service || true
  exit "$STATUS"
}
trap rollback EXIT
cp .next-release.conf "$DROPIN"
ln -sfn "$RELEASE" "$ROOT/current.next"
mv -Tf "$ROOT/current.next" "$ROOT/current"
systemctl daemon-reload
systemctl restart aidreamcapes.service
test "$(systemctl is-active aidreamcapes.service)" = active
READY=0
for ATTEMPT in $(seq 1 30); do
  if curl -fsS --max-time 5 -H 'X-Forwarded-Host: www.aivideosugc.com' -H 'X-Forwarded-Proto: https' http://127.0.0.1:3013/ > .origin.html; then READY=1; break; fi
  sleep 2
done
test "$READY" = 1
DINGYUE_ENV=production DATABASE_TARGET=production node scripts/repair-aidreamcapes-navigation-paths.mjs --target=production --apply --confirm=site_aidreamcapes-navigation-paths > .navigation-path-migration.json
cat .navigation-path-migration.json
MIGRATION_APPLIED=1
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
