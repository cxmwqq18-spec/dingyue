#!/usr/bin/env node
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SITE_ID = "site_dreamshoot";
const LEGACY_SLUGS = [
  "cinematic-portrait-motion",
  "social-profile-clip",
  "travel-route-story",
  "wedding-memory-film",
  "holiday-card-motion",
  "product-showcase-motion",
  "prompt-directed-motion",
  "creator-intro-motion"
];
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const updateDb = args.has("--db");
const now = new Date().toISOString();

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function legacyRows(state) {
  return (state.videoThemes ?? []).filter((row) => row.siteId === SITE_ID && LEGACY_SLUGS.includes(row.slug));
}

function nextLegacyRow(row) {
  return {
    ...row,
    status: "paused",
    legacyStatus: "legacy",
    legacyOriginalStatus: row.legacyOriginalStatus ?? (row.legacyStatus === "legacy" && row.status === "paused" ? "active" : row.status),
    legacyReason: "replaced-by-ai-video-generation-route",
    legacyUpdatedAt: now,
    updatedAt: now
  };
}

let database = { requested: updateDb, applied: false, rows: [] };
if (updateDb && !apply) throw new Error("--db requires --apply");
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("cleanup requires DATABASE_URL");
if (apply) {
  const databaseHost = new URL(databaseUrl).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(databaseHost)) {
    throw new Error("--apply is restricted to a local database host");
  }
}

const prisma = new PrismaClient();
try {
  const document = await prisma.platformStateDocument.findUnique({ where: { id: "platform" } });
  assert.ok(document?.state && typeof document.state === "object", "PostgreSQL platform state document must exist");
  const state = cloneJson(document.state);
  const rows = legacyRows(state);
  assert.equal(rows.length, LEGACY_SLUGS.length, "expected exactly the known legacy MyDreamShoots video themes");
  const activeRows = rows.filter((row) => row.status === "active");
  const changedRows = activeRows.map((row) => ({ id: row.id, slug: row.slug, from: row.status, to: "paused" }));

  await prisma.$transaction(async (tx) => {
    if (apply) {
      const legacyIds = new Set(rows.map((row) => row.id));
      state.videoThemes = (state.videoThemes ?? []).map((row) => legacyIds.has(row.id) ? nextLegacyRow(row) : row);
      await tx.platformStateDocument.update({ where: { id: "platform" }, data: { state } });
    }
    if (!updateDb) return;
    const existing = await tx.videoTheme.findMany({
      where: { siteId: SITE_ID, slug: { in: LEGACY_SLUGS } },
      select: { id: true, slug: true, status: true }
    });
    assert.equal(existing.length, LEGACY_SLUGS.length, "database must contain all known legacy video themes before --db apply");
    for (const row of existing) {
      await tx.videoTheme.update({
        where: { id: row.id },
        data: { status: "paused" },
        select: { id: true, slug: true, status: true }
      });
    }
    database = { requested: true, applied: true, rows: existing.map((row) => ({ id: row.id, slug: row.slug, from: row.status, to: "paused" })) };
  });

  console.log(JSON.stringify({
    ok: true,
    apply,
    stateSource: "postgres",
    siteId: SITE_ID,
    legacyRows: rows.map((row) => ({ id: row.id, slug: row.slug, status: row.status, legacyStatus: row.legacyStatus ?? null })),
    changedRows,
    activeAfter: apply ? 0 : activeRows.length,
    database
  }, null, 2));
} finally {
  await prisma.$disconnect().catch(() => {});
}
