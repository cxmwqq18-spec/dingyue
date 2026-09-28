import { existsSync } from "node:fs";
import { aidreamcapesEcommerceMainImageContent } from "./aidreamcapes-ecommerce-main-image-content.mjs";

const CTA_HREF = "/app/create?tool_id=image_generator";
const SITE_ORIGIN = "https://aidreamcapes.com";

function assetRoot(slug) {
  return `/assets/sites/site_aidreamcapes/${slug}-v1/${slug}`;
}

function image(root, file, alt, width, height, loading = "lazy", fetchPriority = "low") {
  return {
    src: `${root}/${file}`,
    alt,
    width,
    height,
    loading,
    fetchPriority,
    sizes: "(max-width: 760px) 92vw, (max-width: 1200px) 46vw, 620px"
  };
}

const NATIVE_IMAGE_SIZES = {
  landscape: [3344, 1880],
  portrait: [1880, 3344],
  square: [1880, 1880]
};

function nativeImageSize(orientation) {
  return NATIVE_IMAGE_SIZES[orientation];
}

function exampleOrientation(title, alt) {
  const text = `${title} ${alt}`.toLowerCase();
  if (/square|profile crop|thumbnail|magazine-ready|storefront crop/.test(text)) return "square";
  if (/vertical|portrait-ready|full-body|story|tied-back|side profile|outdoor portrait/.test(text)) return "portrait";
  return "landscape";
}

function sourceImageSize() {
  return nativeImageSize("portrait");
}

function orientationFromSize(size) {
  if (!Array.isArray(size) || size.length !== 2) return "landscape";
  const ratio = size[0] / size[1];
  if (Math.abs(ratio - 1) < 0.03) return "square";
  return ratio > 1 ? "landscape" : "portrait";
}

function sixFaq(spec) {
  return [
    {
      question: `What can I make with ${spec.label}?`,
      answer: `${spec.faqOutcome} Use the examples as a guide, then choose the result that fits your own project.`
    },
    {
      question: `Can I start with my own ${spec.referenceNoun}?`,
      answer: `Yes. Use a clear ${spec.referenceNoun} that you own or have permission to use. The clearer the starting image, the easier it is to review the result.`
    },
    {
      question: `Will the result keep the important details?`,
      answer: `The workflow is designed to keep the main ${spec.detailNoun} easy to see, but generated images can change small details. Compare every result with the original before using it.`
    },
    {
      question: `Can I make different versions for different places?`,
      answer: `Yes. Ask for the shape, crop, setting, or view that fits your destination. Check the latest rules and display size wherever the image will appear.`
    },
    {
      question: `Can I use the image for public or business content?`,
      answer: `You can use a suitable result when you control the source material, have permission for everyone shown, and review the image and destination rules before publishing.`
    },
    {
      question: `What should I check before I publish it?`,
      answer: `Look at faces, hands, edges, labels, logos, reflections, shadows, colors, and unwanted objects. Remove anything that is inaccurate or does not belong.`
    }
  ];
}

const THEME_RELATED_LINKS = {
  "lifestyle-scene": [
    ["Create ecommerce main images", "/ai-image-generation/ecommerce-main-image"],
    ["Explore bundle set images", "/ai-image-generation/bundle-sets"],
    ["Read the AI product photography guide", "/blog/ai-product-photography-guide"]
  ],
  "packshot-multi-angle": [
    ["Create ecommerce main images", "/ai-image-generation/ecommerce-main-image"],
    ["Show macro product details", "/ai-image-generation/macro-details"],
    ["Read the AI product photography guide", "/blog/ai-product-photography-guide"]
  ],
  "macro-details": [
    ["Create multi-angle product images", "/ai-image-generation/packshot-multi-angle"],
    ["Build feature infographics", "/ai-image-generation/feature-infographic"],
    ["Read the AI product photography guide", "/blog/ai-product-photography-guide"]
  ],
  "bundle-sets": [
    ["Create ecommerce main images", "/ai-image-generation/ecommerce-main-image"],
    ["Add a size reference", "/ai-image-generation/size-reference"],
    ["Read the AI product photography guide", "/blog/ai-product-photography-guide"]
  ],
  "size-reference": [
    ["Create bundle set images", "/ai-image-generation/bundle-sets"],
    ["Build comparison charts", "/ai-image-generation/comparison-chart"],
    ["Read the AI product photography guide", "/blog/ai-product-photography-guide"]
  ],
  "feature-infographic": [
    ["Show macro product details", "/ai-image-generation/macro-details"],
    ["Build comparison charts", "/ai-image-generation/comparison-chart"],
    ["Read the AI product photography guide", "/blog/ai-product-photography-guide"]
  ],
  "comparison-chart": [
    ["Build feature infographics", "/ai-image-generation/feature-infographic"],
    ["Explore commercial lighting", "/ai-image-generation/commercial-lighting"],
    ["Read the AI product photography guide", "/blog/ai-product-photography-guide"]
  ],
  "feed-ad-still": [
    ["Create UGC ad stills", "/ai-image-generation/ugc-still-ad"],
    ["Create vertical story ads", "/ai-image-generation/story-ad-vertical"],
    ["Read the AI UGC video ads guide", "/blog/ai-ugc-video-ads-guide"]
  ],
  "ugc-still-ad": [
    ["Create feed ad stills", "/ai-image-generation/feed-ad-still"],
    ["Create carousel sets", "/ai-image-generation/carousel-set"],
    ["Read the AI UGC video ads guide", "/blog/ai-ugc-video-ads-guide"]
  ],
  "story-ad-vertical": [
    ["Create feed ad stills", "/ai-image-generation/feed-ad-still"],
    ["Create carousel sets", "/ai-image-generation/carousel-set"],
    ["Read the AI UGC video ads guide", "/blog/ai-ugc-video-ads-guide"]
  ],
  "carousel-set": [
    ["Create vertical story ads", "/ai-image-generation/story-ad-vertical"],
    ["Create sale campaign visuals", "/ai-image-generation/sale-campaign-key-visual"],
    ["Read the AI UGC video ads guide", "/blog/ai-ugc-video-ads-guide"]
  ],
  "sale-campaign-key-visual": [
    ["Create carousel sets", "/ai-image-generation/carousel-set"],
    ["Create a lookbook cover", "/ai-image-generation/lookbook-cover"],
    ["Read the AI UGC video ads guide", "/blog/ai-ugc-video-ads-guide"]
  ],
  "lookbook-cover": [
    ["Create sale campaign visuals", "/ai-image-generation/sale-campaign-key-visual"],
    ["Create fashion editorial images", "/ai-image-generation/fashion-editorial"],
    ["Read the AI UGC video ads guide", "/blog/ai-ugc-video-ads-guide"]
  ],
  "on-model-generation": [
    ["Explore virtual try-on", "/ai-image-generation/virtual-try-on"],
    ["Create ghost mannequin images", "/ai-image-generation/ghost-mannequin"],
    ["Read the AI product photography guide", "/blog/ai-product-photography-guide"]
  ],
  "virtual-try-on": [
    ["Create on-model product images", "/ai-image-generation/on-model-generation"],
    ["Preview hair and makeup", "/ai-image-generation/hair-makeup-preview"],
    ["Read the AI product photography guide", "/blog/ai-product-photography-guide"]
  ],
  "hair-makeup-preview": [
    ["Explore virtual try-on", "/ai-image-generation/virtual-try-on"],
    ["Create a professional headshot", "/ai-image-generation/professional-headshot"],
    ["Read the AI product photography guide", "/blog/ai-product-photography-guide"]
  ],
  "jewelry-positioning": [
    ["Create on-model product images", "/ai-image-generation/on-model-generation"],
    ["Show macro product details", "/ai-image-generation/macro-details"],
    ["Read the AI product photography guide", "/blog/ai-product-photography-guide"]
  ],
  "ghost-mannequin": [
    ["Create on-model product images", "/ai-image-generation/on-model-generation"],
    ["Create product color variations", "/ai-image-generation/colorway-variations"],
    ["Read the AI product photography guide", "/blog/ai-product-photography-guide"]
  ],
  "colorway-variations": [
    ["Create ghost mannequin images", "/ai-image-generation/ghost-mannequin"],
    ["Build comparison charts", "/ai-image-generation/comparison-chart"],
    ["Read the AI product photography guide", "/blog/ai-product-photography-guide"]
  ],
  "background-remove-replace": [
    ["Enhance and upscale an image", "/ai-image-generation/enhance-upscale"],
    ["Explore commercial lighting", "/ai-image-generation/commercial-lighting"],
    ["Read the ecommerce image workflow", "/blog/ecommerce-product-image-workflow"]
  ],
  "enhance-upscale": [
    ["Remove or replace a background", "/ai-image-generation/background-remove-replace"],
    ["Restore an old photo", "/ai-image-generation/old-photo-restore"],
    ["Read the ecommerce image workflow", "/blog/ecommerce-product-image-workflow"]
  ],
  "old-photo-restore": [
    ["Enhance and upscale an image", "/ai-image-generation/enhance-upscale"],
    ["Create a professional headshot", "/ai-image-generation/professional-headshot"],
    ["Read the safe AI content guide", "/blog/ai-content-disclosure-safe-usage"]
  ],
  "commercial-lighting": [
    ["Remove or replace a background", "/ai-image-generation/background-remove-replace"],
    ["Create packaging mockups", "/ai-image-generation/packaging-mockup"],
    ["Read the ecommerce image workflow", "/blog/ecommerce-product-image-workflow"]
  ],
  "packaging-mockup": [
    ["Explore commercial lighting", "/ai-image-generation/commercial-lighting"],
    ["Create bundle set images", "/ai-image-generation/bundle-sets"],
    ["Read the ecommerce image workflow", "/blog/ecommerce-product-image-workflow"]
  ],
  "professional-headshot": [
    ["Create creator portraits", "/ai-image-generation/creator-portrait"],
    ["Create team directory portraits", "/ai-image-generation/team-directory"],
    ["Read the safe AI content guide", "/blog/ai-content-disclosure-safe-usage"]
  ],
  "creator-portrait": [
    ["Create a professional headshot", "/ai-image-generation/professional-headshot"],
    ["Create social profile photos", "/ai-image-generation/social-profile-photo"],
    ["Read the safe AI content guide", "/blog/ai-content-disclosure-safe-usage"]
  ],
  "team-directory": [
    ["Create a professional headshot", "/ai-image-generation/professional-headshot"],
    ["Create social profile photos", "/ai-image-generation/social-profile-photo"],
    ["Read the safe AI content guide", "/blog/ai-content-disclosure-safe-usage"]
  ],
  "social-profile-photo": [
    ["Create creator portraits", "/ai-image-generation/creator-portrait"],
    ["Create a professional headshot", "/ai-image-generation/professional-headshot"],
    ["Read the safe AI content guide", "/blog/ai-content-disclosure-safe-usage"]
  ],
  "fashion-editorial": [
    ["Create a lookbook cover", "/ai-image-generation/lookbook-cover"],
    ["Create on-model product images", "/ai-image-generation/on-model-generation"],
    ["Read the AI product photography guide", "/blog/ai-product-photography-guide"]
  ]
};

