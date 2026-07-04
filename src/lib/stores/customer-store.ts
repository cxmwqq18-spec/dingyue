import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { shouldFallbackRelationalRead, warnRelationalFallback } from "@/lib/stores/relational-fallback";
import type { Customer, PublicCustomer } from "@/lib/types";
import {
  mapCustomer,
  hashRelationalPassword,
  relationalSessionTtlMs,
  relationalUid,
  requireDelegate,
  requireModelFields,
  toCustomerSessionRelational,
  toPublicCustomerRelational,
  verifyRelationalPassword
} from "@/lib/stores/prisma-mappers";

type DbClient = PrismaClient;

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function listSiteCustomersRelational(
  siteId: string,
  client: DbClient = prisma
): Promise<{ customers: PublicCustomer[] }> {
  await requireModelFields(client, "Customer", ["id", "siteId", "email", "name", "status"]);
  const customers = await client.customer.findMany({
    where: { siteId },
    include: { balance: true },
    orderBy: [{ createdAt: "asc" }, { email: "asc" }]
  });
  return { customers: customers.map((customer) => mapCustomer(customer)) };
}

export async function createCustomerSessionRelational(
  params: { siteId: string; email: string; password: string; name?: string },
  client: DbClient = prisma
) {
  const email = params.email.trim().toLowerCase();
  if (!email.includes("@")) throw new StoreError("invalid_email", 400);
  if (params.password.trim().length < 6) throw new StoreError("password_min_6_chars", 400);
  await requireDelegate(client, "customerSession");
  await requireModelFields(client, "Customer", ["id", "siteId", "email", "name", "status", "passwordHash"]);
  await requireModelFields(client, "CustomerSession", ["id", "siteId", "customerId", "createdAt", "expiresAt"]);

  const site = await client.site.findUnique({ where: { id: params.siteId }, select: { id: true, slug: true, signupCreditGrant: true } });
  if (!site) throw new StoreError("site_not_found", 404);
  const existing = await client.customer.findUnique({
    where: { siteId_email: { siteId: params.siteId, email } },
    include: { balance: true }
  });
  let customer = existing;
  let createdCustomer = false;

  if (customer) {
    if (!verifyRelationalPassword(params.password, String((customer as Record<string, unknown>).passwordHash ?? ""))) {
      throw new StoreError("invalid_customer_credentials", 401);
    }
  } else {
    createdCustomer = true;
    const signupCreditGrant = Math.max(0, Math.trunc(Number(site.signupCreditGrant ?? 0)));
    const customerId = relationalUid(`cust_${site.slug}`);
    const passwordHash = hashRelationalPassword(params.password);
    try {
      customer = await client.customer.create({
        data: {
          id: customerId,
          siteId: params.siteId,
          email,
          passwordHash,
          name: params.name?.trim() || email.split("@")[0],
          status: "active",
          balance: {
            create: {
              id: relationalUid("bal"),
              siteId: params.siteId,
              balance: signupCreditGrant,
              reserved: 0
            }
          },
          ...(signupCreditGrant > 0
            ? {
                ledger: {
                  create: {
                    id: relationalUid("led"),
                    siteId: params.siteId,
                    amount: signupCreditGrant,
                    type: "grant",
                    sourceType: "signup_credit",
                    sourceId: `signup_${customerId}`
                  }
                }
              }
            : {})
        },
        include: { balance: true }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      customer = await client.customer.findUnique({
        where: { siteId_email: { siteId: params.siteId, email } },
        include: { balance: true }
      });
      if (!customer || !verifyRelationalPassword(params.password, String((customer as Record<string, unknown>).passwordHash ?? ""))) {
        throw new StoreError("invalid_customer_credentials", 401);
      }
      createdCustomer = false;
    }
  }

  const session = await (client as unknown as { customerSession: { create(args: unknown): Promise<Record<string, unknown>> } }).customerSession.create({
      data: {
        id: relationalUid("sess"),
        siteId: params.siteId,
        customerId: customer.id,
        expiresAt: new Date(Date.now() + relationalSessionTtlMs)
      }
    });

  return {
    customer: toPublicCustomerRelational(customer as unknown as Record<string, unknown>),
    session: toCustomerSessionRelational(session),
    createdCustomer
  };
}

export async function createExistingCustomerSessionRelational(
  params: { siteId: string; email: string; password: string },
  client: DbClient = prisma
) {
  const email = params.email.trim().toLowerCase();
  if (!email.includes("@")) throw new StoreError("invalid_email", 400);
  if (params.password.trim().length < 6) throw new StoreError("password_min_6_chars", 400);
  await requireDelegate(client, "customerSession");
  await requireModelFields(client, "Customer", ["id", "siteId", "email", "name", "status", "passwordHash"]);
  await requireModelFields(client, "CustomerSession", ["id", "siteId", "customerId", "createdAt", "expiresAt"]);

  const customer = await client.customer.findUnique({
    where: { siteId_email: { siteId: params.siteId, email } },
    include: { balance: true }
  });
  if (!customer || !verifyRelationalPassword(params.password, String((customer as Record<string, unknown>).passwordHash ?? ""))) {
    throw new StoreError("invalid_customer_credentials", 401);
  }

  const session = await (client as unknown as { customerSession: { create(args: unknown): Promise<Record<string, unknown>> } }).customerSession.create({
    data: {
      id: relationalUid("sess"),
      siteId: params.siteId,
      customerId: customer.id,
      expiresAt: new Date(Date.now() + relationalSessionTtlMs)
    }
  });

  return {
    customer: toPublicCustomerRelational(customer as unknown as Record<string, unknown>),
    session: toCustomerSessionRelational(session),
    createdCustomer: false
  };
}

export async function deleteCustomerSessionRelational(sessionId: string, client: DbClient = prisma): Promise<void> {
  await requireDelegate(client, "customerSession");
  await (client as unknown as { customerSession: { deleteMany(args: unknown): Promise<unknown> } }).customerSession.deleteMany({
    where: { id: sessionId }
  });
}

export async function getCustomerBySessionRelational(
  params: { siteId: string; sessionId?: string },
  client: DbClient = prisma
): Promise<{ customer: PublicCustomer; session: ReturnType<typeof toCustomerSessionRelational> } | undefined> {
  if (!params.sessionId) return undefined;
  let session;
  try {
    await requireDelegate(client, "customerSession");
    session = await (client as unknown as {
      customerSession: { findFirst(args: unknown): Promise<(Record<string, unknown> & { customer?: Record<string, unknown> }) | null> };
    }).customerSession.findFirst({
      where: {
        id: params.sessionId,
        siteId: params.siteId,
        expiresAt: { gt: new Date() }
      },
      include: {
        customer: { include: { balance: true } }
      }
    });
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("customer session lookup", error);
    return undefined;
  }
  if (!session?.customer) return undefined;
  return {
    customer: toPublicCustomerRelational(session.customer),
    session: toCustomerSessionRelational(session)
  };
}

export async function updateCustomerStatusRelational(
  params: { siteId: string; customerId: string; status: Customer["status"] },
  client: DbClient = prisma
): Promise<{ customer: PublicCustomer }> {
  if (!["active", "past_due", "blocked"].includes(params.status)) {
    throw new StoreError("invalid_customer_status", 400);
  }
  const existing = await client.customer.findFirst({
    where: { id: params.customerId, siteId: params.siteId },
    select: { id: true }
  });
  if (!existing) throw new StoreError("customer_not_found_for_site", 404);
  const customer = await client.customer.update({
    where: { id: params.customerId },
    data: { status: params.status },
    include: { balance: true }
  });
  return { customer: toPublicCustomerRelational(customer as unknown as Record<string, unknown>) };
}
