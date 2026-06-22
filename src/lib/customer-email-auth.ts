import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/resend-email";
import {
  readPlatformState,
  StoreError,
  toPublicCustomer,
  writePlatformState
} from "@/lib/server-store";
import {
  hashRelationalPassword,
  relationalSessionTtlMs,
  relationalUid,
  toCustomerSessionRelational,
  toPublicCustomerRelational
} from "@/lib/stores/prisma-mappers";
import type { CustomerSession, PlatformState, PublicCustomer, Site } from "@/lib/types";

type VerificationPurpose = "register";

type CustomerEmailVerification = {
  id: string;
  siteId: string;
  email: string;
  codeHash: string;
  purpose: VerificationPurpose;
  attempts: number;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  providerMessageId?: string;
  deliveryStatus?: "sent" | "dev" | "failed";
  deliveryError?: string;
};

type VerificationState = PlatformState & {
  customerEmailVerifications?: CustomerEmailVerification[];
};

const verificationTtlMs = 1000 * 60 * 10;
const maxVerificationAttempts = 5;

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) throw new StoreError("invalid_email", 400);
  return normalized;
}

function codeHash(siteId: string, email: string, code: string): string {
  return crypto.createHash("sha256").update(`${siteId}:${email}:${code}`).digest("hex");
}

function randomCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function fallbackPasswordForEmailLogin(email: string): string {
  return `email:${crypto.createHash("sha256").update(email).digest("hex").slice(0, 24)}`;
}

function verificationBucket(state: VerificationState): CustomerEmailVerification[] {
  state.customerEmailVerifications ??= [];
  return state.customerEmailVerifications;
}

function latestPendingVerification(state: VerificationState, siteId: string, email: string): CustomerEmailVerification | undefined {
  const now = Date.now();
  return verificationBucket(state)
    .filter((item) => item.siteId === siteId && item.email === email && !item.consumedAt && Date.parse(item.expiresAt) > now)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

function shouldExposeDevCode(deliveryStatus: CustomerEmailVerification["deliveryStatus"]): boolean {
  return process.env.NODE_ENV !== "production" || process.env.EMAIL_AUTH_EXPOSE_DEV_CODE === "1" || deliveryStatus !== "sent";
}

export async function requestCustomerEmailCode(params: { site: Site; email: string }): Promise<{
  ok: true;
  email: string;
  expiresAt: string;
  deliveryStatus: CustomerEmailVerification["deliveryStatus"];
  devCode?: string;
  deliveryError?: string;
}> {
  const email = normalizeEmail(params.email);
  const state = readPlatformState({ fresh: true }) as VerificationState;
  const site = state.sites.find((item) => item.id === params.site.id);
  if (!site) throw new StoreError("site_not_found", 404);

  const code = randomCode();
  const createdAt = new Date();
  const verification: CustomerEmailVerification = {
    id: relationalUid("email_ver"),
    siteId: site.id,
    email,
    codeHash: codeHash(site.id, email, code),
    purpose: "register",
    attempts: 0,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + verificationTtlMs).toISOString()
  };

  try {
    const sent = await sendVerificationEmail({
      to: email,
      code,
      purpose: "register",
      site,
      settings: state.platformEmailSettings
    });
    verification.deliveryStatus = "sent";
    verification.providerMessageId = sent.messageId;
  } catch (error) {
    verification.deliveryStatus = process.env.NODE_ENV === "production" ? "failed" : "dev";
    verification.deliveryError = error instanceof Error ? error.message : "email_send_failed";
  }

  state.customerEmailVerifications = verificationBucket(state)
    .filter((item) => Date.parse(item.expiresAt) > Date.now() && !item.consumedAt)
    .filter((item) => !(item.siteId === site.id && item.email === email));
  state.customerEmailVerifications.push(verification);
  writePlatformState(state);

  return {
    ok: true,
    email,
    expiresAt: verification.expiresAt,
    deliveryStatus: verification.deliveryStatus,
    deliveryError: verification.deliveryError,
    devCode: shouldExposeDevCode(verification.deliveryStatus) ? code : undefined
  };
}

