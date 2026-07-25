import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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
        aiUrl: true,
        apiKey: true,
        modelType: true
      }
    })
  ]);
  const providerById = new Map(providers.map((provider) => [provider.id, provider]));
  const brokenApps = [];

  for (const app of apps) {
    const config = recordValue(app.providerConfig);
    const mode = typeof config.mode === "string" ? config.mode : "platform_fallback";
    const providerId = typeof config.providerId === "string" ? config.providerId : "";
    if ((mode !== "preferred_provider" && mode !== "fixed_provider") || !providerId) continue;
    const provider = providerById.get(providerId);
    if (
      !provider ||
      !provider.enabled ||
      !provider.aiUrl?.trim() ||
      !provider.apiKey?.trim() ||
      !provider.modelType?.trim()
    ) {
      brokenApps.push({
        id: app.id,
        siteId: app.siteId,
        mode,
        providerId,
        providerLabel: provider?.label ?? ""
      });
    }
  }

  assert(apps.length > 0, "video site AI apps are configured");
  assert(
    brokenApps.length === 0,
    `enabled video site AI apps should not select disabled or incomplete providers: ${JSON.stringify(brokenApps)}`
  );
} finally {
  await prisma.$disconnect();
}
