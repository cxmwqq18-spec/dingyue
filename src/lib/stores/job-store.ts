import "server-only";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AiProviderConfig, AiWorkflowConfig, AiWorkflowField, CreditLedgerEntry, Customer, GenerationJob, SiteAiApp } from "@/lib/types";
import { StoreError } from "@/lib/server-store";
import { mapCreditLedger, mapCustomer, mapGenerationJob, mapSiteAiApp } from "@/lib/stores/prisma-mappers";

type Tx = Prisma.TransactionClient;
const jobStoreTimeoutMs = Math.max(5000, Number(process.env.AI_JOB_STORE_TIMEOUT_MS ?? "20000") || 20000);
const jobStoreTransactionOptions = { timeout: jobStoreTimeoutMs, maxWait: Math.min(5000, jobStoreTimeoutMs) };
const DEFAULT_MAX_SOURCE_ASSETS = 24;

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
}

async function withJobStoreTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new StoreError(message, 504)), jobStoreTimeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function toPrismaJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function cleanRerunRequest(value: Prisma.JsonValue): Record<string, unknown> {
  const request = value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
  delete request.lastWorkerStatus;
  delete request.lastWorkerStage;
  return request;
}

function jsonObject<T>(value: Prisma.JsonValue | null | undefined): T | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultWorkflowConfig(siteAiApp: { aiApp: { name: string; description: string; parameterSchema: Prisma.JsonValue } }): AiWorkflowConfig {
  const parameterSchema = Array.isArray(siteAiApp.aiApp.parameterSchema)
    ? siteAiApp.aiApp.parameterSchema as Array<{ id: string; label: string; type: "text" | "select"; options?: string[] }>
    : [];
  const fields: AiWorkflowField[] = parameterSchema.map((field) => field.type === "select"
    ? {
        id: field.id,
        label: field.label,
        type: "select",
        required: true,
        options: (field.options ?? []).map((option) => ({ label: option, value: option })),
        default: field.options?.[0] ?? ""
      }
    : {
        id: field.id,
        label: field.label,
        type: "text",
        required: true,
        default: ""
      });
  return {
    version: 1,
    flowName: siteAiApp.aiApp.name,
    description: siteAiApp.aiApp.description,
    submitLabel: "Start generation",
    promptTemplate: "Create a private image generation for {{flowName}} using {{fields}} and the selected source photos.",
    steps: [
      { id: "source_photos", title: "Select source photos", kind: "asset_select", assetRules: { min: 1, max: 4, roles: ["input"], accept: ["image/*"], required: true } },
      { id: "generation_options", title: "Set generation options", kind: "fields", fields },
      { id: "review_request", title: "Review request", kind: "review" }
    ]
  };
}

function workflowFields(workflow: AiWorkflowConfig): AiWorkflowField[] {
  return workflow.steps.flatMap((step) => step.kind === "fields" ? step.fields ?? [] : []);
}

function assetRules(workflow: AiWorkflowConfig) {
  return workflow.steps.find((step) => step.kind === "asset_select")?.assetRules ?? { min: 1, max: 4 };
}

function maxAssetsForWorkflow(workflow: AiWorkflowConfig): number {
  const configuredMax = assetRules(workflow).max;
  return configuredMax && configuredMax > 0 ? configuredMax : DEFAULT_MAX_SOURCE_ASSETS;
}

function isThemeModeRequest(requestJson?: Record<string, unknown>): boolean {
  return requestJson?.mode === "theme" || typeof requestJson?.creativePackId === "string";
}

function isThemeManagedField(field: AiWorkflowField): boolean {
  const id = field.id.toLowerCase().replace(/[_-]/g, "");
  const label = field.label.toLowerCase();
  return id === "style" || id === "prompt" || id === "outputcount" || label.includes("style");
}

