"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FileSpreadsheet, Film, ImageIcon, Pencil, Plus, Save, Search, Trash2, UploadCloud, X } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import {
  ErpField,
  ErpFormGrid,
  ErpInput,
  ErpSelect,
  ErpTextarea,
  ErpToolbar,
  ErpToolbarAction,
  ErpToolbarField
} from "@/components/admin/erp-primitives";
import { StatusPill } from "@/components/ui";
import type { VideoTheme, VideoThemeCategory } from "@/lib/types";
import {
  DEFAULT_VIDEO_FRAME_LIMIT,
  MAX_VIDEO_FRAME_LIMIT,
  defaultVideoModelPricing,
  normalizeVideoFrameLimit,
  normalizeVideoModelPricing,
  type VideoDurationSeconds,
  type VideoModelFamily
} from "@/lib/video-frame-config";

type Status = VideoTheme["status"];
type ThemeScope = "public" | "all";

type ThemeQueryResult = {
  themes?: VideoTheme[];
  total?: number;
  counts?: {
    all?: number;
    active?: number;
    draft?: number;
    paused?: number;
    backendAll?: number;
    publicAll?: number;
  };
  error?: string;
};

type CategoryQueryResult = {
  categories?: VideoThemeCategory[];
  error?: string;
};

type ThemeSaveResult = {
  theme?: VideoTheme;
  created?: boolean;
  error?: string;
};

type CategorySaveResult = {
  category?: VideoThemeCategory;
  created?: boolean;
  error?: string;
};

type ImportPreviewResult = {
  ok?: boolean;
  error?: string;
  categories?: Array<{ slug: string; label: string }>;
  themes?: Array<{ slug: string; name: string }>;
  errors?: Array<{ row: number; field?: string; message: string }>;
  imported?: { categories: number; themes: number };
};

const statusLabels: Record<Status, string> = {
  active: "已启用",
  draft: "草稿",
  paused: "已暂停"
};

const videoModelPricingInputs: Array<{ family: VideoModelFamily; seconds: VideoDurationSeconds; label: string }> = [
  { family: "grok", seconds: 6, label: "Grok 6s" },
  { family: "grok", seconds: 10, label: "Grok 10s" },
  { family: "gemini", seconds: 10, label: "Gemini 10s" },
  { family: "gemini", seconds: 15, label: "Gemini 15s" }
];

function statusTone(status: Status): "good" | "warn" | "neutral" {
  if (status === "active") return "good";
  if (status === "paused") return "warn";
  return "neutral";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function newThemeDraft(categoryId?: string): Omit<VideoTheme, "id" | "siteId" | "generationCount" | "createdAt"> {
  return {
    categoryId,
    slug: "",
    name: "新视频主题",
    headline: "生成一条私密短视频",
    description: "说明这个视频主题适合的照片、动作氛围和最终视频用途。",
    prompt: "Create a polished short video from the provided frame images with natural camera movement, consistent subjects, realistic motion, and cinematic pacing.",
    status: "draft",
    creditCost: 24,
    modelPricing: defaultVideoModelPricing(24),
    durationSeconds: 6,
    maxFrames: DEFAULT_VIDEO_FRAME_LIMIT,
    sortOrder: 0,
    imageUrl: "",
    galleryImages: []
  };
}

function updateListItem<T extends { id: string }>(items: T[], nextItem: T) {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index < 0) return [nextItem, ...items];
  const next = [...items];
  next[index] = nextItem;
  return next;
}

