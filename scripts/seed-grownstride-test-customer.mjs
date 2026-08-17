#!/usr/bin/env node
import crypto from "node:crypto";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const DEFAULT_SITE_ID = "site_grownstride_test";
const DEFAULT_DOMAIN = "test.grownstride.com";
const CONFIRM_PHRASE = "seed-grownstride-test-customer";
const DEFAULT_EMAIL = "nora@grownstride.localhost";
const DEFAULT_PASSWORD = "grownstride123";
const DEFAULT_NAME = "Nora Whitman";
const DEFAULT_CREDITS = 300;

const prisma = new PrismaClient();
const rawArgs = process.argv.slice(2);

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/seed-grownstride-test-customer.mjs --dry-run",
      `  node scripts/seed-grownstride-test-customer.mjs --apply --confirm ${CONFIRM_PHRASE}`,
      "",
      "Purpose:",
      "  Seed one reusable customer login for the Grownstride test storefront only.",
      "",
      "Defaults:",
      `  siteId: ${DEFAULT_SITE_ID}`,
      `  domain: ${DEFAULT_DOMAIN}`,
      `  email: ${DEFAULT_EMAIL}`,
      `  password: ${DEFAULT_PASSWORD}`,
      "",
      "Overrides:",
      "  GROWNSTRIDE_TEST_CUSTOMER_EMAIL",
      "  GROWNSTRIDE_TEST_CUSTOMER_PASSWORD",
      "  GROWNSTRIDE_TEST_CUSTOMER_NAME",
      "  GROWNSTRIDE_TEST_CUSTOMER_CREDITS"
    ].join("\n")
  );
}

function hasFlag(flag) {
  return rawArgs.includes(flag);
}

function argValue(name) {
  const equalPrefix = `${name}=`;
  const equalArg = rawArgs.find((arg) => arg.startsWith(equalPrefix));
  if (equalArg) return equalArg.slice(equalPrefix.length);
  const index = rawArgs.indexOf(name);
  if (index >= 0 && index + 1 < rawArgs.length) return rawArgs[index + 1];
  return undefined;
}

function hashPassword(password) {
  return `sha256:${crypto.createHash("sha256").update(password).digest("hex")}`;
}

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  const siteId = argValue("--site-id") ?? process.env.GROWNSTRIDE_TEST_SITE_ID ?? DEFAULT_SITE_ID;
  const email = String(argValue("--email") ?? process.env.GROWNSTRIDE_TEST_CUSTOMER_EMAIL ?? DEFAULT_EMAIL).trim().toLowerCase();
  const password = String(argValue("--password") ?? process.env.GROWNSTRIDE_TEST_CUSTOMER_PASSWORD ?? DEFAULT_PASSWORD);
  const name = String(argValue("--name") ?? process.env.GROWNSTRIDE_TEST_CUSTOMER_NAME ?? DEFAULT_NAME).trim();
  const credits = positiveInt(argValue("--credits") ?? process.env.GROWNSTRIDE_TEST_CUSTOMER_CREDITS, DEFAULT_CREDITS);
  const applyRequested = hasFlag("--apply");
  const dryRun = hasFlag("--dry-run") || !applyRequested;
  const confirmation = argValue("--confirm");

  if (siteId !== DEFAULT_SITE_ID) throw new Error(`refusing to seed non-test site: ${siteId}`);
  if (applyRequested && confirmation !== CONFIRM_PHRASE) {
    throw new Error(`--apply requires --confirm ${CONFIRM_PHRASE}`);
  }
  if (!email.includes("@")) throw new Error(`invalid email: ${email}`);
  if (password.trim().length < 6) throw new Error("password must be at least 6 characters");

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { id: true, slug: true, primaryDomain: true, signupCreditGrant: true }
  });
  if (!site) throw new Error(`site ${siteId} not found`);
  if (site.primaryDomain !== DEFAULT_DOMAIN) {
    throw new Error(`refusing to seed ${siteId}; expected primaryDomain ${DEFAULT_DOMAIN}, got ${site.primaryDomain}`);
  }

  const existing = await prisma.customer.findUnique({
    where: { siteId_email: { siteId, email } },
    include: { balance: true }
  });
  const summary = {
    ok: true,
    mode: dryRun ? "dry-run" : "apply",
    siteId,
    domain: site.primaryDomain,
    email,
    name,
    credits,
    existingCustomerId: existing?.id ?? null,
    existingBalance: existing?.balance ? { available: existing.balance.balance, reserved: existing.balance.reserved } : null
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const customerId = existing?.id ?? "cust_grownstride_test_nora";
  await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { siteId_email: { siteId, email } },
      create: {
        id: customerId,
        siteId,
        email,
        passwordHash: hashPassword(password),
        name: name || email.split("@")[0],
        status: "active"
      },
      update: {
        passwordHash: hashPassword(password),
        name: name || email.split("@")[0],
        status: "active"
      }
    });

    await tx.creditBalance.upsert({
      where: { siteId_customerId: { siteId, customerId: customer.id } },
      create: {
        id: "bal_grownstride_test_nora",
        siteId,
        customerId: customer.id,
        balance: credits,
        reserved: 0
      },
      update: {
        balance: credits,
        reserved: 0
      }
    });

    if (credits > 0) {
      await tx.creditLedger.upsert({
        where: {
          siteId_customerId_type_sourceId: {
            siteId,
            customerId: customer.id,
            type: "grant",
            sourceId: "seed_grownstride_test_customer"
          }
        },
        create: {
          id: "led_grownstride_test_seed_grant",
          siteId,
          customerId: customer.id,
          amount: credits,
          type: "grant",
          sourceType: "seed",
          sourceId: "seed_grownstride_test_customer"
        },
        update: {
          amount: credits,
          sourceType: "seed"
        }
      });
    }
  });

  const seeded = await prisma.customer.findUnique({
    where: { siteId_email: { siteId, email } },
    include: { balance: true }
  });
  console.log(
    JSON.stringify(
      {
        ...summary,
        customerId: seeded?.id ?? customerId,
        balance: seeded?.balance ? { available: seeded.balance.balance, reserved: seeded.balance.reserved } : null
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
