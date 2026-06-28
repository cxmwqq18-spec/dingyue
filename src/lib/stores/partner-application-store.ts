import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { StoreError } from "@/lib/server-store";
import type { PartnerApplication, PartnerApplicationStatus, PublicPartnerApplicationReceipt } from "@/lib/types";
import { cloneJson, relationalUid, toPartnerApplicationRelational } from "@/lib/stores/prisma-mappers";

type DbClient = PrismaClient;

const statuses: PartnerApplicationStatus[] = ["pending", "approved", "rejected", "archived"];
const statusSet = new Set<string>(statuses);

export type PartnerApplicationCreateInput = {
  siteId: string;
  name: string;
  email: string;
  company?: string;
  website?: string;
  socialLinks?: string[];
  audience?: string;
  cadence?: string;
  campaignIdeas?: string;
  message?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type PartnerApplicationsPage = {
  applications: PartnerApplication[];
  stats: Record<PartnerApplicationStatus | "total", number>;
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

function cleanEmail(value: unknown): string {
  const email = cleanText(value, 254)?.toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StoreError("invalid_partner_email", 400);
  return email;
}

function cleanUrl(value: unknown): string | undefined {
  const text = cleanText(value, 500);
  if (!text) return undefined;
  try {
    const url = new URL(text.startsWith("http://") || text.startsWith("https://") ? text : `https://${text}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString().slice(0, 500);
  } catch {
    return text.slice(0, 500);
  }
}

function cleanSocialLinks(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\n|,/)
      : [];
  return raw.map((item) => cleanUrl(item)).filter((item): item is string => Boolean(item)).slice(0, 8);
}

function normalizeStatus(status: unknown): PartnerApplicationStatus {
  return statusSet.has(String(status)) ? String(status) as PartnerApplicationStatus : "pending";
}

function applicationSelect() {
  return {
    id: true,
    siteId: true,
    email: true,
    name: true,
    company: true,
    website: true,
    socialLinks: true,
    audience: true,
    cadence: true,
    campaignIdeas: true,
    message: true,
    status: true,
    source: true,
    reviewedBy: true,
    reviewedAt: true,
    reviewNote: true,
    metadata: true,
    createdAt: true,
    updatedAt: true
  } satisfies Prisma.PartnerApplicationSelect;
}

export async function createPartnerApplicationRelational(
  input: PartnerApplicationCreateInput,
  client: DbClient = prisma
): Promise<{ application: PartnerApplication; receipt: PublicPartnerApplicationReceipt }> {
  const name = cleanText(input.name, 120);
  if (!name) throw new StoreError("partner_name_required", 400);
  const email = cleanEmail(input.email);
  const socialLinks = cleanSocialLinks(input.socialLinks);
  const audience = cleanLongText(input.audience, 2000);
  if (!audience) throw new StoreError("partner_audience_required", 400);
  if (!socialLinks.length && !cleanUrl(input.website)) throw new StoreError("partner_channel_required", 400);

  const site = await client.site.findUnique({ where: { id: input.siteId }, select: { id: true, slug: true } });
  if (!site) throw new StoreError("site_not_found", 404);

  const application = await client.partnerApplication.create({
    data: {
      id: relationalUid(`partner_${site.slug}`),
      siteId: input.siteId,
      email,
      name,
      company: cleanText(input.company, 160),
      website: cleanUrl(input.website),
      socialLinks: socialLinks.length ? socialLinks : undefined,
      audience,
      cadence: cleanText(input.cadence, 240),
      campaignIdeas: cleanLongText(input.campaignIdeas, 2000),
      message: cleanLongText(input.message, 2000),
      status: "pending",
      source: cleanText(input.source, 120) ?? "partner-registration",
      metadata: input.metadata ? cloneJson(input.metadata) as Prisma.InputJsonValue : undefined
    },
    select: applicationSelect()
  });
  const mapped = toPartnerApplicationRelational(application as unknown as Record<string, unknown>);
  return {
    application: mapped,
    receipt: {
      id: mapped.id,
      status: mapped.status,
      createdAt: mapped.createdAt
    }
  };
}

export async function listPartnerApplicationsRelational(
  params: { siteId: string; status?: string; query?: string; take?: number },
  client: DbClient = prisma
): Promise<PartnerApplicationsPage> {
  const take = Math.max(1, Math.min(100, Math.trunc(params.take ?? 60)));
  const status = params.status && params.status !== "all" ? normalizeStatus(params.status) : undefined;
  const query = cleanText(params.query, 120);
  const where: Prisma.PartnerApplicationWhereInput = {
    siteId: params.siteId,
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { company: { contains: query, mode: "insensitive" } },
            { audience: { contains: query, mode: "insensitive" } }
          ]
        }
      : {})
  };
  const [applications, grouped] = await Promise.all([
    client.partnerApplication.findMany({
      where,
      select: applicationSelect(),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take
    }),
    client.partnerApplication.groupBy({
      by: ["status"],
      where: { siteId: params.siteId },
      _count: { _all: true }
    })
  ]);
  const stats: PartnerApplicationsPage["stats"] = { total: 0, pending: 0, approved: 0, rejected: 0, archived: 0 };
  for (const row of grouped) {
    const rowStatus = normalizeStatus(row.status);
    stats[rowStatus] = row._count._all;
    stats.total += row._count._all;
  }
  return {
    applications: applications.map((application) => toPartnerApplicationRelational(application as unknown as Record<string, unknown>)),
    stats
  };
}

export async function updatePartnerApplicationStatusRelational(
  params: { siteId: string; applicationId: string; status: PartnerApplicationStatus; reviewedBy: string; reviewNote?: string },
  client: DbClient = prisma
): Promise<{ application: PartnerApplication }> {
  if (!statusSet.has(params.status)) throw new StoreError("invalid_partner_application_status", 400);
  const existing = await client.partnerApplication.findFirst({
    where: { id: params.applicationId, siteId: params.siteId },
    select: { id: true }
  });
  if (!existing) throw new StoreError("partner_application_not_found", 404);
  const application = await client.partnerApplication.update({
    where: { id: params.applicationId },
    data: {
      status: params.status,
      reviewedBy: params.reviewedBy,
      reviewedAt: new Date(),
      reviewNote: cleanLongText(params.reviewNote, 2000)
    },
    select: applicationSelect()
  });
  return { application: toPartnerApplicationRelational(application as unknown as Record<string, unknown>) };
}
