"use client";

import { useEffect } from "react";

/**
 * Deployment-window recovery for stale client bundles.
 *
 * Every release publishes JS chunks under content-hashed names. A tab that
 * loaded the page before a deploy still references the previous names, so the
 * first lazy load after the deploy (scrolling to a section, opening a dialog,
 * mounting an on-view video) requests a chunk that no longer exists. Next.js
 * surfaces that as an uncaught client exception and the app error page.
 *
 * When a chunk fails to load, reload once so the tab picks up the current
 * bundle. A sessionStorage timestamp stops a second automatic reload in the
 * same minute, which also keeps a genuinely broken release from reload-looping
 * a visitor.
 */
const RELOAD_MARKER = "storefront-chunk-reload-at";
const RELOAD_COOLDOWN_MS = 60_000;
const CHUNK_ERROR_PATTERN = /ChunkLoadError|Loading chunk [\w.-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

function isChunkLoadFailure(message: string): boolean {
  return CHUNK_ERROR_PATTERN.test(message);
}

function recoverOnce(): void {
  try {
    const previous = Number(sessionStorage.getItem(RELOAD_MARKER) ?? "0");
    if (Number.isFinite(previous) && Date.now() - previous < RELOAD_COOLDOWN_MS) return;
    sessionStorage.setItem(RELOAD_MARKER, String(Date.now()));
  } catch {
    // Private mode can block sessionStorage; a single reload is still safe.
  }
  window.location.reload();
}

export function ChunkLoadRecovery() {
  useEffect(() => {
    function onError(event: ErrorEvent): void {
      // Resource errors (a <script> or <link> that 404s) have no message; the
      // failed element is the target, so match Next's static chunk path there.
      const target = event.target as (HTMLElement & { src?: string }) | null;
      const source = typeof target?.src === "string" ? target.src : "";
      if (source.includes("/_next/static/")) {
        recoverOnce();
        return;
      }
      const message = [event.message, event.error instanceof Error ? event.error.message : ""].filter(Boolean).join(" ");
      if (isChunkLoadFailure(message)) recoverOnce();
    }
    function onRejection(event: PromiseRejectionEvent): void {
      const reason = event.reason;
      const message = typeof reason === "string" ? reason : reason instanceof Error ? reason.message : String(reason ?? "");
      if (isChunkLoadFailure(message)) recoverOnce();
    }
    // Capture phase: chunk <script> load failures do not bubble to window.
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
