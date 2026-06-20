"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { ChevronRight, X } from "lucide-react";
import {
  DesignerInfoPill,
  DesignerPillGroup,
  DesignerSearchField
} from "@/components/designer/designer-sidebar-primitives";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function DesignerResourceTrigger({
  icon,
  preview,
  title,
  detail,
  actionLabel = "选择",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  preview?: string;
  title: ReactNode;
  detail?: ReactNode;
  actionLabel?: ReactNode;
}) {
  return (
    <button
      className={cx(
        "widget-selected-line group flex min-h-[36px] items-center rounded-[2px] border border-transparent bg-[#eef0f2] px-2.5 text-left leading-9 outline-none transition hover:border-[#d7dce4] hover:bg-[#e6e9ee] active:bg-[#dde1e8] focus-visible:outline-none",
        className
      )}
      type="button"
      {...props}
    >
      <span className="flex min-w-0 flex-1 items-center">
        <span className="widget-selected-line__img mr-[5px] grid h-8 w-7 shrink-0 place-items-center overflow-hidden bg-transparent text-[#6b7282]">
            {preview ? <img alt="" className="h-full w-full object-cover" src={preview} /> : icon}
        </span>
        <span className="widget-selected-line__title min-w-0 flex-1 truncate text-sm text-[#212121]">
          <span className="widget-selected-line__font-family mr-2.5">{title}</span>
          {detail ? <span className="widget-selected-line__detail">{detail}</span> : null}
        </span>
      </span>
      <span className="widget-selected-line__icon-edit flex h-9 w-10 shrink-0 items-center justify-center text-[#6b7282] transition group-hover:text-[#212121]">
        <span className="sr-only">{actionLabel}</span>
        <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" strokeWidth={1.8} />
      </span>
    </button>
  );
}

export function DesignerResourceInlineSummary({
  title,
  description,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  description: ReactNode;
}) {
  return (
    <div aria-hidden="true" className={cx("hidden", className)} {...props}>
      <p>{title}</p>
      <p>{description}</p>
    </div>
  );
}

export function DesignerResourceModalOverlay({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("fixed inset-0 z-40 grid place-items-center bg-[rgba(24,28,36,0.36)] p-4 backdrop-blur-[1px]", className)} {...props}>
      {children}
    </div>
  );
}

export function DesignerResourceModalPanel({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "grid max-h-[86dvh] w-full max-w-[860px] overflow-hidden rounded-[2px] border border-[#bfc4cb] bg-white shadow-[0_2px_10px_0_rgba(0,0,0,0.18)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DesignerResourceModalSidebar({
  eyebrow,
  title,
  description,
  icon,
  stats,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  stats?: Array<{ label: ReactNode; value: ReactNode }>;
}) {
  return (
    <div className={cx("border-b border-[#d7dce4] bg-[#eef0f5] px-5 py-3 text-[#383838]", className)} {...props}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs leading-5 text-[#7c8087]">{eyebrow}</p>
          <h3 className="text-base font-medium leading-6 text-[#1e1d29]">{title}</h3>
        </div>
        {icon ? <div className="shrink-0 text-[#7c8087]">{icon}</div> : null}
      </div>
      {description ? <p className="mt-1 text-xs leading-5 text-[#7c8087]">{description}</p> : null}
      {stats?.length ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#7c8087]">
          {stats.map((item, index) => (
            <span className="inline-flex items-center gap-1" key={index}>
              <span>{item.label}</span>
              <span className="font-mono text-[#383838]">{item.value}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DesignerResourceModalToolbar({
  query,
  onQueryChange,
  queryPlaceholder,
  actions,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  query: string;
  onQueryChange: (value: string) => void;
  queryPlaceholder: string;
  actions?: ReactNode;
}) {
  return (
    <div className={cx("flex flex-col justify-between gap-2 md:flex-row md:items-center", className)} {...props}>
      <DesignerSearchField
        className="min-w-0 flex-1"
        inputClassName="h-9 rounded-[2px] border-[#c4c7cc] bg-white focus:border-[#479dff]"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={queryPlaceholder}
        value={query}
      />
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function DesignerResourceCloseButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "grid h-8 w-8 place-items-center rounded-[2px] border border-[#c4c7cc] bg-white text-[#6b7282] transition hover:border-[#479dff] hover:text-[#479dff] active:scale-[0.98]",
        className
      )}
      type="button"
      {...props}
    >
      <X className="h-4 w-4" strokeWidth={1.8} />
    </button>
  );
}

export function DesignerResourceMetaList({
  items,
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  items: ReactNode[];
  tone?: "neutral" | "white";
}) {
  const visible = items.filter(Boolean);
  if (!visible.length) return null;
  return (
    <DesignerPillGroup className={className} {...props}>
      {visible.map((item, index) => (
        <DesignerInfoPill key={index} label={item} tone={tone} />
      ))}
    </DesignerPillGroup>
  );
}

export function DesignerResourceCard({
  preview,
  icon,
  title,
  subtitle,
  detail,
  meta = [],
  selected = false,
  tone = "neutral",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  preview?: string;
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  meta?: ReactNode[];
  selected?: boolean;
  tone?: "good" | "warn" | "neutral";
}) {
  return (
    <button
      className={cx(
        "group grid gap-2 rounded-[2px] border bg-white p-2 text-left transition active:scale-[0.99]",
        selected ? "border-[#f4a719] bg-[#fff8e8]" : "border-[#d7dce4] hover:border-[#479dff] hover:bg-[#f7f8fb]",
        className
      )}
      type="button"
      {...props}
    >
      <span className="grid min-w-0 gap-2 grid-cols-[54px_1fr_auto]">
        <span className="grid h-[46px] w-[54px] place-items-center overflow-hidden rounded-[2px] border border-[#d7dce4] bg-[#f2f3f5]">
          {preview ? <img alt="" className="h-full w-full object-cover" src={preview} /> : icon}
        </span>
        <span className="min-w-0">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium leading-5 text-[#212121]">{title}</span>
              {subtitle ? <span className="mt-0.5 block truncate text-xs text-[#7c8087]">{subtitle}</span> : null}
            </span>
          </span>
          {detail ? <span className="mt-1 line-clamp-1 block font-mono text-[10px] leading-4 text-[#909294]">{detail}</span> : null}
        </span>
        <span
          className={cx(
            "mt-2 h-2 w-2 shrink-0 rounded-full",
            tone === "good" ? "bg-[#2ca36c]" : tone === "warn" ? "bg-[#f4a719]" : "bg-[#c4c7cc]"
          )}
        />
      </span>
      {meta.length ? <DesignerResourceMetaList className="resource-meta-list pt-0" items={meta} /> : null}
    </button>
  );
}

export function DesignerResourceEmptyState({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-[2px] border border-dashed border-[#c4c7cc] bg-white p-6 text-sm text-[#7c8087]", className)} {...props}>
      {children}
    </div>
  );
}
