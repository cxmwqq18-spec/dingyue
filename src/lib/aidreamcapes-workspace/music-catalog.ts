import "server-only";
import { prisma } from "@/lib/prisma";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError, type WorkspaceTask } from "./types";
import {
  MUSIC_DEMO_FIXTURES,
  evaluateMusicRights,
  summarizeMusicLicense,
  type MusicCatalogTrackRecord,
  type MusicLicenseRecord,
} from "./music-catalog-rights";
import { assertWorkspaceSite } from "./store";

type CatalogRow = {
  id: string;
  siteId: string;
  title: string;
  artist: string;
  genre: string;
  moods: string[];
  durationSeconds: number;
  bpm: number | null;
  previewAssetKey: string | null;
  demoOnly: boolean;
  active: boolean;
  licenseId: string | null;
  licenseStatus: string | null;
  territories: string[] | null;
  usageTypes: string[] | null;
  attributionRequired: boolean | null;
  attributionText: string | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  licenseRevision: number | null;
};

export interface MusicCatalogFilters {
  territory?: string;
  usage?: "ads" | "organic";
}

export interface MusicCatalogEntry {
  id: string;
  title: string;
  artist: string;
  genre: string;
  moods: string[];
  durationSeconds: number;
  bpm: number | null;
  demoOnly: boolean;
  licenseStatus: string;
  license: null | {
    territories: string[];
    usageTypes: string[];
    attributionRequired: boolean;
    attributionText: string | null;
    startsAt: string | null;
    expiresAt: string | null;
  };
  eligibleForRequestedUse: boolean;
  attributionText?: string;
  previewUrl: string | null;
  notice?: string;
}

function trackFromRow(row: CatalogRow): MusicCatalogTrackRecord {
  return {
    id: row.id,
    siteId: row.siteId,
    title: row.title,
    artist: row.artist,
    genre: row.genre,
    moods: row.moods ?? [],
    durationSeconds: row.durationSeconds,
    bpm: row.bpm,
    previewAssetKey: row.previewAssetKey,
    demoOnly: row.demoOnly,
    active: row.active,
  };
}

function licenseFromRow(row: OwnedCatalogRow): MusicLicenseRecord | null {
  if (!row.licenseId || !row.licenseStatus) return null;
  return {
    id: row.licenseId,
    siteId: row.siteId,
    customerId: row.customerId,
    trackId: row.id,
    status: row.licenseStatus,
    territories: row.territories ?? [],
    usageTypes: row.usageTypes ?? [],
    attributionRequired: row.attributionRequired ?? false,
    attributionText: row.attributionText,
    startsAt: row.startsAt,
    expiresAt: row.expiresAt,
    revision: row.licenseRevision ?? 1,
  };
}

// customerId is attached to each joined row for the ownership check; it is not returned to callers.
type OwnedCatalogRow = CatalogRow & { customerId: string };

function entryFromRow(row: OwnedCatalogRow, filters: MusicCatalogFilters, now = new Date()): MusicCatalogEntry {
  const track = trackFromRow(row);
  const license = licenseFromRow(row);
  const decision = filters.territory && filters.usage
    ? evaluateMusicRights({ track, license, siteId: row.siteId, customerId: row.customerId, territory: filters.territory, usage: filters.usage, now })
    : { allowed: false as const, code: "music_license_required" as const };
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    genre: row.genre,
    moods: row.moods ?? [],
    durationSeconds: row.durationSeconds,
    bpm: row.bpm,
    demoOnly: row.demoOnly,
    licenseStatus: summarizeMusicLicense(license, now),
    license: license ? {
      territories: license.territories,
      usageTypes: license.usageTypes,
      attributionRequired: license.attributionRequired,
      attributionText: license.attributionText,
      startsAt: license.startsAt ? new Date(license.startsAt).toISOString() : null,
      expiresAt: license.expiresAt ? new Date(license.expiresAt).toISOString() : null,
    } : null,
    eligibleForRequestedUse: decision.allowed,
    ...(decision.allowed && decision.attributionRequired && decision.attributionText ? { attributionText: decision.attributionText } : {}),
    previewUrl: row.previewAssetKey
      ? `/api/sites/${AIVIDEOSUGC_SITE_ID}/aivideosugc/music/catalog/${encodeURIComponent(row.id)}/preview`
      : null,
  };
}

