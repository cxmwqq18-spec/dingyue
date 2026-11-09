import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { assertDatabaseTarget } from '../lib/database-target.mjs';
import { loadCloneAcceptanceEnv } from './clone-http-fixture.mjs';

await loadCloneAcceptanceEnv();
assertDatabaseTarget({ expectedTarget: 'local' });
assert(!process.env.CUSTOMER_ASSET_WRITE_BASE_URL && !process.env.CUSTOMER_ASSET_SHARED_BASE_URL, 'Remote customer storage is forbidden.');

const origin = 'http://localhost:3002';
const siteId = 'site_aidreamcapes';
const apiBase = `/api/sites/${siteId}/aivideosugc`;
const cloneBase = `${apiBase}/clones`;
const customerId = `synthetic-twin-clone-browser-${randomUUID()}`;
const sessionId = randomBytes(32).toString('hex');
const nonce = randomBytes(24).toString('base64url');
const csrfSecret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'dev-csrf-secret-change-me';
const csrfToken = `${nonce}.${createHmac('sha256', csrfSecret).update(`customer:${siteId}:${sessionId}:${nonce}`).digest('base64url')}`;
const cookie = `customer_session_${siteId}=${sessionId}; customer_csrf_${siteId}=${csrfToken}`;
const db = new PrismaClient({ errorFormat: 'minimal', log: [] });
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'synthetic-twin-clone-browser-'));
const artifacts = await fs.mkdtemp(path.join(os.tmpdir(), 'aidreamcapes-twin-clone-browser-evidence-'));
const storageRoot = path.resolve(process.env.CUSTOMER_ASSET_STORAGE_ROOT || 'data/customer-assets');
const execute = promisify(execFile);
const expectedIdentity = { id: customerId, email: `${customerId}@example.invalid`, name: 'SYNTHETIC Twin and Ad Clone browser fixture' };
const chromium = '/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
let customerCreated = false;
let browserChild;
let interrupted = false;
let failure = '';
let browserResult = {};
const evidence = { result: 'FAIL', siteId, customerId, artifacts, cleanup: false };

process.on('SIGINT', () => {
  interrupted = true;
  browserChild?.kill('SIGTERM');
});

