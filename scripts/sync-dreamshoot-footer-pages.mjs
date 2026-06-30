import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const companyAddress = "8 THE GREEN STE B, DOVER, DE 19901";

const brandProfiles = [
  {
    matcher: /mydreamshoots|dreamshoot/i,
    brand: "MyDreamShoots",
    footerTitle: "ʍʏƉʀɛǟʍֆhoots",
    footerLogoImageUrl: "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260621b",
    footerLogoAlt: "MyDreamShoots heart camera logo",
    supportEmail: "support@mydreamshoots.com",
    salesEmail: "sales@mydreamshoots.com",
    aboutTitle: "About MyDreamShoots",
    aboutBody:
      "MyDreamShoots is a private AI photo package workspace for everyday uploads, personal AI models, visible credits, secure checkout, and customer-only gallery delivery.",
    aboutSeoTitle: "About MyDreamShoots - private AI photo packages and albums",
    aboutDescription:
      "Learn about MyDreamShoots, an AI photo package workspace for private uploads, personal AI models, clear credits, secure checkout, and customer-only gallery delivery.",
    contactSeoTitle: "Contact MyDreamShoots - support, sales, and company address",
    contactDescription:
      "Contact MyDreamShoots for AI photo package support, sales questions, account help, billing review, privacy requests, or company address information.",
    footerLinks: [
      ["Photo Packages", "/collections", "product"],
      ["Tools", "/tools", "product"],
      ["How it works", "/#workflow", "product"],
      ["Pricing", "/pricing", "product"],
      ["Help center", "/help", "company"],
      ["Guides", "/blog", "company"],
      ["About us", "/about-us", "company"],
      ["Contact us", "/contact-us", "company"],
      ["Creators Circle", "/creators-circle", "company"],
      ["Privacy Policy", "/privacy", "support"],
      ["Content policy", "/content", "support"],
      ["Terms of Service", "/terms", "support"],
      ["Cookie Policy", "/cookies", "support"]
    ]
  },
  {
    matcher: /aidreamcapes/i,
    brand: "Aidreamcapes",
    footerTitle: "Aidreamcapes",
    footerLogoImageUrl: "/assets/dreamshoot/brand/aidreamcapesai-logo-refined.svg?v=aidreamcapes-cream",
    footerLogoAlt: "Aidreamcapes heart logo for cinematic dreamscape portraits and private galleries",
    supportEmail: "support@aidreamcapes.com",
    salesEmail: "sales@aidreamcapes.com",
    aboutTitle: "About Aidreamcapes",
    aboutBody:
      "Aidreamcapes is a private AI dreamscape portrait workspace for source photo planning, visible credits, cinematic scenes, and customer-only gallery delivery.",
    aboutSeoTitle: "About Aidreamcapes - private AI dreamscape portraits and galleries",
    aboutDescription:
      "Learn about Aidreamcapes, a private AI dreamscape portrait workspace for source photo planning, visible credits, cinematic scenes, and customer-only gallery delivery.",
    contactSeoTitle: "Contact Aidreamcapes - support, sales, and company address",
    contactDescription:
      "Contact Aidreamcapes for dreamscape portrait support, source photo guidance, sales questions, billing review, privacy requests, or company address information.",
    footerLinks: [
      ["Travel Packages", "/collections", "product"],
      ["Tools", "/tools", "product"],
      ["How it works", "/#workflow", "product"],
      ["Pricing", "/pricing", "product"],
      ["Help Center", "/help", "company"],
      ["Field Notes", "/blog", "company"],
      ["About the Studio", "/about-us", "company"],
      ["Contact the Studio", "/contact-us", "company"],
      ["Creators Circle", "/creators-circle", "company"],
      ["Privacy Policy", "/privacy", "support"],
      ["Creative Safety", "/content", "support"],
      ["Terms of Service", "/terms", "support"],
      ["Cookie Policy", "/cookies", "support"]
    ]
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function profileForSite(site) {
  const identity = `${site.id} ${site.slug} ${site.name} ${site.primaryDomain} ${site.branding?.logoText ?? ""}`;
  return brandProfiles.find((profile) => profile.matcher.test(identity));
}

function pageJson(profile, page) {
  const isContact = page === "contact";
  const isShipping = page === "shipping";
  const title = isShipping ? "Shipping and Digital Delivery Policy" : isContact ? `Contact ${profile.brand}` : profile.aboutTitle;
  const body = isShipping
    ? `<h3>No physical shipping</h3><p>${profile.brand} sells digital AI photo credits, generated image packages, and private gallery access. We do not ship physical products, printed photos, USB drives, or mailed merchandise from this storefront.</p><h3>Digital delivery</h3><p>Credits are added after payment confirmation. Generated images are delivered inside the signed-in customer workspace or private gallery when a job completes. Delivery timing can vary based on source photo quality, selected package settings, provider availability, moderation review, and system load.</p><h3>Failed or delayed jobs</h3><p>If a service-side issue prevents delivery, support may release reserved credits, rerun the job, troubleshoot the account, or review refund eligibility under the refund policy.</p><h3>No carrier tracking or customs</h3><p>Because orders are digital, customers do not receive carrier tracking numbers and are not charged shipping, customs, duties, or physical handling fees by ${profile.brand}.</p><h3>Contact</h3><p>Email <a href="mailto:${profile.supportEmail}">${profile.supportEmail}</a> with the account email, order or job details, and a short description if a digital delivery does not appear in the workspace.</p>`
    : isContact
      ? `<h3>Support</h3><p>Email <a href="mailto:${profile.supportEmail}">${profile.supportEmail}</a> for account access, upload guidance, billing review, refunds, privacy requests, credit history, generation status, or private gallery delivery help.</p><h3>Sales</h3><p>Email <a href="mailto:${profile.salesEmail}">${profile.salesEmail}</a> for plan questions, business use, creator collaborations, team workflows, or campaign planning.</p><h3>Company address</h3><p>${companyAddress}</p>`
      : `<p>${profile.aboutBody}</p><h3>What customers can expect</h3><p>Private uploads, focused package pages, visible credit usage, secure checkout, and finished galleries connected to the same customer account.</p><h3>Contact</h3><p>Email <a href="mailto:${profile.supportEmail}">${profile.supportEmail}</a> for support or <a href="mailto:${profile.salesEmail}">${profile.salesEmail}</a> for sales questions.</p><h3>Company address</h3><p>${companyAddress}</p>`;
  return {
    version: 1,
    pageType: isShipping ? "policy" : "content",
    sectionsOrder: ["intro_1", "content_1", "footer_1"],
    sections: {
      intro_1: {
        id: "intro_1",
        type: "rich_text",
        settings: {
          eyebrow: isContact ? "Contact" : "About",
          ...(isShipping ? { eyebrow: "Delivery policy" } : {}),
          title,
          body: isShipping
            ? `${profile.brand} orders are delivered digitally through credits, generation jobs, downloads, and private galleries.`
            : isContact
            ? `Reach ${profile.brand} support or sales for account, billing, privacy, package, and business questions.`
            : profile.aboutBody,
          headingLevel: "h1"
        },
        blocks: []
      },
      content_1: {
        id: "content_1",
        type: "policy_content",
        settings: {
          title: isShipping ? "Digital delivery and shipping" : isContact ? "Contact information" : `About ${profile.brand}`,
          lastUpdated: "June 28, 2026",
          contactEmail: profile.supportEmail,
          body
        },
        blocks: []
      },
      footer_1: {
        id: "footer_1",
        type: "footer",
        settings: {},
        blocks: []
      }
    },
    seo: {
      title: isShipping ? `${profile.brand} Shipping and Digital Delivery Policy` : isContact ? profile.contactSeoTitle : profile.aboutSeoTitle,
      description: isShipping ? `Review how ${profile.brand} delivers AI photo credits, generated images, downloads, and private galleries digitally without physical shipping.` : isContact ? profile.contactDescription : profile.aboutDescription,
      keywords: isShipping
        ? `${profile.brand} shipping policy, ${profile.brand} digital delivery, AI photo delivery, private gallery delivery`
        : isContact
        ? `Contact ${profile.brand}, ${profile.brand} support, ${profile.brand} sales, private gallery help`
        : `About ${profile.brand}, AI photo packages, private AI galleries, AI portrait workspace`,
      canonicalPath: isShipping ? "/shipping" : isContact ? "/contact-us" : "/about-us",
      robots: { index: true, follow: true }
    }
  };
}

function link(label, href, group) {
  return { label, href, group };
}

function block(id, label, href, group) {
  return { id, type: "menu_link", settings: { label, href, group } };
}

function normalizePolicyHref(href) {
  const map = {
    "/policies/privacy": "/privacy",
    "/privacy-policy": "/privacy",
    "/policies/terms": "/terms",
    "/terms-of-service": "/terms",
    "/policies/cookies": "/cookies",
    "/cookie-policy": "/cookies",
    "/policies/refunds": "/refunds",
    "/policies/refund": "/refunds",
    "/refund-policy": "/refunds",
    "/policies/content": "/content",
    "/content-policy": "/content",
    "/policies/shipping": "/shipping",
    "/shipping-policy": "/shipping",
    "/delivery-policy": "/shipping",
    "/about": "/about-us",
    "/contact": "/contact-us"
  };
  return map[href] ?? href;
}

function isVirtualGoodsFooterLinkToHide(label, href) {
  const normalizedHref = normalizePolicyHref(href ?? "").toLowerCase();
  const value = `${label ?? ""} ${normalizedHref}`.toLowerCase();
  return (
    normalizedHref === "/refunds" ||
    normalizedHref === "/shipping" ||
    /\brefunds?\b|shipping|delivery|credit review|digital delivery/.test(value)
  );
}

function upsertFooterLinks(settings, profile) {
  const next = clone(settings ?? {});
  next.navigation = next.navigation ?? {};
  const existingLinks = Array.isArray(next.navigation.footerLinks) ? next.navigation.footerLinks : [];
  const preservedExternalLinks = existingLinks
    .map((item) => ({ ...item, href: normalizePolicyHref(item.href) }))
    .filter((item) => /^https?:\/\//i.test(item.href));
  const standardLinks = profile.footerLinks.map(([label, href, group]) => link(label, href, group));
  next.navigation.footerLinks = [...standardLinks, ...preservedExternalLinks];

  next.globalSections = next.globalSections ?? {};
  next.globalSections.footer = next.globalSections.footer ?? { type: "footer", settings: {}, blocks: [] };
  next.globalSections.footer.settings = {
    ...(next.globalSections.footer.settings ?? {}),
    title: profile.footerTitle,
    logoImageUrl: profile.footerLogoImageUrl,
    logoAlt: profile.footerLogoAlt,
    contactAddress: companyAddress,
    contactEmail: profile.supportEmail,
    salesEmail: profile.salesEmail,
    copyright: `© 2026 ${profile.brand}. All rights reserved.`
  };
  const blocks = Array.isArray(next.globalSections.footer.blocks) ? next.globalSections.footer.blocks : [];
  const preservedExternalBlocks = blocks.map((item) => ({
    ...item,
    settings: { ...(item.settings ?? {}), href: normalizePolicyHref(item.settings?.href) }
  })).filter((item) => /^https?:\/\//i.test(item.settings?.href ?? ""));
  const blockPrefix = profile.brand.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  next.globalSections.footer.blocks = [
    ...profile.footerLinks.map(([label, href, group], index) => block(`${blockPrefix}_footer_${group}_${index + 1}`, label, href, group)),
    ...preservedExternalBlocks
  ];
  return next;
}

async function syncSite(site) {
  const profile = profileForSite(site);
  if (!profile) return false;

  const pages = [
    { slug: "/about-us", idSuffix: "about_us", title: "About Us", json: pageJson(profile, "about") },
    { slug: "/contact-us", idSuffix: "contact_us", title: "Contact Us", json: pageJson(profile, "contact") },
    { slug: "/policies/shipping", idSuffix: "shipping", title: "Shipping and Digital Delivery Policy", json: pageJson(profile, "shipping") }
  ];
  for (const page of pages) {
    await prisma.themePage.upsert({
      where: { siteId_slug: { siteId: site.id, slug: page.slug } },
      create: {
        id: `${site.id}_${page.idSuffix}`,
        siteId: site.id,
        pageType: "content",
        templateKey: page.slug.slice(1),
        slug: page.slug,
        title: page.title,
        draftJson: page.json,
        publishedJson: page.json
      },
      update: {
        templateKey: page.slug.slice(1),
        title: page.title,
        draftJson: page.json,
        publishedJson: page.json
      }
    });
  }

  const themeSettings = await prisma.themeSettings.findUnique({ where: { siteId: site.id } });
  if (themeSettings) {
    await prisma.themeSettings.update({
      where: { siteId: site.id },
      data: {
        draftJson: upsertFooterLinks(themeSettings.draftJson, profile),
        publishedJson: upsertFooterLinks(themeSettings.publishedJson, profile)
      }
    });
  }

  const themes = await prisma.siteTheme.findMany({ where: { siteId: site.id } });
  for (const theme of themes) {
    await prisma.siteTheme.update({
      where: { id: theme.id },
      data: { settings: upsertFooterLinks(theme.settings, profile) }
    });
  }

  console.log(`synced ${profile.brand} (${site.slug})`);
  return true;
}

try {
  const sites = await prisma.site.findMany();
  let count = 0;
  for (const site of sites) {
    if (await syncSite(site)) count += 1;
  }
  console.log(`done: ${count} site(s) synced`);
} finally {
  await prisma.$disconnect();
}
