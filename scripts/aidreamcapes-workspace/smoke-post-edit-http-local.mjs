import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { assertDatabaseTarget } from '../lib/database-target.mjs';
import { loadCloneAcceptanceEnv } from './clone-http-fixture.mjs';

// This fixture creates a synthetic, already-generated clip. It never calls an
// action, quote, provider, worker, credit, or ledger endpoint.
await loadCloneAcceptanceEnv();
assertDatabaseTarget({ expectedTarget: 'local' });
assert(!process.env.CUSTOMER_ASSET_WRITE_BASE_URL && !process.env.CUSTOMER_ASSET_SHARED_BASE_URL, 'Remote asset storage is forbidden.');

const siteId = 'site_aidreamcapes';
const origin = 'http://localhost:3002';
const prefix = `/api/sites/${siteId}/aivideosugc`;
const browserRequested = process.argv.includes('--browser');
assert(process.argv.slice(2).every(arg => arg === '--browser'), 'Unsupported fixture argument.');
const today = new Date().toISOString().slice(0, 10);
const analyticsRoute = `${prefix}/analytics?from=${today}&to=${today}&currency=USD`;
const runId = `synthetic-post-edit-${randomUUID()}`;
const owners = [0, 1].map(index => ({ id: `${runId}-${index}`, sessionId: randomBytes(32).toString('hex') }));
const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'dev-csrf-secret-change-me';
const credentials = owners.map(owner => {
  const nonce = randomBytes(24).toString('base64url');
  const token = `${nonce}.${createHmac('sha256', secret).update(`customer:${siteId}:${owner.sessionId}:${nonce}`).digest('base64url')}`;
  return { token, cookie: `customer_session_${siteId}=${owner.sessionId}; customer_csrf_${siteId}=${token}` };
});
const db = new PrismaClient({ errorFormat: 'minimal', log: [] });
const execute = promisify(execFile);
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'synthetic-post-edit-'));
const storageRoot = path.resolve(process.env.CUSTOMER_ASSET_STORAGE_ROOT || 'data/customer-assets');
const renderRoot = path.resolve(process.env.AIVIDEOSUGC_RENDER_ROOT || 'data/aidreamcapes-workspace-render');
const summary = { passed: 0, requests: 0, expectedRejections: 0, uploads: 0, renderVersions: 0, customers: 2,
  creditLedger: 0, generationJobs: 0, cleanup: false };
