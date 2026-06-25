"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ImageIcon, Pencil, Plus, Search, Save, Trash2, X } from "lucide-react";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { downloadCsv } from "@/components/admin/export-utils";
import { defaultCreativePackCoverByCategory, suggestedCreativePackCover, suggestedCreativePackPrompt } from "@/lib/creative-pack-suggestions";
import type { CreativePack, CreativePackCategory, SiteAiApp } from "@/lib/types";
import { StatusPill } from "@/components/ui";

const fallbackCategoryLabels: Record<string, string> = {
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

const fallbackCategoryOptions = [
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
] as const;

function labelFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function packCategoryLabel(pack: CreativePack, categories: CreativePackCategory[]) {
  return pack.categoryRecord?.label ?? categories.find((category) => category.id === pack.categoryId || category.slug === pack.category)?.label ?? fallbackCategoryLabels[pack.category] ?? labelFromSlug(pack.category);
}

function galleryText(images?: string[]) {
  return (images ?? []).join("\n");
}

function parseGalleryText(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

type CategoryQueryResult = {
  categories?: CreativePackCategory[];
  error?: string;
};

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

type CreativePackQueryResult = {
  packs?: CreativePack[];
  total?: number;
  page?: number;
  pageSize?: number;
  counts?: {
    all?: number;
    active?: number;
    draft?: number;
    paused?: number;
  };
  error?: string;
};

function createDraftPack(siteAiApps: SiteAiApp[]): Omit<CreativePack, "id" | "siteId" | "generationCount" | "conversionRate" | "createdAt"> {
  const draft = {
    name: "新拍摄包",
    headline: "新拍摄主题",
    description: "描述这个拍摄包面向的人群、生成内容和客户会收到的成片类型。",
    category: "headshots" as const,
    aiAppSlug: siteAiApps[0]?.aiApp.slug ?? "image_generator",
    status: "draft" as const,
    creditCost: 12,
    outputCount: 8,
    trainingRequired: false,
    imageUrl: defaultCreativePackCoverByCategory.headshots
  };
  return {
    ...draft,
    prompt: suggestedCreativePackPrompt(draft)
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
  const [categoryFilter, setCategoryFilter] = useState("");
  const [appFilter, setAppFilter] = useState("");
  const [categories, setCategories] = useState<CreativePackCategory[]>([]);
  const [categoryDraft, setCategoryDraft] = useState({ label: "", slug: "", parentId: "", status: "active" as CreativePackCategory["status"] });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(packs.length);
  const [counts, setCounts] = useState({
    all: packs.length,
    active: packs.filter((pack) => pack.status === "active").length,
    draft: packs.filter((pack) => pack.status === "draft").length,
    paused: packs.filter((pack) => pack.status === "paused").length
  });
  const [loading, setLoading] = useState(false);
  const [savingPackId, setSavingPackId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [draftPack, setDraftPack] = useState(() => createDraftPack(siteAiApps));
  const [message, setMessage] = useState("拍摄包会持久化并驱动前台商品入口。");

  const parentCategories = useMemo(() => categories.filter((category) => !category.parentId), [categories]);
  const categoryOptions = useMemo<CreativePackCategory[]>(() => {
    if (categories.length) return categories;
    return fallbackCategoryOptions.map((slug, index) => ({
      id: slug,
      siteId,
      slug,
      label: fallbackCategoryLabels[slug] ?? labelFromSlug(slug),
      sortOrder: index,
      status: "active" as const,
      createdAt: new Date(0).toISOString()
    }));
  }, [categories, siteId]);

  useEffect(() => {
    setItems(packs);
    setTotal(packs.length);
    setCounts({
      all: packs.length,
      active: packs.filter((pack) => pack.status === "active").length,
      draft: packs.filter((pack) => pack.status === "draft").length,
      paused: packs.filter((pack) => pack.status === "paused").length
    });
  }, [packs]);

  useEffect(() => {
    setDraftPack(createDraftPack(siteAiApps));
  }, [siteAiApps]);

  useEffect(() => {
    let active = true;
    async function loadCategories() {
      const response = await fetch(`/api/sites/${siteId}/creative-pack-categories`, { method: "GET" });
      const result = (await response.json().catch(() => ({}))) as CategoryQueryResult;
      if (active && response.ok && result.categories) {
        setCategories(result.categories);
      }
    }
    void loadCategories();
    return () => {
      active = false;
    };
  }, [siteId]);

  const editingPack = useMemo(() => items.find((pack) => pack.id === editingPackId) ?? null, [editingPackId, items]);

  async function queryPacks(next: Partial<{ page: number; pageSize: number; query: string; statusFilter: CreativePack["status"] | ""; categoryFilter: string; appFilter: string }> = {}) {
    const nextPage = next.page ?? page;
    const nextPageSize = next.pageSize ?? pageSize;
    const nextQuery = next.query ?? query;
    const nextStatus = next.statusFilter ?? statusFilter;
    const nextCategory = next.categoryFilter ?? categoryFilter;
    const nextApp = next.appFilter ?? appFilter;
    const params = new URLSearchParams({
      page: String(nextPage),
      pageSize: String(nextPageSize)
    });
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextStatus) params.set("status", nextStatus);
    if (nextCategory) params.set("category", nextCategory);
    if (nextApp) params.set("app", nextApp);
    setLoading(true);
    const response = await fetch(`/api/sites/${siteId}/creative-packs?${params.toString()}`, { method: "GET" });
    const result = (await response.json().catch(() => ({}))) as CreativePackQueryResult;
    setLoading(false);
    if (response.ok && result.packs) {
      setItems(result.packs);
      setTotal(result.total ?? result.packs.length);
      setPage(result.page ?? nextPage);
      setPageSize(result.pageSize ?? nextPageSize);
      setCounts({
        all: result.counts?.all ?? counts.all,
        active: result.counts?.active ?? counts.active,
        draft: result.counts?.draft ?? counts.draft,
        paused: result.counts?.paused ?? counts.paused
      });
      setMessage(`已查询到 ${result.total ?? result.packs.length} 个拍摄包。`);
      return;
    }
    setMessage(result.error ?? "拍摄包查询失败。");
  }

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
    setDraftPack((current) => {
      const next = { ...current, [key]: value };
      if ((key === "name" || key === "headline" || key === "description" || key === "category" || key === "outputCount" || key === "trainingRequired") && !current.prompt?.trim()) {
        return { ...next, prompt: suggestedCreativePackPrompt(next) };
      }
      return next;
    });
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
      setTotal((current) => current + 1);
      setCounts((current) => ({
        ...current,
        all: current.all + 1,
        [result.pack!.status]: current[result.pack!.status] + 1
      }));
      setDraftPack(createDraftPack(siteAiApps));
      setPage(1);
      setCreateOpen(false);
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
      setTotal((current) => Math.max(0, current - 1));
      setCounts((current) => ({
        ...current,
        all: Math.max(0, current.all - 1),
        [result.deletedPack!.status]: Math.max(0, current[result.deletedPack!.status] - 1)
      }));
      setEditingPackId((current) => (current === packId ? null : current));
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
    void queryPacks({ page: 1, query: "", statusFilter: "", categoryFilter: "", appFilter: "" });
  }

  function exportPacks() {
    downloadCsv(
      `${siteId}-creative-packs.csv`,
      items.map((pack) => ({
        packId: pack.id,
        name: pack.name,
        headline: pack.headline,
        prompt: pack.prompt ?? "",
        category: pack.category,
        status: pack.status,
        aiAppSlug: pack.aiAppSlug,
        imageUrl: pack.imageUrl ?? "",
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
        "prompt",
        "category",
        "status",
        "aiAppSlug",
        "imageUrl",
        "trainingRequired",
        "creditCost",
        "outputCount",
        "generationCount",
        "conversionRate",
        "createdAt"
      ]
    );
    setMessage(`已导出 ${items.length} 个拍摄包。`);
  }

  function updatePageSize(nextPageSize: number) {
    void queryPacks({ page: 1, pageSize: nextPageSize });
  }

  function updatePage(nextPage: number) {
    void queryPacks({ page: nextPage });
  }

  function updateStatusFilter(nextStatus: CreativePack["status"] | "") {
    setStatusFilter(nextStatus);
    setPage(1);
    void queryPacks({ page: 1, statusFilter: nextStatus });
  }

  function beginEditing(pack: CreativePack) {
    if (!pack.prompt?.trim()) {
      update(pack.id, "prompt", suggestedCreativePackPrompt(pack));
    }
    setEditingPackId(pack.id);
  }

  function updateCategoryFilter(nextCategory: string) {
    setCategoryFilter(nextCategory);
    setPage(1);
    void queryPacks({ page: 1, categoryFilter: nextCategory });
  }

  function updateAppFilter(nextApp: string) {
    setAppFilter(nextApp);
    setPage(1);
    void queryPacks({ page: 1, appFilter: nextApp });
  }

  async function createCategory() {
    const response = await fetch(`/api/sites/${siteId}/creative-pack-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(categoryDraft)
    });
    const result = (await response.json().catch(() => ({}))) as { category?: CreativePackCategory; error?: string };
    if (response.ok && result.category) {
      setCategories((current) => [...current, result.category!]);
      setCategoryDraft({ label: "", slug: "", parentId: "", status: "active" });
      setMessage(`${result.category.label} 分类已创建。`);
      return;
    }
    setMessage(result.error ?? "分类创建失败。");
  }

  async function saveCategory(category: CreativePackCategory) {
    const response = await fetch(`/api/sites/${siteId}/creative-pack-categories/${category.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(category)
    });
    const result = (await response.json().catch(() => ({}))) as { category?: CreativePackCategory; error?: string };
    if (response.ok && result.category) {
      setCategories((current) => current.map((item) => (item.id === result.category!.id ? result.category! : item)));
      setItems((current) => current.map((pack) => (pack.categoryId === result.category!.id ? { ...pack, category: result.category!.slug, categoryRecord: result.category } : pack)));
      setMessage(`${result.category.label} 分类已保存。`);
      return;
    }
    setMessage(result.error ?? "分类保存失败。");
  }

  function updateCategory(categoryId: string, patch: Partial<CreativePackCategory>) {
    setCategories((current) => current.map((category) => (category.id === categoryId ? { ...category, ...patch } : category)));
  }

  function applyCategoryToDraft(categoryId: string) {
    const category = categoryOptions.find((item) => item.id === categoryId);
    updateDraft("categoryId", category?.id);
    updateDraft("category", category?.slug ?? "headshots");
  }

  function applyCategoryToPack(packId: string, categoryId: string) {
    const category = categoryOptions.find((item) => item.id === categoryId);
    update(packId, "categoryId", category?.id);
    update(packId, "category", category?.slug ?? "headshots");
    update(packId, "categoryRecord", category);
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
        <div className="mb-4 rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
          前台绑定检查：拍摄包保存后打开前台工具入口，客户看到的主题名称、Credits、输出数量和上下架状态，都应与下方列表一致。
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
          <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 py-1.5">共 {counts.all} 个</span>
          <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">{counts.active} 个已上架</span>
          <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">{counts.draft} 个草稿</span>
          <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 py-1.5">{counts.paused} 个暂停</span>
          <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 py-1.5">当前查询 {total} 个</span>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.8fr))_auto_auto]">
          <input
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="搜索拍摄包名称、标题、工具..."
            value={query}
          />
          <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => updateStatusFilter(event.target.value as CreativePack["status"] | "")} value={statusFilter}>
            <option value="">全部状态</option>
            <option value="active">已上架</option>
            <option value="draft">草稿</option>
            <option value="paused">已暂停</option>
          </select>
          <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => updateCategoryFilter(event.target.value)} value={categoryFilter}>
            <option value="">全部分类</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.parent ? `${category.parent.label} / ${category.label}` : category.label}
              </option>
            ))}
          </select>
          <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => updateAppFilter(event.target.value)} value={appFilter}>
            <option value="">全部工具</option>
            {siteAiApps.map((app) => (
              <option key={app.id} value={app.aiApp.slug}>
                {app.aiApp.name}
              </option>
            ))}
          </select>
          <button className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-zinc-950 px-4 py-2 text-sm text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={loading} onClick={() => queryPacks({ page: 1 })} type="button">
            <Search className="mr-2 h-4 w-4" strokeWidth={1.8} />
            {loading ? "查询中" : "查询"}
          </button>
          <button className="whitespace-nowrap rounded-xl border border-black/10 bg-white px-4 py-2 text-sm active:scale-[0.98]" onClick={resetFilters} type="button">
            重置筛选
          </button>
        </div>
        <AdminPagination onPageChange={updatePage} onPageSizeChange={updatePageSize} page={page} pageSize={pageSize} total={total} />
      </div>
      <details className="mt-5 rounded-[12px] border border-zinc-200 bg-white p-5">
        <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4">
          <span>
            <span className="block font-mono text-xs uppercase tracking-[0.2em] text-clay">分类维护</span>
            <span className="mt-2 block text-lg font-semibold">一级/二级主题分类</span>
            <span className="mt-1 block text-sm leading-6 text-zinc-500">前台 Photo Packages 下拉菜单会读取这里的分类和主题包绑定。</span>
          </span>
          <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-black/10 px-4 py-2 text-sm">
            <Plus className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
            维护分类
          </span>
        </summary>
        <div className="mt-4 grid gap-3 rounded-[12px] border border-zinc-100 bg-zinc-50 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto]">
          <input className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setCategoryDraft((current) => ({ ...current, label: event.target.value }))} placeholder="分类名称，如 Wedding & Romance" value={categoryDraft.label} />
          <input className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setCategoryDraft((current) => ({ ...current, slug: event.target.value }))} placeholder="URL slug，可留空自动生成" value={categoryDraft.slug} />
          <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setCategoryDraft((current) => ({ ...current, parentId: event.target.value }))} value={categoryDraft.parentId}>
            <option value="">作为一级分类</option>
            {parentCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
          <button className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-zinc-950 px-4 py-2 text-sm text-white active:scale-[0.98]" onClick={createCategory} type="button">
            新增分类
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          {categories.map((category) => (
            <div className="grid gap-2 rounded-[12px] border border-zinc-100 bg-white p-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_auto]" key={category.id}>
              <input className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => updateCategory(category.id, { label: event.target.value })} value={category.label} />
              <input className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => updateCategory(category.id, { slug: event.target.value })} value={category.slug} />
              <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => updateCategory(category.id, { parentId: event.target.value || undefined })} value={category.parentId ?? ""}>
                <option value="">一级分类</option>
                {parentCategories.filter((parent) => parent.id !== category.id).map((parent) => (
                  <option key={parent.id} value={parent.id}>{parent.label}</option>
                ))}
              </select>
              <input className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => updateCategory(category.id, { imageUrl: event.target.value })} placeholder="分类封面图" value={category.imageUrl ?? ""} />
              <button className="whitespace-nowrap rounded-xl border border-black/10 px-4 py-2 text-sm active:scale-[0.98]" onClick={() => saveCategory(category)} type="button">
                保存
              </button>
            </div>
          ))}
        </div>
      </details>
      <details className="mt-5 rounded-[12px] border border-dashed border-zinc-300 bg-white p-5" open={createOpen} onToggle={(event) => setCreateOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-clay">新建拍摄包</p>
            <h3 className="mt-2 text-lg font-semibold">创建前台售卖入口</h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500">默认收起，只有新增主题时再展开完整表单。</p>
          </div>
          <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-black/10 px-4 py-2 text-sm">
            <Plus className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
            展开新建
          </span>
        </summary>
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
          <label className="grid gap-2 text-sm md:col-span-2">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>AI 主题提示词</span>
              <button
                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-black/10 px-3 py-1.5 text-xs active:scale-[0.98]"
                onClick={() => updateDraft("prompt", suggestedCreativePackPrompt(draftPack))}
                type="button"
              >
                生成主题提示词
              </button>
            </span>
            <textarea
              className="min-h-32 rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-xs leading-5"
              onChange={(event) => updateDraft("prompt", event.target.value)}
              placeholder="客户选择该主题后，后端会把这里的提示词合并进生成任务 prompt。"
              value={draftPack.prompt ?? ""}
            />
            <span className="text-xs leading-5 text-zinc-500">建议写成英文专业提示词，包含身份保留、摄影风格、光线、构图和安全约束。</span>
          </label>
          <label className="grid gap-2 text-sm md:col-span-2">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>主题封面图</span>
              <span className="flex flex-wrap gap-2">
                <button
                  className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-black/10 px-3 py-1.5 text-xs active:scale-[0.98]"
                  onClick={() => updateDraft("imageUrl", suggestedCreativePackCover(draftPack))}
                  type="button"
                >
                  使用建议图
                </button>
                <button
                  className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-red-100 px-3 py-1.5 text-xs text-red-600 active:scale-[0.98]"
                  onClick={() => updateDraft("imageUrl", "")}
                  type="button"
                >
                  删除图片
                </button>
              </span>
            </span>
            <input
              className="rounded-xl border border-black/10 bg-white px-3 py-2"
              onChange={(event) => updateDraft("imageUrl", event.target.value)}
              placeholder="/assets/dreamshoot/generated/packs/example.png"
              value={draftPack.imageUrl ?? ""}
            />
            <span className="text-xs leading-5 text-zinc-500">用于前台工具目录和拍摄包卡片；支持 /assets 路径、media id 或完整 URL。清空后前台会显示无图占位。</span>
          </label>
          <label className="grid gap-2 text-sm md:col-span-2">
            主题详情多图
            <textarea className="min-h-24 rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-xs leading-5" onChange={(event) => updateDraft("galleryImages", parseGalleryText(event.target.value))} placeholder="每行一张图片 URL。首张可作为封面兜底。" value={galleryText(draftPack.galleryImages)} />
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
            <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => applyCategoryToDraft(event.target.value)} value={draftPack.categoryId ?? categoryOptions.find((category) => category.slug === draftPack.category)?.id ?? ""}>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.parent ? `${category.parent.label} / ${category.label}` : category.label}
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
        <div className="mt-4 flex justify-end border-t border-zinc-100 pt-4">
          <button className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-zinc-950 px-4 py-2 text-sm text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={creating} onClick={createPack} type="button">
            <Plus className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
            {creating ? "创建中" : "创建拍摄包"}
          </button>
        </div>
      </details>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((pack) => (
          <button
            className="group overflow-hidden rounded-[12px] border border-zinc-200 bg-white text-left transition hover:border-blue-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
            key={pack.id}
            onClick={() => beginEditing(pack)}
            type="button"
          >
            <div className="aspect-[16/9] overflow-hidden border-b border-zinc-100 bg-zinc-100">
              {pack.imageUrl ? (
                <img className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={pack.imageUrl} alt={pack.name} />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">
                  <ImageIcon className="h-6 w-6" strokeWidth={1.8} />
                </div>
              )}
            </div>
            <div className="min-h-[188px] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-1 text-[15px] font-semibold text-slate-900">{pack.name}</p>
                <p className="mt-1 text-[12px] text-slate-500">{packCategoryLabel(pack, categories)}</p>
              </div>
              <StatusPill label={statusLabels[pack.status]} tone={tone(pack.status)} />
            </div>
            <p className="mt-4 line-clamp-2 min-h-[40px] text-sm leading-5 text-zinc-600">{pack.headline}</p>
            <p className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${pack.prompt?.trim() ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {pack.prompt?.trim() ? "已配置提示词" : "未配置提示词"}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-[12px] text-zinc-500">
              <span>
                <strong className="block font-mono text-slate-900">{pack.creditCost}</strong>
                Credits
              </span>
              <span>
                <strong className="block font-mono text-slate-900">{pack.outputCount}</strong>
                输出
              </span>
              <span>
                <strong className="block font-mono text-slate-900">{pack.conversionRate.toFixed(1)}%</strong>
                转化
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-[12px] text-zinc-500">
              <span className="truncate">{siteAiApps.find((app) => app.aiApp.slug === pack.aiAppSlug)?.aiApp.name ?? pack.aiAppSlug}</span>
              <span className="inline-flex items-center gap-1 text-blue-600">
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                编辑
              </span>
            </div>
            </div>
          </button>
        ))}
        {!items.length ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-10 text-center text-sm text-zinc-500 sm:col-span-2 xl:col-span-4">
            当前筛选下没有匹配的拍摄包。
          </div>
        ) : null}
      </div>
      {editingPack ? (
        <div className="fixed inset-0 z-[1200] bg-slate-950/45 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`编辑${editingPack.name}`}>
          <div className="mx-auto flex max-h-[calc(100dvh-48px)] max-w-4xl flex-col rounded-[16px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <div className="min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-400">编辑拍摄包</p>
                <h3 className="mt-1 truncate text-xl font-semibold text-zinc-950">{editingPack.name}</h3>
                <p className="mt-1 text-sm text-zinc-500">{packCategoryLabel(editingPack, categories)} / {statusLabels[editingPack.status]}</p>
              </div>
              <button className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-50" onClick={() => setEditingPackId(null)} type="button" aria-label="关闭编辑弹窗">
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  拍摄包名称
                  <input className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => update(editingPack.id, "name", event.target.value)} value={editingPack.name} />
                </label>
                <label className="grid gap-2 text-sm">
                  前台标题
                  <input className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => update(editingPack.id, "headline", event.target.value)} value={editingPack.headline} />
                </label>
                <label className="grid gap-2 text-sm md:col-span-2">
                  描述
                  <textarea
                    className="min-h-24 rounded-xl border border-black/10 bg-white px-3 py-2"
                    onChange={(event) => update(editingPack.id, "description", event.target.value)}
                    value={editingPack.description}
                  />
                </label>
                <label className="grid gap-2 text-sm md:col-span-2">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span>AI 主题提示词</span>
                    <span className="flex flex-wrap gap-2">
                      <button
                        className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-black/10 px-3 py-1.5 text-xs active:scale-[0.98]"
                        onClick={() => update(editingPack.id, "prompt", suggestedCreativePackPrompt(editingPack))}
                        type="button"
                      >
                        生成/覆盖提示词
                      </button>
                      <button
                        className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-red-100 px-3 py-1.5 text-xs text-red-600 active:scale-[0.98]"
                        onClick={() => update(editingPack.id, "prompt", "")}
                        type="button"
                      >
                        清空提示词
                      </button>
                    </span>
                  </span>
                  <textarea
                    className="min-h-40 rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-xs leading-5"
                    onChange={(event) => update(editingPack.id, "prompt", event.target.value)}
                    placeholder="客户选择该主题后，后端会把这里的提示词合并进生成任务 prompt。"
                    value={editingPack.prompt ?? ""}
                  />
                  <span className="text-xs leading-5 text-zinc-500">这里维护主题的专业摄影/生成术语；客户只选择主题，不能篡改最终 prompt。</span>
                </label>
                <label className="grid gap-2 text-sm md:col-span-2">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span>主题封面图</span>
                    <span className="flex flex-wrap gap-2">
                      <button
                        className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-black/10 px-3 py-1.5 text-xs active:scale-[0.98]"
                        onClick={() => update(editingPack.id, "imageUrl", suggestedCreativePackCover(editingPack))}
                        type="button"
                      >
                        使用建议图
                      </button>
                      <button
                        className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-red-100 px-3 py-1.5 text-xs text-red-600 active:scale-[0.98]"
                        onClick={() => update(editingPack.id, "imageUrl", "")}
                        type="button"
                      >
                        删除图片
                      </button>
                    </span>
                  </span>
                  <input
                    className="rounded-xl border border-black/10 bg-white px-3 py-2"
                    onChange={(event) => update(editingPack.id, "imageUrl", event.target.value)}
                    placeholder="/assets/dreamshoot/generated/packs/example.png"
                    value={editingPack.imageUrl ?? ""}
                  />
                  <span className="text-xs leading-5 text-zinc-500">保存后前台 Tools 目录、拍摄包墙和搜索结果会读取这张图。删除图片会清空数据库 imageUrl，不会删除 public/assets 里的原始文件。</span>
                </label>
                {editingPack.imageUrl ? (
                  <div className="md:col-span-2 overflow-hidden rounded-[14px] border border-zinc-200 bg-zinc-50">
                    <img className="max-h-[260px] w-full object-cover" src={editingPack.imageUrl} alt={`${editingPack.name} preview`} />
                  </div>
                ) : null}
                <label className="grid gap-2 text-sm md:col-span-2">
                  主题详情多图
                  <textarea
                    className="min-h-28 rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-xs leading-5"
                    onChange={(event) => update(editingPack.id, "galleryImages", parseGalleryText(event.target.value))}
                    placeholder="每行一张图片 URL。首张可作为封面兜底，其他图片展示在主题详情页。"
                    value={galleryText(editingPack.galleryImages)}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  状态
                  <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => update(editingPack.id, "status", event.target.value as CreativePack["status"])} value={editingPack.status}>
                    <option value="active">已上架</option>
                    <option value="draft">草稿</option>
                    <option value="paused">已暂停</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  分类
                  <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => applyCategoryToPack(editingPack.id, event.target.value)} value={editingPack.categoryId ?? categoryOptions.find((category) => category.slug === editingPack.category)?.id ?? ""}>
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.parent ? `${category.parent.label} / ${category.label}` : category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  绑定 AI 工具
                  <select className="rounded-xl border border-black/10 bg-white px-3 py-2" onChange={(event) => update(editingPack.id, "aiAppSlug", event.target.value)} value={editingPack.aiAppSlug}>
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
                    onChange={(event) => update(editingPack.id, "trainingRequired", event.target.value === "true")}
                    value={String(editingPack.trainingRequired)}
                  >
                    <option value="true">需要</option>
                    <option value="false">不需要</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  每次消耗 Credits
                  <input className="rounded-xl border border-black/10 bg-white px-3 py-2" min={0} onChange={(event) => update(editingPack.id, "creditCost", Number(event.target.value))} type="number" value={editingPack.creditCost} />
                </label>
                <label className="grid gap-2 text-sm">
                  每次输出数量
                  <input className="rounded-xl border border-black/10 bg-white px-3 py-2" min={1} onChange={(event) => update(editingPack.id, "outputCount", Number(event.target.value))} type="number" value={editingPack.outputCount} />
                </label>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 rounded-[12px] border border-zinc-200 bg-zinc-50 p-4 text-sm">
                <span>
                  <span className="block font-mono text-zinc-950">{editingPack.generationCount}</span>
                  <span className="whitespace-nowrap text-xs text-zinc-500">生成次数</span>
                </span>
                <span>
                  <span className="block font-mono text-zinc-950">{editingPack.conversionRate.toFixed(1)}%</span>
                  <span className="whitespace-nowrap text-xs text-zinc-500">转化率</span>
                </span>
                <span>
                  <span className="block font-mono text-zinc-950">{editingPack.outputCount}</span>
                  <span className="whitespace-nowrap text-xs text-zinc-500">输出数量</span>
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4">
              <button className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-black/10 px-4 py-2 text-sm text-clay active:scale-[0.98]" onClick={() => removePack(editingPack.id)} type="button">
                <Trash2 className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
                删除拍摄包
              </button>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-black/10 px-4 py-2 text-sm active:scale-[0.98]" onClick={() => setEditingPackId(null)} type="button">
                  取消
                </button>
                <button className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-zinc-950 px-4 py-2 text-sm text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55" disabled={savingPackId === editingPack.id} onClick={() => save(editingPack)} type="button">
                  <Save className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
                  {savingPackId === editingPack.id ? "保存中" : "保存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
