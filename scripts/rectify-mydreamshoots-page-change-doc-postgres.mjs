import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2).split("=")[0]));
const forceContentOverwrite = flags.has("force-content-overwrite");
const dbRequested = flags.has("db");
const dryRun = flags.has("dry-run") || !(forceContentOverwrite && dbRequested);

function contentOverwriteGuardPayload() {
  return {
    writeEnabled: !dryRun,
    requiredFlags: ["--db", "--force-content-overwrite"],
    dbRequested,
    note: dryRun
      ? "No database rows were overwritten. Re-run with --db --force-content-overwrite to apply these text rewrites."
      : "Content overwrite was explicitly enabled for this run."
  };
}
const headshotGeneratorLabel = "Headshot Generator";
const headshotGeneratorHref = "/collections/headshots";
const policyLastUpdated = "August 5, 2026";
const policyKeywords = "MyDreamShoots policy, AI photo privacy, AI portrait terms, photo upload privacy, private AI albums, AI photo credits, no AI training, 30-day auto-delete, AES-256";
const policyDescriptions = {
  "/privacy": "Read how MyDreamShoots keeps account data, uploaded source photos, generated portraits, credit activity, checkout records, and private album access private. Your photos are never used to train models, input photos auto-delete 30 days after generation, and data is protected with AES-256 at rest and TLS 256-bit in transit.",
  "/terms": "Review the MyDreamShoots terms for customer accounts, AI photo credits, uploads, generation limits, refunds, and private gallery access. The service does not use your photos for model training, applies 30-day auto-delete to input photos, and protects data with AES-256 at rest and TLS 256-bit in transit.",
  "/content": "Read the MyDreamShoots content policy for permitted source photos, upload rights, identity consent, moderation review, private album use, and the trust commitments that keep your photos out of model training and auto-delete inputs after 30 days.",
  "/refunds": "Review how MyDreamShoots handles the 100% money-back guarantee, unused credits, subscription cancellations, technical failures, reruns, billing reversals, and account credit history."
};
const policyCopyByCanonicalPath = {
  "/privacy": {
    pageTitle: "Privacy policy",
    sectionTitle: "Privacy policy",
    seoTitle: "Privacy Policy for AI Photo Uploads, Credits, and Private Albums",
    body: `<h3>1. Scope of this policy</h3><p>This Privacy Policy explains how MyDreamShoots handles customer accounts, uploaded source photos, generated portraits, prompts, credit activity, checkout records, cookies, support messages, and private album access.</p><h3>2. No AI training on your photos</h3><p>Your uploaded photos, prompts, and generated private results are used to provide the MyDreamShoots service you request. They are never used to train models or build public datasets.</p><h3>3. 30-day auto-delete for input photos</h3><p>Input photos automatically delete 30 days after generation. Generated results, billing records, security logs, dispute records, and support messages may be retained where needed for account access, legal compliance, fraud prevention, refunds, and customer support.</p><h3>4. AES-256 at rest · TLS 256-bit in transit</h3><p>MyDreamShoots protects private uploads and account data with AES-256 at rest and TLS 256-bit in transit across the stack. Access checks, scoped sessions, security cookies, monitoring, and provider controls reduce unauthorized access.</p><h3>5. Payments, credits, and service providers</h3><p>Payments may be processed by Stripe or another connected provider. Hosting, storage, email, moderation, analytics, payment, and AI infrastructure providers may process limited data only to run, secure, generate, store, or deliver the requested service.</p><h3>6. Compliance references</h3><p>Our footer links include KIDS Act and DPDPA notices because privacy, child-related requests, deletion, access, correction, and regional privacy rights matter for AI photo services.</p><h3>7. Your choices and contact</h3><p>You may ask for access, correction, export, deletion, or help with account privacy. Email <a href="mailto:support@mydreamshoots.com">support@mydreamshoots.com</a> with your account email and request details. We may verify account ownership before acting on sensitive requests.</p>`
  },
  "/terms": {
    pageTitle: "Terms of Service",
    sectionTitle: "Terms of service",
    seoTitle: "Terms of Service for MyDreamShoots AI Headshot Generator",
    body: `<h3>1. Agreement to these terms</h3><p>These Terms of Service apply when you visit www.mydreamshoots.com, create a MyDreamShoots account, upload photos, buy credits or subscriptions, use AI photo tools, start generation jobs, download outputs, or access private albums.</p><h3>2. Accounts, credits, and checkout</h3><p>You are responsible for accurate account information and secure sign-in. Credits are added after payment confirmation, displayed before generation, reserved when a request begins, used after successful delivery, and released or reviewed when a request fails.</p><h3>3. Upload rights and consent</h3><p>You may upload only photos, reference images, prompts, or other materials that you own or have permission to use. Do not upload minors, non-consenting people, public figures, protected marks, stolen images, or materials that violate law, platform rules, or third-party rights.</p><h3>4. No AI training on your photos</h3><p>Your inputs are never used to train models. 30-day auto-delete applies to input photos after generation. Private uploads and account records are protected with AES-256 at rest and TLS 256-bit in transit. Some billing, security, tax, dispute, refund, and account-integrity records may be retained where required or reasonably necessary.</p><h3>5. AI output variability</h3><p>AI photo results can vary based on source photo quality, pose, lighting, package settings, moderation review, provider availability, and model behavior. MyDreamShoots may reject, rerun, delay, moderate, or remove jobs that violate rules or cannot be completed reliably.</p><h3>6. Private albums and use of outputs</h3><p>Generated images and albums are designed for private customer access unless you choose to share, publish, or download them. You are responsible for reviewing outputs before using them in advertising, profiles, documents, merchandise, social media, or other public settings.</p><h3>7. Refunds and guarantee review</h3><p>Refunds and credit adjustments follow the Refund Policy, including the 100% money-back guarantee when the shoot does not look like you, subject to support review, account history, and the details of the affected request.</p><h3>8. Contact</h3><p>Email <a href="mailto:support@mydreamshoots.com">support@mydreamshoots.com</a> for account, billing, refund, policy, or legal questions.</p>`
  },
  "/content": {
    pageTitle: "Content policy",
    sectionTitle: "Content policy",
    seoTitle: "Content Policy for MyDreamShoots Uploads and AI Photo Outputs",
    body: `<h3>1. Source photo permission</h3><p>Customers may upload only photos, reference images, prompts, logos, or creative direction they own or have permission to use. Private photo packages should be based on lawful, consented source material.</p><h3>2. Identity consent</h3><p>Do not upload or request content involving minors, non-consenting people, stolen images, public figures, celebrities, athletes, official marks, trademarks, or protected brand assets without permission. Do not use MyDreamShoots for impersonation, harassment, deception, exploitation, fake evidence, or unlawful activity.</p><h3>3. No AI training on your photos</h3><p>Your inputs are never used to train models.</p><h3>4. 30-day auto-delete for input photos</h3><p>Input photos automatically delete 30 days after generation.</p><h3>5. AES-256 at rest · TLS 256-bit in transit</h3><p>Private uploads and generated account records are handled with AES-256 at rest and TLS 256-bit in transit across the stack.</p><h3>6. Moderation and blocked requests</h3><p>MyDreamShoots may review, reject, remove, rerun, or limit requests that appear unsafe, unauthorized, misleading, infringing, exploitative, or outside supported personal, creator, or business workflows.</p><h3>7. Responsible output use</h3><p>AI outputs can contain artifacts or inaccurate details. Review results before posting, selling, printing, or using them for profiles, campaigns, documents, or social platforms. You remain responsible for following rights, disclosure, and platform rules.</p><h3>8. Reporting concerns</h3><p>Email <a href="mailto:support@mydreamshoots.com">support@mydreamshoots.com</a> with the account email, page, package, job, or gallery details if content should be reviewed or removed.</p>`
  },
  "/refunds": {
    pageTitle: "Refund policy",
    sectionTitle: "Refund policy",
    seoTitle: "Refund Policy for MyDreamShoots Credits, Plans, and Failed Jobs",
    body: `<h3>1. 100% money-back guarantee</h3><p>If the shoot does not look like you, contact support for a refund review. Include your account email, order details, package name, job or gallery link, and a short explanation of the mismatch. Eligible requests may receive a refund, credit return, or rerun depending on the account history and affected generation.</p><h3>2. Refund eligibility</h3><p>You may request a refund for purchased credits if none of the credits from that purchase have been used. Credits spent on successful generations are generally not refundable unless MyDreamShoots confirms a service-side issue or approves the money-back guarantee review.</p><h3>3. Failed jobs and technical issues</h3><p>If a technical failure on our side prevents credit use or delivery, support may release reserved credits, rerun the job, troubleshoot the account, or approve a refund after review.</p><h3>4. Trust commitments</h3><ul><li><strong>No AI training on your photos.</strong> Your inputs are never used to train models.</li><li><strong>30-day auto-delete.</strong> Input photos automatically delete 30 days after generation.</li><li><strong>AES-256 at rest · TLS 256-bit in transit.</strong> Encryption standards are used across the stack.</li><li><strong>100% money-back guarantee.</strong> If the shoot does not look like you, request a refund review.</li></ul><h3>5. Refund window and subscriptions</h3><p>Refund requests should be submitted within 30 days of the purchase date. If a subscription is canceled, the customer keeps access to purchased credits until they are used or expire according to plan rules. Cancellation does not automatically refund credits already used.</p><h3>6. Credit history and contact</h3><p>Refunds and billing reversals appear in the customer's credit history. Email <a href="mailto:support@mydreamshoots.com">support@mydreamshoots.com</a> with your account email and purchase details.</p>`
  }
};
const policyCanonicalPathBySlug = {
  "/policies/privacy": "/privacy",
  "/privacy": "/privacy",
  "/privacy-policy": "/privacy",
  "/policies/terms": "/terms",
  "/terms": "/terms",
  "/terms-of-service": "/terms",
  "/policies/content": "/content",
  "/content": "/content",
  "/content-policy": "/content",
  "/policies/refunds": "/refunds",
  "/refunds": "/refunds",
  "/refund-policy": "/refunds"
};

