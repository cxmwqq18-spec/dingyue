import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import Module from "node:module";
import ts from "typescript";

const root = process.cwd();
const source = path.join(root, "src/lib/aidreamcapes-workspace");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-product-brief-"));
const originalLoad = Module._load;
const records = new Map();
const fromTemplate = (strings, _values) => strings.join("?");
const makeRow = (data, revision) => ({ data: structuredClone(data), revision, createdAt: new Date(data.createdAt), updatedAt: new Date(data.updatedAt) });
const prismaMock = {
  async $queryRaw(strings, ...values) {
    const query = fromTemplate(strings, values);
    if (query.startsWith("INSERT INTO \"AidreamcapesVideoTask\"")) {
      const dataText = values.find(value => typeof value === "string" && value.startsWith("{\"taskId\""));
      const data = JSON.parse(dataText);
      if (records.has(data.taskId)) return [];
      const row = makeRow(data, 1);
      records.set(data.taskId, row);
      return [makeRow(data, 1)];
    }
    if (query.startsWith("UPDATE \"AidreamcapesVideoTask\"")) {
      const data = JSON.parse(values[0]);
      const current = records.get(data.taskId);
      if (!current || current.revision !== values[4]) return [];
      const row = makeRow(data, current.revision + 1);
      records.set(data.taskId, row);
      return [makeRow(data, row.revision)];
    }
    if (query.startsWith("SELECT \"data\", \"revision\", \"createdAt\", \"updatedAt\" FROM \"AidreamcapesVideoTask\"")) {
      const row = records.get(values[0]);
      return row && row.data.customerId === values[2] ? [makeRow(row.data, row.revision)] : [];
    }
    throw new Error(`Unexpected mocked SQL: ${query}`);
  },
};

try {
  for (const name of ["types", "product-brief-snapshot", "store"]) {
    const result = ts.transpileModule(fs.readFileSync(path.join(source, `${name}.ts`), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    fs.writeFileSync(path.join(temp, `${name}.js`), result.outputText);
  }

  Module._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    if (request === "@/lib/prisma") return { prisma: prismaMock };
    if (request === "./pipeline") return { createActorVoiceSnapshot: () => undefined };
    return originalLoad.call(this, request, parent, isMain);
  };

  const require = createRequire(path.join(temp, "entry.cjs"));
  const { normalizeConfirmedProductBrief } = require("./product-brief-snapshot.js");
  const store = require("./store.js");
  const base = {
    sourceUrl: "https://shop.example/products/item",
    fetchedPageUrl: "https://shop.example/products/item?source=preview",
    title: { value: "Sample Item", sourceUrl: "https://shop.example/products/item", sourceLabel: "JSON-LD Product.name", confidence: "high", confirmed: false },
    description: { value: "A useful sample description.", sourceUrl: "https://shop.example/products/item", sourceLabel: "Open Graph description", confidence: "medium", confirmed: false },
    candidateImages: [{ value: "https://shop.example/images/item.jpg", sourceUrl: "https://shop.example/images/item.jpg", sourcePageUrl: "https://shop.example/products/item", sourceLabel: "JSON-LD Product.image", confidence: "high", confirmed: false }],
    possiblePrice: { value: { amount: "49.95", currency: "USD" }, sourceUrl: "https://shop.example/products/item", sourceLabel: "JSON-LD Offer.price", confidence: "high", confirmed: false },
    selectionConfirmed: true,
    priceConfirmed: false,
    reviewRequired: true,
    customerConfirmedAt: "2026-10-14T09:40:12.000Z",
  };

  assert.throws(() => normalizeConfirmedProductBrief({ ...base, selectionConfirmed: false }), /product_brief_confirmation_required/);
  assert.throws(() => normalizeConfirmedProductBrief({ ...base, priceConfirmed: true }), /product_brief_confirmation_required/);
  assert.throws(() => normalizeConfirmedProductBrief({ ...base, title: { ...base.title, value: "x".repeat(181) } }), /product_brief_invalid/);
  assert.throws(() => normalizeConfirmedProductBrief({ ...base, possiblePrice: { ...base.possiblePrice, value: { amount: "9".repeat(33) } } }), /product_brief_invalid/);
  assert.throws(() => normalizeConfirmedProductBrief({ ...base, sourceUrl: "http://shop.example/products/item" }), /product_brief_invalid/);

  const snapshot = normalizeConfirmedProductBrief(base);
  assert.equal(snapshot.title.userConfirmed, true);
  assert.equal(snapshot.description.sourceLabel, "Open Graph description");
  assert.equal(snapshot.possiblePrice.userConfirmed, false);
  assert.equal(snapshot.possiblePrice.amount, "49.95");
  assert.equal(snapshot.confirmedAt, base.customerConfirmedAt);
  assert.equal("candidateImages" in snapshot, false, "candidate image metadata is not copied into the task snapshot");

  const originalDatabaseTarget = process.env.DATABASE_TARGET;
  const originalDingyueEnv = process.env.DINGYUE_ENV;
  delete process.env.DATABASE_TARGET;
  delete process.env.DINGYUE_ENV;
  try {
    const input = { images: { productImages: ["/api/assets/product-1"] }, fields: { steps: "Show the product" },
      options: { duration: 15, aspect: "9:16", style: "natural", language: "en", subtitle: false } };
    const created = await store.createTask("site_aidreamcapes", "customer-1", "process_demo", input, [], "Sample Item", "stable-key", snapshot);
    assert.deepEqual(created.productBrief, snapshot, "The task creation payload persists the normalized snapshot");
    assert.equal(created.revisions[0].field, "productBrief", "The creation history records the confirmed brief");
    const readBack = await store.getTask("site_aidreamcapes", "customer-1", created.taskId);
    assert.deepEqual(readBack.productBrief, snapshot, "Task readback retains the provenance snapshot");

    const edited = await store.saveTask({ ...readBack, title: "Edited title" }, readBack.revision);
    assert.deepEqual(edited.productBrief, snapshot, "Task updates retain the original snapshot");
    const retried = await store.createTask("site_aidreamcapes", "customer-1", "process_demo", input, [], "Sample Item", "stable-key", snapshot);
    assert.equal(retried.taskId, created.taskId, "Stable idempotency returns the existing task");
    assert.deepEqual(retried.productBrief, snapshot);
    await assert.rejects(store.createTask("site_aidreamcapes", "customer-1", "process_demo", input, [], "Sample Item", "stable-key", { ...snapshot, title: null }), /idempotency_conflict/);
  } finally {
    if (originalDatabaseTarget === undefined) delete process.env.DATABASE_TARGET;
    else process.env.DATABASE_TARGET = originalDatabaseTarget;
    if (originalDingyueEnv === undefined) delete process.env.DINGYUE_ENV;
    else process.env.DINGYUE_ENV = originalDingyueEnv;
  }

  console.log("PASS: confirmed brief validation, bounded provenance, JSON task persistence/readback/update/history, and idempotency.");
} finally {
  Module._load = originalLoad;
  fs.rmSync(temp, { recursive: true, force: true });
}
