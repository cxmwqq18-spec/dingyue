import "server-only";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreditLedgerEntry, Customer, Order, PaymentEvent, Price, Product, Subscription } from "@/lib/types";
import { StoreError } from "@/lib/server-store";
import { mapCreditLedger, mapCustomer, mapPaymentEvent, mapPrice, mapProduct } from "@/lib/stores/prisma-mappers";
import { clearSiteReadCache } from "@/lib/stores/site-store";
import { fakeStripePriceAdapter, verifyPriceReadOnly, type StripePriceReadAdapter } from "@/lib/stripe-price-verification";
import { clearStorefrontContextCache, isPublicPriceFact } from "@/lib/storefront-context";

type Tx = Prisma.TransactionClient;
const validPriceIntervals = ["month", "quarter", "half_year", "year", "one_time"] as const;
const billingTransactionOptions = { maxWait: 10000, timeout: 20000 } as const;

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
}

function normalizedProductMetadata(metadata: Product["metadata"] | undefined): Product["metadata"] {
  if (!metadata) return undefined;
  const capabilities = metadata.capabilities
    ? Object.fromEntries(Object.entries(metadata.capabilities).filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean"))
    : undefined;
  return {
    ...(metadata.summary?.trim() ? { summary: metadata.summary.trim() } : {}),
    ...(metadata.features?.map((value) => value.trim()).filter(Boolean).length ? { features: metadata.features.map((value) => value.trim()).filter(Boolean) } : {}),
    ...(capabilities && Object.keys(capabilities).length ? { capabilities } : {}),
    ...(metadata.badgeLabel?.trim() ? { badgeLabel: metadata.badgeLabel.trim() } : {}),
    ...(metadata.buttonLabel?.trim() ? { buttonLabel: metadata.buttonLabel.trim() } : {}),
    ...(Number.isFinite(metadata.sortOrder) ? { sortOrder: Math.trunc(metadata.sortOrder as number) } : {})
  };
}

function isSubscriptionInterval(interval: Price["interval"] | string): boolean {
  return interval === "month" || interval === "quarter" || interval === "half_year" || interval === "year";
}

function periodEndForInterval(interval: Price["interval"] | string): Date {
  const periodEnd = new Date();
  if (interval === "year") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else if (interval === "half_year") {
    periodEnd.setMonth(periodEnd.getMonth() + 6);
  } else if (interval === "quarter") {
    periodEnd.setMonth(periodEnd.getMonth() + 3);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }
  return periodEnd;
}

async function readCustomerForUpdate(tx: Tx, siteId: string, customerId: string) {
  const customer = await tx.customer.findFirst({
    where: { id: customerId, siteId },
    include: { balance: true }
  });
  if (!customer) throw new StoreError("customer_not_found_for_site", 404);
  if (!customer.balance) {
    await tx.creditBalance.createMany({
      data: [{ id: uid("bal"), siteId, customerId, balance: 0, reserved: 0 }],
      skipDuplicates: true
    });
    return tx.customer.findFirstOrThrow({ where: { id: customerId, siteId }, include: { balance: true } });
  }
  return customer;
}

async function readPublicPriceForCheckout(tx: Tx, siteId: string, priceId: string) {
  const site = await tx.site.findUnique({ where: { id: siteId }, select: { currency: true } });
  if (!site) throw new StoreError("site_not_found", 404);
  const candidate = await tx.price.findFirst({
    where: { siteId, id: priceId },
    select: { productId: true, interval: true }
  });
  if (!candidate) throw new StoreError("price_not_found_for_site", 404);
  // Price activation and edits use the same product/interval lock. Re-read after
  // acquiring it so an archive cannot race an order or subscription grant.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${siteId}:${candidate.productId}:${candidate.interval}`}))`;
  const price = await tx.price.findFirst({
    where: { siteId, id: priceId },
    include: { product: { include: { prices: true } } }
  });
  if (!price || price.product.siteId !== siteId) throw new StoreError("price_not_found_for_site", 404);
  const now = Date.now();
  const publicPrice = isPublicPriceFact(price, new Date(now), site.currency);
  if (!publicPrice) throw new StoreError("price_not_public", 409);
  if (price.product.status !== "active") throw new StoreError("product_not_active", 409);
  if (!Number.isInteger(price.creditsGranted) || price.creditsGranted <= 0) throw new StoreError("price_has_no_credits", 409);
  return price;
}

export async function getSiteBillingState(siteId: string): Promise<{
  products: Product[];
  customers: Customer[];
  ledger: CreditLedgerEntry[];
}> {
  const [products, customers, ledger] = await prisma.$transaction([
    prisma.product.findMany({ where: { siteId }, include: { prices: true }, orderBy: { id: "asc" } }),
    prisma.customer.findMany({ where: { siteId }, include: { balance: true }, orderBy: { id: "asc" } }),
    prisma.creditLedger.findMany({ where: { siteId }, orderBy: { createdAt: "desc" } })
  ]);
  return {
    products: products.map(mapProduct),
    customers: customers.map(mapCustomer),
    ledger: ledger.map(mapCreditLedger)
  };
}

export async function upsertProductPriceRelational(params: {
  siteId: string;
  productId: string;
  priceId?: string;
  label: string;
  amountCents: number;
  currency: string;
  interval: Price["interval"];
  creditsGranted: number;
  stripePriceId?: string;
  metadata?: Price["metadata"];
}): Promise<{ price: Price }> {
  const priceId = params.priceId ?? uid("price");
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`price:${priceId}`}))`;
    const product = await tx.product.findFirst({ where: { id: params.productId, siteId: params.siteId } });
    if (!product) throw new StoreError("product_not_found", 404);
    const label = params.label.trim();
    const currency = params.currency.trim().toLowerCase();
    if (!label) throw new StoreError("price_label_required", 400);
    if (!Number.isInteger(params.amountCents) || params.amountCents < 0) throw new StoreError("invalid_price_amount", 400);
    if (!currency) throw new StoreError("invalid_price_currency", 400);
    if (!validPriceIntervals.includes(params.interval)) throw new StoreError("invalid_price_interval", 400);
    if (!Number.isInteger(params.creditsGranted) || params.creditsGranted < 0) throw new StoreError("invalid_credits_granted", 400);

    const stripePriceId = params.stripePriceId?.trim() || `manual_${priceId}`;
    const existing = params.priceId
      ? await tx.price.findUnique({ where: { id: params.priceId } })
      : undefined;
    if (existing && (existing.siteId !== params.siteId || existing.productId !== params.productId)) throw new StoreError("price_product_mismatch", 409);
    const intervalLocks = Array.from(new Set([existing?.interval, params.interval].filter(Boolean) as string[])).sort();
    for (const interval of intervalLocks) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${params.siteId}:${params.productId}:${interval}`}))`;
    }
    const isReferenced = existing
      ? (await Promise.all([
          tx.subscription.count({ where: { priceId: existing.id } }),
          tx.order.count({ where: { priceId: existing.id } })
        ])).some((count) => count > 0)
      : false;
    const immutableEconomics = Boolean(existing && (existing.status !== "draft" || isReferenced));
    if (immutableEconomics && existing && (existing.amountCents !== params.amountCents || existing.currency !== currency || existing.interval !== params.interval || existing.creditsGranted !== params.creditsGranted || (existing.stripePriceId ?? `manual_${existing.id}`) !== stripePriceId)) {
      throw new StoreError("active_price_immutable", 409);
    }
    const replacedPrice = existing ? undefined : await tx.price.findFirst({
      where: { siteId: params.siteId, productId: params.productId, interval: params.interval, status: "active" },
      orderBy: { effectiveFrom: "desc" },
      select: { id: true }
    });
    const row = await tx.price.upsert({
      where: { id: priceId },
      create: {
        id: priceId,
        siteId: params.siteId,
        productId: params.productId,
        label,
        stripePriceId,
        metadata: params.metadata ? (params.metadata as Prisma.InputJsonObject) : undefined,
        currency,
        amountCents: params.amountCents,
        interval: params.interval,
        creditsGranted: params.creditsGranted,
        status: "draft",
        replacesPriceId: replacedPrice?.id
      },
      update: {
        label,
        ...(immutableEconomics ? {} : { stripePriceId }),
        metadata: params.metadata ? (params.metadata as Prisma.InputJsonObject) : undefined,
        ...(immutableEconomics ? {} : { currency, amountCents: params.amountCents, interval: params.interval, creditsGranted: params.creditsGranted, status: "draft" })
      }
    });
    if (row.siteId !== params.siteId || row.productId !== params.productId) throw new StoreError("price_product_mismatch", 409);
    return { price: mapPrice(row, { label, metadata: params.metadata, stripePriceId }) };
  }, billingTransactionOptions);
  clearStorefrontContextCache(params.siteId);
  clearSiteReadCache();
  return result;
}

export async function activateProductPriceRelational(params: {
  siteId: string;
  productId: string;
  priceId: string;
  adapter?: StripePriceReadAdapter;
}): Promise<{ price: Price; archivedPriceIds: string[] }> {
  const [source, site] = await Promise.all([
    prisma.price.findFirst({ where: { id: params.priceId, siteId: params.siteId, productId: params.productId } }),
    prisma.site.findUnique({ where: { id: params.siteId }, select: { currency: true } })
  ]);
  if (!site) throw new StoreError("site_not_found", 404);
  if (!source) throw new StoreError("price_not_found", 404);
  if (source.currency.trim().toLowerCase() !== site.currency.trim().toLowerCase()) throw new StoreError("price_currency_mismatch", 409);
  if (source.status === "active") return { price: mapPrice(source), archivedPriceIds: [] };
  if (source.status !== "draft") throw new StoreError("price_not_activatable", 409);
  let verification: Awaited<ReturnType<typeof verifyPriceReadOnly>>;
  try {
    verification = await verifyPriceReadOnly({ price: { ...mapPrice(source), stripePriceId: source.stripePriceId ?? `manual_${source.id}` }, adapter: params.adapter ?? fakeStripePriceAdapter });
  } catch (error) {
    throw new StoreError(error instanceof Error ? error.message : "stripe_price_verification_failed", 409);
  }
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`price:${source.id}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${params.siteId}:${params.productId}:${source.interval}`}))`;
    const current = await tx.price.findFirst({ where: { id: source.id, siteId: params.siteId, productId: params.productId } });
    if (!current) throw new StoreError("price_not_found", 404);
    const currentSite = await tx.site.findUnique({ where: { id: params.siteId }, select: { currency: true } });
    if (!currentSite || current.currency.trim().toLowerCase() !== currentSite.currency.trim().toLowerCase()) throw new StoreError("price_currency_mismatch", 409);
    if (current.status === "active") return { price: mapPrice(current), archivedPriceIds: [] };
    if (
      current.status !== "draft" ||
      current.amountCents !== source.amountCents ||
      current.currency !== source.currency ||
      current.interval !== source.interval ||
      current.creditsGranted !== source.creditsGranted ||
      current.stripePriceId !== source.stripePriceId
    ) {
      throw new StoreError("price_changed_during_provider_verification", 409);
    }
    const now = new Date();
    const previous = await tx.price.findMany({
      where: { siteId: params.siteId, productId: params.productId, interval: source.interval, status: "active", id: { not: source.id } },
      select: { id: true }
    });
    if (previous.length) {
      await tx.price.updateMany({
        where: { id: { in: previous.map((item) => item.id) } },
        data: { status: "archived", effectiveTo: now }
      });
    }
    const row = await tx.price.update({
      where: { id: source.id },
      data: {
        status: "active",
        effectiveFrom: now,
        effectiveTo: null,
        providerVerifiedAt: now,
        providerFingerprint: verification.fingerprint
      }
    });
    return { price: mapPrice(row), archivedPriceIds: previous.map((item) => item.id) };
  }, billingTransactionOptions);
  clearStorefrontContextCache(params.siteId);
  clearSiteReadCache();
  return result;
}

