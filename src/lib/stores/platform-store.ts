import "server-only";

import { prisma } from "@/lib/prisma";
import type { AiGatewayGroup, PlatformAiProvider, PlatformCloudflareAccount, PlatformEmailSettings, PublicSiteAdmin, Site, SiteDomain } from "@/lib/types";
import { normalizeResendApiKey } from "@/lib/resend-email";

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
    platformEmailSettings: emailSettings ? toPlatformEmailSettings(emailSettings) : undefined,
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
  apiKey?: string;
  fromEmail?: string;
  replyTo?: string;
  actor?: string;
}): Promise<PlatformEmailSettings> {
  const current = await prisma.platformEmailSettings.findUnique({ where: { id: "platform_email_settings" } });
  const nextApiKey = normalizeResendApiKey(params.apiKey);
  const currentApiKey = normalizeResendApiKey(current?.apiKey);
  const settingsRecord = await prisma.platformEmailSettings.upsert({
    where: { id: "platform_email_settings" },
    create: {
      provider: "resend",
      apiKey: nextApiKey,
      fromEmail: params.fromEmail?.trim() || undefined,
      replyTo: params.replyTo?.trim() || undefined,
      updatedBy: params.actor
    },
    update: {
      apiKey: nextApiKey ?? currentApiKey ?? null,
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
      apiKeyUpdated: Boolean(nextApiKey)
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
