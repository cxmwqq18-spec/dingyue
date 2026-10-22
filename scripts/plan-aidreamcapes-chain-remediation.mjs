// Field-level plan only. Reads current relational rows; never writes content.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget } from "./lib/database-target.mjs";
import { aidreamcapesAuditLoader } from "./lib/aidreamcapes-typescript-audit-loader.mjs";

const target = argumentValue("--target") || "local";
assertDatabaseTarget({ expectedTarget: target });
const siteId = "site_aidreamcapes";
const db = new PrismaClient();
const hash = (v) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
const load = aidreamcapesAuditLoader({ "@/lib/prisma": { prisma: db } });
const { presetFromCard, presetGenerationIdentity } = load("src/lib/aidreamcapes-workspace/presets.server.ts");
const redirects = new Map(JSON.parse(fs.readFileSync("src/lib/aidreamcapes-site-v2-redirects.json", "utf8")));
const out = argumentValue("--out") || `releases/aidreamcapes/chain-remediation-20261022/fields-${target}.json`;
const ptr = (value) => String(value).replaceAll("~", "~0").replaceAll("/", "~1");
function groupBy(values, keyOf) {
  const groups = new Map();
  for (const value of values) { const key = keyOf(value), group = groups.get(key) || []; group.push(value); groups.set(key, group); }
  return groups;
}
try {
  const rows = await db.livePage.findMany({ where: { siteId }, select: { id: true, slug: true, contentJson: true, updatedAt: true }, orderBy: { slug: "asc" } });
  const pagePaths = new Set(rows.map((row) => row.slug));
  const operations = [], cards = [], held = [];
  function add(row, path, parent, key, after, reason, guards = []) {
    const exists = Object.hasOwn(parent, key);
    if (exists && JSON.stringify(parent[key]) === JSON.stringify(after)) return;
    operations.push({ pageId: row.id, pageSlug: row.slug, path, before: { exists, ...(exists ? { value: parent[key] } : {}) }, after, reason, guards });
  }
  function finalTarget(href) {
    const match = href.match(/^(?:(https:\/\/(?:www\.)?(?:aivideosugc|aidreamcapes)\.com))?(\/[^?#]*)([?#].*)?$/);
    if (!match) return;
    let path = match[2], seen = new Set();
    while (redirects.has(path) && !seen.has(path)) { seen.add(path); path = redirects.get(path); }
    if (!seen.size || redirects.has(path) || !pagePaths.has(path)) return;
    return `${match[1] ? "https://www.aivideosugc.com" : ""}${path}${match[3] || ""}`;
  }
  function walk(row, value, path = "") {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}/${ptr(key)}`;
      if (key === "href" && typeof child === "string") {
        const after = finalTarget(child);
        if (after) add(row, childPath, value, key, after, "direct-current-public-link");
      }
      walk(row, child, childPath);
    }
  }
  function card(row, value, path, source) {
    if (!value?.publicSlug || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(value.publicSlug)) return;
    const preset = presetFromCard(row, row.slug, value);
    const generation = presetGenerationIdentity(preset);
    const kind = value.kind === "photo" ? "photo" : ["video", "clip", "scene"].includes(value.kind) ? "video" : undefined;
    if (!kind || !value.image?.src) return;
    const mediaKey = JSON.stringify([kind, value.video?.src || null, value.image.src]);
    cards.push({ row, value, path, source, kind, mediaKey, generation, semanticHash: generation ? hash([mediaKey, generation]) : null });
  }
  for (const row of rows) {
    walk(row, row.contentJson);
    for (const sectionId of row.contentJson?.sectionsOrder || []) {
      const section = row.contentJson.sections?.[sectionId];
      if (section?.type !== "aidreamcapes_v2_page") continue;
      const data = section.settings?.data, base = `/sections/${ptr(sectionId)}/settings/data`;
      if (data?.templateDefinition?.card) card(row, data.templateDefinition.card, `${base}/templateDefinition/card`, "template");
      for (const [index, value] of (data?.visual?.picker?.cards || []).entries()) card(row, value, `${base}/visual/picker/cards/${index}`, "picker");
      for (const [index, value] of (data?.workspaceCases || []).entries()) card(row, value, `${base}/workspaceCases/${index}`, "case");
      for (const [groupIndex, group] of (data?.examples?.groups || []).entries())
        for (const [index, value] of (group.items || []).entries()) card(row, value, `${base}/examples/groups/${groupIndex}/items/${index}`, "example");
    }
  }
  const slugOwners = new Map();
  for (const entry of cards) { const owners = slugOwners.get(entry.value.publicSlug) || new Set(); owners.add(entry.row.id); slugOwners.set(entry.value.publicSlug, owners); }
  const groups = groupBy(cards, (entry) => entry.mediaKey);
  const decisions = [];
  for (const [mediaKey, group] of groups) {
    if (new Set(group.map((entry) => entry.value.publicSlug)).size < 2) continue;
    const variants = groupBy(group, (entry) => entry.semanticHash || `unresolved:${entry.value.publicSlug}`);
    const decision = { mediaKey, cards: group.length, generationVariants: variants.size, canonicals: [], held: [] };
    for (const [semanticHash, variant] of variants) {
      const rank = (entry) => `${entry.source === "picker" ? "0" : entry.source === "template" ? "1" : "2"}|${entry.row.slug === "/ai-video-generation/video-ads" ? "0" : "1"}|${String(entry.value.publicSlug.length).padStart(3, "0")}|${entry.row.slug}|${entry.value.publicSlug}`;
      const candidates = variant.filter((entry) => entry.generation && !entry.value.detailAliasOf && entry.source !== "template"
        && slugOwners.get(entry.value.publicSlug).size === 1
        && !pagePaths.has(`/${entry.kind === "photo" ? "ai-image-generation" : "ai-video-generation"}/${entry.value.publicSlug}`));
      candidates.sort((a,b) => rank(a).localeCompare(rank(b)));
      const primary = candidates[0];
      if (!primary || variant.length < 2) { decision.held.push(...variant.map((entry) => entry.value.publicSlug)); continue; }
      const aliases = [];
      for (const entry of variant) {
        if (entry.value.publicSlug === primary.value.publicSlug || entry.source === "template") continue;
        if (slugOwners.get(entry.value.publicSlug).size !== 1 || entry.value.detailAliasOf && entry.value.detailAliasOf !== primary.value.publicSlug) {
          held.push({ slug: entry.value.publicSlug, reason: "existing-owner-or-canonical-conflict" }); continue;
        }
        const guards = [entry, primary].map((candidate) => ({ pageId: candidate.row.id, path: candidate.path, hash: hash(candidate.value) }));
        add(entry.row, `${entry.path}/detailAliasOf`, entry.value, "detailAliasOf", primary.value.publicSlug, "equal-effective-generation-and-media", guards);
        aliases.push(entry.value.publicSlug);
      }
      decision.canonicals.push({ semanticHash, slug: primary.value.publicSlug, owner: primary.row.slug, aliases });
    }
    decisions.push(decision);
  }
  const payload = { contract: "aidreamcapes-chain-fields-v1", siteId, target, operations };
  const report = { ...payload, planHash: hash(payload), generatedAt: new Date().toISOString(), readOnly: true,
    summary: { pages: new Set(operations.map((op) => op.pageId)).size, fields: operations.length,
      links: operations.filter((op) => op.reason === "direct-current-public-link").length,
      aliases: operations.filter((op) => op.reason === "equal-effective-generation-and-media").length,
      reviewedMediaGroups: decisions.length, preservedVariantSlugs: decisions.flatMap((item) => item.held).length }, decisions, held };
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ok: true, target, out, planHash: report.planHash, summary: report.summary }, null, 2));
} finally { await db.$disconnect(); }