function entryFromDemoFixture(fixture: typeof MUSIC_DEMO_FIXTURES[number]): MusicCatalogEntry {
  return {
    id: fixture.id,
    title: fixture.title,
    artist: fixture.artist,
    genre: fixture.genre,
    moods: fixture.moods,
    durationSeconds: fixture.durationSeconds,
    bpm: fixture.bpm,
    demoOnly: true,
    licenseStatus: "unlicensed",
    license: null,
    eligibleForRequestedUse: false,
    previewUrl: null,
    notice: fixture.notice,
  };
}

export async function listMusicCatalogForCustomer(siteId: string, customerId: string, filters: MusicCatalogFilters = {}) {
  assertWorkspaceSite(siteId);
  const rows = await prisma.$queryRaw<OwnedCatalogRow[]>`
    SELECT t."id", t."siteId", t."title", t."artist", t."genre", t."moods",
      t."durationSeconds", t."bpm", t."previewAssetKey", t."demoOnly", t."active",
      l."id" AS "licenseId", l."status" AS "licenseStatus", l."territories", l."usageTypes",
      l."attributionRequired", l."attributionText", l."startsAt", l."expiresAt", l."revision" AS "licenseRevision",
      ${customerId}::text AS "customerId"
    FROM "AidreamcapesMusicCatalogTrack" t
    LEFT JOIN "AidreamcapesMusicLicense" l
      ON l."trackId" = t."id" AND l."siteId" = ${AIVIDEOSUGC_SITE_ID} AND l."customerId" = ${customerId}
    WHERE t."siteId" = ${AIVIDEOSUGC_SITE_ID} AND t."active" = TRUE
    ORDER BY t."title" ASC LIMIT 500`;
  const entries = rows.map((row) => entryFromRow(row, filters));
  const demoEntries = MUSIC_DEMO_FIXTURES.map(entryFromDemoFixture);
  return [...entries, ...demoEntries];
}

export async function getMusicCatalogTrackForCustomer(siteId: string, customerId: string, trackId: string): Promise<{
  track: MusicCatalogTrackRecord;
  license: MusicLicenseRecord | null;
}> {
  assertWorkspaceSite(siteId);
  const rows = await prisma.$queryRaw<OwnedCatalogRow[]>`
    SELECT t."id", t."siteId", t."title", t."artist", t."genre", t."moods",
      t."durationSeconds", t."bpm", t."previewAssetKey", t."demoOnly", t."active",
      l."id" AS "licenseId", l."status" AS "licenseStatus", l."territories", l."usageTypes",
      l."attributionRequired", l."attributionText", l."startsAt", l."expiresAt", l."revision" AS "licenseRevision",
      ${customerId}::text AS "customerId"
    FROM "AidreamcapesMusicCatalogTrack" t
    LEFT JOIN "AidreamcapesMusicLicense" l
      ON l."trackId" = t."id" AND l."siteId" = ${AIVIDEOSUGC_SITE_ID} AND l."customerId" = ${customerId}
    WHERE t."id" = ${trackId} AND t."siteId" = ${AIVIDEOSUGC_SITE_ID} AND t."active" = TRUE
    LIMIT 1`;
  const row = rows[0];
  if (row) return { track: trackFromRow(row), license: licenseFromRow(row) };

  const fixture = MUSIC_DEMO_FIXTURES.find((candidate) => candidate.id === trackId);
  if (fixture) return { track: fixture, license: null };
  throw new WorkspaceError("music_track_not_found", 404);
}

export async function assertTaskMusicSelectionRights(task: WorkspaceTask): Promise<MusicCatalogTrackRecord | undefined> {
  const selection = task.musicSelection;
  if (!selection) return undefined;
  assertWorkspaceSite(task.siteId);
  if (selection.usage !== "ads") throw new WorkspaceError("music_ads_not_permitted", 403);
  const { track, license } = await getMusicCatalogTrackForCustomer(task.siteId, task.customerId, selection.trackId);
  if (!license || license.id !== selection.licenseId || license.revision !== selection.licenseRevision) {
    throw new WorkspaceError("music_license_changed", 409);
  }
  const decision = evaluateMusicRights({
    track,
    license,
    siteId: task.siteId,
    customerId: task.customerId,
    territory: selection.territory,
    usage: selection.usage,
  });
  if (!decision.allowed) throw new WorkspaceError(decision.code, 403);
  if (selection.attributionRequired !== decision.attributionRequired ||
      (decision.attributionRequired && selection.attributionText !== decision.attributionText)) {
    throw new WorkspaceError("music_license_changed", 409);
  }
  return track;
}
