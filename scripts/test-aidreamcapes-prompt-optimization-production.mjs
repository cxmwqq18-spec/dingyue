#!/usr/bin/env node
/** End-to-end REAL prompt-optimization test against a running Aidreamcapes
 * server: login as the QA customer (workspaceAuth + CSRF), list prompt skills,
 * submit two real optimization jobs (default skill + explicit skillSlug), poll
 * to completion, and assert the LLM output is merchant-ready natural language:
 * no internal section codes (B1–B7), no markdown headings, negative
 * constraints present, settings consistent. No mocks.
 *
 * Usage (on the production host):
 *   ADC_QA_CUSTOMER_PASSWORD=... node scripts/test-aidreamcapes-prompt-optimization-production.mjs \
 *     --base=https://www.aivideosugc.com [--skill-slug=wan30-ecommerce]
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const i = a.indexOf('=');
  return i === -1 ? [a.replace(/^--/, ''), true] : [a.slice(2, i), a.slice(i + 1)];
}));
const base = (args['base'] || 'https://www.aivideosugc.com').replace(/\/$/, '');
const siteId = 'site_aidreamcapes';
const email = (process.env.ADC_QA_CUSTOMER_EMAIL || 'qa-prompt-skill@aivideosugc.com').toLowerCase();
const password = process.env.ADC_QA_CUSTOMER_PASSWORD;
assert.ok(password, 'ADC_QA_CUSTOMER_PASSWORD is required');
const explicitSlug = typeof args['skill-slug'] === 'string' ? args['skill-slug'] : undefined;

const SOURCE_PROMPT = '薰衣草护手霜，10秒视频。一位年轻女性在明亮浴室里洗手后挤出护手霜涂抹，特写手部滋润效果，包装出现在画面里，卖点是24小时保湿。';

async function main() {
  // 1. Login → session + CSRF cookies.
  const login = await fetch(`${base}/api/sites/${siteId}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  assert.equal(login.status, 200, `login failed: ${login.status} ${await login.text()}`);
  const cookies = (login.headers.getSetCookie?.() ?? []).map(row => row.split(';')[0]);
  const csrfCookie = cookies.find(row => row.toLowerCase().includes('csrf'));
  assert.ok(csrfCookie, 'login did not set a CSRF cookie');
  const csrfToken = csrfCookie.split('=')[1];
  const cookieHeader = cookies.join('; ');
  const authHeaders = { cookie: cookieHeader, 'x-csrf-token': csrfToken };
  console.log(JSON.stringify({ step: 'login', ok: true, customer: (await login.json()).customer.email }));

  // 2. List skills (the selector's data source).
  const skillsResponse = await fetch(`${base}/api/sites/${siteId}/aivideosugc/prompt-skills`, { headers: { cookie: cookieHeader } });
  assert.equal(skillsResponse.status, 200, `prompt-skills failed: ${skillsResponse.status}`);
  const { skills } = await skillsResponse.json();
  assert.ok(Array.isArray(skills) && skills.length >= 1, 'no active prompt skills returned');
  const defaultSkill = skills.find(skill => skill.isDefault) ?? skills[0];
  console.log(JSON.stringify({ step: 'prompt-skills', skills }));

  // 3. Two real optimization jobs: default skill path + explicit skillSlug path.
  const jobs = [
    { label: 'default-skill', body: { prompt: SOURCE_PROMPT, videoTypeId: 'product_ad', durationSeconds: 10, aspectRatio: '9:16', resolution: '1080p' } },
    { label: 'explicit-slug', body: { prompt: SOURCE_PROMPT, videoTypeId: 'tiktok_ad', durationSeconds: 10, aspectRatio: '9:16', resolution: '1080p', skillSlug: explicitSlug ?? defaultSkill.slug } }
  ];
  const results = [];
  for (const job of jobs) {
    const submit = await fetch(`${base}/api/sites/${siteId}/aivideosugc/prompt-optimizations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders, 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify(job.body)
    });
    assert.equal(submit.status, 200, `submit (${job.label}) failed: ${submit.status} ${await submit.text()}`);
    const { jobId } = await submit.json();
    const startedAt = Date.now();
    let finalJob = null;
    while (Date.now() - startedAt < 240_000) {
      await new Promise(resolve => setTimeout(resolve, 4000));
      const poll = await fetch(`${base}/api/sites/${siteId}/aivideosugc/prompt-optimizations/${jobId}`, { headers: { cookie: cookieHeader } });
      assert.equal(poll.status, 200, `poll failed: ${poll.status}`);
      const { job: snapshot } = await poll.json();
      if (snapshot.status === 'succeeded' || snapshot.status === 'failed') { finalJob = snapshot; break; }
    }
    assert.ok(finalJob, `job (${job.label}) did not finish in 240s`);
    assert.equal(finalJob.status, 'succeeded', `job (${job.label}) failed: ${JSON.stringify(finalJob.error)}`);
    const optimizedPrompt = finalJob.result.optimizedPrompt;
    assert.ok(optimizedPrompt.length >= 80 && optimizedPrompt.length <= 5000, 'optimized prompt length out of range');
    assert.doesNotMatch(optimizedPrompt, /\bB[1-7]\b/, 'internal section code B1-B7 leaked into the prompt');
    assert.doesNotMatch(optimizedPrompt, /^#{1,6}\s/m, 'markdown heading leaked into the prompt');
    assert.match(optimizedPrompt, /避免|不要|禁止|不得/, 'negative constraints missing');
    assert.match(optimizedPrompt, /10\s*秒|10s/i, 'duration setting not preserved');
    results.push({ label: job.label, jobId, chars: optimizedPrompt.length, optimizerVersion: finalJob.result.optimizerVersion, optimizedPrompt });
    console.log(JSON.stringify({ step: 'optimized', label: job.label, jobId, chars: optimizedPrompt.length, optimizerVersion: finalJob.result.optimizerVersion }));
  }

  // 4. Full transcript for the report.
  const out = 'releases/aidreamcapes-prompt-skill-seed-20261109/production-real-optimization-test.json';
  const fs = await import('node:fs/promises');
  await fs.mkdir('releases/aidreamcapes-prompt-skill-seed-20261109', { recursive: true });
  await fs.writeFile(out, JSON.stringify({ ok: true, base, email, skills, sourcePrompt: SOURCE_PROMPT, results, at: new Date().toISOString() }, null, 2));
  for (const result of results) {
    console.log(`\n===== ${result.label} (${result.chars} chars, ${result.optimizerVersion}) =====\n${result.optimizedPrompt}\n`);
  }
  console.log(JSON.stringify({ ok: true, report: out }));
}

main().catch(error => { console.error(JSON.stringify({ ok: false, error: String(error?.message || error) })); process.exit(1); });
