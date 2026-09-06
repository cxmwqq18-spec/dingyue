#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_dreamshoot";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply") && !hasArgument("--dry-run");
const productionConfirmed = hasArgument("--confirm-production") && argumentValue("--confirm") === "mydreamshoots-policy-remediation";

assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: target === "production",
  productionConfirmed
});
if (apply && target !== "production") assertNonProductionWriteTarget();
if (target === "production" && apply && !productionConfirmed) {
  throw new Error("Production remediation requires --confirm-production --confirm=mydreamshoots-policy-remediation.");
}

const canonicalPaths = ["/privacy", "/terms", "/refunds", "/children-privacy", "/cookies", "/content", "/digital-delivery"];
const canonicalBySlug = new Map([
  ["/privacy", "/privacy"], ["/privacy-policy", "/privacy"], ["/policies/privacy", "/privacy"],
  ["/terms", "/terms"], ["/terms-of-service", "/terms"], ["/policies/terms", "/terms"],
  ["/refunds", "/refunds"], ["/refund-policy", "/refunds"], ["/policies/refund", "/refunds"], ["/policies/refunds", "/refunds"],
  ["/children-privacy", "/children-privacy"], ["/children-privacy-policy", "/children-privacy"], ["/childrens-privacy", "/children-privacy"], ["/policies/children-privacy", "/children-privacy"],
  ["/cookies", "/cookies"], ["/cookie-policy", "/cookies"], ["/policies/cookies", "/cookies"],
  ["/content", "/content"], ["/content-policy", "/content"], ["/policies/content", "/content"],
  ["/digital-delivery", "/digital-delivery"], ["/shipping", "/digital-delivery"], ["/shipping-policy", "/digital-delivery"], ["/delivery-policy", "/digital-delivery"], ["/policies/shipping", "/digital-delivery"], ["/policies/delivery", "/digital-delivery"], ["/policies/delivery-policy", "/digital-delivery"]
]);

const policySeo = {
  "/privacy": {
    title: "Privacy Policy for AI Photo and Video Uploads, Credits, and Private Albums",
    description: "Review how myDreamshoots handles account data, uploaded source photos, generated images and videos, credit activity, checkout records, and private album access."
  },
  "/terms": {
    title: "Terms of Service for myDreamshoots AI Photo and Video Services",
    description: "Review the myDreamshoots terms for customer accounts, AI photo and video credits, uploads, generation limits, refunds, private gallery access, and the current data-handling policy."
  },
  "/refunds": {
    title: "Refund Policy for myDreamshoots Credits, Plans, and Failed Jobs",
    description: "Review how myDreamshoots handles results-based refund reviews, unused credits, subscription cancellations, technical failures, reruns, billing reversals, and account credit history."
  },
  "/children-privacy": {
    title: "Children's Privacy Notice | myDreamshoots",
    description: "Read the myDreamshoots Children's Privacy Notice for COPPA-related account access, minor image uploads, parent or guardian requests, and private gallery handling."
  },
  "/cookies": {
    title: "Cookie Policy | myDreamshoots",
    description: "How myDreamshoots uses essential browser storage for sign-in, checkout continuity, security, preferences, and private AI photo and video galleries."
  },
  "/content": {
    title: "Content Policy for myDreamshoots Uploads and AI Photo and Video Outputs",
    description: "Read the myDreamshoots content policy for permitted source photos, upload rights, identity consent, moderation review, private album use, and AI photo and video outputs."
  },
  "/digital-delivery": {
    title: "Digital Delivery Policy for AI Photos and Videos | myDreamshoots",
    description: "Learn how myDreamshoots delivers digital credits, AI-generated photos and videos, downloads, and private gallery access. No physical products are shipped."
  }
};

