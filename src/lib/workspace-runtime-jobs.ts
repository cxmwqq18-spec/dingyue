import "server-only";

import { prisma } from "@/lib/prisma";
import type { ThemeRuntimeData } from "@/lib/types";
import { DEFAULT_VIDEO_MODEL_FAMILY } from "@/lib/video-frame-config";

export const WORKSPACE_RELATED_JOB_SUMMARY_LIMIT = 8;
export const WORKSPACE_VIDEO_FRAME_ASSET_LIMIT = 200;

type RuntimeJob = ThemeRuntimeData["jobs"][number];
type WorkspaceJobSummaryRow = {
  id: string;
  aiAppId: string;
  status: string;
  creditsReserved: number;
  createdAt: Date;
  updatedAt: Date;
  requestJson?: unknown;
  resultJson?: unknown;
};

function numberFromRaw(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isoFromRaw(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  return new Date(0).toISOString();
}

function jsonRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function runtimeJobFromWorkspaceSummaryRow(job: WorkspaceJobSummaryRow): RuntimeJob {
  const isVideo = job.aiAppId.toLowerCase().includes("video");
  const outputType = isVideo ? "video" : "image";
  const title = isVideo ? "Prompt Directed Motion" : "AI generation";
  const slotStatus = job.status === "succeeded" || job.status === "failed" || job.status === "running" || job.status === "queued"
    ? job.status
    : "queued";
  const fallbackRequestJson = {
    mode: outputType,
    outputType,
    fields: {
      mode: outputType,
      outputType,
      videoThemeName: title,
      ...(isVideo ? {
        videoModelFamily: DEFAULT_VIDEO_MODEL_FAMILY,
        modelFamily: DEFAULT_VIDEO_MODEL_FAMILY,
        videoThemeCategoryLabel: title,
        videoThemeCategorySlug: "prompt-directed-motion"
      } : {}),
      outputCount: 1
    },
    billing: {
      outputCount: 1
    }
  };
  const persistedRequestJson = jsonRecord(job.requestJson);
  const fallbackResultJson = {
    ...(job.status === "failed" ? { error: isVideo ? "ai_provider_video_failed" : "generation_failed" } : {}),
    outputSlots: [
      {
        index: 1,
        status: slotStatus,
        stage: job.status === "succeeded" ? "provider_response_received" : undefined,
        updatedAt: isoFromRaw(job.updatedAt)
      }
    ]
  };
  const persistedResultJson = jsonRecord(job.resultJson);
  return {
    id: String(job.id),
    aiAppId: String(job.aiAppId),
    status: String(job.status) as RuntimeJob["status"],
    creditsReserved: numberFromRaw(job.creditsReserved),
    createdAt: isoFromRaw(job.createdAt),
    updatedAt: isoFromRaw(job.updatedAt),
    requestJson: {
      ...fallbackRequestJson,
      ...persistedRequestJson,
      fields: {
        ...fallbackRequestJson.fields,
        ...jsonRecord(persistedRequestJson?.fields)
      },
      billing: {
        ...fallbackRequestJson.billing,
        ...jsonRecord(persistedRequestJson?.billing)
      }
    },
    resultJson: {
      ...fallbackResultJson,
      ...persistedResultJson,
      outputSlots: Array.isArray(persistedResultJson?.outputSlots)
        ? persistedResultJson.outputSlots
        : fallbackResultJson.outputSlots
    }
  };
}

export async function readWorkspaceJobSummariesRelational({
  customerId,
  includeJson = true,
  ids,
  siteId,
  take
}: {
  customerId: string;
  includeJson?: boolean;
  ids?: string[];
  siteId: string;
  take?: number;
}): Promise<RuntimeJob[]> {
  const rows = await prisma.generationJob.findMany({
    where: {
      siteId,
      customerId,
      ...(ids?.length ? { id: { in: ids } } : {})
    },
    orderBy: { updatedAt: "desc" },
    ...(take ? { take } : {}),
    select: {
      id: true,
      aiAppId: true,
      status: true,
      creditsReserved: true,
      createdAt: true,
      updatedAt: true,
      ...(includeJson ? { requestJson: true, resultJson: true } : {})
    }
  });
  return (rows as WorkspaceJobSummaryRow[]).map(runtimeJobFromWorkspaceSummaryRow);
}
