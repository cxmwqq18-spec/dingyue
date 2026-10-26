#!/usr/bin/env node
/**
 * Field-level reconciliation for two historical Aidreamcapes credit anomalies.
 *
 * Scope: site_aidreamcapes only.
 *
 * 1. job_aidreamcapes_mrknbo0e_a4032d was consumed and then refunded. Its
 *    billingSettlement says 0 consumed / 39 released even though the ledger
 *    contains reserve -39, consume -39, release +39. The customer balance is
 *    already correct because the release restored the reservation. This script
 *    records the refund explicitly without changing any balance.
 *
 * 2. cust_aidreamcapes_aria has 24 credits stuck in CreditBalance.reserved
 *    after job_msd36rnt_b0fecd was consumed. The consume ledger entry already
 *    records the charge, so the correction clears reserved without crediting
 *    the customer again.
 *
 * Usage:
 *   node scripts/reconcile-aidreamcapes-credit-ledger-2026-10-26.mjs
 *   node scripts/reconcile-aidreamcapes-credit-ledger-2026-10-26.mjs --apply --confirm=aidreamcapes-credit-ledger-2026-10-26
 */
import crypto from "node:crypto";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: process.env.ENV_FILE || ".env.local" });

const prisma = new PrismaClient();
const SITE_ID = "site_aidreamcapes";
const CONFIRM = "aidreamcapes-credit-ledger-2026-10-26";
const JOB_ID = "job_aidreamcapes_mrknbo0e_a4032d";
const CUSTOMER_ID = "cust_aidreamcapes_mqq9gas9_i1vjal";
const ARIA_CUSTOMER_ID = "cust_aidreamcapes_aria";
const ARIA_JOB_ID = "job_msd36rnt_b0fecd";
const apply = process.argv.includes("--apply");
const confirm = process.argv.find((value) => value.startsWith("--confirm="))?.slice("--confirm=".length);

