import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError } from "./types";
import { assertCanInviteRole, assertCanRemoveMember, assertExpectedRevision, assertInviteAcceptance, assertTeamPermission, assertTeamSite, normalizeTeamName, normalizeTeamRole, type TeamRole } from "./team-brand-core";

type TeamRow = { id: string; siteId: string; ownerCustomerId: string; name: string; revision: number; createdAt: Date; updatedAt: Date; role?: TeamRole };
type InviteRow = { id: string; teamId: string; siteId: string; ownerCustomerId: string; invitedCustomerId: string; invitedByCustomerId: string; role: TeamRole; status: string; createdAt: Date; respondedAt: Date | null };

async function getTeamAccess(siteId: string, teamId: string, customerId: string): Promise<TeamRow> {
  assertTeamSite(siteId, AIVIDEOSUGC_SITE_ID);
  const rows = await prisma.$queryRaw<TeamRow[]>`
    SELECT t."id", t."siteId", t."ownerCustomerId", t."name", t."revision", t."createdAt", t."updatedAt", actor."role"
    FROM "AidreamcapesTeam" t
    JOIN "AidreamcapesTeamMember" actor ON actor."teamId" = t."id" AND actor."siteId" = t."siteId" AND actor."ownerCustomerId" = t."ownerCustomerId"
    JOIN "Customer" currentCustomer ON currentCustomer."id" = actor."customerId" AND currentCustomer."siteId" = ${AIVIDEOSUGC_SITE_ID}
    JOIN "Customer" owner ON owner."id" = t."ownerCustomerId" AND owner."siteId" = ${AIVIDEOSUGC_SITE_ID}
    WHERE t."id" = ${teamId} AND t."siteId" = ${AIVIDEOSUGC_SITE_ID} AND actor."customerId" = ${customerId}
    LIMIT 1
  `;
  if (!rows[0]) throw new WorkspaceError("team_not_found", 404);
  return rows[0];
}

export async function listTeams(siteId: string, customerId: string) {
  assertTeamSite(siteId, AIVIDEOSUGC_SITE_ID);
  return prisma.$queryRaw<TeamRow[]>`
    SELECT t."id", t."siteId", t."ownerCustomerId", t."name", t."revision", t."createdAt", t."updatedAt", m."role"
    FROM "AidreamcapesTeam" t
    JOIN "AidreamcapesTeamMember" m ON m."teamId" = t."id" AND m."siteId" = t."siteId" AND m."ownerCustomerId" = t."ownerCustomerId"
    JOIN "Customer" currentCustomer ON currentCustomer."id" = m."customerId" AND currentCustomer."siteId" = ${AIVIDEOSUGC_SITE_ID}
    JOIN "Customer" owner ON owner."id" = t."ownerCustomerId" AND owner."siteId" = ${AIVIDEOSUGC_SITE_ID}
    WHERE t."siteId" = ${AIVIDEOSUGC_SITE_ID} AND m."siteId" = ${AIVIDEOSUGC_SITE_ID} AND m."customerId" = ${customerId}
    ORDER BY t."updatedAt" DESC LIMIT 100
  `;
}

export async function getTeam(siteId: string, teamId: string, customerId: string) {
  const team = await getTeamAccess(siteId, teamId, customerId);
  assertTeamPermission(team.role, "read");
  return team;
}

