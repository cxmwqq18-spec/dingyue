import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { customerAssetPreviewUrl } from "@/lib/stores/asset-store";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError } from "./types";
import { normalizeConfirmedProductBrief } from "./product-brief-snapshot";

/**
 * Aidreamcapes "Product Links": persisted history of confirmed product page
 * imports. One row per customer and source URL; importing the same link again
 * refreshes the existing row instead of accumulating duplicates.
 */

export type ProductImportRow = {
  id: string;
  siteId: string;
  customerId: string;
  assetId: string;
  sourceUrl: string;
  fetchedPageUrl: string | null;
  title: string | null;
  brief: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductImportPublic = {
  id: string;
  assetId: string;
  previewUrl: string;
  sourceUrl: string;
  fetchedPageUrl: string | null;
  title: string | null;
  brief: unknown;
  createdAt: string;
  updatedAt: string;
};

type ListRow = {
  id: string;
  assetId: string;
  sourceUrl: string;
  fetchedPageUrl: string | null;
  title: string | null;
  brief: unknown;
  createdAt: Date;
  updatedAt: Date;
  assetPreviewUrl: string | null;
};

function publicRow(row: ListRow): ProductImportPublic {
  return {
    id: row.id,
    assetId: row.assetId,
    previewUrl: row.assetPreviewUrl ?? "",
    sourceUrl: row.sourceUrl,
    fetchedPageUrl: row.fetchedPageUrl,
    title: row.title,
    brief: row.brief,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function assertProductImportSite(siteId: string) {
  if (siteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("workspace_site_not_found", 404);
}

export async function upsertProductImport(params: {
  siteId: string;
  customerId: string;
  assetId: string;
  sourceUrl: string;
  fetchedPageUrl?: string | null;
  title?: string | null;
  brief: unknown;
}): Promise<ProductImportPublic> {
  assertProductImportSite(params.siteId);
  const brief = normalizeConfirmedProductBrief(params.brief);
  const sourceUrl = params.sourceUrl.trim();
  if (!sourceUrl || sourceUrl.length > 2048) throw new WorkspaceError("product_url_invalid", 400);
  // The referenced asset must belong to the same owner; otherwise the history
  // entry would show a photo the customer cannot access.
  const owned = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "AssetUpload" WHERE "id" = ${params.assetId} AND "siteId" = ${params.siteId} AND "customerId" = ${params.customerId} LIMIT 1`;
  if (!owned[0]) throw new WorkspaceError("asset_not_found", 404);
  const rows = await prisma.$queryRaw<ListRow[]>`
    INSERT INTO "AidreamcapesProductImport" ("id", "siteId", "customerId", "assetId", "sourceUrl", "fetchedPageUrl", "title", "brief")
    SELECT ${randomUUID()}, ${params.siteId}, ${params.customerId}, ${params.assetId}, ${sourceUrl},
      ${params.fetchedPageUrl ?? null}, ${params.title ?? null}, ${JSON.stringify(brief)}::jsonb
    FROM "Customer"
    WHERE "id" = ${params.customerId} AND "siteId" = ${params.siteId}
    ON CONFLICT ("siteId", "customerId", "sourceUrl") DO UPDATE SET
      "assetId" = ${params.assetId},
      "fetchedPageUrl" = ${params.fetchedPageUrl ?? null},
      "title" = ${params.title ?? null},
      "brief" = ${JSON.stringify(brief)}::jsonb,
      "deletedAt" = NULL,
      "updatedAt" = now()
    RETURNING "id", "assetId", "sourceUrl", "fetchedPageUrl", "title", "brief", "createdAt", "updatedAt", NULL::text AS "assetPreviewUrl"`;
  if (!rows[0]) throw new WorkspaceError("customer_site_mismatch", 403);
  return publicRow({ ...rows[0], assetPreviewUrl: await productImportPreviewUrl(params.siteId, params.customerId, params.assetId) });
}

async function productImportPreviewUrl(siteId: string, customerId: string, assetId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ role: string; storageKey: string }[]>`SELECT "role", "storageKey" FROM "AssetUpload" WHERE "id" = ${assetId} AND "siteId" = ${siteId} AND "customerId" = ${customerId} LIMIT 1`;
  if (!rows[0]) return null;
  const role = ["input", "output", "training_input"].includes(rows[0].role) ? rows[0].role as "input" | "output" | "training_input" : "input" as const;
  return customerAssetPreviewUrl({ siteId, customerId, id: assetId, role, mimeType: "image/jpeg", storageKey: rows[0].storageKey });
}

export async function listProductImports(params: { siteId: string; customerId: string; limit?: number }): Promise<ProductImportPublic[]> {
  assertProductImportSite(params.siteId);
  const limit = Math.max(1, Math.min(50, Math.floor(params.limit ?? 20)));
  const rows = await prisma.$queryRaw<ListRow[]>`
    SELECT import."id", import."assetId", import."sourceUrl", import."fetchedPageUrl", import."title", import."brief", import."createdAt", import."updatedAt",
      CASE WHEN asset."storageKey" IS NULL THEN NULL
        ELSE ${"/api/local-assets/"} || asset."storageKey" END AS "assetPreviewUrl"
    FROM "AidreamcapesProductImport" import
    LEFT JOIN "AssetUpload" asset ON asset."id" = import."assetId" AND asset."siteId" = import."siteId" AND asset."customerId" = import."customerId"
    WHERE import."siteId" = ${params.siteId} AND import."customerId" = ${params.customerId} AND import."deletedAt" IS NULL
    ORDER BY import."updatedAt" DESC
    LIMIT ${limit}`;
  return rows.map(publicRow);
}

export async function deleteProductImport(params: { siteId: string; customerId: string; importId: string }): Promise<void> {
  assertProductImportSite(params.siteId);
  const count = await prisma.$executeRaw`UPDATE "AidreamcapesProductImport" SET "deletedAt" = now(), "updatedAt" = now() WHERE "id" = ${params.importId} AND "siteId" = ${params.siteId} AND "customerId" = ${params.customerId} AND "deletedAt" IS NULL`;
  if (!count) throw new WorkspaceError("product_import_not_found", 404);
}
