"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type AdminNavigationSnapshot = {
  href?: string;
  pending: boolean;
};

let snapshot: AdminNavigationSnapshot = { pending: false };
const serverSnapshot: AdminNavigationSnapshot = { pending: false };
let fallbackTimeout: number | undefined;
let pendingDelayTimeout: number | undefined;
const subscribers = new Set<() => void>();

function emitSnapshot(next: AdminNavigationSnapshot) {
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

function getServerSnapshot(): AdminNavigationSnapshot {
  return serverSnapshot;
}

function hrefFromUrl(targetUrl: URL) {
  return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
}

function showPending(href?: string) {
  emitSnapshot({ href, pending: false });
  if (pendingDelayTimeout) window.clearTimeout(pendingDelayTimeout);
  if (fallbackTimeout) window.clearTimeout(fallbackTimeout);
  pendingDelayTimeout = window.setTimeout(() => {
    emitSnapshot({ href, pending: true });
    fallbackTimeout = window.setTimeout(() => emitSnapshot({ pending: false }), 8000);
  }, 180);
}

function clearPending() {
  if (pendingDelayTimeout) window.clearTimeout(pendingDelayTimeout);
  if (fallbackTimeout) window.clearTimeout(fallbackTimeout);
  emitSnapshot({ pending: false });
}

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0;
}

function shouldShowAdminNavigationFeedback(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || anchor.hasAttribute("download")) return false;
  if (anchor.target && anchor.target !== "_self") return false;

  const targetUrl = new URL(href, window.location.href);
  if (targetUrl.origin !== window.location.origin) return false;
  if (!targetUrl.pathname.includes("/admin") && targetUrl.pathname !== "/platform") return false;

  if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) return false;
  return hrefFromUrl(targetUrl);
}

function eventHref(event: Event): string | undefined {
  if (!(event instanceof CustomEvent)) return undefined;
  const href = event.detail && typeof event.detail.href === "string" ? event.detail.href : undefined;
  return href;
}

export function useAdminNavigationSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function AdminNavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pending } = useAdminNavigationSnapshot();

  useEffect(() => {
    clearPending();
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || isModifiedClick(event)) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const href = shouldShowAdminNavigationFeedback(anchor);
      if (!href) return;

      showPending(href);
    }

    function handleNavigationStart(event: Event) {
      showPending(eventHref(event));
    }

    window.addEventListener("admin:navigation-start", handleNavigationStart);
    document.addEventListener("pointerdown", handleClick, true);
    document.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("admin:navigation-start", handleNavigationStart);
      document.removeEventListener("pointerdown", handleClick, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  if (!pending) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[2200]" aria-live="polite" aria-label="正在切换后台模块">
      <div className="h-[2px] w-full overflow-hidden bg-transparent">
        <div className="h-full w-1/3 animate-[admin-progress_1.15s_ease-in-out_infinite] bg-[#2f6fed] shadow-[0_0_14px_rgba(47,111,237,0.62)]" />
      </div>
    </div>
  );
}
