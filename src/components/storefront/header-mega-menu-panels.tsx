"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";

export type HeaderPhotoPackageMegaGroup = {
  label: string;
  slug: string;
  items: Array<{
    label: string;
    slug: string;
    href: string;
  }>;
};

export type HeaderToolMegaItem = {
  id: string;
  title: string;
  href: string;
  category: string;
  categoryTitle: string;
};

function splitColumns<T>(items: T[], columnCount = 3): T[][] {
  const columns = Array.from({ length: columnCount }, () => [] as T[]);
  items.forEach((item, index) => {
    columns[index % columnCount]?.push(item);
  });
  return columns;
}

function categoryCountLabel(count: number, spanish: boolean): string {
  if (spanish) return count === 1 ? "categoria" : "categorias";
  return count === 1 ? "category" : "categories";
}

function themeCountLabel(count: number, spanish: boolean): string {
  if (spanish) return count === 1 ? "tema" : "themes";
  return count === 1 ? "theme" : "themes";
}

function packagePanelTitle(aidreamcapes: boolean, spanish: boolean): string {
  if (spanish) return aidreamcapes ? "Estudios de albumes de ocasion" : "Estudios de paquetes de fotos";
  return aidreamcapes ? "Occasion album studios" : "AI photo package studios";
}

export function HeaderPhotoPackageMegaPanel({
  aidreamcapes = false,
  collectionsHref,
  groups,
  spanish = false,
  variant = "dark"
}: {
  aidreamcapes?: boolean;
  collectionsHref: string;
  groups: HeaderPhotoPackageMegaGroup[];
  spanish?: boolean;
  variant?: "dark" | "warm";
}) {
  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const columns = splitColumns(groups, 3);
  const warm = variant === "warm";
  return (
    <div className={warm ? "flex max-h-[var(--storefront-mega-panel-max-height,calc(100dvh-6.5rem))] flex-col overflow-hidden rounded-[18px] border border-[#eadfce] bg-[#fffaf3]/[0.99] p-4 text-[#1e1712] shadow-[0_34px_110px_-62px_rgba(114,82,48,0.34)] ring-1 ring-[#d8b17e]/20 backdrop-blur-xl" : "flex max-h-[var(--storefront-mega-panel-max-height,calc(100dvh-6.5rem))] flex-col overflow-hidden rounded-[18px] border border-[#263247] bg-[#070708]/[0.99] p-4 text-white shadow-[0_34px_110px_-52px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.04] backdrop-blur-xl"}>
      <div className="mb-4 flex items-center justify-center gap-3 text-center">
        <span className={warm ? "h-px w-16 bg-[#e5d6c5]" : "h-px w-16 bg-white/10"} />
        <div>
          <span className={warm ? "block text-[1.02rem] font-semibold tracking-tight text-[#1e1712]" : "block text-[1.02rem] font-semibold tracking-tight text-white"}>{packagePanelTitle(aidreamcapes, spanish)}</span>
          <p className={warm ? "mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#7b6a5b]" : "mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/38"}>
            {`${groups.length} ${categoryCountLabel(groups.length, spanish)} \u00b7 ${totalItems} ${themeCountLabel(totalItems, spanish)}`}
          </p>
        </div>
        <span className={warm ? "h-px w-16 bg-[#e5d6c5]" : "h-px w-16 bg-white/10"} />
      </div>
      <div className={warm ? "mt-4 grid min-h-0 flex-1 gap-3 overflow-y-auto border-t border-[#eadfce] pt-5 pr-1 lg:grid-cols-3" : "mt-4 grid min-h-0 flex-1 gap-3 overflow-y-auto border-t border-[#263247] pt-5 pr-1 lg:grid-cols-3"}>
        {columns.map((column, columnIndex) => (
          <div className="grid content-start gap-3" key={`package_column_${columnIndex}`}>
            {column.map((group) => (
              <details className={warm ? "group/category rounded-[14px] border border-[#eadfce] bg-white p-3 open:border-[#d8b17e] open:bg-[#fff8ed]" : "group/category rounded-[14px] border border-[#2b374c] bg-[#090a0c] p-3 open:border-white/18 open:bg-white/[0.035]"} key={group.slug} open>
                <summary className={warm ? "flex min-h-10 cursor-pointer list-none items-center gap-2 text-[0.94rem] font-semibold text-[#b86e36] marker:hidden group-open/category:border-b group-open/category:border-[#eadfce] group-open/category:pb-2" : "flex min-h-10 cursor-pointer list-none items-center gap-2 text-[0.94rem] font-semibold text-[#ff8a2f] marker:hidden group-open/category:border-b group-open/category:border-white/10 group-open/category:pb-2"}>
                  <span className="min-w-0 truncate text-[0.94rem] font-semibold leading-none">{group.label}</span>
                  <span className={warm ? "ml-auto text-[11px] font-medium text-[#9b8877]" : "ml-auto text-[11px] font-medium text-white/36"}>{group.items.length}</span>
                  <ChevronRight className={warm ? "h-3.5 w-3.5 shrink-0 rotate-90 text-[#9b8877] transition group-open/category:-rotate-90" : "h-3.5 w-3.5 shrink-0 rotate-90 text-white/36 transition group-open/category:-rotate-90"} strokeWidth={2} />
                </summary>
                <div className="mt-3 grid gap-2">
                  {group.items.map((item) => (
                    <Link className={warm ? "group/package flex min-h-10 items-start gap-2.5 rounded-[10px] px-2 py-2 text-[0.94rem] leading-6 text-[#4b4037] transition hover:bg-[#f5eadf] hover:text-[#1e1712] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d88a4b]/70" : "group/package flex min-h-10 items-start gap-2.5 rounded-[10px] px-2 py-2 text-[0.94rem] leading-6 text-white/82 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16DCF0]/70"} href={item.href} key={item.slug}>
                      <span className="text-[0.94rem] font-semibold leading-6">{item.label}</span>
                      <ChevronRight className={warm ? "ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-[#b99675] transition group-hover/package:translate-x-0.5 group-hover/package:text-[#8f5327]" : "ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-white/28 transition group-hover/package:translate-x-0.5 group-hover/package:text-white/56"} strokeWidth={2} />
                    </Link>
                  ))}
                </div>
              </details>
            ))}
          </div>
        ))}
      </div>
      <div className={warm ? "mt-5 border-t border-[#eadfce] pt-3 text-center" : "mt-5 border-t border-[#263247] pt-3 text-center"}>
        <Link className={warm ? "inline-flex items-center gap-2 text-sm font-semibold text-[#b86e36] transition hover:text-[#8f5327]" : "inline-flex items-center gap-2 text-sm font-semibold text-[#ff8a2f] transition hover:text-[#ffa45d]"} href={collectionsHref}>
          {spanish ? "Ver todos los paquetes" : "View all packages"}
          <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
        </Link>
      </div>
    </div>
  );
}

