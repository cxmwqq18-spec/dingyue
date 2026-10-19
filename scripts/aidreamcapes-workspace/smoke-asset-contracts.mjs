import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { buildSiteV2 } from "../lib/aidreamcapes-site-v2-content.mjs";

const root = process.cwd();
const workspace = path.join(root, "src/lib/aidreamcapes-workspace");
const originalFetch = globalThis.fetch;
let externalRequestCount = 0;
globalThis.fetch = async (input) => {
  const value = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const url = new URL(value, "http://localhost");
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return new Response(null, { status: 204 });
  externalRequestCount++;
  throw new Error(`External request blocked by asset-contract smoke: ${url.origin}`);
};

const SITE = "site_aidreamcapes";
const FOREIGN_SITE = "site_other";
const CUSTOMER = "customer_fixture";
const FOREIGN_CUSTOMER = "customer_other";
const actorDirectory = JSON.parse(fs.readFileSync(path.join(workspace, "actors.json"), "utf8"));
const actorPage = buildSiteV2().pages.find((page) => page.slug === "/ai-actors");
assert(actorPage, "The generated public AI Actors page is available to the fixture");
const actorPageSection = Object.values(actorPage.contentJson.sections).find((section) => section.type === "aidreamcapes_v2_page");
const actorPageCards = actorPageSection?.settings?.data?.actors;
assert.equal(actorPageCards?.length, 53, "The generated AI Actors page has the full 53-person catalog");
const actorPortraits = new Map(actorPageCards.map((actor) => [actor.id, actor.image.src]));
let liveActorPageContentJson = actorPage.contentJson;
const imageAsset = {
  id: "asset_product", siteId: SITE, customerId: CUSTOMER,
  storageKey: `sites/${SITE}/customers/${CUSTOMER}/assets/product.jpg`, mimeType: "image/jpeg", role: "input", deletedAt: null,
};
const musicAsset = {
  id: "asset_music", siteId: SITE, customerId: CUSTOMER,
  storageKey: `sites/${SITE}/customers/${CUSTOMER}/assets/track.mp3`, mimeType: "audio/mpeg", role: "input", subjectRole: "aivideosugc_music", deletedAt: null,
};
const clipAsset = {
  id: "asset_clip", siteId: SITE, customerId: CUSTOMER,
  storageKey: `sites/${SITE}/customers/${CUSTOMER}/assets/clip.mp4`, mimeType: "video/mp4", role: "output", deletedAt: null,
};
const otherClipAsset = {
  id: "asset_other_clip", siteId: SITE, customerId: CUSTOMER,
  storageKey: `sites/${SITE}/customers/${CUSTOMER}/assets/other-clip.mp4`, mimeType: "video/mp4", role: "output", deletedAt: null,
};
const unsupportedClipAsset = {
  id: clipAsset.id, siteId: SITE, customerId: CUSTOMER,
  storageKey: `sites/${SITE}/customers/${CUSTOMER}/assets/clip.webm`, mimeType: "video/webm", role: "output", deletedAt: null,
};
const generatedImageAsset = {
  id: "asset_generated_image", siteId: SITE, customerId: CUSTOMER,
  storageKey: `sites/${SITE}/customers/${CUSTOMER}/assets/generated.webp`, mimeType: "image/webp", role: "output", deletedAt: null,
};
const foreignGeneratedImageAsset = {
  id: "asset_foreign_generated_image", siteId: SITE, customerId: FOREIGN_CUSTOMER,
  storageKey: `sites/${SITE}/customers/${FOREIGN_CUSTOMER}/assets/private.webp`, mimeType: "image/webp", role: "output", deletedAt: null,
};
const customVoiceAsset = {
  id: "asset_voice", siteId: SITE, customerId: CUSTOMER,
  storageKey: `sites/${SITE}/customers/${CUSTOMER}/assets/voice.mp3`, mimeType: "audio/mpeg", role: "input", deletedAt: null,
};
const foreignMusicAsset = {
  id: "asset_foreign_music", siteId: SITE, customerId: FOREIGN_CUSTOMER,
  storageKey: `sites/${SITE}/customers/${FOREIGN_CUSTOMER}/assets/private.mp3`, mimeType: "audio/mpeg", role: "input", subjectRole: "aivideosugc_music", deletedAt: null,
};
const foreignImageAsset = {
  id: "asset_foreign_image", siteId: SITE, customerId: FOREIGN_CUSTOMER,
  storageKey: `sites/${SITE}/customers/${FOREIGN_CUSTOMER}/assets/private.jpg`, mimeType: "image/jpeg", role: "input", deletedAt: null,
};
const foreignSiteImageAsset = {
  id: "asset_foreign_site_image", siteId: FOREIGN_SITE, customerId: CUSTOMER,
  storageKey: `sites/${FOREIGN_SITE}/customers/${CUSTOMER}/assets/private.jpg`, mimeType: "image/jpeg", role: "input", deletedAt: null,
};
const invalidImageAsset = {
  id: "asset_bad_image", siteId: SITE, customerId: CUSTOMER,
  storageKey: `sites/${SITE}/customers/${CUSTOMER}/assets/unsupported.svg`, mimeType: "image/svg+xml", role: "input", deletedAt: null,
};
const mismatchedImageAsset = {
  id: "asset_mismatched_image", siteId: SITE, customerId: CUSTOMER,
  storageKey: `sites/${SITE}/customers/${CUSTOMER}/assets/mismatch.png`, mimeType: "image/jpeg", role: "input", deletedAt: null,
};
const invalidMusicAsset = {
  id: "asset_bad_music", siteId: SITE, customerId: CUSTOMER,
  storageKey: `sites/${SITE}/customers/${CUSTOMER}/assets/unsupported.bin`, mimeType: "audio/mpeg", role: "input", subjectRole: "aivideosugc_music", deletedAt: null,
};