function normalizePromptInputs(requestJson?: Record<string, unknown>): Record<string, string | number | boolean> {
  const fields = requestJson?.fields;
  if (fields && typeof fields === "object" && !Array.isArray(fields)) {
    return Object.fromEntries(
      Object.entries(fields as Record<string, unknown>).filter((entry): entry is [string, string | number | boolean] =>
        typeof entry[1] === "string" || typeof entry[1] === "number" || typeof entry[1] === "boolean"
      )
    );
  }
  return Object.fromEntries(
    Object.entries(requestJson ?? {}).filter((entry): entry is [string, string | number | boolean] =>
      typeof entry[1] === "string" || typeof entry[1] === "number" || typeof entry[1] === "boolean"
    )
  );
}

type GenerationCreativePack = Pick<Prisma.CreativePackGetPayload<object>, "id" | "name" | "headline" | "category" | "aiAppSlug" | "prompt" | "creditCost" | "outputCount">;

function safeCreativePrompt(value: string): string {
  return value
    .replace(/create a coherent \d+[- ]image package[^.]*\./gi, "Create one standalone image for this package slot.")
    .replace(/create a coherent [a-z]+[- ]image package[^.]*\./gi, "Create one standalone image for this package slot.")
    .replace(/\b\d+[- ]image package\b/gi, "single-image package slot")
    .replace(/\bfull set\b/gi, "single package slot")
    .replace(/varied poses, camera distances, and compositions/gi, "one clear pose, one camera distance, and one composition")
    .replace(/no collage unless[^.]*\./gi, "No collage, no grid, no contact sheet, no split panels.")
    .replace(/keeps? the subject recognizable[^.]*\./gi, "Use the uploaded image only as a broad style, pose, color, and composition reference, without recreating or verifying any real person's identity.")
    .replace(/key facial features/gi, "general portrait styling")
    .replace(/overall identity/gi, "overall mood")
    .replace(/identity consistency/gi, "style consistency")
    .replace(/recognizable identity/gi, "coherent styling");
}

function defaultCreativePrompt(creativePack?: GenerationCreativePack | null): string {
  if (!creativePack) return "";
  if (creativePack.prompt?.trim()) return safeCreativePrompt(creativePack.prompt.trim());
  if (creativePack.category === "anime-avatar") {
    return "Use the uploaded image only as a broad style, pose, color, and composition reference. Create an original anime-inspired avatar with expressive eyes, polished digital illustration finish, tasteful outfit styling, vibrant but controlled color palette, high-detail linework, and soft shading. Do not recreate or verify any real person's identity.";
  }
  return "";
}

function isRenderablePromptField(key: string) {
  return !["assetIds", "creativePackId", "customerModelId", "outputCount", "rerunOf", "rerunBy"].includes(key);
}

function renderPrompt(template: string | undefined, context: { flowName: string; fields: Record<string, string | number | boolean>; assetCount: number; themeName?: string; themePrompt?: string }): string {
  const fieldText = Object.entries(context.fields)
    .filter(([key]) => isRenderablePromptField(key))
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("; ");
  const source = template?.trim() || "Create {{flowName}} using {{fields}} with {{assetCount}} selected source photos.";
  return source
    .replaceAll("{{flowName}}", context.flowName)
    .replaceAll("{{fields}}", fieldText)
    .replaceAll("{{assetCount}}", String(context.assetCount))
    .replaceAll("{{themeName}}", context.themeName ?? "")
    .replaceAll("{{themePrompt}}", context.themePrompt ?? "");
}

