"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Save, Trash2 } from "lucide-react";
import { AdminPagination, clampPage, pageItems } from "@/components/admin/admin-pagination";
import { downloadCsv } from "@/components/admin/export-utils";
import type { CreativePack, SiteAiApp } from "@/lib/types";
import { StatusPill } from "@/components/ui";

const categoryLabels: Record<CreativePack["category"], string> = {
  headshots: "职业头像",
  couple: "情侣写真",
  wedding: "婚礼跟拍",
  dating: "约会形象",
  fashion: "时尚大片",
  beauty: "美妆造型",
  travel: "旅行写真",
  seasonal: "节日主题",
  copy: "文案生成",
  creative: "创意大片",
  sports: "运动主题",
  creator: "创作者形象",
  avatar: "头像形象",
  video: "视频生成",
  utility: "实用工具",
  boudoir: "私房写真",
  cultural: "文化主题"
};

const categoryOptions: CreativePack["category"][] = [
  "headshots",
  "couple",
  "wedding",
  "dating",
  "fashion",
  "beauty",
  "travel",
  "seasonal",
  "creative",
  "sports",
  "creator",
  "avatar",
  "video",
  "utility",
  "boudoir",
  "cultural",
  "copy"
];

const statusLabels: Record<CreativePack["status"], string> = {
  active: "已上架",
  draft: "草稿",
  paused: "已暂停"
};

function tone(status: CreativePack["status"]): "good" | "warn" | "neutral" {
  if (status === "active") return "good";
  if (status === "paused") return "warn";
  return "neutral";
}