async function createEmailVerifiedRelationalSession(params: { site: Site; email: string; name?: string }) {
  const password = fallbackPasswordForEmailLogin(params.email);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.customer.findUnique({
      where: { siteId_email: { siteId: params.site.id, email: params.email } },
      include: { balance: true }
    });
    let customer = existing;
    let createdCustomer = false;
    if (!customer) {
      createdCustomer = true;
      const customerId = relationalUid(`cust_${params.site.slug}`);
      customer = await tx.customer.create({
        data: {
          id: customerId,
          siteId: params.site.id,
          email: params.email,
          passwordHash: hashRelationalPassword(password),
          name: params.name?.trim() || params.email.split("@")[0],
          status: "active",
          balance: {
            create: {
              id: relationalUid("bal"),
              siteId: params.site.id,
              balance: 48,
              reserved: 0
            }
          },
          ledger: {
            create: {
              id: relationalUid("led"),
              siteId: params.site.id,
              amount: 48,
              type: "grant",
              sourceType: "signup_credit",
              sourceId: `signup_${customerId}`
            }
          }
        },
        include: { balance: true }
      });
    }

    const session = await tx.customerSession.create({
      data: {
        id: relationalUid("sess"),
        siteId: params.site.id,
        customerId: customer.id,
        expiresAt: new Date(Date.now() + relationalSessionTtlMs)
      }
    });

    return {
      customer: toPublicCustomerRelational(customer as unknown as Record<string, unknown>),
      session: toCustomerSessionRelational(session as unknown as Record<string, unknown>),
      createdCustomer
    };
  });
}

function createEmailVerifiedJsonSession(params: { state: VerificationState; site: Site; email: string; name?: string }): {
  customer: PublicCustomer;
  session: CustomerSession;
  createdCustomer: boolean;
} {
  let customer = params.state.customers.find((item) => item.siteId === params.site.id && item.email === params.email);
  let createdCustomer = false;
  if (!customer) {
    createdCustomer = true;
    customer = {
      id: relationalUid(`cust_${params.site.slug}`),
      siteId: params.site.id,
      email: params.email,
      passwordHash: hashRelationalPassword(fallbackPasswordForEmailLogin(params.email)),
      name: params.name?.trim() || params.email.split("@")[0],
      status: "active",
      balance: { available: 48, reserved: 0 }
    };
    params.state.customers.push(customer);
    params.state.ledger.push({
      id: relationalUid("led"),
      siteId: params.site.id,
      customerId: customer.id,
      amount: 48,
      type: "grant",
      sourceType: "signup_credit",
      sourceId: `signup_${customer.id}`,
      createdAt: new Date().toISOString()
    });
  }
  const session = {
    id: relationalUid("sess"),
    siteId: params.site.id,
    customerId: customer.id,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + relationalSessionTtlMs).toISOString()
  };
  params.state.customerSessions.push(session);
  return { customer: toPublicCustomer(customer), session, createdCustomer };
}

export async function verifyCustomerEmailCode(params: { site: Site; email: string; code: string; name?: string }): Promise<{
  customer: PublicCustomer;
  session: CustomerSession;
  createdCustomer: boolean;
}> {
  const email = normalizeEmail(params.email);
  const code = params.code.trim();
  if (!/^\d{6}$/.test(code)) throw new StoreError("invalid_verification_code", 400);

  const state = readPlatformState({ fresh: true }) as VerificationState;
  const site = state.sites.find((item) => item.id === params.site.id);
  if (!site) throw new StoreError("site_not_found", 404);
  const verification = latestPendingVerification(state, site.id, email);
  if (!verification) throw new StoreError("verification_code_expired", 400);
  if (verification.attempts >= maxVerificationAttempts) throw new StoreError("verification_code_expired", 400);
  verification.attempts += 1;
  if (verification.codeHash !== codeHash(site.id, email, code)) {
    writePlatformState(state);
    throw new StoreError("invalid_verification_code", 400);
  }

  verification.consumedAt = new Date().toISOString();
  const result = process.env.PERSISTENCE_BACKEND === "postgres"
    ? await createEmailVerifiedRelationalSession({ site, email, name: params.name })
    : createEmailVerifiedJsonSession({ state, site, email, name: params.name });

  if (process.env.PERSISTENCE_BACKEND === "postgres") {
    writePlatformState(state);
  } else {
    writePlatformState(state);
  }
  return result;
}