export async function createProductWithPriceRelational(params: {
  siteId: string;
  name: string;
  type: Product["type"];
  status: Product["status"];
  metadata?: Product["metadata"];
  price: {
    label: string;
    amountCents: number;
    currency: string;
    interval: Price["interval"];
    creditsGranted: number;
    stripePriceId?: string;
    metadata?: Price["metadata"];
  };
}): Promise<{ product: Product }> {
  const result = await prisma.$transaction(async (tx) => {
    const site = await tx.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
    if (!site) throw new StoreError("site_not_found", 404);
    const name = params.name.trim();
    const label = params.price.label.trim();
    const currency = params.price.currency.trim().toLowerCase();
    if (name.length < 2) throw new StoreError("product_name_required", 400);
    if (!["subscription", "credit_pack"].includes(params.type)) throw new StoreError("invalid_product_type", 400);
    if (!["active", "draft"].includes(params.status)) throw new StoreError("invalid_product_status", 400);
    if (!label) throw new StoreError("price_label_required", 400);
    if (!Number.isInteger(params.price.amountCents) || params.price.amountCents < 0) throw new StoreError("invalid_price_amount", 400);
    if (!currency) throw new StoreError("invalid_price_currency", 400);
    if (!validPriceIntervals.includes(params.price.interval)) throw new StoreError("invalid_price_interval", 400);
    if (!Number.isInteger(params.price.creditsGranted) || params.price.creditsGranted < 0) throw new StoreError("invalid_credits_granted", 400);

    const productId = uid("prod");
    const priceId = uid("price");
    const stripePriceId = params.price.stripePriceId?.trim() || `manual_${priceId}`;
    const product = await tx.product.create({
      data: {
        id: productId,
        siteId: params.siteId,
        name,
        type: params.type,
        status: params.status,
        metadata: normalizedProductMetadata(params.metadata) as Prisma.InputJsonObject | undefined,
        prices: {
          create: {
            id: priceId,
            siteId: params.siteId,
            label,
            stripePriceId,
            metadata: params.price.metadata ? (params.price.metadata as Prisma.InputJsonObject) : undefined,
            currency,
            amountCents: params.price.amountCents,
            interval: params.price.interval,
            creditsGranted: params.price.creditsGranted,
            status: "draft"
          }
        }
      },
      include: { prices: true }
    });
    return { product: mapProduct(product) };
  }, billingTransactionOptions);
  clearStorefrontContextCache(params.siteId);
  clearSiteReadCache();
  return result;
}

