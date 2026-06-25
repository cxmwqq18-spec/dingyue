import type { SectionInstance, SectionType, ThemePageJson, ThemeSettingValue } from "@/lib/types";
import type { ThemePackageSiteSettings, ThemePackageTemplateKey } from "../types";

function section(type: SectionType, settings: SectionInstance["settings"], blocks: SectionInstance["blocks"] = []): SectionInstance {
  return { type, settings, blocks };
}

function block(id: string, type: string, settings: Record<string, ThemeSettingValue>) {
  return { id, type, settings };
}

function page(pageType: string, sectionsOrder: string[], sections: ThemePageJson["sections"], version = 1): ThemePageJson {
  return {
    pageType,
    version,
    sectionsOrder,
    sections
  };
}

const weddingAssets = {
  santorini: "/assets/site-media/lumen/generated/scenes-20260609/santorini-destination-v1.png?v=20260609a",
  paris: "/assets/site-media/lumen/generated/scenes-20260609/paris-destination-v1.png?v=20260609a",
  bali: "/assets/site-media/lumen/generated/scenes-20260609/bali-destination-v1.png?v=20260609a",
  cappadocia: "/assets/site-media/lumen/generated/scenes-20260609/cappadocia-destination-v1.png?v=20260609a",
  marrakech: "/assets/site-media/lumen/generated/scenes-20260609/marrakech-destination-v1.png?v=20260609a",
  santoriniCard: "/assets/site-media/lumen/generated/scenes-20260609/santorini-wide-v1.png?v=20260609a",
  beachCard: "/assets/site-media/lumen/generated/scenes-20260609/bali-wide-v1.png?v=20260609a",
  desertCard: "/assets/site-media/lumen/generated/scenes-20260609/cappadocia-wide-v1.png?v=20260609a",
  romeCard: "/assets/site-media/lumen/generated/scenes-20260609/marrakech-wide-v1.png?v=20260609a",
  exampleSantorini: "/assets/site-media/lumen/generated/scenes-20260609/santorini-example-v1.png?v=20260609a",
  exampleParis: "/assets/site-media/lumen/generated/scenes-20260609/paris-example-v1.png?v=20260609a",
  exampleBali: "/assets/site-media/lumen/generated/scenes-20260609/bali-example-v1.png?v=20260609a",
  exampleCappadocia: "/assets/site-media/lumen/generated/scenes-20260609/cappadocia-example-v1.png?v=20260609a",
  exampleMarrakech: "/assets/site-media/lumen/generated/scenes-20260609/marrakech-example-v1.png?v=20260609a"
} as const;

const generatedAssets = {
  brandLogo: "/assets/site-media/lumen/brand/ai-wedding-rose-logo-mark-transparent.png?v=20260609a",
  hero: "/assets/site-media/lumen/generated/ai-wedding-hero-api-test-20260608.png?v=20260608a",
  pricingDesert: "/assets/site-media/lumen/generated/ai-wedding-pricing-desert-20260608.png?v=20260608a",
  santoriniVertical: "/assets/site-media/lumen/generated/crops-20260608/santorini-vertical.png?v=20260608a",
  santoriniCard: "/assets/site-media/lumen/generated/crops-20260608/santorini-card.png?v=20260608a",
  santoriniReview: "/assets/site-media/lumen/generated/crops-20260608/santorini-review.png?v=20260608a",
  desertVertical: "/assets/site-media/lumen/generated/crops-20260608/desert-vertical.png?v=20260608a",
  desertCard: "/assets/site-media/lumen/generated/crops-20260608/desert-card.png?v=20260608a",
  desertReview: "/assets/site-media/lumen/generated/crops-20260608/desert-review.png?v=20260608a",
  reviewSantoriniWide: "/assets/site-media/lumen/generated/crops-20260608/review-santorini-wide.png?v=20260608a",
  reviewSantoriniVertical: "/assets/site-media/lumen/generated/crops-20260608/review-santorini-vertical.png?v=20260608a",
  reviewDesertWide: "/assets/site-media/lumen/generated/crops-20260608/review-desert-wide-warm.png?v=20260608a",
  testimonialSophiaAvatar: "/assets/site-media/lumen/generated/testimonials-20260609-lifestyle/sophia-liam-lifestyle-avatar-v2.png?v=20260609c",
  testimonialSophiaResult: "/assets/site-media/lumen/generated/testimonials-20260608/sophia-liam-result-v4.png?v=20260609a",
  testimonialAishaAvatar: "/assets/site-media/lumen/generated/testimonials-20260609-lifestyle/aisha-omar-lifestyle-avatar-v2.png?v=20260609c",
  testimonialAishaResult: "/assets/site-media/lumen/generated/testimonials-20260608/aisha-omar-result-v4.png?v=20260609a",
  testimonialEmilyAvatar: "/assets/site-media/lumen/generated/testimonials-20260609-lifestyle/emily-james-lifestyle-avatar-v2.png?v=20260609c",
  testimonialEmilyResult: "/assets/site-media/lumen/generated/testimonials-20260608/emily-james-result-v4.png?v=20260609a",
  testimonialPriyaAvatar: "/assets/site-media/lumen/generated/testimonials-20260609-lifestyle/priya-arjun-lifestyle-avatar-v2.png?v=20260609c",
  testimonialPriyaResult: "/assets/site-media/lumen/generated/testimonials-20260608/priya-arjun-result-v4.png?v=20260609a"
} as const;

