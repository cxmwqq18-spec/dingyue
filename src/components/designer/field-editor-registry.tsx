"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { fieldDisplayLabel, optionDisplayLabel } from "@/components/designer/designer-metadata";
import { saasFontFamily, saasFontOptions, saasFontValue, saasFontVariantKey } from "@/lib/theme/saas-fonts";
import { themeValueToString } from "@/lib/theme-values";
import type { Site, ThemeFieldSchema, ThemeSettingValue } from "@/lib/types";
import type { DesignerResourceKind, FieldOptions } from "@/components/designer/field-editor-types";
import {
  collectionSelector,
  pageSelector,
  parseSelectorJson,
  productSelector,
  ResourceSelector,
  selectorFromValue,
  selectorJson,
  staticUrlSelector
} from "@/components/designer/resource-selector";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function stringifyValue(value: ThemeSettingValue | undefined): string {
  return themeValueToString(value);
}

export function parseFieldValue(field: ThemeFieldSchema, value: string): ThemeSettingValue {
  if (field.type === "checkbox") return value === "true";
  if (field.type === "range") return Number(value);
  if (field.type === "font_picker") {
    const [family, variant] = value.split("::");
    return saasFontValue(family, variant);
  }
  if (field.type === "collection" || field.type === "product" || field.type === "page" || field.type === "url") {
    return parseSelectorJson(value) ?? (value ? { id: value, type: field.type, title: value, url: value } : "");
  }
  if (field.type === "link_list" || field.type === "menu" || field.type === "blog") {
    return value ? { id: value, type: field.type, title: value } : "";
  }
  return value;
}

function runtimeOptions(field: ThemeFieldSchema, options: FieldOptions): Array<{ label: string; value: string }> {
  if (field.options?.length) return field.options;
  if (field.type === "product" || field.source === "products") {
    return options.products.map((product) => ({ label: `${product.name} (${product.status})`, value: product.id }));
  }
  if (field.type === "price" || field.source === "prices") {
    return options.products.flatMap((product) => product.prices.map((price) => ({ label: `${product.name} - ${price.label}`, value: price.id })));
  }
  if (field.type === "ai_app" || field.source === "site_ai_apps") {
    return options.siteAiApps.map((app) => ({ label: `${app.aiApp.name} - ${app.enabled ? "enabled" : "disabled"}`, value: app.aiApp.slug }));
  }
  if (field.type === "media_asset" || field.source === "media_assets") {
    return options.mediaAssets.map((asset) => ({ label: `${asset.label} (${asset.usage})`, value: asset.id }));
  }
  if (field.type === "font_picker") {
    return saasFontOptions.map((font, index) => ({ label: `${font.family} (${font.category})`, value: `${font.family}::${font.variants[0]?.key ?? "regular"}::${index}` }));
  }
  if (field.type === "page" || field.source === "pages") {
    return options.pages.map((page) => ({ label: `${page.title} (${page.slug})`, value: page.slug }));
  }
  if (field.source === "creative_packs") {
    return options.creativePacks.map((pack) => ({ label: `${pack.name} (${pack.status})`, value: pack.id }));
  }
  if (field.type === "collection") {
    return options.creativePacks.map((pack) => ({ label: `${pack.name} (${pack.category}, ${pack.status})`, value: pack.id }));
  }
  if (field.type === "link_list" || field.type === "menu") {
    return [
      { label: `Header menu (${options.pages.length} site pages)`, value: "header" },
      { label: "Footer menu", value: "footer" },
      { label: "AI tools menu", value: "ai-tools" }
    ];
  }
  if (field.type === "blog") {
    return [
      { label: "Default blog", value: "blog" },
      { label: "Help center", value: "help-center" },
      { label: "Policies", value: "policies" }
    ];
  }
  return [];
}

function fieldInputMode(field: ThemeFieldSchema): "text" | "textarea" | "select" | "checkbox" | "color" | "range" | "notice" {
  if (field.type === "header" || field.type === "paragraph" || field.type === "popover") return "notice";
  if (field.type === "textarea" || field.type === "richtext" || field.type === "html") return "textarea";
  if (["select", "collection", "product", "price", "ai_app", "media_asset", "page", "blog", "font_picker", "menu", "link_list"].includes(field.type)) return "select";
  if (field.type === "checkbox") return "checkbox";
  if (field.type === "color") return "color";
  if (field.type === "range") return "range";
  return "text";
}

