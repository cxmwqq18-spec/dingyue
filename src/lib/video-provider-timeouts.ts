const DEFAULT_VIDEO_PROVIDER_CREATE_TIMEOUT_MS = 180_000;
const DEFAULT_VIDEO_PROVIDER_WORKER_TIMEOUT_MS = 900_000;

function configuredTimeoutMs(value: string | undefined, fallback: number, minimum: number) {
  const configured = Number(value ?? "");
  if (!Number.isFinite(configured) || configured <= 0) return fallback;
  return Math.max(minimum, Math.trunc(configured));
}

export function videoProviderCreateTimeoutMs() {
  return configuredTimeoutMs(
    process.env.LOCAL_AI_WORKER_VIDEO_CREATE_TIMEOUT_MS,
    DEFAULT_VIDEO_PROVIDER_CREATE_TIMEOUT_MS,
    60_000
  );
}

export function videoProviderWorkerTimeoutMs() {
  return configuredTimeoutMs(
    process.env.LOCAL_AI_WORKER_VIDEO_TIMEOUT_MS,
    DEFAULT_VIDEO_PROVIDER_WORKER_TIMEOUT_MS,
    60_000
  );
}

export const VIDEO_PROVIDER_CREATE_TIMEOUT_DEFAULT_MS = DEFAULT_VIDEO_PROVIDER_CREATE_TIMEOUT_MS;
