#!/usr/bin/env node
// Read-only diagnostic: why did recent Aidreamcapes video jobs end without
// reaching the upstream relay?
//
// Reads site_aidreamcapes rows only. No writes, no settlement, no retries.
//
// Usage (after the tunnel is up):
//   DATABASE_URL="<readonly tunneled url>" DATABASE_TARGET=remote-readonly \
//     DINGYUE_ENV=remote-readonly node scripts/diagnose-aidreamcapes-upstream-jobs.mjs \
//     [--email=<customer email>] [--hours=24] [--job=<id,id>]

import { PrismaClient } from "@prisma/client";
import { argumentValue } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const EMAIL = argumentValue("--email");
const HOURS = Number(argumentValue("--hours") || "24");
const JOB_IDS = (argumentValue("--job") || "").split(",").map((v) => v.trim()).filter(Boolean);

const prisma = new PrismaClient();

let customerIds;
if (EMAIL) {
  const customers = await prisma.customer.findMany({
    where: { siteId: SITE_ID, email: { contains: EMAIL } },
    select: { id: true, name: true, email: true }
  });
  console.log("customers:", JSON.stringify(customers));
  customerIds = customers.map((c) => c.id);
} else {
  customerIds = undefined;
}

const since = new Date(Date.now() - HOURS * 3600_000);
const jobs = await prisma.generationJob.findMany({
  where: {
    siteId: SITE_ID,
    ...(JOB_IDS.length ? { id: { in: JOB_IDS } } : { createdAt: { gte: since } }),
    ...(customerIds ? { customerId: { in: customerIds } } : {})
  },
  orderBy: { createdAt: "desc" },
  take: 40
});

for (const job of jobs) {
  const workspace = job.requestJson?.workspace ?? {};
  const prompt = job.requestJson?.prompt ?? {};
  const result = job.resultJson ?? {};
  const shotErrors = Array.isArray(workspace?.shots)
    ? workspace.shots.map((s) => ({ shotId: s.shotId, genStatus: s.genStatus, error: s.error, compositeStatus: s.compositeStatus, compositeError: s.compositeError }))
    : undefined;
  console.log(JSON.stringify({
    job: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    creditsReserved: job.creditsReserved,
    entryPoint: job.entryPoint,
    aiAppId: job.aiAppId,
    model: prompt?.modelId ?? workspace?.providerId ?? undefined,
    aspect: job.requestJson?.aspect ?? prompt?.aspect,
    duration: job.requestJson?.duration,
    dispatched: workspace?.dispatched ?? undefined,
    dispatchClaim: workspace?.dispatchClaim ? { state: workspace.dispatchClaim.state, error: workspace.dispatchClaim.error } : undefined,
    error: job.requestJson?.error ?? result?.error ?? result?.message ?? undefined,
    resultKeys: Object.keys(result).slice(0, 12),
    providerReceipt: result?.provider ?? result?.receipt ?? undefined,
    video: workspace?.video ? { status: workspace.video.status, error: workspace.video.error, finalUrl: workspace.video.finalUrl ? "(set)" : undefined } : undefined,
    shotErrors
  }, null, 1));
}
console.log(`scanned ${jobs.length} job(s) since ${since.toISOString()}`);

// Upstream/relay configuration visible through database only (channels live in env/admin), so also print site AI apps and provider bindings:
const siteAiApps = await prisma.siteAiApp.findMany({
  where: { siteId: SITE_ID },
  select: { routeKey: true, aiApp: { select: { slug: true, appType: true, status: true } } },
  take: 20
});
console.log("siteAiApps:", JSON.stringify(siteAiApps));

await prisma.$disconnect();
