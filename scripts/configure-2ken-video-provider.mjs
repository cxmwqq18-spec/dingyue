import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const providerId = process.env.TWOKEN_VIDEO_PROVIDER_ID?.trim() || "aiprov_2ken_grok_imagine_video";
const label = process.env.TWOKEN_VIDEO_PROVIDER_LABEL?.trim() || "2Ken Grok Imagine Video";
const aiUrl = (process.env.TWOKEN_VIDEO_BASE_URL?.trim() || "https://apis.2ken.com/v1").replace(/\/+$/, "");
const modelType = process.env.TWOKEN_VIDEO_MODEL?.trim() || "grok-imagine-video";
const apiKey = process.env.TWOKEN_VIDEO_API_KEY?.trim() || process.env.TWO_KEN_VIDEO_API_KEY?.trim() || "";
const DEFAULT_VIDEO_PROVIDER_REFERENCE_LIMIT = 7;
const maxImagesPerRequest = Math.max(1, Math.min(Math.trunc(Number(process.env.TWOKEN_VIDEO_MAX_IMAGES_PER_REQUEST ?? String(DEFAULT_VIDEO_PROVIDER_REFERENCE_LIMIT)) || DEFAULT_VIDEO_PROVIDER_REFERENCE_LIMIT), 20));
const updateSiteApps = process.env.TWOKEN_VIDEO_UPDATE_SITE_APPS?.trim() === "1";

if (!apiKey) {
  throw new Error("missing TWOKEN_VIDEO_API_KEY");
}

function maskKey(value) {
  if (!value) return "";
  if (value.length <= 10) return `${value.slice(0, 2)}...${value.slice(-2)}`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function main() {
  await prisma.$transaction(async (tx) => {
    const otherVideoProviders = await tx.platformAiProvider.findMany({
      where: {
        providerType: "video",
        id: { not: providerId }
      },
      select: { id: true },
      orderBy: [{ priority: "asc" }, { label: "asc" }]
    });
    for (const [index, provider] of otherVideoProviders.entries()) {
      await tx.platformAiProvider.update({
        where: { id: provider.id },
        data: {
          preferred: false,
          priority: index + 1
        }
      });
    }

    await tx.platformAiProvider.upsert({
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
      await tx.siteAiApp.updateMany({
        where: {
          routeKey: "local.video.grok"
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
  });

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
      where: { routeKey: "local.video.grok" },
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
