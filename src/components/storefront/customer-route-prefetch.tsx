"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const prefetchPriority = [
  "/collections",
  "/pricing",
  "/help",
  "/privacy",
  "/refunds",
  "/content",
  "/cookies",
  "/tools",
  "/blog",
  "/about-us",
  "/contact-us",
  "/terms",
  "/shipping"
];

function pathPriority(path: string) {
  const pathname = (() => {
    try {
      return new URL(path, window.location.href).pathname.replace(/^\/site\/[^/]+/, "") || "/";
    } catch {
      return path;
    }
  })();
  const index = prefetchPriority.findIndex((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return index === -1 ? prefetchPriority.length : index;
}

export function CustomerRoutePrefetch({ paths }: { paths: string[] }) {
  const router = useRouter();
  const pathKey = paths.filter(Boolean).join("|");

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STOREFRONT_PREFETCH === "0") return;
    const maxPrefetch = Number(process.env.NEXT_PUBLIC_STOREFRONT_PREFETCH_LIMIT ?? 16);
    const uniquePaths = Array.from(new Set(pathKey.split("|").filter(Boolean)))
      .sort((left, right) => pathPriority(left) - pathPriority(right))
      .slice(0, Number.isFinite(maxPrefetch) ? Math.max(maxPrefetch, 0) : 4);
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
          staggerTimer = window.setTimeout(() => prefetchNext(index + 1), 260);
        };
        if (process.env.NEXT_PUBLIC_STOREFRONT_WARM_FETCH !== "0") {
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
      ? window.requestIdleCallback(prefetch, { timeout: 900 })
      : window.setTimeout(prefetch, 350);

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
