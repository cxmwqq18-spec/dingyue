import "server-only";
import crypto from "crypto";

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import { canonicalizeEmail } from "@/lib/customer-email-auth";
import type {
  CreditApplication,
  CreditApplicationReviewContext,
  CreditApplicationStatus
} from "@/lib/types";
import { addAuditLogRelational, relationalUid, toIsoString } from "@/lib/stores/prisma-mappers";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const GRANT_OPTIONS = [20, 40, 60];
export const LIFETIME_CREDIT_CAP = 60;
export const MONTHLY_APPROVAL_CAP = 100;

const platformSet = new Set(["tiktok", "instagram", "youtube", "x"]);
const followerTierSet = new Set(["under_5k", "5k_25k", "25k_100k", "100k_plus"]);
const reviewActions = new Set<string>(["approve", "reject", "archive"]);
const statusSet = new Set<string>(["pending", "approved", "rejected", "archived"]);
const dayMs = 24 * 60 * 60 * 1000;

// Hard-blocked disposable inbox domains, matched as exact domain or subdomain.
const disposableEmailDomains = [
  "0-mail.com", "10minutemail.com", "10minutemail.net", "1secmail.com", "1secmail.net", "1secmail.org",
  "20minutemail.com", "33mail.com", "anonbox.net", "dispostable.com", "emailondeck.com", "fakeinbox.com",
  "getairmail.com", "getnada.com", "grr.la", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "harakirimail.com", "inboxbear.com", "inboxkitten.com", "mail-temporaire.fr", "mail7.io", "mailcatch.com",
  "maildrop.cc", "mailinator.com", "mailnesia.com", "mailsac.com", "mailtemp.net", "mintemail.com",
  "moakt.com", "mohmal.com", "mytemp.email", "nowmymail.com", "sharklasers.com", "spam4.me",
  "spamgourmet.com", "temp-mail.org", "tempail.com", "tempinbox.com", "tempmail.com", "tempmail.dev",
  "tempmail.plus", "tempmailo.com", "tempr.email", "throwawaymail.com", "tmpmail.net", "trashmail.com",
  "trashmail.me", "yopmail.com", "yopmail.net", "zetmail.com"
];

export type CreditApplicationCreateInput = {
  siteId: string;
  customerId: string;
  platform: string;
  profileUrl: string;
  followerTier: string;
  evidencePosts: string[];
  audience?: string;
  message?: string;
  honeypot?: string;
  submitIp?: string;
  submitUa?: string;
};

export type CreditApplicationsPage = {
  applications: CreditApplication[];
  stats: Record<CreditApplicationStatus | "total", number>;
  contexts: Record<string, CreditApplicationReviewContext>;
};

export type CreditProgramQuota = {
  monthlyApproved: number;
  monthlyCap: number;
  grantOptions: number[];
  lifetimeCap: number;
};

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

function cleanLongText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

function cleanHttpsUrl(value: unknown): string | undefined {
  const text = cleanText(value, 500);
  if (!text) return undefined;
  try {
    const url = new URL(text.startsWith("http://") || text.startsWith("https://") ? text : `https://${text}`);
    if (url.protocol !== "https:") return undefined;
    return url.toString().slice(0, 500);
  } catch {
    return undefined;
  }
}

/** sha256 over trimmed url with trailing slashes stripped and host lowercased. */
function evidenceUrlHash(url: string): string {
  try {
    const parsed = new URL(url);
    const normalized = `${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`;
    return crypto.createHash("sha256").update(normalized).digest("hex");
  } catch {
    return crypto.createHash("sha256").update(url.trim()).digest("hex");
  }
}

function cleanEvidencePosts(value: unknown): Array<{ url: string; urlHash: string }> {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\n|,/)
      : [];
  const posts: Array<{ url: string; urlHash: string }> = [];
  for (const item of raw) {
    const url = cleanHttpsUrl(item);
    if (!url) continue;
    posts.push({ url, urlHash: evidenceUrlHash(url) });
  }
  return posts.slice(0, 3);
}

function evidencePostRecords(value: Prisma.JsonValue | null | undefined): Array<{ url?: string; urlHash?: string }> {
  return Array.isArray(value) ? (value as Array<{ url?: string; urlHash?: string }>) : [];
}

