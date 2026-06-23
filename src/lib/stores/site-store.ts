import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { shouldFallbackRelationalRead, warnRelationalFallback } from "@/lib/stores/relational-fallback";
import type { AiGatewayGroup, CreativePack, Site, SiteAdmin, SiteAiApp, SiteDomain } from "@/lib/types";

import {
  addAuditLogRelational,
  cloneJson,
  hashRelationalPassword,
  relationalSessionTtlMs,
  relationalUid,
  RelationalStoreError,
  slugify,
  toGatewayGroup,
  toCreativePack,
  toPublicSiteAdminRelational,
  toSite,
  toSiteAdmin,
  toSiteAdminSessionRelational,
  toSiteAiApp,
  toSiteDomain,
  uid,
  verifyRelationalPassword,
} from "./prisma-mappers";

async function getSiteRelational(siteId: string): Promise<Site> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      domains: true,
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      connect: true
    }
  });
  if (!site) throw new RelationalStoreError("site_not_found", 404);
  return toSite(site);
}

export async function createSiteAdminSessionRelational(params: { siteId: string; email: string; password: string }) {
  const email = params.email.trim().toLowerCase();
  const admin = await prisma.siteAdmin.findUnique({ where: { siteId_email: { siteId: params.siteId, email } } });
  if (!admin || !verifyRelationalPassword(params.password, admin.passwordHash)) {
    throw new RelationalStoreError("invalid_site_admin_credentials", 401);
  }
  const session = await prisma.siteAdminSession.create({
    data: {
      id: relationalUid("sasess"),
      siteId: params.siteId,
      siteAdminId: admin.id,
      expiresAt: new Date(Date.now() + relationalSessionTtlMs)
    }
  });
  return {
    siteAdmin: toPublicSiteAdminRelational(admin),
    session: toSiteAdminSessionRelational(session)
  };
}

export async function createSiteAdminSessionByAdminIdRelational(params: { siteId: string; siteAdminId: string }) {
  const admin = await prisma.siteAdmin.findFirst({ where: { siteId: params.siteId, id: params.siteAdminId } });
  if (!admin) throw new RelationalStoreError("site_admin_not_found", 404);
  const session = await prisma.siteAdminSession.create({
    data: {
      id: relationalUid("sasess"),
      siteId: params.siteId,
      siteAdminId: admin.id,
      expiresAt: new Date(Date.now() + relationalSessionTtlMs)
    }
  });
  return {
    siteAdmin: toPublicSiteAdminRelational(admin),
    session: toSiteAdminSessionRelational(session)
  };
}

export async function deleteSiteAdminSessionRelational(sessionId: string): Promise<void> {
  await prisma.siteAdminSession.deleteMany({ where: { id: sessionId } });
}

export async function getSiteAdminBySessionRelational(params: { siteId: string; sessionId?: string }) {
  if (!params.sessionId) return undefined;
  let session;
  try {
    session = await prisma.siteAdminSession.findFirst({
      where: { id: params.sessionId, siteId: params.siteId, expiresAt: { gt: new Date() } },
      include: { siteAdmin: true }
    });
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("site admin session lookup", error);
    return undefined;
  }
  if (!session?.siteAdmin) return undefined;
  return {
    siteAdmin: toPublicSiteAdminRelational(session.siteAdmin),
    session: toSiteAdminSessionRelational(session)
  };
}

export async function getSiteAdminBridgeTargetRelational(siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, slug: true }
  });
  if (!site) throw new RelationalStoreError("site_not_found", 404);

  const admin =
    (await prisma.siteAdmin.findFirst({
      where: { siteId, role: "owner" },
      orderBy: { createdAt: "asc" }
    })) ??
    (await prisma.siteAdmin.findFirst({
      where: { siteId },
      orderBy: { createdAt: "asc" }
    }));
  if (!admin) throw new RelationalStoreError("site_admin_not_found", 404);

  return { site, admin: toPublicSiteAdminRelational(admin) };
}

export async function getSiteBySlugRelational(slug: string): Promise<Site | undefined> {
  const site = await prisma.site.findUnique({
    where: { slug },
    include: {
      domains: true,
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      connect: true
    }
  });
  return site ? toSite(site) : undefined;
}

