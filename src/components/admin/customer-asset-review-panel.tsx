"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye } from "lucide-react";
import { AdminPagination, clampPage, pageItems } from "@/components/admin/admin-pagination";
import { downloadCsv } from "@/components/admin/export-utils";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import type { AssetUpload, CustomerModel, PublicCustomer } from "@/lib/types";
import { StatusPill } from "@/components/ui";

type Tone = "good" | "warn" | "bad" | "neutral";

function reviewStatusLabel(status: AssetUpload["reviewStatus"]) {
  return {
    approved: "已通过",
    pending: "待审核",
    rejected: "已拒绝"
  }[status];
}

function assetRoleLabel(role: AssetUpload["role"]) {
  return {
    input: "源图",
    training_input: "训练图",
    output: "输出图"
  }[role];
}

function reviewTone(status: AssetUpload["reviewStatus"]): Tone {
  if (status === "approved") return "good";
  if (status === "rejected") return "bad";
  return "warn";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export function CustomerAssetReviewPanel({
  siteId,
  assets,
  customers,
  models = []
}: {
  siteId: string;
  assets: AssetUpload[];
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

  const currentPage = clampPage(page, filteredItems.length, pageSize);
  const pagedItems = pageItems(filteredItems, currentPage, pageSize);
  const selectedAsset = selectedAssetId ? items.find((asset) => asset.id === selectedAssetId) : undefined;

  useEffect(() => setPage(1), [query, roleFilter, reviewFilter, pageSize]);
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [currentPage, page]);

  function exportAssets() {
    downloadCsv(
      `${siteId}-customer-assets.csv`,
      filteredItems.map((asset) => {
        const customer = customers.find((item) => item.id === asset.customerId);
        const model = asset.customerModelId ? models.find((item) => item.id === asset.customerModelId) : undefined;
        return {
          素材ID: asset.id,
          顾客邮箱: customer?.email ?? asset.customerId,
          素材名称: asset.label,
          类型: assetRoleLabel(asset.role),
          审核状态: reviewStatusLabel(asset.reviewStatus),
          模型: model?.label ?? "",
          主体角色: asset.subjectRole ?? "",
          文件类型: asset.mimeType,
          素材路径: asset.storageKey,
          创建时间: asset.createdAt
        };
      }),
      ["素材ID", "顾客邮箱", "素材名称", "类型", "审核状态", "模型", "主体角色", "文件类型", "素材路径", "创建时间"]
    );
    setMessage(`已导出 ${filteredItems.length} 条素材记录。`);
  }

  function resetFilters() {
    setQuery("");
    setRoleFilter("");
    setReviewFilter("");
  }

  async function reviewAsset(asset: AssetUpload, reviewStatus: AssetUpload["reviewStatus"]) {
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

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-clay">素材审核</p>
          <h2 className="mt-2 text-xl font-semibold">客户素材审核</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{message}</p>
        </div>
        <button className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[8px] border border-black/10 px-4 py-2 text-sm active:scale-[0.98]" onClick={exportAssets} type="button">
          <Download className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
          导出 CSV
        </button>
      </div>
      <div className="mt-5 rounded-[12px] border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-zinc-500">共 {items.length} 条</span>
          <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">{items.filter((asset) => asset.reviewStatus === "approved").length} 已通过</span>
          <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">{items.filter((asset) => asset.reviewStatus === "pending").length} 待审核</span>
          <span className="whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700">{items.filter((asset) => asset.reviewStatus === "rejected").length} 已拒绝</span>
          <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-zinc-500">{filteredItems.length} 当前显示</span>
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
          <table className="list min-w-[1040px]">
            <thead>
              <tr>
                <th className="bgtt aleft">素材</th>
                <th className="bgtt aleft">素材路径</th>
                <th className="bgtt">类型</th>
                <th className="bgtt aleft">顾客</th>
                <th className="bgtt">模型</th>
                <th className="bgtt">创建时间</th>
                <th className="bgtt">审核状态</th>
                <th className="bgtt">操作</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((asset) => {
                const customer = customers.find((item) => item.id === asset.customerId);
                const model = asset.customerModelId ? models.find((item) => item.id === asset.customerModelId) : undefined;
                return (
                  <tr key={asset.id}>
                    <td className="aleft">
                      <span className="block max-w-[180px] truncate font-medium text-zinc-950">{asset.label}</span>
                      <span className="font-mono text-[11px] text-zinc-400">{asset.id}</span>
                    </td>
                    <td className="aleft max-w-[260px] truncate font-mono text-[11px] text-zinc-500">{asset.storageKey}</td>
                    <td>{assetRoleLabel(asset.role)}</td>
                    <td className="aleft">
                      <span className="block max-w-[190px] truncate text-zinc-700">{customer?.email ?? asset.customerId}</span>
                      <span className="text-[11px] text-zinc-400">{customer?.name ?? "未命名顾客"}</span>
                    </td>
                    <td>{model?.label ?? "未关联"}</td>
                    <td className="font-mono text-[11px] text-zinc-500">{formatDate(asset.createdAt)}</td>
                    <td><StatusPill label={reviewStatusLabel(asset.reviewStatus)} tone={reviewTone(asset.reviewStatus)} /></td>
                    <td>
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
                          <Eye className="h-3.5 w-3.5" strokeWidth={1.8} />详情
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!filteredItems.length ? <tr><td className="text-center text-zinc-500" colSpan={8}>当前筛选下没有客户素材。</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
      <AdminPagination page={currentPage} pageSize={pageSize} total={filteredItems.length} onPageChange={setPage} onPageSizeChange={setPageSize} />

      {selectedAsset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[12px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <div>
                <p className="text-xs font-medium text-clay">素材详情</p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-950">{selectedAsset.label}</h3>
              </div>
              <button className="rounded-[8px] border border-black/10 px-3 py-1.5 text-sm" onClick={() => setSelectedAssetId(null)} type="button">关闭</button>
            </div>
            {(() => {
              const customer = customers.find((item) => item.id === selectedAsset.customerId);
              const model = selectedAsset.customerModelId ? models.find((item) => item.id === selectedAsset.customerModelId) : undefined;
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
                  <div className="grid gap-2 rounded-[10px] border border-zinc-200 bg-zinc-50 p-4 text-sm">
                    {detailRows.map(([label, value]) => (
                      <div className="grid gap-1 sm:grid-cols-[110px_minmax(0,1fr)]" key={label}>
                        <span className="text-zinc-500">{label}</span>
                        <span className="min-w-0 break-all font-mono text-zinc-800">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
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
