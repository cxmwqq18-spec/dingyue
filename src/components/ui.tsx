import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import type { AdminTone } from "@/lib/admin-menu";

function scopedHref(href: string, siteSlug?: string): string {
  if (!siteSlug) return href;
  if (href.startsWith("http") || href.startsWith("#") || href.startsWith(`/site/${siteSlug}`)) return href;
  if (href === "/") return `/site/${siteSlug}`;
  return `/site/${siteSlug}${href}`;
}

export function Shell({
  children,
  tone = "paper"
}: {
  children: ReactNode;
  tone?: "paper" | "charcoal" | "admin";
}) {
  return (
    <main
      className={
        tone === "charcoal"
          ? "min-h-[100dvh] bg-zinc-950 text-stone-100"
          : tone === "admin"
          ? "min-h-[100dvh] overflow-x-hidden bg-[linear-gradient(180deg,#eef2f6_0%,#f7f9fc_100%)] text-[var(--admin-text)]"
          : "min-h-[100dvh] bg-paper text-ink"
      }
    >
      <div className="relative">{children}</div>
    </main>
  );
}

export function TopBar({
  brand,
  links,
  action,
  siteSlug
}: {
  brand: string;
  links: Array<{ label: string; href: string }>;
  action?: { label: string; href: string };
  siteSlug?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-paper/88 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link href="/" className="font-mono text-sm uppercase tracking-[0.22em] text-ink">
          {brand}
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-zinc-600 md:flex">
          {links.map((link) => (
            <Link className="transition hover:text-ink" href={scopedHref(link.href, siteSlug)} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        {action ? (
          <Link
            href={scopedHref(action.href, siteSlug)}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-stone-50 transition active:scale-[0.98]"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
    </header>
  );
}

export function Metric({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-t border-black/10 pt-4">
      <div className="font-mono text-2xl text-ink">{value}</div>
      <div className="mt-1 text-sm font-medium text-zinc-700">{label}</div>
      <div className="mt-1 text-xs leading-5 text-zinc-500">{detail}</div>
    </div>
  );
}

export function Panel({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-black/10 bg-white/72 shadow-diffusion ${className}`} {...props}>
      {children}
    </section>
  );
}

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: AdminTone }) {
  const toneClass = {
    good: "border-[#c8ead3] bg-[#effaf2] text-[#18794e]",
    warn: "border-[#f3d3aa] bg-[#fff5e8] text-[#b4691f]",
    bad: "border-[#f1c2c2] bg-[#fff1f1] text-[#c24141]",
    neutral: "border-[#d7dee8] bg-[#f7f9fc] text-[#667085]"
  }[tone];
  const normalizedLabel =
    label === "good"
      ? "正常"
      : label === "warn"
      ? "待处理"
      : label === "bad"
      ? "异常"
      : label === "neutral"
      ? "观察"
      : label;
  return (
    <span
      className={`inline-flex h-[24px] items-center rounded-[999px] border px-2.5 font-mono text-[10px] uppercase tracking-[0.08em] leading-[20px] ${toneClass}`}
    >
      {normalizedLabel}
    </span>
  );
}

export function OpsCard({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`right_box border border-[var(--admin-border-soft)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow)] ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}

export function OpsMetric({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const accent = {
    good: "bg-[#3f6b50]",
    warn: "bg-[#d97706]",
    bad: "bg-[#b84f3f]",
    neutral: "bg-[#98a2b3]"
  }[tone];
  return (
    <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-[linear-gradient(180deg,#ffffff_0%,#fafbfd_100%)] p-4 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.32)]">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8a94a6]">{label}</span>
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
      </div>
      <div className="mt-4 font-mono text-[28px] leading-8 tracking-tight text-[var(--admin-text)]">{value}</div>
      <div className="mt-2 text-[13px] leading-5 text-[var(--admin-muted)]">{detail}</div>
    </div>
  );
}

export function ProgressBar({ value, tone = "good" }: { value: number; tone?: "good" | "warn" | "bad" | "neutral" }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = {
    good: "bg-[#3f6b50]",
    warn: "bg-[#d97706]",
    bad: "bg-[#b84f3f]",
    neutral: "bg-[#98a2b3]"
  }[tone];
  return (
    <div className="h-[9px] overflow-hidden rounded-full bg-[#e7edf4]">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