function ipv4Subnet(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  const octets = ip.split(".");
  return octets.length === 4 ? octets.slice(0, 3).join(".") : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function applicationSelect() {
  return {
    id: true,
    siteId: true,
    customerId: true,
    email: true,
    canonicalEmail: true,
    platform: true,
    profileUrl: true,
    followerTier: true,
    evidencePosts: true,
    audience: true,
    message: true,
    status: true,
    grantCredits: true,
    riskFlags: true,
    submitIp: true,
    submitUa: true,
    reviewedBy: true,
    reviewedAt: true,
    reviewNote: true,
    createdAt: true,
    updatedAt: true
  } satisfies Prisma.CreditApplicationSelect;
}

function toCreditApplicationRelational(row: Record<string, unknown>): CreditApplication {
  const status = optionalString(row.status);
  return {
    id: String(row.id),
    siteId: String(row.siteId),
    customerId: String(row.customerId),
    email: String(row.email),
    canonicalEmail: String(row.canonicalEmail),
    platform: String(row.platform),
    profileUrl: String(row.profileUrl),
    followerTier: String(row.followerTier),
    evidencePosts: evidencePostRecords(row.evidencePosts as Prisma.JsonValue | null | undefined)
      .filter((post) => typeof post.url === "string" && typeof post.urlHash === "string")
      .map((post) => ({ url: post.url as string, urlHash: post.urlHash as string })),
    audience: optionalString(row.audience),
    message: optionalString(row.message),
    status: (status && statusSet.has(status) ? status : "pending") as CreditApplicationStatus,
    grantCredits: typeof row.grantCredits === "number" ? row.grantCredits : undefined,
    riskFlags: Array.isArray(row.riskFlags) ? row.riskFlags.map((flag) => String(flag)) : [],
    submitIp: optionalString(row.submitIp),
    submitUa: optionalString(row.submitUa),
    reviewedBy: optionalString(row.reviewedBy),
    reviewedAt: toIsoString(row.reviewedAt as Date | string | undefined),
    reviewNote: optionalString(row.reviewNote),
    createdAt: toIsoString(row.createdAt as Date | string | undefined) ?? new Date(0).toISOString(),
    updatedAt: toIsoString(row.updatedAt as Date | string | undefined) ?? new Date(0).toISOString()
  };
}

function monthStartUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function createCreditApplicationRelational(
  input: CreditApplicationCreateInput,
  client: DbClient = prisma
): Promise<{ application: CreditApplication }> {
  if (cleanText(input.honeypot, 200)) throw new StoreError("credit_application_honeypot", 400);
  if (!platformSet.has(input.platform)) throw new StoreError("credit_application_invalid_platform", 400);
  if (!followerTierSet.has(input.followerTier)) throw new StoreError("credit_application_invalid_follower_tier", 400);
  const profileUrl = cleanHttpsUrl(input.profileUrl);
  if (!profileUrl) throw new StoreError("credit_application_profile_url_required", 400);
  const evidencePosts = cleanEvidencePosts(input.evidencePosts);
  if (!evidencePosts.length) throw new StoreError("credit_application_evidence_required", 400);

  const customer = await client.customer.findFirst({
    where: { id: input.customerId, siteId: input.siteId },
    select: { id: true, email: true, createdAt: true, signupIp: true }
  });
  if (!customer) throw new StoreError("customer_not_found_for_site", 404);
  const site = await client.site.findUnique({ where: { id: input.siteId }, select: { id: true, slug: true } });
  if (!site) throw new StoreError("site_not_found", 404);

  const { canonical } = canonicalizeEmail(customer.email);
  const emailDomain = canonical.split("@")[1] ?? "";
  if (disposableEmailDomains.some((domain) => emailDomain === domain || emailDomain.endsWith(`.${domain}`))) {
    throw new StoreError("credit_application_disposable_email", 400);
  }

  const existingForEmail = await client.creditApplication.findFirst({
    where: { siteId: input.siteId, canonicalEmail: canonical, status: { in: ["pending", "approved"] } },
    select: { id: true }
  });
  if (existingForEmail) throw new StoreError("credit_application_already_applied", 409);
  const approvedForCustomer = await client.creditApplication.findFirst({
    where: { siteId: input.siteId, customerId: input.customerId, status: "approved" },
    select: { id: true }
  });
  if (approvedForCustomer) throw new StoreError("credit_application_already_approved", 409);

  const submitIp = cleanText(input.submitIp, 120);
  if (submitIp) {
    const recentFromIp = await client.creditApplication.count({
      where: { siteId: input.siteId, submitIp, createdAt: { gte: new Date(Date.now() - dayMs) } }
    });
    if (recentFromIp >= 3) throw new StoreError("credit_application_ip_rate_limited", 429);
  }

  // Reused post evidence (profile or tagged posts) across any prior application.
  const priorApplications = await client.creditApplication.findMany({
    where: { siteId: input.siteId },
    select: { profileUrl: true, evidencePosts: true, submitIp: true }
  });
  const submittedHashes = new Set<string>([evidenceUrlHash(profileUrl), ...evidencePosts.map((post) => post.urlHash)]);
  for (const prior of priorApplications) {
    const priorHashes = [
      ...(prior.profileUrl ? [evidenceUrlHash(prior.profileUrl)] : []),
      ...evidencePostRecords(prior.evidencePosts).map((post) => post.urlHash)
    ].filter((hash): hash is string => typeof hash === "string");
    if (priorHashes.some((hash) => submittedHashes.has(hash))) {
      throw new StoreError("credit_application_post_already_used", 409);
    }
  }

  const riskFlags: string[] = [];
  if (submitIp && customer.signupIp === submitIp && Date.now() - customer.createdAt.getTime() < dayMs) {
    riskFlags.push("new_account_same_ip");
  }
  const submitSubnet = ipv4Subnet(submitIp);
  const signupSubnet = ipv4Subnet(customer.signupIp);
  const subnetTarget = submitSubnet ?? signupSubnet;
  if (subnetTarget) {
    const subnetHistoryCount = priorApplications.filter((prior) => ipv4Subnet(prior.submitIp) === subnetTarget).length;
    if (subnetHistoryCount >= 2) riskFlags.push("ip_cluster");
  }
  const [generationCount, paidOrderCount] = await Promise.all([
    client.generationJob.count({ where: { siteId: input.siteId, customerId: input.customerId } }),
    client.order.count({ where: { siteId: input.siteId, customerId: input.customerId, amountCents: { gt: 0 } } })
  ]);
  if (!generationCount && !paidOrderCount) riskFlags.push("zero_activity");

  const application = await client.creditApplication.create({
    data: {
      id: relationalUid(`credit_${site.slug}`),
      siteId: input.siteId,
      customerId: input.customerId,
      email: customer.email,
      canonicalEmail: canonical,
      platform: input.platform,
      profileUrl,
      followerTier: input.followerTier,
      evidencePosts: evidencePosts as unknown as Prisma.InputJsonValue,
      audience: cleanLongText(input.audience, 2000),
      message: cleanLongText(input.message, 2000),
      status: "pending",
      riskFlags: riskFlags.length ? (riskFlags as unknown as Prisma.InputJsonValue) : undefined,
      submitIp,
      submitUa: cleanText(input.submitUa, 400)
    },
    select: applicationSelect()
  });
  return { application: toCreditApplicationRelational(application as unknown as Record<string, unknown>) };
}

export async function listCreditApplicationsRelational(
  params: { siteId: string; status?: string; query?: string; take?: number },
  client: DbClient = prisma
): Promise<CreditApplicationsPage> {
  const take = Math.max(1, Math.min(100, Math.trunc(params.take ?? 60)));
  const status = params.status && params.status !== "all" && statusSet.has(params.status) ? (params.status as CreditApplicationStatus) : undefined;
  const query = cleanText(params.query, 120);
  const where: Prisma.CreditApplicationWhereInput = {
    siteId: params.siteId,
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { canonicalEmail: { contains: query, mode: "insensitive" } },
            { platform: { contains: query, mode: "insensitive" } },
            { profileUrl: { contains: query, mode: "insensitive" } },
            { audience: { contains: query, mode: "insensitive" } },
            { message: { contains: query, mode: "insensitive" } }
          ]
        }
      : {})
  };
  const [applications, grouped] = await Promise.all([
    client.creditApplication.findMany({
      where,
      select: applicationSelect(),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take
    }),
    client.creditApplication.groupBy({
      by: ["status"],
      where: { siteId: params.siteId },
      _count: { _all: true }
    })
  ]);
  const stats: CreditApplicationsPage["stats"] = { total: 0, pending: 0, approved: 0, rejected: 0, archived: 0 };
  for (const row of grouped) {
    const rowStatus = statusSet.has(row.status) ? (row.status as CreditApplicationStatus) : "pending";
    stats[rowStatus] = row._count._all;
    stats.total += row._count._all;
  }
  const mapped = applications.map((application) => toCreditApplicationRelational(application as unknown as Record<string, unknown>));
  const contexts = await buildReviewContexts(client, params.siteId, mapped);
  return { applications: mapped, stats, contexts };
}

