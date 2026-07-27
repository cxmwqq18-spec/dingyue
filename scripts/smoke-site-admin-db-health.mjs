import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const timeoutMs = Math.max(100, Math.floor(Number(process.env.SITE_ADMIN_DB_HEALTH_TIMEOUT_MS ?? 1_000)));
const disconnectTimeoutMs = Math.max(100, Math.floor(Number(process.env.SITE_ADMIN_DB_DISCONNECT_TIMEOUT_MS ?? 500)));

function describeDatabase(rawUrl) {
  if (!rawUrl) return "<DATABASE_URL unset>";
  try {
    const url = new URL(rawUrl);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "<DATABASE_URL present>";
  }
}

function withHealthTimeout(rawUrl) {
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
    url.searchParams.set("connect_timeout", String(timeoutSeconds));
    url.searchParams.set("pool_timeout", String(timeoutSeconds));
    url.searchParams.set("connection_limit", "1");
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function normalizeJson(value) {
  if (typeof value === "bigint") return Number(value);
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeJson(item)]));
}

function messageFromError(error) {
  return error instanceof Error ? error.message.split("\n").filter(Boolean).at(0) ?? error.message : String(error);
}

const databaseUrl = process.env.DATABASE_URL;
const prisma = new PrismaClient({
  ...(databaseUrl ? { datasources: { db: { url: withHealthTimeout(databaseUrl) } } } : {})
});

let exitCode = 0;
const startedAt = performance.now();

try {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`db_health_timeout_${timeoutMs}ms`)), timeoutMs);
  });
  const result = await Promise.race([prisma.$queryRaw`SELECT 1 AS ok`, timeout]);
  const ms = Math.round(performance.now() - startedAt);
  console.log(JSON.stringify({
    ok: true,
    ms,
    maxMs: timeoutMs,
    database: describeDatabase(databaseUrl),
    result: normalizeJson(result)
  }, null, 2));
} catch (error) {
  exitCode = 1;
  const ms = Math.round(performance.now() - startedAt);
  console.error(JSON.stringify({
    ok: false,
    status: "db_unavailable",
    ms,
    maxMs: timeoutMs,
    database: describeDatabase(databaseUrl),
    error: messageFromError(error),
    hint: "DB tunnel/Postgres unavailable: TCP may accept connections while PostgreSQL is unreachable or not responding."
  }, null, 2));
} finally {
  await Promise.race([
    prisma.$disconnect().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, disconnectTimeoutMs))
  ]);
}

process.exit(exitCode);
