import "server-only";

import { prisma } from "@/lib/prisma";
import type { PlatformAiProvider, PlatformCloudflareAccount, PlatformEmailSettings, Site } from "@/lib/types";

import {
  addAuditLogRelational,
  RelationalStoreError,
  toPlatformAiProvider,
  toPlatformCloudflareAccount,
  toPlatformEmailSettings,
  toSite,
  uid
} from "./prisma-mappers";

export async function getPlatformOverviewRelational(): Promise<{
  sites: Site[];
  platformEmailSettings?: PlatformEmailSettings;
  platformCloudflareAccounts: PlatformCloudflareAccount[];
  currentCloudflareAccountId?: string;
  platformAiProviders: PlatformAiProvider[];
  currentAiProviderId?: string;
}> {
  const [sites, emailSettings, cloudflareAccounts, aiProviders] = await Promise.all([
    prisma.site.findMany({
      orderBy: { createdAt: "asc" },
      include: { domains: true, pages: true, settings: true, connect: true }
    }),
    prisma.platformEmailSettings.findUnique({ where: { id: "platform_email_settings" } }),
    prisma.platformCloudflareAccount.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.platformAiProvider.findMany({ orderBy: [{ preferred: "desc" }, { priority: "asc" }] })
  ]);
  const preferredProvider = aiProviders.find((provider) => provider.preferred);
  return {
    sites: sites.map(toSite),
    platformEmailSettings: emailSettings ? toPlatformEmailSettings(emailSettings) : undefined,
    platformCloudflareAccounts: cloudflareAccounts.map(toPlatformCloudflareAccount),
    currentCloudflareAccountId: cloudflareAccounts[0]?.id,
    platformAiProviders: aiProviders.map(toPlatformAiProvider),
    currentAiProviderId: preferredProvider?.id
  };
}

export async function updatePlatformEmailSettingsRelational(params: {
  apiKey?: string;
  fromEmail?: string;
  replyTo?: string;
  actor?: string;
}): Promise<PlatformEmailSettings> {
  const current = await prisma.platformEmailSettings.findUnique({ where: { id: "platform_email_settings" } });
  const settingsRecord = await prisma.platformEmailSettings.upsert({
    where: { id: "platform_email_settings" },
    create: {
      provider: "resend",
      apiKey: params.apiKey?.trim() || undefined,
      fromEmail: params.fromEmail?.trim() || undefined,
      replyTo: params.replyTo?.trim() || undefined,
      updatedBy: params.actor
    },
    update: {
      apiKey: params.apiKey?.trim() || current?.apiKey,
      fromEmail: params.fromEmail?.trim() ?? current?.fromEmail,
      replyTo: params.replyTo?.trim() ?? current?.replyTo,
      updatedBy: params.actor
    }
  });
  const settings = toPlatformEmailSettings(settingsRecord);
  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: "platform_email_settings_updated",
    targetType: "platform_email_settings",
    targetId: "resend",
    metadata: {
      fromEmailConfigured: Boolean(settings.fromEmail),
      replyToConfigured: Boolean(settings.replyTo),
      apiKeyUpdated: Boolean(params.apiKey?.trim())
    }
  });
  return settings;
}

export async function upsertPlatformCloudflareAccountRelational(params: {
  id?: string;
  label: string;
  email: string;
  accountId: string;
  apiToken?: string;
  makeCurrent?: boolean;
  actor?: string;
}): Promise<PlatformCloudflareAccount> {
  const accountId = params.accountId.trim();
  const existing = params.id
    ? await prisma.platformCloudflareAccount.findUnique({ where: { id: params.id } })
    : await prisma.platformCloudflareAccount.findFirst({ where: { accountId } });
  const accountRecord = existing
    ? await prisma.platformCloudflareAccount.update({
        where: { id: existing.id },
        data: {
          label: params.label.trim(),
          email: params.email.trim().toLowerCase(),
          accountId,
          apiToken: params.apiToken?.trim() || existing.apiToken,
          updatedBy: params.actor
        }
      })
    : await prisma.platformCloudflareAccount.create({
        data: {
          id: params.id ?? uid("cf"),
          label: params.label.trim(),
          email: params.email.trim().toLowerCase(),
          accountId,
          apiToken: params.apiToken?.trim() || "",
          updatedBy: params.actor
        }
      });
  const account = toPlatformCloudflareAccount(accountRecord);
  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: "platform_cloudflare_account_upserted",
    targetType: "platform_cloudflare_account",
    targetId: account.id,
    metadata: {
      label: account.label,
      email: account.email,
      accountIdConfigured: Boolean(account.accountId),
      apiTokenUpdated: Boolean(params.apiToken?.trim())
    }
  });
  return account;
}

export async function upsertPlatformAiProviderRelational(params: {
  id?: string;
  label: string;
  aiUrl: string;
  apiKey?: string;
  modelType: string;
  makeCurrent?: boolean;
  actor?: string;
}): Promise<PlatformAiProvider> {
  const existing = params.id ? await prisma.platformAiProvider.findUnique({ where: { id: params.id } }) : null;
  const providerCount = await prisma.platformAiProvider.count();
  const shouldPrefer = Boolean(params.makeCurrent || providerCount === 0);
  const providerRecord = await prisma.$transaction(async (tx) => {
    if (shouldPrefer) await tx.platformAiProvider.updateMany({ data: { preferred: false } });
    return existing
      ? tx.platformAiProvider.update({
          where: { id: existing.id },
          data: {
            label: params.label.trim(),
            aiUrl: params.aiUrl.trim(),
            apiKey: params.apiKey?.trim() || existing.apiKey,
            modelType: params.modelType.trim(),
            preferred: shouldPrefer || existing.preferred,
            updatedBy: params.actor
          }
        })
      : tx.platformAiProvider.create({
          data: {
            id: uid("aiprov"),
            label: params.label.trim(),
            aiUrl: params.aiUrl.trim(),
            apiKey: params.apiKey?.trim() || undefined,
            modelType: params.modelType.trim(),
            priority: providerCount + 1,
            preferred: shouldPrefer,
            updatedBy: params.actor
          }
        });
  });
  const provider = toPlatformAiProvider(providerRecord);
  if (!provider.label || !provider.aiUrl || !provider.modelType) throw new RelationalStoreError("invalid_ai_provider", 400);
  return provider;
}
