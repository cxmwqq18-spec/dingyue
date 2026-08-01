"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FileWarning, Heart, ImageOff, PlayCircle, Trash2 } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import { AdminPagination, clampPage, pageItems } from "@/components/admin/admin-pagination";
import { downloadCsv } from "@/components/admin/export-utils";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import type { AssetUpload, CustomerModel, PublicCustomer } from "@/lib/types";
import type { JobStatus } from "@/lib/types";
import { StatusPill } from "@/components/ui";

type Tone = "good" | "warn" | "bad" | "neutral";
type ReviewAsset = AssetUpload & {
  previewUrl?: string;
  downloadUrl?: string;
  sourceAssetIds?: string[];
};
type ReviewAssetJob = {
  id: string;
  customerId: string;
  status: JobStatus;
  sourceAssetIds: string[];
  outputStorageKeys: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
};
type AssetGroup = {
  id: string;
  sourceAssets: ReviewAsset[];
  outputAssets: ReviewAsset[];
  primaryAsset: ReviewAsset;
  job?: ReviewAssetJob;
};
type DeleteCustomerAssetResult = {
  ok?: boolean;
  deletedJobIds?: string[];
  deletedAssetIds?: string[];
  error?: string;
};
type FavoriteCustomerAssetResult = {
  ok?: boolean;
  asset?: Pick<AssetUpload, "id" | "isFavorite" | "favoriteAt">;
  error?: string;
};
type DeleteMode = "asset" | "output" | "job";

function reviewStatusLabel(status: AssetUpload["reviewStatus"]) {
  return {
    approved: "已通过",
    pending: "待审核",
    rejected: "已拒绝"
  }[status];
}

function isVideoAsset(asset: Pick<AssetUpload, "mimeType">): boolean {
  return asset.mimeType.startsWith("video/");
}

function assetRoleLabel(asset: Pick<AssetUpload, "role" | "mimeType">) {
  if (asset.role === "output") return isVideoAsset(asset) ? "AI 输出视频" : "AI 输出图";
  if (asset.role === "training_input") return "训练图";
  return isVideoAsset(asset) ? "客户上传视频" : "客户上传源图";
}

function assetRoleHint(asset: Pick<AssetUpload, "role" | "mimeType">) {
  if (asset.role === "output") return isVideoAsset(asset) ? "这是 AI 生成后的视频结果，可用于视频工作台交付。" : "这是 AI 生成后的结果图，可用于相册交付。";
  if (asset.role === "training_input") return "这是用于训练或参考的客户素材，不是最终生成结果。";
  return "这是客户上传给 AI 参考的原始素材，不是生成结果。生成结果请查看类型为“AI 输出图/视频”的记录。";
}