function resolveGenerationRequest(params: {
  requestJson?: Record<string, unknown>;
  siteAiApp: Prisma.SiteAiAppGetPayload<{ include: { aiApp: true } }>;
  requestedAssetIds: string[];
  creativePack?: GenerationCreativePack | null;
}) {
  const workflow = jsonObject<AiWorkflowConfig>(params.siteAiApp.workflowConfig) ?? defaultWorkflowConfig(params.siteAiApp);
  const provider = jsonObject<AiProviderConfig>(params.siteAiApp.providerConfig) ?? { mode: "platform_fallback", fallbackEnabled: true };
  const themeMode = isThemeModeRequest(params.requestJson);
  const fields = normalizePromptInputs(params.requestJson);
  const missingField = workflowFields(workflow).find((field) =>
    field.required &&
    !(themeMode && isThemeManagedField(field)) &&
    (fields[field.id] === undefined || fields[field.id] === "")
  );
  if (missingField) throw new StoreError("missing_required_prompt_input", 400);
  const rules = assetRules(workflow);
  const minAssets = rules.min ?? 1;
  const maxAssets = maxAssetsForWorkflow(workflow);
  if (params.requestedAssetIds.length < minAssets) throw new StoreError("not_enough_source_assets", 400);
  if (params.requestedAssetIds.length > maxAssets) throw new StoreError("too_many_source_assets", 400);
  const flowName = workflow.flowName ?? params.siteAiApp.aiApp.name;
  const themePrompt = defaultCreativePrompt(params.creativePack);
  const basePrompt = renderPrompt(workflow.promptTemplate, {
    flowName,
    fields,
    assetCount: params.requestedAssetIds.length,
    themeName: params.creativePack?.name,
    themePrompt
  });
  const renderedPrompt = themePrompt
    ? `${basePrompt}\n\nSelected creative theme: ${params.creativePack?.name ?? "Creative theme"}\nTheme prompt: ${themePrompt}`
    : basePrompt;
  return {
    fields,
    workflow,
    provider,
    prompt: {
      template: workflow.promptTemplate ?? "",
      inputs: fields,
      rendered: renderedPrompt,
      negativePrompt: workflow.negativePrompt ?? "",
      themeName: params.creativePack?.name ?? "",
      themePrompt
    }
  };
}

async function readCustomerForUpdate(tx: Tx, siteId: string, customerId: string) {
  const customer = await tx.customer.findFirst({ where: { id: customerId, siteId }, include: { balance: true } });
  if (!customer) throw new StoreError("customer_not_found_for_site", 404);
  if (!customer.balance) {
    await tx.creditBalance.create({ data: { id: uid("bal"), siteId, customerId, balance: 0, reserved: 0 } });
    return tx.customer.findFirstOrThrow({ where: { id: customerId, siteId }, include: { balance: true } });
  }
  return customer;
}

async function reserveCreditsForJob(tx: Tx, job: { id: string; siteId: string; customerId: string; creditsReserved: number }) {
  let ledger = await tx.creditLedger.findFirst({
    where: { siteId: job.siteId, customerId: job.customerId, type: "reserve", sourceId: job.id }
  });
  if (ledger) return ledger;
  const updated = await tx.creditBalance.updateMany({
    where: { siteId: job.siteId, customerId: job.customerId, balance: { gte: job.creditsReserved } },
    data: { balance: { decrement: job.creditsReserved }, reserved: { increment: job.creditsReserved } }
  });
  if (updated.count !== 1) throw new StoreError("insufficient_credits", 402);
  ledger = await tx.creditLedger.create({
    data: {
      id: uid("led"),
      siteId: job.siteId,
      customerId: job.customerId,
      amount: -job.creditsReserved,
      type: "reserve",
      sourceType: "generation_job",
      sourceId: job.id
    }
  });
  return ledger;
}