function parseGalleryImages(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function galleryText(theme: Partial<VideoTheme>) {
  return (theme.galleryImages ?? []).join("\n");
}

export function VideoThemeEditor({ siteId }: { siteId: string }) {
  const [themes, setThemes] = useState<VideoTheme[]>([]);
  const [categories, setCategories] = useState<VideoThemeCategory[]>([]);
  const [counts, setCounts] = useState<ThemeQueryResult["counts"]>({});
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ThemeScope>("public");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editingTheme, setEditingTheme] = useState<VideoTheme | null>(null);
  const [editingCategory, setEditingCategory] = useState<VideoThemeCategory | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [draftTheme, setDraftTheme] = useState(() => newThemeDraft());
  const [categoryDraft, setCategoryDraft] = useState({ label: "", slug: "", description: "", icon: "", accentColor: "", imageUrl: "", sortOrder: 0, status: "active" as Status });
  const [siteBasePath, setSiteBasePath] = useState("");

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const categoryOptions = categories.length ? categories : [];
  const adminPagesHref = siteBasePath ? `${siteBasePath}/admin/design/pages` : "/admin/design/pages";
  const mediaLibraryHref = siteBasePath ? `${siteBasePath}/admin/media` : "/admin/media";
  const themePreviewHref = useCallback((theme: Pick<VideoTheme, "slug">) => {
    const slug = theme.slug?.trim();
    return slug ? `${siteBasePath}/ai-video-generation/${slug}` : "";
  }, [siteBasePath]);
  const themeFiltersRef = useRef({ query, statusFilter, categoryFilter, scopeFilter });
  themeFiltersRef.current = { query, statusFilter, categoryFilter, scopeFilter };

  useEffect(() => {
    const match = window.location.pathname.match(/^\/site\/[^/]+/);
    setSiteBasePath(match?.[0] ?? "");
  }, []);

  const loadCategories = useCallback(async (nextScope = themeFiltersRef.current.scopeFilter, signal?: AbortSignal) => {
    const params = new URLSearchParams({ admin: "1" });
    if (nextScope === "public") params.set("scope", "public");
    const response = await fetchAdminJson<CategoryQueryResult>(`/api/sites/${siteId}/video-theme-categories?${params.toString()}`, { init: { signal }, ttlMs: 0 });
    if (!response.ok) throw new Error(response.data.error ?? "视频主题分类加载失败。");
    setCategories(response.data.categories ?? []);
  }, [siteId]);

  const loadThemes = useCallback(async (next: Partial<{ query: string; statusFilter: Status | ""; categoryFilter: string; scopeFilter: ThemeScope }> = {}, signal?: AbortSignal) => {
    const currentFilters = themeFiltersRef.current;
    const nextQuery = next.query ?? currentFilters.query;
    const nextStatus = next.statusFilter ?? currentFilters.statusFilter;
    const nextCategory = next.categoryFilter ?? currentFilters.categoryFilter;
    const nextScope = next.scopeFilter ?? currentFilters.scopeFilter;
    const params = new URLSearchParams({ admin: "1", pageSize: "100" });
    if (nextScope === "public") params.set("scope", "public");
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextStatus) params.set("status", nextStatus);
    if (nextCategory) params.set("category", nextCategory);
    const response = await fetchAdminJson<ThemeQueryResult>(`/api/sites/${siteId}/video-themes?${params.toString()}`, { init: { signal }, ttlMs: 0 });
    if (!response.ok) throw new Error(response.data.error ?? "视频主题加载失败。");
    setThemes(response.data.themes ?? []);
    setCounts(response.data.counts ?? {});
    setTotal(response.data.total ?? response.data.themes?.length ?? 0);
  }, [siteId]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        setLoading(true);
        setMessage("");
        await Promise.all([loadCategories(scopeFilter, controller.signal), loadThemes({ scopeFilter }, controller.signal)]);
      } catch (error) {
        if (active && !controller.signal.aborted) setMessage(error instanceof Error ? error.message : "视频主题数据加载失败。");
      } finally {
        if (active && !controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [loadCategories, loadThemes, scopeFilter]);

  function updateDraft<K extends keyof typeof draftTheme>(key: K, value: (typeof draftTheme)[K]) {
    setDraftTheme((current) => ({ ...current, [key]: value }));
  }

  function beginEditing(theme: VideoTheme) {
    setEditingTheme({ ...theme, galleryImages: theme.galleryImages ?? [] });
  }

  function updateEditing<K extends keyof VideoTheme>(key: K, value: VideoTheme[K]) {
    setEditingTheme((current) => current ? { ...current, [key]: value } : current);
  }

  function updateEditingCategory<K extends keyof VideoThemeCategory>(key: K, value: VideoThemeCategory[K]) {
    setEditingCategory((current) => current ? { ...current, [key]: value } : current);
  }

  async function createCategory() {
    if (!categoryDraft.label.trim()) {
      setMessage("请先填写分类名称。");
      return;
    }
    setSaving(true);
    try {
      const response = await fetchAdminJson<CategorySaveResult>(`/api/sites/${siteId}/video-theme-categories`, {
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...categoryDraft, slug: categoryDraft.slug || slugify(categoryDraft.label) })
        },
        ttlMs: 0
      });
      if (!response.ok || !response.data.category) throw new Error(response.data.error ?? "分类创建失败。");
      setCategories((items) => updateListItem(items, response.data.category!));
      setCategoryDraft({ label: "", slug: "", description: "", icon: "", accentColor: "", imageUrl: "", sortOrder: 0, status: "active" });
      setMessage(`已创建视频分类：${response.data.category.label}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "分类创建失败。");
    } finally {
      setSaving(false);
    }
  }

  async function persistEditingCategory() {
    if (!editingCategory) return;
    setSaving(true);
    try {
      const response = await fetchAdminJson<CategorySaveResult>(`/api/sites/${siteId}/video-theme-categories/${editingCategory.id}`, {
        init: {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingCategory)
        },
        ttlMs: 0
      });
      if (!response.ok || !response.data.category) throw new Error(response.data.error ?? "分类保存失败。");
      setCategories((items) => updateListItem(items, response.data.category!));
      setEditingCategory(response.data.category);
      setMessage(`已保存视频分类：${response.data.category.label}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "分类保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(category: VideoThemeCategory) {
    const themeCount = themes.filter((theme) => theme.categoryId === category.id).length;
    if (!window.confirm(themeCount ? `分类「${category.label}」下有 ${themeCount} 个主题，删除后主题会变为未分类。确认继续吗？` : `确认删除分类「${category.label}」吗？`)) return;
    setSaving(true);
    try {
      const response = await fetchAdminJson<{ deletedCategory?: VideoThemeCategory; error?: string }>(`/api/sites/${siteId}/video-theme-categories/${category.id}`, {
        init: { method: "DELETE" },
        ttlMs: 0
      });
      if (!response.ok) throw new Error(response.data.error ?? "分类删除失败。");
      setCategories((items) => items.filter((item) => item.id !== category.id));
      setThemes((items) => items.map((theme) => theme.categoryId === category.id ? { ...theme, categoryId: undefined, category: undefined } : theme));
      setEditingCategory(null);
      await loadThemes();
      setMessage(`已删除视频分类：${category.label}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "分类删除失败。");
    } finally {
      setSaving(false);
    }
  }

  async function runImport(mode: "preview" | "commit") {
    if (!importFile) {
      setMessage("请先选择 CSV 或 XLSX 文件。");
      return;
    }
    setImporting(true);
    try {
      const form = new FormData();
      form.set("file", importFile);
      form.set("mode", mode);
      const response = await fetch(`/api/sites/${siteId}/video-themes/import`, {
        method: "POST",
        body: form,
        credentials: "same-origin"
      });
      const data = await response.json() as ImportPreviewResult;
      setImportPreview(data);
      if (!response.ok) throw new Error(data.error ?? "导入校验失败。");
      if (mode === "commit") {
        await Promise.all([loadCategories(), loadThemes()]);
        setMessage(`导入完成：${data.imported?.categories ?? 0} 个分类，${data.imported?.themes ?? 0} 个主题。`);
      } else {
        setMessage(data.errors?.length ? `预览发现 ${data.errors.length} 个错误，请修正后再导入。` : `预览通过：${data.categories?.length ?? 0} 个分类，${data.themes?.length ?? 0} 个主题。`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入失败。");
    } finally {
      setImporting(false);
    }
  }

  async function saveTheme(theme: Partial<VideoTheme>, themeId?: string) {
    if (!theme.name?.trim()) throw new Error("请填写主题名称。");
    if (!theme.prompt?.trim()) throw new Error("请填写主题提示词。");
    const payload = {
      categoryId: theme.categoryId || undefined,
      slug: theme.slug || slugify(theme.name),
      name: theme.name,
      headline: theme.headline || theme.name,
      description: theme.description || "",
      prompt: theme.prompt,
      status: theme.status ?? "draft",
      creditCost: Math.max(1, Math.trunc(Number(theme.creditCost) || 1)),
      modelPricing: normalizeVideoModelPricing(theme.modelPricing, theme.creditCost),
      durationSeconds: Math.min(15, Math.max(1, Math.trunc(Number(theme.durationSeconds) || 6))),
      maxFrames: normalizeVideoFrameLimit(theme.maxFrames),
      sortOrder: Math.trunc(Number(theme.sortOrder) || 0),
      imageUrl: theme.imageUrl || "",
      galleryImages: theme.galleryImages ?? []
    };
    const url = themeId ? `/api/sites/${siteId}/video-themes/${themeId}` : `/api/sites/${siteId}/video-themes`;
    const response = await fetchAdminJson<ThemeSaveResult>(url, {
      init: {
        method: themeId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      },
      ttlMs: 0
    });
    if (!response.ok || !response.data.theme) throw new Error(response.data.error ?? "视频主题保存失败。");
    return response.data.theme;
  }

  async function createTheme() {
    setSaving(true);
    try {
      const saved = await saveTheme(draftTheme);
      setThemes((items) => updateListItem(items, saved));
      setDraftTheme(newThemeDraft(draftTheme.categoryId));
      await loadThemes();
      setMessage(`已创建视频主题：${saved.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "视频主题创建失败。");
    } finally {
      setSaving(false);
    }
  }

  async function persistEditingTheme() {
    if (!editingTheme) return;
    setSaving(true);
    try {
      const saved = await saveTheme(editingTheme, editingTheme.id);
      setThemes((items) => updateListItem(items, saved));
      setEditingTheme(saved);
      await loadThemes();
      setMessage(`已保存视频主题：${saved.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "视频主题保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTheme(theme: VideoTheme) {
    if (!window.confirm(`确认删除视频主题「${theme.name}」吗？已有关联任务不会被删除，但前台将不再可选。`)) return;
    setSaving(true);
    try {
      const response = await fetchAdminJson<{ deletedTheme?: VideoTheme; error?: string }>(`/api/sites/${siteId}/video-themes/${theme.id}`, {
        init: { method: "DELETE" },
        ttlMs: 0
      });
      if (!response.ok) throw new Error(response.data.error ?? "视频主题删除失败。");
      setThemes((items) => items.filter((item) => item.id !== theme.id));
      if (editingTheme?.id === theme.id) setEditingTheme(null);
      await loadThemes();
      setMessage(`已删除视频主题：${theme.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "视频主题删除失败。");
    } finally {
      setSaving(false);
    }
  }

  function applySearch(nextQuery: string) {
    setQuery(nextQuery);
    void loadThemes({ query: nextQuery });
  }

  function applyStatus(nextStatus: Status | "") {
    setStatusFilter(nextStatus);
    void loadThemes({ statusFilter: nextStatus });
  }

  function applyScope(nextScope: ThemeScope) {
    setScopeFilter(nextScope);
    setCategoryFilter("");
  }

  function applyCategory(nextCategory: string) {
    setCategoryFilter(nextCategory);
    void loadThemes({ categoryFilter: nextCategory });
  }

  const editingThemePreviewHref = editingTheme ? themePreviewHref(editingTheme) : "";
  const scopeCopy = scopeFilter === "public"
    ? {
        primaryLabel: "前台可见",
        secondaryLabel: "后台全部",
        secondaryValue: counts?.backendAll ?? counts?.all ?? themes.length,
        helper: "当前默认只显示前台 AI Video Generation 目录会展示的公开视频主题。旧工作区主题、内部预设和隐藏入口保留在后台全部视图中，避免误删。"
      }
    : {
        primaryLabel: "后台全部",
        secondaryLabel: "前台可见",
        secondaryValue: counts?.publicAll ?? counts?.active ?? 0,
        helper: "当前显示后台全部视频主题，包含旧工作区主题、内部预设和隐藏入口；这个数量不等于前台目录展示数量。"
      };

  if (loading) {
    return (
      <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
        正在加载视频主题...
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <ErpToolbar>
        <div className="flex flex-wrap gap-2">
          <ErpToolbarField label={scopeCopy.primaryLabel} value={String(counts?.all ?? themes.length)} />
          <ErpToolbarField label={scopeCopy.secondaryLabel} value={String(scopeCopy.secondaryValue)} />
          <ErpToolbarField label="已启用" value={String(counts?.active ?? 0)} />
          <ErpToolbarField label="草稿" value={String(counts?.draft ?? 0)} />
          <ErpToolbarField label="暂停" value={String(counts?.paused ?? 0)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="erp-select h-9 min-w-36" onChange={(event) => applyScope(event.target.value as ThemeScope)} value={scopeFilter}>
            <option value="public">前台可见主题</option>
            <option value="all">全部后台主题</option>
          </select>
          <label className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" strokeWidth={1.8} />
            <input
              className="w-44 bg-transparent text-slate-800 outline-none"
              onChange={(event) => applySearch(event.target.value)}
              placeholder="搜索主题"
              value={query}
            />
          </label>
          <select className="erp-select h-9 min-w-28" onChange={(event) => applyStatus(event.target.value as Status | "")} value={statusFilter}>
            <option value="">全部状态</option>
            <option value="active">已启用</option>
            <option value="draft">草稿</option>
            <option value="paused">已暂停</option>
          </select>
          <select className="erp-select h-9 min-w-32" onChange={(event) => applyCategory(event.target.value)} value={categoryFilter}>
            <option value="">全部分类</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
      </ErpToolbar>

      {message ? (
        <div className="rounded-[10px] border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {message}
        </div>
      ) : null}

      <div className="rounded-[10px] border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-800">
        {scopeCopy.helper}
      </div>

      <details className="rounded-[12px] border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">导入分类和主题</summary>
        <div className="mt-4 grid gap-3">
          <label className="flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-[10px] border border-dashed border-slate-300 bg-slate-50 px-4 text-sm text-slate-500 hover:border-blue-300 hover:bg-blue-50/40">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" strokeWidth={1.8} />
            <span>{importFile ? importFile.name : "选择 CSV 或 XLSX 文件"}</span>
            <input accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => { setImportFile(event.target.files?.[0] ?? null); setImportPreview(null); }} type="file" />
          </label>
          <p className="text-xs leading-5 text-slate-500">每行可包含一个一级分类和一个二级主题。预览阶段会校验重复 slug、缺失分类、非法 slug 和必填字段；确认导入时先保存分类，再保存主题。</p>
          <div className="flex flex-wrap gap-2">
            <button className="input_btn inline-flex h-9 items-center px-4" disabled={importing || !importFile} onClick={() => runImport("preview")} type="button">
              <UploadCloud className="mr-2 h-4 w-4" strokeWidth={1.8} />
              预览校验
            </button>
            <button className="inline-flex h-9 items-center rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 disabled:opacity-40" disabled={importing || !importFile || Boolean(importPreview?.errors?.length)} onClick={() => runImport("commit")} type="button">
              确认导入
            </button>
          </div>
          {importPreview ? (
            <div className="grid gap-2 rounded-[10px] border border-slate-200 bg-slate-50 p-3 text-xs">
              <p className="font-semibold text-slate-700">预览结果：{importPreview.categories?.length ?? 0} 个分类，{importPreview.themes?.length ?? 0} 个主题</p>
              {importPreview.errors?.length ? (
                <div className="grid gap-1 text-red-600">
                  {importPreview.errors.slice(0, 12).map((item, index) => <p key={`${item.row}-${item.field}-${index}`}>第 {item.row} 行{item.field ? ` · ${item.field}` : ""}：{item.message}</p>)}
                  {importPreview.errors.length > 12 ? <p>还有 {importPreview.errors.length - 12} 个错误未展开。</p> : null}
                </div>
              ) : <p className="text-emerald-700">校验通过，可以确认导入。</p>}
            </div>
          ) : null}
        </div>
      </details>

      <details className="rounded-[12px] border border-slate-200 bg-slate-50 p-4" open={!categories.length}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">维护视频分类</summary>
        <ErpFormGrid className="mt-4" columns={2}>
          <ErpField label="分类名称">
            <ErpInput onChange={(event) => setCategoryDraft((current) => ({ ...current, label: event.target.value }))} placeholder="旅行短片" value={categoryDraft.label} />
          </ErpField>
          <ErpField hint="为空时按名称自动生成。" label="Slug">
            <ErpInput onChange={(event) => setCategoryDraft((current) => ({ ...current, slug: event.target.value }))} placeholder="travel-story" value={categoryDraft.slug} />
          </ErpField>
          <ErpField label="封面 URL">
            <ErpInput onChange={(event) => setCategoryDraft((current) => ({ ...current, imageUrl: event.target.value }))} value={categoryDraft.imageUrl} />
          </ErpField>
          <ErpField label="图标名称">
            <ErpInput onChange={(event) => setCategoryDraft((current) => ({ ...current, icon: event.target.value }))} placeholder="camera" value={categoryDraft.icon} />
          </ErpField>
          <ErpField hint="支持 #RRGGBB。" label="主题色">
            <ErpInput onChange={(event) => setCategoryDraft((current) => ({ ...current, accentColor: event.target.value }))} placeholder="#38a8ff" value={categoryDraft.accentColor} />
          </ErpField>
          <ErpField label="排序">
            <ErpInput onChange={(event) => setCategoryDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} type="number" value={categoryDraft.sortOrder} />
          </ErpField>
          <ErpField label="状态">
            <ErpSelect onChange={(event) => setCategoryDraft((current) => ({ ...current, status: event.target.value as Status }))} value={categoryDraft.status}>
              <option value="active">已启用</option>
              <option value="draft">草稿</option>
              <option value="paused">已暂停</option>
            </ErpSelect>
          </ErpField>
          <ErpField label="描述" span="full">
            <ErpTextarea onChange={(event) => setCategoryDraft((current) => ({ ...current, description: event.target.value }))} rows={2} value={categoryDraft.description} />
          </ErpField>
        </ErpFormGrid>
        <div className="mt-4 flex justify-end">
          <button className="input_btn inline-flex h-9 items-center px-4" disabled={saving} onClick={createCategory} type="button">
            <Plus className="mr-2 h-4 w-4" strokeWidth={1.8} />
            新建分类
          </button>
        </div>
        <div className="mt-5 grid gap-2 border-t border-slate-200 pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">已有分类</p>
          {categories.map((category) => (
            <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-slate-200 bg-white px-3 py-2" key={category.id}>
              <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: category.accentColor || "#cbd5e1" }} />
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-slate-900">{category.label}</strong>
                <span className="text-xs text-slate-500">{category.slug} · {themes.filter((theme) => theme.categoryId === category.id).length} 个主题</span>
              </span>
              <StatusPill label={statusLabels[category.status]} tone={statusTone(category.status)} />
              <button className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={() => setEditingCategory({ ...category })} type="button">
                <Pencil className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                编辑
              </button>
            </div>
          ))}
        </div>
      </details>

      <details className="rounded-[12px] border border-slate-200 bg-white p-4" open>
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">新建视频主题</summary>
        <ThemeForm
          categories={categoryOptions}
          onChange={updateDraft}
          onGalleryChange={(value) => updateDraft("galleryImages", parseGalleryImages(value))}
          theme={draftTheme}
        />
        <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
          <button className="input_btn inline-flex h-9 items-center px-4" disabled={saving} onClick={createTheme} type="button">
            <Plus className="mr-2 h-4 w-4" strokeWidth={1.8} />
            创建视频主题
          </button>
        </div>
      </details>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((theme) => (
          <button
            className="group overflow-hidden rounded-[12px] border border-slate-200 bg-white text-left transition hover:border-blue-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
            key={theme.id}
            onClick={() => beginEditing(theme)}
            type="button"
          >
            <div className="aspect-[16/9] overflow-hidden border-b border-slate-100 bg-slate-100">
              {theme.imageUrl ? (
                <img alt={theme.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={theme.imageUrl} />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <Film className="h-7 w-7" strokeWidth={1.8} />
                </div>
              )}
            </div>
            <div className="min-h-[190px] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-[15px] font-semibold text-slate-900">{theme.name}</p>
                  <p className="mt-1 text-[12px] text-slate-500">{theme.category?.label ?? categoryById.get(theme.categoryId ?? "")?.label ?? "未分类"}</p>
                </div>
                <StatusPill label={statusLabels[theme.status]} tone={statusTone(theme.status)} />
              </div>
              <p className="mt-4 line-clamp-2 min-h-[40px] text-sm leading-5 text-slate-600">{theme.headline || theme.description}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[12px] text-slate-500">
                <span>
                  <strong className="block font-mono text-slate-900">{theme.creditCost}</strong>
                  Credits
                </span>
                <span>
                  <strong className="block font-mono text-slate-900">{theme.durationSeconds}s</strong>
                  时长
                </span>
                <span>
                  <strong className="block font-mono text-slate-900">{theme.maxFrames}</strong>
                  帧图
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[12px] text-slate-500">
                <span>{theme.prompt.trim() ? "已配置提示词" : "未配置提示词"}</span>
                <span className="inline-flex items-center gap-1 text-blue-600">
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                  编辑
                </span>
              </div>
            </div>
          </button>
        ))}
        {themes.length ? null : (
          <div className="rounded-[12px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 sm:col-span-2 xl:col-span-3">
            当前筛选没有视频主题。
          </div>
        )}
      </div>

      <div className="rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
        当前筛选共 {total} 个主题。前台目录口径为 {counts?.publicAll ?? counts?.active ?? 0} 个公开视频主题；后台全部口径为 {counts?.backendAll ?? counts?.all ?? 0} 个主题。时长会作为供应商入参，最大帧图数上限固定为 {MAX_VIDEO_FRAME_LIMIT}。
      </div>

      {editingCategory ? (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="w-[min(680px,96vw)] rounded-2xl border border-slate-200 bg-white shadow-[0_34px_110px_-56px_rgba(0,0,0,0.75)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">Video category</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{editingCategory.label}</h3>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => setEditingCategory(null)} type="button">
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
            <div className="grid gap-4 p-5">
              <ErpFormGrid columns={2}>
                <ErpField label="分类名称">
                  <ErpInput onChange={(event) => updateEditingCategory("label", event.target.value)} value={editingCategory.label} />
                </ErpField>
                <ErpField label="Slug">
                  <ErpInput onChange={(event) => updateEditingCategory("slug", event.target.value)} value={editingCategory.slug} />
                </ErpField>
                <ErpField label="图标名称">
                  <ErpInput onChange={(event) => updateEditingCategory("icon", event.target.value)} value={editingCategory.icon ?? ""} />
                </ErpField>
                <ErpField label="主题色">
                  <ErpInput onChange={(event) => updateEditingCategory("accentColor", event.target.value)} placeholder="#38a8ff" value={editingCategory.accentColor ?? ""} />
                </ErpField>
                <ErpField label="封面 URL" span="full">
                  <ErpInput onChange={(event) => updateEditingCategory("imageUrl", event.target.value)} value={editingCategory.imageUrl ?? ""} />
                </ErpField>
                <ErpField label="排序">
                  <ErpInput onChange={(event) => updateEditingCategory("sortOrder", Number(event.target.value))} type="number" value={editingCategory.sortOrder} />
                </ErpField>
                <ErpField label="状态">
                  <ErpSelect onChange={(event) => updateEditingCategory("status", event.target.value as Status)} value={editingCategory.status}>
                    <option value="active">已启用</option>
                    <option value="draft">草稿</option>
                    <option value="paused">已暂停</option>
                  </ErpSelect>
                </ErpField>
                <ErpField label="描述" span="full">
                  <ErpTextarea onChange={(event) => updateEditingCategory("description", event.target.value ?? "")} rows={3} value={editingCategory.description ?? ""} />
                </ErpField>
              </ErpFormGrid>
              <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-4">
                <button className="inline-flex h-9 items-center rounded-lg border border-red-100 bg-white px-4 text-sm text-red-600 disabled:opacity-40" disabled={saving} onClick={() => deleteCategory(editingCategory)} type="button">
                  <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.8} />
                  删除分类
                </button>
                <div className="flex gap-2">
                  <ErpToolbarAction label="取消" onClick={() => setEditingCategory(null)} />
                  <button className="input_btn inline-flex h-9 items-center px-4" disabled={saving} onClick={persistEditingCategory} type="button">
                    <Save className="mr-2 h-4 w-4" strokeWidth={1.8} />
                    保存分类
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingTheme ? (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/40 px-4 py-8">
          <div className="max-h-[90vh] w-[min(980px,96vw)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_34px_110px_-56px_rgba(0,0,0,0.75)]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">Video theme</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{editingTheme.name}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {editingThemePreviewHref ? (
                    <a className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 hover:border-blue-200 hover:text-blue-600" href={editingThemePreviewHref} rel="noreferrer" target="_blank">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                      预览详情页
                    </a>
                  ) : null}
                  <a className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 hover:border-blue-200 hover:text-blue-600" href={adminPagesHref} rel="noreferrer" target="_blank">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                    维护详情页面
                  </a>
                  <a className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-slate-600 hover:border-blue-200 hover:text-blue-600" href={mediaLibraryHref} rel="noreferrer" target="_blank">
                    <ImageIcon className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                    打开媒体库
                  </a>
                </div>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => setEditingTheme(null)} type="button">
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
            <div className="grid gap-5 p-5">
              <ThemeForm
                categories={categoryOptions}
                onChange={updateEditing}
                onGalleryChange={(value) => updateEditing("galleryImages", parseGalleryImages(value))}
                theme={editingTheme}
              />
              <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-4">
                <button className="inline-flex h-9 items-center rounded-lg border border-red-100 bg-white px-4 text-sm text-red-600 disabled:opacity-40" disabled={saving} onClick={() => deleteTheme(editingTheme)} type="button">
                  <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.8} />
                  删除主题
                </button>
                <div className="flex flex-wrap gap-2">
                  <ErpToolbarAction label="取消" onClick={() => setEditingTheme(null)} />
                  <button className="input_btn inline-flex h-9 items-center px-4" disabled={saving} onClick={persistEditingTheme} type="button">
                    <Save className="mr-2 h-4 w-4" strokeWidth={1.8} />
                    保存主题
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThemeForm<T extends Partial<VideoTheme>>({
  categories,
  theme,
  onChange,
  onGalleryChange
}: {
  categories: VideoThemeCategory[];
  theme: T;
  onChange: <K extends keyof T>(key: K, value: T[K]) => void;
  onGalleryChange: (value: string) => void;
}) {
  const modelPricing = normalizeVideoModelPricing(theme.modelPricing, theme.creditCost);

  function updateModelPrice(family: VideoModelFamily, seconds: VideoDurationSeconds, value: number) {
    const current = normalizeVideoModelPricing(theme.modelPricing, theme.creditCost);
    const next = {
      ...current,
      [family]: {
        ...(current[family] ?? {}),
        [seconds]: Math.max(0, Math.trunc(Number(value) || 0))
      }
    };
    onChange("modelPricing" as keyof T, next as T[keyof T]);
  }

  return (
    <div className="mt-4 grid gap-4">
      <ErpFormGrid columns={2}>
        <ErpField label="主题名称">
          <ErpInput onChange={(event) => onChange("name" as keyof T, event.target.value as T[keyof T])} value={theme.name ?? ""} />
        </ErpField>
        <ErpField hint="为空时按名称自动生成。" label="Slug">
          <ErpInput onChange={(event) => onChange("slug" as keyof T, event.target.value as T[keyof T])} value={theme.slug ?? ""} />
        </ErpField>
        <ErpField label="分类">
          <ErpSelect onChange={(event) => onChange("categoryId" as keyof T, event.target.value as T[keyof T])} value={theme.categoryId ?? ""}>
            <option value="">未分类</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </ErpSelect>
        </ErpField>
        <ErpField label="状态">
          <ErpSelect onChange={(event) => onChange("status" as keyof T, event.target.value as T[keyof T])} value={theme.status ?? "draft"}>
            <option value="active">已启用</option>
            <option value="draft">草稿</option>
            <option value="paused">已暂停</option>
          </ErpSelect>
        </ErpField>
        <ErpField label="积分消耗">
          <ErpInput min={1} onChange={(event) => onChange("creditCost" as keyof T, Number(event.target.value) as T[keyof T])} type="number" value={theme.creditCost ?? 24} />
        </ErpField>
        <ErpField label="视频时长（秒）">
          <ErpInput max={15} min={1} onChange={(event) => onChange("durationSeconds" as keyof T, Number(event.target.value) as T[keyof T])} type="number" value={theme.durationSeconds ?? 6} />
        </ErpField>
        <ErpField label="排序">
          <ErpInput onChange={(event) => onChange("sortOrder" as keyof T, Number(event.target.value) as T[keyof T])} type="number" value={theme.sortOrder ?? 0} />
        </ErpField>
        <ErpField hint="前台自动按可用视频供应商候选中的最高配置价和时长扣费；旧积分消耗仅作为未配置时的兜底基准。" label="分模型用户扣费" span="full">
          <div className="grid gap-2 rounded-[10px] border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4">
            {videoModelPricingInputs.map((item) => (
              <label className="grid gap-1 text-xs font-semibold text-slate-500" key={`${item.family}-${item.seconds}`}>
                <span>{item.label}</span>
                <ErpInput
                  min={0}
                  onChange={(event) => updateModelPrice(item.family, item.seconds, Number(event.target.value))}
                  type="number"
                  value={modelPricing[item.family]?.[item.seconds] ?? 0}
                />
              </label>
            ))}
          </div>
        </ErpField>
        <ErpField hint={`最多可传 ${MAX_VIDEO_FRAME_LIMIT} 张，前台和后端会按此上限统一校验。`} label="最大帧图数">
          <ErpInput max={MAX_VIDEO_FRAME_LIMIT} min={1} onChange={(event) => onChange("maxFrames" as keyof T, Number(event.target.value) as T[keyof T])} type="number" value={theme.maxFrames ?? DEFAULT_VIDEO_FRAME_LIMIT} />
        </ErpField>
        <ErpField hint="可从媒体库复制资源 URL，也可填写外部图片地址。" label="封面 URL">
          <ErpInput onChange={(event) => onChange("imageUrl" as keyof T, event.target.value as T[keyof T])} value={theme.imageUrl ?? ""} />
        </ErpField>
        <ErpField label="卡片标题" span="full">
          <ErpInput onChange={(event) => onChange("headline" as keyof T, event.target.value as T[keyof T])} value={theme.headline ?? ""} />
        </ErpField>
        <ErpField label="主题描述" span="full">
          <ErpTextarea onChange={(event) => onChange("description" as keyof T, event.target.value as T[keyof T])} rows={3} value={theme.description ?? ""} />
        </ErpField>
        <ErpField hint="会与用户补充说明、帧图顺序说明、固定视频约束拼成最终提示词。" label="主题提示词" span="full">
          <ErpTextarea onChange={(event) => onChange("prompt" as keyof T, event.target.value as T[keyof T])} rows={6} value={theme.prompt ?? ""} />
        </ErpField>
        <ErpField hint="一行一个 URL，可选；第一张封面仍使用上面的封面 URL。" label="展示图集 URL" span="full">
          <ErpTextarea onChange={(event) => onGalleryChange(event.target.value)} rows={3} value={galleryText(theme)} />
        </ErpField>
      </ErpFormGrid>
      {theme.imageUrl ? (
        <div className="overflow-hidden rounded-[12px] border border-slate-200 bg-slate-50">
          <img alt={theme.name ?? "Video theme cover"} className="h-56 w-full object-cover" src={theme.imageUrl} />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-[12px] border border-dashed border-slate-300 bg-slate-50 text-slate-400">
          <ImageIcon className="mr-2 h-5 w-5" strokeWidth={1.8} />
          暂无封面
        </div>
      )}
    </div>
  );
}
