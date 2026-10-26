import "server-only";

import { prisma, runPrismaReadWithReconnect } from "@/lib/prisma";
import type { RelayModelClassification } from "@/lib/relay-model-catalog";
import { normalizeAiProviderProtocol } from "@/lib/video-provider-family";
import { addAuditLogRelational, relationalUid, toPlatformAiProvider } from "./prisma-mappers";
import type { PlatformAiProvider, PlatformAiRelay } from "@/lib/types";
import { clearPlatformReadCache } from "./platform-store";

const relayTransactionOptions = {
  maxWait: Number(process.env.PLATFORM_AI_RELAY_TX_MAX_WAIT_MS ?? 10_000),
  timeout: Number(process.env.PLATFORM_AI_RELAY_TX_TIMEOUT_MS ?? 30_000)
} as const;

function toPlatformAiRelay(record: {
  id: string;
  label: string;
  baseUrl: string;
  apiKey?: string | null;
  protocol: string;
  enabled: boolean;
  lastSyncedAt?: Date | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
  lastSyncModelCount: number;
  updatedBy?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): PlatformAiRelay {
  return {
    id: record.id,
    label: record.label,
    baseUrl: record.baseUrl,
    apiKey: record.apiKey ?? undefined,
    protocol: "newapi",
    enabled: record.enabled,
    lastSyncedAt: record.lastSyncedAt ? new Date(record.lastSyncedAt).toISOString() : undefined,
    lastSyncStatus: record.lastSyncStatus === "succeeded" ? "succeeded" : record.lastSyncStatus === "failed" ? "failed" : undefined,
    lastSyncError: record.lastSyncError ?? undefined,
    lastSyncModelCount: record.lastSyncModelCount ?? 0,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
    updatedBy: record.updatedBy ?? undefined
  };
}

export async function listPlatformAiRelaysRelational(): Promise<PlatformAiRelay[]> {
  const records = await runPrismaReadWithReconnect(
    () => prisma.platformAiRelay.findMany({ orderBy: [{ enabled: "desc" }, { createdAt: "asc" }] }),
    { label: "platform AI relays list" }
  );
  return records.map(toPlatformAiRelay);
}

export async function getPlatformAiRelayRelational(relayId?: string): Promise<PlatformAiRelay | undefined> {
  if (!relayId) return undefined;
  const record = await runPrismaReadWithReconnect(
    () => prisma.platformAiRelay.findUnique({ where: { id: relayId } }),
    { label: "platform AI relay lookup" }
  );
  return record ? toPlatformAiRelay(record) : undefined;
}

export async function upsertPlatformAiRelayRelational(params: {
  id?: string;
  label: string;
  baseUrl: string;
  apiKey?: string;
  enabled?: boolean;
  actor?: string;
}): Promise<PlatformAiRelay> {
  const existing = params.id ? await prisma.platformAiRelay.findUnique({ where: { id: params.id } }) : null;
  const record = await prisma.platformAiRelay.upsert({
    where: { id: params.id ?? relationalUid("airelay") },
    create: {
      id: params.id ?? relationalUid("airelay"),
      label: params.label.trim(),
      baseUrl: params.baseUrl.trim(),
      apiKey: params.apiKey?.trim() || undefined,
      protocol: "newapi",
      enabled: params.enabled ?? true,
      updatedBy: params.actor
    },
    update: {
      label: params.label.trim(),
      baseUrl: params.baseUrl.trim(),
      apiKey: params.apiKey?.trim() || existing?.apiKey || undefined,
      enabled: params.enabled ?? existing?.enabled ?? true,
      updatedBy: params.actor
    }
  });
  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: params.id ? "platform_ai_relay_updated" : "platform_ai_relay_created",
    targetType: "platform_ai_relay",
    targetId: record.id,
    metadata: {
      label: record.label,
      baseUrl: record.baseUrl,
      enabled: record.enabled,
      apiKeyUpdated: Boolean(params.apiKey?.trim())
    }
  });
  clearPlatformReadCache();
  return toPlatformAiRelay(record);
}

export async function deletePlatformAiRelayRelational(params: { relayId: string; actor?: string }): Promise<PlatformAiRelay> {
  const existing = await prisma.platformAiRelay.findUnique({ where: { id: params.relayId } });
  if (!existing) throw new Error("ai_relay_not_found");
  const record = await prisma.$transaction(async (tx) => {
    // 中转被删除后，其同步出来的通道失去归属与凭据来源：
    // 清空密钥并把同步状态改回人工维护，避免留下无来源的凭据和错误的 synced 标记。
    await tx.platformAiProvider.updateMany({
      where: { relayId: params.relayId },
      data: { apiKey: null, syncState: "manual", relayId: null, updatedBy: params.actor }
    });
    return tx.platformAiRelay.delete({ where: { id: params.relayId } });
  }, relayTransactionOptions);
  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: "platform_ai_relay_deleted",
    targetType: "platform_ai_relay",
    targetId: record.id,
    metadata: { label: record.label, baseUrl: record.baseUrl }
  });
  clearPlatformReadCache();
  return toPlatformAiRelay(record);
}

