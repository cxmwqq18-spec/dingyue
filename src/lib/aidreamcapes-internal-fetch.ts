/** Retry one reset of a read-only loopback request; never retry writes. */
export async function fetchAidreamcapesInternal(
  input: URL,
  init: RequestInit,
  request: typeof fetch = fetch,
): Promise<Response> {
  try {
    return await request(input, init);
  } catch (error) {
    const method = (init.method || "GET").toUpperCase();
    const code = error && typeof error === "object" && "cause" in error
      ? (error.cause as { code?: unknown } | undefined)?.code
      : undefined;
    if (input.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(input.hostname)
      || !["GET", "HEAD"].includes(method) || init.signal?.aborted
      || !["ECONNRESET", "UND_ERR_SOCKET"].includes(String(code))) throw error;
    return request(input, init);
  }
}
