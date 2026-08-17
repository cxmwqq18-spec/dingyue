"use client";

import { useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import {
  DesignerPopoverShell
} from "@/components/designer/designer-sidebar-primitives";
import { useDesignerPopover } from "@/components/designer/use-designer-popover";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export type DesignerToolbarMenuOption = {
  key: string;
  label: string;
  description?: string;
  chipLabel?: string;
  chipTone?: "default" | "live" | "draft";
};

export function DesignerTopbarShell({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("designer-command-bar border-b border-[#101722] bg-[#1f2530] text-white shadow-none", className)}
      data-admin-command-bar="saas-style"
      {...props}
    >
      {children}
    </div>
  );
}

export function DesignerTopbarRow({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("relative grid min-h-[64px] grid-cols-[minmax(170px,240px)_96px_minmax(0,1fr)] items-center gap-3 overflow-hidden px-3 py-0", className)} {...props}>
      {children}
    </div>
  );
}

export function DesignerToolbarButton({
  tone = "default",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "primary";
}) {
  return (
    <button
      className={cx(
        "inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[8px] border px-3 text-[13px] font-medium leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 disabled:cursor-not-allowed disabled:opacity-55",
        tone === "primary"
          ? "border-[#f4a719] bg-[#f4a719] text-white hover:bg-[#e59a00]"
          : "border-white/10 bg-white/[0.04] text-white/88 hover:bg-white/[0.1] hover:text-white",
        className
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function DesignerToolbarSelect({
  suffix,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  suffix?: ReactNode;
}) {
  return (
    <div className={cx("relative h-10 w-[168px] shrink-0 rounded-[8px] border border-white/10 bg-white/[0.04]", className)}>
      <select
        className="h-10 w-full appearance-none border-0 bg-transparent px-3 pr-8 text-sm text-white outline-none transition"
        {...props}
      >
        {children}
      </select>
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] uppercase tracking-[0.14em] text-white/45">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export function DesignerToolbarMenu({
  value,
  options,
  onValueChange,
  className,
  triggerLabel = "页面",
  tone = "dark"
}: {
  value: string;
  options: DesignerToolbarMenuOption[];
  onValueChange: (key: string) => void;
  className?: string;
  triggerLabel?: string;
  tone?: "dark" | "light";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useDesignerPopover(open, () => setOpen(false));
  const selectedOption = options.find((option) => option.key === value) ?? options[0];

  return (
    <div
      className={cx(
        "relative h-10 w-[190px] shrink-0 rounded-[8px] border",
        tone === "light" ? "border-[#d9dde4] bg-white text-[#344054]" : "border-white/10 bg-white/[0.04] text-white",
        className
      )}
      ref={rootRef}
    >
      <button
        aria-expanded={open}
        className={cx(
          "inline-flex h-10 w-full items-center justify-between gap-2 rounded-[8px] border-0 bg-transparent px-3 text-left transition",
          tone === "light" ? "text-[#344054] hover:bg-[#f7f8fb]" : "text-white hover:bg-white/[0.1]",
          open && (tone === "light" ? "bg-[#f7f8fb]" : "bg-white/[0.1]")
        )}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="block min-w-0 truncate text-sm font-medium">
          {selectedOption?.label ?? triggerLabel}
        </span>
        <ChevronDown className={cx("h-4 w-4 shrink-0 transition", tone === "light" ? "text-[#667085]" : "text-white/80", open && "rotate-180")} strokeWidth={1.8} />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-[320px]">
          <DesignerPopoverShell className="overflow-hidden rounded-[4px] border border-zinc-200 bg-white shadow-[0_0_4px_1px_rgba(0,0,0,0.04),0_2px_10px_1px_rgba(0,0,0,0.1)]">
            <ul className="page_list_menu_85f7 m-0 list-none p-1 text-sm text-[#383838]">
              {options.map((option) => {
                const selected = option.key === value;
                return (
                  <li
                    className={cx(
                      "flex cursor-pointer items-center justify-between gap-3 px-3 py-3",
                      selected && "active_636b bg-[#f2f5ff] text-[#3369ff]",
                      !selected && "hover:bg-[#f2f5ff] hover:text-[#3369ff]"
                    )}
                    key={option.key}
                    onClick={() => {
                      onValueChange(option.key);
                      setOpen(false);
                    }}
                  >
                    <p className="m-0 min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis p-0 leading-5">
                      {option.label}
                    </p>
                    {option.chipLabel ? (
                      <span className={cx("shrink-0 font-mono text-[10px] uppercase", selected ? "text-[#3369ff]" : "text-[#909294]")}>
                        {option.chipLabel}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </DesignerPopoverShell>
        </div>
      ) : null}
    </div>
  );
}

export function DesignerToolbarSegmented({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("grid h-10 overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.06] shadow-none", className)} {...props}>
      {children}
    </div>
  );
}

export function DesignerToolbarSegmentedButton({
  active = false,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      className={cx(
        "inline-flex h-10 min-w-10 items-center justify-center gap-0 px-0 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35",
        active ? "bg-[#2f6fed] text-white" : "text-white/68 hover:bg-white/[0.1] hover:text-white",
        className
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
