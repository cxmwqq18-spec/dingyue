import "server-only";

import { prisma } from "@/lib/prisma";
import { readPlatformState, writePlatformState } from "@/lib/server-store";
import type { AiGatewayGroup, PlatformAiProvider, PlatformCloudflareAccount, PlatformEmailConfig, PlatformEmailSettings, PublicSiteAdmin, Site, SiteDomain, SiteEmailConfigAssignment } from "@/lib/types";
import { normalizePlatformEmailConfig, normalizeResendApiKey } from "@/lib/resend-email";

import {
  addAuditLogRelational,
  relationalSessionTtlMs,
  relationalUid,
  RelationalStoreError,
  toPlatformSessionRelational,
  toPlatformAiProvider,
  toPlatformCloudflareAccount,
  toPlatformEmailSettings,
  toPublicPlatformAdminRelational,
  toPublicSiteAdminRelational,
  toGatewayGroup,
  toSite,
  toSiteDomain,
  uid,
  verifyRelationalPassword
} from "./prisma-mappers";

export async function createPlatformAdminSessionRelational(params: { email: string; password: string }) {
  const email = params.email.trim().toLowerCase();
  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  if (!admin || !verifyRelationalPassword(params.password, admin.passwordHash)) {
    throw new RelationalStoreError("invalid_platform_credentials", 401);
  }
  const session = await prisma.platformSession.create({
    data: {
      id: relationalUid("psess"),
      platformAdminId: admin.id,
      expiresAt: new Date(Date.now() + relationalSessionTtlMs)
    }
  });
  return {
    platformAdmin: toPublicPlatformAdminRelational(admin),
    session: toPlatformSessionRelational(session)
  };
}

export async function deletePlatformAdminSessionRelational(sessionId: string): Promise<void> {
  await prisma.platformSession.deleteMany({ where: { id: sessionId } });
}

export async function getPlatformAdminBySessionRelational(sessionId?: string) {
  if (!sessionId) return undefined;
  const session = await prisma.platformSession.findFirst({
    where: { id: sessionId, expiresAt: { gt: new Date() } },
    include: { platformAdmin: true }
  });
  if (!session?.platformAdmin) return undefined;
  return {
    platformAdmin: toPublicPlatformAdminRelational(session.platformAdmin),
    session: toPlatformSessionRelational(session)
  };
}

export async function getPlatformOverviewRelational(): Promise<{
  sites: Site[];
  siteDomains: SiteDomain[];
  platformEmailSettings?: PlatformEmailSettings;
  platformEmailConfigs: PlatformEmailConfig[];
  siteEmailConfigAssignments: SiteEmailConfigAssignment[];
  platformCloudflareAccounts: PlatformCloudflareAccount[];
  currentCloudflareAccountId?: string;
  platformAiProviders: PlatformAiProvider[];
  currentAiProviderId?: string;
}> {
  const [sites, siteDomains, emailSettings, cloudflareAccounts, aiProviders] = await Promise.all([
    prisma.site.findMany({
      orderBy: { createdAt: "asc" },
      include: { domains: true, pages: true, settings: true, connect: true }
    }),
    prisma.siteDomain.findMany({ orderBy: [{ siteId: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }] }),
    prisma.platformEmailSettings.findUnique({ where: { id: "platform_email_settings" } }),
    prisma.platformCloudflareAccount.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.platformAiProvider.findMany({ orderBy: [{ preferred: "desc" }, { priority: "asc" }] })
  ]);
  const preferredProvider = aiProviders.find((provider) => provider.preferred);
  const jsonState = readPlatformState();
  const legacyEmailSettings = emailSettings ? toPlatformEmailSettings(emailSettings) : jsonState.platformEmailSettings;
  const platformEmailConfigs = (jsonState.platformEmailConfigs ?? []).map((config) => normalizePlatformEmailConfig(config, legacyEmailSettings));
  if (!platformEmailConfigs.length) {
    platformEmailConfigs.push(normalizePlatformEmailConfig({ id: "resend_default", label: "Default Resend", isDefault: true }, legacyEmailSettings));
  }
  return {
    sites: sites.map(toSite),
    siteDomains: siteDomains.map((domain) => ({
      id: domain.id,
      siteId: domain.siteId,
      domain: domain.domain,
      isPrimary: domain.isPrimary,
      status: domain.status as SiteDomain["status"],
      createdAt: domain.createdAt.toISOString()
    })),
    platformEmailSettings: legacyEmailSettings,
    platformEmailConfigs,
    siteEmailConfigAssignments: jsonState.siteEmailConfigAssignments ?? [],
    platformCloudflareAccounts: cloudflareAccounts.map(toPlatformCloudflareAccount),
    currentCloudflareAccountId: cloudflareAccounts[0]?.id,
    platformAiProviders: aiProviders.map(toPlatformAiProvider),
    currentAiProviderId: preferredProvider?.id
  };
}

