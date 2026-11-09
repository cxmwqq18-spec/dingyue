#!/usr/bin/env node
/** Seed the Aidreamcapes PromptSkill table with the built-in Wan3.0 skill (production variant).
 * The markdown is extracted from src/lib/wan30-prompt-skill.ts (single source of
 * truth) and upserted as the site's default skill row. Idempotent: same version
 * + content is a no-op; a changed version updates the row with CAS on updatedAt.
 * Current relational rows only; readback asserted; no snapshots involved.
 *
 * Rollback: retire the row (status='retired') — the optimizer then falls back to
 * the built-in skill constant, so behavior reverts to pre-skill-table output.
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
const SKILL_SLUG = 'wan30-ecommerce';
const SKILL_ROW_ID = 'pskill_site_aidreamcapes_wan30_ecommerce';

// Extract WAN30_PROMPT_SKILL_MD / WAN30_PROMPT_SKILL_VERSION from the TS source.
const source = await fs.readFile('src/lib/wan30-prompt-skill.ts', 'utf8');
const mdLiteral = /export const WAN30_PROMPT_SKILL_MD = ("(?:[^"\\]|\\.)*");/.exec(source)?.[1];
const version = /export const WAN30_PROMPT_SKILL_VERSION = "([^"]+)";/.exec(source)?.[1];
assert.ok(mdLiteral && version, 'could not parse the skill constant from wan30-prompt-skill.ts');
const skillMd = JSON.parse(mdLiteral);
assert.ok(skillMd.length > 1000, 'skill markdown looks truncated');
assert.match(version, /^wan30-skill-/);

const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(value === undefined ? '<undefined>' : JSON.stringify(stable(value))).digest('hex');
const db = new PrismaClient();

try {
  const report = await db.$transaction(async tx => {
    const site = await tx.site.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } });
    assert.equal(site.slug, 'aidreamcapes');
    assert.match(site.primaryDomain, /aivideosugc\.com$/);
    const protectedBefore = hash(await tx.promptSkill.findMany({ orderBy: { id: 'asc' } }));
    const existing = await tx.promptSkill.findUnique({ where: { siteId_slug: { siteId, slug: SKILL_SLUG } } });
    const desired = { id: SKILL_ROW_ID, siteId, slug: SKILL_SLUG, title: 'Wan3.0 e-commerce video', summary: 'Seven-discipline Wan3.0 e-commerce video prompt structure (style, goal, product, scene, timeline, sound, constraints).', skillMd, version, isDefault: true, status: 'active' };
    const operations = [];
    if (!existing) {
      operations.push({ entity: 'prompt_skill', id: SKILL_ROW_ID, action: 'insert', version, previousValue: null, value: { ...desired, skillMd: `<${skillMd.length} chars>` } });
      if (applying) {
        await tx.promptSkill.create({ data: desired });
      }
    } else if (existing.skillMd !== skillMd || existing.version !== version || !existing.isDefault || existing.status !== 'active') {
      operations.push({ entity: 'prompt_skill', id: SKILL_ROW_ID, action: 'update', version, previousValue: { version: existing.version, skillMdChars: existing.skillMd.length }, value: { version, skillMdChars: skillMd.length } });
      if (applying) {
        const result = await tx.promptSkill.updateMany({ where: { id: existing.id, siteId, slug: SKILL_SLUG, updatedAt: existing.updatedAt }, data: { title: desired.title, summary: desired.summary, skillMd, version, isDefault: true, status: 'active' } });
        assert.equal(result.count, 1, 'CAS update failed: the skill row changed concurrently');
      }
    }
    if (applying) {
      const readback = await tx.promptSkill.findUniqueOrThrow({ where: { siteId_slug: { siteId, slug: SKILL_SLUG } } });
      assert.equal(readback.skillMd, skillMd);
      assert.equal(readback.version, version);
      assert.equal(readback.isDefault, true);
    }
    const protectedAfter = hash(await tx.promptSkill.findMany({ orderBy: { id: 'asc' } }));
    assert.ok(applying ? protectedBefore !== protectedAfter || !operations.length : protectedBefore === protectedAfter, 'unexpected prompt_skill table drift');
    const others = await tx.promptSkill.count({ where: { siteId, slug: { not: SKILL_SLUG } } });
    return { ok: true, target: 'production', siteId, applying, skillVersion: version, skillMdChars: skillMd.length, operations, otherSkillRows: others, historicalStateActivated: false };
  }, { timeout: 60000 });
  const out = 'releases/aidreamcapes-prompt-skill-seed-20261109';
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(`${out}/production-${applying ? 'apply' : 'plan'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await db.$disconnect(); }