function relatedLinksForSlug(slug) {
  return (THEME_RELATED_LINKS[slug] ?? []).map(([label, href]) => ({ label, href }));
}

function makePage(spec) {
  const root = assetRoot(spec.slug);
  const source = image(root, "source-input.webp", spec.sourceAlt, ...sourceImageSize(), "eager", "high");
  const heroOrientation = orientationFromSize(spec.heroSize);
  const hero = image(root, "hero-output.webp", spec.heroAlt, ...(spec.heroOutputSize ?? nativeImageSize(heroOrientation)), "eager", "auto");
  const examples = spec.examples.map(([title, alt], index) => ({
    title,
    body: spec.exampleBody(title),
    image: image(root, `example-${String(index + 1).padStart(2, "0")}.webp`, alt, ...nativeImageSize(exampleOrientation(title, alt)))
  }));
  const detailCards = spec.proof.map(([title, body]) => ({ title, body }));
  const workflowSteps = spec.workflow.map(([title, body]) => ({ title, body }));
  const directions = examples.slice(0, 4).map((item) => ({
    title: item.title,
    body: spec.directionBody(item.title)
  }));
  const canonicalPath = `/ai-image-generation/${spec.slug}`;

  return {
    subject: spec.subject,
    layoutVariant: spec.variant,
    schema: {
      applicationName: `Aidreamcapes ${spec.label}`,
      applicationSubCategory: spec.schemaCategory,
      serviceType: spec.serviceType
    },
    seo: {
      title: spec.title,
      description: spec.description,
      keywords: spec.keywords,
      canonicalPath,
      canonical: `${SITE_ORIGIN}${canonicalPath}`,
      twitterDescription: spec.twitterDescription ?? spec.description,
      ogImage: `${root}/og.webp`,
      ogImageAlt: spec.heroAlt
    },
    hero: {
      eyebrow: spec.heroEyebrow,
      title: spec.h1,
      body: spec.heroBody,
      primaryCta: "Start creating",
      primaryCtaHref: CTA_HREF,
      secondaryCta: "View examples",
      secondaryCtaHref: "#examples",
      availabilityNote: spec.availabilityNote,
      rightsCopy: spec.rightsCopy,
      imageNote: spec.imageNote,
      productLabel: spec.sourceLabel,
      outputLabel: spec.outputLabel,
      productImage: source,
      outputImage: hero
    },
    proof: {
      eyebrow: spec.proofEyebrow,
      title: spec.proofTitle,
      intro: spec.proofIntro,
      cards: detailCards
    },
    workflow: {
      eyebrow: spec.workflowEyebrow,
      title: spec.workflowTitle,
      intro: spec.workflowIntro,
      steps: workflowSteps
    },
    directions: {
      eyebrow: spec.directionEyebrow,
      title: spec.directionTitle,
      intro: spec.directionIntro,
      cards: directions
    },
    examples: {
      eyebrow: spec.examplesEyebrow,
      title: spec.examplesTitle,
      intro: spec.examplesIntro,
      items: examples
    },
    formats: {
      eyebrow: "Where it can help",
      title: spec.formatsTitle,
      intro: spec.formatsIntro,
      items: spec.formats.map(([title, body]) => ({ title, body }))
    },
    checklist: {
      eyebrow: "Before you start",
      title: spec.checklistTitle,
      intro: spec.checklistIntro,
      items: spec.checklist
    },
    faq: {
      eyebrow: "Helpful answers",
      title: "Frequently asked questions",
      intro: spec.faqIntro,
      items: sixFaq(spec)
    },
    internalLinks: relatedLinksForSlug(spec.slug),
    finalCta: {
      eyebrow: spec.finalEyebrow,
      title: spec.finalTitle,
      body: spec.finalBody,
      cta: "Start creating",
      ctaHref: CTA_HREF,
      microcopy: spec.finalMicrocopy
    }
  };
}

function commonSpec(spec) {
  return {
    schemaCategory: "CreativeWorkApplication",
    serviceType: "AI image creation",
    heroEyebrow: "A focused image workflow",
    proofEyebrow: "What makes the result useful",
    proofTitle: "Make the important part easy to understand",
    proofIntro: "A strong image gives people enough context to understand the subject without making them work to find it.",
    workflowEyebrow: "A simple way to get started",
    workflowTitle: "From a clear reference to a useful image",
    workflowIntro: "Start with an image you can use, choose the direction, and review the result before it goes anywhere public.",
    directionEyebrow: "Ways to use the workflow",
    directionTitle: "Choose the view that fits the job",
    directionIntro: "Different uses call for different views, settings, and amounts of surrounding detail.",
    examplesEyebrow: "Example directions",
    examplesTitle: "See how the idea can come together",
    examplesIntro: "These examples show possible directions, not a promise of an identical result.",
    formatsTitle: "Make an image for the place it will live",
    formatsIntro: "Choose a result that fits your page, campaign, profile, or private draft.",
    checklistTitle: "Check the details that matter",
    checklistIntro: "A short review helps you catch changes before the image reaches customers, colleagues, or followers.",
    faqIntro: "Use these answers as a quick guide before you create, share, or publish an image.",
    finalEyebrow: "Ready to make the idea clearer",
    finalTitle: "Create your next image",
    finalBody: "Start with one clear reference and shape an image that fits the job.",
    finalMicrocopy: "Review every result against the original and the place where you plan to use it.",
    availabilityNote: "Use images you own or have permission to use. Review every result before sharing or publishing it.",
    rightsCopy: "Generated images can change small details. Compare the final result with the original and your intended use.",
    imageNote: "reference → finished image",
    sourceLabel: "Reference image",
    outputLabel: "Finished direction",
    workflow: [
      ["Choose a clear reference", "Use a source image that shows the subject well and that you are allowed to use."],
      ["Describe the goal", "Choose the setting, view, mood, or change that matches the job."],
      ["Keep the subject honest", "Check that the shape, color, person, clothing, or product remains true to the source."],
      ["Review the result", "Look for changed details, odd edges, extra objects, and anything that could mislead someone."],
      ["Choose where it belongs", "Use the result only in a place and format that fits the image and your permissions."]
    ],
    exampleBody: (title) => `Use ${title.toLowerCase()} when it helps people understand the subject more quickly.`,
    directionBody: (title) => `A ${title.toLowerCase()} can make this use easier to understand.`,
    ...spec
  };
}

