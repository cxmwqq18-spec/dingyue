import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const dryRun = !apply || process.env.DRY_RUN === "1";
assertDatabaseTarget({ expectedTarget: String(process.env.DATABASE_TARGET || "local").trim().toLowerCase() });

function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function providerIsRunnable(provider) {
  return Boolean(
    provider &&
    provider.enabled &&
    provider.aiUrl?.trim() &&
    provider.apiKey?.trim() &&
    provider.modelType?.trim()
  );
}

try {
  const [apps, providers] = await Promise.all([
    prisma.siteAiApp.findMany({
      where: { enabled: true, routeKey: "local.video.grok" },
      select: {
        id: true,
        siteId: true,
        providerConfig: true
      },
      orderBy: [{ siteId: "asc" }, { id: "asc" }]
    }),
    prisma.platformAiProvider.findMany({
      where: { providerType: "video" },
      select: {
        id: true,
        label: true,
        enabled: true,
        preferred: true,
        priority: true,
        aiUrl: true,
        apiKey: true,
        modelType: true
      },
      orderBy: [{ preferred: "desc" }, { priority: "asc" }, { label: "asc" }]
    })
  ]);

  const providerById = new Map(providers.map((provider) => [provider.id, provider]));
  const currentProvider = providers.find(providerIsRunnable);
  if (!currentProvider) {
    throw new Error("no_runnable_video_provider_configured");
  }

  const repaired = [];
  for (const app of apps) {
    const config = recordValue(app.providerConfig);
    const mode = typeof config.mode === "string" ? config.mode : "platform_fallback";
    const providerId = typeof config.providerId === "string" ? config.providerId : "";
    if ((mode !== "preferred_provider" && mode !== "fixed_provider") || !providerId) continue;
    if (providerIsRunnable(providerById.get(providerId))) continue;

    const nextConfig = {
      mode: "platform_fallback",
      fallbackEnabled: true
    };
    repaired.push({
      id: app.id,
      siteId: app.siteId,
      previousProviderId: providerId,
      nextMode: nextConfig.mode,
      currentVideoProviderId: currentProvider.id,
      currentVideoProviderLabel: currentProvider.label
    });
    if (!dryRun) {
      await prisma.siteAiApp.update({
        where: { id: app.id },
        data: { providerConfig: nextConfig }
      });
    }
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun,
    currentVideoProvider: {
      id: currentProvider.id,
      label: currentProvider.label
    },
    repaired
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
