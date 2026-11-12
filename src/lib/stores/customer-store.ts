import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma, runPrismaReadWithReconnect, runPrismaWriteWithReconnect } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { shouldFallbackRelationalRead, warnRelationalFallback } from "@/lib/stores/relational-fallback";
import type { Customer, PublicCustomer } from "@/lib/types";
import {
  mapCustomer,
  hashRelationalPassword,
  isLegacyRelationalPasswordHash,
  relationalSessionTtlMs,
  relationalUid,
  requireDelegate,
  requireModelFields,
  toCustomerSessionRelational,
  toPublicCustomerRelational,
  verifyRelationalPassword
} from "@/lib/stores/prisma-mappers";

type DbClient = PrismaClient;

function isMissingCustomerProfileTableError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2021") return false;
  const meta = error.meta && typeof error.meta === "object" ? error.meta as { table?: unknown } : undefined;
  const table = typeof meta?.table === "string" ? meta.table : "";
  return table.includes("CustomerProfile") || error.message.includes("CustomerProfile");
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
  // Keep the legacy form helper login-only. Registration must complete the
  // site-scoped email verification flow before a customer row is created.
  return createExistingCustomerSessionRelational({ siteId: params.siteId, email: params.email, password: params.password }, client);
}

export async function createExistingCustomerSessionRelational(
  params: { siteId: string; email: string; password: string; lastLoginIp?: string },
  client: DbClient = prisma
) {
  const createSession = async () => createExistingCustomerSessionRelationalOnce(params, client);
  return client === prisma
    ? runPrismaWriteWithReconnect(createSession, { label: "existing customer login session create" })
    : createSession();
}

async function createExistingCustomerSessionRelationalOnce(
  params: { siteId: string; email: string; password: string; lastLoginIp?: string },
  client: DbClient
) {
  const email = params.email.trim().toLowerCase();
  if (!email.includes("@")) throw new StoreError("invalid_email", 400);
  if (params.password.trim().length < 6) throw new StoreError("password_min_6_chars", 400);
  await requireDelegate(client, "customerSession");
  await requireModelFields(client, "Customer", ["id", "siteId", "email", "name", "status", "passwordHash"]);
  await requireModelFields(client, "CustomerSession", ["id", "siteId", "customerId", "createdAt", "expiresAt"]);

  let customer = await client.customer.findUnique({
    where: { siteId_email: { siteId: params.siteId, email } },
    include: { balance: true }
  });
  if (!customer || !verifyRelationalPassword(params.password, String((customer as Record<string, unknown>).passwordHash ?? ""))) {
    throw new StoreError("invalid_customer_credentials", 401);
  }
  if (customer.status === "blocked") throw new StoreError("customer_account_blocked", 403);
  if (isLegacyRelationalPasswordHash(String((customer as Record<string, unknown>).passwordHash ?? ""))) {
    customer = await client.customer.update({
      where: { id: customer.id },
      data: { passwordHash: hashRelationalPassword(params.password) },
      include: { balance: true }
    });
  }

  const session = await (client as unknown as { customerSession: { create(args: unknown): Promise<Record<string, unknown>> } }).customerSession.create({
    data: {
      id: relationalUid("sess"),
      siteId: params.siteId,
      customerId: customer.id,
      expiresAt: new Date(Date.now() + relationalSessionTtlMs)
    }
  });

  if (params.lastLoginIp) {
    await client.customer.update({ where: { id: customer.id }, data: { lastLoginIp: params.lastLoginIp } });
  }

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
    const readSession = async (includeProfile: boolean) => {
      await requireDelegate(client, "customerSession");
      return (client as unknown as {
        customerSession: { findFirst(args: unknown): Promise<(Record<string, unknown> & { customer?: Record<string, unknown> }) | null> };
      }).customerSession.findFirst({
        where: {
          id: params.sessionId,
          siteId: params.siteId,
          expiresAt: { gt: new Date() }
        },
        include: includeProfile
          ? { customer: { include: { balance: true, profile: { include: { avatarAsset: true } } } } }
          : { customer: { include: { balance: true } } }
      });
    };
    const readSessionWithReconnect = (includeProfile: boolean, label: string) => client === prisma
      ? runPrismaReadWithReconnect(() => readSession(includeProfile), { label })
      : readSession(includeProfile);
    try {
      session = await readSessionWithReconnect(true, "customer session lookup");
    } catch (error) {
      if (!isMissingCustomerProfileTableError(error)) throw error;
      warnRelationalFallback("customer session profile lookup", error);
      session = await readSessionWithReconnect(false, "customer session lookup without profile");
    }
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("customer session lookup", error);
    return undefined;
  }
  if (!session?.customer || session.customer.status === "blocked") return undefined;
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
  if (params.status === "blocked") await requireDelegate(client, "customerSession");
  const customer = await client.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id: params.customerId },
      data: { status: params.status },
      include: { balance: true }
    });
    if (params.status === "blocked") {
      await tx.customerSession.deleteMany({ where: { siteId: params.siteId, customerId: params.customerId } });
    }
    return updated;
  });
  return { customer: toPublicCustomerRelational(customer as unknown as Record<string, unknown>) };
}

export async function updateCustomerPasswordRelational(
  params: { siteId: string; customerId: string; password: string },
  client: DbClient = prisma
): Promise<{ customer: PublicCustomer }> {
  const updatePassword = async () => updateCustomerPasswordRelationalOnce(params, client);
  return client === prisma
    ? runPrismaWriteWithReconnect(updatePassword, { label: "customer password update" })
    : updatePassword();
}

async function updateCustomerPasswordRelationalOnce(
  params: { siteId: string; customerId: string; password: string },
  client: DbClient
): Promise<{ customer: PublicCustomer }> {
  const password = params.password.trim();
  if (password.length < 6) throw new StoreError("password_min_6_chars", 400);
  await requireDelegate(client, "customerSession");
  await requireModelFields(client, "Customer", ["id", "siteId", "passwordHash"]);

  const existing = await client.customer.findFirst({
    where: { id: params.customerId, siteId: params.siteId },
    select: { id: true }
  });
  if (!existing) throw new StoreError("customer_not_found_for_site", 404);

  const customer = await client.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id: existing.id },
      data: { passwordHash: hashRelationalPassword(password) },
      include: { balance: true }
    });
    await tx.customerSession.deleteMany({
      where: { siteId: params.siteId, customerId: existing.id }
    });
    return updated;
  });

  return { customer: toPublicCustomerRelational(customer as unknown as Record<string, unknown>) };
}
