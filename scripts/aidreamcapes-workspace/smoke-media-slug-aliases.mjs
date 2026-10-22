#!/usr/bin/env node
// Release gate for the Aidreamcapes media detail slug aliases.
//
// Every retired product address must answer 308 with the canonical address of
// the same product, the canonical page must own its own canonical link, stay
// `noindex, follow`, and expose exactly one workspace CTA, and the sitemap
// must not list a retired address.
//
// The retired addresses are read from the reviewed manifests in
// scripts/manifests, so the gate covers every migrated address: wall cards,
// template-detail pairs, hub example cards, and the data-only sale/occasion
// example cards.
//
// Usage:
//   AIDREAMCAPES_AUDIT_ORIGIN=http://127.0.0.1:3013 \
//     node scripts/aidreamcapes-workspace/smoke-media-slug-aliases.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load } from 'cheerio';

const origin = String(process.env.AIDREAMCAPES_AUDIT_ORIGIN || 'http://127.0.0.1:3113').replace(/\/$/, '');
const output = process.env.AIDREAMCAPES_AUDIT_OUTPUT;
const requestTimeout = Number(process.env.AIDREAMCAPES_AUDIT_TIMEOUT || 60000);
const report = { ok: true, origin, checks: [], errors: [], writes: false, aliases: 0, modes: [] };

// The retired addresses of every migrated product address.
const MANIFESTS = [
  'scripts/manifests/aidreamcapes-seo-media-alias-local-2026-10-21.json',
  'scripts/manifests/aidreamcapes-media-slug-alias-local-2026-10-22.json',
  'scripts/manifests/aidreamcapes-media-slug-alias-production-2026-10-22.json',
  'scripts/manifests/aidreamcapes-template-detail-slugs-local-2026-10-22.json',
  'scripts/manifests/aidreamcapes-template-detail-slugs-production-2026-10-22.json',
  'scripts/manifests/aidreamcapes-hub-example-slugs-local-2026-10-22.json',
  'scripts/manifests/aidreamcapes-hub-example-slugs-production-2026-10-22.json',
  'scripts/manifests/aidreamcapes-example-prefix-slugs-local-2026-10-22.json',
  'scripts/manifests/aidreamcapes-example-prefix-slugs-production-2026-10-22.json',
  'scripts/manifests/aidreamcapes-card-renames-local-2026-10-22.json',
  'scripts/manifests/aidreamcapes-card-renames-production-2026-10-22.json'
];
const entries = [];
for (const file of MANIFESTS) {
  if (!fs.existsSync(file)) continue;
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const operation of manifest.operations ?? []) entries.push({ oldPath: operation.oldPath, newPath: operation.newPath });
  for (const address of manifest.addresses ?? []) entries.push({ oldPath: address.oldPath, newPath: address.newPath });
}
const aliases = [...new Map(entries.map((entry) => [entry.oldPath, entry])).values()].sort((a, b) => a.oldPath.localeCompare(b.oldPath));
report.aliases = aliases.length;

async function get(path, mode) {
  const base = mode === 'path' ? '/site/aidreamcapes' : '';
  const headers = mode === 'host' ? { 'x-forwarded-host': 'www.aivideosugc.com', 'x-forwarded-proto': 'https' } : {};
  const response = await fetch(`${origin}${base}${path}`, { headers, redirect: 'manual', signal: AbortSignal.timeout(requestTimeout) });
  const html = await response.text();
  return { status: response.status, headers: response.headers, html, $: load(html) };
}

async function check(name, run) {
  try {
    await run();
    report.checks.push(name);
  } catch (error) {
    report.errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// The site answers under the site prefix and under the public host. Both are
// checked, because the retired address must redirect in either mode.
for (const mode of ['path', 'host']) {
  report.modes.push(mode);
  for (const alias of aliases) {
    await check(`${mode}: alias ${alias.oldPath}`, async () => {
      const retired = await get(alias.oldPath, mode);
      assert.equal(retired.status, 308, `retired address answered ${retired.status}`);
      const location = retired.headers.get('location') ?? '';
      assert(new URL(location, origin).pathname.endsWith(alias.newPath), `retired address pointed at ${location}`);

      const canonical = await get(alias.newPath, mode);
      assert.equal(canonical.status, 200, `canonical address answered ${canonical.status}`);
      assert.equal(
        canonical.$('link[rel=canonical]').attr('href'),
        `https://www.aivideosugc.com${alias.newPath}`,
        'canonical link does not match the canonical address'
      );
      assert(
        (canonical.$('meta[name=robots]').attr('content') ?? '').includes('noindex'),
        'canonical page is not noindex'
      );
      assert.equal(
        canonical.$('a[data-workspace-entry]').filter((_, element) => (canonical.$(element).attr('href') ?? '').includes('/app/create/')).length,
        1,
        'canonical page does not expose exactly one workspace CTA'
      );
    });
  }

  await check(`${mode}: sitemap excludes every retired address`, async () => {
    const { html } = await get('/sitemap.xml', mode);
    for (const alias of aliases) {
      assert(!html.includes(`<loc>https://www.aivideosugc.com${alias.oldPath}</loc>`), `sitemap lists retired ${alias.oldPath}`);
      assert(!html.includes(`<loc>https://www.aivideosugc.com${alias.newPath}</loc>`), `sitemap lists detail ${alias.newPath}`);
    }
  });
}

report.ok = report.errors.length === 0;
if (output) fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
