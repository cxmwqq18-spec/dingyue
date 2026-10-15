import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError } from "./types";
import { assertExpectedRevision, assertTeamPermission, assertTeamSite, normalizeBrandFactInput, normalizeBrandProfile, normalizeTeamName, updateBrandFactSnapshot, type TeamRole } from "./team-brand-core";
import { getTeam } from "./teams";

type BrandRow = {
  id: string; teamId: string; siteId: string; ownerCustomerId: string; name: string; revision: number;
  profile: Record<string, unknown>; createdAt: Date; updatedAt: Date; role?: TeamRole;
};
export type BrandFactRow = {
  id: string; brandProfileId: string; siteId: string; ownerCustomerId: string; factKey: string; factValue: string;
  sourceType: string; sourceUrl: string | null; sourceLabel: string | null; confirmed: boolean;
  confirmedByCustomerId: string | null; confirmedAt: Date | null; revision: number; createdAt: Date; updatedAt: Date;
};
type FactVersionRow = {
  id: string; factId: string; revision: number; action: string; factKey: string; factValue: string; sourceType: string;
  sourceUrl: string | null; sourceLabel: string | null; confirmed: boolean; confirmedByCustomerId: string | null;
  confirmedAt: Date | null; changedByCustomerId: string; createdAt: Date;
};

async function getBrandAccess(siteId: string, brandId: string, customerId: string): Promise<BrandRow> {
  assertTeamSite(siteId, AIVIDEOSUGC_SITE_ID);
  const rows = await prisma.$queryRaw<BrandRow[]>`
    SELECT b."id", b."teamId", b."siteId", b."ownerCustomerId", b."name", b."revision", b."profile", b."createdAt", b."updatedAt", member."role"
    FROM "AidreamcapesBrandProfile" b
    JOIN "AidreamcapesTeam" t ON t."id" = b."teamId" AND t."siteId" = b."siteId" AND t."ownerCustomerId" = b."ownerCustomerId"
    JOIN "AidreamcapesTeamMember" member ON member."teamId" = t."id" AND member."siteId" = t."siteId" AND member."ownerCustomerId" = t."ownerCustomerId"
    JOIN "Customer" currentCustomer ON currentCustomer."id" = member."customerId" AND currentCustomer."siteId" = ${AIVIDEOSUGC_SITE_ID}
    JOIN "Customer" owner ON owner."id" = t."ownerCustomerId" AND owner."siteId" = ${AIVIDEOSUGC_SITE_ID}
    WHERE b."id" = ${brandId} AND b."siteId" = ${AIVIDEOSUGC_SITE_ID} AND member."customerId" = ${customerId}
    LIMIT 1
  `;
  if (!rows[0]) throw new WorkspaceError("brand_not_found", 404);
  return rows[0];
}

export async function listBrands(siteId: string, customerId: string) {
  assertTeamSite(siteId, AIVIDEOSUGC_SITE_ID);
  return prisma.$queryRaw<BrandRow[]>`
    SELECT b."id", b."teamId", b."siteId", b."ownerCustomerId", b."name", b."revision", b."profile", b."createdAt", b."updatedAt", member."role"
    FROM "AidreamcapesBrandProfile" b
    JOIN "AidreamcapesTeam" t ON t."id" = b."teamId" AND t."siteId" = b."siteId" AND t."ownerCustomerId" = b."ownerCustomerId"
    JOIN "AidreamcapesTeamMember" member ON member."teamId" = t."id" AND member."siteId" = t."siteId" AND member."ownerCustomerId" = t."ownerCustomerId"
    JOIN "Customer" currentCustomer ON currentCustomer."id" = member."customerId" AND currentCustomer."siteId" = ${AIVIDEOSUGC_SITE_ID}
    JOIN "Customer" owner ON owner."id" = t."ownerCustomerId" AND owner."siteId" = ${AIVIDEOSUGC_SITE_ID}
    WHERE b."siteId" = ${AIVIDEOSUGC_SITE_ID} AND member."siteId" = ${AIVIDEOSUGC_SITE_ID} AND member."customerId" = ${customerId}
    ORDER BY b."updatedAt" DESC LIMIT 100
  `;
}

export async function getBrand(siteId: string, brandId: string, customerId: string) {
  const brand = await getBrandAccess(siteId, brandId, customerId);
  assertTeamPermission(brand.role, "read");
  return brand;
}

