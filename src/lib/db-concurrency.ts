import "server-only";

import { createAdminPerfTracker, isAdminPerfEnabled } from "@/lib/admin-perf";

const defaultDbConcurrency = Number(process.env.ADMIN_DB_QUERY_CONCURRENCY ?? 2);

const globalForDbConcurrency = globalThis as unknown as {
  adminDbTaskQueue?: {
    active: number;
    queue: Array<() => void>;
  };
};

const globalQueue = globalForDbConcurrency.adminDbTaskQueue ?? { active: 0, queue: [] };
globalForDbConcurrency.adminDbTaskQueue = globalQueue;

async function withGlobalDbSlot<T>(task: () => Promise<T>, concurrency: number): Promise<T> {
  const limit = Math.max(1, Math.floor(concurrency));
  while (globalQueue.active >= limit) {
    await new Promise<void>((resolve) => globalQueue.queue.push(resolve));
  }
  globalQueue.active += 1;
  try {
    return await task();
  } finally {
    globalQueue.active = Math.max(0, globalQueue.active - 1);
    const next = globalQueue.queue.shift();
    next?.();
  }
}

export async function runDbTasks<T extends readonly unknown[]>(
  tasks: { [K in keyof T]: () => Promise<T[K]> },
  concurrency = defaultDbConcurrency
): Promise<T> {
  const perf = createAdminPerfTracker("runDbTasks", { taskCount: tasks.length, concurrency });
  const limit = Math.max(1, Math.floor(concurrency));
  const results: unknown[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const queuedAt = isAdminPerfEnabled() ? performance.now() : 0;
      results[currentIndex] = await withGlobalDbSlot(async () => {
        if (perf.enabled) perf.mark("queue", performance.now() - queuedAt, { taskIndex: currentIndex });
        return perf.measure("task", tasks[currentIndex], { taskIndex: currentIndex });
      }, concurrency);
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await perf.measure("db", () => Promise.all(workers), { taskCount: tasks.length, concurrency });
  perf.finish();
  return results as unknown as T;
}
