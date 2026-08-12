"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Box, FileText, ImageIcon, Link2, ShoppingBag, Trash2, UploadCloud, XCircle } from "lucide-react";
import {
  DesignerResourceCard,
  DesignerResourceCloseButton,
  DesignerResourceEmptyState,
  DesignerResourceInlineSummary,
  DesignerResourceModalOverlay,
  DesignerResourceModalPanel,
  DesignerResourceModalSidebar,
  DesignerResourceModalToolbar,
  DesignerResourcePreviewMedia,
  DesignerResourceTrigger
} from "@/components/designer/designer-resource-primitives";
import { csrfHeader } from "@/lib/client-csrf";
import { resolveMediaAssetUrl } from "@/lib/media";
import type { CreativePack, MediaAsset, Product, Site, ThemePage, ThemeSettingValue } from "@/lib/types";
import type { DesignerResourceKind, FieldOptions, ResourceSelectorKind, ResourceSelectorOption, SaasSelectorValue } from "@/components/designer/field-editor-types";

function stringifyValue(value: ThemeSettingValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map((item) => stringifyValue(item)).filter(Boolean).join("\n");
  if (typeof value === "object") {
    const family = value.family;
    const url = value.url;
    const title = value.title;
    const id = value.id;
    if (typeof family === "string") return family;
    if (typeof url === "string") return url;
    if (typeof title === "string") return title;
    if (typeof id === "string" || typeof id === "number") return String(id);
    return "";
  }
  return String(value);
}

function isThemeRecord(value: ThemeSettingValue | undefined): value is Record<string, ThemeSettingValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordString(record: Record<string, ThemeSettingValue>, key: string, fallback = ""): string {
  const value = record[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

export function selectorJson(selector: SaasSelectorValue): string {
  return JSON.stringify(selector);
}

export function parseSelectorJson(value: string): SaasSelectorValue | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const record = parsed as Record<string, unknown>;
    return {
      id: typeof record.id === "string" || typeof record.id === "number" ? String(record.id) : "",
      title: typeof record.title === "string" || typeof record.title === "number" ? String(record.title) : "",
      url: typeof record.url === "string" || typeof record.url === "number" ? String(record.url) : "",
      type: typeof record.type === "string" || typeof record.type === "number" ? String(record.type) : ""
    };
  } catch {
    return undefined;
  }
}

export function selectorFromValue(value: ThemeSettingValue | undefined, fallbackType: string): SaasSelectorValue {
  if (isThemeRecord(value)) {
    const id = recordString(value, "id");
    const title = recordString(value, "title", id);
    const url = recordString(value, "url", id);
    const type = recordString(value, "type", fallbackType);
    return { id, title, url, type };
  }
  const raw = stringifyValue(value);
  return { id: raw, title: raw, url: raw, type: fallbackType };
}

export function pageSelector(page: ThemePage): SaasSelectorValue {
  return { id: page.id, title: page.title, url: page.slug || "/", type: "pages" };
}

export function productSelector(product: Product): SaasSelectorValue {
  return {
    id: product.id,
    title: product.name,
    url: product.type === "subscription" ? "/pricing" : "/login",
    type: "product"
  };
}

export function collectionSelector(pack: CreativePack, type = "collection"): SaasSelectorValue {
  return {
    id: pack.id,
    title: pack.name,
    url: `/tools/${pack.aiAppSlug}`,
    type
  };
}

export function staticUrlSelector(type: "none" | "index" | "urls", url?: string): SaasSelectorValue {
  if (type === "none") return { id: "none", title: "无", url: "javascript:void(0);", type };
  if (type === "index") return { id: "index", title: "首页", url: "/", type };
  const safeUrl = url?.trim() || "/";
  return { id: safeUrl, title: safeUrl, url: safeUrl, type };
}

function mediaPreviewForStorageKey(value: string): string {
  if (!value) return "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png";
  if (value.startsWith("/assets/")) return value;
  if (value.startsWith("/themes/")) return "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png";
  if (value.startsWith("http")) return "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png";
  const images = [
    "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
    "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
    "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png",
    "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png",
    "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png",
    "/assets/dreamshoot/generated/20260619/nature-adventure-solo-v1.png"
  ];
  const hash = [...value].reduce((total, char) => total + char.charCodeAt(0), 0);
  return images[hash % images.length];
}

function mediaPreviewType(mimeType?: string): "image" | "video" {
  return mimeType?.startsWith("video/") ? "video" : "image";
}

function assetMatchesValue(asset: ResourceSelectorOption | undefined, value: string) {
  if (!asset) return false;
  return asset.value === value || asset.id === value || asset.detail === value;
}

