"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, EyeOff, Save, Search } from "lucide-react";
import { fetchAdminJson, type CachedJsonResponse } from "@/components/admin/admin-api-client";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { downloadCsv } from "@/components/admin/export-utils";
import type { Album, AssetUpload, CreativePack, PublicCustomer } from "@/lib/types";
import { StatusPill } from "@/components/ui";

function tone(status: Album["status"]): "good" | "warn" | "neutral" {
  if (status === "ready") return "good";
  if (status === "hidden") return "neutral";
  return "warn";
}

const albumStatusLabels: Record<Album["status"], string> = {
  processing: "处理中",
  ready: "已就绪",
  hidden: "已隐藏"
};

function assetFileName(asset: Pick<AssetUpload, "storageKey" | "label">): string {
  return asset.storageKey.split("/").filter(Boolean).pop() || asset.label;
}

export type AlbumDeliveryPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  query: string;
  status: Album["status"] | "";
  totalCount: number;
  readyCount: number;
  processingCount: number;
  hiddenCount: number;
};

type AlbumDeliveryPayload = {
  albums?: Album[];
  albumCustomers?: PublicCustomer[];
  albumPagination?: AlbumDeliveryPagination;
  packs?: CreativePack[];
  customerAssets?: AssetUpload[];
  error?: string;
};

function fallbackPagination(albums: Album[]): AlbumDeliveryPagination {
  return {
    page: 1,
    pageSize: 20,
    total: albums.length,
    totalPages: Math.max(1, Math.ceil(albums.length / 20)),
    query: "",
    status: "",
    totalCount: albums.length,
    readyCount: albums.filter((album) => album.status === "ready").length,
    processingCount: albums.filter((album) => album.status === "processing").length,
    hiddenCount: albums.filter((album) => album.status === "hidden").length
  };
}

function mergeCustomers(...groups: PublicCustomer[][]): PublicCustomer[] {
  const byId = new Map<string, PublicCustomer>();
  for (const group of groups) {
    for (const customer of group) byId.set(customer.id, customer);
  }
  return [...byId.values()];
}

