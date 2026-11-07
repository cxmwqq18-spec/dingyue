"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, EyeOff, FileWarning, ImageOff, PlayCircle, Trash2, X } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import { downloadCsv } from "@/components/admin/export-utils";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";
import type { Album, AssetUpload, CustomerModel, PublicCustomer } from "@/lib/types";
import type { JobStatus } from "@/lib/types";
import { StatusPill } from "@/components/ui";

type Tone = "good" | "warn" | "bad" | "neutral";

type WallAsset = AssetUpload & {
  previewUrl?: string;
  downloadUrl?: string;
  sourceAssetIds?: string[];
};

type WallAssetJob = {
  id: string;
  customerId: string;
  status: JobStatus;
  sourceAssetIds: string[];
  outputStorageKeys: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type AlbumDeliveryPayload = {
  albums?: Album[];
  albumPagination?: {
    totalPages: number;
  };
  error?: string;
};

type DeleteCustomerAssetResult = {
  ok?: boolean;
  deletedJobIds?: string[];
  deletedAssetIds?: string[];
  error?: string;
};

type ReviewCustomerAssetResult = {
  asset?: { reviewStatus?: AssetUpload["reviewStatus"] };
  error?: string;
};

type AlbumPersistResult = {
  album?: Album;
  error?: string;
};

/** 交付状态：从生成任务 + 相册记录推导（前台已无相册概念，这里只作为交付开关的数据载体） */
type WallDelivery = "ready" | "processing" | "hidden" | "failed";

const deliveryMeta: Record<WallDelivery, { label: string; badge: string }> = {
  ready: { label: "已就绪", badge: "" },
  processing: { label: "处理中", badge: "border-amber-200 bg-amber-50 text-amber-700" },
  hidden: { label: "已隐藏", badge: "border-zinc-200 bg-zinc-100 text-zinc-600" },
  failed: { label: "生成失败", badge: "border-rose-200 bg-rose-50 text-rose-700" }
};

const reviewMeta: Record<AssetUpload["reviewStatus"], { label: string; tone: Tone }> = {
  approved: { label: "已通过", tone: "good" },
  pending: { label: "待审核", tone: "warn" },
  rejected: { label: "已拒绝", tone: "bad" }
};

function isVideoAsset(asset: Pick<AssetUpload, "mimeType">): boolean {
  return asset.mimeType.startsWith("video/");
}

function assetRoleLabel(asset: Pick<AssetUpload, "role" | "mimeType">): string {
  if (asset.role === "output") return isVideoAsset(asset) ? "AI 输出视频" : "AI 输出图";
  if (asset.role === "training_input") return "训练图";
  return isVideoAsset(asset) ? "客户上传视频" : "客户上传源图";
}

function assetRoleBadge(asset: Pick<AssetUpload, "role" | "mimeType">): string {
  if (asset.role === "output") return isVideoAsset(asset) ? "" : "border-sky-200 bg-sky-50 text-sky-700";
  if (asset.role === "training_input") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function localAssetUrl(storageKeyValue: string, search = ""): string {
  const storageKey = storageKeyValue.replace(/^customer-assets\//, "").replace(/^\/+/, "");
  if (!storageKey || storageKey.includes("..") || storageKey.includes("\\")) return "";
  const encodedPath = storageKey.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `/api/local-assets/${encodedPath}${search}`;
}

function assetPreviewUrl(asset: WallAsset): string {
  return asset.previewUrl || localAssetUrl(asset.storageKey);
}

function assetPosterUrl(asset: WallAsset): string {
  return localAssetUrl(asset.storageKey, "?poster=1");
}

function shortId(value: string | undefined): string {
  if (!value) return "未关联";
  return value.length > 24 ? `${value.slice(0, 14)}...${value.slice(-6)}` : value;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function isVideoJob(job: WallAssetJob | undefined): boolean {
  return job?.status === "queued" || job?.status === "running";
}

function isFailedJob(job: WallAssetJob | undefined): boolean {
  return job?.status === "failed" || job?.status === "refunded";
}

function buildAlbumIndexes(albums: Album[]) {
  const byJob = new Map<string, Album>();
  const byCover = new Map<string, Album>();
  for (const album of albums) {
    if (album.sourceJobId && !byJob.has(album.sourceJobId)) byJob.set(album.sourceJobId, album);
    if (album.coverAssetId && !byCover.has(album.coverAssetId)) byCover.set(album.coverAssetId, album);
  }
  return { byJob, byCover };
}

function albumForOutput(albums: Album[], asset: WallAsset): Album | undefined {
  const { byJob, byCover } = buildAlbumIndexes(albums);
  if (asset.jobId && byJob.has(asset.jobId)) return byJob.get(asset.jobId);
  if (byCover.has(asset.id)) return byCover.get(asset.id);
  return undefined;
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // 走降级路径
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function ThumbFallback({ video = false }: { video?: boolean }) {
  const Icon = video ? PlayCircle : ImageOff;
  return (
    <span className={`flex h-full w-full items-center justify-center ${video ? "bg-gradient-to-br from-[#2c3546] to-[#151b28] text-white/80" : "bg-gradient-to-br from-[#f8f9fb] to-[#eef0f4] text-[#98a2b3]"}`}>
      <Icon className="h-6 w-6" strokeWidth={1.6} />
    </span>
  );
}

function WallThumb({ asset }: { asset: WallAsset }) {
  const previewUrl = assetPreviewUrl(asset);
  const posterUrl = isVideoAsset(asset) ? assetPosterUrl(asset) : "";
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [asset.id, previewUrl, posterUrl]);
  const src = isVideoAsset(asset) ? posterUrl : previewUrl;
  return (
    <span className="absolute inset-0">
      {src && !failed ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={`${assetRoleLabel(asset)}预览`} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} src={src} />
          {isVideoAsset(asset) ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white">
                <PlayCircle className="h-5 w-5" strokeWidth={1.8} />
              </span>
            </span>
          ) : null}
        </>
      ) : (
        <ThumbFallback video={isVideoAsset(asset)} />
      )}
    </span>
  );
}

function LightboxField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className={`mt-0.5 break-words text-[13px] text-zinc-800 ${mono ? "break-all font-mono" : "font-medium"}`} title={value}>{value}</p>
    </div>
  );
}