function selectedMediaAssetLabel(item: ResourceSelectorOption | undefined, fallback: string) {
  if (item?.title) return item.title;
  return fallback.trim() || "当前素材";
}

function resourceOptions(kind: ResourceSelectorKind, options: FieldOptions, site: Site): ResourceSelectorOption[] {
  if (kind === "media") {
    return options.mediaAssets.map((asset) => ({
      id: asset.id,
      title: asset.label,
      subtitle:
        asset.usage === "theme"
          ? "主题素材"
          : asset.usage === "brand"
          ? "品牌素材"
          : asset.usage === "pack_cover"
          ? "封面素材"
          : asset.usage === "policy"
          ? "政策素材"
          : "媒体素材",
      detail: asset.storageKey,
      value: asset.storageKey,
      preview: asset.previewUrl || resolveMediaAssetUrl(site, asset.id || asset.storageKey) || mediaPreviewForStorageKey(asset.storageKey),
      previewType: mediaPreviewType(asset.mimeType),
      meta: [asset.mimeType, asset.sourceType ?? "manual", new Date(asset.createdAt).toLocaleDateString("zh-CN")],
      tone: asset.usage === "theme" ? "good" : "neutral"
    }));
  }
  if (kind === "collection") {
    return options.creativePacks.map((pack) => ({
      id: pack.id,
      title: pack.name,
      subtitle: pack.category,
      detail: pack.headline,
      value: selectorJson(collectionSelector(pack)),
      preview: mediaPreviewForStorageKey(`${pack.id}-${pack.category}`),
      meta: [`${pack.creditCost} credits`, `${pack.outputCount} outputs`, pack.status === "active" ? "启用" : pack.status === "paused" ? "暂停" : pack.status],
      tone: pack.status === "active" ? "good" : pack.status === "paused" ? "warn" : "neutral"
    }));
  }
  if (kind === "product") {
    return options.products.map((product) => ({
      id: product.id,
      title: product.name,
      subtitle: product.type === "subscription" ? "订阅商品" : "积分包商品",
      detail: product.prices.map((price) => `${price.label} ${price.amountCents / 100} ${price.currency.toUpperCase()}`).join(" / "),
      value: selectorJson(productSelector(product)),
      preview: mediaPreviewForStorageKey(`${product.id}-${product.type}`),
      meta: [`${product.prices.length} 个价格`, product.status === "active" ? "启用" : product.status],
      tone: product.status === "active" ? "good" : "warn"
    }));
  }
  if (kind === "page") {
    return options.pages.map((page) => ({
      id: page.id,
      title: page.title,
      subtitle: `${page.pageType} / ${page.templateKey ?? "template"}`,
      detail: page.slug,
      value: selectorJson(pageSelector(page)),
      meta: [`v${page.draftJson.version}`, `${page.draftJson.sectionsOrder.length} 个模块`],
      tone: "neutral"
    }));
  }
  return [
    {
      id: "none",
      title: "无",
      subtitle: "不跳转",
      detail: "javascript:void(0);",
      value: selectorJson(staticUrlSelector("none")),
      meta: ["无"],
      tone: "neutral"
    },
    {
      id: "index",
      title: "首页",
      subtitle: "站点首页",
      detail: "/",
      value: selectorJson(staticUrlSelector("index")),
      meta: ["首页"],
      tone: "good"
    },
    ...options.creativePacks.map((pack) => ({
      id: `category:${pack.id}`,
      title: pack.name,
      subtitle: "专辑详情页",
      detail: `/tools/${pack.aiAppSlug}`,
      value: selectorJson(collectionSelector(pack, "category")),
      preview: mediaPreviewForStorageKey(`${pack.id}-${pack.category}`),
      meta: [pack.category, pack.status],
      tone: pack.status === "active" ? "good" as const : "warn" as const
    })),
    ...options.products.map((product) => ({
      id: `product:${product.id}`,
      title: product.name,
      subtitle: "商品详情页",
      detail: product.type === "subscription" ? "/pricing" : "/login",
      value: selectorJson(productSelector(product)),
      preview: mediaPreviewForStorageKey(`${product.id}-${product.type}`),
      meta: [product.type, product.status],
      tone: product.status === "active" ? "good" as const : "warn" as const
    })),
    ...options.pages.map((page) => ({
      id: `pages:${page.id}`,
      title: page.title,
      subtitle: "页面详情页",
      detail: page.slug,
      value: selectorJson(pageSelector(page)),
      meta: [page.pageType, page.templateKey ?? "page"],
      tone: "neutral" as const
    }))
  ];
}