export async function createBrand(siteId: string, customerId: string, teamId: string, nameValue: unknown, profileValue: unknown) {
  const team = await getTeam(siteId, teamId, customerId);
  assertTeamPermission(team.role, "write_brand");
  const name = normalizeTeamName(nameValue);
  const profile = normalizeBrandProfile(profileValue ?? {});
  const id = randomUUID();
  const rows = await prisma.$queryRaw<BrandRow[]>`
    INSERT INTO "AidreamcapesBrandProfile" ("id", "teamId", "siteId", "ownerCustomerId", "name", "revision", "profile")
    SELECT ${id}, t."id", t."siteId", t."ownerCustomerId", ${name}, 1, ${JSON.stringify(profile)}::jsonb
    FROM "AidreamcapesTeam" t
    JOIN "AidreamcapesTeamMember" actor ON actor."teamId" = t."id" AND actor."siteId" = t."siteId" AND actor."ownerCustomerId" = t."ownerCustomerId"
    JOIN "Customer" currentCustomer ON currentCustomer."id" = actor."customerId" AND currentCustomer."siteId" = ${AIVIDEOSUGC_SITE_ID}
    WHERE t."id" = ${teamId} AND t."siteId" = ${AIVIDEOSUGC_SITE_ID} AND t."ownerCustomerId" = ${team.ownerCustomerId}
      AND actor."customerId" = ${customerId} AND actor."role" IN ('owner','admin','editor')
    ON CONFLICT ("teamId") DO NOTHING
    RETURNING "id", "teamId", "siteId", "ownerCustomerId", "name", "revision", "profile", "createdAt", "updatedAt"
  `;
  if (!rows[0]) throw new WorkspaceError("brand_already_exists_or_access_changed", 409);
  return { ...rows[0], role: team.role };
}

export async function updateBrand(siteId: string, brandId: string, customerId: string, patch: { name?: unknown; profile?: unknown; revision: unknown }) {
  const current = await getBrandAccess(siteId, brandId, customerId);
  assertTeamPermission(current.role, "write_brand");
  const expectedRevision = assertExpectedRevision(current.revision, patch.revision);
  const name = patch.name === undefined ? current.name : normalizeTeamName(patch.name);
  const profile = patch.profile === undefined ? current.profile : normalizeBrandProfile(patch.profile);
  const rows = await prisma.$queryRaw<BrandRow[]>`
    UPDATE "AidreamcapesBrandProfile" b SET "name" = ${name}, "profile" = ${JSON.stringify(profile)}::jsonb, "revision" = b."revision" + 1, "updatedAt" = now()
    WHERE b."id" = ${brandId} AND b."teamId" = ${current.teamId} AND b."siteId" = ${AIVIDEOSUGC_SITE_ID}
      AND b."ownerCustomerId" = ${current.ownerCustomerId} AND b."revision" = ${expectedRevision}
      AND EXISTS (
        SELECT 1 FROM "AidreamcapesTeamMember" actor
        JOIN "Customer" c ON c."id" = actor."customerId" AND c."siteId" = ${AIVIDEOSUGC_SITE_ID}
        WHERE actor."teamId" = b."teamId" AND actor."siteId" = ${AIVIDEOSUGC_SITE_ID} AND actor."ownerCustomerId" = b."ownerCustomerId"
          AND actor."customerId" = ${customerId} AND actor."role" IN ('owner','admin','editor')
      )
    RETURNING b."id", b."teamId", b."siteId", b."ownerCustomerId", b."name", b."revision", b."profile", b."createdAt", b."updatedAt"
  `;
  if (!rows[0]) {
    const latest = await getBrandAccess(siteId, brandId, customerId);
    assertTeamPermission(latest.role, "write_brand");
    throw new WorkspaceError("revision_conflict", 409, { expected: expectedRevision, current: latest.revision });
  }
  return { ...rows[0], role: current.role };
}