export async function updateProductRelational(params: {
  siteId: string;
  productId: string;
  name: string;
  status: Product["status"];
  metadata?: Product["metadata"];
}): Promise<{ product: Product }> {
  const name = params.name.trim();
  if (name.length < 2) throw new StoreError("product_name_required", 400);
  if (!(["active", "draft"] as const).includes(params.status)) throw new StoreError("invalid_product_status", 400);
  const existing = await prisma.product.findFirst({ where: { id: params.productId, siteId: params.siteId } });
  if (!existing) throw new StoreError("product_not_found", 404);
  const row = await prisma.product.update({
    where: { id: params.productId },
    data: {
      name,
      status: params.status,
      metadata: normalizedProductMetadata(params.metadata) as Prisma.InputJsonObject | undefined
    },
    include: { prices: true }
  });
  clearStorefrontContextCache(params.siteId);
  clearSiteReadCache();
  return { product: mapProduct(row) };
}

export async function deleteProductPriceRelational(params: {
  siteId: string;
  productId: string;
  priceId: string;
}): Promise<{ deletedPrice: Price }> {
  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: params.productId, siteId: params.siteId }, include: { prices: true } });
    if (!product) throw new StoreError("product_not_found", 404);
    const price = product.prices.find((item) => item.id === params.priceId);
    if (!price) throw new StoreError("price_not_found", 404);
    const isReferenced = (await Promise.all([
      tx.subscription.count({ where: { priceId: price.id } }),
      tx.order.count({ where: { priceId: price.id } })
    ])).some((count) => count > 0);
    if (price.status === "active" || price.status === "archived" || isReferenced) {
      const archived = await tx.price.update({ where: { id: price.id }, data: { status: "archived", effectiveTo: new Date() } });
      return { deletedPrice: mapPrice(archived) };
    }
    if (product.prices.length <= 1) throw new StoreError("product_requires_at_least_one_price", 409);
    await tx.price.delete({ where: { id: params.priceId } });
    return { deletedPrice: mapPrice(price) };
  }, billingTransactionOptions);
  clearStorefrontContextCache(params.siteId);
  clearSiteReadCache();
  return result;
}

