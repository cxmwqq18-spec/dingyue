import "server-only";
import { StoreError } from "@/lib/server-store";
import { createGenerationJobRelational, generationRequestHash, rerunGenerationJobRelational, settleGenerationJobRelational } from "@/lib/stores/job-store";
import { buildWorkerPayload, dispatchWorkerPayload, type WorkerBaseUrls, type WorkerDispatchResult, type WorkerPayload } from "@/lib/worker";
import type { CreditLedgerEntry, Customer, GenerationEntryPoint, GenerationJob, SiteAiApp } from "@/lib/types";

export type GenerationSubmitAuthContext =
  | { kind: "customer"; actorId: string }
  | { kind: "site_admin"; actorId: string }
  | { kind: "platform_admin"; actorId: string }
  | { kind: "external_api"; apiKeyId: string; scopes: string[] };

export interface GenerationSubmitInput {
  siteId: string;
  customerId: string;
  aiAppSlug: string;
  params?: Record<string, unknown>;
  entryPoint: GenerationEntryPoint;
  idempotencyKey?: string;
  authContext: GenerationSubmitAuthContext;
  baseUrls: WorkerBaseUrls;
  subscriptionBypass?: { enabled: boolean; reason: "site_admin"; siteAdminId?: string };
  skipWorkerDispatch?: boolean;
  includeWorkerPayload?: boolean;
}

export interface GenerationSubmitResult {
  ok: boolean;
  job: GenerationJob;
  customer: Customer;
  customerBalance: Customer["balance"];
  siteAiApp?: SiteAiApp;
  ledgerAction?: CreditLedgerEntry | null;
  workerDispatch: WorkerDispatchResult;
  workerPayload?: WorkerPayload;
  reused?: boolean;
  note: string;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function externalProviderOverrideScope(scopes: string[]) {
  return scopes.includes("generation:provider_override");
}

function assertExternalRequestAllowed(params: { requestParams?: Record<string, unknown>; authContext: GenerationSubmitAuthContext }) {
  if (params.authContext.kind !== "external_api" || externalProviderOverrideScope(params.authContext.scopes)) return;
  const fields = recordValue(params.requestParams?.fields);
  for (const key of ["providerSelection", "modelOverride", "sceneImageProviderId", "imageProviderId"]) {
    if (params.requestParams && Object.prototype.hasOwnProperty.call(params.requestParams, key)) {
      throw new StoreError("site_api_key_forbidden", 403);
    }
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      throw new StoreError("site_api_key_forbidden", 403);
    }
  }
}

async function settleFailedDispatch(params: {
  siteId: string;
  job: GenerationJob;
  requestId: string;
  workerDispatch: WorkerDispatchResult;
}) {
  return settleGenerationJobRelational({
    jobId: params.job.id,
    siteId: params.siteId,
    requestId: params.requestId,
    status: "failed",
    error: params.workerDispatch.error ?? "worker_dispatch_failed"
  });
}

export async function submitGenerationJob(input: GenerationSubmitInput): Promise<GenerationSubmitResult> {
  assertExternalRequestAllowed({ requestParams: input.params, authContext: input.authContext });
  const idempotencyKey = input.idempotencyKey?.trim() || undefined;
  const requestHash = idempotencyKey ? generationRequestHash({ aiAppSlug: input.aiAppSlug, requestJson: input.params }) : undefined;
  const created = await createGenerationJobRelational({
    siteId: input.siteId,
    customerId: input.customerId,
    aiAppSlug: input.aiAppSlug,
    requestJson: input.params,
    subscriptionBypass: input.subscriptionBypass,
    entryPoint: input.entryPoint,
    idempotencyKey,
    requestHash,
    skipProviderAvailabilityCheck: input.skipWorkerDispatch === true
  });

  if (created.reused) {
    return {
      ok: true,
      job: created.job,
      customer: created.customer,
      customerBalance: created.customer.balance,
      siteAiApp: created.siteAiApp,
      ledgerAction: null,
      workerDispatch: { status: "skipped", error: "idempotent_replay" },
      reused: true,
      note: "Idempotent replay returned the existing generation job."
    };
  }

  const workerPayload = await buildWorkerPayload({ job: created.job, siteAiApp: created.siteAiApp, baseUrls: input.baseUrls });
  const workerDispatch = input.skipWorkerDispatch
    ? { status: "skipped" as const }
    : await dispatchWorkerPayload(workerPayload);

  if (!input.skipWorkerDispatch && workerDispatch.status !== "sent") {
    const settled = await settleFailedDispatch({
      siteId: input.siteId,
      job: created.job,
      requestId: workerPayload.requestId,
      workerDispatch
    });
    return {
      ok: false,
      job: settled.job,
      customer: settled.customer,
      customerBalance: settled.customer.balance,
      siteAiApp: created.siteAiApp,
      ledgerAction: settled.ledger ?? null,
      workerDispatch,
      ...(input.includeWorkerPayload ? { workerPayload } : {}),
      note: "Worker dispatch was not accepted. The job was failed and reserved credits were released."
    };
  }

  return {
    ok: true,
    job: created.job,
    customer: created.customer,
    customerBalance: created.customer.balance,
    siteAiApp: created.siteAiApp,
    ledgerAction: created.ledger ?? null,
    workerDispatch,
    ...(input.includeWorkerPayload ? { workerPayload } : {}),
    note: input.skipWorkerDispatch
      ? "Persisted job and reserved credits. Worker dispatch is not configured."
      : "Persisted job, reserved credits, and attempted worker dispatch."
  };
}

export async function submitRerunGenerationJob(input: {
  siteId: string;
  jobId: string;
  actor?: string;
  baseUrls: WorkerBaseUrls;
  includeWorkerPayload?: boolean;
}) {
  const rerun = await rerunGenerationJobRelational({
    siteId: input.siteId,
    jobId: input.jobId,
    actor: input.actor
  });
  const workerPayload = await buildWorkerPayload({ job: rerun.job, siteAiApp: rerun.siteAiApp, baseUrls: input.baseUrls });
  const workerDispatch = await dispatchWorkerPayload(workerPayload);
  if (workerDispatch.status !== "sent") {
    const settled = await settleFailedDispatch({
      siteId: input.siteId,
      job: rerun.job,
      requestId: workerPayload.requestId,
      workerDispatch
    });
    return {
      ok: false,
      sourceJob: rerun.sourceJob,
      job: settled.job,
      customer: settled.customer,
      customerBalance: settled.customer.balance,
      ledgerAction: settled.ledger ?? null,
      workerDispatch,
      ...(input.includeWorkerPayload ? { workerPayload } : {}),
      note: "Worker dispatch was not accepted. The rerun job was failed and reserved credits were released."
    };
  }
  return {
    ok: true,
    sourceJob: rerun.sourceJob,
    job: rerun.job,
    customer: rerun.customer,
    customerBalance: rerun.customer.balance,
    ledgerAction: rerun.ledger,
    workerDispatch,
    ...(input.includeWorkerPayload ? { workerPayload } : {}),
    note: "Persisted rerun job, reserved credits, and attempted worker dispatch."
  };
}