export async function createTeam(siteId: string, ownerCustomerId: string, nameValue: unknown) {
  assertTeamSite(siteId, AIVIDEOSUGC_SITE_ID);
  const name = normalizeTeamName(nameValue);
  const id = randomUUID();
  const memberId = randomUUID();
  return prisma.$transaction(async (tx) => {
    const teams = await tx.$queryRaw<TeamRow[]>`
      INSERT INTO "AidreamcapesTeam" ("id", "siteId", "ownerCustomerId", "name", "revision")
      SELECT ${id}, ${AIVIDEOSUGC_SITE_ID}, c."id", ${name}, 1
      FROM "Customer" c WHERE c."id" = ${ownerCustomerId} AND c."siteId" = ${AIVIDEOSUGC_SITE_ID} AND c."status" = 'active'
      RETURNING "id", "siteId", "ownerCustomerId", "name", "revision", "createdAt", "updatedAt"
    `;
    if (!teams[0]) throw new WorkspaceError("customer_site_mismatch", 403);
    const members = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO "AidreamcapesTeamMember" ("id", "teamId", "siteId", "ownerCustomerId", "customerId", "role")
      SELECT ${memberId}, t."id", t."siteId", t."ownerCustomerId", owner."id", 'owner'
      FROM "AidreamcapesTeam" t
      JOIN "Customer" owner ON owner."id" = t."ownerCustomerId" AND owner."siteId" = ${AIVIDEOSUGC_SITE_ID}
      WHERE t."id" = ${id} AND t."siteId" = ${AIVIDEOSUGC_SITE_ID} AND t."ownerCustomerId" = ${ownerCustomerId}
      RETURNING "id"
    `;
    if (!members[0]) throw new WorkspaceError("team_owner_membership_failed", 500);
    return { ...teams[0], role: "owner" as const };
  });
}

export async function updateTeam(siteId: string, teamId: string, customerId: string, patch: { name?: unknown; revision: unknown }) {
  const current = await getTeamAccess(siteId, teamId, customerId);
  assertTeamPermission(current.role, "manage_team");
  const expectedRevision = assertExpectedRevision(current.revision, patch.revision);
  const name = patch.name === undefined ? current.name : normalizeTeamName(patch.name);
  const rows = await prisma.$queryRaw<TeamRow[]>`
    UPDATE "AidreamcapesTeam" t SET "name" = ${name}, "revision" = t."revision" + 1, "updatedAt" = now()
    WHERE t."id" = ${teamId} AND t."siteId" = ${AIVIDEOSUGC_SITE_ID} AND t."ownerCustomerId" = ${current.ownerCustomerId} AND t."revision" = ${expectedRevision}
      AND EXISTS (
        SELECT 1 FROM "AidreamcapesTeamMember" actor
        JOIN "Customer" c ON c."id" = actor."customerId" AND c."siteId" = ${AIVIDEOSUGC_SITE_ID}
        WHERE actor."teamId" = t."id" AND actor."siteId" = ${AIVIDEOSUGC_SITE_ID} AND actor."ownerCustomerId" = t."ownerCustomerId"
          AND actor."customerId" = ${customerId} AND actor."role" IN ('owner','admin')
      )
    RETURNING t."id", t."siteId", t."ownerCustomerId", t."name", t."revision", t."createdAt", t."updatedAt"
  `;
  if (!rows[0]) {
    const latest = await getTeamAccess(siteId, teamId, customerId);
    assertTeamPermission(latest.role, "manage_team");
    throw new WorkspaceError("revision_conflict", 409, { expected: expectedRevision, current: latest.revision });
  }
  return { ...rows[0], role: current.role };
}

export async function listTeamMembers(siteId: string, teamId: string, customerId: string) {
  const team = await getTeamAccess(siteId, teamId, customerId);
  assertTeamPermission(team.role, "read");
  return prisma.$queryRaw<{ customerId: string; name: string; role: TeamRole; createdAt: Date }[]>`
    SELECT m."customerId", c."name", m."role", m."createdAt"
    FROM "AidreamcapesTeamMember" m
    JOIN "Customer" c ON c."id" = m."customerId" AND c."siteId" = ${AIVIDEOSUGC_SITE_ID}
    WHERE m."teamId" = ${teamId} AND m."siteId" = ${AIVIDEOSUGC_SITE_ID} AND m."ownerCustomerId" = ${team.ownerCustomerId}
      AND EXISTS (
        SELECT 1 FROM "AidreamcapesTeamMember" actor
        WHERE actor."teamId" = m."teamId" AND actor."siteId" = ${AIVIDEOSUGC_SITE_ID} AND actor."ownerCustomerId" = m."ownerCustomerId"
          AND actor."customerId" = ${customerId}
      )
    ORDER BY CASE m."role" WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'editor' THEN 2 ELSE 3 END, c."name" ASC
    LIMIT 200
  `;
}

export async function inviteExistingCustomer(siteId: string, teamId: string, inviterCustomerId: string, targetCustomerId: string, roleValue: unknown) {
  const team = await getTeamAccess(siteId, teamId, inviterCustomerId);
  const role = normalizeTeamRole(roleValue);
  assertCanInviteRole(team.role, role);
  if (targetCustomerId === team.ownerCustomerId) throw new WorkspaceError("team_member_exists", 409);
  const targetRows = await prisma.$queryRaw<{ customerId: string; alreadyMember: boolean }[]>`
    SELECT target."id" AS "customerId",
      EXISTS (SELECT 1 FROM "AidreamcapesTeamMember" existing WHERE existing."teamId" = t."id" AND existing."siteId" = ${AIVIDEOSUGC_SITE_ID}
        AND existing."ownerCustomerId" = t."ownerCustomerId" AND existing."customerId" = target."id") AS "alreadyMember"
    FROM "AidreamcapesTeam" t
    JOIN "Customer" target ON target."id" = ${targetCustomerId} AND target."siteId" = ${AIVIDEOSUGC_SITE_ID} AND target."status" = 'active'
    JOIN "AidreamcapesTeamMember" actor ON actor."teamId" = t."id" AND actor."siteId" = t."siteId" AND actor."ownerCustomerId" = t."ownerCustomerId"
    WHERE t."id" = ${teamId} AND t."siteId" = ${AIVIDEOSUGC_SITE_ID} AND t."ownerCustomerId" = ${team.ownerCustomerId}
      AND actor."customerId" = ${inviterCustomerId} AND actor."role" IN ('owner','admin')
    LIMIT 1
  `;
  if (!targetRows[0]) throw new WorkspaceError("team_invite_customer_not_found", 404);
  if (targetRows[0].alreadyMember) throw new WorkspaceError("team_member_exists", 409);
  const id = randomUUID();
  const rows = await prisma.$queryRaw<InviteRow[]>`
    INSERT INTO "AidreamcapesTeamInvite" ("id", "teamId", "siteId", "ownerCustomerId", "invitedCustomerId", "invitedByCustomerId", "role", "status")
    SELECT ${id}, t."id", t."siteId", t."ownerCustomerId", target."id", actor."customerId", ${role}, 'pending'
    FROM "AidreamcapesTeam" t
    JOIN "Customer" target ON target."id" = ${targetCustomerId} AND target."siteId" = ${AIVIDEOSUGC_SITE_ID}
    JOIN "AidreamcapesTeamMember" actor ON actor."teamId" = t."id" AND actor."siteId" = t."siteId" AND actor."ownerCustomerId" = t."ownerCustomerId"
    JOIN "Customer" inviter ON inviter."id" = actor."customerId" AND inviter."siteId" = ${AIVIDEOSUGC_SITE_ID}
    WHERE t."id" = ${teamId} AND t."siteId" = ${AIVIDEOSUGC_SITE_ID} AND t."ownerCustomerId" = ${team.ownerCustomerId}
      AND actor."customerId" = ${inviterCustomerId} AND actor."role" IN ('owner','admin') AND target."id" <> t."ownerCustomerId"
      AND NOT EXISTS (SELECT 1 FROM "AidreamcapesTeamMember" member WHERE member."teamId" = t."id" AND member."siteId" = ${AIVIDEOSUGC_SITE_ID}
        AND member."ownerCustomerId" = t."ownerCustomerId" AND member."customerId" = target."id")
    ON CONFLICT ("teamId", "invitedCustomerId", "status") DO NOTHING
    RETURNING "id", "teamId", "siteId", "ownerCustomerId", "invitedCustomerId", "invitedByCustomerId", "role", "status", "createdAt", "respondedAt"
  `;
  if (!rows[0]) throw new WorkspaceError("team_invite_already_pending", 409);
  return rows[0];
}

export async function listTeamInvites(siteId: string, teamId: string, customerId: string) {
  const team = await getTeamAccess(siteId, teamId, customerId);
  assertTeamPermission(team.role, "read");
  return prisma.$queryRaw<InviteRow[]>`
    SELECT i."id", i."teamId", i."siteId", i."ownerCustomerId", i."invitedCustomerId", i."invitedByCustomerId", i."role", i."status", i."createdAt", i."respondedAt"
    FROM "AidreamcapesTeamInvite" i
    WHERE i."teamId" = ${teamId} AND i."siteId" = ${AIVIDEOSUGC_SITE_ID} AND i."ownerCustomerId" = ${team.ownerCustomerId}
      AND EXISTS (SELECT 1 FROM "AidreamcapesTeamMember" actor WHERE actor."teamId" = i."teamId" AND actor."siteId" = ${AIVIDEOSUGC_SITE_ID}
        AND actor."ownerCustomerId" = i."ownerCustomerId" AND actor."customerId" = ${customerId})
    ORDER BY i."createdAt" DESC LIMIT 100
  `;
}

export async function listMyPendingInvites(siteId: string, customerId: string) {
  assertTeamSite(siteId, AIVIDEOSUGC_SITE_ID);
  return prisma.$queryRaw<(InviteRow & { teamName: string })[]>`
    SELECT i."id", i."teamId", i."siteId", i."ownerCustomerId", i."invitedCustomerId", i."invitedByCustomerId", i."role", i."status", i."createdAt", i."respondedAt", t."name" AS "teamName"
    FROM "AidreamcapesTeamInvite" i
    JOIN "AidreamcapesTeam" t ON t."id" = i."teamId" AND t."siteId" = i."siteId" AND t."ownerCustomerId" = i."ownerCustomerId"
    JOIN "Customer" target ON target."id" = i."invitedCustomerId" AND target."siteId" = ${AIVIDEOSUGC_SITE_ID}
    JOIN "Customer" owner ON owner."id" = i."ownerCustomerId" AND owner."siteId" = ${AIVIDEOSUGC_SITE_ID}
    WHERE i."siteId" = ${AIVIDEOSUGC_SITE_ID} AND i."invitedCustomerId" = ${customerId} AND i."status" = 'pending'
      AND EXISTS (SELECT 1 FROM "AidreamcapesTeamMember" ownerMember WHERE ownerMember."teamId" = i."teamId" AND ownerMember."siteId" = ${AIVIDEOSUGC_SITE_ID}
        AND ownerMember."ownerCustomerId" = i."ownerCustomerId" AND ownerMember."customerId" = i."ownerCustomerId" AND ownerMember."role" = 'owner')
    ORDER BY i."createdAt" DESC LIMIT 100
  `;
}

export async function acceptTeamInvite(siteId: string, inviteId: string, customerId: string) {
  assertTeamSite(siteId, AIVIDEOSUGC_SITE_ID);
  return prisma.$transaction(async (tx) => {
    const invites = await tx.$queryRaw<(InviteRow & { ownerSiteId: string; targetSiteId: string })[]>`
      SELECT i."id", i."teamId", i."siteId", i."ownerCustomerId", i."invitedCustomerId", i."invitedByCustomerId", i."role", i."status", i."createdAt", i."respondedAt",
        owner."siteId" AS "ownerSiteId", target."siteId" AS "targetSiteId"
      FROM "AidreamcapesTeamInvite" i
      JOIN "AidreamcapesTeam" t ON t."id" = i."teamId" AND t."siteId" = i."siteId" AND t."ownerCustomerId" = i."ownerCustomerId"
      JOIN "Customer" owner ON owner."id" = i."ownerCustomerId" AND owner."siteId" = ${AIVIDEOSUGC_SITE_ID}
      JOIN "Customer" target ON target."id" = i."invitedCustomerId" AND target."siteId" = ${AIVIDEOSUGC_SITE_ID}
      WHERE i."id" = ${inviteId} AND i."siteId" = ${AIVIDEOSUGC_SITE_ID} AND i."invitedCustomerId" = ${customerId} AND i."status" = 'pending'
        AND EXISTS (SELECT 1 FROM "AidreamcapesTeamMember" ownerMember WHERE ownerMember."teamId" = i."teamId" AND ownerMember."siteId" = ${AIVIDEOSUGC_SITE_ID}
          AND ownerMember."ownerCustomerId" = i."ownerCustomerId" AND ownerMember."customerId" = i."ownerCustomerId" AND ownerMember."role" = 'owner')
      LIMIT 1
    `;
    const invite = invites[0];
    if (!invite) throw new WorkspaceError("team_invite_not_found", 404);
    assertInviteAcceptance({ siteId: invite.siteId, invitedCustomerId: invite.invitedCustomerId, status: invite.status, ownerSiteId: invite.ownerSiteId }, customerId, invite.targetSiteId);
    const memberRows = await tx.$queryRaw<{ id: string; teamId: string; siteId: string; ownerCustomerId: string; customerId: string; role: TeamRole; createdAt: Date }[]>`
      INSERT INTO "AidreamcapesTeamMember" ("id", "teamId", "siteId", "ownerCustomerId", "customerId", "role")
      SELECT ${randomUUID()}, i."teamId", i."siteId", i."ownerCustomerId", target."id", i."role"
      FROM "AidreamcapesTeamInvite" i
      JOIN "AidreamcapesTeam" t ON t."id" = i."teamId" AND t."siteId" = i."siteId" AND t."ownerCustomerId" = i."ownerCustomerId"
      JOIN "Customer" target ON target."id" = i."invitedCustomerId" AND target."siteId" = ${AIVIDEOSUGC_SITE_ID}
      WHERE i."id" = ${inviteId} AND i."siteId" = ${AIVIDEOSUGC_SITE_ID} AND i."ownerCustomerId" = ${invite.ownerCustomerId}
        AND i."invitedCustomerId" = ${customerId} AND i."status" = 'pending'
        AND EXISTS (SELECT 1 FROM "AidreamcapesTeamMember" ownerMember WHERE ownerMember."teamId" = i."teamId" AND ownerMember."siteId" = ${AIVIDEOSUGC_SITE_ID}
          AND ownerMember."ownerCustomerId" = i."ownerCustomerId" AND ownerMember."customerId" = i."ownerCustomerId" AND ownerMember."role" = 'owner')
      ON CONFLICT ("teamId", "customerId") DO NOTHING
      RETURNING "id", "teamId", "siteId", "ownerCustomerId", "customerId", "role", "createdAt"
    `;
    if (!memberRows[0]) throw new WorkspaceError("team_member_exists", 409);
    const accepted = await tx.$queryRaw<InviteRow[]>`
      UPDATE "AidreamcapesTeamInvite" SET "status" = 'accepted', "respondedAt" = now()
      WHERE "id" = ${inviteId} AND "teamId" = ${invite.teamId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID}
        AND "ownerCustomerId" = ${invite.ownerCustomerId} AND "invitedCustomerId" = ${customerId} AND "status" = 'pending'
      RETURNING "id", "teamId", "siteId", "ownerCustomerId", "invitedCustomerId", "invitedByCustomerId", "role", "status", "createdAt", "respondedAt"
    `;
    if (!accepted[0]) throw new WorkspaceError("team_invite_not_pending", 409);
    return { invite: accepted[0], membership: memberRows[0] };
  });
}

export async function removeTeamMember(siteId: string, teamId: string, actorCustomerId: string, targetCustomerId: string) {
  const team = await getTeamAccess(siteId, teamId, actorCustomerId);
  const target = await prisma.$queryRaw<{ role: TeamRole }[]>`
    SELECT member."role"
    FROM "AidreamcapesTeamMember" member
    JOIN "Customer" target ON target."id" = member."customerId" AND target."siteId" = ${AIVIDEOSUGC_SITE_ID}
    WHERE member."teamId" = ${teamId} AND member."siteId" = ${AIVIDEOSUGC_SITE_ID} AND member."ownerCustomerId" = ${team.ownerCustomerId}
      AND member."customerId" = ${targetCustomerId}
      AND EXISTS (SELECT 1 FROM "AidreamcapesTeamMember" actor WHERE actor."teamId" = member."teamId" AND actor."siteId" = ${AIVIDEOSUGC_SITE_ID}
        AND actor."ownerCustomerId" = member."ownerCustomerId" AND actor."customerId" = ${actorCustomerId})
    LIMIT 1
  `;
  if (!target[0]) throw new WorkspaceError("team_member_not_found", 404);
  assertCanRemoveMember(team.role, target[0].role);
  const count = await prisma.$executeRaw`
    DELETE FROM "AidreamcapesTeamMember" member
    WHERE member."teamId" = ${teamId} AND member."siteId" = ${AIVIDEOSUGC_SITE_ID} AND member."ownerCustomerId" = ${team.ownerCustomerId} AND member."customerId" = ${targetCustomerId}
      AND EXISTS (SELECT 1 FROM "AidreamcapesTeamMember" actor WHERE actor."teamId" = member."teamId" AND actor."siteId" = ${AIVIDEOSUGC_SITE_ID}
        AND actor."ownerCustomerId" = member."ownerCustomerId" AND actor."customerId" = ${actorCustomerId})
  `;
  if (!count) throw new WorkspaceError("team_member_not_found", 404);
}
