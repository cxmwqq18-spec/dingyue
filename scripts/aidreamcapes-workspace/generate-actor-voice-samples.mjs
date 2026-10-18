#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const apiBase = "https://api.tokengo.love";
const presetCatalogUrl = "https://buming001.token6688.com/api/v1/voice-library/presets";
const sourcePath = path.join(root, "scripts/data/aidreamcapes-site-v2/content/ai-actors.json");
const planPath = path.join(root, "docs/plans/aidreamcapes-speech-28-voice-match-clone-plan.md");
const manifestPath = path.join(root, "scripts/aidreamcapes-workspace/actor-voice-assets.json");
const outputDir = path.join(root, "public/assets/sites/site_aidreamcapes/workspace/actors/voices");
const catalogBuilderPath = path.join(root, "scripts/build-aidreamcapes-ugc-actor-catalog.mjs");
const apiKey = process.env.BUMING_API_KEY;

if (!apiKey) throw new Error("Set BUMING_API_KEY in the process environment before running this script.");

const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const sourceCards = source.actor_cards;
assert.equal(sourceCards.length, 53, "Expected exactly 53 Aidreamcapes actor cards.");
const cardById = new Map(sourceCards.map((card) => [card.id, card]));
assert.equal(cardById.size, 53, "Aidreamcapes actor IDs must be unique.");

const plan = await fs.readFile(planPath, "utf8");
const rows = [];
const rowPattern = /^\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|\s*([男女])\s*\/[^|]+\|.*?候选：(.+?)（(?:女声|男声)第(\d+)\/(\d+)页·第(\d+)项/m;
for (const line of plan.split("\n")) {
  if (!line.startsWith("|")) continue;
  const match = line.match(rowPattern);
  if (!match) continue;
  const [, name, actorId, genderLabel, candidateName, page, pageCount, item] = match;
  const card = cardById.get(actorId);
  assert(card, `Voice plan references unknown actor ${actorId}.`);
  const gender = genderLabel === "女" ? "female" : "male";
  assert.equal(card.name, name.trim(), `${actorId}: plan name does not match actor card.`);
  assert.equal(card.gender === "Women" ? "female" : card.gender === "Men" ? "male" : "unknown", gender, `${actorId}: actor gender does not match voice plan.`);
  rows.push({ actorId, name: name.trim(), gender, candidateName: candidateName.trim(), page: Number(page), pageCount: Number(pageCount), item: Number(item), card });
}
assert.equal(rows.length, 53, `Expected 53 voice-plan rows, found ${rows.length}.`);
assert.equal(new Set(rows.map((row) => row.actorId)).size, 53, "Voice-plan actor IDs must be unique.");

const requestedActorIds = new Set(process.argv.slice(2));
assert.equal(requestedActorIds.size, process.argv.length - 2, "Actor IDs passed on the command line must be unique.");
for (const actorId of requestedActorIds) assert(rows.some((row) => row.actorId === actorId), `Unknown actor ID ${actorId}.`);
const rowsToGenerate = requestedActorIds.size ? rows.filter((row) => requestedActorIds.has(row.actorId)) : rows;

const presetResponse = await fetch(presetCatalogUrl, { headers: { "User-Agent": "Aidreamcapes voice asset generator" } });
if (!presetResponse.ok) throw new Error(`Could not load Buming preset voices (${presetResponse.status}).`);
const presetPayload = await presetResponse.json();
const presets = presetPayload?.data;
assert(Array.isArray(presets), "Buming preset voice directory did not return a data list.");
const femalePresets = presets.filter((voice) => voice.family === "minimax" && voice.gender === "female");
const malePresets = presets.filter((voice) => voice.family === "minimax" && voice.gender === "male");
const selectedVoiceIds = new Set();
for (const row of rows) {
  const pool = row.gender === "female" ? femalePresets : malePresets;
  const position = (row.page - 1) * 15 + row.item;
  const preset = pool[position - 1];
  assert(preset, `${row.actorId}: no voice at the planned ${row.gender} list position ${position}.`);
  const expectedName = row.candidateName === "Assertive Woman" ? "Assetive Woman" : row.candidateName;
  assert.equal(preset.name, expectedName, `${row.actorId}: Buming voice at planned position does not match ${row.candidateName}.`);
  assert.equal(preset.gender, row.gender, `${row.actorId}: selected voice gender must match the character gender.`);
  assert(preset.id, `${row.actorId}: selected Buming preset has no voice ID.`);
  assert(!selectedVoiceIds.has(preset.id), `${row.actorId}: duplicate preset voice ID ${preset.id}.`);
  selectedVoiceIds.add(preset.id);
  row.preset = preset;
}