const replacements = new Map([
  ["For broader browsing, open <a href=\"/collections\">Browse packages</a> and compare", "Start with <a href=\"/collections/headshots\">Headshot Generator</a>, then compare"],
  ["For broader browsing, open <a href=\"/collections\">Photo Packages</a> and compare", "Start with <a href=\"/collections/headshots\">Headshot Generator</a>, then compare"],
  ["<a href=\"/collections\">Browse packages</a>", "<a href=\"/collections/headshots\">Headshot Generator</a>"],
  ["Browse packages, compare credit costs, then sign in to upload photos and start the generation request.", "Open the Headshot Generator, compare credit costs, then sign in to upload photos and start the generation request."],
  ["MyDreamShoots Pricing | Credits for Private AI Browse packages", "MyDreamShoots Pricing | Credits for Private AI Headshot Generator"],
  ["Terms of Service for MyDreamShoots AI Browse packages", "Terms of Service for MyDreamShoots AI Headshot Generator"],
  ["Browse packages", "Headshot Generator"],
  ["AI photo packages that feel like a real shoot", "Studio-quality AI photos from the selfies on your phone."],
  ["AI photo packages that feel real", "Studio-quality AI photos from the selfies on your phone."],
  ["Upload selfies, build a private model, then buy photo packages with monthly credits.", "Upload your photos once, then create private headshots, creator portraits, fan posters, beauty previews, and themed albums. You see the credit cost before every generation."],
  ["Upload clear photos once, then create private headshots, creator portraits, fan posters, beauty previews, and themed albums. You see the credit cost before every generation.", "Upload your photos once, then create private headshots, creator portraits, fan posters, beauty previews, and themed albums. You see the credit cost before every generation."],
  ["Get Started", "Create my first photo set"],
  ["Get started", "Create my first photo set"],
  ["Start a photo set", "Create my first photo set"],
  ["Private uploads and clear credit costs", "Private uploads · Credit cost shown upfront · Download your favorites"],
  ["Private uploads, visible credit costs, and gallery delivery", "Private uploads · Credit cost shown upfront · Download your favorites"],
  ["AI photo packages, personal models, Studio tools, credits, and private gallery delivery", "Private AI photo sets with visible credit costs and gallery delivery"],
  ["Create realistic AI photo packages from everyday uploads.", "Create private AI photo sets from everyday selfies."],
  ["Trusted funnel signals", "Private photo sets for work profiles, fan posts, creator pages, and personal albums"],
  ["proof bridge", "private result comparison"],
  ["Clean founder, LinkedIn, resume, and team-ready portraits.", "Create work-ready headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles. Credit cost is shown before generation."],
  ["Create work-ready headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles.", "Create work-ready headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles. Credit cost is shown before generation."],
  ["Stadium portraits, fan posters, match-day avatars, and private social albums.", "Create personal fan portraits, match-day posters, and profile avatars from your own selfies. For personal fan use only; do not use official marks or player likenesses without permission."],
  ["Stadium meet-ups, fan posters, and sports profile visuals.", "Create personal fan portraits, match-day posters, and profile avatars from your own selfies. For personal fan use only; do not use official marks or player likenesses without permission."],
  ["Stadium portraits, fan posters, and match-day profile scenes.", "Create personal fan portraits, match-day posters, and profile avatars from your own selfies. For personal fan use only; do not use official marks or player likenesses without permission."],
  ["Build stadium scenes, fan posters, and match-day profile images.", "Create personal fan portraits, match-day posters, and profile avatars from your own selfies. Personal fan use only."],
  ["Tasteful private portraits with soft lighting, confident styling, and album-only delivery.", "Create a private boudoir-inspired portrait set from photos you own and have permission to use. Adult, consensual use only."],
  ["Polished creator-ready portraits.", "Generate fresh profile portraits for newsletters, landing pages, thumbnails, media kits, and social profiles."],
  ["Generate creator-ready profile photos, channel visuals, and campaign portraits.", "Generate fresh profile portraits for newsletters, landing pages, thumbnails, media kits, and social profiles."],
  ["Cinematic cyberpunk scenes.", "Turn your selfie into a neon city portrait with night lights, futuristic styling, and high-contrast poster crops."],
  ["Neon city portraits and future-fashion scenes.", "Turn your selfie into a neon city portrait with night lights, futuristic styling, and high-contrast poster crops."],
  ["Turn source selfies into neon city portraits and dramatic future looks.", "Turn your selfie into a neon city portrait with night lights, futuristic styling, and high-contrast poster crops."],
  ["AI hairstyle transformation preview.", "Preview haircut, color, and styling ideas before you commit to a real salon change or a full image package."],
  ["Magic upscaler improves your photos.", "Sharpen a favorite generated image for cleaner downloads, profile use, and larger display sizes."],
  ["Preview higher-resolution delivery for finished photos and profile images.", "Sharpen a favorite generated image for cleaner downloads, profile use, and larger display sizes."],
  ["Some lightweight tools may support previews, but private model creation, premium photo packages, and final generation use paid credits because they consume dedicated generation capacity.", "Some lightweight tools can be free. Private model creation and premium photo packages require credits because they use dedicated generation capacity."],
  ["Do MyDreamShoots tools require payment?", "Can I try MyDreamShoots for free?"],
  ["Are my uploads private?", "Are my uploaded photos private?"],
  ["How do credits work?", "When are credits used?"],
  ["Monthly plans grant credits to the customer account. Creating a package reserves the needed credits first, successful results consume them, and failed requests can return them.", "Credit cost is shown before each generation. Different packages may use different credit amounts based on style, output size, and generation settings."],
  ["Use 8-12 clear phone photos per person.", "Upload clear photos you own or have permission to use."],
  ["Build private model", "Review the credit cost"],
  ["Keep identity consistent across packages and styles.", "Review the credit cost before generation."],
  ["Keep identity consistent across packages.", "Review the credit cost before generation."],
  ["40 photos", "Private gallery"],
  ["20 photos", "Work profiles"],
  ["about 20 minutes", "when your generation is ready"],
  ["12,000+ albums generated", "Private albums delivered"],
  ["5-star reviews", "Use cases"],
  ["4.9/5 from creators using private photo packs", "Ways people use MyDreamShoots"]
]);

