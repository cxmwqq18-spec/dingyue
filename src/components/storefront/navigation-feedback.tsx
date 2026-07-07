"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type StorefrontNavigationSnapshot = {
  href?: string;
  pending: boolean;
};

const idleSnapshot: StorefrontNavigationSnapshot = { pending: false };
let snapshot: StorefrontNavigationSnapshot = idleSnapshot;
let pendingDelayTimeout: number | undefined;
let fallbackTimeout: number | undefined;
let lastPendingHref = "";
let lastPendingAt = 0;
const subscribers = new Set<() => void>();

function navigationPendingDelayMs() {
  const configuredDelay = Number(process.env.NEXT_PUBLIC_STOREFRONT_NAV_PENDING_DELAY_MS ?? 2400);
  if (!Number.isFinite(configuredDelay)) return 2400;
  return Math.min(Math.max(configuredDelay, 650), 5000);
}

function emitSnapshot(next: StorefrontNavigationSnapshot) {
  snapshot = next;
  subscribers.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot(): StorefrontNavigationSnapshot {
  return idleSnapshot;
}

function hrefFromUrl(targetUrl: URL) {
  return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
}

function showPending(href?: string) {
  const now = Date.now();
  const pendingDelayMs = navigationPendingDelayMs();
  if (href && href === lastPendingHref && now - lastPendingAt < pendingDelayMs) return;
  lastPendingHref = href ?? "";
  lastPendingAt = now;
  if (pendingDelayTimeout) window.clearTimeout(pendingDelayTimeout);
  if (fallbackTimeout) window.clearTimeout(fallbackTimeout);
  pendingDelayTimeout = window.setTimeout(() => {
    pendingDelayTimeout = undefined;
    emitSnapshot({ href, pending: true });
    fallbackTimeout = window.setTimeout(() => emitSnapshot({ pending: false }), 8000);
  }, pendingDelayMs);
}

function clearPending() {
  if (pendingDelayTimeout) window.clearTimeout(pendingDelayTimeout);
  if (fallbackTimeout) window.clearTimeout(fallbackTimeout);
  pendingDelayTimeout = undefined;
  fallbackTimeout = undefined;
  lastPendingHref = "";
  lastPendingAt = 0;
  if (!snapshot.pending) return;
  emitSnapshot(idleSnapshot);
}

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0;
}

function shouldShowStorefrontNavigationFeedback(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || anchor.hasAttribute("download")) return false;
  if (anchor.dataset.storefrontInstantFilter === "true") return false;
  if (anchor.target && anchor.target !== "_self") return false;

  const targetUrl = new URL(href, window.location.href);
  if (targetUrl.origin !== window.location.origin) return false;
  if (!targetUrl.pathname.startsWith("/site/")) return false;
  if (targetUrl.pathname.includes("/admin")) return false;
  if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) return false;
  return hrefFromUrl(targetUrl);
}

function eventHref(event: Event): string | undefined {
  if (!(event instanceof CustomEvent)) return undefined;
  const href = event.detail && typeof event.detail.href === "string" ? event.detail.href : undefined;
  return href;
}

export function useStorefrontNavigationSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function StorefrontNavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pending } = useStorefrontNavigationSnapshot();

  useEffect(() => {
    clearPending();
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || isModifiedClick(event)) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const href = shouldShowStorefrontNavigationFeedback(anchor);
      if (!href) return;

      showPending(href);
    }

    function handleNavigationStart(event: Event) {
      showPending(eventHref(event));
    }

    window.addEventListener("storefront:navigation-start", handleNavigationStart);
    document.addEventListener("pointerdown", handleClick, true);
    document.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("storefront:navigation-start", handleNavigationStart);
      document.removeEventListener("pointerdown", handleClick, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  if (!pending) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[2400]" aria-live="polite" aria-label="Loading page">
      <div className="h-[3px] w-full overflow-hidden bg-transparent">
        <div className="h-full w-1/3 animate-[admin-progress_1.05s_ease-in-out_infinite] bg-[#16dcf0] shadow-[0_0_18px_rgba(22,220,240,0.72)]" />
      </div>
      <div className="mx-auto mt-3 flex max-w-[1680px] justify-center px-4">
        <div className="rounded-full border border-white/12 bg-[#05070e]/90 px-4 py-2 text-xs font-semibold text-white shadow-[0_18px_48px_-28px_rgba(0,0,0,0.82)] backdrop-blur">
          Loading page
        </div>
      </div>
    </div>
  );
}
