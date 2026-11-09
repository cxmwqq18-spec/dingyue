#!/usr/bin/env node
/** Seed one dedicated QA customer on the Aidreamcapes production site so the
 * prompt-optimization pipeline can be exercised end-to-end through the real
 * HTTP API (workspaceAuth + CSRF + async job + LLM provider).
 * Field-level upsert scoped to site_aidreamcapes; readback asserted.
 *
 * Rollback: delete the customer row by id (previousValue reports existence).
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertAllowedSite, assertDatabaseTarget } from './lib/database-target.mjs';

loadRuntimeEnv();
const applying = process.argv.includes('--apply-production');
assertDatabaseTarget({ expectedTarget: 'production', requireProductionConfirmation: applying, productionConfirmed: applying });
const siteId = assertAllowedSite('site_aidreamcapes');

const EMAIL = (process.env.ADC_QA_CUSTOMER_EMAIL || 'qa-prompt-skill@aivideosugc.com').toLowerCase();
const PASSWORD = process.env.ADC_QA_CUSTOMER_PASSWORD || 'Adc-Qa-2026-Prompt!';

// Mirrors hashRelationalPassword (src/lib/stores/prisma-mappers.ts): scrypt v1.
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt:v1:32768:8:1:${salt.toString('base64url')}:${derived.toString('base64url')}`;
}

const db = new PrismaClient();
try {
  const report = await db.$transaction(async tx => {
    await tx.site.findUniqueOrThrow({ where: { id: siteId }, select: { id: true } });
    const existing = await tx.customer.findUnique({ where: { siteId_email: { siteId, email: EMAIL } }, select: { id: true, email: true, name: true, status: true, passwordHash: true, createdAt: true } });
    const customerId = existing?.id || `cust_${crypto.randomBytes(10).toString('hex')}`;
    const operations = [];
    if (!existing) {
      operations.push({ entity: 'customer', id: customerId, action: 'insert', previousValue: null, value: { email: EMAIL, name: 'QA Prompt Skill', status: 'active' } });
      if (applying) {
        await tx.customer.create({ data: { id: customerId, siteId, email: EMAIL, name: 'QA Prompt Skill', status: 'active', passwordHash: hashPassword(PASSWORD) } });
      }
    } else {
      operations.push({ entity: 'customer', id: existing.id, action: existing.passwordHash ? 'noop' : 'update-password', previousValue: { status: existing.status, hadPassword: Boolean(existing.passwordHash) }, value: { status: 'active', hadPassword: true } });
      if (applying && !existing.passwordHash) {
        const result = await tx.customer.updateMany({ where: { id: existing.id, siteId, passwordHash: null }, data: { passwordHash: hashPassword(PASSWORD), status: 'active' } });
        assert.equal(result.count, 1, 'CAS update failed');
      }
      assert.notEqual(existing.status, 'blocked', 'existing QA customer is blocked');
    }
    if (applying) {
      const readback = await tx.customer.findUniqueOrThrow({ where: { siteId_email: { siteId, email: EMAIL } } });
      assert.equal(readback.status, 'active');
      assert.match(String(readback.passwordHash), /^scrypt:v1:/);
    }
    return { ok: true, target: 'production', siteId, applying, customerId, email: EMAIL, operations, historicalStateActivated: false };
  }, { timeout: 60000 });
  const out = 'releases/aidreamcapes-prompt-skill-seed-20261109';
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(`${out}/production-qa-customer-${applying ? 'apply' : 'plan'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await db.$disconnect(); }
