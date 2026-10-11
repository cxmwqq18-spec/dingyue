#!/usr/bin/env node
/**
 * Inject the shared 19-category template wall into Aidreamcapes v2 content.
 *
 * The wall is source data, so this command is deliberately repeatable:
 * `--check` reports pages whose chips/cards differ without writing anything.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(scriptDir, "data", "aidreamcapes-site-v2", "content");
const wallPath = path.join(scriptDir, "data", "aidreamcapes-site-v2", "template-wall.json");
const checkOnly = process.argv.includes("--check");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function validateWall(wall) {
  if (!wall || typeof wall !== "object" || Array.isArray(wall)) throw new Error("template-wall.json must contain an object");
  if (!Array.isArray(wall.chips) || wall.chips.length !== 19) throw new Error("template wall must contain 19 chips");
  if (!Array.isArray(wall.cards) || wall.cards.length !== 37) throw new Error("template wall must contain 37 cards");
  const chipIds = wall.chips.map((chip) => String(chip?.id ?? ""));
  if (new Set(chipIds).size !== chipIds.length || chipIds.some((id) => !id)) throw new Error("template wall chip ids must be unique and non-empty");
  for (const [index, card] of wall.cards.entries()) {
    for (const field of ["ref", "label", "prompt", "kind"]) {
      if (typeof card?.[field] !== "string" || !card[field].trim()) throw new Error(`template wall card ${index + 1} is missing ${field}`);
    }
    if (!Array.isArray(card.chips) || !card.chips.length || card.chips.some((id) => !chipIds.includes(id))) {
      throw new Error(`template wall card ${index + 1} has an unknown or missing chip`);
    }
    if (Object.prototype.hasOwnProperty.call(card, "competitor")) throw new Error(`template wall card ${index + 1} contains internal competitor data`);
  }
}

function targetFiles() {
  const files = ["templates.json", "video-ads.json"];
  const templatePages = fs.readdirSync(contentDir)
    .filter((name) => /^tpl-[^/]+\.json$/u.test(name))
    .sort();
  return files.concat(templatePages).map((name) => path.join(contentDir, name));
}

function withWall(content, wall) {
  if (!content.visual || typeof content.visual !== "object" || Array.isArray(content.visual)) {
    throw new Error(`${content.id ?? "unknown"}: visual must be an object`);
  }
  const picker = Array.isArray(content.visual.picker) || !content.visual.picker || typeof content.visual.picker !== "object"
    ? {}
    : content.visual.picker;
  content.visual.picker = picker;
  picker.chips = wall.chips.map((chip) => ({ id: chip.id, label: chip.label }));
  picker.cards = wall.cards.map((card) => ({ ref: card.ref, label: card.label, chips: [...card.chips], prompt: card.prompt, kind: card.kind }));
  return content;
}

const wall = readJson(wallPath);
validateWall(wall);
const files = targetFiles();
const changed = [];
for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  const content = readJson(file);
  withWall(content, wall);
  const after = `${JSON.stringify(content, null, 2)}\n`;
  if (before !== after) {
    changed.push(path.relative(process.cwd(), file));
    if (!checkOnly) fs.writeFileSync(file, after, "utf8");
  }
}

if (checkOnly) {
  if (changed.length) {
    console.log(`template wall differs on ${changed.length} page(s):`);
    for (const file of changed) console.log(`- ${file}`);
    process.exitCode = 1;
  } else {
    console.log(`template wall is up to date on ${files.length} pages`);
  }
} else {
  console.log(changed.length ? `updated ${changed.length} page(s)` : `template wall already up to date on ${files.length} pages`);
  for (const file of changed) console.log(`- ${file}`);
}
