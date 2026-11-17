export const PROVIDER_JSON_BODY_MAX_BYTES = 2 * 1024 * 1024;
export const PROVIDER_REFERENCE_BODY_MAX_BYTES = 25 * 1024 * 1024;
export const PROVIDER_RESULT_BODY_MAX_BYTES = 200 * 1024 * 1024;

export type ReadBodyDeadlineParams = {
  maxBytes: number;
  timeoutMs: number;
  timeoutError: string;
  signal?: AbortSignal;
};

/**
 * Reads a provider response body with a hard byte cap and an overall deadline.
 *
 * fetchWithTimeout only races the response headers: once headers arrive its
 * timeout is cleared, so a relay that sends headers and then hangs the body —
 * or returns an oversized/decompress-bomb payload — would leave the awaited
 * body read pending forever or freeze the event loop on a synchronous parse
 * (2026-11-16 incident: video create wedged the whole storefront process with
 * a zero-byte diagnostic report). Both cases now abort into a thrown timeout
 * error, which fails the job and releases reserved credits instead of
 * wedging the shared worker/storefront process.
 */
export async function readBodyWithDeadline(response: Response, params: ReadBodyDeadlineParams): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error(`${params.timeoutError}_no_body`);
  const controller = new AbortController();
  const externalSignal = params.signal;
  const abortFromExternalSignal = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => {
      reject(controller.signal.reason instanceof Error ? controller.signal.reason : new Error(params.timeoutError));
    }, { once: true });
  });
  const chunks: Buffer[] = [];
  let received = 0;
  const deadline = setTimeout(() => controller.abort(new Error(params.timeoutError)), params.timeoutMs);
  try {
    while (true) {
      const read = reader.read();
      void read.catch(() => undefined); // the race may already have been aborted when the stream later errors
      const step = await Promise.race([read, aborted]);
      if (step.done) break;
      if (step.value) {
        received += step.value.byteLength;
        if (received > params.maxBytes) {
          throw new Error(`${params.timeoutError}_body_too_large_${received}_gt_${params.maxBytes}`);
        }
        chunks.push(Buffer.from(step.value));
      }
    }
    return Buffer.concat(chunks, received);
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error instanceof Error ? error : new Error(params.timeoutError);
  } finally {
    clearTimeout(deadline);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}

/** Same deadline semantics as readBodyWithDeadline, but parses JSON; malformed
 * bodies degrade to an empty object, matching the previous response.json().catch({}) behaviour. */
export async function readJsonWithDeadline<T>(response: Response, params: ReadBodyDeadlineParams): Promise<T> {
  const raw = await readBodyWithDeadline(response, params);
  try {
    return JSON.parse(raw.toString("utf8")) as T;
  } catch {
    return {} as T;
  }
}