const privacyFooterNotice = "Separate Children's Privacy and State Privacy notices explain child-related requests and regional privacy rights that may apply to your use of the service.";
const termsUploadRule = "You may upload only photos, reference images, prompts, or other materials that you own or have permission to use. Do not upload photos of minors or non-consenting people unless you have the legal right and consent required for the requested use. Do not upload photos of public figures, protected marks, stolen images, or other materials without the rights or permissions required for the requested use, or that violate law, platform rules, or third-party rights.";
const mydreamshootsShippingPolicyBody = "<p>myDreamshoots provides digital AI photo and video services. This policy explains how credits, generated files, downloads, and private gallery access are delivered. We do not ship physical products.</p><h3>No physical products</h3><p>myDreamshoots does not ship physical products, printed photos, USB drives, or mailed merchandise from this storefront. All purchases and outputs described in this policy are digital.</p><h3>Credits and digital delivery</h3><p>Credits are added to the customer account after payment is confirmed. Generated images and videos become available in the signed-in customer workspace or private gallery when the relevant job is complete. Downloads are provided through the applicable workspace or gallery.</p><h3>Delivery timing</h3><p>Processing time can vary based on the source photo, selected package or generation settings, provider availability, moderation review, and system load.</p><h3>Failed or delayed jobs</h3><p>If a service-side issue prevents a digital result from being delivered, contact support. Depending on the circumstances, support may release reserved credits, rerun the job, troubleshoot the account, or review refund eligibility under the Refund Policy.</p><h3>No tracking, customs, or shipping charges</h3><p>Because purchases are digital, myDreamshoots does not provide carrier tracking numbers and does not charge shipping, customs, duties, or physical handling fees.</p><h3>Contact</h3><p>If a credit, generated file, download, or private gallery result does not appear in the workspace, email <a href=\"mailto:support@mydreamshoots.com\">support@mydreamshoots.com</a> with the account email, order or job details, and a short description of the issue.</p>";
const replacements = [
  ["AES-256 at rest", "AES-256 encryption at rest"],
  ["TLS 256-bit in transit", "TLS encryption in transit"],
  ["Our footer links include KIDS Act and State Privacy notices because privacy, child-related requests, deletion, access, correction, and regional privacy rights matter for AI photo services.", privacyFooterNotice],
  ["Our footer links include KIDS Act and DPDPA notices because privacy, child-related requests, deletion, access, correction, and regional privacy rights matter for AI photo services.", privacyFooterNotice],
  ["100% money-back guarantee", "Results-based refund review"],
  ["Money-back guarantee", "Results-based refund review"],
  ["money-back guarantee review", "results-based refund review"],
  ["generated portraits", "generated images and videos"],
  ["AI photo results can vary", "AI photo and video results can vary"],
  ["use AI photo tools", "use AI photo and video tools"],
  ["start AI photo jobs", "start AI photo or video generation jobs"],
  ["AI photo service", "AI photo and video service"],
  ["AI photo services", "AI photo and video services"],
  ["Content Policy for myDreamshoots Uploads and AI Photo Outputs", "Content Policy for myDreamshoots Uploads and AI Photo and Video Outputs"],
  ["digital AI photo credits, generated image packages, downloads, and private gallery access.", "digital credits for AI photo and video generation, generated image packages, video outputs, downloads, and private gallery access."],
  ["Children's Privacy Notice (KIDS Act)", "Children's Privacy Notice"],
  ["myDreamshoots KIDS Act", "Children's Privacy Notice | myDreamshoots"],
  ["KIDS Act", "Children's Privacy"],
  ["COPPA-aware privacy questions", "COPPA-related privacy questions"],
  ["COPPA-aware handling", "COPPA-related handling"],
  ["Customers should use the service only if they can lawfully manage an account or have permission from a parent or legal guardian.", "A parent, legal guardian, or other authorized adult must manage any child-related request and have the legal right and consent required for the requested use."],
  ["Terms for using myDreamshoots photo packages, credits, and albums.", "Terms for using myDreamshoots photo and video tools, credits, and private albums."],
  ["These terms apply when you use www.mydreamshoots.com, create an account, buy credits, start AI photo jobs, or access private generated albums.", "These terms apply when you use www.mydreamshoots.com, create an account, buy credits, start AI photo or video generation jobs, or access private generated albums."],
  ["<h3>1. 100% money-back guarantee</h3>", "<h3>1. Results-based refund review</h3>"],
  ["<strong>100% money-back guarantee.</strong>", "<strong>Results-based refund review.</strong>"],
  ["<h3>1. Money-back guarantee review</h3>", "<h3>1. Results-based refund review</h3>"],
  ["including the 100% money-back guarantee when the shoot does not look like you, subject to support review, account history, and the details of the affected request.", "including a results-based refund review when a result does not look like you, subject to the conditions and review process described in that policy."],
  ["including the money-back guarantee review.", "including a results-based refund review."],
  ["including the money-back guarantee review", "including a results-based refund review"],
  ["<h3>4. AES-256 encryption at rest · TLS encryption in transit</h3>", "<h3>4. AES-256 encryption at rest · TLS encryption in transit</h3>"],
  ["generated images and albums", "generated images, videos, and albums"],
  ["generated image packages, downloads, and private gallery access", "generated image packages, video outputs, downloads, and private gallery access"]
];

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function replaceText(value) {
  if (typeof value !== "string") return value;
  let next = value;
  for (const [from, to] of replacements) next = next.replaceAll(from, to);
  return next;
}

