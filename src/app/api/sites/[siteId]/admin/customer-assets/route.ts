import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireSiteMutation } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import type { NextRequest } from "next/server";

type DeleteMode = "asset" | "output" | "job";

type DeleteCustomerAssetBody = {
  mode?: DeleteMode;
  customerId?: string;
  assetId?: string;
  jobId?: string;
};

type JobRequestJson = {
  assetIds?: unknown;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function sourceAssetIdsFromRequestJson(value: Prisma.JsonValue): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return stringArray((value as JobRequestJson).assetIds);
}

function deleteSourceId(jobId: string): string {
  return `delete:${jobId}`;
}

async function adjustBalanceForDeletedJob(
  tx: Prisma.TransactionClient,
  job: { id: string; siteId: string; customerId: string; creditsReserved: number }
) {
  const ledgers = await tx.creditLedger.findMany({
    where: { siteId: job.siteId, customerId: job.customerId, sourceType: "generation_job", sourceId: job.id },
    select: { amount: true, type: true }
  });
  let balanceDelta = -ledgers
    .filter((ledger) => ledger.type !== "reserve" && ledger.type !== "release")
    .reduce((sum, ledger) => sum + ledger.amount, 0);
  const hasReserve = ledgers.some((ledger) => ledger.type === "reserve");
  const hasReserveSettlement = ledgers.some((ledger) => ledger.type === "consume" || ledger.type === "release");
  const reservedDelta = hasReserve && !hasReserveSettlement ? -job.creditsReserved : 0;
  if (reservedDelta) balanceDelta += job.creditsReserved;
  if (!balanceDelta && !reservedDelta) return;

  const currentBalance = await tx.creditBalance.findUnique({
    where: { siteId_customerId: { siteId: job.siteId, customerId: job.customerId } },
    select: { balance: true, reserved: true }
  });
  await tx.creditBalance.upsert({
    where: { siteId_customerId: { siteId: job.siteId, customerId: job.customerId } },
    create: {
      id: `bal_${job.customerId}`,
      siteId: job.siteId,
      customerId: job.customerId,
      balance: Math.max(0, balanceDelta),
      reserved: 0
    },
    update: {
      balance: Math.max(0, (currentBalance?.balance ?? 0) + balanceDelta),
      reserved: Math.max(0, (currentBalance?.reserved ?? 0) + reservedDelta)
    }
  });

  await tx.creditLedger.create({
    data: {
      id: `led_${deleteSourceId(job.id)}_${Date.now().toString(36)}`,
      siteId: job.siteId,
      customerId: job.customerId,
      amount: balanceDelta,
      type: "adjustment",
      sourceType: "admin_resource_delete",
      sourceId: deleteSourceId(job.id)
    }
  });
}

async function deleteJobResource(tx: Prisma.TransactionClient, params: { siteId: string; customerId: string; jobId: string }) {
  const now = new Date();
  const job = await tx.generationJob.findFirst({
    where: { id: params.jobId, siteId: params.siteId, customerId: params.customerId },
    select: { id: true, siteId: true, customerId: true, creditsReserved: true, requestJson: true }
  });
  if (!job) throw new Error("job_not_found_for_site_customer");

  const sourceAssetIds = sourceAssetIdsFromRequestJson(job.requestJson);
  const outputAssets = await tx.assetUpload.findMany({
    where: { siteId: params.siteId, customerId: params.customerId, jobId: params.jobId, deletedAt: null },
    select: { id: true }
  });
  const outputAssetIds = outputAssets.map((asset) => asset.id);
  await adjustBalanceForDeletedJob(tx, job);

  await tx.album.deleteMany({ where: { siteId: params.siteId, customerId: params.customerId, sourceJobId: params.jobId } });
  if (outputAssetIds.length) {
    await tx.album.updateMany({
      where: { siteId: params.siteId, customerId: params.customerId, coverAssetId: { in: outputAssetIds } },
      data: { coverAssetId: null, status: "hidden" }
    });
    await tx.assetUpload.updateMany({
      where: { siteId: params.siteId, customerId: params.customerId, id: { in: outputAssetIds }, deletedAt: null },
      data: { deletedAt: now, jobId: null }
    });
  }

  const deletedSourceAssetIds: string[] = [];
  for (const assetId of sourceAssetIds) {
    const otherJobUsingSource = await tx.generationJob.findFirst({
      where: {
        siteId: params.siteId,
        customerId: params.customerId,
        id: { not: params.jobId },
        requestJson: { path: ["assetIds"], array_contains: assetId }
      },
      select: { id: true }
    });
    if (otherJobUsingSource) continue;
    const updated = await tx.assetUpload.updateMany({
      where: { siteId: params.siteId, customerId: params.customerId, id: assetId, deletedAt: null },
      data: { deletedAt: now }
    });
    if (updated.count) deletedSourceAssetIds.push(assetId);
  }

  await tx.assetUpload.updateMany({
    where: { siteId: params.siteId, customerId: params.customerId, jobId: params.jobId },
    data: { jobId: null }
  });
  await tx.generationJob.delete({ where: { id: params.jobId } });
  return {
    deletedJobIds: [params.jobId],
    deletedAssetIds: [...outputAssetIds, ...deletedSourceAssetIds],
    deletedSourceAssetIds,
    deletedAlbumScope: "job"
  };
}

async function deleteAssetResource(tx: Prisma.TransactionClient, params: { siteId: string; customerId: string; assetId: string; outputOnly?: boolean }) {
  const now = new Date();
  const asset = await tx.assetUpload.findFirst({
    where: { id: params.assetId, siteId: params.siteId, customerId: params.customerId, deletedAt: null },
    select: { id: true, role: true, jobId: true }
  });
  if (!asset) throw new Error("asset_not_found_for_site_customer");
  if (params.outputOnly && asset.role !== "output") throw new Error("asset_is_not_output");

  await tx.album.updateMany({
    where: { siteId: params.siteId, customerId: params.customerId, coverAssetId: params.assetId },
    data: { coverAssetId: null, status: "hidden" }
  });
  await tx.assetUpload.update({
    where: { id: params.assetId },
    data: { deletedAt: now }
  });

  return {
    deletedJobIds: [],
    deletedAssetIds: [params.assetId],
    deletedSourceAssetIds: [],
    deletedAlbumScope: "asset"
  };
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const guard = await requireSiteMutation(request, siteId, {
    roles: ["owner", "admin"],
    rateLimit: RATE_LIMITS.adminCustomerAssetDelete
  });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as DeleteCustomerAssetBody;
  if (!body.customerId || !body.mode) {
    return NextResponse.json({ error: "invalid_delete_request" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (body.mode === "job") {
        if (!body.jobId) throw new Error("job_id_required");
        return deleteJobResource(tx, { siteId, customerId: body.customerId!, jobId: body.jobId });
      }
      if (!body.assetId) throw new Error("asset_id_required");
      return deleteAssetResource(tx, { siteId, customerId: body.customerId!, assetId: body.assetId, outputOnly: body.mode === "output" });
    }, { timeout: 20_000, maxWait: 5_000 });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "customer_resource_delete_failed";
    const status = message.includes("not_found") ? 404 : message.includes("required") || message.includes("not_output") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
