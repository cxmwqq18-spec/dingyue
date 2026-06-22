import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function requireDelegate(name) {
  if (!prisma[name]) throw new Error(`missing_prisma_delegate:${name}`);
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function main() {
  [
    "site",
    "customer",
    "creditBalance",
    "product",
    "price",
    "aiApp",
    "siteAiApp",
    "generationJob",
    "creditLedger"
  ].forEach(requireDelegate);

  if (!process.env.DATABASE_URL) {
    console.log(JSON.stringify({ ok: true, schema: { delegates: "available" }, db: { checked: false, reason: "DATABASE_URL_missing" } }, null, 2));
    return;
  }

  const siteId = `smoke_site_${Date.now().toString(36)}`;
  const customerId = uid("cust");
  const productId = uid("prod");
  const aiAppId = uid("app");
  const siteAiAppId = uid("siteapp");
  const jobId = uid("job");

  await prisma.$transaction(async (tx) => {
    await tx.site.create({
      data: {
        id: siteId,
        name: "Relational Store Smoke",
        slug: siteId,
        status: "active",
        primaryDomain: `${siteId}.localhost`,
        branding: {}
      }
    });
    await tx.customer.create({
      data: { id: customerId, siteId, email: `${siteId}@example.com`, name: "Smoke Customer", status: "active" }
    });
    await tx.creditBalance.create({ data: { id: uid("bal"), siteId, customerId, balance: 20, reserved: 0 } });
    await tx.product.create({ data: { id: productId, siteId, name: "Smoke Pack", type: "credit_pack", status: "active" } });
    await tx.price.create({
      data: {
        id: uid("price"),
        siteId,
        productId,
        label: "Smoke credits",
        stripePriceId: "manual_smoke",
        currency: "usd",
        amountCents: 100,
        interval: "one_time",
        creditsGranted: 20
      }
    });
    await tx.aiApp.create({
      data: { id: aiAppId, slug: `smoke-app-${Date.now()}`, name: "Smoke App", description: "Smoke", appType: "image", parameterSchema: [] }
    });
    await tx.siteAiApp.create({ data: { id: siteAiAppId, siteId, aiAppId, enabled: true, creditCost: 5, routeKey: "smoke.worker" } });
    await tx.generationJob.create({
      data: { id: jobId, siteId, customerId, aiAppId, status: "queued", creditsReserved: 5, requestJson: { worker: "smoke.worker" } }
    });
    await tx.creditBalance.update({ where: { customerId }, data: { balance: { decrement: 5 }, reserved: { increment: 5 } } });
    await tx.creditLedger.create({
      data: { id: uid("led"), siteId, customerId, amount: -5, type: "reserve", sourceType: "generation_job", sourceId: jobId }
    });
  });

  const firstSettle = await prisma.$transaction(async (tx) => {
    const job = await tx.generationJob.findUniqueOrThrow({ where: { id: jobId } });
    const existing = await tx.creditLedger.findFirst({ where: { siteId, customerId, type: "consume", sourceId: jobId } });
    if (!existing) {
      await tx.creditBalance.updateMany({ where: { siteId, customerId, reserved: { gte: job.creditsReserved } }, data: { reserved: { decrement: job.creditsReserved } } });
      await tx.creditLedger.create({
        data: { id: uid("led"), siteId, customerId, amount: -job.creditsReserved, type: "consume", sourceType: "generation_job", sourceId: jobId }
      });
    }
    await tx.generationJob.update({ where: { id: jobId }, data: { status: "succeeded", resultJson: { requestId: "smoke-1" } } });
    return tx.creditBalance.findUniqueOrThrow({ where: { customerId } });
  });

  const secondSettle = await prisma.$transaction(async (tx) => {
    const finalJob = await tx.generationJob.findUniqueOrThrow({ where: { id: jobId } });
    if (!["succeeded", "failed", "refunded"].includes(finalJob.status)) throw new Error("job was not final");
    return tx.creditBalance.findUniqueOrThrow({ where: { customerId } });
  });

  const ledgerCount = await prisma.creditLedger.count({ where: { siteId, customerId } });
  console.log(JSON.stringify({ ok: true, siteId, firstSettle, secondSettle, ledgerCount }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