export async function getCreditApplicationReviewContextRelational(
  params: { siteId: string; applicationId: string },
  client: DbClient = prisma
): Promise<{ application: CreditApplication; context: CreditApplicationReviewContext }> {
  const application = await client.creditApplication.findFirst({
    where: { id: params.applicationId, siteId: params.siteId },
    select: applicationSelect()
  });
  if (!application) throw new StoreError("credit_application_not_found", 404);
  const mapped = toCreditApplicationRelational(application as unknown as Record<string, unknown>);
  const contexts = await buildReviewContexts(client, params.siteId, [mapped]);
  return { application: mapped, context: contexts[mapped.id] };
}

/** Account context for the review panel, batched so a page of applications
 * costs a fixed number of queries regardless of list size. */
async function buildReviewContexts(
  client: DbClient,
  siteId: string,
  applications: CreditApplication[]
): Promise<Record<string, CreditApplicationReviewContext>> {
  const customerIds = Array.from(new Set(applications.map((application) => application.customerId)));
  if (!customerIds.length) return {};
  const [customers, generationGroups, orderGroups, applicationIps] = await Promise.all([
    client.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, createdAt: true, signupIp: true }
    }),
    client.generationJob.groupBy({
      by: ["customerId"],
      where: { siteId, customerId: { in: customerIds } },
      _count: { _all: true }
    }),
    client.order.groupBy({
      by: ["customerId"],
      where: { siteId, customerId: { in: customerIds }, amountCents: { gt: 0 } },
      _count: { _all: true }
    }),
    client.creditApplication.findMany({ where: { siteId }, select: { submitIp: true } })
  ]);
  const subnetCounts = new Map<string, number>();
  for (const row of applicationIps) {
    const subnet = ipv4Subnet(row.submitIp);
    if (subnet) subnetCounts.set(subnet, (subnetCounts.get(subnet) ?? 0) + 1);
  }
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const generationCountByCustomer = new Map(generationGroups.map((row) => [row.customerId, row._count._all]));
  const paidOrderCountByCustomer = new Map(orderGroups.map((row) => [row.customerId, row._count._all]));
  const now = Date.now();
  const contexts: Record<string, CreditApplicationReviewContext> = {};
  for (const application of applications) {
    const customer = customerById.get(application.customerId);
    const ownSubnet = ipv4Subnet(application.submitIp);
    const signupSubnet = ipv4Subnet(customer?.signupIp);
    const contextSubnet = ownSubnet ?? signupSubnet;
    contexts[application.id] = {
      customerId: application.customerId,
      accountAgeDays: customer ? Math.max(0, Math.floor((now - customer.createdAt.getTime()) / dayMs)) : 0,
      signupIp: customer?.signupIp ?? undefined,
      submitIp: application.submitIp,
      sameSubnetHistoryCount: contextSubnet
        ? Math.max(0, (subnetCounts.get(contextSubnet) ?? 0) - (ownSubnet ? 1 : 0))
        : 0,
      generationCount: generationCountByCustomer.get(application.customerId) ?? 0,
      paidOrderCount: paidOrderCountByCustomer.get(application.customerId) ?? 0
    };
  }
  return contexts;
}

