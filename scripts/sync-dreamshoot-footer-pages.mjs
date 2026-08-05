import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const defaultCompanyAddress = "8 THE GREEN STE B,DOVER,DE 19901";

const brandProfiles = [
  {
    matcher: /mydreamshoots|dreamshoot/i,
    brand: "MyDreamShoots",
    footerCopyright: "© 2026 myDreamshoots.com. All rights reserved.",
    footerTitle: "MyDreamShoots",
    companyName: "myDreamshoots.com",
    companyAddress: defaultCompanyAddress,
    contactPhone: "",
    taxIdLabel: "",
    taxId: "",
    stateName: "Delaware",
    stateAbbreviation: "DE",
    childrenPrivacyTitle: "KIDS Act",
    statePrivacyTitle: "DPDPA",
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
    contactSeoTitle: "Contact MyDreamShoots - support and address",
    contactDescription:
      "Contact MyDreamShoots for AI photo package support, sales questions, account help, billing review, privacy requests, or address information.",
    footerLinks: [
      ["Browse packages", "/collections", "product"],
      ["Tools", "/tools", "product"],
      ["How it works", "/workflow", "product"],
      ["Pricing", "/pricing", "product"],
      ["FAQ", "/faq", "company"],
      ["Blog", "/blog", "company"],
      ["About us", "/about-us", "company"],
      ["Contact us", "/contact-us", "company"],
      ["Creators Circle", "/creators-circle", "company"],
      ["Refund Policy", "/refunds", "company"],
      ["Privacy Policy", "/privacy", "support"],
      ["Content policy", "/content", "support"],
      ["Terms of Service", "/terms", "support"],
      ["Cookie Policy", "/cookies", "support"],
      ["KIDS Act", "/children-privacy", "support"],
      ["DPDPA", "/state-privacy", "support"]
    ]
  },
  {
    matcher: /aidreamcapes/i,
    brand: "Aidreamcapes",
    footerCopyright: "© 2026 Aidreamcapes.com. All rights reserved.",
    footerTitle: "ልiጋreamርapes",
    companyName: "Aidreamcapes.com",
    companyAddress: "30 N GOULD ST STE R,SHERIDAN,WY 82801",
    contactPhone: "",
    taxIdLabel: "",
    taxId: "",
    stateName: "Wyoming",
    stateAbbreviation: "WY",
    childrenPrivacyTitle: "KIDS Act",
    statePrivacyTitle: "CISA",
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
    contactSeoTitle: "Contact Aidreamcapes - support and address",
    contactDescription:
      "Contact Aidreamcapes for dreamscape portrait support, source photo guidance, billing review, privacy requests, or address information.",
    footerLinks: [
      ["Travel Packages", "/collections", "product"],
      ["Tools", "/tools", "product"],
      ["How it works", "/workflow", "product"],
      ["Pricing", "/pricing", "product"],
      ["FAQ", "/faq", "company"],
      ["Blog", "/blog", "company"],
      ["About the Studio", "/about-us", "company"],
      ["Contact the Studio", "/contact-us", "company"],
      ["Creators Circle", "/creators-circle", "company"],
      ["Refund Policy", "/refunds", "company"],
      ["Privacy Policy", "/privacy", "support"],
      ["Creative Safety", "/content", "support"],
      ["Terms of Service", "/terms", "support"],
      ["Cookie Policy", "/cookies", "support"],
      ["KIDS Act", "/children-privacy", "support"],
      ["CISA", "/state-privacy", "support"]
    ]
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function workflowTutorialSections(profile) {
  const isAidreamcapes = profile.brand === "Aidreamcapes";
  const tutorial = isAidreamcapes
    ? {
        title: "See how an Aidreamcapes occasion album is planned.",
        subtitle: "Start with approved source photos, choose a fan-scene or holiday direction, confirm the visible credit cost, and keep finished images inside your private Aidreamcapes gallery.",
        imageUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-i2v-tutorial-55s.jpg?v=20260804resultfix2",
        videoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-i2v-tutorial-55s.mp4?v=20260804resultfix2",
        videoBadge: "Occasion album workflow",
        playLabel: "Watch the Aidreamcapes workflow"
      }
    : {
        title: "Watch the private photo package workflow.",
        subtitle: "Upload photos you own, choose an AI photo package, review credits, generate the album, and download finished images from your private MyDreamShoots gallery.",
        imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-i2v-tutorial-45s.jpg?v=20260805hug1",
        videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-i2v-tutorial-45s.mp4?v=20260805hug1",
        videoBadge: "Private gallery workflow",
        playLabel: "Watch the MyDreamShoots workflow"
      };
  const imageTutorial = isAidreamcapes
    ? {
        title: "Create a private fan-scene image album.",
        subtitle: "Follow the Aidreamcapes workspace flow: choose a fan-scene album, add approved source photos, review the album details and credit cost, start generation, refresh All assets, and open the finished image.",
        imageUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-ai-image-tutorial-55s.jpg?v=20260805imagepreview1",
        videoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-55s.mp4?v=20260805imagepreview1",
        videoBadge: "AI image album workflow",
        playLabel: "Watch the Aidreamcapes AI image tutorial"
      }
    : {
        title: "Create an AI photo set from source photos.",
        subtitle: "Watch the signed-in flow: choose a photo package, upload a clear source photo, review audience, credits, and selected uploads, start generation, refresh the workspace, and open the finished image.",
        imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-image-tutorial-55s.jpg?v=20260805valentine1",
        videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-tutorial-55s.mp4?v=20260805valentine1",
        videoBadge: "AI photo generation",
        playLabel: "Watch the MyDreamShoots AI image tutorial"
      };
  const mobile = isAidreamcapes
    ? {
        title: "Mobile workflow preview for Aidreamcapes.",
        subtitle: "See the image tutorial and video tutorial side by side in a vertical phone layout.",
        imageUrl: "/assets/sites/site_aidreamcapes/fan-holiday-theme/gallery/private-fan-scene-album-01.webp",
        imageAlt: "Aidreamcapes private fan-scene album preview",
        videoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-i2v-mobile-tutorial-55s.mp4?v=20260804mobile1",
        videoPoster: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-i2v-mobile-tutorial-55s.jpg?v=20260804mobile1",
        videoBadge: "Mobile workflow",
        playLabel: "Watch the video tutorial",
        leftTitle: "AI image tutorial",
        leftVideoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-ai-image-mobile-tutorial-55s.mp4?v=20260804mobile1",
        leftVideoPoster: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-ai-image-mobile-tutorial-55s.jpg?v=20260804mobile1",
        leftPlayLabel: "Watch the image tutorial",
        rightTitle: "AI video tutorial",
        rightVideoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-i2v-mobile-tutorial-55s.mp4?v=20260804mobile1",
        rightVideoPoster: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-i2v-mobile-tutorial-55s.jpg?v=20260804mobile1",
        rightPlayLabel: "Watch the video tutorial"
      }
    : {
        title: "Mobile workflow preview for MyDreamShoots.",
        subtitle: "See the image tutorial and video tutorial side by side in a vertical phone layout.",
        imageUrl: "/assets/dreamshoot/generated/20260622-homepage-unique/flow-private-album-workspace.png",
        imageAlt: "Private album workspace preview",
        videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-i2v-mobile-tutorial-45s.mp4?v=20260805hug1",
        videoPoster: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-i2v-mobile-tutorial-45s.jpg?v=20260805hug1",
        videoBadge: "Mobile workflow",
        playLabel: "Watch the video tutorial",
        leftTitle: "AI image tutorial",
        leftVideoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-mobile-tutorial-55s.mp4?v=20260804mobile1",
        leftVideoPoster: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-image-mobile-tutorial-55s.jpg?v=20260804mobile1",
        leftPlayLabel: "Watch the image tutorial",
        rightTitle: "AI video tutorial",
        rightVideoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-i2v-mobile-tutorial-45s.mp4?v=20260805hug1",
        rightVideoPoster: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-i2v-mobile-tutorial-45s.jpg?v=20260805hug1",
        rightPlayLabel: "Watch the video tutorial"
      };

  return {
    tutorial_video_1: {
      id: "tutorial_video_1",
      type: "video_feature",
      settings: {
        anchor: "how-it-works",
        eyebrow: "How it works",
        ...tutorial
      },
      blocks: []
    },
    tutorial_image_video_1: {
      id: "tutorial_image_video_1",
      type: "video_feature",
      settings: {
        anchor: "ai-image-tutorial",
        eyebrow: "AI image tutorial",
        ...imageTutorial
      },
      blocks: []
    },
    mobile_video_1: {
      id: "mobile_video_1",
      type: "mobile_video_showcase",
      settings: {
        anchor: "mobile-video-tutorial",
        eyebrow: "Mobile tutorial",
        placeholderTitle: "Mobile tutorial coming soon",
        placeholderBody: "The vertical mobile walkthrough will appear here when the final video is ready.",
        ...mobile
      },
      blocks: []
    }
  };
}

function proposedFederalPrivacyLegislationNotice(profile) {
  return `<h3>5. Proposed federal privacy legislation watch</h3><p>${profile.brand} monitors proposed U.S. federal privacy legislation, including the SECURE Data Act and the GUARD Financial Data Act. These proposals are not treated as enacted storefront policy unless they become law, but our privacy operations are prepared around data minimization, customer access, portable copy, deletion, sensitive-data opt-in, and AI-use transparency where applicable.</p>`;
}

function childrenPrivacyBody(profile) {
  if (profile.brand === "Aidreamcapes") {
    return `<h3>1. Who the studio is for</h3><p>Aidreamcapes is built for adults and customers who can responsibly manage private source-photo requests. We do not knowingly invite children under 13 to create accounts or submit personal information.</p><h3>2. Parent and guardian review</h3><p>If a parent or legal guardian believes a child supplied information or appeared in an uploaded source photo without the right permission, they can ask us to locate, restrict, or delete the related account data, upload, prompt, generated image, or support record.</p><h3>3. Minor source photos</h3><p>Customers may upload photos of minors only when they are the parent, legal guardian, or have the legal permission needed for the intended private portrait request. We may reject or remove material that appears unsafe, unauthorized, exploitative, or outside supported personal-use workflows.</p><h3>4. Privacy request path</h3><p>California and other U.S. privacy questions are handled through our <a href="/state-privacy">${profile.statePrivacyTitle}</a> page, including access, deletion, correction, opt-out, and appeal requests where those rights apply.</p><h3>5. Contact for minor-related concerns</h3><p>Email <a href="mailto:${profile.supportEmail}">${profile.supportEmail}</a> with the account email, the upload or gallery concern, and enough detail for support to review the request. Verification may be required before changes are made.</p>`;
  }
  return `<h3>1. Service audience</h3><p>${profile.brand} is not directed to children under 13 and is not designed for child account creation. Customers should use the service only if they can lawfully manage an account or have permission from a parent or legal guardian.</p><h3>2. COPPA-aware handling</h3><p>The Children's Online Privacy Protection Act (COPPA) applies to certain online services directed to children under 13 or knowingly collecting personal information from children under 13. ${profile.brand} does not knowingly collect account information directly from children under 13. If we learn that child personal information was provided without required consent, we will review and delete or restrict it as appropriate.</p><h3>3. Photos of minors</h3><p>Customers must not upload photos of minors unless they are the parent, legal guardian, or otherwise have the legal right and consent to use those images for the requested AI photo workflow. Minor images should never be used for deceptive, exploitative, unlawful, or unsafe purposes.</p><h3>4. Parent or guardian requests</h3><p>A parent or legal guardian may contact us to ask about access, deletion, or restriction of child-related information. We may request verification before acting on a sensitive privacy request.</p><h3>5. ${profile.statePrivacyTitle} requests</h3><p>California and other U.S. state privacy requests are handled in our <a href="/state-privacy">${profile.statePrivacyTitle}</a> notice, including access, deletion, correction, opt-out, and appeal requests where applicable.</p><h3>6. Contact</h3><p>Email <a href="mailto:${profile.supportEmail}">${profile.supportEmail}</a> for children's privacy or COPPA-related questions.</p>`;
}

function statePrivacyBody(profile) {
  return `<h3>1. ${profile.statePrivacyTitle}</h3><p>California and other U.S. residents may have privacy rights, including rights to request access to personal information, deletion, correction, a portable copy, and information about certain disclosures. Where applicable, customers may also request to opt out of sale or sharing of personal information. ${profile.brand} does not sell personal source photos or generated private galleries as stock content.</p><h3>2. Company record for privacy contact</h3><p>Company: ${profile.companyName}; Address: ${profile.companyAddress}; Contact Us: ${profile.supportEmail}.</p><h3>3. How to submit a request</h3><p>Email <a href="mailto:${profile.supportEmail}">${profile.supportEmail}</a> with the account email, request type, and any relevant order or gallery details. We will review the request under the privacy rights that apply to the customer and account.</p>${proposedFederalPrivacyLegislationNotice(profile)}`;
}

function profileForSite(site) {
  const identity = `${site.primaryDomain ?? ""} ${site.slug ?? ""}`.toLowerCase();
  if (!identity.includes(".com")) return undefined;
  return brandProfiles.find((profile) => profile.matcher.test(identity));
}

function pageJson(profile, page) {
  const isContact = page === "contact";
  const isShipping = page === "shipping";
  const isWorkflow = page === "workflow";
  const isChildrenPrivacy = page === "childrenPrivacy";
  const isStatePrivacy = page === "statePrivacy";
  const isAidreamcapes = profile.brand === "Aidreamcapes";
  const title = isWorkflow
    ? profile.workflowTitle
    : isChildrenPrivacy
      ? profile.childrenPrivacyTitle
    : isStatePrivacy
        ? profile.statePrivacyTitle
        : isShipping ? "Shipping and Digital Delivery Policy" : isContact ? `Contact ${profile.brand}` : profile.aboutTitle;
  if (isWorkflow) {
    return {
      version: 1,
      pageType: "content",
      sectionsOrder: ["intro_1", "tutorial_video_1", "tutorial_image_video_1", "mobile_video_1", "workflow_1", "rules_1", "faq_1", "conversion_1", "footer_1"],
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
        ...workflowTutorialSections(profile),
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
          settings: { title: isAidreamcapes ? "Route planning questions" : "Workflow questions" },
          blocks: [
            {
              id: "workflow_faq_uploads",
              type: "faq_item",
              settings: isAidreamcapes
                ? {
                    question: "Which source photos help route portraits?",
                    answer: "Choose sharp portraits with natural light, then add destination notes only when they support the route scene you want."
                  }
                : {
                    question: "What photos should customers upload?",
                    answer: "Use clear recent photos where the face or subject is visible. Customers should only upload photos they own or have permission to use."
                  }
            },
            {
              id: "workflow_faq_credits",
              type: "faq_item",
              settings: isAidreamcapes
                ? {
                    question: "How are route credits reserved?",
                    answer: "Each travel package shows its credit cost before submission; credits are held during processing and released if the request fails."
                  }
                : {
                    question: "When are credits used?",
                    answer: "Credits are shown before generation starts, then reserved or settled through the account credit history based on the job result."
                  }
            },
            {
              id: "workflow_faq_delivery",
              type: "faq_item",
              settings: isAidreamcapes
                ? {
                    question: "Where are finished route portraits delivered?",
                    answer: "Finished Aidreamcapes portraits arrive in the signed-in customer private travel gallery for review and download."
                  }
                : {
                    question: "Where do finished images appear?",
                    answer: "Finished images appear in the signed-in customer's private gallery for review and download."
                  }
            }
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
  const body = isChildrenPrivacy
    ? childrenPrivacyBody(profile)
    : isStatePrivacy
      ? statePrivacyBody(profile)
    : isShipping
    ? `<h3>No physical shipping</h3><p>${profile.brand} sells digital AI photo credits, generated image packages, and private gallery access. We do not ship physical products, printed photos, USB drives, or mailed merchandise from this storefront.</p><h3>Digital delivery</h3><p>Credits are added after payment confirmation. Generated images are delivered inside the signed-in customer workspace or private gallery when a job completes. Delivery timing can vary based on source photo quality, selected package settings, provider availability, moderation review, and system load.</p><h3>Failed or delayed jobs</h3><p>If a service-side issue prevents delivery, support may release reserved credits, rerun the job, troubleshoot the account, or review refund eligibility under the refund policy.</p><h3>No carrier tracking or customs</h3><p>Because orders are digital, customers do not receive carrier tracking numbers and are not charged shipping, customs, duties, or physical handling fees by ${profile.brand}.</p><h3>Contact</h3><p>Email <a href="mailto:${profile.supportEmail}">${profile.supportEmail}</a> with the account email, order or job details, and a short description if a digital delivery does not appear in the workspace.</p>`
    : isContact
      ? `<h3>Company</h3><p>${profile.companyName}</p><h3>Address</h3><p>${profile.companyAddress}</p><h3>Contact Us</h3><p><a href="mailto:${profile.supportEmail}">${profile.supportEmail}</a></p>`
      : `<p>${profile.aboutBody}</p><h3>What customers can expect</h3><p>Private uploads, focused package pages, visible credit usage, secure checkout, and finished galleries connected to the same customer account.</p><h3>Company</h3><p>${profile.companyName}</p><h3>Address</h3><p>${profile.companyAddress}</p><h3>Contact Us</h3><p><a href="mailto:${profile.supportEmail}">${profile.supportEmail}</a></p>`;
  return {
    version: 1,
    pageType: isShipping || isChildrenPrivacy || isStatePrivacy ? "policy" : "content",
    sectionsOrder: ["intro_1", "content_1", "footer_1"],
    sections: {
      intro_1: {
        id: "intro_1",
        type: "rich_text",
        settings: {
          eyebrow: isContact ? "Contact" : "About",
          ...(isShipping ? { eyebrow: "Delivery policy" } : {}),
          ...(isChildrenPrivacy || isStatePrivacy ? { eyebrow: "Policy" } : {}),
          title,
          body: isChildrenPrivacy
            ? isAidreamcapes
              ? "Aidreamcapes reviews minor-related source photo concerns through verified support, guardian requests, and private gallery controls."
              : `${profile.brand} handles children's privacy questions through a COPPA-aware account and source-photo review process.`
            : isStatePrivacy
              ? isAidreamcapes
                ? "Aidreamcapes routes California and other U.S. privacy questions through verified account support before changing private uploads or gallery records."
                : `${profile.brand} receives California and other U.S. state privacy requests through support and verifies account ownership before acting on sensitive data.`
              : isShipping
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
          ...(isChildrenPrivacy ? { title: profile.childrenPrivacyTitle } : {}),
          ...(isStatePrivacy ? { title: profile.statePrivacyTitle } : {}),
          lastUpdated: isChildrenPrivacy || isStatePrivacy ? "July 14, 2026" : "June 28, 2026",
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
      title: isChildrenPrivacy
        ? `${profile.brand} ${profile.childrenPrivacyTitle}`
        : isStatePrivacy
          ? `${profile.brand} ${profile.statePrivacyTitle}`
          : isShipping ? `${profile.brand} Shipping and Digital Delivery Policy` : isContact ? profile.contactSeoTitle : profile.aboutSeoTitle,
      description: isChildrenPrivacy
        ? isAidreamcapes
          ? "Learn how Aidreamcapes reviews guardian requests, minor source-photo concerns, uploaded portraits, generated travel images, and private gallery removal questions."
          : `Read the ${profile.brand} children's privacy notice for COPPA-aware account access, minor image uploads, parent or guardian requests, and private gallery handling.`
        : isStatePrivacy
          ? isAidreamcapes
            ? "Use Aidreamcapes CISA information for California and other U.S. requests involving account access, deletion, correction, private galleries, and company contact details."
            : `Review ${profile.brand} ${profile.statePrivacyTitle} information for California privacy requests, access, deletion, correction, opt-out choices, and company contact details.`
          : isShipping ? `Review how ${profile.brand} delivers AI photo credits, generated images, downloads, and private galleries digitally without physical shipping.` : isContact ? profile.contactDescription : profile.aboutDescription,
      keywords: isShipping
        ? `${profile.brand} shipping policy, ${profile.brand} digital delivery, AI photo delivery, private gallery delivery`
        : isChildrenPrivacy
        ? `${profile.brand} children's privacy, COPPA, minor photo uploads, parent privacy request`
        : isStatePrivacy
        ? `${profile.brand} state privacy rights, California privacy, CCPA, privacy request, ${profile.stateName}`
        : isContact
        ? `Contact ${profile.brand}, ${profile.brand} support, ${profile.brand} sales, private gallery help`
        : `About ${profile.brand}, AI photo packages, private AI galleries, AI portrait workspace`,
      canonicalPath: isChildrenPrivacy ? "/children-privacy" : isStatePrivacy ? "/state-privacy" : isShipping ? "/shipping" : isContact ? "/contact-us" : "/about-us",
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
    "/policies/children-privacy": "/children-privacy",
    "/children-privacy-policy": "/children-privacy",
    "/childrens-privacy": "/children-privacy",
    "/policies/state-privacy": "/state-privacy",
    "/state-privacy-rights": "/state-privacy",
    "/california-privacy": "/state-privacy",
    "/ccpa": "/state-privacy",
    "/about": "/about-us",
    "/contact": "/contact-us"
  };
  return map[href] ?? href;
}

function isVirtualGoodsFooterLinkToHide(label, href) {
  const normalizedHref = normalizePolicyHref(href ?? "").toLowerCase();
  const value = `${label ?? ""} ${normalizedHref}`.toLowerCase();
  return (
    normalizedHref === "/shipping" ||
    /\bshipping\b|delivery|credit review|digital delivery/.test(value)
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
    companyName: profile.companyName,
    contactAddress: profile.companyAddress,
    contactPhone: profile.contactPhone,
    contactEmail: profile.supportEmail,
    taxIdLabel: profile.taxIdLabel,
    taxId: profile.taxId,
    salesEmail: profile.salesEmail,
    instagramUrl: profile.instagramUrl,
    facebookUrl: profile.facebookUrl,
    pinterestUrl: profile.pinterestUrl,
    youtubeUrl: profile.youtubeUrl,
    twitterUrl: profile.twitterUrl,
    showPaymentIcons: true,
    copyright: profile.footerCopyright ?? `© 2026 ${profile.brand}. All rights reserved.`
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
    { slug: "/policies/shipping", idSuffix: "shipping", title: "Shipping and Digital Delivery Policy", json: pageJson(profile, "shipping") },
    { slug: "/policies/children-privacy", idSuffix: "children_privacy", title: profile.childrenPrivacyTitle, json: pageJson(profile, "childrenPrivacy") },
    { slug: "/policies/state-privacy", idSuffix: "state_privacy", title: profile.statePrivacyTitle, json: pageJson(profile, "statePrivacy") }
  ];
  for (const page of pages) {
    await prisma.themePage.upsert({
      where: { siteId_slug: { siteId: site.id, slug: page.slug } },
      create: {
        id: `${site.id}_${page.idSuffix}`,
        siteId: site.id,
        pageType: page.json.pageType ?? "content",
        templateKey: page.slug.slice(1),
        slug: page.slug,
        title: page.title,
        draftJson: page.json,
        publishedJson: page.json
      },
      update: {
        pageType: page.json.pageType ?? "content",
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
