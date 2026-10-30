#!/usr/bin/env node
// Plan the Aidreamcapes industry facet pages (phase 4, 2026-10-30).
//
// Three operation families in one reviewed manifest, applied by
// scripts/apply-aidreamcapes-industry-facets.mjs:
//   1. create 11 facet LivePage rows under /industries/ (pet, kids-toy,
//      e-commerce, education, financial-services, sports-gym, apps, ugc,
//      viral, explainer, other) — the placement vocabulary v2 targets from
//      docs/aivideosugc-tagging-examples-rectification-plan.md §2.2;
//   2. extend the homepage `siteNavigation` "By industry" group 8 -> 19;
//   3. extend the /industries hub `items` card list 8 -> 19.
//
// The facet pages render through the existing TemplateDirectory branch:
// breadcrumbs + h1 + lead + faq + templateDirectory{paths:[], links} —
// the example media grid aggregates automatically from the placement tags
// written in the placement-tags apply (planHash 13be17f3…). No code deploy
// is required; a committed LivePage row is live on the next request.
//
//   node --env-file=.env.production scripts/plan-aidreamcapes-industry-facets.mjs --target=production
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const { PrismaClient } = require("@prisma/client");

const SITE_ID = "site_aidreamcapes";
const CONTRACT = "aidreamcapes-industry-facets-2026-10-30-v1";
const ORIGIN = "https://www.aivideosugc.com";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
assert.equal(target, process.env.DATABASE_TARGET, `DATABASE_TARGET=${process.env.DATABASE_TARGET} does not match --target=${target}`);
assert.equal(process.env.DINGYUE_ENV, target, `DINGYUE_ENV=${process.env.DINGYUE_ENV} does not match --target=${target}`);
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-industry-facets-${target}-2026-10-30.json`
);

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
function pageHash(row) {
  return hash({
    id: row.id,
    siteId: row.siteId,
    slug: row.slug,
    title: row.title,
    pageType: row.pageType,
    templateKey: row.templateKey,
    contentJson: row.contentJson,
    updatedAt: row.updatedAt
  });
}

// ---------------------------------------------------------------------------
// Facet content (public copy; written for end users, reviewed 2026-10-30).
// label matches the shared 17-category filter chip vocabulary; heading is the
// breadcrumb / hub card name.
// ---------------------------------------------------------------------------
const STD_LINKS = [
  { href: "/templates", label: "All templates" },
  { href: "/templates/photo", label: "Photo templates" },
  { href: "/templates/video", label: "Video templates" },
  { href: "/industries", label: "By industry" },
  { href: "/platforms", label: "By platform" }
];

const FACETS = [
  {
    name: "pet", label: "Pet", heading: "Pet Products",
    title: "AI UGC Ads for Pet Products",
    h1: "Pet Product Ads From One Photo",
    lead: "Turn one pet product photo into short UGC-style clips and clean listing photos. Show the harness on a walk, the brush in use, or the bowl at feeding time without a studio day.",
    hubText: "Leashes, brushes, bowls, and harnesses shown in real daily-use scenes from one photo.",
    primaryKeyword: "pet product video ads",
    keywords: "pet product video ads, AI pet product photos, pet UGC video, dog product ads, pet listing photos",
    og: { src: "/ai-image-generation/im03-home-picker-dog-r1-640.webp", alt: "Adult woman with short light-auburn hair brushes a calm golden retriever with a plain pet brush." },
    faq: [
      { q: "What do I upload?", a: "One clear photo of the product. The scenes place it in everyday pet moments, so the clip or photo set matches how owners actually use it." },
      { q: "Which formats come out?", a: "Vertical video for TikTok, Instagram, and Shorts, plus square and wide photos for listings and storefront pages." },
      { q: "Can the scenes include a dog or cat?", a: "Yes. Scenes place the product in use or next to a pet, so the footage reads naturally without booking a real animal shoot." },
      { q: "How much does it cost?", a: "Plans start at $24.50 a month, and every job shows its credit cost before it runs. Failed jobs return the credits." }
    ]
  },
  {
    name: "kids-toy", label: "Kids & Toy", heading: "Kids & Toys",
    title: "AI UGC Ads for Kids & Toy Products",
    h1: "Toy Ads Parents Actually Watch",
    lead: "One toy photo becomes play demos, unboxings, and shelf-ready listing photos. Show how the toy works before the parent reaches the store page.",
    hubText: "Play demos and unboxings that show how the toy works before the store page.",
    primaryKeyword: "kids toy video ads",
    keywords: "kids toy video ads, toy unboxing video, AI toy product photos, toy UGC ads, toy listing photos",
    og: { src: "/ai-image-generation/mx1w-home-kids-toy-2-r1-640.webp", alt: "Adult hands open a plain box of colorful wooden building blocks with no letters or logos." },
    faq: [
      { q: "What do I upload?", a: "One clear photo of the toy, ideally with the full shape visible. The scenes build play moments around it, from unboxing to floor-time demos." },
      { q: "Can I show hands playing with the toy?", a: "Yes. Hands-on play demos are the core format, so parents can see how the pieces move and fit before buying." },
      { q: "Which formats come out?", a: "Vertical video for the feeds and square or wide photos for marketplaces and your own store." },
      { q: "How much does it cost?", a: "Plans start at $24.50 a month, and every job shows its credit cost before it runs. Failed jobs return the credits." }
    ]
  },
  {
    name: "e-commerce", label: "E-Commerce", heading: "E-Commerce",
    title: "AI Product Photos and Video Ads for E-Commerce",
    h1: "Store-Ready Media From One Product Photo",
    lead: "Feed your catalog with listing photos and short product videos that match. One upload covers the product page, the feed ad, and the seasonal refresh.",
    hubText: "Listing photos and feed ads from the same product photo, ready for any catalog.",
    primaryKeyword: "e-commerce product photos and video ads",
    keywords: "e-commerce product photos, catalog product video, AI listing photos, store product ads, white background product photos",
    og: { src: "/ai-image-generation/fx14-white-card-catalog-r1-640.webp", alt: "Pale blue glass storage jar with a plain lid centered on pure white." },
    faq: [
      { q: "Do the photos work for marketplace listings?", a: "Yes. Clean white-background and catalog shots are core formats, alongside the lifestyle scenes you can use on the product page." },
      { q: "Can I keep every channel consistent?", a: "The listing photos and the video ads come from the same upload, so colors and proportions stay consistent across the catalog." },
      { q: "How many products can I run?", a: "As many as your plan's credits cover. Each job shows its credit cost before it runs, and failed jobs return the credits." },
      { q: "Which formats come out?", a: "Square and wide photos for listings, vertical video for TikTok, Instagram, and Shorts, and wide cuts for your store." }
    ]
  },
  {
    name: "education", label: "Education", heading: "Education",
    title: "AI Explainer and Course Promo Videos",
    h1: "Course and Lesson Promos Without a Film Crew",
    lead: "Explain a course, a lesson, or a study tool with short presenter videos and clean visuals. One upload gives you the promo cut and the thumbnail set.",
    hubText: "Course promos and lesson explainers with a presenter, from one upload.",
    primaryKeyword: "course promo video maker",
    keywords: "course promo video, education explainer video, AI lesson video, online course ads, study tool demo",
    og: { src: "/ai-image-generation/actors/ac1-actor-card-classroom-1-r1-640.webp", alt: "An adult white man in his twenties in a classroom setting speaks to camera with empty hands." },
    faq: [
      { q: "What do I upload?", a: "A photo of the product, the cover, or the workspace. The presenter explains the offer in a classroom or desk scene that fits it." },
      { q: "Can the presenter speak my script?", a: "Yes. You write the message, and the presenter delivers it with voice and captions in the clip." },
      { q: "Which formats come out?", a: "Vertical video for the feeds, wide cuts for course pages, and still frames you can use as thumbnails." },
      { q: "How much does it cost?", a: "Plans start at $24.50 a month, and every job shows its credit cost before it runs. Failed jobs return the credits." }
    ]
  },
  {
    name: "financial-services", label: "Financial Services", heading: "Financial Services",
    title: "AI Explainer Videos for Fintech and Finance",
    h1: "Finance Explainers That Stay On Brand",
    lead: "Walk through an app, a dashboard, or a money tool with short presenter videos. The scenes keep the focus on the product, not on stock footage.",
    hubText: "App walkthroughs and dashboard explainers that keep finance products clear.",
    primaryKeyword: "fintech explainer video maker",
    keywords: "fintech explainer video, finance app demo video, AI banking ads, dashboard walkthrough video, insurance explainer",
    og: { src: "/ai-image-generation/gen2guide-k6-templates-strip-deskset-640.webp", alt: "Notebook, pen, and wooden organizer tray arranged together on a tidy desk in soft daylight." },
    faq: [
      { q: "What do I upload?", a: "A photo of the workspace, the card, or the brand material. The presenter walks through the offer from a desk scene that reads professional." },
      { q: "Can I explain a dashboard or an app flow?", a: "Yes. Desk and screen scenes are built for step-by-step walkthroughs, so the viewer can follow the flow." },
      { q: "Which formats come out?", a: "Vertical video for the feeds and wide cuts for landing pages and decks." },
      { q: "How much does it cost?", a: "Plans start at $24.50 a month, and every job shows its credit cost before it runs. Failed jobs return the credits." }
    ]
  },
  {
    name: "sports-gym", label: "Sports & Gym", heading: "Sports & Gym",
    title: "AI UGC Ads for Sports and Gym Products",
    h1: "Gym and Sports Ads From One Product Photo",
    lead: "Show the mat rolling out, the bands stretching, or the bike folding. One photo covers workout clips, checkout shots, and listing photos.",
    hubText: "Workout clips and gear demos shot in the gym, from one product photo.",
    primaryKeyword: "sports and gym product video ads",
    keywords: "gym product video ads, fitness UGC video, AI sports product photos, workout gear ads, gym equipment demos",
    og: { src: "/ai-image-generation/actors/ac1-actor-card-exercise-2-r2-640.webp", alt: "An adult East Asian woman with a straight black bob sits cross-legged on a park exercise mat with open hands." },
    faq: [
      { q: "What do I upload?", a: "One clear photo of the gear or apparel. The scenes place it in workout and recovery moments that match how it is used." },
      { q: "Can the scenes show the product in use?", a: "Yes. Stretching, lifting, and recovery scenes are core formats, so the clip shows the product doing its job." },
      { q: "Which formats come out?", a: "Vertical video for TikTok, Instagram, and Shorts, plus square and wide photos for listings." },
      { q: "How much does it cost?", a: "Plans start at $24.50 a month, and every job shows its credit cost before it runs. Failed jobs return the credits." }
    ]
  },
  {
    name: "apps", label: "Apps", heading: "Apps",
    title: "AI App Promo and Walkthrough Videos",
    h1: "App Promos and Walkthroughs From One Photo",
    lead: "Turn a device photo or a screenshot into walkthrough clips, reaction videos, and store-ready stills. Show the screen flow before the download button.",
    hubText: "Screen walkthroughs and reaction clips that show the app before the download.",
    primaryKeyword: "app promo video maker",
    keywords: "app promo video, app walkthrough video, AI app ads, app store screenshots, app demo clips",
    og: { src: "/ai-image-generation/tw1-wall-apps-2-640.webp", alt: "Adult white man with short tight curls reacts beside a generic tablet showing only soft abstract color blocks in a dark streaming room." },
    faq: [
      { q: "What do I upload?", a: "A photo of the device or the app in use. The scenes build walkthroughs and reaction moments around the screen." },
      { q: "Can I show the actual interface?", a: "Upload the screen you want featured and the scenes keep it in focus, so the walkthrough shows your real flow." },
      { q: "Which formats come out?", a: "Vertical video for TikTok, Instagram, and Shorts, plus stills you can use for store listings." },
      { q: "How much does it cost?", a: "Plans start at $24.50 a month, and every job shows its credit cost before it runs. Failed jobs return the credits." }
    ]
  },
  {
    name: "ugc", label: "UGC", heading: "UGC",
    title: "AI UGC Video Ads From One Product Photo",
    h1: "Creator-Style Ads Without the Creator Wait",
    lead: "One product photo becomes review-style clips that hold the feed. Pick the presenter, the scene, and the format; the clip is ready in minutes.",
    hubText: "Creator-style review clips from one product photo, no creator wait.",
    primaryKeyword: "AI UGC video ads",
    keywords: "AI UGC video ads, UGC creator video, product review video, UGC style ads, AI creator clips",
    og: { src: "/ai-image-generation/tw2-wall-ugc-1-r1-640.webp", alt: "Adult Black man with short salt-and-pepper curls applies plain coral pump moisturizer to his cheek in a bright bathroom." },
    faq: [
      { q: "What do I upload?", a: "One clear product photo. The presenter handles, uses, and reacts to the product in scenes that read like creator content." },
      { q: "Can I pick the presenter?", a: "Yes. Choose the presenter and the setting, and the same photo can produce several review-style cuts." },
      { q: "Does the clip include voice and captions?", a: "Yes. You write the message, and the clip ships with the spoken line and captions." },
      { q: "How much does it cost?", a: "Plans start at $24.50 a month, and every job shows its credit cost before it runs. Failed jobs return the credits." }
    ]
  },
  {
    name: "viral", label: "Viral", heading: "Viral",
    title: "AI Viral Ad Styles for Product Clips",
    h1: "Hook-First Ads Built for the Feed",
    lead: "Reaction reveals, comparisons, and mist-spray hooks — the formats that stop the scroll, made from one product photo.",
    hubText: "Hook-first formats like reveals and comparisons that stop the scroll.",
    primaryKeyword: "viral product video ads",
    keywords: "viral video ads, hook video ads, product reveal video, TikTok viral ads, scroll stopping ads",
    og: { src: "/ai-image-generation/tw2-wall-viral-1-640.webp", alt: "Adult white woman with a short light-blonde pixie holds a plain mint pump face mist beside her cheek." },
    faq: [
      { q: "What makes these clips different?", a: "They open on the hook — the reveal, the comparison, or the reaction — in the first second, which is what keeps the feed watching." },
      { q: "What do I upload?", a: "One clear product photo. The scenes stage the reveal or the side-by-side around it." },
      { q: "Which formats come out?", a: "Vertical video sized for TikTok, Instagram, and Shorts, ready to post as-is." },
      { q: "How much does it cost?", a: "Plans start at $24.50 a month, and every job shows its credit cost before it runs. Failed jobs return the credits." }
    ]
  },
  {
    name: "explainer", label: "Explainer", heading: "Explainer",
    title: "AI Product Explainer Videos From One Photo",
    h1: "Explain the Product in One Short Clip",
    lead: "Before-and-after demos, walkthroughs, and feature explanations from a single product photo. Answer the buyer's question before they ask it.",
    hubText: "Before-and-after demos that answer the buyer's question in one clip.",
    primaryKeyword: "product explainer video maker",
    keywords: "product explainer video, before and after video, AI demo video, feature walkthrough, product how-to video",
    og: { src: "/ai-image-generation/mx1w-home-explainer-1-r1-640.webp", alt: "Adult hands show a plain cable organizer changing a desk from tangled cords to a tidy route." },
    faq: [
      { q: "What do I upload?", a: "One clear photo of the product. The scenes stage the before-and-after or the step-by-step around it." },
      { q: "Can the clip show a problem and the fix?", a: "Yes. Before-and-after demos are the core format, so the viewer sees the problem solved on screen." },
      { q: "Does the clip include voice and captions?", a: "Yes. You write the message, and the clip ships with the spoken line and captions." },
      { q: "How much does it cost?", a: "Plans start at $24.50 a month, and every job shows its credit cost before it runs. Failed jobs return the credits." }
    ]
  },
  {
    name: "other", label: "Other", heading: "More Categories",
    title: "AI Product Videos for Every Niche",
    h1: "One Photo, Any Product Category",
    lead: "Scene openers, presenter clips, and product moments that don't fit one shelf. Start from a photo and shape the story you need.",
    hubText: "Presenter clips and scene openers for products outside the usual shelves.",
    primaryKeyword: "AI product videos for any niche",
    keywords: "AI product video, any product ads, presenter video, scene opener clips, niche product ads",
    og: { src: "/ai-image-generation/gen2spokesperson-videos-c3-640.webp", alt: "Adult holding a protein shaker bottle in a gym after a workout, lips closed." },
    faq: [
      { q: "My product is unusual. Does this still work?", a: "Yes. These formats cover scene openers and presenter clips that work for any product you can photograph." },
      { q: "What do I upload?", a: "One clear photo of the product. The presenter or the scene does the rest." },
      { q: "Which formats come out?", a: "Vertical video for TikTok, Instagram, and Shorts, plus square and wide photos for listings." },
      { q: "How much does it cost?", a: "Plans start at $24.50 a month, and every job shows its credit cost before it runs. Failed jobs return the credits." }
    ]
  }
];

const EXPECTED_NAV_HREFS = [
  "/industries/beauty-skincare", "/industries/fashion-clothing", "/industries/shoes",
  "/industries/jewelry-accessories", "/industries/electronics", "/industries/health-wellness",
  "/industries/food-drinks", "/industries/home-living"
];
const EXPECTED_HUB_HREFS = EXPECTED_NAV_HREFS;

function parseJsonPath(jsonPath) {
  const steps = [];
  for (const part of String(jsonPath).split(".")) {
    const match = part.match(/^([^[\]]+)((?:\[\d+\])*)$/);
    assert(match, `Unsupported jsonPath segment "${part}" in ${jsonPath}.`);
    steps.push(match[1]);
    for (const index of match[2].matchAll(/\[(\d+)\]/g)) steps.push(Number(index[1]));
  }
  return steps;
}
function resolveNode(contentJson, jsonPath) {
  let node = contentJson;
  for (const step of parseJsonPath(jsonPath)) {
    if (node === null || node === undefined) return undefined;
    if (typeof step === "number") {
      if (!Array.isArray(node)) return undefined;
    } else if (typeof node !== "object" || Array.isArray(node)) {
      return undefined;
    }
    node = node[step];
  }
  return node;
}

function facetContentJson(facet, sourceRevision) {
  const slug = `/industries/${facet.name}`;
  const url = `${ORIGIN}${slug}`;
  const faqPage = {
    "@type": "FAQPage",
    mainEntity: facet.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a }
    }))
  };
  const collectionPage = {
    "@type": "CollectionPage",
    "@id": `${url}#webpage`,
    url,
    name: `${facet.title} | AIVideosUGC`,
    description: facet.lead,
    inLanguage: "en",
    isPartOf: { "@id": `${ORIGIN}/#website` }
  };
  return {
    seo: {
      index: true,
      title: `${facet.title} | AIVideosUGC`,
      description: facet.lead,
      canonical: url,
      canonicalPath: slug,
      keywords: facet.keywords,
      primaryKeyword: facet.primaryKeyword,
      ogImage: facet.og.src,
      ogImageAlt: facet.og.alt,
      twitterDescription: facet.lead,
      robots: { index: true, follow: true, maxImagePreview: "large" },
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Organization", "@id": `${ORIGIN}/#organization`, url: `${ORIGIN}/`, name: "AIVideosUGC" },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
              { "@type": "ListItem", position: 2, name: "Industries", item: `${ORIGIN}/industries` },
              { "@type": "ListItem", position: 3, name: facet.heading, item: url }
            ]
          },
          collectionPage,
          faqPage
        ]
      }
    },
    version: 2,
    pageType: "content",
    mediaManifest: [],
    sectionsOrder: ["v2_main"],
    contentContract: {
      seoSource: "LivePage.contentJson",
      mediaSource: "LivePage.contentJson",
      sourceRevision
    },
    sections: {
      v2_main: {
        type: "aidreamcapes_v2_page",
        settings: {
          layout: "collection",
          data: {
            id: `ind-${facet.name}`,
            kind: "industry",
            label: facet.label,
            h1: facet.h1,
            lead: facet.lead,
            faq: facet.faq.map((item) => ({ q: item.q, a: item.a })),
            breadcrumbs: [
              { href: "/", label: "Home" },
              { href: "/industries", label: "Industries" },
              { href: slug, label: facet.heading }
            ],
            templateDirectory: { paths: [], links: STD_LINKS.map((link) => ({ ...link })) }
          }
        }
      }
    }
  };
}

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { in: ["/", "/industries", ...FACETS.map((facet) => `/industries/${facet.name}`)] } },
    select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });
  const homepage = rows.find((row) => row.slug === "/");
  const hub = rows.find((row) => row.slug === "/industries");
  assert(homepage, "Homepage LivePage row is missing.");
  assert(hub, "/industries hub LivePage row is missing.");

  for (const facet of FACETS) {
    const slug = `/industries/${facet.name}`;
    assert(!rows.some((row) => row.slug === slug), `LivePage ${slug} already exists; nothing to plan.`);
  }
  for (const facet of FACETS) {
    const id = `aidreamcapes_v2_ind_${facet.name.replaceAll("-", "_")}`;
    assert(!rows.some((row) => row.id === id), `LivePage id ${id} already exists.`);
  }

  // Homepage "By industry" group must hold exactly the 8 existing facets.
  const navMenus = resolveNode(homepage.contentJson, "siteNavigation.menus");
  assert(Array.isArray(navMenus), "Homepage siteNavigation.menus is missing.");
  const navMenu = navMenus.find((menu) => menu?.label === "Templates");
  assert(navMenu, 'Homepage "Templates" menu is missing.');
  const navGroup = (navMenu.groups ?? []).find((group) => group?.label === "By industry");
  assert(navGroup, 'Homepage "By industry" group is missing.');
  assert.deepEqual(navGroup.items.map((item) => item.href), EXPECTED_NAV_HREFS, "Homepage By industry items changed since review.");
  const navAfter = [...navGroup.items.map((item) => ({ href: item.href, label: item.label })), ...FACETS.map((facet) => ({ href: `/industries/${facet.name}`, label: facet.label }))];

  // Hub cards must hold exactly the 8 existing facets.
  const hubItems = resolveNode(hub.contentJson, "sections.v2_main.settings.data.items");
  assert(Array.isArray(hubItems), "/industries hub items are missing.");
  assert.deepEqual(hubItems.map((item) => item.href), EXPECTED_HUB_HREFS, "/industries hub items changed since review.");
  const hubAfter = [...hubItems.map((item) => ({ href: item.href, text: item.text, image: structuredClone(item.image) })), ...FACETS.map((facet) => ({
    href: `/industries/${facet.name}`,
    text: facet.hubText,
    image: { alt: facet.og.alt, src: facet.og.src }
  }))];

  const sourceRevision = "placement-tags-13be17f3744e7f9f";
  const pages = FACETS.map((facet) => ({
    id: `aidreamcapes_v2_ind_${facet.name.replaceAll("-", "_")}`,
    slug: `/industries/${facet.name}`,
    title: facet.title,
    pageType: "content",
    templateKey: "aidreamcapes-v2",
    contentJson: facetContentJson(facet, sourceRevision)
  }));

  const manifest = {
    ok: true,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    rule: "create 11 industry facet LivePage rows (placement vocabulary v2 targets); extend the homepage siteNavigation By industry group 8 -> 19 and the /industries hub items 8 -> 19",
    pages,
    homepage: {
      id: homepage.id,
      slug: homepage.slug,
      baseHash: pageHash(homepage),
      jsonPath: "siteNavigation.menus[Templates].groups[By industry].items",
      beforeCount: navGroup.items.length,
      afterCount: navAfter.length,
      afterItems: navAfter
    },
    hub: {
      id: hub.id,
      slug: hub.slug,
      baseHash: pageHash(hub),
      jsonPath: "sections.v2_main.settings.data.items",
      beforeCount: hubItems.length,
      afterCount: hubAfter.length,
      afterItems: hubAfter
    },
    operations: [],
    addresses: []
  };
  manifest.planHash = hash({
    contract: manifest.contract,
    siteId: manifest.siteId,
    target: manifest.target,
    pages: manifest.pages,
    homepage: { ...manifest.homepage, jsonPath: manifest.homepage.jsonPath },
    hub: manifest.hub,
    operations: manifest.operations,
    addresses: manifest.addresses
  });

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    mode: "plan",
    contract: CONTRACT,
    target,
    manifestPath,
    planHash: manifest.planHash,
    summary: {
      pagesCreated: pages.length,
      slugs: pages.map((page) => page.slug),
      navItems: { before: manifest.homepage.beforeCount, after: manifest.homepage.afterCount },
      hubItems: { before: manifest.hub.beforeCount, after: manifest.hub.afterCount },
      homepageBaseHash: manifest.homepage.baseHash.slice(0, 12),
      hubBaseHash: manifest.hub.baseHash.slice(0, 12)
    }
  }, null, 2));
} finally {
  await db.$disconnect();
}
