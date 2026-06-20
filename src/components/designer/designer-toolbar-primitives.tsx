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
      className={cx("header_a5ed border-b border-[#c4c7cc] bg-[#1f2430] text-white shadow-none", className)}
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
    <div className={cx("relative flex min-h-[56px] items-center overflow-hidden px-0 py-0", className)} {...props}>
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
        "btn_82a1 operation-item_40c8 inline-flex h-[56px] items-center justify-center gap-[8px] rounded-none px-3 text-[13px] font-normal transition",
        tone === "primary"
          ? "bg-[#f4a719] font-medium text-white hover:bg-[#e59a00]"
          : "bg-transparent text-white/92 hover:bg-[#313747]",
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
    <div className={cx("collection_221b btn_82a1 relative h-[56px] w-[168px] shrink-0", className)}>
      <select
        className="h-[56px] w-full appearance-none border-0 bg-transparent px-3 pr-8 text-sm text-white outline-none transition"
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
  triggerLabel = "页面"
}: {
  value: string;
  options: DesignerToolbarMenuOption[];
  onValueChange: (key: string) => void;
  className?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useDesignerPopover(open, () => setOpen(false));
  const selectedOption = options.find((option) => option.key === value) ?? options[0];

  return (
    <div className={cx("collection_221b btn_82a1 relative h-[56px] w-[176px] shrink-0", className)} ref={rootRef}>
      <button
        aria-expanded={open}
        className={cx(
          "active_636b inline-flex h-[56px] w-full items-center justify-between gap-2 rounded-none border-0 bg-transparent px-3 text-left text-white transition hover:bg-[#313747]",
          open && "bg-[#313747]"
        )}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="page_name_81f0 block min-w-0 truncate text-sm font-normal">
          {selectedOption?.label ?? triggerLabel}
        </span>
        <ChevronDown className={cx("icon_449c h-4 w-4 shrink-0 text-white/80 transition", open && "rotate-180")} strokeWidth={1.8} />
      </button>

      {open ? (
        <div className="absolute left-[38px] top-[calc(100%+8px)] z-30 w-[290px]">
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
    <div className={cx("select-group_6037 center_470b grid h-[48px] overflow-hidden rounded-[12px] border border-[#6f9ae7] bg-[#2f6fed] shadow-none", className)} {...props}>
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
        "select-btn_b6b1 inline-flex h-[48px] w-14 items-center justify-center gap-0 px-0 text-sm transition",
        active ? "select_2c31 bg-[#5f9cff] text-white" : "text-white/72 hover:bg-[#3d78eb] hover:text-white",
        className
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