function navMenuLines(options: FieldOptions, menuId: string): string[] {
  if (menuId === "footer") return ["Privacy|/policies/privacy", "Refunds|/policies/refunds", "Content policy|/policies/content"];
  if (menuId === "ai-tools") return options.siteAiApps.filter((app) => app.enabled).map((app) => `${app.aiApp.name}|/tools/${app.aiApp.slug}`);
  return options.pages.map((page) => `${page.title}|${page.slug}`);
}

function resourceKindsForField(field: ThemeFieldSchema): DesignerResourceKind[] {
  const kinds: DesignerResourceKind[] = [];
  const add = (kind: DesignerResourceKind) => {
    if (!kinds.includes(kind)) kinds.push(kind);
  };
  if (field.type === "product" || field.type === "price" || field.source === "products" || field.source === "prices") add("products");
  if (field.type === "ai_app" || field.source === "site_ai_apps") add("siteAiApps");
  if (field.type === "media_asset" || field.type === "image_picker" || field.source === "media_assets") add("mediaAssets");
  if (field.type === "collection" || field.source === "creative_packs") add("creativePacks");
  if (field.type === "url") {
    add("products");
    add("creativePacks");
  }
  if (field.type === "link_list" || field.type === "menu") add("siteAiApps");
  return kinds;
}

function SaasFieldShell({
  field,
  children,
  className
}: {
  field: ThemeFieldSchema;
  children: ReactNode;
  className?: string;
}) {
  const label = field.label || field.id;
  return (
    <div
      className={cx("ant-form-item widget-formitem", className)}
      data-designer-field-id={field.id}
      data-designer-field-type={field.type}
    >
      <div className="ant-form-item-label mb-2 leading-5">
        <label className="widget_label text-sm text-[#212121]">{fieldDisplayLabel({ id: field.id, label })}</label>
      </div>
      <div className="ant-form-item-control-wrapper">
        <div className="ant-form-item-control">
          <div className="ant-form-item-children">{children}</div>
        </div>
      </div>
      {field.helpText ? <p className="widget_info mt-1 text-xs leading-5 text-[#7c8087]">{field.helpText}</p> : null}
    </div>
  );
}

function SaasNoticeField({ field }: { field: ThemeFieldSchema }) {
  if (field.type === "header") {
    return (
      <div
        className="widget__header mb-4 text-base font-medium text-[#383838]"
        data-designer-field-id={field.id}
        data-designer-field-type="header"
      >
        {field.label || field.id}
      </div>
    );
  }
  return (
    <div className="ant-form-item" data-designer-field-id={field.id} data-designer-field-type={field.type}>
      <p className="text-xs leading-5 text-[#6b7282]">{field.helpText || field.label}</p>
    </div>
  );
}

function SaasSelectedLineFieldShell({
  field,
  children,
  className
}: {
  field: ThemeFieldSchema;
  children: ReactNode;
  className?: string;
}) {
  const label = field.label || field.id;
  return (
    <div
      className={cx("widget-resource-field ant-form-item", className)}
      data-designer-field-id={field.id}
      data-designer-field-type={field.type}
    >
      <label className="widget_label block text-sm leading-5 text-[#212121]">
        {fieldDisplayLabel({ id: field.id, label })}
      </label>
      {children}
      {field.helpText ? <p className="widget_info pt-1 text-xs leading-5 text-[#7c8087]">{field.helpText}</p> : null}
    </div>
  );
}

function SaasInlineFieldShell({
  field,
  children,
  className
}: {
  field: ThemeFieldSchema;
  children: ReactNode;
  className?: string;
}) {
  const label = field.label || field.id;
  return (
    <div
      className={cx("ant-form-item widget-formitem widget-formitem-fix", className)}
      data-designer-field-id={field.id}
      data-designer-field-type={field.type}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <label className="widget_label text-sm text-[#212121]">{fieldDisplayLabel({ id: field.id, label })}</label>
        </div>
        <div className="shrink-0">{children}</div>
      </div>
      {field.helpText ? <p className="widget_info mt-1 text-xs leading-5 text-[#7c8087]">{field.helpText}</p> : null}
    </div>
  );
}

