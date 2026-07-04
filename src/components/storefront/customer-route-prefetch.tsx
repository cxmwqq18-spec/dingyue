"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const prefetchPriority = [
  "/collections",
  "/tools",
  "/pricing",
  "/help",
  "/blog"
];

function normalizedPublicPath(path: string) {
  try {
    return new URL(path, window.location.href).pathname.replace(/^\/site\/[^/]+/, "") || "/";
  } catch {
    return path;
  }
}

function canIdlePrefetch(path: string) {
  const pathname = normalizedPublicPath(path);
  if (pathname === "/account" || pathname.startsWith("/account/")) return false;
  if (pathname === "/app" || pathname.startsWith("/app/")) return false;
  if (pathname === "/album" || pathname.startsWith("/album/")) return false;
  if (pathname === "/checkout" || pathname.startsWith("/checkout/")) return false;
  if (pathname === "/cart" || pathname.startsWith("/cart/")) return false;
  if (pathname === window.location.pathname.replace(/^\/site\/[^/]+/, "")) return false;
  return prefetchPriority.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function pathPriority(path: string) {
  const pathname = normalizedPublicPath(path);
  const index = prefetchPriority.findIndex((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return index === -1 ? prefetchPriority.length : index;
}

export function CustomerRoutePrefetch({ paths }: { paths: string[] }) {
  const router = useRouter();
  const pathKey = paths.filter(Boolean).join("|");

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STOREFRONT_PREFETCH === "0") return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData) return;
    if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType)) return;
    const maxPrefetch = Number(process.env.NEXT_PUBLIC_STOREFRONT_PREFETCH_LIMIT ?? 1);
    const uniquePaths = Array.from(new Set(pathKey.split("|").filter(Boolean)))
      .filter(canIdlePrefetch)
      .sort((left, right) => pathPriority(left) - pathPriority(right))
      .slice(0, Number.isFinite(maxPrefetch) ? Math.max(maxPrefetch, 0) : 1);
    if (!uniquePaths.length) return;
    let cancelled = false;
    let staggerTimer: number | undefined;

    const prefetch = () => {
      const prefetchNext = (index: number) => {
        if (cancelled || index >= uniquePaths.length) return;
        const path = uniquePaths[index];
        router.prefetch(path);
        const scheduleNext = () => {
          if (cancelled) return;
          staggerTimer = window.setTimeout(() => prefetchNext(index + 1), 650);
        };
        if (process.env.NEXT_PUBLIC_STOREFRONT_WARM_FETCH === "1") {
          const timeout = new Promise((resolve) => window.setTimeout(resolve, 900));
          void Promise.race([
            fetch(path, { cache: "force-cache", credentials: "same-origin" }).catch(() => undefined),
            timeout
          ]).then(scheduleNext);
          return;
        }
        scheduleNext();
      };

      prefetchNext(0);
    };

    const idleId = typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(prefetch, { timeout: 1600 })
      : window.setTimeout(prefetch, 900);

    return () => {
      cancelled = true;
      if (staggerTimer) window.clearTimeout(staggerTimer);
      if (typeof idleId === "number") {
        window.clearTimeout(idleId);
        return;
      }
      window.cancelIdleCallback?.(idleId);
    };
  }, [pathKey, router]);

  return null;
}
