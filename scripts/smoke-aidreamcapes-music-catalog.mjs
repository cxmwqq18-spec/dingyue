import assert from "node:assert/strict";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const moduleTemp = fsSync.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-music-modules-"));
for (const name of ["music-catalog-rights", "music-catalog-preview"]) {
  const sourcePath = path.join(process.cwd(), "src/lib/aidreamcapes-workspace", `${name}.ts`);
  const output = ts.transpileModule(fsSync.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  fsSync.writeFileSync(path.join(moduleTemp, `${name}.js`), output);
}
const requireTemp = createRequire(path.join(moduleTemp, "entry.cjs"));
const { AIDREAMCAPES_MUSIC_SITE_ID, MUSIC_DEMO_FIXTURES, evaluateMusicRights } = requireTemp("./music-catalog-rights.js");
const { MusicPreviewPathError, readContainedMusicPreviewFile, resolveContainedMusicPreviewPath } = requireTemp("./music-catalog-preview.js");
fsSync.rmSync(moduleTemp, { recursive: true, force: true });

const now = new Date("2026-10-14T00:00:00.000Z");
const track = {
  id: "track-cleared-01",
  siteId: AIDREAMCAPES_MUSIC_SITE_ID,
  title: "Cleared synthetic catalog record",
  artist: "Test Artist",
  genre: "ambient",
  moods: ["calm"],
  durationSeconds: 30,
  bpm: null,
  previewAssetKey: "ambient/preview.wav",
  demoOnly: false,
  active: true,
};
const license = {
  id: "license-customer-a-01",
  siteId: AIDREAMCAPES_MUSIC_SITE_ID,
  customerId: "customer-a",
  trackId: track.id,
  status: "active",
  territories: ["US", "CA"],
  usageTypes: ["ads"],
  attributionRequired: true,
  attributionText: "Music: Test Artist — Cleared synthetic catalog record",
  startsAt: null,
  expiresAt: "2026-12-31T23:59:59.000Z",
  revision: 4,
};
const evaluate = (licenseOverride = license, overrides = {}) => evaluateMusicRights({
  track: { ...track, ...(overrides.track ?? {}) },
  license: licenseOverride,
  siteId: overrides.siteId ?? AIDREAMCAPES_MUSIC_SITE_ID,
  customerId: overrides.customerId ?? "customer-a",
  territory: overrides.territory ?? "US",
  usage: overrides.usage ?? "ads",
  now,
});

assert.deepEqual(evaluate(), {
  allowed: true,
  attributionRequired: true,
  attributionText: license.attributionText,
});
assert.equal(evaluate(null).code, "music_license_required");
assert.equal(evaluate({ ...license, expiresAt: "2026-10-14T00:00:00.000Z" }).code, "music_license_expired");
assert.equal(evaluate(license, { territory: "GB" }).code, "music_territory_not_covered");
assert.equal(evaluate({ ...license, usageTypes: ["organic"] }).code, "music_ads_not_permitted");
assert.equal(evaluate({ ...license, customerId: "customer-b" }).code, "music_license_not_owned");
assert.equal(evaluate(license, { siteId: "site_dreamshoot" }).code, "music_catalog_site_mismatch");
assert.equal(evaluate(license, { track: { demoOnly: true } }).code, "music_demo_track_not_licensable");
assert.equal(evaluate({ ...license, attributionText: "  " }).code, "music_attribution_unavailable");
assert.equal(MUSIC_DEMO_FIXTURES.length > 0, true);
assert.ok(MUSIC_DEMO_FIXTURES.every((fixture) => fixture.demoOnly && fixture.licenseStatus === "unlicensed" && fixture.license === null && !fixture.previewAssetKey));

const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aidreamcapes-music-catalog-"));
try {
  const previewRoot = path.join(temporaryRoot, "previews");
  const outsideRoot = path.join(temporaryRoot, "outside");
  await fs.mkdir(path.join(previewRoot, "ambient"), { recursive: true });
  await fs.mkdir(outsideRoot, { recursive: true });
  const bytes = Buffer.from("local synthetic path test fixture");
  await fs.writeFile(path.join(previewRoot, "ambient", "preview.wav"), bytes);
  await fs.writeFile(path.join(outsideRoot, "outside.wav"), bytes);

  assert.equal(resolveContainedMusicPreviewPath(previewRoot, "ambient/preview.wav"), path.join(previewRoot, "ambient", "preview.wav"));
  for (const unsafe of ["../outside.wav", "/tmp/outside.wav", "ambient/../outside.wav", "ambient\\outside.wav", "ambient/%2e%2e/outside.wav"]) {
    assert.throws(() => resolveContainedMusicPreviewPath(previewRoot, unsafe), MusicPreviewPathError);
  }
  const preview = await readContainedMusicPreviewFile(previewRoot, "ambient/preview.wav");
  assert.equal(preview.contentType, "audio/wav");
  assert.deepEqual(preview.bytes, bytes);

  await fs.symlink(path.join(outsideRoot, "outside.wav"), path.join(previewRoot, "linked.wav"));
  await assert.rejects(readContainedMusicPreviewFile(previewRoot, "linked.wav"), (error) => error instanceof MusicPreviewPathError && error.code === "unsafe_music_preview_path");
  await fs.symlink(outsideRoot, path.join(previewRoot, "linked-directory"));
  await assert.rejects(readContainedMusicPreviewFile(previewRoot, "linked-directory/outside.wav"), (error) => error instanceof MusicPreviewPathError && error.code === "unsafe_music_preview_path");
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}

console.log("Aidreamcapes music catalog rights, tenant, fixture, and contained-path checks passed.");
