import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import Module from "node:module";
import ts from "typescript";

const root = process.cwd();
const workspacePath = path.join(root, "src/components/aidreamcapes-workspace/workspace.tsx");
const routePath = path.join(root, "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/route.ts");
const briefPath = path.join(root, "src/lib/aidreamcapes-workspace/product-brief-snapshot.ts");
const typesPath = path.join(root, "src/lib/aidreamcapes-workspace/types.ts");
const providerPath = path.join(root, "src/lib/aidreamcapes-workspace/provider.ts");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-product-brief-patch-"));
const originalLoad = Module._load;
const records = new Map();
const originalTask = {
  taskId: "task-1", siteId: "site_aidreamcapes", customerId: "customer-1", sceneId: "process_demo",
  title: "Original product", status: "completed", createdAt: "2026-10-14T09:00:00.000Z", updatedAt: "2026-10-14T09:00:00.000Z",
  revision: 7, input: { images: { productImages: ["/api/assets/old-product"] }, fields: { steps: "Show the product" }, options: { duration: 15, aspect: "9:16", style: "natural", language: "en", subtitle: false } },
  productBrief: { sourceUrl: "https://shop.example/products/old", fetchedPageUrl: "https://shop.example/products/old", title: { value: "Old Product", sourceUrl: "https://shop.example/products/old", sourceLabel: "JSON-LD Product.name", confidence: "high", userConfirmed: true }, description: null, possiblePrice: null, userConfirmed: true, confirmedAt: "2026-10-14T08:00:00.000Z" },
  storyboard: { scenePlan: { strategy: "single", scenes: ["demo"], mainScene: "demo", reason: "test" }, lang: "en", source: "auto", shots: [], colorGrade: "natural", musicGenre: "none", version: "1" },
  storyboardStale: false, storyboardHistory: [{ version: "older-storyboard" }],
  video: { renderId: "render-current", storyboardHash: "old-hash", clips: [], status: "done", steps: [], finalUrl: "/renders/current.mp4", stale: false, createdAt: "2026-10-14T08:30:00.000Z" },
  videoHistory: [{ renderId: "render-prior", stale: true }], operation: undefined,
  revisions: Array.from({ length: 100 }, (_, index) => ({ at: `2026-10-14T09:${String(index).padStart(2, "0")}:00.000Z`, field: `field-${index}`, before: index, after: index + 1 })),
};
let authenticatedCustomer = "customer-1";
let writeAuthObserved = false;

function compile(source, file, options = {}) {
  return ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, ...options,
  } }).outputText;
}

