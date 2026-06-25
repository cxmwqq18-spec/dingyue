"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function CustomerRoutePrefetch({ paths }: { paths: string[] }) {
  const router = useRouter();

  useEffect(() => {
    const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
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
      : window.setTimeout(prefetch, 600);

    return () => {
      cancelled = true;
      if (staggerTimer) window.clearTimeout(staggerTimer);
      if (typeof idleId === "number") {
        window.clearTimeout(idleId);
        return;
      }
      window.cancelIdleCallback?.(idleId);
    };
  }, [paths, router]);

  return null;
}