let manifest = {
  version: "aidreamcapes-ugc-voice-assets-v1",
  provider: "Buming TokenGo",
  model: "speech-2.8",
  settings: { version: "2.8", tier: "turbo", speed: 1, pitch: 0, emotion: "auto", sound_effects: "none", responseFormat: "mp3" },
  actors: {}
};
try {
  const existingManifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  manifest = { ...manifest, ...existingManifest, actors: existingManifest.actors ?? {} };
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await fs.mkdir(outputDir, { recursive: true });

let writeQueue = Promise.resolve();
function persistManifest() {
  writeQueue = writeQueue.then(async () => {
    const temp = `${manifestPath}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await fs.rename(temp, manifestPath);
  });
  return writeQueue;
}

function resolvePublicPath(assetUrl) {
  return path.join(root, "public", assetUrl.replace(/^\//, ""));
}

async function generateOne(row) {
  const assetUrl = `/assets/sites/site_aidreamcapes/workspace/actors/voices/${row.actorId}.mp3`;
  const outputPath = resolvePublicPath(assetUrl);
  const prior = manifest.actors[row.actorId];
  if (prior?.assetUrl === assetUrl && prior.voiceId === row.preset.id && prior.sampleLine === row.card.line) {
    try {
      const existing = await fs.readFile(outputPath);
      if (existing.length > 4096 && existing.subarray(0, 3).toString("ascii") === "ID3") {
        console.log(`SKIP ${row.actorId} ${row.name}: existing MP3 asset is valid.`);
        return { actorId: row.actorId, ok: true, skipped: true };
      }
    } catch {}
  }

  const body = {
    model: "speech-2.8",
    input: row.card.line,
    voice: row.preset.id,
    version: "2.8",
    tier: "turbo",
    speed: 1,
    pitch: 0,
    emotion: "auto",
    sound_effects: "none"
  };
  const request = new Request(`${apiBase}/v1/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  let response;
  let audioBytes;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(request.clone());
      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && contentType.startsWith("audio/")) {
        audioBytes = Buffer.from(await response.arrayBuffer());
        break;
      }
      const text = await response.text();
      let explanation = text.slice(0, 500);
      try {
        const parsed = JSON.parse(text);
        explanation = parsed?.error?.message ?? parsed?.message ?? parsed?.detail ?? explanation;
      } catch {}
      explanation = String(explanation).replaceAll(apiKey, "[redacted]");
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 2000));
        continue;
      }
      throw new Error(`Buming returned HTTP ${response.status}: ${explanation}`);
    } catch (error) {
      if (attempt < 2 && !(error instanceof Error && error.message.startsWith("Buming returned HTTP 4"))) {
        await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 2000));
        continue;
      }
      throw error;
    }
  }

  assert(audioBytes?.length > 4096, `${row.actorId}: empty or incomplete TTS audio response.`);
  assert(audioBytes.subarray(0, 3).toString("ascii") === "ID3", `${row.actorId}: response is not an MP3 file.`);
  const temp = `${outputPath}.tmp`;
  await fs.writeFile(temp, audioBytes);
  await fs.rename(temp, outputPath);

  manifest.actors[row.actorId] = {
    name: row.name,
    gender: row.gender,
    voiceGender: row.preset.gender,
    candidateName: row.candidateName,
    voiceName: row.preset.name,
    voiceId: row.preset.id,
    voiceLanguage: row.preset.language,
    voiceAgeBand: row.preset.age_band,
    voicePosition: { genderPage: row.page, item: row.item },
    sampleLine: row.card.line,
    assetUrl,
    mimeType: response.headers.get("content-type") ?? "audio/mpeg",
    bytes: audioBytes.length,
    generatedAt: new Date().toISOString()
  };
  await persistManifest();
  console.log(`OK ${row.actorId} ${row.name}: ${row.preset.name} (${row.preset.gender}, ${row.preset.language}), ${audioBytes.length} bytes.`);
  return { actorId: row.actorId, ok: true };
}

let nextIndex = 0;
const results = [];
const workerCount = Math.min(3, rowsToGenerate.length);
await Promise.all(Array.from({ length: workerCount }, async () => {
  while (nextIndex < rowsToGenerate.length) {
    const row = rowsToGenerate[nextIndex++];
    try {
      results.push(await generateOne(row));
    } catch (error) {
      const message = String(error?.message ?? error).replaceAll(apiKey, "[redacted]");
      console.error(`FAIL ${row.actorId} ${row.name}: ${message}`);
      results.push({ actorId: row.actorId, ok: false });
    }
  }
}));
await writeQueue;

execFileSync(process.execPath, [catalogBuilderPath], { cwd: root, stdio: "ignore" });
const okCount = results.filter((result) => result.ok).length;
const failed = results.filter((result) => !result.ok).map((result) => result.actorId);
console.log(JSON.stringify({ generatedOrSkipped: okCount, expected: rowsToGenerate.length, failed, manifestPath, outputDir }, null, 2));
if (failed.length) process.exitCode = 1;
