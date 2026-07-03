import "server-only";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreditLedgerEntry, Customer, Order, PaymentEvent, Price, Product, Subscription } from "@/lib/types";
import { StoreError } from "@/lib/server-store";
import { mapCreditLedger, mapCustomer, mapPaymentEvent, mapPrice, mapProduct } from "@/lib/stores/prisma-mappers";

type Tx = Prisma.TransactionClient;
const validPriceIntervals = ["month", "year", "one_time"] as const;

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
}

function isSubscriptionInterval(interval: Price["interval"] | string): boolean {
  return interval === "month" || interval === "year";
}

function periodEndForInterval(interval: Price["interval"] | string): Date {
  const periodEnd = new Date();
  if (interval === "year") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
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
    await tx.creditBalance.create({
      data: { id: uid("bal"), siteId, customerId, balance: 0, reserved: 0 }
    });
    return tx.customer.findFirstOrThrow({ where: { id: customerId, siteId }, include: { balance: true } });
  }
  return customer;
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
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: params.productId, siteId: params.siteId } });
    if (!product) throw new StoreError("product_not_found", 404);
    const label = params.label.trim();
    const currency = params.currency.trim().toLowerCase();
    if (!label) throw new StoreError("price_label_required", 400);
    if (!Number.isInteger(params.amountCents) || params.amountCents < 0) throw new StoreError("invalid_price_amount", 400);
    if (!currency) throw new StoreError("invalid_price_currency", 400);
    if (!validPriceIntervals.includes(params.interval)) throw new StoreError("invalid_price_interval", 400);
    if (!Number.isInteger(params.creditsGranted) || params.creditsGranted < 0) throw new StoreError("invalid_credits_granted", 400);

    const priceId = params.priceId ?? uid("price");
    const stripePriceId = params.stripePriceId?.trim() || `manual_${priceId}`;
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
        creditsGranted: params.creditsGranted
      },
      update: {
        label,
        stripePriceId,
        metadata: params.metadata ? (params.metadata as Prisma.InputJsonObject) : undefined,
        currency,
        amountCents: params.amountCents,
        interval: params.interval,
        creditsGranted: params.creditsGranted
      }
    });
    if (row.siteId !== params.siteId || row.productId !== params.productId) throw new StoreError("price_product_mismatch", 409);
    return { price: mapPrice(row, { label, metadata: params.metadata, stripePriceId }) };
  });
}

export async function createProductWithPriceRelational(params: {
  siteId: string;
  name: string;
  type: Product["type"];
  status: Product["status"];
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
  return prisma.$transaction(async (tx) => {
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
            creditsGranted: params.price.creditsGranted
          }
        }
      },
      include: { prices: true }
    });
    return { product: mapProduct(product) };
  });
}

export async function deleteProductPriceRelational(params: {
  siteId: string;
  productId: string;
  priceId: string;
}): Promise<{ deletedPrice: Price }> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: params.productId, siteId: params.siteId }, include: { prices: true } });
    if (!product) throw new StoreError("product_not_found", 404);
    const price = product.prices.find((item) => item.id === params.priceId);
    if (!price) throw new StoreError("price_not_found", 404);
    if (product.prices.length <= 1) throw new StoreError("product_requires_at_least_one_price", 409);
    await tx.price.delete({ where: { id: params.priceId } });
    return { deletedPrice: mapPrice(price) };
  });
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
  });
}