function groupedTools(tools: HeaderToolMegaItem[]) {
  const groups = new Map<string, { category: string; title: string; items: HeaderToolMegaItem[] }>();
  tools.forEach((tool) => {
    const key = tool.category || "Photo AI";
    const existing = groups.get(key) ?? { category: key, title: tool.categoryTitle || key, items: [] };
    existing.items.push(tool);
    groups.set(key, existing);
  });
  return Array.from(groups.values());
}

export function HeaderToolsMegaPanel({
  ctaHref,
  ctaLabel,
  spanish = false,
  tools,
  variantTone = "dark"
}: {
  ctaHref: string;
  ctaLabel: string;
  spanish?: boolean;
  tools: HeaderToolMegaItem[];
  variantTone?: "dark" | "warm";
}) {
  const warm = variantTone === "warm";
  const groups = groupedTools(tools);
  const columns = splitColumns(groups, Math.min(3, Math.max(1, groups.length)));
  return (
    <div className={warm ? "overflow-hidden rounded-[18px] border border-[#eadfce] bg-[#fffaf3]/[0.99] p-4 text-[#1e1712] shadow-[0_34px_110px_-62px_rgba(114,82,48,0.34)] ring-1 ring-[#d8b17e]/20 backdrop-blur-xl" : "overflow-hidden rounded-[18px] border border-[#263247] bg-[#070708]/[0.99] p-4 text-white shadow-[0_34px_110px_-52px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.04] backdrop-blur-xl"}>
      <span className={warm ? "mb-4 block text-center text-[0.98rem] font-semibold tracking-tight text-[#1e1712] sm:text-[1.02rem]" : "mb-4 block text-center text-[0.98rem] font-semibold tracking-tight text-white sm:text-[1.02rem]"}>
        {spanish ? "Herramientas del estudio" : "Studio tools"}
      </span>
      <div className={warm ? "mt-5 grid gap-6 border-t border-[#eadfce] pt-5" : "mt-5 grid gap-6 border-t border-[#263247] pt-5"} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(16rem, 100%), 1fr))" }}>
        {columns.map((column, columnIndex) => (
          <div className="grid content-start gap-6" key={`tool_column_${columnIndex}`}>
            {column.map((group) => (
              <div key={group.category}>
                <span className={warm ? "mb-3 block text-[0.94rem] font-semibold text-[#b86e36]" : "mb-3 block text-[0.94rem] font-semibold text-[#38a8ff]"}>
                  {group.title}
                </span>
                <div className="grid gap-3">
                  {group.items.map((tool) => (
                    <Link className={warm ? "group/tool flex min-h-10 items-start gap-2.5 rounded-[10px] px-2 py-2 text-[0.94rem] leading-6 text-[#4b4037] transition hover:bg-[#f5eadf] hover:text-[#1e1712] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d88a4b]/70" : "group/tool flex min-h-10 items-start gap-2.5 rounded-[10px] px-2 py-2 text-[0.94rem] leading-6 text-white/82 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16DCF0]/70"} href={tool.href} key={tool.id}>
                      <span className="text-[0.94rem] font-semibold leading-6">{tool.title}</span>
                      <ChevronRight className={warm ? "ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-[#b99675] transition group-hover/tool:translate-x-0.5 group-hover/tool:text-[#8f5327]" : "ml-auto mt-1 h-3.5 w-3.5 shrink-0 text-white/28 transition group-hover/tool:translate-x-0.5 group-hover/tool:text-white/56"} strokeWidth={2} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className={warm ? "mt-5 border-t border-[#eadfce] pt-3 text-center" : "mt-5 border-t border-[#263247] pt-3 text-center"}>
        <Link className={warm ? "inline-flex items-center gap-2 text-sm font-semibold text-[#b86e36] transition hover:text-[#8f5327]" : "inline-flex items-center gap-2 text-sm font-semibold text-[#ff8a2f] transition hover:text-[#ffa45d]"} href={ctaHref}>
          {ctaLabel}
          <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
        </Link>
      </div>
    </div>
  );
}

function mobileSummaryClass(dark: boolean): string {
  return dark
    ? "flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[16px] px-4 py-3 text-sm font-semibold text-white marker:hidden transition hover:bg-white/[0.08]"
    : "flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[16px] px-4 py-3 text-sm font-semibold text-[#171514] marker:hidden transition hover:bg-white";
}

export function HeaderMobilePhotoPackagesMenu({
  aidreamcapes = false,
  collectionsHref,
  dark,
  groups,
  menuLabel,
  spanish = false
}: {
  aidreamcapes?: boolean;
  collectionsHref: string;
  dark: boolean;
  groups: HeaderPhotoPackageMegaGroup[];
  menuLabel?: string;
  spanish?: boolean;
}) {
  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  const resolvedMenuLabel = menuLabel ?? (spanish ? aidreamcapes ? "Albumes de ocasion" : "Ver paquetes" : aidreamcapes ? "Occasion Albums" : "Browse packages");
  return (
    <details className={dark ? "group/mobile rounded-[16px] border border-white/10 bg-white/[0.035] open:bg-white/[0.055]" : "group/mobile rounded-[16px] border border-[#e2d7ca] bg-white/60 open:bg-white"}>
      <summary className={mobileSummaryClass(dark)}>
        <span className="min-w-0 flex-1">{resolvedMenuLabel}</span>
        <span className={dark ? "rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] text-white/48" : "rounded-full bg-[#f3ede5] px-2 py-0.5 text-[11px] text-[#7c7268]"}>{totalItems}</span>
        <ChevronRight className={dark ? "h-4 w-4 rotate-90 text-white/42 transition group-open/mobile:-rotate-90" : "h-4 w-4 rotate-90 text-[#7c7268] transition group-open/mobile:-rotate-90"} strokeWidth={2} />
      </summary>
      <div className={dark ? "max-h-[48vh] overflow-y-auto border-t border-white/10 px-2 pb-3 pt-2" : "max-h-[48vh] overflow-y-auto border-t border-[#eadfce] px-2 pb-3 pt-2"}>
        <div className="grid gap-2">
          {groups.map((group) => (
            <details className={dark ? "group/mobile-category rounded-[12px] bg-black/16 px-2 py-1 open:bg-black/22" : "group/mobile-category rounded-[12px] bg-[#f8f2eb] px-2 py-1 open:bg-[#f3eadf]"} key={group.slug}>
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-semibold marker:hidden">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-none">{group.label}</span>
                <span className={dark ? "text-[11px] text-white/36" : "text-[11px] text-[#8a7e72]"}>{group.items.length}</span>
                <ChevronRight className={dark ? "h-3.5 w-3.5 rotate-90 text-white/36 transition group-open/mobile-category:-rotate-90" : "h-3.5 w-3.5 rotate-90 text-[#8a7e72] transition group-open/mobile-category:-rotate-90"} strokeWidth={2} />
              </summary>
              <div className="grid gap-1 pb-1 pl-3 pt-1">
                {group.items.map((item) => (
                  <Link className={dark ? "rounded-[10px] px-2 py-2 text-sm text-white/74 hover:bg-white/[0.06] hover:text-white" : "rounded-[10px] px-2 py-2 text-sm text-[#4f4944] hover:bg-white hover:text-[#171514]"} href={item.href} key={item.slug}>
                    <span className="text-sm font-semibold leading-5">{item.label}</span>
                  </Link>
                ))}
              </div>
            </details>
          ))}
        </div>
        <Link className={dark ? "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-white/12 px-3 py-2.5 text-sm font-semibold text-white" : "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-[#ded5ca] bg-white px-3 py-2.5 text-sm font-semibold text-[#171514]"} href={collectionsHref}>
          {spanish ? "Ver todos los paquetes" : "View all packages"}
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
        </Link>
      </div>
    </details>
  );
}

export function HeaderMobileToolsMenu({
  ctaHref,
  dark,
  spanish = false,
  tools
}: {
  ctaHref: string;
  dark: boolean;
  spanish?: boolean;
  tools: HeaderToolMegaItem[];
}) {
  const groups = groupedTools(tools);
  return (
    <details className={dark ? "group/mobile rounded-[16px] border border-white/10 bg-white/[0.035] open:bg-white/[0.055]" : "group/mobile rounded-[16px] border border-[#e2d7ca] bg-white/60 open:bg-white"}>
      <summary className={mobileSummaryClass(dark)}>
        <span className="min-w-0 flex-1">{spanish ? "Herramientas" : "Tools"}</span>
        <span className={dark ? "rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] text-white/48" : "rounded-full bg-[#f3ede5] px-2 py-0.5 text-[11px] text-[#7c7268]"}>{tools.length}</span>
        <ChevronRight className={dark ? "h-4 w-4 rotate-90 text-white/42 transition group-open/mobile:-rotate-90" : "h-4 w-4 rotate-90 text-[#7c7268] transition group-open/mobile:-rotate-90"} strokeWidth={2} />
      </summary>
      <div className={dark ? "max-h-[48vh] overflow-y-auto border-t border-white/10 px-2 pb-3 pt-2" : "max-h-[48vh] overflow-y-auto border-t border-[#eadfce] px-2 pb-3 pt-2"}>
        <div className="grid gap-2">
          {groups.map((group) => (
            <details className={dark ? "group/mobile-tool rounded-[12px] bg-black/16 px-2 py-1 open:bg-black/22" : "group/mobile-tool rounded-[12px] bg-[#f8f2eb] px-2 py-1 open:bg-[#f3eadf]"} key={group.category}>
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-semibold marker:hidden">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-none">{group.title}</span>
                <span className={dark ? "text-[11px] text-white/36" : "text-[11px] text-[#8a7e72]"}>{group.items.length}</span>
                <ChevronRight className={dark ? "h-3.5 w-3.5 rotate-90 text-white/36 transition group-open/mobile-tool:-rotate-90" : "h-3.5 w-3.5 rotate-90 text-[#8a7e72] transition group-open/mobile-tool:-rotate-90"} strokeWidth={2} />
              </summary>
              <div className="grid gap-1 pb-1 pl-3 pt-1">
                {group.items.map((tool) => (
                  <Link className={dark ? "rounded-[10px] px-2 py-2 text-sm text-white/74 hover:bg-white/[0.06] hover:text-white" : "rounded-[10px] px-2 py-2 text-sm text-[#4f4944] hover:bg-white hover:text-[#171514]"} href={tool.href} key={tool.id}>
                    <span className="text-sm font-semibold leading-5">{tool.title}</span>
                  </Link>
                ))}
              </div>
            </details>
          ))}
        </div>
        <Link className={dark ? "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-white/12 px-3 py-2.5 text-sm font-semibold text-white" : "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-[#ded5ca] bg-white px-3 py-2.5 text-sm font-semibold text-[#171514]"} href={ctaHref}>
          {spanish ? "Ver todas las herramientas" : "View all tools"}
          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
        </Link>
      </div>
    </details>
  );
}
