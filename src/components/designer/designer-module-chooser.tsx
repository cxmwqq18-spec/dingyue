"use client";

import { useEffect, useRef, useState, type ComponentProps, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { ModuleLibrary } from "@/components/designer/module-library";
import {
  DesignerPopoverBody,
  DesignerPopoverShell,
  DesignerSearchField
} from "@/components/designer/designer-sidebar-primitives";
import { useDesignerPopover } from "@/components/designer/use-designer-popover";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function DesignerModuleChooser({
  onAddSection,
  pageTitle,
  sectionCount,
  moduleLibraryProps,
  variant = "footer"
}: {
  onAddSection?: ComponentProps<typeof ModuleLibrary>["onAddSection"];
  pageTitle: string;
  sectionCount: number;
  moduleLibraryProps: ComponentProps<typeof ModuleLibrary>;
  variant?: "footer" | "inline" | "rail";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const rootRef = useDesignerPopover(open, () => setOpen(false), [popoverRef]);
  const compactTrigger = variant === "inline" || variant === "rail";
  const rail = variant === "rail";

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPopoverStyle(null);
      return;
    }

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = compactTrigger ? 276 : Math.max(360, rect.width);
      const viewportPadding = 8;
      const preferredHeight = Math.min(window.innerHeight * 0.56, 420);
      let left = rect.left;
      if (left + width > window.innerWidth - viewportPadding) {
        left = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
      }

      if (rail) {
        const availableAbove = Math.max(0, rect.top - viewportPadding);
        const availableBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding);
        const placeAbove = availableAbove >= Math.min(preferredHeight, 240) || availableAbove >= availableBelow;
        const maxHeight = Math.max(180, Math.min(preferredHeight, placeAbove ? availableAbove : availableBelow));
        setPopoverStyle({
          position: "fixed",
          left,
          top: placeAbove ? Math.max(viewportPadding, rect.top - maxHeight - 6) : Math.min(window.innerHeight - viewportPadding - maxHeight, rect.bottom + 6),
          maxHeight,
          width,
          zIndex: 90
        });
        return;
      }

      if (compactTrigger) {
        const availableAbove = Math.max(0, rect.top - viewportPadding);
        const availableBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding);
        const placeAbove = availableBelow < 220 && availableAbove > availableBelow;
        const maxHeight = Math.max(180, Math.min(preferredHeight, placeAbove ? availableAbove : availableBelow));
        const top = placeAbove ? Math.max(viewportPadding, rect.top - maxHeight - 6) : rect.bottom + 6;
        setPopoverStyle({
          position: "fixed",
          left,
          top,
          maxHeight,
          width,
          zIndex: 90
        });
        return;
      }

      setPopoverStyle({
        position: "fixed",
        left,
        bottom: window.innerHeight - rect.top + 10,
        width,
        zIndex: 90
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [compactTrigger, open, rail]);

  return (
    <div className="relative" ref={rootRef}>
      {open && popoverStyle && typeof document !== "undefined"
        ? createPortal(
            <div className="z-[90]" ref={popoverRef} style={popoverStyle}>
              <DesignerPopoverShell className={cx("popover_model", compactTrigger ? "rounded-[4px] border border-zinc-200 shadow-[0_2px_10px_0_rgba(0,0,0,0.1),0_0_4px_0_rgba(0,0,0,0.04)]" : undefined)}>
                {compactTrigger ? null : (
                  <DesignerPopoverBody className="border-b border-zinc-200 bg-zinc-50/50 px-4 py-4">
                    <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-2">
                      <DesignerSearchField
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="搜索模块"
                        value={query}
                      />
                    </div>
                  </DesignerPopoverBody>
                )}

                <ModuleLibrary
                  {...moduleLibraryProps}
                  onAddSection={(type) => {
                    (onAddSection ?? moduleLibraryProps.onAddSection)(type);
                    setOpen(false);
                  }}
                  query={compactTrigger ? "" : query}
                  showIntro={false}
                  variant="popover"
                />
              </DesignerPopoverShell>
            </div>,
            document.body
          )
        : null}

      <button
        ref={triggerRef}
        className={cx(
          rail
            ? "add_47ab mx-0 flex min-h-9 w-full items-center justify-start rounded-[4px] border-0 px-2 py-2 text-left transition focus-visible:outline-none"
            : compactTrigger
            ? "add_47ab flex min-h-9 w-full items-center justify-start rounded-[4px] border-0 px-2 py-2 text-left transition focus-visible:outline-none"
            : "flex w-full items-center justify-between gap-4 rounded-[14px] border px-4 py-3 text-left shadow-[0_18px_52px_-44px_rgba(24,24,27,0.6)] transition focus-visible:outline-none",
          open
            ? compactTrigger
              ? "bg-[#f7f8fb] text-[#f4a719]"
              : "border-zinc-950 bg-zinc-950 text-white"
            : rail
            ? "bg-transparent text-[#f4a719] hover:bg-[#f7f8fb] hover:text-[#f4a719]"
            : compactTrigger
            ? "bg-transparent text-[#f4a719] hover:bg-[#f7f8fb] hover:text-[#f4a719]"
            : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:-translate-y-0.5"
        )}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className={cx("flex min-w-0", compactTrigger ? "items-center gap-2" : "items-start gap-3")}>
          <span className={cx(rail || compactTrigger ? "grid h-5 w-5 shrink-0 place-items-center text-current" : "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[12px] border", !compactTrigger && open ? "border-white/10 bg-white/10" : rail || compactTrigger ? "" : "border-[#f4a719]/20 bg-[#f4a719]/10 text-[#8a5a00]")}>
            <Plus className={rail || compactTrigger ? "h-3.5 w-3.5" : "h-[18px] w-[18px]"} strokeWidth={1.8} />
          </span>
          <span className="min-w-0">
            <span className={cx("block truncate font-semibold", rail ? "text-sm text-[#f4a719]" : compactTrigger ? "mt-0 text-sm text-[#f4a719]" : "mt-1 text-sm")}>{compactTrigger ? "添加模块" : "添加模块"}</span>
          </span>
        </span>
        {!compactTrigger ? (
          <span className={cx("shrink-0 rounded-full border px-2.5 py-1.5 font-mono text-[10px]", open ? "border-white/15 bg-white/10 text-white/65" : "border-zinc-200 bg-zinc-50 text-zinc-500")}>
            {pageTitle}
          </span>
        ) : null}
      </button>
    </div>
  );
}
