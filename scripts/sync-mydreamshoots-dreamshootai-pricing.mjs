import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const statePath = path.resolve(process.cwd(), "data", "platform-state.json");
const siteId = "site_dreamshoot";

function envOrManualPrice(envName, fallback) {
  return process.env[envName]?.trim() || fallback;
}

const subscriptionPlans = [
  { id: "prod_dreamshoot_starter", family: "starter", name: "Starter", audience: "couple", monthlyPriceId: "price_dreamshoot_starter_monthly", yearlyPriceId: "price_dreamshoot_starter_yearly", monthlyAmountCents: 2450, originalAmountCents: 3500, monthlyCredits: 200, yearlyAmountCents: 18000, yearlyCredits: 2400, yearlyEquivalentMonthlyCents: 1500, featured: false, bestValue: false, planSubtitle: "Perfect for couples just starting their AI journey", editingLabel: "Standard editing", generatedPhotos: 20, destinationCount: 2, deliveryDays: 3 },
  { id: "prod_dreamshoot_pro", family: "pro", name: "Pro", audience: "couple", monthlyPriceId: "price_dreamshoot_pro_monthly", yearlyPriceId: "price_dreamshoot_pro_yearly", monthlyAmountCents: 3500, originalAmountCents: 5000, monthlyCredits: 300, yearlyAmountCents: 24000, yearlyCredits: 3600, yearlyEquivalentMonthlyCents: 2000, featured: true, bestValue: false, planSubtitle: "Most popular choice for couples", editingLabel: "Advanced editing", generatedPhotos: 40, destinationCount: 4, deliveryDays: 2 },
  { id: "prod_dreamshoot_premium", family: "premium", name: "Premium", audience: "couple", monthlyPriceId: "price_dreamshoot_premium_monthly", yearlyPriceId: "price_dreamshoot_premium_yearly", monthlyAmountCents: 6300, originalAmountCents: 9000, monthlyCredits: 600, yearlyAmountCents: 40000, yearlyCredits: 7200, yearlyEquivalentMonthlyCents: 3333, featured: false, bestValue: true, planSubtitle: "Ultimate package for the perfect AI experience", editingLabel: "Premium editing and retouching", generatedPhotos: 80, destinationCount: 8, deliveryDays: 1 },
  { id: "prod_dreamshoot_single_starter", family: "single_starter", name: "Single Starter", audience: "single", monthlyPriceId: "price_dreamshoot_single_starter_monthly", yearlyPriceId: "price_dreamshoot_single_starter_yearly", monthlyAmountCents: 1260, originalAmountCents: 1800, monthlyCredits: 200, yearlyAmountCents: 10800, yearlyCredits: 2400, yearlyEquivalentMonthlyCents: 900, featured: false, bestValue: false, planSubtitle: "Focused AI photos for one person", editingLabel: "Standard editing", generatedPhotos: 20, destinationCount: 2, deliveryDays: 3 },
  { id: "prod_dreamshoot_single_pro", family: "single_pro", name: "Single Pro", audience: "single", monthlyPriceId: "price_dreamshoot_single_pro_monthly", yearlyPriceId: "price_dreamshoot_single_pro_yearly", monthlyAmountCents: 2660, originalAmountCents: 3800, monthlyCredits: 300, yearlyAmountCents: 22800, yearlyCredits: 3600, yearlyEquivalentMonthlyCents: 1900, featured: true, bestValue: false, planSubtitle: "More looks for one-person albums", editingLabel: "Advanced editing", generatedPhotos: 40, destinationCount: 4, deliveryDays: 2 },
  { id: "prod_dreamshoot_single_premium", family: "single_premium", name: "Single Premium", audience: "single", monthlyPriceId: "price_dreamshoot_single_premium_monthly", yearlyPriceId: "price_dreamshoot_single_premium_yearly", monthlyAmountCents: 4760, originalAmountCents: 6800, monthlyCredits: 600, yearlyAmountCents: 40800, yearlyCredits: 7200, yearlyEquivalentMonthlyCents: 3400, featured: false, bestValue: true, planSubtitle: "Full creative access for solo albums", editingLabel: "Premium editing and retouching", generatedPhotos: 80, destinationCount: 8, deliveryDays: 1 }
];

