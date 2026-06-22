import "server-only";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreditLedgerEntry, Customer, Price, Product } from "@/lib/types";
import { StoreError } from "@/lib/server-store";
import { mapCreditLedger, mapCustomer, mapPrice, mapProduct } from "@/lib/stores/prisma-mappers";

type Tx = Prisma.TransactionClient;

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
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
    if (!["month", "one_time"].includes(params.interval)) throw new StoreError("invalid_price_interval", 400);
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
