import "server-only";

const defaultDbConcurrency = Number(process.env.ADMIN_DB_QUERY_CONCURRENCY ?? 4);

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
  const limit = Math.max(1, Math.floor(concurrency));
  const results: unknown[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await withGlobalDbSlot(tasks[currentIndex], concurrency);
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results as unknown as T;
}
