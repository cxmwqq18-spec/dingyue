import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const requestedLimit = Number(process.env.VIDEO_PROVIDER_MAX_IMAGES_PER_REQUEST ?? "1");
const targetLimit = Math.max(1, Math.min(Math.trunc(Number.isFinite(requestedLimit) ? requestedLimit : 1), 30));

function isVideoModel(modelType) {
  return typeof modelType === "string" && modelType.trim().toLowerCase().includes("video");
}

async function main() {
  const providers = await prisma.platformAiProvider.findMany({
    select: {
      id: true,
      label: true,
      modelType: true,
      maxImagesPerRequest: true
    },
    orderBy: [{ preferred: "desc" }, { priority: "asc" }]
  });
  const videoProviders = providers.filter((provider) => isVideoModel(provider.modelType));
  if (!videoProviders.length) throw new Error("No video AI providers found.");

  const providerIds = videoProviders.map((provider) => provider.id);
  await prisma.platformAiProvider.updateMany({
    where: {
      id: { in: providerIds }
    },
    data: {
      maxImagesPerRequest: targetLimit
    }
  });

  const updated = await prisma.platformAiProvider.findMany({
    where: { id: { in: providerIds } },
    select: {
      label: true,
      modelType: true,
      maxImagesPerRequest: true
    },
    orderBy: [{ preferred: "desc" }, { priority: "asc" }]
  });

  console.log(JSON.stringify({
    ok: true,
    targetLimit,
    videoProviders: updated
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
