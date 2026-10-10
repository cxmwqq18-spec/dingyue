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
const originPathPrefix = new URL(origin).pathname.replace(/\/+$/, '');
const pathModeOrigin = /^\/site\/[^/]+(?:\/|$)/.test(originPathPrefix);
const localOrigin = ['localhost', '127.0.0.1'].includes(new URL(origin).hostname);
const privatePath = (p) => /^\/(app|account|album|login|register|signup|cart|checkout|auth|api|admin|platform|search|forgot-password|reset-password|logout)(\/|$)/.test(p);
function localLink(href, base) {
  try {
    const u = new URL(href, `https://${publicHost}${base}`);
    if (!['www.mydreamshoots.com', 'mydreamshoots.com', publicHost, new URL(origin).hostname].includes(u.hostname) || !/^https?:$/.test(u.protocol)) return;
    const requestPath = u.pathname.replace(/\/$/, '') || '/';
    const p = originPathPrefix && (requestPath === originPathPrefix || requestPath.startsWith(`${originPathPrefix}/`))
      ? requestPath.slice(originPathPrefix.length) || '/'
      : requestPath;
    if (/^\/(assets|_next|uploads|fonts|images|favicon)(\/|\.|$)/.test(p) || /\.[a-z0-9]{2,5}$/i.test(p)) return;
    return { path: p, hash: u.hash, query: u.search };
  } catch { return; }
}
async function request(p) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await delay(attempt * 5000);
    try {
      const headers = pathModeOrigin
        ? { accept: 'text/html,application/xml' }
        : { Host: publicHost, 'x-forwarded-host': publicHost, accept: 'text/html,application/xml' };
      const response = await fetch(origin + p, { headers, redirect: 'manual', signal: AbortSignal.timeout(45000) });
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
    const topicGroupLinks = $('[data-topic-group-links] a[href]').map((i, e) => {
      const link = localLink($(e).attr('href'), p);
      if (!link) return null;
      return { ...link, anchor: $(e).text().trim().replace(/\s+/g, ' ') || $(e).find('img').attr('alt') || '' };
    }).get().filter(Boolean);
    const breadcrumbs = $('[data-topic-group-breadcrumb] a[href]').map((i, e) => {
      const link = localLink($(e).attr('href'), p);
      return link ? { ...link, anchor: $(e).text().trim().replace(/\s+/g, ' ') } : null;
    }).get().filter(Boolean);
    const canonicalPath = localLink($('link[rel="canonical"]').attr('href'), p)?.path;
    const robotsMeta = $('meta[name="robots"]').attr('content') || '';
    const edgeRobots = localOrigin ? '' : (response.headers.get('x-robots-tag') || '');
    const row = { path: p, status: response.status, finalPath: p, canonicalPath, noindex: /noindex/i.test(robotsMeta + edgeRobots), title: $('title').text(), h1: $('h1').first().text().trim().replace(/\s+/g, ' '), ids: $('[id]').map((i, e) => $(e).attr('id')).get(), links, topicGroupLinks, breadcrumbs, contextualLinks: $('[data-contextual-links] a[href]').length };
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
const bodyLinkPaths = (row) => new Set((row?.links || []).filter((link) => !link.global && !link.nofollow).map((link) => link.path));
const hierarchyDirectories = ['/ai-image-generation', '/ai-video-generation', '/best-save-the-date'];
const hierarchyGroups = [], hierarchyLeaves = [], hierarchyFailures = [];
const homepageBodyLinks = bodyLinkPaths(byPath.get('/'));
for (const directoryPath of hierarchyDirectories) {
  const directory = byPath.get(directoryPath);
  const directoryInHomepageBody = homepageBodyLinks.has(directoryPath);
  if (!directoryInHomepageBody) hierarchyFailures.push({ path: directoryPath, reason: 'main_directory_missing_from_homepage_body' });
  if (!directory || directory.status !== 200 || directory.noindex || directory.canonicalPath !== directoryPath) {
    hierarchyFailures.push({ path: directoryPath, reason: 'main_directory_not_indexable_200' });
    continue;
  }
  const groupEntries = directory.topicGroupLinks || [];
  if (!groupEntries.length) hierarchyFailures.push({ path: directoryPath, reason: 'no_topic_group_links_in_body' });
  for (const groupLink of groupEntries) {
    const groupPath = groupLink.path;
    const group = byPath.get(groupPath);
    const directoryBodyLinks = bodyLinkPaths(directory);
    const groupLinkedFromDirectoryBody = directoryBodyLinks.has(groupPath);
    const groupIsIndexable = Boolean(group && group.status === 200 && !group.noindex && group.canonicalPath === groupPath && group.h1 && (group.topicGroupLinks || []).length);
    const groupReturnsToDirectory = bodyLinkPaths(group).has(directoryPath);
    const children = group?.topicGroupLinks || [];
    const groupRecord = { directoryPath, groupPath, anchor: groupLink.anchor, directoryInHomepageBody, groupLinkedFromDirectoryBody, groupReturnsToDirectory, groupStatus: group?.status ?? null, groupIndexable: groupIsIndexable, childLinks: children.length };
    hierarchyGroups.push(groupRecord);
    if (!groupLinkedFromDirectoryBody) hierarchyFailures.push({ path: groupPath, reason: 'group_missing_from_parent_directory_body' });
    if (!groupIsIndexable) hierarchyFailures.push({ path: groupPath, reason: 'group_not_indexable_200_or_missing_h1_or_children' });
    if (!groupReturnsToDirectory) hierarchyFailures.push({ path: groupPath, reason: 'group_missing_body_link_back_to_directory' });
    if (!children.length) hierarchyFailures.push({ path: groupPath, reason: 'group_has_no_topic_children' });
    for (const child of children) {
      const leaf = byPath.get(child.path);
      const leafIsIndexable = Boolean(leaf && leaf.status === 200 && !leaf.noindex && leaf.canonicalPath === child.path);
      const leafReturnsToGroup = bodyLinkPaths(leaf).has(groupPath);
      const pathIsValid = directoryInHomepageBody && groupLinkedFromDirectoryBody && groupIsIndexable && groupReturnsToDirectory && leafIsIndexable && leafReturnsToGroup;
      const hierarchyLeaf = { homePath: '/', directoryPath, groupPath, leafPath: child.path, anchor: child.anchor, edges: 3, valid: pathIsValid, leafStatus: leaf?.status ?? null, leafIndexable: leafIsIndexable, leafReturnsToGroup };
      hierarchyLeaves.push(hierarchyLeaf);
      if (!leafIsIndexable) hierarchyFailures.push({ path: child.path, reason: 'group_child_not_indexable_200' });
      if (!leafReturnsToGroup) hierarchyFailures.push({ path: child.path, reason: 'leaf_missing_body_link_back_to_group', groupPath });
    }
  }
}
const hierarchyLeafPaths = new Map();
for (const leaf of hierarchyLeaves) if (leaf.valid) hierarchyLeafPaths.set(leaf.leafPath, (hierarchyLeafPaths.get(leaf.leafPath) || 0) + 1);
const hierarchy = {
  requiredPath: 'homepage body → main directory body → topic group body → theme page body',
  pathDepthEdges: 3,
  directoryCount: hierarchyDirectories.length,
  groupCount: hierarchyGroups.length,
  leafPathCount: hierarchyLeaves.length,
  uniqueLeafCount: hierarchyLeafPaths.size,
  groups: hierarchyGroups,
  leaves: hierarchyLeaves,
  failures: hierarchyFailures
};
const depthMetrics = {
  fullNavigationShortest: { maxDepth: graph.maxDepth, unreachable: graph.unreachable },
  bodyShortest: { maxDepth: body.maxDepth, unreachable: body.unreachable },
  categoryHierarchy: { pathDepthEdges: hierarchy.pathDepthEdges, groups: hierarchy.groupCount, leafPaths: hierarchy.leafPathCount, uniqueLeaves: hierarchy.uniqueLeafCount, failures: hierarchy.failures }
};
const important = (p) => /^\/(?:ai-image-generation|ai-video-generation|ai-save-the-date|watch|blog)\/[^/]+$/.test(p);
const weakInbound = body.pages.filter((r) => important(r.path) && r.inbound < 2);
const deepContent = body.pages.filter((r) => (important(r.path) || /^\/(?:ai-image-generation|ai-video-generation|best-[^/]+|blog)$/.test(r.path)) && (r.depth === null || r.depth > 3));
const badSitemap = seeds.filter((p) => { const r = byPath.get(p); return !r || r.status !== 200 || r.noindex || r.canonicalPath !== p; });
const result = { origin, checkedAt: new Date().toISOString(), sitemapPages: seeds.length, crawledPages: rows.length, depthMetrics, hierarchy, graph, body, broken, redirects, fragments, invalidAnchors, weakInbound, deepContent, badSitemap, rows };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
const fullDepthByPath = new Map(graph.pages.map((r) => [r.path, r.depth]));
const hierarchyCountByPath = new Map(hierarchyLeafPaths);
fs.writeFileSync(out.replace(/\.json$/, '.csv'), 'path,status,full_navigation_shortest_depth,body_shortest_depth,body_inbound,body_outbound,hierarchy_path_count\n' + body.pages.map((r) => [r.path, byPath.get(r.path)?.status ?? '', fullDepthByPath.get(r.path) ?? 'unreachable', r.depth ?? 'unreachable', r.inbound, r.outbound, hierarchyCountByPath.get(r.path) || 0].join(',')).join('\n') + '\n');
console.log(JSON.stringify({ out, sitemapPages: seeds.length, crawledPages: rows.length, depths: depthMetrics, orphans: graph.orphans, unreachable: graph.unreachable, cannotReturnHome: graph.cannotReturnHome, broken: broken.length, redirects: redirects.length, fragments: fragments.length, weakInbound: weakInbound.map((r) => r.path), deepContent: deepContent.map((r) => r.path), badSitemap }, null, 2));
if (strict && (broken.length || redirects.length || fragments.length || graph.orphans.length || graph.unreachable.length || graph.cannotReturnHome.length || weakInbound.length || deepContent.length || badSitemap.length || hierarchyFailures.length)) process.exitCode = 1;