function mapStrings(value) {
  if (typeof value === "string") return replaceText(value);
  if (Array.isArray(value)) return value.map(mapStrings);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, mapStrings(child)]));
}

function setPolicySeo(json, canonicalPath) {
  const next = clone(json ?? {});
  const seo = policySeo[canonicalPath];
  next.seo = {
    ...(next.seo ?? {}),
    title: seo.title,
    description: seo.description,
    canonicalPath,
    canonical: canonicalPath === "/cookies"
      ? "https://www.mydreamshoots.com/cookies"
      : canonicalPath === "/digital-delivery"
        ? "https://www.mydreamshoots.com/digital-delivery"
        : (next.seo?.canonical || canonicalPath),
    index: true,
    follow: true,
    robots: { ...(next.seo?.robots ?? {}), index: true, follow: true }
  };
  return next;
}

function updateShippingLink(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const next = clone(value);
  const updateList = (list) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const settings = item.settings && typeof item.settings === "object" ? item.settings : item;
      if (["/shipping", "/shipping-policy", "/delivery-policy", "/policies/shipping", "/policies/delivery", "/policies/delivery-policy"].includes(settings.href)) {
        settings.href = "/digital-delivery";
        settings.label = "Digital Delivery Policy";
      }
    }
  };
  updateList(next.navigation?.footerLinks);
  updateList(next.globalSections?.footer?.blocks);
  return next;
}

function updateChildrenPage(json) {
  const next = mapStrings(json);
  next.title = "Children's Privacy Notice";
  next.seo = { ...(next.seo ?? {}), title: policySeo["/children-privacy"].title, description: policySeo["/children-privacy"].description };
  for (const section of Object.values(next.sections ?? {})) {
    if (!section?.settings) continue;
    if (section.settings.title === "KIDS Act" || section.settings.title === "Children's Privacy Notice (KIDS Act)") section.settings.title = "Children's Privacy Notice";
    if (typeof section.settings.body === "string") section.settings.body = replaceText(section.settings.body);
  }
  return next;
}

function updatePolicyJson(json, canonicalPath) {
  let next = mapStrings(json);
  next = setPolicySeo(next, canonicalPath);
  if (canonicalPath === "/children-privacy") return updateChildrenPage(next);
  if (canonicalPath === "/privacy") {
    const body = next.sections?.policy_1?.settings?.body;
    if (typeof body === "string") next.sections.policy_1.settings.body = body
      .replace(/This Privacy Policy explains how [^<]+handles customer accounts, uploaded source photos, generated images and videos, prompts, credit activity, checkout records, cookies, support messages, and private album access\./i,
        "This Privacy Policy explains how myDreamshoots handles customer accounts, uploaded source photos, generated images and videos, prompts, credit activity, checkout records, cookies, support messages, and private album access.")
      .replace(/Our footer links include [^<]+matter for AI photo services\./i, privacyFooterNotice);
  }
  if (canonicalPath === "/refunds") {
    const body = next.sections?.policy_1?.settings?.body;
    if (typeof body === "string") next.sections.policy_1.settings.body = body
      .replace(/If the shoot does not look like you, contact support for a refund review\./g, "If the result does not look like you, contact support with the affected order and a short explanation.")
      .replace(/Money-back guarantee\.?/g, "Results-based refund review.");
  }
  if (canonicalPath === "/digital-delivery") {
    const policySettings = next.sections?.policy_1?.settings;
    if (policySettings) {
      policySettings.title = "Digital Delivery Policy";
      policySettings.lastUpdated = "2026-09-05";
      policySettings.body = mydreamshootsShippingPolicyBody;
    }
  }
  if (canonicalPath === "/terms" && next.sections?.policy_1?.settings?.body) {
    next.sections.policy_1.settings.body = next.sections.policy_1.settings.body.replace(
      /You may upload only photos, reference images, prompts, or other materials that you own or have permission to use\. Do not upload[^<]+/i,
      termsUploadRule
    ).replace(
      /including the Results-based refund review when the shoot does not look like you, subject to support review, account history, and the details of the affected request\./i,
      "including a results-based refund review when a result does not look like you, subject to the conditions and review process described in that policy."
    );
  }
  return next;
}

