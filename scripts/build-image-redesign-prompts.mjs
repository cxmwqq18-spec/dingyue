import fs from "fs/promises";
import path from "path";

const workspaceRoot = process.cwd();
const shotDir = path.join(workspaceRoot, "tmp", "page-shots");
const outputDir = path.join(workspaceRoot, "tmp", "page-design-prompts");
const capturePath = path.join(shotDir, "capture-results.json");

const pageRecipes = {
  home: {
    family: "platform_landing",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this product entry page into a premium multi-site AI subscription platform launch surface.",
      "Keep the same information architecture recognizable: platform entry, site entry, role-based access, and route cards.",
      "Shift it from a simple internal launcher into a polished product-control welcome page for operators and client demos.",
      "Use restrained enterprise taste: warm light background, sharp typography, quiet surfaces, darker navigation accents, subtle depth, and zero generic AI gradients.",
      "Make it feel like a serious SaaS control product that can still be shown to customers."
    ].join(" ")
  },
  "platform-login": {
    family: "auth_platform",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this platform login page as a premium enterprise SaaS sign-in experience.",
      "Keep the same core function: platform admin email-password login and quick environment links.",
      "Use a clean two-panel composition with professional brand framing, operator trust cues, and denser but elegant form styling.",
      "The result should feel closer to Shopify Admin, Linear, or a high-end ERP sign-in screen, not a generic card template."
    ].join(" ")
  },
  "platform-dashboard": {
    family: "platform_admin",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this platform dashboard into a premium multi-tenant SaaS operations console.",
      "Keep the same modules recognizable: left workspace rail, top command bar, site registry, KPI cards, site creation form, domain control, billing readiness, and AI gateway controls.",
      "Improve hierarchy, density, spacing, table clarity, and module grouping so it reads like a real ERP backoffice for multiple client sites.",
      "Use a serious enterprise tone with a deep navy workspace rail, bright but not overblown content canvas, crisp grid lines, and restrained blue action accents."
    ].join(" ")
  },
  "lumen-home": {
    family: "storefront_home",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this client-facing storefront homepage for an AI couple photo and portrait subscription product.",
      "Keep the same product concept and section flow recognizable: hero, package proof, visual samples, pricing, FAQ, and trust modules.",
      "Push the look toward a premium DreamShootAI-grade visual system with better rhythm, stronger imagery, cleaner typography, more intentional module separation, and higher-end storytelling.",
      "The design should feel sellable to clients, not like an internal demo theme."
    ].join(" ")
  },
  "lumen-login": {
    family: "auth_customer",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this customer login page into a premium AI studio entry screen.",
      "Keep the same behavior and fields recognizable: customer email-password login, site-scoped membership explanation, and demo-account hints.",
      "Upgrade it into a polished consumer SaaS sign-in page with stronger brand mood, cleaner trust messaging, and a better visual split between form and product promise."
    ].join(" ")
  },
  "lumen-pricing": {
    family: "storefront_pricing",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this pricing page for a site-owned AI photo subscription storefront.",
      "Keep the same functional content recognizable: subscription plans, credit packs, comparison logic, and purchase intent modules.",
      "Make the page feel premium, conversion-ready, and credible, with sharper plan cards, clearer differentiation, stronger benefit hierarchy, and better spacing.",
      "Avoid inflated neon AI aesthetics."
    ].join(" ")
  },
  "lumen-tool-image-studio": {
    family: "storefront_ai_tool",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this AI tool detail and generation page for a premium subscription storefront.",
      "Keep the same core flow recognizable: offer framing, upload intake, generation form, credits logic cues, and result-oriented conversion.",
      "Make it feel like a high-end client-facing AI studio surface instead of a developer form page.",
      "Use richer visual hierarchy, stronger product framing, and calmer premium SaaS styling."
    ].join(" ")
  },
  "lumen-help": {
    family: "storefront_help",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this help center page for an AI subscription storefront.",
      "Keep the same information architecture recognizable: support index, FAQs, policy/help guidance, and self-service customer education.",
      "Turn it into a clean support knowledge surface that feels consistent with a premium product brand."
    ].join(" ")
  },
  "lumen-policy-privacy": {
    family: "storefront_policy",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this privacy policy page for a premium AI subscription storefront.",
      "Keep the same legal and informational structure recognizable, but present it with cleaner reading width, stronger hierarchy, calmer spacing, and a more trustworthy branded shell.",
      "The result should feel like a serious customer-facing legal page, not a default article dump."
    ].join(" ")
  },
  "lumen-policy-refunds": {
    family: "storefront_policy",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this refunds policy page for a premium AI subscription storefront.",
      "Keep the same policy content recognizable while improving legibility, hierarchy, support framing, and brand consistency.",
      "Treat it as a trust-building billing policy page, not a bare CMS output."
    ].join(" ")
  },
  "lumen-policy-content": {
    family: "storefront_policy",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this content policy page for a premium AI subscription storefront.",
      "Keep the same moderation and usage guidance recognizable, but improve clarity, emphasis, and scanning patterns so customers can understand policy rules quickly.",
      "Use clean enterprise-consumer hybrid styling with strong readability."
    ].join(" ")
  },
  "lumen-collections": {
    family: "storefront_collection",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this collection or category page for an AI subscription storefront.",
      "Keep the same browsing purpose recognizable: grouped packages, offers, or tool collections with clear paths deeper into the site.",
      "Make it feel sellable, image-led, and premium rather than a placeholder list."
    ].join(" ")
  },
  "lumen-search": {
    family: "storefront_search",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this storefront search page for a premium AI subscription product.",
      "Keep the same core function recognizable: query input, result grouping, and paths to packages, help content, and tools.",
      "Improve empty-state polish, result hierarchy, and operator-grade visual order."
    ].join(" ")
  },
  "lumen-cart": {
    family: "storefront_cart",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this cart page for a premium AI subscription storefront.",
      "Keep the same checkout-prep structure recognizable: selected product lines, credits context, pricing totals, and next-step call to action.",
      "Make it feel commercially credible, calm, and conversion-ready."
    ].join(" ")
  },
  "lumen-blog": {
    family: "storefront_blog",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this blog landing page for an AI photo subscription brand.",
      "Keep the same editorial function recognizable: article listing, category/guide feeling, and storefront consistency.",
      "Improve typography, content density, preview cards, and editorial hierarchy so it feels like a real branded content surface."
    ].join(" ")
  },
  "atlas-home": {
    family: "storefront_home_alt",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this alternate client storefront homepage for Atlas Copy Foundry, a second site in the same subscription platform.",
      "Keep the same multi-site storefront concept recognizable but visually differentiate it from Lumen.",
      "Use a more editorial, copy-systems oriented creative direction with a clearer Atlas brand identity, stronger text-first merchandising, and premium SaaS-storefront polish."
    ].join(" ")
  },
  "atlas-pricing": {
    family: "storefront_pricing_alt",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this alternate-site pricing page for Atlas Copy Foundry.",
      "Keep the same subscription and credits structure recognizable, but give Atlas a more editorial and text-led premium identity than Lumen.",
      "The page should clearly belong to the same platform family while still feeling like a different client brand."
    ].join(" ")
  },
  "atlas-tool-image-studio": {
    family: "storefront_ai_tool_alt",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this alternate-site AI tool page for Atlas Copy Foundry.",
      "Keep the same generation flow recognizable, but shift the art direction to an editorial, language-systems, premium studio look distinct from Lumen.",
      "Preserve the platform product logic while differentiating the client-facing theme."
    ].join(" ")
  },
  "atlas-help": {
    family: "storefront_help_alt",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this alternate-site help center page for Atlas Copy Foundry.",
      "Keep the same support IA recognizable while aligning the page with a more editorial and text-led Atlas brand identity.",
      "The result should feel like a polished knowledge surface inside a premium client site."
    ].join(" ")
  },
  "atlas-blog": {
    family: "storefront_blog_alt",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this alternate-site blog page for Atlas Copy Foundry.",
      "Keep the same article-listing purpose recognizable, but push the visual language toward a more editorial, copy-driven premium content brand.",
      "The page should be clearly different from Lumen while still feeling product-quality."
    ].join(" ")
  },
  "atlas-policy-privacy": {
    family: "storefront_policy_alt",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this Atlas privacy policy page with the same legal information architecture but a clearer, more premium and editorial reading experience.",
      "Keep trust and legibility primary."
    ].join(" ")
  },
  "atlas-policy-refunds": {
    family: "storefront_policy_alt",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this Atlas refunds policy page with the same policy structure but a cleaner, more premium customer-facing presentation.",
      "Keep it trustworthy, legible, and clearly branded."
    ].join(" ")
  },
  "atlas-policy-content": {
    family: "storefront_policy_alt",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this Atlas content policy page with stronger hierarchy, cleaner reading flow, and a premium editorial-branded shell.",
      "Keep the current rules recognizable."
    ].join(" ")
  },
  "atlas-collections": {
    family: "storefront_collection_alt",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this Atlas collection page for a premium multi-site storefront.",
      "Keep the same browse-and-enter purpose recognizable while differentiating the visual identity from Lumen."
    ].join(" ")
  },
  "atlas-search": {
    family: "storefront_search_alt",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this Atlas search page with the same result and route structure, but give it a more refined editorial and product-grade identity.",
      "Keep result scanning clear and fast."
    ].join(" ")
  },
  "atlas-cart": {
    family: "storefront_cart_alt",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this Atlas cart page as a premium checkout-prep surface.",
      "Keep the same commercial structure recognizable while differentiating the client brand from Lumen."
    ].join(" ")
  },
  "atlas-admin-login": {
    family: "auth_site_admin",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this site-admin login page for a client store backend.",
      "Keep the same function recognizable: site-admin email-password login and quick route switching.",
      "Make it feel like a premium store SaaS backend sign-in, consistent with the admin shell but visually cleaner and more confident."
    ].join(" ")
  },
  "lumen-admin-dashboard": {
    family: "site_admin_dashboard",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this site admin dashboard into a premium ERP-style operations workspace for one client store.",
      "Keep the same modules recognizable: KPI cards, launch checklist, operational lanes, recent trend tables, and module entry cards.",
      "The left navigation, top bar, and content hierarchy should feel more mature, denser, and more deliberate, like a serious store SaaS backend.",
      "Visual goal: clearer than the current mockup, closer to a refined Shopify Admin plus ERP hybrid."
    ].join(" ")
  },
  "lumen-admin-design": {
    family: "site_admin_designer",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this visual store designer into a premium block-based storefront editor.",
      "Keep the same core structure recognizable: top toolbar, device switcher, center preview, section tree rail, and right property inspector.",
      "Push it closer to a mature store SaaS theme editor with cleaner rail density, sharper preview framing, more structured property forms, and better contrast rhythm.",
      "Avoid dashboard-card clutter inside the editor."
    ].join(" ")
  },
  "lumen-admin-themes": {
    family: "site_admin_themes",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this theme management page for a client store backend.",
      "Keep the same modules recognizable: draft theme, active theme, publication history, theme copies, theme install/apply/activate actions.",
      "Make it read like a premium theme-control room with better gallery hierarchy, action grouping, and publication state clarity."
    ].join(" ")
  },
  "lumen-admin-orders": {
    family: "site_admin_orders",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this orders and subscriptions admin page for an AI subscription store.",
      "Keep the same modules recognizable: orders, subscriptions, payment events, and credit history.",
      "Increase ERP-grade clarity, table rhythm, financial trust, and settlement visibility."
    ].join(" ")
  },
  "lumen-admin-ai-tools": {
    family: "site_admin_ai_ops",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this AI tools and job operations page for a client store backend.",
      "Keep the same control surfaces recognizable: enabled tools, route configuration, queue status, failed jobs, and rerun operations.",
      "Make it feel like a serious operations module rather than a demo panel."
    ].join(" ")
  },
  "lumen-admin-products": {
    family: "site_admin_products",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this products and pricing admin page for an AI subscription store.",
      "Keep the same business objects recognizable: subscription plans, credit packs, pricing editor, storefront bindings, and product operations.",
      "Increase density and clarity so operators can actually manage plans confidently."
    ].join(" ")
  },
  "lumen-admin-customers": {
    family: "site_admin_customers",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this customer management page for a site-owned AI subscription store.",
      "Keep the same purpose recognizable: customer list, status control, balance/credits context, private asset visibility, and quick operations.",
      "Make the list, filters, and action zones feel more trustworthy and more like an enterprise member-ops workspace."
    ].join(" ")
  },
  "lumen-admin-content": {
    family: "site_admin_content",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this content operations page for a store SaaS backend.",
      "Keep the same IA recognizable: policy/help/blog content control, draft status, publishing flow, and SEO-content links.",
      "Make the page read as a serious content operations module instead of a generic card stack."
    ].join(" ")
  },
  "lumen-admin-media": {
    family: "site_admin_media",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this site media library page for a storefront builder backend.",
      "Keep the same purpose recognizable: site-scoped theme assets, pack covers, resource usage, and bindings into the design system.",
      "Improve asset scanning, categorization, preview rhythm, and operator confidence."
    ].join(" ")
  },
  "lumen-admin-settings": {
    family: "site_admin_settings",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this site settings page for a multi-tenant AI subscription backend.",
      "Keep the same settings areas recognizable: domain, Stripe Connect, admin accounts, audit trail, and launch blockers.",
      "Make it feel like a clean ERP configuration console with better trust and hierarchy."
    ].join(" ")
  },
  "lumen-admin-design-pages": {
    family: "site_admin_design_pages",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this page-tree management screen for the store designer workspace.",
      "Keep the same tasks recognizable: full-site page tree, preview links, editor entry points, and route management.",
      "Improve scanability, table/list hierarchy, and relationship to the overall design workspace."
    ].join(" ")
  },
  "lumen-admin-design-navigation": {
    family: "site_admin_design_navigation",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this navigation management screen for a storefront builder backend.",
      "Keep the same function recognizable: header links, footer links, menu structures, and publication flow.",
      "Make it look like a clean information architecture tool with stronger list editing ergonomics."
    ].join(" ")
  },
  "lumen-admin-design-seo": {
    family: "site_admin_design_seo",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this SEO settings screen for a client storefront backend.",
      "Keep the same modules recognizable: site metadata, page metadata defaults, publication readiness, and search preview controls.",
      "The result should feel crisp, calm, and enterprise-ready."
    ].join(" ")
  },
  "lumen-admin-design-publications": {
    family: "site_admin_design_publications",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this publication history screen for the visual designer.",
      "Keep the same purpose recognizable: snapshots, versions, restore actions, publish metadata, and release confidence.",
      "Turn it into a polished release-control workspace with clearer timeline hierarchy and status emphasis."
    ].join(" ")
  },
  "lumen-app": {
    family: "customer_workspace",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this customer workspace for a private AI studio subscription product.",
      "Keep the same modules recognizable: credit overview, job creation, recent jobs, ledger, album outputs, and private assets.",
      "Make it feel like a premium consumer-facing studio console with lighter framing, stronger asset emphasis, and cleaner operational cards."
    ].join(" ")
  },
  "lumen-app-job-detail": {
    family: "customer_workspace_job",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this job detail page for a private AI studio workspace.",
      "Keep the same information architecture recognizable: job status, inputs, outputs, trace/progress, asset delivery, and action controls.",
      "Present it as a polished customer delivery and traceability screen, not a developer debug page."
    ].join(" ")
  },
  "lumen-app-running-job": {
    family: "customer_workspace_job_running",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this running-job detail page for a private AI studio workspace.",
      "Keep the same in-progress state recognizable: active status, inputs, progress, expected outputs, and controls.",
      "Make the live-progress experience clearer, calmer, and more premium for end customers."
    ].join(" ")
  },
  "atlas-admin-dashboard": {
    family: "site_admin_dashboard_alt",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this alternate-site admin dashboard for Atlas Copy Foundry.",
      "Keep the same operational dashboard structure recognizable, but differentiate the brand tone from Lumen while keeping the same ERP shell quality."
    ].join(" ")
  },
  "atlas-admin-themes": {
    family: "site_admin_themes_alt",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this alternate-site theme management page for Atlas Copy Foundry.",
      "Keep the same theme-control function recognizable while differentiating visual identity from the Lumen backend."
    ].join(" ")
  },
  "atlas-admin-settings": {
    family: "site_admin_settings_alt",
    template: "ui-screenshot-system",
    prompt: [
      "Redesign this alternate-site settings page for Atlas Copy Foundry.",
      "Keep the same settings information architecture recognizable while giving the backend a distinct but platform-consistent client brand character."
    ].join(" ")
  }
};

