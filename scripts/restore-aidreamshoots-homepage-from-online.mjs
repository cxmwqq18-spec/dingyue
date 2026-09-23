#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import {
  assertDatabaseTarget,
  buildTunneledReadonlyDatabaseUrl
} from "./lib/database-target.mjs";

const SITE_ID = "site_mydreamshoots_xby";
const SITE_SLUG = "aidreamshoots";
const SITE_DOMAIN = "aidreamshoots.eu";
const APPLY = process.argv.includes("--apply");
const EXPECTED_ORDER = [
  "hero_1",
  "generation_showcase_1",
  "tutorial_video_1",
  "proof_1",
  "faq_1",
  "conversion_1",
  "brand_strip_1"
];

const localDatabaseUrl = process.env.DATABASE_URL;
assertDatabaseTarget({ expectedTarget: "local" });
const remoteDatabaseUrl = buildTunneledReadonlyDatabaseUrl(
  process.env.REMOTE_DB_READONLY_DATABASE_URL,
  { host: "127.0.0.1", port: 15432 }
);
assertDatabaseTarget({
  expectedTarget: "remote-readonly",
  env: {
    ...process.env,
    DINGYUE_ENV: "remote-readonly",
    DATABASE_TARGET: "remote-readonly",
    DATABASE_URL: remoteDatabaseUrl
  }
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assetReferences(value, output = new Set()) {
  if (typeof value === "string") {
    for (const match of value.matchAll(/\/assets\/[^\s"'<>|)]+/g)) {
      output.add(match[0].split(/[?#]/, 1)[0]);
    }
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) assetReferences(item, output);
    return output;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) assetReferences(child, output);
  }
  return output;
}

function assertOnlineHomepageContract(json, label) {
  assert.deepEqual(json?.sectionsOrder, EXPECTED_ORDER, `${label}: online section order is not the current homepage contract`);
  const hero = json?.sections?.hero_1?.settings;
  assert(hero, `${label}: online homepage hero is missing`);
  assert.equal(hero.layout, "immersive_dark", `${label}: online renderer layout is not immersive_dark`);
  assert.match(
    String(hero.imageUrl ?? ""),
    /\/generated\/regenerated\/aidreamshoots-/i,
    `${label}: online hero does not use the current regenerated asset namespace`
  );
  assert.match(
    String(hero.heroGridImages ?? ""),
    /\/generated\/regenerated\/aidreamshoots-/i,
    `${label}: online hero grid does not use the current regenerated asset namespace`
  );
  assert.doesNotMatch(
    String(hero.imageUrl ?? ""),
    /\/visuals\/generated\/20260622-homepage-unique\//i,
    `${label}: legacy 20260622 homepage asset was selected`
  );
}

function assertLocalAssets(value) {
  const missing = [];
  for (const url of assetReferences(value)) {
    const relative = url.replace(/^\//, "");
    const filePath = path.join(process.cwd(), "public", relative);
    if (!relative.startsWith("assets/") || relative.includes("..") || !fs.existsSync(filePath)) {
      missing.push(url);
    }
  }
  assert.equal(
    missing.length,
    0,
    `online homepage references local assets that are missing: ${missing.slice(0, 12).join(", ")}`
  );
}

function rowSummary(row) {
  if (!row) return null;
  return {
    id: row.id,
    updatedAt: row.updatedAt,
    contentHash: hash(row.contentJson ?? row.draftJson ?? row.publishedJson),
    pageType: row.pageType,
    templateKey: row.templateKey,
    title: row.title
  };
}

async function readOnlineSource(remote) {
  const site = await remote.site.findUnique({ where: { id: SITE_ID } });
  assert(site, `online site ${SITE_ID} was not found`);
  assert.equal(site.slug, SITE_SLUG, "online site slug does not match aidreamshoots");
  assert.equal(site.primaryDomain, SITE_DOMAIN, "online site domain does not match aidreamshoots.eu");

  const [live, settings, compatibilityTheme] = await remote.$transaction([
    remote.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/" } } }),
    remote.themeSettings.findUnique({ where: { siteId: SITE_ID } }),
    remote.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/" } } })
  ]);
  assert(live, "online homepage LivePage is missing");
  assert(settings, "online ThemeSettings is missing");
  assert(compatibilityTheme, "online homepage ThemePage is missing");

  // The public runtime reads LivePage.contentJson and ThemeSettings.draftJson.
  // ThemePage is retained as compatibility/editor data and is deliberately not
  // used as the source of the public homepage restore.
  assertOnlineHomepageContract(live.contentJson, "online LivePage");
  assertLocalAssets({ homepage: live.contentJson, settings: settings.draftJson });

  return { site, live, settings, compatibilityTheme };
}

async function readLocalState(local) {
  const [site, live, theme, settings] = await Promise.all([
    local.site.findUnique({ where: { id: SITE_ID } }),
    local.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/" } } }),
    local.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/" } } }),
    local.themeSettings.findUnique({ where: { siteId: SITE_ID } })
  ]);
  assert(site, "local aidreamshoots site is missing");
  assert(live, "local homepage LivePage is missing");
  assert(theme, "local homepage ThemePage is missing");
  assert(settings, "local ThemeSettings is missing");
  return { site, live, theme, settings };
}

function backupPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve("releases/backups/local", `aidreamshoots-homepage-before-online-restore-${stamp}.json`);
}

const remote = new PrismaClient({ datasources: { db: { url: remoteDatabaseUrl } } });
const local = new PrismaClient({ datasources: { db: { url: localDatabaseUrl } } });

try {
  const online = await readOnlineSource(remote);
  const current = await readLocalState(local);
  const summary = {
    source: {
      database: "remote-readonly",
      domain: SITE_DOMAIN,
      livePage: rowSummary(online.live),
      themeSettings: { id: online.settings.id, updatedAt: online.settings.updatedAt, draftHash: hash(online.settings.draftJson), publishedHash: hash(online.settings.publishedJson) },
      compatibilityTheme: rowSummary(online.compatibilityTheme)
    },
    localBefore: {
      livePage: rowSummary(current.live),
      themePage: { id: current.theme.id, updatedAt: current.theme.updatedAt, draftHash: hash(current.theme.draftJson), publishedHash: hash(current.theme.publishedJson) },
      themeSettings: { id: current.settings.id, updatedAt: current.settings.updatedAt, draftHash: hash(current.settings.draftJson), publishedHash: hash(current.settings.publishedJson) }
    },
    apply: APPLY,
    protectedScope: ["LivePage:/", "ThemePage:/", "ThemeSettings"]
  };

  if (!APPLY) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", ...summary }, null, 2));
  } else {
    const rollbackPath = backupPath();
    fs.mkdirSync(path.dirname(rollbackPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      rollbackPath,
      `${JSON.stringify({
        createdAt: new Date().toISOString(),
        source: { database: "remote-readonly", domain: SITE_DOMAIN, liveUpdatedAt: online.live.updatedAt, themeSettingsUpdatedAt: online.settings.updatedAt },
        site: current.site,
        live: current.live,
        theme: current.theme,
        settings: current.settings
      }, null, 2)}\n`,
      { mode: 0o600 }
    );

    await local.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Site" WHERE "id" = ${SITE_ID} FOR UPDATE`;
      await tx.livePage.update({
        where: { id: current.live.id },
        data: {
          pageType: online.live.pageType,
          templateKey: online.live.templateKey,
          title: online.live.title,
          contentJson: clone(online.live.contentJson)
        }
      });
      // Keep the editor/compatibility row aligned with the real public source.
      // Do not copy the stale online ThemePage payload into the live storefront.
      await tx.themePage.update({
        where: { id: current.theme.id },
        data: {
          pageType: online.live.pageType,
          templateKey: online.live.templateKey,
          title: online.live.title,
          draftJson: clone(online.live.contentJson),
          publishedJson: clone(online.live.contentJson)
        }
      });
      await tx.themeSettings.update({
        where: { id: current.settings.id },
        data: {
          draftJson: clone(online.settings.draftJson),
          publishedJson: clone(online.settings.publishedJson)
        }
      });
      await tx.auditLog.create({
        data: {
          id: `audit_${SITE_ID}_homepage_restore_online_${Date.now()}`,
          siteId: SITE_ID,
          actorId: "platform",
          actorType: "platform",
          action: "site.aidreamshoots.homepage.restore-online",
          targetType: "homepage",
          targetId: current.live.id,
          metadata: {
            sourceDatabase: "remote-readonly",
            sourceDomain: SITE_DOMAIN,
            sourceLiveUpdatedAt: online.live.updatedAt,
            sourceThemeSettingsUpdatedAt: online.settings.updatedAt,
            sourceCompatibilityThemeUpdatedAt: online.compatibilityTheme.updatedAt,
            rollbackPath: path.relative(process.cwd(), rollbackPath),
            protectedScope: ["LivePage:/", "ThemePage:/", "ThemeSettings"]
          }
        }
      });
    }, { timeout: 120000, maxWait: 20000 });

    const restored = await readLocalState(local);
    assertOnlineHomepageContract(restored.live.contentJson, "restored local LivePage");
    assertOnlineHomepageContract(restored.theme.draftJson, "restored local ThemePage.draftJson");
    assertOnlineHomepageContract(restored.theme.publishedJson, "restored local ThemePage.publishedJson");
    assertLocalAssets({ homepage: restored.live.contentJson, settings: restored.settings.draftJson });
    assert.equal(hash(restored.live.contentJson), hash(online.live.contentJson), "local LivePage readback differs from online source");
    assert.equal(hash(restored.settings.draftJson), hash(online.settings.draftJson), "local ThemeSettings readback differs from online source");

    console.log(JSON.stringify({ ok: true, mode: "applied", ...summary, rollbackPath: path.relative(process.cwd(), rollbackPath), restored: { livePage: rowSummary(restored.live), themePage: rowSummary(restored.theme), themeSettings: { id: restored.settings.id, updatedAt: restored.settings.updatedAt, draftHash: hash(restored.settings.draftJson), publishedHash: hash(restored.settings.publishedJson) } } }, null, 2));
  }
} finally {
  await Promise.all([remote.$disconnect(), local.$disconnect()]);
}
