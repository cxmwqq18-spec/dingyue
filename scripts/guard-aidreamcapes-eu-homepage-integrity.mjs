#!/usr/bin/env node

import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { assertAidreamcapesEuHomepageIntegrity } from "./lib/aidreamcapes-eu-homepage-integrity.mjs";
import { buildTunneledDatabaseUrl, parseDatabaseUrl } from "./lib/database-target.mjs";

if (String(process.env.DATABASE_TARGET || "").trim().toLowerCase() === "production") {
  const current = parseDatabaseUrl(process.env.DATABASE_URL);
  if ((current.database === "dingyue_local" || current.port === 15433) && process.env.REMOTE_DB_DATABASE_URL) {
    process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 });
  }
  const connected = parseDatabaseUrl(process.env.DATABASE_URL);
  if (!(connected.host === "127.0.0.1" && connected.port === 15432)) {
    throw new Error(`Production EU homepage guard requires the protected SSH tunnel at 127.0.0.1:15432; received ${connected.host}:${connected.port}.`);
  }
}

const prisma = new PrismaClient();
try {
  const report = await assertAidreamcapesEuHomepageIntegrity(prisma);
  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
