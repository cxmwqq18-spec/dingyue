import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { assertDatabaseTarget } from '../lib/database-target.mjs';
import { loadCloneAcceptanceEnv } from './clone-http-fixture.mjs';

await loadCloneAcceptanceEnv();
assertDatabaseTarget({ expectedTarget: 'local' });
const origin = 'http://localhost:3002';
const siteId = 'site_aidreamcapes';
const prefix = `/api/sites/${siteId}/aivideosugc`;
const customerId = `synthetic-team-http-${randomUUID()}`;
const sessionId = randomBytes(32).toString('hex');
const nonce = randomBytes(24).toString('base64url');
const csrfSecret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'dev-csrf-secret-change-me';
const csrfToken = `${nonce}.${createHmac('sha256', csrfSecret).update(`customer:${siteId}:${sessionId}:${nonce}`).digest('base64url')}`;
const cookie = `customer_session_${siteId}=${sessionId}; customer_csrf_${siteId}=${csrfToken}`;
const db = new PrismaClient({ errorFormat: 'minimal', log: [] });
const scope = { siteId, customerId };
let failure;
let checks = 0;

async function request(method, path, { body, revision, status = 200 } = {}) {
  const mutations = method === 'POST' && (path === '/teams' || path === '/brands' || /^\/brands\/[A-Za-z0-9_-]+\/facts$/.test(path)) ||
    method === 'PATCH' && (/^\/teams\/[A-Za-z0-9_-]+$/.test(path) || /^\/brands\/[A-Za-z0-9_-]+\/facts\/[A-Za-z0-9_-]+$/.test(path));
  assert(method === 'GET' || mutations, `HTTP method/path is outside the explicit team/brand acceptance allowlist: ${method} ${path}`);
  const response = await fetch(`${origin}${prefix}${path}`, {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: {
      cookie,
      'x-csrf-token': csrfToken,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(revision !== undefined ? { 'if-match': String(revision) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json().catch(() => ({}));
  assert.equal(response.status, status, `${method} ${path}: HTTP ${response.status}, code=${typeof value.error === 'string' ? value.error : 'none'}`);
  checks += 1;
  return value;
}

try {
  await db.customer.create({ data: { id: customerId, siteId, email: `${customerId}@example.invalid`, passwordHash: null, name: 'SYNTHETIC team and brand fixture', status: 'active' } });
  await db.customerSession.create({ data: { id: sessionId, siteId, customerId, expiresAt: new Date(Date.now() + 900_000) } });

  assert.deepEqual((await request('GET', '/teams')).teams, []);
  const createdTeam = (await request('POST', '/teams', { body: { name: 'SYNTHETIC local team' }, status: 201 })).team;
  assert.equal(createdTeam.role, 'owner');
  assert.equal(createdTeam.ownerCustomerId, customerId);
  assert.equal((await request('GET', '/teams')).teams[0].id, createdTeam.id);
  const updatedTeam = (await request('PATCH', `/teams/${createdTeam.id}`, { revision: createdTeam.revision, body: { name: 'SYNTHETIC local team renamed', revision: createdTeam.revision } })).team;
  assert.equal(updatedTeam.name, 'SYNTHETIC local team renamed');
  checks += 3;

  const createdBrand = (await request('POST', '/brands', { body: {
    teamId: createdTeam.id,
    name: 'SYNTHETIC local brand',
    profile: { website: 'https://synthetic.example', description: 'Synthetic local workflow profile.' },
  }, status: 201 })).brand;
  assert.equal(createdBrand.teamId, createdTeam.id);
  assert.deepEqual((await request('GET', '/brands')).brands.map((brand) => brand.id), [createdBrand.id]);
  const factPath = `/brands/${createdBrand.id}/facts`;
  const createdFact = (await request('POST', factPath, { body: {
    factKey: 'materials', factValue: 'Synthetic cotton canvas', sourceUrl: 'https://synthetic.example/materials', sourceLabel: 'Synthetic materials page',
  }, status: 201 })).fact;
  assert.equal(createdFact.confirmed, false, 'New product information starts unconfirmed.');
  assert.equal(createdFact.sourceUrl, 'https://synthetic.example/materials');
  const factsBeforeConfirm = (await request('GET', factPath)).facts;
  assert.equal(factsBeforeConfirm[0].confirmed, false);
  const factPathWithId = `${factPath}/${createdFact.id}`;
  const confirmedFact = (await request('PATCH', factPathWithId, {
    revision: createdFact.revision,
    body: { revision: createdFact.revision, confirm: true },
  })).fact;
  assert.equal(confirmedFact.confirmed, true);
  assert.equal(confirmedFact.confirmedByCustomerId, customerId);
  const factsAfterReload = (await request('GET', factPath)).facts;
  assert.equal(factsAfterReload[0].confirmed, true);
  assert.equal(factsAfterReload[0].factValue, 'Synthetic cotton canvas');
  assert.equal(factsAfterReload[0].sourceUrl, 'https://synthetic.example/materials');
  checks += 8;
} catch (error) {
  failure = error instanceof Error ? error.message : 'Synthetic team and brand HTTP acceptance failed.';
} finally {
  try {
    const teams = await db.$queryRaw`SELECT "id" FROM "AidreamcapesTeam" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId}`;
    for (const { id: teamId } of teams) {
      await db.$executeRaw`DELETE FROM "AidreamcapesBrandFactVersion" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "brandProfileId" IN (SELECT "id" FROM "AidreamcapesBrandProfile" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "teamId"=${teamId})`;
      await db.$executeRaw`DELETE FROM "AidreamcapesBrandFact" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "brandProfileId" IN (SELECT "id" FROM "AidreamcapesBrandProfile" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "teamId"=${teamId})`;
      await db.$executeRaw`DELETE FROM "AidreamcapesBrandProfile" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "teamId"=${teamId}`;
      await db.$executeRaw`DELETE FROM "AidreamcapesTeamInvite" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "teamId"=${teamId}`;
      await db.$executeRaw`DELETE FROM "AidreamcapesTeamMember" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "teamId"=${teamId}`;
      await db.$executeRaw`DELETE FROM "AidreamcapesTeam" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId} AND "id"=${teamId}`;
    }
    await db.customerSession.deleteMany({ where: { ...scope, id: sessionId } });
    await db.customer.deleteMany({ where: { siteId, id: customerId, name: 'SYNTHETIC team and brand fixture', email: `${customerId}@example.invalid` } });
    const rows = await db.$queryRaw`SELECT (SELECT count(*) FROM "AidreamcapesTeam" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId})+(SELECT count(*) FROM "AidreamcapesTeamMember" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId})+(SELECT count(*) FROM "AidreamcapesTeamInvite" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId})+(SELECT count(*) FROM "AidreamcapesBrandProfile" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId})+(SELECT count(*) FROM "AidreamcapesBrandFact" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId})+(SELECT count(*) FROM "AidreamcapesBrandFactVersion" WHERE "siteId"=${siteId} AND "ownerCustomerId"=${customerId}) AS count`;
    assert.equal(Number(rows[0].count), 0, 'Only this fixture owner/site scope is checked after cleanup.');
    assert.equal(await db.customer.count({ where: { siteId, id: customerId } }), 0);
    assert.equal(await db.customerSession.count({ where: { ...scope, id: sessionId } }), 0);
    const creditLedger = await db.creditLedger.count({ where: scope });
    const generationJobs = await db.generationJob.count({ where: scope });
    assert.equal(creditLedger, 0);
    assert.equal(generationJobs, 0);
  } catch {
    failure ||= 'Exact synthetic team/brand fixture cleanup failed.';
  }
  await db.$disconnect();
}

if (failure) {
  console.error(`FAIL team and brand local HTTP acceptance: ${failure}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ result: 'PASS', checks, siteId, syntheticOwnerOnly: true, cleanup: true, creditLedger: 0, generationJobs: 0 }));
}