export type RelaySyncPlanEntry = {
  upstreamModelId: string;
  label: string;
  providerType: "image" | "video" | "audio" | "text";
  apiProtocol: string;
  videoModelFamily: "auto" | "grok" | "gemini";
  action: "create" | "update" | "unchanged" | "remove";
  needsReview: boolean;
  reason: string;
  providerId?: string;
};

export type RelaySyncPlan = {
  relayId: string;
  entries: RelaySyncPlanEntry[];
  created: number;
  updated: number;
  unchanged: number;
  removed: number;
};

/**
 * 依据中转目录计算与当前关系数据的差异。
 * 只做计划，不写库；写库由 syncPlatformAiRelayModelsRelational 执行。
 */
export async function planPlatformAiRelaySyncRelational(params: {
  relayId: string;
  models: RelayModelClassification[];
}): Promise<RelaySyncPlan> {
  const relay = await prisma.platformAiRelay.findUnique({ where: { id: params.relayId } });
  if (!relay) throw new Error("ai_relay_not_found");
  const existing = await prisma.platformAiProvider.findMany({ where: { relayId: params.relayId } });
  const existingByModelId = new Map(existing.map((provider) => [provider.upstreamModelId ?? "", provider]));
  const seen = new Set<string>();
  const entries: RelaySyncPlanEntry[] = [];

  for (const model of params.models) {
    seen.add(model.modelId);
    const matched = existingByModelId.get(model.modelId);
    if (matched) {
      // 中转是凭据的权威来源：通道 key 与中转当前 key 不一致即视为需要更新，
      // 保证换 key 后一次同步即可全线统一。中转没有 key 时不回写，避免清空通道凭据。
      const relayKey = relay.apiKey?.trim() ?? "";
      const credentialsChanged = Boolean(relayKey) && matched.apiKey !== relayKey;
      const changed = matched.providerType !== model.capability
        || normalizeAiProviderProtocol(matched.apiProtocol) !== normalizeAiProviderProtocol(model.protocol)
        || (model.capability === "video" && matched.videoModelFamily !== model.modelFamily)
        || credentialsChanged;
      entries.push({
        upstreamModelId: model.modelId,
        label: matched.label,
        providerType: model.capability,
        apiProtocol: model.protocol,
        videoModelFamily: model.modelFamily,
        action: changed ? "update" : "unchanged",
        needsReview: model.needsReview,
        reason: credentialsChanged ? `凭据已同步为当前中转 key；${model.reason}` : model.reason,
        providerId: matched.id
      });
      continue;
    }
    entries.push({
      upstreamModelId: model.modelId,
      label: model.modelId,
      providerType: model.capability,
      apiProtocol: model.protocol,
      videoModelFamily: model.modelFamily,
      action: "create",
      needsReview: model.needsReview,
      reason: model.reason
    });
  }

  for (const provider of existing) {
    const upstreamModelId = provider.upstreamModelId ?? "";
    if (upstreamModelId && seen.has(upstreamModelId)) continue;
    entries.push({
      upstreamModelId,
      label: provider.label,
      providerType: provider.providerType as RelaySyncPlanEntry["providerType"],
      apiProtocol: normalizeAiProviderProtocol(provider.apiProtocol),
      videoModelFamily: provider.videoModelFamily === "grok" || provider.videoModelFamily === "gemini" ? provider.videoModelFamily : "auto",
      action: "remove",
      needsReview: false,
      reason: "上游已下线",
      providerId: provider.id
    });
  }

  return {
    relayId: params.relayId,
    entries,
    created: entries.filter((entry) => entry.action === "create").length,
    updated: entries.filter((entry) => entry.action === "update").length,
    unchanged: entries.filter((entry) => entry.action === "unchanged").length,
    removed: entries.filter((entry) => entry.action === "remove").length
  };
}

export type RelaySyncApplyResult = {
  relayId: string;
  created: number;
  updated: number;
  removed: number;
  unchanged: number;
  providerIds: string[];
};

