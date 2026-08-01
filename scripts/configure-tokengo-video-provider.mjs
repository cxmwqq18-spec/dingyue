import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const providerId = process.env.TOKENGO_VIDEO_PROVIDER_ID?.trim() || "aiprov_tokengo_media_grok_imagine_15";
const label = process.env.TOKENGO_VIDEO_PROVIDER_LABEL?.trim() || "Buming / TokenGo Grok Imagine 1.5";
const aiUrl = (process.env.TOKENGO_VIDEO_BASE_URL?.trim() || "https://buming.token6688.com").replace(/\/+$/, "");
const modelType = process.env.TOKENGO_VIDEO_MODEL?.trim() || "grok-imagine-1.5";
const explicitApiKey = process.env.TOKENGO_VIDEO_API_KEY?.trim() || process.env.BUMING_VIDEO_API_KEY?.trim() || "";
const DEFAULT_VIDEO_PROVIDER_REFERENCE_LIMIT = 1;
const maxImagesPerRequest = Math.max(
  1,
  Math.min(
    Math.trunc(
      Number(process.env.TOKENGO_VIDEO_MAX_IMAGES_PER_REQUEST ?? String(DEFAULT_VIDEO_PROVIDER_REFERENCE_LIMIT)) ||
        DEFAULT_VIDEO_PROVIDER_REFERENCE_LIMIT
    ),
    20
  )
);
const updateSiteApps = process.env.TOKENGO_VIDEO_UPDATE_SITE_APPS?.trim() === "1";
const siteRouteKey = process.env.TOKENGO_VIDEO_SITE_ROUTE_KEY?.trim() || "local.video.grok";

function maskKey(value) {
  if (!value) return "";
  if (value.length <= 10) return `${value.slice(0, 2)}...${value.slice(-2)}`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function main() {
  const existingTokenGoProvider = await prisma.platformAiProvider.findFirst({
    where: {
      providerType: "video",
      aiUrl: { contains: "token6688" },
      apiKey: { not: "" }
    },
    select: { apiKey: true }
  });
  const apiKey = explicitApiKey || existingTokenGoProvider?.apiKey?.trim() || "";
  if (!apiKey) throw new Error("missing TOKENGO_VIDEO_API_KEY");

  const otherVideoProviders = await prisma.platformAiProvider.findMany({
    where: {
      providerType: "video",
      id: { not: providerId }
    },
    select: { id: true },
    orderBy: [{ priority: "asc" }, { label: "asc" }]
  });

  for (const [index, provider] of otherVideoProviders.entries()) {
    await prisma.platformAiProvider.update({
      where: { id: provider.id },
      data: {
        preferred: false,
        priority: index + 1
      }
    });
  }

  await prisma.platformAiProvider.upsert({
    where: { id: providerId },
    create: {
      id: providerId,
      label,
      aiUrl,
      apiKey,
      modelType,
      providerType: "video",
      priority: 0,
      preferred: true,
      enabled: true,
      supportsGenerationN: false,
      supportsEditN: false,
      maxImagesPerRequest,
      updatedBy: "codex"
    },
    update: {
      label,
      aiUrl,
      apiKey,
      modelType,
      providerType: "video",
      priority: 0,
      preferred: true,
      enabled: true,
      supportsGenerationN: false,
      supportsEditN: false,
      maxImagesPerRequest,
      updatedBy: "codex"
    }
  });

  if (updateSiteApps) {
    await prisma.siteAiApp.updateMany({
      where: {
        routeKey: siteRouteKey
      },
      data: {
        providerConfig: {
          mode: "preferred_provider",
          providerId,
          fallbackEnabled: false
        }
      }
    });
  }

  const [videoProviders, videoApps] = await Promise.all([
    prisma.platformAiProvider.findMany({
      where: { providerType: "video" },
      select: {
        id: true,
        label: true,
        aiUrl: true,
        modelType: true,
        providerType: true,
        priority: true,
        preferred: true,
        enabled: true,
        maxImagesPerRequest: true,
        apiKey: true
      },
      orderBy: [{ preferred: "desc" }, { priority: "asc" }, { label: "asc" }]
    }),
    prisma.siteAiApp.findMany({
      where: { routeKey: siteRouteKey },
      select: {
        id: true,
        siteId: true,
        routeKey: true,
        enabled: true,
        providerConfig: true
      },
      orderBy: [{ siteId: "asc" }, { routeKey: "asc" }]
    })
  ]);

  console.log(JSON.stringify({
    ok: true,
    configuredProviderId: providerId,
    siteRouteKey,
    providers: videoProviders.map((provider) => ({
      ...provider,
      apiKey: maskKey(provider.apiKey || "")
    })),
    videoApps
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error?.message || String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
