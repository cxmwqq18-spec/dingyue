import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import Module from "node:module";
import ts from "typescript";

const root = process.cwd();
const source = path.join(root, "src/lib/aidreamcapes-workspace");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-batch-"));
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  if (request === "@/lib/prisma") return { prisma: {} };
  return originalLoad.call(this, request, parent, isMain);
};

try {
  for (const name of ["types", "catalogs", "capabilities", "pipeline", "batch"]) {
    const result = ts.transpileModule(fs.readFileSync(path.join(source, `${name}.ts`), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    });
    fs.writeFileSync(path.join(temp, `${name}.js`), result.outputText);
  }
  const require = createRequire(path.join(temp, "entry.cjs"));
  const { defaultTaskInput } = require("./catalogs.js");
  const { createBatchDrafts, getBatchGroup, resumeBatch, cancelBatch, mockBatchRunner, MAX_BATCH_CONCURRENCY } = require("./batch.js");
  const actors = JSON.parse(fs.readFileSync(path.join(source, "actors.json"), "utf8")).actors;
  const actor = actors[0];
  const makeItems = count => Array.from({ length: count }, (_, index) => {
    const input = defaultTaskInput("presenter_showcase");
    input.actorId = actor.actorId;
    input.fields.detail = `Batch item ${index}`;
    return { sceneId: "presenter_showcase", input, title: `Batch item ${index}` };
  });

  class MemoryBatchRepository {
    rows = new Map();
    failCreation = false;
    serial = Promise.resolve();
    async createAtomically(siteId, customerId, tasks) {
      assert.equal(siteId, "site_aidreamcapes");
      assert.ok(tasks.every(task => task.customerId === customerId));
      if (this.failCreation) throw new Error("simulated_transaction_abort");
      const staged = new Map(this.rows);
      for (const task of tasks) staged.set(task.taskId, structuredClone(task));
      this.rows = staged;
      return this.listOwned(siteId, customerId, tasks[0].batch.batchId);
    }
    async listOwned(siteId, customerId, batchId) {
      if (siteId !== "site_aidreamcapes") return [];
      return [...this.rows.values()].filter(task => task.siteId === siteId && task.customerId === customerId && task.batch.batchId === batchId)
        .sort((a, b) => b.batch.index - a.batch.index).map(task => structuredClone(task));
    }
    async updateOwned({ siteId, customerId, batchId, expectedRevision }, update) {
      let unlock;
      const previousLock = this.serial;
      this.serial = new Promise(resolve => { unlock = resolve; });
      await previousLock;
      try {
        const current = await this.listOwned(siteId, customerId, batchId);
        if (!current.length) throw Object.assign(new Error("workspace_batch_not_found"), { code: "workspace_batch_not_found", status: 404 });
        if (expectedRevision !== undefined && current[0].batch.batchRevision !== expectedRevision) {
          throw Object.assign(new Error("revision_conflict"), { code: "revision_conflict", status: 409 });
        }
        const updated = update(structuredClone(current));
        const stored = updated.map(task => {
          const previous = this.rows.get(task.taskId);
          const next = { ...structuredClone(task), revision: previous.revision + 1, updatedAt: new Date().toISOString() };
          this.rows.set(task.taskId, next);
          return structuredClone(next);
        });
        return stored.sort((a, b) => a.batch.index - b.batch.index);
      } finally {
        unlock();
      }
    }
    async claimNext(siteId, customerId, batchId) {
      let taskId;
      let runToken;
      await this.updateOwned({ siteId, customerId, batchId }, tasks => {
        if (tasks[0].batch.cancelRequested || tasks.filter(task => task.batch.status === "running").length >= MAX_BATCH_CONCURRENCY) return tasks;
        const task = tasks.find(item => item.batch.status === "queued");
        if (!task) return tasks;
        taskId = task.taskId;
        runToken = `run-${taskId}-${task.batch.attempts + 1}`;
        task.batch.status = "running";
        task.batch.attempts++;
        task.batch.runToken = runToken;
        task.batch.leaseUntil = new Date(Date.now() + 60_000).toISOString();
        return tasks;
      });
      if (!taskId) return undefined;
      return (await this.listOwned(siteId, customerId, batchId)).find(task => task.taskId === taskId && task.batch.runToken === runToken);
    }
    async finishItem({ siteId, customerId, batchId, taskId, runToken, error }) {
      await this.updateOwned({ siteId, customerId, batchId }, tasks => {
        const task = tasks.find(item => item.taskId === taskId);
        if (!task || task.batch.status !== "running" || task.batch.runToken !== runToken) return tasks;
        task.batch.status = tasks[0].batch.cancelRequested ? "cancelled" : error ? "failed" : "completed";
        task.batch.error = task.batch.status === "failed" ? error : undefined;
        delete task.batch.runToken;
        delete task.batch.leaseUntil;
        return tasks;
      });
    }
  }

  const customerId = "customer-a";
  const repository = new MemoryBatchRepository();
  const items = makeItems(8);
  const created = await createBatchDrafts({ siteId: "site_aidreamcapes", customerId, idempotencyKey: "create-atomic", items, actors, repository });
  assert.equal(created.tasks.length, 8, "all drafts are persisted together");
  assert.equal(repository.rows.size, 8, "atomic create leaves all rows present");
  assert.ok(created.tasks.every(task => task.batch.status === "draft" && task.batch.batchId === created.batch.batchId));
  assert.ok(created.tasks.every(task => task.voiceSnapshot?.voiceId === `mock:aidreamcapes:${actor.gender}:${actor.actorId}:v1`));

  const replay = await createBatchDrafts({ siteId: "site_aidreamcapes", customerId, idempotencyKey: "create-atomic", items, actors, repository });
  assert.equal(replay.batch.batchId, created.batch.batchId, "same key and content returns the same group");
  assert.deepEqual(replay.tasks.map(task => task.taskId), created.tasks.map(task => task.taskId));
  assert.equal(repository.rows.size, 8, "idempotent replay does not create duplicate task rows");
  await assert.rejects(() => createBatchDrafts({ siteId: "site_aidreamcapes", customerId, idempotencyKey: "create-atomic", items: makeItems(7), actors, repository }), error => error.code === "idempotency_conflict");

  const abortingRepository = new MemoryBatchRepository();
  abortingRepository.failCreation = true;
  await assert.rejects(() => createBatchDrafts({ siteId: "site_aidreamcapes", customerId, idempotencyKey: "atomic-abort", items: makeItems(4), actors, repository: abortingRepository }), /simulated_transaction_abort/);
  assert.equal(abortingRepository.rows.size, 0, "aborted creation leaves no partial rows");

  await assert.rejects(() => getBatchGroup({ siteId: "site_aidreamcapes", customerId: "customer-b", batchId: created.batch.batchId, repository }), error => error.code === "workspace_batch_not_found" && error.status === 404);
  await assert.rejects(() => cancelBatch({ siteId: "site_aidreamcapes", customerId: "customer-b", batchId: created.batch.batchId, expectedRevision: 1, repository }), error => error.code === "workspace_batch_not_found" && error.status === 404);
  await assert.rejects(() => resumeBatch({ siteId: "site_dreamshoot", customerId, batchId: created.batch.batchId, expectedRevision: 1, repository }), error => error.code === "workspace_site_not_found" && error.status === 404);
  await assert.rejects(() => resumeBatch({ siteId: "site_aidreamcapes", customerId: "customer-b", batchId: created.batch.batchId, expectedRevision: 1, repository }), error => error.code === "workspace_batch_not_found" && error.status === 404);
  await assert.rejects(() => resumeBatch({ siteId: "site_aidreamcapes", customerId, batchId: created.batch.batchId, expectedRevision: 2, repository }), error => error.code === "revision_conflict" && error.status === 409);
  await assert.rejects(() => resumeBatch({ siteId: "site_aidreamcapes", customerId, batchId: created.batch.batchId, expectedRevision: 2, repository, runner: mockBatchRunner }), error => error.code === "revision_conflict" && error.status === 409);

  let active = 0;
  let maximumActive = 0;
  const completed = await resumeBatch({ siteId: "site_aidreamcapes", customerId, batchId: created.batch.batchId, expectedRevision: 1, repository, runner: async () => {
    active++;
    maximumActive = Math.max(maximumActive, active);
    await new Promise(resolve => setTimeout(resolve, 4));
    active--;
  } });
  assert.equal(maximumActive, 3, "runner uses all three available slots without exceeding the cap");
  assert.equal(completed.batch.maxConcurrency, 3);
  assert.equal(completed.batch.status, "completed");
  assert.equal(completed.batch.counts.completed, 8);
  assert.ok(completed.tasks.every(task => task.batch.attempts === 1));

  const partialRepo = new MemoryBatchRepository();
  const partialDraft = await createBatchDrafts({ siteId: "site_aidreamcapes", customerId, idempotencyKey: "partial-resume", items: makeItems(4), actors, repository: partialRepo });
  const failedOnce = new Set();
  const partial = await resumeBatch({ siteId: "site_aidreamcapes", customerId, batchId: partialDraft.batch.batchId, expectedRevision: 1, repository: partialRepo, runner: async task => {
    if (task.batch.index === 2 && !failedOnce.has(task.taskId)) {
      failedOnce.add(task.taskId);
      throw new Error("mock_item_failure");
    }
  } });
  assert.equal(partial.batch.status, "partial");
  assert.equal(partial.batch.counts.completed, 3);
  assert.equal(partial.batch.counts.failed, 1);
  const retried = await resumeBatch({ siteId: "site_aidreamcapes", customerId, batchId: partial.batch.batchId, expectedRevision: partial.batch.revision, repository: partialRepo, runner: async () => {} });
  assert.equal(retried.batch.status, "completed");
  assert.equal(retried.batch.counts.completed, 4);
  assert.deepEqual(retried.tasks.map(task => task.batch.attempts), [1, 1, 2, 1], "resume retries only the failed item");

  const cancelRepo = new MemoryBatchRepository();
  const cancelDraft = await createBatchDrafts({ siteId: "site_aidreamcapes", customerId, idempotencyKey: "cancel-running", items: makeItems(5), actors, repository: cancelRepo });
  let started = 0;
  let resolveStarted;
  const startedSignal = new Promise(resolve => { resolveStarted = resolve; });
  let releaseRunner;
  const runGate = new Promise(resolve => { releaseRunner = resolve; });
  const inFlightRun = resumeBatch({ siteId: "site_aidreamcapes", customerId, batchId: cancelDraft.batch.batchId, expectedRevision: 1, repository: cancelRepo, runner: async () => {
    started++;
    if (started === MAX_BATCH_CONCURRENCY) resolveStarted();
    await runGate;
  } });
  await startedSignal;
  const cancelling = await cancelBatch({ siteId: "site_aidreamcapes", customerId, batchId: cancelDraft.batch.batchId, expectedRevision: 1, repository: cancelRepo });
  assert.equal(cancelling.batch.status, "cancelling");
  assert.equal(cancelling.batch.counts.running, 3);
  assert.equal(cancelling.batch.counts.cancelled, 2);
  releaseRunner();
  const cancelled = await inFlightRun;
  assert.equal(cancelled.batch.status, "cancelled");
  assert.equal(cancelled.batch.counts.cancelled, 5);

  const mockOnlyRepo = new MemoryBatchRepository();
  const mockOnlyDraft = await createBatchDrafts({ siteId: "site_aidreamcapes", customerId, idempotencyKey: "mock-only-run", items: makeItems(1), actors, repository: mockOnlyRepo });
  let externalCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { externalCalls++; throw new Error("external network call forbidden"); };
  await assert.rejects(
    resumeBatch({ siteId: "site_aidreamcapes", customerId, batchId: mockOnlyDraft.batch.batchId, expectedRevision: 1, repository: mockOnlyRepo }),
    error => error.code === "workspace_batch_execution_unavailable" && error.status === 503,
    "An ordinary resume cannot complete tasks without a real batch executor"
  );
  const stillDraft = await getBatchGroup({ siteId: "site_aidreamcapes", customerId, batchId: mockOnlyDraft.batch.batchId, repository: mockOnlyRepo });
  assert.equal(stillDraft.batch.status, "draft", "Unavailable execution leaves the batch unchanged");
  const mockOnlyResult = await resumeBatch({ siteId: "site_aidreamcapes", customerId, batchId: mockOnlyDraft.batch.batchId, expectedRevision: 1, repository: mockOnlyRepo, runner: mockBatchRunner });
  globalThis.fetch = originalFetch;
  assert.equal(externalCalls, 0, "mock runner performs no network or provider call");
  assert.equal(mockOnlyResult.batch.status, "completed", "Explicitly injected fixture runner can exercise completion semantics");

  const batchSource = fs.readFileSync(path.join(source, "batch.ts"), "utf8");
  assert.doesNotMatch(batchSource, /from ["'][^"']*(?:provider|dispatch|billing|ledger)[^"']*["']/i, "batch implementation has no provider, dispatch, or billing imports");
  assert.doesNotMatch(batchSource, /\b(?:GenerationJob|reserveCredits|createLedgerEntry|dispatchWorker)\b/, "batch implementation does not touch generation jobs, workers, or ledgers");
  assert.match(batchSource, /FROM "AidreamcapesVideoTask" WHERE "siteId" = \$\{AIVIDEOSUGC_SITE_ID\} AND "customerId" = \$\{customerId\}/);
  assert.match(batchSource, /WHERE "id" = \$\{row\.id\} AND "siteId" = \$\{AIVIDEOSUGC_SITE_ID\} AND "customerId" = \$\{args\.customerId\} AND "revision" = \$\{row\.revision\}/);
  assert.match(batchSource, /prisma\.\$transaction/);
  assert.match(batchSource, /jsonb_to_recordset/);
  const resumeRoute = fs.readFileSync(path.join(root, "src/app/api/sites/[siteId]/aivideosugc/tasks/batch/[batchId]/resume/route.ts"), "utf8");
  assert.match(resumeRoute, /resumeBatch\(/);
  assert.doesNotMatch(resumeRoute, /runner\s*:/, "Ordinary resume route does not inject the fixture runner");

  console.log("Aidreamcapes batch contract passed (atomic/idempotent creation, owner and revision guards, concurrency 3, failure resume, cancellation, mock-only execution).");
} finally {
  Module._load = originalLoad;
  fs.rmSync(temp, { recursive: true, force: true });
}