async function createGenerationJobInTx(tx: Tx, params: {
  siteId: string;
  customerId: string;
  aiAppSlug: string;
  requestJson?: Record<string, unknown>;
}) {
  const customer = await readCustomerForUpdate(tx, params.siteId, params.customerId);
  if (customer.status === "past_due") throw new StoreError("customer_past_due", 402);
  if (customer.status === "blocked") throw new StoreError("customer_blocked", 403);
  const siteAiApp = await tx.siteAiApp.findFirst({
    where: { siteId: params.siteId, enabled: true, aiApp: { slug: params.aiAppSlug } },
    include: { aiApp: true }
  });
  if (!siteAiApp) throw new StoreError("ai_app_not_enabled_for_site", 404);

  const creativePackId = typeof params.requestJson?.creativePackId === "string" ? params.requestJson.creativePackId : undefined;
  const creativePack = creativePackId
    ? await tx.creativePack.findFirst({
        where: { id: creativePackId, siteId: params.siteId, status: "active" },
        select: {
          id: true,
          name: true,
          headline: true,
          category: true,
          aiAppSlug: true,
          prompt: true,
          creditCost: true,
          outputCount: true
        }
      })
    : null;
  if (creativePackId && !creativePack) throw new StoreError("creative_pack_not_found_for_site", 404);
  if (creativePack && creativePack.aiAppSlug !== params.aiAppSlug) throw new StoreError("creative_pack_tool_mismatch", 400);
  const creditsReserved = creativePack?.creditCost ?? siteAiApp.creditCost;
  if ((customer.balance?.balance ?? 0) < creditsReserved) throw new StoreError("insufficient_credits", 402);

  const requestedAssetIds = Array.isArray(params.requestJson?.assetIds)
    ? params.requestJson.assetIds.filter((item): item is string => typeof item === "string")
    : [];
  const resolvedRequest = resolveGenerationRequest({ requestJson: params.requestJson, siteAiApp, requestedAssetIds, creativePack });
  if (requestedAssetIds.length) {
    const validAssets = await tx.assetUpload.findMany({
      where: { id: { in: requestedAssetIds }, siteId: params.siteId, customerId: params.customerId, deletedAt: null },
      select: { id: true }
    });
    const validAssetIds = new Set(validAssets.map((asset) => asset.id));
    const invalidAssetId = requestedAssetIds.find((assetId) => !validAssetIds.has(assetId));
    if (invalidAssetId) throw new StoreError("asset_not_found_for_customer", 404);
  }

  const job = await tx.generationJob.create({
    data: {
      id: uid("job"),
      siteId: params.siteId,
      customerId: params.customerId,
      aiAppId: siteAiApp.aiApp.id,
      status: "queued",
      creditsReserved,
      requestJson: toPrismaJson({
        ...(params.requestJson ?? {}),
        fields: resolvedRequest.fields,
        worker: siteAiApp.routeKey,
        flow: {
          version: resolvedRequest.workflow.version,
          flowName: resolvedRequest.workflow.flowName ?? siteAiApp.aiApp.name,
          aiAppSlug: params.aiAppSlug,
          siteAiAppId: siteAiApp.id,
          routeKey: siteAiApp.routeKey
        },
        flowSnapshot: resolvedRequest.workflow,
        creativePack: creativePack
          ? {
              id: creativePack.id,
              name: creativePack.name,
              headline: creativePack.headline,
              category: creativePack.category,
              aiAppSlug: creativePack.aiAppSlug,
              prompt: creativePack.prompt ?? "",
              creditCost: creativePack.creditCost,
              outputCount: creativePack.outputCount
            }
          : undefined,
        prompt: resolvedRequest.prompt,
        providerSelection: resolvedRequest.provider
      })
    }
  });
  const ledger = await reserveCreditsForJob(tx, job);
  const updatedCustomer = await tx.customer.findFirstOrThrow({ where: { id: params.customerId, siteId: params.siteId }, include: { balance: true } });
  return { job, siteAiApp, ledger, customer: updatedCustomer };
}

export async function createGenerationJobRelational(params: {
  siteId: string;
  customerId: string;
  aiAppSlug: string;
  requestJson?: Record<string, unknown>;
}): Promise<{ job: GenerationJob; siteAiApp: SiteAiApp; ledger: CreditLedgerEntry; customer: Customer }> {
  return withJobStoreTimeout(prisma.$transaction(async (tx) => {
    const result = await createGenerationJobInTx(tx, params);
    return {
      job: mapGenerationJob(result.job),
      siteAiApp: mapSiteAiApp(result.siteAiApp),
      ledger: mapCreditLedger(result.ledger),
      customer: mapCustomer(result.customer)
    };
  }, jobStoreTransactionOptions), "job_create_timeout");
}

