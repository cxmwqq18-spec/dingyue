import "server-only";
import fs from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import type { Album, AssetUpload, CustomerModel, ThemeRuntimeAsset } from "@/lib/types";
import {
  compactObject,
  prismaJsonObject,
  relationalUid,
  requireModelFields,
  toAlbumRelational,
  toAssetUploadRelational,
  toCustomerModelRelational
} from "@/lib/stores/prisma-mappers";

type DbClient = PrismaClient;
const customerAssetRoot = path.join(process.cwd(), "data", "customer-assets");

const requiredAssetMetadataFields = [
  "id",
  "siteId",
  "customerId",
  "label",
  "storageKey",
  "mimeType",
  "role",
  "visibility",
  "reviewStatus",
  "createdAt",
  "deletedAt"
];

export function safeCustomerAssetStorageKey(params: { siteId: string; customerId: string; storageKey: string }): string {
  const normalized = params.storageKey.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^customer-assets\//, "");
  const expectedPrefix = `sites/${params.siteId}/customers/${params.customerId}/assets/`;
  if (
    !normalized ||
    normalized.includes("..") ||
    path.isAbsolute(normalized) ||
    normalized.split("/").some((part) => part === "." || part === "") ||
    !normalized.startsWith(expectedPrefix)
  ) {
    throw new StoreError("unsafe_asset_storage_key", 400);
  }
  return normalized;
}