export async function getPlatformSitesRelational(): Promise<
  Array<Site & { domains: SiteDomain[]; admins: PublicSiteAdmin[]; gatewayGroups: AiGatewayGroup[] }>
> {
  const sites = await prisma.site.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      domains: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      admins: { orderBy: [{ role: "asc" }, { createdAt: "asc" }] },
      gatewayGroups: { orderBy: [{ status: "asc" }, { name: "asc" }] },
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      connect: true
    }
  });
  return sites.map((site) => ({
    ...toSite(site),
    domains: site.domains.map(toSiteDomain),
    admins: site.admins.map(toPublicSiteAdminRelational),
    gatewayGroups: site.gatewayGroups.map(toGatewayGroup)
  }));
}

export async function updatePlatformEmailSettingsRelational(params: {
  configId?: string;
  label?: string;
  apiKey?: string;
  fromEmail?: string;
  replyTo?: string;
  isDefault?: boolean;
  siteAssignments?: Array<{ siteId: string; configId: string }>;
  actor?: string;
}): Promise<PlatformEmailSettings> {
  const current = await prisma.platformEmailSettings.findUnique({ where: { id: "platform_email_settings" } });
  const nextApiKey = normalizeResendApiKey(params.apiKey);
  const currentApiKey = normalizeResendApiKey(current?.apiKey);
  const jsonState = readPlatformState();
  const legacySettings = current ? toPlatformEmailSettings(current) : jsonState.platformEmailSettings;
  const currentConfigs = (jsonState.platformEmailConfigs ?? []).map((config) => normalizePlatformEmailConfig(config, legacySettings));
  const targetId = params.configId?.trim() || currentConfigs.find((config) => config.isDefault)?.id || currentConfigs[0]?.id || "resend_default";
  const existingConfig = currentConfigs.find((config) => config.id === targetId);
  const updatedConfig = normalizePlatformEmailConfig(
    {
      ...(existingConfig ?? { id: targetId }),
      label: params.label ?? existingConfig?.label,
      apiKey: nextApiKey ?? existingConfig?.apiKey ?? legacySettings?.apiKey,
      fromEmail: params.fromEmail?.trim() ?? existingConfig?.fromEmail ?? legacySettings?.fromEmail,
      replyTo: params.replyTo?.trim() ?? existingConfig?.replyTo ?? legacySettings?.replyTo,
      isDefault: params.isDefault ?? existingConfig?.isDefault ?? !currentConfigs.some((config) => config.isDefault),
      updatedBy: params.actor,
      updatedAt: new Date().toISOString()
    },
    legacySettings
  );
  const nextConfigs = [
    updatedConfig,
    ...currentConfigs.filter((config) => config.id !== targetId)
  ].map((config) => ({
    ...config,
    isDefault: updatedConfig.isDefault ? config.id === updatedConfig.id : config.isDefault
  }));
  if (!nextConfigs.some((config) => config.isDefault)) nextConfigs[0].isDefault = true;
  const validConfigIds = new Set(nextConfigs.map((config) => config.id));
  const nextAssignments = (params.siteAssignments ?? jsonState.siteEmailConfigAssignments ?? [])
    .filter((assignment) => assignment.siteId && validConfigIds.has(assignment.configId))
    .map((assignment) => ({
      siteId: assignment.siteId,
      configId: assignment.configId,
      updatedAt: new Date().toISOString(),
      updatedBy: params.actor
    }));
  writePlatformState({
    ...jsonState,
    platformEmailSettings: {
      provider: "resend",
      apiKey: nextConfigs.find((config) => config.isDefault)?.apiKey,
      fromEmail: nextConfigs.find((config) => config.isDefault)?.fromEmail,
      replyTo: nextConfigs.find((config) => config.isDefault)?.replyTo,
      updatedAt: updatedConfig.updatedAt,
      updatedBy: params.actor
    },
    platformEmailConfigs: nextConfigs,
    siteEmailConfigAssignments: nextAssignments
  });
  const defaultConfig = nextConfigs.find((config) => config.isDefault) ?? updatedConfig;
  const settingsRecord = await prisma.platformEmailSettings.upsert({
    where: { id: "platform_email_settings" },
    create: {
      provider: "resend",
      apiKey: defaultConfig.apiKey,
      fromEmail: defaultConfig.fromEmail,
      replyTo: defaultConfig.replyTo,
      updatedBy: params.actor
    },
    update: {
      apiKey: defaultConfig.apiKey ?? currentApiKey ?? null,
      fromEmail: defaultConfig.fromEmail ?? current?.fromEmail,
      replyTo: defaultConfig.replyTo ?? current?.replyTo,
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
      apiKeyUpdated: Boolean(nextApiKey),
      configId: updatedConfig.id,
      siteAssignmentsUpdated: Boolean(params.siteAssignments)
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

export async function setCurrentPlatformCloudflareAccountRelational(params: {
  accountId: string;
  actor?: string;
}): Promise<PlatformCloudflareAccount> {
  const accountRecord = await prisma.platformCloudflareAccount.findUnique({ where: { id: params.accountId } });
  if (!accountRecord) throw new RelationalStoreError("cloudflare_account_not_found", 404);
  const account = toPlatformCloudflareAccount(
    await prisma.platformCloudflareAccount.update({
      where: { id: params.accountId },
      data: { updatedBy: params.actor }
    })
  );
  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: "platform_cloudflare_current_account_changed",
    targetType: "platform_cloudflare_account",
    targetId: account.id,
    metadata: {
      label: account.label,
      accountId: account.accountId
    }
  });
  return account;
}

export async function clearCurrentPlatformCloudflareAccountRelational(params: {
  accountId?: string;
  actor?: string;
}): Promise<void> {
  if (!params.accountId) return;
  const account = await prisma.platformCloudflareAccount.findUnique({ where: { id: params.accountId } });
  if (!account) throw new RelationalStoreError("cloudflare_account_not_found", 404);
  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: "platform_cloudflare_current_account_cleared",
    targetType: "platform_cloudflare_account",
    targetId: account.id,
    metadata: {
      label: account.label,
      accountId: account.accountId
    }
  });
}