export async function getFirstSiteAdminEmailRelational(siteId: string): Promise<string | undefined> {
  const admin = await prisma.siteAdmin.findFirst({
    where: { siteId },
    orderBy: { createdAt: "asc" },
    select: { email: true }
  });
  return admin?.email;
}

export async function createSiteRelational(params: {
  name: string;
  slug?: string;
  ownerEmail: string;
  ownerPassword?: string;
  sourceSiteId?: string;
  domain?: string;
}): Promise<{
  site: Site;
  domain: SiteDomain;
  admin: SiteAdmin;
  siteAiApps: SiteAiApp[];
  gatewayGroup: AiGatewayGroup;
}> {
  const slug = slugify(params.slug || params.name);
  if (!slug) throw new RelationalStoreError("invalid_site_slug", 400);
  const ownerEmail = params.ownerEmail.trim().toLowerCase();
  if (!ownerEmail.includes("@")) throw new RelationalStoreError("invalid_owner_email", 400);

  return prisma.$transaction(async (tx) => {
    const existingSite = await tx.site.findUnique({ where: { slug } });
    if (existingSite) throw new RelationalStoreError("site_slug_exists", 409);
    const domainName = (params.domain || `${slug}.localhost`).trim().toLowerCase();
    const existingDomain = await tx.siteDomain.findUnique({ where: { domain: domainName } });
    if (existingDomain) throw new RelationalStoreError("site_domain_exists", 409);

    const sourceSite = await tx.site.findFirst({
      where: params.sourceSiteId ? { id: params.sourceSiteId } : undefined,
      include: {
        pages: true,
        settings: true,
        aiApps: { include: { aiApp: true } }
      }
    });
    if (!sourceSite) throw new RelationalStoreError("source_site_not_found", 404);

    const siteId = `site_${slug}`;
    const branding = cloneJson(sourceSite.branding) as Site["branding"];
    branding.logoText = params.name.trim().split(/\s+/)[0] || params.name.trim();
    branding.description = `New AI subscription site cloned from ${sourceSite.name}.`;

    await tx.site.create({
      data: {
        id: siteId,
        name: params.name.trim(),
        slug,
        status: "draft",
        primaryDomain: domainName,
        timezone: sourceSite.timezone,
        currency: sourceSite.currency,
        branding: branding as unknown as Prisma.InputJsonValue
      }
    });

    const domainRecord = await tx.siteDomain.create({
      data: {
        id: uid("dom"),
        siteId,
        domain: domainName,
        isPrimary: true,
        status: "pending"
      }
    });

    const adminRecord = await tx.siteAdmin.create({
      data: {
        id: uid("admin"),
        siteId,
        email: ownerEmail,
        passwordHash: hashRelationalPassword(params.ownerPassword || `${slug}123`),
        displayName: ownerEmail.split("@")[0] || ownerEmail,
        role: "owner"
      }
    });

    if (sourceSite.settings) {
      await tx.themeSettings.create({
        data: {
          id: `settings_${siteId}`,
          siteId,
          draftJson: cloneJson(sourceSite.settings.draftJson) as unknown as Prisma.InputJsonValue,
          publishedJson: cloneJson(sourceSite.settings.publishedJson) as unknown as Prisma.InputJsonValue
        }
      });
    }

    for (const [index, page] of sourceSite.pages.entries()) {
      await tx.themePage.create({
        data: {
          id: `${siteId}_${slugify(page.slug) || `page_${index + 1}`}`,
          siteId,
          pageType: page.pageType,
          slug: page.slug,
          title: page.title,
          draftJson: cloneJson(page.draftJson) as unknown as Prisma.InputJsonValue,
          publishedJson: cloneJson(page.publishedJson) as unknown as Prisma.InputJsonValue
        }
      });
    }

    const siteAiApps = [];
    for (const app of sourceSite.aiApps) {
      const record = await tx.siteAiApp.create({
        data: {
          id: `sai_${slug}_${app.aiApp.slug}`,
          siteId,
          aiAppId: app.aiAppId,
          enabled: app.enabled,
          creditCost: app.creditCost,
          routeKey: app.routeKey
        },
        include: { aiApp: true }
      });
      siteAiApps.push(toSiteAiApp(record));
    }

    const gatewayGroupRecord = await tx.aiGatewayGroup.create({
      data: {
        id: `gw_${slug}_primary`,
        siteId,
        name: `${branding.logoText} primary quota`,
        status: "paused",
        modelAllowlist: ["gpt-image-2", "gpt-4.1-mini"],
        monthlyQuota: 3000,
        usedQuota: 0,
        retryStatusCodes: [429, 500, 502, 503],
        rateLimitPerMinute: 30,
        accountPoolMode: "shared",
        unavailableReason: "Stripe Connect pending"
      }
    });
    const gatewayGroup = toGatewayGroup(gatewayGroupRecord);

    await addAuditLogRelational(tx, {
      siteId,
      actorType: "platform_admin",
      actorId: "platform",
      action: "site_created",
      targetType: "site",
      targetId: siteId,
      metadata: { slug, domain: domainName }
    });

    return {
      site: toSite(
        await tx.site.findUniqueOrThrow({
          where: { id: siteId },
          include: { domains: true, pages: true, settings: true, connect: true }
        })
      ),
      domain: toSiteDomain(domainRecord),
      admin: toSiteAdmin(adminRecord),
      siteAiApps,
      gatewayGroup
    };
  });
}

