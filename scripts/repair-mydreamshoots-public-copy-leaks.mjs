#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_dreamshoot";
const apply = process.argv.includes("--db");
const backupDir = path.resolve(process.env.MYDREAMSHOOTS_COPY_BACKUP_DIR || "/tmp/mydreamshoots-copy-backups");
const internalCopyPattern = /\b(?:search intent|query ownership|keyword ownership|indexation|do not index|before launch)\b/i;

function transform(value) {
  if (typeof value === "string") {
    const next = value
      .replace(/search intent/gi, "topic focus")
      .replace(/query ownership/gi, "topic focus")
      .replace(/keyword ownership/gi, "topic focus")
      .replace(/indexation/gi, "publishing")
      .replace(/do not index/gi, "keep this page focused")
      .replace(/before launch/gi, "before publishing")
      .replace(/,?\s*used as a feeding-routine visual reference without nutrition claims/gi, "")
      .replace(/,?\s*feeding-routine visual reference/gi, "")
    return next === value ? value : next.replace(/\s+/g, " ").trim();
  }
  if (Array.isArray(value)) return value.map(transform);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, transform(child)]));
  return value;
}

function collectLeaks(value, location = "root", rows = []) {
  if (typeof value === "string") {
    if (internalCopyPattern.test(value)) rows.push({ location, value });
    return rows;
  }
  if (Array.isArray(value)) return value.flatMap((child, index) => collectLeaks(child, `${location}[${index}]`, rows));
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) collectLeaks(child, `${location}.${key}`, rows);
  }
  return rows;
}

function diffValues(before, after, location = "", rows = []) {
  if (Object.is(before, after)) return rows;
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      diffValues(before[index], after[index], `${location}/${index}`, rows);
    }
    return rows;
  }
  if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const escaped = String(key).replace(/~/g, "~0").replace(/\//g, "~1");
      diffValues(before[key], after[key], `${location}/${escaped}`, rows);
    }
    return rows;
  }
  rows.push({ path: location || "/", before, after });
  return rows;
}

const prisma = new PrismaClient();
try {
  const pages = await prisma.themePage.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } });
  const changed = [];
  const beforeLeaks = [];
  const afterPages = pages.map((page) => {
    const draftJson = transform(page.draftJson);
    const publishedJson = transform(page.publishedJson);
    beforeLeaks.push(...collectLeaks(page.draftJson, `${page.id}.draftJson`), ...collectLeaks(page.publishedJson, `${page.id}.publishedJson`));
    if (JSON.stringify(draftJson) !== JSON.stringify(page.draftJson) || JSON.stringify(publishedJson) !== JSON.stringify(page.publishedJson)) {
      changed.push({ id: page.id, slug: page.slug });
    }
    return { ...page, draftJson, publishedJson };
  });
  const remainingLeaks = afterPages.flatMap((page) => [
    ...collectLeaks(page.draftJson, `${page.id}.draftJson`),
    ...collectLeaks(page.publishedJson, `${page.id}.publishedJson`)
  ]);
  let backupPath = null;
  if (apply && changed.length) {
    assertNonProductionWriteTarget();
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    backupPath = path.join(backupDir, `${SITE_ID}-copy-inverse-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    const inverseManifest = changed.map(({ id, slug }) => {
      const before = pages.find((page) => page.id === id);
      const after = afterPages.find((page) => page.id === id);
      return {
        id,
        slug,
        fields: [
          ...diffValues(before?.draftJson, after?.draftJson, "/draftJson"),
          ...diffValues(before?.publishedJson, after?.publishedJson, "/publishedJson")
        ]
      };
    });
    fs.writeFileSync(backupPath, `${JSON.stringify({
      createdAt: new Date().toISOString(),
      siteId: SITE_ID,
      operation: "repair-public-copy-leaks",
      changes: inverseManifest
    }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(afterPages.filter((page) => changed.some((row) => row.id === page.id)).map((page) => prisma.themePage.update({ where: { id: page.id }, data: { draftJson: page.draftJson, publishedJson: page.publishedJson } })));
  }
  console.log(JSON.stringify({ ok: remainingLeaks.length === 0, siteId: SITE_ID, mode: apply ? "apply" : "dry-run", pageCount: pages.length, changedPages: changed.length, beforeLeaks: beforeLeaks.length, afterLeaks: remainingLeaks.length, backupPath }, null, 2));
  if (remainingLeaks.length) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