function resourceKindsForSelector(kind: ResourceSelectorKind): DesignerResourceKind[] {
  if (kind === "media") return ["mediaAssets"];
  if (kind === "collection") return ["creativePacks"];
  if (kind === "product") return ["products"];
  if (kind === "url") return ["creativePacks", "products"];
  return [];
}

export function ResourceSelector({
  kind,
  title,
  currentLabel,
  selectedValue,
  options,
  onSelect,
  site
}: {
  kind: ResourceSelectorKind;
  title: string;
  currentLabel: string;
  selectedValue: string;
  options: FieldOptions;
  onSelect: (value: string) => void;
  site: Site;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadUsage, setUploadUsage] = useState<MediaAsset["usage"]>("theme");
  const resourceKinds = useMemo(() => resourceKindsForSelector(kind), [kind]);
  const requestResourceRef = useRef(options.requestResource);
  const resourceStatusRef = useRef(options.resourceStatus);
  const resourceStatus = resourceKinds.some((item) => options.resourceStatus?.[item] === "loading")
    ? "loading"
    : resourceKinds.some((item) => options.resourceStatus?.[item] === "error")
    ? "error"
    : resourceKinds.every((item) => options.resourceStatus?.[item] === "ready")
    ? "ready"
    : resourceKinds.length
    ? "idle"
    : "ready";
  const items = resourceOptions(kind, options, site);
  const filtered = items.filter((item) => {
    const haystack = `${item.title} ${item.subtitle} ${item.detail} ${item.meta?.join(" ") ?? ""}`.toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  });
  const selectedItem = items.find((item) => item.value === selectedValue || item.id === selectedValue || item.detail === selectedValue);
  const Icon = kind === "media" ? ImageIcon : kind === "collection" ? Box : kind === "product" ? ShoppingBag : kind === "page" ? FileText : Link2;
  const modalLabel = {
    media: "素材选择",
    collection: "集合选择",
    product: "商品选择",
    page: "页面选择",
    url: "链接选择"
  }[kind];

  useEffect(() => {
    if (!open) {
      setQuery("");
      setStatusMessage("");
    }
  }, [open]);

  useEffect(() => {
    requestResourceRef.current = options.requestResource;
    resourceStatusRef.current = options.resourceStatus;
  }, [options.requestResource, options.resourceStatus]);

  useEffect(() => {
    const currentStatus = resourceKinds.some((item) => resourceStatusRef.current?.[item] === "loading")
      ? "loading"
      : resourceKinds.every((item) => resourceStatusRef.current?.[item] === "ready")
      ? "ready"
      : "idle";
    if (!open || currentStatus === "loading" || currentStatus === "ready") return;
    const controller = new AbortController();
    for (const resourceKind of resourceKinds) {
      void requestResourceRef.current?.(resourceKind, { signal: controller.signal });
    }
    return () => controller.abort();
  }, [open, resourceKinds]);

  async function handleMediaUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || kind !== "media") return;
    setMediaBusy(true);
    setStatusMessage("正在上传素材...");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("label", uploadLabel.trim() || file.name);
      form.append("usage", uploadUsage);
      const response = await fetch(`/api/sites/${site.id}/media-assets`, {
        method: "POST",
        headers: csrfHeader(`site_admin_csrf_${site.id}`),
        body: form
      });
      const body = (await response.json().catch(() => ({}))) as { asset?: MediaAsset; error?: string };
      if (!response.ok || !body.asset) {
        setStatusMessage(body.error ? `上传失败：${body.error}` : "上传失败，请检查文件类型和大小。");
        return;
      }
      options.upsertMediaAsset?.(body.asset);
      onSelect(body.asset.storageKey);
      setUploadLabel("");
      setStatusMessage("已上传并选中素材，左侧草稿预览会自动同步；发布后才上线。");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "上传失败，请稍后重试。");
    } finally {
      setMediaBusy(false);
    }
  }

  async function handleDeleteMediaAsset(item: ResourceSelectorOption | undefined) {
    if (kind !== "media" || !item?.id) return;
    const label = selectedMediaAssetLabel(item, selectedValue);
    if (!window.confirm(`删除素材「${label}」？删除后素材库不再显示它，当前字段会取消选择。`)) return;
    setMediaBusy(true);
    setStatusMessage("正在删除素材...");
    try {
      const response = await fetch(`/api/sites/${site.id}/media-assets/${item.id}`, {
        method: "DELETE",
        headers: csrfHeader(`site_admin_csrf_${site.id}`)
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatusMessage(body.error ? `删除失败：${body.error}` : "删除失败，请稍后重试。");
        return;
      }
      options.removeMediaAsset?.(item.id);
      if (assetMatchesValue(item, selectedValue)) onSelect("");
      setStatusMessage("素材已删除，当前字段已取消选择；左侧草稿预览会自动同步。");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "删除失败，请稍后重试。");
    } finally {
      setMediaBusy(false);
    }
  }

  function handleClearMediaSelection() {
    if (kind !== "media") return;
    onSelect("");
    setStatusMessage("已取消当前字段的素材选择；左侧草稿预览会自动同步。");
  }

  return (
    <div className="grid gap-2" data-designer-selector={`saas-${kind}-resource-selector`}>
      <DesignerResourceTrigger
        detail={selectedItem ? (selectedItem.subtitle || selectedItem.detail) : undefined}
        icon={<Icon className="h-4 w-4" strokeWidth={1.8} />}
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
        preview={selectedItem?.preview}
        previewType={selectedItem?.previewType}
        title={selectedItem?.title || currentLabel}
      />
      <DesignerResourceInlineSummary
        data-designer-modal={open ? "saas-resource-selector-open" : "saas-resource-selector"}
        description={resourceStatus === "loading" ? `${modalLabel}加载中...` : resourceStatus === "error" ? `${modalLabel}加载失败，可重新打开重试。` : `${modalLabel}，共 ${items.length} 项。`}
        title="资源选择器"
      />
      {open ? (
        <DesignerResourceModalOverlay data-designer-modal="saas-resource-selector">
          <DesignerResourceModalPanel data-designer-modal-kind={kind}>
            <div className="grid max-h-[86dvh] min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-white">
              <DesignerResourceModalSidebar
                description={kind === "media" ? "上传或选择当前站点素材，左侧草稿预览会自动同步，发布后才上线。" : "选择当前站点可用资源，保存草稿后写入当前模块字段。"}
                eyebrow={modalLabel}
                icon={<Icon className="h-5 w-5" strokeWidth={1.8} />}
                stats={[
                  { label: "资源类型", value: kind },
                  { label: "可选数量", value: items.length },
                  { label: "作用范围", value: "当前站点" }
                ]}
                title={title}
              />
              <div className="flex min-h-0 flex-col gap-3 p-4">
                <DesignerResourceModalToolbar
                  actions={<DesignerResourceCloseButton onClick={() => setOpen(false)} />}
                  onQueryChange={setQuery}
                  query={query}
                  queryPlaceholder="搜索名称、路径、状态"
                />
                {kind === "media" ? (
                  <div className="grid gap-2 rounded-[2px] border border-[#d7dce4] bg-[#f7f8fb] p-3" data-designer-media-library-actions>
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_auto]">
                      <input
                        className="min-w-0 rounded-[2px] border border-[#c4c7cc] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#479dff]"
                        onChange={(event) => setUploadLabel(event.target.value)}
                        placeholder="上传后显示名称，可留空使用文件名"
                        value={uploadLabel}
                      />
                      <select
                        className="rounded-[2px] border border-[#c4c7cc] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#479dff]"
                        onChange={(event) => setUploadUsage(event.target.value as MediaAsset["usage"])}
                        value={uploadUsage}
                      >
                        <option value="theme">主题素材</option>
                        <option value="brand">品牌素材</option>
                        <option value="pack_cover">封面素材</option>
                        <option value="policy">政策素材</option>
                      </select>
                      <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[2px] border border-[#c4c7cc] bg-white px-4 text-sm font-medium text-[#383838] transition hover:border-[#479dff] hover:text-[#479dff]">
                        <UploadCloud className="h-4 w-4" strokeWidth={1.8} />
                        上传图片/视频
                        <input
                          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                          className="sr-only"
                          data-designer-media-upload-input
                          disabled={mediaBusy}
                          onChange={handleMediaUpload}
                          type="file"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#667085]">
                      <span>图片最大 12MB，视频最大 80MB。</span>
                      {mediaBusy ? <span className="text-[#b06d2c]">处理中...</span> : null}
                      {statusMessage ? <span className="text-[#2457c5]">{statusMessage}</span> : null}
                    </div>
                  </div>
                ) : null}
                <div className="grid min-h-[180px] flex-1 gap-1.5 overflow-auto pr-1 md:grid-cols-2">
                  {filtered.length ? filtered.map((item) => {
                    const isSelected = item.value === selectedValue || item.id === selectedValue || item.detail === selectedValue;
                    return (
                      <DesignerResourceCard
                        detail={item.detail}
                        icon={<Icon className="h-5 w-5 text-zinc-500" strokeWidth={1.8} />}
                        key={`${kind}:${item.id}`}
                        meta={item.meta ?? []}
                        onClick={(event) => {
                          event.preventDefault();
                          onSelect(item.value);
                          if (kind === "media") {
                            setStatusMessage("已选中素材，左侧草稿预览会自动同步；确认后可关闭弹窗。");
                            return;
                          }
                          setOpen(false);
                        }}
                        preview={item.preview}
                        previewType={item.previewType}
                        selected={isSelected}
                        subtitle={item.subtitle}
                        title={item.title}
                        tone={item.tone ?? "neutral"}
                      />
                    );
                  }) : (
                    <DesignerResourceEmptyState className="md:col-span-2">
                      {resourceStatus === "loading" ? "资源加载中..." : resourceStatus === "error" ? "资源加载失败，请关闭后重试。" : "没有匹配到可用资源。"}
                    </DesignerResourceEmptyState>
                  )}
                </div>
                {kind === "media" || kind === "url" ? (
                  <div className="rounded-[2px] border border-[#d7dce4] bg-[#f7f8fb] p-3">
                    <p className="text-sm font-medium leading-5 text-[#383838]">{kind === "media" ? "手动填写素材地址" : "手动填写链接地址"}</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                      <input
                        className="min-w-0 rounded-[2px] border border-[#c4c7cc] bg-white px-3 py-2 font-mono text-xs outline-none transition focus:border-[#479dff]"
                        onChange={(event) => {
                          if (kind === "media") onSelect(event.target.value);
                          if (kind === "url") onSelect(selectorJson(staticUrlSelector("urls", event.target.value)));
                        }}
                        placeholder={kind === "media" ? "填写 storage key、/assets 路径或 CDN 地址" : "填写 /pricing、/tools/xxx 或 https://..."}
                        value={kind === "media" ? selectedValue : selectorFromValue(selectedValue, "urls").url}
                      />
                      <div className="flex items-center gap-2">
                        {kind === "media" ? (
                          <button
                            className="inline-flex h-10 items-center gap-1.5 rounded-[2px] border border-[#c4c7cc] bg-white px-3 text-sm font-medium text-[#383838] transition hover:border-[#479dff] hover:text-[#479dff] active:scale-[0.98]"
                            onClick={handleClearMediaSelection}
                            type="button"
                          >
                            <XCircle className="h-4 w-4" strokeWidth={1.8} />
                            取消选择
                          </button>
                        ) : null}
                        <button
                          className="rounded-[2px] border border-[#c4c7cc] bg-white px-4 py-2 text-sm font-medium text-[#383838] transition hover:border-[#479dff] hover:text-[#479dff] active:scale-[0.98]"
                          onClick={() => setOpen(false)}
                          type="button"
                        >
                          使用
                        </button>
                      </div>
                    </div>
                    {kind === "media" && selectedItem ? (
                      <div className="mt-3 grid gap-3 rounded-[2px] border border-[#d7dce4] bg-white p-3 md:grid-cols-[120px_1fr_auto]">
                        <div className="grid h-[82px] w-full place-items-center overflow-hidden rounded-[2px] border border-[#d7dce4] bg-[#f2f3f5]">
                          {selectedItem.preview ? (
                            <DesignerResourcePreviewMedia
                              className="h-full w-full object-cover"
                              controls={selectedItem.previewType === "video"}
                              preview={selectedItem.preview}
                              previewType={selectedItem.previewType}
                              title={selectedItem.title}
                            />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-[#7c8087]" strokeWidth={1.8} />
                          )}
                        </div>
                        <div className="min-w-0 text-sm">
                          <p className="truncate font-medium text-[#212121]">{selectedItem.title}</p>
                          <p className="mt-1 truncate font-mono text-[11px] text-[#7c8087]">{selectedItem.detail}</p>
                          <p className="mt-1 text-xs text-[#667085]">{selectedItem.meta?.filter(Boolean).join(" / ")}</p>
                        </div>
                        <div className="flex flex-wrap items-start gap-2 md:flex-col">
                          <button
                            className="inline-flex h-9 items-center justify-center rounded-[2px] border border-[#c4c7cc] bg-white px-3 text-sm font-medium text-[#383838] transition hover:border-[#479dff] hover:text-[#479dff]"
                            onClick={() => setOpen(false)}
                            type="button"
                          >
                            使用当前素材
                          </button>
                          <button
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[2px] border border-[#ffd0d0] bg-white px-3 text-sm font-medium text-[#b42318] transition hover:bg-[#fff1f1]"
                            disabled={mediaBusy}
                            onClick={() => void handleDeleteMediaAsset(selectedItem)}
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                            删除素材
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </DesignerResourceModalPanel>
        </DesignerResourceModalOverlay>
      ) : null}
    </div>
  );
}