export async function addSiteDomainRelational(params: {
  siteId: string;
  domain: string;
  isPrimary?: boolean;
}): Promise<{ domain: SiteDomain; site: Site }> {
  const domainName = params.domain.trim().toLowerCase();
  if (!domainName.includes(".")) throw new RelationalStoreError("invalid_domain", 400);

  return prisma.$transaction(async (tx) => {
    const site = await tx.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
    if (!site) throw new RelationalStoreError("site_not_found", 404);
    const existingDomain = await tx.siteDomain.findUnique({ where: { domain: domainName } });
    if (existingDomain) throw new RelationalStoreError("site_domain_exists", 409);
    if (params.isPrimary) {
      await tx.siteDomain.updateMany({ where: { siteId: params.siteId }, data: { isPrimary: false } });
    }
    const domain = await tx.siteDomain.create({
      data: {
        id: uid("dom"),
        siteId: params.siteId,
        domain: domainName,
        isPrimary: Boolean(params.isPrimary),
        status: "pending"
      }
    });
    if (params.isPrimary) {
      await tx.site.update({ where: { id: params.siteId }, data: { primaryDomain: domainName } });
    }
    const updatedSite = await tx.site.findUniqueOrThrow({
      where: { id: params.siteId },
      include: { domains: true, pages: true, settings: true, connect: true }
    });
    return { domain: toSiteDomain(domain), site: toSite(updatedSite) };
  });
}

export async function updateSiteDomainRelational(params: {
  siteId: string;
  domainId: string;
  isPrimary?: boolean;
  status?: SiteDomain["status"];
}): Promise<{ domain: SiteDomain; site: Site }> {
  return prisma.$transaction(async (tx) => {
    const domain = await tx.siteDomain.findFirst({ where: { siteId: params.siteId, id: params.domainId } });
    if (!domain) throw new RelationalStoreError("site_domain_not_found", 404);
    if (params.isPrimary) {
      await tx.siteDomain.updateMany({ where: { siteId: params.siteId }, data: { isPrimary: false } });
    }
    const updated = await tx.siteDomain.update({
      where: { id: domain.id },
      data: {
        status: params.isPrimary ? "active" : params.status,
        isPrimary: params.isPrimary ?? domain.isPrimary
      }
    });
    return { domain: toSiteDomain(updated), site: await getSiteRelational(params.siteId) };
  });
}

