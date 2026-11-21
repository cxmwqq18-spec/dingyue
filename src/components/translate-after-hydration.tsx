"use client";

import { useEffect } from "react";

/**
 * The SSR document ships `translate="no"` so Chrome's auto-translate cannot
 * rewrite text nodes before React hydrates — that pre-hydration mutation threw
 * React #418 and blanked the main content (2026-11-21, 17 journal-reported
 * occurrences). The site owner requires browser translation to stay available,
 * so this gate flips the document back to translatable once hydration has
 * settled: Chrome then offers/auto-runs translation on a DOM React already
 * owns, where post-hydration mutation never re-triggers hydration.
 */
export function TranslateAfterHydration() {
  useEffect(() => {
    let cancelled = false;
    const flip = () => {
      if (cancelled) return;
      document.documentElement.setAttribute("translate", "yes");
      document.body.setAttribute("translate", "yes");
    };
    const onLoaded = () => {
      window.setTimeout(flip, 400);
    };
    if (document.readyState === "complete") {
      onLoaded();
    } else {
      window.addEventListener("load", onLoaded, { once: true });
    }
    // Safety net: even if the load event is delayed by a hanging asset, the
    // page must become translatable within seconds.
    const safety = window.setTimeout(flip, 8000);
    return () => {
      cancelled = true;
      window.removeEventListener("load", onLoaded);
      window.clearTimeout(safety);
    };
  }, []);
  return null;
}
