"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, EyeOff, Save } from "lucide-react";
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

export function AlbumDeliveryPanel({
  siteId,
  albums,
  customers,
  packs,
  assets
}: {
  siteId: string;
  albums: Album[];
  customers: PublicCustomer[];
  packs: CreativePack[];
  assets: AssetUpload[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(albums);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Album["status"] | "">("");
  const [busyAlbumId, setBusyAlbumId] = useState<string | null>(null);
  const [message, setMessage] = useState("用于管理客户专属相册交付。相册关联生成任务、输出素材和封面图，只有当前站点和对应顾客可以查看。");

  useEffect(() => {
    setItems(albums);
  }, [albums]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((album) => {
      if (statusFilter && album.status !== statusFilter) return false;
      if (!normalized) return true;
      const customer = customers.find((item) => item.id === album.customerId);
      const pack = packs.find((item) => item.id === album.creativePackId);
      return [album.title, album.sourceJobId ?? "", customer?.email ?? "", pack?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [customers, items, packs, query, statusFilter]);

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
    setQuery("");
    setStatusFilter("");
  }

  function exportAlbums() {
    downloadCsv(
      `${siteId}-albums.csv`,
      filteredItems.map((album) => {
        const customer = customers.find((item) => item.id === album.customerId);
        const pack = packs.find((item) => item.id === album.creativePackId);
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
    setMessage(`已导出 ${filteredItems.length} 条相册记录。`);
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
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5">共 {items.length} 个相册</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">{items.filter((album) => album.status === "ready").length} 已就绪</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">{items.filter((album) => album.status === "processing").length} 处理中</span>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5">{filteredItems.length} 当前显示</span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索相册、顾客、套餐、任务"
            value={query}
          />
          <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setStatusFilter(event.target.value as Album["status"] | "")} value={statusFilter}>
            <option value="">全部状态</option>
            <option value="processing">处理中</option>
            <option value="ready">已就绪</option>
            <option value="hidden">已隐藏</option>
          </select>
          <button className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm active:scale-[0.98]" onClick={resetFilters} type="button">
            重置
          </button>
        </div>
      </div>
      <div className="mt-5 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {filteredItems.map((album) => {
          const customer = customers.find((item) => item.id === album.customerId);
          const pack = packs.find((item) => item.id === album.creativePackId);
          const coverCandidates = assets.filter((asset) => asset.customerId === album.customerId && asset.role === "output");
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
                        {asset.label} / {asset.storageKey}
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
        {!filteredItems.length ? (
          <div className="p-6 text-sm text-zinc-600">
            <p className="font-semibold text-zinc-900">暂无匹配的相册。</p>
            <p className="mt-2 leading-6">操作手册：AI 任务成功后会生成输出素材和相册记录；运维需要确认标题、输出数量、封面素材和交付状态。客户可见的相册应标记为“已就绪”，问题相册可先“隐藏”，避免客户前台看到未验收内容。</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