async function fixtureRequest(route, { body, form, revision, expectedStatus = 200 } = {}) {
  const method = body || form || revision ? 'POST' : 'GET';
  const allowed = method === 'POST' && [
    `${cloneBase}/assets`, `${apiBase}/actors`, `${cloneBase}/consents`,
    `${cloneBase}/voice-twins/queue`, `${cloneBase}/ad-references/queue`,
    `/api/sites/${siteId}/customers/${customerId}/assets`,
  ].includes(route) || method === 'POST' && new RegExp(`^${cloneBase}/jobs/[a-zA-Z0-9_-]+/(run-mock|bind-actor)$`).test(route);
  assert(allowed, `Fixture HTTP route is outside the clone-fixture allowlist: ${method} ${route}`);
  const response = await fetch(`${origin}${route}`, {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(60_000),
    headers: {
      cookie,
      'x-csrf-token': csrfToken,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(revision ? { 'if-match': String(revision) } : {}),
    },
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const value = await response.json().catch(() => ({}));
  assert.equal(response.status, expectedStatus, `${route}: expected ${expectedStatus}, received ${response.status} (${value.error || 'no error code'})`);
  return value;
}

async function uploadCloneAsset(filename, mimeType, workflow) {
  const form = new FormData();
  form.set('file', new Blob([await fs.readFile(path.join(temp, filename))], { type: mimeType }), filename);
  form.set('workflow', workflow);
  return (await fixtureRequest(`${cloneBase}/assets`, { form, expectedStatus: 201 })).asset;
}

async function verifyOwnedFixture(actorId, jobIds) {
  const owners = await db.$queryRaw`SELECT "siteId", "customerId" FROM "AidreamcapesWorkspaceActor" WHERE "id" = ${actorId}`;
  assert.equal(owners.length, 1);
  assert.equal(owners[0].siteId, siteId);
  assert.equal(owners[0].customerId, customerId);
  const jobs = await db.$queryRaw`SELECT "id", "siteId", "customerId", "workflow", "status", "actorId" FROM "AidreamcapesCloneJob" WHERE "siteId" = ${siteId} AND "customerId" = ${customerId} ORDER BY "id"`;
  assert.deepEqual(jobs.map(job => job.id).sort(), [...jobIds].sort());
  assert(jobs.every(job => job.siteId === siteId && job.customerId === customerId));
  const voiceJob = jobs.find(job => job.workflow === 'voice_twin');
  const adJob = jobs.find(job => job.workflow === 'ad_reference');
  assert(voiceJob && adJob, 'Both a Twin simulation and an Ad Clone reference job must exist.');
  assert.equal(voiceJob.status, 'mock_complete');
  assert.equal(voiceJob.actorId, actorId);
  assert.equal(adJob.status, 'mock_complete');
}

const browserScript = String.raw`
import json, os, re, sys
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

fixture=json.load(sys.stdin)
errors=[]; five_xx=[]; blocked=[]; external_fonts=[]; failed=[]; actor_lists=[]; job_lists=[]; screenshots=[]; checks=0
origin=fixture['origin']

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path=fixture['chromium'])
    context=browser.new_context(viewport={'width':1440,'height':1000}, device_scale_factor=1)
    context.add_cookies([
      {'name':'customer_session_site_aidreamcapes','value':fixture['sessionId'],'url':origin,'httpOnly':True,'sameSite':'Lax'},
      {'name':'customer_csrf_site_aidreamcapes','value':fixture['csrfToken'],'url':origin,'sameSite':'Lax'},
    ])

    def guard(route):
        req=route.request
        if req.url.startswith('https://fonts.googleapis.com/'):
            external_fonts.append(req.url.split('?')[0])
            route.fulfill(status=200, content_type='text/css', body='/* External fonts disabled during local acceptance. */')
            return
        if not req.url.startswith(origin + '/') or req.method != 'GET':
            blocked.append({'method':req.method, 'url':req.url.split('?')[0]})
            route.abort()
            return
        route.continue_()

    context.route('**/*', guard)
    page=context.new_page()
    page.on('pageerror', lambda error: errors.append({'message':str(error), 'stack':error.stack}))
    page.on('requestfailed', lambda request: failed.append({'url':request.url.split('?')[0], 'failure':request.failure}))
    def capture(response):
        if response.status >= 500:
            five_xx.append({'url':response.url.split('?')[0], 'status':response.status})
        parsed=urlsplit(response.url)
        if parsed.path == fixture['apiBase'] + '/actors' and response.status == 200:
            try:
                actors=response.json().get('actors', [])
                custom=[actor for actor in actors if actor.get('actorId','').startswith('custom-')]
                actor_ids=sorted(actor.get('actorId') for actor in custom)
                assert actor_ids == [fixture['actorId']], 'Custom actor response must contain only the signed-in owner’s synthetic presenter.'
                assert custom[0].get('name') == fixture['actorName']
                actor_lists.append(actor_ids)
            except Exception as error:
                errors.append({'message':'Actor response validation: '+str(error)})
        if parsed.path == fixture['cloneBase'] + '/jobs' and response.status == 200:
            try:
                jobs=response.json().get('jobs', [])
                for job in jobs:
                    assert job.get('siteId') == fixture['siteId'] and job.get('customerId') == fixture['customerId'], 'Clone job response owner mismatch.'
                ids=sorted(job.get('id') for job in jobs if job.get('status') != 'deleted')
                assert ids == sorted(fixture['jobIds']), 'Clone jobs response must contain only this owner’s synthetic jobs.'
                job_lists.append(ids)
            except Exception as error:
                errors.append({'message':'Clone job response validation: '+str(error)})
    page.on('response', capture)

    try:
        for width, label in [(1440,'desktop'), (390,'mobile')]:
            page.set_viewport_size({'width':width, 'height':1000 if width == 1440 else 844})
            for view in ['twin','clone']:
                url=origin + '/site/aidreamcapes/app/create/' + view
                page.goto(url, wait_until='networkidle', timeout=120000)
                if view == 'twin':
                    workbench=page.locator('section[aria-label="AI Twin workbench"]')
                    workbench.wait_for(state='visible', timeout=60000)
                    page.get_by_role('heading', name='My saved requests', exact=True).wait_for()
                    page.get_by_role('heading', name=fixture['actorName'], exact=True).wait_for()
                    profile=page.locator('section[aria-label="Personal presenters"]')
                    profile.get_by_text(fixture['actorName'], exact=True).wait_for()
                    request_card=page.locator('article').filter(has_text=fixture['actorName']).first
                    request_card.get_by_text('Simulation only. No cloned voice or video output is available.', exact=True).wait_for()
                    assert fixture['voiceJobId'] in [job['id'] for job in fixture['jobs'] if job['workflow']=='voice_twin']
                    checks += 5
                else:
                    page.get_by_role('heading', name='Saved analyses', exact=True).wait_for(state='visible', timeout=60000)
                    page.locator('h1').filter(has_text='Start with a structure.').wait_for()
                    saved=page.get_by_role('button').filter(has_text=fixture['videoLabel']).first
                    saved.wait_for(state='visible', timeout=30000)
                    saved.get_by_text('Simulation complete', exact=True).wait_for()
                    checks += 3

                page.reload(wait_until='networkidle', timeout=120000)
                if view == 'twin':
                    page.locator('section[aria-label="AI Twin workbench"]').wait_for(state='visible', timeout=60000)
                    page.get_by_role('heading', name=fixture['actorName'], exact=True).wait_for(timeout=30000)
                    page.locator('section[aria-label="Personal presenters"]').get_by_text(fixture['actorName'], exact=True).wait_for()
                    page.locator('article').filter(has_text=fixture['actorName']).first.get_by_text('Simulation only. No cloned voice or video output is available.', exact=True).wait_for()
                else:
                    page.get_by_role('heading', name='Saved analyses', exact=True).wait_for(state='visible', timeout=60000)
                    saved=page.get_by_role('button').filter(has_text=fixture['videoLabel']).first
                    saved.wait_for(state='visible', timeout=30000)
                    saved.get_by_text('Simulation complete', exact=True).wait_for()
                checks += 2
                dimensions=page.evaluate('({scroll:document.documentElement.scrollWidth, client:document.documentElement.clientWidth})')
                assert dimensions['scroll'] <= dimensions['client'] + 1, f'{view}/{label} has horizontal overflow: {dimensions}'
                checks += 1
                image=os.path.join(fixture['artifacts'], f'{view}-{label}.png')
                page.screenshot(path=image, full_page=True)
                screenshots.append(image)

        assert len(actor_lists) >= 4, f'Expected actor list reloads at desktop and mobile, got {len(actor_lists)}.'
        assert len(job_lists) >= 8, f'Expected job list reloads from both views and both widths, got {len(job_lists)}.'
        assert not errors, 'Page errors or response ownership errors: ' + json.dumps(errors)
        assert not five_xx, 'HTTP 5xx responses: ' + json.dumps(five_xx)
        assert not blocked, 'Unexpected external or mutating browser requests: ' + json.dumps(blocked)
        checks += 5
        print(json.dumps({'result':'PASS','checks':checks,'pageErrors':len(errors),'http5xx':len(five_xx),'unexpectedRequests':len(blocked),'externalFontsStubbed':len(external_fonts),'actorListReloads':len(actor_lists),'jobListReloads':len(job_lists),'ownedActorReloaded':fixture['actorId'],'ownedJobsReloaded':fixture['jobIds'],'screenshots':screenshots}))
    except Exception as error:
        try:
            page.screenshot(path=os.path.join(fixture['artifacts'], 'failure.png'), full_page=True)
            screenshots.append(os.path.join(fixture['artifacts'], 'failure.png'))
        except Exception:
            pass
        print(json.dumps({'result':'FAIL','error':str(error),'pageErrors':errors,'http5xx':five_xx,'unexpectedRequests':blocked,'failedRequests':failed,'screenshots':screenshots}))
        sys.exitcode=1
    finally:
        browser.close()

if getattr(sys,'exitcode',0):
    sys.exit(1)
`;

try {
  const customer = await db.customer.create({ data: { ...expectedIdentity, siteId, passwordHash: null, status: 'active' } });
  customerCreated = true;
  await db.customerSession.create({ data: { id: sessionId, siteId, customerId, expiresAt: new Date(Date.now() + 30 * 60_000) } });
  await execute('ffmpeg', ['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=2','-ac','1','-ar','16000',path.join(temp,'twin-reference.wav')]);
  await execute('ffmpeg', ['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=160x160:r=10:d=2','-an','-c:v','libx264','-pix_fmt','yuv420p',path.join(temp,'ad-reference.mp4')]);
  await execute('ffmpeg', ['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=green:s=128x128','-frames:v','1',path.join(temp,'twin-portrait.png')]);

  const voiceAsset = await uploadCloneAsset('twin-reference.wav', 'audio/wav', 'voice_twin');
  const adAsset = await uploadCloneAsset('ad-reference.mp4', 'video/mp4', 'ad_reference');
  const imageForm = new FormData();
  imageForm.set('file', new Blob([await fs.readFile(path.join(temp,'twin-portrait.png'))], { type: 'image/png' }), 'twin-portrait.png');
  imageForm.set('label', 'SYNTHETIC presenter portrait');
  const portrait = (await fixtureRequest(`/api/sites/${siteId}/customers/${customerId}/assets`, { form: imageForm })).asset;
  const actorName = 'SYNTHETIC local browser presenter';
  const actor = (await fixtureRequest(`${apiBase}/actors`, {
    body: { name: actorName, gender: 'female', ageRange: '25-30', languages: ['en'], imageUrl: portrait.previewUrl, refAudio: voiceAsset.previewUrl },
    expectedStatus: 201,
  })).actor;

  const fixtureJobs = [];
  for (const [workflow, sourceAsset, queuePath] of [
    ['voice_twin', voiceAsset, `${cloneBase}/voice-twins/queue`],
    ['ad_reference', adAsset, `${cloneBase}/ad-references/queue`],
  ]) {
    const consent = (await fixtureRequest(`${cloneBase}/consents`, {
      body: { workflow, scope: workflow, rightsConfirmed: true, ...(workflow === 'voice_twin' ? { actorId: actor.actorId } : { sourceAssetId: sourceAsset.id }) },
      expectedStatus: 201,
    })).consent;
    const queued = (await fixtureRequest(queuePath, {
      body: { consentId: consent.id, consentRevision: consent.revision, idempotencyKey: randomUUID() },
      expectedStatus: 202,
    })).job;
    const ready = (await fixtureRequest(`${cloneBase}/jobs/${queued.id}/run-mock`, { revision: queued.revision })).job;
    fixtureJobs.push({ workflow, id: ready.id });
    if (workflow === 'voice_twin') {
      await fixtureRequest(`${cloneBase}/jobs/${ready.id}/bind-actor`, { revision: ready.revision, body: { mockMode: true, actorId: actor.actorId } });
    }
  }

  await verifyOwnedFixture(actor.actorId, fixtureJobs.map(job => job.id));
  const ownedCustomer = await db.$queryRaw`SELECT "id", "email", "name" FROM "Customer" WHERE "id" = ${customerId} AND "siteId" = ${siteId}`;
  assert.equal(ownedCustomer.length, 1);
  assert.equal(ownedCustomer[0].email, expectedIdentity.email);
  assert.equal(ownedCustomer[0].name, expectedIdentity.name);

  const voiceJobId = fixtureJobs.find(job => job.workflow === 'voice_twin').id;
  const payload = {
    origin, siteId, apiBase, cloneBase, sessionId, csrfToken, customerId,
    actorId: actor.actorId, actorName, voiceJobId,
    jobs: fixtureJobs.map(job => ({ ...job, siteId, customerId })),
    jobIds: fixtureJobs.map(job => job.id), videoLabel: adAsset.label,
    artifacts, chromium,
  };
  browserResult = await new Promise((resolve, reject) => {
    browserChild = spawn('/tmp/aidreamcapes-dom-browser-venv/bin/python', ['-c', browserScript], { stdio: ['pipe','pipe','pipe'] });
    let stdout = '', stderr = '';
    browserChild.stdout.on('data', chunk => { stdout += chunk; });
    browserChild.stderr.on('data', chunk => { stderr += chunk; });
    browserChild.on('error', reject);
    browserChild.on('close', code => {
      try {
        const parsed = JSON.parse(stdout.trim().split('\n').at(-1));
        if (code !== 0) parsed.exitCode = code;
        resolve(parsed);
      } catch {
        reject(new Error(`Browser runner failed (${code}); diagnostic bytes=${stderr.length}`));
      }
    });
    browserChild.stdin.end(JSON.stringify(payload));
  });
  if (interrupted) throw new Error('Acceptance run was interrupted.');
  if (browserResult.result !== 'PASS') throw new Error(browserResult.error || 'Browser acceptance failed.');
} catch (error) {
  failure = error instanceof Error ? error.message : 'Integrated browser acceptance failed.';
} finally {
  try {
    if (customerCreated) {
      const current = await db.$queryRaw`SELECT "id", "email", "name" FROM "Customer" WHERE "id" = ${customerId} AND "siteId" = ${siteId}`;
      assert.equal(current.length, 1, 'Synthetic customer owner must still match the exact scoped fixture.');
      assert.equal(current[0].email, expectedIdentity.email);
      assert.equal(current[0].name, expectedIdentity.name);
      const ledgers = await db.$queryRaw`SELECT count(*)::int AS n FROM "CreditLedger" WHERE "siteId" = ${siteId} AND "customerId" = ${customerId}`;
      const generations = await db.$queryRaw`SELECT count(*)::int AS n FROM "GenerationJob" WHERE "siteId" = ${siteId} AND "customerId" = ${customerId}`;
      assert.equal(ledgers[0].n, 0, 'No credits may be charged by the acceptance run.');
      assert.equal(generations[0].n, 0, 'No generation jobs may be created by the acceptance run.');
      await db.$executeRaw`DELETE FROM "AidreamcapesCloneJob" WHERE "siteId" = ${siteId} AND "customerId" = ${customerId}`;
      await db.$executeRaw`DELETE FROM "AidreamcapesCloneConsent" WHERE "siteId" = ${siteId} AND "customerId" = ${customerId}`;
      await db.$executeRaw`DELETE FROM "AidreamcapesVideoTask" WHERE "siteId" = ${siteId} AND "customerId" = ${customerId}`;
      await db.$executeRaw`DELETE FROM "AidreamcapesWorkspaceActor" WHERE "siteId" = ${siteId} AND "customerId" = ${customerId}`;
      await db.$executeRaw`DELETE FROM "AssetUpload" WHERE "siteId" = ${siteId} AND "customerId" = ${customerId}`;
      await db.$executeRaw`DELETE FROM "CustomerSession" WHERE "siteId" = ${siteId} AND "customerId" = ${customerId} AND "id" = ${sessionId}`;
      await db.$executeRaw`DELETE FROM "Customer" WHERE "siteId" = ${siteId} AND "id" = ${customerId} AND "email" = ${expectedIdentity.email} AND "name" = ${expectedIdentity.name}`;
      await fs.rm(path.join(storageRoot, 'sites', siteId, 'customers', customerId), { recursive: true, force: true });
      const remaining = await db.$queryRaw`SELECT
        (SELECT count(*) FROM "Customer" WHERE "siteId" = ${siteId} AND "id" = ${customerId}) +
        (SELECT count(*) FROM "CustomerSession" WHERE "siteId" = ${siteId} AND "customerId" = ${customerId}) +
        (SELECT count(*) FROM "AssetUpload" WHERE "siteId" = ${siteId} AND "customerId" = ${customerId}) +
        (SELECT count(*) FROM "AidreamcapesCloneJob" WHERE "siteId" = ${siteId} AND "customerId" = ${customerId}) +
        (SELECT count(*) FROM "AidreamcapesCloneConsent" WHERE "siteId" = ${siteId} AND "customerId" = ${customerId}) +
        (SELECT count(*) FROM "AidreamcapesWorkspaceActor" WHERE "siteId" = ${siteId} AND "customerId" = ${customerId}) AS n`;
      assert.equal(Number(remaining[0].n), 0, 'Exact synthetic owner cleanup must remove all scoped records.');
      evidence.cleanup = true;
      evidence.cleanupEvidence = { exactOwnerVerified: true, remainingOwnedRows: 0, creditLedgers: 0, generationJobs: 0, assetDirectoryRemoved: true };
    } else {
      evidence.cleanup = true;
      evidence.cleanupEvidence = { customerCreated: false, noCustomerRowsWritten: true };
    }
  } catch (error) {
    failure ||= `Scoped synthetic fixture cleanup failed: ${error instanceof Error ? error.message : 'unknown error'}`;
  }
  await fs.rm(temp, { recursive: true, force: true });
  await db.$disconnect();
}

evidence.result = failure ? 'FAIL' : 'PASS';
evidence.browser = browserResult;
if (failure) evidence.error = failure;
await fs.writeFile(path.join(artifacts, 'summary.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
if (failure) process.exitCode = 1;
