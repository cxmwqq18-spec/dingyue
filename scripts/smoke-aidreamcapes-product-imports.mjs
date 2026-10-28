import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import Module from "node:module";
import ts from "typescript";

const root = process.cwd();
const source = path.join(root, "src/lib/aidreamcapes-workspace");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-product-imports-"));
const originalLoad = Module._load;

const SITE = "site_aidreamcapes";
const CUSTOMER = "cust_test";
const ASSET_ID = "asset_1";

const imports = new Map(); // id -> row
const assets = new Set([ASSET_ID]);
const customers = new Set([CUSTOMER]);

const makeRow = (row) => ({ ...row, createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt) });

const prismaMock = {
  async $queryRaw(strings, ...values) {
    const query = strings.join("?");
    if (query.startsWith("SELECT \"id\" FROM \"AssetUpload\"")) {
      const [assetId, siteId, customerId] = values;
      if (siteId !== SITE || customerId !== CUSTOMER || !assets.has(assetId)) return [];
      return [{ id: assetId }];
    }
    if (query.startsWith("SELECT \"role\", \"storageKey\" FROM \"AssetUpload\"")) {
      const [assetId, siteId, customerId] = values;
      if (siteId !== SITE || customerId !== CUSTOMER || !assets.has(assetId)) return [];
      return [{ role: "input", storageKey: `${customerId}/${assetId}/product.jpg` }];
    }
    if (query.includes("INSERT INTO \"AidreamcapesProductImport\"")) {
      const [id, siteId, customerId, assetId, sourceUrl, fetchedPageUrl, title, briefText] = values;
      if (!customers.has(customerId) || siteId !== SITE) return [];
      const existing = [...imports.values()].find((row) => row.siteId === siteId && row.customerId === customerId && row.sourceUrl === sourceUrl);
      const now = new Date();
      if (existing) {
        existing.assetId = assetId;
        existing.fetchedPageUrl = fetchedPageUrl;
        existing.title = title;
        existing.brief = JSON.parse(briefText);
        existing.deletedAt = null;
        existing.updatedAt = now;
        return [makeRow({ ...existing })];
      }
      const row = { id, siteId, customerId, assetId, sourceUrl, fetchedPageUrl, title, brief: JSON.parse(briefText), deletedAt: null, createdAt: now, updatedAt: now };
      imports.set(id, row);
      return [makeRow(row)];
    }
    if (query.includes("FROM \"AidreamcapesProductImport\" import") && query.includes("LEFT JOIN \"AssetUpload\"")) {
      const siteId = values[1], customerId = values[2], limit = values[3];
      if (siteId !== SITE || customerId !== CUSTOMER) return [];
      return [...imports.values()]
        .filter((row) => row.siteId === siteId && row.customerId === customerId && row.deletedAt === null)
        .slice(0, limit)
        .map((row) => ({ ...makeRow(row), assetPreviewUrl: assets.has(row.assetId) ? `/api/local-assets/${row.customerId}/${row.assetId}/product.jpg` : null }));
    }
    throw new Error(`Unexpected mocked SQL: ${query.slice(0, 120)}`);
  },
  async $executeRaw(strings, ...values) {
    const query = strings.join("?");
    if (query.startsWith("UPDATE \"AidreamcapesProductImport\"")) {
      const [importId, siteId, customerId] = values;
      const row = imports.get(importId);
      if (!row || row.siteId !== siteId || row.customerId !== customerId || row.deletedAt !== null) return 0;
      row.deletedAt = new Date();
      row.updatedAt = new Date();
      return 1;
    }
    throw new Error(`Unexpected mocked SQL: ${query.slice(0, 120)}`);
  },
};

