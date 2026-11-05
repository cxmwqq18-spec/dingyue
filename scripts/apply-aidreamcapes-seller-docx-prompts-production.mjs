#!/usr/bin/env node
// Production apply: replace the four seller detail-card prompts with faithful
// English translations of the complete 30-second Wan 3.0 scripts from the
// owner's prompt document (groups 04 serum, 09 candle, 10 supplement,
// 11 sneaker). The paragraphs, shot timings, quotes, sound notes and limits
// mirror the document one-to-one; nothing is condensed or paraphrased away.
//
// Videos themselves are unchanged by this manifest — only `prompt`.
//
// Usage (on the production server, from the current release dir):
//   node scripts/apply-aidreamcapes-seller-docx-prompts-production.mjs                     # plan
//   node scripts/apply-aidreamcapes-seller-docx-prompts-production.mjs --apply-production  # apply
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertDatabaseTarget } from './lib/database-target.mjs';

loadRuntimeEnv();
const applying = process.argv.includes('--apply-production');
assertDatabaseTarget({ expectedTarget: 'production', requireProductionConfirmation: applying, productionConfirmed: applying });
const siteId = 'site_aidreamcapes';
const pageId = 'site_aidreamcapes_home';
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(value === undefined ? '<undefined>' : JSON.stringify(stable(value))).digest('hex');
const db = new PrismaClient();

