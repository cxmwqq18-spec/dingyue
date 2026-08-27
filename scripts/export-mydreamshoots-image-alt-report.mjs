#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const output = path.resolve(
  process.argv.find((argument) => argument.startsWith("--output="))?.slice("--output=".length)
    || "artifacts/reports/mydreamshoots-image-alt-report.md"
);
const siteId = "site_dreamshoot";
const prisma = new PrismaClient();

function groupFor(storageKey) {
  const match = storageKey.match(/^\/?assets\/dreamshoot\/([^/]+)/);
  return match?.[1] || "other";
}

function markdown(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ").trim();
}

try {
  const assets = await prisma.mediaAsset.findMany({
    where: { siteId, mimeType: { startsWith: "image/" } },
    select: { storageKey: true, altText: true, usageType: true, sourceType: true },
    orderBy: { storageKey: "asc" }
  });
  const groups = new Map();
  for (const asset of assets) {
    const group = groupFor(asset.storageKey);
    const list = groups.get(group) ?? [];
    list.push(asset);
    groups.set(group, list);
  }
  const lengths = assets.map((asset) => asset.altText?.length ?? 0).sort((left, right) => left - right);
  const median = lengths[Math.floor(lengths.length / 2)] ?? 0;
  const lines = [
    "# MyDreamShoots Image Alt Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    `- Image records: ${assets.length}`,
    `- Empty alt text: ${assets.filter((asset) => !asset.altText?.trim()).length}`,
    `- Alt length: ${lengths[0] ?? 0}-${lengths.at(-1) ?? 0} characters; median ${median}`,
    ""
  ];
  for (const [group, entries] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    lines.push(`## ${group} (${entries.length})`, "", "| Resource | Alt text | Usage | Source |", "| --- | --- | --- | --- |");
    for (const asset of entries) {
      lines.push(`| \`${markdown(asset.storageKey)}\` | ${markdown(asset.altText)} | ${markdown(asset.usageType)} | ${markdown(asset.sourceType)} |`);
    }
    lines.push("");
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${lines.join("\n")}\n`);
  console.log(JSON.stringify({ ok: true, output, images: assets.length, groups: Object.fromEntries([...groups].map(([group, entries]) => [group, entries.length])) }, null, 2));
} finally {
  await prisma.$disconnect();
}
