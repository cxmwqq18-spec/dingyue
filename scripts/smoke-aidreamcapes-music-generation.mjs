import assert from "node:assert/strict";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const corePath = path.join(root, "src/lib/aidreamcapes-workspace/music-generation-core.ts");
const coreSource = fs.readFileSync(corePath, "utf8");
const compiled = ts.transpileModule(coreSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const coreModule = new Module(corePath);
coreModule.filename = corePath;
coreModule.paths = Module._nodeModulePaths(path.dirname(corePath));
const nativeRequire = coreModule.require.bind(coreModule);
coreModule.require = (specifier) => {
  if (specifier === "./types") return {
    AIVIDEOSUGC_SITE_ID: "site_aidreamcapes",
    WorkspaceError: class WorkspaceError extends Error {
      constructor(code, status = 400, details) { super(code); this.code = code; this.status = status; this.details = details; }
    },
  };
  return nativeRequire(specifier);
};
coreModule._compile(compiled, corePath);
const {
  MUSIC_GENERATION_ZERO_SIDE_EFFECTS,
  assertMusicGenerationAttachable,
  assertMusicGenerationMockEnabled,
  createDeterministicMusicWav,
  makeQueuedMusicGenerationJob,
  musicGenerationCapabilities,
  musicGenerationRequestHash,
  publicMusicGenerationJob,
  replayMusicGenerationIdempotentJob,
  transitionMusicGenerationJob,
  validateMusicGenerationRequest,
} = coreModule.exports;

const fixturePath = path.join(root, "src/lib/aidreamcapes-workspace/music-generation-fixture.ts");
const fixtureSource = fs.readFileSync(fixturePath, "utf8");
const fixtureCompiled = ts.transpileModule(fixtureSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const fixtureModule = new Module(fixturePath);
fixtureModule.filename = fixturePath;
fixtureModule.paths = Module._nodeModulePaths(path.dirname(fixturePath));
const fixtureRequire = fixtureModule.require.bind(fixtureModule);
fixtureModule.require = (specifier) => {
  if (specifier === "server-only") return {};
  if (specifier === "./types") return {
    WorkspaceError: class WorkspaceError extends Error {
      constructor(code, status = 400, details) { super(code); this.code = code; this.status = status; this.details = details; }
    },
  };
  if (specifier === "./music-generation-core") return coreModule.exports;
  return fixtureRequire(specifier);
};
fixtureModule._compile(fixtureCompiled, fixturePath);
const { writeMusicGenerationFixture } = fixtureModule.exports;

function expectCode(run, code) {
  assert.throws(run, (error) => error?.code === code, `expected ${code}`);
}

const originalMode = process.env.AIVIDEOSUGC_STABILITY_MODE;
delete process.env.AIVIDEOSUGC_STABILITY_MODE;
try {
  const disabled = musicGenerationCapabilities();
  assert.equal(disabled.capabilityState, "not_configured");
  assert.equal(disabled.generationAvailable, false);
  assert.equal(disabled.productionReady, false);
  assert.equal(disabled.provider, null);
  assert.equal(disabled.billing, "none");
  assert.equal(disabled.rightsStatus, "unlicensed");
  assert.equal(disabled.canAttachAsLicensedAdMusic, false);
  assert.equal(disabled.canAdvertise, false);
  assert.equal(disabled.canPublish, false);
  assert.deepEqual({
    externalRequestCount: disabled.externalRequestCount,
    providerCalls: disabled.providerCalls,
    realLedgerWrites: disabled.realLedgerWrites,
  }, MUSIC_GENERATION_ZERO_SIDE_EFFECTS);
  expectCode(() => assertMusicGenerationMockEnabled(), "music_generation_not_configured");
  assert.equal(musicGenerationCapabilities("live").capabilityState, "not_configured");

  process.env.AIVIDEOSUGC_STABILITY_MODE = "mock";
  assert.doesNotThrow(() => assertMusicGenerationMockEnabled());
  const mockCapabilities = musicGenerationCapabilities();
  assert.equal(mockCapabilities.capabilityState, "mock_only");
  assert.equal(mockCapabilities.generationAvailable, true);
  assert.equal(mockCapabilities.providerCalls, 0);

  const request = validateMusicGenerationRequest({
    taskId: "task-a",
    taskRevision: 3,
    prompt: "A gentle, bright instrumental pulse",
    durationSeconds: 12,
    tempoBpm: 96,
    idempotencyKey: "music-test-01",
    rightsAcknowledgedUnlicensed: true,
  });
  assert.equal(validateMusicGenerationRequest({ ...request, idempotencyKey: undefined }, "music-test-01").idempotencyKey, "music-test-01");
  expectCode(() => validateMusicGenerationRequest({ ...request, rightsAcknowledgedUnlicensed: false }), "music_generation_unlicensed_ack_required");
  expectCode(() => validateMusicGenerationRequest({ ...request, durationSeconds: 31 }), "music_generation_duration_invalid");
  expectCode(() => validateMusicGenerationRequest({ ...request, tempoBpm: 201 }), "music_generation_tempo_invalid");
  expectCode(() => validateMusicGenerationRequest({ ...request, prompt: "\u0000" }), "music_generation_prompt_invalid");

  const requestHash = musicGenerationRequestHash(request);
  const queued = makeQueuedMusicGenerationJob({
    id: "job-create",
    customerId: "customer-a",
    request,
    requestHash,
    now: "2026-10-14T00:00:00.000Z",
  });
  const disabledFixtureRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), "aidreamcapes-music-disabled-"));
  const enabledMode = process.env.AIVIDEOSUGC_STABILITY_MODE;
  try {
    delete process.env.AIVIDEOSUGC_STABILITY_MODE;
    await assert.rejects(() => writeMusicGenerationFixture(queued, disabledFixtureRoot), (error) => error?.code === "music_generation_not_configured");
    assert.equal(fs.existsSync(path.join(disabledFixtureRoot, "site_aidreamcapes")), false);
  } finally {
    process.env.AIVIDEOSUGC_STABILITY_MODE = enabledMode;
    await fsPromises.rm(disabledFixtureRoot, { recursive: true, force: true });
  }
  assert.equal(queued.status, "queued");
  assert.equal(queued.revision, 1);
  assert.equal(queued.rightsStatus, "unlicensed");
  assert.equal(publicMusicGenerationJob(queued).fixtureAvailable, false);
  assert.deepEqual(replayMusicGenerationIdempotentJob(queued, requestHash), { job: queued, created: false });
  expectCode(() => replayMusicGenerationIdempotentJob(queued, "b".repeat(64)), "idempotency_conflict");

  const cancelled = transitionMusicGenerationJob(queued, "cancel", 1, "2026-10-14T00:01:00.000Z");
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.revision, 2);
  assert.equal(cancelled.fixtureKey, null);
  expectCode(() => transitionMusicGenerationJob(queued, "cancel", 2), "revision_conflict");

  const generated = transitionMusicGenerationJob(
    { ...queued, id: "job-run" },
    "run_mock",
    1,
    "2026-10-14T00:02:00.000Z",
    "mock-music/customer-a/task-a/job-run.wav",
  );
  assert.equal(generated.status, "mock_complete");
  assert.equal(generated.revision, 2);
  assert.equal(generated.rightsStatus, "unlicensed");
  assert.equal(generated.testOnly, true);
  const status = publicMusicGenerationJob(generated);
  assert.equal(status.fixtureAvailable, true);
  assert.equal(status.canAttachAsLicensedAdMusic, false);
  assert.equal(status.canAdvertise, false);
  assert.equal(status.canPublish, false);
  assert.equal(status.billing, "none");
  assert.deepEqual({ externalRequestCount: status.externalRequestCount, providerCalls: status.providerCalls, realLedgerWrites: status.realLedgerWrites }, MUSIC_GENERATION_ZERO_SIDE_EFFECTS);
  expectCode(() => assertMusicGenerationAttachable(generated, {
    siteId: "site_aidreamcapes", customerId: "customer-a", taskId: "task-a", revision: 3,
  }, 2), "music_generation_unlicensed");
  expectCode(() => assertMusicGenerationAttachable(generated, {
    siteId: "site_dreamshoot", customerId: "customer-a", taskId: "task-a", revision: 3,
  }, 2), "music_generation_task_not_owned");

  const wav = createDeterministicMusicWav({ requestHash, durationSeconds: 12, tempoBpm: 96 });
  assert.deepEqual(createDeterministicMusicWav({ requestHash, durationSeconds: 12, tempoBpm: 96 }), wav);
  assert.equal(wav.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(wav.subarray(8, 12).toString("ascii"), "WAVE");
  assert.equal(wav.subarray(36, 40).toString("ascii"), "data");
  assert.equal(wav.length, 44 + 8_000 * 12 * 2);
  assert.notDeepEqual(createDeterministicMusicWav({ requestHash: "c".repeat(64), durationSeconds: 12, tempoBpm: 96 }), wav);

  const fixtureRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), "aidreamcapes-music-fixture-"));
  try {
    const fixtureKey = await writeMusicGenerationFixture(generated, fixtureRoot);
    assert.equal(fixtureKey, "mock-music/customer-a/task-a/job-run.wav");
    const fixtureFile = path.join(fixtureRoot, "site_aidreamcapes", "customer-a", "task-a", "mock-music", "job-run.wav");
    assert.deepEqual(await fsPromises.readFile(fixtureFile), wav);
    assert.equal(await writeMusicGenerationFixture(generated, fixtureRoot), fixtureKey, "replay uses the same local fixture");
  } finally {
    await fsPromises.rm(fixtureRoot, { recursive: true, force: true });
  }

  const migration = fs.readFileSync(path.join(root, "prisma/migrations/20261014210000_add_aidreamcapes_music_generation_jobs/migration.sql"), "utf8");
  assert.match(migration, /CHECK \("siteId" = 'site_aidreamcapes'\)/);
  assert.match(migration, /"rightsStatus" = 'unlicensed' AND "testOnly" = TRUE/);
  assert.match(migration, /taskRevision/);
  assert.match(migration, /AidreamcapesMusicGenerationJob_owner_idempotency/);
  assert.match(migration, /AidreamcapesVideoTask" t WHERE t\."id" = NEW\."taskId"/);
  assert.doesNotMatch(migration, /site_dreamshoot|mydreamshoots/i);

  const routeRoot = path.join(root, "src/app/api/sites/[siteId]/aivideosugc/music");
  const routes = [
    "generation/capabilities/route.ts",
    "generations/route.ts",
    "generations/[jobId]/route.ts",
    "generations/[jobId]/run-mock/route.ts",
    "generations/[jobId]/cancel/route.ts",
    "generations/[jobId]/attach/route.ts",
  ].map((relative) => path.join(routeRoot, relative));
  for (const route of routes) assert.ok(fs.existsSync(route), `missing ${path.relative(root, route)}`);
  for (const route of routes) {
    const source = fs.readFileSync(route, "utf8");
    assert.match(source, /workspaceAuth\(request, siteId/);
    assert.doesNotMatch(source, /\b(fetch|axios|undici|http\.request|https\.request)\s*\(/i);
  }
  const service = fs.readFileSync(path.join(root, "src/lib/aidreamcapes-workspace/music-generation.ts"), "utf8");
  assert.match(service, /getTask\(siteId, customerId, request\.taskId\)/);
  assert.match(service, /"siteId" = 'site_aidreamcapes' AND "customerId" = \$\{customerId\}/);
  assert.match(service, /"revision" = \$\{expectedRevision\}/);
  assert.doesNotMatch(service, /\b(fetch|axios|undici|http\.request|https\.request)\s*\(/i);
  assert.doesNotMatch(service, /from ["'][^"']*(?:provider|billing|ledger|credits)[^"']*["']/i);
  assert.doesNotMatch(service, /AidreamcapesMusicCatalogTrack|AssetUpload/);
  const fixtureService = fs.readFileSync(fixturePath, "utf8");
  assert.match(fixtureService, /assertMusicGenerationMockEnabled\(\)/);
  assert.doesNotMatch(fixtureService, /\b(fetch|axios|undici|http\.request|https\.request)\s*\(/i);
  assert.doesNotMatch(fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8"), /AidreamcapesMusicGenerationJob/);
} finally {
  if (originalMode === undefined) delete process.env.AIVIDEOSUGC_STABILITY_MODE;
  else process.env.AIVIDEOSUGC_STABILITY_MODE = originalMode;
}

console.log("Aidreamcapes AI music generation default-off, mock lifecycle, revision, unlicensed rights, WAV determinism, and zero-external-side-effect checks passed.");
