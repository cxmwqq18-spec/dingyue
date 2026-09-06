#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

assertDatabaseTarget({ expectedTarget: "local" });
const siteId = "site_dreamshoot";
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const prisma = new PrismaClient();
const backupRoot = path.join(process.cwd(), "releases", "backups");

const policySources = [
  ["/privacy", "/policies/privacy", "Privacy policy"],
  ["/terms", "/policies/terms", "Terms of Service"],
  ["/cookies", "/policies/cookies", "Cookie policy"],
  ["/refunds", "/policies/refunds", "Refund policy"],
  ["/content", "/policies/content", "Content policy"],
  ["/digital-delivery", "/policies/shipping", "Digital Delivery Policy"],
  ["/children-privacy", "/policies/children-privacy", "Children's Privacy"],
  ["/state-privacy", "/policies/state-privacy", "State Privacy"]
];

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function pageJsonFor(source, canonicalPath) {
  const json = clone(source.draftJson ?? source.publishedJson ?? {});
  json.seo = {
    ...(json.seo ?? {}),
    title: json.seo?.title || source.title,
    description: json.seo?.description || `${source.title} for myDreamshoots customers and private AI photo workflows.`,
    canonicalPath,
    canonical: canonicalPath,
    index: true,
    follow: true,
    robots: { ...(json.seo?.robots ?? {}), index: true, follow: true }
  };
  return json;
}

try {
  const pages = await prisma.themePage.findMany({ where: { siteId } });
  const bySlug = new Map(pages.map((page) => [page.slug, page]));
  const changes = [];
  for (const [canonicalPath, sourcePath, fallbackTitle] of policySources) {
    const source = bySlug.get(sourcePath) ?? bySlug.get(canonicalPath);
    if (!source) throw new Error(`missing policy source: ${sourcePath}`);
    const nextJson = pageJsonFor(source, canonicalPath);
    const current = bySlug.get(canonicalPath);
    changes.push({ canonicalPath, sourcePath, source, current, nextJson, title: current?.title || fallbackTitle });
  }
  const backupPath = path.join(backupRoot, `mydreamshoots-policy-pages-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  if (apply) {
    fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId, pages: changes.map(({ current, canonicalPath }) => ({ canonicalPath, page: current })) }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      for (const item of changes) {
        const data = { siteId, pageType: "policy", templateKey: item.source.templateKey || item.source.pageType || "policy", slug: item.canonicalPath, title: item.title, draftJson: item.nextJson, publishedJson: {}, updatedAt: new Date() };
        if (item.current) await tx.themePage.update({ where: { id: item.current.id }, data });
        else await tx.themePage.create({ data: { id: `${siteId}_policy_${item.canonicalPath.slice(1).replace(/[^a-z0-9]+/gi, "_")}`, ...data, createdAt: new Date() } });
      }
    });
  }
  console.log(JSON.stringify({ ok: true, mode: apply ? "applied" : "dry-run", siteId, paths: changes.map((item) => item.canonicalPath), backupPath: apply ? backupPath : undefined }, null, 2));
} finally {
  await prisma.$disconnect();
}
