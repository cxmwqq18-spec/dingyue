import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/resend-email";
import { readPlatformState, StoreError } from "@/lib/server-store";
import {
  hashRelationalPassword,
  relationalSessionTtlMs,
  relationalUid,
  toCustomerSessionRelational,
  toPlatformEmailSettings,
  toPublicCustomerRelational
} from "@/lib/stores/prisma-mappers";
import type { CustomerSession, PublicCustomer, Site } from "@/lib/types";

type VerificationPurpose = "register" | "password_reset";

type CustomerEmailVerificationDeliveryStatus = "sent" | "dev" | "failed";
type EmailAuthSite = Pick<Site, "id" | "name" | "slug" | "branding">;

type CustomerEmailVerificationResult = {
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
  deliveryStatus?: CustomerEmailVerificationDeliveryStatus;
  deliveryError?: string;
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

function shouldExposeDevCode(deliveryStatus: CustomerEmailVerificationDeliveryStatus | undefined): boolean {
  return process.env.NODE_ENV !== "production" || process.env.EMAIL_AUTH_EXPOSE_DEV_CODE === "1" || deliveryStatus !== "sent";
}

function normalizePurpose(purpose: string | undefined): VerificationPurpose {
  return purpose === "password_reset" ? "password_reset" : "register";
}

function normalizePassword(password: string | undefined): string {
  const normalized = String(password ?? "").trim();
  if (normalized.length < 6) throw new StoreError("password_min_6_chars", 400);
  return normalized;
}

async function requireEmailAuthSite(siteId: string): Promise<EmailAuthSite> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      name: true,
      slug: true,
      branding: true
    }
  });
  if (!site) throw new StoreError("site_not_found", 404);
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    branding: site.branding as Site["branding"]
  };
}

export async function requestCustomerEmailCode(params: { siteId: string; email: string; purpose?: VerificationPurpose }): Promise<{
  ok: true;
  email: string;
  purpose: VerificationPurpose;
  expiresAt: string;
  deliveryStatus: CustomerEmailVerificationDeliveryStatus;
  devCode?: string;
  deliveryError?: string;
}> {
  const email = normalizeEmail(params.email);
  const purpose = normalizePurpose(params.purpose);
  const site = await requireEmailAuthSite(params.siteId);
  const existing = await prisma.customer.findUnique({ where: { siteId_email: { siteId: site.id, email } }, select: { id: true } });
  if (purpose === "register" && existing) throw new StoreError("customer_already_exists", 409);
  if (purpose === "password_reset" && !existing) throw new StoreError("customer_not_found_for_site", 404);

  const code = randomCode();
  const createdAt = new Date();
  const verification: CustomerEmailVerificationResult = {
    id: relationalUid("email_ver"),
    siteId: site.id,
    email,
    codeHash: codeHash(site.id, email, code),
    purpose,
    attempts: 0,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + verificationTtlMs).toISOString()
  };
  const emailSettings = await prisma.platformEmailSettings.findUnique({ where: { id: "platform_email_settings" } });
  const jsonState = readPlatformState();
  const settings = emailSettings ? toPlatformEmailSettings(emailSettings) : jsonState.platformEmailSettings;
  const settingsContext = {
    platformEmailSettings: settings,
    platformEmailConfigs: jsonState.platformEmailConfigs,
    siteEmailConfigAssignments: jsonState.siteEmailConfigAssignments
  };

  try {
    const sent = await sendVerificationEmail({
      to: email,
      code,
      purpose,
      site,
      settingsContext
    });
    verification.deliveryStatus = "sent";
    verification.providerMessageId = sent.messageId;
  } catch (error) {
    verification.deliveryStatus = process.env.NODE_ENV === "production" ? "failed" : "dev";
    verification.deliveryError = error instanceof Error ? error.message : "email_send_failed";
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.customerEmailVerification.deleteMany({
      where: { siteId: site.id, email, OR: [{ expiresAt: { lte: now } }, { consumedAt: { not: null } }] }
    });
    await tx.customerEmailVerification.updateMany({
      where: { siteId: site.id, email, purpose, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now }
    });
    await tx.customerEmailVerification.create({
      data: {
        id: verification.id,
        siteId: site.id,
        email,
        codeHash: verification.codeHash,
        purpose: verification.purpose,
        attempts: 0,
        providerMessageId: verification.providerMessageId,
        deliveryStatus: verification.deliveryStatus,
        deliveryError: verification.deliveryError,
        createdAt,
        expiresAt: new Date(verification.expiresAt)
      }
    });
  });

  return {
    ok: true,
    email,
    purpose,
    expiresAt: verification.expiresAt,
    deliveryStatus: verification.deliveryStatus,
    deliveryError: verification.deliveryError,
    devCode: shouldExposeDevCode(verification.deliveryStatus) ? code : undefined
  };
}

async function completeVerifiedCustomerAuth(params: { site: Pick<Site, "id" | "slug">; email: string; password: string; purpose: VerificationPurpose; name?: string }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.customer.findUnique({
      where: { siteId_email: { siteId: params.site.id, email: params.email } },
      include: { balance: true }
    });
    let customer = existing;
    let createdCustomer = false;
    if (params.purpose === "register") {
      if (customer) throw new StoreError("customer_already_exists", 409);
      createdCustomer = true;
      const customerId = relationalUid(`cust_${params.site.slug}`);
      customer = await tx.customer.create({
        data: {
          id: customerId,
          siteId: params.site.id,
          email: params.email,
          passwordHash: hashRelationalPassword(params.password),
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
    } else {
      if (!customer) throw new StoreError("customer_not_found_for_site", 404);
      customer = await tx.customer.update({
        where: { id: customer.id },
        data: { passwordHash: hashRelationalPassword(params.password), status: "active" },
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

export async function verifyCustomerEmailCode(params: { siteId: string; email: string; code: string; password?: string; purpose?: VerificationPurpose; name?: string }): Promise<{
  customer: PublicCustomer;
  session: CustomerSession;
  createdCustomer: boolean;
}> {
  const email = normalizeEmail(params.email);
  const code = params.code.trim();
  const purpose = normalizePurpose(params.purpose);
  const password = normalizePassword(params.password);
  if (!/^\d{6}$/.test(code)) throw new StoreError("invalid_verification_code", 400);

  const site = await requireEmailAuthSite(params.siteId);
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const verification = await tx.customerEmailVerification.findFirst({
      where: {
        siteId: site.id,
        email,
        purpose,
        consumedAt: null,
        expiresAt: { gt: now }
      },
      orderBy: { createdAt: "desc" }
    });
    if (!verification) throw new StoreError("verification_code_expired", 400);
    if (verification.attempts >= maxVerificationAttempts) {
      await tx.customerEmailVerification.update({
        where: { id: verification.id },
        data: { consumedAt: now }
      });
      throw new StoreError("verification_code_expired", 400);
    }

    const attempts = verification.attempts + 1;
    if (verification.codeHash !== codeHash(site.id, email, code)) {
      await tx.customerEmailVerification.update({
        where: { id: verification.id },
        data: {
          attempts,
          consumedAt: attempts >= maxVerificationAttempts ? now : undefined
        }
      });
      throw new StoreError("invalid_verification_code", 400);
    }

    await tx.customerEmailVerification.update({
      where: { id: verification.id },
      data: { attempts, consumedAt: now }
    });
  });
  return completeVerifiedCustomerAuth({ site, email, password, purpose, name: params.name });
}
