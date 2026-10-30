#!/usr/bin/env node
// Plan the Aidreamcapes /occasions hub LivePage row (Step 1 of
// docs/aivideosugc-template-cases-navigation-plan.md).
//
// The row is a new insert: a data-driven hub page reusing the existing
// platform-directory layout, listing the three occasion facet pages. The
// manifest carries the full reviewed row content; the apply script inserts it
// with CAS guards (refuses when the row already exists with different
// content). No snapshot or published state is written.
//
//   node --env-file=.env.local scripts/plan-aidreamcapes-occasions-hub.mjs --target=local
//   node --env-file=.env.local scripts/plan-aidreamcapes-occasions-hub.mjs --target=production
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CONTRACT = "aidreamcapes-occasions-hub-2026-10-30-v1";
const SITE_ID = "site_aidreamcapes";
const SLUG = "/occasions";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] || "local";
assert.ok(["local", "production"].includes(target), "--target must be local or production");

function stable(value) {
  if (value === undefined) return '"<undefined>"';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

const origin = "https://www.aivideosugc.com";
const contentJson = {
  seo: {
    index: true,
    title: "AI Sale and Holiday Campaign Ideas | AIVideosUGC",
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@id": `${origin}${SLUG}#webpage`,
          url: `${origin}${SLUG}`,
          name: "AI Sale and Holiday Campaign Ideas | AIVideosUGC",
          "@type": "CollectionPage",
          inLanguage: "en",
          description: "Browse AI product video and photo ideas for Black Friday, the holidays and countdown sales."
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { item: `${origin}/`, name: "Home", "@type": "ListItem", position: 1 },
            { item: `${origin}${SLUG}`, name: "Occasions", "@type": "ListItem", position: 2 }
          ]
        },
        {
          "@type": "ItemList",
          itemListElement: [
            { url: `${origin}/occasions/black-friday`, name: "Black Friday", "@type": "ListItem", position: 1 },
            { url: `${origin}/occasions/holidays`, name: "Holidays", "@type": "ListItem", position: 2 },
            { url: `${origin}/occasions/sale-discount`, name: "Sale & Discount", "@type": "ListItem", position: 3 }
          ]
        }
      ]
    },
    robots: { index: true, follow: true },
    ogImage: "/ai-image-generation/t33-occ-black-friday-og-r2.webp",
    canonical: `${origin}${SLUG}`,
    ogImageAlt: "Adult hands pack a charcoal travel duffel with a shirt and toiletry pouch.",
    description: "Browse AI product video and photo ideas for Black Friday, the holidays and countdown sales.",
    canonicalPath: SLUG
  },
  version: 2,
  pageType: "content",
  sections: {
    v2_main: {
      type: "aidreamcapes_v2_page",
      blocks: [],
      settings: {
        layout: "platform-directory",
        data: {
          h1: "Ideas for Your Next Sale or Season",
          id: "occasions",
          faq: [],
          lead: "Pick an occasion to explore product video and photo ideas for your next campaign or promotion.",
          items: [
            {
              href: "/occasions/black-friday",
              text: "Plan your Black Friday ad creatives before the rush starts.",
              image: {
                src: "/ai-image-generation/t33-occ-black-friday-og-r2.webp",
                alt: "Adult hands pack a charcoal travel duffel with a shirt and toiletry pouch.",
                width: 1280,
                height: 672
              },
              label: "Black Friday"
            },
            {
              href: "/occasions/holidays",
              text: "Make a festive holiday video that fits gift season shopping.",
              image: {
                src: "/ai-image-generation/t33-occ-holidays-og-r2.webp",
                alt: "Adult lifts generic matte graphite over-ear headphones with round leather pads from a gift box.",
                width: 1280,
                height: 672
              },
              label: "Holidays"
            },
            {
              href: "/occasions/sale-discount",
              text: "Build a countdown sale video that gives shoppers a reason to buy now.",
              image: {
                src: "/ai-image-generation/t33-occ-sale-discount-og-r2.webp",
                alt: "Adult applies cream from a jar while two pastel skincare bottles remain visible.",
                width: 1280,
                height: 672
              },
              label: "Sale & Discount"
            }
          ],
          label: "Occasions",
          eyebrow: "Browse by occasion",
          breadcrumbs: [
            { href: "/", label: "Home" },
            { href: "/occasions", label: "Occasions" }
          ]
        }
      }
    }
  },
  sectionsOrder: ["v2_main"]
};

// Guard: every referenced occasion facet page must exist in production state
// (checked by the apply script against the target database before insert).
const referencedFacets = ["/occasions/black-friday", "/occasions/holidays", "/occasions/sale-discount"];

const row = {
  slug: SLUG,
  id: "aidreamcapes_v2_occasions",
  siteId: SITE_ID,
  pageType: "content",
  templateKey: "aidreamcapes-v2",
  title: "Ideas for Your Next Sale or Season",
  contentJson
};

const manifest = {
  ok: true,
  contract: CONTRACT,
  siteId: SITE_ID,
  target,
  generatedAt: new Date().toISOString(),
  operation: "insert-row",
  referencedFacets,
  row: { ...row, contentHash: hash(contentJson) }
};
manifest.planHash = hash({ row: manifest.row, referencedFacets });

const manifestPath = path.resolve(process.cwd(), `scripts/manifests/aidreamcapes-occasions-hub-${target}-2026-10-30.json`);
fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, manifestPath, planHash: manifest.planHash, contentHash: manifest.row.contentHash }, null, 2));
