export type AiProviderFallbackCandidate = {
  id?: string;
  label?: string;
  priority?: number | null;
  preferred?: boolean | null;
};

type ProviderSelection = {
  mode?: unknown;
  providerId?: unknown;
  fallbackEnabled?: unknown;
};

type FallbackEnv = Record<string, string | undefined>;

function fallbackErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error || "local_worker_generation_failed");
  const cause = error.cause instanceof Error ? ` cause:${error.cause.message}` : "";
  return `${error.message}${cause}`;
}

function selectionText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function selectionRecord(value: unknown): ProviderSelection {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ProviderSelection : {};
}

function providerPriority(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : Number.MAX_SAFE_INTEGER;
}

function providerLabel(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function orderAiProviderFallbackCandidates<T extends AiProviderFallbackCandidate>(providers: T[]): T[] {
  return [...providers].sort((left, right) =>
    providerPriority(left.priority) - providerPriority(right.priority) ||
    Number(Boolean(right.preferred)) - Number(Boolean(left.preferred)) ||
    providerLabel(left.label).localeCompare(providerLabel(right.label)) ||
    providerLabel(left.id).localeCompare(providerLabel(right.id))
  );
}

export function orderSelectableAiProviderFallbackCandidates<T extends AiProviderFallbackCandidate>(
  providers: T[],
  providerSelection: unknown
): T[] {
  const ordered = orderAiProviderFallbackCandidates(providers);
  const selection = selectionRecord(providerSelection);
  const selectedProviderId = selectionText(selection.providerId);
  const selectedProvider = selectedProviderId
    ? ordered.find((provider) => provider.id === selectedProviderId)
    : undefined;

  if (selection.mode === "fixed_provider") return selectedProvider ? [selectedProvider] : [];
  if (selection.mode === "preferred_provider" && selection.fallbackEnabled === false && selectedProvider) {
    return [selectedProvider];
  }
  if (selection.mode === "preferred_provider" && selectedProvider) {
    return [selectedProvider, ...ordered.filter((provider) => provider.id !== selectedProvider.id)];
  }
  return ordered;
}

export function shouldAllowPaidVideoProviderFallback(env: FallbackEnv = process.env) {
  return env.LOCAL_AI_WORKER_ALLOW_PAID_VIDEO_PROVIDER_FALLBACK === "1";
}

export function isUnacceptedVideoCreateFailure(error: unknown): boolean {
  const message = fallbackErrorMessage(error).toLowerCase();
  if (!message.includes("ai_provider_video_create_failed_")) return false;
  if (/ai_provider_video_create_failed_(?:multi_frame_payload_rejected_)?(?:402|429|500|502|503|504|524)_/.test(message)) {
    return true;
  }
  return message.includes("余额不足") ||
    message.includes("insufficient") ||
    message.includes("quota") ||
    message.includes("billing") ||
    message.includes("upstream_error") ||
    message.includes("服务暂时不可用") ||
    message.includes("temporarily unavailable") ||
    message.includes("try again later") ||
    message.includes("service unavailable");
}

export function shouldTryNextPaidVideoProvider(
  error: unknown,
  timing?: Record<string, string>,
  env: FallbackEnv = process.env
) {
  if (!shouldAllowPaidVideoProviderFallback(env)) return false;
  if (timing?.providerTaskCreatedAt) return false;
  return isUnacceptedVideoCreateFailure(error);
}
