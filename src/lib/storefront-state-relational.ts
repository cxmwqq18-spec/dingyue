import "server-only";

import { runDbTasks } from "@/lib/db-concurrency";
import { prisma } from "@/lib/prisma";
import { readPlatformState } from "@/lib/server-store";
import { shouldFallbackRelationalRead, warnRelationalFallback } from "@/lib/stores/relational-fallback";
import {
  mapAiApp,
  mapCreditLedger,
  mapCustomer,
  mapGenerationJob,
  mapPaymentEvent,
  mapProduct,
  toAlbumRelational,
  toAssetUploadRelational,
  toCreativePackCategory,
  toCreativePack,
  toCustomerModelRelational,
  toCustomerSessionRelational,
  toGatewayGroup,
  toMediaAsset,
  toPlatformAiProvider,
  toPlatformCloudflareAccount,
  toPlatformEmailConfig,
  toPlatformEmailSettings,
  toPlatformSessionRelational,
  toPublicPlatformAdminRelational,
  toSite,
  toSiteAdmin,
  toSiteAdminSessionRelational,
  toSiteAiApp,
  toSiteDomain,
  toSiteEmailConfigAssignment,
  toSiteTheme,
  toThemeCopy,
  toThemePublication,
  toToolCategory,
  toToolMenuItem,
  toVideoTheme,
  toVideoThemeCategory
} from "@/lib/stores/prisma-mappers";
import type { PlatformState, Site } from "@/lib/types";

export function readStorefrontPlatformStateJsonFallback(): PlatformState {
  return readPlatformState();
}

function mergeSitesWithMedia(sites: Site[], mediaAssets: PlatformState["mediaAssets"]): Site[] {
  const bySiteId = new Map<string, PlatformState["mediaAssets"]>();
  for (const asset of mediaAssets) {
    const current = bySiteId.get(asset.siteId) ?? [];
    current.push(asset);
    bySiteId.set(asset.siteId, current);
  }
  return sites.map((site) => ({
    ...site,
    mediaAssets: bySiteId.get(site.id) ?? []
  }));
}

