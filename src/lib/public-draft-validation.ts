import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";

type Database = PrismaClient | Prisma.TransactionClient;

const MEDIA_KEYS = /(?:image|media|photo|video|poster|cover|thumbnail|logo|avatar|gallery|ogimage|(?:^|_)(?:src|source)$)/i;
const MEDIA_EXTENSIONS = /\.(?:avif|gif|jpe?g|png|svg|webp|mp4|webm|mov)(?:$|[?#])/i;

export class PublicDraftValidationError extends Error {
  readonly status = 422;
}

export function collectPublicDraftMediaUrls(value: unknown, key: string | undefined = undefined, output: string[] = []): string[] {
  if (typeof value === "string") {
    const url = value.trim();
    if (url && key && (MEDIA_KEYS.test(key) || MEDIA_EXTENSIONS.test(url)) && (/^(?:https?:)?\/\//i.test(url) || url.startsWith("/"))) output.push(url);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPublicDraftMediaUrls(item, key, output);
    return output;
  }
  if (value && typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) collectPublicDraftMediaUrls(childValue, childKey, output);
  }
  return output;
}

function withoutQuery(url: string): string {
  return url.split(/[?#]/, 1)[0] ?? url;
}

function localAssetExists(url: string): boolean {
  const clean = withoutQuery(url);
  if (!clean.startsWith("/assets/")) return true;
  const relative = clean.replace(/^\/+/, "");
  return fs.existsSync(path.join(process.cwd(), "public", relative)) || fs.existsSync(path.join(process.cwd(), relative));
}

export async function validatePublicDraftMediaReferences(params: {
  db: Database;
  siteId: string;
  values: unknown[];
}): Promise<void> {
  const urls = Array.from(new Set(params.values.flatMap((value) => collectPublicDraftMediaUrls(value))));
  if (!urls.length) return;
  const assets = await params.db.mediaAsset.findMany({
    where: { siteId: params.siteId },
    select: { storageKey: true, previewUrl: true, originUrl: true }
  });
  const known = new Set(assets.flatMap((asset) => [asset.storageKey, asset.previewUrl, asset.originUrl].filter((item): item is string => Boolean(item)).map(withoutQuery)));
  const missing = urls.filter((url) => !known.has(withoutQuery(url)) || !localAssetExists(url));
  if (missing.length) {
    throw new PublicDraftValidationError(`public_media_asset_missing:${missing.slice(0, 5).join(",")}`);
  }
}