export async function listBrandFacts(siteId: string, brandId: string, customerId: string) {
  const brand = await getBrandAccess(siteId, brandId, customerId);
  assertTeamPermission(brand.role, "read");
  return prisma.$queryRaw<BrandFactRow[]>`
    SELECT f."id", f."brandProfileId", f."siteId", f."ownerCustomerId", f."factKey", f."factValue", f."sourceType", f."sourceUrl", f."sourceLabel",
      f."confirmed", f."confirmedByCustomerId", f."confirmedAt", f."revision", f."createdAt", f."updatedAt"
    FROM "AidreamcapesBrandFact" f
    WHERE f."brandProfileId" = ${brandId} AND f."siteId" = ${AIVIDEOSUGC_SITE_ID} AND f."ownerCustomerId" = ${brand.ownerCustomerId}
      AND EXISTS (
        SELECT 1 FROM "AidreamcapesBrandProfile" b
        JOIN "AidreamcapesTeamMember" actor ON actor."teamId" = b."teamId" AND actor."siteId" = b."siteId" AND actor."ownerCustomerId" = b."ownerCustomerId"
        JOIN "Customer" c ON c."id" = actor."customerId" AND c."siteId" = ${AIVIDEOSUGC_SITE_ID}
        WHERE b."id" = f."brandProfileId" AND b."siteId" = ${AIVIDEOSUGC_SITE_ID} AND b."ownerCustomerId" = f."ownerCustomerId"
          AND actor."customerId" = ${customerId}
      )
    ORDER BY f."factKey" ASC, f."createdAt" ASC LIMIT 500
  `;
}

export async function createBrandFact(siteId: string, brandId: string, customerId: string, input: Record<string, unknown>) {
  const brand = await getBrandAccess(siteId, brandId, customerId);
  assertTeamPermission(brand.role, "write_brand");
  const fact = normalizeBrandFactInput(input);
  const id = randomUUID();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<BrandFactRow[]>`
      INSERT INTO "AidreamcapesBrandFact" ("id", "brandProfileId", "siteId", "ownerCustomerId", "factKey", "factValue", "sourceType", "sourceUrl", "sourceLabel", "confirmed", "revision")
      SELECT ${id}, b."id", b."siteId", b."ownerCustomerId", ${fact.factKey}, ${fact.factValue}, ${fact.sourceType}, ${fact.sourceUrl}, ${fact.sourceLabel}, FALSE, 1
      FROM "AidreamcapesBrandProfile" b
      JOIN "AidreamcapesTeam" t ON t."id" = b."teamId" AND t."siteId" = b."siteId" AND t."ownerCustomerId" = b."ownerCustomerId"
      JOIN "AidreamcapesTeamMember" actor ON actor."teamId" = t."id" AND actor."siteId" = t."siteId" AND actor."ownerCustomerId" = t."ownerCustomerId"
      JOIN "Customer" c ON c."id" = actor."customerId" AND c."siteId" = ${AIVIDEOSUGC_SITE_ID}
      WHERE b."id" = ${brandId} AND b."siteId" = ${AIVIDEOSUGC_SITE_ID} AND b."ownerCustomerId" = ${brand.ownerCustomerId}
        AND actor."customerId" = ${customerId} AND actor."role" IN ('owner','admin','editor')
      ON CONFLICT ("brandProfileId", "factKey") DO NOTHING
      RETURNING "id", "brandProfileId", "siteId", "ownerCustomerId", "factKey", "factValue", "sourceType", "sourceUrl", "sourceLabel", "confirmed", "confirmedByCustomerId", "confirmedAt", "revision", "createdAt", "updatedAt"
    `;
    if (!rows[0]) throw new WorkspaceError("brand_fact_key_exists_or_access_changed", 409);
    await insertFactVersion(tx, rows[0], customerId, "created");
    return rows[0];
  });
}

async function getBrandFactAccess(siteId: string, brandId: string, factId: string, customerId: string): Promise<BrandFactRow & { role: TeamRole }> {
  const brand = await getBrandAccess(siteId, brandId, customerId);
  assertTeamPermission(brand.role, "read");
  const rows = await prisma.$queryRaw<(BrandFactRow & { role: TeamRole })[]>`
    SELECT f."id", f."brandProfileId", f."siteId", f."ownerCustomerId", f."factKey", f."factValue", f."sourceType", f."sourceUrl", f."sourceLabel",
      f."confirmed", f."confirmedByCustomerId", f."confirmedAt", f."revision", f."createdAt", f."updatedAt", actor."role"
    FROM "AidreamcapesBrandFact" f
    JOIN "AidreamcapesBrandProfile" b ON b."id" = f."brandProfileId" AND b."siteId" = f."siteId" AND b."ownerCustomerId" = f."ownerCustomerId"
    JOIN "AidreamcapesTeamMember" actor ON actor."teamId" = b."teamId" AND actor."siteId" = b."siteId" AND actor."ownerCustomerId" = b."ownerCustomerId"
    JOIN "Customer" currentCustomer ON currentCustomer."id" = actor."customerId" AND currentCustomer."siteId" = ${AIVIDEOSUGC_SITE_ID}
    WHERE f."id" = ${factId} AND f."brandProfileId" = ${brandId} AND f."siteId" = ${AIVIDEOSUGC_SITE_ID}
      AND f."ownerCustomerId" = ${brand.ownerCustomerId} AND actor."customerId" = ${customerId}
    LIMIT 1
  `;
  if (!rows[0]) throw new WorkspaceError("brand_fact_not_found", 404);
  return rows[0];
}