const saasInputClass = "ant-input w-full rounded-[2px] border border-[#c4c7cc] bg-white px-[9px] py-1 text-sm leading-8 text-[#212121] outline-none transition focus:border-[#479dff]";
const saasTextareaClass = "ant-input w-full rounded-[2px] border border-[#c4c7cc] bg-white px-[9px] py-2 text-sm leading-6 text-[#212121] outline-none transition focus:border-[#479dff]";
const saasSelectClass = "ant-input w-full rounded-[2px] border border-[#c4c7cc] bg-white px-[9px] py-2 text-sm text-[#212121] outline-none transition focus:border-[#479dff]";
const saasCodeTextareaClass = "ant-input min-h-40 w-full rounded-[2px] border border-[#c4c7cc] bg-[#23262e] px-[9px] py-2 font-mono text-xs leading-6 text-[#f5f5f5] outline-none transition focus:border-[#479dff]";

function StaticSelectedLine({
  title,
  detail,
  preview,
  className
}: {
  title: ReactNode;
  detail?: ReactNode;
  preview?: string;
  className?: string;
}) {
  return (
    <div className={cx("widget-selected-line flex min-h-[36px] items-center rounded-[2px] border border-transparent bg-[#eef0f2] px-2.5 leading-9", className)}>
      {preview ? <span className="widget-selected-line__img mr-[5px] h-8 w-7 shrink-0 bg-center bg-contain bg-no-repeat" style={{ backgroundImage: `url(${preview})` }} /> : null}
      <div className="widget-selected-line__title min-w-0 flex-1 truncate text-sm text-[#212121]">
        <span className="widget-selected-line__font-family mr-2.5">{title}</span>
        {detail ? <span className="text-[#7c8087]">{detail}</span> : null}
      </div>
      <span className="widget-selected-line__icon-edit flex h-9 w-10 items-center justify-center text-[#7c8087]">
        <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
      </span>
    </div>
  );
}

function menuValue(value: ThemeSettingValue | undefined, fallback: string) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const id = value.id;
    if (typeof id === "string") return id;
  }
  return stringifyValue(value) || fallback;
}