export async function adjustCustomerCreditsRelational(params: {
  siteId: string;
  customerId: string;
  amount: number;
  reason: string;
  actor?: string;
  sourceId?: string;
}): Promise<{ customer: Customer; ledger: CreditLedgerEntry }> {
  return prisma.$transaction(async (tx) => {
    if (!Number.isInteger(params.amount) || params.amount === 0) throw new StoreError("invalid_adjustment_amount", 400);
    const reason = params.reason.trim();
    if (reason.length < 3) throw new StoreError("adjustment_reason_required", 400);
    const customer = await readCustomerForUpdate(tx, params.siteId, params.customerId);
    const currentAvailable = customer.balance?.balance ?? 0;
    if (currentAvailable + params.amount < 0) throw new StoreError("adjustment_would_make_negative_balance", 409);

    const sourceId = params.sourceId ?? uid("adj");
    const sourceType = `site_admin_adjustment:${params.actor ?? "site_admin_demo"}:${reason.slice(0, 80)}`;
    let ledger = await tx.creditLedger.findFirst({
      where: { siteId: params.siteId, customerId: params.customerId, type: "adjustment", sourceId }
    });
    if (!ledger) {
      ledger = await tx.creditLedger.create({
        data: {
          id: uid("led"),
          siteId: params.siteId,
          customerId: params.customerId,
          amount: params.amount,
          type: "adjustment",
          sourceType,
          sourceId
        }
      });
      const updated = await tx.creditBalance.updateMany({
        where: {
          customerId: params.customerId,
          siteId: params.siteId,
          balance: params.amount < 0 ? { gte: Math.abs(params.amount) } : undefined
        },
        data: { balance: { increment: params.amount } }
      });
      if (updated.count !== 1) throw new StoreError("adjustment_would_make_negative_balance", 409);
    }
    const updatedCustomer = await tx.customer.findFirstOrThrow({ where: { id: params.customerId, siteId: params.siteId }, include: { balance: true } });
    return { customer: mapCustomer(updatedCustomer), ledger: mapCreditLedger(ledger) };
  }, billingTransactionOptions);
}