const useCaseCards = new Map([
  ["Ava Mercer", ["Daily creator content", "Create daily content without spending hours on outfit changes, makeup, hairstyling, or studio setup.", "Creator workflow", "Photos and short videos"]],
  ["LinkedIn refresh", ["Daily creator content", "Create daily content without spending hours on outfit changes, makeup, hairstyling, or studio setup.", "Creator workflow", "Photos and short videos"]],
  ["Lucas Bennett", ["Wedding website visuals", "Build wedding-style albums and realistic short videos that can support a couple's wedding website or announcement page.", "Wedding stories", "Albums and video clips"]],
  ["Match-day fan posts", ["Wedding website visuals", "Build wedding-style albums and realistic short videos that can support a couple's wedding website or announcement page.", "Wedding stories", "Albums and video clips"]],
  ["Mia Collins", ["Family memory album", "Recreate meaningful family scenes from approved photos, including memorial albums and gentle hug videos for loved ones.", "Keepsake scenes", "Private family gallery"]],
  ["Creator profile update", ["Family memory album", "Recreate meaningful family scenes from approved photos, including memorial albums and gentle hug videos for loved ones.", "Keepsake scenes", "Private family gallery"]],
  ["Noah Reed", ["Prompt-led video scene", "Use up to 7 selected frame images, choose 6 or 10 seconds, review credits first, then save the result in your private gallery.", "Video previews", "6-10 second clips"]],
  ["Private style preview", ["Prompt-led video scene", "Use up to 7 selected frame images, choose 6 or 10 seconds, review credits first, then save the result in your private gallery.", "Video previews", "6-10 second clips"]]
]);