function mapOrder(row: Prisma.OrderGetPayload<object>): Order {
  return {
    id: row.id,
    siteId: row.siteId,
    customerId: row.customerId,
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
  return prisma.$transaction(async (tx) => {
    const customer = await readCustomerForUpdate(tx, params.siteId, params.customerId);
    const price = await tx.price.findFirst({
      where: { siteId: params.siteId, id: params.priceId },
      include: { product: true }
    });
    if (!price || price.product.siteId !== params.siteId) throw new StoreError("price_not_found_for_site", 404);
    if (price.product.status !== "active") throw new StoreError("product_not_active", 409);
    if (!Number.isInteger(price.creditsGranted) || price.creditsGranted <= 0) throw new StoreError("price_has_no_credits", 409);

    const intentId = params.intentId?.trim().replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 120);
    const sourceId = intentId ? `admin_comp:${intentId}` : `admin_comp:${uid("intent")}`;
    const existingOrder = await tx.order.findFirst({
      where: { siteId: params.siteId, customerId: params.customerId, sourceId }
    });
    if (existingOrder) {
      const [existingLedger, existingSubscription, updatedCustomer] = await Promise.all([
        tx.creditLedger.findFirst({ where: { siteId: params.siteId, customerId: params.customerId, sourceType: { startsWith: "admin_comp_checkout" }, sourceId: existingOrder.id } }),
        tx.subscription.findFirst({ where: { siteId: params.siteId, customerId: params.customerId, stripeSubscriptionId: `admin_comp_${existingOrder.id}` } }),
        tx.customer.findFirstOrThrow({ where: { id: params.customerId, siteId: params.siteId }, include: { balance: true } })
      ]);
      if (!existingLedger) throw new StoreError("admin_checkout_ledger_missing", 409);
      return {
        customer: mapCustomer(updatedCustomer),
        order: mapOrder(existingOrder),
        ledger: mapCreditLedger(existingLedger),
        subscription: existingSubscription ? mapSubscription(existingSubscription) : undefined,
        grantedCredits: existingOrder.credits
      };
    }

    const orderId = uid("ord");
    const orderRow = await tx.order.create({
      data: {
        id: orderId,
        siteId: params.siteId,
        customerId: params.customerId,
        status: "fulfilled",
        amountCents: price.amountCents,
        currency: price.currency,
        credits: price.creditsGranted,
        sourceId
      }
    });

    const ledgerRow = await tx.creditLedger.create({
      data: {
        id: uid("led"),
        siteId: params.siteId,
        customerId: params.customerId,
        amount: price.creditsGranted,
        type: "grant",
        sourceType: `admin_comp_checkout:${params.actor ?? "customer_admin"}`,
        sourceId: orderId
      }
    });

    await tx.creditBalance.update({
      where: { customerId: customer.id },
      data: { balance: { increment: price.creditsGranted } }
    });

    let subscriptionRow: Prisma.SubscriptionGetPayload<object> | undefined;
    if (isSubscriptionInterval(price.interval) || price.product.type === "subscription") {
      const periodEnd = periodEndForInterval(price.interval);
      await tx.subscription.updateMany({
        where: {
          siteId: params.siteId,
          customerId: params.customerId,
          productId: price.productId,
          status: { in: ["trialing", "active", "past_due"] }
        },
        data: { status: "canceled" }
      });
      subscriptionRow = await tx.subscription.create({
        data: {
          id: uid("sub"),
          siteId: params.siteId,
          customerId: params.customerId,
          productId: price.productId,
          priceId: price.id,
          stripeSubscriptionId: `admin_comp_${orderId}`,
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
          creditsPerCycle: price.creditsGranted
        }
      });
    }

    const updatedCustomer = await tx.customer.findFirstOrThrow({ where: { id: params.customerId, siteId: params.siteId }, include: { balance: true } });
    return {
      customer: mapCustomer(updatedCustomer),
      order: mapOrder(orderRow),
      ledger: mapCreditLedger(ledgerRow),
      subscription: subscriptionRow ? mapSubscription(subscriptionRow) : undefined,
      grantedCredits: price.creditsGranted
    };
  });
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
    const price = await tx.price.findFirst({
      where: { siteId: params.siteId, id: params.priceId },
      include: { product: { include: { prices: true } } }
    });
    if (!price || price.product.siteId !== params.siteId) throw new StoreError("price_not_found_for_site", 404);
    if (price.product.status !== "active") throw new StoreError("product_not_active", 409);
    if (!Number.isInteger(price.creditsGranted) || price.creditsGranted <= 0) throw new StoreError("price_has_no_credits", 409);

    const sourceId = checkoutSourceId(params.intentId);
    const existingOrder = await tx.order.findFirst({
      where: { siteId: params.siteId, customerId: params.customerId, sourceId }
    });
    const order = existingOrder ?? await tx.order.create({
      data: {
        id: uid("ord"),
        siteId: params.siteId,
        customerId: params.customerId,
        status: "checkout_started",
        amountCents: price.amountCents,
        currency: price.currency,
        credits: price.creditsGranted,
        sourceId
      }
    });

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
  });
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

    const existing = await tx.paymentEvent.findUnique({
      where: { siteId_provider_providerEventId: { siteId, provider: "stripe", providerEventId } }
    });
    if (existing) {
      const ledger = await tx.creditLedger.findFirst({
        where: { siteId, sourceType: "stripe_webhook", sourceId: providerEventId }
      });
      const existingOrder = payload.data?.object?.metadata?.orderId
        ? await tx.order.findFirst({ where: { siteId, id: payload.data.object.metadata.orderId } })
        : null;
      return {
        event: mapPaymentEvent(existing),
        siteId,
        alreadyProcessed: true,
        ledger: ledger ? mapCreditLedger(ledger) : undefined,
        order: existingOrder ? mapOrder(existingOrder) : undefined
      };
    }

    const event = await tx.paymentEvent.create({
      data: {
        id: uid("payevt"),
        siteId,
        provider: "stripe",
        providerEventId,
        eventType,
        processedAt: new Date(),
        payload: payload as Prisma.InputJsonObject
      }
    });

    const metadata = payload.data?.object?.metadata;
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
      order = await tx.order.create({
        data: {
          id: uid("ord"),
          siteId,
          customerId: customer.id,
          status: "checkout_started",
          amountCents: price?.amountCents ?? 0,
          currency: price?.currency ?? "usd",
          credits,
          sourceId: `stripe_webhook:${providerEventId}`
        }
      });
    }

    const existingLedger = await tx.creditLedger.findFirst({
      where: { siteId, customerId: customer.id, sourceType: "stripe_webhook", sourceId: providerEventId }
    });
    const ledger = existingLedger ?? await tx.creditLedger.create({
      data: {
        id: uid("led"),
        siteId,
        customerId: customer.id,
        amount: credits,
        type: "grant",
        sourceType: "stripe_webhook",
        sourceId: providerEventId
      }
    });
    if (!existingLedger) {
      await tx.creditBalance.update({
        where: { customerId: customer.id },
        data: { balance: { increment: credits } }
      });
    }
    const fulfilledOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "fulfilled",
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
  });
}