const homeSections: ThemePageJson["sections"] = {
  hero_1: section(
    "hero",
    {
      eyebrow: "AI-generated wedding photography",
      headline: "AI-Powered Wedding Photos in Any Destination",
      subheadline:
        "Create breathtaking, magazine-quality wedding photos anywhere in the world with AI. No travel. No stress. Just your love story, reimagined.",
      mediaAssetId: "media_lumen_generated_hero_20260608",
      imageUrl: generatedAssets.hero,
      heroVisualOverride: generatedAssets.hero,
      secondaryImageUrl: weddingAssets.paris,
      tertiaryImageUrl: weddingAssets.bali,
      bulletList:
        "Stunning global destinations|Photorealistic wedding scenes|Save time and travel costs|100% private and secure",
      highlightWord: "Wedding",
      heroBadge: "AI Wedding",
      authRibbon: "Now booking destination wedding stories",
      authPrimaryLabel: "Continue with Email",
      authEmailPlaceholder: "Enter your wedding email",
      authButtonLabel: "Get Started",
      socialProofLabel: "4.9/5 loved by 10,000+ couples",
      imageCaption: "Destination wedding scenes, private delivery, and editorial detail.",
      imageBadge: "40 photo album",
      detailCardEyebrow: "AI Wedding",
      detailCardTitle: "Destination wedding scenes, private delivery, and editorial detail.",
      detailCardBody: "Upload your photos, choose a destination, and receive a polished private album without booking a global shoot.",
      showStats: false,
      layout: "studio_commerce"
    },
    [
      block("hero_cta_primary", "cta", { label: "See Examples", href: "#examples", style: "primary" }),
      block("hero_cta_secondary", "cta", { label: "How It Works", href: "#workflow", style: "secondary" }),
      block("hero_metric_destinations", "stat", { value: "100+", label: "Dream Destinations" }),
      block("hero_metric_couples", "stat", { value: "10,000+", label: "Happy Couples" }),
      block("hero_metric_satisfaction", "stat", { value: "99%", label: "Satisfaction Rate" }),
      block("hero_metric_support", "stat", { value: "24/7", label: "AI Support" })
    ]
  ),
  metrics_1: section(
    "metric_strip",
    {
      anchor: "metrics",
      eyebrow: "",
      title: "",
      subtitle: "",
      tone: "light",
      showTopBorder: false,
      showBottomBorder: true
    },
    [
      block("metric_destinations", "stat", { value: "100+", label: "Dream Destinations" }),
      block("metric_couples", "stat", { value: "10,000+", label: "Happy Couples" }),
      block("metric_satisfaction", "stat", { value: "99%", label: "Satisfaction Rate" }),
      block("metric_support", "stat", { value: "24/7", label: "AI Support" })
    ]
  ),
  brand_strip_1: section(
    "brand_logo_strip",
    {
      anchor: "trusted",
      title: "Trusted by wedding studios, planners, and destination couples",
      style: "light"
    },
    [
      block("logo_weddingwire", "logo", { name: "WeddingWire", imageUrl: "", badge: "Trusted" }),
      block("logo_theknot", "logo", { name: "The Knot", imageUrl: "", badge: "Partner" }),
      block("logo_brides", "logo", { name: "Brides", imageUrl: "", badge: "Editorial" }),
      block("logo_zola", "logo", { name: "Zola", imageUrl: "", badge: "Vendor" }),
      block("logo_stylemepretty", "logo", { name: "Style Me Pretty", imageUrl: "", badge: "Feature" })
    ]
  ),
  pain_points_1: section(
    "sample_strip",
    {
      anchor: "pain-points",
      eyebrow: "Wedding photo problems",
      title: "Tired of These Wedding Photo Problems?",
      subtitle: "Turn the biggest wedding-photo objections into a clear before-AI narrative.",
      cardBadgeLabel: "Before AI",
      footerBody: "AI Wedding turns those planning limits into a private album workflow: choose a destination, upload your couple photos, and receive an editorial story without booking a global shoot.",
      footerCtaLabel: "See the AI solution",
      footerCtaHref: "#possibilities",
      speed: "still"
    },
    [
      block("pain_expensive", "sample", { label: "Too Expensive", imageUrl: generatedAssets.desertVertical, meta: "Destination weddings cost a fortune." }),
      block("pain_time", "sample", { label: "Time-Consuming", imageUrl: generatedAssets.reviewSantoriniVertical, meta: "Trips, visas, and schedules slow everything down." }),
      block("pain_weather", "sample", { label: "Weather Unpredictable", imageUrl: generatedAssets.desertCard, meta: "Rain, wind, and storms ruin the perfect shot." }),
      block("pain_choices", "sample", { label: "Limited Choices", imageUrl: generatedAssets.santoriniCard, meta: "You cannot travel everywhere you dream of." })
    ]
  ),
  luxury_highlight_1: section(
    "luxury_highlight",
    {
      anchor: "possibilities",
      eyebrow: "AI makes it possible",
      title: "AI Makes It Possible.",
      subtitle: "A destination wedding editorial look no longer depends on flights, production crews, or unpredictable weather.",
      leadImageUrl: generatedAssets.santoriniVertical,
      leadKicker: "editorial destination edit",
      leadTitle: "Turn ordinary couple photos into a private wedding gallery that feels planned by a luxury destination studio.",
      leadSideKicker: "private delivery",
      leadSideBody: "Pick a destination, lock the style, and receive ceremony-ready images through one secure client account.",
      ctaLabel: "See Styles",
      ctaHref: "#styles"
    },
    [
      block("luxury_point_1", "card", { meta: "01", title: "Any destination, any style", text: "From Paris to Bali, Sahara to Santorini." }),
      block("luxury_point_2", "card", { meta: "02", title: "Photorealistic wedding scenes", text: "Looks 100% real and editorial-ready." }),
      block("luxury_point_3", "card", { meta: "03", title: "Save time and money", text: "No travel, no production spend, just beautiful delivery." }),
      block("luxury_point_4", "card", { meta: "04", title: "Your story, your way", text: "Custom poses, styling, and background worlds." }),
      block("luxury_scene_1", "example", { title: "Santorini", description: "Cliffside vows", location: "Santorini, Greece", imageUrl: weddingAssets.exampleSantorini, href: "/collections" }),
      block("luxury_scene_2", "example", { title: "Marrakech", description: "Desert elegance", location: "Marrakech, Morocco", imageUrl: weddingAssets.exampleMarrakech, href: "/collections" }),
      block("luxury_scene_3", "example", { title: "Bali", description: "Tropical vows", location: "Bali, Indonesia", imageUrl: weddingAssets.exampleBali, href: "/collections" }),
      block("luxury_scene_4", "example", { title: "Cappadocia", description: "Sunrise balloon ceremony", location: "Cappadocia, Turkey", imageUrl: weddingAssets.exampleCappadocia, href: "/collections" })
    ]
  ),
  before_after_1: section(
    "before_after_gallery",
    {
      anchor: "proof",
      title: "Give couples proof before asking them to subscribe.",
      subtitle: "Compare ordinary source photos with a ceremony-ready editorial finish before choosing your collection."
    },
    [
      block("before_after_couple", "before_after", {
        beforeLabel: "Original engagement upload",
        afterLabel: "Ceremony editorial finish",
        beforeImage: weddingAssets.exampleCappadocia,
        afterImage: weddingAssets.santorini
      }),
      block("before_after_bride", "before_after", {
        beforeLabel: "Phone portrait",
        afterLabel: "Bridal detail series",
        beforeImage: weddingAssets.exampleMarrakech,
        afterImage: weddingAssets.paris
      })
    ]
  ),
  occasions_1: section(
    "occasion_showcase",
    {
      anchor: "moments",
      eyebrow: "Wedding moments",
      title: "Package the moments people actually shop for.",
      subtitle: "This gives the storefront the same merchandising clarity that a good wedding studio homepage has."
    },
    [
      block("occasion_engagement", "occasion", {
        title: "Engagement preview",
        description: "Save-the-date portraits, proposal announcements, and engagement landing page imagery.",
        tag: "Before the day",
        imageUrl: weddingAssets.exampleParis,
        href: "/collections/wedding"
      }),
      block("occasion_ceremony", "occasion", {
        title: "Ceremony album",
        description: "Editorial aisle shots, vow moments, and clean ceremony hero images.",
        tag: "Ceremony",
        imageUrl: weddingAssets.santorini,
        href: "/collections/wedding"
      }),
      block("occasion_reception", "occasion", {
        title: "Reception recap",
        description: "After-party edits, toasts, dance floor frames, and thank-you page visuals.",
        tag: "Reception",
        imageUrl: weddingAssets.marrakech,
        href: "/collections/wedding"
      })
    ]
  ),
  workflow_1: section(
    "studio_steps",
    {
      anchor: "workflow",
      eyebrow: "How it works",
      title: "How It Works",
      subtitle: "A four-step wedding flow customers can understand in under a minute.",
      imageUrl: weddingAssets.exampleCappadocia
    },
    [
      block("step_upload", "card", { title: "Upload Photos", text: "Upload 8-15 clear photos of you as a couple.", meta: "1", imageUrl: "" }),
      block("step_choose", "card", { title: "Choose Style", text: "Pick your dream destination and visual direction.", meta: "2", imageUrl: "" }),
      block("step_generate", "card", { title: "AI Generates", text: "Our AI creates stunning, realistic wedding imagery.", meta: "3", imageUrl: "" }),
      block("step_download", "card", { title: "Download & Enjoy", text: "Get your high-resolution photos in 3-5 days.", meta: "4", imageUrl: "" })
    ]
  ),
  destinations_1: section(
    "destination_showcase",
    {
      anchor: "styles",
      eyebrow: "Popular destinations",
      title: "Popular Destinations / Styles",
      subtitle: "Browse destination styles before you create your wedding story, then open a private album flow with the look already decided.",
      tabs: "All|Europe|Asia|Beach|Desert|City",
      defaultTab: "All"
    },
    [
      block("destination_santorini", "destination", { title: "Santorini", description: "Whitewashed cliffs and iconic blue domes at sunset.", tag: "Europe", tags: "Europe|Beach", location: "Santorini, Greece", imageUrl: weddingAssets.santorini, href: "/collections" }),
      block("destination_bali", "destination", { title: "Bali", description: "Lush jungle vows and tropical coastal portraits.", tag: "Beach", tags: "Asia|Beach", location: "Bali, Indonesia", imageUrl: weddingAssets.bali, href: "/collections" }),
      block("destination_paris", "destination", { title: "Paris", description: "Historic grandeur with cinematic terrace portraits.", tag: "City", tags: "Europe|City", location: "Paris, France", imageUrl: weddingAssets.paris, href: "/collections" }),
      block("destination_cappadocia", "destination", { title: "Cappadocia", description: "Balloon sunrise scenes and sculpted stone landscapes.", tag: "Desert", tags: "Asia|Desert", location: "Cappadocia, Turkey", imageUrl: weddingAssets.cappadocia, href: "/collections" }),
      block("destination_marrakech", "destination", { title: "Marrakech", description: "Warm arches, desert tones, and cinematic evening light.", tag: "Desert", tags: "Africa|Desert|City", location: "Marrakech, Morocco", imageUrl: weddingAssets.marrakech, href: "/collections" })
    ]
  ),
  examples_1: section(
    "example_gallery",
    {
      anchor: "examples",
      eyebrow: "Inspiring examples",
      title: "Inspiring Examples",
      subtitle: "Choose a visual direction from real-looking wedding worlds, then start a private album request."
    },
    [
      block("example_santorini", "example", { title: "Coastal Romance", description: "White and blue dreams in Santorini.", location: "Santorini, Greece", imageUrl: weddingAssets.exampleSantorini, href: "/collections" }),
      block("example_marrakech", "example", { title: "Exotic Elegance", description: "Rich textures and timeless Moorish architecture.", location: "Marrakech, Morocco", imageUrl: weddingAssets.exampleMarrakech, href: "/collections" }),
      block("example_cappadocia", "example", { title: "Adventure & Magic", description: "Balloon-filled skies and unforgettable moments.", location: "Cappadocia, Turkey", imageUrl: weddingAssets.exampleCappadocia, href: "/collections" }),
      block("example_paris", "example", { title: "City Chic", description: "Iconic cities, cinematic love stories.", location: "Paris, France", imageUrl: weddingAssets.exampleParis, href: "/collections" }),
      block("example_bali", "example", { title: "Tropical Paradise", description: "Lush jungles and serene tropical vows.", location: "Bali, Indonesia", imageUrl: weddingAssets.exampleBali, href: "/collections" })
    ]
  ),
  collections_1: section("photo_package_wall", {
    anchor: "collections",
    eyebrow: "Wedding collections",
    title: "Simple, Transparent Pricing",
    subtitle: "Browse wedding collections that stay connected to your live offers, credit rules, and private album delivery promise.",
    source: "creative_packs",
    layout: "editorial"
  }),
  pricing_1: section("pricing_table", {
    anchor: "plans",
    eyebrow: "Transparent pricing",
    title: "Choose your wedding story package.",
    subtitle: "Choose the perfect package for your love story. Pricing, credits, generated photos, destination count, and delivery time stay connected to your live offers.",
    backgroundImage: generatedAssets.pricingDesert,
    plansMetricLabel: "Wedding plans",
    plansMetricDetail: "Essential, Premium, Deluxe",
    deliveryMetricLabel: "Delivery",
    deliveryMetricDetail: "Album turnaround",
    creditsMetricLabel: "Credits",
    creditsMetricDetail: "Included every month",
    sidePanelEyebrow: "what changes by plan",
    sidePanelTitle: "Choose the delivery standard that matches the story you want to publish.",
    inclusionsEyebrow: "what every subscription includes",
    inclusionsTitle: "Live pricing, private delivery, and a wedding workflow customers can trust.",
    featuredProductId: "prod_lumen_premium",
    featuredBadgeLabel: "Most popular",
    standardBadgeLabel: "Wedding plan",
    planSubtitle: "Private destination wedding album",
    subscriptionBody: "A guided wedding album plan for couples or studios creating bridal, ceremony, and reception imagery.",
    bestForLabel: "Best for",
    bestForBody: "Couples and studios creating polished destination albums",
    deliveryCardLabel: "Delivery",
    deliveryCardBody: "High-resolution images delivered to your private gallery after payment confirmation.",
    checkoutLabel: "Start your journey",
    previewCheckoutLabel: "Preview checkout",
    emptyBody: "Wedding packages are not open yet. Please check back when the next collection release is available.",
    productType: "subscription",
    showCheckoutNote: true
  }, [
    block("plan_note_essential", "plan_note", {
      productId: "prod_lumen_essential",
      title: "Essential",
      description: "For couples testing one destination direction with a clear, private gallery delivery.",
      meta: "editorial fit"
    }),
    block("plan_note_premium", "plan_note", {
      productId: "prod_lumen_premium",
      title: "Premium",
      description: "For the full wedding story with more outputs, more destinations, and faster delivery.",
      meta: "editorial fit"
    }),
    block("plan_note_deluxe", "plan_note", {
      productId: "prod_lumen_deluxe",
      title: "Deluxe",
      description: "For planners and studios selling a complete ceremony, bridal, and reception narrative.",
      meta: "editorial fit"
    }),
    block("benefit_live_products", "benefit", {
      label: "Prices stay synced to your real checkout products",
      description: ""
    }),
    block("benefit_confirmed_billing", "benefit", {
      label: "Credits are granted after confirmed billing events",
      description: ""
    }),
    block("benefit_private_delivery", "benefit", {
      label: "Generated albums stay private to the customer account",
      description: ""
    })
  ]),
  conversion_1: section(
    "conversion_panel",
    {
      anchor: "book",
      eyebrow: "Start your album",
      title: "Start your private wedding story.",
      subtitle: "Create an account, choose a destination collection, upload your portraits, and receive the finished album in a private gallery.",
      primaryCta: "Create private account",
      primaryHref: "/login",
      secondaryCta: "See live pricing",
      secondaryHref: "/pricing"
    },
    [
      block("cta_stat_collections", "stat", { value: "3", label: "live wedding collections" }),
      block("cta_stat_private", "stat", { value: "Private", label: "couple galleries and uploads" }),
      block("cta_stat_ledger", "stat", { value: "Credits", label: "clear balances and delivery" })
    ]
  ),
  proof_1: section(
    "testimonial_wall",
    {
      anchor: "reviews",
      title: "Loved by Couples Worldwide",
      subtitle: "Real couples use AI Wedding to preview destination looks, build private albums, and receive polished ceremony-ready imagery without booking a global shoot.",
      summaryTitle: "Loved by Couples Worldwide",
      summaryBody: "Couples use AI Wedding to turn their own portraits into believable destination albums, then review everything inside a private gallery.",
      summaryRating: "4.9/5",
      summaryMeta: "From 10,000+ reviews"
    },
    [
      block("proof_1", "testimonial", {
        quote: "We used our engagement photos and asked for a Santorini album. The faces still looked like us, and the gallery felt natural enough to send to our families.",
        name: "Sophia & Liam",
        role: "Couple",
        location: "Australia",
        rating: "5",
        avatarUrl: generatedAssets.testimonialSophiaAvatar,
        resultImageUrl: generatedAssets.testimonialSophiaResult
      }),
      block("proof_2", "testimonial", {
        quote: "The Marrakech set matched the look we wanted for our invitations. It did not feel like a preset filter; it looked like a styled wedding shoot.",
        name: "Aisha & Omar",
        role: "Couple",
        location: "UAE",
        rating: "5",
        avatarUrl: generatedAssets.testimonialAishaAvatar,
        resultImageUrl: generatedAssets.testimonialAishaResult
      }),
      block("proof_3", "testimonial", {
        quote: "We tried the Paris direction before choosing prints for our announcement cards. The process was simple and the final images still felt personal.",
        name: "Emily & James",
        role: "Couple",
        location: "Canada",
        rating: "5",
        avatarUrl: generatedAssets.testimonialEmilyAvatar,
        resultImageUrl: generatedAssets.testimonialEmilyResult
      }),
      block("proof_4", "testimonial", {
        quote: "The Bali set helped us compare styles before our wedding site went live. The finished gallery looked polished without losing the feeling of us.",
        name: "Priya & Arjun",
        role: "Couple",
        location: "Singapore",
        rating: "5",
        avatarUrl: generatedAssets.testimonialPriyaAvatar,
        resultImageUrl: generatedAssets.testimonialPriyaResult
      })
    ]
  ),
  trust_1: section(
    "trust_signal_bar",
    {
      anchor: "guarantee",
      title: "",
      subtitle: ""
    },
    [
      block("trust_private", "stat", { value: "100% Private & Secure", label: "Private & Secure|Your photos and data are always protected." }),
      block("trust_guarantee", "stat", { value: "Satisfaction Guarantee", label: "Satisfaction Guarantee|Not satisfied? We'll make it right." }),
      block("trust_fees", "stat", { value: "No Hidden Fees", label: "No Hidden Fees|What you see is what you pay." }),
      block("trust_revisions", "stat", { value: "Unlimited Revisions", label: "Revisions|We work with you until you love the results." })
    ]
  ),
  final_cta_1: section(
    "final_cta",
    {
      anchor: "journey",
      eyebrow: "Your wedding story",
      title: "Your Love Story, Anywhere.",
      subtitle: "Upload your photos, choose a destination, and let AI create the wedding story you want to sell, share, and keep.",
      primaryCta: "Start Your Journey",
      primaryHref: "/login",
      secondaryCta: "See Pricing",
      secondaryHref: "/pricing",
      badgeLabel: "Private wedding story",
      panelEyebrow: "what happens after checkout",
      panelTitle: "A private, guided wedding image workflow from upload to final album delivery.",
      backgroundImage: generatedAssets.hero
    },
    [
      block("journey_step_upload", "journey_step", {
        title: "Upload",
        description: "Add your best couple portraits and destination references.",
        meta: "Included"
      }),
      block("journey_step_direction", "journey_step", {
        title: "Direction",
        description: "Choose the ceremony mood, styling, and destination look.",
        meta: "Included"
      }),
      block("journey_step_delivery", "journey_step", {
        title: "Delivery",
        description: "Review the final images inside one private gallery.",
        meta: "Included"
      })
    ]
  ),
  faq_1: section(
    "faq",
    {
      anchor: "faq",
      eyebrow: "Questions couples ask",
      title: "Frequently Asked Questions",
      subtitle: "Answer the bridal, privacy, and delivery questions before they slow down conversion.",
      supportEyebrow: "before they subscribe",
      supportBulletList: "Privacy for uploaded couple photos|Real turnaround expectations|Resolution, printing, and revision confidence",
      journeyTitle: "Your Dream Wedding Photos, Just 4 Steps Away",
      journeyTitles: "Upload|Choose Style|AI Generates|Download",
      journeyDescriptions: "Upload your photos.|Pick your dream destination & style.|Our AI creates your stunning photos.|Download and cherish forever."
    },
    [
      block("faq_uploads", "faq_item", {
        question: "Is this really AI-generated?",
        answer: "Yes. We use your uploaded couple photos and chosen destination or style direction to generate realistic, editorial wedding imagery."
      }),
      block("faq_private", "faq_item", {
        question: "How long does it take?",
        answer: "Most wedding story albums are delivered within 3-5 days depending on your plan, revision needs, and output count."
      }),
      block("faq_billing", "faq_item", {
        question: "Can I request styles?",
        answer: "Yes. You can choose destination moods, ceremony aesthetics, wardrobe direction, and cinematic or editorial styling during the workflow."
      }),
      block("faq_revisions", "faq_item", {
        question: "Are photos high-resolution?",
        answer: "Yes. Final deliveries are prepared for digital sharing and keepsake printing, with quality depending on your selected package."
      }),
      block("faq_print", "faq_item", {
        question: "Can I print the photos?",
        answer: "Yes. Delivered files are intended for keepsakes, announcements, framed prints, and private wedding albums."
      })
    ]
  ),
  billing_system_1: section(
    "rich_text",
    {
      anchor: "billing-system",
      eyebrow: "Plans & credits",
      title: "Subscriptions, credit packs, and private album reruns designed for wedding stories.",
      body: "Choose a monthly plan for ongoing destination edits, add credits when you want more looks, and keep every request, hold, and delivery inside one private client account.",
      tone: "warm",
      layout: "commerce_intro",
      primaryCta: "See live pricing",
      primaryHref: "/pricing",
      secondaryCta: "Open private account",
      secondaryHref: "/account"
    },
    [
      block("billing_subscription", "card", { meta: "01", title: "Monthly plan", description: "Keep recurring credits ready for destination previews, bridal edits, and ceremony variations." }),
      block("billing_pack", "card", { meta: "02", title: "Credit pack", description: "Add more capacity for extra locations, reception looks, or seasonal save-the-date sets." }),
      block("billing_confirmation", "card", { meta: "03", title: "Confirmed billing", description: "Credits appear only after billing is confirmed, so every balance stays trustworthy." }),
      block("billing_ledger", "card", { meta: "04", title: "Clear history", description: "Every hold, use, return, and rerun stays visible inside the private client account." })
    ]
  ),
  account_ops_1: section(
    "ai_feature_launcher",
    {
      anchor: "account-ops",
      eyebrow: "Customer account",
      title: "Your private wedding account for credits, uploads, requests, and album delivery.",
      subtitle: "Keep credits, uploads, album requests, and delivered galleries in one private wedding workspace.",
      surface: "account",
      imageUrl: "/assets/site-media/lumen/ref-crops/photo-santorini.png?v=20260607a"
    },
    [
      block("account_credits", "feature", { title: "Credit balance", description: "Show available and held credits so couples understand when an album request is still running.", meta: "Credits", href: "/account" }),
      block("account_uploads", "feature", { title: "Private uploads", description: "Source files and inspiration images stay inside the customer's private wedding account.", meta: "Assets", href: "/app" }),
      block("account_jobs", "feature", { title: "Album requests", description: "Waiting, creating, review-needed, and delivered states are visible without exposing other customers.", meta: "Status", href: "/app/jobs/progress" }),
      block("account_albums", "feature", { title: "Delivered albums", description: "Finished ceremony, bridal, and reception images live in a private gallery.", meta: "Gallery", href: "/album" })
    ]
  )
};

