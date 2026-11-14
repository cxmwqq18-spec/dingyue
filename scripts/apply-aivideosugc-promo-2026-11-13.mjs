#!/usr/bin/env node
// AIVideosUGC promo surfaces, 2026-11-13.
// Field-level updates on two rows of site_aidreamcapes — each writes exactly one
// new key into sections.v2_main.settings.data and leaves every other key as-is:
//   / — promoStrip: the two-card offer band rendered under the homepage hero
//     (free creator video -> /partners#free-credits, $1 first video ->
//     /app/create/starter-offer) with the social-proof stats line.
//   /pricing — promoBanner: the one-line offer banner above the plans grid.
// Rendering is fully data-driven (enabled + non-empty payloads); pages without
// these keys render nothing, so the change is additive and reversible by
// clearing the keys. h1 and seo stay untouched.
//   dry run:  node scripts/apply-aivideosugc-promo-2026-11-13.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-promo-2026-11-13.mjs --target=local --apply
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-promo-2026-11-13";

// Embedded manifest: the default promo payloads written into each page's
// sections.v2_main.settings.data.
const manifest = {
  siteId: "site_aidreamcapes",
  home: {
    slug: "/",
    promoStrip: {
      enabled: true,
      stats: "1,200+ product videos generated in the last 30 days",
      cards: [
        { key: "creators", badge: "FREE", title: "Free video for creators", body: "Post with #AivideosUGC, get a free 15s video after review.", cta: "Get free credits", href: "/partners#free-credits" },
        { key: "starter", badge: "FIRST VIDEO OFFER", title: "Your first 15s video — just $1", body: "New here? Full quality, no watermark, no subscription.", cta: "Claim your $1 video", href: "/app/create/starter-offer", price: "$1" }
      ]
    }
  },
  pricing: {
    slug: "/pricing",
    promoStrip: {
      enabled: true,
      stats: "",
      cards: [
        { key: "creators", badge: "FREE", title: "Free video for creators", body: "Post with #AivideosUGC, get a free 15s video after review.", cta: "Get free credits", href: "/partners#free-credits" },
        { key: "starter", badge: "FIRST VIDEO OFFER", title: "Your first 15s video — just $1", body: "New here? Full quality, no watermark, no subscription.", cta: "Claim your $1 video", href: "/app/create/starter-offer", price: "$1" }
      ]
    },
    promoBanner: {
      enabled: true,
      text: "🎁 Free credits for creators · $1 first video for new users",
      href: "/partners#free-credits",
      linkLabel: "Learn more"
    },
    promoPopup: {
      enabled: true,
      kicker: "New user exclusive",
      title: "Your first video, just $1",
      sub: "One full 15s AI UGC product video · one-time payment",
      price: "$1",
      priceWas: "$2.40 list",
      priceOff: "58% OFF",
      priceNote: "8 credits · auto-applied",
      ctaLabel: "Claim your $1 video",
      ctaHref: "/app/create/starter-offer",
      altPre: "Creator? Post with",
      altTag: "#AivideosUGC",
      altText: "get a 15s video FREE",
      altHref: "/partners#free-credits",
      fine: "Reviewed by hand · credits land on your account automatically · no subscription"
    }
  }
};

const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const baseHashes = {};
for (const part of ["home", "pricing"]) {
  const value = argumentValue(`--base-hash-${part}`);
  if (value) baseHashes[part] = value;
}
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: hasArgument(`--confirm=${CONFIRM_NAME}`) });
if (apply && target === "production") assert(hasArgument(`--confirm=${CONFIRM_NAME}`), `Production update requires --confirm=${CONFIRM_NAME}`);

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

