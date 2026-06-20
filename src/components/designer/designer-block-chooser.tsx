"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { DesignerPopoverBody, DesignerPopoverOptionList, DesignerPopoverShell } from "@/components/designer/designer-sidebar-primitives";
import { useDesignerPopover } from "@/components/designer/use-designer-popover";
import { blockSchemaDisplayLabel } from "@/components/designer/designer-metadata";
import type { ThemeBlockSchema } from "@/lib/types";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function DesignerBlockChooser({
  blockSchemas,
  onAddBlock,
  className
}: {
  blockSchemas: ThemeBlockSchema[];
  onAddBlock: (blockSchema: ThemeBlockSchema) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
  const rootRef = useDesignerPopover(open, () => setOpen(false), [popoverRef]);
  const triggerLabel = useMemo(() => {
    if (blockSchemas.length === 1) return `添加${blockSchemaDisplayLabel(blockSchemas[0])}`;
    return "添加子块";
  }, [blockSchemas]);

  useEffect(() => {
    if (!open) {
      setPopoverStyle(null);
      return;
    }

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 276;
      let left = rect.left;
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      let top = rect.bottom + 4;
      if (top + 320 > window.innerHeight - 8) {
        top = Math.max(8, rect.top - 320);
      }
      setPopoverStyle({
        position: "fixed",
        left,
        top,
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
  }, [open]);

  if (!blockSchemas.length) return null;

  return (
    <div className={cx("relative", className)} ref={rootRef}>
      {open && popoverStyle && typeof document !== "undefined"
        ? createPortal(
            <div ref={popoverRef} style={popoverStyle}>
              <DesignerPopoverShell className="popover_model rounded-[4px] border border-zinc-200 shadow-[0_2px_10px_0_rgba(0,0,0,0.1),0_0_4px_0_rgba(0,0,0,0.04)]">
                <DesignerPopoverBody className="p-2">
                  <DesignerPopoverOptionList
                    className="gap-0"
                    itemKey={(blockSchema) => blockSchema.type}
                    itemSelected={() => false}
                    itemTitle={(blockSchema) => blockSchemaDisplayLabel(blockSchema)}
                    items={blockSchemas}
                    onItemClick={(blockSchema) => {
                      onAddBlock(blockSchema);
                      setOpen(false);
                    }}
                    variant="flat"
                  />
                </DesignerPopoverBody>
              </DesignerPopoverShell>
            </div>,
            document.body
          )
        : null}

      <button
        ref={triggerRef}
        className="add_47ab flex min-h-9 w-full items-center rounded-[4px] px-2 py-2 text-left text-sm leading-5 text-[#f4a719] transition hover:bg-[#f7f8fb] focus-visible:outline-none"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center text-current">
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <span className="pl-2 font-semibold">{triggerLabel}</span>
      </button>
    </div>
  );
}
