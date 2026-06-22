import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function requireDelegate(name) {
  if (!prisma[name]) throw new Error(`missing_prisma_delegate:${name}`);
}

async function main() {
  [
    "site",
    "siteDomain",
    "siteAdmin",
    "siteAiApp",
    "aiGatewayGroup",
    "themePage",
    "themeSettings",
    "themePublication",
    "siteTheme",
    "mediaAsset",
    "platformEmailSettings",
    "platformCloudflareAccount",
    "platformAiProvider",
    "auditLog",
    "platformStateDocument"
  ].forEach(requireDelegate);

  if (!process.env.DATABASE_URL) {
    console.log(JSON.stringify({ ok: true, schema: { delegates: "available" }, db: { checked: false, reason: "DATABASE_URL_missing" } }, null, 2));
    return;
  }

  const [
    siteCount,
    pageCount,
    publicationCount,
    siteThemeCount,
    mediaCount,
    gatewayGroupCount,
    platformEmailSettings,
    cloudflareAccountCount,
    aiProviderCount,
    document
  ] = await Promise.all([
    prisma.site.count(),
    prisma.themePage.count(),
    prisma.themePublication.count(),
    prisma.siteTheme.count(),
    prisma.mediaAsset.count(),
    prisma.aiGatewayGroup.count(),
    prisma.platformEmailSettings.findUnique({ where: { id: "platform_email_settings" } }),
    prisma.platformCloudflareAccount.count(),
    prisma.platformAiProvider.count(),
    prisma.platformStateDocument.findUnique({ where: { id: "platform" } })
  ]);

  const firstSite = await prisma.site.findFirst({
    include: {
      domains: true,
      pages: { take: 3, orderBy: { slug: "asc" } },
      settings: true,
      aiApps: { take: 3, include: { aiApp: true } }
    }
  });

  const jsonState = document?.state && typeof document.state === "object" ? document.state : {};
  const summary = {
    relational: {
      sites: siteCount,
      themePages: pageCount,
      themePublications: publicationCount,
      siteThemes: siteThemeCount,
      mediaAssets: mediaCount,
      gatewayGroups: gatewayGroupCount,
      platformEmailConfigured: Boolean(platformEmailSettings),
      cloudflareAccounts: cloudflareAccountCount,
      aiProviders: aiProviderCount,
      firstSite: firstSite
        ? {
            id: firstSite.id,
            slug: firstSite.slug,
            domains: firstSite.domains.length,
            pages: firstSite.pages.length,
            hasSettings: Boolean(firstSite.settings),
            siteAiApps: firstSite.aiApps.length
          }
        : null
    },
    jsonFallback: {
      hasPlatformDocument: Boolean(document),
      siteThemes: Array.isArray(jsonState.siteThemes) ? jsonState.siteThemes.length : 0,
      gatewayGroups: Array.isArray(jsonState.aiGatewayGroups) ? jsonState.aiGatewayGroups.length : 0,
      cloudflareAccounts: Array.isArray(jsonState.platformCloudflareAccounts) ? jsonState.platformCloudflareAccounts.length : 0,
      aiProviders: Array.isArray(jsonState.platformAiProviders) ? jsonState.platformAiProviders.length : 0,
      hasEmailSettings: Boolean(jsonState.platformEmailSettings)
    }
  };

  console.log(JSON.stringify({ ok: true, summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