function mapOrder(row: Prisma.OrderGetPayload<object>): Order {
  return {
    id: row.id,
    siteId: row.siteId,
    customerId: row.customerId,
    priceId: row.priceId ?? undefined,
    status: row.status as Order["status"],
    amountCents: row.amountCents,
    currency: row.currency,
    credits: row.credits,
    sourceId: row.sourceId,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
  };
}

function mapSubscription(row: Prisma.SubscriptionGetPayload<object>): Subscription {
  return {
    id: row.id,
    siteId: row.siteId,
    customerId: row.customerId,
    productId: row.productId,
    priceId: row.priceId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    status: row.status as Subscription["status"],
    currentPeriodEnd: row.currentPeriodEnd instanceof Date ? row.currentPeriodEnd.toISOString() : String(row.currentPeriodEnd),
    creditsPerCycle: row.creditsPerCycle,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
  };
}

export async function completeAdminCheckoutRelational(params: {
  siteId: string;
  customerId: string;
  priceId: string;
  actor?: string;
  intentId?: string;
}): Promise<{ customer: Customer; order: Order; ledger: CreditLedgerEntry; subscription?: Subscription; grantedCredits: number }> {
  const intentId = params.intentId?.trim().replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 120);
  const sourceId = intentId ? `admin_comp:${intentId}` : `admin_comp:${uid("intent")}`;
  return prisma.$transaction(async (tx) => {
    await readCustomerForUpdate(tx, params.siteId, params.customerId);
    const price = await readPublicPriceForCheckout(tx, params.siteId, params.priceId);

    await tx.order.createMany({
      data: [{
        id: uid("ord"),
        siteId: params.siteId,
        customerId: params.customerId,
        priceId: price.id,
        status: "fulfilled",
        amountCents: price.amountCents,
        currency: price.currency,
        credits: price.creditsGranted,
        sourceId
      }],
      skipDuplicates: true
    });
    const orderRow = await tx.order.findFirstOrThrow({ where: { siteId: params.siteId, customerId: params.customerId, sourceId } });
    const ledgerInsert = await tx.creditLedger.createMany({
      data: [{
        id: uid("led"),
        siteId: params.siteId,
        customerId: params.customerId,
        amount: orderRow.credits,
        type: "grant",
        sourceType: `admin_comp_checkout:${params.actor ?? "customer_admin"}`,
        sourceId: orderRow.id
      }],
      skipDuplicates: true
    });
    if (ledgerInsert.count === 1) {
      await tx.creditBalance.update({
        where: { customerId: params.customerId },
        data: { balance: { increment: orderRow.credits } }
      });
      if (isSubscriptionInterval(price.interval) || price.product.type === "subscription") {
        const periodEnd = periodEndForInterval(price.interval);
        await tx.subscription.updateMany({
          where: {
            siteId: params.siteId,
            customerId: params.customerId,
            productId: price.productId,
            status: { in: ["trialing", "active", "past_due"] },
            stripeSubscriptionId: { not: `admin_comp_${orderRow.id}` }
          },
          data: { status: "canceled" }
        });
        await tx.subscription.createMany({
          data: [{
            id: uid("sub"),
            siteId: params.siteId,
            customerId: params.customerId,
            productId: price.productId,
            priceId: price.id,
            stripeSubscriptionId: `admin_comp_${orderRow.id}`,
            status: "active",
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
            creditsPerCycle: orderRow.credits
          }],
          skipDuplicates: true
        });
      }
    }
    const [ledgerRow, subscriptionRow, updatedCustomer] = await Promise.all([
      tx.creditLedger.findFirstOrThrow({ where: { siteId: params.siteId, customerId: params.customerId, type: "grant", sourceId: orderRow.id } }),
      tx.subscription.findFirst({ where: { siteId: params.siteId, customerId: params.customerId, stripeSubscriptionId: `admin_comp_${orderRow.id}` } }),
      tx.customer.findFirstOrThrow({ where: { id: params.customerId, siteId: params.siteId }, include: { balance: true } })
    ]);
    return {
      customer: mapCustomer(updatedCustomer),
      order: mapOrder(orderRow),
      ledger: mapCreditLedger(ledgerRow),
      subscription: subscriptionRow ? mapSubscription(subscriptionRow) : undefined,
      grantedCredits: orderRow.credits
    };
  }, billingTransactionOptions);
}

