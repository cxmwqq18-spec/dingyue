const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const buckets = new Map<string, number[]>();

/** Small in-process limiter; the contact route runs on the Node server. */
export function allowContactRequest(key: string): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) {
    for (const [entry, times] of buckets) {
      if (!times.some((time) => now - time < WINDOW_MS)) buckets.delete(entry);
    }
  }
  return true;
}
