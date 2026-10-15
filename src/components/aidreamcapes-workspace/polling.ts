/** Poll private workspace state without stacking slow requests or polling hidden tabs. */
export function startWorkspacePolling(
  refresh: (signal: AbortSignal) => Promise<void>,
  intervalMs: number,
  immediate = false,
): () => void {
  const controller = new AbortController();
  let inFlight = false;
  const tick = async () => {
    if (controller.signal.aborted || document.hidden || inFlight) return;
    inFlight = true;
    try { await refresh(controller.signal); }
    finally { inFlight = false; }
  };
  const onVisible = () => { if (!document.hidden) void tick(); };
  const timer = setInterval(() => { void tick(); }, intervalMs);
  document.addEventListener("visibilitychange", onVisible);
  if (immediate) void tick();
  return () => {
    controller.abort();
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