/**
 * 把同步计划写入关系数据。
 * 语义：新建/更新只覆盖同步拥有的字段（模型 ID、能力类型、协议、模型族、连接地址与密钥）；
 * 人工维护的调度与能力字段（优先级、优先标记、启用状态、时长画幅、参考图上限）一律保留。
 * 上游下线的通道只停用并标记，不删除，避免丢失人工配置与审计线索。
 */
export async function syncPlatformAiRelayModelsRelational(params: {
  relayId: string;
  entries: RelaySyncPlanEntry[];
  actor?: string;
}): Promise<RelaySyncApplyResult> {
  const relay = await prisma.platformAiRelay.findUnique({ where: { id: params.relayId } });
  if (!relay) throw new Error("ai_relay_not_found");

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.platformAiProvider.findMany({ where: { relayId: params.relayId } });
    const existingByModelId = new Map(existing.map((provider) => [provider.upstreamModelId ?? "", provider]));
    const created: string[] = [];
    let updatedCount = 0;
    let removedCount = 0;
    let unchangedCount = 0;

    for (const entry of params.entries) {
      if (entry.action === "remove") {
        const matched = existingByModelId.get(entry.upstreamModelId);
        if (!matched) continue;
        await tx.platformAiProvider.update({
          where: { id: matched.id },
          data: { enabled: false, syncState: "upstream_removed", updatedBy: params.actor }
        });
        removedCount += 1;
        continue;
      }

      if (entry.action === "unchanged") {
        unchangedCount += 1;
        continue;
      }

      const matched = existingByModelId.get(entry.upstreamModelId);
      if (matched) {
        await tx.platformAiProvider.update({
          where: { id: matched.id },
          data: {
            providerType: entry.providerType,
            apiProtocol: entry.apiProtocol,
            videoModelFamily: entry.providerType === "video" ? entry.videoModelFamily : matched.videoModelFamily,
            aiUrl: relay.baseUrl,
            apiKey: relay.apiKey?.trim() || matched.apiKey,
            syncState: "synced",
            updatedBy: params.actor
          }
        });
        updatedCount += 1;
        continue;
      }

      const createdProvider = await tx.platformAiProvider.create({
        data: {
          id: relationalUid("aiprov"),
          label: entry.label,
          aiUrl: relay.baseUrl,
          apiKey: relay.apiKey?.trim() || undefined,
          modelType: entry.upstreamModelId,
          providerType: entry.providerType,
          priority: 0,
          preferred: false,
          enabled: false,
          supportsGenerationN: false,
          supportsEditN: false,
          maxImagesPerRequest: entry.providerType === "image" ? 1 : 1,
          apiProtocol: entry.apiProtocol,
          videoModelFamily: entry.providerType === "video" ? entry.videoModelFamily : "auto",
          videoDurations: [6, 10, 15],
          videoAspectRatios: ["9:16", "1:1", "16:9"],
          videoNativeSpeech: null,
          relayId: relay.id,
          upstreamModelId: entry.upstreamModelId,
          syncState: "synced",
          updatedBy: params.actor
        }
      });
      created.push(createdProvider.id);
    }

    await tx.platformAiRelay.update({
      where: { id: relay.id },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: "succeeded",
        lastSyncError: null,
        lastSyncModelCount: params.entries.filter((entry) => entry.action !== "remove").length,
        updatedBy: params.actor
      }
    });

    return { created: created.length, updated: updatedCount, removed: removedCount, unchanged: unchangedCount, providerIds: created };
  }, relayTransactionOptions);

  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: "platform_ai_relay_models_synced",
    targetType: "platform_ai_relay",
    targetId: params.relayId,
    metadata: {
      label: relay.label,
      baseUrl: relay.baseUrl,
      created: result.created,
      updated: result.updated,
      removed: result.removed,
      unchanged: result.unchanged
    }
  });
  clearPlatformReadCache();
  return { relayId: params.relayId, ...result };
}

export async function markPlatformAiRelaySyncFailedRelational(params: {
  relayId: string;
  error: string;
  actor?: string;
}): Promise<void> {
  await prisma.platformAiRelay.update({
    where: { id: params.relayId },
    data: { lastSyncedAt: new Date(), lastSyncStatus: "failed", lastSyncError: params.error.slice(0, 240), updatedBy: params.actor }
  });
  clearPlatformReadCache();
}

export async function listPlatformAiProvidersByRelayRelational(relayId: string): Promise<PlatformAiProvider[]> {
  const records = await runPrismaReadWithReconnect(
    () => prisma.platformAiProvider.findMany({
      where: { relayId },
      orderBy: [{ providerType: "asc" }, { priority: "asc" }, { label: "asc" }]
    }),
    { label: "platform AI providers by relay" }
  );
  return records.map(toPlatformAiProvider);
}
