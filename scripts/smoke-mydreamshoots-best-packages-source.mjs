#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const state = JSON.parse(fs.readFileSync("data/platform-state.json", "utf8"));
const page = state.sites?.find((candidate) => candidate.id === "site_dreamshoot")?.pages?.find((candidate) => candidate.slug === "/best-packages");
assert.ok(page, "MyDreamShoots /best-packages source page is required");
const blocks = Object.values(page.draftJson?.sections ?? {}).flatMap((section) => Array.isArray(section.blocks) ? section.blocks : []);
const worldCup = blocks.filter((block) => /^seasonal_worldcup_[1-6]$/.test(block.id));
assert.equal(worldCup.length, 6, "all six World Cup source cards must exist");
assert.ok(worldCup.every((block) => block.settings?.collectionSlug === "soccer"), "all World Cup source cards must target soccer");
console.log(JSON.stringify({ ok: true, source: "draftJson", worldCupCards: worldCup.length, collectionSlug: "soccer" }, null, 2));
