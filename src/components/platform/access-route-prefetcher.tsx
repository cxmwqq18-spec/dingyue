"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type AccessRoutePrefetcherProps = {
  paths: string[];
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function uniquePaths(paths: string[]) {
  return Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean)));
}

export function AccessRoutePrefetcher({ paths }: AccessRoutePrefetcherProps) {
  const router = useRouter();
  const pathKey = uniquePaths(paths).join("|");

  useEffect(() => {
    if (!pathKey || process.env.NEXT_PUBLIC_ACCESS_ROUTE_PREFETCH === "0") return;

    const defaultLimit = process.env.NODE_ENV === "development" ? 0 : 8;
    const parsedLimit = Number(process.env.NEXT_PUBLIC_ACCESS_ROUTE_PREFETCH_LIMIT ?? defaultLimit);
    const limit = Number.isFinite(parsedLimit) ? Math.max(0, parsedLimit) : 8;
    const prefetchPaths = pathKey.split("|").slice(0, limit);
    if (!prefetchPaths.length) return;

    let cancelled = false;
    const browser = window as IdleWindow;
    let stepTimer: number | ReturnType<typeof setTimeout> | undefined;
    let idleTimer: number | ReturnType<typeof setTimeout> | undefined;
    let idleCallback: number | undefined;

    const prefetchNext = (index: number) => {
      if (cancelled || index >= prefetchPaths.length) return;
      router.prefetch(prefetchPaths[index]);
      stepTimer = setTimeout(() => prefetchNext(index + 1), 650);
    };

    const start = () => prefetchNext(0);
    if (browser.requestIdleCallback) {
      idleCallback = browser.requestIdleCallback(start, { timeout: 1800 });
    } else {
      idleTimer = setTimeout(start, 900);
    }

    return () => {
      cancelled = true;
      if (stepTimer) clearTimeout(stepTimer);
      if (idleTimer) clearTimeout(idleTimer);
      if (idleCallback !== undefined && browser.cancelIdleCallback) {
        browser.cancelIdleCallback(idleCallback);
      }
    };
  }, [pathKey, router]);

  return null;
}
