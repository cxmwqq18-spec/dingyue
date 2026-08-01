import "server-only";

type LocalWorkerAbortEntry = {
  controller: AbortController;
  jobId: string;
  requestId: string;
  siteId: string;
  startedAt: number;
};

type LocalWorkerAbortState = {
  entries: Map<string, LocalWorkerAbortEntry>;
};

const globalAbortState = globalThis as typeof globalThis & {
  __dreamshootLocalWorkerAbortState?: LocalWorkerAbortState;
};

const abortState = globalAbortState.__dreamshootLocalWorkerAbortState ?? {
  entries: new Map<string, LocalWorkerAbortEntry>()
};
globalAbortState.__dreamshootLocalWorkerAbortState = abortState;

export const localWorkerAbortErrorCode = "local_worker_aborted";

export function localWorkerAbortKey(params: { siteId: string; jobId: string; requestId: string }) {
  return `${params.siteId}:${params.jobId}:${params.requestId}`;
}

function abortReason(reason?: string) {
  return new Error(reason || localWorkerAbortErrorCode);
}

export function registerLocalWorkerProcess(params: { siteId: string; jobId: string; requestId: string }): {
  key: string;
  signal: AbortSignal;
  unregister: () => void;
} {
  const key = localWorkerAbortKey(params);
  const controller = new AbortController();
  abortState.entries.set(key, {
    controller,
    jobId: params.jobId,
    requestId: params.requestId,
    siteId: params.siteId,
    startedAt: Date.now()
  });
  return {
    key,
    signal: controller.signal,
    unregister: () => {
      const current = abortState.entries.get(key);
      if (current?.controller === controller) abortState.entries.delete(key);
    }
  };
}

export function hasLocalWorkerProcess(params: { siteId: string; jobId: string; requestId?: string }): boolean {
  return matchingLocalWorkerEntries(params).length > 0;
}

export function abortLocalWorkerProcesses(params: { siteId: string; jobId: string; requestId?: string; reason?: string }): {
  aborted: boolean;
  count: number;
  requestIds: string[];
} {
  const entries = matchingLocalWorkerEntries(params);
  for (const [key, entry] of entries) {
    if (!entry.controller.signal.aborted) entry.controller.abort(abortReason(params.reason));
    abortState.entries.delete(key);
  }
  return {
    aborted: entries.length > 0,
    count: entries.length,
    requestIds: entries.map(([, entry]) => entry.requestId)
  };
}

export function throwIfLocalWorkerAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw abortReason(signal.reason instanceof Error ? signal.reason.message : localWorkerAbortErrorCode);
}

export function isLocalWorkerAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = error instanceof Error ? error.message : "";
  return message.includes(localWorkerAbortErrorCode);
}

export async function sleepWithLocalWorkerAbort(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfLocalWorkerAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const timeoutRef: { current?: ReturnType<typeof setTimeout> } = {};
    const onAbort = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      reject(abortReason(signal?.reason instanceof Error ? signal.reason.message : localWorkerAbortErrorCode));
    };
    timeoutRef.current = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function matchingLocalWorkerEntries(params: { siteId: string; jobId: string; requestId?: string }): Array<[string, LocalWorkerAbortEntry]> {
  const matches: Array<[string, LocalWorkerAbortEntry]> = [];
  for (const [key, entry] of abortState.entries) {
    if (entry.siteId !== params.siteId || entry.jobId !== params.jobId) continue;
    if (params.requestId && entry.requestId !== params.requestId) continue;
    matches.push([key, entry]);
  }
  return matches;
}
