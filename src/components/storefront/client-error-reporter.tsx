"use client";

import { useEffect } from "react";

/**
 * Reports uncaught client exceptions to the service journal so a real device
 * reproduction can be diagnosed from the server (an iPhone's console is not
 * reachable from a desktop session). The report carries only the message,
 * stack, page URL and user agent; no cookies, no identifiers, no database.
 * Chunk-load failures are handled separately by ChunkLoadRecovery and are not
 * reported here to avoid noise during deployments.
 */
const REPORT_PATH = "/api/client-errors";
const CHUNK_PATTERN = /ChunkLoadError|Loading chunk [\w.-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i;
const MAX_PER_SESSION = 20;

function alreadyReported(key: string): boolean {
  try {
    const raw = sessionStorage.getItem("client-error-reports");
    const seen: string[] = raw ? JSON.parse(raw) : [];
    if (seen.includes(key) || seen.length >= MAX_PER_SESSION) return true;
    seen.push(key);
    sessionStorage.setItem("client-error-reports", JSON.stringify(seen));
  } catch {
    // Private mode: still report, just without de-duplication.
  }
  return false;
}

function report(kind: string, message: string, stack: string): void {
  if (!message || CHUNK_PATTERN.test(message)) return;
  if (alreadyReported(`${kind}:${message}`.slice(0, 200))) return;
  try {
    void fetch(REPORT_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, message: message.slice(0, 600), stack: stack.slice(0, 4000), url: location.href, userAgent: navigator.userAgent }),
      keepalive: true
    }).catch(() => {});
  } catch {
    // Reporting must never throw.
  }
}

export function ClientErrorReporter() {
  useEffect(() => {
    function onError(event: ErrorEvent): void {
      if (event.target instanceof HTMLElement) return; // resource error, not a JS exception
      const error = event.error instanceof Error ? event.error : null;
      report("error", event.message || error?.message || "", error?.stack ?? "");
    }
    function onRejection(event: PromiseRejectionEvent): void {
      const reason = event.reason;
      const message = typeof reason === "string" ? reason : reason instanceof Error ? reason.message : String(reason ?? "");
      const stack = reason instanceof Error ? reason.stack ?? "" : "";
      report("rejection", message, stack);
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