function updateThemeSettingsJson(value) {
  const next = mapStrings(value);
  const updateSeoPages = (node) => {
    if (Array.isArray(node)) return node.map(updateSeoPages);
    if (!node || typeof node !== "object") return node;
    const updated = Object.fromEntries(Object.entries(node).map(([key, child]) => [key, updateSeoPages(child)]));
    const pages = updated.pages;
    if (pages && typeof pages === "object" && !Array.isArray(pages)) {
      for (const [key, page] of Object.entries(pages)) {
        if (!page || typeof page !== "object") continue;
        const lower = key.toLowerCase();
        const canonicalPath = lower.includes("children_privacy") ? "/children-privacy"
          : lower.includes("state_privacy") ? undefined
          : lower.includes("privacy") ? "/privacy"
          : lower.includes("terms") ? "/terms"
          : lower.includes("refund") ? "/refunds"
          : lower.includes("cookie") ? "/cookies"
          : lower.includes("content") ? "/content"
          : lower.includes("shipping") || lower.includes("delivery") ? "/digital-delivery"
          : undefined;
        if (!canonicalPath) continue;
        page.title = policySeo[canonicalPath].title;
        page.description = policySeo[canonicalPath].description;
        page.canonicalPath = canonicalPath;
        page.index = true;
        page.follow = true;
        page.robots = { ...(page.robots ?? {}), index: true, follow: true };
      }
    }
    return updated;
  };
  const withSeo = updateSeoPages(next);
  return updateShippingLink(withSeo);
}

function updatePageRecord(record, contentKey) {
  const canonicalPath = canonicalBySlug.get(record.slug);
  if (!canonicalPath) return record;
  const next = clone(record);
  if (canonicalPath === "/digital-delivery" && record.slug === "/shipping") next.slug = "/digital-delivery";
  next.title = canonicalPath === "/children-privacy" ? "Children's Privacy Notice" : canonicalPath === "/content" ? "Content policy" : canonicalPath === "/refunds" ? "Refund policy" : canonicalPath === "/digital-delivery" ? "Digital Delivery Policy" : canonicalPath === "/terms" ? "Terms of Service" : canonicalPath === "/cookies" ? "Cookie policy" : "Privacy policy";
  next[contentKey] = updatePolicyJson(next[contentKey], canonicalPath);
  return next;
}

function updateStateSite(site) {
  if (!site || site.id !== SITE_ID) return site;
  const next = clone(site);
  next.pages = (next.pages ?? []).map((page) => {
    const updated = updatePageRecord(page, "draftJson");
    const canonicalPath = canonicalBySlug.get(page.slug);
    if (canonicalPath && updated.publishedJson) updated.publishedJson = updatePolicyJson(updated.publishedJson, canonicalPath);
    return updated;
  });
  if (next.themeSettings) {
    next.themeSettings = clone(next.themeSettings);
    next.themeSettings.draftJson = updateThemeSettingsJson(next.themeSettings.draftJson);
    next.themeSettings.publishedJson = updateThemeSettingsJson(next.themeSettings.publishedJson);
  }
  next.siteThemes = (next.siteThemes ?? []).map((theme) => ({
    ...theme,
    templates: updateThemeTemplates(theme.templates),
    settings: updateThemeSettingsJson(theme.settings)
  }));
  return next;
}

function updateThemeTemplates(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const next = clone(value);
  for (const [key, template] of Object.entries(next)) {
    const canonicalPath = canonicalBySlug.get(`/${key}`) ?? canonicalBySlug.get(key) ?? (key === "privacy" || key === "terms" || key === "cookies" || key === "refunds" || key === "content" || key === "shipping" || key === "digital-delivery" ? `/${key}` : key === "policies/children-privacy" ? "/children-privacy" : undefined);
    if (canonicalPath) next[key] = updatePolicyJson(template, canonicalPath);
    else next[key] = updateShippingLink(mapStrings(template));
  }
  return next;
}