export async function getCreditProgramQuotaRelational(
  params: { siteId: string },
  client: DbClient = prisma
): Promise<CreditProgramQuota> {
  const monthlyApproved = await client.creditApplication.count({
    where: { siteId: params.siteId, status: "approved", reviewedAt: { gte: monthStartUtc() } }
  });
  return {
    monthlyApproved,
    monthlyCap: MONTHLY_APPROVAL_CAP,
    grantOptions: [...GRANT_OPTIONS],
    lifetimeCap: LIFETIME_CREDIT_CAP
  };
}

export async function reviewCreditApplicationRelational(
  params: {
    siteId: string;
    applicationId: string;
    action: string;
    grantCredits?: number;
    reviewedBy: string;
    reviewNote?: string;
  },
  client: DbClient = prisma
): Promise<{ application: CreditApplication; grantedCredits?: number }> {
  if (params.action === "approve") return approveCreditApplicationRelational(params, client);
  if (!reviewActions.has(params.action)) throw new StoreError("invalid_credit_application_action", 400);

  const existing = await client.creditApplication.findFirst({
    where: { id: params.applicationId, siteId: params.siteId },
    select: { id: true }
  });
  if (!existing) throw new StoreError("credit_application_not_found", 404);
  const application = await client.creditApplication.update({
    where: { id: params.applicationId },
    data: {
      status: params.action,
      reviewedBy: params.reviewedBy,
      reviewedAt: new Date(),
      reviewNote: cleanLongText(params.reviewNote, 2000)
    },
    select: applicationSelect()
  });
  return { application: toCreditApplicationRelational(application as unknown as Record<string, unknown>) };
}

