import "server-only";

type TimingEntry = {
  name: string;
  durationMs: number;
  detail?: Record<string, string | number | boolean | undefined>;
};

export type AdminPerfTracker = {
  readonly enabled: boolean;
  mark(name: string, durationMs: number, detail?: TimingEntry["detail"]): void;
  measure<T>(name: string, work: () => Promise<T>, detail?: TimingEntry["detail"]): Promise<T>;
  measureSync<T>(name: string, work: () => T, detail?: TimingEntry["detail"]): T;
  info(message: string, detail?: Record<string, string | number | boolean | undefined>): void;
  finish(detail?: Record<string, string | number | boolean | undefined>): TimingEntry[];
  serverTimingHeader(): string;
};

export function isAdminPerfEnabled(): boolean {
  return process.env.ADMIN_PERF_LOG === "1";
}

function nowMs(): number {
  return performance.now();
}

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}

function cleanDetail(detail: Record<string, string | number | boolean | undefined> | undefined) {
  if (!detail) return undefined;
  return Object.fromEntries(Object.entries(detail).filter(([, value]) => value !== undefined));
}

function tokenName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48) || "total";
}

export function createAdminPerfTracker(
  scope: string,
  detail: Record<string, string | number | boolean | undefined> = {}
): AdminPerfTracker {
  const enabled = isAdminPerfEnabled();
  const startedAt = nowMs();
  const timings: TimingEntry[] = [];
  const baseDetail = cleanDetail(detail);

  const tracker: AdminPerfTracker = {
    enabled,
    mark(name, durationMs, entryDetail) {
      if (!enabled) return;
      timings.push({ name, durationMs: roundMs(durationMs), detail: cleanDetail(entryDetail) });
    },
    async measure(name, work, entryDetail) {
      if (!enabled) return work();
      const start = nowMs();
      try {
        return await work();
      } finally {
        tracker.mark(name, nowMs() - start, entryDetail);
      }
    },
    measureSync(name, work, entryDetail) {
      if (!enabled) return work();
      const start = nowMs();
      try {
        return work();
      } finally {
        tracker.mark(name, nowMs() - start, entryDetail);
      }
    },
    info(message, entryDetail) {
      if (!enabled) return;
      console.info("[admin-perf]", { scope, message, ...baseDetail, ...cleanDetail(entryDetail) });
    },
    finish(entryDetail) {
      if (!enabled) return [];
      tracker.mark("total", nowMs() - startedAt, entryDetail);
      console.info("[admin-perf]", {
        scope,
        ...baseDetail,
        ...cleanDetail(entryDetail),
        timings
      });
      return timings;
    },
    serverTimingHeader() {
      if (!enabled) return "";
      return timings
        .map((entry) => `${tokenName(entry.name)};dur=${entry.durationMs}`)
        .join(", ");
    }
  };

  return tracker;
}

export function adminPerfJson(
  tracker: AdminPerfTracker,
  payload: unknown,
  init: ResponseInit = {},
  finishDetail?: Record<string, string | number | boolean | undefined>
): Response {
  let body = "";
  tracker.measureSync("json", () => {
    body = JSON.stringify(payload);
  });
  tracker.finish(finishDetail);
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const serverTiming = tracker.serverTimingHeader();
  if (serverTiming) headers.set("Server-Timing", serverTiming);
  return new Response(body, { ...init, headers });
}
