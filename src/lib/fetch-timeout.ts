import "server-only";

export class FetchTimeoutError extends Error {
  timeoutMs: number;
  url: string;

  constructor(url: string, timeoutMs: number) {
    super(`fetch_timeout:${timeoutMs}`);
    this.name = "FetchTimeoutError";
    this.timeoutMs = timeoutMs;
    this.url = url;
  }
}

function timeoutSignal(url: string, timeoutMs: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(timeoutMs);
  const controller = new AbortController();
  setTimeout(() => controller.abort(new FetchTimeoutError(url, timeoutMs)), timeoutMs).unref?.();
  return controller.signal;
}

export async function fetchWithTimeout(input: string | URL, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const url = String(input);
  const timeoutMs = Math.max(250, init.timeoutMs ?? 5000);
  const signal = init.signal ?? timeoutSignal(url, timeoutMs);
  try {
    return await fetch(input, { ...init, signal });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new FetchTimeoutError(url, timeoutMs);
    }
    throw error;
  }
}
