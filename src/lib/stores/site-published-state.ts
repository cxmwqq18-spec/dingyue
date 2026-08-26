import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { SitePublishedState, VerifiedBackupReceipt } from "@/lib/types";
import { prisma, runPrismaReadWithReconnect, runPrismaWriteWithReconnect } from "@/lib/prisma";
import { publicationSnapshotIntegrity } from "@/lib/publication-snapshot-integrity";
import { compileCurrentPublishedPayloadRelational } from "@/lib/stores/theme-store";
import { toSitePublishedState } from "@/lib/stores/prisma-mappers";
import { assertVerifiedBackupReceipt } from "@/lib/current-state/backup-receipt";

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stable(item)])
  );
}

export function currentPublishedContentHash(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(stable(payload))).digest("hex");
}

export function currentPublishedRevision(siteId: string, contentHash: string): string {
  return crypto.createHash("sha256").update(`${siteId}:${contentHash}`).digest("hex").slice(0, 24);
}

export async function getCurrentPublishedStateRelational(siteId: string): Promise<SitePublishedState> {
  const row = await runPrismaReadWithReconnect(
    () => prisma.sitePublishedState.findUnique({ where: { siteId } }),
    { label: `current published state ${siteId}` }
  );
  if (!row) throw new Error("current_published_state_missing");
  if (currentPublishedContentHash(row.payload) !== row.contentHash) {
    throw new Error("current_published_state_hash_mismatch");
  }
  return toSitePublishedState(row);
}

export async function compileCandidatePublishedStateRelational(siteId: string) {
  const payload = await compileCurrentPublishedPayloadRelational(siteId);
  if (publicationSnapshotIntegrity(payload) !== "valid") {
    throw new Error("current_published_candidate_invalid");
  }
  const contentHash = currentPublishedContentHash(payload);
  return { payload, contentHash, revision: currentPublishedRevision(siteId, contentHash) };
}

export type PublishCurrentStateParams = {
  siteId: string;
  actor: string;
  approvalId: string;
  target: string;
  databaseIdentity: string;
  verifiedBackupReceipt: VerifiedBackupReceipt;
};

export async function publishCurrentStateRelational(params: PublishCurrentStateParams): Promise<{
  state: SitePublishedState;
  noOp: boolean;
  verifiedBackupReceipt: VerifiedBackupReceipt;
}> {
  const receipt = assertVerifiedBackupReceipt(params.verifiedBackupReceipt, {
    target: params.target,
    databaseIdentity: params.databaseIdentity
  });
  const candidate = await compileCandidatePublishedStateRelational(params.siteId);

  return runPrismaWriteWithReconnect(async () => {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Site" WHERE "id" = ${params.siteId} FOR UPDATE`;
      const approval = await tx.themePublishApproval.findUnique({ where: { id: params.approvalId } });
      if (!approval || approval.siteId !== params.siteId || approval.status !== "approved" || !approval.approvedBy || !approval.approvedAt || approval.consumedAt || (approval.expiresAt && approval.expiresAt <= new Date())) {
        throw new Error("current_published_approval_unavailable");
      }
      const current = await tx.sitePublishedState.findUnique({ where: { siteId: params.siteId } });
      if (current && current.contentHash === candidate.contentHash) {
        return { row: current, noOp: true };
      }

      const row = await tx.sitePublishedState.upsert({
        where: { siteId: params.siteId },
        create: {
          siteId: params.siteId,
          payload: candidate.payload as unknown as Prisma.InputJsonValue,
          contentHash: candidate.contentHash,
          revision: candidate.revision,
          publishedBy: params.actor
        },
        update: {
          payload: candidate.payload as unknown as Prisma.InputJsonValue,
          contentHash: candidate.contentHash,
          revision: candidate.revision,
          publishedBy: params.actor
        }
      });
      const consumed = await tx.themePublishApproval.updateMany({
        where: { id: params.approvalId, siteId: params.siteId, status: "approved", consumedAt: null },
        data: {
          status: "consumed",
          consumedAt: new Date(),
          consumedPublicationId: `current_${params.siteId}_${candidate.revision}`
        }
      });
      if (consumed.count !== 1) throw new Error("current_published_approval_already_consumed");
      return { row, noOp: false };
    }, { timeout: 120000 });

    const state = toSitePublishedState(result.row);
    if (state.contentHash !== candidate.contentHash || state.revision !== candidate.revision) {
      throw new Error("current_published_state_readback_mismatch");
    }
    return { state, noOp: result.noOp, verifiedBackupReceipt: receipt };
  }, { label: `publish current state ${params.siteId}` });
}
