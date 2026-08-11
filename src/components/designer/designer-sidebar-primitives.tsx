"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { ChevronRight, GripVertical, Search } from "lucide-react";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function interleaveMeta(items: ReactNode[]) {
  return items.filter(Boolean).flatMap((item, index, array) =>
    index < array.length - 1
      ? [<span key={`item:${index}`}>{item}</span>, <span key={`sep:${index}`}> · </span>]
      : [<span key={`item:${index}`}>{item}</span>]
  );
}

export function DesignerSidebarShell({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("card_setting_f769 flex h-full min-h-0 flex-col overflow-hidden bg-[#d7dce4] text-[#383838]", className)} {...props}>
      {children}
    </div>
  );
}

export function DesignerSidebarHeader({
  title,
  meta,
  actions,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={cx("mb-0 flex min-h-[44px] items-center justify-between gap-2 px-3 py-2 text-[#7c8087]", className)} {...props}>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-[#383838]">{title}</p>
        {meta ? <p className="mt-0.5 truncate font-mono text-[10px] tracking-[0.06em] text-[#909294]">{meta}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}

export function DesignerPillButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx("rounded-[8px] border border-[#d8dbe1] bg-white px-2 py-1 text-[11px] text-[#667085] transition hover:border-[#c4c7cc] hover:bg-[#f7f8fb] hover:text-[#383838]", className)}
      type="button"
      {...props}
    />
  );
}