const specs = [
  commonSpec({
    slug: "lifestyle-scene",
    label: "Lifestyle Scene",
    variant: "lifestyle-scene-detail",
    title: "AI Lifestyle Product Image Generator | Aidreamcapes",
    description: "Create natural lifestyle product photos with real-world settings, useful context, and a clear focus on what you sell for Shopify, marketplaces, and online stores.",
    keywords: "AI lifestyle product image generator, lifestyle product photography, product lifestyle photos, ecommerce lifestyle images",
    h1: "Put your product in the moments customers can imagine.",
    heroBody: "Turn one product reference into a natural scene that shows how the item can fit into everyday life, while keeping the product easy to find and understand.",
    sourceAlt: "Unbranded linen tote bag product reference on a neutral tabletop",
    heroAlt: "Linen tote bag styled in a bright weekend market scene",
    sourceLabel: "Product reference",
    outputLabel: "Lifestyle scene",
    imageNote: "product → lived-in scene",
    subject: "linen tote bag",
    referenceNoun: "product photo",
    detailNoun: "product shape and finish",
    faqOutcome: "It can place a product in a believable home, outdoor, travel, or shopping moment.",
    proof: [["Product stays visible", "Keep the item clear even when the scene has people, furniture, or outdoor detail."], ["Context feels useful", "Show a setting that helps someone picture when and where the product belongs."], ["The scene feels natural", "Use light, scale, and simple actions that do not compete with the product."], ["Leave room for the page", "Choose a crop that can work beside a headline, price, or button you add later."]],
    formats: [["Product pages", "Add a natural second image after the main product view."], ["Storefront banners", "Use a wider scene when the page needs atmosphere and room for copy."], ["Social posts", "Show the product in a moment people can recognize quickly."], ["Campaign drafts", "Explore a setting before planning a full photo shoot."]],
    checklist: ["Check that the product shape and color still match the reference.", "Make sure people, hands, and props do not cover the item.", "Remove settings or objects that imply an unverified claim.", "Review the crop at the size where customers will see it."],
    directionBody: (title) => `Use ${title.toLowerCase()} to make the product feel easier to picture in daily life.`,
    examples: [["Morning cafe", "Linen tote bag beside a coffee cup at a sunny cafe"], ["Park break", "Linen tote bag on a park bench with soft morning light"], ["City ride", "Linen tote bag carried beside a city bike"], ["Beach picnic", "Linen tote bag on a beach picnic blanket"], ["Home entryway", "Linen tote bag hanging in a bright home entryway"], ["Neighborhood walk", "Hand holding the linen tote bag on a neighborhood street"], ["Fabric detail", "Close view of the tote bag weave and stitched handle"], ["Storefront crop", "Portrait-ready lifestyle crop of the linen tote bag"]]
  }),
  commonSpec({
    slug: "packshot-multi-angle",
    label: "Packshot Multi-angle",
    variant: "packshot-multi-angle-detail",
    title: "AI Multi-Angle Product Image Generator | Aidreamcapes",
    description: "Create consistent product images from the front, back, side, top, and key viewing angles so online shoppers can understand what they are buying.",
    keywords: "AI multi-angle product image generator, product angle photography, product views, ecommerce product images",
    h1: "Let shoppers see the product from every useful angle.",
    heroBody: "Build a clear set of product views from one reference, so shoppers can understand the shape, controls, finish, and details before they decide.",
    sourceAlt: "Unbranded compact wireless speaker product reference on a neutral surface",
    heroAlt: "Front-facing compact wireless speaker centered on a gray studio background",
    subject: "compact wireless speaker",
    referenceNoun: "product photo",
    detailNoun: "product shape and visible controls",
    faqOutcome: "It can create front, rear, side, top, and close views that help explain a product.",
    proof: [["Every side has a job", "Show the views that answer real shopper questions instead of adding angles just to fill a gallery."], ["Shape stays consistent", "Keep the product recognizable as the view changes."], ["Details get their own space", "Give ports, controls, handles, and finishes a clear place in the set."], ["The set feels connected", "Use matching light and background so the views feel like one product story."]],
    formats: [["Product listings", "Add the most useful angles after the first product image."], ["Product pages", "Help shoppers inspect the item without guessing about its shape."], ["Retail catalogs", "Keep a repeatable view set across a product range."], ["Sales conversations", "Share details that are hard to explain with one photo."]],
    checklist: ["Confirm that each angle shows the same product.", "Check controls, ports, handles, and openings for unwanted changes.", "Remove invented accessories or features.", "Choose only the views that help someone make a decision."],
    examples: [["Front view", "Straight-on view of the compact wireless speaker on a gray studio background"], ["Rear view", "Rear view of the wireless speaker showing its plain connection area"], ["Side profile", "Side profile showing the speaker’s depth and rounded edge"], ["Top view", "Top view of the wireless speaker with simple controls"], ["Three-quarter view", "Three-quarter product view showing the speaker grille and body shape"], ["Base view", "Bottom view showing the speaker base and grip"], ["Grille detail", "Close view of the wireless speaker fabric grille"], ["Paired views", "Front and rear views of the wireless speaker side by side"]]
  }),
  commonSpec({
    slug: "macro-details",
    label: "Macro Details",
    variant: "macro-details-detail",
    title: "AI Product Detail Image Generator | Aidreamcapes",
    description: "Create close-up product images that make materials, texture, stitching, finishes, and small features easier to see before a customer buys.",
    keywords: "AI product detail image generator, product close-up photography, material detail images, ecommerce detail photos",
    h1: "Make the details shoppers care about easy to see.",
    heroBody: "Turn a product reference into close views that answer small but important questions about texture, construction, finish, and everyday use.",
    sourceAlt: "Unbranded brown leather wallet product reference on a neutral surface",
    heroAlt: "Close product image of a brown leather wallet with clean studio lighting",
    subject: "brown leather wallet",
    referenceNoun: "product photo",
    detailNoun: "material, stitching, and small features",
    faqOutcome: "It can create close views of material, stitching, edges, openings, and other useful product details.",
    proof: [["Texture feels close", "Let shoppers see the surface instead of relying on a vague description."], ["Construction is easier to judge", "Show seams, folds, joins, and edges with enough room to inspect them."], ["Small features get attention", "Give zippers, pockets, openings, and finishes their own view."], ["Close does not mean confusing", "Keep the larger product context nearby so a detail still makes sense."]],
    formats: [["Product pages", "Place a detail image beside the product facts it supports."], ["Material stories", "Show the surface and construction behind a product description."], ["Catalog pages", "Use close views to make a product range feel more tangible."], ["Customer support", "Explain a feature with a picture instead of a long paragraph."]],
    checklist: ["Compare the texture and color with the original product.", "Check seams, edges, zippers, and openings closely.", "Do not let a close crop suggest a feature the product does not have.", "Keep the detail connected to the full product view."],
    examples: [["Leather grain", "Close view of the wallet leather grain"], ["Outer stitching", "Wallet stitching detail along the outer edge"], ["Card slots", "Interior card slots of the brown leather wallet"], ["Folded edge", "Folded wallet edge and seam detail"], ["Zipper detail", "Close view of the wallet zipper and pull"], ["Corner finish", "Corner detail showing the leather finish"], ["Open interior", "Open wallet interior on a neutral background"]]
  }),
  commonSpec({
    slug: "bundle-sets",
    label: "Bundle Sets",
    variant: "bundle-sets-detail",
    title: "AI Product Bundle Image Generator | Aidreamcapes",
    description: "Create clear bundle images that show every included item together with balanced spacing and a clean presentation for online stores.",
    keywords: "AI product bundle image generator, product set photography, bundle product images, ecommerce bundle photos",
    h1: "Show everything in the box at a glance.",
    heroBody: "Create a clear view of a product set so shoppers can see what is included, how the pieces work together, and what they can expect to receive.",
    sourceAlt: "Unbranded skincare bottle, cream jar, and matching box bundle",
    heroAlt: "Complete skincare bundle arranged together on a clean studio set",
    subject: "skincare bundle",
    referenceNoun: "bundle reference photo",
    detailNoun: "included items and packaging",
    faqOutcome: "It can arrange a set of products, accessories, packaging, or travel pieces in one easy-to-read image.",
    proof: [["Every included item is visible", "Make the bundle easier to understand before someone adds it to a cart."], ["Spacing feels intentional", "Keep pieces separated enough to count without making the set feel scattered."], ["The set feels real", "Use believable contact, light, and shadows between the pieces."], ["The main item leads", "Give the most important product the clearest position in the bundle."]],
    formats: [["Bundle listings", "Show the complete set in the first few product images."], ["Gift collections", "Present the pieces together without inventing extra contents."], ["Travel sets", "Make small items and their container easy to see."], ["Catalog spreads", "Create a consistent visual language for grouped products."]],
    checklist: ["Count every item against the real bundle contents.", "Check that sizes, colors, lids, and accessories are correct.", "Remove invented pieces or labels.", "Make sure no item is hidden behind another item."],
    examples: [["Complete set", "Every item in the skincare set shown together"], ["Bottle and jar", "Skincare bottle and cream jar arranged side by side"], ["Open box", "Open product box with the skincare items beside it"], ["Top view", "Top view of the complete skincare bundle"], ["Travel pouch", "Travel-size skincare set arranged in a small pouch"], ["Gift arrangement", "Gift-ready skincare bundle on a neutral surface"], ["Shelf grouping", "Shelf presentation of the complete skincare collection"]]
  }),
  commonSpec({
    slug: "size-reference",
    label: "Size Reference",
    variant: "size-reference-detail",
    title: "AI Product Size Reference Image Generator | Aidreamcapes",
    description: "Help shoppers understand product size with clear scale images that use familiar objects, hands, and everyday settings. Review every result before publishing.",
    keywords: "AI product size reference image generator, product scale images, ecommerce size comparison, product dimensions visual",
    h1: "Help shoppers understand the size before they buy.",
    heroBody: "Show a product beside familiar objects or in a real setting, giving shoppers a useful sense of scale without guessing from a single number.",
    sourceAlt: "Unbranded folding travel backpack product reference on a neutral surface",
    heroAlt: "Travel backpack shown beside a familiar hand and carry-on suitcase for scale",
    subject: "folding travel backpack",
    referenceNoun: "product reference",
    detailNoun: "shape and real-world scale",
    faqOutcome: "It can place a product beside hands, furniture, bags, or everyday objects to give a clearer sense of size.",
    proof: [["Scale feels familiar", "Use objects people already know instead of asking them to imagine a measurement."], ["The product stays honest", "Keep the reference item’s shape and proportions visible."], ["Context does not distract", "Use a simple setting that supports the size comparison."], ["Measurements remain factual", "Use real dimensions in your page copy and treat the image as a visual guide."]],
    formats: [["Product pages", "Add a scale image beside the written dimensions."], ["Marketplace listings", "Give shoppers a quick visual before they read the details."], ["Furniture and bags", "Use everyday surroundings to make size easier to picture."], ["Customer questions", "Answer common size concerns with a clear visual reference."]],
    checklist: ["Use the real product dimensions in the written description.", "Choose a familiar comparison object with a believable size.", "Check that hands and people do not make the product look misleadingly large or small.", "Explain that the image is a visual guide, not a measurement tool."],
    heroSize: [1600, 1000],
    examples: [["Hand comparison", "Hand beside the travel backpack showing everyday size"], ["Chair comparison", "Travel backpack next to a dining chair"], ["Suitcase comparison", "Backpack beside a carry-on suitcase"], ["Desk comparison", "Backpack resting on a desk beside a notebook"], ["Worn size", "Person wearing the backpack for a natural size cue"], ["Folded size", "Folded backpack shown beside the full-size version"]]
  }),
  commonSpec({
    slug: "feature-infographic",
    label: "Feature Infographic",
    variant: "feature-infographic-detail",
    title: "AI Product Feature Infographic Maker | Aidreamcapes",
    description: "Turn product details into clear feature images with simple callouts and easy-to-scan layouts for product pages, listings, and online stores.",
    keywords: "AI product feature infographic maker, product feature image, ecommerce infographic, product callout image",
    h1: "Turn product features into easy-to-read visuals.",
    heroBody: "Start with a clear product image and build a simple visual explanation around it. Add your final labels yourself so every word stays accurate.",
    sourceAlt: "Unbranded electric kettle product reference with plain surfaces",
    heroAlt: "Electric kettle with simple feature callouts placed beside the product",
    subject: "electric kettle",
    referenceNoun: "product image",
    detailNoun: "features and visible controls",
    faqOutcome: "It can help you plan a product image with clear places for feature callouts and supporting details.",
    proof: [["The product remains central", "Keep the object large enough to understand before adding any explanation around it."], ["Callouts have a clear target", "Point each note to one visible part of the product."], ["Your facts stay yours", "Add the final feature words in your own layout instead of trusting generated lettering."], ["The page is easy to scan", "Use a simple reading order so shoppers can move from feature to feature."]],
    formats: [["Product pages", "Explain a feature beside the image where shoppers need it."], ["Marketplace galleries", "Use one clear visual to support the product description."], ["Sales sheets", "Turn a product photo into a quick reference for buyers."], ["Store education", "Help people understand unfamiliar parts without a long manual."]],
    checklist: ["Confirm every callout points to a real visible feature.", "Add final labels and facts yourself in the page layout.", "Check that no generated lettering is treated as product information.", "Compare feature names with the approved product documentation."],
    imageNote: "product → explained view",
    examples: [["Lid opening", "Electric kettle lid opening detail"], ["Pouring spout", "Kettle spout and pouring angle close-up"], ["Handle", "Kettle handle detail in a clean studio view"], ["Base", "Kettle base and power area shown clearly"], ["Water window", "Kettle water window detail"], ["Control area", "Kettle control area without readable text"], ["Side silhouette", "Side silhouette of the electric kettle"]]
  }),
  commonSpec({
    slug: "comparison-chart",
    label: "Comparison Chart",
    variant: "comparison-chart-detail",
    title: "AI Product Comparison Chart Maker | Aidreamcapes",
    description: "Create clear comparison visuals that help shoppers compare sizes, features, materials, and included items without adding unsupported claims.",
    keywords: "AI product comparison chart maker, product comparison image, ecommerce comparison chart, product feature comparison",
    h1: "Make product differences clear at a glance.",
    heroBody: "Set two product options side by side and give shoppers a calm, factual way to compare what changes and what stays the same.",
    sourceAlt: "Two unbranded insulated bottle variants beside each other",
    heroAlt: "Two insulated bottle variants arranged for a clear side-by-side comparison",
    subject: "insulated bottle variants",
    referenceNoun: "product references",
    detailNoun: "differences, colors, and included items",
    faqOutcome: "It can help you show two or more product options together so the differences are easier to understand.",
    proof: [["The options are easy to separate", "Give each product its own clear space and name it in your HTML layout."], ["The comparison stays factual", "Show visible differences without inventing ratings, promises, or test results."], ["Shared details remain visible", "Make it clear when the products share the same material or basic design."], ["The shopper can scan quickly", "Use a short comparison list beside the images."]],
    formats: [["Variant pages", "Help shoppers compare sizes or finishes before choosing."], ["Buying guides", "Show the difference between two product options."], ["Catalogs", "Keep product families easy to compare across a page."], ["Sales support", "Give customers a visual starting point for questions."]],
    checklist: ["Use accurate names and facts for each option.", "Do not add ratings, test results, or claims you cannot support.", "Keep the two products at a believable relative size.", "Check that every included accessory is shown in the correct column."],
    formatsTitle: "Give shoppers a fair side-by-side view",
    examples: [["Overall view", "Front view of two insulated bottle variants aligned for comparison"], ["Height", "Height comparison of two insulated bottles"], ["Lids", "Different lids shown side by side"], ["Openings", "Bottle mouth and opening comparison"], ["Colors", "Color comparison of the two bottle options"], ["Carry loops", "Carry loop comparison on both bottles"]]
  }),
  commonSpec({
    slug: "feed-ad-still",
    label: "Feed Ad Still",
    variant: "feed-ad-still-detail",
    title: "AI Feed Ad Image Generator | Aidreamcapes",
    description: "Create product ad images for social feeds with a strong focal point, readable space, and a clear next step for shoppers.",
    keywords: "AI feed ad image generator, social feed product ad, product advertising image, ecommerce ad creative",
    h1: "Make the product clear before the scroll moves on.",
    heroBody: "Create a feed-ready product image with a strong first look, room for your own message, and a visual path that makes the next step easy to understand.",
    sourceAlt: "Unbranded running shoe product reference on a neutral surface",
    heroAlt: "Running shoe centered in a clean vertical feed ad composition",
    subject: "running shoe",
    referenceNoun: "product reference",
    detailNoun: "product shape and visible materials",
    faqOutcome: "It can create product-focused images for social feeds, campaign drafts, and paid or organic posts.",
    proof: [["The first look is clear", "Make the product recognizable before a viewer has time to read the message."], ["The image has breathing room", "Leave space for your own headline, offer, and button outside the generated image."], ["The product leads the story", "Use props and people only when they help explain the item."], ["The final message stays accurate", "Add claims and offer details yourself so they match the campaign."]],
    formats: [["Social feeds", "Create a first frame that makes the product easy to notice."], ["Paid campaigns", "Build a visual direction before adding approved ad copy."], ["Organic posts", "Show a product in a simple, shareable composition."], ["Retargeting drafts", "Try another product view without changing the facts."]],
    checklist: ["Keep the product visible at a small screen size.", "Add final prices, terms, and claims outside the generated image.", "Check that the crop leaves room for the real ad layout.", "Review the ad destination and disclosure requirements before publishing."],
    imageNote: "product → feed frame",
    examples: [["Product close-up", "Running shoe close-up for a social feed"], ["Hand-held view", "Hand holding the running shoe against a simple background"], ["Gym bag scene", "Running shoe beside a gym bag"], ["Outdoor path", "Running shoe on an outdoor path"], ["Tread detail", "Sole and tread detail of the running shoe"], ["Pair arrangement", "Pair of running shoes in a clean product arrangement"], ["Square feed crop", "Square feed crop of the running shoe"]]
  }),
  commonSpec({
    slug: "ugc-still-ad",
    label: "UGC Still Ad",
    variant: "ugc-still-ad-detail",
    title: "AI UGC Ad Image Generator | Aidreamcapes",
    description: "Turn an approved product reference into a natural-looking customer-style ad image for social feeds, with real context and a clear product focus.",
    keywords: "UGC still ad generator, AI customer style ad image, social product ad photo, user style advertising image",
    h1: "Create ad images that feel natural and product-first.",
    heroBody: "Build a casual product scene that feels at home in a social feed without inventing a customer review, personal story, or product claim.",
    sourceAlt: "Unbranded reusable water bottle product reference held by a person",
    heroAlt: "Person naturally holding an unbranded reusable water bottle in a home setting",
    subject: "reusable water bottle",
    referenceNoun: "product reference",
    detailNoun: "product shape and real use",
    faqOutcome: "It can create casual, customer-style product scenes for social ads without creating a fake testimonial.",
    proof: [["It feels everyday", "Use natural hands, light, and surroundings instead of a polished studio-only look."], ["The product is still clear", "Keep the item visible even when the scene feels spontaneous."], ["No fake review is implied", "Use the image as a visual direction, not proof that a real customer said or did something."], ["Your message stays in control", "Add approved copy and claims in the ad layout later."]],
    formats: [["Social ads", "Create a casual first impression for a product campaign."], ["Creator briefs", "Show a possible use scene before arranging a real shoot."], ["Product launches", "Explore natural settings for a new item."], ["Organic content", "Build a simple product moment for a feed post."]],
    checklist: ["Do not pair the image with an invented testimonial.", "Check that the product and hands look natural together.", "Add approved claims and disclosures outside the image.", "Confirm that everyone shown has permission for the intended use."],
    imageNote: "product → customer-style scene",
    examples: [["Kitchen routine", "Water bottle on a kitchen counter during a daily routine"], ["Gym bag", "Person placing the bottle into a gym bag"], ["Desk moment", "Water bottle beside a laptop on a desk"], ["Outdoor carry", "Person carrying the bottle outdoors"], ["Lid close-up", "Hand-held close view of the bottle lid"], ["Window light", "Close product view in natural window light"], ["Vertical crop", "Vertical customer-style crop of the water bottle"]]
  }),
  commonSpec({
    slug: "story-ad-vertical",
    label: "Story 9:16 Ad",
    variant: "story-ad-vertical-detail",
    title: "AI Vertical Story Ad Image Generator | Aidreamcapes",
    description: "Create vertical product ad images for Stories, Shorts, and full-screen mobile placements with strong framing and room for your own copy.",
    keywords: "vertical story ad image generator, AI story ad, full screen product ad, mobile ad image",
    h1: "Make your product stand out in a full-screen story.",
    heroBody: "Create a tall, easy-to-scan product scene for a phone screen, with a clear focal point and room to add your own message later.",
    sourceAlt: "Unbranded sunscreen bottle on a plain surface",
    heroAlt: "Vertical full-screen story image of a sunscreen bottle beside a bright pool towel",
    subject: "sunscreen bottle",
    referenceNoun: "product photo",
    detailNoun: "product shape and cap",
    faqOutcome: "It can create tall product images for Stories, Shorts, and other full-screen mobile placements.",
    proof: [["It reads quickly", "Make the product obvious in the first moment of a full-screen view."], ["The crop is tall by design", "Keep the subject inside the safe center area of a phone screen."], ["There is room for your words", "Leave open space for the copy, sticker, or button you add later."], ["The product does not get lost", "Use a simple background and one clear action or setting."]],
    formats: [["Stories", "Build a product frame for a vertical story sequence."], ["Shorts", "Use a tall visual before adding the final short-form message."], ["Mobile landing pages", "Create a product image that feels natural on a narrow screen."], ["Launch countdowns", "Leave room for a date or offer that you add yourself."]],
    checklist: ["Check the image on an actual phone-sized preview.", "Keep the product away from areas covered by app controls.", "Add final text, dates, and offers outside the generated image.", "Review the current rules for the platform where the story will run."],
    heroSize: [1024, 1536],
    exampleSize: [1024, 1536],
    imageNote: "product → full-screen story",
    examples: [["Bathroom shelf", "Sunscreen bottle on a bathroom shelf"], ["Beach bag", "Hand holding sunscreen beside a beach bag"], ["Travel pouch", "Sunscreen bottle in a travel pouch"], ["Morning light", "Bottle beside a bright morning window"], ["Cap detail", "Close view of the sunscreen cap and bottle shape"], ["Open copy space", "Vertical product crop with open space for copy"]]
  }),
  commonSpec({
    slug: "carousel-set",
    label: "Carousel Set",
    variant: "carousel-set-detail",
    title: "AI Carousel Ad Image Generator | Aidreamcapes",
    description: "Plan a connected set of product ad images that introduce the item, show key details, and lead shoppers through a simple story.",
    keywords: "AI carousel ad image generator, product carousel images, social carousel ads, ecommerce carousel creative",
    h1: "Lead shoppers through the product one frame at a time.",
    heroBody: "Create a connected sequence where each image has one clear job, from the first product view to the detail that helps someone decide.",
    sourceAlt: "Unbranded wireless earbuds case and earbuds product reference",
    heroAlt: "Connected carousel opening frame for an unbranded wireless earbuds set",
    subject: "wireless earbuds set",
    referenceNoun: "product reference",
    detailNoun: "product shape and included pieces",
    faqOutcome: "It can help you plan a product story across several connected images.",
    proof: [["Each frame has one job", "Introduce, explain, reassure, and invite action without putting everything in one image."], ["The story feels connected", "Keep the product, light, and visual mood consistent from card to card."], ["Details appear at the right time", "Move closer only when a feature deserves more attention."], ["The ending stays clear", "Leave the final message and button for the layout you control."]],
    formats: [["Social carousels", "Build a sequence that works one swipe at a time."], ["Product launches", "Introduce a new item in a simple visual order."], ["Buying guides", "Use separate frames for benefits, details, and included pieces."], ["Retargeting", "Show a different part of the product without repeating the first image."]],
    checklist: ["Give every frame a different reason to exist.", "Check that the product stays consistent across the sequence.", "Add final copy and claims in the approved campaign layout.", "View the full carousel in order before publishing it."],
    imageNote: "reference → connected frames",
    examples: [["Opening frame", "Front product introduction image for wireless earbuds"], ["Inside the case", "Earbuds shown inside the open charging case"], ["Hand-held scale", "Earbud held between fingers for scale"], ["Desk use", "Charging case beside a phone without readable screen text"], ["Earbud detail", "Close view of the earbud shape"], ["Travel use", "Charging case in a pocket or travel pouch"], ["Work desk", "Wireless earbuds on a work desk"], ["Detail card", "Product detail crop for a carousel card"]]
  }),
  commonSpec({
    slug: "sale-campaign-key-visual",
    label: "Sale / BF Key Visual",
    variant: "sale-campaign-key-visual-detail",
    title: "AI Sale Campaign Image Generator | Aidreamcapes",
    description: "Create seasonal sale visuals for launches, Black Friday, and limited-time campaigns while keeping prices, terms, and final copy under your control.",
    keywords: "AI sale campaign image generator, Black Friday campaign image, ecommerce sale creative, seasonal product ad",
    h1: "Build a sale visual without inventing the offer.",
    heroBody: "Create the visual mood for a launch or seasonal campaign, then add your real price, dates, terms, and call to action in the final layout.",
    sourceAlt: "Unbranded winter jacket product reference on a neutral hanger",
    heroAlt: "Seasonal campaign image of an unbranded winter jacket with space for sale copy",
    subject: "winter jacket",
    referenceNoun: "product reference",
    detailNoun: "product shape, color, and seasonal styling",
    faqOutcome: "It can create campaign images for launches, Black Friday, seasonal events, and limited-time promotions.",
    proof: [["The product is the anchor", "Make the item recognizable before the campaign message takes over."], ["Seasonal mood is flexible", "Explore winter, holiday, or launch settings without locking in a false offer."], ["The offer stays accurate", "Add the real price, dates, and terms in your own design."], ["The visual can be reused", "Keep enough room to adapt the image for different campaign placements."]],
    formats: [["Black Friday", "Create a strong seasonal direction before adding approved offer copy."], ["Product launches", "Set the visual tone for a new collection or item."], ["Holiday campaigns", "Use seasonal context without adding unverified claims."], ["Email and social", "Adapt the same visual idea to different campaign layouts."]],
    checklist: ["Add only real prices, dates, and offer terms.", "Check that seasonal props do not hide the product.", "Remove invented badges, labels, and discount language.", "Review the campaign brief and destination platform rules."],
    imageNote: "product → campaign mood",
    examples: [["Folded jacket", "Winter jacket folded on a clean surface"], ["Worn outdoors", "Person wearing the jacket outdoors"], ["Fabric detail", "Close view of the jacket fabric and zipper"], ["Winter flat lay", "Flat lay of the jacket and winter accessories"], ["Snowy street", "Jacket in a snowy city setting"], ["Gift presentation", "Gift-style jacket presentation without price or text"], ["Square campaign crop", "Square seasonal campaign crop"]]
  }),
  commonSpec({
    slug: "lookbook-cover",
    label: "Lookbook Cover",
    variant: "lookbook-cover-detail",
    title: "AI Lookbook Cover Image Generator | Aidreamcapes",
    description: "Create a polished cover image for a product lookbook with a strong visual mood, flexible space for your own title, and no invented brand details.",
    keywords: "AI lookbook cover image generator, fashion lookbook cover, product catalog cover, editorial cover image",
    h1: "Open your lookbook with a cover that sets the mood.",
    heroBody: "Create a cover direction that gives your collection a point of view, with enough quiet space for the real title and details you add later.",
    sourceAlt: "Unbranded linen overshirt on a plain hanger",
    heroAlt: "Editorial lookbook cover featuring an unbranded linen overshirt in warm light",
    subject: "linen overshirt",
    referenceNoun: "garment reference",
    detailNoun: "garment shape, fabric, and styling",
    faqOutcome: "It can create a cover direction for product lookbooks, seasonal collections, and editorial catalogs.",
    proof: [["The cover has a clear mood", "Use light, color, and setting to introduce the collection before the pages begin."], ["The garment stays recognizable", "Keep the main product visible instead of treating it as decoration."], ["There is room for the real title", "Add your own collection name, date, and brand details later."], ["The inside pages can follow", "Build a visual language that can carry through the rest of the lookbook."]],
    formats: [["Collection covers", "Set a visual direction for a new product range."], ["Seasonal catalogs", "Give a seasonal edit a strong opening image."], ["Wholesale decks", "Create an editorial cover before adding business details."], ["Campaign mood boards", "Explore styling and atmosphere at the start of a project."]],
    checklist: ["Leave space for the real title and brand details.", "Check that the garment shape and material are accurate.", "Remove invented logos, publication marks, or dates.", "View the cover beside the first inside page before exporting it."],
    heroSize: [1200, 1600],
    exampleSize: [1200, 1600],
    imageNote: "garment → editorial cover",
    examples: [["Full outfit", "Full outfit with the linen overshirt"], ["Fabric close-up", "Close view of linen fabric texture"], ["In motion", "Person wearing the overshirt in motion"], ["Studio spread", "Studio fashion image with generous space"], ["Outdoor page", "Outdoor lookbook image in soft afternoon light"], ["Collar detail", "Detail of the overshirt collar and buttons"]]
  }),
  commonSpec({
    slug: "on-model-generation",
    label: "On-Model Generation",
    variant: "on-model-generation-detail",
    title: "AI On-Model Product Image Generator | Aidreamcapes",
    description: "Show a product on a person using a reference image, with clear attention to fit, color, pose, and the details shoppers need to see.",
    keywords: "AI on-model product image generator, product on model photos, apparel product photography, ecommerce model images",
    h1: "Show the product in use without hiding what matters.",
    heroBody: "Place a product in a believable use scene so shoppers can understand how it looks on a person, while keeping the item and its important details visible.",
    sourceAlt: "Unbranded canvas backpack product reference on a neutral surface",
    heroAlt: "Person wearing an unbranded canvas backpack on a city walk",
    subject: "canvas backpack",
    referenceNoun: "product photo",
    detailNoun: "product shape, color, and worn position",
    faqOutcome: "It can show a product being worn or used by a person in a natural setting.",
    proof: [["The product remains easy to find", "Keep the item visible when the person and scene add context."], ["The pose feels believable", "Use a simple action that helps explain the product instead of distracting from it."], ["Color and shape stay clear", "Compare the worn result with the original product reference."], ["Fit is shown, not promised", "Treat the image as a visual preview and check real measurements separately."]],
    formats: [["Apparel listings", "Show clothing or accessories in use after the main product view."], ["Store campaigns", "Build a lifestyle direction around a product collection."], ["Product pages", "Help shoppers imagine the item in an everyday scene."], ["Internal planning", "Explore a model direction before arranging photography."]],
    checklist: ["Check the product shape, color, and visible features.", "Review hands, straps, edges, and contact points.", "Do not treat the image as proof of exact fit or performance.", "Confirm that the person and product references are authorized."],
    imageNote: "product → worn view",
    examples: [["Front view", "Front view of the backpack worn by a person"], ["Side view", "Side view showing the shoulder straps"], ["Back view", "Back view showing the full backpack shape"], ["Pocket detail", "Close view of the backpack pocket"], ["Desk use", "Person using the backpack at a desk"], ["Outdoor walk", "Outdoor walking image with the backpack"], ["Handle detail", "Detail of the backpack handle"]]
  }),
  commonSpec({
    slug: "virtual-try-on",
    label: "Virtual Try-On",
    variant: "virtual-try-on-detail",
    title: "AI Virtual Try-On Image Generator | Aidreamcapes",
    description: "Preview clothing or accessories on a person using approved reference images, then review the result for fit, hands, edges, and unexpected changes.",
    keywords: "AI virtual try-on image generator, virtual clothing try on, apparel try-on photos, accessory try-on image",
    h1: "See how a new look could come together.",
    heroBody: "Preview a clothing or accessory idea on a person before you decide what to photograph, order, style, or share.",
    sourceAlt: "Plain blue jacket reference on a neutral hanger",
    heroAlt: "Person wearing a plain blue jacket in a softly lit fitting room",
    subject: "plain blue jacket",
    referenceNoun: "clothing reference",
    detailNoun: "garment shape, color, and fit",
    faqOutcome: "It can create a visual preview of clothing or accessories on an approved person reference.",
    proof: [["The look is easy to compare", "Use a fitting-room style preview so the change is easy to see."], ["The garment stays the focus", "Keep the clothing visible from a useful view."], ["The person remains recognizable", "Use approved references and review the face, hands, and body carefully."], ["It is a preview, not a fitting promise", "Use real measurements and an actual fitting process for final decisions."]],
    formats: [["Style planning", "Compare possible clothing directions before a shoot."], ["Product pages", "Explore a worn view for a clothing or accessory listing."], ["Personal shopping", "Visualize an outfit idea before choosing it."], ["Campaign drafts", "Try a new styling direction with an approved person reference."]],
    checklist: ["Check the clothing shape and color against the source.", "Review hands, seams, sleeves, collars, and edges.", "Do not claim that the image proves real fit or comfort.", "Get permission from the person shown before sharing the result."],
    imageNote: "garment → try-on preview",
    examples: [["Front view", "Front view of the blue jacket on a person"], ["Side view", "Side view showing the jacket length"], ["Sleeve detail", "Blue jacket sleeve and cuff detail on a person"], ["Collar detail", "Zipper and collar detail"], ["Walking view", "Person walking in the jacket"], ["Seated view", "Seated view of the jacket fit"], ["Fabric close-up", "Close fabric view of the blue jacket"]]
  }),
  commonSpec({
    slug: "hair-makeup-preview",
    label: "Hair / Makeup Preview",
    variant: "hair-makeup-preview-detail",
    title: "AI Hair and Makeup Preview Generator | Aidreamcapes",
    description: "Explore hair and makeup ideas on a portrait you can use, with side-by-side looks that make it easier to compare a new style before choosing.",
    keywords: "AI hair and makeup preview generator, hairstyle preview, makeup look preview, virtual beauty try-on",
    h1: "Try a new hair or makeup look before you decide.",
    heroBody: "Explore a few possible looks on an approved portrait so you can compare the mood, shape, and color before making a real appointment or styling choice.",
    sourceAlt: "Adult portrait reference with a neutral expression and plain background",
    heroAlt: "Adult portrait showing a natural hair and makeup preview in soft studio light",
    subject: "adult portrait",
    referenceNoun: "portrait",
    detailNoun: "facial features, hair, and makeup placement",
    faqOutcome: "It can show different hairstyle and makeup directions on the same approved portrait.",
    proof: [["The face stays recognizable", "Keep the person easy to recognize while exploring a new look."], ["The change is easy to compare", "Place styles side by side so the difference is clear."], ["The look stays believable", "Use natural hair, skin, light, and makeup detail instead of costume-like changes."], ["The final decision stays personal", "Use the preview as an idea, not as a promise of a real salon result."]],
    formats: [["Salon planning", "Bring a few visual directions to a real consultation."], ["Beauty content", "Explore a look for a creator post or editorial idea."], ["Profile refresh", "Try a polished change before updating a portrait."], ["Style boards", "Compare several moods in one private planning set."]],
    checklist: ["Check that the face, skin tone, and identity remain accurate.", "Review hair edges, eyes, teeth, and makeup placement.", "Do not treat the image as a guarantee of a real-world result.", "Use a portrait you own or have permission to use."],
    imageNote: "portrait → style preview",
    examples: [["Short hair", "Short hairstyle preview on the same adult"], ["Long hair", "Long hairstyle preview on the same adult"], ["Warm makeup", "Warm makeup look on the same adult"], ["Natural makeup", "Natural makeup look on the same adult"], ["Side profile", "Side profile with a new hairstyle"], ["Tied-back style", "Tied-back hairstyle preview"], ["Evening look", "Evening makeup preview"], ["Simple styling", "Clean portrait with simple natural styling"]]
  }),
  commonSpec({
    slug: "jewelry-positioning",
    label: "Jewelry Positioning",
    variant: "jewelry-positioning-detail",
    title: "AI Jewelry Try-On Image Generator | Aidreamcapes",
    description: "Preview how jewelry may look when worn, with close views that keep the piece visible and make placement easier to compare.",
    keywords: "AI jewelry try-on image generator, jewelry positioning, jewelry product photography, jewelry worn image",
    h1: "See where a piece of jewelry belongs before you publish.",
    heroBody: "Create clear worn views for necklaces, earrings, bracelets, and rings, keeping the piece visible without promising an exact fit or final appearance.",
    sourceAlt: "Simple silver necklace and an approved portrait reference",
    heroAlt: "Close portrait showing a simple silver necklace worn at the collarbone",
    subject: "simple silver jewelry",
    referenceNoun: "jewelry and portrait reference",
    detailNoun: "jewelry placement, scale, and finish",
    faqOutcome: "It can show where a jewelry piece may sit on a person in a close, easy-to-compare view.",
    proof: [["The piece stays visible", "Give the jewelry enough space to see its shape, finish, and position."], ["The view matches the piece", "Use a neckline, ear, wrist, or hand view that fits the jewelry type."], ["Scale remains a visual guide", "Use real measurements when exact size matters."], ["Skin and hands get reviewed", "Check contact points, fingers, hair, and small edges before sharing."]],
    formats: [["Jewelry listings", "Show a worn view after the clean product image."], ["Collection pages", "Help shoppers imagine how several pieces can be worn."], ["Gift planning", "Explore a piece on an approved person reference."], ["Campaign drafts", "Test a styling direction before a photo shoot."]],
    checklist: ["Compare the jewelry shape and finish with the original.", "Check placement, scale, skin, hair, and hands closely.", "Do not claim an exact fit from a generated preview.", "Use a person reference and jewelry image you are allowed to use."],
    imageNote: "jewelry → worn detail",
    examples: [["Necklace", "Silver necklace on a dark top"], ["Earring", "Simple hoop earring shown on an approved portrait"], ["Bracelet", "Bracelet shown on a wrist close-up"], ["Ring", "Ring shown on a hand close-up"], ["Pendant", "Pendant detail at the neckline"], ["Three-quarter view", "Three-quarter view of jewelry placement"], ["Side neckline", "Side neckline view with the necklace visible"]]
  }),
  commonSpec({
    slug: "ghost-mannequin",
    label: "Ghost Mannequin",
    variant: "ghost-mannequin-detail",
    title: "AI Ghost Mannequin Image Generator | Aidreamcapes",
    description: "Create clean apparel product images that show the garment’s shape without a visible model, while keeping the collar, seams, and structure easy to inspect.",
    keywords: "AI ghost mannequin image generator, invisible mannequin clothing photo, apparel product image, garment flat product photo",
    h1: "Show the garment’s shape without a visible model.",
    heroBody: "Create a clean garment view that gives shoppers a better sense of shape, structure, and construction without putting a person between them and the product.",
    sourceAlt: "Cream knit sweater product reference laid flat",
    heroAlt: "Clean apparel image of a cream knit sweater with no visible model",
    subject: "cream knit sweater",
    referenceNoun: "garment photo",
    detailNoun: "garment shape, seams, and construction",
    faqOutcome: "It can create clean apparel views that show the garment without a visible person wearing it.",
    proof: [["The garment is the subject", "Remove visual distractions so shoppers can focus on the clothing itself."], ["Shape remains readable", "Keep shoulders, sleeves, collar, and hem in a natural position."], ["Construction is visible", "Give seams, cuffs, and fabric enough space to inspect."], ["The image stays simple", "Use a clean background that supports the product page."]],
    formats: [["Apparel listings", "Add a clean garment view to a product image set."], ["Catalogs", "Keep clothing images consistent across a collection."], ["Wholesale sheets", "Show structure without a lifestyle scene."], ["Product detail pages", "Answer shape questions with a direct view."]],
    checklist: ["Compare the garment silhouette with the original.", "Check collar, seams, sleeves, hem, and fabric direction.", "Remove any visible body parts or invented garment sections.", "Review the final crop against the product page layout."],
    imageNote: "garment → clean product view",
    examples: [["Front view", "Front view of the cream knit sweater"], ["Back view", "Back view of the sweater"], ["Neckline detail", "Collar and neckline detail"], ["Sleeve detail", "Cream knit sweater sleeve and cuff detail without a visible model"], ["Hem detail", "Hem and side seam detail"], ["Folded view", "Folded sweater product image"]]
  }),
  commonSpec({
    slug: "colorway-variations",
    label: "Colorway Variations",
    variant: "colorway-variations-detail",
    title: "AI Product Color Variation Generator | Aidreamcapes",
    description: "Create clear color options for one product so shoppers can compare finishes and choose the version that fits your collection.",
    keywords: "AI product color variation generator, product color options, colorway product images, ecommerce color variants",
    h1: "Let shoppers compare product colors side by side.",
    heroBody: "Explore a clean set of color directions for one product, keeping the shape and finish consistent so the color is the part that changes.",
    sourceAlt: "Unbranded canvas sneaker in a single base color",
    heroAlt: "Four unbranded canvas sneakers shown together in distinct color options",
    subject: "canvas sneaker color options",
    referenceNoun: "product photo",
    detailNoun: "product shape, finish, and color",
    faqOutcome: "It can show possible color options for one product in a clear side-by-side arrangement.",
    proof: [["The shape stays the same", "Keep the product easy to recognize as the color changes."], ["Colors are easy to compare", "Place options together with enough separation to see each finish."], ["The collection feels organized", "Use a repeatable shelf or swatch view across related products."], ["The final color stays factual", "Compare the result with the real material or approved color reference."]],
    formats: [["Variant selectors", "Add clear supporting images beside a color choice."], ["Collection pages", "Show a family of finishes together."], ["Product launches", "Explore possible colors before a full shoot."], ["Catalogs", "Create a visual color reference for a product range."]],
    checklist: ["Compare every color with a real approved reference.", "Check that shape, sole, seams, and materials stay consistent.", "Do not call a color available until it is actually offered.", "Review the colors on the screens where shoppers will see them."],
    imageNote: "one product → color shelf",
    examples: [["White option", "White canvas sneaker color option"], ["Navy option", "Navy canvas sneaker color option"], ["Sage option", "Sage canvas sneaker color option"], ["Rust option", "Rust canvas sneaker color option"], ["Color lineup", "Side-by-side color lineup"], ["Sole detail", "Sole detail across the color options"], ["Canvas texture", "Close view of the canvas texture"]]
  }),
  commonSpec({
    slug: "background-remove-replace",
    label: "Background Remove / Replace",
    variant: "background-remove-replace-detail",
    title: "AI Background Remover and Replacer | Aidreamcapes",
    description: "Remove a distracting background or place a product in a cleaner setting while keeping its edges and important details easy to check.",
    keywords: "AI background remover, background replacement tool, product background editor, remove background from product photo",
    h1: "Put your product in a cleaner setting.",
    heroBody: "Separate a product from a busy photo or try a new setting, while keeping the edges, shadows, colors, and details honest enough to review.",
    sourceAlt: "Unbranded ceramic vase on a cluttered home background",
    heroAlt: "Ceramic vase isolated against a clean warm studio background",
    heroOutputSize: [2048, 3072],
    subject: "ceramic vase",
    referenceNoun: "product photo",
    detailNoun: "product edges, shape, and shadow",
    faqOutcome: "It can remove a distracting setting or place the same subject in a cleaner background.",
    proof: [["Edges stay easy to inspect", "Look around handles, hair, thin parts, and reflective surfaces."], ["The product remains the same", "Change the setting without adding features or changing the item."], ["The shadow has a reason", "Use a grounded shadow only when it helps the product feel placed."], ["The new setting supports the job", "Choose a background that matches the page or campaign."]],
    formats: [["Product listings", "Create a cleaner supporting image for a product page."], ["Store banners", "Place the product in a setting that fits the collection."], ["Campaign drafts", "Test a new scene without arranging a full shoot."], ["Catalogs", "Keep the product treatment consistent across a range."]],
    checklist: ["Check the full edge of the product at a close view.", "Compare colors, reflections, and proportions with the source.", "Remove extra props that were not part of the request.", "Make sure the new background does not imply a false setting or claim."],
    imageNote: "busy photo → clean setting",
    examples: [["Original setting", "Original vase photo with the room background"], ["Plain background", "Vase isolated on a plain light background"], ["Warm room", "Vase in a warm living room setting"], ["Dark background", "Vase on a dark editorial background"], ["Outdoor setting", "Vase outdoors on a stone surface"], ["Edge detail", "Clean edge detail around the vase"], ["Square crop", "Square product crop with a soft shadow"]]
  }),
  commonSpec({
    slug: "enhance-upscale",
    label: "Enhance / Upscale",
    variant: "enhance-upscale-detail",
    title: "AI Image Enhancer and Upscaler | Aidreamcapes",
    description: "Improve a small or soft product image for clearer viewing, then check fine details before using it on a store page or campaign.",
    keywords: "AI image enhancer, image upscaler, product photo enhancer, improve small product image",
    h1: "Make a soft image easier to view.",
    heroBody: "Give a small or soft product photo a clearer starting point, then compare the result closely before using it in a customer-facing place.",
    sourceAlt: "Small soft product photo of an unbranded fabric wallet",
    heroAlt: "Clear product view of a fabric wallet with improved visible texture",
    subject: "fabric wallet",
    referenceNoun: "small product photo",
    detailNoun: "texture, stitching, and edges",
    faqOutcome: "It can make a small or soft image easier to view, especially when the original subject is already clear.",
    proof: [["The subject stays familiar", "Improve the view without turning it into a different product."], ["Fine details get checked", "Look closely at stitching, edges, texture, and small hardware."], ["The image has a practical use", "Prepare a clearer file for a page, draft, or internal review."], ["No detail is invented silently", "Reject changes that add features or markings not present in the original."]],
    formats: [["Store pages", "Use a clearer image when the source is too soft to inspect."], ["Catalog drafts", "Improve an older product photo before layout work."], ["Internal review", "Make a detail easier for a teammate to check."], ["Campaign planning", "Start a visual direction from an existing image."]],
    checklist: ["Compare the result with the original at the same size.", "Check texture, stitching, labels, and edges for made-up detail.", "Do not use the result as proof of a product fact it cannot show.", "Keep the original file available for comparison."],
    imageNote: "small photo → clearer view",
    examples: [["Original small image", "Original small wallet image"], ["Clear front view", "Clear front view of the wallet"], ["Stitching detail", "Close stitching detail"], ["Zipper detail", "Zipper detail of the wallet"], ["Fabric corner", "Wallet corner and fabric texture"], ["Hand-held view", "Hand-held clearer product view"]]
  }),
  commonSpec({
    slug: "old-photo-restore",
    label: "Old Photo Restore",
    variant: "old-photo-restore-detail",
    title: "AI Old Photo Restoration Tool | Aidreamcapes",
    description: "Restore a worn family or archival photo with clearer faces, balanced color, and careful detail while keeping the original memory recognizable.",
    keywords: "AI old photo restoration tool, restore old family photos, vintage photo repair, photo color restoration",
    h1: "Bring an old photo back into clearer focus.",
    heroBody: "Give a worn photograph a cleaner view while respecting the faces, clothing, mood, and small imperfections that make the original memory yours.",
    sourceAlt: "Worn black-and-white family photo with no readable writing",
    heroAlt: "Restored family portrait with clearer faces and balanced natural tones",
    subject: "old family photograph",
    referenceNoun: "old photo",
    detailNoun: "faces, clothing, and original composition",
    faqOutcome: "It can help clean up wear, improve visibility, and explore a natural color version of an old photograph.",
    proof: [["Faces remain the focus", "Keep the people recognizable instead of changing the photograph into a new scene."], ["The memory stays intact", "Respect the original framing, clothing, and relationships in the picture."], ["Damage is handled gently", "Reduce distracting marks without erasing useful character."], ["Color remains a choice", "Treat color as a careful interpretation, not a verified record of the past."]],
    formats: [["Family archives", "Create a clearer private copy of a meaningful photograph."], ["Memory books", "Prepare an image for a printed or digital family collection."], ["Historical projects", "Make an old reference easier to inspect while keeping the source."], ["Personal gifts", "Share a restored image only when the people and rights are clear."]],
    checklist: ["Keep the original scan or photograph unchanged and saved.", "Check faces, hands, clothing, and background for unwanted changes.", "Do not treat guessed colors or details as historical facts.", "Ask for permission before publishing a photo of other people."],
    imageNote: "old photo → clearer memory",
    examples: [["Face detail", "Restored face detail from the family photo"], ["Clothing detail", "Restored clothing and hair detail"], ["Background detail", "Restored background and edge detail"], ["Group view", "Restored group portrait view"], ["Natural color", "Natural color version of the old photo"], ["Print crop", "Clean restored print crop"]]
  }),
  commonSpec({
    slug: "commercial-lighting",
    label: "Commercial Lighting",
    variant: "commercial-lighting-detail",
    title: "AI Product Lighting Image Generator | Aidreamcapes",
    description: "Create product images with brighter, softer, or more dramatic lighting while keeping the item’s shape, color, and surface easy to judge.",
    keywords: "AI product lighting image generator, commercial product lighting, studio lighting product photo, product lighting editor",
    h1: "Find the light that helps your product look its best.",
    heroBody: "Explore different lighting moods for one product and choose the direction that makes its shape, material, and finish easiest to understand.",
    sourceAlt: "Unbranded glass perfume bottle without a label",
    heroAlt: "Glass perfume bottle lit with a clean soft studio look",
    subject: "unbranded glass perfume bottle",
    referenceNoun: "product photo",
    detailNoun: "shape, color, reflection, and surface",
    faqOutcome: "It can help you compare softer, brighter, warmer, cooler, or more dramatic product lighting.",
    proof: [["The product remains easy to judge", "Use light to reveal the item instead of hiding its shape in style."], ["Reflections stay intentional", "Check glass, metal, and glossy surfaces for odd highlights."], ["Mood changes without new features", "Adjust the atmosphere without changing the product itself."], ["The set feels consistent", "Use one lighting direction across a product collection when needed."]],
    formats: [["Product listings", "Choose a clear lighting direction for the main image set."], ["Campaigns", "Explore a warmer or more dramatic mood for a launch."], ["Catalogs", "Keep a product range visually connected."], ["Creative reviews", "Compare lighting ideas before a studio shoot."]],
    checklist: ["Compare product color and surface with the reference.", "Check reflections, highlights, and shadows on every edge.", "Do not use dramatic lighting to hide an inaccurate detail.", "Choose lighting that matches the place where the image will be used."],
    imageNote: "product → lighting board",
    examples: [["Soft light", "Soft light on the glass perfume bottle"], ["Bright light", "Bright light showing the bottle shape"], ["Dramatic edge", "Dramatic edge light on the bottle"], ["Warm light", "Warm light on a neutral studio surface"], ["Cool light", "Cool light with a clean blue-gray background"], ["Side silhouette", "Side silhouette of the perfume bottle"], ["Reflective surface", "Reflective surface detail"]]
  }),
  commonSpec({
    slug: "packaging-mockup",
    label: "Packaging Mockup",
    variant: "packaging-mockup-detail",
    title: "AI Packaging Mockup Generator | Aidreamcapes",
    description: "Show packaging in a realistic setting before production with clear views of the box, pouch, label area, and overall presentation.",
    keywords: "AI packaging mockup generator, product packaging mockup, box mockup image, pouch packaging preview",
    h1: "See how the package could look in the real world.",
    heroBody: "Place a packaging idea on a shelf, counter, or in a hand so you can review the shape and presentation before committing to production.",
    sourceAlt: "Unbranded tea box and pouch packaging references",
    heroAlt: "Unbranded tea packaging arranged on a realistic kitchen shelf",
    subject: "tea box and pouch packaging",
    referenceNoun: "packaging reference",
    detailNoun: "package shape, material, and label area",
    faqOutcome: "It can show a box, pouch, or package idea in a realistic setting before production.",
    proof: [["The package is easy to recognize", "Show the box, pouch, or container clearly before adding the setting."], ["The material feels believable", "Use folds, edges, shadows, and contact that fit the package type."], ["Your label stays accurate", "Add approved artwork later instead of trusting generated lettering."], ["The setting answers a question", "Use a shelf, counter, or hand only when it helps explain the presentation."]],
    formats: [["Packaging reviews", "See how a new package may sit in a real environment."], ["Product launches", "Explore shelf presence before production is complete."], ["Retail presentations", "Show a package direction to a buyer or teammate."], ["Brand planning", "Compare settings while keeping the final artwork under control."]],
    checklist: ["Compare the package shape and opening with the source.", "Add final labels, names, and claims using approved artwork.", "Check folds, edges, shadows, and hand contact points.", "Do not present a concept image as proof of a manufactured package."],
    imageNote: "flat reference → real setting",
    examples: [["Box front", "Front view of the tea box"], ["Pouch beside box", "Tea pouch standing beside the box"], ["Counter set", "Stacked packaging set on a counter"], ["Hand-held pouch", "Hand holding the tea pouch"], ["Shelf view", "Tea packaging on a kitchen shelf"], ["Open arrangement", "Open packaging arrangement without readable text"], ["Material detail", "Close view of the package material"]]
  }),
  commonSpec({
    slug: "professional-headshot",
    label: "Professional Headshot",
    variant: "professional-headshot-detail",
    title: "AI Professional Headshot Generator | Aidreamcapes",
    description: "Create a polished professional headshot from an approved portrait for profiles, team pages, bios, and career materials.",
    keywords: "AI professional headshot generator, business profile photo, professional portrait, LinkedIn headshot",
    h1: "Put your best professional face forward.",
    heroBody: "Create a polished portrait for a profile, bio, team page, or career document while keeping the person recognizable and the setting believable.",
    sourceAlt: "Adult professional portrait reference on a plain background",
    heroAlt: "Polished professional headshot of an adult against a clean neutral background",
    subject: "professional portrait",
    referenceNoun: "portrait",
    detailNoun: "face, hair, expression, and clothing",
    faqOutcome: "It can create polished headshot directions for profiles, bios, team pages, and career materials.",
    proof: [["The person remains recognizable", "Keep the face, hair, expression, and defining features close to the approved portrait."], ["The background supports the role", "Use a simple setting that feels appropriate without inventing an employer or credential."], ["The crop works small", "Make sure the expression and face remain easy to see in a profile card."], ["The portrait still feels human", "Use natural posture and light instead of an over-polished stock-photo look."]],
    formats: [["Professional profiles", "Create a clear image for a public work profile."], ["Team pages", "Build a portrait that works beside other team members."], ["Speaker bios", "Use a polished but recognizable portrait for an introduction."], ["Career materials", "Prepare a professional image for a resume or application draft."]],
    checklist: ["Compare the face, hair, eyes, and expression with the source.", "Remove invented badges, uniforms, offices, or credentials.", "Check the image at the small size used by the destination.", "Get the subject’s approval before publishing the portrait."],
    imageNote: "portrait → professional profile",
    examples: [["Blazer portrait", "Professional headshot in a dark blazer"], ["Casual portrait", "Professional headshot in a casual shirt"], ["Office background", "Headshot with a warm office background"], ["Outdoor background", "Headshot with an outdoor neutral background"], ["Three-quarter view", "Three-quarter professional portrait"], ["Square crop", "Square profile crop of the headshot"]]
  }),
  commonSpec({
    slug: "creator-portrait",
    label: "Creator Portrait",
    variant: "creator-portrait-detail",
    title: "AI Creator Portrait Generator | Aidreamcapes",
    description: "Build expressive creator portraits for profile pages, thumbnails, and personal brands while keeping the person recognizable and the setting intentional.",
    keywords: "AI creator portrait generator, creator profile photo, personal brand portrait, social thumbnail portrait",
    h1: "Create portraits that feel like your work.",
    heroBody: "Build a set of creator portraits that carries your point of view across profiles, thumbnails, workspaces, and social posts.",
    sourceAlt: "Adult creator portrait reference in a simple studio",
    heroAlt: "Creator portrait of an adult at a colorful desk with room for profile copy",
    subject: "creator portrait",
    referenceNoun: "portrait",
    detailNoun: "face, expression, and recognizable style",
    faqOutcome: "It can create expressive portraits for creator profiles, thumbnails, personal brands, and content pages.",
    proof: [["The person stays recognizable", "Keep the face and expression close enough that the portrait still feels like its subject."], ["The setting says something useful", "Use a desk, studio, or outdoor scene that fits the person’s work."], ["The crop can travel", "Create views that work for a profile, thumbnail, and wider introduction."], ["The style feels owned", "Choose color and light with intention instead of copying a generic creator look."]],
    formats: [["Creator profiles", "Create a visual identity for a public profile."], ["Video thumbnails", "Make a face-led crop that reads at a small size."], ["About pages", "Show the person behind a project with useful context."], ["Social posts", "Build varied portraits that still belong to the same creator."]],
    checklist: ["Compare the face and defining features with the source.", "Check that props do not invent an affiliation or achievement.", "Review the crop at thumbnail size.", "Use an approved portrait and approve the final image before sharing it."],
    imageNote: "portrait → creator media wall",
    examples: [["Studio portrait", "Creator portrait in a studio"], ["Outdoor portrait", "Creator portrait outdoors"], ["Working at desk", "Creator working at a desk"], ["Close expression", "Close creator portrait with a natural expression"], ["Side portrait", "Side portrait with colorful background light"], ["Thumbnail crop", "Thumbnail-ready creator crop"], ["Workspace view", "Creator portrait with visible hands and workspace"]]
  }),
  commonSpec({
    slug: "team-directory",
    label: "Team Directory",
    variant: "team-directory-detail",
    title: "AI Team Directory Photo Generator | Aidreamcapes",
    description: "Create a consistent set of team portraits with matching framing and background so people are easy to recognize across a company directory.",
    keywords: "AI team directory photo generator, employee profile photos, company team headshots, consistent team portraits",
    h1: "Give every team member a consistent, recognizable photo.",
    heroBody: "Create a calm, connected portrait set for a team directory while keeping each person’s identity, expression, and approval at the center.",
    sourceAlt: "Four fictional team members shown in separate portrait references",
    heroAlt: "Consistent team directory preview with four recognizable portraits in one layout",
    subject: "fictional team portraits",
    referenceNoun: "approved portrait",
    detailNoun: "face, expression, and consistent framing",
    faqOutcome: "It can help create a visually consistent set of team portraits for a company directory or people page.",
    proof: [["Everyone remains recognizable", "Keep each person’s features and expression close to their approved portrait."], ["The set feels connected", "Use matching crop, light, background, and head size across the group."], ["Each person gets equal space", "Build a directory that feels clear and respectful instead of ranking people visually."], ["Approval stays important", "Let each person review the image before it appears publicly."]],
    formats: [["Team directories", "Create a connected portrait wall for an internal or public page."], ["About pages", "Show the people behind a company or project."], ["Event materials", "Use a consistent team set in a simple introduction layout."], ["Internal tools", "Make names and faces easier to connect in a workspace."]],
    checklist: ["Use an approved reference for every person.", "Check identity details, hair, glasses, clothing, and crop.", "Keep the framing fair and consistent across the group.", "Get individual approval before publishing team portraits."],
    imageNote: "portraits → people directory",
    examples: [["Team member one", "Team member portrait one in a neutral background"], ["Team member two", "Team member portrait two in a neutral background"], ["Team member three", "Team member portrait three in a neutral background"], ["Team member four", "Team member portrait four in a neutral background"], ["Team grid", "Four-person team grid preview"], ["Square crop", "Square crop for a team directory"], ["Alternate background", "Alternate background treatment for the team"], ["Framing detail", "Close portrait showing consistent framing"]]
  }),
  commonSpec({
    slug: "social-profile-photo",
    label: "Social / Dating Profile",
    variant: "social-profile-photo-detail",
    title: "AI Social Profile Photo Generator | Aidreamcapes",
    description: "Create natural profile photos for social and dating apps from photos you can use, with varied settings that still look like the same person.",
    keywords: "AI social profile photo generator, dating profile photos, social app profile picture, natural profile portrait",
    h1: "Create profile photos that still feel like you.",
    heroBody: "Create a small set of natural profile directions with different places and moods, while keeping the person recognizable and the images honest.",
    sourceAlt: "Adult social profile portrait reference in natural daylight",
    heroAlt: "Natural social profile portrait of an adult outdoors with a relaxed expression",
    subject: "social profile portrait",
    referenceNoun: "portrait",
    detailNoun: "face, expression, and recognizable appearance",
    faqOutcome: "It can create natural profile photo directions for social and dating apps using an approved portrait.",
    proof: [["The person still looks like the person", "Keep face shape, hair, skin tone, and expression believable across the set."], ["The scenes feel lived in", "Use cafes, parks, streets, and home settings instead of staged fantasy backgrounds."], ["The first crop reads clearly", "Make sure the face remains easy to see in a small profile circle or card."], ["Honesty comes first", "Do not use an image that gives a misleading impression of who or where you are."]],
    formats: [["Dating profiles", "Create a natural first image and a few supporting views."], ["Social profiles", "Refresh a profile while keeping the person recognizable."], ["Community pages", "Use a relaxed portrait that feels approachable."], ["Private planning", "Compare settings before choosing what to share publicly."]],
    checklist: ["Compare the face and defining features across every image.", "Remove invented locations, events, or relationship clues.", "Check the crop at the small size used by the app.", "Use images and people references with permission before sharing."],
    imageNote: "portrait → profile set",
    examples: [["Cafe photo", "Casual cafe profile photo"], ["Park photo", "Park profile photo in daylight"], ["Travel photo", "Travel profile photo near a city street"], ["Home photo", "Relaxed home profile photo"], ["Close smile", "Close smile portrait"], ["Outdoor full view", "Full-body outdoor profile photo"], ["Square profile crop", "Square profile crop of the same adult"]]
  }),
  commonSpec({
    slug: "fashion-editorial",
    label: "Fashion Editorial",
    variant: "fashion-editorial-detail",
    title: "AI Fashion Editorial Image Generator | Aidreamcapes",
    description: "Create fashion story images with strong styling, composition, and mood for lookbooks, campaigns, and editorial concepts.",
    keywords: "AI fashion editorial image generator, fashion story images, editorial fashion photography, clothing campaign images",
    h1: "Turn an outfit into a visual story.",
    heroBody: "Build a sequence around an outfit with movement, texture, and mood, while keeping the garment recognizable and the final story under your direction.",
    sourceAlt: "Unbranded tailored outfit on a plain hanger",
    heroAlt: "Fashion editorial image of an adult wearing a tailored neutral outfit in a sculptural space",
    subject: "tailored neutral outfit",
    referenceNoun: "garment reference",
    detailNoun: "garment shape, fabric, and styling",
    faqOutcome: "It can create a connected fashion story for lookbooks, campaigns, editorials, and collection concepts.",
    proof: [["The clothing remains the story", "Let the garment lead while the setting adds mood and movement."], ["The sequence has variety", "Use different views without losing the same styling direction."], ["Texture gets a moment", "Show fabric, structure, and accessories close enough to understand."], ["The mood is intentional", "Choose light, place, and movement to support the collection instead of competing with it."]],
    formats: [["Fashion campaigns", "Explore a visual story before production planning."], ["Lookbooks", "Build connected pages around one collection."], ["Editorial concepts", "Try a mood, setting, or movement direction."], ["Social launch sets", "Create varied frames that still belong to the same outfit story."]],
    checklist: ["Compare the garment silhouette, color, and material with the source.", "Check hands, accessories, seams, and clothing edges.", "Remove invented brands, publication names, and endorsements.", "Review the full sequence together before publishing it."],
    imageNote: "outfit → fashion story",
    examples: [["Full look", "Full fashion look in a studio"], ["Movement", "Outfit captured in motion"], ["Fabric texture", "Close view of fabric texture"], ["Accessory detail", "Accessory detail with no visible brand"], ["Street scene", "Street fashion editorial scene"], ["Outdoor portrait", "Outdoor editorial portrait"], ["Close portrait", "Close fashion portrait"], ["Magazine crop", "Magazine-ready fashion crop"]]
  })
];

