import { NextRequest, NextResponse } from "next/server";
import { aiProviderStatus, assertValidAiProviderUrl, testAiProviderConnection } from "@/lib/ai-provider-config";
import { getCurrentPlatformAdmin, requirePlatformMutation } from "@/lib/api-auth";
import { createAsyncJob, toAsyncJobAcceptedPayload } from "@/lib/async-jobs";
import { StoreError } from "@/lib/server-store";
import {
  deletePlatformAiProviderRelational,
  getPlatformAiProviderRelational,
  listPlatformAiProvidersRelational,
  setCurrentPlatformAiProviderRelational,
  setPlatformAiProviderEnabledRelational,
  upsertPlatformAiProviderRelational
} from "@/lib/stores/platform-store";
import type { PlatformAiProvider } from "@/lib/types";
import { inferPlatformAiProviderType, normalizePlatformAiProviderType, platformAiProviderTypes, type PlatformAiProviderType } from "@/lib/ai-provider-type";

const defaultModelTypes = [
  "gpt-image-2",
  "gpt-5.5",
  "grok-video-3-pro",
  "grok-video-3-max",
  "grok-imagine-video",
  "grok-imagine-video-1.5-preview",
  "grok-imagine-video-1.5",
  "grok-video-3.5-1015"
];

async function requirePlatformRead() {
  const current = await getCurrentPlatformAdmin();
  if (!current) return { ok: false as const, response: NextResponse.json({ error: "platform_login_required" }, { status: 401 }) };
  return { ok: true as const, current };
}

async function payload(extra: Record<string, unknown> = {}) {
  const providers = await listPlatformAiProvidersRelational();
  const enabledProviders = providers.filter((provider) => provider.enabled);
  const currentProviderIds = Object.fromEntries(platformAiProviderTypes.map((providerType) => {
    const typed = enabledProviders.filter((provider) => provider.providerType === providerType);
    const current = typed.find((provider) => provider.preferred) ?? typed[0];
    return [providerType, current?.id ?? ""];
  })) as Record<PlatformAiProviderType, string>;
  const current = enabledProviders.find((provider) => provider.id === currentProviderIds.image) ?? enabledProviders[0];
  const summaryForType = (providerType: PlatformAiProviderType) => {
    const typed = providers.filter((provider) => provider.providerType === providerType);
    const enabledTyped = typed.filter((provider) => provider.enabled);
    const currentTyped = enabledTyped.find((provider) => provider.id === currentProviderIds[providerType]);
    return {
      totalProviders: typed.length,
      enabledProviders: enabledTyped.length,
      configuredProviders: typed.filter((provider) => aiProviderStatus(provider).configured).length,
      runnableProviders: typed.filter((provider) => aiProviderStatus(provider).runnable).length,
      currentProviderId: currentTyped?.id ?? "",
      currentConfigured: aiProviderStatus(currentTyped).runnable
    };
  };
  return {
    ok: true,
    currentProviderId: current?.id ?? "",
    currentProviderIds,
    modelTypes: Array.from(new Set([...defaultModelTypes, ...providers.map((provider) => provider.modelType).filter(Boolean)])),
    providers: providers.map((provider) => ({
      id: provider.id,
      label: provider.label,
      aiUrl: provider.aiUrl,
      modelType: provider.modelType,
      providerType: provider.providerType,
      priority: provider.priority,
      preferred: provider.preferred,
      enabled: provider.enabled,
      supportsGenerationN: provider.supportsGenerationN,
      supportsEditN: provider.supportsEditN,
      maxImagesPerRequest: provider.maxImagesPerRequest,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
      updatedBy: provider.updatedBy,
      isCurrent: provider.id === currentProviderIds[provider.providerType],
      status: aiProviderStatus(provider)
    })),
    summary: {
      totalProviders: providers.length,
      enabledProviders: enabledProviders.length,
      configuredProviders: providers.filter((provider) => aiProviderStatus(provider).configured).length,
      runnableProviders: providers.filter((provider) => aiProviderStatus(provider).runnable).length,
      currentConfigured: aiProviderStatus(current).runnable,
      byType: Object.fromEntries(platformAiProviderTypes.map((providerType) => [providerType, summaryForType(providerType)]))
    },
    ...extra
  };
}