function checkoutSourceId(intentId?: string): string {
  const safeIntentId = intentId?.trim().replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 120);
  return safeIntentId ? `stripe_checkout:${safeIntentId}` : `stripe_checkout:${uid("intent")}`;
}

export async function startCustomerCheckoutRelational(params: {
  siteId: string;
  customerId: string;
  priceId: string;
  intentId?: string;
}): Promise<{ customer: Customer; order: Order; price: Price; product: Product; metadata: Record<string, string> }> {
  return prisma.$transaction(async (tx) => {
    const customer = await readCustomerForUpdate(tx, params.siteId, params.customerId);
    const price = await readPublicPriceForCheckout(tx, params.siteId, params.priceId);

    const sourceId = checkoutSourceId(params.intentId);
    await tx.order.createMany({
      data: [{
        id: uid("ord"),
        siteId: params.siteId,
        customerId: params.customerId,
        priceId: price.id,
        status: "checkout_started",
        amountCents: price.amountCents,
        currency: price.currency,
        credits: price.creditsGranted,
        sourceId
      }],
      skipDuplicates: true
    });
    const order = await tx.order.findFirstOrThrow({ where: { siteId: params.siteId, customerId: params.customerId, sourceId } });

    return {
      customer: mapCustomer(customer),
      order: mapOrder(order),
      price: mapPrice(price),
      product: mapProduct(price.product),
      metadata: {
        siteId: params.siteId,
        customerId: params.customerId,
        priceId: price.id,
        orderId: order.id,
        creditsGranted: String(price.creditsGranted),
        fulfillment: "credits_ledger_grant"
      }
    };
  }, billingTransactionOptions);
}

