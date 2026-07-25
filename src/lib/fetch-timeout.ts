import "server-only";
import { ProxyAgent } from "undici";

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

let cachedProxyAgent: { proxyUrl: string; agent: ProxyAgent } | undefined;

function configuredProxyUrl() {
  return (
    process.env.AI_WORKER_HTTPS_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    ""
  );
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function proxyAgentForUrl(proxyUrl: string) {
  if (!cachedProxyAgent || cachedProxyAgent.proxyUrl !== proxyUrl) {
    cachedProxyAgent = { proxyUrl, agent: new ProxyAgent(proxyUrl) };
  }
  return cachedProxyAgent.agent;
}

function withProxyDispatcher(input: string | URL, init: RequestInit): RequestInit {
  const proxyUrl = configuredProxyUrl();
  if (!proxyUrl) return init;
  try {
    const target = new URL(String(input));
    if (!["http:", "https:"].includes(target.protocol) || isLoopbackHost(target.hostname)) return init;
    return { ...init, dispatcher: proxyAgentForUrl(proxyUrl) } as RequestInit;
  } catch {
    return init;
  }
}

export async function fetchWithTimeout(input: string | URL, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const url = String(input);
  const timeoutMs = Math.max(250, init.timeoutMs ?? 5000);
  const signal = init.signal ?? timeoutSignal(url, timeoutMs);
  try {
    return await fetch(input, withProxyDispatcher(input, { ...init, signal }));
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new FetchTimeoutError(url, timeoutMs);
    }
    throw error;
  }
}