try {
  fs.writeFileSync(path.join(temp, "types.js"), compile("", typesPath));
  fs.writeFileSync(path.join(temp, "product-brief-snapshot.js"), compile("", briefPath));
  fs.writeFileSync(path.join(temp, "route.js"), compile("", routePath));
  const require = createRequire(path.join(temp, "entry.cjs"));
  const { WorkspaceError } = require("./types.js");
  const { normalizeConfirmedProductBrief } = require("./product-brief-snapshot.js");
  const clone = (value) => structuredClone(value);
  const routeStore = {
    async getTask(siteId, customerId, taskId) {
      const task = records.get(taskId);
      if (!task || siteId !== "site_aidreamcapes" || task.siteId !== siteId || task.customerId !== customerId) throw new WorkspaceError("task_not_found", 404);
      return clone(task);
    },
    async saveTask(task, expectedRevision) {
      const current = records.get(task.taskId);
      if (!current || current.customerId !== task.customerId || current.revision !== expectedRevision) throw new WorkspaceError("revision_conflict", 409);
      const next = { ...clone(task), revision: expectedRevision + 1, updatedAt: "2026-10-14T10:00:00.000Z" };
      records.set(task.taskId, clone(next));
      return clone(next);
    },
    async deleteTask() { throw new Error("Unexpected DELETE in smoke"); },
    publicTask(task) { return clone(task); },
  };
  const api = {
    workspaceResponse(payload, status = 200) { return { status, payload: clone(payload) }; },
    workspaceFailure(error) {
      if (error instanceof WorkspaceError) return { status: error.status, payload: { error: error.code } };
      throw error;
    },
    async jsonBody(request) { return request.body; },
    expectedRevision(_request, body) { return Number(body.revision); },
    parseInput(value) { return value; },
    patchStoryboard() { throw new Error("Unexpected storyboard patch in smoke"); },
    async assertOwnedImages() {},
  };
  Module._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    if (request === "@/lib/aidreamcapes-workspace/auth") return { workspaceAuth: async (_request, siteId, write = false) => {
      if (siteId !== "site_aidreamcapes") return { ok: false, response: { status: 404, payload: { error: "workspace_site_not_found" } } };
      if (write) writeAuthObserved = true;
      return { ok: true, current: { customer: { id: authenticatedCustomer } } };
    } };
    if (request === "@/lib/aidreamcapes-workspace/api") return { ...api, catalogForCustomer: async () => ({ actors: [] }) };
    if (request === "@/lib/aidreamcapes-workspace/store") return routeStore;
    if (request === "@/lib/aidreamcapes-workspace/pipeline") return {
      assertActorVoiceSnapshot() {}, createActorVoiceSnapshot() { return undefined; }, validateTaskInput(_sceneId, input) { return input; },
    };
    if (request === "@/lib/aidreamcapes-workspace/runner") return { refreshTask: async (task) => task };
    if (request === "@/lib/aidreamcapes-workspace/types") return require("./types.js");
    if (request === "@/lib/aidreamcapes-workspace/product-brief-snapshot") return require("./product-brief-snapshot.js");
    return originalLoad.call(this, request, parent, isMain);
  };

  const { PATCH, GET } = require("./route.js");
  const candidate = {
    sourceUrl: "https://shop.example/products/new",
    fetchedPageUrl: "https://shop.example/products/new?ref=preview",
    title: { value: "New Product", sourceUrl: "https://shop.example/products/new", sourceLabel: "JSON-LD Product.name", confidence: "high", confirmed: false },
    description: { value: "A fresh product description.", sourceUrl: "https://shop.example/products/new", sourceLabel: "Open Graph description", confidence: "medium", confirmed: false },
    possiblePrice: { value: { amount: "18.50", currency: "USD" }, sourceUrl: "https://shop.example/products/new", sourceLabel: "JSON-LD Offer.price", confidence: "high", confirmed: false },
    selectionConfirmed: true, priceConfirmed: false, reviewRequired: true, customerConfirmedAt: "2026-10-14T09:45:00.000Z",
  };
  const updatedInput = clone(originalTask.input);
  updatedInput.images.productImages.push("/api/assets/new-product");
  records.set(originalTask.taskId, clone(originalTask));
  const request = (body) => ({ headers: new Headers(), body });
  const context = { params: Promise.resolve({ siteId: "site_aidreamcapes", taskId: "task-1" }) };

  const patchResponse = await PATCH(request({ revision: 7, title: "New Product", input: updatedInput, productBrief: candidate }), context);
  assert.equal(patchResponse.status, 200, "authorized current owner can patch the existing draft");
  assert.equal(writeAuthObserved, true, "PATCH requires write-authenticated workspace access");
  const updated = records.get("task-1");
  assert.equal(updated.revision, 8);
  assert.equal(updated.title, "New Product");
  assert.deepEqual(updated.input.images.productImages, ["/api/assets/old-product", "/api/assets/new-product"], "product image is retained with the existing image");
  assert.equal(updated.productBrief.title.value, "New Product", "the new provenance replaces the active brief");
  assert.equal(updated.productBrief.description.value, "A fresh product description.");
  assert.equal(updated.productBrief.possiblePrice.userConfirmed, false);
  assert.equal(updated.productBrief.possiblePrice.amount, "18.50");
  assert.equal(updated.productBrief.userConfirmed, true);
  assert.equal(updated.revisions.length, 100, "the audit list remains bounded");
  assert.equal(updated.revisions.at(-1).field, "productBrief");
  assert.deepEqual(updated.revisions.at(-1).before, originalTask.productBrief, "the bounded audit retains the previous active provenance");
  assert.deepEqual(updated.revisions.at(-1).after, updated.productBrief);
  assert.equal(updated.storyboardStale, true, "a current storyboard is marked stale for regeneration");
  assert.deepEqual(updated.storyboard, originalTask.storyboard, "the storyboard remains available while stale");
  assert.deepEqual(updated.storyboardHistory, originalTask.storyboardHistory, "storyboard history is preserved");
  assert.equal(updated.video.stale, true, "the current render is marked stale");
  assert.equal(updated.video.finalUrl, originalTask.video.finalUrl, "the old rendered video remains available");
  assert.deepEqual(updated.videoHistory, originalTask.videoHistory, "prior render versions are preserved");

  const readback = await GET(request({}), context);
  assert.equal(readback.status, 200);
  assert.deepEqual(readback.payload.task.productBrief, updated.productBrief, "task refresh/readback returns the saved normalized provenance");
  assert.equal(readback.payload.task.video.stale, true);

  const beforeConflict = clone(records.get("task-1"));
  const conflict = await PATCH(request({ revision: 7, productBrief: candidate }), context);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.payload.error, "revision_conflict");
  assert.deepEqual(records.get("task-1"), beforeConflict, "a stale revision cannot overwrite current provenance");

  authenticatedCustomer = "customer-2";
  const denied = await PATCH(request({ revision: 8, productBrief: candidate }), context);
  assert.equal(denied.status, 404, "another customer cannot read or patch this task");
  assert.equal(denied.payload.error, "task_not_found");
  assert.deepEqual(records.get("task-1"), beforeConflict, "cross-customer denial does not change the record");
  authenticatedCustomer = "customer-1";

  const normalized = normalizeConfirmedProductBrief(candidate);
  assert.equal(normalized.possiblePrice.userConfirmed, false, "normalization keeps possible price unconfirmed");
  const providerSource = fs.readFileSync(providerPath, "utf8");
  const facts = providerSource.match(/const facts = \[([\s\S]*?)\n\s*\];/)?.[1];
  assert.ok(facts, "storyboard facts block is present");
  assert.match(facts, /confirmed_product_title/);
  assert.match(facts, /confirmed_product_description/);
  assert.doesNotMatch(facts, /possiblePrice|confirmed_product_price/, "possible price is never supplied as a generation fact");

  const workspaceSource = fs.readFileSync(workspacePath, "utf8");
  const persistPatch = workspaceSource.match(/const patch = \{([\s\S]*?)\n\s*\};/)?.[1];
  assert.ok(persistPatch, "workspace queued PATCH object is present");
  assert.match(persistPatch, /pendingBrief[\s\S]*?productBrief: pendingBrief\.payload/, "queued PATCH carries the confirmed import payload for validation");
  assert.match(persistPatch, /current\.productBrief[\s\S]*?saved\?\.productBrief/, "the optimistic task snapshot is compared with the saved task");
  const importBranch = workspaceSource.match(/function importProduct\([\s\S]*?\n\s*}\n\n  function importedBriefNotice/)?.[0];
  assert.ok(importBranch, "workspace product import handler is present");
  assert.match(importBranch, /if \(task && scene\)/, "the existing-task branch handles imports");
  assert.match(importBranch, /title: title\.slice/);
  assert.match(importBranch, /pendingProductBrief\.current = \{ taskId: task\.taskId, payload: brief \}/);
  assert.match(importBranch, /productBrief: taskProductBriefSnapshot\(brief\)/);
  assert.match(importBranch, /asset\.previewUrl/, "the product photo continues to update task input");

  console.log("PASS: Aidreamcapes existing-draft product brief PATCH, normalized readback, ownership/revision guards, stale render preservation, price omission, and queued UI update.");
} finally {
  Module._load = originalLoad;
  fs.rmSync(temp, { recursive: true, force: true });
}
