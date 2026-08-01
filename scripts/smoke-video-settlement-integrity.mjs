import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const prisma = new PrismaClient();

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isVideoRequest(requestJson) {
  const request = object(requestJson);
  const fields = object(request.fields);
  return request.mode === "video" ||
    request.outputType === "video" ||
    typeof request.videoThemeId === "string" ||
    fields.mode === "video" ||
    fields.outputType === "video" ||
    typeof fields.videoThemeId === "string";
}

function outputSlots(resultJson) {
  const slots = object(resultJson).outputSlots;
  return Array.isArray(slots)
    ? slots.filter((slot) => slot && typeof slot === "object" && !Array.isArray(slot))
    : [];
}

function succeededVideoSlots(resultJson) {
  return outputSlots(resultJson).filter((slot) => {
    const mimeType = typeof slot.mimeType === "string" ? slot.mimeType : "";
    return slot.status === "succeeded" &&
      typeof slot.storageKey === "string" &&
      slot.storageKey.trim() &&
      mimeType.startsWith("video/");
  });
}

try {
  const activeJobs = await prisma.generationJob.findMany({
    where: { status: { in: ["queued", "running"] } },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 200,
    select: {
      id: true,
      siteId: true,
      customerId: true,
      status: true,
      updatedAt: true,
      requestJson: true,
      resultJson: true
    }
  });

  const stuckDeliveredJobs = activeJobs
    .map((job) => ({ job, slots: succeededVideoSlots(job.resultJson) }))
    .filter(({ job, slots }) => isVideoRequest(job.requestJson) && slots.length > 0);

  if (stuckDeliveredJobs.length > 0) {
    console.error("video settlement integrity smoke failed: active jobs already have delivered video slots");
    console.error(JSON.stringify(stuckDeliveredJobs.slice(0, 10).map(({ job, slots }) => ({
      id: job.id,
      siteId: job.siteId,
      customerId: job.customerId,
      status: job.status,
      updatedAt: job.updatedAt.toISOString(),
      slots: slots.map((slot) => ({
        index: slot.index,
        stage: slot.stage,
        storageKey: slot.storageKey,
        mimeType: slot.mimeType,
        providerTaskId: slot.providerTaskId
      }))
    })), null, 2));
    process.exit(1);
  }

  console.log("video settlement integrity smoke passed");
} finally {
  await prisma.$disconnect();
}
