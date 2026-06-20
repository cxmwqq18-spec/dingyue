"use client";

import { useEffect, useState } from "react";
import { Box, FileText, ImageIcon, Link2, ShoppingBag } from "lucide-react";
import {
  DesignerResourceCard,
  DesignerResourceCloseButton,
  DesignerResourceEmptyState,
  DesignerResourceInlineSummary,
  DesignerResourceModalOverlay,
  DesignerResourceModalPanel,
  DesignerResourceModalSidebar,
  DesignerResourceModalToolbar,
  DesignerResourceTrigger
} from "@/components/designer/designer-resource-primitives";
import { resolveMediaAssetUrl } from "@/lib/media";
import type { CreativePack, Product, Site, ThemePage, ThemeSettingValue } from "@/lib/types";
import type { FieldOptions, ResourceSelectorKind, ResourceSelectorOption, SaasSelectorValue } from "@/components/designer/field-editor-types";

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
  if (value.startsWith("http")) return "/assets/dreamshoot/generated/20260619/world-cup-fan-star-clean-v1.png";
  const images = [
    "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
    "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
    "/assets/dreamshoot/generated/20260619/world-cup-fan-star-clean-v1.png",
    "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png",
    "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png",
    "/assets/dreamshoot/generated/20260619/nature-adventure-solo-v1.png"
  ];
  const hash = [...value].reduce((total, char) => total + char.charCodeAt(0), 0);
  return images[hash % images.length];
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
    if (!open) setQuery("");
  }, [open]);

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
        title={selectedItem?.title || currentLabel}
      />
      <DesignerResourceInlineSummary
        data-designer-modal={open ? "saas-resource-selector-open" : "saas-resource-selector"}
        description={`${modalLabel}，共 ${items.length} 项。`}
        title="资源选择器"
      />
      {open ? (
        <DesignerResourceModalOverlay data-designer-modal="saas-resource-selector">
          <DesignerResourceModalPanel data-designer-modal-kind={kind}>
            <div className="grid max-h-[86dvh] min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-white">
              <DesignerResourceModalSidebar
                description="选择当前站点可用资源，保存后会直接写入当前模块字段。"
                eyebrow={modalLabel}
                icon={<Icon className="h-5 w-5" strokeWidth={1.8} />}
                stats={[
                  { label: "资源类型", value: kind },
                  { label: "可选数量", value: items.length },
                  { label: "作用范围", value: "当前站点" }
                ]}
                title={title}
              />
              <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 p-4">
                <DesignerResourceModalToolbar
                  actions={<DesignerResourceCloseButton onClick={() => setOpen(false)} />}
                  onQueryChange={setQuery}
                  query={query}
                  queryPlaceholder="搜索名称、路径、状态"
                />
                <div className="grid max-h-[54dvh] gap-1.5 overflow-auto pr-1 md:grid-cols-2">
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
                          setOpen(false);
                        }}
                        preview={item.preview}
                        selected={isSelected}
                        subtitle={item.subtitle}
                        title={item.title}
                        tone={item.tone ?? "neutral"}
                      />
                    );
                  }) : (
                    <DesignerResourceEmptyState className="md:col-span-2">
                      没有匹配到可用资源。
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
                      <button
                        className="rounded-[2px] border border-[#c4c7cc] bg-white px-4 py-2 text-sm font-medium text-[#383838] transition hover:border-[#479dff] hover:text-[#479dff] active:scale-[0.98]"
                        onClick={() => setOpen(false)}
                        type="button"
                      >
                        使用
                      </button>
                    </div>
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
