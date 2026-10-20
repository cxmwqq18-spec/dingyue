import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

// SSR entry smoke with mocked auth, headers, catalog and LivePage preset resolver.
// No database/provider calls are possible in this fixture.
const root = process.cwd();
const source = path.join(root, "src/lib/aidreamcapes-workspace");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-template-entry-"));
const require = createRequire(path.join(root, "package.json"));
const presetId = `p_${"a".repeat(24)}`;
const currentTime = "2026-10-15T01:02:03.000Z";
const videoPreset = { sourcePage: "/templates", presetId, title: "Creator scene", kind: "video", prompt: "A creator demonstrates a product.", previewUrl: "/media/site_aidreamcapes/picker/creator.webp", sceneId: "presenter_showcase", aspect: "9:16", duration: 15, imageTool: "custom", sourceUpdatedAt: currentTime };
const photoPreset = { ...videoPreset, title: "Clean white product", kind: "photo", prompt: "A product on a white background.", imageTool: "white-background" };
const templateGallery = { categories: [{ id: "accessories", label: "Accessories" }], options: [{ ...videoPreset, imageAlt: "A creator presents a product.", categoryIds: ["accessories"] }] };
const NotFound = class extends Error { constructor() { super("NEXT_NOT_FOUND"); this.code = "NEXT_NOT_FOUND"; } };
class Redirect extends Error { constructor(location) { super("NEXT_REDIRECT"); this.location = location; } }