const state = {
  assets: [imageAsset, musicAsset, clipAsset, generatedImageAsset, foreignGeneratedImageAsset, customVoiceAsset, foreignImageAsset, foreignSiteImageAsset, foreignMusicAsset, invalidImageAsset, mismatchedImageAsset, invalidMusicAsset],
  returnForeignAsset: undefined,
  returnForeignListRows: false,
  assetListQueries: [],
  assetLookupQueries: [],
  prismaQueries: [],
  fileReads: [],
  totalFileReads: 0,
  fileMimeType: undefined,
  livePageQueries: [],
};

function assetPreview(asset) {
  if (asset.role === "output") {
    const url = `/api/sites/${asset.siteId}/customers/${asset.customerId}/assets/${asset.id}/download?preview=1`;
    return asset.mimeType.startsWith("video/") ? `${url}&poster=1` : url;
  }
  return `/api/local-assets/${asset.storageKey.replace(/^customer-assets\//, "")}`;
}

function matchesWhere(asset, where = {}) {
  return Object.entries(where).every(([key, value]) => asset[key] === value);
}

const assetStore = {
  async getCustomerAssetsRelational(params) {
    state.assetListQueries.push(structuredClone(params));
    const rows = (state.returnForeignListRows ? state.assets : state.assets.filter((asset) =>
      asset.siteId === params.siteId && asset.customerId === params.customerId && !asset.deletedAt))
      .filter((asset) => !params.roles?.length || params.roles.includes(asset.role));
    return { assets: rows };
  },
  toThemeRuntimeAssetRelational(asset) { return { id: asset.id, previewUrl: assetPreview(asset), mimeType: asset.mimeType, role: asset.role }; },
  async getCustomerAssetRelational(params) {
    state.assetLookupQueries.push(structuredClone(params));
    const asset = state.returnForeignAsset ?? state.assets.find((candidate) =>
      candidate.id === params.assetId && candidate.siteId === params.siteId && candidate.customerId === params.customerId && !candidate.deletedAt);
    if (!asset) throw Object.assign(new Error("asset_not_found_for_customer"), { code: "asset_not_found_for_customer" });
    return { asset };
  },
  async readCustomerAssetFileByStorageKey(params) {
    state.fileReads.push({ siteId: params.siteId, customerId: params.customerId, storageKey: params.asset.storageKey });
    state.totalFileReads++;
    return { asset: params.asset, bytes: Buffer.from("local-fixture-bytes"), mimeType: state.fileMimeType ?? params.asset.mimeType };
  },
};

