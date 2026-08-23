#!/usr/bin/env node
import { readPlatformStateFromSql, writePlatformStateToSql } from "./lib/platform-state-sql.mjs";

const state = await readPlatformStateFromSql();
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
await writePlatformStateToSql(state);
console.log(`Synced MyDreamShoots brand text: ${changeCount} string fields updated.`);
