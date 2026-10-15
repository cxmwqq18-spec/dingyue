import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { assertDatabaseTarget } from '../lib/database-target.mjs';
import { loadCloneAcceptanceEnv } from './clone-http-fixture.mjs';
await loadCloneAcceptanceEnv();
assertDatabaseTarget({ expectedTarget: 'local' });
assert(!process.env.CUSTOMER_ASSET_WRITE_BASE_URL && !process.env.CUSTOMER_ASSET_SHARED_BASE_URL, 'Remote storage is forbidden.');
const origin = 'http://localhost:3002';
const siteId = 'site_aidreamcapes';
const prefix = `/api/sites/${siteId}/aivideosugc`;
const clone = `${prefix}/clones`;
const runId = `synthetic-clone-http-${randomUUID()}`;
const owners = [0, 1].map(index => ({ id: `${runId}-${index}`, sessionId: randomBytes(32).toString('hex') }));
const customerIds = owners.map(owner => owner.id);
const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'dev-csrf-secret-change-me';
const credentials = owners.map(owner => {
  const nonce = randomBytes(24).toString('base64url');
  const token = `${nonce}.${createHmac('sha256', secret).update(`customer:${siteId}:${owner.sessionId}:${nonce}`).digest('base64url')}`;
  return { token, cookie: `customer_session_${siteId}=${owner.sessionId}; customer_csrf_${siteId}=${token}` };
});
const db = new PrismaClient({ errorFormat: 'minimal', log: [] });
const execute = promisify(execFile);
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'synthetic-clone-http-'));
const storageRoot = path.resolve(process.env.CUSTOMER_ASSET_STORAGE_ROOT || 'data/customer-assets');
const summary = { passed: 0, requests: 0, expectedRejections: 0, uploads: 0, customers: 2, cleanup: false, creditLedger: 0, generationJobs: 0 };
let failure;
let currentCheck = 'preflight';
function check(condition, label) { assert.ok(condition, label); summary.passed++; }
const allow = [
  ['GET', /^\/clones(?:\/assets|\/consents|\/jobs)?$/],
  ['GET', /^\/clones\/(?:jobs|consents)\/[a-zA-Z0-9_-]+$/],
  ['POST', /^\/clones\/(?:assets|consents|voice-twins\/queue|ad-references\/queue)$/],
  ['POST', /^\/clones\/jobs\/[a-zA-Z0-9_-]+\/(?:run-mock|retry|cancel|bind-actor|attach-draft)$/],
  ['PATCH', /^\/clones\/consents\/[a-zA-Z0-9_-]+$/],
  ['DELETE', /^\/clones\/jobs\/[a-zA-Z0-9_-]+$/],
  ['GET', /^\/(?:actors|tasks\/[a-zA-Z0-9_-]+)$/],
  ['POST', /^\/(?:actors|tasks)$/],
];
async function request(route, { method = 'GET', owner = 0, body, form, revision, csrf = true, status = 200, error, key } = {}) {
  currentCheck = `${method} ${route}`;
  const relative = route.startsWith(prefix) ? route.slice(prefix.length) : '';
  const imageUpload = method === 'POST' && route === `/api/sites/${siteId}/customers/${owners[0].id}/assets`;
  assert(imageUpload || allow.some(([verb, pattern]) => verb === method && pattern.test(relative)), 'Route outside non-generating acceptance allowlist.');
  assert(!/quote|reserve|billing|generate|actions/.test(route), 'Paid/model routes forbidden.');
  const auth = owner === null ? {} : { cookie: credentials[owner].cookie, ...(csrf && method !== 'GET' ? { 'x-csrf-token': credentials[owner].token } : {}) };
  const response = await fetch(`${origin}${route}`, { method, redirect: 'error', signal: AbortSignal.timeout(60_000), headers: { ...auth, ...(body ? { 'content-type': 'application/json' } : {}), ...(revision ? { 'if-match': String(revision) } : {}), ...(key ? { 'idempotency-key': key } : {}) }, body: form || (body ? JSON.stringify(body) : undefined) });
  summary.requests++;
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error(`${currentCheck}: HTTP ${response.status}; non-JSON response (${text.length} bytes)`); }
  if (response.status !== status) throw new Error(`${currentCheck}: expected ${status}, got ${response.status}; code=${typeof result.error === 'string' ? result.error : 'none'}`);
  if (error) check(result.error === error, `${currentCheck} expected error ${error}`);
  check(response.status === status, `${currentCheck} status`);
  if (status >= 400) summary.expectedRejections++;
  return result;
}
async function upload(filename, workflow) {
  const form = new FormData();
  form.set('file', new Blob([await fs.readFile(path.join(directory, filename))], { type: workflow === 'voice_twin' ? 'audio/wav' : 'video/mp4' }), filename);
  form.set('workflow', workflow);
  const result = await request(`${clone}/assets`, { method: 'POST', form, status: 201 });
  summary.uploads++;
  check(result.media.durationSeconds > 0 && result.asset.id, 'Validated synthetic media upload');
  return result.asset;
}
async function grant(workflow, sourceAssetId) {
  return (await request(`${clone}/consents`, { method: 'POST', body: { workflow, scope: workflow, sourceAssetId, rightsConfirmed: true }, status: 201 })).consent;
}
async function queue(workflow, consent, idempotencyKey = randomUUID()) {
  return request(`${clone}/${workflow === 'voice_twin' ? 'voice-twins' : 'ad-references'}/queue`, { method: 'POST', body: { consentId: consent.id, consentRevision: consent.revision, idempotencyKey }, status: 202 });
}
try {
  await db.$connect();
  for (const owner of owners) {
    await db.customer.create({ data: { id: owner.id, siteId, email: `${owner.id}@example.invalid`, name: 'SYNTHETIC clone HTTP acceptance', status: 'active', passwordHash: null } });
    await db.customerSession.create({ data: { id: owner.sessionId, siteId, customerId: owner.id, expiresAt: new Date(Date.now() + 900_000) } });
  }
  await request(clone, { owner: null, status: 401, error: 'customer_login_required' });
  await request(`${clone}/consents`, { method: 'POST', owner: null, body: {}, status: 401, error: 'customer_login_required' });
  const caps = await request(clone);
  check(caps.productionReady === false && caps.components.database.available === true && caps.analysisBeforeTask === true, 'Installed schema + taskless capability, production false');
  check(caps.externalRequests === false && caps.billing === false, 'No real provider/billing capability');
  await request(`${clone}/consents`, { method: 'POST', csrf: false, body: {}, status: 403, error: 'csrf_token_required' });
  await execute('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-ac', '1', '-ar', '16000', path.join(directory, 'synthetic.wav')]);
  await execute('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=160x160:r=10:d=2', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(directory, 'synthetic.mp4')]);
  await execute('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=green:s=128x128', '-frames:v', '1', path.join(directory, 'synthetic.png')]);
  const audio = await upload('synthetic.wav', 'voice_twin');
  const video = await upload('synthetic.mp4', 'ad_reference');
  const form = new FormData(); form.set('file', new Blob([await fs.readFile(path.join(directory, 'synthetic.png'))], { type: 'image/png' }), 'synthetic.png'); form.set('label', 'SYNTHETIC product and actor fixture');
  const image = (await request(`/api/sites/${siteId}/customers/${owners[0].id}/assets`, { method: 'POST', form })).asset;
  summary.uploads++;
  const actorBody = { name: 'SYNTHETIC private actor', gender: 'female', ageRange: '25-30', languages: ['en'], imageUrl: image.previewUrl, refAudio: audio.previewUrl };
  const actor = (await request(`${prefix}/actors`, { method: 'POST', body: actorBody, status: 201 })).actor;
  await request(`${prefix}/actors`, { method: 'POST', owner: 1, body: actorBody, status: 403, error: 'actor_image_not_owned' });
  const actors = (await request(`${prefix}/actors`)).actors;
  check(actors.filter(item => !item.actorId.startsWith('custom-')).length === 53, '53 built-in actors preserved');
  await request(`${clone}/consents`, { method: 'POST', owner: 1, body: { workflow: 'voice_twin', scope: 'voice_twin', sourceAssetId: audio.id, rightsConfirmed: true }, status: 403, error: 'clone_source_asset_not_owned' });
  const voiceConsent = await grant('voice_twin', audio.id);
  const voice = (await queue('voice_twin', voiceConsent)).job;
  await request(`${clone}/jobs/${voice.id}`, { owner: 1, status: 404, error: 'clone_job_not_found' });
  await request(`${clone}/jobs/${voice.id}/run-mock`, { method: 'POST', owner: 1, revision: voice.revision, status: 404, error: 'clone_job_not_found' });
  let readyVoice = (await request(`${clone}/jobs/${voice.id}/run-mock`, { method: 'POST', revision: voice.revision })).job;
  check(readyVoice.result.provenance.consentId === voiceConsent.id && readyVoice.result.sourceAssetId === audio.id && readyVoice.result.output === null && readyVoice.result.mediaRead === false && readyVoice.result.productionReady === false, 'Truthful voice mock result');
  const bound = await request(`${clone}/jobs/${voice.id}/bind-actor`, { method: 'POST', revision: readyVoice.revision, body: { actorId: actor.actorId, mockMode: true } });
  check(bound.actor.voice.voiceId.startsWith('mock:aidreamcapes:clone:') && bound.actor.cloneBinding.consentId === voiceConsent.id, 'Private actor bound to explicit mock provenance');
  const reloadedActors = (await request(`${prefix}/actors`)).actors;
  check(reloadedActors.find(item => item.actorId === actor.actorId)?.voice.voiceId === bound.actor.voice.voiceId, 'Actor binding survives HTTP reload');
  const adConsent = await grant('ad_reference', video.id);
  check(adConsent.taskId === null, 'Ad consent before target draft');
  const adKey = randomUUID();
  const ad = (await queue('ad_reference', adConsent, adKey)).job;
  check(ad.taskId === null, 'Ad queue before target draft');
  const replay = await request(`${clone}/ad-references/queue`, { method: 'POST', body: { consentId: adConsent.id, consentRevision: adConsent.revision, idempotencyKey: adKey } });
  check(replay.job.id === ad.id && replay.created === false, 'HTTP queue idempotent replay');
  const readyAd = (await request(`${clone}/jobs/${ad.id}/run-mock`, { method: 'POST', revision: ad.revision })).job;
  const loadedAd = (await request(`${clone}/jobs/${ad.id}`)).job;
  check(loadedAd.result.output === null && loadedAd.result.mediaRead === false && loadedAd.result.remoteFetch === false && loadedAd.result.analysis.synthetic === true && loadedAd.result.analysis.transcript.length === 0, 'Truthful saved synthetic analysis, no fabricated transcript');
  const productUrl = 'https://example.invalid/synthetic-product';
  const brief = { sourceUrl: productUrl, fetchedPageUrl: productUrl, selectionConfirmed: true, priceConfirmed: false, reviewRequired: true, customerConfirmedAt: new Date().toISOString(), title: { value: 'SYNTHETIC green test item', sourceUrl: productUrl, sourceLabel: 'Synthetic fixture confirmed by acceptance', confidence: 'high', confirmed: false }, description: null, possiblePrice: null };
  const draft = (await request(`${prefix}/tasks`, { method: 'POST', status: 201, key: randomUUID(), body: { sceneId: 'texture_closeup', title: 'SYNTHETIC clone acceptance draft', input: { fields: { detail: 'A solid green synthetic test item.' }, images: { productImages: [image.previewUrl] }, options: { duration: 15, aspect: '9:16', language: 'en', style: 'natural', subtitle: false } }, productBrief: brief } })).task;
  const attached = await request(`${clone}/jobs/${ad.id}/attach-draft`, { method: 'POST', revision: readyAd.revision, body: { taskId: draft.taskId, taskRevision: draft.revision, mockMode: true, confirmedProductFacts: true, analysisRevision: 1, segments: [{ start: 0, end: 5, role: 'hook', visual: 'SYNTHETIC reviewed structure' }] } });
  check(attached.task.productBrief.title.value === brief.title.value && attached.sourceAnalysis.userEdited && attached.sourceAnalysis.sourceAssetId === video.id, 'Confirmed product facts separate from reference structure');
  const linked = (await request(`${clone}/jobs/${ad.id}`)).job;
  check(linked.attachedTaskId === draft.taskId && linked.taskId === null, 'Derived attachedTaskId reload preserves canonical taskless audit');
  const savedDraft = (await request(`${prefix}/tasks/${draft.taskId}`)).task;
  check(savedDraft.sourceAnalysis.referenceAnalysisId === ad.id && savedDraft.productBrief.title.value === brief.title.value, 'Task reload preserves analysis and confirmed facts independently');
  const retried = (await request(`${clone}/jobs/${ad.id}/retry`, { method: 'POST', revision: readyAd.revision, body: { mockMode: true, idempotencyKey: randomUUID() }, status: 201 })).job;
  const cancelled = (await request(`${clone}/jobs/${retried.id}/cancel`, { method: 'POST', revision: retried.revision })).job;
  check(cancelled.status === 'cancelled', 'Retry is new job and can cancel');
  await request(`${clone}/consents/${adConsent.id}`, { method: 'PATCH', revision: adConsent.revision, body: { action: 'revoke' } });
  await request(`${clone}/ad-references/queue`, { method: 'POST', body: { consentId: adConsent.id, consentRevision: adConsent.revision, idempotencyKey: randomUUID() }, status: 403, error: 'clone_consent_revoked' });
  await request(`${clone}/jobs/${ad.id}/retry`, { method: 'POST', revision: readyAd.revision, body: { mockMode: true, idempotencyKey: randomUUID() }, status: 403, error: 'clone_consent_revoked' });
  await request(`${clone}/consents/${voiceConsent.id}`, { method: 'PATCH', revision: voiceConsent.revision, body: { action: 'revoke' } });
  await request(`${clone}/jobs/${voice.id}/bind-actor`, { method: 'POST', revision: readyVoice.revision, body: { actorId: actor.actorId, mockMode: true }, status: 403, error: 'clone_consent_revoked' });
  const deleted = (await request(`${clone}/jobs/${retried.id}`, { method: 'DELETE', revision: cancelled.revision })).job;
  check(deleted.status === 'deleted' && deleted.consentId === adConsent.id, 'Soft deletion retains consent audit');
} catch (error) {
  failure = `${currentCheck}: ${error instanceof Error ? error.message : 'acceptance failed'}`;
  // Only bounded safe error/status metadata; never response bodies, cookies or tokens.
  console.error(`FAIL clone HTTP acceptance: ${failure}`);
} finally {
  try {
    const scope = { siteId, customerId: { in: customerIds } };
    summary.creditLedger = await db.creditLedger.count({ where: scope });
    summary.generationJobs = await db.generationJob.count({ where: scope });
    check(summary.creditLedger === 0 && summary.generationJobs === 0, 'No synthetic customer billing or generation records');
    const assets = await db.assetUpload.findMany({ where: scope, select: { storageKey: true } });
    // Explicit fixture-site and exact customer predicates on every destructive operation.
    await db.$executeRaw`DELETE FROM "AidreamcapesCloneJob" WHERE "siteId" = ${siteId} AND "customerId" = ANY(${customerIds}::text[])`;
    await db.$executeRaw`DELETE FROM "AidreamcapesCloneConsent" WHERE "siteId" = ${siteId} AND "customerId" = ANY(${customerIds}::text[])`;
    await db.$executeRaw`DELETE FROM "AidreamcapesVideoTask" WHERE "siteId" = ${siteId} AND "customerId" = ANY(${customerIds}::text[])`;
    await db.$executeRaw`DELETE FROM "AidreamcapesWorkspaceActor" WHERE "siteId" = ${siteId} AND "customerId" = ANY(${customerIds}::text[])`;
    await db.assetUpload.deleteMany({ where: scope });
    await db.customerSession.deleteMany({ where: { ...scope, id: { in: owners.map(owner => owner.sessionId) } } });
    await db.customer.deleteMany({ where: { siteId, id: { in: customerIds }, email: { endsWith: '@example.invalid' }, name: 'SYNTHETIC clone HTTP acceptance' } });
    for (const { storageKey } of assets) {
      check(customerIds.some(id => storageKey.startsWith(`sites/${siteId}/customers/${id}/assets/`)) && !storageKey.includes('..'), 'Cleanup asset path belongs to exact fixture');
      const file = path.resolve(storageRoot, storageKey);
      assert(file.startsWith(`${storageRoot}${path.sep}`));
      await fs.rm(file, { force: true });
    }
    for (const owner of owners) {
      const folder = path.join(storageRoot, 'sites', siteId, 'customers', owner.id);
      await fs.rm(folder, { recursive: true, force: true });
    }
    check(await db.customer.count({ where: { siteId, id: { in: customerIds } } }) === 0, 'All exact synthetic customers removed');
    const remaining = await db.$queryRaw`SELECT (SELECT count(*) FROM "AidreamcapesCloneJob" WHERE "siteId" = ${siteId} AND "customerId" = ANY(${customerIds}::text[])) + (SELECT count(*) FROM "AidreamcapesCloneConsent" WHERE "siteId" = ${siteId} AND "customerId" = ANY(${customerIds}::text[])) + (SELECT count(*) FROM "AidreamcapesVideoTask" WHERE "siteId" = ${siteId} AND "customerId" = ANY(${customerIds}::text[])) + (SELECT count(*) FROM "AidreamcapesWorkspaceActor" WHERE "siteId" = ${siteId} AND "customerId" = ANY(${customerIds}::text[])) AS count`;
    check(Number(remaining[0].count) === 0 && await db.assetUpload.count({ where: scope }) === 0 && await db.customerSession.count({ where: scope }) === 0, 'All scoped fixtures removed');
    summary.cleanup = true;
  } catch (error) { failure ||= 'Scoped cleanup failed'; console.error(`FAIL cleanup: ${error instanceof Error ? error.message.replace(/\b[a-f0-9]{64}\b/g, '[redacted]') : 'unknown error'}`); }
  await fs.rm(directory, { recursive: true, force: true });
  await db.$disconnect();
}
console.log(JSON.stringify({ result: failure ? 'FAIL' : 'PASS', ...summary }));
if (failure) process.exitCode = 1;