const templates: Record<ThemePackageTemplateKey, ThemePageJson> = {
  home: page(
    "home",
    [
      "hero_1",
      "metrics_1",
      "pain_points_1",
      "luxury_highlight_1",
      "workflow_1",
      "destinations_1",
      "examples_1",
      "proof_1",
      "pricing_1",
      "trust_1",
      "faq_1",
      "final_cta_1"
    ],
    homeSections
  ),
  pricing: page("pricing", ["billing_system_1", "pricing_1", "collections_1", "workflow_1", "faq_1", "conversion_1"], {
    billing_system_1: homeSections.billing_system_1,
    pricing_1: homeSections.pricing_1,
    collections_1: homeSections.collections_1,
    workflow_1: homeSections.workflow_1,
    faq_1: homeSections.faq_1,
    conversion_1: homeSections.conversion_1
  }),
  packages: page("collection", ["collections_1", "pain_points_1", "occasions_1", "conversion_1"], {
    collections_1: homeSections.collections_1,
    pain_points_1: homeSections.pain_points_1,
    occasions_1: homeSections.occasions_1,
    conversion_1: homeSections.conversion_1
  }),
  tools: page("tools", ["tool_intro_1", "collections_1", "workflow_1", "conversion_1"], {
    tool_intro_1: section("rich_text", {
      eyebrow: "Wedding tools",
      title: "Guided tools for private album creation.",
      body: "Use this page to route couples into upload, credit hold, generation status, and finished album delivery.",
      tone: "warm",
      layout: "compact"
    }),
    collections_1: homeSections.collections_1,
    workflow_1: homeSections.workflow_1,
    conversion_1: homeSections.conversion_1
  }),
  "package-detail": page("package_detail", ["package_hero_1", "before_after_1", "workflow_1", "pricing_1", "faq_1", "conversion_1"], {
    package_hero_1: section("media_banner", {
      anchor: "collection",
      eyebrow: "Wedding collection",
      title: "Choose the wedding outcome before you start the album.",
      subtitle: "Use this page to compare ceremony, bridal, and reception offers before starting a private album.",
      imageUrl: "media_lumen_editorial_hero",
      imageCaption: "Signature ceremony story, delivered as a private album.",
      imageMeta: "Each collection keeps the story promise, credit cost, and private delivery path clear.",
      ctaLabel: "Start this collection",
      ctaHref: "/login",
      tone: "warm"
    }, [
      block("package_stat_outputs", "stat", { value: "40", label: "edited frames" }),
      block("package_stat_scope", "stat", { value: "Private", label: "couple gallery" }),
      block("package_stat_checkout", "stat", { value: "Secure", label: "live checkout" })
    ]),
    before_after_1: homeSections.before_after_1,
    workflow_1: homeSections.workflow_1,
    pricing_1: homeSections.pricing_1,
    faq_1: homeSections.faq_1,
    conversion_1: homeSections.conversion_1
  }),
  "tool-detail": page("ai_tool", ["tool_hero_1", "entry_1", "before_after_1", "workflow_1", "upload_1", "form_1", "progress_1", "album_1", "faq_1"], {
    tool_hero_1: section("media_banner", {
      anchor: "tool",
      eyebrow: "Wedding generation flow",
      title: "Guide the couple from upload to finished ceremony album.",
      subtitle: "A guided storefront flow for private uploads, credit holds, album creation, and polished wedding delivery.",
      imageUrl: weddingAssets.paris,
      imageCaption: "A guided AI retouching workflow for ceremony and bridal imagery.",
      imageMeta: "Upload intake, credit hold, album creation, and delivery stay in one private flow.",
      ctaLabel: "Open workspace",
      ctaHref: "/app",
      tone: "warm"
    }, [
      block("tool_stat_upload", "stat", { value: "Upload", label: "private intake" }),
      block("tool_stat_reserve", "stat", { value: "Hold", label: "credits first" }),
      block("tool_stat_album", "stat", { value: "Album", label: "delivered images" })
    ]),
    entry_1: section("ai_tool_entry", {
      aiAppSlug: "image_generator",
      eyebrow: "Customer-facing tool",
      title: "Wedding Story Generator",
      subtitle: "Create bridal portraits, ceremony sets, and reception recaps from a private customer workspace.",
      imageUrl: "media_lumen_editorial_hero",
      ctaLabel: "Open workspace"
    }),
    before_after_1: homeSections.before_after_1,
    workflow_1: homeSections.workflow_1,
    upload_1: section("upload_panel", {
      eyebrow: "Private upload intake",
      title: "Wedding photo intake",
      subtitle: "Collect the couple portraits, bridal references, venue inspiration, and ceremony moodboards in one premium private intake.",
      surface: "journey",
      helper: "Collect couple portraits, inspiration images, venue moodboards, and bridal references inside a private account.",
      imageUrl: weddingAssets.exampleParis,
      emptyTitle: "No wedding source images yet.",
      emptyBody: "Add a few private source portraits and inspiration references to unlock the first ceremony album request."
    }),
    form_1: section("generation_form", {
      aiAppSlug: "image_generator",
      eyebrow: "Customer generation",
      title: "Collection generator",
      subtitle: "Configure the live wedding image generator, hold credits, and start a private request for this specific couple only.",
      surface: "journey",
      helper: "Select the collection, hold credits, and begin the private album request for this couple only.",
      imageUrl: weddingAssets.marrakech,
      emptyTitle: "No enabled wedding generator.",
      emptyBody: "The wedding generator will appear here as soon as this studio opens private album requests."
    }),
    progress_1: section("job_progress", {
      eyebrow: "Album requests",
      title: "Album progress",
      subtitle: "Let the couple review waiting, creating, review-needed, and delivered wedding requests without leaving the premium storefront.",
      surface: "journey",
      imageUrl: weddingAssets.desertCard,
      emptyTitle: "No album requests yet.",
      emptyBody: "Create the first wedding generation request to start the private album flow."
    }),
    album_1: section("album_gallery", {
      eyebrow: "Private album gallery",
      title: "Delivered wedding album",
      subtitle: "A private delivery surface for ceremony, bridal, and reception images that still feels like part of the same brand world.",
      surface: "journey",
      imageUrl: weddingAssets.santorini,
      emptyTitle: "No delivered wedding images yet.",
      emptyBody: "Successful requests will appear here automatically after final delivery.",
      showDownloads: true
    }),
    faq_1: homeSections.faq_1
  }),
  login: page("login", ["login_1", "trust_1"], {
    login_1: section(
      "login_method_panel",
      {
        anchor: "start",
        eyebrow: "Couple login",
        title: "Sign into your private wedding story workspace.",
        subtitle: "Each storefront keeps its own customers, uploads, credit history, and album delivery.",
        emailPlaceholder: "you@weddingemail.com",
        buttonLabel: "Continue with email",
        actionHref: "/login",
        imageUrl: weddingAssets.paris,
        secondaryImageUrl: weddingAssets.exampleMarrakech,
        imageBadge: "Private customer access",
        imageCaption: "Magazine-grade destination albums begin with a private sign-in.",
        imageMeta: "Keep ceremony, bridal, and reception requests inside one elegant client workspace."
      },
      [
        block("login_google", "login_method", { label: "Continue with Google", helper: "Fast start for couples and planners.", kind: "google", href: "/login" }),
        block("login_email", "login_method", { label: "Use email login", helper: "Password login for private album access.", kind: "email", href: "/login" })
      ]
    ),
    trust_1: section("trust_signal_bar", {
      anchor: "trust",
      title: "Private wedding delivery for every couple."
    }, [
      block("trust_private", "stat", { value: "Private", label: "customer uploads and albums" }),
      block("trust_credit", "stat", { value: "Credits", label: "clear balances and returns" }),
      block("trust_site", "stat", { value: "Secure", label: "isolated wedding storefront" })
    ])
  }),
  "app-home": page("workspace", ["workspace_1", "upload_1", "form_1", "progress_1", "album_1"], {
    workspace_1: section("ai_feature_launcher", {
      anchor: "workspace",
      eyebrow: "Wedding workspace",
      title: "Create and manage your private AI wedding album.",
      subtitle: "Upload source photos, start a collection request, follow progress, and open delivered albums from one private account.",
      surface: "workspace",
      imageUrl: weddingAssets.santorini,
      chipList: "Private customer account|Album-ready workflow|Live credits and delivery",
      ctaLabel: "Open workspace",
      ctaHref: "/app"
    }, [
      block("feature_upload", "feature", { title: "Upload wedding photos", description: "Add couple portraits, venue references, and bridal inspiration before starting a collection.", meta: "Private intake", href: "/app" }),
      block("feature_jobs", "feature", { title: "Track album requests", description: "Follow every collection while it waits, creates, enters review, or becomes ready.", meta: "Album progress", href: "/app/jobs/progress" }),
      block("feature_album", "feature", { title: "Review albums", description: "Open finished ceremony, bridal, and reception images from your private gallery.", meta: "Album delivery", href: "/album" }),
      block("feature_credits", "feature", { title: "Manage credits", description: "See available credits, held credits, and add-ons before requesting more images.", meta: "Billing", href: "/account" })
    ]),
    upload_1: section("upload_panel", {
      eyebrow: "Private upload intake",
      title: "Private wedding uploads",
      subtitle: "Keep source portraits, venue references, wardrobe inspiration, and bridal moodboards in one secure client intake.",
      surface: "workspace",
      helper: "Only the signed-in couple and studio team can access these private wedding references.",
      imageUrl: weddingAssets.exampleParis,
      emptyTitle: "No private uploads in this workspace yet.",
      emptyBody: "Add source portraits or inspiration frames before creating the next album request."
    }),
    form_1: section("generation_form", {
      aiAppSlug: "image_generator",
      eyebrow: "Customer generation",
      title: "Start a wedding album request",
      subtitle: "Choose the generator, configure the collection, hold credits, and begin the request from one branded workspace.",
      surface: "workspace",
      helper: "Choose the wedding image generator, hold credits, and begin the private request for this couple.",
      imageUrl: weddingAssets.marrakech,
      emptyTitle: "No enabled album experience in this workspace.",
      emptyBody: "Your studio has not opened private album requests yet."
    }),
    progress_1: section("job_progress", {
      eyebrow: "Album requests",
      title: "Recent album requests",
      subtitle: "Follow active and delivered wedding collections without leaving your private workspace.",
      surface: "workspace",
      imageUrl: weddingAssets.desertCard,
      emptyTitle: "No album requests in this workspace yet.",
      emptyBody: "Start your first wedding album request and its progress will appear here."
    }),
    album_1: section("album_gallery", {
      eyebrow: "Private album gallery",
      title: "Wedding album gallery",
      subtitle: "Finished ceremony, reception, and bridal images stay in the same private brand-led gallery.",
      surface: "immersive",
      imageUrl: weddingAssets.santorini,
      emptyTitle: "No wedding albums delivered yet.",
      emptyBody: "Delivered images will appear here automatically after a successful request.",
      showDownloads: true
    })
  }),
  "job-progress": page("job_progress", ["job_intro_1", "progress_1", "album_1", "faq_1"], {
    job_intro_1: section("rich_text", {
      eyebrow: "Album progress",
      title: "Track every wedding album request from checkout to delivery.",
      body: "Follow each request through waiting, creating, review, delivery, or credit return states so the couple always knows what comes next.",
      tone: "warm",
      layout: "compact"
    }),
    progress_1: section("job_progress", {
      eyebrow: "Album requests",
      title: "Current wedding generation status",
      subtitle: "Every active album request shows its current state, held credits, and delivery progress in one private timeline.",
      surface: "timeline",
      imageUrl: weddingAssets.desertCard,
      emptyTitle: "No live generation status yet.",
      emptyBody: "Start a collection request and the status timeline will appear here."
    }),
    album_1: section("album_gallery", {
      eyebrow: "Private album gallery",
      title: "Delivered wedding images",
      subtitle: "Keep delivered images visible beside the live status stream.",
      surface: "immersive",
      imageUrl: weddingAssets.santorini,
      emptyTitle: "No wedding images delivered yet.",
      emptyBody: "Finished images will appear here automatically after delivery.",
      showDownloads: true
    }),
    faq_1: homeSections.faq_1
  }),
  album: page("album", ["album_intro_1", "album_1", "account_ops_1", "conversion_1"], {
    album_intro_1: section("media_banner", {
      anchor: "album",
      eyebrow: "Private gallery",
      title: "Your finished wedding images, ready in a private album.",
      subtitle: "Review delivered bridal, ceremony, and reception images in a gallery made for your wedding story.",
      imageUrl: weddingAssets.marrakech,
      imageCaption: "Finished bridal, ceremony, and reception images stay private.",
      imageMeta: "Only the signed-in couple can review, open, and download their delivered wedding images.",
      ctaLabel: "Open workspace",
      ctaHref: "/app",
      tone: "warm"
    }, [
      block("album_stat_scope", "stat", { value: "Private", label: "couple access" }),
      block("album_stat_download", "stat", { value: "Download", label: "ready files" }),
      block("album_stat_audit", "stat", { value: "Secure", label: "gallery delivery" })
    ]),
    album_1: section("album_gallery", {
      eyebrow: "Private album gallery",
      title: "Wedding gallery",
      subtitle: "Open finished images, review collection status, and keep every delivered album in one private gallery.",
      imageUrl: weddingAssets.santorini,
      emptyTitle: "No gallery images delivered yet.",
      emptyBody: "Once a wedding request succeeds, the delivered images will appear in this gallery.",
      showDownloads: true
    }),
    account_ops_1: homeSections.account_ops_1,
    conversion_1: homeSections.conversion_1
  }),
  "account-billing": page("account", ["billing_intro_1", "account_ops_1", "pricing_1", "album_1", "conversion_1"], {
    billing_intro_1: section("rich_text", {
      eyebrow: "Account and billing",
      title: "Credits, subscriptions, and collection add-ons stay visible after login.",
      body: "Review plan credits, one-time add-ons, payment confirmation, and album revision activity from the same private wedding account.",
      tone: "warm",
      layout: "commerce_intro",
      primaryCta: "Open workspace",
      primaryHref: "/app",
      secondaryCta: "View delivered albums",
      secondaryHref: "/album"
    }),
    account_ops_1: homeSections.account_ops_1,
    pricing_1: homeSections.pricing_1,
    album_1: section("album_gallery", {
      eyebrow: "Private album gallery",
      title: "Latest delivered wedding albums",
      subtitle: "Keep recent bridal, ceremony, and reception deliveries visible beside the customer's credits and subscription state.",
      surface: "immersive",
      imageUrl: weddingAssets.santorini,
      emptyTitle: "No delivered wedding albums on this account yet.",
      emptyBody: "After a wedding album request succeeds, the latest delivered images will appear here with download actions.",
      showDownloads: true
    }),
    conversion_1: homeSections.conversion_1
  }),
  "job-detail": page("job_detail", ["job_detail_1", "album_1", "conversion_1"], {
    job_detail_1: section("job_detail", {
      eyebrow: "Album request",
      title: "Review one private album request without leaving the storefront.",
      subtitle: "Review request status, delivered images, and credit history from your private wedding account.",
      showLedger: true,
      showAssets: true
    }),
    album_1: section("album_gallery", {
      eyebrow: "Request gallery",
      title: "Related wedding images",
      subtitle: "Show delivered frames attached to this private request while keeping credits, source files, and final images in one branded flow.",
      imageUrl: weddingAssets.santorini,
      emptyTitle: "No delivered images for this request yet.",
      emptyBody: "When this request finishes, related ceremony, bridal, or reception images will appear here automatically.",
      showDownloads: true
    }),
    conversion_1: homeSections.conversion_1
  }),
  help: page("help", ["help_intro_1", "faq_1", "blog_list_1"], {
    help_intro_1: section("rich_text", {
      eyebrow: "Help center",
      title: "Plan uploads, timing, collections, and privacy with confidence.",
      body: "Find guidance for source photos, destination styles, album delivery, revisions, and private gallery access before you begin.",
      tone: "warm",
      layout: "compact"
    }),
    faq_1: homeSections.faq_1,
    blog_list_1: section("blog_list", {
      title: "Planning guides",
      body: "Bridal preparation, upload guidance, album timing, and collection selection for couples planning an AI wedding story."
    })
  }),
  policy: page("policy", ["policy_1"], {
    policy_1: section("policy_content", {
      title: "Wedding site policy",
      body: "<p>Your uploads, payment activity, and delivered wedding images are handled inside a private account for this storefront. Source photos are used to create the requested album experience, and delivered files remain available to the signed-in customer unless deletion is requested.</p><p>Subscription credits and one-time credit packs are applied after payment confirmation. If an album request fails or is cancelled before delivery, held credits are returned to the account balance.</p>"
    })
  }),
  "blog-list": page("blog", ["blog_intro_1", "blog_list_1", "conversion_1"], {
    blog_intro_1: section("rich_text", {
      eyebrow: "Wedding journal",
      title: "Content that supports planning and collection selection.",
      body: "Read practical guides on bridal prep, engagement references, subscription credits, and the private album delivery flow.",
      tone: "warm",
      layout: "compact"
    }),
    blog_list_1: section("blog_list", {
      title: "Wedding planning guides",
      body: "Guides for uploads, collection planning, bridal portraits, delivery timing, and privacy."
    }),
    conversion_1: homeSections.conversion_1
  }),
  "blog-detail": page("article", ["article_1", "collections_1", "blog_list_1", "conversion_1"], {
    article_1: section("rich_text", {
      eyebrow: "Guide",
      title: "How to prepare source photos for a wedding story album",
      body: "Prepare clear couple portraits, bridal detail shots, venue references, and outfit variety before you start. Strong source photos help the studio create a more consistent destination album and make revision requests easier to review.",
      tone: "warm",
      layout: "compact"
    }),
    collections_1: homeSections.collections_1,
    blog_list_1: section("blog_list", {
      title: "Related wedding guides",
      body: "Keep readers moving from planning content into real collections and pricing."
    }),
    conversion_1: homeSections.conversion_1
  }),
  search: page("search", ["search_intro_1", "search_1", "collections_1", "conversion_1"], {
    search_intro_1: section("rich_text", {
      eyebrow: "Search",
      title: "Help couples find collections, pricing, tools, and policies.",
      body: "Search helps couples find collections, pricing, upload guidance, privacy terms, and album support from the same storefront.",
      tone: "warm",
      layout: "compact"
    }),
    search_1: section("search_results", {
      eyebrow: "Site search",
      title: "Search this wedding storefront",
      emptyTitle: "No matching wedding story content yet.",
      emptyBody: "Try ceremony, pricing, credits, privacy, album, or upload guidance.",
      resultLimit: 12
    }),
    collections_1: homeSections.collections_1,
    conversion_1: homeSections.conversion_1
  }),
  cart: page("cart", ["cart_intro_1", "cart_1", "pricing_1", "conversion_1"], {
    cart_intro_1: section("rich_text", {
      eyebrow: "Cart",
      title: "Confirm the wedding collection before checkout.",
      body: "Review the selected collection, credit grant, and checkout amount before the private album workflow begins.",
      tone: "warm",
      layout: "compact"
    }),
    cart_1: section("cart_summary", {
      eyebrow: "Checkout summary",
      title: "Your selected wedding plan",
      subtitle: "Products, prices, credits, and checkout state stay tied to this storefront. Credits appear only after payment confirmation.",
      emptyTitle: "Choose a wedding plan first",
      emptyBody: "Open pricing to select a subscription or credit pack for this private wedding album.",
      returnLabel: "Back to pricing",
      returnHref: "/pricing"
    }),
    pricing_1: homeSections.pricing_1,
    conversion_1: homeSections.conversion_1
  }),
  "404": page("404", ["not_found_1", "collections_1", "conversion_1"], {
    not_found_1: section("not_found", {
      eyebrow: "404",
      title: "This wedding story page is not available.",
      subtitle: "Send couples back to collections, pricing, login, or the private album workspace.",
      primaryCta: "Return home",
      primaryHref: "/",
      secondaryCta: "View collections",
      secondaryHref: "/collections"
    }),
    collections_1: homeSections.collections_1,
    conversion_1: homeSections.conversion_1
  })
};

