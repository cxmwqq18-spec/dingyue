"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Download,
  ImageIcon,
  Pencil,
  Plus,
  Search,
  Save,
  Star,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { downloadCsv } from "@/components/admin/export-utils";
import { defaultCreativePackCoverByCategory, suggestedCreativePackCover, suggestedCreativePackPrompt } from "@/lib/creative-pack-suggestions";
import { allCreativePackIconOptions, creativePackIconByName } from "@/lib/creative-pack-icons";
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

function CategoryIconPicker({
  value,
  onChange
}: {
  value?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [iconPage, setIconPage] = useState(1);
  const selected = creativePackIconByName(value);
  const SelectedIcon = selected.icon;
  const visibleOptions = allCreativePackIconOptions.filter((item) => {
    const haystack = `${item.name} ${item.label}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  const iconPageSize = 120;
  const iconPageCount = Math.max(1, Math.ceil(visibleOptions.length / iconPageSize));
  const safeIconPage = Math.min(iconPage, iconPageCount);
  const pagedOptions = visibleOptions.slice((safeIconPage - 1) * iconPageSize, safeIconPage * iconPageSize);
  return (
    <>
      <button
        className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm active:scale-[0.98]"
        onClick={() => {
          setOpen(true);
          setIconPage(1);
        }}
        type="button"
      >
        <SelectedIcon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
        <span className="truncate">{selected.label}</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/36 px-4 py-8">
          <div className="max-h-[86vh] w-[min(920px,96vw)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_34px_110px_-56px_rgba(0,0,0,0.75)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Icon library</p>
                <h3 className="mt-1 text-lg font-semibold">选择分类 Icon</h3>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-50" onClick={() => setOpen(false)} type="button">
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
            <div className="grid gap-4 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                  <SelectedIcon className="h-4 w-4 text-zinc-950" strokeWidth={1.8} />
                  当前：{selected.label}
                </div>
                <input
                  className="min-w-[260px] flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setIconPage(1);
                  }}
                  placeholder={`搜索 ${allCreativePackIconOptions.length}+ icons`}
                  value={query}
                />
                <span className="text-sm text-zinc-400">{visibleOptions.length} 个可选</span>
              </div>
              <div className="grid max-h-[52vh] grid-cols-8 gap-2 overflow-y-auto pr-1 sm:grid-cols-10 md:grid-cols-12">
                {pagedOptions.map((item) => {
                  const Icon = item.icon;
                  const active = item.name === selected.name;
                  return (
                    <button
                      aria-label={`Choose ${item.label} icon`}
                      className={active ? "grid h-12 place-items-center rounded-xl bg-zinc-950 text-white" : "grid h-12 place-items-center rounded-xl border border-zinc-100 text-zinc-500 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950"}
                      key={item.name}
                      onClick={() => {
                        onChange(item.name);
                        setOpen(false);
                      }}
                      title={`${item.label} (${item.name})`}
                      type="button"
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </button>
                  );
                })}
                {pagedOptions.length ? null : <span className="col-span-full px-2 py-8 text-center text-sm text-zinc-400">没有匹配的 icon</span>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                <span className="text-sm text-zinc-500">第 {safeIconPage} / {iconPageCount} 页</span>
                <div className="flex gap-2">
                  <button className="rounded-xl border border-zinc-200 px-3 py-2 text-sm disabled:opacity-40" disabled={safeIconPage <= 1} onClick={() => setIconPage((current) => Math.max(1, current - 1))} type="button">
                    上一页
                  </button>
                  <button className="rounded-xl border border-zinc-200 px-3 py-2 text-sm disabled:opacity-40" disabled={safeIconPage >= iconPageCount} onClick={() => setIconPage((current) => Math.min(iconPageCount, current + 1))} type="button">
                    下一页
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

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

function uniqueImages(images: Array<string | undefined | null>) {
  const seen = new Set<string>();
  return images
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

type MediaUploadResult = {
  asset?: {
    previewUrl?: string;
    storageKey?: string;
  };
  url?: string;
  error?: string;
};

function CreativePackImageManager({
  siteId,
  coverUrl,
  galleryImages,
  suggestedUrl,
  onCoverChange,
  onGalleryChange,
  onMessage
}: {
  siteId: string;
  coverUrl?: string;
  galleryImages?: string[];
  suggestedUrl?: string;
  onCoverChange: (value: string) => void;
  onGalleryChange: (value: string[]) => void;
  onMessage: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const images = useMemo(() => uniqueImages([coverUrl, ...(galleryImages ?? [])]), [coverUrl, galleryImages]);

  function commitImages(nextImages: string[]) {
    const cleaned = uniqueImages(nextImages);
    onCoverChange(cleaned[0] ?? "");
    onGalleryChange(cleaned);
  }

  function moveImage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    commitImages(next);
  }

  async function uploadFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        body.append("usage", "pack_cover");
        body.append("label", file.name.replace(/\.[^.]+$/, "") || "主题图片");
        const response = await fetch(`/api/sites/${siteId}/media-assets`, {
          method: "POST",
          body
        });
        const result = (await response.json().catch(() => ({}))) as MediaUploadResult;
        if (!response.ok) {
          throw new Error(result.error ?? "图片上传失败。");
        }
        const url = result.url ?? result.asset?.previewUrl ?? (result.asset?.storageKey ? `/assets/${result.asset.storageKey}` : "");
        if (url) uploaded.push(url);
      }
      commitImages([...images, ...uploaded]);
      onMessage(`已上传 ${uploaded.length} 张主题图片。首张图片会作为封面。`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "图片上传失败。");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-3 rounded-[14px] border border-zinc-200 bg-zinc-50 p-3 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-800">主题图片</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">上传后自动写入站点素材库。第一张为封面，其余图片用于主题详情页展示。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            multiple
            onChange={(event) => uploadFiles(event.target.files)}
            type="file"
          />
          <button
            className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-zinc-950 px-3 py-2 text-xs font-semibold text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <UploadCloud className="mr-1.5 h-4 w-4" strokeWidth={1.8} />
            {uploading ? "上传中" : "上传图片"}
          </button>
          {suggestedUrl ? (
            <button
              className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-black/10 bg-white px-3 py-2 text-xs active:scale-[0.98]"
              onClick={() => commitImages([suggestedUrl, ...images])}
              type="button"
            >
              使用建议图
            </button>
          ) : null}
          <button
            className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-red-100 bg-white px-3 py-2 text-xs text-red-600 active:scale-[0.98]"
            disabled={!images.length}
            onClick={() => commitImages([])}
            type="button"
          >
            清空图片
          </button>
        </div>
      </div>
      {images.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((imageUrl, index) => (
            <div className="overflow-hidden rounded-[12px] border border-zinc-200 bg-white" key={imageUrl}>
              <div className="relative aspect-[16/9] overflow-hidden bg-zinc-100">
                <img alt={`主题图片 ${index + 1}`} className="h-full w-full object-cover" src={imageUrl} />
                {index === 0 ? (
                  <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-zinc-950/82 px-2 py-1 text-[11px] font-semibold text-white">
                    <Star className="mr-1 h-3 w-3 fill-current" strokeWidth={1.8} />
                    封面
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 p-2">
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 disabled:opacity-35"
                  disabled={index === 0}
                  onClick={() => commitImages([imageUrl, ...images.filter((item) => item !== imageUrl)])}
                  title="设为封面"
                  type="button"
                >
                  <Star className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 disabled:opacity-35"
                  disabled={index === 0}
                  onClick={() => moveImage(index, -1)}
                  title="上移"
                  type="button"
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 disabled:opacity-35"
                  disabled={index === images.length - 1}
                  onClick={() => moveImage(index, 1)}
                  title="下移"
                  type="button"
                >
                  <ArrowDown className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <button
                  className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-600"
                  onClick={() => commitImages(images.filter((item) => item !== imageUrl))}
                  title="删除图片"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <button
          className="flex min-h-36 flex-col items-center justify-center rounded-[12px] border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500 active:scale-[0.99]"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <UploadCloud className="mb-2 h-6 w-6" strokeWidth={1.8} />
          还没有主题图片，点击上传图片。
        </button>
      )}
    </div>
  );
}

function CategoryImagePicker({
  siteId,
  value,
  onChange,
  onMessage
}: {
  siteId: string;
  value?: string;
  onChange: (value: string) => void;
  onMessage: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("usage", "pack_cover");
      body.append("label", file.name.replace(/\.[^.]+$/, "") || "分类封面");
      const response = await fetch(`/api/sites/${siteId}/media-assets`, {
        method: "POST",
        body
      });
      const result = (await response.json().catch(() => ({}))) as MediaUploadResult;
      if (!response.ok) throw new Error(result.error ?? "分类图片上传失败。");
      const url = result.url ?? result.asset?.previewUrl ?? (result.asset?.storageKey ? `/assets/${result.asset.storageKey}` : "");
      if (!url) throw new Error("分类图片上传后没有返回可用地址。");
      onChange(url);
      onMessage("分类封面图已上传，保存分类后生效。");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "分类图片上传失败。");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <input
        ref={inputRef}
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => uploadFile(event.target.files?.[0])}
        type="file"
      />
      {value ? (
        <img alt="分类封面预览" className="h-10 w-14 shrink-0 rounded-lg border border-zinc-200 object-cover" src={value} />
      ) : (
        <button
          className="grid h-10 w-14 shrink-0 place-items-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400"
          onClick={() => inputRef.current?.click()}
          title="上传分类封面"
          type="button"
        >
          <ImageIcon className="h-4 w-4" strokeWidth={1.8} />
        </button>
      )}
      <button
        className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {uploading ? "上传中" : "上传"}
      </button>
      <button
        className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg border border-red-100 bg-white px-2 text-xs text-red-600 disabled:opacity-35"
        disabled={!value}
        onClick={() => onChange("")}
        type="button"
      >
        清空
      </button>
    </div>
  );
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
  siteAiApps,
  initialCounts,
  initialTotal
}: {
  siteId: string;
  packs: CreativePack[];
  siteAiApps: SiteAiApp[];
  initialCounts?: {
    all: number;
    active: number;
    draft: number;
    paused: number;
  };
  initialTotal?: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(packs);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CreativePack["status"] | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [appFilter, setAppFilter] = useState("");
  const [categories, setCategories] = useState<CreativePackCategory[]>([]);
  const [categoryDraft, setCategoryDraft] = useState({ label: "", slug: "", parentId: "", icon: "", status: "active" as CreativePackCategory["status"] });
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryParentFilter, setCategoryParentFilter] = useState("");
  const [categoryKindFilter, setCategoryKindFilter] = useState<"children" | "parents" | "all">("children");
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(initialTotal ?? packs.length);
  const [counts, setCounts] = useState({
    all: initialCounts?.all ?? packs.length,
    active: initialCounts?.active ?? packs.filter((pack) => pack.status === "active").length,
    draft: initialCounts?.draft ?? packs.filter((pack) => pack.status === "draft").length,
    paused: initialCounts?.paused ?? packs.filter((pack) => pack.status === "paused").length
  });
  const [loading, setLoading] = useState(false);
  const [packsLoaded, setPacksLoaded] = useState(packs.length > 0);
  const [savingPackId, setSavingPackId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [draftPack, setDraftPack] = useState(() => createDraftPack(siteAiApps));
  const [message, setMessage] = useState("拍摄包会持久化并驱动前台商品入口。");

  const parentCategories = useMemo(() => categories.filter((category) => !category.parentId), [categories]);
  const selectedParentId = categoryParentFilter || parentCategories[0]?.id || "";
  const selectedParent = parentCategories.find((category) => category.id === selectedParentId) ?? parentCategories[0];
  const visibleCategories = useMemo(() => {
    const normalizedSearch = categorySearch.trim().toLowerCase();
    return categories.filter((category) => {
      if (categoryKindFilter === "parents" && category.parentId) return false;
      if (categoryKindFilter === "children" && !category.parentId) return false;
      if (categoryKindFilter === "children" && selectedParentId && category.parentId !== selectedParentId) return false;
      if (categoryKindFilter === "all" && selectedParentId && category.parentId && category.parentId !== selectedParentId) return false;
      if (!normalizedSearch) return true;
      return [category.label, category.slug, category.icon, category.iconName].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [categories, categoryKindFilter, categorySearch, selectedParentId]);
  const categoryPageCount = Math.max(1, Math.ceil(visibleCategories.length / categoryPageSize));
  const safeCategoryPage = Math.min(categoryPage, categoryPageCount);
  const pagedCategories = useMemo(
    () => visibleCategories.slice((safeCategoryPage - 1) * categoryPageSize, safeCategoryPage * categoryPageSize),
    [categoryPageSize, safeCategoryPage, visibleCategories]
  );
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
    setTotal(initialTotal ?? packs.length);
    setCounts({
      all: initialCounts?.all ?? packs.length,
      active: initialCounts?.active ?? packs.filter((pack) => pack.status === "active").length,
      draft: initialCounts?.draft ?? packs.filter((pack) => pack.status === "draft").length,
      paused: initialCounts?.paused ?? packs.filter((pack) => pack.status === "paused").length
    });
    if (packs.length > 0) {
      setItems(packs);
      setPacksLoaded(true);
      return;
    }
    if ((initialTotal ?? 0) === 0) {
      setItems([]);
      setPacksLoaded(true);
    }
  }, [initialCounts, initialTotal, packs]);

  useEffect(() => {
    setDraftPack(createDraftPack(siteAiApps));
  }, [siteAiApps]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadCategories() {
      try {
        const response = await fetch(`/api/sites/${siteId}/creative-pack-categories`, { method: "GET", signal: controller.signal });
        const result = (await response.json().catch(() => ({}))) as CategoryQueryResult;
        if (active && response.ok && result.categories) {
          setCategories(result.categories);
          const firstParent = result.categories.find((category) => !category.parentId);
          if (firstParent) {
            setCategoryParentFilter((current) => current || firstParent.id);
            setCategoryDraft((current) => current.parentId ? current : { ...current, parentId: firstParent.id });
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setMessage(error instanceof Error ? error.message : "分类加载失败。");
        }
      }
    }
    void loadCategories();
    return () => {
      active = false;
      controller.abort();
    };
  }, [siteId]);

  const editingPack = useMemo(() => items.find((pack) => pack.id === editingPackId) ?? null, [editingPackId, items]);

  async function queryPacks(next: Partial<{ page: number; pageSize: number; query: string; statusFilter: CreativePack["status"] | ""; categoryFilter: string; appFilter: string }> = {}, signal?: AbortSignal) {
    const nextPage = next.page ?? page;
    const nextPageSize = next.pageSize ?? pageSize;
    const nextQuery = next.query ?? query;
    const nextStatus = next.statusFilter ?? statusFilter;
    const nextCategory = next.categoryFilter ?? categoryFilter;
    const nextApp = next.appFilter ?? appFilter;
    const params = new URLSearchParams({
      admin: "1",
      page: String(nextPage),
      pageSize: String(nextPageSize)
    });
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextStatus) params.set("status", nextStatus);
    if (nextCategory) params.set("category", nextCategory);
    if (nextApp) params.set("app", nextApp);
    try {
      setLoading(true);
      const response = await fetch(`/api/sites/${siteId}/creative-packs?${params.toString()}`, { method: "GET", signal });
      const result = (await response.json().catch(() => ({}))) as CreativePackQueryResult;
      if (signal?.aborted) return;
      if (response.ok && result.packs) {
        setItems(result.packs);
        setPacksLoaded(true);
        setTotal(result.total ?? result.packs.length);
        setPage(result.page ?? nextPage);
        setPageSize(result.pageSize ?? nextPageSize);
        setCounts((current) => ({
          all: result.counts?.all ?? current.all,
          active: result.counts?.active ?? current.active,
          draft: result.counts?.draft ?? current.draft,
          paused: result.counts?.paused ?? current.paused
        }));
        setMessage(`已查询到 ${result.total ?? result.packs.length} 个拍摄包。`);
        return;
      }
      setMessage(result.error ?? "拍摄包查询失败。");
    } catch (error) {
      if (!signal?.aborted) {
        setMessage(error instanceof Error ? error.message : "拍摄包查询失败。");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadInitialPacks() {
      const params = new URLSearchParams({
        admin: "1",
        page: "1",
        pageSize: "10"
      });
      try {
        setLoading(true);
        const response = await fetch(`/api/sites/${siteId}/creative-packs?${params.toString()}`, { method: "GET", signal: controller.signal });
        const result = (await response.json().catch(() => ({}))) as CreativePackQueryResult;
        if (!active || controller.signal.aborted) return;
        if (response.ok && result.packs) {
          setItems(result.packs);
          setPacksLoaded(true);
          setTotal(result.total ?? result.packs.length);
          setPage(result.page ?? 1);
          setPageSize(result.pageSize ?? 10);
          setCounts((current) => ({
            all: result.counts?.all ?? current.all,
            active: result.counts?.active ?? current.active,
            draft: result.counts?.draft ?? current.draft,
            paused: result.counts?.paused ?? current.paused
          }));
          setMessage(`已查询到 ${result.total ?? result.packs.length} 个拍摄包。`);
          return;
        }
        setMessage(result.error ?? "拍摄包查询失败。");
      } catch (error) {
        if (!controller.signal.aborted) {
          setMessage(error instanceof Error ? error.message : "拍摄包查询失败。");
        }
      } finally {
        if (active && !controller.signal.aborted) setLoading(false);
      }
    }
    void loadInitialPacks();
    return () => {
      active = false;
      controller.abort();
    };
  }, [siteId]);

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
      setCategoryDraft({ label: "", slug: "", parentId: "", icon: "", status: "active" });
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
        <div className="mt-4 grid gap-3 rounded-[12px] border border-zinc-100 bg-zinc-50 p-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto_auto]">
          <input className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setCategoryDraft((current) => ({ ...current, label: event.target.value }))} placeholder="分类名称，如 Wedding & Romance" value={categoryDraft.label} />
          <input className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setCategoryDraft((current) => ({ ...current, slug: event.target.value }))} placeholder="URL slug，可留空自动生成" value={categoryDraft.slug} />
          <select className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => setCategoryDraft((current) => ({ ...current, parentId: event.target.value }))} value={categoryDraft.parentId}>
            <option value="">作为一级分类</option>
            {parentCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
          <CategoryIconPicker onChange={(icon) => setCategoryDraft((current) => ({ ...current, icon }))} value={categoryDraft.icon} />
          <button className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-zinc-950 px-4 py-2 text-sm text-white active:scale-[0.98]" onClick={createCategory} type="button">
            新增分类
          </button>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-[12px] border border-zinc-100 bg-zinc-50 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-700">一级分类</span>
              <span className="rounded-full bg-white px-2 py-1 text-xs text-zinc-500">{parentCategories.length}</span>
            </div>
            <div className="grid max-h-[520px] gap-1 overflow-y-auto pr-1">
              {parentCategories.map((parent) => {
                const childCount = categories.filter((category) => category.parentId === parent.id).length;
                const active = parent.id === selectedParent?.id;
                return (
                  <button
                    className={active ? "flex items-center justify-between gap-2 rounded-xl bg-zinc-950 px-3 py-2 text-left text-sm text-white" : "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm text-zinc-600 hover:bg-white hover:text-zinc-950"}
                    key={parent.id}
                    onClick={() => {
                      setCategoryParentFilter(parent.id);
                      setCategoryKindFilter("children");
                      setCategoryDraft((current) => ({ ...current, parentId: parent.id }));
                      setCategoryPage(1);
                    }}
                    type="button"
                  >
                    <span className="truncate">{parent.label}</span>
                    <span className={active ? "text-white/58" : "text-zinc-400"}>{childCount}</span>
                  </button>
                );
              })}
            </div>
          </aside>
          <div className="overflow-hidden rounded-[12px] border border-zinc-100 bg-white">
            <div className="grid gap-3 border-b border-zinc-100 bg-zinc-50 p-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.65fr)]">
              <input
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                onChange={(event) => {
                  setCategorySearch(event.target.value);
                  setCategoryPage(1);
                }}
                placeholder="搜索分类名称、slug、icon..."
                value={categorySearch}
              />
              <select
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                onChange={(event) => {
                  setCategoryParentFilter(event.target.value);
                  setCategoryPage(1);
                }}
                value={selectedParentId}
              >
                {parentCategories.map((parent) => (
                  <option key={parent.id} value={parent.id}>{parent.label}</option>
                ))}
              </select>
              <select
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                onChange={(event) => {
                  setCategoryKindFilter(event.target.value as "children" | "parents" | "all");
                  setCategoryPage(1);
                }}
                value={categoryKindFilter}
              >
                <option value="children">查看二级分类</option>
                <option value="parents">查看一级分类</option>
                <option value="all">查看全部</option>
              </select>
            </div>
            <div className="grid grid-cols-[1.1fr_1fr_0.9fr_0.65fr_1fr_88px] gap-3 border-b border-zinc-100 bg-white px-3 py-2 text-xs font-semibold text-zinc-500">
              <span>分类名称</span>
              <span>Slug</span>
              <span>父级</span>
              <span>Icon</span>
              <span>封面图</span>
              <span className="text-right">操作</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {pagedCategories.map((category) => (
                <div className="grid grid-cols-[1.1fr_1fr_0.9fr_0.65fr_1fr_88px] items-center gap-3 px-3 py-3" key={category.id}>
                  <input className="min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => updateCategory(category.id, { label: event.target.value })} value={category.label} />
                  <input className="min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => updateCategory(category.id, { slug: event.target.value })} value={category.slug} />
                  <select className="min-w-0 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm" onChange={(event) => updateCategory(category.id, { parentId: event.target.value || undefined })} value={category.parentId ?? ""}>
                    <option value="">一级分类</option>
                    {parentCategories.filter((parent) => parent.id !== category.id).map((parent) => (
                      <option key={parent.id} value={parent.id}>{parent.label}</option>
                    ))}
                  </select>
                  <CategoryIconPicker onChange={(icon) => updateCategory(category.id, { icon })} value={category.icon ?? category.iconName ?? ""} />
                  <CategoryImagePicker
                    onChange={(imageUrl) => updateCategory(category.id, { imageUrl })}
                    onMessage={setMessage}
                    siteId={siteId}
                    value={category.imageUrl}
                  />
                  <button className="justify-self-end whitespace-nowrap rounded-xl border border-black/10 px-4 py-2 text-sm active:scale-[0.98]" onClick={() => saveCategory(category)} type="button">
                    保存
                  </button>
                </div>
              ))}
              {pagedCategories.length ? null : (
                <div className="px-4 py-10 text-center text-sm text-zinc-500">没有匹配的分类。</div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-3 py-3 text-sm text-zinc-500">
              <span>显示 {visibleCategories.length ? (safeCategoryPage - 1) * categoryPageSize + 1 : 0}-{Math.min(visibleCategories.length, safeCategoryPage * categoryPageSize)} / 共 {visibleCategories.length} 个分类</span>
              <div className="flex items-center gap-2">
                <select className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5" onChange={(event) => { setCategoryPageSize(Number(event.target.value)); setCategoryPage(1); }} value={categoryPageSize}>
                  {[10, 20, 50].map((size) => <option key={size} value={size}>每页 {size}</option>)}
                </select>
                <button className="rounded-lg border border-zinc-200 px-3 py-1.5 disabled:opacity-40" disabled={safeCategoryPage <= 1} onClick={() => setCategoryPage((current) => Math.max(1, current - 1))} type="button">上一页</button>
                <span>{safeCategoryPage} / {categoryPageCount}</span>
                <button className="rounded-lg border border-zinc-200 px-3 py-1.5 disabled:opacity-40" disabled={safeCategoryPage >= categoryPageCount} onClick={() => setCategoryPage((current) => Math.min(categoryPageCount, current + 1))} type="button">下一页</button>
              </div>
            </div>
          </div>
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
          <CreativePackImageManager
            coverUrl={draftPack.imageUrl}
            galleryImages={draftPack.galleryImages}
            onCoverChange={(value) => updateDraft("imageUrl", value)}
            onGalleryChange={(value) => updateDraft("galleryImages", value)}
            onMessage={setMessage}
            siteId={siteId}
            suggestedUrl={suggestedCreativePackCover(draftPack)}
          />
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
        {!packsLoaded || (loading && !items.length) ? (
          <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50 px-5 py-10 text-center text-sm text-blue-700 sm:col-span-2 xl:col-span-4">
            正在加载拍摄包列表...
          </div>
        ) : null}
        {packsLoaded && !loading && !items.length ? (
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
                <CreativePackImageManager
                  coverUrl={editingPack.imageUrl}
                  galleryImages={editingPack.galleryImages}
                  onCoverChange={(value) => update(editingPack.id, "imageUrl", value)}
                  onGalleryChange={(value) => update(editingPack.id, "galleryImages", value)}
                  onMessage={setMessage}
                  siteId={siteId}
                  suggestedUrl={suggestedCreativePackCover(editingPack)}
                />
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