export function DesignerNoticePanel({
  tone = "neutral",
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "neutral" | "active";
}) {
  return (
    <div
      className={cx(
        "mx-3 mb-1.5 rounded-[8px] border px-2.5 py-2 text-[11px] leading-4 transition",
        tone === "active" ? "border-[#bdd4ff] bg-[#eef4ff] text-[#2457c5]" : "border-[#d9dde4] bg-[#f7f8fb] text-[#667085]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DesignerInfoCard({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("mb-1.5 rounded-[8px] border border-[#d9dde4] bg-[#f3f5f7] px-2.5 py-2 text-xs text-[#667085]", className)} {...props}>
      {children}
    </div>
  );
}

export function DesignerEditorSummary({
  eyebrow,
  summary,
  aside,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  eyebrow: ReactNode;
  summary: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <DesignerInfoCard className={cx(className)} {...props}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a94a6]">{eyebrow}</p>
          <p className="mt-0.5 truncate text-[11px] text-[#667085]">{summary}</p>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </DesignerInfoCard>
  );
}

export function DesignerContextCard({
  eyebrow,
  title,
  description,
  aside,
  footer,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={cx("rounded-[8px] border border-[#d9dde4] bg-[#f3f5f7] p-3", className)} {...props}>
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#8a94a6]">{eyebrow}</p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#1f2937]">{title}</p>
          {description ? <p className="mt-1 text-xs text-[#667085]">{description}</p> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {footer ? <div className="mt-3 flex flex-wrap items-center gap-2">{footer}</div> : null}
    </div>
  );
}

export function DesignerTreeScrollArea({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("content_4d8e min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-0", className)} {...props}>
      {children}
    </div>
  );
}

export function DesignerSidebarPanel({
  title,
  meta,
  actions,
  notice,
  summaryEyebrow,
  summary,
  summaryAside,
  children,
  chrome = "full",
  className,
  scrollClassName,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  notice?: ReactNode;
  summaryEyebrow: ReactNode;
  summary: ReactNode;
  summaryAside?: ReactNode;
  chrome?: "full" | "bare";
  scrollClassName?: string;
}) {
  if (chrome === "bare") {
    return (
      <DesignerSidebarShell className={className} {...props}>
        <DesignerTreeScrollArea className={cx("pt-0", scrollClassName)}>{children}</DesignerTreeScrollArea>
      </DesignerSidebarShell>
    );
  }

  return (
    <DesignerSidebarShell className={className} {...props}>
      <DesignerSidebarHeader actions={actions} meta={meta} title={title} />
      {notice ? <DesignerNoticePanel>{notice}</DesignerNoticePanel> : null}
      <DesignerEditorSummary aside={summaryAside} eyebrow={summaryEyebrow} summary={summary} />
      <DesignerTreeScrollArea className={scrollClassName}>{children}</DesignerTreeScrollArea>
    </DesignerSidebarShell>
  );
}

export function DesignerTreeCard({
  selected = false,
  surface = "filled",
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  selected?: boolean;
  surface?: "filled" | "plain";
}) {
  return (
    <div
      className={cx(
        "sectiona_l3bt relative my-0 overflow-hidden border-0 px-0 py-0 text-[#6b7282] shadow-none transition",
        surface === "filled" ? "bg-transparent" : "bg-transparent",
        selected && "tools_active rounded-r-none bg-white",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DesignerTreeHeader({
  selected = false,
  expanded = false,
  title,
  leading,
  subtitle,
  meta,
  aside,
  onToggle,
  onSelect,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  selected?: boolean;
  expanded?: boolean;
  title: ReactNode;
  leading?: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const hasMetaLine = Boolean(subtitle || meta);
  return (
    <div
      className={cx(
        "section__header_543e section__header_wrap_e09b group relative min-h-[38px] rounded-[4px] border border-transparent transition",
        selected ? "selected_cb61 bg-[#f2f5ff] text-[#383838]" : "hover:bg-[#f7f8fb] text-[#6b7282]",
        className
      )}
      {...props}
    >
      <button
        aria-label={expanded ? "收起模块" : "展开模块"}
        className="warp-lb1-arrow unfold_icon_9cba absolute inset-y-0 left-[16px] grid w-[18px] appearance-none place-items-center rounded-[4px] border-0 bg-transparent text-[#6b7282] outline-none transition hover:bg-[#e5e7ea] hover:text-[#383838] focus-visible:outline-none"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        type="button"
        >
        <ChevronRight className={cx("h-3.5 w-3.5 transition", expanded && "rotate-90")} strokeWidth={1.8} />
      </button>
      <button className="section__header_title_94d5 flex min-h-[38px] w-full appearance-none items-center border-0 bg-transparent py-[8px] pl-[38px] pr-2 text-left text-sm leading-5 text-inherit outline-none focus-visible:outline-none" onClick={onSelect} type="button">
        <div className="grid w-full grid-cols-[1fr_auto] items-center gap-2">
          <div className={cx("min-w-0", leading ? "flex items-start gap-2" : undefined)}>
            {leading ? <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[#8a94a6]">{leading}</span> : null}
            <span className="block min-w-0">
              <span className="block min-w-0 truncate text-[12px] font-medium leading-5 text-inherit">{title}</span>
              {hasMetaLine ? (
                <span className="mt-0.5 block min-w-0 truncate text-[10px] font-normal leading-4 text-[#909294]">
                  {interleaveMeta([subtitle, meta])}
                </span>
              ) : null}
            </span>
          </div>
          {aside ? <span className="shrink-0 font-mono text-[10px] font-medium text-[#909294]">{aside}</span> : null}
        </div>
      </button>
      <span className={cx("move_icon_fc26 pointer-events-none absolute inset-y-0 left-0 hidden w-6 items-center justify-center rounded-[4px] text-[#b1b7c4] group-hover:flex", selected && "flex text-[#6b7282]")}>
        <GripVertical className="h-3.5 w-3.5" strokeWidth={1.8} />
      </span>
    </div>
  );
}

export function DesignerTreeMetaRow({
  items,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  items: ReactNode[];
}) {
  const visible = items.filter(Boolean);
  if (!visible.length) return null;
  return <div className={cx("hidden", className)} {...props}>{visible.join(" / ")}</div>;
}

export function DesignerTreeBranch({
  selected = false,
  expanded = false,
  surface = "filled",
  title,
  testId,
  leading,
  subtitle,
  meta,
  aside,
  metaItems = [],
  onToggle,
  onSelect,
  children,
  className,
  headerClassName,
  draggable,
  onDragEnd,
  onDragEnter,
  onDragOver,
  onDragStart,
  onDrop,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  selected?: boolean;
  expanded?: boolean;
  surface?: "filled" | "plain";
  title: ReactNode;
  testId?: string;
  leading?: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  metaItems?: ReactNode[];
  onToggle: () => void;
  onSelect: () => void;
  headerClassName?: string;
}) {
  return (
    <DesignerTreeCard className={className} selected={selected} surface={surface} {...props}>
      <DesignerTreeHeader
        aside={aside}
        className={headerClassName}
        data-designer-tree-id={testId}
        draggable={draggable}
        expanded={expanded}
        leading={leading}
        meta={meta}
        onDragEnd={onDragEnd}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onSelect={onSelect}
        onToggle={onToggle}
        selected={selected}
        subtitle={subtitle}
        title={title}
      />
      <DesignerTreeMetaRow items={metaItems} />
      {children}
    </DesignerTreeCard>
  );
}

export function DesignerTreeChildButton({
  selected = false,
  dragTarget = false,
  draggable = false,
  leading,
  kicker,
  title,
  meta,
  aside,
  className,
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  selected?: boolean;
  dragTarget?: boolean;
  draggable?: boolean;
  leading?: ReactNode;
  kicker: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
}) {
  const hasMetaLine = Boolean(kicker || meta);
  return (
    <button
      className={cx(
        "blocks__item_wrap_6acb blocks__item_0377 group relative flex min-h-[34px] w-full appearance-none items-center rounded-[4px] border border-transparent bg-transparent py-[7px] pl-2 pr-8 text-left text-sm leading-5 outline-none",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer active:scale-[0.99]",
        selected ? "selected_cb61 bg-[#f2f5ff] text-[#383838]" : "bg-transparent text-[#6b7282] hover:bg-[#f7f8fb] hover:text-[#383838]",
        className
      )}
      draggable={draggable}
      aria-pressed={selected}
      type="button"
      {...props}
      >
      {dragTarget ? <span className="placeholder_9109 absolute left-2 right-0 top-0 flex h-9 items-center"><span className="round_7aff h-3 w-3 shrink-0 rounded-full border-2 border-[#3369ff]" /><span className="line_3fa2 ml-[-2px] h-[3px] flex-1 bg-[#3369ff]" /></span> : null}
      <span className={cx("flex min-w-0 flex-1 items-center", leading ? "gap-2" : "gap-2")}>
        <span className="blocks__item_img_a901 flex h-4 w-4 shrink-0 items-center justify-center text-[#a3acb9] opacity-100">
          {leading ?? <span className="h-3.5 w-3.5 rounded-[2px] border border-current/40" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium leading-5 text-inherit">{title}</span>
          {hasMetaLine ? (
            <span className="mt-0.5 block truncate font-mono text-[10px] leading-4 text-[#909294]">
              {interleaveMeta([kicker, meta])}
            </span>
          ) : null}
        </span>
        {aside ? <span className="shrink-0 font-mono text-[10px] text-[#909294]">{aside}</span> : null}
      </span>
      <span className={cx("move_icon_fc26 pointer-events-none absolute inset-y-0 left-0 hidden w-6 items-center justify-center rounded-[4px] text-[#b1b7c4] group-hover:flex", selected && "flex text-[#6b7282]")}>
        <GripVertical className="h-3.5 w-3.5" strokeWidth={1.8} />
      </span>
      {children}
    </button>
  );
}

export function DesignerGlobalNodeButton({
  selected = false,
  expanded = false,
  title,
  leading,
  aside,
  expandable = false,
  onSelect,
  onToggle,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  selected?: boolean;
  expanded?: boolean;
  title: ReactNode;
  leading?: ReactNode;
  aside?: ReactNode;
  expandable?: boolean;
  onSelect: () => void;
  onToggle?: () => void;
}) {
  return (
    <div
      className={cx(
        "saas-global-row tools_global_wrap group flex min-h-[38px] items-center gap-3 rounded-[4px] border border-transparent px-0 py-0 text-[#6b7282] transition",
        selected ? "bg-[#f2f5ff] text-[#383838]" : "hover:bg-[#f7f8fb]",
        className
      )}
      {...props}
    >
      {expandable ? (
        <button
          aria-label={expanded ? "收起模块" : "展开模块"}
          className="saas-global-row__toggle ml-2 grid h-[22px] w-[22px] shrink-0 appearance-none place-items-center rounded-[4px] border-0 bg-transparent text-[#6b7282] outline-none transition hover:bg-[#e5e7ea] hover:text-[#383838] focus-visible:outline-none"
          onClick={(event) => {
            event.stopPropagation();
            onToggle?.();
          }}
          type="button"
        >
          <ChevronRight className={cx("h-3.5 w-3.5 transition", expanded && "rotate-90")} strokeWidth={1.8} />
        </button>
      ) : null}
      {leading ? (
        <span className="saas-global-row__icon ml-2 flex h-4 w-4 shrink-0 items-center justify-center text-[#8a94a6]">
          {leading}
        </span>
      ) : null}
      <button
        className="saas-global-row__content min-w-0 flex-1 appearance-none whitespace-nowrap border-0 bg-transparent p-0 pr-3 text-left text-sm font-medium leading-5 text-inherit outline-none focus-visible:outline-none"
        onClick={onSelect}
        type="button"
      >
        <span className="tools_global_item flex items-center justify-between gap-2">
          <span className="block min-w-0 truncate">{title}</span>
          {aside ? <span className="saas-global-row__aside shrink-0 font-mono text-[10px] font-medium text-[#909294]">{aside}</span> : null}
        </span>
      </button>
    </div>
  );
}

export function DesignerInfoPill({
  label,
  tone = "neutral",
  uppercase = false,
  className
}: {
  label: ReactNode;
  tone?: "neutral" | "good" | "warn" | "white" | "inverse";
  uppercase?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "rounded-[999px] border px-2 py-1 font-mono text-[10px]",
        uppercase && "uppercase tracking-[0.12em]",
        tone === "good"
          ? "border-[#cbe7d5] bg-[#edf7f0] text-[#18794e]"
          : tone === "warn"
          ? "border-[#f2d3a4] bg-[#fff4e6] text-[#b06d2c]"
          : tone === "white"
          ? "border-[#d5dae1] bg-white text-[#667085]"
          : tone === "inverse"
          ? "border-white/15 bg-white/10 text-white/65"
          : "border-[#d5dae1] bg-[#f7f8fa] text-[#667085]",
        className
      )}
    >
      {label}
    </span>
  );
}

export function DesignerPillGroup({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("flex flex-wrap gap-1.5", className)} {...props}>
      {children}
    </div>
  );
}

export function DesignerStatePill({
  label,
  tone = "neutral",
  className
}: {
  label: ReactNode;
  tone?: "neutral" | "draft" | "live" | "selected";
  className?: string;
}) {
  return (
    <DesignerInfoPill
      className={className}
      label={label}
      tone={tone === "draft" ? "warn" : tone === "live" ? "good" : tone === "selected" ? "inverse" : "neutral"}
      uppercase
    />
  );
}

export function DesignerSearchField({
  className,
  inputClassName,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  inputClassName?: string;
}) {
  return (
    <label className={cx("relative block", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" strokeWidth={1.8} />
      <input
        className={cx(
          "h-9 w-full rounded-[2px] border border-[#c4c7cc] bg-white pl-9 pr-3 text-sm text-[#383838] outline-none transition placeholder:text-[#909294] focus:border-[#479dff]",
          inputClassName
        )}
        {...props}
      />
    </label>
  );
}

export function DesignerSubpanel({
  title,
  count,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  count?: ReactNode;
}) {
  return (
    <div className={cx("rounded-[8px] border border-zinc-200 bg-white p-4 shadow-[0_14px_42px_-38px_rgba(24,24,27,0.65)]", className)} {...props}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{title}</p>
        </div>
        {count ? <span className="rounded-full bg-zinc-50 px-2.5 py-1 font-mono text-[10px] text-zinc-500">{count}</span> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function DesignerCatalogItem({
  title,
  badges,
  description,
  action,
  draggable = false,
  className,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title: ReactNode;
  badges?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  draggable?: boolean;
}) {
  return (
    <div
      className={cx(
        "group rounded-[12px] border bg-white p-3 text-left transition hover:-translate-y-0.5",
        draggable && "active:scale-[0.99]",
        className
      )}
      draggable={draggable}
      {...props}
    >
      <span className="flex items-center justify-between gap-3 text-sm font-medium">
        <span className="min-w-0">{title}</span>
        {action ? <span className="shrink-0">{action}</span> : null}
      </span>
      {badges ? <span className="mt-2 flex flex-wrap gap-1.5">{badges}</span> : null}
      {children}
      {description ? <span className="mt-1 block text-xs leading-5 text-zinc-500">{description}</span> : null}
    </div>
  );
}

export function DesignerPopoverOptionCard({
  selected = false,
  variant = "card",
  leading,
  title,
  description,
  aside,
  className,
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  selected?: boolean;
  variant?: "card" | "flat";
  leading?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <button
      className={cx(
        variant === "flat"
          ? "popover_item flex w-full items-center gap-2 rounded-[4px] border-0 px-2 py-2 text-left text-[#383838] outline-none transition hover:bg-[#f7f8fb] focus-visible:outline-none"
          : "grid grid-cols-[1fr_auto] items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition active:scale-[0.99]",
        variant === "flat"
          ? (selected ? "bg-[#f2f5ff] text-[#383838]" : "bg-transparent text-[#383838]")
          : (selected ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"),
        className
      )}
      type="button"
      {...props}
    >
      <span className={cx("min-w-0", variant === "flat" ? "flex min-w-0 flex-1 items-center gap-2" : "")}>
        {variant === "flat" ? leading : null}
        <span className="min-w-0">
          <span className={cx("flex items-center gap-2", variant !== "flat" ? "" : "min-w-0")}>
            {variant !== "flat" ? leading : null}
            <span className={cx("truncate text-sm", variant === "flat" ? "font-normal text-[#383838]" : "font-medium")}>{title}</span>
          </span>
        {description ? (
          <span className={cx("mt-1 block truncate font-mono text-[10px]", variant === "flat" ? "pl-7 text-zinc-400" : selected ? "text-white/55" : "text-zinc-400")}>
            {description}
          </span>
        ) : null}
        {children}
        </span>
      </span>
      {aside ? <span className="shrink-0">{aside}</span> : null}
    </button>
  );
}

export function DesignerPopoverOptionList<T>({
  items,
  itemKey,
  itemSelected,
  itemLeading,
  itemTitle,
  itemDescription,
  itemAside,
  onItemClick,
  variant = "card",
  className
}: {
  items: T[];
  itemKey: (item: T, index: number) => string;
  itemSelected: (item: T, index: number) => boolean;
  itemLeading?: (item: T, index: number) => ReactNode;
  itemTitle: (item: T, index: number) => ReactNode;
  itemDescription?: (item: T, index: number) => ReactNode;
  itemAside?: (item: T, index: number) => ReactNode;
  onItemClick: (item: T, index: number) => void;
  variant?: "card" | "flat";
  className?: string;
}) {
  return (
    <div className={cx(variant === "flat" ? "grid gap-0" : "grid gap-1.5", className)}>
      {items.map((item, index) => (
        <DesignerPopoverOptionCard
          aside={itemAside?.(item, index)}
          description={itemDescription?.(item, index)}
          key={itemKey(item, index)}
          leading={itemLeading?.(item, index)}
          onClick={() => onItemClick(item, index)}
          selected={itemSelected(item, index)}
          title={itemTitle(item, index)}
          variant={variant}
        />
      ))}
    </div>
  );
}

export function DesignerModeTabs<T extends string>({
  active,
  items,
  onValueChange,
  tone = "underline",
  surface = "panel",
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  active: T;
  items: Array<{ key: T; label: ReactNode; icon?: ReactNode }>;
  onValueChange: (key: T) => void;
  tone?: "underline" | "pill";
  surface?: "panel" | "bare";
}) {
  return (
    <div
      className={cx(
        surface === "panel" && "border-b border-zinc-200 bg-white px-4 py-3",
        surface === "bare" && "w-full",
        className
      )}
      {...props}
    >
      <div className={cx("flex items-center", tone === "pill" ? "justify-center" : "gap-4")}>
        <div className={cx(tone === "pill" ? "flex min-h-10 w-full min-w-0 items-center justify-center gap-1 rounded-[10px] bg-[#eef1f5] p-1" : "flex items-center gap-4")}>
        {items.map((item) => {
          const selected = item.key === active;
          return (
            <button
              aria-pressed={selected}
              className={cx(
                "inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed]/35",
                tone === "pill"
                  ? cx(
                      "h-8 flex-1 rounded-[8px] px-2 py-0 text-[12px] font-medium",
                      selected ? "bg-[#f4a719] text-white" : "text-[#6b7282] hover:text-[#383838]"
                    )
                  : cx(
                      "border-b-2 px-1 py-1.5",
                      selected ? "border-zinc-950 font-medium text-zinc-950" : "border-transparent text-zinc-500 hover:text-zinc-900"
                    )
              )}
              key={item.key}
              data-designer-tab-key={item.key}
              onClick={() => onValueChange(item.key)}
              type="button"
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}

export function DesignerDockedPanel({
  title,
  children,
  defaultOpen = false,
  className,
  ...props
}: HTMLAttributes<HTMLDetailsElement> & {
  title: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className={cx("rounded-[8px] border border-zinc-200 bg-white", className)} open={defaultOpen} {...props}>
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-800">{title}</summary>
      <div className="border-t border-zinc-200">{children}</div>
    </details>
  );
}

export function DesignerNavigationPanel({
  title,
  eyebrow,
  meta,
  children,
  footer,
  className,
  bodyClassName,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <div className={cx("rounded-[8px] border border-zinc-200 bg-white", className)} {...props}>
      <div className="border-b border-zinc-200 px-4 py-3">
        {eyebrow ? <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</p> : null}
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium text-zinc-800">{title}</p>
          {meta ? <div className="shrink-0">{meta}</div> : null}
        </div>
      </div>
      <div className={cx("min-h-0", bodyClassName)}>{children}</div>
      {footer ? <div className="border-t border-zinc-200 px-3 py-3">{footer}</div> : null}
    </div>
  );
}

export function DesignerActionButton({
  tone = "neutral",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      className={cx(
        "rounded-lg border px-3 py-2 text-sm transition hover:bg-zinc-50 disabled:opacity-40",
        tone === "danger" ? "border-zinc-200 text-clay hover:bg-clay/5" : "border-zinc-200 text-zinc-800",
        className
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function DesignerHudPanel({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-[10px] border border-black/10 bg-white/90 px-3 py-2 shadow-[0_18px_42px_-30px_rgba(24,24,27,0.45)] backdrop-blur",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DesignerPopoverShell({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-[4px] border border-zinc-200 bg-white shadow-[0_2px_10px_0_rgba(0,0,0,0.1),0_0_4px_0_rgba(0,0,0,0.04)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DesignerPopoverHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={cx("border-b border-zinc-200 bg-zinc-50/90 px-4 py-4", className)} {...props}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</p>
          <p className="mt-1 truncate text-sm font-semibold text-zinc-950">{title}</p>
          {description ? <p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}

export function DesignerPopoverBody({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("max-h-[360px] overflow-auto p-0", className)} {...props}>
      {children}
    </div>
  );
}
