"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { canBulkPrefetchAdminRoute, type AdminRoutePrefetchMatcher } from "@/components/admin/admin-route-prefetch-policy";

type AdminRoutePrefetcherProps = {
  allow?: AdminRoutePrefetchMatcher[];
  deny?: AdminRoutePrefetchMatcher[];
  hrefs: string[];
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const prefetchedHrefs = new Set<string>();

function uniqueHrefs(hrefs: string[], policy: Pick<AdminRoutePrefetcherProps, "allow" | "deny">) {
  return [
    ...new Set(
      hrefs.filter((href) => canBulkPrefetchAdminRoute(href, policy) && !prefetchedHrefs.has(href))
    )
  ];
}

export function AdminRoutePrefetcher({ allow, deny, hrefs }: AdminRoutePrefetcherProps) {
  const router = useRouter();
  const normalized = uniqueHrefs(hrefs, { allow, deny }).join("\n");

  useEffect(() => {
    const targets = normalized.split("\n").filter(Boolean);
    if (!targets.length) return;

    let cancelled = false;
    let index = 0;
    const idleWindow = window as IdleWindow;
    const timeoutHandles: number[] = [];
    const idleHandles: number[] = [];

    function scheduleNext() {
      if (cancelled || index >= targets.length) return;
      const prefetchNext = () => {
        if (cancelled) return;
        const href = targets[index];
        index += 1;
        if (prefetchedHrefs.has(href)) {
          scheduleNext();
          return;
        }
        prefetchedHrefs.add(href);
        router.prefetch(href);
        const handle = window.setTimeout(scheduleNext, 360);
        timeoutHandles.push(handle);
      };

      if (idleWindow.requestIdleCallback) {
        const handle = idleWindow.requestIdleCallback(prefetchNext, { timeout: 2400 });
        idleHandles.push(handle);
        return;
      }

      const handle = window.setTimeout(prefetchNext, 900);
      timeoutHandles.push(handle);
    }

    scheduleNext();

    return () => {
      cancelled = true;
      timeoutHandles.forEach((handle) => window.clearTimeout(handle));
      if (idleWindow.cancelIdleCallback) idleHandles.forEach((handle) => idleWindow.cancelIdleCallback?.(handle));
    };
  }, [normalized, router]);

  return null;
}