// Full-script English translations, group by group, paragraph structure kept.
const docxPrompts = {
  'serum-nightly-glow': [
    'Wan 3.0; 30s; 9:16; sound on; product/vanity photo + presenter identity reference, non-first-frame mode.',
    'A soft, natural skincare product demonstration that preserves real skin texture, glass translucency and liquid reflections, with no beauty-filter smoothing. Show the dropper dispensing a single drop onto a fingertip and being gently pressed onto the skin. Explain that the dropper makes it easy to dispense a little at a time; make no ingredient, repair, brightening, or instant-effect claims.',
    'Reference images: image 1 locks the pink glass dropper bottle, the cream jar and the vanity setting; image 2 locks the adult woman\'s face, her dark brown hairstyle and the white bathrobe. Image 2 locks the person only and does not inherit the plain studio background. The cream jar stays as a silent prop, and no order of use between the two products is implied.',
    'Scene: the same vanity with soft window light. The dropper bottle stands on the countertop with the cream jar beside it. There is exactly one cap and one dropper throughout. The bottle starts closed.',
    'Shot 1 [0-6s] 50mm medium close-up of the presenter and products; her mouth, the closed dropper bottle and the cream jar are in frame together. She gestures naturally at the dropper bottle and says: "A dropper lets you apply this serum a little at a time."',
    'Shot 2 [6-12s] Hard cut to an 85mm close-up of the hands. The twisting-open action is omitted through an explicit edit; the shot begins with the bottle already open, cap and dropper held together in her right hand, her left fingertips spread open. She dispenses a single drop onto the left fingertip and stops. No dialogue.',
    'Shot 3 [12-18s] Hard cut back to the 50mm medium close-up; retrieving the dropper and twisting the cap back on are explicitly omitted. The closed bottle is back in place and a single drop of serum is visible on the left fingertip. Her mouth is visible as she says: "Apply a drop to clean fingertips, then gently press it onto skin."',
    'Shot 4 [18-24s] Hard cut to an 85mm close-up from the side. The left fingertip gently presses the cheek once, then moves away naturally; the serum shows only a real, localized sheen, and skin texture and tone stay unchanged. No dialogue.',
    'Shot 5 [24-30s] Hard cut back to the 50mm two-shot of presenter and products, hands lowered naturally, the closed dropper bottle and cream jar in place. She says: "Choose it if you prefer a dropper format in your skincare routine."',
    'Sound: one consistent, natural English female voice across the whole piece, lip-synced, with an unhurried pace and pauses at the ends of sentences. Spoken on-camera lines happen only when the mouth is visible; hand and cheek close-ups carry no dialogue. Keep soft room ambience and faint, natural handling sounds; the omitted cap actions add no extra sound effects. No background music.',
    'Limits: the bottle never squeezes or deforms; the dropper never pierces the skin or comes near the eyes; the cream jar stays closed and untouched. Opening and closing are bridged through explicit edit omissions and never shown as self-restoring. The liquid never appears or disappears arbitrarily, and nothing generates whitened skin, erased pores, or before/after comparisons. Keep the product\'s original appearance; no added copy, captions, auto-subtitles, or watermarks.'
  ].join('\n\n'),
  'candle-cozy-gift': [
    'Wan 3.0; 30s; 9:16; sound on; two-image reference generation, neither image used as a forced first frame.',
    'A warm-toned lifestyle e-commerce short film with real glass refraction and candlelight; no scent particles, floating light spots, or exaggerated glow. Show the ribbed clear glass jar, the ivory wax, the single wick and the wood-grain round lid, plus the candle actually lit on a home tabletop. The reasons to buy center on looks and tabletop ambience; make no claims about scent type, wax material, burn time, or health effects.',
    'Reference images: image 1 locks the candle jar, the wax, the single wick, the wood-grain lid and the proportions; image 2 locks the adult woman\'s face, her brown updo, the cream knit sweater, and the warm living-room atmosphere. The open-flame holding pose in image 2 is not used for this action. The presenter keeps the same identity and outfit across shots.',
    'Scene: a warm living room, the same sturdy side table, with consistent evening window light and warm lamps in the distance. The candle jar always stands upright in a heat-safe tray, away from the sweater, curtains, cushions, plants and other flammables. The wood-grain lid lies flat on the right side of the table, and the candle starts unlit. The presenter sits behind the table, and the frame keeps both her mouth and the product clearly visible.',
    'Shot 1 [0-6s] 50mm medium shot of presenter and product with a slow push-in. Her hands rest naturally, the unlit candle in the foreground, as she says to camera: "This candle pairs a ribbed glass jar with a wooden lid."',
    'Shot 2 [6-12s] Hard cut to an 85mm close-up from the front-side, with a slow lateral move across the glass ribbing, the wax surface, the single wick and the wooden lid beside it. The jar and lid stay in place, nothing is picked up, and there is no dialogue.',
    'Shot 3 [12-18s] Hard cut back to the 50mm medium shot; the time lighting takes is explicitly omitted through an edit, and the shot begins with the candle already lit in the same tray, the wooden lid still on the right. She never touches the jar and says: "On a clear tabletop, the flame adds a warm visual accent."',
    'Shot 4 [18-24s] Hard cut to a locked 85mm close-up showing the small flame on the single wick and the natural reflections inside the glass; the candle is not moved and the flame sways gently and naturally. No dialogue.',
    'Shot 5 [24-30s] Hard cut back to the 50mm two-shot of presenter and product. She keeps her distance from the flame and says: "Choose it for the glass detail and a softly lit setting." The shot holds steady.',
    'Sound: a natural English female on-camera voice, lip-synced, speaking only when her mouth is visible; product close-ups carry no dialogue. Keep light living-room ambience; a normal small flame gets no exaggerated crackling; the lighting step is omitted and no lighter sound is dubbed in. No background music.',
    'Limits: the flame never appears from the jar wall, elsewhere on the wax, or on the wooden lid; there is always exactly one wick and one small flame. Once lit, the jar is never picked up, the lid never goes back on, and hair or sleeves never come near the flame. No sudden mass melting, sourceless wax pools, or softening glass. No unconfirmed scent or effect claims. Keep the product\'s original appearance; no added copy, captions, auto-subtitles, branding, or watermarks.'
  ].join('\n\n'),
  'supplement-morning-routine': [
    'Wan 3.0; 30s; 9:16; sound on; two-image reference generation, neither image used as a forced first frame.',
    'A live-presenter packaging introduction filmed in a bright home kitchen, with natural reflections on the white bottle and a solid-color green label. Show the white bottle body, the white ribbed cap and the green label, plus the process of picking the bottle up and setting it back down. The current images cannot confirm what the bottle contains, so the bottle shape, the water glass, or the kitchen setting must never be treated as evidence that it is edible, a supplement, a weight-loss product, or guidance on how to take it. This brief carries no efficacy or dosage recommendations for the unknown contents.',
    'Reference images: image 1 locks the white bottle body, the white cap, the blank green label and the proportions; image 2 locks the adult woman\'s face, her brown updo, the cream knit sweater and the bright kitchen. The bottle in image 2 is the same single product and is not duplicated. The water glass is a static set prop only and never implies taking it with water.',
    'Scene: the same kitchen with soft window light from the left. The closed bottle stands upright on the light countertop, the water glass sits farther to the right, and the presenter stands behind the counter. Keep the label facing the camera as much as possible; hands touch only the sides and bottom of the bottle so the label is never covered.',
    'Shot 1 [0-6s] 50mm medium shot of presenter and product with a slight push-in, the bottle still resting on the countertop. She says to camera: "Here\'s a closer look at the bottle and its packaging."',
    'Shot 2 [6-12s] Hard cut to a locked 85mm close-up of the hands. Her right hand grips the bottle from the side, her left hand supports the bottom, and she lifts it smoothly a little off the counter; the cap stays closed, the bottle upright, the green label facing the camera. No dialogue.',
    'Shot 3 [12-18s] Hard cut back to the 50mm medium close-up, still holding the bottle with both hands, her mouth visible. She says: "It has a white cap and a plain green label."',
    'Shot 4 [18-24s] Hard cut to an 85mm close-up from the front-side. Both hands set the bottle smoothly back in place; only after the base touches the counter and settles do her hands withdraw; the locked shot holds a moment on the closed cap and the bottle\'s outline. No dialogue.',
    'Shot 5 [24-30s] Hard cut back to the 50mm two-shot, her hands resting naturally at the table edge as she says: "Check the product details and directions before deciding how to use it."',
    'Sound: a natural English on-camera voice, lip-synced, audible only when the mouth is visible; hand close-ups carry no dialogue. Keep room ambience, a light fingertip-on-glass sound, and the sound of the base settling on the table. No background music.',
    'Limits: the label stays the blank green from the reference images — no product names, ingredients, dosages, certifications, or any invented text. The cap never opens, nothing is poured out, no swallowing is shown, and the water glass is never picked up. No weight-loss, health, therapeutic, or other effect claims. There is exactly one bottle; it is gripped firmly before lifting and set down steadily before the hands withdraw; no hands passing through it, no floating. No added copy, captions, auto-subtitles, or watermarks.'
  ].join('\n\n'),
  'sneakers-every-day': [
    'Wan 3.0; 30s; 9:16; sound on; two-image reference generation, neither image used as a forced first frame.',
    'A natural-daylight, front-door outfit e-commerce short film that preserves the real details of the upper, stitching, laces and sole, with relaxed, natural movement. Show the look of this pair of white low-top lace-up sneakers, the lace-up structure, and everyday wear-and-walk use. The reasons to buy center on the clean white look and how it pairs with jeans; do not add unconfirmed selling points such as genuine leather, waterproofing, slip resistance, cushioning, or all-day comfort.',
    'Reference images: image 1 locks this pair\'s silhouette, laces, tongue, stitching and white sole; materials render only as their visible surfaces, with no leather-type inference. Image 2 locks the adult woman\'s face, her brown updo, the cream knit sweater, the light-blue jeans and the front-step setting. Identity and outfit stay consistent across shots; the shoe model is decided by image 1.',
    'Scene: the same front steps in soft natural daylight on dry, even ground. The presenter starts seated and settled, the right shoe already on her right foot and the left foot in a sock resting on the step; the left shoe is held in both hands with its laces loosened. There is exactly one pair of shoes in the whole piece.',
    'Shot 1 [0-6s] 50mm medium shot; her mouth and the left shoe are in frame together. She shows the side of the shoe naturally and says: "A simple white sneaker pairs easily with a casual denim outfit."',
    'Shot 2 [6-12s] Hard cut to a locked 85mm close-up. Her left hand supports the sole and her right hand steadies the heel as the same left shoe rotates at a small angle to show the upper, stitching and lace structure; both hands keep supporting it. The shoe is never bent or squeezed, and there is no dialogue.',
    'Shot 3 [12-18s] Hard cut back to the 50mm medium shot; putting on the left shoe is explicitly omitted through an edit. The shot begins with both shoes correctly worn and laced; she sits settled, her mouth visible, and says: "The lace-up design lets you adjust the fit before heading out."',
    'Shot 4 [18-24s] Hard cut to a low, locked close-up that cuts in at the moment she is already standing, omitting the process of getting up. She takes two small natural steps on the flat ground in front of the door, heel and forefoot landing in natural gait order, the upper flexing gently at the toe joints; the camera stays in place and the walk finishes inside the frame. No dialogue.',
    'Shot 5 [24-30s] Hard cut to a 50mm standing medium shot; she has come to rest by the door, both feet still, facing the camera as she says: "Choose them for a clean, simple look with your everyday outfits."',
    'Sound: a natural English on-camera voice, lip-synced, speaking only when the mouth is visible. Close-ups carry no dialogue; keep light clothing sounds, natural contact sounds while handling the shoe, and two footstep landings. No background music.',
    'Limits: the right and left shoes never swap and never multiply into a third shoe; laces, tongue and sole stay continuous. Putting on the shoes and standing up are bridged through explicit edit omissions — no feet morphing into uppers, no shoes snapping onto feet. Steps never slide or float, and the sole never sinks through the ground. No running, jumping, or slip tests that imply unconfirmed performance. No added text, captions, auto-subtitles, branding, or watermarks.'
  ].join('\n\n')
};

