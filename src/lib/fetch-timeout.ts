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

function proxyUrlForInput(input: string | URL): string {
  const proxyUrl = configuredProxyUrl();
  if (!proxyUrl) return "";
  try {
    const target = new URL(String(input));
    if (!["http:", "https:"].includes(target.protocol) || isLoopbackHost(target.hostname)) return "";
    return proxyUrl;
  } catch {
    return "";
  }
}

function proxyLooksLocal(proxyUrl: string): boolean {
  try {
    return isLoopbackHost(new URL(proxyUrl).hostname);
  } catch {
    return false;
  }
}

function shouldRetryWithoutLocalProxy(error: unknown, proxyUrl: string): boolean {
  if (!proxyLooksLocal(proxyUrl) || process.env.AI_WORKER_PROXY_DIRECT_FALLBACK === "0") return false;
  const cause = error instanceof Error && "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
  const code = typeof cause === "object" && cause && "code" in cause ? String((cause as { code?: unknown }).code ?? "") : "";
  const message = [
    error instanceof Error ? error.message : "",
    cause instanceof Error ? cause.message : ""
  ].join(" ");
  return code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    /ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH/.test(message);
}

export async function fetchWithTimeout(input: string | URL, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const url = String(input);
  const timeoutMs = Math.max(250, init.timeoutMs ?? 5000);
  const signal = init.signal ?? timeoutSignal(url, timeoutMs);
  const proxyUrl = proxyUrlForInput(input);
  const requestInit = { ...init, signal };
  try {
    return await fetch(input, proxyUrl ? { ...requestInit, dispatcher: proxyAgentForUrl(proxyUrl) } as RequestInit : requestInit);
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new FetchTimeoutError(url, timeoutMs);
    }
    if (proxyUrl && shouldRetryWithoutLocalProxy(error, proxyUrl)) {
      return fetch(input, requestInit);
    }
    throw error;
  }
}
