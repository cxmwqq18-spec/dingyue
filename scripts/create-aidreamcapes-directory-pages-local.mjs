import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SITE_ID = "site_aidreamcapes";
const base = "/assets/sites/site_aidreamcapes/site-v2/guide/";
const gen = "/assets/sites/site_aidreamcapes/site-v2/gen/";
const img = (file, alt) => ({ src: base + file, alt });
const genImg = (file, alt) => ({ src: gen + file, alt });
const card = (title, body, image, tag) => ({ title, body, ...(image ? { image } : {}), ...(tag ? { tag } : {}) });
const section = (id, kind, title, lead, extra = {}) => ({ id, kind, title, lead, ...extra });

const twin = {
  id: "ai-twin", label: "AI Twin", eyebrow: "AI TWIN CONCEPT PREVIEW",
  h1: "Shape your next digital presenter.",
  lead: "Explore a presenter concept for your product stories. Define the look, setting and message before you plan your next video.",
  homeLabel: "Home", breadcrumbLabel: "Breadcrumb",
  heroImage: img("img1-video-hub-hero-beauty-r1--640.webp", "Presenter holding a skincare product in a bright natural setting"),
  secondaryImage: img("ac1-actor-card-beach-1-r1--640.webp", "Presenter portrait illustrating an AI Twin visual direction"),
  demoLabel: "Illustrative presenter concept", heroChips: ["Warm studio", "Product introduction", "Natural delivery"],
  notice: "Concept preview. Face and voice cloning are not available here.",
  primaryHref: "/ai-video-generation/ai-actors", primaryCta: "Explore AI presenters",
  secondaryHref: "/ai-video-generation", secondaryCta: "See the video workflow",
  landingSections: [
    section("twin-statement", "statement", "", "", { items: ["Plan the presence.", "Refine the story.", "Review every detail."] }),
    section("twin-benefits", "cards", "Bring the presenter into your product story.", "Explore how presenter style, scene and product message can work together before you continue in the video workspace.", { eyebrow: "A clear creative direction", cards: [
      card("Find a fitting style", "Consider the tone and on-camera presence that suit your product and audience."),
      card("Set the scene", "Choose a visual setting that gives your product story useful context."),
      card("Keep the product central", "Plan where the product appears and which details your video should show.", img("im03-home-picker-bottle-r1--640.webp", "Product reference photo used to plan a presenter-led story")),
      card("Shape the message", "Decide the product facts and key message before drafting your scenes."),
      card("Consider the format", "Review the framing and composition that fit the destination for your video."),
      card("Review before creating", "Use an editable brief and storyboard to refine your direction before generating selected shots.")
    ] }),
    section("twin-steps", "steps", "Three decisions shape the direction.", "Start with the product, choose a scene and presenter, then refine the brief in the workspace.", { eyebrow: "From idea to video plan", cards: [
      card("Start with the product", "Gather clear product photos and the facts you want your video to communicate.", img("im03-home-picker-bottle-r1--640.webp", "Clear product image prepared as a video reference")),
      card("Choose a scene and presenter", "Explore an on-camera style and setting that fit your product introduction.", img("ac1-actor-card-home-1-r1--640.webp", "Presenter in a home setting for a product introduction")),
      card("Write and refine the brief", "Describe the audience, message and visual direction. Edit the storyboard before generating shots.", img("img1-video-hub-hero-beauty-r1--640.webp", "Editable product video storyboard direction with presenter"))
    ] }),
    section("twin-product-first", "split", "A presenter concept that starts with what you sell.", "Keep product details, audience and presenter direction in the same creative conversation.", { eyebrow: "Product first", image: img("img1-video-hub-hero-beauty-r1--640.webp", "Presenter introducing a skincare product in a natural bathroom setting"), items: ["Bring your own product photos and facts", "Describe the audience and the point you want to make", "Refine scene notes before you continue"], href: "/ai-video-generation", button: "Plan a product video" }),
    section("twin-scenes", "gallery", "One product can have different settings.", "Use these visual directions as inspiration while you plan a product introduction.", { eyebrow: "Explore scene directions", cards: [
      card("A calm morning", "A bright everyday setting for a simple routine.", img("img1-video-hub-hero-beauty-r1--640.webp", "Natural morning skincare routine presenter scene"), "Everyday"),
      card("A closer look", "Bring a product detail into the foreground.", img("im03-home-picker-lipstick-r1--640.webp", "Close product view with a beauty item on a vanity"), "Product detail"),
      card("A fresh opening", "Introduce the product with a distinct first scene.", img("ac1-actor-card-studio-1-r1--640.webp", "Presenter portrait in a bright home setting"), "Opening"),
      card("A considered finish", "End with the detail you want viewers to remember.", img("f13-r10-occ-holidays-unboxing-candle--640.webp", "Warm home product scene with a candle"), "Closing")
    ] }),
    section("twin-presenters", "gallery", "Explore a style that fits the story.", "These portraits are illustrative references. Available presenters are selected in the video workspace.", { eyebrow: "Presenter styles", cards: [
      card("Warm studio", "A polished, direct product introduction.", img("ac1-actor-card-studio-1-r1--640.webp", "Presenter portrait in a softly lit studio"), "Studio"),
      card("At home", "A relaxed setting for an everyday product story.", img("ac1-actor-card-home-1-r1--640.webp", "Presenter in a home interior"), "Home"),
      card("At work", "A clear, conversational style for explaining a product.", img("ac1-actor-card-office-1-r1--640.webp", "Presenter in a work setting"), "Work"),
      card("Outdoors", "A brighter backdrop for a lighter product story.", img("ac1-actor-card-beach-1-r1--640.webp", "Presenter outdoors in daylight"), "Outdoor")
    ] }),
    section("twin-use-cases", "cards", "Plan the kind of product story you need.", "Choose a direction for your next product introduction, feature demonstration or launch.", { eyebrow: "Ways to use a presenter", cards: [
      card("Product introductions", "Introduce what the product is and who it is for.", img("im03-home-picker-bottle-r1--640.webp", "Product bottle prepared for a presenter-led introduction")),
      card("Feature demonstrations", "Focus each scene on a useful feature or product detail.", img("q12-guide-product-photo-tips-shoe--640.webp", "Sneaker product detail photographed for a demonstration")),
      card("Launch stories", "Shape an opening, product moment and closing message for a new release.", img("gen2guide-white-background-canvas-tote--640.webp", "Canvas product prepared for a new product story")),
      card("Recurring campaigns", "Keep a consistent brief while exploring different scenes and openings.", img("ac1-actor-card-home-1-r1--640.webp", "Presenter scene for a recurring product campaign"))
    ] }),
    section("twin-storyboard", "storyboard", "See how each scene connects.", "A storyboard keeps the brief, shot choices and final sequence easy to review.", { eyebrow: "Editable storyboard", note: "Review selected shots before assembly.", cards: [
      card("Product opening", "Establish the product and the reason to watch.", img("im03-home-picker-bottle-r1--640.webp", "Product close-up for the opening storyboard shot")),
      card("Presenter introduction", "Bring the product into a natural scene.", img("img1-video-hub-hero-beauty-r1--640.webp", "Presenter holding a product in a natural scene")),
      card("Closing detail", "Return to the feature or message that matters.", img("im03-home-picker-lipstick-r1--640.webp", "Product detail for the closing storyboard shot"))
    ] }),
    section("twin-options", "comparison", "Choose a starting point that fits your next step.", "AI Twin is a concept preview. AI presenters and the product video workflow are available in the workspace.", { eyebrow: "Understand the available tools", columns: ["", "AI presenters", "AI Twin concept"], rows: [
      ["Starting point", "Choose from available presenters", "Explore a visual direction"],
      ["Product story", "Write and refine a script", "Plan the look, setting and message"],
      ["Video creation", "Storyboard, generate selected shots and assemble", "Continue with available workspace tools"],
      ["Face or voice cloning", "Not offered here", "Not available in this preview"]
    ], note: "This AI Twin page does not create a digital copy of your face or voice." }),
    section("twin-faq", "faq", "AI Twin concepts, explained.", "Understand what this preview shows and how to continue with available tools.", { eyebrow: "Questions, answered", cards: [
      card("What is the AI Twin concept?", "It is a visual planning concept for presenter-led product stories. Use the examples to consider a look, setting and message before planning a video."),
      card("Can I clone my face or voice here?", "No. Face cloning, voice cloning and an identity-matched digital twin are not available on this page."),
      card("Can I create a product video today?", "Yes. Continue with available AI presenters and the video workflow. Prepare a product brief, refine the storyboard, generate selected shots and assemble the clips you choose."),
      card("What should I prepare?", "Bring clear product photos, accurate product facts, the intended audience and one key message. These help you make a focused brief."),
      card("Are the portraits my generated results?", "No. They are illustrative examples of presenter styles and creative directions. Review your own generated work in the workspace.")
    ] }),
    section("twin-related", "related", "Find the right tool for your next step.", "", { eyebrow: "Continue exploring", cards: [
      { title: "AI presenters", body: "Browse available presenters for product videos.", href: "/ai-video-generation/ai-actors" },
      { title: "Text to Video", body: "Shape a written brief into an editable video plan.", href: "/text-to-video" },
      { title: "Image to Video", body: "Start a video direction from a product photo.", href: "/ai-video-generation/image-to-video" }
    ] }),
    section("twin-cta", "cta", "Your next product story starts with a clear direction.", "Bring your product photos, facts and creative intent into the video workspace.", { eyebrow: "Continue with available presenters", href: "/ai-video-generation/ai-actors", button: "Explore AI presenters", cards: [
      card("Product", "", img("im03-home-picker-bottle-r1--640.webp", "Product reference image")),
      card("Presenter", "", img("img1-video-hub-hero-beauty-r1--640.webp", "Presenter in a product story")),
      card("Detail", "", img("im03-home-picker-lipstick-r1--640.webp", "Product detail image"))
    ] })
  ]
};