function assetRoleTone(role: AssetUpload["role"]): string {
  if (role === "output") return "border-sky-200 bg-sky-50 text-sky-700";
  if (role === "training_input") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function reviewTone(status: AssetUpload["reviewStatus"]): Tone {
  if (status === "approved") return "good";
  if (status === "rejected") return "bad";
  return "warn";
}

function jobStatusLabel(status: JobStatus) {
  return {
    queued: "排队中",
    running: "生成中",
    succeeded: "已完成",
    failed: "生成失败",
    refunded: "已退回"
  }[status];
}

function jobStatusTone(status: JobStatus): string {
  if (status === "succeeded") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed" || status === "refunded") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function assetPreviewUrl(asset: ReviewAsset): string {
  if (asset.previewUrl) return asset.previewUrl;
  return localAssetUrl(asset.storageKey);
}

function localAssetUrl(storageKeyValue: string, search = ""): string {
  const storageKey = storageKeyValue.replace(/^customer-assets\//, "").replace(/^\/+/, "");
  if (!storageKey || storageKey.includes("..") || storageKey.includes("\\")) return "";
  const encodedPath = storageKey.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `/api/local-assets/${encodedPath}${search}`;
}

function assetPosterUrl(asset: ReviewAsset): string {
  return localAssetUrl(asset.storageKey, "?poster=1");
}

function assetFileName(asset: Pick<ReviewAsset, "storageKey" | "label">): string {
  return asset.storageKey.split("/").filter(Boolean).pop() || asset.label;
}

function shortId(value: string | undefined): string {
  if (!value) return "未关联";
  return value.length > 24 ? `${value.slice(0, 14)}...${value.slice(-6)}` : value;
}

function assetTimestamp(asset: ReviewAsset): number {
  const timestamp = new Date(asset.createdAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function newestAsset(assets: ReviewAsset[]): ReviewAsset {
  return assets.reduce((newest, asset) => (assetTimestamp(asset) > assetTimestamp(newest) ? asset : newest), assets[0]);
}

function jobTimestamp(job: ReviewAssetJob): number {
  const timestamp = new Date(job.createdAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function jobUpdatedTimestamp(job: ReviewAssetJob): number {
  const timestamp = new Date(job.updatedAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : jobTimestamp(job);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function mergeAssetJob(left: ReviewAssetJob, right: ReviewAssetJob): ReviewAssetJob {
  const preferred = jobUpdatedTimestamp(right) >= jobUpdatedTimestamp(left) ? right : left;
  return {
    ...preferred,
    sourceAssetIds: uniqueStrings([...left.sourceAssetIds, ...right.sourceAssetIds]),
    outputStorageKeys: uniqueStrings([...left.outputStorageKeys, ...right.outputStorageKeys])
  };
}

function uniqueAssetJobs(jobs: ReviewAssetJob[]): ReviewAssetJob[] {
  const byId = new Map<string, ReviewAssetJob>();
  for (const job of jobs) {
    const existing = byId.get(job.id);
    byId.set(job.id, existing ? mergeAssetJob(existing, job) : job);
  }
  return Array.from(byId.values());
}

function buildAssetGroups(assets: ReviewAsset[], allAssets: ReviewAsset[], jobs: ReviewAssetJob[]): AssetGroup[] {
  const byId = new Map(allAssets.map((asset) => [asset.id, asset]));
  const outputByJobId = new Map<string, ReviewAsset[]>();
  for (const output of allAssets.filter((asset) => asset.role === "output" && asset.jobId)) {
    const current = outputByJobId.get(output.jobId!) ?? [];
    current.push(output);
    outputByJobId.set(output.jobId!, current);
  }
  const consumedSourceIds = new Set<string>();
  const consumedOutputIds = new Set<string>();
  const sourceIdsInFilter = new Set(assets.filter((asset) => asset.role !== "output").map((asset) => asset.id));
  const outputIdsInFilter = new Set(assets.filter((asset) => asset.role === "output").map((asset) => asset.id));
  const groups: AssetGroup[] = [];

  for (const job of uniqueAssetJobs(jobs)) {
    const sourceAssets = job.sourceAssetIds
      .map((assetId) => byId.get(assetId))
      .filter((asset): asset is ReviewAsset => Boolean(asset));
    const outputAssets = (outputByJobId.get(job.id) ?? []).filter((asset) =>
      outputIdsInFilter.has(asset.id) || (!outputIdsInFilter.size && !sourceIdsInFilter.size)
    );
    const hasVisibleSource = sourceAssets.some((asset) => sourceIdsInFilter.has(asset.id));
    const hasVisibleOutput = outputAssets.some((asset) => outputIdsInFilter.has(asset.id));
    if ((sourceIdsInFilter.size || outputIdsInFilter.size) && !hasVisibleSource && !hasVisibleOutput) continue;
    if (!sourceAssets.length && !outputAssets.length) continue;
    sourceAssets.forEach((asset) => consumedSourceIds.add(asset.id));
    outputAssets.forEach((asset) => consumedOutputIds.add(asset.id));
    const primaryAsset = newestAsset([...outputAssets, ...sourceAssets]);
    groups.push({
      id: `job:${job.id}`,
      sourceAssets,
      outputAssets,
      primaryAsset,
      job
    });
  }

  for (const output of assets.filter((asset) => asset.role === "output")) {
    if (consumedOutputIds.has(output.id)) continue;
    const sourceAssets = (output.sourceAssetIds ?? [])
      .map((assetId) => byId.get(assetId))
      .filter((asset): asset is ReviewAsset => Boolean(asset));
    sourceAssets.forEach((asset) => consumedSourceIds.add(asset.id));
    groups.push({
      id: output.jobId ? `job:${output.jobId}:output:${output.id}` : `output:${output.id}`,
      sourceAssets,
      outputAssets: [output],
      primaryAsset: output
    });
  }

  for (const asset of assets) {
    if (asset.role === "output" || consumedSourceIds.has(asset.id)) continue;
    groups.push({
      id: `asset:${asset.id}`,
      sourceAssets: asset.role === "input" || asset.role === "training_input" ? [asset] : [],
      outputAssets: [],
      primaryAsset: asset
    });
  }

  return groups.sort((left, right) => {
    const rightTime = right.job ? Math.max(jobTimestamp(right.job), assetTimestamp(right.primaryAsset)) : assetTimestamp(right.primaryAsset);
    const leftTime = left.job ? Math.max(jobTimestamp(left.job), assetTimestamp(left.primaryAsset)) : assetTimestamp(left.primaryAsset);
    return rightTime - leftTime;
  });
}

function AssetPreviewFallback({
  compact = false,
  video = false
}: {
  compact?: boolean;
  video?: boolean;
}) {
  const Icon = video ? PlayCircle : ImageOff;
  return (
    <span className={`flex h-full w-full items-center justify-center bg-zinc-50 text-zinc-400 ${compact ? "text-[10px]" : "text-xs"}`}>
      <span className="grid justify-items-center gap-1">
        <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} strokeWidth={1.8} />
        {!compact ? <span>预览不可用</span> : null}
      </span>
    </span>
  );
}

function AssetThumb({ asset }: { asset: ReviewAsset }) {
  const previewUrl = assetPreviewUrl(asset);
  const posterUrl = isVideoAsset(asset) ? assetPosterUrl(asset) : "";
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [asset.id, previewUrl, posterUrl]);
  const src = isVideoAsset(asset) ? posterUrl : previewUrl;
  return (
    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-zinc-200 bg-zinc-50">
      {src && !failed ? (
        <span className="relative h-full w-full">
          <img
            alt={`${assetRoleLabel(asset)}预览`}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setFailed(true)}
            src={src}
          />
          {isVideoAsset(asset) ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/12 text-white">
              <PlayCircle className="h-4 w-4 drop-shadow" strokeWidth={2} />
            </span>
          ) : null}
        </span>
      ) : (
        <AssetPreviewFallback compact video={isVideoAsset(asset)} />
      )}
    </span>
  );
}

function AssetDetailCard({ asset }: { asset: ReviewAsset }) {
  const previewUrl = assetPreviewUrl(asset);
  const posterUrl = isVideoAsset(asset) ? assetPosterUrl(asset) : "";
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [asset.id, previewUrl, posterUrl]);
  return (
    <div className="grid gap-3 rounded-[12px] border border-zinc-200 bg-white p-3">
      <div className="h-44 overflow-hidden rounded-[10px] border border-zinc-200 bg-zinc-50">
        {previewUrl && isVideoAsset(asset) && !failed ? (
          <video
            className="h-full w-full bg-black object-contain"
            controls
            onError={() => setFailed(true)}
            playsInline
            poster={posterUrl || undefined}
            preload="metadata"
            src={previewUrl}
          />
        ) : previewUrl && !failed ? (
          <img alt={asset.label} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} src={previewUrl} />
        ) : (
          <AssetPreviewFallback video={isVideoAsset(asset)} />
        )}
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${assetRoleTone(asset.role)}`}>
            {assetRoleLabel(asset)}
          </span>
          <StatusPill label={reviewStatusLabel(asset.reviewStatus)} tone={reviewTone(asset.reviewStatus)} />
          {asset.isFavorite ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
              <Heart className="h-3 w-3 fill-current" strokeWidth={1.8} />收藏
            </span>
          ) : null}
        </div>
        <p className="truncate text-sm font-semibold text-zinc-950" title={asset.label}>{asset.label}</p>
        <p className="mt-1 truncate font-mono text-[11px] text-zinc-500" title={assetFileName(asset)}>{assetFileName(asset)}</p>
        <dl className="mt-2 grid gap-1 text-[11px] leading-5 text-zinc-500">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <dt className="shrink-0">素材 ID</dt>
            <dd className="truncate font-mono text-zinc-700" title={asset.id}>{shortId(asset.id)}</dd>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <dt className="shrink-0">文件类型</dt>
            <dd className="truncate font-mono text-zinc-700">{asset.mimeType}</dd>
          </div>
        </dl>
        <details className="mt-2 text-[11px] text-zinc-500">
          <summary className="cursor-pointer select-none">查看存储路径</summary>
          <p className="mt-1 break-all font-mono leading-5 text-zinc-600">{asset.storageKey}</p>
        </details>
      </div>
      <div className="flex flex-wrap gap-2">
        {previewUrl ? (
          <a className="rounded-[8px] border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700" href={previewUrl} rel="noreferrer" target="_blank">
            {isVideoAsset(asset) ? "打开视频" : "打开图片"}
          </a>
        ) : null}
        {asset.downloadUrl ? (
          <a className="rounded-[8px] border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700" href={asset.downloadUrl} rel="noreferrer" target="_blank">
            下载
          </a>
        ) : null}
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-sm text-zinc-900 ${mono ? "break-all font-mono leading-5" : "break-words font-medium"}`} title={value}>{value}</p>
    </div>
  );
}

function DetailMetric({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function GroupAssetSection({
  title,
  emptyText,
  assets
}: {
  title: string;
  emptyText: string;
  assets: ReviewAsset[];
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-zinc-950">{title}</h4>
        <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-500">{assets.length} 项</span>
      </div>
      {assets.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => <AssetDetailCard asset={asset} key={asset.id} />)}
        </div>
      ) : (
        <div className="rounded-[12px] border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-500">{emptyText}</div>
      )}
    </section>
  );
}