export async function deleteSiteDomainRelational(params: { siteId: string; domainId: string }): Promise<{ deletedDomain: SiteDomain; site: Site }> {
  return prisma.$transaction(async (tx) => {
    const site = await tx.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
    if (!site) throw new RelationalStoreError("site_not_found", 404);
    const domain = await tx.siteDomain.findFirst({ where: { siteId: params.siteId, id: params.domainId } });
    if (!domain) throw new RelationalStoreError("site_domain_not_found", 404);
    const fallback = domain.isPrimary
      ? await tx.siteDomain.findFirst({
          where: { siteId: params.siteId, id: { not: params.domainId } },
          orderBy: { createdAt: "asc" }
        })
      : null;
    if (domain.isPrimary && !fallback) throw new RelationalStoreError("site_requires_primary_domain", 409);

    await tx.siteDomain.delete({ where: { id: domain.id } });
    if (domain.isPrimary && fallback) {
      const fallbackStatus = fallback.status === "failed" ? "pending" : fallback.status;
      await tx.siteDomain.update({
        where: { id: fallback.id },
        data: { isPrimary: true, status: fallbackStatus }
      });
      await tx.site.update({
        where: { id: params.siteId },
        data: { primaryDomain: fallback.domain }
      });
    }

    return {
      deletedDomain: toSiteDomain(domain),
      site: await getSiteRelational(params.siteId)
    };
  });
}

export async function updateSiteSettingsRelational(params: {
  siteId: string;
  actor?: string;
  actorType?: "platform_admin" | "site_admin" | "customer" | "system" | "worker";
  name: string;
  status: Site["status"];
  currency: string;
  timezone: string;
  branding: Site["branding"];
  connect: Site["connect"];
}): Promise<{ site: Site }> {
  const name = params.name.trim();
  const currency = params.currency.trim().toUpperCase();
  const timezone = params.timezone.trim();
  const branding = {
    logoText: params.branding.logoText.trim(),
    market: params.branding.market.trim(),
    description: params.branding.description.trim()
  };
  if (!name) throw new RelationalStoreError("invalid_site_name", 400);
  if (!currency) throw new RelationalStoreError("invalid_currency", 400);
  if (!timezone) throw new RelationalStoreError("invalid_timezone", 400);
  if (!branding.logoText || !branding.market || !branding.description) throw new RelationalStoreError("invalid_branding", 400);

  return prisma.$transaction(async (tx) => {
    await tx.site.update({
      where: { id: params.siteId },
      data: {
        name,
        status: params.status,
        currency,
        timezone,
        branding: branding as unknown as Prisma.InputJsonValue
      }
    });
    await tx.stripeConnectAccount.upsert({
      where: { siteId: params.siteId },
      create: {
        id: `connect_${params.siteId}`,
        siteId: params.siteId,
        stripeAccountId: params.connect.stripeAccountId.trim(),
        onboardingStatus: params.connect.status,
        chargesEnabled: params.connect.chargesEnabled,
        payoutsEnabled: params.connect.payoutsEnabled
      },
      update: {
        stripeAccountId: params.connect.stripeAccountId.trim(),
        onboardingStatus: params.connect.status,
        chargesEnabled: params.connect.chargesEnabled,
        payoutsEnabled: params.connect.payoutsEnabled
      }
    });
    await addAuditLogRelational(tx, {
      siteId: params.siteId,
      actorType: params.actorType ?? "site_admin",
      actorId: params.actor ?? "site_admin_demo",
      action: "site_settings_updated",
      targetType: "site",
      targetId: params.siteId,
      metadata: { status: params.status, currency, timezone, connectStatus: params.connect.status }
    });
    return { site: await getSiteRelational(params.siteId) };
  });
}

export async function createSiteAdminRelational(params: {
  siteId: string;
  email: string;
  password: string;
  displayName: string;
  role: SiteAdmin["role"];
  actor?: string;
}): Promise<{ admin: SiteAdmin }> {
  const email = params.email.trim().toLowerCase();
  const displayName = params.displayName.trim();
  if (!email.includes("@")) throw new RelationalStoreError("invalid_site_admin_email", 400);
  if (params.password.trim().length < 6) throw new RelationalStoreError("invalid_site_admin_password", 400);
  if (!displayName) throw new RelationalStoreError("invalid_site_admin_name", 400);
  if (!["owner", "admin", "support"].includes(params.role)) throw new RelationalStoreError("invalid_site_admin_role", 400);
  const admin = await prisma.siteAdmin.create({
    data: { id: uid("admin"), siteId: params.siteId, email, passwordHash: hashRelationalPassword(params.password.trim()), displayName, role: params.role }
  });
  await addAuditLogRelational(prisma, {
    siteId: params.siteId,
    actorType: "site_admin",
    actorId: params.actor ?? "site_admin_demo",
    action: "site_admin_created",
    targetType: "site_admin",
    targetId: admin.id,
    metadata: { email, role: params.role }
  });
  return { admin: toSiteAdmin(admin) };
}