const textVideo = {
  id: "text-to-video", label: "Text to Video", eyebrow: "TEXT TO VIDEO · PRODUCT BRIEF TO STORYBOARD",
  h1: "Text to Video AI Generator for product stories.",
  lead: "Turn product facts, photos and a written brief into an editable storyboard. Refine scenes, generate selected shots and review the assembled video before download.",
  homeLabel: "Home", breadcrumbLabel: "Breadcrumb",
  heroImage: genImg("im01-video-hub-og-r1.webp", "Product video creative shown in a workspace preview"),
  secondaryImage: img("im03-home-picker-bottle-r1--640.webp", "Product photo used as a visual reference in a video brief"),
  demoLabel: "Creative brief · Editable storyboard", heroChips: ["Product facts", "Scene direction", "Selected shots"],
  notice: "Start with a product idea, then review each creative decision before assembling your video.",
  primaryHref: "/ai-video-generation", primaryCta: "Explore video creation",
  secondaryHref: "#text-video-workflow", secondaryCta: "See how it works",
  landingSections: [
    section("text-video-statement", "statement", "", "", { items: ["A clear brief.", "An editable storyboard.", "Your selected shots."] }),
    section("text-video-examples", "gallery", "A few words. Many creative directions.", "Start with a product, a moment or a story you want to tell.", { eyebrow: "Creative inspiration", cards: [
      card("The daily routine", "A natural product moment with a presenter.", img("img1-video-hub-hero-beauty-r1--640.webp", "Presenter introduces a product as part of a daily routine"), "Product story"),
      card("A fresh perspective", "Give the product a different opening scene.", img("q12-guide-product-photo-tips-shoe--640.webp", "Sneaker product shown in a detail-focused scene"), "New opening"),
      card("Everyday essentials", "Show the product in a familiar setting.", img("im03-home-picker-earbuds-r1--640.webp", "Earbuds product in an everyday setting"), "Lifestyle"),
      card("A quieter moment", "Use a calmer scene to set the tone.", img("f13-r10-occ-holidays-unboxing-candle--640.webp", "Candle product in a calm home scene"), "Scene idea")
    ] }),
    section("text-video-features", "cards", "Built around your creative decisions.", "Keep your idea visible as you move from brief to storyboard to the final sequence.", { eyebrow: "A workflow you can shape", cards: [
      card("Start with your product", "Bring product photos and facts together so your brief has a clear foundation.", img("im03-home-picker-bottle-r1--640.webp", "Product photo used to start a written video brief")),
      card("Write a clear brief", "Describe the audience, setting and story you want the video to tell.", img("im03-home-picker-bottle-r1--640.webp", "Product details gathered as the foundation for a clear video brief")),
      card("Edit the storyboard", "Review scene descriptions and refine the sequence before generating shots.", img("img1-video-hub-hero-beauty-r1--640.webp", "Presenter scene prepared for an editable storyboard")),
      card("Choose your shots", "Develop the scenes you select, one creative decision at a time.", img("im03-home-picker-earbuds-r1--640.webp", "Selected product shots arranged for review")),
      card("Compare versions", "Review different shot versions and choose a direction that fits your brief.", img("ac1-actor-card-home-1-r1--640.webp", "Presenter direction compared across video versions")),
      card("Review the final cut", "Assemble the sequence, check the result and download after your review.", genImg("im01-video-hub-og-r1.webp", "Finished product video preview ready for review"))
    ] }),
    section("text-video-workflow", "steps", "From a written brief to a video you can review.", "Shape the idea before you assemble the final sequence.", { eyebrow: "How text to video works", cards: [
      card("Describe the idea", "Add product facts, photos, audience and the key message you want to communicate.", img("im03-home-picker-bottle-r1--640.webp", "Product photos added to an editable video brief")),
      card("Shape the storyboard", "Review the scenes and refine each description, order and creative direction.", img("img1-video-hub-hero-beauty-r1--640.webp", "Storyboard scene with a presenter and product")),
      card("Generate selected shots", "Develop selected scenes, compare versions and choose the takes for your video.", img("im03-home-picker-lipstick-r1--640.webp", "Selected product detail shot in a video sequence"))
    ] }),
    section("text-video-brief", "split", "Give your prompt a clear direction.", "Bring product facts, photos and creative intent into one brief. Describe what matters to your audience and the story you want to tell.", { eyebrow: "01 / Start with intention", image: img("im03-home-picker-bottle-r1--640.webp", "Product reference photo alongside a creative video brief"), items: ["Give your product useful context", "Describe the setting and visual direction", "Keep the message focused"], href: "/ai-video-generation", button: "Start with a product brief" }),
    section("text-video-scene", "split", "Refine the scene before the final cut.", "Edit the storyboard to shape the setting, shot description and presenter direction. Generate selected shots and compare the results before choosing a version.", { eyebrow: "02 / Make the scene yours", image: img("ac1-actor-card-studio-1-r1--640.webp", "Presenter options representing different scene directions"), items: ["Refine written scene direction", "Generate the shots you select", "Compare before assembling"], href: "/ai-video-generation/ai-actors", button: "Explore AI presenters" }),
    section("text-video-storyboard", "storyboard", "Choose the takes. Shape the sequence.", "Compare versions, assemble your preferred scenes and review the complete video before download.", { eyebrow: "Selected shots", note: "Sequence preview · Review before download", cards: [
      card("Product opening", "Introduce the product and the key message.", img("im03-home-picker-bottle-r1--640.webp", "Product opening shot from a storyboard")),
      card("Everyday scene", "Place the product in a relatable moment.", img("img1-video-hub-hero-beauty-r1--640.webp", "Presenter product scene from a storyboard")),
      card("Product detail", "Bring a useful product detail into focus.", img("im03-home-picker-lipstick-r1--640.webp", "Close-up product detail shot"))
    ] }),
    section("text-video-use-cases", "cards", "Made for the way you create.", "Whether you work on one product or client briefs, start with a story worth showing.", { eyebrow: "Built for your creative work", cards: [
      card("DTC brands", "Build a product-led story from the details that make your brand distinctive.", img("im03-home-picker-bottle-r1--640.webp", "DTC product image prepared for an ad brief")),
      card("Online shops", "Give product photos a new creative direction through a written video brief.", img("gen2guide-white-background-canvas-tote--640.webp", "Online store product photo used in a video concept")),
      card("Agencies", "Develop different creative directions around client products and campaign briefs.", img("ac1-actor-card-home-1-r1--640.webp", "Presenter direction for an agency product campaign")),
      card("Creators", "Shape an idea into scenes, compare the shots and assemble a story in your own direction.", img("ac1-actor-card-office-1-r1--640.webp", "Creator-style product video concept"))
    ] }),
    section("text-video-variations", "gallery", "One product. More than one story.", "Explore a different opening, setting or scene while keeping the product at the center.", { eyebrow: "Room to explore", cards: [
      card("Original product", "Keep the reference visible as you shape the brief.", img("im03-home-picker-bottle-r1--640.webp", "Original product reference image"), "Reference"),
      card("Everyday routine", "A warm, human-led direction.", img("img1-video-hub-hero-beauty-r1--640.webp", "Everyday presenter-led product scene"), "Scene"),
      card("Small details", "A closer product perspective.", img("im03-home-picker-lipstick-r1--640.webp", "Close-up beauty product perspective"), "Detail"),
      card("A new opening", "A different first scene to compare.", img("ac1-actor-card-studio-1-r1--640.webp", "Alternate opening scene with a presenter"), "Opening")
    ] }),
    section("text-video-formats", "cards", "Review the story in different frames.", "Check how the product and scene sit within a frame before assembling your sequence.", { eyebrow: "Consider every frame", cards: [
      card("Vertical composition", "A presenter-led moment for vertical placements.", img("img1-video-hub-hero-beauty-r1--640.webp", "Portrait video composition with a presenter")),
      card("Square composition", "Keep the product in focus in a balanced frame.", img("im03-home-picker-bottle-r1--640.webp", "Square product composition")),
      card("Landscape composition", "Give the scene and product more room.", img("ac1-actor-card-home-1-r1--640.webp", "Landscape product scene composition"))
    ] }),
    section("text-video-assurance", "cards", "Your brief stays in the conversation.", "Start with product context, make editable decisions and review the result.", { eyebrow: "A considered creative process", cards: [
      card("Product facts first", "Begin with the details and photos you provide, then shape a brief around your product."),
      card("Editable decisions", "Refine the storyboard before generating selected shots and comparing versions."),
      card("Review before download", "Assemble the sequence and check the complete video before you choose to download.")
    ] }),
    section("text-video-faq", "faq", "Text to video, explained.", "A little clarity before your next creative brief.", { eyebrow: "Your questions, answered", cards: [
      card("How do I turn text into a product video?", "Start with product facts, photos and a written brief. Edit the storyboard, generate selected shots, compare versions and assemble your video. Review the result before downloading."),
      card("Can I edit the storyboard?", "Yes. Review scene descriptions and refine the order and creative direction before generating selected shots."),
      card("Can I compare different versions?", "Yes. Compare generated versions for selected shots and choose the takes that fit your brief."),
      card("What should I include in my brief?", "Include accurate product facts, the intended audience, the main message and a description of the setting or visual direction."),
      card("When can I review the video?", "After choosing your shots and assembling the sequence, review the complete video before downloading it.")
    ] }),
    section("text-video-related", "related", "Keep building your creative toolkit.", "", { eyebrow: "More ways to create", cards: [
      { title: "AI Twin concept", body: "Explore a presenter visual direction for future product stories.", href: "/ai-twin" },
      { title: "AI presenters", body: "Choose from available presenters for a product video.", href: "/ai-video-generation/ai-actors" },
      { title: "Image to Video", body: "Start with a product photo and plan a video direction.", href: "/ai-video-generation/image-to-video" }
    ] }),
    section("text-video-cta", "cta", "Your next video starts with a brief.", "Bring product facts, photos and a little creative direction into the video workspace.", { eyebrow: "Begin with your next idea", href: "/ai-video-generation", button: "Explore video creation", cards: [
      card("Product", "", img("im03-home-picker-bottle-r1--640.webp", "Product reference photo")),
      card("Story", "", img("img1-video-hub-hero-beauty-r1--640.webp", "Presenter product story")),
      card("Details", "", img("im03-home-picker-lipstick-r1--640.webp", "Product detail for a video brief"))
    ] })
  ]
};

