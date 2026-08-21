import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const prisma = new PrismaClient();
const documentId = "platform";

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function usage() {
  console.log("Usage: node scripts/import-platform-state-to-prisma.mjs --source archive/legacy/platform-state.json [--dry-run]");
}

function summarize(state) {
  return {
    sites: state.sites?.length ?? 0,
    customers: state.customers?.length ?? 0,
    products: state.products?.length ?? 0,
    prices: state.products?.reduce((sum, product) => sum + (product.prices?.length ?? 0), 0) ?? 0,
    jobs: state.jobs?.length ?? 0,
    assets: state.assetUploads?.length ?? 0,
    albums: state.albums?.length ?? 0,
    ledger: state.ledger?.length ?? 0,
    paymentEvents: state.paymentEvents?.length ?? 0
  };
}

function validateState(state) {
  const errors = [];
  if (!Array.isArray(state.sites)) errors.push("missing sites[]");
  if (!Array.isArray(state.customers)) errors.push("missing customers[]");
  if (!Array.isArray(state.products)) errors.push("missing products[]");
  if (!Array.isArray(state.jobs)) errors.push("missing jobs[]");
  const siteIds = new Set((state.sites ?? []).map((site) => site.id));
  for (const customer of state.customers ?? []) {
    if (!siteIds.has(customer.siteId)) errors.push(`customer ${customer.id} references missing site ${customer.siteId}`);
  }
  for (const job of state.jobs ?? []) {
    if (!siteIds.has(job.siteId)) errors.push(`job ${job.id} references missing site ${job.siteId}`);
  }
  return errors;
}

async function main() {
  if (process.argv.includes("--help")) {
    usage();
    return;
  }
  const sourceArg = argValue("--source");
  if (!sourceArg) throw new Error("--source is required for historical JSON import; runtime never reads archive files.");
  const source = path.resolve(sourceArg);
  const dryRun = process.argv.includes("--dry-run");
  if (!fs.existsSync(source)) throw new Error(`state file not found: ${source}`);
  const state = JSON.parse(fs.readFileSync(source, "utf8"));
  const errors = validateState(state);
  if (errors.length) {
    console.error(JSON.stringify({ ok: false, source, errors }, null, 2));
    process.exit(1);
  }
  const summary = summarize(state);
  if (!dryRun) {
    assertNonProductionWriteTarget();
    await prisma.platformStateDocument.upsert({
      where: { id: documentId },
      create: { id: documentId, state },
      update: { state }
    });
  }
  console.log(JSON.stringify({ ok: true, dryRun, source, documentId, summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