function rewriteString(value) {
  let next = value;
  for (const [from, to] of replacements) next = next.replaceAll(from, to);
  return next;
}

function normalizeHeadshotGeneratorCtas(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  const normalizePair = (labelKey, hrefKey) => {
    if (!(labelKey in value)) return;
    const label = value[labelKey];
    const href = value[hrefKey];
    if (label === "Browse packages" || label === "Photo Packages" || (label === headshotGeneratorLabel && href === "/collections")) {
      value[labelKey] = headshotGeneratorLabel;
      if (hrefKey) value[hrefKey] = headshotGeneratorHref;
    }
  };

  normalizePair("label", "href");
  normalizePair("primaryCta", "primaryHref");
  normalizePair("secondaryCta", "secondaryHref");
  normalizePair("ctaLabel", "ctaHref");
}

function isBlogPageSlug(slug) {
  return slug === "/blog" || String(slug ?? "").startsWith("/blog/");
}

function rewriteJson(value) {
  if (typeof value === "string") return rewriteString(value);
  if (Array.isArray(value)) return value.map(rewriteJson);
  if (!value || typeof value !== "object") return value;

  if (typeof value.name === "string" && useCaseCards.has(value.name)) {
    const [name, quote, role, location] = useCaseCards.get(value.name);
    value.name = name;
    value.quote = quote;
    value.role = role;
    value.location = location;
    value.rating = "";
  }

  if (value.summaryRating) value.summaryRating = "";
  if (value.summaryMeta === "Realistic customer stories for AI photo package buyers" || value.summaryMeta === "Example use cases") {
    value.subtitle = "Real stories for social content, wedding pages, family keepsakes, and short AI videos.";
    value.summaryBody = "Turn everyday selfies and family photos into private albums, gallery-ready images, and 6-10 second video moments.";
    value.summaryMeta = "Narrative examples";
  }
  if (value.title === "What Our Customers Say" || value.title === "Realistic customer stories") value.title = "Ways people use MyDreamShoots";

  normalizeHeadshotGeneratorCtas(value);
  for (const key of Object.keys(value)) {
    value[key] = rewriteJson(value[key]);
  }
  normalizeHeadshotGeneratorCtas(value);
  return value;
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function removeStateCaches() {
  for (const dir of [".next", ".next-dev", ".next-3002", ".next-docx-verify"]) {
    const cacheFile = path.join(process.cwd(), dir, "cache/platform-state-postgres.json");
    if (fs.existsSync(cacheFile)) fs.rmSync(cacheFile, { force: true });
  }
}

function setPageSeo(page, title, description, keywords) {
  const update = structuredClone(page);
  update.seo ??= {};
  update.seo.title = title;
  update.seo.description = description;
  if (keywords) update.seo.keywords = keywords;
  else delete update.seo.keywords;
  return update;
}

function updateThemeSeoPolicyPage(themeJson, pageId, canonicalPath) {
  const copy = policyCopyByCanonicalPath[canonicalPath];
  if (!copy) return;
  const pageSeo = themeJson?.seo?.pages?.[pageId];
  if (!pageSeo) return;
  pageSeo.title = copy.seoTitle;
  pageSeo.description = policyDescriptions[canonicalPath];
  pageSeo.keywords = policyKeywords;
  pageSeo.canonicalPath = canonicalPath;
  pageSeo.robots = { index: true, follow: true };
  pageSeo.index = true;
  pageSeo.follow = true;
}

function updatePolicyJson(pageJson, canonicalPath) {
  const copy = policyCopyByCanonicalPath[canonicalPath];
  if (!pageJson || !copy) return pageJson;

  pageJson.seo ??= {};
  pageJson.seo.title = copy.seoTitle;
  pageJson.seo.description = policyDescriptions[canonicalPath];
  pageJson.seo.keywords = policyKeywords;
  pageJson.seo.canonicalPath = canonicalPath;
  pageJson.seo.robots = { index: true, follow: true };
  pageJson.seo.index = true;
  pageJson.seo.follow = true;

  pageJson.sections ??= {};
  pageJson.sections.policy_1 ??= { type: "policy_content", blocks: [], settings: {} };
  pageJson.sections.policy_1.settings ??= {};
  pageJson.sections.policy_1.settings.title = copy.sectionTitle;
  pageJson.sections.policy_1.settings.body = copy.body;
  pageJson.sections.policy_1.settings.lastUpdated = policyLastUpdated;
  pageJson.sections.policy_1.settings.contactEmail = "support@mydreamshoots.com";
  return pageJson;
}

function updatePolicyTemplate(templateJson, canonicalPath) {
  const copy = policyCopyByCanonicalPath[canonicalPath];
  if (!templateJson || !copy) return templateJson;
  templateJson.sections ??= {};
  templateJson.sections.policy_1 ??= { type: "policy_content", version: "1", card_name: "Policy Content", blocks: [], settings: {} };
  templateJson.sections.policy_1.settings ??= {};
  templateJson.sections.policy_1.settings.title = copy.sectionTitle;
  templateJson.sections.policy_1.settings.body = copy.body;
  templateJson.sections.policy_1.settings.lastUpdated = policyLastUpdated;
  templateJson.sections.policy_1.settings.contactEmail = "support@mydreamshoots.com";
  return templateJson;
}

function updateHomeHeroCtas(pageJson) {
  const hero = pageJson?.sections?.hero_1;
  if (!hero?.blocks) return pageJson;
  const primary = hero.blocks.find((block) => block.id === "hero_cta_primary");
  const secondary = hero.blocks.find((block) => block.id === "hero_cta_secondary");
  if (primary?.settings) primary.settings.label = "Create Now";
  if (secondary?.settings) {
    secondary.settings.label = headshotGeneratorLabel;
    secondary.settings.href = headshotGeneratorHref;
  }
  return pageJson;
}

async function main() {
  const site = await prisma.site.findFirst({
    where: {
      OR: [
        { id: "site_dreamshoot" },
        { slug: "mydreamshoots" },
        { primaryDomain: "www.mydreamshoots.com" }
      ]
    },
    select: { id: true }
  });
  if (!site) throw new Error("MyDreamShoots site not found");

  const result = { themeSettings: 0, themePages: 0, siteThemes: 0, themePublications: 0, creativePacks: 0 };
  const themePages = await prisma.themePage.findMany({ where: { siteId: site.id } });
  const blogPageIds = new Set(themePages.filter((page) => isBlogPageSlug(page.slug)).map((page) => page.id));

  const settings = await prisma.themeSettings.findUnique({ where: { siteId: site.id } });
  if (settings) {
    const draftJson = rewriteJson(structuredClone(settings.draftJson));
    const publishedJson = rewriteJson(structuredClone(settings.publishedJson));
    for (const themeSettingsJson of [draftJson, publishedJson]) {
      const seo = themeSettingsJson.seo;
      if (!seo) continue;
      seo.siteTitle = "MyDreamShoots";
      seo.titleTemplate = "%s | MyDreamShoots";
      seo.siteDescription = "Turn your selfies into stunning couple photos in seconds with MyDreamShoots – the most advanced AI photo generator maker. No studio, no outfits, just magic.";
      seo.siteKeywords = "Dream Shoots,Wedding Photoshoot,Travel Selfies,Free AI Photos,Free Photo Generator,AI Couple Photo,AI Headshot";
      for (const [pageId, pageSeo] of Object.entries(seo.pages ?? {})) {
        if (!blogPageIds.has(pageId)) delete pageSeo.keywords;
      }
      if (seo.pages?.site_dreamshoot_home) {
        seo.pages.site_dreamshoot_home.title = "Professional AI Photo Generator Online - MyDreamShoots";
        seo.pages.site_dreamshoot_home.description = "Turn your selfies into stunning couple photos in seconds with MyDreamShoots – the most advanced AI photo generator maker. No studio, no outfits, just magic.";
        seo.pages.site_dreamshoot_home.keywords = "Dream Shoots,Wedding Photoshoot,Travel Selfies,Free AI Photos,Free Photo Generator,AI Couple Photo,AI Headshot";
      }
      for (const page of themePages) updateThemeSeoPolicyPage(themeSettingsJson, page.id, policyCanonicalPathBySlug[page.slug]);
    }
    if (changed(settings.draftJson, draftJson) || changed(settings.publishedJson, publishedJson)) {
      if (!dryRun) await prisma.themeSettings.update({ where: { siteId: site.id }, data: { draftJson, publishedJson } });
      result.themeSettings += 1;
    }
  }

  for (const page of themePages) {
    let draftJson = rewriteJson(structuredClone(page.draftJson));
    let publishedJson = rewriteJson(structuredClone(page.publishedJson));
    let title = page.title;
    if (page.slug === "/") {
      draftJson = setPageSeo(draftJson, "Professional AI Photo Generator Online - MyDreamShoots", "Turn your selfies into stunning couple photos in seconds with MyDreamShoots – the most advanced AI photo generator maker. No studio, no outfits, just magic.", "Dream Shoots,Wedding Photoshoot,Travel Selfies,Free AI Photos,Free Photo Generator,AI Couple Photo,AI Headshot");
      publishedJson = setPageSeo(publishedJson, "Professional AI Photo Generator Online - MyDreamShoots", "Turn your selfies into stunning couple photos in seconds with MyDreamShoots – the most advanced AI photo generator maker. No studio, no outfits, just magic.", "Dream Shoots,Wedding Photoshoot,Travel Selfies,Free AI Photos,Free Photo Generator,AI Couple Photo,AI Headshot");
      draftJson = updateHomeHeroCtas(draftJson);
      publishedJson = updateHomeHeroCtas(publishedJson);
    }
    if (page.slug === "/pricing") {
      draftJson = setPageSeo(draftJson, "MyDreamShoots Pricing | Credits for Private AI Headshot Generator", "Compare MyDreamShoots plans and credit packs for private AI photo packages, source-photo uploads, generation requests, secure checkout, and private gallery delivery.");
      publishedJson = setPageSeo(publishedJson, "MyDreamShoots Pricing | Credits for Private AI Headshot Generator", "Compare MyDreamShoots plans and credit packs for private AI photo packages, source-photo uploads, generation requests, secure checkout, and private gallery delivery.");
    }
    if (page.slug === "/tools") {
      draftJson = setPageSeo(draftJson, "AI Photo Tools with Free Previews | Background, Headshots & Try-ons | MyDreamShoots", "Explore MyDreamShoots tools for headshots, background edits, video clips, try-on previews, private uploads, visible credits, and private albums.");
      publishedJson = setPageSeo(publishedJson, "AI Photo Tools with Free Previews | Background, Headshots & Try-ons | MyDreamShoots", "Explore MyDreamShoots tools for headshots, background edits, video clips, try-on previews, private uploads, visible credits, and private albums.");
    }
    if (page.slug === "/collections") {
      draftJson = setPageSeo(draftJson, "Browse private AI photo packages | MyDreamShoots", "Browse MyDreamShoots packages for headshots, fan photos, creator portraits, beauty looks, AI shoot packages, and cinematic private albums with visible credit costs.");
      publishedJson = setPageSeo(publishedJson, "Browse private AI photo packages | MyDreamShoots", "Browse MyDreamShoots packages for headshots, fan photos, creator portraits, beauty looks, AI shoot packages, and cinematic private albums with visible credit costs.");
    }
    if (page.slug === "/tools/headshot" || page.slug === "/collections/headshots") {
      draftJson = setPageSeo(draftJson, "AI Headshot Generator for LinkedIn, Resumes & Team Photos | MyDreamShoots", "Create work-ready AI headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles with private uploads and visible credit costs.");
      publishedJson = setPageSeo(publishedJson, "AI Headshot Generator for LinkedIn, Resumes & Team Photos | MyDreamShoots", "Create work-ready AI headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles with private uploads and visible credit costs.");
    }
    const canonicalPath = policyCanonicalPathBySlug[page.slug];
    if (canonicalPath) {
      const copy = policyCopyByCanonicalPath[canonicalPath];
      title = copy.pageTitle;
      draftJson = updatePolicyJson(draftJson, canonicalPath);
      publishedJson = updatePolicyJson(publishedJson, canonicalPath);
    }
    if (changed(page.draftJson, draftJson) || changed(page.publishedJson, publishedJson) || title !== page.title) {
      if (!dryRun) await prisma.themePage.update({ where: { id: page.id }, data: { title, draftJson, publishedJson } });
      result.themePages += 1;
    }
  }

  for (const theme of await prisma.siteTheme.findMany({ where: { siteId: site.id } })) {
    const templates = rewriteJson(structuredClone(theme.templates));
    const themeSettings = rewriteJson(structuredClone(theme.settings));
    updatePolicyTemplate(templates?.privacy, "/privacy");
    updatePolicyTemplate(templates?.terms, "/terms");
    updatePolicyTemplate(templates?.content, "/content");
    updatePolicyTemplate(templates?.refunds, "/refunds");
    if (changed(theme.templates, templates) || changed(theme.settings, themeSettings)) {
      if (!dryRun) await prisma.siteTheme.update({ where: { id: theme.id }, data: { templates, settings: themeSettings } });
      result.siteThemes += 1;
    }
  }

  for (const publication of await prisma.themePublication.findMany({ where: { siteId: site.id } })) {
    const snapshot = rewriteJson(structuredClone(publication.snapshot));
    for (const page of snapshot?.pages ?? []) {
      const canonicalPath = policyCanonicalPathBySlug[page.slug];
      if (!canonicalPath) continue;
      page.title = policyCopyByCanonicalPath[canonicalPath].pageTitle;
      page.draftJson = updatePolicyJson(page.draftJson ?? page.publishedJson ?? {}, canonicalPath);
      page.publishedJson = updatePolicyJson(page.publishedJson ?? page.draftJson ?? {}, canonicalPath);
    }
    for (const themeSettingsJson of [snapshot?.themeSettings?.draftJson, snapshot?.themeSettings?.publishedJson, snapshot?.themeSettings]) {
      if (!themeSettingsJson) continue;
      for (const page of snapshot?.pages ?? []) updateThemeSeoPolicyPage(themeSettingsJson, page.id, policyCanonicalPathBySlug[page.slug]);
    }
    updatePolicyTemplate(snapshot?.saasTheme?.templates?.privacy, "/privacy");
    updatePolicyTemplate(snapshot?.saasTheme?.templates?.terms, "/terms");
    updatePolicyTemplate(snapshot?.saasTheme?.templates?.content, "/content");
    updatePolicyTemplate(snapshot?.saasTheme?.templates?.refunds, "/refunds");
    if (changed(publication.snapshot, snapshot)) {
      if (!dryRun) await prisma.themePublication.update({ where: { id: publication.id }, data: { snapshot } });
      result.themePublications += 1;
    }
  }

  for (const pack of await prisma.creativePack.findMany({ where: { siteId: site.id } })) {
    const next = {
      ...pack,
      headline: rewriteString(pack.headline),
      description: rewriteString(pack.description),
      prompt: pack.prompt ? rewriteString(pack.prompt) : pack.prompt
    };
    if (pack.id === "pack_dreamshoot_headshots") next.description = "Create work-ready headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles. Credit cost is shown before generation.";
    if (pack.id === "pack_dreamshoot_worldcup") next.description = "Create personal fan portraits, match-day posters, and profile avatars from your own selfies. For personal fan use only; do not use official marks or player likenesses without permission.";
    if (pack.id === "pack_dreamshoot_boudoir") next.description = "Create a private boudoir-inspired portrait set from photos you own and have permission to use. Adult, consensual use only.";
    if (pack.id === "pack_dreamshoot_creator_portraits") next.description = "Generate fresh profile portraits for newsletters, landing pages, thumbnails, media kits, and social profiles.";
    if (pack.id === "pack_dreamshoot_cyberpunk") next.description = "Turn your selfie into a neon city portrait with night lights, futuristic styling, and high-contrast poster crops.";
    if (pack.id === "pack_dreamshoot_hairstyle") next.description = "Preview haircut, color, and styling ideas before you commit to a real salon change or a full image package.";
    if (pack.id === "pack_dreamshoot_upscaler") next.description = "Sharpen a favorite generated image for cleaner downloads, profile use, and larger display sizes.";
    if (next.headline !== pack.headline || next.description !== pack.description || next.prompt !== pack.prompt) {
      if (!dryRun) await prisma.creativePack.update({ where: { id: pack.id }, data: { headline: next.headline, description: next.description, prompt: next.prompt } });
      result.creativePacks += 1;
    }
  }

  if (!dryRun) removeStateCaches();
  console.log(JSON.stringify({ ok: true, dryRun, contentOverwriteGuard: contentOverwriteGuardPayload(), siteId: site.id, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