export async function deletePlatformCloudflareAccountRelational(params: {
  accountId: string;
  actor?: string;
}): Promise<PlatformCloudflareAccount> {
  const account = await prisma.platformCloudflareAccount.findUnique({ where: { id: params.accountId } });
  if (!account) throw new RelationalStoreError("cloudflare_account_not_found", 404);
  await prisma.platformCloudflareAccount.delete({ where: { id: account.id } });
  await addAuditLogRelational(prisma, {
    actorType: "platform_admin",
    actorId: params.actor ?? "platform",
    action: "platform_cloudflare_account_deleted",
    targetType: "platform_cloudflare_account",
    targetId: account.id,
    metadata: {
      label: account.label,
      accountId: account.accountId
    }
  });
  return toPlatformCloudflareAccount(account);
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

export async function setCurrentPlatformAiProviderRelational(params: {
  providerId: string;
  actor?: string;
}): Promise<PlatformAiProvider> {
  const provider = await prisma.$transaction(async (tx) => {
    const existing = await tx.platformAiProvider.findUnique({ where: { id: params.providerId } });
    if (!existing) throw new RelationalStoreError("ai_provider_not_found", 404);
    await tx.platformAiProvider.updateMany({ data: { preferred: false } });
    return tx.platformAiProvider.update({
      where: { id: params.providerId },
      data: { preferred: true, updatedBy: params.actor }
    });
  });
  return toPlatformAiProvider(provider);
}
