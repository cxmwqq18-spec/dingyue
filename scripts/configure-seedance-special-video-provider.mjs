import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const providerId = process.env.SEEDANCE_SPECIAL_VIDEO_PROVIDER_ID?.trim() || "aiprov_tokengo_media_seedance_2_0_special";
const label = process.env.SEEDANCE_SPECIAL_VIDEO_PROVIDER_LABEL?.trim() || "Buming / TokenGo Seedance 2.0 Special";
const aiUrl = (process.env.SEEDANCE_SPECIAL_VIDEO_BASE_URL?.trim() || "https://buming.token6688.com").replace(/\/+$/, "");
const modelType = process.env.SEEDANCE_SPECIAL_VIDEO_MODEL?.trim() || "seedance-2-0-special";
const explicitApiKey = process.env.SEEDANCE_SPECIAL_VIDEO_API_KEY?.trim() ||
  process.env.TOKENGO_VIDEO_API_KEY?.trim() ||
  process.env.BUMING_VIDEO_API_KEY?.trim() ||
  "";
const DEFAULT_VIDEO_PROVIDER_REFERENCE_LIMIT = 9;
const maxImagesPerRequest = Math.max(
  1,
  Math.min(
    Math.trunc(
      Number(process.env.SEEDANCE_SPECIAL_VIDEO_MAX_IMAGES_PER_REQUEST ?? String(DEFAULT_VIDEO_PROVIDER_REFERENCE_LIMIT)) ||
        DEFAULT_VIDEO_PROVIDER_REFERENCE_LIMIT
    ),
    20
  )
);

function maskKey(value) {
  if (!value) return "";
  if (value.length <= 10) return `${value.slice(0, 2)}...${value.slice(-2)}`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function nextVideoProviderPriority() {
  const provider = await prisma.platformAiProvider.findFirst({
    where: {
      providerType: "video",
      id: { not: providerId }
    },
    select: { priority: true },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }]
  });
  return provider ? provider.priority + 1 : 0;
}

async function existingTokenGoApiKeyProvider() {
  return prisma.platformAiProvider.findFirst({
    where: {
      providerType: "video",
      apiKey: { not: "" },
      OR: [
        { aiUrl: { contains: "token6688" } },
        { aiUrl: { contains: "tokengo" } },
        { aiUrl: { contains: "buming" } }
      ]
    },
    select: { id: true, label: true, apiKey: true },
    orderBy: [{ preferred: "desc" }, { priority: "asc" }, { createdAt: "asc" }]
  });
}

async function main() {
  const existingProvider = await prisma.platformAiProvider.findUnique({
    where: { id: providerId },
    select: {
      id: true,
      apiKey: true,
      priority: true,
      preferred: true
    }
  });
  const fallbackKeyProvider = await existingTokenGoApiKeyProvider();
  const apiKey = explicitApiKey || existingProvider?.apiKey?.trim() || fallbackKeyProvider?.apiKey?.trim() || "";
  if (!apiKey) {
    throw new Error("missing SEEDANCE_SPECIAL_VIDEO_API_KEY, TOKENGO_VIDEO_API_KEY, BUMING_VIDEO_API_KEY, or existing token6688 provider key");
  }

  const priority = existingProvider ? existingProvider.priority : await nextVideoProviderPriority();
  const preferred = existingProvider?.preferred ?? false;

  await prisma.platformAiProvider.upsert({
    where: { id: providerId },
    create: {
      id: providerId,
      label,
      aiUrl,
      apiKey,
      modelType,
      providerType: "video",
      priority,
      preferred,
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
      priority,
      preferred,
      enabled: true,
      supportsGenerationN: false,
      supportsEditN: false,
      maxImagesPerRequest,
      updatedBy: "codex"
    }
  });

  const videoProviders = await prisma.platformAiProvider.findMany({
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
    orderBy: [{ priority: "asc" }, { preferred: "desc" }, { label: "asc" }]
  });

  console.log(JSON.stringify({
    ok: true,
    configuredProviderId: providerId,
    reusedApiKeyFromProviderId: explicitApiKey
      ? undefined
      : existingProvider?.apiKey
        ? providerId
        : fallbackKeyProvider?.id,
    billableCreateAttempts: 0,
    providers: videoProviders.map((provider) => ({
      ...provider,
      apiKey: maskKey(provider.apiKey || "")
    }))
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