try {
  const report = await db.$transaction(async tx => {
    const site = await tx.site.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } });
    assert.equal(site.slug, 'aidreamcapes');
    assert.match(site.primaryDomain, /aivideosugc\.com$/);
    const protectedRows = () => tx.livePage.findMany({ where: { siteId: { not: siteId } }, orderBy: { id: 'asc' }, select: { id: true, contentJson: true } });
    const protectedBefore = hash(await protectedRows());
    const row = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId, slug: '/' } });
    const next = structuredClone(row.contentJson);
    const data = next.sections.v2_main.settings.data;
    assert.equal(data.homeExperience.version, 1);
    const base = 'sections/v2_main/settings/data';
    const operations = [];
    const push = (path, previousValue, value) => { if (hash(previousValue) === hash(value)) return; operations.push({ entityType: 'live_page', id: pageId, field: 'contentJson', path: `/${path}`, baseHash: hash(previousValue), ...(previousValue === undefined ? {} : { previousValue }), value }); };

    // Replace the four seller detail-card prompts, located by publicSlug.
    const items = data.examples.groups[0].items;
    for (const [slug, prompt] of Object.entries(docxPrompts)) {
      const index = items.findIndex(item => item.publicSlug === slug);
      assert.ok(index >= 0, `seller detail card not found: ${slug}`);
      const card = items[index];
      assert.equal(card.kind, 'video', `${slug}: kind changed`);
      assert.equal(card.duration, 30, `${slug}: duration must stay 30`);
      push(`${base}/examples/groups/0/items/${index}/prompt`, card.prompt, prompt);
      card.prompt = prompt;
    }

    assert.deepEqual(next.seo, row.contentJson.seo);
    assert.deepEqual(next.mediaManifest, row.contentJson.mediaManifest);
    if (applying && operations.length) {
      const result = await tx.livePage.updateMany({ where: { siteId, id: pageId, updatedAt: row.updatedAt }, data: { contentJson: next } });
      assert.equal(result.count, 1);
      const readback = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId } });
      assert.equal(hash(readback.contentJson), hash(next));
    }
    const protectedAfter = hash(await protectedRows());
    assert.equal(protectedBefore, protectedAfter);
    return { ok: true, target: 'production', siteId, pageId, owner: 'LivePage.contentJson', applying, sourceRevisionBefore: hash(row.contentJson), sourceRevisionAfter: hash(next), protectedBefore, protectedAfter, operations, historicalStateActivated: false };
  });
  const out = 'releases/aidreamcapes-seller-docx-prompts-20261105';
  await fs.promises.mkdir(out, { recursive: true });
  await fs.promises.writeFile(`${out}/production-${applying ? 'apply' : 'plan'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, operations: report.operations.map(op => op.path) }, null, 2));
} finally { await db.$disconnect(); }
