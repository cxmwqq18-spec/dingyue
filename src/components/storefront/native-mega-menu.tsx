"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function NativeMegaMenu({
  blockAttrs,
  buttonClassName,
  children,
  label,
  panelClassName
}: {
  blockAttrs?: Record<string, string | number | boolean | undefined>;
  buttonClassName: string;
  children: ReactNode;
  disablePrefetch?: boolean;
  label: string;
  panelClassName: string;
  prefetchPaths?: string[];
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const menu = menuRef.current;
      if (!menu || menu.contains(event.target as Node)) return;
      menu.open = false;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const menu = menuRef.current;
      if (!menu) return;
      menu.open = false;
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <details
      className="group relative"
      data-native-mega-menu="true"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      ref={menuRef}
      {...blockAttrs}
    >
      <summary className={`${buttonClassName} list-none [&::-webkit-details-marker]:hidden`}>
        <span>{label}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" strokeWidth={2} />
      </summary>
      <div className={panelClassName}>{children}</div>
    </details>
  );
}
