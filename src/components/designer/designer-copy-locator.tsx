"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Code2, FileText, LocateFixed, Menu, PanelBottom, PanelTop, Search, SearchCheck } from "lucide-react";
import type { DesignerWorkspaceTab } from "@/components/designer/designer-workspace-pane";
import type { Selection } from "@/components/designer/designer-types";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type DesignerCopyLocatorSource = "page" | "global" | "navigation" | "seo" | "code";

export type DesignerCopyLocatorItem = {
  id: string;
  label: string;
  text: string;
  path: string;
  source: DesignerCopyLocatorSource;
  sourceLabel: string;
  hint?: string;
  readOnly?: boolean;
  selection?: Selection;
  workspaceTab?: DesignerWorkspaceTab;
};

export type DesignerCopyLocatorQuickTarget = "header" | "footer" | "navigation" | "seo";

export function DesignerCopyLocatorPanel({
  items,
  activePageTitle,
  breadcrumb,
  pageIsEmpty,
  onSelectItem,
  onQuickSelect
}: {
  items: DesignerCopyLocatorItem[];
  activePageTitle: string;
  breadcrumb?: string;
  pageIsEmpty: boolean;
  onSelectItem: (item: DesignerCopyLocatorItem) => void;
  onQuickSelect: (target: DesignerCopyLocatorQuickTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return items.slice(0, 8);
    const sourcePriority: Record<DesignerCopyLocatorSource, number> = {
      navigation: 0,
      global: 1,
      seo: 2,
      page: 3,
      code: 4
    };
    return items
      .filter((item) => `${item.label} ${item.text} ${item.path} ${item.sourceLabel} ${item.hint ?? ""}`.toLowerCase().includes(normalizedQuery))
      .sort((left, right) => sourcePriority[left.source] - sourcePriority[right.source])
      .slice(0, 32);
  }, [items, normalizedQuery]);

  return (
    <section className="border-b border-[#e3e6eb] bg-[#fbfcfe]" data-designer-layout="saas-copy-locator">
      <div className="px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[#1f2937]">文案定位器</p>
            <p className="mt-0.5 truncate text-[10px] text-[#7c8087]">{activePageTitle}</p>
          </div>
          <span className="shrink-0 rounded-full border border-[#d9dde4] bg-white px-2 py-1 font-mono text-[10px] text-[#667085]">
            {items.length} 项
          </span>
        </div>

        <label className="relative mt-2 block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#909294]" strokeWidth={1.8} />
          <input
            className="h-9 w-full rounded-[6px] border border-[#cfd4dc] bg-white pl-8 pr-2 text-[12px] text-[#1f2937] outline-none transition placeholder:text-[#909294] focus:border-[#2f6fed]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入预览里看到的文案"
            value={query}
          />
        </label>

        {pageIsEmpty ? (
          <div className="mt-2 rounded-[6px] border border-[#f2d3a4] bg-[#fff8ed] px-2.5 py-2 text-[11px] leading-4 text-[#9a5a1f]">
            此页主体没有页面模块。预览里看到的页头、页脚、导航和 SEO 属于全局配置。
          </div>
        ) : null}

        <div className="mt-2 grid grid-cols-2 gap-1.5" data-designer-layout="saas-copy-locator-shortcuts">
          <QuickButton icon={<PanelTop className="h-3.5 w-3.5" />} label="编辑页头" onClick={() => onQuickSelect("header")} />
          <QuickButton icon={<PanelBottom className="h-3.5 w-3.5" />} label="编辑页脚" onClick={() => onQuickSelect("footer")} />
          <QuickButton icon={<Menu className="h-3.5 w-3.5" />} label="编辑导航" onClick={() => onQuickSelect("navigation")} />
          <QuickButton icon={<SearchCheck className="h-3.5 w-3.5" />} label="编辑 SEO" onClick={() => onQuickSelect("seo")} />
        </div>
      </div>

      <div className="max-h-[190px] overflow-y-auto border-t border-[#edf0f4] px-2 py-2">
        {filteredItems.length ? (
          <div className="grid gap-1.5">
            {filteredItems.map((item) => {
              const disabled = item.readOnly && !item.selection;
              return (
                <button
                  className={cx(
                    "w-full rounded-[6px] border px-2 py-2 text-left transition",
                    disabled
                      ? "cursor-default border-[#f2d3a4] bg-[#fff8ed] text-[#8a5a1f]"
                      : "border-[#e3e6eb] bg-white text-[#344054] hover:border-[#2f6fed] hover:bg-[#f5f8ff]"
                  )}
                  disabled={disabled}
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  title={item.path}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[11px] font-semibold">{item.label}</span>
                    <SourcePill source={item.source} label={item.sourceLabel} />
                  </span>
                  <span className="mt-1 block max-h-[34px] overflow-hidden text-[11px] leading-[17px] text-[#667085]">
                    {item.text || item.hint || "空字段，可进入对应位置填写。"}
                  </span>
                  <span className="mt-1 flex items-center gap-1 truncate font-mono text-[9px] leading-3 text-[#98a2b3]">
                    {item.readOnly ? <Code2 className="h-3 w-3 shrink-0" /> : <LocateFixed className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{item.path}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[6px] border border-dashed border-[#cfd4dc] bg-white px-3 py-3 text-[11px] leading-5 text-[#667085]">
            没找到匹配字段。若这句文案仍在预览里出现，它可能是代码硬编码，需要开发先迁移成可配置字段。
          </div>
        )}
      </div>

      {breadcrumb ? (
        <div className="flex items-center gap-1 border-t border-[#edf0f4] bg-white px-3 py-2 text-[10px] text-[#7c8087]" data-designer-layout="saas-copy-breadcrumb">
          <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          <span className="truncate">{breadcrumb}</span>
        </div>
      ) : null}
    </section>
  );
}

function QuickButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-[6px] border border-[#d9dde4] bg-white px-2 text-[11px] font-medium text-[#344054] transition hover:border-[#2f6fed] hover:text-[#2f6fed]"
      onClick={onClick}
      type="button"
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function SourcePill({ source, label }: { source: DesignerCopyLocatorSource; label: string }) {
  return (
    <span
      className={cx(
        "shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[9px]",
        source === "page" && "border-[#cbe7d5] bg-[#edf7f0] text-[#18794e]",
        source === "global" && "border-[#bdd4ff] bg-[#eef4ff] text-[#2457c5]",
        source === "navigation" && "border-[#d8c7ff] bg-[#f4f0ff] text-[#6941c6]",
        source === "seo" && "border-[#cfd4dc] bg-[#f7f8fb] text-[#475467]",
        source === "code" && "border-[#f2d3a4] bg-[#fff4e6] text-[#9a5a1f]"
      )}
    >
      {label}
    </span>
  );
}