function content(slug, data, seo) {
  return {
    version: 2, pageType: "content",
    contentContract: { seoSource: "LivePage.contentJson", mediaSource: "LivePage.contentJson", sourceRevision: "aidreamcapes-directory-pages-20261017-v1" },
    seo: { index: true, robots: { index: true, follow: true, maxImagePreview: "large" }, canonicalPath: slug, canonical: "https://www.aivideosugc.com" + slug, ...seo },
    sectionsOrder: ["v2_main"],
    sections: { v2_main: { type: "aidreamcapes_v2_page", settings: { layout: data.id === "ai-twin" ? "ai-twin-landing" : "text-to-video-landing", data } } }
  };
}
const records = [
  { id: "site_aidreamcapes_ai_twin", slug: "/ai-twin", title: "AI Twin concept for product video presenters | AIVideosUGC", contentJson: content("/ai-twin", twin, {
    title: "AI Twin Concept for Product Video Presenters | AIVideosUGC",
    description: "Explore AI Twin presenter concepts for product videos. Plan a visual style, setting and message, then continue with the available AI presenters.",
    keywords: "AI Twin concept, AI presenter for product videos, AI video presenter, product video storyboard",
    primaryKeyword: "AI Twin concept", ogImage: twin.heroImage.src, ogImageAlt: twin.heroImage.alt
  }) },
  { id: "site_aidreamcapes_text_to_video", slug: "/text-to-video", title: "Text to Video AI Generator for Product Ads | AIVideosUGC", contentJson: content("/text-to-video", textVideo, {
    title: "Text to Video AI Generator for Product Ads | AIVideosUGC",
    description: "Turn product facts, photos and a written brief into an editable video storyboard. Refine scenes, compare versions and review the video before download.",
    keywords: "text to video AI generator, text to video for product ads, AI product video, editable video storyboard, AI video ads",
    primaryKeyword: "text to video AI generator", ogImage: textVideo.heroImage.src, ogImageAlt: textVideo.heroImage.alt
  }) }
];
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
try {
  const target = await prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true } });
  if (!target || target.slug !== "aidreamcapes") throw new Error("Aidreamcapes target not found; refusing a cross-store write.");
  const [existing, dreamshootBefore] = await Promise.all([
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: records.map((row) => row.slug) } }, select: { id: true, slug: true, title: true } }),
    prisma.livePage.findMany({ where: { siteId: "site_dreamshoot" }, select: { id: true, slug: true, title: true, contentJson: true, updatedAt: true }, orderBy: { slug: "asc" } })
  ]);
  if (existing.length) throw new Error("Target LivePage routes already exist; refusing to overwrite current data.");
  const beforeHash = hash(dreamshootBefore);
  console.log(JSON.stringify({ mode: process.argv.includes("--apply-local") ? "apply-local" : "dry-run", target: { id: target.id, slug: target.slug }, pages: records.map((row) => ({ slug: row.slug, title: row.title, contentHash: hash(row.contentJson), sections: row.contentJson.sections.v2_main.settings.data.landingSections.length })), protectedMydreamshootsRows: dreamshootBefore.length, protectedMydreamshootsHash: beforeHash }, null, 2));
  if (process.argv.includes("--apply-local")) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: records.map((row) => row.slug) } }, select: { id: true } });
      if (current.length) throw new Error("A target route appeared during apply; refusing to overwrite.");
      await tx.livePage.createMany({ data: records.map((row) => ({ ...row, siteId: SITE_ID, pageType: "content", templateKey: "aidreamcapes-v2-directory" })) });
    }, { isolationLevel: "Serializable" });
    const [readback, dreamshootAfter] = await Promise.all([
      prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: records.map((row) => row.slug) } }, select: { id: true, slug: true, title: true, contentJson: true, updatedAt: true }, orderBy: { slug: "asc" } }),
      prisma.livePage.findMany({ where: { siteId: "site_dreamshoot" }, select: { id: true, slug: true, title: true, contentJson: true, updatedAt: true }, orderBy: { slug: "asc" } })
    ]);
    if (readback.length !== records.length || hash(dreamshootAfter) !== beforeHash) throw new Error("Readback failed or MyDreamShoots data changed.");
    console.log(JSON.stringify({ readback: readback.map((row) => ({ id: row.id, slug: row.slug, title: row.title, updatedAt: row.updatedAt, contentHash: hash(row.contentJson) })), isolationVerified: true }, null, 2));
  }
} finally { await prisma.$disconnect(); }
