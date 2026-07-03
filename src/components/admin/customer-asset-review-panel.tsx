"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Trash2 } from "lucide-react";
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
type DeleteMode = "asset" | "output" | "job";

function reviewStatusLabel(status: AssetUpload["reviewStatus"]) {
  return {
    approved: "已通过",
    pending: "待审核",
    rejected: "已拒绝"
  }[status];
}

function assetRoleLabel(role: AssetUpload["role"]) {
  return {
    input: "客户上传源图",
    training_input: "训练图",
    output: "AI 输出图"
  }[role];
}

function assetRoleHint(role: AssetUpload["role"]) {
  if (role === "output") return "这是 AI 生成后的结果图，可用于相册交付。";
  if (role === "training_input") return "这是用于训练或参考的客户素材，不是最终生成结果。";
  return "这是客户上传给 AI 参考的原始图片，不是生成结果。生成结果请查看类型为“AI 输出图”的记录。";
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
  const storageKey = asset.storageKey.replace(/^customer-assets\//, "").replace(/^\/+/, "");
  if (!storageKey || storageKey.includes("..") || storageKey.includes("\\")) return "";
  return `/api/local-assets/${storageKey}`;
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

  for (const job of jobs) {
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
      id: output.jobId ? `job:${output.jobId}` : `output:${output.id}`,
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

function AssetMiniCard({ asset, onOpen }: { asset: ReviewAsset; onOpen: (assetId: string) => void }) {
  const previewUrl = assetPreviewUrl(asset);
  return (
    <button
      className="grid w-full grid-cols-[54px_minmax(0,1fr)] items-center gap-3 rounded-[10px] border border-zinc-200 bg-white p-2 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
      onClick={() => onOpen(asset.id)}
      type="button"
    >
      {previewUrl ? (
        <img alt={asset.label} className="h-[54px] w-[54px] rounded-[8px] border border-zinc-200 bg-zinc-100 object-cover" src={previewUrl} />
      ) : (
        <span className="flex h-[54px] w-[54px] items-center justify-center rounded-[8px] border border-dashed border-zinc-200 bg-zinc-50 text-[10px] text-zinc-400">无图</span>
      )}
      <span className="min-w-0">
        <span className={`mb-1 inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${assetRoleTone(asset.role)}`}>
          {assetRoleLabel(asset.role)}
        </span>
        <span className="block truncate text-sm font-medium text-zinc-950">{asset.label}</span>
        <span className="block truncate font-mono text-[11px] text-zinc-400">{asset.id}</span>
      </span>
    </button>
  );
}

function AssetThumbnailStrip({
  assets,
  onOpen
}: {
  assets: ReviewAsset[];
  onOpen: (assetId: string) => void;
}) {
  const visibleAssets = assets.slice(0, 10);
  const hiddenCount = Math.max(0, assets.length - visibleAssets.length);
  return (
    <div className="min-w-[640px] max-w-[900px]">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-zinc-700">共 {assets.length} 张 AI 输出图</span>
        {hiddenCount ? <span className="text-zinc-400">还有 {hiddenCount} 张</span> : null}
      </div>
      <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
        {visibleAssets.map((asset, index) => {
          const previewUrl = assetPreviewUrl(asset);
          return (
            <button
              className="group w-[92px] shrink-0 rounded-[10px] border border-zinc-200 bg-white p-1.5 text-left transition hover:border-sky-300 hover:bg-sky-50"
              key={asset.id}
              onClick={() => onOpen(asset.id)}
              title={`${asset.label} / ${asset.id}`}
              type="button"
            >
              {previewUrl ? (
                <img alt={asset.label} className="h-[72px] w-full rounded-[8px] border border-zinc-100 bg-zinc-100 object-cover" src={previewUrl} />
              ) : (
                <span className="flex h-[72px] w-full items-center justify-center rounded-[8px] border border-dashed border-zinc-200 bg-zinc-50 text-[10px] text-zinc-400">无图</span>
              )}
              <span className="mt-1 block truncate text-[11px] font-medium text-zinc-700">输出 {index + 1}</span>
            </button>
          );
        })}
      </div>
    </div>
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
  const [message, setMessage] = useState("源图、训练图和输出图进入任务队列前都需要在当前站点内完成审核。");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [reviewingAssetId, setReviewingAssetId] = useState<string | null>(null);
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
      if (!normalized) return true;
      const customer = customers.find((item) => item.id === asset.customerId);
      const model = asset.customerModelId ? models.find((item) => item.id === asset.customerModelId) : undefined;
      return [asset.label, asset.id, asset.storageKey, customer?.email ?? "", customer?.name ?? "", model?.label ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [customers, items, models, query, reviewFilter, roleFilter]);

  const visibleAssetJobs = useMemo(() => assetJobs.filter((job) => !deletedJobIds.has(job.id)), [assetJobs, deletedJobIds]);
  const groupedItems = useMemo(() => buildAssetGroups(filteredItems, items, visibleAssetJobs), [filteredItems, items, visibleAssetJobs]);
  const currentPage = clampPage(page, groupedItems.length, pageSize);
  const pagedGroups = pageItems(groupedItems, currentPage, pageSize);
  const selectedAsset = selectedAssetId ? items.find((asset) => asset.id === selectedAssetId) : undefined;

  useEffect(() => setPage(1), [query, roleFilter, reviewFilter, pageSize]);
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
          生成图: group.outputAssets.map((item) => item.label).join("；"),
          审核状态: reviewStatusLabel(asset.reviewStatus),
          模型: model?.label ?? "",
          任务ID: asset.jobId ?? "",
          任务状态: group.job ? jobStatusLabel(group.job.status) : "",
          失败原因: group.job?.error ?? "",
          创建时间: asset.createdAt
        };
      }),
      ["记录ID", "顾客邮箱", "源图", "生成图", "审核状态", "模型", "任务ID", "任务状态", "失败原因", "创建时间"]
    );
    setMessage(`已导出 ${groupedItems.length} 条素材记录。`);
  }

  function resetFilters() {
    setQuery("");
    setRoleFilter("");
    setReviewFilter("");
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
      return `确定删除这条生成任务吗？将同时清理该任务的输出图、相册记录、任务记录和相关额度流水；未被其他任务复用的源图也会删除。任务 ID：${group.job.id}`;
    }
    if (group.primaryAsset.role === "output") {
      return `确定删除这张 AI 输出图吗？如果它被相册封面引用，相册会被隐藏并取消封面。素材 ID：${group.primaryAsset.id}`;
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
      if (selectedAssetId && removedAssets.has(selectedAssetId)) setSelectedAssetId(null);
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
          <p className="mt-1 text-xs leading-5 text-zinc-500">用途说明：这里审核客户上传的源图、训练图和任务输出图，避免未授权或质量不合格的素材进入训练、生成和相册交付流程。</p>
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
            {items.filter((asset) => asset.role === "output").length} AI 输出图
          </button>
          <button className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700" onClick={() => setRoleFilter("input")} type="button">
            {items.filter((asset) => asset.role === "input").length} 客户上传源图
          </button>
          <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">{items.filter((asset) => asset.reviewStatus === "approved").length} 已通过</span>
          <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">{items.filter((asset) => asset.reviewStatus === "pending").length} 待审核</span>
          <span className="whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700">{items.filter((asset) => asset.reviewStatus === "rejected").length} 已拒绝</span>
          <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-zinc-500">{groupedItems.length} 当前显示</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_150px_170px_auto]">
          <input className="rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder="搜索素材、顾客、模型" value={query} />
          <select className="rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setRoleFilter(event.target.value as AssetUpload["role"] | "")} value={roleFilter}>
            <option value="">全部类型</option>
            <option value="input">源图</option>
            <option value="training_input">训练图</option>
            <option value="output">输出图</option>
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
          <table className="list min-w-[2050px] table-fixed">
            <colgroup>
              <col className="w-[360px]" />
              <col className="w-[760px]" />
              <col className="w-[240px]" />
              <col className="w-[120px]" />
              <col className="w-[260px]" />
              <col className="w-[210px]" />
              <col className="w-[130px]" />
              <col className="w-[320px]" />
            </colgroup>
            <thead>
              <tr>
                <th className="bgtt aleft">源图</th>
                <th className="bgtt aleft">AI 生成结果</th>
                <th className="bgtt aleft">顾客</th>
                <th className="bgtt">模型</th>
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
                const model = asset.customerModelId ? models.find((item) => item.id === asset.customerModelId) : undefined;
                return (
                  <tr key={group.id}>
                    <td className="aleft align-middle">
                      <div className="grid min-w-[240px] gap-2">
                        {group.sourceAssets.length ? group.sourceAssets.map((sourceAsset) => (
                          <AssetMiniCard asset={sourceAsset} key={sourceAsset.id} onOpen={setSelectedAssetId} />
                        )) : (
                          <span className="rounded-[10px] border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-sm text-zinc-400">未关联源图</span>
                        )}
                      </div>
                    </td>
                    <td className="aleft align-middle">
                      <div className="min-w-[640px]">
                        {group.outputAssets.length ? (
                          <AssetThumbnailStrip assets={group.outputAssets} onOpen={setSelectedAssetId} />
                        ) : (
                          <span className="rounded-[10px] border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-sm text-zinc-500">
                            <span className="block font-medium">{group.job ? `${jobStatusLabel(group.job.status)}，暂无输出图` : "暂无生成结果"}</span>
                            {group.job?.error ? (
                              <span className="mt-1 block line-clamp-2 text-xs text-rose-600" title={group.job.error}>{group.job.error}</span>
                            ) : null}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="aleft whitespace-nowrap align-middle">
                      <span className="block max-w-[220px] truncate text-zinc-700">{customer?.email ?? asset.customerId}</span>
                      <span className="text-[11px] text-zinc-400">{customer?.name ?? "未命名顾客"}</span>
                    </td>
                    <td className="whitespace-nowrap align-middle">{model?.label ?? "未关联"}</td>
                    <td className="whitespace-nowrap align-middle text-[11px] text-zinc-500">
                      {group.job ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`inline-flex w-fit rounded-full border px-2 py-0.5 font-medium ${jobStatusTone(group.job.status)}`}>{jobStatusLabel(group.job.status)}</span>
                          <span className="max-w-[180px] truncate font-mono" title={group.job.id}>{group.job.id}</span>
                        </span>
                      ) : (
                        <span className="block max-w-[220px] truncate font-mono" title={asset.jobId ?? "未关联"}>{asset.jobId ?? "未关联"}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap align-middle font-mono text-[11px] text-zinc-500">{formatDate(asset.createdAt)}</td>
                    <td className="whitespace-nowrap align-middle"><StatusPill label={reviewStatusLabel(asset.reviewStatus)} tone={reviewTone(asset.reviewStatus)} /></td>
                    <td className="whitespace-nowrap align-middle">
                      <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
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
                        <button className="admin_btn inline-flex h-[30px] items-center gap-1 whitespace-nowrap" onClick={() => setSelectedAssetId(asset.id)} type="button">
                          <Eye className="h-3.5 w-3.5" strokeWidth={1.8} />结果详情
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
                      <p className="mt-2 leading-6">操作手册：客户上传图片后会出现在这里。源图和训练图用于模型训练，输出图用于相册交付。运维需要查看素材详情，确认顾客、模型、文件类型和路径无误后点击“通过”；不合规素材点击“拒绝”，拒绝后不要进入训练或交付流程。</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <AdminPagination page={currentPage} pageSize={pageSize} total={groupedItems.length} onPageChange={setPage} onPageSizeChange={setPageSize} />

      {selectedAsset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[12px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <div>
                <p className="text-xs font-medium text-clay">{assetRoleLabel(selectedAsset.role)}</p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-950">{selectedAsset.label}</h3>
              </div>
              <button className="rounded-[8px] border border-black/10 px-3 py-1.5 text-sm" onClick={() => setSelectedAssetId(null)} type="button">关闭</button>
            </div>
            {(() => {
              const customer = customers.find((item) => item.id === selectedAsset.customerId);
              const model = selectedAsset.customerModelId ? models.find((item) => item.id === selectedAsset.customerModelId) : undefined;
              const previewUrl = assetPreviewUrl(selectedAsset);
              const detailRows = [
                ["素材路径", selectedAsset.storageKey],
                ["类型", assetRoleLabel(selectedAsset.role)],
                ["文件类型", selectedAsset.mimeType],
                ["顾客", customer ? `${customer.name} / ${customer.email}` : selectedAsset.customerId],
                ["模型", model ? `${model.label} / ${model.status}` : "未关联"],
                ["创建时间", formatDate(selectedAsset.createdAt)],
                ["审核状态", reviewStatusLabel(selectedAsset.reviewStatus)],
                ["主体角色", selectedAsset.subjectRole ?? "未设置"],
                ["任务 ID", selectedAsset.jobId ?? "未关联"],
                ["模型 ID", selectedAsset.customerModelId ?? "未关联"]
              ];
              return (
                <div className="grid gap-5 p-5">
                  <div className="overflow-hidden rounded-[12px] border border-zinc-200 bg-zinc-50">
                    {previewUrl ? (
                      <img alt={selectedAsset.label} className="max-h-[420px] w-full object-contain" src={previewUrl} />
                    ) : (
                      <div className="flex min-h-[220px] items-center justify-center text-sm text-zinc-500">当前素材没有可预览的图片文件。</div>
                    )}
                  </div>
                  <div className={`rounded-[10px] border px-4 py-3 text-sm leading-6 ${assetRoleTone(selectedAsset.role)}`}>
                    {assetRoleHint(selectedAsset.role)}
                  </div>
                  <div className="grid gap-2 rounded-[10px] border border-zinc-200 bg-zinc-50 p-4 text-sm">
                    {detailRows.map(([label, value]) => (
                      <div className="grid gap-1 sm:grid-cols-[110px_minmax(0,1fr)]" key={label}>
                        <span className="text-zinc-500">{label}</span>
                        <span className="min-w-0 break-all font-mono text-zinc-800">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {previewUrl ? (
                      <a
                        className="rounded-[8px] border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
                        href={previewUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        打开图片
                      </a>
                    ) : null}
                    <button
                      className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 disabled:opacity-50"
                      disabled={reviewingAssetId === selectedAsset.id || selectedAsset.reviewStatus === "approved"}
                      onClick={() => reviewAsset(selectedAsset, "approved")}
                      type="button"
                    >
                      标记通过
                    </button>
                    <button
                      className="rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 disabled:opacity-50"
                      disabled={reviewingAssetId === selectedAsset.id || selectedAsset.reviewStatus === "rejected"}
                      onClick={() => reviewAsset(selectedAsset, "rejected")}
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