let taskId;
let assetId;
let sourceRenderId;
let batchId;
let batchTaskIds = [];
let currentCheck = 'preflight';
let failure;
function check(value, label) { assert.ok(value, label); summary.passed++; }
function outputUrl(task, kind) { return `${prefix}/tasks/${task}/output?kind=${kind}`; }
function safeError(error) {
  if (error && typeof error === 'object' && typeof error.code === 'string') return error.code;
  return error instanceof Error ? error.message.slice(0, 300) : 'unknown error';
}
function authHeaders(owner, csrf, method) {
  if (owner === null) return {};
  return { cookie: credentials[owner].cookie, ...(csrf && method !== 'GET' ? { 'x-csrf-token': credentials[owner].token } : {}) };
}
function allowRequest(route, method) {
  const allowed = route === `${prefix}/clones/assets` && method === 'POST' ||
    route === `${prefix}/tasks` && method === 'POST' ||
    route === `${prefix}/tasks/batch` && method === 'POST' ||
    batchId && route === `${prefix}/tasks/batch/${batchId}` && method === 'GET' ||
    batchId && route === `${prefix}/tasks/batch/${batchId}/resume` && method === 'POST' ||
    route === `${prefix}/tasks/${taskId}` && method === 'GET' ||
    route === `${prefix}/tasks/${taskId}/edit` && ['GET', 'PATCH'].includes(method) ||
    route === `${prefix}/tasks/${taskId}/captions` && ['GET', 'PATCH'].includes(method) ||
    route === analyticsRoute && method === 'GET' ||
    [outputUrl(taskId, 'video'), outputUrl(taskId, 'subtitles')].includes(route) && method === 'GET';
  assert(allowed, `Unexpected HTTP route: ${method} ${route}`);
  assert(!/\/actions|\/quote|\/images|\/generation|\/reserve|\/billing/.test(route), 'Paid or generation route forbidden.');
}
async function request(route, { method = 'GET', owner = 0, csrf = true, body, form, revision, key, status = 200, error, binary = false } = {}) {
  allowRequest(route, method);
  currentCheck = `${method} ${route.replace(taskId || 'no-task', ':taskId')}`;
  const response = await fetch(`${origin}${route}`, { method, redirect: 'error', signal: AbortSignal.timeout(90_000),
    headers: { ...authHeaders(owner, csrf, method), ...(body ? { 'content-type': 'application/json' } : {}),
      ...(revision ? { 'if-match': String(revision) } : {}), ...(key ? { 'idempotency-key': key } : {}) },
    body: form || (body ? JSON.stringify(body) : undefined) });
  summary.requests++;
  if (response.status !== status) {
    const value = await response.text();
    let code = 'non_json'; try { code = JSON.parse(value).error || 'none'; } catch {}
    throw new Error(`${currentCheck}: expected ${status}, got ${response.status}; code=${code}`);
  }
  check(response.status === status, `${currentCheck} status`);
  if (status >= 400) summary.expectedRejections++;
  if (binary && status === 200) return { bytes: Buffer.from(await response.arrayBuffer()), headers: response.headers };
  const result = await response.json();
  if (error) check(result.error === error, `${currentCheck} error ${error}`);
  return result;
}
function renderFolder(customerId, renderId) {
  assert(taskId && renderId && /^[a-zA-Z0-9_-]+$/.test(renderId));
  return path.resolve(renderRoot, siteId, customerId, taskId, renderId);
}
async function seedTask(data, revision) {
  assert(taskId && data.taskId === taskId && data.siteId === siteId && data.customerId === owners[0].id);
  const next = { ...data, revision: revision + 1, updatedAt: new Date().toISOString() };
  const rows = await db.$queryRaw`UPDATE "AidreamcapesVideoTask" SET "data" = ${JSON.stringify(next)}::jsonb,
    "revision" = "revision" + 1, "updatedAt" = now() WHERE "id" = ${taskId} AND "siteId" = ${siteId}
    AND "customerId" = ${owners[0].id} AND "revision" = ${revision} RETURNING "revision"`;
  check(rows.length === 1, 'Exact synthetic task JSON seed succeeded');
  return rows[0].revision;
}
async function taskRead() { return (await request(`${prefix}/tasks/${taskId}`)).task; }
function storyboardHash(task) {
  return createHash('sha256').update(JSON.stringify({ input: task.input, musicSelection: task.musicSelection ?? null, storyboard: task.storyboard })).digest('hex');
}
function probe(file) { return execute('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { timeout: 20_000 }); }
async function runBrowserFixture() {
  const helper = path.resolve('scripts/aidreamcapes-workspace/post-edit-browser.py');
  const python = '/tmp/aidreamcapes-dom-browser-venv/bin/python';
  const chromium = '/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  await Promise.all([fs.access(helper), fs.access(python), fs.access(chromium)]);
  const artifacts = await fs.mkdtemp(path.join(os.tmpdir(), 'aidreamcapes-post-edit-browser-evidence-'));
  const payload = { origin, siteId, taskId, sessionId: owners[0].sessionId, token: credentials[0].token, artifacts, chromium };
  const value = await new Promise((resolve, reject) => {
    const child = spawn(python, [helper], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderrBytes = 0;
    const timer = setTimeout(() => child.kill('SIGTERM'), 180_000);
    child.stdout.on('data', data => { stdout += data; if (stdout.length > 1_000_000) child.kill('SIGTERM'); });
    child.stderr.on('data', data => { stderrBytes += data.length; });
    child.on('error', reject);
    child.on('close', code => {
      clearTimeout(timer);
      try {
        const result = JSON.parse(stdout.trim().split('\n').at(-1));
        if (code !== 0 || result.result !== 'PASS') throw new Error(`Browser fixture failed (exit ${code}, stderr bytes ${stderrBytes}).`);
        resolve(result);
      } catch { reject(new Error(`Browser fixture failed (exit ${code}, stderr bytes ${stderrBytes}).`)); }
    });
    child.stdin.end(JSON.stringify(payload));
  });
  return { result: value.result, checks: Number(value.checks || 0), artifacts };
}

try {
  await db.$connect();
  const schema = await db.$queryRaw`SELECT to_regclass('public."AidreamcapesVideoTask"') IS NOT NULL AS task_ready,
    to_regclass('public."AssetUpload"') IS NOT NULL AS asset_ready`;
  check(schema[0]?.task_ready && schema[0]?.asset_ready, 'Local synthetic task and asset tables installed');
  for (const owner of owners) {
    await db.customer.create({ data: { id: owner.id, siteId, email: `${owner.id}@example.invalid`,
      name: 'SYNTHETIC post-edit HTTP acceptance', status: 'active', passwordHash: null } });
    await db.customerSession.create({ data: { id: owner.sessionId, siteId, customerId: owner.id,
      expiresAt: new Date(Date.now() + 900_000) } });
  }
  const emptyAnalytics = await request(analyticsRoute);
  check(emptyAnalytics.dataAvailable === false && emptyAnalytics.emptyState?.code === 'no_provider_metrics',
    'Personal analytics HTTP query returns scoped empty state');
  const batchDraft = await request(`${prefix}/tasks/batch`, { method: 'POST', key: randomUUID(), status: 201,
    body: { items: [{ sceneId: 'process_demo', title: 'SYNTHETIC batch executor gate' }] } });
  batchId = batchDraft.batch.batchId;
  batchTaskIds = batchDraft.tasks.map(task => task.taskId);
  check(batchDraft.batch.status === 'draft' && batchTaskIds.length === 1, 'Batch API creates only a draft');
  await request(`${prefix}/tasks/batch/${batchId}/resume`, { method: 'POST', revision: batchDraft.batch.revision,
    status: 503, error: 'workspace_batch_execution_unavailable' });
  const afterRefusal = await request(`${prefix}/tasks/batch/${batchId}`);
  check(afterRefusal.batch.status === 'draft' && afterRefusal.tasks[0].batch.status === 'draft',
    'Ordinary batch route refuses no-op completion without changing state');

  const clipFile = path.join(temp, 'solid-with-audio.mp4');
  await execute('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i',
    'color=c=blue:s=320x180:r=24:d=6', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=6',
    '-t', '6', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', clipFile], { timeout: 30_000 });
  const originalBytes = await fs.readFile(clipFile);
  const form = new FormData();
  form.set('file', new Blob([originalBytes], { type: 'video/mp4' }), 'synthetic-source.mp4');
  form.set('workflow', 'ad_reference');
  const uploaded = await request(`${prefix}/clones/assets`, { method: 'POST', form, status: 201 });
  assetId = uploaded.asset.id;
  summary.uploads++;
  check(uploaded.media.hasAudio === true && uploaded.asset.role === 'input' && uploaded.media.kind === 'video', 'Synthetic source uploaded and probed with audio');
  // The edit contract reads generated output clips. This fixture promotes only
  // its newly uploaded synthetic row to model an already-generated source clip.
  const roleFlip = await db.assetUpload.updateMany({ where: { id: assetId, siteId, customerId: owners[0].id,
    role: 'input', deletedAt: null }, data: { role: 'output' } });
  check(roleFlip.count === 1, 'Only exact synthetic source asset changed to output role');
  const clipUrl = `/api/sites/${siteId}/customers/${owners[0].id}/assets/${assetId}/download`;

  const draft = (await request(`${prefix}/tasks`, { method: 'POST', status: 201, body: { sceneId: 'process_demo',
    title: 'SYNTHETIC post-edit HTTP fixture', input: { images: {}, fields: {}, options: { duration: 6,
      aspect: '16:9', style: 'professional', language: 'en', subtitle: false, subtitleStyle: 'classic' } } } })).task;
  taskId = draft.taskId;
  check(draft.siteId === siteId && draft.customerId === owners[0].id && draft.status === 'draft', 'Task API created exact owner draft');
  const shotId = 'synthetic_shot_1', vid = 'synthetic_version_1';
  const shot = { shotId, visual: 'Synthetic blue source clip', voiceover: '', refKinds: [], refImgs: {}, environment: 'Local fixture',
    start: 0, end: 6, duration: 6, camera: 'static', framing: 'medium', lighting: 'even', expression: '',
    locked: false, genStatus: 'done', curVer: vid, prompt: 'Synthetic local source', versions: [] };
  shot.versions.push({ visual: shot.visual, voiceover: shot.voiceover, refKinds: [], refImgs: {}, environment: shot.environment,
    start: 0, end: 6, duration: 6, camera: shot.camera, framing: shot.framing, lighting: shot.lighting, expression: shot.expression,
    vid, ts: new Date().toISOString(), prompt: shot.prompt, clipUrl,
    origin: 'auto', status: 'done', nativeAudioVerified: true, speechTimingVerified: true });
  draft.storyboard = { scenePlan: { strategy: 'single', scenes: ['Synthetic source'], mainScene: 'Synthetic source', reason: 'Fixture' },
    lang: 'en', source: 'user_edited', shots: [shot], colorGrade: 'natural', musicGenre: 'none', version: '1' };
  draft.status = 'storyboard_ready';
  draft.storyboardStale = false;
  let revision = await seedTask(draft, draft.revision);
  const shaped = await taskRead();
  check(shaped.revision === revision && shaped.storyboard.shots[0].versions[0].clipUrl === clipUrl, 'Storyboard readback preserves exact clip URL');

  sourceRenderId = `source-${randomUUID()}`;
  const sourceDir = renderFolder(owners[0].id, sourceRenderId);
  await fs.mkdir(sourceDir, { recursive: true, mode: 0o700 });
  await fs.copyFile(clipFile, path.join(sourceDir, 'final.mp4'));
  await fs.writeFile(path.join(sourceDir, 'subtitles.srt'), '1\n00:00:00,500 --> 00:00:03,500\nSynthetic verified caption.\n', { mode: 0o600 });
  shaped.status = 'completed';
  shaped.video = { renderId: sourceRenderId, storyboardHash: storyboardHash(shaped),
    clips: [{ shotId, vid, clipUrl }], status: 'done', stale: false,
    steps: [{ id: 'confirm', status: 'done' }, { id: 'concat', status: 'done' },
      { id: 'subtitles', status: 'done' }, { id: 'audio', status: 'done' }],
    finalUrl: outputUrl(taskId, 'video'),
    subtitleUrl: outputUrl(taskId, 'subtitles'),
    captionLines: [{ start: 0.5, end: 3.5, text: 'Synthetic verified caption.' }],
    createdAt: new Date().toISOString(), completedAt: new Date().toISOString() };
  revision = await seedTask(shaped, revision);
  const ready = await taskRead();
  check(ready.revision === revision && ready.status === 'completed' && ready.video.storyboardHash === storyboardHash(ready), 'Completed synthetic source readback and hash');

  await request(`${prefix}/tasks/${taskId}/edit`, { owner: null, status: 401, error: 'customer_login_required' });
  await request(`${prefix}/tasks/${taskId}/captions`, { owner: null, status: 401, error: 'customer_login_required' });
  await request(`${prefix}/tasks/${taskId}/edit`, { owner: 1, status: 404, error: 'task_not_found' });
  await request(`${prefix}/tasks/${taskId}/captions`, { owner: 1, status: 404, error: 'task_not_found' });
  await request(`${prefix}/tasks/${taskId}/edit`, { method: 'PATCH', csrf: false, body: { edits: {} }, revision,
    status: 403, error: 'csrf_token_required' });
  await request(`${prefix}/tasks/${taskId}/captions`, { method: 'PATCH', csrf: false, body: { lines: [] }, revision,
    status: 403, error: 'csrf_token_required' });
  const editGet = await request(`${prefix}/tasks/${taskId}/edit`);
  check(editGet.renderId === sourceRenderId && editGet.duration === 6, 'Edit GET exposes verified source');
  const captionsGet = await request(`${prefix}/tasks/${taskId}/captions`);
  check(captionsGet.lines.length === 1 && captionsGet.lines[0].text === 'Synthetic verified caption.', 'Caption GET exposes source cue');
  await request(`${prefix}/tasks/${taskId}/captions`, { method: 'PATCH', revision,
    body: { lines: [{ start: 1, end: 3, text: 'First' }, { start: 2, end: 4, text: 'Overlap' }] },
    status: 422, error: 'workspace_caption_timing_invalid' });
  await request(`${prefix}/tasks/${taskId}/edit`, { method: 'PATCH', revision,
    body: { edits: { clips: [{ shotId, inPoint: 6, outPoint: 1 }] } }, status: 422, error: 'workspace_edit_clip_range_invalid' });
  const corrected = await request(`${prefix}/tasks/${taskId}/captions`, { method: 'PATCH', revision,
    body: { lines: [{ start: 0.75, end: 3.25, text: 'Corrected synthetic caption.' }] } });
  check(corrected.revision === revision + 1 && corrected.edited, 'Confirmed caption correction saved');
  const beforeEditRevision = corrected.revision;
  await request(`${prefix}/tasks/${taskId}/captions`, { method: 'PATCH', revision,
    body: { lines: [{ start: 0.75, end: 3.25, text: 'Stale' }] }, status: 409, error: 'revision_conflict' });

  const first = await request(`${prefix}/tasks/${taskId}/edit`, { method: 'PATCH', revision: beforeEditRevision,
    body: { edits: { clips: [{ shotId, inPoint: 0.5, outPoint: 3.5, speed: 1.5 }], subtitleStyle: 'bold',
      overlay: { text: 'SYNTHETIC local fixture', cta: 'Review now' }, audio: { nativeGain: 0.8, musicGain: 0, mixMusic: false } } } });
  check(first.revision === beforeEditRevision + 1 && first.renderId !== sourceRenderId && first.duration === 2,
    'Local FFmpeg edit applied trim, speed, style, overlay, and audio gain');
  summary.renderVersions++;
  const firstTask = await taskRead();
  check(firstTask.videoHistory.some(video => video.renderId === sourceRenderId) && firstTask.video.captionLines.length > 0,
    'Edited readback retains source history and corrected caption');
  const firstFile = path.join(renderFolder(owners[0].id, first.renderId), 'final.mp4');
  const firstInfo = JSON.parse((await probe(firstFile)).stdout);
  check(firstInfo.streams.some(stream => stream.codec_type === 'audio') &&
    Math.abs(Number(firstInfo.format.duration) - 2) < 0.15, 'Edited MP4 has audio and measured duration');
  const video = await request(outputUrl(taskId, 'video'), { binary: true });
  check(video.bytes.length > 1_000 && video.headers.get('content-type')?.startsWith('video/mp4'), 'HTTP MP4 download');
  const subtitles = await request(outputUrl(taskId, 'subtitles'), { binary: true });
  check(subtitles.bytes.toString('utf8').includes('Corrected synthetic caption.'), 'HTTP SRT download uses corrected caption');
  await request(outputUrl(taskId, 'video'), { owner: 1, status: 404, error: 'task_not_found' });
  await request(outputUrl(taskId, 'video'), { owner: null, status: 401, error: 'customer_login_required' });
  const afterEditGet = await request(`${prefix}/tasks/${taskId}/edit`);
  check(afterEditGet.renderId === first.renderId && afterEditGet.settings.subtitleStyle === 'bold', 'Edit GET survives reload');
  const afterCaptionGet = await request(`${prefix}/tasks/${taskId}/captions`);
  check(afterCaptionGet.renderId === first.renderId && afterCaptionGet.lines.length > 0, 'Caption GET survives reload');
  await request(`${prefix}/tasks/${taskId}/edit`, { method: 'PATCH', revision: beforeEditRevision,
    body: { edits: { overlay: { cta: 'Stale' } } }, status: 409, error: 'revision_conflict' });
  const second = await request(`${prefix}/tasks/${taskId}/edit`, { method: 'PATCH', revision: first.revision,
    body: { edits: { overlay: { cta: 'Second version' } } } });
  summary.renderVersions++;
  const finalTask = await taskRead();
  check(second.renderId !== first.renderId && finalTask.videoHistory.some(video => video.renderId === first.renderId) &&
    finalTask.videoHistory.some(video => video.renderId === sourceRenderId), 'Second render preserves both prior versions');
  check((await fs.stat(firstFile)).size > 1_000, 'Prior edited MP4 remains on disk');
  if (browserRequested) {
    currentCheck = 'browser fixture';
    summary.browser = await runBrowserFixture();
    check(summary.browser.result === 'PASS', 'Integrated browser helper passed');
    const browserTask = await taskRead();
    check(browserTask.video.renderId !== second.renderId &&
      browserTask.videoHistory.some(video => video.renderId === second.renderId),
    'Browser edit saved a new render and retained HTTP fixture history');
    summary.renderVersions++;
  }
} catch (error) {
  failure = `${currentCheck}: ${safeError(error)}`;
  console.error(`FAIL post-edit HTTP acceptance: ${failure}`);
} finally {
  try {
    const scope = { siteId, customerId: { in: owners.map(owner => owner.id) } };
    summary.creditLedger = await db.creditLedger.count({ where: scope });
    summary.generationJobs = await db.generationJob.count({ where: scope });
    check(summary.creditLedger === 0 && summary.generationJobs === 0, 'No credit or generation records for fixture owners');
    const assets = await db.assetUpload.findMany({ where: scope, select: { id: true, storageKey: true } });
    const taskIds = [taskId, ...batchTaskIds].filter(Boolean);
    if (taskIds.length) await db.$executeRaw`DELETE FROM "AidreamcapesVideoTask" WHERE "id" = ANY(${taskIds}::text[])
      AND "siteId" = ${siteId} AND "customerId" = ${owners[0].id}`;
    await db.assetUpload.deleteMany({ where: { ...scope, id: assetId ? { in: [assetId] } : { in: [] } } });
    await db.customerSession.deleteMany({ where: { ...scope, id: { in: owners.map(owner => owner.sessionId) } } });
    await db.customer.deleteMany({ where: { siteId, id: { in: owners.map(owner => owner.id) },
      email: { endsWith: '@example.invalid' }, name: 'SYNTHETIC post-edit HTTP acceptance' } });
    for (const asset of assets) {
      assert(asset.id === assetId, 'Cleanup found an unexpected synthetic asset');
      check(asset.storageKey.startsWith(`sites/${siteId}/customers/${owners[0].id}/assets/`) && !asset.storageKey.includes('..'),
        'Asset cleanup path belongs to fixture owner');
      const file = path.resolve(storageRoot, asset.storageKey);
      assert(file.startsWith(`${storageRoot}${path.sep}`));
      await fs.rm(file, { force: true });
    }
    for (const owner of owners) {
      await fs.rm(path.join(storageRoot, 'sites', siteId, 'customers', owner.id), { recursive: true, force: true });
      if (taskId) await fs.rm(path.join(renderRoot, siteId, owner.id, taskId), { recursive: true, force: true });
    }
    const remaining = await db.$queryRaw`SELECT count(*) AS count FROM "AidreamcapesVideoTask"
      WHERE "id" = ANY(${taskIds}::text[]) AND "siteId" = ${siteId} AND "customerId" = ${owners[0].id}`;
    check(Number(remaining[0].count) === 0 && await db.assetUpload.count({ where: scope }) === 0 &&
      await db.customerSession.count({ where: scope }) === 0 && await db.customer.count({ where: { siteId,
        id: { in: owners.map(owner => owner.id) } } }) === 0, 'Exact synthetic database cleanup verified');
    summary.cleanup = true;
  } catch (error) {
    failure ||= 'Scoped cleanup failed';
    console.error(`FAIL cleanup: ${safeError(error)}`);
  }
  await fs.rm(temp, { recursive: true, force: true });
  await db.$disconnect();
}
console.log(JSON.stringify({ result: failure ? 'FAIL' : 'PASS', ...summary }));
if (failure) process.exitCode = 1;
