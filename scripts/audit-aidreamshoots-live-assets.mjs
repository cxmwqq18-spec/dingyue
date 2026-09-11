#!/usr/bin/env node
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { argumentValue } from "./lib/database-target.mjs";
import { buildTunneledDatabaseUrl } from "./lib/database-target.mjs";

const TARGET_SITE_ID = "site_mydreamshoots_xby";
const TARGET_DOMAIN = "aidreamshoots.eu";
const TARGET_ASSET_PREFIX = "/assets/sites/site_aidreamshoots/";
const repoRoot = process.cwd();
const reportPath = argumentValue("--report");
const missingListPath = argumentValue("--missing-list");
const concurrency = Math.max(1, Math.min(32, Number(argumentValue("--concurrency") || 16)));

process.env.DINGYUE_ENV = "remote";
process.env.DATABASE_TARGET = "remote";
process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, {
  host: "127.0.0.1",
  port: 15432
});

const prisma = new PrismaClient();
const sourceUrl = (value) => new URL(value, `https://${TARGET_DOMAIN}`).toString();
const localPathForUrl = (value) => path.join(repoRoot, "public", new URL(sourceUrl(value)).pathname.slice(1));

async function fetchAssetWithRetry(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
        headers: { "user-agent": "AIdreamshoots-live-asset-audit/1.0" }
      });
      if (response.status === 200) return response;
      await response.body?.cancel();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
  }
  throw lastError ?? new Error("asset fetch failed");
}

try {
  const rows = await prisma.mediaAsset.findMany({
    where: { siteId: TARGET_SITE_ID },
    select: { id: true, storageKey: true, previewUrl: true, originUrl: true },
    orderBy: { storageKey: "asc" }
  });
  const urls = [...new Map(rows
    .flatMap((row) => [row.previewUrl, row.originUrl]
      .filter(Boolean)
      .map((value) => {
        const parsed = new URL(sourceUrl(value));
        parsed.search = "";
        return [parsed.pathname, { path: parsed.pathname, raw: value, storageKey: row.storageKey }];
      }))
    ).values()];
  const failures = [];
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= urls.length) return;
      const item = urls[index];
      const url = `https://${TARGET_DOMAIN}${item.path}`;
      try {
        const response = await fetchAssetWithRetry(url);
        if (response.status !== 200 || new URL(response.url).host !== TARGET_DOMAIN) {
          failures.push({ path: item.path, status: response.status, finalUrl: response.url, storageKey: item.storageKey });
        }
        await response.body?.cancel();
      } catch (error) {
        failures.push({ path: item.path, error: String(error), storageKey: item.storageKey });
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

  const localMissing = urls
    .filter((item) => !existsSync(localPathForUrl(item.path)))
    .map((item) => item.path);
  const report = {
    createdAt: new Date().toISOString(),
    targetSiteId: TARGET_SITE_ID,
    targetDomain: TARGET_DOMAIN,
    mediaRows: rows.length,
    distinctPaths: urls.length,
    httpOk: urls.length - failures.length,
    httpFailures: failures.length,
    localMissing: localMissing.length,
    failures,
    localMissingPaths: localMissing
  };
  if (reportPath) {
    await fs.mkdir(path.dirname(path.resolve(reportPath)), { recursive: true });
    await fs.writeFile(path.resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    report.reportPath = path.resolve(reportPath);
  }
  if (missingListPath) {
    const missingPaths = failures
      .filter((item) => item.status === 404 && item.path.startsWith(TARGET_ASSET_PREFIX))
      .map((item) => `public${item.path}`);
    await fs.writeFile(path.resolve(missingListPath), `${missingPaths.join("\n")}\n`, "utf8");
    report.missingListPath = path.resolve(missingListPath);
    report.missingListCount = missingPaths.length;
  }
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = failures.length || localMissing.length ? 1 : 0;
} finally {
  await prisma.$disconnect();
}
