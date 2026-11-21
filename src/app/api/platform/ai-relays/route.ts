import { NextRequest, NextResponse } from "next/server";
import { getCurrentPlatformAdmin, requirePlatformMutation } from "@/lib/api-auth";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { fetchRelayModelList } from "@/lib/relay-model-list";
import { splitRelayModelsByVisibility } from "@/lib/relay-model-catalog";
import {
  deletePlatformAiRelayRelational,
  getPlatformAiRelayOverviewRelational,
  getPlatformAiRelayRelational,
  markPlatformAiRelaySyncFailedRelational,
  planPlatformAiRelaySyncRelational,
  syncPlatformAiRelayModelsRelational,
  upsertPlatformAiRelayRelational
} from "@/lib/stores/ai-relay-store";
import { maskAiProviderKey } from "@/lib/ai-provider-config";
import type { PlatformAiRelay } from "@/lib/types";

async function requirePlatformRead() {
  const current = await getCurrentPlatformAdmin();
  if (!current) return { ok: false as const, response: NextResponse.json({ error: "platform_login_required" }, { status: 401 }) };
  return { ok: true as const, current };
}

function relayPayload(relay: PlatformAiRelay) {
  return {
    id: relay.id,
    label: relay.label,
    baseUrl: relay.baseUrl,
    apiKeyPreview: maskAiProviderKey(relay.apiKey),
    apiKeyConfigured: Boolean(relay.apiKey?.trim()),
    protocol: relay.protocol,
    enabled: relay.enabled,
    lastSyncedAt: relay.lastSyncedAt,
    lastSyncStatus: relay.lastSyncStatus,
    lastSyncError: relay.lastSyncError,
    lastSyncModelCount: relay.lastSyncModelCount,
    createdAt: relay.createdAt,
    updatedAt: relay.updatedAt,
    updatedBy: relay.updatedBy
  };
}

export async function GET() {
  const permission = await requirePlatformRead();
  if (!permission.ok) return permission.response;
  return NextResponse.json(await getPlatformAiRelayOverviewRelational());
}

export async function PUT(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], rateLimit: RATE_LIMITS.adminProviderConfig });
  if (!permission.ok) return permission.response;
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    label?: string;
    baseUrl?: string;
    apiKey?: string;
    enabled?: boolean;
  };
  if (!body.label?.trim()) return NextResponse.json({ error: "missing_ai_relay_label" }, { status: 400 });
  if (!body.baseUrl?.trim()) return NextResponse.json({ error: "missing_ai_relay_url" }, { status: 400 });
  let parsed: URL;
  try {
    parsed = new URL(body.baseUrl.trim());
  } catch {
    return NextResponse.json({ error: "invalid_ai_relay_url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json({ error: "invalid_ai_relay_url" }, { status: 400 });
  }
  if (body.id) {
    const existing = await getPlatformAiRelayRelational(body.id);
    if (!existing) return NextResponse.json({ error: "ai_relay_not_found" }, { status: 404 });
    if (!body.apiKey?.trim() && !existing.apiKey) {
      return NextResponse.json({ error: "missing_ai_relay_api_key" }, { status: 400 });
    }
  } else if (!body.apiKey?.trim()) {
    return NextResponse.json({ error: "missing_ai_relay_api_key" }, { status: 400 });
  }
  const relay = await upsertPlatformAiRelayRelational({
    id: body.id,
    label: body.label.trim(),
    baseUrl: body.baseUrl.trim(),
    apiKey: body.apiKey?.trim() || undefined,
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    actor: permission.current.platformAdmin.id
  });
  return NextResponse.json({ ok: true, relay: relayPayload(relay) });
}

export async function POST(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], rateLimit: RATE_LIMITS.adminProviderConfig });
  if (!permission.ok) return permission.response;
  const body = (await request.json().catch(() => ({}))) as {
    action?: "sync" | "preview" | "reveal";
    relayId?: string;
  };
  const relayId = body.relayId?.trim();
  if (!relayId) return NextResponse.json({ error: "missing_ai_relay" }, { status: 400 });
  const relay = await getPlatformAiRelayRelational(relayId);
  if (!relay) return NextResponse.json({ error: "ai_relay_not_found" }, { status: 404 });

  if (body.action === "reveal") {
    return NextResponse.json({ ok: true, relayId: relay.id, apiKey: relay.apiKey ?? "" });
  }

  const listing = await fetchRelayModelList({ baseUrl: relay.baseUrl, apiKey: relay.apiKey });
  if (!listing.ok) {
    await markPlatformAiRelaySyncFailedRelational({ relayId: relay.id, error: listing.message, actor: permission.current.platformAdmin.id });
    return NextResponse.json({ error: "ai_relay_model_list_failed", message: listing.message }, { status: 502 });
  }
  // 只同步上游公开的模型：内部变体（-15s、workflow、dola-* 等）不进入平台目录，
  // 并在预览里逐条列出，避免把隐藏的视频模型当成正式通道。
  const { visible, hidden } = splitRelayModelsByVisibility(listing.models);
  if (!visible.length) {
    const message = "上游目录只返回隐藏模型，已跳过本次同步。";
    await markPlatformAiRelaySyncFailedRelational({ relayId: relay.id, error: message, actor: permission.current.platformAdmin.id });
    return NextResponse.json({ error: "ai_relay_only_hidden_models", message, hidden }, { status: 422 });
  }

  const plan = await planPlatformAiRelaySyncRelational({ relayId: relay.id, models: visible });
  const hiddenNote = hidden.length ? `，跳过 ${hidden.length} 个隐藏模型` : "";
  if (body.action === "preview") {
    return NextResponse.json({ ok: true, plan, hidden, message: `${listing.message}${hiddenNote}` });
  }

  const applied = await syncPlatformAiRelayModelsRelational({
    relayId: relay.id,
    entries: plan.entries,
    actor: permission.current.platformAdmin.id
  });
  // 同步结果直接带回最新总览，前端不再追加一次 GET（远程访问下每次往返都要 1 秒上下）。
  const overview = await getPlatformAiRelayOverviewRelational();
  return NextResponse.json({
    ok: true,
    message: `同步完成：新增 ${applied.created}，更新 ${applied.updated}，移除 ${applied.removed}，未变 ${applied.unchanged}${hiddenNote}`,
    plan,
    hidden,
    applied,
    relays: overview.relays,
    providers: overview.providers
  });
}

export async function DELETE(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], rateLimit: RATE_LIMITS.adminProviderConfig });
  if (!permission.ok) return permission.response;
  const body = (await request.json().catch(() => ({}))) as { relayId?: string };
  const relayId = body.relayId?.trim();
  if (!relayId) return NextResponse.json({ error: "missing_ai_relay" }, { status: 400 });
  try {
    const relay = await deletePlatformAiRelayRelational({ relayId, actor: permission.current.platformAdmin.id });
    return NextResponse.json({ ok: true, relay: relayPayload(relay) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ai_relay_delete_failed";
    return NextResponse.json({ error: message }, { status: message === "ai_relay_not_found" ? 404 : 400 });
  }
}