async function providerFromBody(body: { id?: string; aiUrl?: string; apiKey?: string }): Promise<Pick<PlatformAiProvider, "aiUrl" | "apiKey">> {
  const existing = await getPlatformAiProviderRelational(body.id);
  if (!body.aiUrl?.trim()) throw new Error("missing_ai_provider_url");
  return {
    aiUrl: body.aiUrl,
    apiKey: body.apiKey?.trim() || existing?.apiKey || undefined
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
    providerType?: string;
    makeCurrent?: boolean;
    enabled?: boolean;
    supportsGenerationN?: boolean;
    supportsEditN?: boolean;
    maxImagesPerRequest?: number;
  };
  if (!body.label?.trim()) return NextResponse.json({ error: "missing_ai_provider_label" }, { status: 400 });
  if (!body.id && !body.aiUrl?.trim()) return NextResponse.json({ error: "missing_ai_provider_url" }, { status: 400 });
  if (!body.modelType?.trim()) return NextResponse.json({ error: "missing_ai_provider_model_type" }, { status: 400 });
  if (body.aiUrl?.trim()) {
    try {
      assertValidAiProviderUrl(body.aiUrl);
    } catch {
      return NextResponse.json({ error: "invalid_ai_provider_url" }, { status: 400 });
    }
  }

  await upsertPlatformAiProviderRelational({
    id: body.id,
    label: body.label,
    aiUrl: body.aiUrl ?? "",
    apiKey: body.apiKey,
    modelType: body.modelType,
    providerType: normalizePlatformAiProviderType(body.providerType, inferPlatformAiProviderType({ label: body.label, aiUrl: body.aiUrl, modelType: body.modelType })),
    makeCurrent: body.makeCurrent,
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    supportsGenerationN: Boolean(body.supportsGenerationN),
    supportsEditN: Boolean(body.supportsEditN),
    maxImagesPerRequest: body.maxImagesPerRequest,
    actor: permission.current.platformAdmin.id
  });
  return NextResponse.json(await payload());
}

export async function POST(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: "platform:ai-provider" });
  if (!permission.ok) return permission.response;

  const body = (await request.json().catch(() => ({}))) as {
    action?: "current" | "test" | "enabled";
    providerId?: string;
    enabled?: boolean;
    id?: string;
    aiUrl?: string;
    apiKey?: string;
  };
  try {
    if (body.action === "test") {
      const provider = await providerFromBody(body);
      const job = await createAsyncJob({
        kind: "ai_provider_test",
        actorId: permission.current.platformAdmin.id,
        metadata: {
          providerId: body.providerId ?? body.id ?? "",
          aiUrl: provider.aiUrl,
          hasApiKey: Boolean(provider.apiKey)
        },
        ttlMs: 10 * 60 * 1000,
        run: async () => testAiProviderConnection(provider)
      });
      return NextResponse.json(toAsyncJobAcceptedPayload(job), { status: 202 });
    }
    if (!body.providerId) return NextResponse.json({ error: "missing_ai_provider" }, { status: 400 });
    if (body.action === "enabled") {
      await setPlatformAiProviderEnabledRelational({
        providerId: body.providerId,
        enabled: body.enabled !== false,
        actor: permission.current.platformAdmin.id
      });
      return NextResponse.json(await payload());
    }
    await setCurrentPlatformAiProviderRelational({ providerId: body.providerId, actor: permission.current.platformAdmin.id });
    return NextResponse.json(await payload());
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "ai_provider_action_failed" }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: "platform:ai-provider" });
  if (!permission.ok) return permission.response;

  const body = (await request.json().catch(() => ({}))) as { providerId?: string };
  const providerId = body.providerId?.trim() || new URL(request.url).searchParams.get("providerId")?.trim();
  if (!providerId) return NextResponse.json({ error: "missing_ai_provider" }, { status: 400 });

  try {
    await deletePlatformAiProviderRelational({ providerId, actor: permission.current.platformAdmin.id });
    return NextResponse.json(await payload());
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "ai_provider_delete_failed" }, { status });
  }
}
