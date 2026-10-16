#!/usr/bin/env node
// Keep Cloudflare from rewriting the AIVideosUGC server-rendered email nodes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fetch, ProxyAgent } from 'undici';
import { loadRuntimeEnv } from './load-runtime-env.mjs';

loadRuntimeEnv();
const args = process.argv.slice(2);
const option = key => args.find(arg => arg.startsWith(key + '='))?.slice(key.length + 1);
const apply = args.includes('--apply');
const domain = 'aivideosugc.com';
assert(!apply || option('--confirm') === domain, 'Writes require --confirm=aivideosugc.com');
const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
assert(token, 'CLOUDFLARE_API_TOKEN is required');
const dispatcher = option('--proxy') ? new ProxyAgent(option('--proxy')) : undefined;

async function request(path, method = 'GET', value) {
  const response = await fetch('https://api.cloudflare.com/client/v4' + path, {
    method, dispatcher,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    ...(value ? { body: JSON.stringify(value) } : {})
  });
  const json = await response.json();
  assert(response.ok && json.success, 'Cloudflare request failed: ' + response.status + ' ' + JSON.stringify(json.errors));
  return json.result;
}

try {
  const zones = await request('/zones?name=' + domain);
  assert.equal(zones.length, 1, 'Require one exact, existing domain zone');
  const zone = zones[0];
  assert.equal(zone.name, domain);
  assert.equal(zone.status, 'active');
  const path = '/zones/' + zone.id + '/settings/email_obfuscation';
  const before = await request(path);
  assert.equal(before.id, 'email_obfuscation');
  assert(['on', 'off'].includes(before.value));
  if (apply && before.value !== 'off') {
    assert(before.editable, 'Setting must be editable');
    await request(path, 'PATCH', { value: 'off' });
  }
  const after = await request(path);
  if (apply) assert.equal(after.value, 'off');
  const report = { ok: true, mode: apply ? 'apply' : 'plan', siteId: 'site_aidreamcapes', domain, zoneId: zone.id, endpoint: path, before: before.value, desired: 'off', after: after.value, changed: before.value !== after.value, otherZonesModified: false };
  if (option('--report')) await fs.writeFile(option('--report'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await dispatcher?.close();
}