function fail(message) {
  throw new Error(message);
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function auditId() {
  return `audit_reconcile_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

async function loadState(tx) {
  const job = await tx.generationJob.findFirst({ where: { id: JOB_ID, siteId: SITE_ID } });
  const jobLedger = await tx.creditLedger.findMany({
    where: { siteId: SITE_ID, customerId: CUSTOMER_ID, sourceId: JOB_ID },
    orderBy: { createdAt: "asc" }
  });
  const customer = await tx.customer.findFirst({
    where: { id: CUSTOMER_ID, siteId: SITE_ID },
    include: { balance: true }
  });
  const ariaCustomer = await tx.customer.findFirst({
    where: { id: ARIA_CUSTOMER_ID, siteId: SITE_ID },
    include: { balance: true }
  });
  const ariaJob = await tx.generationJob.findFirst({ where: { id: ARIA_JOB_ID, siteId: SITE_ID } });
  const ariaLedger = await tx.creditLedger.findMany({
    where: { siteId: SITE_ID, customerId: ARIA_CUSTOMER_ID, sourceId: ARIA_JOB_ID },
    orderBy: { createdAt: "asc" }
  });
  return { job, jobLedger, customer, ariaCustomer, ariaJob, ariaLedger };
}

function validateJob39(state) {
  const { job, jobLedger, customer } = state;
  assert(job, "missing_job_39");
  assert(job.siteId === SITE_ID && job.customerId === CUSTOMER_ID, "job_39_scope_mismatch");
  assert(job.status === "refunded", `job_39_status_changed:${job.status}`);
  assert(Number(job.creditsReserved) === 39, `job_39_reserved_changed:${job.creditsReserved}`);
  const jobResult = job.resultJson && typeof job.resultJson === "object" && !Array.isArray(job.resultJson) ? job.resultJson : {};
  assert(jobResult.error === "debug_probe_local_video_fallback_removed", `job_39_error_changed:${jobResult.error ?? "missing"}`);
  const settlement = jobResult.billingSettlement && typeof jobResult.billingSettlement === "object" ? jobResult.billingSettlement : {};
  assert(Number(settlement.creditsReserved) === 39, "job_39_settlement_reserved_changed");
  const alreadyReconciled = settlement.reconciliation?.source === "field_manifest" && Number(settlement.creditsRefunded) === 39;
  if (alreadyReconciled) {
    assert(Number(settlement.creditsConsumed) === 39, `job_39_consumed_after_reconcile_changed:${settlement.creditsConsumed}`);
    assert(Number(settlement.creditsReleased) === 0, `job_39_released_after_reconcile_changed:${settlement.creditsReleased}`);
  } else {
    assert(Number(settlement.creditsConsumed) === 0, `job_39_consumed_changed:${settlement.creditsConsumed}`);
    assert(Number(settlement.creditsReleased) === 39, `job_39_released_changed:${settlement.creditsReleased}`);
  }

  const amounts = jobLedger.map((entry) => [entry.type, Number(entry.amount)]);
  assert(amounts.length === 3, `job_39_ledger_count_changed:${amounts.length}`);
  assert(amounts.some(([type, amount]) => type === "reserve" && amount === -39), "job_39_reserve_ledger_mismatch");
  assert(amounts.some(([type, amount]) => type === "consume" && amount === -39), "job_39_consume_ledger_mismatch");
  assert(amounts.some(([type, amount]) => type === "release" && amount === 39), "job_39_release_ledger_mismatch");
  // reserve and release are the only balance-affecting entries. consume moves
  // the already-reserved amount into consumed and does not change the available
  // balance, so the balance effect of this job must be zero.
  const balanceEffect = amounts
    .filter(([type]) => type === "reserve" || type === "release")
    .reduce((total, [, amount]) => total + amount, 0);
  assert(balanceEffect === 0, "job_39_ledger_balance_effect_not_zero");

  assert(customer?.balance, "job_39_customer_balance_missing");
  if (!alreadyReconciled) {
    assert(Number(customer.balance.balance) === 601, `job_39_customer_balance_changed:${customer.balance.balance}`);
    assert(Number(customer.balance.reserved) === 0, `job_39_customer_reserved_changed:${customer.balance.reserved}`);
  }
}

function validateAria(state) {
  const { ariaCustomer, ariaJob, ariaLedger } = state;
  assert(ariaCustomer?.balance, "aria_customer_balance_missing");
  assert([0, 24].includes(Number(ariaCustomer.balance.reserved)), `aria_reserved_changed:${ariaCustomer.balance.reserved}`);
  if (Number(ariaCustomer.balance.reserved) === 24) {
    assert(Number(ariaCustomer.balance.balance) === 252, `aria_balance_changed:${ariaCustomer.balance.balance}`);
  }
  assert(ariaJob, "missing_aria_job");
  assert(ariaJob.status === "succeeded", `aria_job_status_changed:${ariaJob.status}`);
  assert(Number(ariaJob.creditsReserved) === 24, `aria_job_reserved_changed:${ariaJob.creditsReserved}`);
  const ariaResult = ariaJob.resultJson && typeof ariaJob.resultJson === "object" && !Array.isArray(ariaJob.resultJson) ? ariaJob.resultJson : {};
  const ariaSettlement = ariaResult.billingSettlement && typeof ariaResult.billingSettlement === "object" ? ariaResult.billingSettlement : {};
  assert(Number(ariaSettlement.creditsConsumed) === 24, `aria_settlement_consumed_changed:${ariaSettlement.creditsConsumed}`);
  assert(Number(ariaSettlement.creditsReleased) === 0, `aria_settlement_released_changed:${ariaSettlement.creditsReleased}`);

  const ariaAmounts = ariaLedger.map((entry) => [entry.type, Number(entry.amount)]);
  assert(ariaAmounts.length === 2, `aria_ledger_count_changed:${ariaAmounts.length}`);
  assert(ariaAmounts.some(([type, amount]) => type === "reserve" && amount === -24), "aria_reserve_ledger_mismatch");
  assert(ariaAmounts.some(([type, amount]) => type === "consume" && amount === -24), "aria_consume_ledger_mismatch");
  assert(!ariaAmounts.some(([type]) => type === "release"), "aria_release_ledger_present");
}

function validate(state) {
  validateJob39(state);
  validateAria(state);
}

function plan(state) {
  const jobResult = state.job.resultJson && typeof state.job.resultJson === "object" && !Array.isArray(state.job.resultJson) ? state.job.resultJson : {};
  const settlement = jobResult.billingSettlement && typeof jobResult.billingSettlement === "object" ? jobResult.billingSettlement : {};
  const releaseEntry = state.jobLedger.find((entry) => entry.type === "release");
  const alreadyReconciled = settlement.reconciliation?.source === "field_manifest" && Number(settlement.creditsRefunded) === 39;
  return {
    job39: {
      alreadyReconciled,
      before: {
        creditsReserved: Number(settlement.creditsReserved),
        creditsConsumed: Number(settlement.creditsConsumed),
        creditsReleased: Number(settlement.creditsReleased),
        netCreditsCharged: Number(settlement.netCreditsCharged ?? (Number(settlement.creditsConsumed) - Number(settlement.creditsRefunded ?? 0)))
      },
      after: {
        creditsReserved: 39,
        creditsConsumed: 39,
        creditsReleased: 0,
        creditsRefunded: 39,
        netCreditsCharged: 0,
        refundedAt: iso(releaseEntry?.createdAt ?? state.job.updatedAt)
      },
      customerBalance: Number(state.customer.balance.balance),
      customerReserved: Number(state.customer.balance.reserved)
    },
    aria: {
      alreadyReconciled: Number(state.ariaCustomer.balance.reserved) === 0,
      customerId: ARIA_CUSTOMER_ID,
      jobId: ARIA_JOB_ID,
      before: { balance: Number(state.ariaCustomer.balance.balance), reserved: Number(state.ariaCustomer.balance.reserved) },
      after: { balance: Number(state.ariaCustomer.balance.balance), reserved: 0 }
    }
  };
}

async function applyPlan() {
  return prisma.$transaction(async (tx) => {
    assert(confirm === CONFIRM, `missing_or_wrong_confirmation_expected_${CONFIRM}`);

    // Lock the exact job row and re-read it so an online edit wins.
    const locked = await tx.$queryRaw`
      SELECT "id" FROM "GenerationJob"
      WHERE "id" = ${JOB_ID} AND "siteId" = ${SITE_ID}
      FOR UPDATE
    `;
    assert(locked.length === 1, "job_39_not_found_after_lock");
    const state = await loadState(tx);
    validate(state);

    const jobResult = state.job.resultJson && typeof state.job.resultJson === "object" && !Array.isArray(state.job.resultJson) ? state.job.resultJson : {};
    const settlement = jobResult.billingSettlement && typeof jobResult.billingSettlement === "object" ? jobResult.billingSettlement : {};
    const releaseEntry = state.jobLedger.find((entry) => entry.type === "release");
    const jobAlreadyReconciled = settlement.reconciliation?.source === "field_manifest" && Number(settlement.creditsRefunded) === 39;
    if (!jobAlreadyReconciled) {
      const nextSettlement = {
        ...settlement,
        creditsReserved: 39,
        creditsConsumed: 39,
        creditsReleased: 0,
        creditsRefunded: 39,
        netCreditsCharged: 0,
        refundedAt: iso(releaseEntry?.createdAt ?? state.job.updatedAt),
        reconciliation: {
          source: "field_manifest",
          reason: "historical_debug_probe_refund",
          appliedAt: new Date().toISOString(),
          ledger: { reserve: -39, consume: -39, release: 39 },
          note: "The job was consumed and then fully refunded; the release ledger entry is the refund, not an unused reservation."
        }
      };
      const updated = await tx.generationJob.updateMany({
        where: { id: JOB_ID, siteId: SITE_ID, status: "refunded", creditsReserved: 39 },
        data: {
          resultJson: {
            ...jobResult,
            billingSettlement: nextSettlement
          }
        }
      });
      assert(updated.count === 1, "job_39_update_compare_and_set_failed");
      await tx.auditLog.create({
        data: {
          id: auditId(),
          siteId: SITE_ID,
          actorType: "system_reconciliation",
          actorId: "system_reconciliation",
          action: "generation_job_refund_settlement_reconciled",
          targetType: "generation_job",
          targetId: JOB_ID,
          metadata: {
            reason: "historical_debug_probe_refund",
            ledger: { reserve: -39, consume: -39, release: 39 },
            before: { creditsConsumed: Number(settlement.creditsConsumed), creditsReleased: Number(settlement.creditsReleased) },
            after: { creditsConsumed: 39, creditsReleased: 0, creditsRefunded: 39, netCreditsCharged: 0 },
            customerBalanceUnchanged: Number(state.customer.balance.balance)
          }
        }
      });
    }

    // Lock the Aria balance row. Clear only the stuck reserved pool; the
    // consume ledger entry already records the charge, so do not credit the
    // customer's available balance again.
    const lockedBalance = await tx.$queryRaw`
      SELECT "id" FROM "CreditBalance"
      WHERE "siteId" = ${SITE_ID} AND "customerId" = ${ARIA_CUSTOMER_ID}
      FOR UPDATE
    `;
    assert(lockedBalance.length === 1, "aria_balance_not_found_after_lock");
    const ariaState = await loadState(tx);
    validateAria(ariaState);
    const ariaAlreadyReconciled = Number(ariaState.ariaCustomer.balance.reserved) === 0;
    if (!ariaAlreadyReconciled) {
      const updated = await tx.creditBalance.updateMany({
        where: {
          id: ariaState.ariaCustomer.balance.id,
          siteId: SITE_ID,
          customerId: ARIA_CUSTOMER_ID,
          balance: 252,
          reserved: 24
        },
        data: { reserved: { decrement: 24 } }
      });
      assert(updated.count === 1, "aria_reserved_update_compare_and_set_failed");
      await tx.auditLog.create({
        data: {
          id: auditId(),
          siteId: SITE_ID,
          actorType: "system_reconciliation",
          actorId: "system_reconciliation",
          action: "generation_credit_reserved_reconciled",
          targetType: "customer",
          targetId: ARIA_CUSTOMER_ID,
          metadata: {
            reason: "consumed_job_left_reserved_pool",
            jobId: ARIA_JOB_ID,
            ledger: { reserve: -24, consume: -24 },
            before: { balance: 252, reserved: 24 },
            after: { balance: 252, reserved: 0 }
          }
        }
      });
    }

    return loadState(tx);
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}

async function main() {
  const before = await loadState(prisma);
  validate(before);
  const planned = plan(before);
  console.log(JSON.stringify({ apply, planned }, null, 2));
  if (!apply) {
    console.log("dry-run: no rows changed. Re-run with --apply --confirm=" + CONFIRM);
    return;
  }
  const after = await applyPlan();
  assert(after.job?.resultJson?.billingSettlement?.creditsRefunded === 39, "job_39_post_apply_settlement_missing");
  assert(Number(after.ariaCustomer?.balance?.reserved) === 0, "aria_post_apply_reserved_not_zero");
  console.log(JSON.stringify({
    applied: true,
    job39: {
      settlement: after.job.resultJson?.billingSettlement,
      audited: true
    },
    aria: {
      balance: Number(after.ariaCustomer.balance.balance),
      reserved: Number(after.ariaCustomer.balance.reserved),
      audited: true
    }
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
