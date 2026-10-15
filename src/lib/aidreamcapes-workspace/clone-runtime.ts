import { CloneProviderAdapterError } from "./clone-contract";
import { WorkspaceError } from "./types";
import type { CloneExecution, CloneProviderAdapter, CloneProviderEvent, CloneProviderOutput, CloneProviderRequest } from "./clone-contract";

export function fixtureCloneOutput(operation: CloneProviderRequest["operation"], sourceAssetId: string): CloneProviderOutput {
  return operation === "voice_twin" ? { sourceAssetId, voiceId: `mock:aidreamcapes:clone:${sourceAssetId}:v1` } : {
    sourceAssetId, analysis: { revision: 1, synthetic: true, transcript: [], productFacts: [], segments: [
      { start: 0, end: 3, role: "hook", visual: "Introduce the product." },
      { start: 3, end: 12, role: "body", visual: "Show the product in use." },
      { start: 12, end: 15, role: "cta", visual: "Invite viewers to learn more." },
    ] },
  };
}
/** No default transport, network, configuration or billing dependency. Caller persists each revision. */
export async function submitCloneExecution(adapter: CloneProviderAdapter, request: CloneProviderRequest, assertAuthorized: () => Promise<void>, now = Date.now()): Promise<CloneExecution> {
  if (request.siteId !== "site_aidreamcapes" || !request.customerId) throw new WorkspaceError("clone_owner_required", 403);
  await assertAuthorized();
  if (!adapter.capabilities[request.operation] || (adapter.mode === "real" && !adapter.capabilities.proven)) throw new WorkspaceError("clone_provider_unavailable", 503);
  const { providerJobId } = await adapter.submit(request);
  if (!providerJobId) throw new WorkspaceError("clone_provider_result_invalid", 502);
  return { request, adapterId: adapter.id, mode: adapter.mode, providerJobId, state: "running", revision: 1, sequence: 0, deadline: now + 300_000 };
}
export async function applyCloneEvent(execution: CloneExecution, event: CloneProviderEvent, revision: number, assertAuthorized: () => Promise<void>, now = Date.now()): Promise<CloneExecution> {
  if (execution.revision !== revision) throw new WorkspaceError("revision_conflict", 409);
  if (execution.providerJobId !== event.providerJobId) throw new WorkspaceError("clone_callback_job_mismatch", 403);
  // Authorization runs even for duplicates; a revoked result cannot be reused.
  await assertAuthorized();
  if (execution.state !== "running" || event.sequence <= execution.sequence) return execution;
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 1) throw new WorkspaceError("clone_callback_sequence_invalid");
  if (now >= execution.deadline) return { ...execution, state: "failed", failure: "timeout", revision: revision + 1 };
  if (!["running", "succeeded", "failed", "cancelled"].includes(event.state)) throw new WorkspaceError("clone_callback_state_invalid");
  if (event.state === "failed" && !event.failure) throw new WorkspaceError("clone_provider_failure_required");
  if (event.state === "succeeded") validateCloneProviderOutput(execution, event.result);
  return { ...execution, state: event.state, sequence: event.sequence, revision: revision + 1, result: event.state === "succeeded" ? event.result : undefined, failure: event.failure };
}
export async function pollCloneExecution(adapter: CloneProviderAdapter, execution: CloneExecution, assertAuthorized: () => Promise<void>, now = Date.now()) {
  if (adapter.id !== execution.adapterId || adapter.mode !== execution.mode) throw new WorkspaceError("clone_adapter_mismatch", 409);
  await assertAuthorized();
  if (execution.state !== "running") return execution;
  if (now >= execution.deadline) { await adapter.cancel(execution.providerJobId); return { ...execution, state: "failed" as const, failure: "timeout" as const, revision: execution.revision + 1 }; }
  let event: CloneProviderEvent;
  try {
    event = await adapter.poll(execution.providerJobId);
    if (event.state === "succeeded" && !event.result) event = { ...event, result: await adapter.readResult(execution.providerJobId) };
  } catch (error) {
    if (!(error instanceof CloneProviderAdapterError)) throw error;
    await assertAuthorized();
    return { ...execution, state: "failed" as const, failure: error.failure, revision: execution.revision + 1 };
  }
  return applyCloneEvent(execution, event, execution.revision, assertAuthorized, now);
}
export async function cancelCloneExecution(adapter: CloneProviderAdapter, execution: CloneExecution) {
  if (adapter.id !== execution.adapterId || adapter.mode !== execution.mode) throw new WorkspaceError("clone_adapter_mismatch", 409);
  if (execution.state !== "running") return execution;
  await adapter.cancel(execution.providerJobId);
  return { ...execution, state: "cancelled" as const, revision: execution.revision + 1 };
}

export function validateCloneProviderOutput(execution: CloneExecution, result: CloneProviderOutput | undefined): asserts result is CloneProviderOutput {
  const invalid = () => { throw new WorkspaceError("clone_provider_result_invalid", 502); };
  if (!result || result.sourceAssetId !== execution.request.sourceAssetId) return invalid();
  if (execution.request.operation === "voice_twin") {
    if (typeof result.voiceId !== "string" || !result.voiceId || result.voiceId.length > 512 ||
      (execution.mode === "real" ? result.voiceId.startsWith("mock:") : !result.voiceId.startsWith("mock:"))) return invalid();
    return;
  }
  const analysis = result.analysis;
  if (!analysis || !Number.isSafeInteger(analysis.revision) || analysis.revision < 1 ||
      typeof analysis.synthetic !== "boolean" || (execution.mode === "real" ? analysis.synthetic : !analysis.synthetic) ||
      !Array.isArray(analysis.productFacts) || analysis.productFacts.length ||
      !Array.isArray(analysis.segments) || !analysis.segments.length || analysis.segments.length > 100 ||
      !Array.isArray(analysis.transcript) || analysis.transcript.length > 1000 ||
      (execution.mode === "fixture" && analysis.transcript.length)) return invalid();
  for (const segment of [...analysis.segments, ...analysis.transcript]) {
    if (!segment || !Number.isFinite(segment.start) || !Number.isFinite(segment.end) || segment.start < 0 || segment.end <= segment.start || segment.end > 3600) return invalid();
  }
  if (analysis.segments.some(segment => !["hook", "body", "cta"].includes(segment.role) || typeof segment.visual !== "string" || !segment.visual.trim() || segment.visual.length > 6000) ||
      analysis.transcript.some(segment => typeof segment.text !== "string" || !segment.text.trim() || segment.text.length > 6000)) return invalid();
}
/** No callback route exists until an adapter with authenticated callbacks is configured. */
export async function receiveCloneCallback(adapter: CloneProviderAdapter, execution: CloneExecution, payload: unknown, signature: string, revision: number, assertAuthorized: () => Promise<void>, now = Date.now()) {
  if (adapter.id !== execution.adapterId || adapter.mode !== execution.mode) throw new WorkspaceError("clone_adapter_mismatch", 409);
  await assertAuthorized();
  const event = await adapter.verifyCallback(payload, signature);
  return applyCloneEvent(execution, event, revision, assertAuthorized, now);
}