const siteId = assertAllowedSite(manifest.siteId);
const db = new PrismaClient();
try {
  const slugs = [manifest.home.slug, manifest.pricing.slug];
  const rows = await db.livePage.findMany({
    where: { siteId, slug: { in: slugs } },
    select: { id: true, slug: true, contentJson: true, updatedAt: true }
  });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const plans = {};

  for (const part of ["home", "pricing"]) {
    const spec = manifest[part];
    const keys = part === "home" ? ["promoStrip"] : ["promoBanner", "promoStrip", "promoPopup"];
    const row = bySlug.get(spec.slug);
    assert(row, `LivePage ${spec.slug} does not exist on ${target}. Nothing was written.`);
    assert(row.contentJson && typeof row.contentJson === "object" && !Array.isArray(row.contentJson), `LivePage ${spec.slug} contentJson is missing or not an object.`);
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    const settings = contentJson.sections?.v2_main?.settings;
    assert(settings?.data && typeof settings.data === "object" && !Array.isArray(settings.data), `LivePage ${spec.slug} is missing sections.v2_main.settings.data; page shape changed.`);
    if (baseHashes[part]) assert.equal(hash(row.contentJson), baseHashes[part], `${spec.slug} contentJson changed since the reviewed dry run; refusing to apply.`);

    // Idempotency: absent -> write; identical -> no-op; different -> refuse
    // unless --allow-overwrite is passed for a reviewed data migration.
    const allowOverwrite = hasArgument("--allow-overwrite");
    for (const key of keys) {
      const current = settings.data[key];
      if (current !== undefined) {
        if (allowOverwrite) {
          console.log(`[aivideosugc-promo] ${spec.slug}: ${key} exists; overwriting (--allow-overwrite).`);
        } else {
          assert.equal(stable(current), stable(spec[key]), `LivePage ${spec.slug} already has ${key} with different content; refusing to overwrite manual edits (pass --allow-overwrite to migrate).`);
          console.log(`[aivideosugc-promo] ${spec.slug}: ${key} already identical; no-op.`);
          continue;
        }
      }

      const h1Before = settings.data.h1;
      settings.data[key] = spec[key];
      assert.equal(settings.data.h1, h1Before, `${spec.slug} h1 changed; not allowed.`);
      plans[spec.slug] = contentJson;
    }
  }

  console.log(`[aivideosugc-promo] target=${target}`);
  for (const [slug, contentJson] of Object.entries(plans)) {
    console.log(`[aivideosugc-promo] ${slug} base-hash=${hash(bySlug.get(slug).contentJson)} next-hash=${hash(contentJson)}`);
  }
  if (!apply) {
    console.log("[aivideosugc-promo] dry run — no writes.");
  } else {
    for (const [slug, contentJson] of Object.entries(plans)) {
      const row = bySlug.get(slug);
      await db.livePage.update({ where: { id: row.id }, data: { contentJson } });
      const readback = await db.livePage.findUnique({ where: { id: row.id }, select: { contentJson: true, updatedAt: true } });
      assert.equal(hash(readback.contentJson), hash(contentJson), `Readback hash mismatch on ${slug}.`);
      console.log(`[aivideosugc-promo] applied ${slug}; readback verified; updatedAt=${readback.updatedAt.toISOString()}`);
    }
    const homeData = (await db.livePage.findFirst({ where: { siteId, slug: manifest.home.slug }, select: { contentJson: true } })).contentJson;
    const homeStrip = homeData.sections.v2_main.settings.data.promoStrip;
    assert(homeStrip?.enabled === true && Array.isArray(homeStrip.cards) && homeStrip.cards.length === 2, "Readback homepage promoStrip malformed.");
    assert(homeStrip.cards.every((card) => typeof card.href === "string" && card.href.startsWith("/")), "Readback promoStrip cards must link to site-relative paths.");
    const pricingData = (await db.livePage.findFirst({ where: { siteId, slug: manifest.pricing.slug }, select: { contentJson: true } })).contentJson;
    const banner = pricingData.sections.v2_main.settings.data.promoBanner;
    assert(banner?.enabled === true && typeof banner.href === "string" && banner.href.startsWith("/"), "Readback pricing promoBanner malformed.");
  }
} catch (error) {
  console.error(`[aivideosugc-promo] ${(error && error.message) || error}`);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
