"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const prefetchPriority = [
  "/",
  "/login",
  "/pricing",
  "/ai-image-generation",
  "/ai-video-generation",
  "/tools",
  "/collections",
  "/faq",
  "/blog"
];

const warmFetchPathPrefixes = [
  "/",
  "/login",
  "/ai-image-generation",
  "/ai-video-generation",
  "/collections",
  "/tools",
  "/pricing",
  "/faq"
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
  if (
    process.env.NEXT_PUBLIC_STOREFRONT_PREFETCH_DEEP !== "1" &&
    pathname !== "/" &&
    pathname.split("/").filter(Boolean).length > 1
  ) {
    return false;
  }
  if (pathname === "/") return true;
  return prefetchPriority.some((prefix) => pathname === prefix);
}

function pathPriority(path: string) {
  const pathname = normalizedPublicPath(path);
  const index = prefetchPriority.findIndex((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return index === -1 ? prefetchPriority.length : index;
}

function shouldWarmFetch(path: string) {
  const pathname = normalizedPublicPath(path);
  if (process.env.NEXT_PUBLIC_STOREFRONT_WARM_FETCH !== "1") return false;
  return warmFetchPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function warmDelayForPath(path: string, index: number) {
  const pathname = normalizedPublicPath(path);
  if (pathname === "/") return 40;
  if (pathname === "/ai-video-generation" || pathname.startsWith("/ai-video-generation/")) return 80;
  if (pathname === "/ai-image-generation" || pathname.startsWith("/ai-image-generation/")) return 180;
  if (pathname === "/tools" || pathname.startsWith("/tools/")) return 80;
  if (pathname === "/collections" || pathname.startsWith("/collections/")) return 180;
  if (pathname === "/login") return 260;
  if (pathname === "/pricing") return 520;
  if (pathname === "/faq" || pathname.startsWith("/faq/") || pathname === "/help" || pathname.startsWith("/help/")) return 900;
  return 1200 + index * 300;
}

export function CustomerRoutePrefetch({ paths }: { paths: string[] }) {
  const router = useRouter();
  const pathKey = paths.filter(Boolean).join("|");

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STOREFRONT_PREFETCH !== "1") return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData) return;
    if (connection?.effectiveType && /(^|-)(2g|3g)$/.test(connection.effectiveType)) return;
    const maxPrefetch = Number(process.env.NEXT_PUBLIC_STOREFRONT_PREFETCH_LIMIT ?? 1);
    const uniquePaths = Array.from(new Set(pathKey.split("|").filter(Boolean)))
      .filter(canIdlePrefetch)
      .sort((left, right) => pathPriority(left) - pathPriority(right))
      .slice(0, Number.isFinite(maxPrefetch) ? Math.max(maxPrefetch, 0) : 1);
    if (!uniquePaths.length) return;
    let cancelled = false;
    let activeWarmFetch: AbortController | undefined;
    const warmTimers: number[] = [];

    const cancelPendingPrefetch = () => {
      cancelled = true;
      activeWarmFetch?.abort();
      activeWarmFetch = undefined;
      warmTimers.forEach((timer) => window.clearTimeout(timer));
      warmTimers.length = 0;
    };

    const prefetch = () => {
      if (cancelled) return;
      uniquePaths.forEach((path, index) => {
        const warmTimer = window.setTimeout(() => {
          if (cancelled) return;
          if (shouldWarmFetch(path)) {
            activeWarmFetch?.abort();
            const controller = new AbortController();
            activeWarmFetch = controller;
            void fetch(path, { cache: "force-cache", credentials: "same-origin", signal: controller.signal })
              .then((response) => response.arrayBuffer())
              .then(() => undefined)
              .catch(() => undefined)
              .finally(() => {
                if (activeWarmFetch === controller) activeWarmFetch = undefined;
              });
            return;
          }
          router.prefetch(path);
        }, warmDelayForPath(path, index));
        warmTimers.push(warmTimer);
      });
    };

    const idleId = typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(prefetch, { timeout: 4000 })
      : window.setTimeout(prefetch, 1600);
    window.addEventListener("storefront:navigation-start", cancelPendingPrefetch);

    return () => {
      window.removeEventListener("storefront:navigation-start", cancelPendingPrefetch);
      cancelPendingPrefetch();
      window.clearTimeout(idleId);
      window.cancelIdleCallback?.(idleId);
    };
  }, [pathKey, router]);

  return null;
}
