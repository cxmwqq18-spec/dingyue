import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const statePath = path.resolve(process.cwd(), "data", "platform-state.json");
const siteId = "site_dreamshoot";
const rawArgs = process.argv.slice(2);
const flags = new Set(rawArgs.filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2).split("=")[0]));
const dryRunRequested = flags.has("dry-run");
const writeJsonRequested = !dryRunRequested && flags.has("write-json");
const writePostgresRequested = !dryRunRequested && flags.has("db") && flags.has("force-pricing-overwrite");

function envOrManualPrice(envName, fallback) {
  return process.env[envName]?.trim() || fallback;
}

const subscriptionPlans = [
  { id: "prod_dreamshoot_starter", family: "starter", name: "Starter", monthlyPriceId: "price_dreamshoot_starter_monthly", quarterlyPriceId: "price_dreamshoot_starter_quarterly", halfYearPriceId: "price_dreamshoot_starter_half_year", legacyYearlyPriceId: "price_dreamshoot_starter_yearly", monthlyAmountCents: 2450, originalAmountCents: 3500, monthlyCredits: 200, quarterlyAmountCents: 4500, quarterlyCredits: 600, halfYearAmountCents: 9000, halfYearCredits: 1200, equivalentMonthlyCents: 1500, featured: false, bestValue: false, planSubtitle: "A practical starting plan for first private albums and quick profile sets.", editingLabel: "Standard editing", generatedPhotos: 20, destinationCount: 2, deliveryDays: 3 },
  { id: "prod_dreamshoot_pro", family: "pro", name: "Pro", monthlyPriceId: "price_dreamshoot_pro_monthly", quarterlyPriceId: "price_dreamshoot_pro_quarterly", halfYearPriceId: "price_dreamshoot_pro_half_year", legacyYearlyPriceId: "price_dreamshoot_pro_yearly", monthlyAmountCents: 3500, originalAmountCents: 5000, monthlyCredits: 300, quarterlyAmountCents: 6000, quarterlyCredits: 900, halfYearAmountCents: 12000, halfYearCredits: 1800, equivalentMonthlyCents: 2000, featured: true, bestValue: false, planSubtitle: "More credits for several albums, edits, and style tests.", editingLabel: "Advanced editing", generatedPhotos: 40, destinationCount: 4, deliveryDays: 2 },
  { id: "prod_dreamshoot_premium", family: "premium", name: "Premium", monthlyPriceId: "price_dreamshoot_premium_monthly", quarterlyPriceId: "price_dreamshoot_premium_quarterly", halfYearPriceId: "price_dreamshoot_premium_half_year", legacyYearlyPriceId: "price_dreamshoot_premium_yearly", monthlyAmountCents: 6300, originalAmountCents: 9000, monthlyCredits: 600, quarterlyAmountCents: 10000, quarterlyCredits: 1800, halfYearAmountCents: 20000, halfYearCredits: 3600, equivalentMonthlyCents: 3333, featured: false, bestValue: true, planSubtitle: "The highest credit allowance for repeat albums, video ideas, and premium outputs.", editingLabel: "Premium editing and retouching", generatedPhotos: 80, destinationCount: 8, deliveryDays: 1 }
];

const legacyYearlyPriceIds = subscriptionPlans.map((plan) => plan.legacyYearlyPriceId);

const oneTimeProducts = [
  { id: "prod_dreamshoot_one_shot", name: "One-shot trial", priceId: "price_dreamshoot_one_shot", label: "One-shot trial", amountCents: 999, creditsGranted: 40, envName: "MYDREAMSHOOTS_STRIPE_PRICE_ONE_SHOT", manual: "manual_dreamshoot_one_shot", metadata: { oneShot: true, publicReference: "myDreamshoots one-shot trial" } },
  { id: "prod_dreamshoot_credits_small", name: "Small credit pack", priceId: "price_dreamshoot_credits_small", label: "Small credit pack", amountCents: 1200, creditsGranted: 100, envName: "MYDREAMSHOOTS_STRIPE_PRICE_CREDITS_SMALL", manual: "manual_dreamshoot_credits_small", metadata: { packSize: "small", publicReference: "myDreamshoots small credit pack" } },
  { id: "prod_dreamshoot_credits_medium", name: "Medium credit pack", priceId: "price_dreamshoot_credits_medium", label: "Medium credit pack", amountCents: 2000, creditsGranted: 200, envName: "MYDREAMSHOOTS_STRIPE_PRICE_CREDITS_MEDIUM", manual: "manual_dreamshoot_credits_medium", metadata: { packSize: "medium", publicReference: "myDreamshoots medium credit pack" } },
  { id: "prod_dreamshoot_credits_large", name: "Large credit pack", priceId: "price_dreamshoot_credits_large", label: "Large credit pack", amountCents: 3200, creditsGranted: 350, envName: "MYDREAMSHOOTS_STRIPE_PRICE_CREDITS_LARGE", manual: "manual_dreamshoot_credits_large", metadata: { packSize: "large", publicReference: "myDreamshoots large credit pack" } }
];

