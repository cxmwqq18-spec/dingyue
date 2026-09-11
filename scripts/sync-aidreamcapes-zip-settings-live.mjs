#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const SITE_ID = "site_aidreamcapes";
const apply = process.argv.includes("--apply");
const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));

function assertLocalDatabase() {
  const value = process.env.DATABASE_URL;
  assert(value, "DATABASE_URL is required");
  const hostname = new URL(value).hostname;
  assert(["127.0.0.1", "localhost", "::1"].includes(hostname), `Refusing non-local database: ${hostname}`);
}

function mergeZipSettings(published, draft) {
  const next = clone(published);
  next.aidreamcapesZipNavigation = clone(draft.aidreamcapesZipNavigation);
  next.globalSections = {
    ...(next.globalSections ?? {}),
    footer: clone(draft.globalSections?.footer)
  };
  next.colors = { ...(next.colors ?? {}), ...(draft.colors ?? {}) };
  next.radii = { ...(next.radii ?? {}), ...(draft.radii ?? {}) };
  next.typography = { ...(next.typography ?? {}), ...(draft.typography ?? {}) };
  next.saasSettingsCurrent = { ...(next.saasSettingsCurrent ?? {}), ...(draft.saasSettingsCurrent ?? {}) };
  next.seo = {
    ...(next.seo ?? {}),
    pages: {
      ...(next.seo?.pages ?? {}),
      site_aidreamcapes_home: clone(draft.seo?.pages?.site_aidreamcapes_home)
    }
  };
  return next;
}

const prisma = new PrismaClient();
try {
  if (apply) assertLocalDatabase();
  const [site, settings] = await Promise.all([
    prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { id: true, siteId: true, draftJson: true, publishedJson: true } })
  ]);
  assert(site, `site not found: ${SITE_ID}`);
  assert.equal(site.slug, "aidreamcapes");
  assert(["aidreamcapes.com", "www.aidreamcapes.com"].includes(site.primaryDomain), `unexpected Aidreamcapes domain: ${site.primaryDomain}`);
  assert(settings, "Aidreamcapes ThemeSettings is required");
  assert(settings.draftJson?.aidreamcapesZipNavigation, "draft ZIP navigation is missing; run the homepage migration first");
  assert(settings.draftJson?.globalSections?.footer, "draft ZIP footer is missing; run the homepage migration first");

  const nextPublished = mergeZipSettings(settings.publishedJson, settings.draftJson);
  const changed = JSON.stringify(nextPublished) !== JSON.stringify(settings.publishedJson);
  const report = {
    ok: true,
    mode: apply ? "apply" : "dry-run",
    scope: { siteId: SITE_ID, siteSlug: site.slug, domain: site.primaryDomain },
    target: { settingsId: settings.id, target: "ThemeSettings.publishedJson" },
    changed,
    before: {
      hasZipNavigation: Boolean(settings.publishedJson?.aidreamcapesZipNavigation),
      footerTitle: settings.publishedJson?.globalSections?.footer?.settings?.title ?? null
    },
    after: {
      hasZipNavigation: Boolean(nextPublished.aidreamcapesZipNavigation),
      footerTitle: nextPublished.globalSections?.footer?.settings?.title ?? null,
      navigationActions: nextPublished.aidreamcapesZipNavigation?.actions ?? null
    },
    backupPath: null
  };

  if (apply && changed) {
    const backupPath = path.join(process.cwd(), "releases", "backups", "aidreamcapes", `settings-live-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId: SITE_ID, settings }, null, 2)}\n`, { mode: 0o600 });
    report.backupPath = backupPath;
    await prisma.$transaction((tx) => tx.themeSettings.update({ where: { siteId: SITE_ID }, data: { publishedJson: nextPublished, updatedAt: new Date() } }));
    const readback = await prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { siteId: true, publishedJson: true } });
    assert.equal(readback?.siteId, SITE_ID);
    assert.deepEqual(readback?.publishedJson?.aidreamcapesZipNavigation?.actions, nextPublished.aidreamcapesZipNavigation.actions);
    assert.equal(readback?.publishedJson?.globalSections?.footer?.settings?.title, nextPublished.globalSections.footer.settings.title);
    report.readback = {
      hasZipNavigation: Boolean(readback?.publishedJson?.aidreamcapesZipNavigation),
      footerTitle: readback?.publishedJson?.globalSections?.footer?.settings?.title ?? null
    };
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