const oneTimeProducts = [
  { id: "prod_dreamshoot_one_shot", name: "One-shot trial", priceId: "price_dreamshoot_one_shot", label: "One-shot trial", amountCents: 999, creditsGranted: 40, envName: "MYDREAMSHOOTS_STRIPE_PRICE_ONE_SHOT", manual: "manual_dreamshoot_one_shot", metadata: { oneShot: true, publicReference: "MyDreamShoots one-shot trial" } },
  { id: "prod_dreamshoot_credits_small", name: "Small credit pack", priceId: "price_dreamshoot_credits_small", label: "Small credit pack", amountCents: 1200, creditsGranted: 100, envName: "MYDREAMSHOOTS_STRIPE_PRICE_CREDITS_SMALL", manual: "manual_dreamshoot_credits_small", metadata: { packSize: "small", publicReference: "MyDreamShoots small credit pack" } },
  { id: "prod_dreamshoot_credits_medium", name: "Medium credit pack", priceId: "price_dreamshoot_credits_medium", label: "Medium credit pack", amountCents: 2000, creditsGranted: 200, envName: "MYDREAMSHOOTS_STRIPE_PRICE_CREDITS_MEDIUM", manual: "manual_dreamshoot_credits_medium", metadata: { packSize: "medium", publicReference: "MyDreamShoots medium credit pack" } },
  { id: "prod_dreamshoot_credits_large", name: "Large credit pack", priceId: "price_dreamshoot_credits_large", label: "Large credit pack", amountCents: 3200, creditsGranted: 350, envName: "MYDREAMSHOOTS_STRIPE_PRICE_CREDITS_LARGE", manual: "manual_dreamshoot_credits_large", metadata: { packSize: "large", publicReference: "MyDreamShoots large credit pack" } }
];

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
        metadata: {
          generatedPhotos: plan.generatedPhotos,
          destinationCount: plan.destinationCount,
          deliveryDays: plan.deliveryDays,
          featured: plan.featured,
          planSubtitle: plan.planSubtitle,
          editingLabel: plan.editingLabel,
          originalAmountCents: plan.originalAmountCents,
          discountLabel: "30% off",
          billingCadence: "monthly",
          planFamily: plan.family,
          audience: plan.audience,
          bestValue: plan.bestValue,
          publicReference: `MyDreamShoots ${String(plan.name).toLowerCase()} credit package`
        }
      },
      {
        id: plan.yearlyPriceId,
        siteId,
        productId: plan.id,
        label: `${plan.name} yearly`,
        amountCents: plan.yearlyAmountCents,
        currency: "usd",
        interval: "year",
        creditsGranted: plan.yearlyCredits,
        stripePriceId: envOrManualPrice(`MYDREAMSHOOTS_STRIPE_PRICE_${plan.family.toUpperCase()}_YEARLY`, `manual_${plan.yearlyPriceId}`),
        metadata: {
          generatedPhotos: plan.generatedPhotos,
          destinationCount: plan.destinationCount,
          deliveryDays: plan.deliveryDays,
          featured: plan.featured,
          planSubtitle: plan.planSubtitle,
          editingLabel: plan.editingLabel,
          originalAmountCents: plan.originalAmountCents * 12,
          discountLabel: "Pay 6, get 12",
          billingCadence: "yearly",
          yearlyEquivalentMonthlyCents: plan.yearlyEquivalentMonthlyCents,
          yearlySavingsLabel: "6 months free",
          planFamily: plan.family,
          audience: plan.audience,
          bestValue: plan.bestValue,
          publicReference: `MyDreamShoots ${String(plan.name).toLowerCase()} yearly credit package`
        }
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

function replaceWhere(items, predicate, nextItems) {
  return [...items.filter((item) => !predicate(item)), ...nextItems];
}

function updateJsonState(products) {
  if (!fs.existsSync(statePath)) return false;
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const before = JSON.stringify(state.products ?? []);
  state.products = replaceWhere(state.products ?? [], (item) => item.siteId === siteId, products);
  const changed = before !== JSON.stringify(state.products ?? []);
  if (changed) fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return changed;
}

async function updatePostgres(products) {
  const site = await prisma.site.findFirst({
    where: { OR: [{ id: siteId }, { slug: { in: ["mydreamshoots", "dreamshoot"] } }, { primaryDomain: "www.mydreamshoots.com" }] },
    select: { id: true }
  });
  if (!site) throw new Error("MyDreamShoots site not found");

  const activeProductIds = products.map((product) => product.id);
  await prisma.price.deleteMany({ where: { siteId: site.id, productId: { notIn: activeProductIds } } });
  await prisma.product.deleteMany({ where: { siteId: site.id, id: { notIn: activeProductIds } } });

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      create: { id: product.id, siteId: site.id, name: product.name, type: product.type, status: product.status },
      update: { name: product.name, type: product.type, status: product.status }
    });
    const activePriceIds = product.prices.map((price) => price.id);
    await prisma.price.deleteMany({ where: { siteId: site.id, productId: product.id, id: { notIn: activePriceIds } } });
    for (const price of product.prices) {
      await prisma.price.upsert({
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
  return { siteId: site.id, products: products.length, prices: products.reduce((sum, product) => sum + product.prices.length, 0) };
}

function removeStateCaches() {
  for (const dir of [".next", ".next-dev", ".next-3002", ".next-docx-verify"]) {
    const cacheFile = path.join(process.cwd(), dir, "cache/platform-state-postgres.json");
    if (fs.existsSync(cacheFile)) fs.rmSync(cacheFile, { force: true });
  }
}

async function main() {
  const products = buildProducts();
  const jsonChanged = updateJsonState(products);
  const postgres = await updatePostgres(products);
  removeStateCaches();
  console.log(JSON.stringify({ ok: true, jsonChanged, postgres }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