function subscriptionPriceMetadata(plan, cadence, originalAmountCents, extra = {}) {
  return {
    generatedPhotos: plan.generatedPhotos,
    destinationCount: plan.destinationCount,
    deliveryDays: plan.deliveryDays,
    featured: plan.featured,
    planSubtitle: plan.planSubtitle,
    editingLabel: plan.editingLabel,
    originalAmountCents,
    billingCadence: cadence,
    planFamily: plan.family,
    bestValue: plan.bestValue,
    publicReference: `myDreamshoots ${String(plan.name).toLowerCase()} ${cadence} credit package`,
    ...extra
  };
}

function buildProducts() {
  const subscriptions = subscriptionPlans.map((plan) => ({
    id: plan.id,
    siteId,
    name: plan.name,
    type: "subscription",
    status: "active",
    prices: [
      {
        id: plan.monthlyPriceId,
        siteId,
        productId: plan.id,
        label: plan.name,
        amountCents: plan.monthlyAmountCents,
        currency: "usd",
        interval: "month",
        creditsGranted: plan.monthlyCredits,
        stripePriceId: envOrManualPrice(`MYDREAMSHOOTS_STRIPE_PRICE_${plan.family.toUpperCase()}_MONTHLY`, `manual_${plan.monthlyPriceId}`),
        metadata: subscriptionPriceMetadata(plan, "monthly", plan.originalAmountCents, {
          discountLabel: "30% off"
        })
      },
      {
        id: plan.quarterlyPriceId,
        siteId,
        productId: plan.id,
        label: `${plan.name} quarterly`,
        amountCents: plan.quarterlyAmountCents,
        currency: "usd",
        interval: "quarter",
        creditsGranted: plan.quarterlyCredits,
        stripePriceId: envOrManualPrice(`MYDREAMSHOOTS_STRIPE_PRICE_${plan.family.toUpperCase()}_QUARTERLY`, `manual_${plan.quarterlyPriceId}`),
        metadata: subscriptionPriceMetadata(plan, "quarterly", plan.originalAmountCents * 3, {
          discountLabel: "Quarterly savings",
          equivalentMonthlyCents: plan.equivalentMonthlyCents,
          yearlyEquivalentMonthlyCents: plan.equivalentMonthlyCents
        })
      },
      {
        id: plan.halfYearPriceId,
        siteId,
        productId: plan.id,
        label: `${plan.name} semiannual`,
        amountCents: plan.halfYearAmountCents,
        currency: "usd",
        interval: "half_year",
        creditsGranted: plan.halfYearCredits,
        stripePriceId: envOrManualPrice(`MYDREAMSHOOTS_STRIPE_PRICE_${plan.family.toUpperCase()}_SEMIANNUAL`, `manual_${plan.halfYearPriceId}`),
        metadata: subscriptionPriceMetadata(plan, "semiannually", plan.originalAmountCents * 6, {
          discountLabel: "Semiannual savings",
          equivalentMonthlyCents: plan.equivalentMonthlyCents,
          yearlyEquivalentMonthlyCents: plan.equivalentMonthlyCents
        })
      }
    ]
  }));

  const creditPacks = oneTimeProducts.map((product) => ({
    id: product.id,
    siteId,
    name: product.name,
    type: "credit_pack",
    status: "active",
    prices: [
      {
        id: product.priceId,
        siteId,
        productId: product.id,
        label: product.label,
        amountCents: product.amountCents,
        currency: "usd",
        interval: "one_time",
        creditsGranted: product.creditsGranted,
        stripePriceId: envOrManualPrice(product.envName, product.manual),
        metadata: product.metadata
      }
    ]
  }));

  return [...subscriptions, ...creditPacks];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function replaceWhere(items, predicate, nextItems) {
  return [...items.filter((item) => !predicate(item)), ...nextItems];
}

function assertNoYearlySubscriptionsInState(state) {
  const legacy = new Set(legacyYearlyPriceIds);
  const matches = asArray(state.subscriptions).filter((subscription) => subscription.siteId === siteId && legacy.has(subscription.priceId));
  if (matches.length) {
    throw new Error(`Refusing to remove legacy yearly prices because ${matches.length} local subscription(s) still reference them.`);
  }
}

function updateJsonState(products, { write }) {
  if (!fs.existsSync(statePath)) return { available: false, changed: false, wrote: false };
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assertNoYearlySubscriptionsInState(state);
  const before = JSON.stringify(state.products ?? []);
  state.products = replaceWhere(state.products ?? [], (item) => item.siteId === siteId, products);
  const changed = before !== JSON.stringify(state.products ?? []);
  if (changed && write) fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return { available: true, changed, wrote: Boolean(changed && write) };
}

async function assertNoYearlySubscriptionsInPostgres(tx, targetSiteId) {
  const subscriptions = await tx.subscription.findMany({
    where: { siteId: targetSiteId, priceId: { in: legacyYearlyPriceIds } },
    select: { id: true, customerId: true, priceId: true, status: true }
  });
  if (subscriptions.length) {
    throw new Error(`Refusing to remove legacy yearly prices because ${subscriptions.length} Postgres subscription(s) still reference them: ${subscriptions.map((item) => `${item.id}:${item.priceId}:${item.status}`).join(", ")}`);
  }
}

async function updatePostgres(products) {
  const site = await prisma.site.findFirst({
    where: { OR: [{ id: siteId }, { slug: { in: ["mydreamshoots", "dreamshoot"] } }, { primaryDomain: "www.mydreamshoots.com" }] },
    select: { id: true }
  });
  if (!site) throw new Error("myDreamshoots site not found");

  await prisma.$transaction(async (tx) => {
    await assertNoYearlySubscriptionsInPostgres(tx, site.id);
    const activeProductIds = products.map((product) => product.id);
    await tx.price.deleteMany({ where: { siteId: site.id, productId: { notIn: activeProductIds } } });
    await tx.product.deleteMany({ where: { siteId: site.id, id: { notIn: activeProductIds } } });

    for (const product of products) {
      await tx.product.upsert({
        where: { id: product.id },
        create: { id: product.id, siteId: site.id, name: product.name, type: product.type, status: product.status },
        update: { name: product.name, type: product.type, status: product.status }
      });
      const activePriceIds = product.prices.map((price) => price.id);
      await tx.price.deleteMany({ where: { siteId: site.id, productId: product.id, id: { notIn: activePriceIds } } });
      for (const price of product.prices) {
        await tx.price.upsert({
          where: { id: price.id },
          create: {
            id: price.id,
            siteId: site.id,
            productId: product.id,
            label: price.label,
            amountCents: price.amountCents,
            currency: price.currency,
            interval: price.interval,
            creditsGranted: price.creditsGranted,
            stripePriceId: price.stripePriceId,
            metadata: price.metadata
          },
          update: {
            label: price.label,
            amountCents: price.amountCents,
            currency: price.currency,
            interval: price.interval,
            creditsGranted: price.creditsGranted,
            stripePriceId: price.stripePriceId,
            metadata: price.metadata
          }
        });
      }
    }
  });

  return { siteId: site.id, products: products.length, prices: products.reduce((sum, product) => sum + product.prices.length, 0) };
}

function removeStateCaches() {
  for (const dir of [".next", ".next-dev", ".next-3002", ".next-build", ".next-docx-verify"]) {
    const cacheFile = path.join(process.cwd(), dir, "cache/platform-state-postgres.json");
    if (fs.existsSync(cacheFile)) fs.rmSync(cacheFile, { force: true });
  }
}

async function main() {
  const products = buildProducts();
  const jsonState = updateJsonState(products, { write: writeJsonRequested });
  const postgres = writePostgresRequested ? await updatePostgres(products) : null;
  if (writeJsonRequested || writePostgresRequested) removeStateCaches();
  console.log(JSON.stringify({
    ok: true,
    mode: writeJsonRequested || writePostgresRequested ? "write" : "dry-run",
    siteId,
    writeGuards: {
      jsonRequires: "--write-json",
      postgresRequires: "--db --force-pricing-overwrite",
      yearlySubscriptionCheck: legacyYearlyPriceIds
    },
    jsonState,
    postgres,
    products: products.length,
    prices: products.reduce((sum, product) => sum + product.prices.length, 0)
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
