#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget, assertNonProductionWriteTarget, buildTunneledDatabaseUrl, databaseTargetSummary } from "./lib/database-target.mjs";

const repoRoot = process.cwd();
const envLocalPath = path.join(repoRoot, ".env.local");
const composePath = path.join(repoRoot, "ops", "local-postgres.compose.yml");
const tunnelScriptPath = path.join(repoRoot, "scripts", "start-remote-db-tunnel.mjs");
const localDevScriptPath = path.join(repoRoot, "scripts", "dev-local.mjs");
const packagePath = path.join(repoRoot, "package.json");

function fail(message) {
  throw new Error(message);
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function expectFailure(name, action) {
  try {
    action();
  } catch {
    return;
  }
  fail(`Expected database target guard to reject ${name}.`);
}

const envLocal = readIfExists(envLocalPath);
const compose = readIfExists(composePath);
const tunnelScript = readIfExists(tunnelScriptPath);
const localDevScript = readIfExists(localDevScriptPath);
const packageJson = JSON.parse(readIfExists(packagePath));

assertDatabaseTarget({ expectedTarget: "local" });
expectFailure("legacy remote tunnel port 15432", () => {
  assertDatabaseTarget({
    expectedTarget: "local",
    env: {
      DINGYUE_ENV: "local",
      DATABASE_TARGET: "local",
      DATABASE_URL: "postgresql://dingyue_local:secret@127.0.0.1:15432/dingyue_local?schema=public"
    }
  });
});
expectFailure("full-state write through legacy remote tunnel port 15432", () => {
  assertNonProductionWriteTarget({
    DINGYUE_ENV: "local",
    DATABASE_TARGET: "local",
    DATABASE_URL: "postgresql://dingyue_local:secret@127.0.0.1:15432/dingyue_local?schema=public"
  });
});
expectFailure("production-looking database in local target", () => {
  assertDatabaseTarget({
    expectedTarget: "local",
    env: {
      DINGYUE_ENV: "local",
      DATABASE_TARGET: "local",
      DATABASE_URL: "postgresql://dingyue_local:secret@127.0.0.1:15433/dingyue?schema=public"
    }
  });
});

const remoteEnv = {
  DINGYUE_ENV: "remote",
  DATABASE_TARGET: "remote",
  DATABASE_URL: buildTunneledDatabaseUrl("postgresql://dingyue:secret@127.0.0.1:5432/dingyue?schema=public")
};
assertDatabaseTarget({ expectedTarget: "remote", env: remoteEnv });
assertNonProductionWriteTarget(remoteEnv);

if (envLocal.includes("15432")) {
  fail(".env.local still references legacy remote tunnel port 15432.");
}
if (!compose.includes("127.0.0.1:15433:5432")) {
  fail("Local Postgres compose file must bind 127.0.0.1:15433 to the container database.");
}
if (!tunnelScript.includes("--readonly")) {
  fail("Remote database tunnel must require an explicit --readonly flag.");
}
if (!tunnelScript.includes("--readwrite")) {
  fail("Remote database tunnel must support an explicit --readwrite flag.");
}
if (packageJson.scripts?.dev !== "node scripts/dev-local.mjs" || packageJson.scripts?.["dev:3002"] !== "node scripts/dev-local.mjs") {
  fail("Default dev scripts must use the local database launcher.");
}
if (!localDevScript.includes('docker", ["compose", "-f", composePath, "up", "-d"]')) {
  fail("Local dev launcher must start the isolated PostgreSQL compose service.");
}
if (!localDevScript.includes('migrate", "deploy"')) {
  fail("Local dev launcher must apply pending Prisma migrations before starting Next.js.");
}
if (process.env.PLATFORM_STATE_POSTGRES_STRICT !== "1") {
  fail("PLATFORM_STATE_POSTGRES_STRICT=1 is required for local MyDreamShoots development.");
}
if (process.env.STOREFRONT_PATH_MODE_READS !== "database") {
  fail("STOREFRONT_PATH_MODE_READS=database is required for local MyDreamShoots development.");
}

console.log(JSON.stringify({
  ok: true,
  target: databaseTargetSummary(),
  checks: [
    "local database target is 127.0.0.1:15433/dingyue_local",
    ".env.local does not reference 15432",
    "remote target allows CRUD through 127.0.0.1:15432",
    "remote tunnel supports explicit --readonly and --readwrite modes",
    "default dev scripts use the local database launcher",
    "local dev launcher starts PostgreSQL and applies pending migrations",
    "strict postgres storefront reads are enabled"
  ]
}, null, 2));
