import { NextRequest, NextResponse } from "next/server";
import { aiProviderStatus, assertValidAiProviderUrl, testAiProviderConnection } from "@/lib/ai-provider-config";
import { getCurrentPlatformAdmin, requirePlatformMutation } from "@/lib/api-auth";
import {
  StoreError
} from "@/lib/server-store";
import {
  getPlatformOverviewRelational,
  setCurrentPlatformAiProviderRelational,
  upsertPlatformAiProviderRelational
} from "@/lib/stores/platform-store";
import type { PlatformAiProvider } from "@/lib/types";

const defaultModelTypes = ["gpt-image-2", "gpt-5.5"];

async function requirePlatformRead() {
  const current = await getCurrentPlatformAdmin();
  if (!current) return { ok: false as const, response: NextResponse.json({ error: "platform_login_required" }, { status: 401 }) };
  return { ok: true as const, current };
}

async function payload(extra: Record<string, unknown> = {}) {
  const overview = await getPlatformOverviewRelational();
  const providers = overview.platformAiProviders ?? [];
  const current = providers.find((provider) => provider.id === overview.currentAiProviderId) ?? providers[0];
  return {
    ok: true,
    currentProviderId: current?.id ?? "",
    modelTypes: Array.from(new Set([...defaultModelTypes, ...providers.map((provider) => provider.modelType).filter(Boolean)])),
    providers: providers.map((provider) => ({
      id: provider.id,
      label: provider.label,
      aiUrl: provider.aiUrl,
      modelType: provider.modelType,
      priority: provider.priority,
      preferred: provider.preferred,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
      updatedBy: provider.updatedBy,
      isCurrent: provider.id === current?.id,
      status: aiProviderStatus(provider)
    })),
    summary: {
      totalProviders: providers.length,
      configuredProviders: providers.filter((provider) => aiProviderStatus(provider).configured).length,
      currentConfigured: aiProviderStatus(current).configured
    },
    ...extra
  };
}

async function providerFromBody(body: { id?: string; aiUrl?: string; apiKey?: string }): Promise<Pick<PlatformAiProvider, "aiUrl" | "apiKey">> {
  const overview = await getPlatformOverviewRelational();
  const existing = body.id ? (overview.platformAiProviders ?? []).find((provider) => provider.id === body.id) : undefined;
  if (!body.aiUrl?.trim()) throw new Error("missing_ai_provider_url");
  return {
    aiUrl: body.aiUrl,
    apiKey: body.apiKey?.trim() || existing?.apiKey
  };
}

export async function GET() {
  const permission = await requirePlatformRead();
  if (!permission.ok) return permission.response;
  return NextResponse.json(await payload());
}

export async function PUT(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: "platform:ai-provider" });
  if (!permission.ok) return permission.response;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    label?: string;
    aiUrl?: string;
    apiKey?: string;
    modelType?: string;
    makeCurrent?: boolean;
  };
  if (!body.label?.trim()) return NextResponse.json({ error: "missing_ai_provider_label" }, { status: 400 });
  if (!body.aiUrl?.trim()) return NextResponse.json({ error: "missing_ai_provider_url" }, { status: 400 });
  if (!body.modelType?.trim()) return NextResponse.json({ error: "missing_ai_provider_model_type" }, { status: 400 });
  try {
    assertValidAiProviderUrl(body.aiUrl);
  } catch {
    return NextResponse.json({ error: "invalid_ai_provider_url" }, { status: 400 });
  }

  await upsertPlatformAiProviderRelational({
    id: body.id,
    label: body.label,
    aiUrl: body.aiUrl,
    apiKey: body.apiKey,
    modelType: body.modelType,
    makeCurrent: body.makeCurrent,
    actor: permission.current.platformAdmin.id
  });
  return NextResponse.json(await payload());
}

export async function POST(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: "platform:ai-provider" });
  if (!permission.ok) return permission.response;

  const body = (await request.json().catch(() => ({}))) as {
    action?: "current" | "test";
    providerId?: string;
    id?: string;
    aiUrl?: string;
    apiKey?: string;
  };
  try {
    if (body.action === "test") {
      const result = await testAiProviderConnection(await providerFromBody(body));
      return NextResponse.json(await payload({ test: result }));
    }
    if (!body.providerId) return NextResponse.json({ error: "missing_ai_provider" }, { status: 400 });
    await setCurrentPlatformAiProviderRelational({ providerId: body.providerId, actor: permission.current.platformAdmin.id });
    return NextResponse.json(await payload());
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "ai_provider_action_failed" }, { status });
  }
}
