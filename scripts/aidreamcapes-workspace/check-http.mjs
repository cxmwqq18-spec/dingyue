import '../load-runtime-env.mjs';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { assertDatabaseTarget } from '../lib/database-target.mjs';

assertDatabaseTarget({ expectedTarget: 'local' });
const origin = process.env.AIVIDEOSUGC_CHECK_ORIGIN || 'http://127.0.0.1:3032';
const target = new URL(origin);
assert(['localhost', '127.0.0.1'].includes(target.hostname), 'HTTP validation is local only.');
const siteId = 'site_aidreamcapes';
const prefix = `/api/sites/${siteId}/aivideosugc`;
const db = new PrismaClient({ errorFormat: 'minimal' });
const owners = [0, 1].map(() => ({ id: `ugc-check-${randomUUID()}`, sessionId: randomBytes(32).toString('hex') }));
const csrfSecret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'dev-csrf-secret-change-me';
const credentials = owners.map(owner => {
  const nonce = randomBytes(24).toString('base64url');
  const token = `${nonce}.${createHmac('sha256', csrfSecret).update(`customer:${siteId}:${owner.sessionId}:${nonce}`).digest('base64url')}`;
  return { token, cookie: `customer_session_${siteId}=${owner.sessionId}; customer_csrf_${siteId}=${token}` };
});
async function request(path, { method = 'GET', owner, body, revision, csrf = true, headers = {} } = {}) {
  const auth = owner === undefined ? {} : { cookie: credentials[owner].cookie, ...(csrf ? { 'x-csrf-token': credentials[owner].token } : {}) };
  const result = await fetch(`${origin}${path}`, { method, headers: { ...auth, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(revision ? { 'if-match': String(revision) } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: result.status, body: await result.json() };
}

try {
  for (const owner of owners) {
    await db.customer.create({ data: { id: owner.id, siteId, email: `${owner.id}@example.invalid`, name: 'Workspace validation', status: 'active' } });
    await db.customerSession.create({ data: { id: owner.sessionId, siteId, customerId: owner.id, expiresAt: new Date(Date.now() + 600_000) } });
  }
  assert.equal((await request('/api/sites/site_dreamshoot/aivideosugc/catalog')).status, 404, 'Catalog rejects another tenant.');
  assert.equal((await request(`${prefix}/tasks`)).status, 401, 'Tasks require authentication.');
  assert.equal((await request(`${prefix}/tasks`, { method: 'POST', owner: 0, csrf: false, body: { sceneId: 'process_demo' } })).status, 403, 'Writes require CSRF.');
  const catalog = await request(`${prefix}/catalog`);
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.catalog.scenes.length, 3);
  const form = new FormData();
  form.set('file', new Blob([await readFile('public/media/site_aidreamcapes/workspace/actors/actor_1.png')], { type: 'image/png' }), 'validation-actor.png');
  form.set('label', 'Validation actor');
  const uploadResponse = await fetch(`${origin}/api/sites/${siteId}/customers/${owners[0].id}/assets`, {
    method: 'POST', headers: { cookie: credentials[0].cookie, 'x-csrf-token': credentials[0].token }, body: form,
  });
  const upload = await uploadResponse.json();
  assert.equal(uploadResponse.status, 200, JSON.stringify(upload));
  const actorBody = { name: 'Validation actor', gender: 'female', ageRange: '25-30', imageUrl: upload.asset.previewUrl, timbre: 'warm', languages: ['en'] };
  const actorResult = await request(`${prefix}/actors`, { method: 'POST', owner: 0, body: actorBody });
  assert.equal(actorResult.status, 201, JSON.stringify(actorResult.body));
  const customActor = actorResult.body.actor;
  assert.equal((await request(`${prefix}/actors`, { method: 'POST', owner: 1, body: actorBody })).status, 403, 'Actor images belong to the creator account.');
  const otherActors = await request(`${prefix}/actors`, { owner: 1 });
  assert(!otherActors.body.actors.some(actor => actor.actorId === customActor.actorId), 'Custom actor catalog is private to its owner.');
  const voiceResult = await request(`${prefix}/actors`, { method: 'POST', owner: 0, body: { ...actorBody, timbre: 'free-text-voice' } });
  assert.equal(voiceResult.status, 400, 'Free text cannot bypass the voice pool.');
  const imageInput = { prompt: 'Show the supplied item on a plain white background.', assetUrls: [upload.asset.previewUrl], aspect: '1:1' };
  const imageQuote = await request(`${prefix}/images/quote`, { method: 'POST', owner: 0, body: imageInput });
  assert.equal(imageQuote.status, 200, JSON.stringify(imageQuote.body));
  if (imageQuote.body.quote?.available) {
    const token = imageQuote.body.quote.quoteToken;
    const forged = await request(`${prefix}/images`, { method: 'POST', owner: 0, body: { ...imageInput, quoteToken: `${token.slice(0, -1)}!` }, headers: { 'idempotency-key': randomUUID() } });
    assert.equal(forged.status, 403, 'A forged price token cannot create a paid job.');
    const replayed = await request(`${prefix}/images`, { method: 'POST', owner: 1, body: { ...imageInput, quoteToken: token }, headers: { 'idempotency-key': randomUUID() } });
    assert([403, 404].includes(replayed.status), 'Another account cannot use a quote or its references.');
  }
  const key = randomUUID();
  const created = await request(`${prefix}/tasks`, { method: 'POST', owner: 0, body: { sceneId: 'process_demo', title: 'HTTP validation' }, headers: { 'idempotency-key': key } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  let task = created.body.task;
  const replay = await request(`${prefix}/tasks`, { method: 'POST', owner: 0, body: { sceneId: 'process_demo', title: 'HTTP validation' }, headers: { 'idempotency-key': key } });
  assert.equal(replay.body.task.taskId, task.taskId, 'Duplicate create reuses the persisted task.');
  const path = `${prefix}/tasks/${task.taskId}`;
  assert.equal((await request(path, { owner: 1 })).status, 404, 'Other customers cannot read a task.');
  const updated = await request(path, { method: 'PATCH', owner: 0, revision: task.revision, body: { title: 'Saved through the API' } });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal((await request(path, { method: 'PATCH', owner: 0, revision: task.revision, body: { title: 'Stale edit' } })).status, 409, 'Stale revision cannot overwrite newer data.');
  task = updated.body.task;
  let productAsset;
  // Explicit opt-in calls the configured text model only; never dispatches paid video/image generation.
  if (process.env.AIVIDEOSUGC_LIVE_STORYBOARD_CHECK === '1') {
    const productForm = new FormData();
    productForm.set('file', new Blob([await readFile('public/media/site_aidreamcapes/workspace/references/product_1.png')], { type: 'image/png' }), 'validation-product.png');
    productForm.set('label', 'Validation product');
    const productUpload = await fetch(`${origin}/api/sites/${siteId}/customers/${owners[0].id}/assets`, { method: 'POST', headers: { cookie: credentials[0].cookie, 'x-csrf-token': credentials[0].token }, body: productForm });
    assert.equal(productUpload.status, 200);
    productAsset = (await productUpload.json()).asset;
    const prepared = await request(path, { method: 'PATCH', owner: 0, revision: task.revision, body: { input: { ...task.input, images: { productImages: [productAsset.previewUrl] }, fields: { steps: 'Place the product on a clean table.\nTurn the product so its front is visible.\nShow the surface of the product in close-up.' } } } });
    assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
    task = prepared.body.task;
    const queued = await request(`${path}/actions`, { method: 'POST', owner: 0, revision: task.revision, body: { action: 'storyboard' }, headers: { 'idempotency-key': randomUUID() } });
    assert.equal(queued.status, 202, JSON.stringify(queued.body));
    const deadline = Date.now() + 180_000;
    do {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const progress = await request(path, { owner: 0 });
      assert.equal(progress.status, 200, JSON.stringify(progress.body));
      task = progress.body.task;
    } while (['pending', 'run'].includes(task.operation?.state) && Date.now() < deadline);
    assert.equal(task.operation?.state, 'done', JSON.stringify({ state: task.operation?.state, error: task.error }));
    assert.equal(task.status, 'storyboard_ready');
    assert.equal(task.storyboard.shots.length, 3);
    assert(task.storyboard.shots.every(shot => shot.prompt && !shot.voiceover));
    console.log('PASS: live configured LLM storyboard/style generation and persisted async completion; no media generation dispatched.');
  }
  const invalid = await request(path, { method: 'PATCH', owner: 0, revision: task.revision, body: { input: { ...task.input, options: { ...task.input.options, duration: 999 } } } });
  assert.equal(invalid.status, 400, 'Unsupported duration is rejected.');
  const stolen = await request(path, { method: 'PATCH', owner: 0, revision: task.revision, body: { input: { ...task.input, images: { productImages: ['https://example.invalid/other-customer.png'] } } } });
  assert.equal(stolen.status, 403, 'Foreign media cannot become a task reference.');
  const restored = await request(path, { owner: 0 });
  assert.equal(restored.body.task.title, 'Saved through the API');
  assert.equal(restored.body.task.revision, task.revision, 'Rejected mutations preserve the revision.');
  const listed = await request(`${prefix}/tasks`, { owner: 1 });
  assert(!listed.body.tasks.some(candidate => candidate.taskId === task.taskId));
  assert.equal((await request(path, { method: 'DELETE', owner: 1, revision: task.revision })).status, 404);
  assert.equal((await request(path, { method: 'DELETE', owner: 0, revision: task.revision })).status, 200);
  assert.equal((await request(path, { owner: 0 })).status, 404);
  assert.equal((await request(`${prefix}/actors/${customActor.actorId}`, { method: 'DELETE', owner: 1 })).status, 404);
  assert.equal((await request(`${prefix}/actors/${customActor.actorId}`, { method: 'DELETE', owner: 0 })).status, 200);
  await request(`/api/sites/${siteId}/customers/${owners[0].id}/assets`, { method: 'DELETE', owner: 0, body: { assetIds: [upload.asset.id, ...(productAsset ? [productAsset.id] : [])] } });
  console.log('PASS: authentication, CSRF, store/customer isolation, media ownership, actor privacy and voice whitelist, creation idempotency, autosave and revision conflicts.');
} finally {
  for (const owner of owners) await db.customer.deleteMany({ where: { id: owner.id, siteId } });
  await db.$disconnect();
}