export async function updateSiteAdminRelational(params: {
  siteId: string;
  adminId: string;
  displayName?: string;
  role?: SiteAdmin["role"];
  password?: string;
  actor?: string;
}): Promise<{ admin: SiteAdmin }> {
  const data: { displayName?: string; role?: string; passwordHash?: string } = {};
  const metadata: Record<string, string | boolean> = {};
  if (params.displayName !== undefined) {
    data.displayName = params.displayName.trim();
    if (!data.displayName) throw new RelationalStoreError("invalid_site_admin_name", 400);
    metadata.displayName = data.displayName;
  }
  if (params.role !== undefined) {
    if (!["owner", "admin", "support"].includes(params.role)) throw new RelationalStoreError("invalid_site_admin_role", 400);
    data.role = params.role;
    metadata.role = params.role;
  }
  if (params.password !== undefined) {
    if (params.password.trim().length < 6) throw new RelationalStoreError("invalid_site_admin_password", 400);
    data.passwordHash = hashRelationalPassword(params.password.trim());
    metadata.passwordReset = true;
  }
  if (!Object.keys(metadata).length) throw new RelationalStoreError("site_admin_update_empty", 400);

  const existing = await prisma.siteAdmin.findFirst({ where: { siteId: params.siteId, id: params.adminId } });
  if (!existing) throw new RelationalStoreError("site_admin_not_found", 404);
  const admin = await prisma.siteAdmin.update({ where: { id: existing.id }, data });
  await addAuditLogRelational(prisma, {
    siteId: params.siteId,
    actorType: "site_admin",
    actorId: params.actor ?? "site_admin_demo",
    action: "site_admin_updated",
    targetType: "site_admin",
    targetId: admin.id,
    metadata
  });
  return { admin: toSiteAdmin(admin) };
}

export async function deleteSiteAdminRelational(params: {
  siteId: string;
  adminId: string;
  actor?: string;
}): Promise<{ deletedAdmin: SiteAdmin }> {
  const admin = await prisma.siteAdmin.findFirst({ where: { siteId: params.siteId, id: params.adminId } });
  if (!admin) throw new RelationalStoreError("site_admin_not_found", 404);
  if (admin.role === "owner") {
    const ownerCount = await prisma.siteAdmin.count({ where: { siteId: params.siteId, role: "owner" } });
    if (ownerCount <= 1) throw new RelationalStoreError("site_requires_owner", 409);
  }
  await prisma.siteAdmin.delete({ where: { id: admin.id } });
  await addAuditLogRelational(prisma, {
    siteId: params.siteId,
    actorType: "site_admin",
    actorId: params.actor ?? "site_admin_demo",
    action: "site_admin_deleted",
    targetType: "site_admin",
    targetId: admin.id,
    metadata: { email: admin.email, role: admin.role }
  });
  return { deletedAdmin: toSiteAdmin(admin) };
}

export async function upsertCreativePackRelational(params: {
  siteId: string;
  packId?: string;
  name: string;
  headline: string;
  description: string;
  category: CreativePack["category"];
  aiAppSlug: string;
  status: CreativePack["status"];
  creditCost: number;
  outputCount: number;
  trainingRequired: boolean;
}): Promise<{ pack: CreativePack; created: boolean }> {
  const site = await prisma.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
  if (!site) throw new RelationalStoreError("site_not_found", 404);
  const name = params.name.trim();
  if (name.length < 2) throw new RelationalStoreError("creative_pack_name_required", 400);
  const headline = params.headline.trim() || name;
  const description = params.description.trim();
  if (description.length < 8) throw new RelationalStoreError("creative_pack_description_required", 400);
  const aiApp = await prisma.aiApp.findUnique({ where: { slug: params.aiAppSlug }, select: { id: true } });
  if (!aiApp) throw new RelationalStoreError("ai_app_not_found", 404);
  if (!Number.isInteger(params.creditCost) || params.creditCost < 0) throw new RelationalStoreError("invalid_credit_cost", 400);
  if (!Number.isInteger(params.outputCount) || params.outputCount < 1) throw new RelationalStoreError("invalid_output_count", 400);

  const existing = params.packId
    ? await prisma.creativePack.findFirst({ where: { siteId: params.siteId, id: params.packId } })
    : null;
  const pack = existing
    ? await prisma.creativePack.update({
        where: { id: existing.id },
        data: {
          name,
          headline,
          description,
          category: params.category,
          aiAppSlug: params.aiAppSlug,
          status: params.status,
          creditCost: params.creditCost,
          outputCount: params.outputCount,
          trainingRequired: params.trainingRequired
        }
      })
    : await prisma.creativePack.create({
        data: {
          id: params.packId ?? uid("pack"),
          siteId: params.siteId,
          name,
          headline,
          description,
          category: params.category,
          aiAppSlug: params.aiAppSlug,
          status: params.status,
          creditCost: params.creditCost,
          outputCount: params.outputCount,
          trainingRequired: params.trainingRequired,
          generationCount: 0,
          conversionRate: 0
        }
      });

  return { pack: toCreativePack(pack), created: !existing };
}

