import "server-only";
import fs from "fs";
import type { PrismaClient } from "@prisma/client";
import {
  customerAssetFileExists,
  customerAssetFilePath,
  deleteCustomerAssetFileShared,
  hasRemoteCustomerAssetReadSource,
  normalizeCustomerAssetStorageKey,
  readCustomerAssetFileRemote,
  shouldAssumeRemoteCustomerAssetsReadable
} from "@/lib/customer-asset-storage";
import { fallbackImageForSeed } from "@/lib/media";
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
  let normalized = "";
  try {
    normalized = normalizeCustomerAssetStorageKey(params.storageKey);
  } catch {
    throw new StoreError("unsafe_asset_storage_key", 400);
  }
  const expectedPrefix = `sites/${params.siteId}/customers/${params.customerId}/assets/`;
  if (
    !normalized ||
    normalized.includes("..") ||
    normalized.split("/").some((part) => part === "." || part === "") ||
    !normalized.startsWith(expectedPrefix)
  ) {
    throw new StoreError("unsafe_asset_storage_key", 400);
  }
  return normalized;
}

function deleteAssetFileBestEffort(storageKey: string) {
  try {
    void deleteCustomerAssetFileShared(storageKey).catch(() => null);
  } catch {
    // Metadata should remain deletable even when a file was already missing.
  }
}

