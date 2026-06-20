"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Save, Trash2 } from "lucide-react";
import { downloadCsv } from "@/components/admin/export-utils";
import type { CreativePack, SiteAiApp } from "@/lib/types";
import { StatusPill } from "@/components/ui";

function tone(status: CreativePack["status"]): "good" | "warn" | "neutral" {
  if (status === "active") return "good";
  if (status === "paused") return "warn";
  return "neutral";
}

function createDraftPack(siteAiApps: SiteAiApp[]): Omit<CreativePack, "id" | "siteId" | "generationCount" | "conversionRate" | "createdAt"> {
  return {
    name: "New creative pack",
    headline: "New creative pack",
    description: "Describe what this pack creates, who it targets, and what kind of output customers will receive.",
    category: "headshots",
    aiAppSlug: siteAiApps[0]?.aiApp.slug ?? "image_generator",
    status: "draft",
    creditCost: 12,
    outputCount: 8,
    trainingRequired: false
  };
}

export function CreativePackEditor({
  siteId,
  packs,
  siteAiApps
}: {
  siteId: string;
  packs: CreativePack[];
  siteAiApps: SiteAiApp[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(packs);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CreativePack["status"] | "">("");
  const [categoryFilter, setCategoryFilter] = useState<CreativePack["category"] | "">("");
  const [appFilter, setAppFilter] = useState("");
  const [savingPackId, setSavingPackId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftPack, setDraftPack] = useState(() => createDraftPack(siteAiApps));
  const [message, setMessage] = useState("Photoshoot packs persist and drive the storefront offer catalog.");

  useEffect(() => {
    setItems(packs);
  }, [packs]);

  useEffect(() => {
    setDraftPack(createDraftPack(siteAiApps));
  }, [siteAiApps]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((pack) => {
      if (statusFilter && pack.status !== statusFilter) return false;
      if (categoryFilter && pack.category !== categoryFilter) return false;
      if (appFilter && pack.aiAppSlug !== appFilter) return false;
      if (!normalized) return true;
      return [pack.name, pack.headline, pack.description, pack.aiAppSlug, pack.category].join(" ").toLowerCase().includes(normalized);
    });
  }, [appFilter, categoryFilter, items, query, statusFilter]);

  const activeCount = items.filter((pack) => pack.status === "active").length;
  const draftCount = items.filter((pack) => pack.status === "draft").length;
  const pausedCount = items.filter((pack) => pack.status === "paused").length;

  function update<K extends keyof CreativePack>(packId: string, key: K, value: CreativePack[K]) {
    setItems((current) =>
      current.map((pack) =>
        pack.id === packId
          ? {
              ...pack,
              [key]: value
            }
          : pack
      )
    );
  }

  async function save(pack: CreativePack) {
    setSavingPackId(pack.id);
    const response = await fetch(`/api/sites/${siteId}/creative-packs/${pack.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pack)
    });
    const result = (await response.json().catch(() => ({}))) as { pack?: CreativePack; error?: string };
    setSavingPackId(null);
    if (response.ok && result.pack) {
      setItems((current) => current.map((item) => (item.id === result.pack?.id ? result.pack : item)));
      setMessage(`${result.pack.name} saved.`);
      router.refresh();
    } else {
      setMessage(result.error ?? "Photoshoot pack save failed.");
    }
  }

  function updateDraft<K extends keyof typeof draftPack>(key: K, value: (typeof draftPack)[K]) {
    setDraftPack((current) => ({ ...current, [key]: value }));
  }

  async function createPack() {
    setCreating(true);
    const response = await fetch(`/api/sites/${siteId}/creative-packs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftPack)
    });
    const result = (await response.json().catch(() => ({}))) as { pack?: CreativePack; error?: string };
    setCreating(false);
    if (response.ok && result.pack) {
      setItems((current) => [result.pack!, ...current]);
      setDraftPack(createDraftPack(siteAiApps));
      setMessage(`${result.pack.name} created.`);
      router.refresh();
      return;
    }
    setMessage(result.error ?? "Photoshoot pack create failed.");
  }

  async function removePack(packId: string) {
    const response = await fetch(`/api/sites/${siteId}/creative-packs/${packId}`, {
      method: "DELETE"
    });
    const result = (await response.json().catch(() => ({}))) as { deletedPack?: CreativePack; error?: string };
    if (response.ok && result.deletedPack) {
      setItems((current) => current.filter((item) => item.id !== packId));
      setMessage(`${result.deletedPack.name} deleted.`);
      router.refresh();
      return;
    }
    setMessage(result.error ?? "Photoshoot pack delete failed.");
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("");
    setCategoryFilter("");
    setAppFilter("");
  }

  function exportPacks() {
    downloadCsv(
      `${siteId}-creative-packs.csv`,
      filteredItems.map((pack) => ({
        packId: pack.id,
        name: pack.name,
        headline: pack.headline,
        category: pack.category,
        status: pack.status,
        aiAppSlug: pack.aiAppSlug,
        trainingRequired: pack.trainingRequired,
        creditCost: pack.creditCost,
        outputCount: pack.outputCount,
        generationCount: pack.generationCount,
        conversionRate: pack.conversionRate,
        createdAt: pack.createdAt
      })),
      [
        "packId",
        "name",
        "headline",
        "category",
        "status",
        "aiAppSlug",
        "trainingRequired",
        "creditCost",
        "outputCount",
        "generationCount",
        "conversionRate",
        "createdAt"
      ]
    );
    setMessage(`Exported ${filteredItems.length} creative packs.`);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-clay">DreamShoot-style offers</p>
          <h2 className="mt-2 text-2xl font-semibold">Photoshoot packs and themes</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{message}</p>
        </div>
        <button className="rounded-full border border-black/10 px-4 py-2 text-sm active:scale-[0.98]" onClick={exportPacks} type="button">
          <Download className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
          Export CSV
        </button>
      </div>
      <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5">{items.length} total</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">{activeCount} active</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">{draftCount} draft</span>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5">{pausedCount} paused</span>
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5">{filteredItems.length} visible</span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.8fr))_auto]">
          <input
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pack name, headline, tool..."
            value={query}
          />
          <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setStatusFilter(event.target.value as CreativePack["status"] | "")} value={statusFilter}>
            <option value="">All status</option>
            <option value="active">active</option>
            <option value="draft">draft</option>
            <option value="paused">paused</option>
          </select>
          <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setCategoryFilter(event.target.value as CreativePack["category"] | "")} value={categoryFilter}>
            <option value="">All categories</option>
            {["headshots", "couple", "wedding", "dating", "fashion", "beauty", "travel", "seasonal", "copy"].map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setAppFilter(event.target.value)} value={appFilter}>
            <option value="">All tools</option>
            {siteAiApps.map((app) => (
              <option key={app.id} value={app.aiApp.slug}>
                {app.aiApp.name}
              </option>
            ))}
          </select>
          <button className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm active:scale-[0.98]" onClick={resetFilters} type="button">
            Reset
          </button>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-dashed border-zinc-300 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-clay">new pack</p>
            <h3 className="mt-2 text-lg font-semibold">Create storefront offer</h3>
          </div>
          <button className="rounded-full bg-zinc-950 px-4 py-2 text-sm text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={creating} onClick={createPack} type="button">
            <Plus className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
            {creating ? "Creating" : "Create pack"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            Pack name
            <input className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => updateDraft("name", event.target.value)} value={draftPack.name} />
          </label>
          <label className="grid gap-2 text-sm">
            Headline
            <input className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => updateDraft("headline", event.target.value)} value={draftPack.headline} />
          </label>
          <label className="grid gap-2 text-sm md:col-span-2">
            Description
            <textarea className="min-h-24 rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => updateDraft("description", event.target.value)} value={draftPack.description} />
          </label>
          <label className="grid gap-2 text-sm">
            Status
            <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => updateDraft("status", event.target.value as CreativePack["status"])} value={draftPack.status}>
              <option value="active">active</option>
              <option value="draft">draft</option>
              <option value="paused">paused</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Category
            <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => updateDraft("category", event.target.value as CreativePack["category"])} value={draftPack.category}>
              {["headshots", "couple", "wedding", "dating", "fashion", "beauty", "travel", "seasonal", "copy"].map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Bound AI tool
            <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => updateDraft("aiAppSlug", event.target.value)} value={draftPack.aiAppSlug}>
              {siteAiApps.map((app) => (
                <option key={app.id} value={app.aiApp.slug}>
                  {app.aiApp.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Training required
            <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => updateDraft("trainingRequired", event.target.value === "true")} value={String(draftPack.trainingRequired)}>
              <option value="true">yes</option>
              <option value="false">no</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Credits
            <input className="rounded-xl border border-black/10 bg-white px-3 py-2" min={0} onChange={(event) => updateDraft("creditCost", Number(event.target.value))} type="number" value={draftPack.creditCost} />
          </label>
          <label className="grid gap-2 text-sm">
            Output count
            <input className="rounded-xl border border-black/10 bg-white px-3 py-2" min={1} onChange={(event) => updateDraft("outputCount", Number(event.target.value))} type="number" value={draftPack.outputCount} />
          </label>
        </div>
      </div>
      <div className="mt-5 grid gap-4">
        {filteredItems.map((pack) => (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5" key={pack.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{pack.name}</p>
                  <StatusPill label={pack.status} tone={tone(pack.status)} />
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">{pack.category}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-full bg-zinc-950 px-4 py-2 text-sm text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={savingPackId === pack.id} onClick={() => save(pack)} type="button">
                  <Save className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
                  {savingPackId === pack.id ? "Saving" : "Save"}
                </button>
                <button className="rounded-full border border-black/10 px-4 py-2 text-sm text-clay active:scale-[0.98]" onClick={() => removePack(pack.id)} type="button">
                  <Trash2 className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
                  Delete
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm">
                Pack name
                <input className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => update(pack.id, "name", event.target.value)} value={pack.name} />
              </label>
              <label className="grid gap-2 text-sm">
                Headline
                <input className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => update(pack.id, "headline", event.target.value)} value={pack.headline} />
              </label>
              <label className="grid gap-2 text-sm md:col-span-2">
                Description
                <textarea
                  className="min-h-24 rounded-xl border border-black/10 bg-white px-3 py-2"
                  onChange={(event) => update(pack.id, "description", event.target.value)}
                  value={pack.description}
                />
              </label>
              <label className="grid gap-2 text-sm">
                Status
                <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => update(pack.id, "status", event.target.value as CreativePack["status"])} value={pack.status}>
                  <option value="active">active</option>
                  <option value="draft">draft</option>
                  <option value="paused">paused</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm">
                Category
                <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => update(pack.id, "category", event.target.value as CreativePack["category"])} value={pack.category}>
                  {["headshots", "couple", "wedding", "dating", "fashion", "beauty", "travel", "seasonal", "copy"].map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm">
                Bound AI tool
                <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => update(pack.id, "aiAppSlug", event.target.value)} value={pack.aiAppSlug}>
                  {siteAiApps.map((app) => (
                    <option key={app.id} value={app.aiApp.slug}>
                      {app.aiApp.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm">
                Training required
                <select
                  className="rounded-xl border border-black/10 bg-white px-3 py-2"
                  onChange={(event) => update(pack.id, "trainingRequired", event.target.value === "true")}
                  value={String(pack.trainingRequired)}
                >
                  <option value="true">yes</option>
                  <option value="false">no</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm">
                Credits
                <input className="rounded-xl border border-black/10 bg-white px-3 py-2" min={0} onChange={(event) => update(pack.id, "creditCost", Number(event.target.value))} type="number" value={pack.creditCost} />
              </label>
              <label className="grid gap-2 text-sm">
                Output count
                <input className="rounded-xl border border-black/10 bg-white px-3 py-2" min={1} onChange={(event) => update(pack.id, "outputCount", Number(event.target.value))} type="number" value={pack.outputCount} />
              </label>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
              <span>
                <span className="block font-mono">{pack.generationCount}</span>
                <span className="text-xs text-zinc-500">runs</span>
              </span>
              <span>
                <span className="block font-mono">{pack.conversionRate.toFixed(1)}%</span>
                <span className="text-xs text-zinc-500">conversion</span>
              </span>
              <span>
                <span className="block font-mono">{pack.outputCount}</span>
                <span className="text-xs text-zinc-500">photos</span>
              </span>
            </div>
          </div>
        ))}
        {!filteredItems.length ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-10 text-center text-sm text-zinc-500">
            No creative packs match the current filters.
          </div>
        ) : null}
      </div>
    </div>
  );
}
