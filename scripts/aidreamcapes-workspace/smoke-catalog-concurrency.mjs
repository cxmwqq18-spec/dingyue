import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// Every I/O dependency is an in-memory gate. This smoke never loads Prisma,
// calls a provider, or opens a network connection.
const SITE = "site_aidreamcapes";
const customerId = "catalog_fixture_customer";
const load = (name, mocks) => {
  const filename = path.resolve(`src/lib/aidreamcapes-workspace/${name}.ts`);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const fixtureModule = { exports: {} };
  new Function("require", "module", "exports", output)((id) => mocks[id] ?? {}, fixtureModule, fixtureModule.exports);
  return fixtureModule.exports;
};
const gate = (label, events, result) => {
  let release;
  const promise = new Promise((resolve) => { release = () => resolve(result); });
  return { run: () => { events.push(label); return promise; }, release };
};

const events = [];
const catalogGate = gate("catalog", events, { actors: [{ actorId: "builtin" }] });
const actorGate = gate("customerActors", events, [{ actorId: "private" }]);
const api = load("api", {
  "./provider": { getWorkspaceCatalog: async (siteId) => { assert.equal(siteId, SITE); return structuredClone(await catalogGate.run()); } },
  "./store": { listActors: async (siteId, owner) => { assert.equal(siteId, SITE); assert.equal(owner, customerId); return actorGate.run(); } },
});
const pending = api.catalogForCustomer(SITE, customerId);
assert.deepEqual(events, ["catalog", "customerActors"], "both catalog and scoped actor reads must start before either completes");
catalogGate.release();
actorGate.release();
assert.deepEqual((await pending).actors.map((actor) => actor.actorId), ["builtin", "private"]);
events.length = 0;
assert.deepEqual((await api.catalogForCustomer(SITE)).actors.map((actor) => actor.actorId), ["builtin"]);
assert.deepEqual(events, ["catalog"], "guest catalog must not read a customer's private actors");

const providerEvents = [];
const gates = Object.fromEntries(["video", "image", "videoApp", "imageApp", "asr"].map((label) =>
  [label, gate(label, providerEvents, label === "asr" ? { enabled: true, apiKey: "fixture", aiUrl: "https://fixture.invalid" } : label.endsWith("App") ? { creditCost: 4 } : [])]));
const originalAsr = process.env.AIVIDEOSUGC_ASR_PROVIDER_ID;
process.env.AIVIDEOSUGC_ASR_PROVIDER_ID = "fixture-asr";
try {
  const provider = load("provider", {
    "@/lib/prisma": { prisma: { siteAiApp: { findFirst: ({ where }) => {
      assert.equal(where.siteId, SITE);
      return gates[where.aiApp.slug === "video_generator" ? "videoApp" : "imageApp"].run();
    } } } },
    "./provider-catalog-read": {
      listWorkspaceProviderRows: ({ providerType }) => gates[providerType].run(),
      getWorkspaceProviderRow: (id) => { assert.equal(id, "fixture-asr"); return gates.asr.run(); },
    },
    "@/lib/stores/platform-store": {
      listPlatformAiProvidersRelational: ({ providerType }) => gates[providerType].run(),
      getPlatformAiProviderRelational: (id) => { assert.equal(id, "fixture-asr"); return gates.asr.run(); },
    },
    "./catalogs": {
      assertWorkspaceSite: (siteId) => assert.equal(siteId, SITE), SCENES: [], WORKSPACE_LANGUAGES: [], WORKSPACE_ASPECTS: [],
    },
    "./capabilities": { workspaceOutputOptions: () => ({ aspects: [], durations: [] }) },
    "./stability": { isWorkspaceStabilityMockMode: () => false },
    "./actors.json": { actors: [] },
  });
  const catalog = provider.getWorkspaceCatalog(SITE);
  assert.deepEqual(providerEvents, ["video", "videoApp", "image", "imageApp", "asr"],
    "ASR availability must start alongside the provider/app reads");
  Object.values(gates).forEach((entry) => entry.release());
  assert.equal((await catalog).subtitles.available, true);
} finally {
  if (originalAsr === undefined) delete process.env.AIVIDEOSUGC_ASR_PROVIDER_ID;
  else process.env.AIVIDEOSUGC_ASR_PROVIDER_ID = originalAsr;
}
console.log("PASS: workspace catalog reads run concurrently; customer actor reads remain scoped and absent for guests.");
