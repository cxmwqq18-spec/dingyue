import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { LOCAL_DATABASE, assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const envFile = path.join(process.cwd(), ".env.local");
const cacheFile = path.join(process.cwd(), ".next", "cache", "platform-state-postgres.json");
const shouldRestart = process.argv.includes("--restart");

function parseEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

function writeEnvPort() {
  if (shouldRestart) {
    throw new Error("--restart is disabled for full-state repair scripts. Use the release pipeline and service deploy step.");
  }
  if (!fs.existsSync(envFile)) throw new Error(".env.local missing");
  const before = fs.readFileSync(envFile, "utf8");
  const after = before.replace(
    /^(DATABASE_URL=.*@(?:127\.0\.0\.1|localhost):)15432(\/.*)$/m,
    "$1" + String(LOCAL_DATABASE.port) + "$2"
  );
  if (after !== before) {
    fs.writeFileSync(envFile, after);
  }
  const env = parseEnv(after);
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL missing in .env.local");
  const url = new URL(env.DATABASE_URL);
  if ((url.hostname === "127.0.0.1" || url.hostname === "localhost") && url.port !== String(LOCAL_DATABASE.port)) {
    throw new Error(`DATABASE_URL local Postgres port is ${url.port || "(default)"}, expected ${LOCAL_DATABASE.port}`);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  process.env.DINGYUE_ENV = env.DINGYUE_ENV || process.env.DINGYUE_ENV || "local";
  process.env.DATABASE_TARGET = env.DATABASE_TARGET || process.env.DATABASE_TARGET || "local";
  process.env.PERSISTENCE_BACKEND = env.PERSISTENCE_BACKEND || "postgres";
  process.env.PLATFORM_STATE_DISK_CACHE = "0";
  assertDatabaseTarget({ expectedTarget: process.env.DATABASE_TARGET });
  assertNonProductionWriteTarget();
  return { changed: after !== before, host: url.hostname, port: url.port || String(LOCAL_DATABASE.port) };
}

function summarize(state) {
  return {
    sites: state.sites?.length ?? 0,
    siteNames: (state.sites ?? []).map((site) => site.name),
    siteSlugs: (state.sites ?? []).map((site) => site.slug),
    customers: state.customers?.length ?? 0,
    products: state.products?.length ?? 0,
    jobs: state.jobs?.length ?? 0
  };
}

function assertExpectedState(summary) {
  if (summary.sites < 3) throw new Error(`expected at least 3 sites, got ${summary.sites}`);
  if (!summary.siteNames.includes("DreamShootAI")) throw new Error("DreamShootAI site missing");
}

async function main() {
  const envStatus = writeEnvPort();
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`select 1`;
    const document = await prisma.platformStateDocument.findUnique({ where: { id: "platform" } });
    if (!document?.state) throw new Error("PlatformStateDocument(platform) is missing");
    const dbSummary = summarize(document.state);
    assertExpectedState(dbSummary);
    if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
    console.log(
      JSON.stringify(
        {
          ok: true,
          env: { changed: envStatus.changed, databaseHost: envStatus.host, databasePort: envStatus.port },
          cacheCleared: true,
          restarted: false,
          dbSummary
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