export function CustomerAssetWallPanel({
  siteId,
  assets,
  assetJobs = [],
  customers,
  models = []
}: {
  siteId: string;
  assets: WallAsset[];
  assetJobs?: WallAssetJob[];
  customers: PublicCustomer[];
  models?: CustomerModel[];
}) {
  const [items, setItems] = useState(assets);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumsLoaded, setAlbumsLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "output" | "upload">("all");
  const [shown, setShown] = useState(20);
  const [message, setMessage] = useState("AI 成品与客户上传素材统一展示；点开素材完成交付开关或审核操作。");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setItems(assets);
  }, [assets]);

  useEffect(() => {
    let active = true;
    (async () => {
      const albumUrl = (page: number) =>
        `/api/sites/${siteId}/admin/customers-page?detail=delivery&albumPage=${page}&albumPageSize=300`;
      try {
        const first = await fetchAdminJson<AlbumDeliveryPayload>(albumUrl(1), { ttlMs: 0, timeoutMs: 15_000 });
        if (!active) return;
        if (!first.ok) throw new Error(first.data.error ?? "albums_load_failed");
        let collected = first.data.albums ?? [];
        const seen = new Set(collected.map((album) => album.id));
        const totalPages = Math.min(first.data.albumPagination?.totalPages ?? 1, 12);
        if (totalPages > 1) {
          const rest = await Promise.allSettled(
            Array.from({ length: totalPages - 1 }, (_, index) =>
              fetchAdminJson<AlbumDeliveryPayload>(albumUrl(index + 2), { ttlMs: 0, timeoutMs: 15_000 })
            )
          );
          for (const result of rest) {
            if (result.status !== "fulfilled" || !result.value.ok) continue;
            for (const album of result.value.data.albums ?? []) {
              if (seen.has(album.id)) continue;
              seen.add(album.id);
              collected = collected.concat(album);
            }
          }
        }
        if (!active) return;
        setAlbums(collected);
        setAlbumsLoaded(true);
      } catch (error) {
        if (!active) return;
        setAlbumsLoaded(true);
        setMessage(error instanceof Error ? `相册交付状态加载失败：${error.message}` : "相册交付状态加载失败。");
      }
    })();
    return () => {
      active = false;
    };
  }, [siteId]);

  const customerById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const modelById = useMemo(() => new Map(models.map((model) => [model.id, model])), [models]);
  const jobById = useMemo(() => {
    const map = new Map<string, WallAssetJob>();
    for (const job of assetJobs) if (!map.has(job.id)) map.set(job.id, job);
    return map;
  }, [assetJobs]);

  const deliveryOf = useMemo(() => {
    const { byJob, byCover } = buildAlbumIndexes(albums);
    return (asset: WallAsset): WallDelivery | null => {
      if (asset.role !== "output") return null;
      const job = asset.jobId ? jobById.get(asset.jobId) : undefined;
      if (isVideoJob(job)) return "processing";
      if (isFailedJob(job)) return "failed";
      const album = (asset.jobId ? byJob.get(asset.jobId) : undefined) ?? byCover.get(asset.id);
      if (album?.status === "hidden") return "hidden";
      return "ready";
    };
  }, [albums, jobById]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((asset) => {
      if (tab === "output" && asset.role !== "output") return false;
      if (tab === "upload" && asset.role === "output") return false;
      if (!normalized) return true;
      const customer = customerById.get(asset.customerId);
      const model = asset.customerModelId ? modelById.get(asset.customerModelId) : undefined;
      return [asset.label, asset.id, asset.storageKey, customer?.email ?? "", customer?.name ?? "", model?.label ?? "", asset.jobId ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [customerById, items, modelById, query, tab]);

  const visible = filtered.slice(0, shown);
  const selected = selectedId ? items.find((item) => item.id === selectedId) : undefined;
  const outputCount = items.filter((item) => item.role === "output").length;

  useEffect(() => setShown(20), [query, tab]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  function exportCsv() {
    downloadCsv(
      `${siteId}-customer-assets.csv`,
      filtered.map((asset) => {
        const customer = customerById.get(asset.customerId);
        const delivery = deliveryOf(asset);
        return {
          素材ID: asset.id,
          类型: assetRoleLabel(asset),
          顾客邮箱: customer?.email ?? asset.customerId,
          顾客名称: customer?.name ?? "",
          名称: asset.label,
          审核状态: reviewMeta[asset.reviewStatus].label,
          交付状态: delivery ? deliveryMeta[delivery].label : "",
          任务ID: asset.jobId ?? "",
          创建时间: asset.createdAt
        };
      }),
      ["素材ID", "类型", "顾客邮箱", "顾客名称", "名称", "审核状态", "交付状态", "任务ID", "创建时间"]
    );
    setMessage(`已导出 ${filtered.length} 条素材记录。`);
  }

  async function reviewAsset(asset: WallAsset, reviewStatus: AssetUpload["reviewStatus"]) {
    setBusyId(asset.id);
    setMessage(`正在将 ${asset.label} 标记为${reviewMeta[reviewStatus].label}...`);
    try {
      const response = await fetch(`/api/sites/${siteId}/customers/${asset.customerId}/assets/${asset.id}/review`, {
        method: "POST",
        headers: siteAdminJsonHeaders(siteId),
        body: JSON.stringify({ reviewStatus })
      });
      const result = (await response.json().catch(() => ({}))) as ReviewCustomerAssetResult;
      if (!response.ok || !result.asset?.reviewStatus) {
        throw new Error(result.error || "asset_review_failed");
      }
      const nextStatus = result.asset.reviewStatus!;
      setItems((current) => current.map((item) => (item.id === asset.id ? { ...item, reviewStatus: nextStatus } : item)));
      setMessage(`${asset.label} 已标记为${reviewMeta[nextStatus].label}。`);
    } catch (error) {
      setMessage(error instanceof Error ? `审核失败：${error.message}` : "审核失败，请稍后重试。");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDelivery(asset: WallAsset, next: "ready" | "hidden") {
    const album = albumForOutput(albums, asset);
    if (!album) {
      setMessage("该素材未关联相册交付记录，暂不支持在此切换交付状态。");
      return;
    }
    setBusyId(asset.id);
    setMessage(`正在${next === "hidden" ? "隐藏" : "恢复"} ${asset.label}...`);
    try {
      const response = await fetch(`/api/sites/${siteId}/albums/${album.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: album.title,
          status: next,
          outputCount: album.outputCount,
          coverAssetId: album.coverAssetId ?? ""
        })
      });
      const result = (await response.json().catch(() => ({}))) as AlbumPersistResult;
      if (!response.ok || !result.album) {
        throw new Error(result.error || "album_status_update_failed");
      }
      const updated = result.album;
      setAlbums((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage(next === "hidden" ? `${asset.label} 已隐藏，顾客前台不可见。` : `${asset.label} 已就绪，顾客前台已更新。`);
    } catch (error) {
      setMessage(error instanceof Error ? `交付状态更新失败：${error.message}` : "交付状态更新失败，请稍后重试。");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteAsset(asset: WallAsset) {
    const isOutput = asset.role === "output";
    const confirmed = window.confirm(
      isOutput
        ? `确定删除这个 AI 输出结果吗？如果它被相册封面引用，相册会被隐藏并取消封面。素材 ID：${asset.id}`
        : `确定删除这张客户源图/训练图吗？素材 ID：${asset.id}`
    );
    if (!confirmed) return;
    setBusyId(asset.id);
    setMessage("正在删除素材...");
    try {
      const response = await fetchAdminJson<DeleteCustomerAssetResult>(`/api/sites/${siteId}/admin/customer-assets`, {
        init: {
          method: "DELETE",
          headers: siteAdminJsonHeaders(siteId),
          body: JSON.stringify({
            mode: isOutput ? "output" : "asset",
            customerId: asset.customerId,
            assetId: asset.id
          })
        },
        timeoutMs: 20_000
      });
      if (!response.ok || !response.data.ok) {
        throw new Error(response.data.error || "customer_resource_delete_failed");
      }
      const removedAssets = new Set(response.data.deletedAssetIds ?? [asset.id]);
      setItems((current) => current.filter((item) => !removedAssets.has(item.id)));
      if (selectedId && removedAssets.has(selectedId)) setSelectedId(null);
      setMessage(`已删除素材 ${asset.label}。`);
    } catch (error) {
      setMessage(error instanceof Error ? `删除失败：${error.message}` : "删除失败，请稍后重试。");
    } finally {
      setBusyId(null);
    }
  }

  function tileBadge(asset: WallAsset): { label: string; className: string } | null {
    const delivery = deliveryOf(asset);
    if (delivery === "processing") return { label: "处理中", className: "border-amber-200 bg-amber-50 text-amber-700" };
    if (delivery === "failed") return { label: "生成失败", className: "border-rose-200 bg-rose-50 text-rose-700" };
    if (delivery === "hidden") return { label: "已隐藏", className: "border-zinc-200 bg-zinc-100 text-zinc-600" };
    if (asset.reviewStatus === "pending") return { label: "待审核", className: "border-amber-200 bg-amber-50 text-amber-700" };
    return null;
  }

  function tileSub(asset: WallAsset): string {
    const customer = customerById.get(asset.customerId);
    const bits = [customer?.name ?? customer?.email ?? "未知顾客", formatDate(asset.createdAt).replace(/^\d{4}\//, "")];
    if (asset.role === "output") {
      const delivery = deliveryOf(asset);
      bits.push(delivery ? deliveryMeta[delivery].label : "已就绪");
    } else {
      bits.push(reviewMeta[asset.reviewStatus].label);
    }
    return bits.join(" · ");
  }

  const tileClass = (asset: WallAsset): string => {
    const delivery = deliveryOf(asset);
    if (asset.role === "output" && delivery !== "processing" && delivery !== "failed" && isVideoAsset(asset)) return "";
    if (asset.role === "output" && delivery === "processing") return "border-[1.5px] border-dashed border-[#d5dbe4] bg-white";
    if (asset.role === "output" && delivery === "failed") return "bg-gradient-to-br from-[#3a3f4d] to-[#22262f]";
    if (asset.role === "output") return "";
    return "";
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["all", `全部 ${items.length}`],
            ["output", `AI 成品 ${outputCount}`],
            ["upload", `客户上传 ${items.length - outputCount}`]
          ] as const).map(([value, label]) => (
            <button
              className={`rounded-[9px] px-3.5 py-1.5 text-[13px] font-medium transition ${tab === value ? "bg-sky-50 text-sky-700" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"}`}
              key={value}
              onClick={() => setTab(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <input
            className="w-full max-w-[280px] rounded-[9px] border border-black/10 bg-white px-3 py-1.5 text-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索顾客、任务 ID、素材 ID"
            value={query}
          />
          <button className="admin_btn inline-flex h-[32px] items-center gap-1.5 whitespace-nowrap" onClick={exportCsv} type="button">
            <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
            导出 CSV
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-zinc-400">{message}{albumsLoaded ? "" : " · 正在加载交付状态..."}</p>

      {visible.length ? (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(228px,1fr))] gap-x-[18px] gap-y-5">
          {visible.map((asset) => {
            const delivery = deliveryOf(asset);
            const badge = tileBadge(asset);
            const isProcessing = delivery === "processing";
            return (
              <figure
                className={`cursor-pointer ${delivery === "hidden" ? "opacity-70" : ""}`}
                key={asset.id}
                onClick={() => setSelectedId(asset.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter") setSelectedId(asset.id);
                }}
              >
                <div className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-[12px] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(16,24,40,0.16)] ${tileClass(asset)}`}>
                  {isProcessing ? (
                    <span className="flex flex-col items-center gap-2 text-zinc-400">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-[1.5px] border-[#c3d4f8] border-t-sky-600" />
                      <span className="text-[11px] font-medium">生成中</span>
                    </span>
                  ) : delivery === "failed" ? (
                    <span className="flex flex-col items-center gap-1 text-white/85">
                      <FileWarning className="h-5 w-5" strokeWidth={1.6} />
                      <span className="text-[11px] font-medium">生成失败</span>
                    </span>
                  ) : (
                    <WallThumb asset={asset} />
                  )}
                  {badge ? (
                    <span className={`absolute right-2 top-2 inline-flex items-center whitespace-nowrap rounded-[6px] px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  ) : null}
                  {asset.role !== "output" || delivery === "hidden" ? (
                    <span className={`absolute left-2 top-2 inline-flex items-center whitespace-nowrap rounded-[6px] px-1.5 py-0.5 text-[10px] font-semibold ${assetRoleBadge(asset) || "border border-white/25 bg-white/25 text-white"}`}>
                      {asset.role === "output" ? "已隐藏" : assetRoleLabel(asset)}
                    </span>
                  ) : null}
                </div>
                <figcaption className="px-0.5 pt-2">
                  <p className="truncate text-[13px] font-semibold text-zinc-900" title={asset.label}>{asset.label}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-zinc-500">{tileSub(asset)}</p>
                </figcaption>
              </figure>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-[12px] border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
          当前筛选下没有素材。客户上传素材或任务生成结果后会出现在这里。
        </div>
      )}
      {shown < filtered.length ? (
        <div className="mt-5 text-center">
          <button className="admin_btn inline-flex h-[34px] items-center" onClick={() => setShown((current) => current + 20)} type="button">
            加载更多
          </button>
          <span className="ml-3 text-xs text-zinc-400">已显示 {Math.min(shown, filtered.length)} / {filtered.length} 条</span>
        </div>
      ) : (
        <div className="mt-5 text-center text-xs text-zinc-400">已显示全部 {filtered.length} 条</div>
      )}

      {selected ? (() => {
        const customer = customerById.get(selected.customerId);
        const model = selected.customerModelId ? modelById.get(selected.customerModelId) : undefined;
        const delivery = deliveryOf(selected);
        const isOutput = selected.role === "output";
        const album = isOutput ? albumForOutput(albums, selected) : undefined;
        const job = selected.jobId ? jobById.get(selected.jobId) : undefined;
        const previewUrl = assetPreviewUrl(selected);
        const posterUrl = isVideoAsset(selected) ? assetPosterUrl(selected) : "";
        return (
          <div aria-label="素材详情" aria-modal="true" className="fixed inset-0 z-[1300] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-[2px]" onClick={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }} role="dialog">
            <div className="flex max-h-[92dvh] w-full max-w-[880px] overflow-hidden rounded-[16px] bg-white shadow-2xl">
              <div className="relative hidden min-h-[340px] flex-[1.4] items-center justify-center bg-[#0b1120] sm:flex">
                {previewUrl && isVideoAsset(selected) ? (
                  <video className="max-h-[62dvh] w-full bg-black object-contain" controls poster={posterUrl || undefined} preload="metadata" src={previewUrl} />
                ) : previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={selected.label} className="max-h-[62dvh] w-full object-contain" src={previewUrl} />
                ) : (
                  <ThumbFallback video={isVideoAsset(selected)} />
                )}
              </div>
              <div className="flex min-w-[290px] flex-1 flex-col gap-3 overflow-y-auto p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words pr-2 text-[15.5px] font-bold leading-6 text-zinc-950">{selected.label}</h3>
                  <button aria-label="关闭" className="shrink-0 rounded-[8px] p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" onClick={() => setSelectedId(null)} type="button">
                    <X className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
                <p className="text-[12.5px] text-zinc-500">{customer?.name ?? "未命名顾客"} · {customer?.email ?? selected.customerId}</p>
                {isOutput ? (
                  <p className="flex items-center gap-1.5 font-mono text-[10.5px] text-zinc-400">
                    任务 {shortId(selected.jobId)}
                    {selected.jobId ? (
                      <button
                        aria-label="复制任务 ID"
                        className="rounded p-0.5 hover:text-sky-600"
                        onClick={async (event) => {
                          event.stopPropagation();
                          const ok = await copyText(selected.jobId!);
                          setMessage(ok ? `已复制任务 ID ${selected.jobId}` : "复制失败，请手动复制。");
                        }}
                        type="button"
                      >
                        <Copy className="h-3 w-3" strokeWidth={1.8} />
                      </button>
                    ) : null}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-zinc-100 pt-3">
                  <LightboxField label="素材 ID" mono value={shortId(selected.id)} />
                  <LightboxField label="文件类型" value={selected.mimeType} />
                  <LightboxField label="创建时间" value={formatDate(selected.createdAt)} />
                  <LightboxField label="模型" value={model ? `${model.label} / ${model.status}` : "未关联"} />
                </div>
                <div className="border-t border-zinc-100 pt-3">
                  {isOutput ? (
                    delivery === "processing" ? (
                      <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12.5px] leading-5 text-amber-700">
                        生成进行中，完成后自动对顾客可见；如长时间无进展请到任务进程排查。
                      </div>
                    ) : delivery === "failed" ? (
                      <div className="rounded-[10px] border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12.5px] leading-5 text-rose-700">
                        <p className="flex items-start gap-2">
                          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                          <span>生成失败{job?.error ? `：${job.error}` : ""}。学分已按策略处理，可调整后重新发起。</span>
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="mb-1.5 text-[11.5px] font-semibold text-zinc-500">
                          交付状态 <span className="font-normal text-zinc-400">· 切换即时生效，顾客前台实时更新</span>
                        </p>
                        <div className="flex rounded-[9px] bg-zinc-100 p-0.5">
                          {(["ready", "hidden"] as const).map((next) => (
                            <button
                              className={`flex-1 rounded-[7px] px-2 py-1.5 text-[12px] ${delivery === next ? "bg-white font-semibold shadow-sm" : "text-zinc-500"} ${next === "ready" && delivery === next ? "text-emerald-700" : ""} ${next === "hidden" && delivery === next ? "text-zinc-700" : ""}`}
                              disabled={busyId === selected.id || !album}
                              key={next}
                              onClick={() => void toggleDelivery(selected, next)}
                              type="button"
                            >
                              {next === "ready" ? "已就绪" : "已隐藏"}
                            </button>
                          ))}
                        </div>
                        {!album ? <p className="mt-1.5 text-[11px] text-zinc-400">该素材未关联相册交付记录，暂不支持在此切换。</p> : null}
                      </div>
                    )
                  ) : (
                    <div>
                      <p className="mb-1.5 text-[11.5px] font-semibold text-zinc-500">审核状态</p>
                      <StatusPill label={reviewMeta[selected.reviewStatus].label} tone={reviewMeta[selected.reviewStatus].tone} />
                    </div>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 pt-3">
                  {isOutput && selected.previewUrl ? (
                    <a className="admin_btn inline-flex h-[30px] items-center" href={selected.previewUrl} rel="noreferrer" target="_blank">
                      打开原文件
                    </a>
                  ) : null}
                  {!isOutput && selected.reviewStatus !== "approved" ? (
                    <button
                      className="admin_btn inline-flex h-[30px] items-center gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 disabled:opacity-50"
                      disabled={busyId === selected.id}
                      onClick={() => void reviewAsset(selected, "approved")}
                      type="button"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={1.8} />
                      通过审核
                    </button>
                  ) : null}
                  {!isOutput && selected.reviewStatus !== "rejected" ? (
                    <button
                      className="admin_btn inline-flex h-[30px] items-center gap-1 border-rose-200 bg-rose-50 text-rose-700 disabled:opacity-50"
                      disabled={busyId === selected.id}
                      onClick={() => void reviewAsset(selected, "rejected")}
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.8} />
                      拒绝
                    </button>
                  ) : null}
                  {isOutput && delivery === "hidden" ? (
                    <button
                      className="admin_btn inline-flex h-[30px] items-center gap-1 disabled:opacity-50"
                      disabled={busyId === selected.id || !album}
                      onClick={() => void toggleDelivery(selected, "ready")}
                      type="button"
                    >
                      <EyeOff className="h-3.5 w-3.5" strokeWidth={1.8} />
                      恢复显示
                    </button>
                  ) : null}
                  <span className="flex-1" />
                  <button
                    className="admin_btn inline-flex h-[30px] items-center gap-1 border-rose-200 bg-rose-50 text-rose-700 disabled:opacity-50"
                    disabled={busyId === selected.id}
                    onClick={() => void deleteAsset(selected)}
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}
