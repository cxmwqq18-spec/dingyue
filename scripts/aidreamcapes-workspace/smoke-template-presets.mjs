import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

// Offline contract regression: mocked LivePage, task storage, auth, and provider transport.
// This script never opens a database connection or sends a network request.
const source = path.join(process.cwd(), "src/lib/aidreamcapes-workspace");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-template-preset-"));
const require = createRequire(path.join(temp, "entry.cjs"));
const transpile = (name) => ts.transpileModule(fs.readFileSync(path.join(source, `${name}.ts`), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const compileModule = (name, scopedRequire) => {
  const compiled = { exports: {} };
  new Function("require", "module", "exports", transpile(name))(scopedRequire, compiled, compiled.exports);
  return compiled.exports;
};
class WorkspaceError extends Error {
  constructor(code, status = 400, details) { super(code); this.code = code; this.status = status; this.details = details; }
}

try {
  const presetContract = compileModule("preset-contract", require);
  const inspirationModule = { exports: {} };
  const inspirationSource = ts.transpileModule(fs.readFileSync(path.join(source, "../aidreamcapes-inspirations-types.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", inspirationSource)((id) => id === "@/lib/aidreamcapes-workspace/preset-contract" ? presetContract : require(id), inspirationModule, inspirationModule.exports);
  for (const [kind, family] of [["video", "ai-video-generation"], ["photo", "ai-image-generation"]]) {
    const card = { kind, publicSlug: "readable-product-scene", sceneSlug: "internal-scene-12345678", pageSlug: "/examples", toolSlug: "product-videos", prompt: "A product scene." };
    assert.equal(inspirationModule.exports.inspirationCreateHref(card), `/${family}/readable-product-scene`);
    assert.equal(inspirationModule.exports.inspirationCreateHref(card, "/site/aidreamcapes"), `/site/aidreamcapes/${family}/readable-product-scene`);
  }
  const navigationModules = new Map();
  const navigationRequire = (id) => {
    if (!id.startsWith("./")) return require(id);
    const name = id.slice(2);
    if (navigationModules.has(name)) return navigationModules.get(name).exports;
    const entry = { exports: {} };
    navigationModules.set(name, entry);
    new Function("require", "module", "exports", transpile(name))(navigationRequire, entry, entry.exports);
    return entry.exports;
  };
  const navigation = navigationRequire("./navigation");
  assert.equal(navigation.workspaceViewHref("", "inspirations"), "/app/create/inspirations");
  assert.equal(navigation.workspaceViewHref("/site/aidreamcapes", "inspirations"), "/site/aidreamcapes/app/create/inspirations");
  assert.equal(navigation.workspaceViewHref("/site/aivideosugc", "inspirations"), "/site/aivideosugc/app/create/inspirations");
  let livePageRow;
  let livePageReads = 0;
  const livePageCalls = [];
  const publicRouteCalls = [];
  const prismaMock = { livePage: { async findUnique(args) {
    livePageReads++; livePageCalls.push(structuredClone(args));
    return livePageRow;
  } }, async $queryRaw(strings, ...values) {
    publicRouteCalls.push({ sql: strings.join("?"), values });
    const [siteId, publicSlug, kind] = values;
    if (siteId !== "site_aidreamcapes" || !livePageRow) return [];
    const cards = Object.values(livePageRow.contentJson.sections ?? {}).flatMap((section) =>
      section?.type === "aidreamcapes_v2_page" && Array.isArray(section?.settings?.data?.visual?.picker?.cards)
        ? section.settings.data.visual.picker.cards : []);
    return cards.some((card) => card.publicSlug === publicSlug && card.kind === kind)
      ? [{ slug: "/templates", ...livePageRow }]
      : [];
  } };
  const resolverRequire = (id) => {
    if (id === "server-only") return {};
    if (id === "@/lib/prisma") return { prisma: prismaMock };
    if (id === "./preset-contract") return presetContract;
    if (id === "./static-routes") return navigationRequire("./static-routes");
    if (id === "./types") return { AIVIDEOSUGC_SITE_ID: "site_aidreamcapes" };
    return require(id);
  };
  const { resolveWorkspacePreset, resolveWorkspacePublicScenePreset } = compileModule("presets.server", resolverRequire);
  const makeCard = (overrides = {}) => ({
    image: { src: "/media/site_aidreamcapes/picker/creator.webp", w: 720, h: 1280 },
    label: "Creator product demo", prompt: "A creator demonstrates the product in a bright room.",
    href: "/app/create?tool=video-ads&size=9:16&length=10", kind: "video", tool: "video-ads", ...overrides,
  });
  const makePage = (card, updatedAt = "2026-10-15T01:02:03.000Z") => ({
    updatedAt: new Date(updatedAt),
    contentJson: { sectionsOrder: ["intro", "picker"], sections: {
      intro: { type: "hero", settings: {} },
      picker: { type: "aidreamcapes_v2_page", settings: { data: { visual: { picker: { cards: [card] } } } } },
    } },
  });
  const card = makeCard();
  const presetId = presetContract.pickerPresetId(card);
  livePageRow = makePage(card);
  const resolved = await resolveWorkspacePreset("site_aidreamcapes", { sourcePage: "/templates", presetId });
  assert.equal(resolved.presetId, presetId);
  assert.equal(resolved.sceneId, "presenter_showcase", "creator video preset resolves to presenter scene");
  assert.equal(resolved.aspect, "9:16");
  assert.equal(resolved.duration, 10);
  assert.equal(resolved.sourceUpdatedAt, "2026-10-15T01:02:03.000Z");
  assert.equal(resolved.previewUrl, card.image.src);
  assert.equal(livePageCalls[0].where.siteId_slug.siteId, "site_aidreamcapes");
  assert.equal(livePageCalls[0].where.siteId_slug.slug, "/templates");
  assert.deepEqual(livePageCalls[0].select, { contentJson: true, updatedAt: true });

  const stablePresetId = presetContract.pickerPresetId(makeCard());
  assert.equal(stablePresetId, presetId, "preset identity is stable for an unchanged card");
  livePageRow = null;
  assert.equal(await resolveWorkspacePreset("site_aidreamcapes", { sourcePage: "/templates", presetId }), undefined, "missing current LivePage is rejected");
  const readsBeforeWrongSite = livePageReads;
  assert.equal(await resolveWorkspacePreset("site_dreamshoot", { sourcePage: "/templates", presetId }), undefined);
  assert.equal(livePageReads, readsBeforeWrongSite, "foreign site never reads a page");
  livePageRow = makePage(makeCard({ image: { src: "https://evil.example/preview.webp", w: 720, h: 1280 } }));
  const invalidMediaId = presetContract.pickerPresetId(makeCard({ image: { src: "https://evil.example/preview.webp", w: 720, h: 1280 } }));
  assert.equal(await resolveWorkspacePreset("site_aidreamcapes", { sourcePage: "/templates", presetId: invalidMediaId }), undefined, "foreign preview URL is rejected");
  livePageRow = makePage(makeCard({ prompt: "x".repeat(4001) }));
  const longPromptCard = makeCard({ prompt: "x".repeat(4001) });
  assert.equal(await resolveWorkspacePreset("site_aidreamcapes", { sourcePage: "/templates", presetId: presetContract.pickerPresetId(longPromptCard) }), undefined, "oversized prompt is rejected");
  livePageRow = makePage(makeCard({ label: "Clean product image", prompt: "Product on a clean neutral background.", href: "/app/create?tool=white-background&size=16:9&length=30", kind: "photo", tool: "white-background", image: { src: "/assets/sites/site_aidreamcapes/products/item.png", w: 1600, h: 900 } }));
  const photoCard = makeCard({ label: "Clean product image", prompt: "Product on a clean neutral background.", href: "/app/create?tool=white-background&size=16:9&length=30", kind: "photo", tool: "white-background", image: { src: "/assets/sites/site_aidreamcapes/products/item.png", w: 1600, h: 900 } });
  const photoPreset = await resolveWorkspacePreset("site_aidreamcapes", { sourcePage: "/templates", presetId: presetContract.pickerPresetId(photoCard) });
  assert.equal(photoPreset.kind, "photo");
  assert.equal(photoPreset.sceneId, "process_demo", "unspecified scene uses conservative default");
  assert.equal(photoPreset.aspect, "16:9");
  assert.equal(photoPreset.duration, 30);
  assert.equal(photoPreset.imageTool, "white-background");

  const staticVideoCard = makeCard({ publicSlug: "creator-product-demo", sceneSlug: "creator-product-demo" });
  livePageRow = makePage(staticVideoCard);
  const publicVideoPreset = await resolveWorkspacePublicScenePreset("site_aidreamcapes", "video", "creator-product-demo");
  assert.equal(publicVideoPreset?.title, staticVideoCard.label, "Readable video routes resolve against the current LivePage card");
  assert.equal(publicVideoPreset?.publicSlug, "creator-product-demo");
  assert.equal(presetContract.pickerPresetHref(staticVideoCard, "/templates"), "/ai-video-generation/creator-product-demo", "Picker links use the prefixed readable video path");
  assert.deepEqual(publicRouteCalls.at(-1)?.values, ["site_aidreamcapes", "creator-product-demo", "video"], "Static route lookup is explicitly scoped to Aidreamcapes and media kind");
  const staticPhotoCard = makeCard({ label: "Clean product image", prompt: "Product on a clean neutral background.", href: "/app/create?tool=white-background", kind: "photo", publicSlug: "clean-product-image", image: { src: "/assets/sites/site_aidreamcapes/products/item.png", w: 1600, h: 900 } });
  livePageRow = makePage(staticPhotoCard);
  assert.equal((await resolveWorkspacePublicScenePreset("site_aidreamcapes", "photo", "clean-product-image"))?.kind, "photo", "Readable image routes resolve with the correct media kind");
  assert.equal(presetContract.pickerPresetHref(staticPhotoCard, "/templates"), "/ai-image-generation/clean-product-image", "Picker links use the prefixed readable image path");

  for (const [kind, tool] of [["video", "spokesperson-videos"], ["photo", "white-background"]]) {
    const migratedCard = makeCard({ kind, tool: undefined, publicSlug: "migrated-scene", href: `/app/create/tool/${tool}#step-video` });
    livePageRow = makePage(migratedCard);
    const migrated = await resolveWorkspacePublicScenePreset("site_aidreamcapes", kind, "migrated-scene");
    assert.equal(migrated?.title, migratedCard.label, "Current cards with fixed tool URLs still resolve to their scene");
    if (kind === "photo") assert.equal(migrated.imageTool, tool);
  }
  for (const href of ["/app/create/tool/INVALID", "/app/create/library/all", "https://evil.example/app/create/tool/video-ads", "https://user@www.aivideosugc.com/app/create/tool/video-ads"]) {
    livePageRow = makePage(makeCard({ publicSlug: "invalid-target", href }));
    assert.equal(await resolveWorkspacePublicScenePreset("site_aidreamcapes", "video", "invalid-target"), undefined, "Invalid or unrelated creation targets are rejected");
  }

  // Exercise task POST with fully mocked auth, LivePage and store. Auth must happen before lookup.
  const taskInput = { images: { productImages: ["/api/sites/site_aidreamcapes/customers/c_test/assets/a1"] }, fields: { steps: "Show the product" }, creativeDirection: "User revised visual direction.", options: { duration: 10, aspect: "9:16", style: "professional", language: "en", subtitle: false } };
  const apiContractRequire = (id) => {
    if (id === "server-only") return {};
    if (id === "next/server") return { NextResponse: { json: (value) => value } };
    if (id === "@/lib/stores/asset-store") return {};
    if (id === "./store") return {};
    if (id === "./pipeline") return {};
    if (id === "./provider") return {};
    if (id === "./asset-contracts") return {};
    if (id === "./catalogs") return {};
    if (id === "./types") return { WorkspaceError, AIVIDEOSUGC_SITE_ID: "site_aidreamcapes" };
    return require(id);
  };
  const apiContract = compileModule("api", apiContractRequire);
  const parsedCreativeInput = apiContract.parseInput(taskInput);
  assert.equal(parsedCreativeInput.creativeDirection, taskInput.creativeDirection, "API parsing preserves the editable creative field");
  assert.throws(() => apiContract.parseInput({ ...taskInput, creativeDirection: "x".repeat(4001) }), /invalid_creative_direction/);
  const pipelineRequire = (id) => {
    if (id === "./catalogs") return {
      CAMERA_FRAGMENTS: {}, FRAMING_FRAGMENTS: {}, STYLE_FRAGMENTS: { professional: { lighting: "soft light", colorGrade: "neutral colors" } },
      WORKSPACE_ASPECTS: ["9:16", "1:1", "16:9"], WORKSPACE_DURATIONS: [6, 10, 15, 30], WORKSPACE_LANGUAGES: [{ value: "en", label: "English" }],
      sceneSchema: () => ({ id: "process_demo", needsActor: false, styleOptions: [{ value: "professional" }], sections: [{ fields: [
        { id: "productImages", type: "images", required: true, max: 4, min: 1 }, { id: "steps", type: "textarea", required: true },
      ] }] }),
    };
    if (id === "./types") return { WorkspaceError };
    if (id === "./capabilities") return { assertWorkspaceCapabilitySupport() {} };
    return require(id);
  };
  const pipeline = compileModule("pipeline", pipelineRequire);
  assert.equal(pipeline.validateTaskInput("process_demo", parsedCreativeInput, [], false).creativeDirection, taskInput.creativeDirection);
  assert.throws(() => pipeline.validateTaskInput("process_demo", { ...parsedCreativeInput, creativeDirection: "x".repeat(4001) }, [], false), /workspace_creative_direction_invalid/);
  const videoCard = makeCard();
  const videoPresetId = presetContract.pickerPresetId(videoCard);
  livePageRow = makePage(videoCard);
  const currentRevision = livePageRow.updatedAt.toISOString();
  let authAllowed = false;
  let routeReadCount = 0;
  let ownedInput;
  let createdArgs;
  let customer = { id: "c_test" };
  const apiMocks = {
    auth: { async workspaceAuth(_request, siteId, required) {
      assert.equal(siteId, "site_aidreamcapes"); assert.equal(required, true);
      return authAllowed ? { ok: true, current: { customer } } : { ok: false, response: { status: 401, error: "login_required" } };
    } },
    api: {
      workspaceResponse: (payload, status = 200) => ({ status, payload }),
      workspaceFailure: (error) => ({ status: error.status ?? 500, error: error.code ?? error.message }),
      jsonBody: (request) => request.json(), parseInput: apiContract.parseInput,
      async assertOwnedImages(_siteId, _customerId, input) { ownedInput = structuredClone(input); },
      async catalogForCustomer() { return { actors: [], models: [] }; },
    },
    store: {
      async createTask(...args) { createdArgs = args; return { taskId: "task_mock", ...args[0] }; },
      async listTasks() { return []; }, publicTask: (task) => task,
    },
    catalogs: { sceneSchema: (id) => ({ id }), defaultTaskInput: () => structuredClone(taskInput) },
    pipeline: { validateTaskInput() {} },
    brief: { normalizeConfirmedProductBrief: (value) => value },
    presets: { async resolveWorkspacePreset(siteId, request) { routeReadCount++; return resolveWorkspacePreset(siteId, request); } },
    types: { WorkspaceError },
  };
  const routeRequire = (id) => {
    if (id === "@/lib/aidreamcapes-workspace/auth") return apiMocks.auth;
    if (id === "@/lib/aidreamcapes-workspace/api") return apiMocks.api;
    if (id === "@/lib/aidreamcapes-workspace/store") return apiMocks.store;
    if (id === "@/lib/aidreamcapes-workspace/catalogs") return apiMocks.catalogs;
    if (id === "@/lib/aidreamcapes-workspace/pipeline") return apiMocks.pipeline;
    if (id === "@/lib/aidreamcapes-workspace/product-brief-snapshot") return apiMocks.brief;
    if (id === "@/lib/aidreamcapes-workspace/presets.server") return apiMocks.presets;
    if (id === "@/lib/aidreamcapes-workspace/types") return apiMocks.types;
    return require(id);
  };
  const routeModule = { exports: {} };
  const routeFile = path.join(process.cwd(), "src/app/api/sites/[siteId]/aivideosugc/tasks/route.ts");
  const routeCode = ts.transpileModule(fs.readFileSync(routeFile, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", routeCode)(routeRequire, routeModule, routeModule.exports);
  const requestFor = (presetRevision = currentRevision) => ({
    async json() { return { sceneId: "process_demo", input: structuredClone(taskInput), title: "client cannot replace source title", preset: { sourcePage: "/templates", presetId: videoPresetId, sourceUpdatedAt: presetRevision } }; },
    headers: { get() { return "idempotency-test"; } },
  });
  const params = Promise.resolve({ siteId: "site_aidreamcapes" });
  const unauthenticated = await routeModule.exports.POST(requestFor(), { params });
  assert.equal(unauthenticated.status, 401);
  assert.equal(routeReadCount, 0, "unauthenticated task create must not read a preset");
  authAllowed = true;
  const staleResponse = await routeModule.exports.POST(requestFor("2026-10-14T00:00:00.000Z"), { params });
  assert.equal(staleResponse.status, 409, "changed LivePage revision requires explicit reload");
  assert.equal(staleResponse.error, "workspace_template_changed");
  assert.equal(createdArgs, undefined, "stale preset never creates a task");
  const created = await routeModule.exports.POST(requestFor(), { params });
  assert.equal(created.status, 201);
  assert.equal(createdArgs[2], "process_demo");
  assert.equal(createdArgs[5], "Creator product demo", "server owns the saved source title");
  assert.deepEqual(ownedInput, apiContract.parseInput(taskInput));
  assert(!JSON.stringify(ownedInput).includes(videoCard.image.src), "preview is never treated as an uploaded/owned image");
  assert.equal(createdArgs[8].previewUrl, videoCard.image.src);

  // Exercise real createTask JSON persistence and idempotency hash with a mock raw-query adapter.
  const storedRows = [];
  const storeDbMock = { async $queryRaw(strings, ...values) {
    const sql = strings.join("?");
    if (!sql.includes('INSERT INTO "AidreamcapesVideoTask"')) throw new Error(`Unexpected store query: ${sql}`);
    const data = JSON.parse(values[3]);
    storedRows.push(data);
    return [{ data, revision: 1, createdAt: new Date(data.createdAt), updatedAt: new Date(data.updatedAt) }];
  } };
  const storeRequire = (id) => {
    if (id === "server-only") return {};
    if (id === "node:crypto") return require(id);
    if (id === "@/lib/prisma") return { prisma: storeDbMock };
    if (id === "./types") return { AIVIDEOSUGC_SITE_ID: "site_aidreamcapes", WorkspaceError };
    if (id === "./pipeline") return { createActorVoiceSnapshot: () => undefined };
    if (id === "./preset-contract") return {};
    return require(id);
  };
  const store = compileModule("store", storeRequire);
  const persisted = await store.createTask("site_aidreamcapes", "c_test", "process_demo", taskInput, [], "Creator product demo", "key-1", undefined, createdArgs[8]);
  assert.equal(storedRows.length, 1);
  assert.deepEqual(storedRows[0].sourceTemplate, createdArgs[8]);
  assert.deepEqual(persisted.sourceTemplate, createdArgs[8]);
  assert.equal(persisted.creationHash, storedRows[0].creationHash);
  assert(persisted.creationHash.length === 64);

  // Exercise real storyboard request formatting with a mocked fetch transport only.
  const providerCalls = [];
  const priorFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://invalid.test/v1/chat/completions", "provider traffic stays on the local mock transport");
    const body = JSON.parse(options.body); providerCalls.push(body);
    const styleOnly = body.messages[0].content.startsWith("Choose camera");
    const output = styleOnly ? { shots: [{ camera: "static", framing: "medium" }] } : { environment: "A bright room", shots: [{ visual: "A creator demonstrates the item.", voiceover: "", factSources: ["steps"] }] };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }), { status: 200 });
  };
  try {
    const providerRequire = (id) => {
      if (id === "server-only") return {};
      if (id.startsWith("node:")) return require(id);
      if (id === "./catalogs") return { SCENES: [], WORKSPACE_ASPECTS: [], WORKSPACE_DURATIONS: [], WORKSPACE_LANGUAGES: [{ value: "en", label: "English" }], assertWorkspaceSite() {}, sceneSchema: () => ({ id: "process_demo", needsActor: false, structureField: "steps", sections: [] }) };
      if (id === "./pipeline") return { validateTaskInput: (_scene, input) => input, referencePool: () => ({}), compileStoryboard: ({ storyboard }) => storyboard };
      if (id === "./types") return { WorkspaceError, AIVIDEOSUGC_SITE_ID: "site_aidreamcapes" };
      if (id === "./capabilities") return {};
      if (id === "./stability") return { isWorkspaceStabilityMockMode: () => false, mockStructuredDecision() { throw new Error("Unexpected mock decision path"); } };
      if (id === "@/lib/stores/platform-store") return { listPlatformAiProvidersRelational: async () => [{ id: "local-test", enabled: true, apiKey: "test-only", aiUrl: "https://invalid.test", modelType: "mock-model" }] };
      if (id === "./provider-catalog-read") return { listWorkspaceProviderRows: async () => [{ id: "local-test", enabled: true, apiKey: "test-only", aiUrl: "https://invalid.test", modelType: "mock-model" }] };
      if (id === "./dispatch") return {};
      if (id === "./asset-contracts") return {};
      if (id === "./actors.json") return { actors: [] };
      return () => {};
    };
    const provider = compileModule("provider", providerRequire);
    await provider.generateStoryboard({ siteId: "site_aidreamcapes", sceneId: "process_demo", input: createdArgs[3], actors: [], sourceTemplate: createdArgs[8] });
    const storyboardCall = providerCalls.find((call) => !call.messages[0].content.startsWith("Choose camera"));
    const storyboardData = JSON.parse(storyboardCall.messages[1].content);
    assert.equal(storyboardData.visualDirection, taskInput.creativeDirection, "user edits take priority over canonical preset direction");
    assert(storyboardCall.messages[0].content.includes("not product evidence"));
    await provider.generateStoryboard({ siteId: "site_aidreamcapes", sceneId: "process_demo", input: { ...createdArgs[3], creativeDirection: undefined }, actors: [], sourceTemplate: createdArgs[8] });
    const canonicalCall = providerCalls.filter((call) => !call.messages[0].content.startsWith("Choose camera"))[1];
    assert.equal(JSON.parse(canonicalCall.messages[1].content).visualDirection, videoCard.prompt, "canonical source direction is used when no customer edit exists");
  } finally {
    globalThis.fetch = priorFetch;
  }
  console.log("PASS: scoped current LivePage preset resolution, validation/inference, auth-before-read, stale revision rejection, owned-image boundary, task metadata persistence, and visualDirection isolation.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
