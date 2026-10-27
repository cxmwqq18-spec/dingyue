import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const provs = await p.platformAiProvider.findMany({
  where: { providerType: "image", enabled: true },
  select: { id: true, label: true, modelType: true, maxImagesPerRequest: true }
});
for (const r of provs) console.log("IMG", JSON.stringify(r));
await p.$disconnect();
