import '../load-runtime-env.mjs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { assertDatabaseTarget } from '../lib/database-target.mjs';
const first = new PrismaClient();
const second = new PrismaClient();
const taskId = `workspace-validation-${randomUUID()}`;
let validatedCustomerId;
let wrongCustomerId;
try {
  if (process.argv.includes('--isolated-acceptance')) {
    const target = assertDatabaseTarget({ expectedTarget: 'test' });
    assert.deepEqual(
      { host: target.host, port: target.port, database: target.database },
      { host: '127.0.0.1', port: 55439, database: 'aidreamcapes_acceptance' },
      'The isolated acceptance mode only permits its dedicated loopback test database.'
    );
  } else {
    assertDatabaseTarget({ expectedTarget: 'local' });
  }
  const customer = await first.customer.findFirst({ where: { siteId: 'site_aidreamcapes' }, select: { id: true } });
  assert(customer, 'AIVideosUGC needs an existing local customer for validation; no account will be created.');
  validatedCustomerId = customer.id;
  wrongCustomerId = `workspace-validation-other-${randomUUID()}`;
  await first.$executeRaw`INSERT INTO "Customer" ("id", "siteId") VALUES (${wrongCustomerId}, 'site_aidreamcapes')`;
  const data = { taskId, siteId: 'site_aidreamcapes', customerId: customer.id, revision: 1, status: 'draft', operation: { id: 'recovery-example', state: 'pending', action: 'storyboard' } };
  await first.$executeRaw`INSERT INTO "AidreamcapesVideoTask" ("id", "siteId", "customerId", "data") VALUES (${taskId}, 'site_aidreamcapes', ${customer.id}, ${JSON.stringify(data)}::jsonb)`;
  const results = await Promise.all([
    first.$executeRaw`UPDATE "AidreamcapesVideoTask" SET "data" = jsonb_set("data", '{revision}', to_jsonb("revision" + 1), TRUE), "revision" = "revision" + 1 WHERE "id" = ${taskId} AND "siteId" = 'site_aidreamcapes' AND "customerId" = ${customer.id} AND "revision" = 1`,
    second.$executeRaw`UPDATE "AidreamcapesVideoTask" SET "data" = jsonb_set("data", '{revision}', to_jsonb("revision" + 1), TRUE), "revision" = "revision" + 1 WHERE "id" = ${taskId} AND "siteId" = 'site_aidreamcapes' AND "customerId" = ${customer.id} AND "revision" = 1`
  ]);
  assert.equal(results.reduce((a, b) => a + b, 0), 1, 'Only one concurrent optimistic writer can win.');
  const readback = await second.$queryRaw`SELECT "data", "revision" FROM "AidreamcapesVideoTask" WHERE "id" = ${taskId} AND "siteId" = 'site_aidreamcapes' AND "customerId" = ${customer.id}`;
  assert.equal(readback[0].revision, 2);
  assert.equal(readback[0].data.operation.id, 'recovery-example', 'Queued operations survive an independent database connection.');
  const wrongOwner = await second.$queryRaw`SELECT "id" FROM "AidreamcapesVideoTask" WHERE "id" = ${taskId} AND "siteId" = 'site_aidreamcapes' AND "customerId" = ${wrongCustomerId}`;
  assert.equal(wrongOwner.length, 0);
  const wrongOwnerUpdate = await second.$executeRaw`UPDATE "AidreamcapesVideoTask" SET "data" = jsonb_set("data", '{customerId}', to_jsonb(${wrongCustomerId}::text)) WHERE "id" = ${taskId} AND "siteId" = 'site_aidreamcapes' AND "customerId" = ${wrongCustomerId}`;
  assert.equal(wrongOwnerUpdate, 0, 'A different Aidreamcapes customer cannot mutate the task row.');
  await assert.rejects(first.$executeRaw`UPDATE "AidreamcapesVideoTask" SET "siteId" = 'site_dreamshoot' WHERE "id" = ${taskId} AND "siteId" = 'site_aidreamcapes' AND "customerId" = ${customer.id}`);
  const otherCustomer = await first.customer.findFirst({ where: { siteId: 'site_dreamshoot' }, select: { id: true } });
  if (otherCustomer) await assert.rejects(first.$executeRaw`UPDATE "AidreamcapesVideoTask" SET "customerId" = ${otherCustomer.id}, "data" = jsonb_set("data", '{customerId}', to_jsonb(${otherCustomer.id}::text)) WHERE "id" = ${taskId} AND "siteId" = 'site_aidreamcapes' AND "customerId" = ${customer.id}`);
  console.log('PASS: tenant constraints, ownership reads, concurrent revision guards and persisted recovery.');
} finally {
  if (validatedCustomerId) await first.$executeRaw`DELETE FROM "AidreamcapesVideoTask" WHERE "id" = ${taskId} AND "siteId" = 'site_aidreamcapes' AND "customerId" = ${validatedCustomerId}`;
  if (wrongCustomerId) await first.$executeRaw`DELETE FROM "Customer" WHERE "id" = ${wrongCustomerId} AND "siteId" = 'site_aidreamcapes'`;
  await Promise.all([first.$disconnect(), second.$disconnect()]);
}
