import type { MusicUsage } from "./types";

export const AIDREAMCAPES_MUSIC_SITE_ID = "site_aidreamcapes";

export interface MusicCatalogTrackRecord {
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
}

export interface MusicLicenseRecord {
  id: string;
  siteId: string;
  customerId: string;
  trackId: string;
  status: string;
  territories: string[];
  usageTypes: string[];
  attributionRequired: boolean;
  attributionText: string | null;
  startsAt: Date | string | null;
  expiresAt: Date | string | null;
  revision: number;
}

export interface MusicDemoFixture extends MusicCatalogTrackRecord {
  demoOnly: true;
  licenseStatus: "unlicensed";
  license: null;
  notice: "Demo fixture only; no music license is represented.";
}

export const MUSIC_DEMO_FIXTURES: MusicDemoFixture[] = [
  {
    id: "demo-fixture-synthetic-ambient-01",
    siteId: AIDREAMCAPES_MUSIC_SITE_ID,
    title: "Synthetic ambient demo",
    artist: "Aidreamcapes demo fixture",
    genre: "ambient",
    moods: ["calm", "minimal"],
    durationSeconds: 30,
    bpm: null,
    previewAssetKey: null,
    demoOnly: true,
    active: true,
    licenseStatus: "unlicensed",
    license: null,
    notice: "Demo fixture only; no music license is represented.",
  },
  {
    id: "demo-fixture-synthetic-upbeat-01",
    siteId: AIDREAMCAPES_MUSIC_SITE_ID,
    title: "Synthetic upbeat demo",
    artist: "Aidreamcapes demo fixture",
    genre: "electronic",
    moods: ["upbeat", "bright"],
    durationSeconds: 24,
    bpm: 112,
    previewAssetKey: null,
    demoOnly: true,
    active: true,
    licenseStatus: "unlicensed",
    license: null,
    notice: "Demo fixture only; no music license is represented.",
  },
];

export type MusicRightsFailure =
  | "music_catalog_site_mismatch"
  | "music_track_inactive"
  | "music_license_required"
  | "music_license_not_owned"
  | "music_demo_track_not_licensable"
  | "music_license_inactive"
  | "music_license_not_yet_effective"
  | "music_license_expired"
  | "music_territory_invalid"
  | "music_territory_not_covered"
  | "music_usage_not_permitted"
  | "music_ads_not_permitted"
  | "music_attribution_unavailable";

export type MusicRightsDecision =
  | { allowed: true; attributionRequired: boolean; attributionText?: string }
  | { allowed: false; code: MusicRightsFailure };

function asMillis(value: Date | string | null): number | undefined {
  if (value === null) return undefined;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function normalizeMusicTerritory(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const territory = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(territory) ? territory : undefined;
}

export function evaluateMusicRights(args: {
  track: MusicCatalogTrackRecord;
  license: MusicLicenseRecord | null;
  siteId: string;
  customerId: string;
  territory: unknown;
  usage: MusicUsage;
  now?: Date;
}): MusicRightsDecision {
  const { track, license } = args;
  if (args.siteId !== AIDREAMCAPES_MUSIC_SITE_ID || track.siteId !== args.siteId) {
    return { allowed: false, code: "music_catalog_site_mismatch" };
  }
  if (!track.active) return { allowed: false, code: "music_track_inactive" };
  if (!license) return { allowed: false, code: "music_license_required" };
  if (license.siteId !== args.siteId || license.customerId !== args.customerId || license.trackId !== track.id) {
    return { allowed: false, code: "music_license_not_owned" };
  }
  if (track.demoOnly) return { allowed: false, code: "music_demo_track_not_licensable" };
  if (license.status !== "active") return { allowed: false, code: "music_license_inactive" };

  const now = (args.now ?? new Date()).getTime();
  const startsAt = asMillis(license.startsAt);
  const expiresAt = asMillis(license.expiresAt);
  if (license.startsAt !== null && (startsAt === undefined || startsAt > now)) {
    return { allowed: false, code: "music_license_not_yet_effective" };
  }
  if (license.expiresAt !== null && (expiresAt === undefined || expiresAt <= now)) {
    return { allowed: false, code: "music_license_expired" };
  }

  const territory = normalizeMusicTerritory(args.territory);
  if (!territory) return { allowed: false, code: "music_territory_invalid" };
  if (!license.territories.some((value) => value === "*" || value.toUpperCase() === territory)) {
    return { allowed: false, code: "music_territory_not_covered" };
  }
  if (!license.usageTypes.includes(args.usage)) {
    return { allowed: false, code: args.usage === "ads" ? "music_ads_not_permitted" : "music_usage_not_permitted" };
  }

  const attributionText = license.attributionText?.trim();
  if (license.attributionRequired && !attributionText) {
    return { allowed: false, code: "music_attribution_unavailable" };
  }
  return {
    allowed: true,
    attributionRequired: license.attributionRequired,
    ...(license.attributionRequired && attributionText ? { attributionText } : {}),
  };
}

export function summarizeMusicLicense(license: MusicLicenseRecord | null, now = new Date()): string {
  if (!license) return "unlicensed";
  if (license.status !== "active") return license.status;
  const startsAt = asMillis(license.startsAt);
  if (license.startsAt !== null && (startsAt === undefined || startsAt > now.getTime())) return "not_yet_effective";
  const expiresAt = asMillis(license.expiresAt);
  if (license.expiresAt !== null && (expiresAt === undefined || expiresAt <= now.getTime())) return "expired";
  return "licensed";
}
