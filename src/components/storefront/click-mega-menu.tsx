"use client";

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, X } from "lucide-react";

type ClickMegaMenuProps = {
  blockAttrs?: Record<string, string | number | boolean | undefined>;
  buttonClassName: string;
  children: ReactNode;
  label: string;
  panelClassName: string;
  prefetchPaths?: string[];
};

export function ClickMegaMenu({ blockAttrs, buttonClassName, children, label, panelClassName, prefetchPaths = [] }: ClickMegaMenuProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const prefetchedRef = useRef(false);
  const prefetchTimerRef = useRef<number | undefined>(undefined);
  const panelId = useId();
  const prefetchKey = prefetchPaths.filter(Boolean).join("|");

  const prefetchMenuPaths = useCallback(() => {
    if (process.env.NEXT_PUBLIC_STOREFRONT_MENU_PREFETCH !== "1") return;
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    const maxPrefetch = Number(process.env.NEXT_PUBLIC_STOREFRONT_MENU_PREFETCH_LIMIT ?? 1);
    const uniquePaths = Array.from(new Set(prefetchKey.split("|").filter(Boolean))).slice(0, Number.isFinite(maxPrefetch) ? Math.max(maxPrefetch, 0) : 6);
    if (!uniquePaths.length) return;
    prefetchTimerRef.current = window.setTimeout(() => {
      for (const path of uniquePaths) router.prefetch(path);
    }, 250);
  }, [prefetchKey, router]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || process.env.NEXT_PUBLIC_STOREFRONT_MENU_PREFETCH !== "1") return;
    prefetchMenuPaths();
    return () => {
      if (prefetchTimerRef.current) window.clearTimeout(prefetchTimerRef.current);
    };
  }, [open, prefetchMenuPaths]);

  return (
    <div
      className="relative"
      onClickCapture={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        const anchor = target?.closest<HTMLAnchorElement>("a[href]");
        if (!anchor) return;
        setOpen(false);
        const href = anchor.getAttribute("href");
        if (href && !href.startsWith("#") && !anchor.hasAttribute("download") && (!anchor.target || anchor.target === "_self")) {
          window.dispatchEvent(new CustomEvent("storefront:navigation-start", { detail: { href } }));
        }
      }}
      ref={menuRef}
    >
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={buttonClassName}
        onClick={() => {
          prefetchMenuPaths();
          setOpen((current) => !current);
        }}
        type="button"
        {...blockAttrs}
      >
        {label}
        <ChevronRight className={`h-3.5 w-3.5 text-white/72 transition ${open ? "-rotate-90" : "rotate-90"}`} data-mega-toggle="" strokeWidth={2} />
      </button>
      <div
        aria-hidden={!open}
        className={`${open ? "visible pointer-events-auto translate-y-0 opacity-100" : "invisible pointer-events-none translate-y-2 opacity-0"} ${panelClassName}`}
        data-storefront-mega-menu-panel=""
        id={panelId}
        inert={!open ? true : undefined}
        role="dialog"
      >
        <button
          aria-label={`Close ${label} menu`}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-black/35 text-white shadow-[0_14px_34px_-24px_rgba(0,0,0,0.8)] backdrop-blur transition hover:bg-black/55"
          onClick={() => setOpen(false)}
          type="button"
        >
          <X className="h-4 w-4" strokeWidth={1.9} />
        </button>
        {children}
      </div>
    </div>
  );
}