function createDraftPack(siteAiApps: SiteAiApp[]): Omit<CreativePack, "id" | "siteId" | "generationCount" | "conversionRate" | "createdAt"> {
  return {
    name: "新拍摄包",
    headline: "新拍摄主题",
    description: "描述这个拍摄包面向的人群、生成内容和客户会收到的成片类型。",
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [savingPackId, setSavingPackId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftPack, setDraftPack] = useState(() => createDraftPack(siteAiApps));
  const [message, setMessage] = useState("拍摄包会持久化并驱动前台商品入口。");

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

  useEffect(() => {
    setPage((current) => clampPage(current, filteredItems.length, pageSize));
  }, [filteredItems.length, pageSize]);

  const pagedItems = useMemo(() => pageItems(filteredItems, page, pageSize), [filteredItems, page, pageSize]);

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
      setMessage(`${result.pack.name} 已保存。`);
      router.refresh();
    } else {
      setMessage(result.error ?? "拍摄包保存失败。");
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
      setPage(1);
      setMessage(`${result.pack.name} 已创建。`);
      router.refresh();
      return;
    }
    setMessage(result.error ?? "拍摄包创建失败。");
  }

  async function removePack(packId: string) {
    const response = await fetch(`/api/sites/${siteId}/creative-packs/${packId}`, {
      method: "DELETE"
    });
    const result = (await response.json().catch(() => ({}))) as { deletedPack?: CreativePack; error?: string };
    if (response.ok && result.deletedPack) {
      setItems((current) => current.filter((item) => item.id !== packId));
      setMessage(`${result.deletedPack.name} 已删除。`);
      router.refresh();
      return;
    }
    setMessage(result.error ?? "拍摄包删除失败。");
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("");
    setCategoryFilter("");
    setAppFilter("");
    setPage(1);
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
    setMessage(`已导出 ${filteredItems.length} 个拍摄包。`);
  }

  function updatePageSize(nextPageSize: number) {
    setPageSize(nextPageSize);
    setPage(1);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-clay">拍摄包商品</p>
          <h2 className="mt-2 text-2xl font-semibold">AI 拍摄包与主题</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{message}</p>
        </div>
        <button className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-black/10 px-4 py-2 text-sm active:scale-[0.98]" onClick={exportPacks} type="button">
          <Download className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
          导出 CSV
        </button>
      </div>
      <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
          <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 py-1.5">共 {items.length} 个</span>
          <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">{activeCount} 个已上架</span>
          <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">{draftCount} 个草稿</span>
          <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 py-1.5">{pausedCount} 个暂停</span>
          <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 py-1.5">当前 {filteredItems.length} 个</span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.8fr))_auto]">
          <input
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="搜索拍摄包名称、标题、工具..."
            value={query}
          />
          <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => { setStatusFilter(event.target.value as CreativePack["status"] | ""); setPage(1); }} value={statusFilter}>
            <option value="">全部状态</option>
            <option value="active">已上架</option>
            <option value="draft">草稿</option>
            <option value="paused">已暂停</option>
          </select>
          <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => { setCategoryFilter(event.target.value as CreativePack["category"] | ""); setPage(1); }} value={categoryFilter}>
            <option value="">全部分类</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {categoryLabels[category]}
              </option>
            ))}
          </select>
          <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => { setAppFilter(event.target.value); setPage(1); }} value={appFilter}>
            <option value="">全部工具</option>
            {siteAiApps.map((app) => (
              <option key={app.id} value={app.aiApp.slug}>
                {app.aiApp.name}
              </option>
            ))}
          </select>
          <button className="whitespace-nowrap rounded-xl border border-black/10 bg-white px-4 py-2 text-sm active:scale-[0.98]" onClick={resetFilters} type="button">
            重置筛选
          </button>
        </div>
        <AdminPagination onPageChange={setPage} onPageSizeChange={updatePageSize} page={page} pageSize={pageSize} total={filteredItems.length} />
      </div>
      <div className="mt-5 rounded-2xl border border-dashed border-zinc-300 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-clay">新建拍摄包</p>
            <h3 className="mt-2 text-lg font-semibold">创建前台售卖入口</h3>
          </div>
          <button className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-zinc-950 px-4 py-2 text-sm text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={creating} onClick={createPack} type="button">
            <Plus className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
            {creating ? "创建中" : "创建拍摄包"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            拍摄包名称
            <input className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => updateDraft("name", event.target.value)} value={draftPack.name} />
          </label>
          <label className="grid gap-2 text-sm">
            前台标题
            <input className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => updateDraft("headline", event.target.value)} value={draftPack.headline} />
          </label>
          <label className="grid gap-2 text-sm md:col-span-2">
            描述
            <textarea className="min-h-24 rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => updateDraft("description", event.target.value)} value={draftPack.description} />
          </label>
          <label className="grid gap-2 text-sm">
            状态
            <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => updateDraft("status", event.target.value as CreativePack["status"])} value={draftPack.status}>
              <option value="active">已上架</option>
              <option value="draft">草稿</option>
              <option value="paused">已暂停</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            分类
            <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => updateDraft("category", event.target.value as CreativePack["category"])} value={draftPack.category}>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            绑定 AI 工具
            <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => updateDraft("aiAppSlug", event.target.value)} value={draftPack.aiAppSlug}>
              {siteAiApps.map((app) => (
                <option key={app.id} value={app.aiApp.slug}>
                  {app.aiApp.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            是否需要训练
            <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => updateDraft("trainingRequired", event.target.value === "true")} value={String(draftPack.trainingRequired)}>
              <option value="true">需要</option>
              <option value="false">不需要</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            消耗积分
            <input className="rounded-xl border border-black/10 bg-white px-3 py-2" min={0} onChange={(event) => updateDraft("creditCost", Number(event.target.value))} type="number" value={draftPack.creditCost} />
          </label>
          <label className="grid gap-2 text-sm">
            输出数量
            <input className="rounded-xl border border-black/10 bg-white px-3 py-2" min={1} onChange={(event) => updateDraft("outputCount", Number(event.target.value))} type="number" value={draftPack.outputCount} />
          </label>
        </div>
      </div>
      <div className="mt-5 grid gap-4">
        {pagedItems.map((pack) => (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5" key={pack.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{pack.name}</p>
                  <StatusPill label={statusLabels[pack.status]} tone={tone(pack.status)} />
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">{categoryLabels[pack.category]}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-zinc-950 px-4 py-2 text-sm text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={savingPackId === pack.id} onClick={() => save(pack)} type="button">
                  <Save className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
                  {savingPackId === pack.id ? "保存中" : "保存"}
                </button>
                <button className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-black/10 px-4 py-2 text-sm text-clay active:scale-[0.98]" onClick={() => removePack(pack.id)} type="button">
                  <Trash2 className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
                  删除
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm">
                拍摄包名称
                <input className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => update(pack.id, "name", event.target.value)} value={pack.name} />
              </label>
              <label className="grid gap-2 text-sm">
                前台标题
                <input className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => update(pack.id, "headline", event.target.value)} value={pack.headline} />
              </label>
              <label className="grid gap-2 text-sm md:col-span-2">
                描述
                <textarea
                  className="min-h-24 rounded-xl border border-black/10 bg-white px-3 py-2"
                  onChange={(event) => update(pack.id, "description", event.target.value)}
                  value={pack.description}
                />
              </label>
              <label className="grid gap-2 text-sm">
                状态
                <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => update(pack.id, "status", event.target.value as CreativePack["status"])} value={pack.status}>
                  <option value="active">已上架</option>
                  <option value="draft">草稿</option>
                  <option value="paused">已暂停</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm">
                分类
                <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => update(pack.id, "category", event.target.value as CreativePack["category"])} value={pack.category}>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabels[category]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm">
                绑定 AI 工具
                <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => update(pack.id, "aiAppSlug", event.target.value)} value={pack.aiAppSlug}>
                  {siteAiApps.map((app) => (
                    <option key={app.id} value={app.aiApp.slug}>
                      {app.aiApp.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm">
                是否需要训练
                <select
                  className="rounded-xl border border-black/10 bg-white px-3 py-2"
                  onChange={(event) => update(pack.id, "trainingRequired", event.target.value === "true")}
                  value={String(pack.trainingRequired)}
                >
                  <option value="true">需要</option>
                  <option value="false">不需要</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm">
                消耗积分
                <input className="rounded-xl border border-black/10 bg-white px-3 py-2" min={0} onChange={(event) => update(pack.id, "creditCost", Number(event.target.value))} type="number" value={pack.creditCost} />
              </label>
              <label className="grid gap-2 text-sm">
                输出数量
                <input className="rounded-xl border border-black/10 bg-white px-3 py-2" min={1} onChange={(event) => update(pack.id, "outputCount", Number(event.target.value))} type="number" value={pack.outputCount} />
              </label>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
              <span>
                <span className="block font-mono">{pack.generationCount}</span>
                <span className="whitespace-nowrap text-xs text-zinc-500">生成次数</span>
              </span>
              <span>
                <span className="block font-mono">{pack.conversionRate.toFixed(1)}%</span>
                <span className="whitespace-nowrap text-xs text-zinc-500">转化率</span>
              </span>
              <span>
                <span className="block font-mono">{pack.outputCount}</span>
                <span className="whitespace-nowrap text-xs text-zinc-500">成片数</span>
              </span>
            </div>
          </div>
        ))}
        {!filteredItems.length ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-10 text-center text-sm text-zinc-500">
            当前筛选下没有匹配的拍摄包。
          </div>
        ) : null}
      </div>
    </div>
  );
}
