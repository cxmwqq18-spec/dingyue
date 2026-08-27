"use client";

import { type CSSProperties, type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, X } from "lucide-react";

type ClickMegaMenuProps = {
  blockAttrs?: Record<string, string | number | boolean | undefined>;
  buttonClassName: string;
  children: ReactNode;
  disablePrefetch?: boolean;
  label: string;
  panelClassName: string;
  prefetchPaths?: string[];
};

const storefrontMegaPanelMaxHeight = 760;
const storefrontMegaPanelViewportRatio = 0.72;

function menuPrefetchEnabled() {
  return process.env.NEXT_PUBLIC_STOREFRONT_MENU_PREFETCH === "1";
}

function menuWarmFetchEnabled() {
  return process.env.NEXT_PUBLIC_STOREFRONT_MENU_WARM_FETCH === "1";
}

export function ClickMegaMenu({ blockAttrs, buttonClassName, children, disablePrefetch = false, label, panelClassName, prefetchPaths = [] }: ClickMegaMenuProps) {
  const [open, setOpen] = useState(false);
  const [panelMetrics, setPanelMetrics] = useState<{ maxHeight: number; top: number } | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const prefetchedRef = useRef(false);
  const prefetchTimerRefs = useRef<number[]>([]);
  const warmFetchTimerRefs = useRef<number[]>([]);
  const hoveredPrefetchRef = useRef<Set<string>>(new Set());
  const warmFetchedRef = useRef<Set<string>>(new Set());
  const warmFetchControllersRef = useRef<Set<AbortController>>(new Set());
  const panelId = useId();
  const prefetchKey = prefetchPaths.filter(Boolean).join("|");
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const panelStyle = panelMetrics
    ? ({
        "--storefront-mega-panel-max-height": `${panelMetrics.maxHeight}px`,
        maxHeight: `${panelMetrics.maxHeight}px`,
        top: `${panelMetrics.top}px`
      } as CSSProperties)
    : undefined;

  const updatePanelMetrics = useCallback(() => {
    const source = menuRef.current?.closest("header") ?? menuRef.current;
    if (!source) return;
    const rect = source.getBoundingClientRect();
    const top = Math.max(8, Math.ceil(rect.bottom + 12));
    const availableHeight = Math.max(180, Math.floor(window.innerHeight - top - 16));
    const responsiveHeight = Math.max(260, Math.floor(window.innerHeight * storefrontMegaPanelViewportRatio));
    setPanelMetrics({
      maxHeight: Math.min(storefrontMegaPanelMaxHeight, responsiveHeight, availableHeight),
      top
    });
  }, []);

  const cancelWarmFetches = useCallback(() => {
    warmFetchTimerRefs.current.forEach((timer) => window.clearTimeout(timer));
    warmFetchTimerRefs.current = [];
    warmFetchControllersRef.current.forEach((controller) => controller.abort());
    warmFetchControllersRef.current.clear();
  }, []);

  const warmFetchPath = useCallback((path: string, delayMs = 0) => {
    if (!menuWarmFetchEnabled()) return;
    if (!path || warmFetchedRef.current.has(path)) return;
    if (path.includes("/app") || path.includes("/account") || path.includes("/cart") || path.includes("/checkout")) return;
    warmFetchedRef.current.add(path);
    const run = () => {
      const controller = new AbortController();
      warmFetchControllersRef.current.add(controller);
      void fetch(path, { cache: "force-cache", credentials: "same-origin", priority: "low", signal: controller.signal })
        .then((response) => response.arrayBuffer())
        .then(() => undefined)
        .catch(() => undefined)
        .finally(() => {
          warmFetchControllersRef.current.delete(controller);
        });
    };
    if (delayMs > 0) {
      const timer = window.setTimeout(() => {
        warmFetchTimerRefs.current = warmFetchTimerRefs.current.filter((current) => current !== timer);
        run();
      }, delayMs);
      warmFetchTimerRefs.current.push(timer);
      return;
    }
    run();
  }, []);

  const prefetchMenuPaths = useCallback(() => {
    if (disablePrefetch || !menuPrefetchEnabled()) return;
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    const maxPrefetch = Number(process.env.NEXT_PUBLIC_STOREFRONT_MENU_PREFETCH_LIMIT ?? 2);
    const uniquePaths = Array.from(new Set(prefetchKey.split("|").filter(Boolean))).slice(0, Number.isFinite(maxPrefetch) ? Math.max(maxPrefetch, 0) : 2);
    if (!uniquePaths.length) return;
    uniquePaths.slice(0, 2).forEach((path, index) => warmFetchPath(path, 90 + index * 180));
    prefetchTimerRefs.current.forEach((timer) => window.clearTimeout(timer));
    prefetchTimerRefs.current = uniquePaths.map((path, index) =>
      window.setTimeout(() => {
        router.prefetch(path);
      }, 60 + index * 180)
    );
  }, [disablePrefetch, prefetchKey, router, warmFetchPath]);

  const prefetchHoveredAnchor = useCallback((target: EventTarget | null) => {
    if (disablePrefetch || !menuPrefetchEnabled() || process.env.NEXT_PUBLIC_STOREFRONT_MENU_HOVER_PREFETCH !== "1") return;
    const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
    const href = anchor?.getAttribute("href");
    if (!href || href.startsWith("#") || anchor?.target && anchor.target !== "_self") return;
    let path = "";
    try {
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return;
      path = `${url.pathname}${url.search}`;
    } catch {
      return;
    }
    if (!path || hoveredPrefetchRef.current.has(path)) return;
    hoveredPrefetchRef.current.add(path);
    router.prefetch(path);
    warmFetchPath(path, 240);
  }, [disablePrefetch, router, warmFetchPath]);

  useEffect(() => {
    if (!open) return;
    updatePanelMetrics();
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePanelMetrics);
    window.addEventListener("scroll", updatePanelMetrics, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePanelMetrics);
      window.removeEventListener("scroll", updatePanelMetrics, true);
    };
  }, [open, updatePanelMetrics]);

  useEffect(() => {
    if (!open || disablePrefetch || !menuPrefetchEnabled()) return;
    prefetchMenuPaths();
    return () => {
      prefetchTimerRefs.current.forEach((timer) => window.clearTimeout(timer));
      prefetchTimerRefs.current = [];
      cancelWarmFetches();
    };
  }, [cancelWarmFetches, disablePrefetch, open, prefetchMenuPaths]);

  useEffect(() => {
    setOpen(false);
    cancelWarmFetches();
  }, [cancelWarmFetches, routeKey]);

  return (
    <details
      className="group relative"
      data-native-mega-menu="true"
      open={open}
      onClick={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        const anchor = target?.closest<HTMLAnchorElement>("a[href]");
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (!href || href.startsWith("#") || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
        let navigationHref = "";
        try {
          const url = new URL(href, window.location.href);
          if (url.origin !== window.location.origin) return;
          navigationHref = `${url.pathname}${url.search}${url.hash}`;
        } catch {
          return;
        }
        window.dispatchEvent(new CustomEvent("storefront:navigation-start", { detail: { href: navigationHref } }));
        window.requestAnimationFrame(() => {
          setOpen(false);
          cancelWarmFetches();
        });
      }}
      onPointerOverCapture={(event) => {
        if (event.pointerType !== "touch") prefetchHoveredAnchor(event.target);
      }}
      ref={menuRef}
    >
      <summary
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`${buttonClassName} list-none [&::-webkit-details-marker]:hidden`}
        onClick={(event) => {
          event.preventDefault();
          prefetchMenuPaths();
          if (!open) updatePanelMetrics();
          setOpen((current) => !current);
        }}
        onFocus={() => {
          updatePanelMetrics();
          prefetchMenuPaths();
        }}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") {
            updatePanelMetrics();
            prefetchMenuPaths();
          }
        }}
        {...blockAttrs}
      >
        <span>{label}</span>
        <ChevronRight className={`h-3.5 w-3.5 text-white/72 transition ${open ? "-rotate-90" : "rotate-90"}`} data-mega-toggle="" strokeWidth={2} />
      </summary>
      <div
        aria-hidden={!open}
        className={`${open ? "visible pointer-events-auto translate-y-0 opacity-100" : "invisible pointer-events-none translate-y-2 opacity-0"} ${panelClassName}`}
        data-storefront-mega-menu-panel=""
        id={panelId}
        inert={!open ? true : undefined}
        role="dialog"
        style={panelStyle}
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
    </details>
  );
}