export async function getBrandFact(siteId: string, brandId: string, factId: string, customerId: string) {
  const fact = await getBrandFactAccess(siteId, brandId, factId, customerId);
  const versions = await prisma.$queryRaw<FactVersionRow[]>`
    SELECT v."id", v."factId", v."revision", v."action", v."factKey", v."factValue", v."sourceType", v."sourceUrl", v."sourceLabel",
      v."confirmed", v."confirmedByCustomerId", v."confirmedAt", v."changedByCustomerId", v."createdAt"
    FROM "AidreamcapesBrandFactVersion" v
    WHERE v."factId" = ${factId} AND v."brandProfileId" = ${brandId} AND v."siteId" = ${AIVIDEOSUGC_SITE_ID}
      AND v."ownerCustomerId" = ${fact.ownerCustomerId}
      AND EXISTS (
        SELECT 1 FROM "AidreamcapesBrandFact" f
        JOIN "AidreamcapesBrandProfile" b ON b."id" = f."brandProfileId" AND b."siteId" = f."siteId" AND b."ownerCustomerId" = f."ownerCustomerId"
        JOIN "AidreamcapesTeamMember" actor ON actor."teamId" = b."teamId" AND actor."siteId" = b."siteId" AND actor."ownerCustomerId" = b."ownerCustomerId"
        JOIN "Customer" c ON c."id" = actor."customerId" AND c."siteId" = ${AIVIDEOSUGC_SITE_ID}
        WHERE f."id" = v."factId" AND f."siteId" = ${AIVIDEOSUGC_SITE_ID} AND f."ownerCustomerId" = v."ownerCustomerId" AND actor."customerId" = ${customerId}
      )
    ORDER BY v."revision" DESC LIMIT 100
  `;
  return { fact, versions };
}

async function insertFactVersion(tx: Prisma.TransactionClient, fact: BrandFactRow, changedByCustomerId: string, action: string) {
  const count = await tx.$executeRaw`
    INSERT INTO "AidreamcapesBrandFactVersion" ("id", "factId", "brandProfileId", "siteId", "ownerCustomerId", "revision", "action", "factKey", "factValue", "sourceType", "sourceUrl", "sourceLabel", "confirmed", "confirmedByCustomerId", "confirmedAt", "changedByCustomerId")
    SELECT ${randomUUID()}, f."id", f."brandProfileId", f."siteId", f."ownerCustomerId", f."revision", ${action}, f."factKey", f."factValue", f."sourceType", f."sourceUrl", f."sourceLabel", f."confirmed", f."confirmedByCustomerId", f."confirmedAt", ${changedByCustomerId}
    FROM "AidreamcapesBrandFact" f
    JOIN "AidreamcapesBrandProfile" b ON b."id" = f."brandProfileId" AND b."siteId" = f."siteId" AND b."ownerCustomerId" = f."ownerCustomerId"
    JOIN "AidreamcapesTeamMember" actor ON actor."teamId" = b."teamId" AND actor."siteId" = b."siteId" AND actor."ownerCustomerId" = b."ownerCustomerId"
    JOIN "Customer" currentCustomer ON currentCustomer."id" = actor."customerId" AND currentCustomer."siteId" = ${AIVIDEOSUGC_SITE_ID}
    WHERE f."id" = ${fact.id} AND f."brandProfileId" = ${fact.brandProfileId} AND f."siteId" = ${AIVIDEOSUGC_SITE_ID}
      AND f."ownerCustomerId" = ${fact.ownerCustomerId} AND actor."customerId" = ${changedByCustomerId}
      AND actor."role" IN ('owner','admin','editor')
  `;
  if (!count) throw new WorkspaceError("brand_fact_revision_write_failed", 409);
}

