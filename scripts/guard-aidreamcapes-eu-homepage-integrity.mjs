#!/usr/bin/env node

import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { assertAidreamcapesEuHomepageIntegrity } from "./lib/aidreamcapes-eu-homepage-integrity.mjs";

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