export async function recordStripeWebhookRelational(payload: {
  id?: string;
  type?: string;
  account?: string;
  data?: {
    object?: {
      id?: string;
      subscription?: string;
      metadata?: { siteId?: string; customerId?: string; priceId?: string; orderId?: string; creditsGranted?: string };
    };
  };
}): Promise<{ event: PaymentEvent; siteId: string; alreadyProcessed: boolean; ledger?: CreditLedgerEntry; order?: Order; subscription?: Subscription }> {
  if (!payload.id || !payload.type) throw new StoreError("invalid_webhook_payload", 400);
  const providerEventId = payload.id;
  const eventType = payload.type;
  return prisma.$transaction(async (tx) => {
    const siteId =
      payload.data?.object?.metadata?.siteId ??
      (payload.account
        ? (await tx.stripeConnectAccount.findFirst({ where: { stripeAccountId: payload.account }, select: { siteId: true } }))?.siteId
        : undefined);
    if (!siteId) throw new StoreError("site_not_found_for_webhook", 400);

    const metadata = payload.data?.object?.metadata;
    const paymentEventInsert = await tx.paymentEvent.createMany({
      data: [{
        id: uid("payevt"),
        siteId,
        provider: "stripe",
        providerEventId,
        eventType,
        processedAt: new Date(),
        payload: payload as Prisma.InputJsonObject
      }],
      skipDuplicates: true
    });
    const event = await tx.paymentEvent.findUniqueOrThrow({
      where: { siteId_provider_providerEventId: { siteId, provider: "stripe", providerEventId } }
    });
    if (paymentEventInsert.count === 0) {
      const existingOrder = metadata?.orderId
        ? await tx.order.findFirst({ where: { siteId, id: metadata.orderId } })
        : null;
      const ledger = await tx.creditLedger.findFirst({
        where: {
          siteId,
          sourceType: "stripe_webhook",
          sourceId: existingOrder?.id ?? providerEventId
        }
      });
      return {
        event: mapPaymentEvent(event),
        siteId,
        alreadyProcessed: true,
        ledger: ledger ? mapCreditLedger(ledger) : undefined,
        order: existingOrder ? mapOrder(existingOrder) : undefined
      };
    }

    const paidEvent = ["checkout.session.completed", "invoice.paid", "payment_intent.succeeded"].includes(eventType);
    const customer = metadata?.customerId
      ? await tx.customer.findFirst({ where: { siteId, id: metadata.customerId }, include: { balance: true } })
      : null;
    const price = metadata?.priceId
      ? await tx.price.findFirst({
          where: {
            siteId,
            OR: [{ id: metadata.priceId }, { stripePriceId: metadata.priceId }]
          }
        })
      : null;
    const credits = Number(metadata?.creditsGranted ?? price?.creditsGranted ?? 0);
    if (!paidEvent || !customer || !Number.isFinite(credits) || credits <= 0) {
      return { event: mapPaymentEvent(event), siteId, alreadyProcessed: false };
    }

    await readCustomerForUpdate(tx, siteId, customer.id);
    let order = metadata?.orderId
      ? await tx.order.findFirst({ where: { siteId, id: metadata.orderId, customerId: customer.id } })
      : null;
    if (!order) {
      const orderSourceId = `stripe_webhook:${providerEventId}`;
      await tx.order.createMany({
        data: [{
          id: uid("ord"),
          siteId,
          customerId: customer.id,
          priceId: price?.id,
          status: "checkout_started",
          amountCents: price?.amountCents ?? 0,
          currency: price?.currency ?? "usd",
          credits,
          sourceId: orderSourceId
        }],
        skipDuplicates: true
      });
      order = await tx.order.findFirstOrThrow({ where: { siteId, customerId: customer.id, sourceId: orderSourceId } });
    }

    const ledgerInsert = await tx.creditLedger.createMany({
      data: [{
        id: uid("led"),
        siteId,
        customerId: customer.id,
        amount: credits,
        type: "grant",
        sourceType: "stripe_webhook",
        sourceId: order.id
      }],
      skipDuplicates: true
    });
    const ledger = await tx.creditLedger.findFirstOrThrow({
      where: { siteId, customerId: customer.id, type: "grant", sourceId: order.id }
    });
    if (ledgerInsert.count === 1) {
      await tx.creditBalance.update({
        where: { customerId: customer.id },
        data: { balance: { increment: credits } }
      });
    }
    const fulfilledOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "fulfilled",
        priceId: price?.id ?? order.priceId,
        amountCents: price?.amountCents ?? order.amountCents,
        currency: price?.currency ?? order.currency,
        credits
      }
    });

    let subscriptionRow: Prisma.SubscriptionGetPayload<object> | undefined;
    if (price && (isSubscriptionInterval(price.interval) || price.productId)) {
      const product = await tx.product.findFirst({ where: { siteId, id: price.productId } });
      if (product?.type === "subscription" || isSubscriptionInterval(price.interval)) {
        const periodEnd = periodEndForInterval(price.interval);
        const stripeSubscriptionId =
          payload.data?.object?.subscription ??
          (payload.data?.object?.id?.startsWith("sub_") ? payload.data.object.id : undefined) ??
          `stripe_event_${providerEventId}`;
        await tx.subscription.updateMany({
          where: {
            siteId,
            customerId: customer.id,
            productId: price.productId,
            status: { in: ["trialing", "active", "past_due"] },
            stripeSubscriptionId: { not: stripeSubscriptionId }
          },
          data: { status: "canceled" }
        });
        subscriptionRow = await tx.subscription.upsert({
          where: { stripeSubscriptionId },
          create: {
            id: uid("sub"),
            siteId,
            customerId: customer.id,
            productId: price.productId,
            priceId: price.id,
            stripeSubscriptionId,
            status: "active",
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
            creditsPerCycle: credits
          },
          update: {
            status: "active",
            priceId: price.id,
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
            creditsPerCycle: credits
          }
        });
      }
    }
    return {
      event: mapPaymentEvent(event),
      siteId,
      alreadyProcessed: false,
      ledger: mapCreditLedger(ledger),
      order: mapOrder(fulfilledOrder),
      subscription: subscriptionRow ? mapSubscription(subscriptionRow) : undefined
    };
  }, billingTransactionOptions);
}
