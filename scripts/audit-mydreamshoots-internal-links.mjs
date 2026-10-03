import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { setTimeout as delay } from 'node:timers/promises';
import { linkGraph } from './lib/internal-link-graph.mjs';

const arg = (name, fallback) => process.argv.find((x) => x.startsWith(name + '='))?.slice(name.length + 1) ?? fallback;
const origin = arg('--origin', 'https://www.mydreamshoots.com').replace(/\/$/, '');
const publicHost = arg('--host', 'www.mydreamshoots.com');
const out = arg('--out', 'releases/internal-links/audit.json');
const strict = process.argv.includes('--strict');
const concurrency = Math.max(1, Math.min(8, Number(arg('--concurrency', '4')) || 4));
const privatePath = (p) => /^\/(app|account|album|login|register|signup|cart|checkout|auth|api|admin|platform|search|forgot-password|reset-password|logout)(\/|$)/.test(p);
function localLink(href, base) {
  try {
    const u = new URL(href, `https://${publicHost}${base}`);
    if (!['www.mydreamshoots.com', 'mydreamshoots.com', publicHost, new URL(origin).hostname].includes(u.hostname) || !/^https?:$/.test(u.protocol)) return;
    const p = u.pathname.replace(/\/$/, '') || '/';
    if (/^\/(assets|_next|uploads|fonts|images|favicon)(\/|\.|$)/.test(p) || /\.[a-z0-9]{2,5}$/i.test(p)) return;
    return { path: p, hash: u.hash, query: u.search };
  } catch { return; }
}
async function request(p) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await delay(attempt * 5000);
    try {
      const response = await fetch(origin + p, { headers: { Host: publicHost, 'x-forwarded-host': publicHost, accept: 'text/html,application/xml' }, redirect: 'manual', signal: AbortSignal.timeout(45000) });
      if (response.status >= 500 && attempt < 2) continue;
      return { response, html: await response.text() };
    } catch (e) { if (attempt === 2) throw e; }
  }
}
const sitemap = await request('/sitemap.xml');
if (sitemap.response.status !== 200) throw new Error(`sitemap returned ${sitemap.response.status}`);
const xml = cheerio.load(sitemap.html, { xmlMode: true });
const seeds = [...new Set(xml('url > loc').map((i, e) => new URL(xml(e).text()).pathname).get())];
if (!seeds.length) throw new Error('Empty sitemap inventory');
const queue = [...new Set(['/', ...seeds])], seen = new Set(queue), rows = [];
async function scan(p) {
  try {
    const { response, html } = await request(p);
    const $ = cheerio.load(html);
    const links = $('a[href]').map((i, e) => {
      const link = localLink($(e).attr('href'), p);
      if (!link) return null;
      return { ...link, anchor: $(e).text().trim().replace(/\s+/g, ' ') || $(e).find('img').attr('alt') || '', global: !!$(e).closest('header,footer').length, nofollow: /nofollow/i.test($(e).attr('rel') || '') };
    }).get().filter(Boolean);
    const canonicalPath = localLink($('link[rel="canonical"]').attr('href'), p)?.path;
    const row = { path: p, status: response.status, finalPath: p, canonicalPath, noindex: /noindex/i.test(($('meta[name="robots"]').attr('content') || '') + (response.headers.get('x-robots-tag') || '')), title: $('title').text(), ids: $('[id]').map((i, e) => $(e).attr('id')).get(), links, contextualLinks: $('[data-contextual-links] a[href]').length };
    if (response.status >= 300 && response.status < 400) row.redirectTo = localLink(response.headers.get('location'), p)?.path;
    rows.push(row);
    for (const link of links) if (!privatePath(link.path) && !seen.has(link.path)) { seen.add(link.path); queue.push(link.path); }
    if (seen.size > 350) throw new Error('Unexpected URL expansion beyond 350 pages');
  } catch (e) { rows.push({ path: p, status: 0, error: e.message, links: [], ids: [] }); }
}
while (queue.length) {
  await Promise.all(queue.splice(0, concurrency).map(scan));
  if (rows.length % 24 === 0) console.log(JSON.stringify({ crawled: rows.length, remaining: queue.length }));
}
const byPath = new Map(rows.map((r) => [r.path, r]));
const broken = [], redirects = [], fragments = [], invalidAnchors = [];
for (const row of rows) for (const link of row.links) {
  if (privatePath(link.path)) continue;
  const target = byPath.get(link.path);
  if (!target || target.status === 0 || target.status >= 400) broken.push({ from: row.path, to: link.path, status: target?.status, anchor: link.anchor });
  else if (target.redirectTo) redirects.push({ from: row.path, to: link.path, target: target.redirectTo });
  if (link.hash && target?.status === 200) {
    let id = link.hash.slice(1); try { id = decodeURIComponent(id); } catch { /* retain original */ }
    if (!target.ids.includes(id)) fragments.push({ from: row.path, to: link.path + link.hash, anchor: link.anchor });
  }
  if (!link.global && !link.anchor) invalidAnchors.push({ from: row.path, to: link.path });
}
const graph = linkGraph(rows), body = linkGraph(rows, { bodyOnly: true });
const important = (p) => /^\/(?:ai-image-generation|ai-video-generation|ai-save-the-date|watch|blog)\/[^/]+$/.test(p);
const weakInbound = body.pages.filter((r) => important(r.path) && r.inbound < 2);
const deepContent = body.pages.filter((r) => (important(r.path) || /^\/(?:ai-image-generation|ai-video-generation|best-[^/]+|blog)$/.test(r.path)) && (r.depth === null || r.depth > 3));
const badSitemap = seeds.filter((p) => { const r = byPath.get(p); return !r || r.status !== 200 || r.noindex || r.canonicalPath !== p; });
const result = { origin, checkedAt: new Date().toISOString(), sitemapPages: seeds.length, crawledPages: rows.length, graph, body, broken, redirects, fragments, invalidAnchors, weakInbound, deepContent, badSitemap, rows };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
fs.writeFileSync(out.replace(/\.json$/, '.csv'), 'path,status,body_inbound,body_outbound,body_depth\n' + body.pages.map((r) => [r.path, byPath.get(r.path).status, r.inbound, r.outbound, r.depth ?? 'unreachable'].join(',')).join('\n') + '\n');
console.log(JSON.stringify({ out, sitemapPages: seeds.length, crawledPages: rows.length, orphans: graph.orphans, unreachable: graph.unreachable, cannotReturnHome: graph.cannotReturnHome, broken: broken.length, redirects: redirects.length, fragments: fragments.length, weakInbound: weakInbound.map((r) => r.path), deepContent: deepContent.map((r) => r.path), badSitemap }, null, 2));
if (strict && (broken.length || redirects.length || fragments.length || graph.orphans.length || graph.unreachable.length || graph.cannotReturnHome.length || weakInbound.length || deepContent.length || badSitemap.length)) process.exitCode = 1;
