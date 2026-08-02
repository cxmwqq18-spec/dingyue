import "server-only";

import { readFileSync } from "fs";
import { readFile, readdir, stat, writeFile } from "fs/promises";
import path from "path";
import { DEFAULT_MEDIA_WATERMARK_OPACITY, MEDIA_WATERMARK_VERSION, watermarkMediaBytes } from "@/lib/media-watermark";

const imageExtensions = new Set([".avif", ".jpeg", ".jpg", ".png", ".webp"]);
const videoExtensions = new Set([".m4v", ".mov", ".mp4", ".webm"]);

export type PublicMediaWatermarkFailure = {
  filePath: string;
  error: string;
};

export type PublicMediaWatermarkSummary = {
  ok: boolean;
  siteId: string;
  text: string;
  version: string;
  dryRun: boolean;
  force: boolean;
  opacity: number;
  roots: string[];
  discovered: number;
  processed: number;
  changed: number;
  skipped: number;
  failures: PublicMediaWatermarkFailure[];
};

type PublicMediaWatermarkPlan = {
  siteId: string;
  text: string;
  roots: string[];
};

type PublicMediaWatermarkMarker = {
  version: string;
  text: string;
  opacity?: number;
};

const sitePlans: Record<string, { text: string; roots: string[] }> = {
  site_dreamshoot: {
    text: "myDreamshoots.com",
    roots: ["public/assets/dreamshoot"]
  },
  site_aidreamcapes: {
    text: "Aidreamcapes.com",
    roots: ["public/assets/sites/site_aidreamcapes"]
  },
  site_mydreamshoots_xby: {
    text: "Aidreamshoots.eu",
    roots: ["public/assets/sites/site_aidreamshoots"]
  },
  site_aidreamcapes_xby: {
    text: "Aidreamcapes.eu",
    roots: [
      "public/assets/sites/site_aidreamcapes_eu",
      "public/assets/sites/site_aidreamcapes_xby"
    ]
  }
};

function repoRelative(filePath: string): string {
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

function markerPath(filePath: string): string {
  return `${filePath}.watermark.json`;
}

function publicRoot(): string {
  return path.resolve(process.cwd(), "public");
}

function isInsidePublic(filePath: string): boolean {
  const root = publicRoot();
  const relative = path.relative(root, filePath);
  return Boolean(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function mimeTypeForPublicMedia(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".avif") return "image/avif";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  return "video/mp4";
}

export function isWatermarkablePublicDisplayPath(filePath: string): boolean {
  const normalized = repoRelative(path.resolve(filePath));
  const ext = path.extname(normalized).toLowerCase();
  if (!imageExtensions.has(ext) && !videoExtensions.has(ext)) return false;
  if (normalized.includes("/brand/")) return false;
  if (!normalized.startsWith("public/assets/")) return false;
  return true;
}

function readWatermarkMarker(filePath: string): PublicMediaWatermarkMarker | undefined {
  try {
    const value = JSON.parse(readFileSync(markerPath(filePath), "utf8")) as Partial<PublicMediaWatermarkMarker>;
    return typeof value.version === "string" && typeof value.text === "string"
      ? {
        version: value.version,
        text: value.text,
        opacity: typeof value.opacity === "number" ? value.opacity : undefined
      }
      : undefined;
  } catch {
    return undefined;
  }
}

async function writeWatermarkMarker(filePath: string, marker: PublicMediaWatermarkMarker): Promise<void> {
  await writeFile(markerPath(filePath), `${JSON.stringify({
    ...marker,
    writtenAt: new Date().toISOString()
  }, null, 2)}\n`);
}

function hasCurrentWatermarkMarker(filePath: string, text: string): boolean {
  const marker = readWatermarkMarker(filePath);
  return marker?.version === MEDIA_WATERMARK_VERSION && marker.text === text && (marker.opacity ?? DEFAULT_MEDIA_WATERMARK_OPACITY) === DEFAULT_MEDIA_WATERMARK_OPACITY;
}

export function publicMediaWatermarkPlanForSite(siteId: string): PublicMediaWatermarkPlan | undefined {
  const plan = sitePlans[siteId];
  if (!plan) return undefined;
  return {
    siteId,
    text: plan.text,
    roots: plan.roots.map((root) => path.resolve(process.cwd(), root))
  };
}

async function walkMediaFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  const entryStat = await stat(root).catch(() => null);
  if (!entryStat) return result;
  if (entryStat.isFile()) return isWatermarkablePublicDisplayPath(root) ? [root] : [];
  if (!entryStat.isDirectory()) return result;

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(filePath);
        continue;
      }
      if (entry.isFile() && isWatermarkablePublicDisplayPath(filePath)) {
        result.push(filePath);
      }
    }
  }

  await walk(root);
  return result;
}

async function watermarkPublicMediaFile(params: {
  filePath: string;
  text: string;
  dryRun: boolean;
  force: boolean;
  opacity: number;
}): Promise<{ changed: boolean; skipped: boolean }> {
  if (!isInsidePublic(params.filePath)) throw new Error("public_media_path_outside_public_root");
  if (!params.force && hasCurrentWatermarkMarker(params.filePath, params.text)) {
    return { changed: false, skipped: true };
  }
  if (params.dryRun) return { changed: true, skipped: false };

  const bytes = await readFile(params.filePath);
  const result = await watermarkMediaBytes({
    bytes,
    mimeType: mimeTypeForPublicMedia(params.filePath),
    text: params.text,
    opacity: params.opacity
  });
  await writeFile(params.filePath, result.bytes);
  await writeWatermarkMarker(params.filePath, {
    version: MEDIA_WATERMARK_VERSION,
    text: params.text,
    opacity: params.opacity
  });
  return { changed: true, skipped: false };
}

export async function batchWatermarkSitePublicMedia(params: {
  siteId: string;
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  opacity?: number;
}): Promise<PublicMediaWatermarkSummary> {
  const plan = publicMediaWatermarkPlanForSite(params.siteId);
  if (!plan) {
    throw new Error("public_media_watermark_site_not_configured");
  }
  const dryRun = Boolean(params.dryRun);
  const force = Boolean(params.force);
  const opacity = DEFAULT_MEDIA_WATERMARK_OPACITY;
  const limit = Number.isFinite(params.limit) && Number(params.limit) > 0
    ? Math.floor(Number(params.limit))
    : Number.POSITIVE_INFINITY;
  const discoveredFiles = (await Promise.all(plan.roots.map(walkMediaFiles))).flat();
  const files = Array.from(new Set(discoveredFiles)).sort();
  let processed = 0;
  let changed = 0;
  let skipped = 0;
  const failures: PublicMediaWatermarkFailure[] = [];

  for (const filePath of files) {
    if (processed >= limit) break;
    processed += 1;
    try {
      const result = await watermarkPublicMediaFile({
        filePath,
        text: plan.text,
        dryRun,
        force,
        opacity
      });
      if (result.changed) changed += 1;
      if (result.skipped) skipped += 1;
    } catch (error) {
      failures.push({
        filePath: repoRelative(filePath),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    ok: failures.length === 0,
    siteId: params.siteId,
    text: plan.text,
    version: MEDIA_WATERMARK_VERSION,
    dryRun,
    force,
    opacity,
    roots: plan.roots.map(repoRelative),
    discovered: files.length,
    processed,
    changed,
    skipped,
    failures
  };
}
