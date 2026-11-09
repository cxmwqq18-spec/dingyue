#!/usr/bin/env node
/** One-shot diagnostic probe: calls the SAME production text provider with the
 * SAME system prefix + skill + user payload as optimizeWan30VideoPrompt, then
 * replicates the validators locally to identify which rule rejects the output
 * and prints the raw LLM text. Read-only for site data; one real LLM call.
 * Run on the production host from the release root.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';

loadRuntimeEnv();

// --- Extract the skill + prefix from the TS source (same as the seed script).
const source = await fs.readFile('src/lib/wan30-prompt-skill.ts', 'utf8');
const skillMd = JSON.parse(/export const WAN30_PROMPT_SKILL_MD = ("(?:[^"\\]|\\.)*");/.exec(source)[1]);
const prefixBlock = /export const WAN30_OPTIMIZER_SYSTEM_PREFIX = \[\n((?:.*\n)*?)\]\.join\("\\n"\);/.exec(source)[1];
const prefixLines = [...prefixBlock.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => JSON.parse(`"${m[1]}"`));
const systemPrompt = prefixLines.join('\n');

// --- Same user payload as generationMessages.
const videoTypes = {
  product_ad: { label: '产品广告片', instruction: '突出产品卖点', strategy: '以商品为主角' }
};
const input = {
  sourcePrompt: '薰衣草护手霜，10秒视频。一位年轻女性在明亮浴室里洗手后挤出护手霜涂抹，特写手部滋润效果，包装出现在画面里，卖点是24小时保湿。',
  videoTypeId: 'product_ad',
  durationSeconds: 10,
  aspectRatio: '9:16',
  resolution: '1080p',
  referenceImages: []
};
const textPayload = JSON.stringify({
  task: '把下面的用户描述优化成一条可直接粘贴给 Wan3.0 的电商商品视频提示词。',
  sourcePrompt: input.sourcePrompt,
  videoType: videoTypes[input.videoTypeId].label,
  videoTypeInstruction: videoTypes[input.videoTypeId].instruction,
  videoTypeStrategy: videoTypes[input.videoTypeId].strategy,
  durationSeconds: input.durationSeconds,
  aspectRatio: input.aspectRatio,
  resolution: input.resolution.toUpperCase(),
  referenceCount: 0,
  references: []
});

const db = new PrismaClient();
let raw = '';
try {
  const providers = await db.platformAiProvider.findMany({ where: { providerType: 'text' } });
  const provider = providers.find(p => p.enabled && p.apiKey);
  assert.ok(provider, 'no runnable text provider');
  const url = new URL(provider.aiUrl);
  let path = url.pathname.replace(/\/+$/, '');
  if (path.endsWith('/chat/completions')) { /* keep */ }
  else if (path.endsWith('/models')) { url.pathname = path.slice(0, -'/models'.length) + '/chat/completions'; }
  else { url.pathname = (path.endsWith('/v1') ? path : `${path || '/v1'}`) + '/chat/completions'; }
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ model: provider.modelType, temperature: 0.7, messages: [{ role: 'system', content: systemPrompt + skillMd }, { role: 'user', content: textPayload }] })
  });
  assert.ok(response.ok, `provider http ${response.status}`);
  const payload = await response.json();
  raw = (payload.choices?.[0]?.message?.content ?? '').trim();
  assert.ok(raw, 'empty provider response');
} finally { await db.$disconnect(); }

// --- Parse like the optimizer, then replicate every validator to find the trip-wire.
let optimizedPrompt = raw;
try {
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(jsonText);
  optimizedPrompt = String(parsed.optimizedPrompt ?? '').trim();
} catch { /* validator would report parse failure; show raw */ }

const checks = {};
checks.ratios = [...optimizedPrompt.matchAll(/\b(\d{1,2})\s*:\s*(\d{1,2})\b/g)].map(m => `${m[1]}:${m[2]}`);
checks.durationsZh = [...optimizedPrompt.matchAll(/(\d{1,3})\s*秒(?!\])/g)].map(m => Number(m[1]));
checks.durationsEn = [...optimizedPrompt.matchAll(/\b(\d{1,3})\s*(?:-| )?seconds?\b/gi)].map(m => Number(m[1]));
checks.resolutions = [...optimizedPrompt.matchAll(/\b(480p|720p|1080p|1440p|4k)\b/gi)].map(m => m[1].toLowerCase());
checks.referenceIndexes = [...optimizedPrompt.matchAll(/图(\d{1,2})/g)].map(m => Number(m[1]));
checks.mentionsReferenceImages = /参考图|参考图片|reference images?/i.test(optimizedPrompt);
checks.sectionLabels = /\bB[1-7]\b/.test(optimizedPrompt);
checks.markdownHeading = /^#{1,6}\s/m.test(optimizedPrompt);
checks.negative = /避免|不要|禁止|不得|不出现|负面|negative/i.test(optimizedPrompt);
const conflicts = [];
if (checks.ratios.some(r => r !== input.aspectRatio)) conflicts.push(`ratio ${checks.ratios.join(',')} != ${input.aspectRatio}`);
if (checks.durationsZh.some(d => d > input.durationSeconds) || checks.durationsEn.some(d => d > input.durationSeconds)) conflicts.push('duration overrun');
if (checks.resolutions.some(r => r !== input.resolution.toLowerCase())) conflicts.push(`resolution ${checks.resolutions.join(',')} != 1080p`);
if (checks.referenceIndexes.some(i => i > 0)) conflicts.push('reference index out of range');
if (input.referenceImages.length === 0 && checks.mentionsReferenceImages) conflicts.push('mentions reference images with none provided');
if (checks.sectionLabels) conflicts.push('B1-B7 section labels');
if (checks.markdownHeading) conflicts.push('markdown heading');
if (!checks.negative) conflicts.push('missing negative constraints');

console.log(JSON.stringify({ ok: true, conflicts, checks: { ...checks, mentionsReferenceImages: undefined, negative: undefined } }, null, 2));
console.log('\n===== RAW LLM RESPONSE =====\n' + raw + '\n===== END =====\n');
