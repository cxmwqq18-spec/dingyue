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
  const [message, setMessage] = useState("Albums are customer-scoped delivery objects backed by private output assets.");

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
      setMessage(actionLabel ? `${result.album.title} ${actionLabel}.` : `${result.album.title} saved.`);
      router.refresh();
    } else {
      setMessage(result.error ?? "Album save failed.");
    }
  }

  function save(album: Album) {
    return persist(album);
  }

  function hide(album: Album) {
    return persist(album, { status: "hidden" }, "hidden");
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
    setMessage(`Exported ${filteredItems.length} albums.`);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-clay">album delivery</p>
          <h2 className="mt-2 text-2xl font-semibold">Private album handoff</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{message}</p>
        </div>
        <button className="rounded-full border border-black/10 px-4 py-2 text-sm active:scale-[0.98]" onClick={exportAlbums} type="button">
          <Download className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
          Export CSV
        </button>
      </div>
      <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5">{items.length} total</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">{items.filter((album) => album.status === "ready").length} ready</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">{items.filter((album) => album.status === "processing").length} processing</span>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5">{filteredItems.length} visible</span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search album, customer, pack, job..."
            value={query}
          />
          <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setStatusFilter(event.target.value as Album["status"] | "")} value={statusFilter}>
            <option value="">All status</option>
            <option value="processing">processing</option>
            <option value="ready">ready</option>
            <option value="hidden">hidden</option>
          </select>
          <button className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm active:scale-[0.98]" onClick={resetFilters} type="button">
            Reset
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
                  <StatusPill label={album.status} tone={tone(album.status)} />
                  <button className="rounded-full border border-black/10 px-3 py-1.5 text-xs active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={busyAlbumId === album.id || album.status === "hidden"} onClick={() => hide(album)} type="button">
                    <EyeOff className="mr-1.5 inline h-3.5 w-3.5" strokeWidth={1.8} />
                    {busyAlbumId === album.id && album.status !== "hidden" ? "Hiding" : "Hide"}
                  </button>
                  <button className="rounded-full bg-zinc-950 px-3 py-1.5 text-xs text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={busyAlbumId === album.id} onClick={() => save(album)} type="button">
                    <Save className="mr-1.5 inline h-3.5 w-3.5" strokeWidth={1.8} />
                    {busyAlbumId === album.id ? "Saving" : "Save"}
                  </button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_0.42fr_0.58fr]">
                <label className="grid gap-1 text-xs text-zinc-500">
                  Title
                  <input className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-950" onChange={(event) => update(album.id, "title", event.target.value)} value={album.title} />
                </label>
                <label className="grid gap-1 text-xs text-zinc-500">
                  Output count
                  <input className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-950" min={0} onChange={(event) => update(album.id, "outputCount", Number(event.target.value))} type="number" value={album.outputCount} />
                </label>
                <label className="grid gap-1 text-xs text-zinc-500">
                  Status
                  <select className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-950" onChange={(event) => update(album.id, "status", event.target.value as Album["status"])} value={album.status}>
                    <option value="processing">processing</option>
                    <option value="ready">ready</option>
                    <option value="hidden">hidden</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-zinc-500 md:col-span-3">
                  Cover asset
                  <select className="rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-xs text-zinc-950" onChange={(event) => update(album.id, "coverAssetId", event.target.value)} value={album.coverAssetId ?? ""}>
                    <option value="">none</option>
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
                  Pack: <span className="font-medium text-zinc-700">{pack?.name ?? "unlinked"}</span>
                </span>
                <span>
                  Job: <span className="font-mono text-zinc-700">{album.sourceJobId ?? "manual"}</span>
                </span>
                <span>
                  Updated: <span className="font-mono text-zinc-700">{new Date(album.updatedAt).toLocaleDateString("en-US")}</span>
                </span>
              </div>
            </div>
          );
        })}
        {!filteredItems.length ? <div className="p-6 text-center text-sm text-zinc-500">No albums match the current filters.</div> : null}
      </div>
    </div>
  );
}