/** Approve grants credits through the same idempotent ledger key as admin
 * adjustments ([siteId, customerId, type, sourceId]); a re-approve or a raced
 * duplicate hits the existing ledger row and fails instead of double-granting. */
async function approveCreditApplicationRelational(
  params: {
    siteId: string;
    applicationId: string;
    grantCredits?: number;
    reviewedBy: string;
    reviewNote?: string;
  },
  client: DbClient
): Promise<{ application: CreditApplication; grantedCredits: number }> {
  const grantCredits = Math.trunc(Number(params.grantCredits));
  if (!GRANT_OPTIONS.includes(grantCredits)) throw new StoreError("invalid_grant_credits", 400);

  // Interactive transactions are only typed on the full client; callers pass prisma here.
  return (client as PrismaClient).$transaction(async (tx) => {
    const application = await tx.creditApplication.findFirst({
      where: { id: params.applicationId, siteId: params.siteId },
      select: applicationSelect()
    });
    if (!application) throw new StoreError("credit_application_not_found", 404);
    if (application.status === "approved") throw new StoreError("credit_application_already_approved", 409);

    const lifetime = await tx.creditLedger.aggregate({
      where: { siteId: params.siteId, customerId: application.customerId, type: "adjustment", sourceType: "creator_program" },
      _sum: { amount: true }
    });
    if ((lifetime._sum.amount ?? 0) + grantCredits > LIFETIME_CREDIT_CAP) {
      throw new StoreError("credit_application_lifetime_cap_reached", 409);
    }
    const monthlyApproved = await tx.creditApplication.count({
      where: { siteId: params.siteId, status: "approved", reviewedAt: { gte: monthStartUtc() } }
    });
    if (monthlyApproved >= MONTHLY_APPROVAL_CAP) throw new StoreError("credit_application_monthly_cap_reached", 409);

    const existingLedger = await tx.creditLedger.findFirst({
      where: { siteId: params.siteId, customerId: application.customerId, type: "adjustment", sourceId: application.id }
    });
    if (existingLedger) throw new StoreError("credit_application_already_approved", 409);

    const customer = await tx.customer.findFirst({
      where: { id: application.customerId, siteId: params.siteId },
      include: { balance: true }
    });
    if (!customer) throw new StoreError("customer_not_found_for_site", 404);
    if (!customer.balance) {
      await tx.creditBalance.createMany({
        data: [{ id: relationalUid("bal"), siteId: params.siteId, customerId: customer.id, balance: 0, reserved: 0 }],
        skipDuplicates: true
      });
    }
    const ledger = await tx.creditLedger.create({
      data: {
        id: relationalUid("led"),
        siteId: params.siteId,
        customerId: application.customerId,
        amount: grantCredits,
        type: "adjustment",
        sourceType: "creator_program",
        sourceId: application.id
      }
    });
    const updatedBalance = await tx.creditBalance.updateMany({
      where: { customerId: application.customerId, siteId: params.siteId },
      data: { balance: { increment: grantCredits } }
    });
    if (updatedBalance.count !== 1) throw new StoreError("credit_application_balance_update_failed", 409);

    const updated = await tx.creditApplication.update({
      where: { id: application.id },
      data: {
        status: "approved",
        grantCredits,
        reviewedBy: params.reviewedBy,
        reviewedAt: new Date(),
        reviewNote: cleanLongText(params.reviewNote, 2000)
      },
      select: applicationSelect()
    });

    await addAuditLogRelational(tx, {
      siteId: params.siteId,
      actorType: "site_admin",
      actorId: params.reviewedBy,
      action: "credit_application_approved",
      targetType: "credit_application",
      targetId: application.id,
      metadata: { grantCredits, platform: application.platform, followerTier: application.followerTier }
    });

    return {
      application: toCreditApplicationRelational(updated as unknown as Record<string, unknown>),
      grantedCredits: grantCredits
    };
  }, { maxWait: 10000, timeout: 20000 });
}
