"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
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

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.open = false;
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <details className="group relative" data-native-mega-menu="true" ref={menuRef} {...blockAttrs}>
      <summary className={`${buttonClassName} list-none [&::-webkit-details-marker]:hidden`}>
        <span>{label}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" strokeWidth={2} />
      </summary>
      <div className={panelClassName}>{children}</div>
    </details>
  );
}