export async function deleteCreativePackRelational(params: {
  siteId: string;
  packId: string;
}): Promise<{ deletedPack: CreativePack }> {
  const pack = await prisma.creativePack.findFirst({ where: { siteId: params.siteId, id: params.packId } });
  if (!pack) throw new RelationalStoreError("creative_pack_not_found", 404);
  await prisma.$transaction(async (tx) => {
    await tx.album.updateMany({ where: { siteId: params.siteId, creativePackId: pack.id }, data: { creativePackId: null } });
    await tx.creativePack.delete({ where: { id: pack.id } });
  });
  return { deletedPack: toCreativePack(pack) };
}

export async function updateGatewayGroupRelational(params: {
  siteId: string;
  groupId: string;
  status: AiGatewayGroup["status"];
  modelAllowlist: string[];
  monthlyQuota: number;
  retryStatusCodes: number[];
  rateLimitPerMinute: number;
  accountPoolMode: AiGatewayGroup["accountPoolMode"];
  unavailableReason?: string;
}): Promise<{ gatewayGroup: AiGatewayGroup }> {
  if (!Number.isInteger(params.monthlyQuota) || params.monthlyQuota < 0) throw new RelationalStoreError("invalid_monthly_quota", 400);
  if (!Number.isInteger(params.rateLimitPerMinute) || params.rateLimitPerMinute < 1) throw new RelationalStoreError("invalid_rate_limit", 400);
  const existing = await prisma.aiGatewayGroup.findFirst({ where: { id: params.groupId, siteId: params.siteId } });
  if (!existing) throw new RelationalStoreError("gateway_group_not_found", 404);
  const gatewayGroup = await prisma.aiGatewayGroup.update({
    where: { id: params.groupId },
    data: {
      status: params.status,
      modelAllowlist: params.modelAllowlist.map((model) => model.trim()).filter(Boolean),
      monthlyQuota: params.monthlyQuota,
      retryStatusCodes: params.retryStatusCodes.filter((code) => Number.isInteger(code)),
      rateLimitPerMinute: params.rateLimitPerMinute,
      accountPoolMode: params.accountPoolMode,
      unavailableReason: params.unavailableReason?.trim() || null
    }
  });
  return { gatewayGroup: toGatewayGroup(gatewayGroup) };
}

export async function updateSiteAiAppRelational(params: {
  siteId: string;
  siteAiAppId: string;
  enabled: boolean;
  creditCost: number;
  routeKey: string;
}): Promise<{ siteAiApp: SiteAiApp }> {
  if (!Number.isInteger(params.creditCost) || params.creditCost < 0) throw new RelationalStoreError("invalid_credit_cost", 400);
  const routeKey = params.routeKey.trim();
  if (!routeKey) throw new RelationalStoreError("invalid_route_key", 400);
  const existing = await prisma.siteAiApp.findFirst({ where: { id: params.siteAiAppId, siteId: params.siteId } });
  if (!existing) throw new RelationalStoreError("site_ai_app_not_found", 404);
  const siteAiApp = await prisma.siteAiApp.update({
    where: { id: params.siteAiAppId },
    data: { enabled: params.enabled, creditCost: params.creditCost, routeKey },
    include: { aiApp: true }
  });
  return { siteAiApp: toSiteAiApp(siteAiApp) };
}
