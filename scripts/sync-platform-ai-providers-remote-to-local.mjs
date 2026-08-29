#!/usr/bin/env node

import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import {
  assertDatabaseTarget,
  buildTunneledReadonlyDatabaseUrl,
  hasArgument,
} from "./lib/database-target.mjs";

const apply = hasArgument("--apply");
const confirmed = hasArgument("--confirm-local-provider-sync");
const includeSecrets = hasArgument("--include-secrets");
const GPT55_TEXT_PROVIDER_ID = "aiprov_mqqgjg6q_cj0nnr";

function normalizeProviderForLocal(provider) {
  if (provider.id !== GPT55_TEXT_PROVIDER_ID) return provider;

  return {
    ...provider,
    label: "OpenAI 主要",
    modelType: "gpt-5.5",
    providerType: "text",
    priority: 0,
    preferred: true,
    enabled: true,
    supportsGenerationN: false,
    supportsEditN: false,
    maxImagesPerRequest: 1,
    updatedBy: "sync:remote-to-local:gpt55-text-normalization",
  };
}

assertDatabaseTarget({ expectedTarget: "local" });
if (apply && (!confirmed || !includeSecrets)) {
  throw new Error("Applying requires --confirm-local-provider-sync and --include-secrets.");
}

const localUrl = process.env.DATABASE_URL;
const remoteUrl = buildTunneledReadonlyDatabaseUrl(process.env.REMOTE_DB_READONLY_DATABASE_URL);
const local = new PrismaClient({ datasources: { db: { url: localUrl } } });
const remote = new PrismaClient({ datasources: { db: { url: remoteUrl } } });

try {
  const [remoteProviders, targetProviders] = await Promise.all([
    remote.platformAiProvider.findMany({ orderBy: [{ providerType: "asc" }, { priority: "asc" }] }),
    local.platformAiProvider.findMany({ select: { id: true } }),
  ]);
  const sourceProviders = remoteProviders.map(normalizeProviderForLocal);
  if (!sourceProviders.length) throw new Error("Remote read-only source has no platform AI providers.");

  const targetIds = new Set(targetProviders.map((provider) => provider.id));
  const plan = {
    source: "remote-readonly",
    target: "local",
    sourceCount: sourceProviders.length,
    targetCountBefore: targetProviders.length,
    creates: sourceProviders.filter((provider) => !targetIds.has(provider.id)).length,
    updates: sourceProviders.filter((provider) => targetIds.has(provider.id)).length,
    preservedLocalOnly: targetProviders.filter((provider) => !sourceProviders.some((source) => source.id === provider.id)).length,
    rowsWithSecrets: sourceProviders.filter((provider) => Boolean(provider.apiKey)).length,
    apply,
  };
  console.log(JSON.stringify(plan, null, 2));
  if (!apply) process.exitCode = 2;

  if (apply) {
    await local.$transaction(sourceProviders.map((provider) => local.platformAiProvider.upsert({
      where: { id: provider.id },
      create: provider,
      update: {
        label: provider.label,
        aiUrl: provider.aiUrl,
        apiKey: provider.apiKey,
        modelType: provider.modelType,
        providerType: provider.providerType,
        priority: provider.priority,
        preferred: provider.preferred,
        enabled: provider.enabled,
        supportsGenerationN: provider.supportsGenerationN,
        supportsEditN: provider.supportsEditN,
        maxImagesPerRequest: provider.maxImagesPerRequest,
        updatedBy: provider.updatedBy,
      },
    })));

    const targetCountAfter = await local.platformAiProvider.count();
    console.log(JSON.stringify({ ok: true, targetCountAfter, paidProviderCalls: 0 }, null, 2));
  }
} finally {
  await Promise.all([local.$disconnect(), remote.$disconnect()]);
}