export async function updateGenerationJobStatusRelational(params: {
  jobId: string;
  siteId: string;
  requestId: string;
  status: string;
  stage?: string;
}): Promise<{ job: GenerationJob; alreadyFinal: boolean }> {
  return withJobStoreTimeout(prisma.$transaction(async (tx) => {
    const job = await tx.generationJob.findFirst({ where: { id: params.jobId, siteId: params.siteId } });
    if (!job) throw new StoreError("job_not_found", 404);
    const alreadyFinal = job.status === "succeeded" || job.status === "failed" || job.status === "refunded";
    const resultJson = {
      ...((job.resultJson && typeof job.resultJson === "object" && !Array.isArray(job.resultJson) ? job.resultJson : {}) as Record<string, unknown>),
      lastWorkerStatus: params.status,
      lastWorkerStage: params.stage ?? "worker_update",
      requestId: params.requestId
    };
    const updatedJob = await tx.generationJob.update({
      where: { id: job.id },
      data: {
        status: !alreadyFinal && params.status !== "queued" ? (params.status === "failed" ? "failed" : "running") : undefined,
        resultJson: toPrismaJson(resultJson)
      }
    });
    return { job: mapGenerationJob(updatedJob), alreadyFinal };
  }, jobStoreTransactionOptions), "job_status_update_timeout");
}

export async function settleGenerationJobRelational(params: {
  jobId: string;
  siteId: string;
  requestId: string;
  status: "succeeded" | "failed";
  outputs?: Array<{ storageKey: string; mimeType?: string }>;
  providerTrace?: Array<{ provider: string; attempts: number }>;
  costTrace?: { estimatedCostUsd?: number };
  error?: string;
}): Promise<{ job: GenerationJob; ledger?: CreditLedgerEntry; alreadyProcessed: boolean; customer: Customer }> {
  return withJobStoreTimeout(prisma.$transaction(async (tx) => {
    const job = await tx.generationJob.findFirst({ where: { id: params.jobId, siteId: params.siteId } });
    if (!job) throw new StoreError("job_not_found", 404);
    const customer = await readCustomerForUpdate(tx, job.siteId, job.customerId);
    const alreadyProcessed = job.status === "succeeded" || job.status === "failed" || job.status === "refunded";
    if (alreadyProcessed) return { job: mapGenerationJob(job), alreadyProcessed, customer: mapCustomer(customer) };

    const ledgerType = params.status === "succeeded" ? "consume" : "release";
    let ledger = await tx.creditLedger.findFirst({
      where: { siteId: job.siteId, customerId: job.customerId, type: ledgerType, sourceId: job.id }
    });
    if (!ledger) {
      const updated = await tx.creditBalance.updateMany({
        where: { siteId: job.siteId, customerId: job.customerId, reserved: { gte: job.creditsReserved } },
        data:
          params.status === "succeeded"
            ? { reserved: { decrement: job.creditsReserved } }
            : { balance: { increment: job.creditsReserved }, reserved: { decrement: job.creditsReserved } }
      });
      if (updated.count !== 1) throw new StoreError("reserved_credits_not_available", 409);
      ledger = await tx.creditLedger.create({
        data: {
          id: uid("led"),
          siteId: job.siteId,
          customerId: job.customerId,
          amount: params.status === "succeeded" ? -job.creditsReserved : job.creditsReserved,
          type: ledgerType,
          sourceType: "generation_job",
          sourceId: job.id
        }
      });
    }
    const outputs = params.outputs ?? [];
    const updatedJob = await tx.generationJob.update({
      where: { id: job.id },
      data: {
        status: params.status,
        resultJson: toPrismaJson({
          requestId: params.requestId,
          outputs,
          providerTrace: params.providerTrace ?? [],
          costTrace: params.costTrace ?? {},
          error: params.error ?? null,
          settledAt: new Date().toISOString()
        })
      }
    });
    if (params.status === "succeeded") {
      await upsertAlbumForSettledJob(tx, updatedJob, outputs);
    }
    const updatedCustomer = await tx.customer.findFirstOrThrow({ where: { id: job.customerId, siteId: job.siteId }, include: { balance: true } });
    return { job: mapGenerationJob(updatedJob), ledger: mapCreditLedger(ledger), alreadyProcessed: false, customer: mapCustomer(updatedCustomer) };
  }, jobStoreTransactionOptions), "job_result_update_timeout");
}