export function AlbumDeliveryPanel({
  siteId,
  albums,
  albumCustomers = [],
  pagination,
  customers,
  packs,
  assets
}: {
  siteId: string;
  albums: Album[];
  albumCustomers?: PublicCustomer[];
  pagination?: AlbumDeliveryPagination;
  customers: PublicCustomer[];
  packs: CreativePack[];
  assets: AssetUpload[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(albums);
  const [assetItems, setAssetItems] = useState(assets);
  const [packItems, setPackItems] = useState(packs);
  const [customerItems, setCustomerItems] = useState(() => mergeCustomers(customers, albumCustomers));
  const [pageMeta, setPageMeta] = useState<AlbumDeliveryPagination>(() => pagination ?? fallbackPagination(albums));
  const [query, setQuery] = useState(pagination?.query ?? "");
  const [draftQuery, setDraftQuery] = useState(pagination?.query ?? "");
  const [statusFilter, setStatusFilter] = useState<Album["status"] | "">(pagination?.status ?? "");
  const [loadingPage, setLoadingPage] = useState(false);
  const [busyAlbumId, setBusyAlbumId] = useState<string | null>(null);
  const [message, setMessage] = useState("用于管理 Album 相册交付记录。相册关联生成任务、输出素材和封面图，封面候选只来自当前顾客的 AI 输出素材。");

  useEffect(() => {
    setItems(albums);
    setPageMeta(pagination ?? fallbackPagination(albums));
    setQuery(pagination?.query ?? "");
    setDraftQuery(pagination?.query ?? "");
    setStatusFilter(pagination?.status ?? "");
  }, [albums, pagination]);

  useEffect(() => {
    setAssetItems(assets);
  }, [assets]);

  useEffect(() => {
    setPackItems(packs);
  }, [packs]);

  useEffect(() => {
    setCustomerItems(mergeCustomers(customers, albumCustomers));
  }, [albumCustomers, customers]);

  const customerById = useMemo(() => new Map(customerItems.map((customer) => [customer.id, customer])), [customerItems]);
  const packById = useMemo(() => new Map(packItems.map((pack) => [pack.id, pack])), [packItems]);

  async function loadAlbumPage(overrides: Partial<Pick<AlbumDeliveryPagination, "page" | "pageSize" | "query" | "status">> = {}) {
    const nextPage = overrides.page ?? pageMeta.page;
    const nextPageSize = overrides.pageSize ?? pageMeta.pageSize;
    const nextQuery = overrides.query ?? query;
    const nextStatus = overrides.status ?? statusFilter;
    const params = new URLSearchParams({
      detail: "delivery",
      albumPage: String(nextPage),
      albumPageSize: String(nextPageSize)
    });
    if (nextQuery.trim()) params.set("albumQuery", nextQuery.trim());
    if (nextStatus) params.set("albumStatus", nextStatus);
    setLoadingPage(true);
    let response: CachedJsonResponse<AlbumDeliveryPayload>;
    try {
      response = await fetchAdminJson<AlbumDeliveryPayload>(`/api/sites/${siteId}/admin/customers-page?${params.toString()}`, {
        ttlMs: 0,
        timeoutMs: 12_000
      });
    } catch {
      setLoadingPage(false);
      setMessage("相册分页加载中断，请稍后重试。");
      return;
    }
    setLoadingPage(false);
    if (!response.ok) {
      setMessage(response.data.error ?? "相册分页加载失败。");
      return;
    }
    const result = response.data;
    setItems(result.albums ?? []);
    setAssetItems(result.customerAssets ?? []);
    if (result.packs) setPackItems(result.packs);
    setCustomerItems((current) => mergeCustomers(customers, current, result.albumCustomers ?? []));
    if (result.albumPagination) {
      setPageMeta(result.albumPagination);
      setQuery(result.albumPagination.query);
      setDraftQuery(result.albumPagination.query);
      setStatusFilter(result.albumPagination.status);
    }
    setMessage(`已加载第 ${result.albumPagination?.page ?? nextPage} 页，共 ${result.albumPagination?.total ?? result.albums?.length ?? 0} 条匹配相册。`);
  }

  function update<K extends keyof Album>(albumId: string, key: K, value: Album[K]) {
    setItems((current) => current.map((album) => (album.id === albumId ? { ...album, [key]: value } : album)));
  }

  async function persist(album: Album, overrides?: Partial<Album>, actionLabel?: string) {
    setBusyAlbumId(album.id);
    const response = await fetch(`/api/sites/${siteId}/albums/${album.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: overrides?.title ?? album.title,
        status: overrides?.status ?? album.status,
        outputCount: overrides?.outputCount ?? album.outputCount,
        coverAssetId: overrides?.coverAssetId ?? album.coverAssetId ?? ""
      })
    });
    const result = (await response.json().catch(() => ({}))) as { album?: Album; error?: string };
    setBusyAlbumId(null);
    if (response.ok && result.album) {
      setItems((current) => current.map((item) => (item.id === result.album?.id ? result.album : item)));
      setMessage(actionLabel ? `${result.album.title} 已${actionLabel}。` : `${result.album.title} 已保存。`);
      void loadAlbumPage({ page: pageMeta.page });
      router.refresh();
    } else {
      setMessage(result.error ?? "相册保存失败。");
    }
  }

  function save(album: Album) {
    return persist(album);
  }

  function hide(album: Album) {
    return persist(album, { status: "hidden" }, "隐藏");
  }

  function resetFilters() {
    setDraftQuery("");
    void loadAlbumPage({ page: 1, query: "", status: "" });
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadAlbumPage({ page: 1, query: draftQuery.trim() });
  }

  function exportAlbums() {
    downloadCsv(
      `${siteId}-albums.csv`,
      items.map((album) => {
        const customer = customerById.get(album.customerId);
        const pack = album.creativePackId ? packById.get(album.creativePackId) : undefined;
        return {
          albumId: album.id,
          title: album.title,
          customerEmail: customer?.email ?? album.customerId,
          creativePack: pack?.name ?? "",
          status: album.status,
          outputCount: album.outputCount,
          coverAssetId: album.coverAssetId ?? "",
          sourceJobId: album.sourceJobId ?? "",
          updatedAt: album.updatedAt
        };
      }),
      ["albumId", "title", "customerEmail", "creativePack", "status", "outputCount", "coverAssetId", "sourceJobId", "updatedAt"]
    );
    setMessage(`已导出当前页 ${items.length} 条相册记录。`);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-clay">相册交付</p>
          <h2 className="mt-2 text-xl font-semibold">私有相册交付</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{message}</p>
        </div>
        <button className="rounded-full border border-black/10 px-4 py-2 text-sm active:scale-[0.98]" onClick={exportAlbums} type="button">
          <Download className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
          导出 CSV
        </button>
      </div>
      <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5">共 {pageMeta.totalCount} 个相册</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">{pageMeta.readyCount} 已就绪</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">{pageMeta.processingCount} 处理中</span>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5">{pageMeta.hiddenCount} 已隐藏</span>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5">匹配 {pageMeta.total} 条</span>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5">当前页 {items.length} 条</span>
        </div>
        <form className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_auto_auto]" onSubmit={submitSearch}>
          <input
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="搜索相册、顾客、套餐、任务"
            value={draftQuery}
          />
          <select
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            onChange={(event) => void loadAlbumPage({ page: 1, status: event.target.value as Album["status"] | "" })}
            value={statusFilter}
          >
            <option value="">全部状态</option>
            <option value="processing">处理中</option>
            <option value="ready">已就绪</option>
            <option value="hidden">已隐藏</option>
          </select>
          <button className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={loadingPage} type="submit">
            <Search className="mr-1.5 inline h-4 w-4" strokeWidth={1.8} />
            搜索
          </button>
          <button className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm active:scale-[0.98]" onClick={resetFilters} type="button">
            重置
          </button>
        </form>
      </div>
      <div className="mt-5 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {items.map((album) => {
          const customer = customerById.get(album.customerId);
          const pack = album.creativePackId ? packById.get(album.creativePackId) : undefined;
          const coverCandidates = assetItems.filter((asset) => asset.customerId === album.customerId && asset.role === "output");
          return (
            <div className="grid gap-4 p-4 text-sm" key={album.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span>
                  <span className="block font-semibold">{album.title}</span>
                  <span className="text-xs text-zinc-500">{customer?.email ?? album.customerId}</span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill label={albumStatusLabels[album.status]} tone={tone(album.status)} />
                  <button className="rounded-full border border-black/10 px-3 py-1.5 text-xs active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={busyAlbumId === album.id || album.status === "hidden"} onClick={() => hide(album)} type="button">
                    <EyeOff className="mr-1.5 inline h-3.5 w-3.5" strokeWidth={1.8} />
                    {busyAlbumId === album.id && album.status !== "hidden" ? "隐藏中" : "隐藏"}
                  </button>
                  <button className="rounded-full bg-zinc-950 px-3 py-1.5 text-xs text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={busyAlbumId === album.id} onClick={() => save(album)} type="button">
                    <Save className="mr-1.5 inline h-3.5 w-3.5" strokeWidth={1.8} />
                    {busyAlbumId === album.id ? "保存中" : "保存"}
                  </button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_0.42fr_0.58fr]">
                <label className="grid gap-1 text-xs text-zinc-500">
                  相册标题
                  <input className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-950" onChange={(event) => update(album.id, "title", event.target.value)} value={album.title} />
                </label>
                <label className="grid gap-1 text-xs text-zinc-500">
                  输出数量
                  <input className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-950" min={0} onChange={(event) => update(album.id, "outputCount", Number(event.target.value))} type="number" value={album.outputCount} />
                </label>
                <label className="grid gap-1 text-xs text-zinc-500">
                  交付状态
                  <select className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-950" onChange={(event) => update(album.id, "status", event.target.value as Album["status"])} value={album.status}>
                    <option value="processing">处理中</option>
                    <option value="ready">已就绪</option>
                    <option value="hidden">已隐藏</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-zinc-500 md:col-span-3">
                  封面素材
                  <select className="rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-xs text-zinc-950" onChange={(event) => update(album.id, "coverAssetId", event.target.value)} value={album.coverAssetId ?? ""}>
                    <option value="">未设置</option>
                    {coverCandidates.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.label} / {assetFileName(asset)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-2 text-xs text-zinc-500 sm:grid-cols-3">
                <span>
                  套餐：<span className="font-medium text-zinc-700">{pack?.name ?? "未关联"}</span>
                </span>
                <span>
                  任务：<span className="font-mono text-zinc-700">{album.sourceJobId ?? "手动创建"}</span>
                </span>
                <span>
                  更新时间：<span className="font-mono text-zinc-700">{new Date(album.updatedAt).toLocaleDateString("zh-CN")}</span>
                </span>
              </div>
            </div>
          );
        })}
        {!items.length ? (
          <div className="p-6 text-sm text-zinc-600">
            <p className="font-semibold text-zinc-900">暂无匹配的相册。</p>
            <p className="mt-2 leading-6">操作手册：AI 任务成功后会生成输出素材和相册记录；运维需要确认标题、输出数量、封面素材和交付状态。客户可见的相册应标记为“已就绪”，问题相册可先“隐藏”，避免客户前台看到未验收内容。</p>
          </div>
        ) : null}
      </div>
      <AdminPagination
        onPageChange={(nextPage: number | ((page: number) => number)) => void loadAlbumPage({ page: typeof nextPage === "function" ? nextPage(pageMeta.page) : nextPage })}
        onPageSizeChange={(nextPageSize) => void loadAlbumPage({ page: 1, pageSize: nextPageSize })}
        page={pageMeta.page}
        pageSize={pageMeta.pageSize}
        total={pageMeta.total}
      />
    </div>
  );
}