export async function updateBrandFact(siteId: string, brandId: string, factId: string, customerId: string, expectedRevisionValue: unknown, patch: Record<string, unknown>) {
  const current = await getBrandFactAccess(siteId, brandId, factId, customerId);
  assertTeamPermission(current.role, "write_brand");
  const expectedRevision = assertExpectedRevision(current.revision, expectedRevisionValue);
  if (!["factKey", "factValue", "sourceUrl", "sourceLabel", "confirm"].some((key) => Object.hasOwn(patch, key))) throw new WorkspaceError("brand_fact_patch_empty");
  const updated = updateBrandFactSnapshot(current, patch, customerId);
  const action = patch.confirm === true && !["factKey", "factValue", "sourceUrl", "sourceLabel"].some((key) => Object.hasOwn(patch, key)) ? "confirmed"
    : patch.confirm === false && !["factKey", "factValue", "sourceUrl", "sourceLabel"].some((key) => Object.hasOwn(patch, key)) ? "unconfirmed" : "updated";
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<BrandFactRow[]>`
      UPDATE "AidreamcapesBrandFact" f SET "factKey" = ${updated.factKey}, "factValue" = ${updated.factValue}, "sourceType" = ${updated.sourceType},
        "sourceUrl" = ${updated.sourceUrl}, "sourceLabel" = ${updated.sourceLabel}, "confirmed" = ${updated.confirmed},
        "confirmedByCustomerId" = ${updated.confirmedByCustomerId}, "confirmedAt" = ${updated.confirmedAt},
        "revision" = f."revision" + 1, "updatedAt" = now()
      WHERE f."id" = ${factId} AND f."brandProfileId" = ${brandId} AND f."siteId" = ${AIVIDEOSUGC_SITE_ID}
        AND f."ownerCustomerId" = ${current.ownerCustomerId} AND f."revision" = ${expectedRevision}
        AND EXISTS (
          SELECT 1 FROM "AidreamcapesBrandProfile" b
          JOIN "AidreamcapesTeamMember" actor ON actor."teamId" = b."teamId" AND actor."siteId" = b."siteId" AND actor."ownerCustomerId" = b."ownerCustomerId"
          JOIN "Customer" c ON c."id" = actor."customerId" AND c."siteId" = ${AIVIDEOSUGC_SITE_ID}
          WHERE b."id" = f."brandProfileId" AND b."siteId" = ${AIVIDEOSUGC_SITE_ID} AND b."ownerCustomerId" = f."ownerCustomerId"
            AND actor."customerId" = ${customerId} AND actor."role" IN ('owner','admin','editor')
        )
      RETURNING f."id", f."brandProfileId", f."siteId", f."ownerCustomerId", f."factKey", f."factValue", f."sourceType", f."sourceUrl", f."sourceLabel",
        f."confirmed", f."confirmedByCustomerId", f."confirmedAt", f."revision", f."createdAt", f."updatedAt"
    `;
    if (!rows[0]) {
      const latest = await tx.$queryRaw<{ revision: number }[]>`
        SELECT f."revision"
        FROM "AidreamcapesBrandFact" f
        JOIN "AidreamcapesBrandProfile" b ON b."id" = f."brandProfileId" AND b."siteId" = f."siteId" AND b."ownerCustomerId" = f."ownerCustomerId"
        JOIN "AidreamcapesTeamMember" actor ON actor."teamId" = b."teamId" AND actor."siteId" = b."siteId" AND actor."ownerCustomerId" = b."ownerCustomerId"
        JOIN "Customer" currentCustomer ON currentCustomer."id" = actor."customerId" AND currentCustomer."siteId" = ${AIVIDEOSUGC_SITE_ID}
        WHERE f."id" = ${factId} AND f."brandProfileId" = ${brandId} AND f."siteId" = ${AIVIDEOSUGC_SITE_ID}
          AND f."ownerCustomerId" = ${current.ownerCustomerId} AND actor."customerId" = ${customerId} AND actor."role" IN ('owner','admin','editor')
        LIMIT 1
      `;
      if (!latest[0]) throw new WorkspaceError("brand_fact_not_found", 404);
      throw new WorkspaceError("revision_conflict", 409, { expected: expectedRevision, current: latest[0].revision });
    }
    await insertFactVersion(tx, rows[0], customerId, action);
    return rows[0];
  });
}
