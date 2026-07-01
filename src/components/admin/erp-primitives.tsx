import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import type { LucideIcon } from "lucide-react";

type Tone = "good" | "warn" | "bad" | "neutral";

function toneClass(tone: Tone) {
  return {
    good: "bg-[#22c55e]",
    warn: "bg-[#f59e0b]",
    bad: "bg-[#ef4444]",
    neutral: "bg-[#94a3b8]"
  }[tone];
}

export function ErpSection({
  eyebrow,
  title,
  description,
  action,
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`right_box min-w-0 max-w-full rounded-[8px] border border-[var(--admin-border-soft)] bg-white shadow-[0_12px_24px_-30px_rgba(15,23,42,0.14)] ${className}`}
      {...props}
    >
      <div className="px-4 pt-4">
        <div className="xt_tt">
          <span>{title}</span>
          {eyebrow ? <em className="ml-2 not-italic font-mono text-[10px] uppercase tracking-[0.12em] text-[#98a2b3]">{eyebrow}</em> : null}
          {action ? <div className="float-right mr-1 flex h-[46px] items-center gap-2">{action}</div> : null}
          <div className="clear" />
        </div>
        {description ? <p className="mt-1.5 text-[12px] leading-5 text-[#8a94a6]">{description}</p> : null}
      </div>
      <div className="min-w-0 px-4 pb-4 pt-3">{children}</div>
    </section>
  );
}

export function ErpToolbar({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 max-w-full rounded-[8px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)]/92 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] ${className}`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">{children}</div>
    </div>
  );
}

export function ErpToolbarField({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="inline-flex min-h-[34px] items-center rounded-[8px] border border-[var(--admin-border-soft)] bg-white px-3 text-[12px] text-[var(--admin-muted)] shadow-[0_8px_18px_-22px_rgba(15,23,42,0.18)]">
      <span className="mr-1 text-[var(--admin-text)]">{label}:</span>
      <span className="font-mono text-[var(--admin-text)]">{value}</span>
    </div>
  );
}

export function ErpToolbarAction({
  label,
  href,
  primary = false,
  onClick
}: {
  label: string;
  href?: string;
  primary?: boolean;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
}) {
  const className = primary
    ? "input_btn inline-flex h-[34px] items-center justify-center whitespace-nowrap px-3.5"
    : "admin_btn inline-flex h-[34px] items-center justify-center whitespace-nowrap px-3.5";

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

export function ErpStatGrid({
  items,
  columns = 4
}: {
  items: Array<{
    label: string;
    value: string;
    detail: string;
    icon?: LucideIcon;
    tone?: Tone;
    href?: string;
  }>;
  columns?: 2 | 3 | 4 | 5 | 6;
}) {
  const gridClass =
    columns === 2
      ? "md:grid-cols-2"
    : columns === 3
      ? "md:grid-cols-2 xl:grid-cols-3"
    : columns === 5
      ? "md:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-5"
    : columns === 6
      ? "md:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-6"
      : "md:grid-cols-2 min-[1800px]:grid-cols-4";

  return (
    <div className={`grid w-full min-w-0 max-w-full gap-3 ${gridClass}`}>
      {items.map((item) => (
        <ErpStatCard key={item.label} {...item} />
      ))}
    </div>
  );
}

export function ErpStatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
  href
}: {
  label: string;
  value: string;
  detail: string;
  icon?: LucideIcon;
  tone?: Tone;
  href?: string;
}) {
  const card = (
    <div className="h-full min-w-0 rounded-[8px] border border-[var(--admin-border-soft)] bg-white px-4 py-3.5 shadow-[0_14px_24px_-30px_rgba(15,23,42,0.14)] transition hover:border-[var(--admin-accent-soft)] hover:shadow-[0_18px_34px_-30px_rgba(15,23,42,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#98a2b3]">{label}</span>
        </span>
        {Icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] text-[var(--admin-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-mono text-[30px] leading-8 tracking-[-0.04em] text-[var(--admin-text)] [overflow-wrap:anywhere]">{value}</p>
          <p className="mt-1.5 break-words text-[11px] leading-5 text-[#98a2b3] [overflow-wrap:anywhere]">{detail}</p>
        </div>
        <span className={`h-2.5 w-2.5 rounded-full ${toneClass(tone)}`} />
      </div>
    </div>
  );

  return href ? (
    <Link className="block h-full" href={href} prefetch={false}>
      {card}
    </Link>
  ) : (
    card
  );
}

export function ErpInfoList({
  items
}: {
  items: Array<{ label: string; value: string; tone?: Tone }>;
}) {
  return (
    <div className="overflow-hidden rounded-[8px] divide-y divide-[var(--admin-border-soft)] border border-[var(--admin-border-soft)] bg-[var(--admin-surface)]">
      {items.map((item) => (
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-[12px]" key={item.label}>
          <span className="flex items-center gap-2 text-[var(--admin-muted)]">
            <span className={`h-2 w-2 rounded-full ${toneClass(item.tone ?? "neutral")}`} />
            {item.label}
          </span>
          <span className="font-mono text-[var(--admin-text)]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ErpFormGrid({
  children,
  columns = 2,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <div
      className={`grid gap-4 ${columns === 1 ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2"} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function ErpField({
  label,
  hint,
  children,
  className = "",
  span = "default"
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  span?: "default" | "full";
}) {
  return (
    <label className={`grid gap-2 ${span === "full" ? "xl:col-span-2" : ""} ${className}`}>
      <span className="text-[12px] font-medium text-[#475467]">{label}</span>
      {children}
      {hint ? <span className="text-[11px] leading-5 text-[#98a2b3]">{hint}</span> : null}
    </label>
  );
}

export function ErpInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="erp-input" {...props} />;
}

export function ErpTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="erp-textarea" {...props} />;
}

export function ErpSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="erp-select" {...props} />;
}

export function ErpCheckboxRow({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex min-h-[38px] items-center gap-2 rounded-[8px] border border-[var(--admin-border-soft)] bg-white px-3 text-[12px] text-[var(--admin-text)] shadow-[0_8px_18px_-22px_rgba(15,23,42,0.14)]">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}