async function upsertAlbumForSettledJob(
  tx: Tx,
  job: Prisma.GenerationJobGetPayload<object>,
  outputs: Array<{ storageKey: string; mimeType?: string }>
) {
  const assetIds: string[] = [];
  for (const [index, output] of outputs.entries()) {
    const existing = await tx.assetUpload.findFirst({
      where: { siteId: job.siteId, customerId: job.customerId, jobId: job.id, storageKey: output.storageKey }
    });
    if (existing) {
      assetIds.push(existing.id);
      continue;
    }
    const asset = await tx.assetUpload.create({
      data: {
        id: uid("asset"),
        siteId: job.siteId,
        customerId: job.customerId,
        jobId: job.id,
        label: `Output ${index + 1}`,
        storageKey: output.storageKey,
        mimeType: output.mimeType ?? "image/webp",
        role: "output",
        visibility: "private",
        reviewStatus: "approved"
      }
    });
    assetIds.push(asset.id);
  }
  const packId = typeof (job.requestJson as Record<string, unknown>)?.creativePackId === "string"
    ? ((job.requestJson as Record<string, unknown>).creativePackId as string)
    : undefined;
  const existingAlbum = await tx.album.findFirst({ where: { siteId: job.siteId, sourceJobId: job.id } });
  if (existingAlbum) {
    await tx.album.update({
      where: { id: existingAlbum.id },
      data: {
        status: "ready",
        outputCount: outputs.length || existingAlbum.outputCount,
        coverAssetId: assetIds[0] ?? existingAlbum.coverAssetId
      }
    });
    return;
  }
  await tx.album.create({
    data: {
      id: uid("album"),
      siteId: job.siteId,
      customerId: job.customerId,
      title: "Generated album",
      sourceJobId: job.id,
      creativePackId: packId,
      status: "ready",
      outputCount: outputs.length,
      coverAssetId: assetIds[0]
    }
  });
}

export async function rerunGenerationJobRelational(params: {
  siteId: string;
  jobId: string;
  actor?: string;
}): Promise<{ sourceJob: GenerationJob; job: GenerationJob; siteAiApp: SiteAiApp; ledger: CreditLedgerEntry; customer: Customer }> {
  return withJobStoreTimeout(prisma.$transaction(async (tx) => {
    const sourceJob = await tx.generationJob.findFirst({ where: { id: params.jobId, siteId: params.siteId } });
    if (!sourceJob) throw new StoreError("job_not_found", 404);
    if (sourceJob.status !== "failed" && sourceJob.status !== "refunded") {
      throw new StoreError("only_failed_or_refunded_jobs_can_be_rerun", 409);
    }
    const aiApp = await tx.aiApp.findUnique({ where: { id: sourceJob.aiAppId } });
    if (!aiApp) throw new StoreError("ai_app_not_found", 404);
    const rerun = await createGenerationJobInTx(tx, {
      siteId: params.siteId,
      customerId: sourceJob.customerId,
      aiAppSlug: aiApp.slug,
      requestJson: {
        ...cleanRerunRequest(sourceJob.requestJson),
        rerunOf: sourceJob.id,
        rerunBy: params.actor ?? "site_admin_demo"
      }
    });
    return {
      sourceJob: mapGenerationJob(sourceJob),
      job: mapGenerationJob(rerun.job),
      siteAiApp: mapSiteAiApp(rerun.siteAiApp),
      ledger: mapCreditLedger(rerun.ledger),
      customer: mapCustomer(rerun.customer)
    };
  }, jobStoreTransactionOptions), "job_rerun_timeout");
}
