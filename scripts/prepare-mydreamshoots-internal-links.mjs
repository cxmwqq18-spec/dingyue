// Prepare field deltas against a current, read-only relational audit. This
// never imports records or activates a publication, and does not write a DB.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import './load-runtime-env.mjs';

const arg = (name, fallback) => process.argv.find((x) => x.startsWith(name + '='))?.slice(name.length + 1) ?? fallback;
const auditDir = arg('--audit-dir', 'releases/internal-links');
const target = arg('--target', 'production');
if (!['production', 'local'].includes(target)) throw new Error('Only MyDreamShoots local/production deltas are supported');
const d = JSON.parse(fs.readFileSync(path.join(auditDir, 'current-production-audit.json')));
const before = JSON.parse(fs.readFileSync(path.join(auditDir, 'before.json')));
const watches = JSON.parse(fs.readFileSync(path.join(auditDir, 'current-watch-audit.json')));
if (d.livePages.some((p) => p.siteId !== 'site_dreamshoot')) throw new Error('Cross-store input');
const stable = (v) => v === undefined ? 'undefined' : v === null || typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? `[${v.map(stable).join(',')}]` : `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
const hash = (v) => crypto.createHash('sha256').update(stable(v)).digest('hex');
const escape = (p) => p.replaceAll('~', '~0').replaceAll('/', '~1');
const pointer = (v, p) => p.slice(1).split('/').reduce((a, k) => a?.[k.replaceAll('~1', '/').replaceAll('~0', '~')], v);
let bases = d.livePages;
let settingsBase = d.settings;
if (target === 'local') {
  const prisma = new PrismaClient();
  try {
    bases = await prisma.livePage.findMany({ where: { siteId: 'site_dreamshoot' } });
    settingsBase = await prisma.themeSettings.findUnique({ where: { siteId: 'site_dreamshoot' } });
  } finally { await prisma.$disconnect(); }
}
const operations = [];
function delta(row, fieldPath, value) {
  const base = bases.find((p) => p.id === row.id);
  if (!base) throw new Error(`Missing current page ${row.id}; refusing a record import`);
  const previousValue = pointer(base.contentJson, fieldPath);
  if (stable(previousValue) === stable(value)) return;
  operations.push({ entityType: 'live_page', entityKey: row.id, field: 'contentJson', fieldPath, operation: 'upsert', baseHash: hash(previousValue), ...(previousValue === undefined ? {} : { previousValue }), value });
}
const pages = new Map(d.livePages.map((p) => [p.slug, p]));
const rowFor = (p) => pages.get(p) ?? (p.startsWith('/ai-image-generation/') ? pages.get('/ai-image-generation') : p === '/ai-save-the-date/wedding-invitation' ? pages.get('/ai-video-generation/wedding-invitation') : undefined);
const labels = new Map([['/ai-image-generation','AI photo packages and editing tools'],['/ai-video-generation','AI video themes'],['/best-save-the-date','Save the Date and celebration videos'],['/best-ai-image','AI photo examples'],['/best-ai-video','AI video examples'],['/best-packages','photo package ideas'],['/blog','photo and video guides'],['/workflow','the photo and video workflow']]);
const label = (p) => labels.get(p) || p.split('/').pop().split('-').map((s) => s[0]?.toUpperCase() + s.slice(1)).join(' ');
const link = (href, anchor, before, after) => ({ href, label: anchor, ...(before ? { before } : {}), ...(after ? { after } : {}) });
const links = new Map();
function add(p, ...items) {
  const list = links.get(p) ?? [];
  for (const item of items) if (item.href !== p && !list.some((e) => e.href === item.href)) list.push(item);
  links.set(p, list);
}
const imageRoot = '/ai-image-generation', videoRoot = '/ai-video-generation', eventRoot = '/best-save-the-date';
const imageSlugs = ['headshot','portrait-photo','avatar','rich-lifestyle','travel','urban','street-style','nightlife','cannes','gala-photo','mafia','cyberpunk','soccer','holiday','singles-awareness-day','black-friday','only-fans','boudoir','bikini','swimsuit','engagement-photo','wedding-photo','valentines-photo','christmas-photo','halloween-photo','thanksgiving-photo','hairstyle-generator','virtual-try-on','edit-by-prompt','background-remover','background-changer','magic-eraser','portrait-retouch','color-correction','old-photo-restoration','unblur-image','photo-enhancer'];
const videos = before.rows.filter((p) => p.status === 200 && /^\/ai-video-generation\/[^/]+$/.test(p.path) && p.canonicalPath === p.path).map((p) => p.path).sort();
const events = ['proposal','engagement','save-the-date','wedding-invitation','wedding-ceremony','valentines-day','wedding-anniversary','christmas','new-year','mothers-day','fathers-day','thanksgiving','halloween'].map((s) => '/ai-save-the-date/' + s).filter((p) => before.rows.some((r) => r.path === p && r.status === 200));
const images = imageSlugs.map((s) => imageRoot + '/' + s);
const planningNotes = {
  'motion-generator':'Start with one clear subject and a restrained movement, such as a slow camera push or a gentle turn, so the original image remains easy to recognize.',
  'story-video':'Plan an opening, one visible change, and an ending before adding more scenes. A simple sequence gives viewers a clear thread to follow through a short video.',
  'social-media-video':'Choose the viewing format and the main message before building your clip. Keep the opening easy to understand, especially when people watch without sound or on a small screen.',
  'youtube-video':'Give the viewer a clear reason to keep watching, then organize the clip around that promise. Choose images that explain each point rather than filling every moment with movement.',
  'pet-video':'Choose source images where your pet is clearly visible and begin with a simple scene. Gentle movement makes it easier to review facial features, paws, and the surrounding details.',
  'meme-video':'Keep the setup brief and make the visual payoff easy to read. One recognizable situation usually gives a short joke more room to land than several competing ideas.'
};
function ring(group, parent, parentLabel, kind) {
  group.forEach((p, i) => {
    const previous = group[(i + group.length - 1) % group.length], next = group[(i + 1) % group.length];
    add(p,
      link(previous, `${label(previous).toLowerCase().replace(/ video$/, kind === 'video ideas' ? '' : ' video')} ${kind}`, `${planningNotes[p.split('/').pop()] ?? 'Looking for another direction?'} Compare the mood and purpose of`, 'before choosing the look that fits your project.'),
      link(next, `${label(next).toLowerCase().replace(/ video$/, kind === 'video ideas' ? '' : ' video')} ${kind}`, 'For a different approach, browse', 'and consider how the setting, subject, and final format support your idea.'),
      link(parent, parentLabel, 'You can also browse', 'to compare more examples and choose a starting point.'),
      link('/', 'the myDreamshoots photo and video collections', 'Planning something beyond this theme? Explore', 'for more creative options.'));
  });
}
ring(images, imageRoot, 'all AI photo packages and editing tools', 'ideas');
ring(videos, videoRoot, 'all AI video themes', 'video ideas');
ring(events, eventRoot, 'Save the Date and celebration video ideas', 'celebration ideas');
for (const [photo, event] of [['engagement-photo','engagement'],['wedding-photo','wedding-ceremony'],['valentines-photo','valentines-day'],['christmas-photo','christmas'],['halloween-photo','halloween'],['thanksgiving-photo','thanksgiving']]) {
  const a = `${imageRoot}/${photo}`, b = `/ai-save-the-date/${event}`;
  add(a, link(b, `${label(b)} video ideas`, 'Pair a still image with a moving announcement using', 'when you want to share the occasion in another format.'));
  add(b, link(a, `${label(a)} photo ideas`, 'For a matching portrait or keepsake, explore', 'and choose a visual style that suits the same occasion.'));
}
for (const [p, hrefs] of [
  ['/', [imageRoot, videoRoot, eventRoot, '/best-ai-image','/best-ai-video','/best-packages','/blog','/workflow']],
  [imageRoot, ['/best-ai-image',videoRoot,eventRoot,'/']],
  [videoRoot, ['/best-ai-video',imageRoot,eventRoot,'/blog','/']],
  [eventRoot, [videoRoot,imageRoot,'/best-ai-video','/']],
  ['/best-ai-image', [imageRoot,'/best-packages','/best-ai-video','/']],
  ['/best-packages', [imageRoot,'/best-ai-image',videoRoot,'/']],
  ['/best-ai-video', [videoRoot,eventRoot,'/workflow','/']],
  ['/blog', [videoRoot,imageRoot,'/workflow','/']],
  ['/workflow', [imageRoot,videoRoot,'/best-ai-video','/']]
]) for (const href of hrefs) add(p, link(href, href === '/' ? 'myDreamshoots photo and video collections' : label(href), 'Explore', 'to find examples, compare ideas, and plan your next creation.'));
// Directory links supplement, rather than replace, their current media cards.
for (const p of images) add(imageRoot, link(p, label(p), 'Explore', 'for a different photo style or editing task.'));
for (const p of videos) add(videoRoot, link(p, `${label(p)} video ideas`, 'Explore', 'and choose a format that suits your story.'));
for (const p of events) add(eventRoot, link(p, `${label(p)} celebration videos`, 'For your next occasion, browse', 'and plan a personal announcement or keepsake.'));
const blogPairs = [['/blog/motion-generator-video-guide',`${videoRoot}/motion-generator`],['/blog/cinematic-video-guide',`${videoRoot}/cinematic-video`],['/blog/talking-photo-video-guide',`${videoRoot}/talking-photo`]];
blogPairs.forEach(([article, source], i) => {
  add('/blog', link(article, label(article), 'Read', 'for practical ideas before choosing a video style.'));
  add(article, link(source, `${label(source)} video examples`, 'Apply the ideas in this guide by exploring', 'and planning a focused first scene.'), link(blogPairs[(i + 1) % blogPairs.length][0], label(blogPairs[(i + 1) % blogPairs.length][0]), 'Continue reading', 'to compare another creative approach.'), link('/blog', 'all photo and video guides', 'Browse', 'for more planning advice.'), link('/', 'myDreamshoots photo and video ideas', 'Return to', 'to explore the main collections.'));
  add(source, link(article, label(article), 'Before creating your clip, read', 'for practical guidance on planning the result.'));
});
const sourceRepairs = {
  'cinematic-portrait-motion': `${videoRoot}/cinematic-video`,
  'creator-scene-motion': `${videoRoot}/motion-generator`,
  'prompt-directed-motion': `${videoRoot}/motion-generator`,
  'creator-intro-motion': `${videoRoot}/talking-head-video`,
  'product-showcase-motion': `${videoRoot}/product-video`,
  'social-profile-clip': `${videoRoot}/social-media-video`,
  'travel-route-story': `${videoRoot}/story-video`,
  'holiday-card-motion': '/ai-save-the-date/christmas',
  'wedding-memory-film': '/ai-save-the-date/wedding-ceremony'
};
const workflow = pages.get('/workflow');
for (const [sectionId, duration] of [['tutorial_video_1',61],['tutorial_image_video_1',58]]) {
  const s = workflow.contentJson.sections[sectionId].settings;
  const slug = sectionId === 'tutorial_video_1' ? 'ai-video-creation-tutorial' : 'mydreamshoots-ai-video-tutorial-20260814';
  watches.push({ slug, watchPath: '/watch/' + slug, sourcePath: '/workflow', name: s.title, description: s.subtitle, thumbnailPath: s.imageUrl, contentPath: s.videoUrl, uploadDate: '2026-08-14T00:00:00.000Z', durationSeconds: duration });
  // The dated tutorial asset is the existing video source; its actual duration
  // is verified with ffprobe. No filename-derived discovery fallback is used.
  delta(workflow, `/sections/${sectionId}/settings/durationSeconds`, duration);
  delta(workflow, `/sections/${sectionId}/settings/createdAt`, '2026-08-14T00:00:00.000Z');
}
const entries = watches.map((w, i) => {
  const source = sourceRepairs[w.slug] ?? w.sourcePath;
  const related = watches[(i + 1) % watches.length];
  const watchLabel = (video) => ({'christmas-family-gift':'Christmas family gift video','valentines-day-save-the-date':"Valentine’s Day Save the Date video",'ai-video-creation-tutorial':'AI photo creation tutorial','mydreamshoots-ai-video-tutorial-20260814':'AI image-to-video tutorial'}[video.slug] ?? (video.name.split(/\s+/).length > 10 ? `${label(sourceRepairs[video.slug] ?? video.sourcePath)} example` : video.name));
  add('/best-ai-video', link(w.watchPath, `Watch the ${watchLabel(w).toLowerCase()}`, 'See an example:', 'then explore its theme for more ideas.'));
  add(source, link(w.watchPath, `Watch the ${watchLabel(w).toLowerCase()}`, 'See this idea in motion:', 'and use the example to plan your own clip.'));
  return { videoUrl: w.contentPath, title: w.name, description: w.description, imageUrl: w.thumbnailPath, createdAt: w.uploadDate, durationSeconds: w.durationSeconds, sourcePath: source, sourceLabel: source === '/workflow' ? 'Explore the photo and video workflow' : `Explore ${label(source).toLowerCase()} ideas`, contextualLinks: [link(related.watchPath, `Watch the ${watchLabel(related).toLowerCase()}`, 'Continue with', 'to compare another video example.'), link('/best-ai-video', 'all AI video examples', 'Browse', 'to find another style or occasion.'), link('/', 'myDreamshoots photo and video collections', 'Return to', 'to plan your next creation.')] };
});
delta(pages.get('/best-ai-video'), '/videoWatchEntries', entries);
for (const [p, value] of links) {
  const row = rowFor(p);
  if (!row) throw new Error(`No current relational owner for ${p}`);
  if (p.startsWith(imageRoot + '/') && row.slug !== p) continue;
  delta(row, '/contextualLinks', value);
}
// Catalog detail pages use their current parent LivePage; each route still
// owns its own editable anchors, without copying the parent page into a leaf.
const byPath = {};
for (const p of images) byPath[p] = links.get(p);
delta(pages.get(imageRoot), '/contextualLinksByPath', byPath);
// Repair only the incorrect root-qualified fragments. Leave other hrefs alone.
function visit(value, at, callback) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const next = `${at}/${escape(key)}`;
    if (typeof child === 'string') callback(child, next);
    else visit(child, next, callback);
  }
}
const fragmentRepairs = new Map(before.fragments.map((f) => [f.from, f.to.split('#')[1]]));
for (const [p, fragment] of fragmentRepairs) visit(rowFor(p).contentJson, '', (v, at) => { if (v === '#' + fragment || v === '/#' + fragment) delta(rowFor(p), at, p + '#' + fragment); });
// Update current navigation hrefs to canonical English targets at field level.
visit(d.settings.draftJson, '', (v, at) => {
  const replacement = v === imageRoot + '/estilo-y-fantasia' ? imageRoot + '/travel' : v === imageRoot + '/urbano' ? imageRoot + '/urban' : undefined;
  if (!replacement) return;
  const previousValue = pointer(settingsBase.draftJson, at);
  if (previousValue === replacement) return;
  operations.push({ entityType:'theme_settings', entityKey:'site_dreamshoot', field:'draftJson', fieldPath:at, operation:'upsert', baseHash:hash(previousValue), previousValue, value:replacement });
});
const codeCommit = arg('--commit', execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
const manifest = { formatVersion:2, releaseId:'mydreamshoots-internal-links-20261003', codeCommit, target, sourceTarget:'local', sourceSiteId:'site_dreamshoot', siteId:'site_dreamshoot', createdAt:new Date().toISOString(), operations, deletions:[] };
const out = arg('--out', path.join(auditDir, `${target}-manifest.json`));
fs.mkdirSync(path.dirname(out), { recursive:true });
fs.writeFileSync(out, JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({out,target,pages:links.size,watchEntries:entries.length,operations:operations.length,recordImports:0,deletions:0}));