export function CustomerAssetReviewPanel({
  siteId,
  assets,
  assetJobs = [],
  customers,
  models = []
}: {
  siteId: string;
  assets: ReviewAsset[];
  assetJobs?: ReviewAssetJob[];
  customers: PublicCustomer[];
  models?: CustomerModel[];
}) {
  const [items, setItems] = useState(assets);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AssetUpload["role"] | "">("");
  const [reviewFilter, setReviewFilter] = useState<AssetUpload["reviewStatus"] | "">("");
  const [favoriteFilter, setFavoriteFilter] = useState<"" | "favorite">("");
  const [message, setMessage] = useState("用于审核后台返回的最新客户素材记录，包含客户上传源图、训练图和 AI 输出结果；输出结果通过任务关联到相册交付。");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [reviewingAssetId, setReviewingAssetId] = useState<string | null>(null);
  const [favoritingAssetId, setFavoritingAssetId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [deletedJobIds, setDeletedJobIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setItems(assets);
  }, [assets]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((asset) => {
      if (roleFilter && asset.role !== roleFilter) return false;
      if (reviewFilter && asset.reviewStatus !== reviewFilter) return false;
      if (favoriteFilter === "favorite" && !asset.isFavorite) return false;
      if (!normalized) return true;
      const customer = customers.find((item) => item.id === asset.customerId);
      const model = asset.customerModelId ? models.find((item) => item.id === asset.customerModelId) : undefined;
      return [asset.label, asset.id, asset.storageKey, customer?.email ?? "", customer?.name ?? "", model?.label ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [customers, favoriteFilter, items, models, query, reviewFilter, roleFilter]);

  const visibleAssetJobs = useMemo(() => assetJobs.filter((job) => !deletedJobIds.has(job.id)), [assetJobs, deletedJobIds]);
  const groupedItems = useMemo(() => buildAssetGroups(filteredItems, items, visibleAssetJobs), [filteredItems, items, visibleAssetJobs]);
  const currentPage = clampPage(page, groupedItems.length, pageSize);
  const pagedGroups = pageItems(groupedItems, currentPage, pageSize);
  const selectedGroup = selectedGroupId ? groupedItems.find((group) => group.id === selectedGroupId) : undefined;

  useEffect(() => setPage(1), [query, roleFilter, reviewFilter, favoriteFilter, pageSize]);
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);

  function exportAssets() {
    downloadCsv(
      `${siteId}-customer-assets.csv`,
      groupedItems.map((group) => {
        const asset = group.primaryAsset;
        const customer = customers.find((item) => item.id === asset.customerId);
        const model = asset.customerModelId ? models.find((item) => item.id === asset.customerModelId) : undefined;
        return {
          记录ID: group.id,
          顾客邮箱: customer?.email ?? asset.customerId,
          源图: group.sourceAssets.map((item) => item.label).join("；"),
          生成结果: group.outputAssets.map((item) => item.label).join("；"),
          审核状态: reviewStatusLabel(asset.reviewStatus),
          模型: model?.label ?? "",
          任务ID: asset.jobId ?? "",
          任务状态: group.job ? jobStatusLabel(group.job.status) : "",
          失败原因: group.job?.error ?? "",
          创建时间: asset.createdAt
        };
      }),
      ["记录ID", "顾客邮箱", "源图", "生成结果", "审核状态", "模型", "任务ID", "任务状态", "失败原因", "创建时间"]
    );
    setMessage(`已导出 ${groupedItems.length} 条素材记录。`);
  }

  function resetFilters() {
    setQuery("");
    setRoleFilter("");
    setReviewFilter("");
    setFavoriteFilter("");
  }

  async function toggleFavoriteAsset(asset: ReviewAsset) {
    if (asset.role !== "output") {
      setMessage("只有 AI 输出结果可以加入收藏。");
      return;
    }
    const nextFavorite = !asset.isFavorite;
    const nextFavoriteAt = nextFavorite ? new Date().toISOString() : undefined;
    setFavoritingAssetId(asset.id);
    setItems((current) => current.map((item) => item.id === asset.id ? { ...item, isFavorite: nextFavorite, favoriteAt: nextFavoriteAt } : item));
    setMessage(`正在${nextFavorite ? "收藏" : "取消收藏"} ${asset.label}...`);
    try {
      const response = await fetchAdminJson<FavoriteCustomerAssetResult>(`/api/sites/${siteId}/admin/customer-assets`, {
        init: {
          method: "PATCH",
          headers: siteAdminJsonHeaders(siteId),
          body: JSON.stringify({
            customerId: asset.customerId,
            assetId: asset.id,
            isFavorite: nextFavorite
          })
        },
        timeoutMs: 12_000
      });
      if (!response.ok || !response.data.asset) {
        throw new Error(response.data.error || "asset_favorite_update_failed");
      }
      setItems((current) => current.map((item) => item.id === asset.id ? { ...item, isFavorite: response.data.asset!.isFavorite, favoriteAt: response.data.asset!.favoriteAt } : item));
      setMessage(`${asset.label} 已${response.data.asset.isFavorite ? "加入收藏" : "取消收藏"}。`);
    } catch (error) {
      setItems((current) => current.map((item) => item.id === asset.id ? asset : item));
      setMessage(error instanceof Error ? `收藏更新失败：${error.message}` : "收藏更新失败，请稍后重试。");
    } finally {
      setFavoritingAssetId(null);
    }
  }

  async function reviewAsset(asset: ReviewAsset, reviewStatus: AssetUpload["reviewStatus"]) {
    setReviewingAssetId(asset.id);
    setMessage(`正在将 ${asset.label} 标记为${reviewStatusLabel(reviewStatus)}...`);
    try {
      const response = await fetch(`/api/sites/${siteId}/customers/${asset.customerId}/assets/${asset.id}/review`, {
        method: "POST",
        headers: siteAdminJsonHeaders(siteId),
        body: JSON.stringify({ reviewStatus })
      });
      const result = (await response.json().catch(() => ({}))) as { asset?: { reviewStatus?: AssetUpload["reviewStatus"] }; error?: string };
      if (!response.ok || !result.asset?.reviewStatus) {
        throw new Error(result.error || "asset_review_failed");
      }
      setItems((current) => current.map((item) => (item.id === asset.id ? { ...item, reviewStatus: result.asset!.reviewStatus! } : item)));
      setMessage(`已将 ${asset.label} 标记为${reviewStatusLabel(result.asset.reviewStatus)}。`);
    } catch (error) {
      setMessage(error instanceof Error ? `审核失败：${error.message}` : "审核失败，请稍后重试。");
    } finally {
      setReviewingAssetId(null);
    }
  }

  function deleteModeForGroup(group: AssetGroup): DeleteMode {
    if (group.job) return "job";
    return group.primaryAsset.role === "output" ? "output" : "asset";
  }

  function deleteConfirmText(group: AssetGroup): string {
    if (group.job) {
      return `确定删除这条生成任务吗？将同时清理该任务的输出结果、相册记录、任务记录和相关额度流水；未被其他任务复用的源图也会删除。任务 ID：${group.job.id}`;
    }
    if (group.primaryAsset.role === "output") {
      return `确定删除这个 AI 输出结果吗？如果它被相册封面引用，相册会被隐藏并取消封面。素材 ID：${group.primaryAsset.id}`;
    }
    return `确定删除这张客户源图/训练图吗？素材 ID：${group.primaryAsset.id}`;
  }

  async function deleteGroup(group: AssetGroup) {
    if (!window.confirm(deleteConfirmText(group))) return;
    const mode = deleteModeForGroup(group);
    const asset = group.primaryAsset;
    setDeletingGroupId(group.id);
    setMessage("正在删除当前资源及关联数据...");
    try {
      const response = await fetchAdminJson<DeleteCustomerAssetResult>(`/api/sites/${siteId}/admin/customer-assets`, {
        init: {
          method: "DELETE",
          headers: siteAdminJsonHeaders(siteId),
          body: JSON.stringify({
            mode,
            customerId: asset.customerId,
            assetId: mode === "job" ? undefined : asset.id,
            jobId: group.job?.id ?? asset.jobId
          })
        },
        timeoutMs: 20_000
      });
      if (!response.ok || !response.data.ok) {
        throw new Error(response.data.error || "customer_resource_delete_failed");
      }
      const removedAssets = new Set(response.data.deletedAssetIds ?? []);
      const removedJobs = new Set(response.data.deletedJobIds ?? []);
      if (group.job) removedJobs.add(group.job.id);
      setItems((current) => current.filter((item) => !removedAssets.has(item.id)));
      if (selectedGroupId === group.id) setSelectedGroupId(null);
      if (removedJobs.size) {
        setDeletedJobIds((current) => new Set([...current, ...removedJobs]));
      }
      setMessage(`已删除当前资源：${removedJobs.size} 个任务，${removedAssets.size} 个素材。`);
    } catch (error) {
      setMessage(error instanceof Error ? `删除失败：${error.message}` : "删除失败，请稍后重试。");
    } finally {
      setDeletingGroupId(null);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-clay">素材审核</p>
          <h2 className="mt-2 text-xl font-semibold">客户素材审核</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{message}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">用途说明：这里审核客户上传的源图、训练图和任务输出结果，避免未授权或质量不合格的素材进入训练、生成和相册交付流程。</p>
        </div>
        <button className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[8px] border border-black/10 px-4 py-2 text-sm active:scale-[0.98]" onClick={exportAssets} type="button">
          <Download className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
          导出 CSV
        </button>
      </div>
      <div className="mt-5 rounded-[12px] border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-zinc-500">共 {items.length} 条</span>
          <button className="whitespace-nowrap rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sky-700" onClick={() => setRoleFilter("output")} type="button">
            {items.filter((asset) => asset.role === "output").length} AI 输出结果
          </button>
          <button className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700" onClick={() => setRoleFilter("input")} type="button">
            {items.filter((asset) => asset.role === "input").length} 客户上传源图
          </button>
          <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">{items.filter((asset) => asset.reviewStatus === "approved").length} 已通过</span>
          <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">{items.filter((asset) => asset.reviewStatus === "pending").length} 待审核</span>
          <span className="whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700">{items.filter((asset) => asset.reviewStatus === "rejected").length} 已拒绝</span>
          <button className="whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700" onClick={() => setFavoriteFilter("favorite")} type="button">
            {items.filter((asset) => asset.isFavorite).length} 已收藏
          </button>
          <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-zinc-500">{groupedItems.length} 当前显示</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_150px_170px_auto]">
          <input className="rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder="搜索素材、顾客、模型" value={query} />
          <select className="rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setRoleFilter(event.target.value as AssetUpload["role"] | "")} value={roleFilter}>
            <option value="">全部类型</option>
            <option value="input">源图</option>
            <option value="training_input">训练图</option>
            <option value="output">输出结果</option>
          </select>
          <select className="rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setReviewFilter(event.target.value as AssetUpload["reviewStatus"] | "")} value={reviewFilter}>
            <option value="">全部审核状态</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
          <button className="shrink-0 whitespace-nowrap rounded-[8px] border border-black/10 bg-white px-4 py-2 text-sm active:scale-[0.98]" onClick={resetFilters} type="button">重置</button>
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-[12px] border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="list min-w-[1420px] table-fixed">
            <colgroup>
              <col className="w-[280px]" />
              <col className="w-[170px]" />
              <col className="w-[230px]" />
              <col className="w-[240px]" />
              <col className="w-[260px]" />
              <col className="w-[180px]" />
              <col className="w-[130px]" />
              <col className="w-[180px]" />
            </colgroup>
            <thead>
              <tr>
                <th className="bgtt aleft">记录</th>
                <th className="bgtt aleft">源图</th>
                <th className="bgtt aleft">AI 生成结果</th>
                <th className="bgtt aleft">顾客</th>
                <th className="bgtt">任务</th>
                <th className="bgtt">创建时间</th>
                <th className="bgtt">审核状态</th>
                <th className="bgtt">操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedGroups.map((group) => {
                const asset = group.primaryAsset;
                const customer = customers.find((item) => item.id === asset.customerId);
                const firstSource = group.sourceAssets[0];
                const firstOutput = group.outputAssets[0];
                return (
                  <tr className="h-[72px]" key={group.id}>
                    <td className="aleft whitespace-nowrap align-middle">
                      <div className="flex min-w-0 items-center gap-3">
                        <AssetThumb asset={asset} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${assetRoleTone(asset.role)}`}>
                              {assetRoleLabel(asset)}
                            </span>
                            {asset.isFavorite ? <Heart className="h-3.5 w-3.5 shrink-0 fill-rose-500 text-rose-500" strokeWidth={1.8} /> : null}
                          </div>
                          <p className="mt-1 max-w-[190px] truncate text-sm font-semibold text-zinc-950" title={asset.label}>{asset.label}</p>
                          <p className="max-w-[190px] truncate font-mono text-[11px] text-zinc-400" title={group.id}>{shortId(group.id)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="aleft whitespace-nowrap align-middle">
                      <div className="flex min-w-0 items-center gap-2">
                        {firstSource ? <AssetThumb asset={firstSource} /> : <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-dashed border-zinc-200 bg-zinc-50 text-[10px] text-zinc-400">无</span>}
                        <span className="min-w-0 flex-1 overflow-hidden">
                          <span className="block truncate text-sm font-medium text-zinc-700">{group.sourceAssets.length ? `${group.sourceAssets.length} 项源素材` : "未关联源素材"}</span>
                          <span className="block truncate font-mono text-[11px] text-zinc-400" title={firstSource?.id ?? ""}>{shortId(firstSource?.id)}</span>
                        </span>
                      </div>
                    </td>
                    <td className="aleft whitespace-nowrap align-middle">
                      <div className="flex min-w-0 items-center gap-2">
                        {firstOutput ? <AssetThumb asset={firstOutput} /> : <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-dashed border-zinc-200 bg-zinc-50 text-[10px] text-zinc-400">无</span>}
                        <span className="min-w-0 flex-1 overflow-hidden">
                          <span className="block truncate text-sm font-medium text-zinc-700">{group.outputAssets.length ? `${group.outputAssets.length} 项输出结果` : group.job ? `${jobStatusLabel(group.job.status)}，暂无输出` : "暂无生成结果"}</span>
                          <span className="block truncate text-[11px] text-rose-600" title={group.job?.error ?? ""}>{group.job?.error ?? ""}</span>
                        </span>
                      </div>
                    </td>
                    <td className="aleft whitespace-nowrap align-middle">
                      <span className="block max-w-[220px] truncate text-zinc-700">{customer?.email ?? asset.customerId}</span>
                      <span className="block max-w-[220px] truncate text-[11px] text-zinc-400">{customer?.name ?? "未命名顾客"}</span>
                    </td>
                    <td className="whitespace-nowrap align-middle text-[11px] text-zinc-500">
                      {group.job ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 font-medium ${jobStatusTone(group.job.status)}`}>{jobStatusLabel(group.job.status)}</span>
                          <span className="max-w-[180px] truncate font-mono" title={group.job.id}>{shortId(group.job.id)}</span>
                        </span>
                      ) : (
                        <span className="block max-w-[220px] truncate font-mono" title={asset.jobId ?? "未关联"}>{shortId(asset.jobId)}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap align-middle font-mono text-[11px] text-zinc-500">{formatDate(asset.createdAt)}</td>
                    <td className="whitespace-nowrap align-middle"><StatusPill label={reviewStatusLabel(asset.reviewStatus)} tone={reviewTone(asset.reviewStatus)} /></td>
                    <td className="whitespace-nowrap align-middle">
                      <span className="inline-flex flex-nowrap items-center justify-center gap-1.5 whitespace-nowrap">
                        <button
                          className="admin_btn inline-flex h-[30px] items-center gap-1 whitespace-nowrap"
                          disabled={reviewingAssetId === asset.id || asset.reviewStatus === "approved"}
                          onClick={() => reviewAsset(asset, "approved")}
                          type="button"
                        >
                          通过
                        </button>
                        <button
                          className="admin_btn inline-flex h-[30px] items-center gap-1 whitespace-nowrap"
                          disabled={reviewingAssetId === asset.id || asset.reviewStatus === "rejected"}
                          onClick={() => reviewAsset(asset, "rejected")}
                          type="button"
                        >
                          拒绝
                        </button>
                        <button className="admin_btn inline-flex h-[30px] items-center gap-1 whitespace-nowrap" onClick={() => setSelectedGroupId(group.id)} type="button">
                          <Eye className="h-3.5 w-3.5" strokeWidth={1.8} />详情
                        </button>
                        <button
                          className="admin_btn inline-flex h-[30px] items-center gap-1 whitespace-nowrap border-rose-200 bg-rose-50 text-rose-700 disabled:opacity-50"
                          disabled={deletingGroupId === group.id}
                          onClick={() => deleteGroup(group)}
                          type="button"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />删除
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!filteredItems.length ? (
                <tr>
                  <td className="text-left text-zinc-600" colSpan={8}>
                    <div className="rounded-[10px] border border-dashed border-zinc-300 bg-zinc-50 p-5">
                      <p className="font-semibold text-zinc-900">当前筛选下没有客户素材。</p>
                      <p className="mt-2 leading-6">操作手册：客户上传素材后会出现在这里。源图和训练图用于模型训练，输出结果用于相册或视频交付。运维需要查看素材详情，确认顾客、模型、文件类型和路径无误后点击“通过”；不合规素材点击“拒绝”，拒绝后不要进入训练或交付流程。</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <AdminPagination page={currentPage} pageSize={pageSize} total={groupedItems.length} onPageChange={setPage} onPageSizeChange={setPageSize} />

      {selectedGroup ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-zinc-950/45 p-4" role="dialog" aria-modal="true" aria-label="生成记录详情">
          <div className="max-h-[calc(100dvh-32px)] w-full max-w-6xl overflow-y-auto overscroll-contain rounded-[12px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-clay">生成记录详情</p>
                <h3 className="mt-1 truncate text-lg font-semibold text-zinc-950">{selectedGroup.primaryAsset.label}</h3>
              </div>
              <button className="rounded-[8px] border border-black/10 px-3 py-1.5 text-sm" onClick={() => setSelectedGroupId(null)} type="button">关闭</button>
            </div>
            {(() => {
              const asset = selectedGroup.primaryAsset;
              const customer = customers.find((item) => item.id === asset.customerId);
              const model = asset.customerModelId ? models.find((item) => item.id === asset.customerModelId) : undefined;
              const taskId = selectedGroup.job?.id ?? asset.jobId ?? "未关联";
              return (
                <div className="grid gap-5 p-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <section className="rounded-[12px] border border-zinc-200 bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${assetRoleTone(asset.role)}`}>
                          {assetRoleLabel(asset)}
                        </span>
                        <StatusPill label={reviewStatusLabel(asset.reviewStatus)} tone={reviewTone(asset.reviewStatus)} />
                        {selectedGroup.job ? (
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${jobStatusTone(selectedGroup.job.status)}`}>{jobStatusLabel(selectedGroup.job.status)}</span>
                        ) : null}
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        <DetailMetric label="源素材" value={selectedGroup.sourceAssets.length} />
                        <DetailMetric label="生成结果" value={selectedGroup.outputAssets.length} />
                        <DetailMetric label="收藏输出" value={selectedGroup.outputAssets.filter((item) => item.isFavorite).length} />
                      </div>
                    </section>
                    <section className="rounded-[12px] border border-zinc-200 bg-zinc-50 p-4">
                      <h4 className="text-sm font-semibold text-zinc-950">顾客与任务</h4>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <DetailField label="顾客邮箱" value={customer?.email ?? asset.customerId} />
                        <DetailField label="顾客名称" value={customer?.name ?? "未命名顾客"} />
                        <DetailField label="任务 ID" mono value={taskId} />
                        <DetailField label="任务更新时间" value={selectedGroup.job ? formatDate(selectedGroup.job.updatedAt) : "未关联"} />
                        <DetailField label="模型" value={model ? `${model.label} / ${model.status}` : "未关联"} />
                        <DetailField label="模型 ID" mono value={asset.customerModelId ?? "未关联"} />
                      </div>
                    </section>
                  </div>
                  {selectedGroup.job?.error ? (
                    <div className="flex gap-3 rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                      <FileWarning className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                      <span>{selectedGroup.job.error}</span>
                    </div>
                  ) : null}
                  <div className={`rounded-[10px] border px-4 py-3 text-sm leading-6 ${assetRoleTone(asset.role)}`}>
                    {assetRoleHint(asset)}
                  </div>
                  <section className="rounded-[12px] border border-zinc-200 bg-white p-4">
                    <h4 className="text-sm font-semibold text-zinc-950">资产定位</h4>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <DetailField label="记录 ID" mono value={selectedGroup.id} />
                      <DetailField label="主素材 ID" mono value={asset.id} />
                      <DetailField label="创建时间" value={formatDate(asset.createdAt)} />
                      <DetailField label="主素材文件" mono value={assetFileName(asset)} />
                    </div>
                    <details className="mt-4 text-xs text-zinc-500">
                      <summary className="cursor-pointer select-none font-medium text-zinc-700">查看主素材完整存储路径</summary>
                      <p className="mt-2 break-all rounded-[8px] bg-zinc-50 p-3 font-mono leading-5 text-zinc-700">{asset.storageKey}</p>
                    </details>
                  </section>
                  <GroupAssetSection assets={selectedGroup.sourceAssets} emptyText="当前记录未关联源素材。" title="源素材 / 客户上传" />
                  <GroupAssetSection assets={selectedGroup.outputAssets} emptyText={selectedGroup.job ? `${jobStatusLabel(selectedGroup.job.status)}，暂无生成结果。` : "当前记录暂无生成结果。"} title="生成结果 / AI 输出" />
                  <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 pt-4">
                    {selectedGroup.outputAssets.map((outputAsset) => (
                      <button
                        className="rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 disabled:opacity-50"
                        disabled={favoritingAssetId === outputAsset.id}
                        key={outputAsset.id}
                        onClick={() => toggleFavoriteAsset(outputAsset)}
                        type="button"
                      >
                        {outputAsset.isFavorite ? "取消收藏" : "收藏输出结果"}
                      </button>
                    ))}
                    <button
                      className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 disabled:opacity-50"
                      disabled={reviewingAssetId === asset.id || asset.reviewStatus === "approved"}
                      onClick={() => reviewAsset(asset, "approved")}
                      type="button"
                    >
                      标记通过
                    </button>
                    <button
                      className="rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 disabled:opacity-50"
                      disabled={reviewingAssetId === asset.id || asset.reviewStatus === "rejected"}
                      onClick={() => reviewAsset(asset, "rejected")}
                      type="button"
                    >
                      标记拒绝
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}
    </div>
  );
}
