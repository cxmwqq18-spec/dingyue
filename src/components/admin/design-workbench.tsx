"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  ExternalLink,
  Search
} from "lucide-react";
import { ProgressBar, StatusPill } from "@/components/ui";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function DesignWorkbenchLayout({
  sidebar,
  children,
  aside,
  className = ""
}: {
  sidebar?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  const gridClass = sidebar && aside
    ? "2xl:grid-cols-[220px_minmax(0,1fr)_280px]"
    : sidebar
    ? "xl:grid-cols-[220px_minmax(0,1fr)]"
    : aside
    ? "2xl:grid-cols-[minmax(0,1fr)_300px]"
    : "grid-cols-1";

  return (
    <div className={cx("grid gap-4", gridClass, className)}>
      {sidebar ? <aside className="min-w-0">{sidebar}</aside> : null}
      <div className="min-w-0">{children}</div>
      {aside ? <aside className="min-w-0">{aside}</aside> : null}
    </div>
  );
}

export function WorkbenchMetricStrip({
  items
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="grid gap-3 rounded-[8px] border border-[#e6ebf2] bg-white px-4 py-3.5 shadow-[0_12px_26px_-34px_rgba(15,23,42,0.18)] md:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <div
          className={cx(
            "min-w-0",
            index < items.length - 1 && "xl:border-r xl:border-[#edf2f7] xl:pr-4"
          )}
          key={item.label}
        >
          <div className="text-[12px] text-[#667085]">{item.label}</div>
          <div className="mt-1 text-[33px] font-semibold leading-none tracking-[-0.05em] text-[#111827]">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function WorkbenchPanel({
  title,
  eyebrow,
  description,
  action,
  children,
  className = ""
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("overflow-hidden rounded-[8px] border border-[#e3e8ef] bg-white shadow-[0_14px_28px_-32px_rgba(15,23,42,0.16)]", className)}>
      <div className="flex items-start justify-between gap-4 border-b border-[#edf2f7] px-5 py-4">
        <div className="min-w-0">
          {eyebrow ? <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#98a2b3]">{eyebrow}</div> : null}
          <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.02em] text-[#18212f]">{title}</h3>
          {description ? <p className="mt-1 text-[13px] leading-6 text-[#667085]">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function WorkbenchMiniStat({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <div className="rounded-[8px] border border-[#e7edf3] bg-white px-4 py-3.5 shadow-[0_12px_24px_-30px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium text-[#475467]">{label}</span>
        <span className={cx("h-2.5 w-2.5 rounded-full", tone === "good" && "bg-[#22c55e]", tone === "warn" && "bg-[#f59e0b]", tone === "bad" && "bg-[#ef4444]", tone === "neutral" && "bg-[#94a3b8]")} />
      </div>
      <div className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.04em] text-[#101828]">{value}</div>
      {detail ? <div className="mt-2 text-[12px] leading-5 text-[#98a2b3]">{detail}</div> : null}
    </div>
  );
}

export function WorkbenchSectionTabs({
  items,
  active,
  onChange
}: {
  items: Array<{ key: string; label: string }>;
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-6 border-b border-[#edf2f7] px-2">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            className={cx(
              "relative inline-flex h-11 items-center text-[14px] font-medium transition",
              isActive ? "text-[#2f6fed]" : "text-[#667085] hover:text-[#18212f]"
            )}
            key={item.key}
            onClick={() => onChange(item.key)}
            type="button"
          >
            {item.label}
            {isActive ? <span className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-full bg-[#2f6fed]" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function WorkbenchSearchRow({
  controls,
  actions
}: {
  controls: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0 flex-1">{controls}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function WorkbenchTableShell({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("overflow-hidden rounded-[18px] border border-[#e6ebf2] bg-white", className)}>
      {children}
    </div>
  );
}

export function WorkbenchTableHeader({
  columns,
  className = ""
}: {
  columns: string[];
  className?: string;
}) {
  return (
    <div
      className={cx(
        "grid gap-3 border-b border-[#edf2f7] px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-[#98a2b3]",
        className
      )}
    >
      {columns.map((column) => (
        <span key={column}>{column}</span>
      ))}
    </div>
  );
}

export function WorkbenchTableRow({
  children,
  className = "",
  active = false
}: {
  children: ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <div
      className={cx(
        "grid gap-3 border-b border-[#edf2f7] px-5 py-4 transition last:border-b-0",
        active ? "bg-[#f6f8fc]" : "bg-white hover:bg-[#fbfcfe]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function WorkbenchSidebarCard({
  title,
  eyebrow,
  children,
  action
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-[#e6ebf2] bg-white shadow-[0_14px_28px_-34px_rgba(15,23,42,0.16)]">
      <div className="border-b border-[#edf2f7] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow ? <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#98a2b3]">{eyebrow}</div> : null}
            <div className="mt-1 text-[14px] font-semibold text-[#18212f]">{title}</div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export function WorkbenchRowLink({
  href,
  label
}: {
  href: string;
  label: string;
}) {
  return (
    <Link className="inline-flex items-center gap-1 text-[13px] font-medium text-[#2f6fed]" href={href}>
      {label}
      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
    </Link>
  );
}

export function WorkbenchSearchInput({
  value,
  placeholder,
  onChange
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex h-[38px] items-center gap-3 rounded-[8px] border border-[#d8e0ea] bg-white px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
      <Search className="h-4 w-4 text-[#98a2b3]" strokeWidth={1.8} />
      <input
        className="w-full border-0 bg-transparent p-0 text-[13px] text-[#18212f] outline-none placeholder:text-[#98a2b3]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

export function WorkbenchSelect({
  value,
  options,
  onChange
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="h-[38px] rounded-[8px] border border-[#d8e0ea] bg-white px-3 text-[13px] text-[#18212f] outline-none"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function WorkbenchActionButton({
  label,
  href,
  onClick,
  primary = false,
  quiet = false
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
  quiet?: boolean;
}) {
  const className = cx(
    "inline-flex h-[38px] items-center justify-center rounded-[8px] px-4 text-[13px] font-medium transition",
    primary
      ? "bg-[#2f6fed] text-white shadow-[0_18px_28px_-22px_rgba(47,111,237,0.6)] hover:bg-[#1f61db]"
      : quiet
      ? "border border-[#edf2f7] bg-white text-[#667085] hover:text-[#18212f]"
      : "border border-[#d8e0ea] bg-white text-[#18212f] hover:border-[#bfd0f5] hover:text-[#2f6fed]"
  );

  if (href) {
    return (
      <Link className={className} href={href}>
        {label}
      </Link>
    );
  }

  return (
    <button className={className} onClick={onClick} type="button">
      {label}
    </button>
  );
}

export function PageTreeCard({
  active,
  title,
  path,
  routeType,
  status,
  sectionCount,
  blockCount,
  editorHref,
  previewHref,
  onSelect
}: {
  active?: boolean;
  title: string;
  path: string;
  routeType: string;
  status: { label: string; tone: "good" | "warn" | "bad" | "neutral" };
  sectionCount: number;
  blockCount: number;
  editorHref: string;
  previewHref: string;
  onSelect?: () => void;
}) {
  return (
    <button
      className={cx(
        "flex w-full items-start gap-3 rounded-[14px] border px-4 py-4 text-left transition",
        active ? "border-[#bfd0f5] bg-[#f5f8ff]" : "border-[#edf2f7] bg-white hover:border-[#dbe4f0] hover:bg-[#fbfcfe]"
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[#e4e7ec] bg-[#f8fafc] text-[#667085]">
        <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-[#18212f]">{title}</span>
          <StatusPill label={status.label} tone={status.tone} />
        </span>
        <span className="mt-1 block truncate font-mono text-[11px] text-[#98a2b3]">{path}</span>
        <span className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-[#667085]">
          <span>{routeType}</span>
          <span>{sectionCount} sections</span>
          <span>{blockCount} blocks</span>
        </span>
        <span className="mt-3 flex flex-wrap items-center gap-3 text-[12px] font-medium">
          <Link className="text-[#2f6fed]" href={editorHref} onClick={(event) => event.stopPropagation()}>
            Edit in Designer
          </Link>
          <Link className="inline-flex items-center gap-1 text-[#667085]" href={previewHref} onClick={(event) => event.stopPropagation()}>
            Preview
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
          </Link>
        </span>
      </span>
    </button>
  );
}

export function WorkbenchInfoList({
  items
}: {
  items: Array<{ label: string; value: ReactNode; tone?: "good" | "warn" | "bad" | "neutral" }>;
}) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-[#edf2f7] bg-white">
      {items.map((item, index) => (
        <div
          className={cx("flex items-center justify-between gap-3 px-4 py-3", index < items.length - 1 && "border-b border-[#edf2f7]")}
          key={item.label}
        >
          <span className="flex items-center gap-2 text-[13px] text-[#667085]">
            <span
              className={cx(
                "h-2 w-2 rounded-full",
                item.tone === "good" && "bg-[#22c55e]",
                item.tone === "warn" && "bg-[#f59e0b]",
                item.tone === "bad" && "bg-[#ef4444]",
                (!item.tone || item.tone === "neutral") && "bg-[#94a3b8]"
              )}
            />
            {item.label}
          </span>
          <span className="text-right text-[13px] font-medium text-[#18212f]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function PublicationConfidence({
  value,
  label
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#edf2f7] bg-white px-4 py-4">
      <div className="text-[13px] font-medium text-[#18212f]">{label}</div>
      <div className="mt-5 px-2">
        <div className="mx-auto flex h-[160px] w-[160px] items-center justify-center rounded-full border-[10px] border-[#e9eef6]">
          <div className="text-center">
            <div className="text-[40px] font-semibold tracking-[-0.05em] text-[#18212f]">{value}%</div>
            <div className="text-[12px] text-[#667085]">发布置信度</div>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <ProgressBar tone={value >= 80 ? "good" : value >= 55 ? "warn" : "bad"} value={value} />
      </div>
    </div>
  );
}

export function SiteRegistryRowCard({
  index,
  name,
  siteId,
  slug,
  domain,
  domainCount,
  owner,
  customerCount,
  subscriptionCount,
  revenueLabel,
  chargesReady,
  publicationCount,
  enabledAppCount,
  appCount,
  healthScore,
  jobCount,
  status,
  adminHref,
  storefrontHref,
  themeHref,
  settingsHref,
  actions
}: {
  index: number;
  name: string;
  siteId: string;
  slug: string;
  domain: string;
  domainCount: number;
  owner: string;
  customerCount: number;
  subscriptionCount: number;
  revenueLabel: string;
  chargesReady: boolean;
  publicationCount: number;
  enabledAppCount: number;
  appCount: number;
  healthScore: number;
  jobCount: number;
  status: { label: string; tone: "good" | "warn" | "bad" | "neutral" };
  adminHref: string;
  storefrontHref: string;
  themeHref: string;
  settingsHref: string;
  actions?: ReactNode;
}) {
  return (
    <div className="grid gap-4 rounded-[8px] border border-[#edf2f7] bg-white px-4 py-4 shadow-[0_12px_24px_-30px_rgba(15,23,42,0.12)] lg:grid-cols-[56px_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_180px]">
      <div className="flex items-start justify-between gap-3 lg:block">
        <div className="text-[24px] font-semibold leading-none tracking-[-0.04em] text-[#101828]">{index}</div>
        <StatusPill label={status.label} tone={status.tone} />
      </div>

      <div className="min-w-0">
        <Link className="truncate text-[15px] font-semibold text-[#2f6fed]" href={adminHref}>
          {name}
        </Link>
        <div className="mt-1 truncate font-mono text-[11px] text-[#98a2b3]">{siteId}</div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[#667085]">
          <span>{slug}</span>
          <span className="rounded-full bg-[#f2f4f7] px-2 py-1 text-[11px] text-[#667085]">{publicationCount} snapshots</span>
        </div>
      </div>

      <div className="min-w-0">
        <Link className="truncate text-[14px] font-medium text-[#18212f]" href={storefrontHref}>
          {domain}
        </Link>
        <div className="mt-1 text-[12px] text-[#98a2b3]">{domainCount} 个域名</div>
        <div className="mt-3 text-[13px] text-[#475467]">{owner}</div>
      </div>

      <div>
        <div className="text-[22px] font-semibold leading-none tracking-[-0.04em] text-[#101828]">{customerCount}</div>
        <div className="mt-2 text-[12px] text-[#667085]">{subscriptionCount} 个有效订阅</div>
      </div>

      <div>
        <div className={cx("text-[14px] font-semibold", chargesReady ? "text-[#12b76a]" : "text-[#f79009]")}>
          {chargesReady ? "已就绪" : "待开户"}
        </div>
        <div className="mt-2 font-mono text-[13px] text-[#101828]">{revenueLabel}</div>
      </div>

      <div>
        <div className="text-[14px] font-semibold text-[#18212f]">{enabledAppCount}/{appCount}</div>
        <div className="mt-2 text-[12px] text-[#667085]">{jobCount} 个任务</div>
      </div>

      <div className="grid gap-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[12px] text-[#667085]">
            <span>健康度</span>
            <span className="font-medium text-[#18212f]">{healthScore}%</span>
          </div>
          <ProgressBar tone={healthScore >= 76 ? "good" : healthScore >= 50 ? "warn" : "bad"} value={healthScore} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions ?? (
            <>
              <WorkbenchActionButton href={adminHref} label="后台" quiet />
              <WorkbenchActionButton href={storefrontHref} label="前台" quiet />
              <WorkbenchActionButton href={themeHref} label="主题" />
              <WorkbenchActionButton href={settingsHref} label="配置" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