try {
  for (const name of ["types", "product-brief-snapshot", "product-imports"]) {
    const result = ts.transpileModule(fs.readFileSync(path.join(source, `${name}.ts`), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    fs.writeFileSync(path.join(temp, `${name}.js`), result.outputText);
  }

  Module._load = function (request, parent, isMain) {
    if (request === "server-only") return {};
    if (request === "@/lib/prisma") return { prisma: prismaMock };
    if (request === "@/lib/stores/asset-store") return { customerAssetPreviewUrl: (asset) => asset.role === "output" ? `/download/${asset.id}` : `/api/local-assets/${asset.storageKey}` };
    return originalLoad.call(this, request, parent, isMain);
  };

  const require = createRequire(path.join(temp, "entry.cjs"));
  const store = require("./product-imports.js");

  const brief = {
    sourceUrl: "https://store.example/products/item",
    fetchedPageUrl: "https://store.example/products/item",
    title: { value: "Sample product", sourceUrl: "https://store.example/products/item", sourceLabel: "Page title", confidence: "high", confirmed: false },
    description: null,
    candidateImages: [],
    possiblePrice: { value: { amount: "29.99", currency: "USD" }, sourceUrl: "https://store.example/products/item", sourceLabel: "Price", confidence: "medium", confirmed: false },
    selectionConfirmed: true,
    priceConfirmed: false,
    reviewRequired: true,
    customerConfirmedAt: new Date().toISOString(),
  };

  const recorded = await store.upsertProductImport({ siteId: SITE, customerId: CUSTOMER, assetId: ASSET_ID, sourceUrl: brief.sourceUrl, fetchedPageUrl: brief.fetchedPageUrl, title: "Sample product", brief });
  assert.ok(recorded.id && recorded.previewUrl.includes("/api/local-assets/"), "upsert should return a public row with a preview URL");
  assert.equal(recorded.title, "Sample product");

  // Same source URL refreshes the same row instead of duplicating.
  const refreshed = await store.upsertProductImport({ siteId: SITE, customerId: CUSTOMER, assetId: ASSET_ID, sourceUrl: brief.sourceUrl, fetchedPageUrl: brief.fetchedPageUrl, title: "Sample product v2", brief });
  assert.equal(refreshed.id, recorded.id, "re-importing the same link must reuse the history row");
  assert.equal(refreshed.title, "Sample product v2");
  assert.equal([...imports.values()].length, 1);

  // Unconfirmed briefs are rejected.
  await assert.rejects(
    () => store.upsertProductImport({ siteId: SITE, customerId: CUSTOMER, assetId: ASSET_ID, sourceUrl: "https://store.example/other", brief: { ...brief, selectionConfirmed: false } }),
    /product_brief_confirmation_required/,
    "unconfirmed briefs must be rejected",
  );

  // Assets from another customer cannot back a history row.
  await assert.rejects(
    () => store.upsertProductImport({ siteId: SITE, customerId: CUSTOMER, assetId: "asset_other", sourceUrl: "https://store.example/other", brief }),
    /asset_not_found/,
    "foreign assets must be rejected",
  );

  // Other sites are refused.
  await assert.rejects(
    () => store.upsertProductImport({ siteId: "site_other", customerId: CUSTOMER, assetId: ASSET_ID, sourceUrl: brief.sourceUrl, brief }),
    /workspace_site_not_found/,
    "non-aidreamcapes sites must be refused",
  );

  const listed = await store.listProductImports({ siteId: SITE, customerId: CUSTOMER });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, recorded.id);

  await store.deleteProductImport({ siteId: SITE, customerId: CUSTOMER, importId: recorded.id });
  assert.deepEqual(await store.listProductImports({ siteId: SITE, customerId: CUSTOMER }), [], "soft-deleted rows must not appear in the library");

  await assert.rejects(
    () => store.deleteProductImport({ siteId: SITE, customerId: CUSTOMER, importId: recorded.id }),
    /product_import_not_found/,
    "deleting an already-removed row must 404",
  );

  console.log("smoke-aidreamcapes-product-imports: ok");
} finally {
  Module._load = originalLoad;
  fs.rmSync(temp, { recursive: true, force: true });
}