export async function createAssetUploadRelational(
  params: {
    siteId: string;
    customerId: string;
    label: string;
    mimeType: string;
    role?: AssetUpload["role"];
    jobId?: string;
    storageKey?: string;
    customerModelId?: string;
    subjectRole?: string;
  },
  client: DbClient = prisma
): Promise<{ asset: AssetUpload }> {
  await requireModelFields(client, "AssetUpload", requiredAssetMetadataFields);
  const customer = await client.customer.findFirst({ where: { id: params.customerId, siteId: params.siteId }, select: { id: true } });
  if (!customer) throw new StoreError("customer_not_found_for_site", 404);
  const label = params.label.trim();
  if (!label) throw new StoreError("asset_label_required", 400);
  const mimeType = params.mimeType.trim();
  if (!mimeType.includes("/")) throw new StoreError("invalid_mime_type", 400);
  const assetId = relationalUid("asset");
  const storageKey = safeCustomerAssetStorageKey({
    siteId: params.siteId,
    customerId: params.customerId,
    storageKey:
      params.storageKey ??
      `sites/${params.siteId}/customers/${params.customerId}/assets/${assetId}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  });
  const asset = await client.assetUpload.create({
    data: compactObject({
      id: assetId,
      siteId: params.siteId,
      customerId: params.customerId,
      customerModelId: params.customerModelId?.trim() || undefined,
      subjectRole: params.subjectRole?.trim() || undefined,
      jobId: params.jobId?.trim() || undefined,
      label,
      storageKey,
      mimeType,
      role: params.role ?? "input",
      visibility: "private",
      reviewStatus: "approved"
    } as Record<string, unknown>) as never
  });
  return { asset: toAssetUploadRelational(asset as unknown as Record<string, unknown>) };
}

export async function deleteAssetUploadRelational(
  params: { siteId: string; customerId: string; assetId: string },
  client: DbClient = prisma
): Promise<{ asset: AssetUpload }> {
  const asset = await client.assetUpload.findFirst({
    where: { id: params.assetId, siteId: params.siteId, customerId: params.customerId }
  });
  if (!asset) throw new StoreError("asset_not_found_for_customer", 404);
  const updated = await client.assetUpload.update({
    where: { id: params.assetId },
    data: { deletedAt: new Date() }
  });
  return { asset: toAssetUploadRelational(updated as unknown as Record<string, unknown>) };
}

export async function getCustomerAssetsRelational(
  params: { siteId: string; customerId: string; includeDeleted?: boolean; take?: number },
  client: DbClient = prisma
): Promise<{ assets: AssetUpload[] }> {
  const take = params.take === undefined ? undefined : Math.min(Math.max(Math.trunc(params.take), 1), 500);
  const assets = await client.assetUpload.findMany({
    where: compactObject({
      siteId: params.siteId,
      customerId: params.customerId,
      deletedAt: params.includeDeleted ? undefined : null
    }),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take
  });
  return { assets: assets.map((asset) => toAssetUploadRelational(asset as unknown as Record<string, unknown>)) };
}

export async function getCustomerAssetRelational(
  params: { siteId: string; customerId: string; assetId: string; includeDeleted?: boolean },
  client: DbClient = prisma
): Promise<{ asset: AssetUpload }> {
  const asset = await client.assetUpload.findFirst({
    where: compactObject({
      id: params.assetId,
      siteId: params.siteId,
      customerId: params.customerId,
      deletedAt: params.includeDeleted ? undefined : null
    })
  });
  if (!asset) throw new StoreError("asset_not_found_for_customer", 404);
  return { asset: toAssetUploadRelational(asset as unknown as Record<string, unknown>) };
}

export async function updateAssetReviewRelational(
  params: { siteId: string; customerId: string; assetId: string; reviewStatus: AssetUpload["reviewStatus"] },
  client: DbClient = prisma
): Promise<{ asset: AssetUpload }> {
  if (!["pending", "approved", "rejected"].includes(params.reviewStatus)) {
    throw new StoreError("invalid_asset_review_status", 400);
  }
  const asset = await client.assetUpload.findFirst({
    where: { id: params.assetId, siteId: params.siteId, customerId: params.customerId, deletedAt: null }
  });
  if (!asset) throw new StoreError("asset_not_found_for_customer", 404);
  const updated = await client.assetUpload.update({
    where: { id: params.assetId },
    data: { reviewStatus: params.reviewStatus }
  });
  return { asset: toAssetUploadRelational(updated as unknown as Record<string, unknown>) };
}

export async function createAssetDownloadLinkRelational(
  params: { siteId: string; customerId: string; assetId: string },
  client: DbClient = prisma
): Promise<{ asset: AssetUpload; downloadUrl: string; expiresAt: string }> {
  const { asset } = await getCustomerAssetRelational(params, client);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15).toISOString();
  const token = Buffer.from(`${asset.id}:${asset.storageKey}:${expiresAt}`).toString("base64url");
  return {
    asset,
    downloadUrl: `/api/sites/${params.siteId}/customers/${params.customerId}/assets/${params.assetId}/download?token=${token}`,
    expiresAt
  };
}

export function readCustomerAssetFileByStorageKey(params: {
  siteId: string;
  customerId: string;
  asset: AssetUpload;
}): { asset: AssetUpload; bytes: Buffer } {
  const storageKey = safeCustomerAssetStorageKey({
    siteId: params.siteId,
    customerId: params.customerId,
    storageKey: params.asset.storageKey
  });
  const filePath = path.join(customerAssetRoot, storageKey);
  if (!filePath.startsWith(`${customerAssetRoot}${path.sep}`)) throw new StoreError("unsafe_asset_storage_key", 400);
  if (!fs.existsSync(filePath)) throw new StoreError("asset_file_missing", 404);
  return { asset: params.asset, bytes: fs.readFileSync(filePath) };
}

export function toThemeRuntimeAssetRelational(asset: AssetUpload): ThemeRuntimeAsset {
  const storageKey = asset.storageKey.replace(/^customer-assets\//, "");
  return {
    id: asset.id,
    jobId: asset.jobId,
    label: asset.label,
    previewUrl: `/api/local-assets/${storageKey}`,
    downloadUrl: `/api/sites/${asset.siteId}/customers/${asset.customerId}/assets/${asset.id}/download`,
    mimeType: asset.mimeType,
    role: asset.role,
    reviewStatus: asset.reviewStatus,
    createdAt: asset.createdAt
  };
}

export async function listSiteCustomerModelsRelational(
  siteId: string,
  client: DbClient = prisma
): Promise<{ models: CustomerModel[] }> {
  await requireModelFields(client, "CustomerModel", ["id", "siteId", "customerId", "label", "status"]);
  const models = await client.customerModel.findMany({
    where: { siteId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }]
  });
  return { models: models.map((model) => toCustomerModelRelational(model as unknown as Record<string, unknown>)) };
}

export async function listSiteAlbumsRelational(siteId: string, client: DbClient = prisma): Promise<{ albums: Album[] }> {
  await requireModelFields(client, "Album", ["id", "siteId", "customerId", "title", "status"]);
  const albums = await client.album.findMany({
    where: { siteId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }]
  });
  return { albums: albums.map((album) => toAlbumRelational(album as unknown as Record<string, unknown>)) };
}

export async function listSiteCustomerAssetsRelational(
  params: { siteId: string; includeDeleted?: boolean; take?: number },
  client: DbClient = prisma
): Promise<{ assets: AssetUpload[] }> {
  await requireModelFields(client, "AssetUpload", requiredAssetMetadataFields);
  const assets = await client.assetUpload.findMany({
    where: compactObject({
      siteId: params.siteId,
      deletedAt: params.includeDeleted ? undefined : null
    }),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: params.take
  });
  return { assets: assets.map((asset) => toAssetUploadRelational(asset as unknown as Record<string, unknown>)) };
}

export async function updateCustomerModelRelational(
  params: {
    siteId: string;
    modelId: string;
    status: CustomerModel["status"];
    providerModelId?: string;
    failureReason?: string;
    inputAssetCount?: number;
  },
  client: DbClient = prisma
): Promise<{ model: CustomerModel }> {
  if (!["collecting_uploads", "training", "ready", "failed", "archived"].includes(params.status)) {
    throw new StoreError("invalid_customer_model_status", 400);
  }
  if (typeof params.inputAssetCount === "number" && (!Number.isInteger(params.inputAssetCount) || params.inputAssetCount < 0)) {
    throw new StoreError("invalid_input_asset_count", 400);
  }
  const model = await client.customerModel.findFirst({ where: { id: params.modelId, siteId: params.siteId } });
  if (!model) throw new StoreError("customer_model_not_found", 404);
  const updated = await client.customerModel.update({
    where: { id: params.modelId },
    data: compactObject({
      status: params.status,
      providerModelId: params.providerModelId !== undefined ? params.providerModelId.trim() || null : undefined,
      failureReason: params.failureReason !== undefined ? params.failureReason.trim() || null : undefined,
      inputAssetCount: params.inputAssetCount
    } as Record<string, unknown>)
  });
  return { model: toCustomerModelRelational(updated as unknown as Record<string, unknown>) };
}

export async function updateAlbumRelational(
  params: {
    siteId: string;
    albumId: string;
    status: Album["status"];
    title?: string;
    outputCount?: number;
    coverAssetId?: string;
  },
  client: DbClient = prisma
): Promise<{ album: Album }> {
  if (!["processing", "ready", "hidden"].includes(params.status)) throw new StoreError("invalid_album_status", 400);
  if (typeof params.outputCount === "number" && (!Number.isInteger(params.outputCount) || params.outputCount < 0)) {
    throw new StoreError("invalid_output_count", 400);
  }
  const album = await client.album.findFirst({ where: { id: params.albumId, siteId: params.siteId } });
  if (!album) throw new StoreError("album_not_found", 404);
  const updated = await client.album.update({
    where: { id: params.albumId },
    data: compactObject({
      status: params.status,
      title: params.title !== undefined ? params.title.trim() || album.title : undefined,
      outputCount: params.outputCount,
      coverAssetId: params.coverAssetId !== undefined ? params.coverAssetId.trim() || null : undefined
    } as Record<string, unknown>)
  });
  return { album: toAlbumRelational(updated as unknown as Record<string, unknown>) };
}

export function customerAssetMetadataEnvelope(asset: AssetUpload): Record<string, unknown> {
  return {
    id: asset.id,
    siteId: asset.siteId,
    customerId: asset.customerId,
    customerModelId: asset.customerModelId,
    subjectRole: asset.subjectRole,
    jobId: asset.jobId,
    label: asset.label,
    storageKey: asset.storageKey,
    mimeType: asset.mimeType,
    role: asset.role,
    visibility: asset.visibility,
    reviewStatus: asset.reviewStatus,
    validationStatus: asset.validationStatus,
    validationReport: prismaJsonObject(asset.validationReport),
    createdAt: asset.createdAt,
    deletedAt: asset.deletedAt
  };
}