export function FieldEditor({
  field,
  value,
  onChange,
  options,
  site
}: {
  field: ThemeFieldSchema;
  value: ThemeSettingValue | undefined;
  onChange: (value: string) => void;
  options: FieldOptions;
  site: Site;
}) {
  const mode = fieldInputMode(field);
  const valueString = stringifyValue(value ?? field.default ?? "");
  const choices = runtimeOptions(field, options);
  const requestResourceRef = useRef(options.requestResource);
  const resourceStatusRef = useRef(options.resourceStatus);

  useEffect(() => {
    requestResourceRef.current = options.requestResource;
    resourceStatusRef.current = options.resourceStatus;
  }, [options.requestResource, options.resourceStatus]);

  useEffect(() => {
    const controller = new AbortController();
    for (const kind of resourceKindsForField(field)) {
      const status = resourceStatusRef.current?.[kind] ?? "idle";
      if (status === "idle" || status === "error") {
        void requestResourceRef.current?.(kind, { signal: controller.signal });
      }
    }
    return () => controller.abort();
  }, [field]);

  if (mode === "notice") return <SaasNoticeField field={field} />;

  if (field.type === "image_picker" || field.type === "media_asset") {
    return (
      <SaasSelectedLineFieldShell field={field}>
        <ResourceSelector
          currentLabel={valueString || "未选择媒体"}
          kind="media"
          onSelect={onChange}
          options={options}
          selectedValue={valueString}
          site={site}
          title="选择装修素材"
        />
        <details className="mt-2 rounded-[2px] border border-[#dde2e7] bg-[#f7f8fb]" data-designer-field-mode="manual-media-entry">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-[#6a7078]">
            手动输入地址
          </summary>
          <div className="border-t border-[#dde2e7] p-2">
            <input
              className={cx(saasInputClass, "font-mono text-xs")}
              onChange={(event) => onChange(event.target.value)}
              placeholder="粘贴 CDN URL、/assets 路径或 storage key"
              value={valueString}
            />
          </div>
        </details>
      </SaasSelectedLineFieldShell>
    );
  }

  if (field.type === "collection") {
    const selected = selectorFromValue(value, "collection");
    return (
      <SaasSelectedLineFieldShell field={field}>
        <ResourceSelector
          currentLabel={selected.title || "未选择集合"}
          kind="collection"
          onSelect={onChange}
          options={options}
          selectedValue={selected.id}
          site={site}
          title="选择集合"
        />
      </SaasSelectedLineFieldShell>
    );
  }

  if (field.type === "product") {
    const selected = selectorFromValue(value, "product");
    return (
      <SaasSelectedLineFieldShell field={field}>
        <ResourceSelector
          currentLabel={selected.title || "未选择商品"}
          kind="product"
          onSelect={onChange}
          options={options}
          selectedValue={selected.id}
          site={site}
          title="选择真实商品"
        />
      </SaasSelectedLineFieldShell>
    );
  }

  if (field.type === "page") {
    const selected = selectorFromValue(value, "pages");
    return (
      <SaasSelectedLineFieldShell field={field}>
        <ResourceSelector
          currentLabel={selected.title || "未选择页面"}
          kind="page"
          onSelect={onChange}
          options={options}
          selectedValue={selected.id}
          site={site}
          title="选择页面"
        />
      </SaasSelectedLineFieldShell>
    );
  }

  if (field.type === "url") {
    return (
      <SaasSelectedLineFieldShell field={field}>
        <SaasUrlSelector onChange={onChange} options={options} site={site} value={value} />
      </SaasSelectedLineFieldShell>
    );
  }

  if (field.type === "link_list" || field.type === "menu") {
    const selectedMenu = menuValue(value, "header");
    const menuLines = navMenuLines(options, selectedMenu);
    return (
      <SaasSelectedLineFieldShell field={field}>
        <StaticSelectedLine detail={menuLines[0] || "空菜单"} title={selectedMenu} />
        <select className={cx(saasSelectClass, "mt-2")} onChange={(event) => onChange(event.target.value)} value={selectedMenu}>
          {choices.map((choice, index) => <option key={`${choice.value}_${index}`} value={choice.value}>{optionDisplayLabel(choice.label)}</option>)}
        </select>
      </SaasSelectedLineFieldShell>
    );
  }

  if (field.type === "font_picker") {
    const family = saasFontFamily(value);
    const font = saasFontOptions.find((item) => item.family === family) ?? saasFontOptions[0];
    const variantKey = saasFontVariantKey(value, font.family);
    const variant = font.variants.find((item) => item.key === variantKey) ?? font.variants[0];
    return (
      <SaasSelectedLineFieldShell field={field}>
        <StaticSelectedLine
          detail={`${variant.label} / ${font.category}`}
          title={<span style={{ fontFamily: `'${font.family}', ${font.category}`, fontStyle: variant.style, fontWeight: variant.weight }}>{font.family}</span>}
        />
        <div className="mt-2 grid gap-2">
          <select
            className={saasSelectClass}
            onChange={(event) => onChange(`${event.target.value}::${saasFontVariantKey(value, event.target.value)}`)}
            value={font.family}
          >
            {saasFontOptions.map((item, index) => (
              <option key={`${item.family}_${item.category}_${index}`} value={item.family}>{item.family} ({item.category})</option>
            ))}
          </select>
          <select
            className={saasSelectClass}
            onChange={(event) => onChange(`${font.family}::${event.target.value}`)}
            value={variant.key}
          >
            {font.variants.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </div>
      </SaasSelectedLineFieldShell>
    );
  }

  if (field.type === "custom_select") {
    return (
      <SaasFieldShell field={field}>
        <div className="grid grid-cols-3 gap-2">
          {choices.map((choice, index) => {
            const selected = valueString === choice.value || (!valueString && index === 0);
            const looksLikeImage = /\.(svg|png|jpe?g|webp)$/i.test(choice.label);
            return (
              <button
                className={cx(
                  "min-h-[64px] border bg-white p-1.5 text-xs text-[#383838] transition",
                  selected ? "border-[#f4a719] ring-1 ring-[#f4a719]" : "border-[#c4c7cc] hover:border-[#479dff]"
                )}
                key={`${choice.value}_${index}`}
                onClick={(event) => {
                  event.preventDefault();
                  onChange(choice.value);
                }}
                type="button"
              >
                {looksLikeImage ? (
                  <img alt={choice.value} className="mx-auto max-h-9 max-w-full object-contain" src={choice.label} />
                ) : (
                  <span className="line-clamp-2">{choice.label}</span>
                )}
                <span className="mt-1 block truncate font-mono text-[10px] text-[#7c8087]">{choice.value}</span>
              </button>
            );
          })}
        </div>
      </SaasFieldShell>
    );
  }

  if (mode === "checkbox") {
    return (
      <SaasInlineFieldShell field={field}>
        <button
          aria-label={fieldDisplayLabel({ id: field.id, label: field.label || field.id })}
          aria-checked={valueString === "true"}
          className={cx("ant-switch flex h-5 w-11 items-center rounded-full border p-0.5 transition", valueString === "true" ? "ant-switch-checked border-[#f4a719] bg-[#f4a719]" : "border-[#e6e6e6] bg-white")}
          onClick={(event) => {
            event.preventDefault();
            onChange(valueString === "true" ? "false" : "true");
          }}
          role="switch"
          type="button"
        >
          <span className={cx("h-[18px] w-[18px] rounded-full bg-white shadow-sm transition", valueString === "true" ? "translate-x-[22px]" : "translate-x-0")} />
        </button>
      </SaasInlineFieldShell>
    );
  }

  return (
    <SaasFieldShell field={field}>
      {field.type === "video_url" ? (
        <input className={saasInputClass} onChange={(event) => onChange(event.target.value)} placeholder="YouTube, Vimeo, or embed URL" value={valueString} />
      ) : field.type === "richtext" ? (
        <textarea className={cx(saasTextareaClass, "min-h-32")} onChange={(event) => onChange(event.target.value)} placeholder="<p>Rich text content</p>" value={valueString} />
      ) : field.type === "html" ? (
        <textarea className={saasCodeTextareaClass} onChange={(event) => onChange(event.target.value)} placeholder="<div>Custom HTML</div>" value={valueString} />
      ) : mode === "textarea" ? (
        <textarea className={cx(saasTextareaClass, "min-h-24")} onChange={(event) => onChange(event.target.value)} value={valueString} />
      ) : mode === "select" ? (
        <select className={saasSelectClass} onChange={(event) => onChange(event.target.value)} value={valueString}>
          {choices.length ? choices.map((choice, index) => <option key={`${choice.value}_${index}`} value={choice.value}>{optionDisplayLabel(choice.label)}</option>) : <option value="">{optionDisplayLabel("No options available")}</option>}
        </select>
      ) : mode === "color" ? (
        <div className="flex gap-2">
          <input className="h-9 w-11 rounded-[2px] border border-[#c4c7cc] bg-white p-1" type="color" onChange={(event) => onChange(event.target.value)} value={valueString || "#171717"} />
          <input className={cx(saasInputClass, "min-w-0 flex-1")} onChange={(event) => onChange(event.target.value)} value={valueString} />
        </div>
      ) : mode === "range" ? (
        <div className="grid gap-2" data-designer-field-type="saas-range-slider">
          <div className="flex items-center justify-between gap-3 text-xs text-[#7c8087]">
            <span>{field.min ?? 0}</span>
            <span className="font-mono text-[#212121]">{valueString || String(field.default ?? 0)}{field.unit ?? ""}</span>
            <span>{field.max ?? 100}</span>
          </div>
          <input className="w-full accent-[#f4a719]" max={field.max} min={field.min} step={field.step} type="range" onChange={(event) => onChange(event.target.value)} value={valueString || String(field.default ?? 0)} />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input className={saasInputClass} type="number" onChange={(event) => onChange(event.target.value)} value={valueString} />
            <span className="grid min-w-12 place-items-center border border-[#c4c7cc] bg-white px-3 font-mono text-xs text-[#7c8087]">{field.unit ?? ""}</span>
          </div>
        </div>
      ) : (
        <input className={saasInputClass} onChange={(event) => onChange(event.target.value)} value={valueString} />
      )}
    </SaasFieldShell>
  );
}

function SaasUrlSelector({
  value,
  onChange,
  options,
  site
}: {
  value: ThemeSettingValue | undefined;
  onChange: (value: string) => void;
  options: FieldOptions;
  site: Site;
}) {
  const selected = selectorFromValue(value, "urls");
  const selectedType = ["none", "index", "category", "product", "pages", "urls"].includes(selected.type) ? selected.type : "urls";
  const customValue = selectedType === "urls" ? selected.url : "";
  const productId = selectedType === "product" ? selected.id : "";
  const pageId = selectedType === "pages" ? selected.id : "";
  const collectionId = selectedType === "category" ? selected.id : "";
  const requestResourceRef = useRef(options.requestResource);
  const resourceStatusRef = useRef(options.resourceStatus);
  useEffect(() => {
    requestResourceRef.current = options.requestResource;
    resourceStatusRef.current = options.resourceStatus;
  }, [options.requestResource, options.resourceStatus]);
  useEffect(() => {
    const controller = new AbortController();
    const resourceKind = selectedType === "product" ? "products" : selectedType === "category" ? "creativePacks" : undefined;
    if (resourceKind) {
      const status = resourceStatusRef.current?.[resourceKind] ?? "idle";
      if (status === "idle" || status === "error") void requestResourceRef.current?.(resourceKind, { signal: controller.signal });
    }
    return () => controller.abort();
  }, [selectedType]);
  const applyType = (type: string) => {
    if (type === "none" || type === "index") {
      onChange(selectorJson(staticUrlSelector(type)));
      return;
    }
    if (type === "product") {
      const product = options.products[0];
      onChange(product ? selectorJson(productSelector(product)) : selectorJson({ id: "", title: "", url: "", type: "product" }));
      return;
    }
    if (type === "category") {
      const pack = options.creativePacks[0];
      onChange(pack ? selectorJson(collectionSelector(pack, "category")) : selectorJson({ id: "", title: "", url: "", type: "category" }));
      return;
    }
    if (type === "pages") {
      const page = options.pages[0];
      onChange(page ? selectorJson(pageSelector(page)) : selectorJson({ id: "", title: "", url: "", type: "pages" }));
      return;
    }
    onChange(selectorJson(staticUrlSelector("urls", customValue || "/pricing")));
  };
  return (
    <div className="grid gap-2" data-designer-field-type="saas-link-selector">
      <ResourceSelector
        currentLabel={selected.title || selected.url || "未选择链接"}
        kind="url"
        onSelect={onChange}
        options={options}
        selectedValue={selected.id}
        site={site}
        title="选择页面或链接"
      />
      <select className={saasSelectClass} onChange={(event) => applyType(event.target.value)} value={selectedType}>
        <option value="none">无</option>
        <option value="index">首页</option>
        <option value="category">专辑详情页</option>
        <option value="product">商品详情页</option>
        <option value="pages">页面详情页</option>
        <option value="urls">自定义URL</option>
      </select>
      {selectedType === "product" ? (
        <select
          className={saasSelectClass}
          onChange={(event) => {
            const product = options.products.find((item) => item.id === event.target.value);
            onChange(product ? selectorJson(productSelector(product)) : "");
          }}
          value={productId}
        >
          <option value="">选择商品</option>
          {options.products.map((product) => (
            <option key={product.id} value={product.id}>{product.name} ({product.status})</option>
          ))}
        </select>
      ) : null}
      {selectedType === "category" ? (
        <select
          className={saasSelectClass}
          onChange={(event) => {
            const pack = options.creativePacks.find((item) => item.id === event.target.value);
            onChange(pack ? selectorJson(collectionSelector(pack, "category")) : "");
          }}
          value={collectionId}
        >
          <option value="">选择专辑</option>
          {options.creativePacks.map((pack) => (
            <option key={pack.id} value={pack.id}>{pack.name} ({pack.category})</option>
          ))}
        </select>
      ) : null}
      {selectedType === "pages" ? (
        <select
          className={saasSelectClass}
          onChange={(event) => {
            const page = options.pages.find((item) => item.id === event.target.value);
            onChange(page ? selectorJson(pageSelector(page)) : "");
          }}
          value={pageId}
        >
          <option value="">选择页面</option>
          {options.pages.map((page) => (
            <option key={page.id} value={page.id}>{page.title} ({page.slug})</option>
          ))}
        </select>
      ) : null}
      {selectedType === "urls" ? (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            className={cx(saasInputClass, "min-w-0")}
            onChange={(event) => onChange(selectorJson(staticUrlSelector("urls", event.target.value)))}
            placeholder="/pricing, /tools/headshot, or https://..."
            value={customValue}
          />
          <button className="rounded-[2px] border border-[#c4c7cc] bg-white px-3 text-xs text-[#6b7282] transition hover:border-[#479dff] hover:text-[#479dff]" onClick={(event) => { event.preventDefault(); onChange(selectorJson(staticUrlSelector("urls", "/pricing"))); }} type="button">Pricing</button>
        </div>
      ) : null}
    </div>
  );
}