function buildEntry(record) {
  const recipe = pageRecipes[record.name];
  if (!recipe) {
    return {
      ...record,
      family: "generic_ui",
      template: "ui-screenshot-system",
      prompt:
        "Redesign this page into a premium SaaS interface while keeping the same information architecture and core business modules recognizable."
    };
  }
  return {
    ...record,
    ...recipe
  };
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const capture = JSON.parse(await fs.readFile(capturePath, "utf8"));
  const briefs = capture.map((record) => buildEntry(record));

  await fs.writeFile(path.join(outputDir, "design-briefs.json"), `${JSON.stringify(briefs, null, 2)}\n`);

  const markdown = [
    "# Page Redesign Briefs",
    "",
    "Generated from `tmp/page-shots/capture-results.json`.",
    "",
    ...briefs.flatMap((entry, index) => [
      `## ${index + 1}. ${entry.name}`,
      `- route: \`${entry.url}\``,
      `- screenshot: \`${path.relative(workspaceRoot, entry.file)}\``,
      `- design input: \`${path.relative(workspaceRoot, entry.designInputFile ?? entry.file)}\``,
      `- family: \`${entry.family}\``,
      `- template: \`${entry.template}\``,
      `- prompt: ${entry.prompt}`,
      ""
    ])
  ].join("\n");

  await fs.writeFile(path.join(outputDir, "design-briefs.md"), `${markdown}\n`);
  console.log(`Wrote ${briefs.length} design briefs to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
