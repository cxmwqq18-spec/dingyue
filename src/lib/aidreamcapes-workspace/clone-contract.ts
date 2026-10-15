/** Transport contract only: declaring a capability does not prove provider support. */
export type CloneOperation = "voice_twin" | "ad_reference";
export type CloneProviderFailure = "not_configured" | "unsupported" | "unauthorized" | "invalid_media" | "rate_limited" | "upstream_unavailable" | "timeout" | "cancelled" | "invalid_result";
export type CloneProviderRequest = {
  siteId: "site_aidreamcapes"; customerId: string; jobId: string; sourceAssetId: string;
  consentId: string; consentRevision: number; operation: CloneOperation; idempotencyKey: string;
};
export type CloneProviderOutput = {
  sourceAssetId: string; voiceId?: string;
  analysis?: { revision: number; synthetic: boolean; transcript: { start: number; end: number; text: string }[];
    segments: { start: number; end: number; role: "hook" | "body" | "cta"; visual: string }[]; productFacts: never[] };
};
export type CloneProviderEvent = {
  providerJobId: string; sequence: number; state: "running" | "succeeded" | "failed" | "cancelled";
  result?: CloneProviderOutput; failure?: CloneProviderFailure;
};
export interface CloneProviderAdapter {
  readonly id: string;
  readonly mode: "fixture" | "real";
  readonly capabilities: { voice_twin: boolean; ad_reference: boolean; proven: boolean };
  submit(request: CloneProviderRequest): Promise<{ providerJobId: string }>;
  poll(providerJobId: string): Promise<CloneProviderEvent>;
  /** A real implementation must authenticate callback origin before returning an event. */
  verifyCallback(payload: unknown, signature: string): Promise<CloneProviderEvent>;
  readResult(providerJobId: string): Promise<CloneProviderOutput>;
  cancel(providerJobId: string): Promise<void>;
}
export type CloneExecution = {
  request: CloneProviderRequest; adapterId: string; mode: "fixture" | "real"; providerJobId: string;
  state: CloneProviderEvent["state"]; revision: number; sequence: number; deadline: number;
  result?: CloneProviderOutput; failure?: CloneProviderFailure;
};

/** Transport implementations map HTTP/status errors to this stable taxonomy. */
export class CloneProviderAdapterError extends Error {
  constructor(public readonly failure: CloneProviderFailure, public readonly retryAfterMs?: number) { super(failure); }
}
