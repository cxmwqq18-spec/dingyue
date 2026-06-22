import "server-only";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreditLedgerEntry, Customer, GenerationJob, SiteAiApp } from "@/lib/types";
import { StoreError } from "@/lib/server-store";
import { mapCreditLedger, mapCustomer, mapGenerationJob, mapSiteAiApp } from "@/lib/stores/prisma-mappers";

type Tx = Prisma.TransactionClient;

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
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
  if ((customer.balance?.balance ?? 0) < siteAiApp.creditCost) throw new StoreError("insufficient_credits", 402);

  const requestedAssetIds = Array.isArray(params.requestJson?.assetIds)
    ? params.requestJson.assetIds.filter((item): item is string => typeof item === "string")
    : [];
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
      creditsReserved: siteAiApp.creditCost,
      requestJson: toPrismaJson({ ...(params.requestJson ?? {}), worker: siteAiApp.routeKey })
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
  return prisma.$transaction(async (tx) => {
    const result = await createGenerationJobInTx(tx, params);
    return {
      job: mapGenerationJob(result.job),
      siteAiApp: mapSiteAiApp(result.siteAiApp),
      ledger: mapCreditLedger(result.ledger),
      customer: mapCustomer(result.customer)
    };
  });
}

export async function updateGenerationJobStatusRelational(params: {
  jobId: string;
  siteId: string;
  requestId: string;
  status: string;
  stage?: string;
}): Promise<{ job: GenerationJob; alreadyFinal: boolean }> {
  return prisma.$transaction(async (tx) => {
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
  });
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
  return prisma.$transaction(async (tx) => {
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
  });
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
  return prisma.$transaction(async (tx) => {
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
  });
}