export const weddingStoryHouseTemplates: Record<ThemePackageTemplateKey, ThemePageJson> = templates;

export const weddingStoryHouseTemplateLabels: Record<ThemePackageTemplateKey, string> = {
  home: "Home",
  pricing: "Pricing",
  packages: "Wedding Collections",
  tools: "Wedding Tools",
  "package-detail": "Collection Detail",
  "tool-detail": "Wedding Generator",
  login: "Customer Login",
  "app-home": "Wedding Workspace",
  "job-progress": "Album Progress",
  album: "Album",
  "account-billing": "Account Billing",
  "job-detail": "Album Request Detail",
  help: "Help Center",
  policy: "Policy",
  "blog-list": "Blog List",
  "blog-detail": "Blog Detail",
  search: "Search",
  cart: "Cart",
  "404": "404"
};

export const weddingStoryHouseSiteSettings: ThemePackageSiteSettings = {
  branding: {
    logoText: "AI Wedding",
    market: "AI-powered destination wedding photography",
    description: "A luxury AI wedding storefront for destination bridal portraits, ceremony editorials, private couple albums, and high-end delivery."
  },
  themeSettings: {
    colors: {
      background: "#f5f0e8",
      foreground: "#171514",
      accent: "#b8744f",
      muted: "#eadfce"
    },
    typography: {
      display: "Playfair Display",
      body: "Geist"
    },
    radii: {
      section: 18,
      control: 12
    },
    navigation: {
      headerLinks: [
        { label: "How It Works", href: "#workflow" },
        { label: "Styles", href: "#styles" },
        { label: "Examples", href: "#examples" },
        { label: "Pricing", href: "/pricing" },
        { label: "FAQ", href: "#faq" }
      ],
      footerLinks: [
        { label: "How It Works", href: "#workflow", group: "product" },
        { label: "Pricing", href: "/pricing", group: "product" },
        { label: "Examples", href: "#examples", group: "company" },
        { label: "Journal", href: "/blog", group: "company" },
        { label: "Help center", href: "/help", group: "support" },
        { label: "Privacy", href: "/policies/privacy", group: "support" },
        { label: "Refunds", href: "/policies/refunds", group: "support" },
        { label: "Content policy", href: "/policies/content", group: "support" }
      ]
    },
    globalSections: {
      header: {
        settings: {
          title: "AI Wedding",
          sticky: true,
          ctaLabel: "Get Started",
          ctaHref: "/login",
          style: "light_commerce",
          mobileLabel: "Menu",
          logoImageUrl: generatedAssets.brandLogo,
          logoAlt: "AI Wedding rose logo"
        },
        blocks: [
          { id: "global_header_workflow", type: "menu_link", settings: { label: "How It Works", href: "#workflow" } },
          { id: "global_header_styles", type: "menu_link", settings: { label: "Styles", href: "#styles" } },
          { id: "global_header_examples", type: "menu_link", settings: { label: "Examples", href: "#examples" } },
          { id: "global_header_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing" } },
          { id: "global_header_faq", type: "menu_link", settings: { label: "FAQ", href: "#faq" } }
        ]
      },
      footer: {
        settings: {
          title: "AI Wedding",
          tagline: "AI-powered destination wedding photography",
          body: "AI-powered photography for couples who dream beyond boundaries. Private albums, destination styles, transparent plans, and premium delivery.",
          productHeading: "Product",
          companyHeading: "Company",
          supportHeading: "Support",
          socialHeading: "Follow Us",
          socialBody: "Destination wedding inspiration, private delivery, and elegant AI-generated albums.",
          instagramUrl: "https://instagram.com",
          facebookUrl: "https://facebook.com",
          pinterestUrl: "https://pinterest.com",
          youtubeUrl: "https://youtube.com",
          bottomLine: "Private albums, live pricing, and destination wedding storytelling in one storefront.",
          copyright: "AI Wedding. All rights reserved.",
          logoImageUrl: generatedAssets.brandLogo,
          logoAlt: "AI Wedding rose logo",
          backgroundColor: "#0b0d10",
          textColor: "#f7f2ea"
        },
        blocks: [
          { id: "global_footer_product_workflow", type: "menu_link", settings: { label: "How It Works", href: "#workflow", group: "product" } },
          { id: "global_footer_product_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing", group: "product" } },
          { id: "global_footer_company_examples", type: "menu_link", settings: { label: "Examples", href: "#examples", group: "company" } },
          { id: "global_footer_company_journal", type: "menu_link", settings: { label: "Journal", href: "/blog", group: "company" } },
          { id: "global_footer_support_help", type: "menu_link", settings: { label: "Help center", href: "/help", group: "support" } },
          { id: "global_footer_support_privacy", type: "menu_link", settings: { label: "Privacy", href: "/policies/privacy", group: "support" } },
          { id: "global_footer_support_refunds", type: "menu_link", settings: { label: "Refunds", href: "/policies/refunds", group: "support" } },
          { id: "global_footer_support_content", type: "menu_link", settings: { label: "Content policy", href: "/policies/content", group: "support" } }
        ]
      }
    },
    seo: {
      siteTitle: "AI Wedding",
      siteDescription: "Luxury AI wedding photography for destination bridal portraits, ceremony stories, and private couple albums.",
      titleTemplate: "%s | AI Wedding"
    },
    saasSettingsCurrent: {
      skin_bg: "#f5f0e8",
      skin_title_color: "#171514",
      skin_text_color: "#5f5954",
      skin_price_color: "#b8744f",
      skin_primary_btn_bg_color: "#171514",
      skin_primary_btn_text_color: "#ffffff",
      skin_secondary_btn_bg_color: "#f5f0e8",
      skin_secondary_btn_text_color: "#171514",
      skin_title_font_family: "Playfair Display",
      skin_text_font_family: "Geist",
      general_layout_width: 1280,
      general_layout_spacing: 56,
      sections: {
        header_plus: {
          type: "header_plus",
          version: "1",
          card_name: "Wedding header",
          settings: {
            is_announce_show: false,
            announce_title: "Wedding collections are private until you publish them to your couple gallery.",
            announce_color: "#ffffff",
            announce_bg_color: "#171514"
          },
          blocks: []
        }
      }
    }
  }
};
