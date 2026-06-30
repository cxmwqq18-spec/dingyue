#!/usr/bin/env node
import fs from "node:fs";

const statePath = new URL("../data/platform-state.json", import.meta.url);
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

const replacements = new Map([
  ["Upload selfies and create your own private AI model.|Themed photo packages from headshots to football fan photos.|Gala, cyberpunk, travel, beauty, and profile packs.|Magic upscaler, AI video concepts, and style preview flows.", "Upload selfies and create your own private AI model.|Themed photo packages from headshots to football fan photos.|Gala, cyberpunk, lifestyle, beauty, and profile packs.|Magic upscaler, AI video concepts, and style preview flows."],
  ["All|Headshots|Beauty|Creative|Sports|Creator|Avatar|Wedding|Cultural|Couple|Boudoir|Seasonal|Travel|Video|Utility", "All|Headshots|Beauty|Creative|Sports|Creator|Avatar|Wedding|Cultural|Couple|Boudoir|Seasonal|Lifestyle|Video|Utility"],
  ["All|Headshots|Beauty|Creative|Sports|Creator|Avatar|Travel|Cultural|Seasonal|Video|Utility", "All|Headshots|Beauty|Creative|Sports|Creator|Avatar|Lifestyle|Cultural|Seasonal|Video|Utility"],
  ["I tried free tools first, then upgraded when I needed a private model and a full travel scene pack.", "I tried free tools first, then upgraded when I needed a private model and a full creator lifestyle pack."],
  ["I tried studio tools first, then upgraded when I needed a private model and a full travel scene pack.", "I tried studio tools first, then upgraded when I needed a private model and a full creator lifestyle pack."],
  ["Travel buyer", "Lifestyle pack buyer"],
  ["Advanced packages need a customer model so results can stay consistent across headshots, gala, travel, and style sets.", "Advanced packages need a customer model so results can stay consistent across headshots, gala, lifestyle, and style sets."],
  ["Cyberpunk, mafia, nature, travel, gala, and dramatic themed photos.", "Cyberpunk, mafia, nature, gala, and dramatic themed photos."],
  ["Each sample shows a clear use case, from headshots and fan photos to travel looks and private albums.", "Each sample shows a clear use case, from headshots and fan photos to lifestyle looks and private albums."],
  ["Place the customer in scenic outdoor, hiking, and travel-inspired scenes.", "Place the customer in outdoor, hiking, fitness, and creator lifestyle scenes."],
  ["MydreamShoots travel scene", "MydreamShoots lifestyle scene"],
  ["destination-travel", "creator-lifestyle"]
]);

let changeCount = 0;

function isDreamshootContext(path) {
  let node = state;
  for (const key of path) {
    if (node == null) return false;
    node = node[key];
    if (node && typeof node === "object" && (node.siteId === "site_dreamshoot" || node.targetId === "site_dreamshoot")) {
      return true;
    }
  }
  return false;
}

function applyString(value) {
  let next = value;
  for (const [from, to] of replacements) {
    if (next.includes(from)) {
      next = next.split(from).join(to);
    }
  }
  if (next !== value) changeCount += 1;
  return next;
}

function walk(node, path = []) {
  if (typeof node === "string") {
    if (isDreamshootContext(path.slice(0, -1))) {
      return applyString(node);
    }
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((item, index) => walk(item, path.concat(index)));
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      node[key] = walk(value, path.concat(key));
    }
  }
  return node;
}

walk(state);

fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
console.log(`Synced MyDreamShoots SEO isolation strings: ${changeCount} string fields updated.`);
