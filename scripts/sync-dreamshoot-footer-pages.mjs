import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const defaultCompanyAddress = "8 THE GREEN STE B, DOVER, DE 19901";

const brandProfiles = [
  {
    matcher: /mydreamshoots|dreamshoot/i,
    brand: "MyDreamShoots",
    footerTitle: "MyDreamShoots",
    companyAddress: defaultCompanyAddress,
    footerLogoImageUrl: "/assets/dreamshoot/brand/dreamshootai-logo-refined.svg?v=20260621b",
    footerLogoAlt: "MyDreamShoots heart camera logo",
    supportEmail: "support@mydreamshoots.com",
    salesEmail: "",
    instagramUrl: "https://www.instagram.com/mydreamshoots",
    facebookUrl: "https://www.facebook.com/mydreamshoots",
    pinterestUrl: "https://www.pinterest.com/mydreamshoots",
    youtubeUrl: "https://www.youtube.com/@mydreamshoots",
    twitterUrl: "https://x.com/mydreamshoots",
    aboutTitle: "About MyDreamShoots",
    aboutBody:
      "MyDreamShoots is a private AI photo package workspace for everyday uploads, personal AI models, visible credits, secure checkout, and customer-only gallery delivery.",
    aboutSeoTitle: "About MyDreamShoots - private AI photo packages and albums",
    aboutDescription:
      "Learn about MyDreamShoots, an AI photo package workspace for private uploads, personal AI models, clear credits, secure checkout, and customer-only gallery delivery.",
    workflowTitle: "How MyDreamShoots works",
    workflowIntro:
      "Upload photos you own, choose the photo package you want, review the visible credit cost, generate the private request, and download finished images from your account gallery.",
    workflowSeoTitle: "How MyDreamShoots works - private AI photo generation workflow",
    workflowDescription:
      "Learn how MyDreamShoots customers upload source photos, choose AI photo packages, review credits, generate private results, and download finished galleries.",
    workflowSteps: [
      ["Upload clear photos", "Add recent source photos you own or have permission to use inside the signed-in account.", "01"],
      ["Choose a photo package", "Pick the outcome you want, such as headshots, fan posters, creator portraits, beauty previews, or themed albums.", "02"],
      ["Review the credit cost", "The request shows the credit cost before generation starts so the account history stays understandable.", "03"],
      ["Download favorites", "Finished sets land in the private gallery for review, download, and future account access.", "04"]
    ],
    contactSeoTitle: "Contact MyDreamShoots - support and company address",
    contactDescription:
      "Contact MyDreamShoots for AI photo package support, sales questions, account help, billing review, privacy requests, or company address information.",
    footerLinks: [
      ["Browse packages", "/collections", "product"],
      ["Tools", "/tools", "product"],
      ["How it works", "/workflow", "product"],
      ["Pricing", "/pricing", "product"],
      ["FAQ", "/faq", "company"],
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
    footerTitle: "ልiጋreamርapes",
    companyAddress: "30 N GOULD ST STE R,SHERIDAN,WY 82801",
    footerLogoImageUrl: "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260708c",
    footerLogoAlt: "Aidreamcapes logo for AI travel portraits and private destination galleries",
    supportEmail: "support@aidreamcapes.com",
    salesEmail: "",
    instagramUrl: "https://www.instagram.com/aidreamcapes",
    facebookUrl: "https://www.facebook.com/aidreamcapes",
    pinterestUrl: "https://www.pinterest.com/aidreamcapes",
    youtubeUrl: "https://www.youtube.com/@aidreamcapes",
    twitterUrl: "https://x.com/aidreamcapes",
    aboutTitle: "About Aidreamcapes",
    aboutBody:
      "Aidreamcapes is a private AI dreamscape portrait workspace for source photo planning, visible credits, cinematic scenes, and customer-only gallery delivery.",
    aboutSeoTitle: "About Aidreamcapes - private AI dreamscape portraits and galleries",
    aboutDescription:
      "Learn about Aidreamcapes, a private AI dreamscape portrait workspace for source photo planning, visible credits, cinematic scenes, and customer-only gallery delivery.",
    workflowTitle: "How Aidreamcapes works",
    workflowIntro:
      "Plan the destination mood, attach source photos you own, review route credits, generate private travel portraits, and collect finished images inside your account gallery.",
    workflowSeoTitle: "How Aidreamcapes works - private AI travel portrait workflow",
    workflowDescription:
      "Learn how Aidreamcapes customers plan destination moods, upload source photos, review credits, generate private travel portraits, and download finished galleries.",
    workflowSteps: [
      ["Plan the route mood", "Choose a coastal, city, resort, trail, cafe, or postcard direction before starting the request.", "01"],
      ["Attach source photos", "Upload clear portraits and optional travel references that you own or have permission to use.", "02"],
      ["Review route credits", "Confirm the credit cost before the private travel portrait request starts.", "03"],
      ["Collect the gallery", "Finished destination portraits return to the private gallery for review and download.", "04"]
    ],
    contactSeoTitle: "Contact Aidreamcapes - support and company address",
    contactDescription:
      "Contact Aidreamcapes for dreamscape portrait support, source photo guidance, billing review, privacy requests, or company address information.",
    footerLinks: [
      ["Travel Packages", "/collections", "product"],
      ["Tools", "/tools", "product"],
      ["How it works", "/workflow", "product"],
      ["Pricing", "/pricing", "product"],
      ["FAQ", "/faq", "company"],
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
  const isWorkflow = page === "workflow";
  const title = isWorkflow ? profile.workflowTitle : isShipping ? "Shipping and Digital Delivery Policy" : isContact ? `Contact ${profile.brand}` : profile.aboutTitle;
  if (isWorkflow) {
    return {
      version: 1,
      pageType: "content",
      sectionsOrder: ["intro_1", "workflow_1", "rules_1", "faq_1", "conversion_1", "footer_1"],
      sections: {
        intro_1: {
          id: "intro_1",
          type: "rich_text",
          settings: {
            eyebrow: "How it works",
            title,
            body: profile.workflowIntro,
            headingLevel: "h1",
            tone: "dark",
            primaryCta: "Browse packages",
            primaryHref: "/collections",
            secondaryCta: "View pricing",
            secondaryHref: "/pricing"
          },
          blocks: [
            { id: "workflow_private", type: "rich_text_card", settings: { meta: "Private", title: "Account-scoped uploads", description: "Source photos, requests, credit history, and finished galleries stay tied to the signed-in customer account." } },
            { id: "workflow_credits", type: "rich_text_card", settings: { meta: "Credits", title: "Visible cost before generation", description: "Customers can review the package credit cost before a generation request begins." } },
            { id: "workflow_gallery", type: "rich_text_card", settings: { meta: "Gallery", title: "Private delivery", description: "Finished results return to the customer gallery instead of a public showcase." } }
          ]
        },
        workflow_1: {
          id: "workflow_1",
          type: "studio_steps",
          settings: {
            anchor: "workflow",
            eyebrow: "Workflow",
            title: "Upload, choose, review, generate.",
            subtitle: "Each step keeps the customer journey clear before credits are reserved and after results are delivered."
          },
          blocks: profile.workflowSteps.map(([stepTitle, text, meta], index) => ({
            id: `workflow_step_${index + 1}`,
            type: "card",
            settings: { title: stepTitle, text, meta }
          }))
        },
        rules_1: {
          id: "rules_1",
          type: "rich_text",
          settings: {
            eyebrow: "Before generation",
            title: "Source photos, credits, and albums stay organized in one account.",
            body: "The workflow is built around private uploads, visible credit use, secure checkout, account-scoped jobs, and downloadable galleries. Customers should upload only photos they own or have permission to use.",
            primaryCta: "Start creating",
            primaryHref: "/login",
            secondaryCta: "Read FAQ",
            secondaryHref: "/faq"
          },
          blocks: []
        },
        faq_1: {
          id: "faq_1",
          type: "faq",
          settings: { title: "Workflow questions" },
          blocks: [
            { id: "workflow_faq_uploads", type: "faq_item", settings: { question: "What photos should customers upload?", answer: "Use clear recent photos where the face or subject is visible. Customers should only upload photos they own or have permission to use." } },
            { id: "workflow_faq_credits", type: "faq_item", settings: { question: "When are credits used?", answer: "Credits are shown before generation starts, then reserved or settled through the account credit history based on the job result." } },
            { id: "workflow_faq_delivery", type: "faq_item", settings: { question: "Where do finished images appear?", answer: "Finished images appear in the signed-in customer's private gallery for review and download." } }
          ]
        },
        conversion_1: {
          id: "conversion_1",
          type: "conversion_panel",
          settings: {
            eyebrow: "Start the workflow",
            title: "Choose a package and create a private set.",
            subtitle: "Browse packages, compare credit costs, then sign in to upload photos and start the generation request.",
            primaryCta: "Browse packages",
            primaryHref: "/collections",
            secondaryCta: "View pricing",
            secondaryHref: "/pricing"
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
        title: profile.workflowSeoTitle,
        description: profile.workflowDescription,
        keywords: `${profile.brand} workflow, AI photo workflow, private gallery workflow, credit-based generation`,
        canonicalPath: "/workflow",
        robots: { index: true, follow: true }
      }
    };
  }
  const body = isShipping
    ? `<h3>No physical shipping</h3><p>${profile.brand} sells digital AI photo credits, generated image packages, and private gallery access. We do not ship physical products, printed photos, USB drives, or mailed merchandise from this storefront.</p><h3>Digital delivery</h3><p>Credits are added after payment confirmation. Generated images are delivered inside the signed-in customer workspace or private gallery when a job completes. Delivery timing can vary based on source photo quality, selected package settings, provider availability, moderation review, and system load.</p><h3>Failed or delayed jobs</h3><p>If a service-side issue prevents delivery, support may release reserved credits, rerun the job, troubleshoot the account, or review refund eligibility under the refund policy.</p><h3>No carrier tracking or customs</h3><p>Because orders are digital, customers do not receive carrier tracking numbers and are not charged shipping, customs, duties, or physical handling fees by ${profile.brand}.</p><h3>Contact</h3><p>Email <a href="mailto:${profile.supportEmail}">${profile.supportEmail}</a> with the account email, order or job details, and a short description if a digital delivery does not appear in the workspace.</p>`
    : isContact
      ? `<h3>Support</h3><p>Email <a href="mailto:${profile.supportEmail}">${profile.supportEmail}</a> for account access, upload guidance, billing review, refunds, privacy requests, credit history, generation status, plan questions, creator use cases, or private gallery delivery help.</p><h3>Company address</h3><p>${profile.companyAddress}</p>`
      : `<p>${profile.aboutBody}</p><h3>What customers can expect</h3><p>Private uploads, focused package pages, visible credit usage, secure checkout, and finished galleries connected to the same customer account.</p><h3>Contact</h3><p>Email <a href="mailto:${profile.supportEmail}">${profile.supportEmail}</a> for account support, plan questions, or private gallery delivery help.</p><h3>Company address</h3><p>${profile.companyAddress}</p>`;
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
    contactAddress: profile.companyAddress,
    contactEmail: profile.supportEmail,
    salesEmail: profile.salesEmail,
    instagramUrl: profile.instagramUrl,
    facebookUrl: profile.facebookUrl,
    pinterestUrl: profile.pinterestUrl,
    youtubeUrl: profile.youtubeUrl,
    twitterUrl: profile.twitterUrl,
    showPaymentIcons: true,
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
    { slug: "/workflow", idSuffix: "workflow", title: "How it works", json: pageJson(profile, "workflow") },
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