try {
  const contractModules = new Map();
  const contractRequire = (id) => {
    if (!id.startsWith("./")) return require(id);
    const name = id.slice(2);
    if (contractModules.has(name)) return contractModules.get(name).exports;
    const module = { exports: {} };
    contractModules.set(name, module);
    new Function("require", "module", "exports", ts.transpileModule(fs.readFileSync(path.join(source, `${name}.ts`), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText)(contractRequire, module, module.exports);
    return module.exports;
  };
  const presetContract = contractRequire("./preset-contract");
  const validQuery = { source: "/templates", preset: presetId };
  const fixtures = { video: videoPreset, photo: photoPreset, missing: undefined };
  let selectedPreset = "video";
  let resolveCalls = [];
  let host = "www.aivideosugc.com";
  let customer;
  let currentCustomerCalls = 0;
  let templateGalleryCalls = 0;
  const workspaceMarker = function AidreamcapesWorkspace() {};
  const scopedRequire = (id) => {
    if (id === "server-only") return {};
    if (id === "next/navigation") return {
      notFound: () => { throw new NotFound(); },
      redirect: (location) => { throw new Redirect(location); },
    };
    if (id === "next/headers") return {
      cookies: async () => ({ get: () => ({ value: "csrf-test" }) }),
      headers: async () => ({ get: (name) => name === "x-forwarded-host" ? host : null }),
    };
    if (id === "@/lib/api-auth") return { getCurrentCustomerForSite: async (siteId) => { currentCustomerCalls++; assert.equal(siteId, "site_aidreamcapes"); return customer; } };
    if (id === "@/lib/security/csrf") return { csrfCookieName: (value) => value };
    if (id === "@/components/aidreamcapes-workspace/workspace") return { AidreamcapesWorkspace: workspaceMarker };
    if (id === "./provider") return { getWorkspaceCatalog: async (siteId) => ({ siteId, mode: "guest-catalog" }) };
    if (id === "./api") return { catalogForCustomer: async (siteId, customerId) => ({ siteId, customerId, mode: "customer-catalog" }) };
    if (id === "./types") return { AIVIDEOSUGC_SITE_ID: "site_aidreamcapes" };
    if (id === "./navigation") return { isWorkspaceView: (value) => ["home", "agent", "images", "inspirations", "library", "settings"].includes(value) };
    if (id === "./handoff") return { workspaceHandoffFromSearchParams: () => undefined, workspaceHandoffHref: () => "" };
    if (id === "./entry-transfer") return {
      entryCookieName: (view) => `adc_workspace_entry_${view}`,
      readWorkspaceEntry: () => undefined,
    };
    if (id === "./inspirations-page.server") return {
      getWorkspaceInspirationPage: async () => ({ cards: [], counts: { all: 0, video: 0, photo: 0 }, categories: [], total: 0, nextOffset: null }),
    };
    if (id === "@/lib/aidreamcapes-inspirations") return { getAidreamcapesInspirationCards: async () => [] };
    if (id === "@/lib/aidreamcapes-inspirations-types") {
      const module = { exports: {} };
      const code = ts.transpileModule(fs.readFileSync(path.join(root, "src/lib/aidreamcapes-inspirations-types.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
      new Function("require", "module", "exports", code)((childId) => childId === "@/lib/aidreamcapes-workspace/preset-contract" ? presetContract : require(childId), module, module.exports);
      return module.exports;
    }
    if (id === "@/lib/aidreamcapes-create-intent") return { aidreamcapesCreateIntentFromSearchParams: () => undefined };
    if (id === "./preset-contract") return presetContract;
    if (id === "./presets.server") return {
      resolveWorkspacePreset: async (siteId, request) => { resolveCalls.push({ siteId, request }); return fixtures[selectedPreset]; },
      getWorkspaceTemplateGallery: async (siteId) => { templateGalleryCalls++; assert.equal(siteId, "site_aidreamcapes"); return templateGallery; },
    };
    return require(id);
  };
  const pageModule = { exports: {} };
  const pageCode = ts.transpileModule(fs.readFileSync(path.join(source, "page.tsx"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", pageCode)(scopedRequire, pageModule, pageModule.exports);
  const { aidreamcapesWorkspaceEntry, renderAidreamcapesWorkspace } = pageModule.exports;

  const entry = aidreamcapesWorkspaceEntry({ ...validQuery, tool: "video-ads", scene: "presenter_showcase", nextHash: "step-video" });
  assert.deepEqual(entry.presetRequest, { sourcePage: "/templates", presetId });
  assert.equal(entry.sceneId, "presenter_showcase");
  assert.equal(entry.invalidPreset, false);
  assert.equal(aidreamcapesWorkspaceEntry({ source: "/templates", preset: "not-an-id" }).invalidPreset, true);
  assert.equal(aidreamcapesWorkspaceEntry({ source: "//evil.example", preset: presetId }).invalidPreset, true);
  assert.equal(aidreamcapesWorkspaceEntry({ tool_id: "image_generator", tool: "white-background" }).initialView, "images");
  assert.equal(aidreamcapesWorkspaceEntry({ view: "inspirations" }).initialView, "inspirations");

  // The inspiration tab is a workspace view: it renders inside the shell for
  // both the public host and path-mode entries instead of redirecting away.
  for (const [requestHost, routeSlug] of [
    ["www.aivideosugc.com", "aidreamcapes"],
    ["localhost:3002", "aidreamcapes"],
    ["localhost:3002", "aivideosugc"],
  ]) {
    host = requestHost;
    const gallery = await renderAidreamcapesWorkspace({ routeSlug, initialView: "inspirations" });
    assert.equal(gallery.type, workspaceMarker);
    assert.equal(gallery.props.initialView, "inspirations");
    assert.deepEqual(gallery.props.initialInspirations.cards, []);
    assert.equal(gallery.props.initialInspirations.total, 0);
  }

  resolveCalls = []; selectedPreset = "video"; customer = undefined; host = "www.aivideosugc.com"; templateGalleryCalls = 0;
  const videoElement = await renderAidreamcapesWorkspace({ routeSlug: "aivideosugc", ...entry, initialView: "agent" });
  assert.equal(videoElement.type, workspaceMarker);
  assert.equal(videoElement.props.initialView, "video", "video preset opens the video editor directly");
  assert.deepEqual(videoElement.props.initialPreset, videoPreset);
  assert.equal(videoElement.props.basePath, "", "canonical host uses host routes");
  assert.equal(videoElement.props.initialTemplateGallery, undefined, "AIVideosUGC alias does not load Aidreamcapes-only picker data");
  assert.equal(templateGalleryCalls, 0);
  assert.equal(resolveCalls.length, 1);
  assert.deepEqual(resolveCalls[0], { siteId: "site_aidreamcapes", request: { sourcePage: "/templates", presetId } });
  const videoNext = new URL(videoElement.props.loginPath, "https://www.aivideosugc.com").searchParams.get("next");
  assert.equal(videoNext, `/app/create?source=%2Ftemplates&preset=${presetId}`, "guest login retains source and preset");

  selectedPreset = "photo"; resolveCalls = [];
  const photoEntry = aidreamcapesWorkspaceEntry(validQuery);
  const photoElement = await renderAidreamcapesWorkspace({ routeSlug: "aidreamcapes", ...photoEntry, initialView: "agent" });
  assert.equal(photoElement.props.initialView, "images", "photo preset opens image view");
  assert.deepEqual(photoElement.props.initialPreset, photoPreset);
  assert.deepEqual(photoElement.props.initialTemplateGallery, templateGallery, "Aidreamcapes workspace receives its homepage template gallery");
  assert.equal(templateGalleryCalls, 1);
  assert.equal(new URL(photoElement.props.loginPath, "https://www.aivideosugc.com").searchParams.get("next"), `/app/create?source=%2Ftemplates&preset=${presetId}`);

  // Invalid query identity and valid-but-missing current preset fail explicitly before loading auth/catalog.
  const readsBeforeInvalid = currentCustomerCalls;
  await assert.rejects(renderAidreamcapesWorkspace({ routeSlug: "aidreamcapes", ...aidreamcapesWorkspaceEntry({ source: "/templates", preset: "bad" }) }), NotFound);
  assert.equal(currentCustomerCalls, readsBeforeInvalid);
  selectedPreset = "missing";
  await assert.rejects(renderAidreamcapesWorkspace({ routeSlug: "aidreamcapes", ...photoEntry }), NotFound);

  // Existing task wins over any incoming preset; do not perform a fresh LivePage read.
  selectedPreset = "video"; resolveCalls = [];
  const taskEntry = aidreamcapesWorkspaceEntry({ ...validQuery, task: "task_existing" });
  const taskElement = await renderAidreamcapesWorkspace({ routeSlug: "aidreamcapes", ...taskEntry, initialView: "agent" });
  assert.equal(resolveCalls.length, 0);
  assert.equal(taskElement.props.initialTaskId, "task_existing");
  assert.equal(taskElement.props.initialPreset, undefined);
  const taskNext = new URL(taskElement.props.loginPath, "https://www.aivideosugc.com").searchParams.get("next");
  assert.equal(taskNext, "/app/create?task=task_existing");

  // Path mode retains the site path in its base and guest return route.
  selectedPreset = "video"; resolveCalls = []; customer = undefined; host = "localhost:3000";
  const pathElement = await renderAidreamcapesWorkspace({ routeSlug: "aidreamcapes", ...entry, initialView: "agent" });
  assert.equal(pathElement.props.basePath, "/site/aidreamcapes");
  assert.equal(pathElement.props.accountPath, "/site/aidreamcapes/account");
  const pathNext = new URL(pathElement.props.loginPath, "http://localhost:3000").searchParams.get("next");
  assert.equal(pathNext, `/site/aidreamcapes/app/create?source=%2Ftemplates&preset=${presetId}`);
  assert.equal(resolveCalls.length, 1);

  console.log("PASS: SSR query parsing, current preset resolution, video/photo views, invalid/missing notFound, task precedence, guest return preservation, and host/path routing.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
