"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function CustomerRoutePrefetch({ paths }: { paths: string[] }) {
  const router = useRouter();
  const pathKey = paths.filter(Boolean).join("|");

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STOREFRONT_PREFETCH !== "1") return;
    const maxPrefetch = Number(process.env.NEXT_PUBLIC_STOREFRONT_PREFETCH_LIMIT ?? 1);
    const uniquePaths = Array.from(new Set(pathKey.split("|").filter(Boolean))).slice(0, Number.isFinite(maxPrefetch) ? Math.max(maxPrefetch, 0) : 4);
    if (!uniquePaths.length) return;
    let cancelled = false;
    let staggerTimer: number | undefined;

    const prefetch = () => {
      const prefetchNext = (index: number) => {
        if (cancelled || index >= uniquePaths.length) return;
        router.prefetch(uniquePaths[index]);
        staggerTimer = window.setTimeout(() => prefetchNext(index + 1), 450);
      };

      prefetchNext(0);
    };

    const idleId = typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(prefetch, { timeout: 1800 })
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