function sourceAssetIdsFromJobRequest(value: unknown): string[] {
  const request = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const fields = request.fields && typeof request.fields === "object" && !Array.isArray(request.fields)
    ? request.fields as Record<string, unknown>
    : {};
  return [request.assetIds, request.primaryAssetIds, request.partnerAssetIds, fields.primaryAssetIds, fields.partnerAssetIds]
    .flatMap((entry) => Array.isArray(entry) ? entry : [])
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function customerAssetPreviewUrl(storageKey: string): string {
  return `/api/local-assets/${normalizeCustomerAssetStorageKey(storageKey)}`;
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
  deleteAssetFileBestEffort(asset.storageKey);
  return { asset: toAssetUploadRelational(updated as unknown as Record<string, unknown>) };
}

export async function deleteAssetUploadsRelational(
  params: { siteId: string; customerId: string; assetIds: string[] },
  client: DbClient = prisma
): Promise<{ assets: AssetUpload[]; deletedCount: number }> {
  const assetIds = Array.from(new Set(params.assetIds.map((id) => id.trim()).filter(Boolean))).slice(0, 100);
  if (!assetIds.length) return { assets: [], deletedCount: 0 };
  const assets = await client.assetUpload.findMany({
    where: { id: { in: assetIds }, siteId: params.siteId, customerId: params.customerId, deletedAt: null }
  });
  const foundIds = new Set(assets.map((asset) => asset.id));
  const missingId = assetIds.find((assetId) => !foundIds.has(assetId));
  if (missingId) throw new StoreError("asset_not_found_for_customer", 404);
  const deletedAt = new Date();
  const updated = await client.assetUpload.updateMany({
    where: { id: { in: assetIds }, siteId: params.siteId, customerId: params.customerId, deletedAt: null },
    data: { deletedAt }
  });
  for (const asset of assets) deleteAssetFileBestEffort(asset.storageKey);
  return {
    assets: assets.map((asset) => toAssetUploadRelational({ ...asset, deletedAt } as unknown as Record<string, unknown>)),
    deletedCount: updated.count
  };
}

export async function pruneCustomerInputAssetsRelational(
  params: { siteId: string; customerId: string; keepAssetIds: string[] },
  client: DbClient = prisma
): Promise<{ deletedCount: number }> {
  const keepAssetIds = Array.from(new Set(params.keepAssetIds.map((id) => id.trim()).filter(Boolean)));
  const referencedJobs = await client.generationJob.findMany({
    where: {
      siteId: params.siteId,
      customerId: params.customerId,
      status: { in: ["queued", "running"] }
    },
    select: { requestJson: true },
    orderBy: { createdAt: "desc" },
    take: 24
  });
  const protectedAssetIds = new Set([...keepAssetIds, ...referencedJobs.flatMap((job) => sourceAssetIdsFromJobRequest(job.requestJson))]);
  const staleAssets = await client.assetUpload.findMany({
    where: {
      siteId: params.siteId,
      customerId: params.customerId,
      deletedAt: null,
      role: { in: ["input", "training_input"] },
      NOT: { subjectRole: "video_frame" },
      ...(protectedAssetIds.size ? { id: { notIn: Array.from(protectedAssetIds) } } : {})
    }
  });
  if (!staleAssets.length) return { deletedCount: 0 };
  await client.assetUpload.updateMany({
    where: { id: { in: staleAssets.map((asset) => asset.id) }, siteId: params.siteId, customerId: params.customerId },
    data: { deletedAt: new Date() }
  });
  for (const asset of staleAssets) deleteAssetFileBestEffort(asset.storageKey);
  return { deletedCount: staleAssets.length };
}

export async function getCustomerAssetsRelational(
  params: { siteId: string; customerId: string; includeDeleted?: boolean; take?: number; roles?: AssetUpload["role"][] },
  client: DbClient = prisma
): Promise<{ assets: AssetUpload[] }> {
  const take = params.take === undefined ? undefined : Math.min(Math.max(Math.trunc(params.take), 1), 500);
  const roles = params.roles?.filter((role) => role === "input" || role === "output" || role === "training_input");
  const assets = await client.assetUpload.findMany({
    where: compactObject({
      siteId: params.siteId,
      customerId: params.customerId,
      role: roles?.length ? { in: roles } : undefined,
      deletedAt: params.includeDeleted ? undefined : null
    }),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take
  });
  return { assets: assets.map((asset) => toAssetUploadRelational(asset as unknown as Record<string, unknown>)) };
}

export function customerAssetHasReadableFile(asset: Pick<AssetUpload, "storageKey">): boolean {
  if (shouldAssumeRemoteCustomerAssetsReadable()) return true;
  return customerAssetFileExists(asset.storageKey.replace(/^customer-assets\//, ""));
}

export async function updateCustomerAssetFavoriteRelational(
  params: { siteId: string; customerId: string; assetId: string; isFavorite: boolean },
  client: DbClient = prisma
): Promise<{ asset: AssetUpload }> {
  const asset = await client.assetUpload.findFirst({
    where: { id: params.assetId, siteId: params.siteId, customerId: params.customerId, deletedAt: null }
  });
  if (!asset) throw new StoreError("asset_not_found_for_customer", 404);
  if (asset.role !== "output") throw new StoreError("only_generated_outputs_can_be_favorited", 400);
  const currentReport = prismaJsonObject(toAssetUploadRelational(asset as unknown as Record<string, unknown>).validationReport) ?? {};
  const favoriteReport = params.isFavorite
    ? { ...currentReport, isFavorite: true, favoriteAt: new Date().toISOString() }
    : Object.fromEntries(Object.entries(currentReport).filter(([key]) => key !== "isFavorite" && key !== "favoriteAt"));
  const updated = await client.assetUpload.update({
    where: { id: params.assetId },
    data: { validationReport: favoriteReport }
  });
  return { asset: toAssetUploadRelational(updated as unknown as Record<string, unknown>) };
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

export async function readCustomerAssetFileByStorageKey(params: {
  siteId: string;
  customerId: string;
  asset: AssetUpload;
}): Promise<{ asset: AssetUpload; bytes: Buffer; mimeType: string }> {
  const storageKey = safeCustomerAssetStorageKey({
    siteId: params.siteId,
    customerId: params.customerId,
    storageKey: params.asset.storageKey
  });
  const filePath = customerAssetFilePath(storageKey);
  if (fs.existsSync(filePath)) {
    return { asset: params.asset, bytes: fs.readFileSync(filePath), mimeType: params.asset.mimeType };
  }
  if (hasRemoteCustomerAssetReadSource()) {
    try {
      const remote = await readCustomerAssetFileRemote({ storageKey });
      return { asset: params.asset, bytes: remote.bytes, mimeType: remote.mimeType || params.asset.mimeType };
    } catch {
      throw new StoreError("asset_file_missing", 404);
    }
  }
  throw new StoreError("asset_file_missing", 404);
}

export function toThemeRuntimeAssetRelational(asset: AssetUpload): ThemeRuntimeAsset {
  const storageKey = asset.storageKey.replace(/^customer-assets\//, "");
  const altText = typeof asset.validationReport?.altText === "string" ? asset.validationReport.altText : undefined;
  const previewUrl = customerAssetFileExists(storageKey) || hasRemoteCustomerAssetReadSource()
    ? customerAssetPreviewUrl(storageKey)
    : fallbackImageForSeed(`${asset.siteId}-${asset.id}-${storageKey}`);
  return {
    id: asset.id,
    jobId: asset.jobId,
    subjectRole: asset.subjectRole,
    altText,
    label: asset.label,
    storageKey,
    previewUrl,
    downloadUrl: `/api/sites/${asset.siteId}/customers/${asset.customerId}/assets/${asset.id}/download`,
    mimeType: asset.mimeType,
    role: asset.role,
    reviewStatus: asset.reviewStatus,
    isFavorite: asset.isFavorite,
    favoriteAt: asset.favoriteAt,
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