export function aidreamcapesImageThemePages() {
  return [aidreamcapesEcommerceMainImageContent(), ...specs.map(makePage)];
}

export function validateAidreamcapesImageThemePages({ requireAssets = false } = {}) {
  const pages = aidreamcapesImageThemePages();
  if (pages.length !== 30) throw new Error(`Aidreamcapes image theme registry requires 30 pages, found ${pages.length}.`);
  const paths = new Set();
  const variants = new Set();
  const subjects = new Set();
  for (const page of pages) {
    if (paths.has(page.seo.canonicalPath)) throw new Error(`Duplicate image theme path: ${page.seo.canonicalPath}`);
    if (variants.has(page.layoutVariant)) throw new Error(`Duplicate image theme layout variant: ${page.layoutVariant}`);
    if (!page.subject || subjects.has(page.subject)) throw new Error(`Duplicate or missing image theme subject: ${page.seo.canonicalPath}`);
    paths.add(page.seo.canonicalPath);
    variants.add(page.layoutVariant);
    subjects.add(page.subject);
    if (page.faq.items.length !== 6) throw new Error(`${page.seo.canonicalPath} requires six FAQ items.`);
    if (page.examples.items.length < 6) throw new Error(`${page.seo.canonicalPath} requires at least six example images.`);
    if (!Array.isArray(page.internalLinks) || page.internalLinks.length < 3) throw new Error(`${page.seo.canonicalPath} requires at least three related links.`);
    for (const link of page.internalLinks) {
      if (!link.label || !link.href || !link.href.startsWith("/") || /collections|\/tools(?:\/|$)/i.test(link.href)) {
        throw new Error(`${page.seo.canonicalPath} has an invalid related link.`);
      }
    }
    if (requireAssets) {
      const images = [page.hero.productImage, page.hero.outputImage, ...page.examples.items.map((item) => item.image)];
      for (const item of images) if (!existsSync(`public${item.src}`)) throw new Error(`Missing image theme asset: ${item.src}`);
      if (!existsSync(`public${page.seo.ogImage}`)) throw new Error(`Missing image theme asset: ${page.seo.ogImage}`);
    }
  }
  return pages;
}
