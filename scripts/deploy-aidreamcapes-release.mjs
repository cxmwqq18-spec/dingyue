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
// Deploying application code never authorizes writes to editable site content.
const codeOnly = true;
const verifyInspirations = args.includes("--verify-inspirations");
const verifyMediaDetails = args.includes("--verify-media-details");
const verifyLoad = args.includes("--verify-load");
// The exhaustive sitemap SEO contract is a separate task. Pass this flag (or
// AIDREAMCAPES_RELEASE_FULL_SEO=1) only for releases that change public SEO,
// metadata or large amounts of published content.
const fullSeoContract = args.includes("--full-seo-contract") || process.env.AIDREAMCAPES_RELEASE_FULL_SEO === "1";
assert(/^[a-f0-9]{40}$/.test(commit || ""), "Supply the exact pushed --commit=<40-character SHA>");
const prebuiltBuild = value("--prebuilt-build");
const reuseBuildCommit = value("--reuse-build");
// Build window: stop the two EU storefronts (aidreamcapes.eu, aidreamshoots.eu)
// for the duration of the server-side build so the host has enough free memory,
// and answer their domains with the 503 maintenance page meanwhile. The build
// runs locally for prebuilt releases, so no window is needed there.
const buildWindow = args.includes("--build-window");
assert(!(buildWindow && (prebuiltBuild || reuseBuildCommit)), "--build-window applies to server-side builds only; a prebuilt or reused build needs no window");
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
// Editable TDK is owner-locked. An application release may not ship while the
// live homepage title/keywords/description differs from the approved lock.
execFileSync(process.execPath, ["scripts/guard-aivideosugc-home-tdk.mjs"], { stdio: "inherit" });
const sourcePaths = ["package.json", "package-lock.json", "next.config.mjs", "next-env.d.ts", "postcss.config.mjs", "tailwind.config.ts", "tsconfig.json", "tsconfig.typecheck.json", "eslint.config.mjs", "server.mjs", "data/saas-fonts.json", "data/saas-theme-packages.json", "data/saas-theme1-package.json", "prisma", "scripts", "src"];
const productionAssetPaths = [
  // Self-hosted font subsets referenced by the root layout stylesheet.
  "public/fonts",
  "public/assets/sites/site_aidreamcapes/workspace/actors/voices",
  "public/media/site_aidreamcapes/workspace/actors/library",
  // Width variants for the first viewport and the hub card images. They are
  // referenced by the committed responsive index, so a release that ships the
  // index has to ship the files with it.
  "public/assets/sites/site_aidreamcapes/v2-responsive",
  // Workspace guide screenshots and interaction loops for /guides.
  "public/assets/sites/site_aidreamcapes/guides",
  // Blog covers, press assets and inline article media.
  "public/assets/sites/site_aidreamcapes/blog",
  // About page office scenes and team portraits. The page renders these
  // addresses from LivePage content, so a release that publishes the page has
  // to ship the files with it.
  "public/assets/sites/site_aidreamcapes/about",
  // The committed full-content companion of /llms.txt. It is generated from the
  // live page copy, so a release that regenerates it has to ship the file; a
  // public directory copied from the previous release would keep serving the
  // older text.
  "public/llms-full.txt",
];
const archivePaths = [...sourcePaths, ...productionAssetPaths];
const root = "/www/wwwroot/aidreamcapes.com";
// The production bundle of this storefront is large. The build heap is
// configurable so a release can be given the room it needs instead of
// failing with a heap limit on the release host.
//
// Measured on a 24GB workstation: the build peaks at about 3.7GB of resident
// memory and finishes in about five minutes with a 16GB cap. On the shared
// release host the same build is best effort: it has finished with a 5120MB
// cap, and it has also died at 5120MB, 8GB and 12GB when the other storefront
// services left less memory than the heap wanted. A cap larger than the host
// can back makes it worse, because V8 grows the heap instead of collecting and
// the build swaps until it aborts. When this host cannot finish the build, use
// the prebuilt path in scripts/build-aidreamcapes-prebuilt.mjs.
const buildHeapMb = process.env.AIDREAMCAPES_BUILD_HEAP_MB || "5120";
// Measured build peak is about 3.7GB of resident memory; below this the host
// is already swapping and the build would thrash instead of finishing.
const buildMinAvailableMb = process.env.AIDREAMCAPES_BUILD_MIN_AVAILABLE_MB || "4608";
if (reuseBuildCommit) {
  assert(/^[a-f0-9]{40}$/.test(reuseBuildCommit), "Reuse requires an exact --reuse-build=<40-character SHA>");
  const buildInputs = (sha) => git("ls-tree", "-r", sha, "--", ...sourcePaths)
    .split("\n").filter((line) => !line.endsWith("\tscripts/deploy-aidreamcapes-release.mjs")).join("\n");
  assert.equal(buildInputs(reuseBuildCommit), buildInputs(commit), "Reused build must have identical tracked build inputs; only this deployment script may differ");
}
const release = `${root}/releases/${commit}-seo`;
const quote = (s) => `'${String(s).replaceAll("'", "'\\''")}'`;
const connection = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=6", "-o", "Compression=yes"];
if (process.env.SSH_CONFIG_PATH) connection.push("-F", process.env.SSH_CONFIG_PATH);
if (process.env.AI_PROJECT_SSH_KEY_PATH) connection.push("-i", process.env.AI_PROJECT_SSH_KEY_PATH);
// A release performs several SSH/scp/rsync operations in a row. Reusing one
// multiplexed connection keeps that sequence stable on hosts that throttle
// new connections, without changing what each operation does.
if (process.env.AI_PROJECT_SSH_CONTROL_PATH) connection.push("-o", `ControlPath=${process.env.AI_PROJECT_SSH_CONTROL_PATH}`);
const port = process.env.AI_PROJECT_SSH_PORT || "11765";
const host = `root@${process.env.AI_PROJECT_SSH_HOST || "204.77.130.125"}`;
const sshCommand = ["ssh", "-p", port, ...connection].map((arg) => quote(arg)).join(" ");
function run(command, argv) {
  const result = spawnSync(command, argv, { stdio: "inherit" });
  assert.equal(result.status, 0, `${command} failed (${result.status})`);
}
console.log(JSON.stringify({
  domain: "www.aivideosugc.com",
  service: "aidreamcapes.service",
  commit,
  release,
  fullSeoContract,
  appliesAidreamcapesLivePagePathMigration: args.includes("--apply") && !codeOnly
}));
if (!args.includes("--apply")) process.exit(0);
assert.equal(value("--confirm"), "deploy-aidreamcapes", "Explicit target confirmation is required");
// A release must never move the site backwards. The commit being deployed has
// to contain the commit that is live right now, so a stale or force-pushed
// base cannot roll back a shipped fix.
const liveCommit = execFileSync("ssh", ["-p", port, ...connection, host, `cat ${quote(`${root}/current/.deployed-commit`)} 2>/dev/null || true`], { encoding: "utf8" }).trim();
if (/^[a-f0-9]{40}$/.test(liveCommit)) {
  const keepsLive = spawnSync("git", ["merge-base", "--is-ancestor", liveCommit, commit]).status === 0;
  assert(keepsLive, `Refusing to deploy ${commit}: the live commit ${liveCommit} is not an ancestor of it, so this release would roll the site back.`);
  console.log(JSON.stringify({ liveCommit, containsLiveCommit: true }));
  assertPublicAssetsShipCommittedBytes(liveCommit);
}
// A release fills public/ from the live release and then overwrites only the
// paths listed in productionAssetPaths. A tracked public file that changed in
// git without being listed keeps serving the older bytes forever; that is how
// /llms-full.txt stayed on a previous month's copy across several releases.
// Compare the live copies against the committed blobs and refuse to ship stale
// public files instead of discovering the drift after the release.
function assertPublicAssetsShipCommittedBytes(baseCommit) {
  const publicBlobMap = (sha) => {
    const map = new Map();
    for (const line of git("ls-tree", "-r", sha, "--", "public").split("\n")) {
      if (!line) continue;
      const tab = line.indexOf("\t");
      map.set(line.slice(tab + 1), line.slice(0, tab).split(" ")[2]);
    }
    return map;
  };
  const covered = (assetPath) => productionAssetPaths.some((asset) => assetPath === asset || assetPath.startsWith(`${asset}/`));
  const commitPublic = publicBlobMap(commit);
  const basePublic = publicBlobMap(baseCommit);
  // Files only in the base are deleted from git but resurrected by the copy step.
  // They are reported, not refused: they serve unchanged bytes, so they cannot
  // make a page show content the release did not ship.
  const resurrected = [...basePublic.keys()].filter((assetPath) => !commitPublic.has(assetPath));
  const inherited = [...commitPublic.keys()]
    .filter((assetPath) => !covered(assetPath))
    .map((assetPath) => assetPath.replace(/^public\//, ""));
  const remote = spawnSync(
    "ssh",
    ["-p", port, ...connection, host, `cd ${quote(`${root}/current/public`)} && git hash-object --stdin-paths`],
    { input: `${inherited.join("\n")}\n`, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  assert.equal(remote.status, 0, `Refusing to deploy: could not read the live public asset hashes (${String(remote.stderr ?? "").trim().slice(0, 300)})`);
  const liveHashes = String(remote.stdout ?? "").trim().split("\n");
  const stale = [];
  inherited.forEach((assetPath, index) => {
    if (liveHashes[index] !== commitPublic.get(`public/${assetPath}`)) stale.push(assetPath);
  });
  assert.equal(
    stale.length,
    0,
    `Refusing to deploy ${commit}: ${stale.length} tracked public file(s) differ from the live release but are not in productionAssetPaths, so this release would keep serving the older bytes: ${stale.slice(0, 5).join(", ")}${stale.length > 5 ? ", ..." : ""}. Add the path to productionAssetPaths or move it out of public/.`
  );
  console.log(JSON.stringify({ publicAssetsMatchLiveBytes: true, inheritedPaths: inherited.length, resurrectedPaths: resurrected.length }));
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-release-"));
const archive = path.join(temp, "source.tar");
const remoteArchive = `/tmp/aidreamcapes-${commit}.tar`;
const buildStaging = `${root}/.build-staging`;
try {
  execFileSync("git", ["archive", "--format=tar", `--output=${archive}`, commit, "--", ...archivePaths]);
  if (prebuiltBuild) {
    // 构建产物走 rsync 增量传输：与服务器暂存目录按内容校验比对，只发送
    // 真正变化的块。首次部署为全量，之后未变的 chunk 通常不再上传。
    // --delete 保证暂存目录与本地构建完全一致；cache/ 是本机构建缓存，
    // 运行时无用，永不传输。暂存目录供远程 cp -al 硬链接进发布目录，
    // 后续 rsync 更新只替换暂存侧文件，历史发布的硬链接不受影响。
    run("rsync", ["-azc", "--delete", "--exclude=cache/", "-e", sshCommand, `${path.resolve(prebuiltBuild)}/`, `${host}:${buildStaging}/`]);
  }
  run("scp", ["-P", port, ...connection, archive, `${host}:${remoteArchive}`]);
  const command = `set -eu
ROOT=${quote(root)}
RELEASE=${quote(release)}
COMMIT=${quote(commit)}
BASE=$(systemctl show aidreamcapes.service -p WorkingDirectory | sed -n 's/^WorkingDirectory=//p')
OTHER_SERVICES=$(systemctl show mydreamshoots.service -p MainPID -p WorkingDirectory)
EU_SERVICE_PIDS=$(systemctl show aidreamcapes-eu.service aidreamshoots.service -p MainPID)
EU_SERVICE_DIRS=$(systemctl show aidreamcapes-eu.service aidreamshoots.service -p WorkingDirectory)
${buildWindow ? `restore_build_window() { systemctl start aidreamcapes-eu.service aidreamshoots.service 2>/dev/null || true; }` : `restore_build_window() { :; }`}
test -d "$BASE/public"
test -f "$BASE/.env.local"
# A release restart must never expose the default nginx 502 page. Refuse to
# touch the service unless the 503 maintenance page is installed and loaded.
test -s /www/wwwroot/aidreamcapes.com/maintenance/maintenance.html || { echo 'Refusing to deploy: Aidreamcapes maintenance page file is missing.' >&2; exit 1; }
nginx -T 2>/dev/null | grep -q 'location = /__maintenance' || { echo 'Refusing to deploy: nginx maintenance location is not loaded.' >&2; exit 1; }
nginx -T 2>/dev/null | grep -q 'error_page 502 503 504 =503 /__maintenance' || { echo 'Refusing to deploy: nginx maintenance error_page is not loaded.' >&2; exit 1; }
${buildWindow ? `test -s /www/wwwroot/aidreamcapes.eu/maintenance/maintenance.html || { echo 'Refusing to deploy: aidreamcapes.eu maintenance page file is missing.' >&2; exit 1; }
test -s /www/wwwroot/aidreamshoots.eu/maintenance/maintenance.html || { echo 'Refusing to deploy: aidreamshoots.eu maintenance page file is missing.' >&2; exit 1; }
nginx -T 2>/dev/null | grep -q '/www/wwwroot/aidreamcapes.eu/maintenance' || { echo 'Refusing to deploy: aidreamcapes.eu maintenance location is not loaded.' >&2; exit 1; }
nginx -T 2>/dev/null | grep -q '/www/wwwroot/aidreamshoots.eu/maintenance' || { echo 'Refusing to deploy: aidreamshoots.eu maintenance location is not loaded.' >&2; exit 1; }` : ""}
test ! -e "$RELEASE" || { echo "Refusing to deploy: $RELEASE already exists, probably from an earlier failed attempt. Remove that directory, then run the deploy again." >&2; exit 1; }
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
${prebuiltBuild ? `test -f "$ROOT/.build-staging/BUILD_ID"
test "$(cat "$ROOT/.build-staging/.build-commit")" = ${quote(commit)}
mkdir -p .next-build
cp -al "$ROOT/.build-staging/." .next-build/
test -f .next-build/BUILD_ID` : reuseBuildCommit ? `REUSE=${quote(`${root}/releases/${reuseBuildCommit}-seo`)}
test "$(cat "$REUSE/.deployed-commit")" = ${quote(reuseBuildCommit)}
test -f "$REUSE/.next-build/BUILD_ID"
cp -a --reflink=auto "$REUSE/.next-build" "$RELEASE/.next-build"` : `${buildWindow ? `# Build window: the build needs the memory the two EU storefronts hold.
# Stop them first so the free-memory check below sees the freed memory, verify
# their domains answer the 503 maintenance page directly at the origin, and arm
# a restore that runs on every exit path.
BUILD_WINDOW_SERVICES="aidreamcapes-eu.service aidreamshoots.service"
systemctl stop $BUILD_WINDOW_SERVICES
sleep 1
BUILD_WINDOW_OK=1
for BUILD_WINDOW_DOMAIN in aidreamcapes.eu aidreamshoots.eu; do
  BUILD_WINDOW_CODE=$(curl -sk -o /dev/null -w '%{http_code}' --resolve "$BUILD_WINDOW_DOMAIN:443:127.0.0.1" "https://$BUILD_WINDOW_DOMAIN/")
  if [ "$BUILD_WINDOW_CODE" != "503" ]; then
    echo "Refusing to build: $BUILD_WINDOW_DOMAIN answered $BUILD_WINDOW_CODE instead of the 503 maintenance page." >&2
    BUILD_WINDOW_OK=0
  fi
done
if [ "$BUILD_WINDOW_OK" != "1" ]; then
  restore_build_window
  exit 1
fi
echo 'build window: aidreamcapes-eu.service and aidreamshoots.service stopped, maintenance pages verified'
trap 'restore_build_window' EXIT` : ""}
AVAILABLE_MB=$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
if [ "${process.env.AIDREAMCAPES_BUILD_ALLOW_LOW_MEMORY === "1" ? "1" : "0"}" != "1" ] && [ "$AVAILABLE_MB" -lt ${buildMinAvailableMb} ]; then
  echo "Refusing to build on this host: ${buildMinAvailableMb}MB of free memory is required and only \${AVAILABLE_MB}MB is available." >&2
  echo "Build locally with scripts/build-aidreamcapes-prebuilt.mjs and deploy with --prebuilt-build, or set AIDREAMCAPES_BUILD_ALLOW_LOW_MEMORY=1 to try anyway." >&2
  restore_build_window
  exit 1
fi
nice -n 10 env DINGYUE_ENV=production DATABASE_TARGET=production DINGYUE_BUILD_MAX_OLD_SPACE_SIZE=${buildHeapMb} node scripts/build-production.mjs`}
printf '%s\n' "$COMMIT" > .deployed-commit
CANDIDATE_PORT=$(node -e 'const server=require("node:net").createServer(); server.listen(0,"127.0.0.1",()=>{process.stdout.write(String(server.address().port));server.close();});')
HOSTNAME=127.0.0.1 PORT="$CANDIDATE_PORT" NODE_ENV=production NEXT_DIST_DIR=.next-build DINGYUE_ENV=production DATABASE_TARGET=production node server.mjs > .candidate.log 2>&1 &
CANDIDATE=$!
trap 'restore_build_window; kill "$CANDIDATE" 2>/dev/null || true' EXIT
READY=0
for ATTEMPT in $(seq 1 60); do
  if ! kill -0 "$CANDIDATE" 2>/dev/null; then cat .candidate.log; exit 1; fi
  if grep -Fq "> Ready on http://127.0.0.1:$CANDIDATE_PORT" .candidate.log && curl -fsS --max-time 15 -H 'X-Forwarded-Host: www.aivideosugc.com' -H 'X-Forwarded-Proto: https' "http://127.0.0.1:$CANDIDATE_PORT/" > .candidate.html; then READY=1; break; fi
  sleep 2
done
test "$READY" = 1
AIDREAMCAPES_ROUTE_SMOKE_ORIGIN="http://127.0.0.1:$CANDIDATE_PORT" AIDREAMCAPES_ROUTE_SMOKE_MEDIA_ORIGIN="https://www.aivideosugc.com" node scripts/smoke-aidreamcapes-release-routes.mjs > .candidate-routes.json
cat .candidate-routes.json
AIDREAMCAPES_AUDIT_ORIGIN="http://127.0.0.1:$CANDIDATE_PORT" node scripts/aidreamcapes-workspace/smoke-media-slug-aliases.mjs > .candidate-seo-paths.json
cat .candidate-seo-paths.json
node scripts/smoke-aidreamcapes-chain-identities.mjs > .candidate-chain-identities.json
cat .candidate-chain-identities.json
${verifyLoad ? `AIDREAMCAPES_LOAD_ORIGIN="http://127.0.0.1:$CANDIDATE_PORT" node scripts/smoke-aidreamcapes-concurrency.mjs --limit=24 --concurrency=4 --max-p95-ms=20000 > .candidate-load.json
cat .candidate-load.json` : ""}
AIDREAMCAPES_ROUTE_SMOKE_ORIGIN="http://127.0.0.1:$CANDIDATE_PORT" AIDREAMCAPES_ROUTE_SMOKE_MEDIA_ORIGIN="https://www.aivideosugc.com" node scripts/aidreamcapes-workspace/audit-card-entry-links.mjs > .candidate-card-links.json
cat .candidate-card-links.json
${fullSeoContract ? 'AIDREAMCAPES_SEO_ORIGIN="http://127.0.0.1:$CANDIDATE_PORT" AIDREAMCAPES_SEO_MEDIA_ORIGIN="https://www.aivideosugc.com" AIDREAMCAPES_SEO_PRE_NAV_MIGRATION=1 node scripts/smoke-aidreamcapes-seo-contract.mjs > .candidate-contract.json\ncat .candidate-contract.json' : ""}
${verifyInspirations ? 'AIDREAMCAPES_INSPIRATIONS_ORIGIN="http://127.0.0.1:$CANDIDATE_PORT" AIDREAMCAPES_INSPIRATIONS_MEDIA_ORIGIN=https://www.aivideosugc.com node scripts/aidreamcapes-workspace/smoke-inspirations-release.mjs > .candidate-inspirations.json\ncat .candidate-inspirations.json' : ""}
${verifyMediaDetails ? 'AIDREAMCAPES_AUDIT_ORIGIN="http://127.0.0.1:$CANDIDATE_PORT" AIDREAMCAPES_AUDIT_CONCURRENCY=2 node scripts/aidreamcapes-workspace/verify-media-detail-remediation.mjs > .candidate-media-details.json\ncat .candidate-media-details.json' : ""}
kill "$CANDIDATE"; wait "$CANDIDATE" 2>/dev/null || true
trap - EXIT
${buildWindow ? `# The switch phase has its own rollback trap; keep the window restore armed
# until the release finishes so a failure here cannot leave the EU sites down.
trap 'restore_build_window' EXIT` : ""}
# Chunk reachability: nginx serves /_next/static/ from this shared directory
# first, so a tab opened before a deploy keeps resolving the previous release's
# hashed chunk names (a 404 here surfaced as a client-side exception on scroll).
# Chunk names are content-hashed and immutable, so hardlink them and prune only
# months-old leftovers.
mkdir -p "$ROOT/shared/next-static/_next/static"
if [ -d "$BASE/.next-build/static" ]; then cp -al -n "$BASE/.next-build/static/." "$ROOT/shared/next-static/_next/static/" 2>/dev/null || true; fi
if [ -d "$RELEASE/.next-build/static" ]; then cp -al -n "$RELEASE/.next-build/static/." "$ROOT/shared/next-static/_next/static/" 2>/dev/null || true; fi
find "$ROOT/shared/next-static/_next/static" -type f -mtime +30 -delete 2>/dev/null || true

# Apply the exact release's forward-only schema migrations after the built
# candidate passes its SSR contract and before it receives production traffic.
DINGYUE_ENV=production DATABASE_TARGET=production node ./node_modules/prisma/build/index.js migrate deploy
DROPIN=/etc/systemd/system/aidreamcapes.service.d/release.conf
cp "$DROPIN" .previous-release.conf
OLD_CURRENT=$(readlink -f "$ROOT/current")
printf '%s\n' '[Service]' "WorkingDirectory=$RELEASE" 'EnvironmentFile=' "EnvironmentFile=$RELEASE/.env.local" 'Environment=NODE_ENV=production' 'Environment=DINGYUE_ENV=production' 'Environment=DATABASE_TARGET=production' 'Environment=PLATFORM_STATE_POSTGRES_STRICT=1' 'Environment=NEXT_DIST_DIR=.next-build' 'Environment=HOSTNAME=127.0.0.1' 'Environment=PORT=3013' 'Environment=WORKSPACE_WORKER_RECOVERY=1' "Environment=GIT_COMMIT_SHA=$COMMIT" "Environment=NEXT_PUBLIC_RELEASE_COMMIT=$COMMIT" 'ExecStart=' "ExecStart=/usr/local/bin/node $RELEASE/server.mjs" > .next-release.conf
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
  restore_build_window
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
  if curl -fsS --max-time 20 -H 'X-Forwarded-Host: www.aivideosugc.com' -H 'X-Forwarded-Proto: https' http://127.0.0.1:3013/ > .origin.html; then READY=1; break; fi
  sleep 2
done
test "$READY" = 1
${codeOnly ? "# Code-only release: current relational content is read without content migrations." : `DINGYUE_ENV=production DATABASE_TARGET=production node scripts/repair-aidreamcapes-navigation-paths.mjs --target=production --apply --confirm=site_aidreamcapes-navigation-paths > .navigation-path-migration.json
cat .navigation-path-migration.json
DINGYUE_ENV=production DATABASE_TARGET=production node scripts/repair-aidreamcapes-static-create-links.mjs --target=production --apply --confirm=site_aidreamcapes-static-create-links > .static-create-links-migration.json
cat .static-create-links-migration.json
MIGRATION_APPLIED=1`}
if node scripts/purge-aidreamcapes-public-cache.mjs --apply > .edge-purge.json; then
  cat .edge-purge.json
else
  cat .edge-purge.json
  echo 'Edge cache purge failed; the new release stays active for forward repair.' >&2
  MIGRATION_APPLIED=1
  exit 1
fi
AIDREAMCAPES_ROUTE_SMOKE_ORIGIN=http://127.0.0.1:3013 AIDREAMCAPES_ROUTE_SMOKE_MEDIA_ORIGIN=https://www.aivideosugc.com node scripts/smoke-aidreamcapes-release-routes.mjs > .origin-routes.json
AIDREAMCAPES_AUDIT_ORIGIN=http://127.0.0.1:3013 node scripts/aidreamcapes-workspace/smoke-media-slug-aliases.mjs > .origin-seo-paths.json
cat .origin-seo-paths.json
node scripts/smoke-aidreamcapes-chain-identities.mjs > .origin-chain-identities.json
cat .origin-chain-identities.json
cat .origin-routes.json
${verifyLoad ? `AIDREAMCAPES_LOAD_ORIGIN=http://127.0.0.1:3013 node scripts/smoke-aidreamcapes-concurrency.mjs --limit=24 --concurrency=4 --max-p95-ms=20000 > .origin-load.json
cat .origin-load.json` : ""}
AIDREAMCAPES_ROUTE_SMOKE_ORIGIN=http://127.0.0.1:3013 AIDREAMCAPES_ROUTE_SMOKE_MEDIA_ORIGIN=https://www.aivideosugc.com node scripts/aidreamcapes-workspace/audit-card-entry-links.mjs > .origin-card-links.json
cat .origin-card-links.json
${fullSeoContract ? `AIDREAMCAPES_SEO_ORIGIN=http://127.0.0.1:3013 AIDREAMCAPES_SEO_MEDIA_ORIGIN=https://www.aivideosugc.com ${codeOnly ? "AIDREAMCAPES_SEO_PRE_NAV_MIGRATION=1 " : ""}node scripts/smoke-aidreamcapes-seo-contract.mjs > .origin-contract.json
cat .origin-contract.json` : ""}
${verifyInspirations ? 'AIDREAMCAPES_INSPIRATIONS_ORIGIN=http://127.0.0.1:3013 AIDREAMCAPES_INSPIRATIONS_MEDIA_ORIGIN=https://www.aivideosugc.com node scripts/aidreamcapes-workspace/smoke-inspirations-release.mjs > .origin-inspirations.json\ncat .origin-inspirations.json' : ""}
test "$(cat "$ROOT/current/.deployed-commit")" = "$COMMIT"
test "$(systemctl show aidreamcapes.service -p WorkingDirectory | sed -n 's/^WorkingDirectory=//p')" = "$RELEASE"
test "$(systemctl show mydreamshoots.service -p MainPID -p WorkingDirectory)" = "$OTHER_SERVICES"
test "$(systemctl show aidreamcapes-eu.service aidreamshoots.service -p WorkingDirectory)" = "$EU_SERVICE_DIRS"
${buildWindow ? `restore_build_window
test "$(systemctl is-active aidreamcapes-eu.service)" = active
test "$(systemctl is-active aidreamshoots.service)" = active
echo 'build window closed: aidreamcapes-eu.service and aidreamshoots.service active again'` : `test "$(systemctl show aidreamcapes-eu.service aidreamshoots.service -p MainPID)" = "$EU_SERVICE_PIDS"`}
trap - EXIT
printf '%s\n' "deployed_commit=$COMMIT" "current=$RELEASE" 'service=aidreamcapes.service'
# The Cloudflare edge caches public HTML for two hours. A new release changes
# what the origin answers without touching any content revision, so the
# revision-triggered purge never fires — purge the edge here instead, or
# visitors keep the previous release's HTML (and headers) for up to two hours.
if curl -fsS --max-time 20 -H "Authorization: Bearer $(grep '^CLOUDFLARE_API_TOKEN=' "$RELEASE/.env.local" | cut -d= -f2- | tr -d '"' | tr -d ' ')" -H "Content-Type: application/json" "https://api.cloudflare.com/client/v4/zones/\${AIDREAMCAPES_PURGE_ZONE_ID:-8bd33b91a4bc763f3d994e0d0777bbf9}/purge_cache" --data '{"purge_everything":true}' | grep -q '"success":true'; then
  echo 'edge_purge=ok'
else
  echo 'edge_purge=FAILED (run the purge manually: the edge may serve the previous release for up to two hours)'
fi
`;
  if (args.includes("--print-remote-command")) {
    fs.rmSync(temp, { recursive: true, force: true });
    console.log(command);
    process.exit(0);
  }
  try {
    run("ssh", ["-p", port, ...connection, host, command]);
  } catch (error) {
    if (!prebuiltBuild && !reuseBuildCommit) {
      console.error([
        "",
        "The release host did not finish this deploy. If the build ran out of memory, build here and upload the artifact:",
        `  npm run deploy:aidreamcapes:prebuilt -- --commit=${commit}`,
        `  node scripts/deploy-aidreamcapes-release.mjs --commit=${commit} --prebuilt-build=.next-build --apply --confirm=deploy-aidreamcapes`,
        "",
        `A failed attempt leaves ${release} behind; remove it before retrying.`
      ].join("\n"));
    }
    throw error;
  }
  // Each release is about 10GB. Keep the directory bounded as part of the
  // release instead of waiting for the disk to fill up: the running release,
  // the previous ones and anything with a .keep marker survive.
  if (!args.includes("--no-prune")) {
    const prune = spawnSync(process.execPath, [
      "scripts/prune-aidreamcapes-releases.mjs",
      "--apply",
      "--confirm=prune-aidreamcapes-releases",
      `--keep=${process.env.AIDREAMCAPES_RELEASE_RETENTION || "3"}`
    ], { stdio: "inherit" });
    if (prune.status !== 0) {
      console.error("warning: release retention prune failed; the deployed release stays active and the old releases were left in place");
    }
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
