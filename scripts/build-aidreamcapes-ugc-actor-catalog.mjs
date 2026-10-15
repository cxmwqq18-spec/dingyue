#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "scripts/data/aidreamcapes-site-v2/content/ai-actors.json");
const outputPath = path.join(root, "src/lib/aidreamcapes-workspace/actors.json");
const voiceAssetsPath = path.join(root, "scripts/aidreamcapes-workspace/actor-voice-assets.json");
const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const sourceCards = source.actor_cards;
let voiceAssets = {};
try {
  const manifest = JSON.parse(await fs.readFile(voiceAssetsPath, "utf8"));
  voiceAssets = manifest.actors ?? {};
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
assert.equal(sourceCards.length, 53, "The plan's actor directory must contain exactly 53 cards.");
assert.equal(new Set(sourceCards.map((card) => card.id)).size, 53, "The 53 actor IDs must be unique.");

const femaleVoices = [
  { timbre: "warm", label: "Warm & friendly", vocalProfile: "A female voice with a warm, friendly tone, medium-slow pace and moderate breathiness." },
  { timbre: "calm", label: "Calm & clear", vocalProfile: "A calm, thoughtful female voice with a slower pace and clear articulation." },
  { timbre: "bright", label: "Bright & lively", vocalProfile: "A bright, lively female voice with a medium-fast pace and expressive intonation." }
];
const maleVoices = [
  { timbre: "low", label: "Deep & resonant", vocalProfile: "A low, resonant male voice with a slower pace and clear chest resonance." },
  { timbre: "warm", label: "Warm & grounded", vocalProfile: "A warm male voice in a relaxed mid register, with natural phrasing and clear articulation." },
  { timbre: "clear", label: "Clear & measured", vocalProfile: "A clear male voice with an even mid register, measured pace and precise articulation." }
];
const actorVoiceOverrides = {
  "home-1": { label: "Low & grounded", vocalProfile: "An adult male voice with a natural, trustworthy tone, a medium-low register, measured pacing and clear articulation." },
  "outdoor-1": { label: "Warm & natural", vocalProfile: "An adult female voice with a warm, natural tone, a relaxed medium pace and clear conversational phrasing." },
  "garden-1": { label: "Warm & composed", vocalProfile: "An adult female voice with a natural warm tone, a steady medium pace and clear, composed articulation." },
  "cafe-1": { label: "Calm & composed", vocalProfile: "An adult female voice with a calm, composed tone, a medium-slow pace and clear articulation." },
  "cafe-2": { label: "Confident & lively", vocalProfile: "An adult female voice with a confident, lively tone, natural pitch and expressive but measured phrasing." },
  "fitness-2": { label: "Thoughtful & steady", vocalProfile: "An adult female voice with a thoughtful, calm tone, a steady pace and clear conversational articulation." },
  "balcony-1": { label: "Warm & conversational", vocalProfile: "An adult female voice with a warm conversational tone, a natural mid register and relaxed, clear phrasing." },
  "shopping-2": { label: "Bright & confident", vocalProfile: "An adult female voice with a bright but mature tone, natural pitch, clear articulation and an energetic medium pace." },
  "terrace-2": { label: "Gentle & grounded", vocalProfile: "An adult female voice with a gentle, grounded tone, a natural mid register and clear, measured phrasing." },
  "reporting-1": { label: "Professional & clear", vocalProfile: "An adult female presenter voice with a natural mid register, even pacing and precise, composed articulation." }
};
const voiceCounts = { female: 0, male: 0 };
const actors = sourceCards.map((card) => {
  assert(card.id && card.name && card.age && card.gender && card.talent && card.scene && card.style && card.action, `Incomplete plan data for ${card.id ?? "unknown actor"}.`);
  const gender = card.gender === "Women" ? "female" : card.gender === "Men" ? "male" : null;
  assert(gender, `${card.id}: unexpected gender label ${card.gender}.`);
  const pool = gender === "female" ? femaleVoices : maleVoices;
  const voice = structuredClone(pool[voiceCounts[gender]++ % pool.length]);
  Object.assign(voice, actorVoiceOverrides[card.id] ?? {});
  const voiceAsset = voiceAssets[card.id];
  if (voiceAsset) {
    assert.equal(voiceAsset.sampleLine, card.line, `${card.id}: voice sample text must match the actor card.`);
    assert.equal(voiceAsset.voiceGender, gender, `${card.id}: voice sample gender must match the actor card.`);
    assert.match(voiceAsset.assetUrl, /^\/media\/site_aidreamcapes\/workspace\/actors\/voices\/[a-z0-9-]+\.mp3$/, `${card.id}: unexpected voice asset path.`);
  }
  const portraitPrompt = [
    `Create one photorealistic portrait of an original fictional adult AI actor named ${card.name}. Match this character description exactly: ${card.talent}.`,
    `The character card is for a ${card.style} in a ${card.scene} setting. Depict this same person in a simple chest-up portrait, using this scene and pose as visual guidance: ${card.action}.`,
    "Natural skin texture and age details, recognizable face, direct friendly eye contact, realistic anatomy, candid commercial-photo style, one person only.",
    "Do not change the character's stated gender, age range, or appearance. No public-figure likeness, text, lettering, logos, watermarks, collage, border, or extra people."
  ].join(" ");
  return {
    actorId: card.id,
    name: card.name,
    gender,
    genderLabel: card.gender,
    ageRange: card.age,
    appearance: card.talent,
    scene: card.scene,
    style: card.style,
    description: card.use,
    category: card.category,
    talent: card.talent,
    sampleLine: card.line,
    action: card.action,
    ambient: card.ambient,
    sourceRef: card.ref,
    identityPrompt: `Match the same fictional actor described as ${card.talent}. Keep the person's face, stated age range, appearance, and hairstyle consistent with the supplied actor reference.`,
    portraitPrompt,
    imageUrl: `/media/site_aidreamcapes/workspace/actors/library/${card.id}.webp`,
    voice: {
      ...voice,
      language: "en",
      languages: ["en"],
      refAudio: voiceAsset?.assetUrl ?? "",
      speed: 1,
      pitch: 0
    }
  };
});

await fs.writeFile(outputPath, `${JSON.stringify({ version: "aidreamcapes-ugc-actors-v1", source: "ai-actors.json", count: actors.length, provider: "image4", model: "gpt-image-2", actors }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, count: actors.length, genderLabels: Object.fromEntries(Object.entries(sourceCards.reduce((counts, card) => ({ ...counts, [card.gender]: (counts[card.gender] ?? 0) + 1 }), {}))) }, null, 2));
