import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
const assets = await p.assetUpload.findMany({
  where: { siteId: "site_aidreamcapes", role: "output", mimeType: { startsWith: "video/" }, deletedAt: null, createdAt: { lt: cutoff } },
  orderBy: { createdAt: "asc" },
  select: { id: true, jobId: true, storageKey: true, createdAt: true, mimeType: true }
});
for (const a of assets) {
  // 是否仍被任务镜头版本引用
  let referenced = "no-task";
  if (a.jobId) {
    const job = await p.generationJob.findUnique({ where: { id: a.jobId }, select: { requestJson: true, status: true } });
    const taskId = job?.requestJson?.workspace?.taskId;
    if (taskId) {
      const t = await p.$queryRaw`SELECT "data" FROM "AidreamcapesVideoTask" WHERE "id" = ${taskId} AND "siteId" = 'site_aidreamcapes' LIMIT 1`;
      const shots = t[0]?.data?.storyboard?.shots ?? [];
      const hit = shots.some(s => (s.versions ?? []).some(v => typeof v.clipUrl === "string" && v.clipUrl.includes(`/assets/${a.id}/download`)));
      referenced = hit ? "REFERENCED" : "unreferenced";
    }
  }
  console.log("DUE", a.createdAt.toISOString().slice(0, 16), a.id.slice(6, 22).padEnd(17), referenced.padEnd(12), (a.storageKey.split("/").pop() ?? "").slice(0, 40));
}
await p.$disconnect();