export async function readStorefrontPlatformStateRelational(): Promise<PlatformState> {
  try {
    const [
      sites,
      siteDomains,
      siteAdmins,
      siteAdminSessions,
      customers,
      customerSessions,
      products,
      subscriptions,
      orders,
      paymentEvents,
      aiApps,
      siteAiApps,
      aiGatewayGroups,
      creativePackCategories,
      creativePacks,
      toolCategories,
      toolMenuItems,
      videoThemeCategories,
      videoThemes,
      mediaAssets,
      themePublications,
      siteThemes,
      themeCopies,
      customerModels,
      albums,
      auditLogs,
      jobs,
      assetUploads,
      ledger,
      platformAdmins,
      platformSessions,
      emailSettings,
      emailConfigs,
      emailAssignments,
      cloudflareAccounts,
      aiProviders
    ] = await runDbTasks([
      () => prisma.site.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          domains: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
          pages: { orderBy: { slug: "asc" } },
          settings: true,
          connect: true
        }
      }),
      () => prisma.siteDomain.findMany({ orderBy: [{ siteId: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }] }),
      () => prisma.siteAdmin.findMany({ orderBy: [{ siteId: "asc" }, { role: "asc" }, { createdAt: "asc" }] }),
      () => prisma.siteAdminSession.findMany({ orderBy: { createdAt: "desc" } }),
      () => prisma.customer.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "asc" }], include: { balance: true } }),
      () => prisma.customerSession.findMany({ orderBy: { createdAt: "desc" } }),
      () => prisma.product.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "asc" }], include: { prices: true } }),
      () => prisma.subscription.findMany({ orderBy: { createdAt: "desc" } }),
      () => prisma.order.findMany({ orderBy: { createdAt: "desc" } }),
      () => prisma.paymentEvent.findMany({ orderBy: { processedAt: "desc" } }),
      () => prisma.aiApp.findMany({ orderBy: { slug: "asc" } }),
      () => prisma.siteAiApp.findMany({ orderBy: [{ siteId: "asc" }, { routeKey: "asc" }], include: { aiApp: true } }),
      () => prisma.aiGatewayGroup.findMany({ orderBy: [{ siteId: "asc" }, { name: "asc" }] }),
      () => prisma.creativePackCategory.findMany({ orderBy: [{ siteId: "asc" }, { parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }], include: { parent: true } }),
      () => prisma.creativePack.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "asc" }], include: { categoryRecord: { include: { parent: true } } } }),
      () => prisma.toolCategory.findMany({ orderBy: [{ siteId: "asc" }, { parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }], include: { parent: true } }),
      () => prisma.toolMenuItem.findMany({ orderBy: [{ siteId: "asc" }, { sortOrder: "asc" }, { title: "asc" }], include: { category: { include: { parent: true } } } }),
      () => prisma.videoThemeCategory.findMany({ orderBy: [{ siteId: "asc" }, { sortOrder: "asc" }, { label: "asc" }] }),
      () => prisma.videoTheme.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "asc" }], include: { category: true } }),
      () => prisma.mediaAsset.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "asc" }] }),
      () => prisma.themePublication.findMany({ orderBy: [{ siteId: "asc" }, { version: "desc" }] }),
      () => prisma.siteTheme.findMany({ orderBy: [{ siteId: "asc" }, { updatedAt: "desc" }] }),
      () => prisma.themeCopy.findMany({ orderBy: [{ siteId: "asc" }, { updatedAt: "desc" }] }),
      () => prisma.customerModel.findMany({ orderBy: { updatedAt: "desc" } }),
      () => prisma.album.findMany({ orderBy: { updatedAt: "desc" } }),
      () => prisma.auditLog.findMany({ orderBy: { createdAt: "desc" } }),
      () => prisma.generationJob.findMany({ orderBy: { updatedAt: "desc" } }),
      () => prisma.assetUpload.findMany({ orderBy: { createdAt: "desc" } }),
      () => prisma.creditLedger.findMany({ orderBy: { createdAt: "desc" } }),
      () => prisma.platformAdmin.findMany({ orderBy: { createdAt: "asc" } }),
      () => prisma.platformSession.findMany({ orderBy: { createdAt: "desc" } }),
      () => prisma.platformEmailSettings.findUnique({ where: { id: "platform_email_settings" } }),
      () => prisma.platformEmailConfig.findMany({ orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] }),
      () => prisma.siteEmailConfigAssignment.findMany({ orderBy: [{ siteId: "asc" }] }),
      () => prisma.platformCloudflareAccount.findMany({ orderBy: { updatedAt: "desc" } }),
      () => prisma.platformAiProvider.findMany({ orderBy: [{ providerType: "asc" }, { enabled: "desc" }, { preferred: "desc" }, { priority: "asc" }] })
    ]);

    const mappedMediaAssets = mediaAssets.map(toMediaAsset);
    const mappedAiProviders = aiProviders.map(toPlatformAiProvider);
    const preferredProvider = mappedAiProviders.find((provider) => provider.providerType === "image" && provider.enabled && provider.preferred) ?? mappedAiProviders.find((provider) => provider.providerType === "image" && provider.enabled) ?? mappedAiProviders.find((provider) => provider.enabled);
    const mappedEmailConfigs = emailConfigs.map(toPlatformEmailConfig);
    const currentCloudflareAccount = cloudflareAccounts[0];
    return {
      platformAdmins: platformAdmins.map(toPublicPlatformAdminRelational),
      platformSessions: platformSessions.map(toPlatformSessionRelational),
      platformEmailSettings: emailSettings ? toPlatformEmailSettings(emailSettings) : undefined,
      platformEmailConfigs: mappedEmailConfigs,
      siteEmailConfigAssignments: emailAssignments.map(toSiteEmailConfigAssignment),
      platformCloudflareAccounts: cloudflareAccounts.map(toPlatformCloudflareAccount),
      currentCloudflareAccountId: currentCloudflareAccount?.id,
      sites: mergeSitesWithMedia(sites.map(toSite), mappedMediaAssets),
      siteDomains: siteDomains.map(toSiteDomain),
      siteAdmins: siteAdmins.map(toSiteAdmin),
      siteAdminSessions: siteAdminSessions.map(toSiteAdminSessionRelational),
      customers: customers.map(mapCustomer),
      customerSessions: customerSessions.map(toCustomerSessionRelational),
      products: products.map(mapProduct),
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.id,
        siteId: subscription.siteId,
        customerId: subscription.customerId,
        productId: subscription.productId,
        priceId: subscription.priceId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        status: subscription.status as PlatformState["subscriptions"][number]["status"],
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        creditsPerCycle: subscription.creditsPerCycle,
        createdAt: subscription.createdAt.toISOString()
      })),
      orders: orders.map((order) => ({
        id: order.id,
        siteId: order.siteId,
        customerId: order.customerId,
        status: order.status as PlatformState["orders"][number]["status"],
        amountCents: order.amountCents,
        currency: order.currency,
        credits: order.credits,
        sourceId: order.sourceId,
        createdAt: order.createdAt.toISOString()
      })),
      paymentEvents: paymentEvents.map(mapPaymentEvent),
      aiApps: aiApps.map(mapAiApp),
      siteAiApps: siteAiApps.map(toSiteAiApp),
      toolCategories: toolCategories.map(toToolCategory),
      toolMenuItems: toolMenuItems.map(toToolMenuItem),
      videoThemeCategories: videoThemeCategories.map(toVideoThemeCategory),
      videoThemes: videoThemes.map(toVideoTheme),
      aiGatewayGroups: aiGatewayGroups.map(toGatewayGroup),
      creativePackCategories: creativePackCategories.map(toCreativePackCategory),
      creativePacks: creativePacks.map(toCreativePack),
      mediaAssets: mappedMediaAssets,
      themePublications: themePublications.map(toThemePublication),
      siteThemes: siteThemes.map(toSiteTheme),
      themeCopies: themeCopies.map(toThemeCopy),
      customerModels: customerModels.map(toCustomerModelRelational),
      albums: albums.map(toAlbumRelational),
      auditLogs: auditLogs.map((entry) => ({
        id: entry.id,
        siteId: entry.siteId ?? undefined,
        actorType: entry.actorType as PlatformState["auditLogs"][number]["actorType"],
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        createdAt: entry.createdAt.toISOString(),
        metadata: entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
          ? Object.fromEntries(Object.entries(entry.metadata).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))) as PlatformState["auditLogs"][number]["metadata"]
          : undefined
      })),
      jobs: jobs.map(mapGenerationJob),
      assetUploads: assetUploads.map(toAssetUploadRelational),
      ledger: ledger.map(mapCreditLedger),
      platformAiProviders: mappedAiProviders,
      currentAiProviderId: preferredProvider?.id
    };
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("storefront state", error);
    throw error;
  }
}
