#!/usr/bin/env node
import fs from "node:fs";

const statePath = "data/platform-state.json";
const write = process.argv.includes("--write");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const site = state.sites?.find((candidate) => candidate.id === "site_dreamshoot");
if (!site) throw new Error("site_dreamshoot not found");
const page = site.pages?.find((candidate) => candidate.slug === "/best-packages");
if (!page?.draftJson?.sections) throw new Error("/best-packages draft page not found");
const section = Object.values(page.draftJson.sections).find((candidate) => candidate.type === "dreamshoot_featured_pack" && Array.isArray(candidate.blocks) && candidate.blocks.some((block) => /^seasonal_worldcup_[1-6]$/.test(block.id)));
if (!section) throw new Error("World Cup featured source section not found");
const changed = [];
for (const block of section.blocks) {
  if (!/^seasonal_worldcup_[1-6]$/.test(block.id)) continue;
  if (block.settings.collectionSlug !== "soccer") {
    changed.push({ id: block.id, from: block.settings.collectionSlug ?? null, to: "soccer" });
    block.settings.collectionSlug = "soccer";
  }
}
if (write && changed.length) fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, write, changed, note: write ? "draftJson only; publish through the formal publication service" : "dry-run; no source state changed" }, null, 2));
