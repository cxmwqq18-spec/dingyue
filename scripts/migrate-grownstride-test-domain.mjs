import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { readPlatformStateFromSql, writePlatformStateToSql } from "./lib/platform-state-sql.mjs";

const siteId = "site_grownstride_test";
const primaryDomain = "test.grownstride.com";
const aliasDomains = ["www.grownstride.com", "grownstride.com"];
const domainRows = [
  { id: "dom_grownstride_test", domain: primaryDomain, isPrimary: true },
  { id: "dom_grownstride_primary", domain: "www.grownstride.com", isPrimary: false },
  { id: "dom_grownstride_apex", domain: "grownstride.com", isPrimary: false }
];

function wants(flag) {
  return process.argv.includes(flag);
}

function fail(message) {
  throw new Error(message);
}

function buildStatePlan(state) {
  const site = state.sites?.find((row) => row.id === siteId);
  if (!site) fail(`missing site ${siteId}`);

  const conflicts = (state.siteDomains ?? []).filter(
    (row) => aliasDomains.concat(primaryDomain).includes(String(row.domain).toLowerCase()) && row.siteId !== siteId
  );
  if (conflicts.length) fail(`domain already belongs to another site: ${conflicts.map((row) => row.domain).join(", ")}`);

  const next = structuredClone(state);
  const nextSite = next.sites.find((row) => row.id === siteId);
  nextSite.primaryDomain = primaryDomain;
  next.siteDomains = next.siteDomains.filter(
    (row) => row.siteId !== siteId && !aliasDomains.concat(primaryDomain).includes(String(row.domain).toLowerCase())
  );
  next.siteDomains.push(
    ...domainRows.map((row) => ({
      id: row.id,
      siteId,
      domain: row.domain,
      isPrimary: row.isPrimary,
      status: "active",
      createdAt: new Date().toISOString()
    }))
  );
  return next;
}

async function applyDatabase() {
  if (!process.env.DATABASE_URL) return { skipped: true, reason: "DATABASE_URL is not configured" };
  const prisma = new PrismaClient();
  try {
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, primaryDomain: true } });
    if (!site) fail(`database site not found: ${siteId}`);

    const conflicts = await prisma.siteDomain.findMany({
      where: { domain: { in: [primaryDomain, ...aliasDomains] }, siteId: { not: siteId } },
      select: { domain: true, siteId: true }
    });
    if (conflicts.length) fail(`database domain conflict: ${conflicts.map((row) => row.domain).join(", ")}`);

    const result = await prisma.$transaction(async (tx) => {
      await tx.siteDomain.updateMany({
        where: { siteId },
        data: { isPrimary: false, status: "active" }
      });

      for (const row of domainRows) {
        await tx.siteDomain.upsert({
          where: { domain: row.domain },
          update: {
            siteId,
            isPrimary: row.isPrimary,
            status: "active"
          },
          create: {
            id: row.id,
            siteId,
            domain: row.domain,
            isPrimary: row.isPrimary,
            status: "active"
          }
        });
      }

      const updatedSite = await tx.site.update({
        where: { id: siteId },
        data: { primaryDomain }
      });
      return {
        primaryDomain: updatedSite.primaryDomain,
        domains: await tx.siteDomain.findMany({
          where: { siteId },
          select: { id: true, domain: true, isPrimary: true, status: true },
          orderBy: { createdAt: "asc" }
        })
      };
    });
    return { skipped: false, ...result };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (wants("--help")) {
    console.log("Usage: node scripts/migrate-grownstride-test-domain.mjs [--apply] [--database]");
    return;
  }
  const state = await readPlatformStateFromSql();
  const nextState = buildStatePlan(state);
  const currentSite = state.sites.find((row) => row.id === siteId);
  const currentDomains = state.siteDomains.filter((row) => row.siteId === siteId).map((row) => row.domain);
  const report = {
    siteId,
    before: { primaryDomain: currentSite.primaryDomain, domains: currentDomains },
    after: { primaryDomain, domains: domainRows.map((row) => row.domain) },
    apply: wants("--apply"),
    database: wants("--database")
  };

  if (!wants("--apply")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  await writePlatformStateToSql(nextState);
  if (wants("--database")) report.databaseResult = await applyDatabase();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(`grownstride domain migration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