const prisma = {
  livePage: {
    async findUnique(args) {
      state.livePageQueries.push(structuredClone(args));
      if (args.where?.siteId_slug?.siteId !== SITE || args.where?.siteId_slug?.slug !== "/ai-actors") return null;
      return { contentJson: liveActorPageContentJson };
    },
  },
  generationJob: { async findMany() { return []; } },
  assetUpload: {
    async findFirst(args) {
      state.prismaQueries.push(structuredClone(args));
      if (state.returnForeignAsset) return state.returnForeignAsset;
      return state.assets.find((asset) => matchesWhere(asset, args.where)) ?? null;
    },
  },
};

const requireNative = createRequire(path.join(root, "package.json"));
const moduleCache = new Map();
const options = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } };
const empty = {};
function loadWorkspaceModule(name) {
  if (moduleCache.has(name)) return moduleCache.get(name).exports;
  if (name === "actors.json") return JSON.parse(fs.readFileSync(path.join(workspace, "actors.json"), "utf8"));
  const filename = path.join(workspace, `${name}.ts`);
  return loadFile(filename, name);
}

function loadFile(filename, cacheKey = filename) {
  if (moduleCache.has(cacheKey)) return moduleCache.get(cacheKey).exports;
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, options).outputText;
  const fixtureModule = { exports: {} };
  moduleCache.set(cacheKey, fixtureModule);
  const scopedRequire = (id) => {
    if (id === "./provider-catalog-read") return { listWorkspaceProviderRows: async () => [], getWorkspaceProviderRow: async () => undefined };
    if (id === "server-only") return empty;
    if (id === "./pipeline") return { compileStoryboard() {}, compileShot() {}, referencePool() { return {}; }, resolveShotReferences() { return []; }, validateTaskInput() {} };
    if (id === "./dispatch") return { dispatchWorkspaceJob: async () => { throw new Error("Unexpected dispatch in contract smoke"); } };
    if (id === "./store") return { listActors: async () => [] };
    if (id === "./captions") return { confirmedCaptionEdits: () => undefined };
    if (id === "./stability") return { assertWorkspaceExternalOperation() {}, isWorkspaceStabilityMockMode: () => false, mockStructuredDecision: async () => ({}), mockSpeechCues: () => [] };
    if (id.startsWith("./")) return loadWorkspaceModule(id.slice(2).replace(/\.json$/, ".json").replace(/\.ts$/, ""));
    if (id === "@/lib/aidreamcapes-workspace/auth") return { workspaceAuth: async () => ({ ok: true, current: { customer: { id: CUSTOMER } } }) };
    if (id === "@/lib/aidreamcapes-workspace/dispatch") return { dispatchWorkspaceJob: async () => { throw new Error("Unexpected dispatch in contract smoke"); } };
    if (id === "@/lib/aidreamcapes-workspace/quote") return { verifyQuote: async () => 0 };
    if (id.startsWith("@/lib/aidreamcapes-workspace/")) return loadWorkspaceModule(id.slice("@/lib/aidreamcapes-workspace/".length).replace(/\.ts$/, ""));
    if (id === "@/lib/aidreamcapes-workspace/asset-contracts") return loadWorkspaceModule("asset-contracts");
    if (id === "@/lib/aidreamcapes-workspace/api") return loadWorkspaceModule("api");
    if (id === "@/lib/prisma") return { prisma };
    if (id === "@/lib/stores/asset-store") return assetStore;
    if (id === "@/lib/stores/platform-store") return { listPlatformAiProvidersRelational: async () => [], getPlatformAiProviderRelational: async () => undefined };
    if (id === "@/lib/customer-asset-storage") return { writeCustomerAssetFileShared: async () => { throw new Error("Unexpected asset write in contract smoke"); } };
    if (id === "@/lib/generation-submit") return { submitGenerationJob: async () => { throw new Error("Unexpected generation in contract smoke"); } };
    if (id === "@/lib/stores/job-store") return { settleGenerationJobRelational: async () => { throw new Error("Unexpected ledger call in contract smoke"); } };
    if (id === "@/lib/worker") return { resolveWorkerBaseUrls: () => ({}) };
    if (id === "@/lib/session") return { publicUrlForRequest: () => ({ origin: "http://localhost" }) };
    if (id === "@/lib/video-provider-availability") return { videoProviderAvailabilityReason: () => undefined };
    if (id === "@/lib/video-provider-family") return { videoProviderModelFamilyForProvider: () => "fixture" };
    if (id === "@/lib/video-frame-config") return { videoDurationCreditCost: () => 0, videoResolutionCreditCost: () => 0, normalizeVideoDurationSecondsForFrameCount: (duration) => duration };
    if (id === "@/lib/types") return empty;
    if (id === "next/server") return { NextResponse: { json: (value, init = {}) => new Response(JSON.stringify(value), { status: init.status ?? 200, headers: init.headers }) } };
    return requireNative(id);
  };
  new Function("require", "module", "exports", "__filename", "__dirname", output)(scopedRequire, fixtureModule, fixtureModule.exports, filename, path.dirname(filename));
  return fixtureModule.exports;
}

