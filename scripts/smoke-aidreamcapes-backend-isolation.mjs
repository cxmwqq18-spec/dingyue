import "./load-runtime-env.mjs";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const siteId = "site_aidreamcapes";
const customerId = "cust_aidreamcapes_aria";
const testCustomerId = "cust_aidreamcapes_test";
const assetId = "asset_aidreamcapes_aria_out_001";
const albumId = "album_aidreamcapes_aria_destination";
const jobId = "job_aidreamcapes_1001";
const slowMs = Number(process.env.AIDREAMCAPES_BACKEND_DB_SLOW_MS ?? 5_000);

async function timed(name, fn) {
  const started = performance.now();
  const value = await fn();
  const ms = Math.round(performance.now() - started);
  return { name, ms, value };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ledgerCreditState(ledger) {
  return ledger.reduce(
    (state, entry) => {
      const amount = Number(entry.amount ?? 0);
      const credits = Math.abs(amount);
      if (entry.type === "grant" || entry.type === "adjustment") {
        state.granted += amount;
      } else if (entry.type === "reserve") {
        state.reservedLedger += credits;
      } else if (entry.type === "consume") {
        state.consumed += credits;
      } else if (entry.type === "release") {
        state.released += credits;
      }
      return state;
    },
    { consumed: 0, granted: 0, released: 0, reservedLedger: 0 }
  );
}

function assertFast(samples) {
  const slow = samples.filter((sample) => sample.ms >= slowMs);
  if (slow.length) {
    throw new Error(`slow_queries:${slow.map((sample) => `${sample.name}:${sample.ms}ms`).join(",")}`);
  }
}

const samples = [];

try {
  samples.push(await timed("site", () => prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, slug: true, name: true, primaryDomain: true, status: true }
  })));
  samples.push(await timed("customer", () => prisma.customer.findFirst({
    where: { id: customerId, siteId },
    include: { balance: true }
  })));
  samples.push(await timed("testCustomer", () => prisma.customer.findFirst({
    where: { id: testCustomerId, siteId },
    include: { balance: true }
  })));
  samples.push(await timed("counts", async () => ({
    customers: await prisma.customer.count({ where: { siteId } }),
    activeCustomers: await prisma.customer.count({ where: { siteId, status: "active" } }),
    subscriptions: await prisma.subscription.count({ where: { siteId } }),
    orders: await prisma.order.count({ where: { siteId } }),
    jobs: await prisma.generationJob.count({ where: { siteId } }),
    albums: await prisma.album.count({ where: { siteId } }),
    assets: await prisma.assetUpload.count({ where: { siteId, deletedAt: null } }),
    products: await prisma.product.count({ where: { siteId } }),
    packs: await prisma.creativePack.count({ where: { siteId } }),
    ledger: await prisma.creditLedger.count({ where: { siteId } })
  })));
  samples.push(await timed("delivery", () => prisma.album.findFirst({
    where: { id: albumId, siteId, customerId },
    include: { coverAsset: true }
  })));
  samples.push(await timed("asset", () => prisma.assetUpload.findFirst({
    where: { id: assetId, siteId, customerId, deletedAt: null },
    select: { id: true, siteId: true, customerId: true, jobId: true, role: true, visibility: true, reviewStatus: true, storageKey: true }
  })));
  samples.push(await timed("job", () => prisma.generationJob.findFirst({
    where: { id: jobId, siteId, customerId },
    select: { id: true, siteId: true, customerId: true, status: true, creditsReserved: true, resultJson: true }
  })));
  samples.push(await timed("ledger", () => prisma.creditLedger.findMany({
    where: { siteId, customerId },
    select: { id: true, amount: true, type: true, sourceId: true },
    orderBy: { createdAt: "asc" }
  })));
  samples.push(await timed("crossSiteLeaks", async () => ({
    dreamshootCustomer: await prisma.customer.findFirst({ where: { id: customerId, siteId: "site_dreamshoot" }, select: { id: true } }),
    dreamshootAsset: await prisma.assetUpload.findFirst({ where: { id: assetId, siteId: "site_dreamshoot" }, select: { id: true } }),
    dreamshootAlbum: await prisma.album.findFirst({ where: { id: albumId, siteId: "site_dreamshoot" }, select: { id: true } }),
    aidreamcapesDreamshootCustomer: await prisma.customer.findFirst({ where: { siteId, id: "cust_dreamshoot_nora" }, select: { id: true } })
  })));

  const byName = Object.fromEntries(samples.map((sample) => [sample.name, sample.value]));
  assert(byName.site?.slug === "aidreamcapes", "missing_aidreamcapes_site");
  assert(byName.customer?.email === "aria@aidreamcapes.localhost", "missing_seed_customer");
  const customerCredits = ledgerCreditState(byName.ledger);
  assert((byName.customer?.balance?.balance ?? -1) >= 0, `negative_available_credits:${byName.customer?.balance?.balance}`);
  assert((byName.customer?.balance?.reserved ?? -1) >= 0, `negative_reserved_credits:${byName.customer?.balance?.reserved}`);
  assert((byName.customer?.balance?.balance ?? 0) <= customerCredits.granted + customerCredits.released, `available_credits_exceed_grants:${byName.customer?.balance?.balance}`);
  assert((byName.customer?.balance?.reserved ?? 0) <= customerCredits.granted, `reserved_credits_exceed_grants:${byName.customer?.balance?.reserved}`);
  assert(byName.testCustomer?.email === "test@aidreamcapes.localhost", "missing_test_customer");
  assert(byName.testCustomer?.balance?.balance === 500, `unexpected_test_available_credits:${byName.testCustomer?.balance?.balance}`);
  assert(byName.testCustomer?.balance?.reserved === 0, `unexpected_test_reserved_credits:${byName.testCustomer?.balance?.reserved}`);
  assert(byName.counts.customers >= 2, `unexpected_customer_count:${byName.counts.customers}`);
  assert(byName.counts.activeCustomers >= 2, `unexpected_active_customer_count:${byName.counts.activeCustomers}`);
  assert(byName.counts.subscriptions >= 1, `unexpected_subscription_count:${byName.counts.subscriptions}`);
  assert(byName.counts.orders >= 1, `unexpected_order_count:${byName.counts.orders}`);
  assert(byName.counts.jobs >= 1, `unexpected_job_count:${byName.counts.jobs}`);
  assert(byName.counts.albums >= 1, `unexpected_album_count:${byName.counts.albums}`);
  assert(byName.counts.assets >= 1, `unexpected_asset_count:${byName.counts.assets}`);
  assert(byName.counts.products >= 4, `unexpected_product_count:${byName.counts.products}`);
  assert(byName.counts.packs >= 10, `unexpected_pack_count:${byName.counts.packs}`);
  assert(byName.counts.ledger >= 2, `unexpected_ledger_count:${byName.counts.ledger}`);
  assert(byName.delivery?.coverAsset?.id === assetId, `unexpected_album_cover_asset:${byName.delivery?.coverAsset?.id}`);
  assert(byName.asset?.role === "output", `unexpected_asset_role:${byName.asset?.role}`);
  assert(byName.asset?.visibility === "private", `unexpected_asset_visibility:${byName.asset?.visibility}`);
  assert(byName.job?.status === "succeeded", `unexpected_job_status:${byName.job?.status}`);
  assert(Object.values(byName.crossSiteLeaks).every((value) => value === null), `cross_site_leak:${JSON.stringify(byName.crossSiteLeaks)}`);
  assertFast(samples);

  console.log(JSON.stringify({
    ok: true,
    siteId,
    customerId,
    counts: byName.counts,
    balance: byName.customer.balance,
    queryTimes: samples.map(({ name, ms }) => ({ name, ms })),
    slowMs
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    queryTimes: samples.map(({ name, ms }) => ({ name, ms }))
  }, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
