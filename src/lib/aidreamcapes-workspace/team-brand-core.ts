import { AIVIDEOSUGC_SITE_ID, WorkspaceError } from "./types";

export const TEAM_ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type TeamRole = typeof TEAM_ROLES[number];
export type TeamPermission = "read" | "manage_team" | "write_brand";

const ROLE_PERMISSIONS: Record<TeamRole, TeamPermission[]> = {
  owner: ["read", "manage_team", "write_brand"],
  admin: ["read", "manage_team", "write_brand"],
  editor: ["read", "write_brand"],
  viewer: ["read"]
};

export function normalizeTeamRole(value: unknown): TeamRole {
  if (typeof value !== "string" || !TEAM_ROLES.includes(value as TeamRole) || value === "owner") throw new WorkspaceError("team_role_invalid");
  return value as TeamRole;
}

export function assertTeamPermission(roleValue: unknown, permission: TeamPermission): asserts roleValue is TeamRole {
  if (!TEAM_ROLES.includes(roleValue as TeamRole) || !ROLE_PERMISSIONS[roleValue as TeamRole].includes(permission)) {
    throw new WorkspaceError("team_permission_denied", 403);
  }
}

export function assertCanInviteRole(actorRole: unknown, invitedRole: TeamRole): void {
  assertTeamPermission(actorRole, "manage_team");
  if (invitedRole === "owner" || (invitedRole === "admin" && actorRole !== "owner")) throw new WorkspaceError("team_invite_role_denied", 403);
}

export function assertCanRemoveMember(actorRole: unknown, targetRole: unknown): void {
  assertTeamPermission(actorRole, "manage_team");
  if (targetRole === "owner" || (actorRole === "admin" && targetRole === "admin")) throw new WorkspaceError("team_member_role_protected", 403);
}

export function assertTeamSite(siteId: string, ownerSiteId: string): void {
  if (siteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("workspace_site_not_found", 404);
  if (ownerSiteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("team_owner_site_mismatch", 403);
}

export function assertInviteAcceptance(invite: { siteId: string; invitedCustomerId: string; status: string; ownerSiteId: string }, customerId: string, customerSiteId: string): void {
  if (invite.siteId !== AIVIDEOSUGC_SITE_ID || invite.ownerSiteId !== AIVIDEOSUGC_SITE_ID || customerSiteId !== AIVIDEOSUGC_SITE_ID) {
    throw new WorkspaceError("team_invite_site_mismatch", 403);
  }
  if (invite.invitedCustomerId !== customerId) throw new WorkspaceError("team_invite_not_found", 404);
  if (invite.status !== "pending") throw new WorkspaceError("team_invite_not_pending", 409);
}

export function assertExpectedRevision(currentRevision: number, expectedRevision: unknown): number {
  const parsed = typeof expectedRevision === "number" ? expectedRevision : Number(expectedRevision);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new WorkspaceError("revision_required", 428);
  if (currentRevision !== parsed) throw new WorkspaceError("revision_conflict", 409, { expected: parsed, current: currentRevision });
  return parsed;
}

export function requestRevisionValue(request: Request, body: Record<string, unknown>): unknown {
  const header = request.headers.get("if-match")?.replace(/^W\//, "").replaceAll('"', "").trim();
  return header || body.revision;
}

export function normalizeTeamName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100) throw new WorkspaceError("team_name_invalid");
  return value.trim();
}

export function normalizeBrandProfile(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(value).length > 64_000) throw new WorkspaceError("brand_profile_invalid");
  return structuredClone(value as Record<string, unknown>);
}

export function normalizeBrandFactInput(input: Record<string, unknown>) {
  if (typeof input.factKey !== "string" || !/^[a-z][a-z0-9_.-]{0,79}$/.test(input.factKey)) throw new WorkspaceError("brand_fact_key_invalid");
  if (typeof input.factValue !== "string" || !input.factValue.trim() || input.factValue.trim().length > 4_000) throw new WorkspaceError("brand_fact_value_invalid");
  const sourceUrl = input.sourceUrl === undefined || input.sourceUrl === null || input.sourceUrl === "" ? null : validateSourceUrl(input.sourceUrl);
  const sourceLabel = input.sourceLabel === undefined || input.sourceLabel === null || input.sourceLabel === "" ? null : boundedText(input.sourceLabel, 120, "brand_fact_source_label_invalid");
  if (input.confirmed === true || input.confirmedByCustomerId || input.confirmedAt) throw new WorkspaceError("brand_fact_confirmation_requires_review", 400);
  return { factKey: input.factKey, factValue: input.factValue.trim(), sourceType: sourceUrl ? "product_url" : "manual", sourceUrl, sourceLabel,
    confirmed: false as const, confirmedByCustomerId: null, confirmedAt: null };
}

function validateSourceUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) throw new WorkspaceError("brand_fact_source_url_invalid");
  let url: URL;
  try { url = new URL(value); } catch { throw new WorkspaceError("brand_fact_source_url_invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new WorkspaceError("brand_fact_source_url_invalid");
  return url.toString();
}

function boundedText(value: unknown, max: number, code: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new WorkspaceError(code);
  return value.trim();
}

export function updateBrandFactSnapshot<T extends {
  factKey: string; factValue: string; sourceType: string; sourceUrl: string | null; sourceLabel: string | null;
  confirmed: boolean; confirmedByCustomerId: string | null; confirmedAt: Date | string | null; revision: number;
}>(current: T, patch: Record<string, unknown>, actorCustomerId: string, now = new Date()): Omit<T, "revision"> & { revision: number } {
  const changedContent = ["factKey", "factValue", "sourceUrl", "sourceLabel"].some((key) => Object.hasOwn(patch, key));
  const next = { ...current } as T;
  if (Object.hasOwn(patch, "factKey")) {
    if (typeof patch.factKey !== "string" || !/^[a-z][a-z0-9_.-]{0,79}$/.test(patch.factKey)) throw new WorkspaceError("brand_fact_key_invalid");
    next.factKey = patch.factKey;
  }
  if (Object.hasOwn(patch, "factValue")) {
    if (typeof patch.factValue !== "string" || !patch.factValue.trim() || patch.factValue.trim().length > 4_000) throw new WorkspaceError("brand_fact_value_invalid");
    next.factValue = patch.factValue.trim();
  }
  if (Object.hasOwn(patch, "sourceUrl")) next.sourceUrl = patch.sourceUrl === null || patch.sourceUrl === "" ? null : validateSourceUrl(patch.sourceUrl);
  if (Object.hasOwn(patch, "sourceLabel")) next.sourceLabel = patch.sourceLabel === null || patch.sourceLabel === "" ? null : boundedText(patch.sourceLabel, 120, "brand_fact_source_label_invalid");
  if (patch.confirm !== undefined && typeof patch.confirm !== "boolean") throw new WorkspaceError("brand_fact_confirmation_invalid");
  if (changedContent) {
    next.sourceType = next.sourceUrl ? "product_url" : "manual";
    next.confirmed = false;
    next.confirmedByCustomerId = null;
    next.confirmedAt = null;
  } else if (patch.confirm === true) {
    next.confirmed = true;
    next.confirmedByCustomerId = actorCustomerId;
    next.confirmedAt = now;
  } else if (patch.confirm === false) {
    next.confirmed = false;
    next.confirmedByCustomerId = null;
    next.confirmedAt = null;
  }
  next.revision += 1;
  return next;
}