function resetReadState() {
  state.returnForeignAsset = undefined;
  state.returnForeignListRows = false;
  state.assetListQueries.length = 0;
  state.assetLookupQueries.length = 0;
  state.prismaQueries.length = 0;
  state.fileReads.length = 0;
  state.fileMimeType = undefined;
}

try {
  const contracts = loadWorkspaceModule("asset-contracts");
  const api = loadWorkspaceModule("api");
  const provider = loadWorkspaceModule("provider");
  const mediaRender = loadWorkspaceModule("media-render");
  const builtins = await provider.getWorkspaceActors(SITE);
  assert.deepEqual(state.livePageQueries.at(-1), {
    where: { siteId_slug: { siteId: SITE, slug: "/ai-actors" } }, select: { contentJson: true },
  }, "The workspace reads portraits from the current Aidreamcapes AI Actors LivePage only");
  assert.equal(builtins.length, 53);
  const builtin = builtins[0];
  const productUrl = assetPreview(imageAsset);
  const musicUrl = `/api/sites/${SITE}/customers/${CUSTOMER}/assets/${musicAsset.id}/download`;
  const baseInput = { actorId: undefined, images: { productImages: [productUrl] }, fields: {}, options: { duration: 6, aspect: "9:16", style: "clean", language: "en", subtitle: false } };

  for (const actor of builtins) {
    assert(contracts.isBuiltinActorCatalogReference(actor.imageUrl, "image", builtins), `${actor.actorId} portrait is an exact catalog asset`);
    assert.equal(actor.imageUrl, actorPortraits.get(actor.actorId), `${actor.actorId} workspace portrait matches its public AI Actors card`);
    assert(actor.imageUrl.startsWith("/assets/sites/site_aidreamcapes/") || actor.imageUrl.startsWith("/ai-image-generation/actors/"), `${actor.actorId} public portrait is an Aidreamcapes-owned asset`);
    const voiceDefinition = actorDirectory.actors.find((candidate) => candidate.actorId === actor.actorId)?.voice;
    assert.deepEqual(actor.voice, voiceDefinition, `${actor.actorId} audio/voice settings remain unchanged`);
    if (actor.voice.refAudio) {
      assert(contracts.isBuiltinActorCatalogReference(actor.voice.refAudio, "audio", builtins), `${actor.actorId} voice sample is an exact catalog asset`);
      assert(fs.existsSync(path.join(root, "public/assets/sites/site_aidreamcapes/workspace/actors/voices", `${actor.actorId}.mp3`)), `${actor.actorId} voice sample exists in the Aidreamcapes media catalog`);
    }
  }
  liveActorPageContentJson = structuredClone(actorPage.contentJson);
  const legacyPortraits = new Map();
  for (const section of Object.values(liveActorPageContentJson.sections)) {
    if (section.type !== "aidreamcapes_v2_page" || !Array.isArray(section.settings?.data?.actors)) continue;
    for (const actor of section.settings.data.actors) {
      actor.image.src = `/ai-image-generation/actors/${actor.id}.webp`;
      legacyPortraits.set(actor.id, actor.image.src);
    }
  }
  const legacyBuiltins = await provider.getWorkspaceActors(SITE);
  assert.equal(legacyBuiltins.length, 53, "The workspace accepts the current Aidreamcapes public actor-media route");
  for (const actor of legacyBuiltins) assert.equal(actor.imageUrl, legacyPortraits.get(actor.actorId), `${actor.actorId} uses the current public LivePage portrait`);
  liveActorPageContentJson = actorPage.contentJson;
  await assert.rejects(provider.getWorkspaceActors(FOREIGN_SITE), (error) => error.code === "workspace_site_not_allowed");
  assert.equal(contracts.isBuiltinActorCatalogReference(`${builtin.imageUrl}?x=1`, "image", builtins), false, "Catalog references reject URL decorations");
  assert.equal(contracts.isBuiltinActorCatalogReference("/media/site_aidreamcapes/workspace/actors/library/unknown.webp", "image", builtins), false, "Unlisted actor files are not catalog assets");

  await api.assertOwnedImages(SITE, CUSTOMER, baseInput, []);
  assert.deepEqual(state.assetListQueries.at(-1), { siteId: SITE, customerId: CUSTOMER }, "Customer images are loaded with the exact site and current customer filter");
  await assert.rejects(api.assertOwnedImages(SITE, CUSTOMER, { ...baseInput, images: { productImages: [assetPreview(foreignImageAsset)] } }, []), (error) => error.code === "asset_not_owned");
  await assert.rejects(api.assertOwnedImages(SITE, CUSTOMER, { ...baseInput, images: { productImages: [assetPreview(foreignSiteImageAsset)] } }, []), (error) => error.code === "asset_not_owned");
  await assert.rejects(api.assertOwnedImages(SITE, CUSTOMER, { ...baseInput, images: { productImages: ["/api/local-assets/sites/site_aidreamcapes/customers/customer_fixture/assets/../../customer_other/private.jpg"] } }, []), (error) => error.code === "asset_not_owned");
  state.returnForeignListRows = true;
  await assert.rejects(api.assertOwnedImages(SITE, CUSTOMER, { ...baseInput, images: { productImages: [assetPreview(foreignImageAsset)] } }, []), (error) => error.code === "asset_not_owned");
  state.returnForeignListRows = false;

  const invalidImageInput = (asset) => ({ ...baseInput, images: { productImages: [assetPreview(asset)] } });
  await assert.rejects(api.assertOwnedImages(SITE, CUSTOMER, invalidImageInput(invalidImageAsset), []), (error) => error.code === "asset_not_owned");
  await assert.rejects(api.assertOwnedImages(SITE, CUSTOMER, invalidImageInput(mismatchedImageAsset), []), (error) => error.code === "asset_not_owned");
  await api.assertOwnedImages(SITE, CUSTOMER, { ...baseInput, images: { productImages: [assetPreview(generatedImageAsset)] } }, []);

  const actorInput = { ...baseInput, actorId: builtin.actorId };
  await api.assertOwnedImages(SITE, CUSTOMER, actorInput, builtins, { shots: [{ refImgs: { actor: builtin.imageUrl, product: productUrl } }] });
  const alteredBuiltin = { ...builtin, imageUrl: `${builtin.imageUrl}/../../foreign.png` };
  await assert.rejects(api.assertOwnedImages(SITE, CUSTOMER, actorInput, [alteredBuiltin], { shots: [{ refImgs: { actor: alteredBuiltin.imageUrl, product: productUrl } }] }), (error) => error.code === "workspace_actor_reference_not_owned");

  const customActor = { ...builtin, actorId: "custom-fixture", imageUrl: productUrl, voice: { ...builtin.voice, refAudio: assetPreview(customVoiceAsset) } };
  await api.assertOwnedImages(SITE, CUSTOMER, { ...baseInput, actorId: customActor.actorId }, [customActor]);
  const foreignCustomActor = { ...customActor, voice: { ...customActor.voice, refAudio: assetPreview({ ...customVoiceAsset, customerId: FOREIGN_CUSTOMER, storageKey: `sites/${SITE}/customers/${FOREIGN_CUSTOMER}/assets/voice.mp3` }) } };
  await assert.rejects(api.assertOwnedImages(SITE, CUSTOMER, { ...baseInput, actorId: foreignCustomActor.actorId }, [foreignCustomActor]), (error) => error.code === "workspace_actor_reference_not_owned");

  await api.assertOwnedImages(SITE, CUSTOMER, { ...baseInput, musicUrl }, []);
  await assert.rejects(api.assertOwnedImages(SITE, CUSTOMER, { ...baseInput, musicUrl: `/api/sites/${SITE}/customers/${FOREIGN_CUSTOMER}/assets/${foreignMusicAsset.id}/download` }, []), (error) => error.code === "music_asset_not_owned");
  await assert.rejects(api.assertOwnedImages(SITE, CUSTOMER, { ...baseInput, musicUrl: `/api/sites/${SITE}/customers/${CUSTOMER}/assets/${invalidMusicAsset.id}/download` }, []), (error) => error.code === "music_asset_not_owned");
  assert.equal(contracts.customerAssetIdFromDownloadUrl(`/api/sites/${SITE}/customers/${CUSTOMER}/assets/${musicAsset.id}/download?unknown=1`, { siteId: SITE, customerId: CUSTOMER }), undefined, "Unknown download query parameters fail closed");
  assert.equal(contracts.customerAssetIdFromDownloadUrl(`/api/sites/${SITE}/customers/${CUSTOMER}/assets/${musicAsset.id}/download?`, { siteId: SITE, customerId: CUSTOMER }), undefined, "Empty malformed query fails closed");
  assert.equal(contracts.customerAssetStorageKeyFromLocalUrl(`/api/local-assets/sites/${SITE}/customers/${CUSTOMER}/assets/%2e%2e/foreign.jpg`, { siteId: SITE, customerId: CUSTOMER }), undefined, "Encoded traversal fails closed");

  resetReadState();
  assert.equal(await provider.assetIdForReference({ siteId: SITE, customerId: CUSTOMER, url: productUrl }), imageAsset.id);
  assert.equal(await provider.assetIdForReference({ siteId: SITE, customerId: CUSTOMER, url: assetPreview(generatedImageAsset) }), generatedImageAsset.id, "Generated image previews resolve through owner-scoped asset records");
  assert.deepEqual(state.prismaQueries[0].where, { siteId: SITE, customerId: CUSTOMER, storageKey: imageAsset.storageKey, deletedAt: null, role: "input" }, "Local image lookup is scoped to site, current customer and input role");
  await assert.rejects(provider.assetIdForReference({ siteId: SITE, customerId: CUSTOMER, url: `/api/local-assets/sites/${SITE}/customers/${FOREIGN_CUSTOMER}/assets/private.jpg` }), (error) => error.code === "workspace_reference_not_owned");
  await assert.rejects(provider.assetIdForReference({ siteId: SITE, customerId: CUSTOMER, url: `/api/local-assets/sites/${SITE}/customers/${CUSTOMER}/assets/../../other.jpg` }), (error) => error.code === "workspace_reference_not_owned");
  await assert.rejects(provider.assetIdForReference({ siteId: SITE, customerId: CUSTOMER, url: assetPreview(invalidImageAsset) }), (error) => error.code === "workspace_reference_not_owned");
  state.returnForeignAsset = foreignImageAsset;
  await assert.rejects(provider.assetIdForReference({ siteId: SITE, customerId: CUSTOMER, url: productUrl }), (error) => error.code === "workspace_reference_not_owned");
  state.returnForeignAsset = generatedImageAsset;
  await assert.rejects(provider.assetIdForReference({ siteId: SITE, customerId: CUSTOMER, url: productUrl }), (error) => error.code === "workspace_reference_not_owned");
  state.returnForeignAsset = imageAsset;
  await assert.rejects(provider.assetIdForReference({ siteId: SITE, customerId: CUSTOMER, url: assetPreview(generatedImageAsset) }), (error) => error.code === "workspace_reference_not_owned");
  assert(state.prismaQueries.every((query) => query.where.siteId === SITE && query.where.customerId === CUSTOMER), "Provider asset records are always looked up with exact tenant filters");
  state.returnForeignAsset = undefined;

  const task = { taskId: "task-fixture", siteId: SITE, customerId: CUSTOMER };
  assert.deepEqual(await mediaRender.readClip(task, `/api/sites/${SITE}/customers/${CUSTOMER}/assets/${clipAsset.id}/download`), Buffer.from("local-fixture-bytes"));
  assert.deepEqual(state.assetLookupQueries.at(-1), { siteId: SITE, customerId: CUSTOMER, assetId: clipAsset.id }, "Generated clip reads use exact site and current customer scope");
  await assert.rejects(mediaRender.readClip(task, `/api/sites/${SITE}/customers/${FOREIGN_CUSTOMER}/assets/${clipAsset.id}/download`), (error) => error.code === "workspace_clip_not_owned");
  await assert.rejects(mediaRender.readClip(task, `/api/sites/${SITE}/customers/${CUSTOMER}/assets/../download`), (error) => error.code === "workspace_clip_not_owned");
  state.returnForeignAsset = foreignImageAsset;
  await assert.rejects(mediaRender.readClip(task, `/api/sites/${SITE}/customers/${CUSTOMER}/assets/${clipAsset.id}/download`), (error) => error.code === "workspace_clip_not_owned");
  state.returnForeignAsset = undefined;
  state.returnForeignAsset = otherClipAsset;
  await assert.rejects(mediaRender.readClip(task, `/api/sites/${SITE}/customers/${CUSTOMER}/assets/${clipAsset.id}/download`), (error) => error.code === "workspace_clip_not_owned");
  state.returnForeignAsset = unsupportedClipAsset;
  await assert.rejects(mediaRender.readClip(task, `/api/sites/${SITE}/customers/${CUSTOMER}/assets/${clipAsset.id}/download`), (error) => error.code === "workspace_clip_not_owned");
  state.returnForeignAsset = undefined;

  assert.deepEqual(await mediaRender.readMusic(task, musicUrl), Buffer.from("local-fixture-bytes"));
  await assert.rejects(mediaRender.readMusic(task, `/api/sites/${SITE}/customers/${FOREIGN_CUSTOMER}/assets/${foreignMusicAsset.id}/download`), (error) => error.code === "workspace_clip_not_owned");
  const mismatchedMusicMime = { ...musicAsset, mimeType: "audio/wav", storageKey: `sites/${SITE}/customers/${CUSTOMER}/assets/track.mp3` };
  state.returnForeignAsset = mismatchedMusicMime;
  await assert.rejects(mediaRender.readMusic(task, musicUrl), (error) => error.code === "workspace_music_not_owned");
  state.returnForeignAsset = { ...musicAsset, id: "asset_other_music" };
  await assert.rejects(mediaRender.readMusic(task, musicUrl), (error) => error.code === "workspace_music_not_owned");
  state.returnForeignAsset = undefined;
  state.fileMimeType = "audio/unknown";
  await assert.rejects(mediaRender.readMusic(task, musicUrl), (error) => error.code === "workspace_music_not_owned");

  state.returnForeignListRows = true;
  const imagesRoute = loadFile(path.join(root, "src/app/api/sites/[siteId]/aivideosugc/images/route.ts"), "images-route");
  const imagesResponse = await imagesRoute.GET(new Request("http://localhost/api"), { params: Promise.resolve({ siteId: SITE }) });
  const listedImages = await imagesResponse.json();
  assert.deepEqual(listedImages.assets.map((asset) => asset.id), [generatedImageAsset.id], "Image selection lists only supported current-customer generated images");

  const musicRoute = loadFile(path.join(root, "src/app/api/sites/[siteId]/aivideosugc/music/route.ts"), "music-route");
  const response = await musicRoute.GET(new Request("http://localhost/api"), { params: Promise.resolve({ siteId: SITE }) });
  const listed = await response.json();
  assert.deepEqual(listed.tracks.map((track) => track.id), [musicAsset.id], "Music selection lists only valid current-customer music uploads");
  assert(listed.tracks.every((track) => track.url.includes(`/customers/${CUSTOMER}/`)), "Music selection URLs are bound to the authenticated customer");
  assert.deepEqual(state.assetListQueries.at(-1), { siteId: SITE, customerId: CUSTOMER, roles: ["input"], take: 500 });

  assert.equal(externalRequestCount, 0, "No external requests were attempted");
  assert.equal(state.totalFileReads > 0, true, "Local fixture media reads exercised the consumption paths");
  console.log("PASS: customer media references resolve only within the current Aidreamcapes tenant; actor catalog, image/music MIME-extension, malformed path, generated clip and music selection contracts hold.");
  console.log(`COUNTS: ${JSON.stringify({ externalRequestCount, assetListQueries: state.assetListQueries.length, assetLookupQueries: state.assetLookupQueries.length, prismaQueries: state.prismaQueries.length, fileReads: state.totalFileReads })}`);
} finally {
  globalThis.fetch = originalFetch;
}
