import "server-only";

import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { RelationalStoreError, toStorefrontProfile } from "@/lib/stores/prisma-mappers";
import { clearSiteReadCache } from "@/lib/stores/site-store";
import { validatePublicDraftMediaReferences } from "@/lib/public-draft-validation";
import type { StorefrontProfile, StorefrontProfileJson, ThemeDraftMeta } from "@/lib/types";

function profileEtag(profile: StorefrontProfileJson, revision: number): string {
  return crypto.createHash("sha256").update(JSON.stringify({ revision, profile })).digest("hex");
}

export function normalizeStorefrontProfile(input: StorefrontProfileJson): StorefrontProfileJson {
  const clean = (value: string | undefined) => value?.replace(/\s+/g, " ").trim() || undefined;
  const positive = (value: number | undefined, field: string) => {
    if (value === undefined) return undefined;
    if (!Number.isInteger(value) || value <= 0) throw new RelationalStoreError(`invalid_${field}`, 400);
    return value;
  };
  const supportEmail = clean(input.identity?.supportEmail)?.toLowerCase();
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) throw new RelationalStoreError("invalid_support_email", 400);
  const sameAs = (input.identity?.sameAs ?? []).map((url) => clean(url)).filter((url): url is string => Boolean(url));
  if (sameAs.some((url) => !/^https:\/\/[^\s]+$/i.test(url))) throw new RelationalStoreError("invalid_social_profile_url", 400);
  const effectiveDate = clean(input.policyFacts?.effectiveDate);
  const parsedEffectiveDate = effectiveDate ? new Date(`${effectiveDate}T00:00:00Z`) : undefined;
  if (effectiveDate && (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || Number.isNaN(parsedEffectiveDate?.getTime()) || parsedEffectiveDate?.toISOString().slice(0, 10) !== effectiveDate)) {
    throw new RelationalStoreError("invalid_policy_effective_date", 400);
  }
  if (input.policyFacts?.usesCustomerMediaForTraining !== undefined && typeof input.policyFacts.usesCustomerMediaForTraining !== "boolean") {
    throw new RelationalStoreError("invalid_training_policy", 400);
  }
  if (input.policyFacts?.refundReviewRequired !== undefined && typeof input.policyFacts.refundReviewRequired !== "boolean") {
    throw new RelationalStoreError("invalid_refund_review_policy", 400);
  }
  const creditLifecycle = input.policyFacts?.creditLifecycle;
  const security = input.policyFacts?.security;
  return {
    identity: {
      legalName: clean(input.identity?.legalName),
      entityType: clean(input.identity?.entityType),
      address: input.identity?.address ? {
        line1: clean(input.identity.address.line1) ?? "",
        line2: clean(input.identity.address.line2),
        city: clean(input.identity.address.city) ?? "",
        region: clean(input.identity.address.region) ?? "",
        postalCode: clean(input.identity.address.postalCode) ?? "",
        country: clean(input.identity.address.country) ?? ""
      } : undefined,
      supportEmail,
      phone: clean(input.identity?.phone),
      sameAs: Array.from(new Set(sameAs))
    },
    policyFacts: {
      usesCustomerMediaForTraining: input.policyFacts?.usesCustomerMediaForTraining,
      sourceMediaRetentionDays: positive(input.policyFacts?.sourceMediaRetentionDays, "source_media_retention_days"),
      refundReviewRequired: input.policyFacts?.refundReviewRequired,
      refundWindowDays: positive(input.policyFacts?.refundWindowDays, "refund_window_days"),
      effectiveDate,
      creditLifecycle: creditLifecycle ? {
        reserve: clean(creditLifecycle.reserve),
        consume: clean(creditLifecycle.consume),
        release: clean(creditLifecycle.release)
      } : undefined,
      security: security ? {
        checkoutProvider: clean(security.checkoutProvider),
        transportClaimKey: clean(security.transportClaimKey),
        storageClaimKey: clean(security.storageClaimKey)
      } : undefined
    }
  };
}

export async function getStorefrontProfileRelational(siteId: string): Promise<StorefrontProfile | undefined> {
  const row = await prisma.storefrontProfile.findUnique({ where: { siteId } });
  return row ? toStorefrontProfile(row) : undefined;
}

export async function saveStorefrontProfileDraftRelational(params: {
  siteId: string;
  draftJson: StorefrontProfileJson;
  expectedRevision?: number;
  expectedEtag?: string;
}): Promise<StorefrontProfile> {
  const draftJson = normalizeStorefrontProfile(params.draftJson);
  const profile = await prisma.$transaction(async (tx) => {
    const site = await tx.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
    if (!site) throw new RelationalStoreError("site_not_found", 404);
    const current = await tx.storefrontProfile.findUnique({ where: { siteId: params.siteId } });
    const currentProfile = current ? toStorefrontProfile(current) : undefined;
    if (params.expectedRevision !== undefined && currentProfile?.draftMeta?.revision !== params.expectedRevision) throw new RelationalStoreError("storefront_profile_draft_conflict", 409);
    if (params.expectedEtag && currentProfile?.draftMeta?.etag !== params.expectedEtag) throw new RelationalStoreError("storefront_profile_draft_conflict", 409);
    const [pages, settings] = await Promise.all([
      tx.themePage.findMany({ where: { siteId: params.siteId }, select: { draftJson: true } }),
      tx.themeSettings.findUnique({ where: { siteId: params.siteId }, select: { draftJson: true } })
    ]);
    await validatePublicDraftMediaReferences({ db: tx, siteId: params.siteId, values: [...pages.map((page) => page.draftJson), settings?.draftJson, draftJson] });
    const revision = (currentProfile?.draftMeta?.revision ?? 0) + 1;
    const now = new Date().toISOString();
    const draftMeta: ThemeDraftMeta = { revision, updatedAt: now, etag: profileEtag(draftJson, revision) };
    const row = await tx.storefrontProfile.upsert({
      where: { siteId: params.siteId },
      create: {
        id: `profile_${params.siteId}`,
        siteId: params.siteId,
        draftJson: draftJson as unknown as Prisma.InputJsonValue,
        publishedJson: draftJson as unknown as Prisma.InputJsonValue,
        draftMeta: draftMeta as unknown as Prisma.InputJsonValue
      },
      update: {
        draftJson: draftJson as unknown as Prisma.InputJsonValue,
        publishedJson: draftJson as unknown as Prisma.InputJsonValue,
        draftMeta: draftMeta as unknown as Prisma.InputJsonValue
      }
    });
    const profile = toStorefrontProfile(row);
    if (!profile) throw new RelationalStoreError("storefront_profile_save_failed", 500);
    return profile;
  });
  clearSiteReadCache();
  return profile;
}
