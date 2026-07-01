#!/usr/bin/env node
import fs from "node:fs";

const statePath = new URL("../data/platform-state.json", import.meta.url);
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
let changeCount = 0;

function normalizeBrandText(value) {
  const next = value.replace(/MydreamShoots/g, "MyDreamShoots").replace(/Mydreamshoots/g, "MyDreamShoots");
  if (next !== value) changeCount += 1;
  return next;
}

function walk(node) {
  if (typeof node === "string") return normalizeBrandText(node);
  if (Array.isArray(node)) return node.map(walk);
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      node[key] = walk(value);
    }
  }
  return node;
}

walk(state);
fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
console.log(`Synced MyDreamShoots brand text: ${changeCount} string fields updated.`);