function updateBackupState(state) {
  const next = clone(state);
  next.sites = (next.sites ?? []).map(updateStateSite);
  next.siteThemes = (next.siteThemes ?? []).map((theme) => theme.siteId === SITE_ID ? { ...theme, templates: updateThemeTemplates(theme.templates), settings: updateThemeSettingsJson(theme.settings) } : theme);
  return next;
}

function stable(value) {
  return JSON.stringify(value);
}

const prisma = new PrismaClient();
try {
  const [themePages, livePages, themeSettings, siteThemes, platformState] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID } }),
    prisma.siteTheme.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } }),
    prisma.platformStateDocument.findUnique({ where: { id: "platform" }, select: { state: true } })
  ]);
  const targetThemePages = themePages.filter((page) => canonicalBySlug.has(page.slug));
  const targetLivePages = livePages.filter((page) => canonicalBySlug.has(page.slug));
  for (const canonicalPath of canonicalPaths) {
    assert(targetThemePages.some((page) => canonicalBySlug.get(page.slug) === canonicalPath), `missing ThemePage for ${canonicalPath}`);
    assert(targetLivePages.some((page) => canonicalBySlug.get(page.slug) === canonicalPath), `missing LivePage for ${canonicalPath}`);
  }
  assert(themeSettings, "MyDreamShoots ThemeSettings row is required");
  assert(platformState?.state && typeof platformState.state === "object", "platform state document is required");

  const nextThemePages = targetThemePages.map((page) => updatePageRecord(page, "draftJson"));
  for (const page of nextThemePages) page.publishedJson = updatePolicyJson(page.publishedJson, canonicalBySlug.get(page.slug));
  const nextLivePages = targetLivePages.map((page) => updatePageRecord(page, "contentJson"));
  const nextThemeSettings = {
    ...themeSettings,
    draftJson: updateThemeSettingsJson(themeSettings.draftJson),
    publishedJson: updateThemeSettingsJson(themeSettings.publishedJson)
  };
  const nextSiteThemes = siteThemes.map((theme) => ({ ...theme, templates: updateThemeTemplates(theme.templates), settings: updateThemeSettingsJson(theme.settings) }));
  const nextState = updateBackupState(platformState.state);
  const changed = {
    themePages: nextThemePages.filter((page, index) => stable(page) !== stable(targetThemePages[index])).map((page) => page.slug),
    livePages: nextLivePages.filter((page, index) => stable(page) !== stable(targetLivePages[index])).map((page) => page.slug),
    themeSettings: stable(nextThemeSettings) !== stable(themeSettings),
    siteThemes: nextSiteThemes.filter((theme, index) => stable(theme) !== stable(siteThemes[index])).map((theme) => theme.id),
    platformState: stable(nextState) !== stable(platformState.state)
  };
  const backupDir = path.join(process.cwd(), "releases", "backups", target);
  const backupPath = path.join(backupDir, `mydreamshoots-policy-remediation-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const report = { ok: true, mode: apply ? "apply" : "dry-run", target, siteId: SITE_ID, canonicalPaths, changed, backupPath: apply ? backupPath : null };
  if (apply) {
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId: SITE_ID, themePages: targetThemePages, livePages: targetLivePages, themeSettings, siteThemes, platformState }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      for (const page of nextThemePages) await tx.themePage.update({ where: { id: page.id }, data: { slug: page.slug, title: page.title, draftJson: page.draftJson, publishedJson: page.publishedJson } });
      for (const page of nextLivePages) await tx.livePage.update({ where: { id: page.id }, data: { slug: page.slug, title: page.title, contentJson: page.contentJson } });
      await tx.themeSettings.update({ where: { id: themeSettings.id }, data: { draftJson: nextThemeSettings.draftJson, publishedJson: nextThemeSettings.publishedJson } });
      for (const theme of nextSiteThemes) await tx.siteTheme.update({ where: { id: theme.id }, data: { templates: theme.templates, settings: theme.settings } });
      await tx.platformStateDocument.update({ where: { id: "platform" }, data: { state: nextState } });
    }, { timeout: 120_000 });
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
