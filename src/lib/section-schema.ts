import { getImportedSaasSectionSchemas } from "@/lib/theme/saas-theme-package";
import type {
  SectionBlockInstance,
  SectionInstance,
  SectionType,
  ThemeBlockSchema,
  ThemeFieldSchema,
  ThemeSectionSchema,
  ThemeSettingValue
} from "@/lib/types";

function text(id: string, label: string, defaultValue = "", helpText?: string): ThemeFieldSchema {
  return { id, label, type: "text", default: defaultValue, helpText };
}

function textarea(id: string, label: string, defaultValue = "", helpText?: string): ThemeFieldSchema {
  return { id, label, type: "textarea", default: defaultValue, helpText };
}

function richtext(id: string, label: string, defaultValue = "", helpText?: string): ThemeFieldSchema {
  return { id, label, type: "richtext", default: defaultValue, helpText };
}

function url(id: string, label: string, defaultValue = "#"): ThemeFieldSchema {
  return { id, label, type: "url", default: defaultValue };
}

function image(id: string, label: string, defaultValue = ""): ThemeFieldSchema {
  return { id, label, type: "image_picker", default: defaultValue };
}

function media(id: string, label: string, defaultValue = ""): ThemeFieldSchema {
  return { id, label, type: "media_asset", source: "media_assets", default: defaultValue };
}

function checkbox(id: string, label: string, defaultValue = false): ThemeFieldSchema {
  return { id, label, type: "checkbox", default: defaultValue };
}

function range(id: string, label: string, defaultValue: number, min: number, max: number, step = 1): ThemeFieldSchema {
  return { id, label, type: "range", default: defaultValue, min, max, step };
}

function select(id: string, label: string, options: Array<[string, string]>, defaultValue: string): ThemeFieldSchema {
  return {
    id,
    label,
    type: "select",
    default: defaultValue,
    options: options.map(([value, optionLabel]) => ({ value, label: optionLabel }))
  };
}

function aiApp(id = "aiAppSlug", label = "AI app"): ThemeFieldSchema {
  return { id, label, type: "ai_app", source: "site_ai_apps", default: "image_generator" };
}

function block(id: string, type: string, settings: Record<string, ThemeSettingValue>): SectionBlockInstance {
  return { id, type, settings };
}

const ctaBlock: ThemeBlockSchema = {
  type: "cta",
  label: "CTA",
  maxBlocks: 2,
  settings: [
    text("label", "Label", "Start creating"),
    url("href", "Link", "/login"),
    select(
      "style",
      "Style",
      [
        ["primary", "Primary"],
        ["secondary", "Secondary"],
        ["ghost", "Ghost"]
      ],
      "primary"
    )
  ],
  preset: { label: "CTA", settings: { label: "Start creating", href: "/login", style: "primary" } }
};

const statBlock: ThemeBlockSchema = {
  type: "stat",
  label: "Metric",
  maxBlocks: 4,
  settings: [text("value", "Value", "20-40"), text("label", "Label", "photos per album")],
  preset: { label: "Metric", settings: { value: "20-40", label: "photos per album" } }
};

const cardBlock: ThemeBlockSchema = {
  type: "card",
  label: "Card",
  settings: [text("title", "Title"), textarea("description", "Description"), textarea("text", "Text"), text("meta", "Meta"), image("imageUrl", "Image URL")],
  preset: { label: "Card", settings: { title: "New card", description: "Describe this item.", text: "Describe this item.", meta: "", imageUrl: "" } }
};

const faqBlock: ThemeBlockSchema = {
  type: "faq_item",
  label: "FAQ item",
  settings: [text("question", "Question", "What should customers upload?"), textarea("answer", "Answer", "Clear recent photos work best.")],
  preset: { label: "FAQ item", settings: { question: "New question", answer: "Write the answer here." } }
};

const testimonialBlock: ThemeBlockSchema = {
  type: "testimonial",
  label: "Testimonial",
  settings: [
    textarea("quote", "Quote"),
    text("name", "Name"),
    text("role", "Role"),
    text("location", "Location"),
    text("rating", "Rating", "5"),
    image("avatarUrl", "Avatar image"),
    image("resultImageUrl", "Result image")
  ],
  preset: {
    label: "Testimonial",
    settings: {
      quote: "Customers understand the offer quickly.",
      name: "Studio customer",
      role: "Verified",
      location: "",
      rating: "5",
      avatarUrl: "",
      resultImageUrl: ""
    }
  }
};

const beforeAfterBlock: ThemeBlockSchema = {
  type: "before_after",
  label: "Before / after pair",
  settings: [text("beforeLabel", "Before label"), text("afterLabel", "After label"), image("beforeImage", "Before image"), image("afterImage", "After image")],
  preset: {
    label: "Before / after pair",
    settings: {
      beforeLabel: "Selfie intake",
      afterLabel: "Editorial output",
      beforeImage: "",
      afterImage: ""
    }
  }
};

const menuLinkBlock: ThemeBlockSchema = {
  type: "menu_link",
  label: "Menu link",
  settings: [text("label", "Label", "Packages"), url("href", "Link", "#packages"), text("group", "Group", "")],
  preset: { label: "Menu link", settings: { label: "Packages", href: "#packages", group: "" } }
};

const logoBlock: ThemeBlockSchema = {
  type: "logo",
  label: "Brand logo",
  settings: [
    text("name", "Brand name", "ReviewHub"),
    image("imageUrl", "Logo image URL"),
    text("badge", "Badge", "Trusted")
  ],
  preset: { label: "Brand logo", settings: { name: "ReviewHub", imageUrl: "", badge: "Trusted" } }
};

const featureTabBlock: ThemeBlockSchema = {
  type: "feature_tab",
  label: "Feature tab",
  settings: [
    text("label", "Tab label", "Photo packages"),
    text("title", "Title", "AI photo package studio"),
    textarea("description", "Description", "Turn everyday selfies into a polished themed photo set."),
    image("imageUrl", "Image URL"),
    url("href", "Link", "/tools")
  ],
  preset: {
    label: "Feature tab",
    settings: {
      label: "Photo packages",
      title: "AI photo package studio",
      description: "Turn everyday selfies into a polished themed photo set.",
      imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
      href: "/tools"
    }
  }
};

const destinationCardBlock: ThemeBlockSchema = {
  type: "destination",
  label: "Destination card",
  settings: [
    text("title", "Title", "Santorini"),
    textarea("description", "Description", "Whitewashed cliffs and golden-hour scene portraits."),
    text("tag", "Display tag", "Europe"),
    text("tags", "Filter tags", "Europe|Beach", "Use | to assign this destination to multiple filter tabs."),
    text("location", "Location", "Santorini, Greece"),
    image("imageUrl", "Image URL"),
    url("href", "Link", "/collections")
  ],
  preset: {
    label: "Destination card",
    settings: {
      title: "Santorini",
      description: "Whitewashed cliffs and golden-hour scene portraits.",
      tag: "Europe",
      tags: "Europe|Beach",
      location: "Santorini, Greece",
      imageUrl: "",
      href: "/collections"
    }
  }
};

const exampleCardBlock: ThemeBlockSchema = {
  type: "example",
  label: "Example card",
  settings: [
    text("title", "Title", "Coastal Romance"),
    textarea("description", "Description", "White and blue dreams in Santorini."),
    text("location", "Location", "Santorini, Greece"),
    image("imageUrl", "Image URL"),
    url("href", "Link", "/collections")
  ],
  preset: {
    label: "Example card",
    settings: {
      title: "Coastal Romance",
      description: "White and blue dreams in Santorini.",
      location: "Santorini, Greece",
      imageUrl: "",
      href: "/collections"
    }
  }
};

const loginMethodBlock: ThemeBlockSchema = {
  type: "login_method",
  label: "Login method",
  settings: [
    text("label", "Label", "Continue with Google"),
    text("helper", "Helper", "OAuth-ready entry for production storefronts."),
    select(
      "kind",
      "Kind",
      [
        ["google", "Google"],
        ["email", "Email"],
        ["apple", "Apple"]
      ],
      "google"
    ),
    url("href", "Link", "/login")
  ],
  preset: {
    label: "Login method",
    settings: { label: "Continue with Google", helper: "OAuth-ready entry for production storefronts.", kind: "google", href: "/login" }
  }
};

const journeyStepBlock: ThemeBlockSchema = {
  type: "journey_step",
  label: "Journey step",
  maxBlocks: 6,
  settings: [
    text("title", "Title", "Upload"),
    textarea("description", "Description", "Add your best source portraits and style references."),
    text("meta", "Badge", "Included")
  ],
  preset: {
    label: "Journey step",
    settings: {
      title: "Upload",
      description: "Add your best source portraits and style references.",
      meta: "Included"
    }
  }
};

const dreamshootToolBlock: ThemeBlockSchema = {
  type: "tool_card",
  label: "Tool card",
  maxBlocks: 36,
  settings: [
    text("title", "Title", "Background changer"),
    textarea("description", "Description", "Edit one photo with a focused AI tool before upgrading to private packs."),
    text("category", "Category", "AI Photo Edit"),
    text("badge", "Badge", "Studio"),
    image("imageUrl", "Image URL"),
    url("href", "Link", "/tools/background-changer")
  ],
  preset: {
    label: "Tool card",
    settings: {
      title: "Background changer",
      description: "Edit one photo with a focused AI tool before upgrading to private packs.",
      category: "AI Photo Edit",
      badge: "Studio",
      imageUrl: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
      href: "/tools/background-changer"
    }
  }
};

const dreamshootTaxonomyBlock: ThemeBlockSchema = {
  type: "taxonomy_card",
  label: "Package category",
  maxBlocks: 20,
  settings: [
    text("title", "Title", "Photo package studio"),
    textarea("description", "Description", "Headshot, gala, travel, sports, beauty, and creator scenes."),
    text("meta", "Meta", "Core package"),
    text("keywords", "Keywords", "headshots|gala photos|creator portraits"),
    image("imageUrl", "Image URL"),
    url("href", "Link", "/collections")
  ],
  preset: {
    label: "Package category",
    settings: {
      title: "Photo package studio",
      description: "Headshot, gala, travel, sports, beauty, and creator scenes.",
      meta: "Core package",
      keywords: "headshots|gala photos|creator portraits",
      imageUrl: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
      href: "/collections"
    }
  }
};

const dreamshootProofCardBlock: ThemeBlockSchema = {
  type: "proof_card",
  label: "Proof card",
  maxBlocks: 8,
  settings: [
    text("title", "Title", "World Cup fan photos"),
    textarea("description", "Description", "Package-ready looks with clear buyer intent."),
    text("category", "Category", "Sports"),
    text("badge", "Badge", "Featured"),
    image("imageUrl", "Image URL"),
    url("href", "Link", "/collections")
  ],
  preset: {
    label: "Proof card",
    settings: {
      title: "World Cup fan photos",
      description: "Package-ready looks with clear buyer intent.",
      category: "Sports",
      badge: "Featured",
      imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/friend-fan-photos.png",
      href: "/collections"
    }
  }
};

const dreamshootSeasonalImageBlock: ThemeBlockSchema = {
  type: "seasonal_image",
  label: "Seasonal image",
  maxBlocks: 8,
  settings: [
    text("label", "Label", "Fan poster"),
    text("meta", "Meta", "Match-day crop"),
    image("imageUrl", "Image URL"),
    text("shape", "Shape", "wide")
  ],
  preset: {
    label: "Seasonal image",
    settings: {
      label: "Fan poster",
      meta: "Match-day crop",
      imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png",
      shape: "wide"
    }
  }
};

const dreamshootCatalogPackBlock: ThemeBlockSchema = {
  type: "catalog_pack",
  label: "Catalog pack",
  maxBlocks: 32,
  settings: [
    text("title", "Title", "World Cup fan photos"),
    textarea("description", "Description", "Match-day portraits, fan posters, and stadium-inspired profile images."),
    text("category", "Category", "Sports"),
    text("meta", "Photos", "40 photos"),
    text("credits", "Credits", "26 credits"),
    image("imageUrl", "Image URL"),
    url("href", "Link", "/tools/world-cup-fan-photos")
  ],
  preset: {
    label: "Catalog pack",
    settings: {
      title: "World Cup fan photos",
      description: "Match-day portraits, fan posters, and stadium-inspired profile images.",
      category: "Sports",
      meta: "40 photos",
      credits: "26 credits",
      imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png",
      href: "/tools/world-cup-fan-photos"
    }
  }
};

const pricingPlanNoteBlock: ThemeBlockSchema = {
  type: "plan_note",
  label: "Plan note",
  maxBlocks: 6,
  settings: [
    { id: "productId", label: "Plan", type: "product", source: "products", default: "" },
    text("title", "Title", "Premium"),
    textarea("description", "Description", "For the full photo story with more outputs, more destinations, and faster delivery."),
    text("meta", "Badge", "editorial fit")
  ],
  preset: {
    label: "Plan note",
    settings: {
      productId: "",
      title: "Premium",
      description: "For the full photo story with more outputs, more destinations, and faster delivery.",
      meta: "editorial fit"
    }
  }
};

const benefitBlock: ThemeBlockSchema = {
  type: "benefit",
  label: "Benefit",
  maxBlocks: 8,
  settings: [text("label", "Label", "Prices stay synced to your real checkout products"), textarea("description", "Description", "")],
  preset: {
    label: "Benefit",
    settings: {
      label: "Prices stay synced to your real checkout products",
      description: ""
    }
  }
};

export const aiSubscriptionSectionSchemas: Record<string, ThemeSectionSchema> = {
  hero: {
    type: "hero",
    label: "Editorial Hero",
    category: "Storefront",
    description: "Asymmetric first-screen offer with imagery, CTAs, and proof metrics.",
    maxBlocks: 6,
    settings: [
      text("eyebrow", "Eyebrow", "Private AI photo studio"),
      text("headline", "Headline", "Create studio-quality photos from everyday selfies."),
      textarea("subheadline", "Subheadline", "Upload photos, train a private model, and generate themed albums."),
      media("mediaAssetId", "Hero media asset"),
      image("imageUrl", "Primary image URL"),
      image("secondaryImageUrl", "Secondary image URL"),
      image("tertiaryImageUrl", "Tertiary image URL"),
      textarea("bulletList", "Feature bullets", "Upload selfies and create your own AI model|Themed photo packs from headshots to AI photos|Announcement creator|Magic upscaler|Music lip sync"),
      text("highlightWord", "Highlighted word", "real"),
      text("heroBadge", "Hero badge", "AI photo package studio"),
      text("authRibbon", "Auth ribbon", "World Cup fan pack live"),
      text("authPrimaryLabel", "Auth primary label", "Continue with Google"),
      text("authEmailPlaceholder", "Auth email placeholder", "Enter your email"),
      text("authButtonLabel", "Auth button label", "Get Started with Email"),
      text("imageBadge", "Image badge", "40 photo album"),
      text("imageCaption", "Image caption", "Private photo albums, ready for client delivery."),
      text("detailCardEyebrow", "Detail card eyebrow", "MydreamShoots"),
      text("detailCardTitle", "Detail card title", "Destination photo scenes, private delivery, and editorial detail."),
      textarea("detailCardBody", "Detail card body", "Upload your photos, choose a destination, and receive a polished private album."),
      text("socialProofLabel", "Floating proof label", "Popov purchased the MydreamShoots Pro 36 minutes ago"),
      checkbox("showStats", "Show metrics inside hero", true),
      select(
        "layout",
        "Layout",
        [
          ["editorial", "Editorial collage"],
          ["split", "Split image"],
          ["minimal", "Minimal copy"],
          ["studio_commerce", "Studio commerce"],
          ["immersive_dark", "Immersive dark hero"]
        ],
        "editorial"
      )
    ],
    blocks: [ctaBlock, statBlock],
    presets: [
      {
        label: "MydreamShoots-style photo hero",
        settings: {
          eyebrow: "Private AI photo studio",
          headline: "Create studio-quality AI photo packs from everyday selfies.",
          subheadline: "Upload clear photos, train a private model, and generate headshots, creator portraits, gala scenes, World Cup fan photos, and editorial looks.",
          mediaAssetId: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
          imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
          secondaryImageUrl: "/assets/dreamshoot/editorial-headshot.svg",
          tertiaryImageUrl: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
          bulletList:
            "Upload selfies and create your own AI model|Themed photo packs from headshots to AI photos|Announcement creator|Magic upscaler|Music lip sync",
          highlightWord: "real",
          heroBadge: "AI photo package studio",
          authRibbon: "World Cup fan pack live",
          authPrimaryLabel: "Continue with Google",
          authEmailPlaceholder: "Enter your email",
          authButtonLabel: "Get Started with Email",
          imageBadge: "40 photo album",
          imageCaption: "Private photo albums, ready for client delivery.",
          detailCardEyebrow: "MydreamShoots",
          detailCardTitle: "Destination photo scenes, private delivery, and editorial detail.",
          detailCardBody: "Upload your photos, choose a destination, and receive a polished private album.",
          socialProofLabel: "Popov purchased the MydreamShoots Pro 36 minutes ago",
          showStats: true,
          layout: "studio_commerce"
        },
        blocks: [
          block("cta_primary", "cta", { label: "Start with email", href: "/login", style: "primary" }),
          block("cta_secondary", "cta", { label: "View photo packs", href: "#packages", style: "secondary" }),
          block("stat_outputs", "stat", { value: "20-40", label: "photos per themed album" }),
          block("stat_selfies", "stat", { value: "12+", label: "clear selfies recommended" }),
          block("stat_private", "stat", { value: "Private", label: "uploads and delivery" })
        ]
      }
    ]
  },
  brand_logo_strip: {
    type: "brand_logo_strip",
    label: "Brand Logo Strip",
    category: "Storefront",
    description: "Compact trust row with partner or review-platform logos.",
    maxBlocks: 12,
    settings: [
      text("anchor", "Anchor", "trusted"),
      text("title", "Title", "Trusted by reviews websites"),
      text("style", "Style label", "dark")
    ],
    blocks: [logoBlock],
    presets: [
      {
        label: "Trust logo row",
        settings: {
          anchor: "trusted",
          title: "Trusted by reviews websites",
          style: "dark"
        },
        blocks: [
          block("logo_photowire", "logo", { name: "ReviewHub", imageUrl: "", badge: "Trusted" }),
          block("logo_creatorproof", "logo", { name: "CreatorProof", imageUrl: "", badge: "Trusted" }),
          block("logo_customers", "logo", { name: "Customers", imageUrl: "", badge: "Trusted" }),
          block("logo_stylemepretty", "logo", { name: "Studio Notes", imageUrl: "", badge: "Trusted" }),
          block("logo_zola", "logo", { name: "Creator Reviews", imageUrl: "", badge: "Trusted" })
        ]
      }
    ]
  },
  story_mosaic: {
    type: "story_mosaic",
    label: "Story Mosaic",
    category: "Storefront",
    description: "Editorial story block with lead copy and a mosaic of image cards.",
    maxBlocks: 14,
    settings: [
      text("anchor", "Anchor", "story"),
      text("eyebrow", "Eyebrow", "Featured story"),
          text("title", "Title", "AI Photo Studio & Creative Packs"),
      textarea("subtitle", "Subtitle", "Editorial storytelling block for featured AI use cases."),
      text("ctaLabel", "CTA label", "Create My Fan Photo Pack"),
      url("ctaHref", "CTA link", "/login"),
      select(
        "tone",
        "Tone",
        [
          ["dark", "Dark canvas"],
          ["light", "Light canvas"]
        ],
        "dark"
      )
    ],
    blocks: [
      {
        type: "story_card",
        label: "Story image",
        settings: [
          text("label", "Label", "Travel creator"),
          image("imageUrl", "Image URL"),
          text("meta", "Meta", "Featured"),
          url("href", "Link", "/login")
        ],
        preset: {
          label: "Story image",
          settings: {
            label: "Travel creator",
            imageUrl: "/assets/dreamshoot/travel-card.svg",
            meta: "Featured",
            href: "/login"
          }
        }
      }
    ]
  },
  metric_strip: {
    type: "metric_strip",
    label: "Metric Strip",
    category: "Storefront",
    description: "Standalone horizontal proof metrics for hero, trust, conversion, or product pages.",
    maxBlocks: 6,
    settings: [
      text("anchor", "Anchor", "metrics"),
      text("eyebrow", "Eyebrow", "Proof points"),
      text("title", "Title", ""),
      textarea("subtitle", "Subtitle", ""),
      select(
        "tone",
        "Tone",
        [
          ["light", "Light"],
          ["warm", "Warm"],
          ["dark", "Dark"]
        ],
        "light"
      ),
      checkbox("showTopBorder", "Show top divider", true),
      checkbox("showBottomBorder", "Show bottom divider", true)
    ],
    blocks: [statBlock],
    presets: [
      {
        label: "MydreamShoots proof metrics",
        settings: {
          anchor: "metrics",
          eyebrow: "Trusted worldwide",
          title: "",
          subtitle: "",
          tone: "light",
          showTopBorder: true,
          showBottomBorder: true
        },
        blocks: [
          block("metric_destinations", "stat", { value: "100+", label: "Dream Destinations" }),
          block("metric_customers", "stat", { value: "10,000+", label: "Happy Customers" }),
          block("metric_satisfaction", "stat", { value: "99%", label: "Satisfaction Rate" }),
          block("metric_support", "stat", { value: "24/7", label: "AI Support" })
        ]
      }
    ]
  },
  destination_showcase: {
    type: "destination_showcase",
    label: "Destination Showcase",
    category: "Storefront",
    description: "Filterable destination or style card wall for photo packages and inspiration.",
    maxBlocks: 18,
    settings: [
      text("anchor", "Anchor", "styles"),
      text("eyebrow", "Eyebrow", "Popular destinations"),
      text("title", "Title", "Popular destinations"),
      textarea("subtitle", "Subtitle", "Show destination categories and let customers browse styles before they sign up."),
      textarea("tabs", "Tabs", "All|Europe|Asia|Beach|Desert|City"),
      text("defaultTab", "Default tab", "All")
    ],
    blocks: [destinationCardBlock],
    presets: [
      {
        label: "MydreamShoots destination wall",
        settings: {
          anchor: "styles",
          eyebrow: "Popular destinations",
          title: "Popular Destinations",
          subtitle: "Let customers browse destination styles before they create a private photo pack.",
          tabs: "All|Europe|Asia|Beach|Desert|City",
          defaultTab: "All"
        },
        blocks: [
          block("destination_santorini", "destination", { title: "Santorini", description: "Whitewashed cliffs and iconic blue domes at sunset.", tag: "Europe", tags: "Europe|Beach", location: "Santorini, Greece", imageUrl: "/assets/site-media/lumen/ref-crops/photo-santorini.png?v=20260607a", href: "/collections" }),
          block("destination_bali", "destination", { title: "Bali", description: "Lush jungle story moments and tropical coastal portraits.", tag: "Beach", tags: "Asia|Beach", location: "Bali, Indonesia", imageUrl: "/assets/site-media/lumen/ref-crops/photo-bali.png?v=20260607a", href: "/collections" }),
          block("destination_paris", "destination", { title: "Paris", description: "Historic grandeur with cinematic terrace portraits.", tag: "City", tags: "Europe|City", location: "Paris, France", imageUrl: "/assets/site-media/lumen/ref-crops/photo-paris.png?v=20260607a", href: "/collections" }),
          block("destination_cappadocia", "destination", { title: "Cappadocia", description: "Balloon sunrise scenes and sculpted stone landscapes.", tag: "Desert", tags: "Asia|Desert", location: "Cappadocia, Turkey", imageUrl: "/assets/site-media/lumen/ref-crops/photo-cappadocia.png?v=20260607a", href: "/collections" }),
          block("destination_marrakech", "destination", { title: "Marrakech", description: "Warm arches, desert tones, and cinematic evening light.", tag: "Desert", tags: "Africa|Desert|City", location: "Marrakech, Morocco", imageUrl: "/assets/site-media/lumen/ref-crops/photo-marrakech.png?v=20260607a", href: "/collections" })
        ]
      }
    ]
  },
  example_gallery: {
    type: "example_gallery",
    label: "Example Gallery",
    category: "Storefront",
    description: "Editorial example wall with real-looking photo destinations and captions.",
    maxBlocks: 18,
    settings: [
      text("anchor", "Anchor", "examples"),
      text("eyebrow", "Eyebrow", "Inspiring examples"),
      text("title", "Title", "Inspiring examples"),
      textarea("subtitle", "Subtitle", "Choose a visual direction from real-looking photo worlds, then start a private album request.")
    ],
    blocks: [exampleCardBlock],
    presets: [
      {
        label: "MydreamShoots inspiration wall",
        settings: {
          anchor: "examples",
          eyebrow: "Inspiring examples",
          title: "Inspiring Examples",
          subtitle: "Choose a visual direction from real-looking photo worlds, then start a private album request."
        },
        blocks: [
          block("example_santorini", "example", { title: "Coastal Romance", description: "White and blue dreams in Santorini.", location: "Santorini, Greece", imageUrl: "/assets/site-media/lumen/ref-crops/photo-santorini.png?v=20260607a", href: "/collections" }),
          block("example_marrakech", "example", { title: "Exotic Elegance", description: "Rich textures and timeless Moorish architecture.", location: "Marrakech, Morocco", imageUrl: "/assets/site-media/lumen/ref-crops/photo-marrakech.png?v=20260607a", href: "/collections" }),
          block("example_cappadocia", "example", { title: "Adventure & Magic", description: "Balloon-filled skies and unforgettable moments.", location: "Cappadocia, Turkey", imageUrl: "/assets/site-media/lumen/ref-crops/photo-cappadocia.png?v=20260607a", href: "/collections" }),
          block("example_paris", "example", { title: "City Chic", description: "Iconic cities, cinematic love stories.", location: "Paris, France", imageUrl: "/assets/site-media/lumen/ref-crops/photo-paris.png?v=20260607a", href: "/collections" }),
          block("example_bali", "example", { title: "Tropical Paradise", description: "Lush jungles and serene tropical story moments.", location: "Bali, Indonesia", imageUrl: "/assets/site-media/lumen/ref-crops/photo-bali.png?v=20260607a", href: "/collections" })
        ]
      }
    ]
  },
  video_feature: {
    type: "video_feature",
    label: "Video Feature",
    category: "Storefront",
    description: "Large media player-style module for tutorial or how-it-works video framing.",
    maxBlocks: 8,
    settings: [
      text("anchor", "Anchor", "how-it-works"),
      text("eyebrow", "Eyebrow", "Tutorial"),
      text("title", "Title", "See how it works"),
      textarea("subtitle", "Subtitle", "Frame a featured photo story, collection, or sports campaign."),
      image("imageUrl", "Poster image"),
      text("videoBadge", "Video badge", "HAPPY NEW YEAR"),
      text("playLabel", "Play label", "Watch tutorial")
    ]
  },
  email_start_panel: {
    type: "email_start_panel",
    label: "Email Start Panel",
    category: "AI business",
    description: "MydreamShoots-style email capture and quick-start entry panel for customers.",
    maxBlocks: 4,
    settings: [
      text("anchor", "Anchor", "start"),
      text("eyebrow", "Eyebrow", "Start your AI shoot"),
      text("title", "Title", "Begin with your email and choose a photo package."),
      textarea("subtitle", "Subtitle", "Start with a private account, choose a collection, and keep every album delivery in one secure workspace."),
      text("placeholder", "Email placeholder", "you@example.com"),
      text("buttonLabel", "Button label", "Continue"),
      url("actionHref", "Action link", "/login")
    ],
    blocks: [statBlock],
    presets: [
      {
        label: "MydreamShoots email start",
        settings: {
          anchor: "start",
          eyebrow: "Start your AI shoot",
          title: "Begin with email, then build a private photo album.",
          subtitle: "Start with a private account, choose a collection, and keep every album delivery in one secure workspace.",
          placeholder: "you@example.com",
          buttonLabel: "Continue",
          actionHref: "/login"
        },
        blocks: [
          block("start_metric_credits", "stat", { value: "Credits", label: "subscription or pack checkout" }),
          block("start_metric_private", "stat", { value: "Private", label: "customer uploads" }),
          block("start_metric_albums", "stat", { value: "Albums", label: "download-ready result delivery" })
        ]
      }
    ]
  },
  media_banner: {
    type: "media_banner",
    label: "Media Banner",
    category: "Storefront",
    description: "Large campaign banner with image, overlay copy, and CTA.",
    maxBlocks: 3,
    settings: [
      text("anchor", "Anchor", "shoots"),
      text("eyebrow", "Eyebrow", "Campaign banner"),
      text("title", "Title", "Promote a sports fan AI photo collection."),
      textarea("subtitle", "Subtitle"),
      image("imageUrl", "Image URL"),
      text("imageCaption", "Image caption", "Private album workflow"),
      textarea("imageMeta", "Image meta", "Upload, hold credits, create, and deliver from one customer account."),
      text("ctaLabel", "CTA label", "Explore"),
      url("ctaHref", "CTA link", "#packages"),
      select(
        "tone",
        "Tone",
        [
          ["dark", "Dark"],
          ["light", "Light"],
          ["warm", "Warm"]
        ],
        "warm"
      )
    ],
    blocks: [statBlock]
  },
  luxury_highlight: {
    type: "luxury_highlight",
    label: "Luxury Highlight",
    category: "Storefront",
    description: "Dark premium showcase with selling points and a horizontal scene rail.",
    maxBlocks: 12,
    settings: [
      text("anchor", "Anchor", "possibilities"),
      text("eyebrow", "Eyebrow", "AI makes it possible"),
      text("title", "Title", "AI Makes It Possible."),
      textarea("subtitle", "Subtitle", "Create destination photo scenes without travel or physical production."),
      image("leadImageUrl", "Lead image"),
      text("leadKicker", "Lead card kicker", "from one upload"),
      text("leadTitle", "Lead card title", "Turn everyday portraits into a complete destination photo story."),
      text("leadSideKicker", "Side card kicker", "private delivery"),
      textarea("leadSideBody", "Side card body", "Choose a package, track the album, and receive finished images in a secure customer gallery."),
      text("ctaLabel", "CTA label", "See styles"),
      url("ctaHref", "CTA link", "#styles")
    ],
    blocks: [cardBlock, exampleCardBlock],
    presets: [
      {
        label: "MydreamShoots black solution showcase",
        settings: {
          anchor: "possibilities",
          eyebrow: "AI makes it possible",
          title: "AI Makes It Possible.",
          subtitle: "Get the AI photos you have always dreamed of without leaving home.",
          leadImageUrl: "/assets/site-media/lumen/ref-crops/photo-paris.png?v=20260607a",
          leadKicker: "from one upload",
          leadTitle: "Turn everyday portraits into a complete destination photo story.",
          leadSideKicker: "private delivery",
          leadSideBody: "Choose a package, track the album, and receive finished images in a secure customer gallery.",
          ctaLabel: "See styles",
          ctaHref: "#styles"
        },
        blocks: [
          block("luxury_point_1", "card", { meta: "01", title: "Any destination, any style", text: "From Paris to Bali, Sahara to Santorini." }),
          block("luxury_point_2", "card", { meta: "02", title: "Photorealistic photo scenes", text: "Looks realistic, cinematic, and editorial-ready." }),
          block("luxury_point_3", "card", { meta: "03", title: "Save time and production cost", text: "No travel, no production spend, just beautiful delivery." }),
          block("luxury_point_4", "card", { meta: "04", title: "Your story, your way", text: "Custom poses, styling, scene mood, and destination worlds." }),
          block("luxury_scene_santorini", "example", { title: "Santorini", description: "Cliffside story moments", location: "Santorini, Greece", imageUrl: "/assets/site-media/lumen/ref-crops/photo-santorini.png?v=20260607a", href: "/collections" }),
          block("luxury_scene_marrakech", "example", { title: "Marrakech", description: "Desert elegance", location: "Marrakech, Morocco", imageUrl: "/assets/site-media/lumen/ref-crops/photo-marrakech.png?v=20260607a", href: "/collections" }),
          block("luxury_scene_bali", "example", { title: "Bali", description: "Tropical story moments", location: "Bali, Indonesia", imageUrl: "/assets/site-media/lumen/ref-crops/photo-bali.png?v=20260607a", href: "/collections" })
        ]
      }
    ]
  },
  occasion_showcase: {
    type: "occasion_showcase",
    label: "Occasion Showcase",
    category: "Storefront",
    description: "Image-led occasion rows for photo shoots, creators, travels, headshots, and gift use cases.",
    maxBlocks: 12,
    settings: [
      text("anchor", "Anchor", "occasions"),
      text("eyebrow", "Eyebrow", "Photo occasions"),
      text("title", "Title", "Choose the story your AI shoot should tell."),
      textarea("subtitle", "Subtitle", "Merchandise photo moments, destination styles, and customer use cases.")
    ],
    blocks: [
      {
        type: "occasion",
        label: "Occasion",
        settings: [
          text("title", "Title", "Photo"),
          textarea("description", "Description", "Creator portraits for profiles, albums, and campaign pages."),
          text("tag", "Tag", "Creator"),
          image("imageUrl", "Image URL"),
          url("href", "Link", "/tools")
        ],
        preset: {
          label: "Occasion",
          settings: {
            title: "Photo",
            description: "Creator portraits for profiles, albums, and campaign pages.",
            tag: "Creator",
            imageUrl: "",
            href: "/tools"
          }
        }
      }
    ],
    presets: [
      {
        label: "AI photo occasions",
        settings: {
          anchor: "occasions",
          eyebrow: "Photo occasions",
          title: "Choose the story your AI shoot should tell.",
          subtitle: "Show concrete photo outcomes instead of an empty prompt field."
        },
        blocks: [
          block("occasion_photo", "occasion", { title: "Photo", description: "Profile, scene, and editorial creator looks.", tag: "Creator", imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png", href: "/tools/creator-portrait" }),
          block("occasion_travel", "occasion", { title: "Sports fan portraits", description: "Stadium scenes, fan posters, and profile photos for match-day campaigns.", tag: "Sports", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/banner-cover.png", href: "/tools/world-cup-fan-photos" }),
          block("occasion_headshot", "occasion", { title: "Headshots", description: "Professional photos for founders, job search, and teams.", tag: "Professional", imageUrl: "/assets/dreamshoot/editorial-headshot.svg", href: "/tools/headshot" })
        ]
      }
    ]
  },
  ai_feature_launcher: {
    type: "ai_feature_launcher",
    label: "AI Feature Launcher",
    category: "AI business",
    description: "Customer-facing launcher for enabled tools, uploads, training, albums, and credits.",
    maxBlocks: 8,
    settings: [
      text("anchor", "Anchor", "features"),
      text("eyebrow", "Eyebrow", "AI studio features"),
      text("title", "Title", "Everything customers need to create and manage albums."),
      textarea("subtitle", "Subtitle", "Give customers a clear path from upload to progress tracking, delivery, and credit management."),
      select(
        "surface",
        "Surface",
        [
          ["showcase", "Showcase"],
          ["workspace", "Workspace"],
          ["account", "Account"]
        ],
        "showcase"
      ),
      textarea("chipList", "Top chips", "Private customer account|Album-ready workflow|Live credits and delivery", "Use | to separate short chips."),
      text("ctaLabel", "Primary CTA", "Open workspace"),
      url("ctaHref", "Primary CTA link", "/app"),
      media("imageUrl", "Feature image")
    ],
    blocks: [
      {
        type: "feature",
        label: "Feature",
        settings: [
          text("title", "Title", "Upload photos"),
          textarea("description", "Description", "Add private intake images to the current customer account."),
          text("meta", "Meta", "Private assets"),
          url("href", "Link", "/app")
        ],
        preset: { label: "Feature", settings: { title: "Upload photos", description: "Add private intake images to the current customer account.", meta: "Private assets", href: "/app" } }
      }
    ],
    presets: [
      {
        label: "Feature launcher grid",
        settings: {
          anchor: "features",
          eyebrow: "AI studio features",
          title: "A real product frontend, not just a landing page.",
          subtitle: "Customers can log in, upload, start album requests, check progress, view albums, and manage credits.",
          surface: "showcase",
          chipList: "Private customer account|Album-ready workflow|Live credits and delivery",
          ctaLabel: "Open workspace",
          ctaHref: "/app"
        },
        blocks: [
          block("launcher_uploads", "feature", { title: "Upload photos", description: "Collect selfies and source images inside a private customer workspace.", meta: "Private intake", href: "/app" }),
          block("launcher_train", "feature", { title: "Train models", description: "Prepare solo, creator, or brand models before package generation.", meta: "Model state", href: "/app" }),
          block("launcher_progress", "feature", { title: "Track requests", description: "Show waiting, creating, delivered, review, and returned-credit states.", meta: "Live progress", href: "/app" }),
          block("launcher_albums", "feature", { title: "Download albums", description: "Deliver finished images to private customer galleries.", meta: "Private gallery", href: "/app" })
        ]
      }
    ]
  },
  feature_grid: {
    type: "feature_grid",
    label: "Feature / Pack Grid",
    category: "Storefront",
    description: "Manual feature blocks or product-bound creative pack grid.",
    maxBlocks: 8,
    settings: [
      text("anchor", "Anchor", "workflow"),
      text("eyebrow", "Eyebrow", "How it works"),
      text("title", "Title", "Explain the customer flow."),
      textarea("subtitle", "Subtitle"),
      select(
        "source",
        "Content source",
        [
          ["blocks", "Manual blocks"],
          ["creative_packs", "Active creative packs"]
        ],
        "blocks"
      ),
      select(
        "layout",
        "Layout",
        [
          ["asymmetric", "Asymmetric"],
          ["steps", "Steps"],
          ["masonry", "Masonry"]
        ],
        "asymmetric"
      )
    ],
    blocks: [cardBlock],
    presets: [
      {
        label: "How it works",
        settings: {
          anchor: "workflow",
          eyebrow: "How it works",
          title: "A storefront flow customers can understand in seconds.",
          subtitle: "Guide customers from upload to private album delivery.",
          source: "blocks",
          layout: "steps"
        },
        blocks: [
          block("feature_upload", "card", { title: "Upload", text: "Add clear selfies for each person. Files stay scoped to this site and customer.", meta: "Step 01", imageUrl: "" }),
          block("feature_train", "card", { title: "Train", text: "Build a private solo or creator model before generating themed albums.", meta: "Step 02", imageUrl: "" }),
          block("feature_generate", "card", { title: "Generate", text: "Pick a collection, spend credits, and begin the private image request.", meta: "Step 03", imageUrl: "" }),
          block("feature_download", "card", { title: "Download", text: "Results land in the customer's album with private delivery and audit history.", meta: "Step 04", imageUrl: "" })
        ]
      }
    ]
  },
  photo_package_wall: {
    type: "photo_package_wall",
    label: "Photo Package Wall",
    category: "Storefront",
    description: "MydreamShoots-style package catalog with image-rich cards and real pack bindings.",
    maxBlocks: 24,
    settings: [
      text("anchor", "Anchor", "packages"),
      text("eyebrow", "Eyebrow", "Photo packages"),
      text("title", "Title", "Choose a shoot style and generate a private album."),
      textarea("subtitle", "Subtitle", "Show active collections or curate a focused package wall for customers."),
      select(
        "source",
        "Content source",
        [
          ["creative_packs", "Active creative packs"],
          ["blocks", "Manual package blocks"]
        ],
        "creative_packs"
      ),
      select(
        "layout",
        "Layout",
        [
          ["editorial", "Editorial wall"],
          ["compact", "Compact grid"],
          ["carousel", "Horizontal shelf"]
        ],
        "editorial"
      )
    ],
    blocks: [
      {
        type: "package",
        label: "Package",
        settings: [
          text("title", "Title", "Photo Story Album"),
          textarea("description", "Description", "AI portraits for profiles, creator pages, product launches, and private albums."),
          text("meta", "Meta", "40 photos"),
          text("credits", "Credits", "24 credits"),
          image("imageUrl", "Image URL"),
          url("href", "Link", "/tools")
        ],
        preset: {
          label: "Package",
          settings: {
            title: "Photo Story Album",
            description: "AI portraits for profiles, creator pages, product launches, and private albums.",
            meta: "40 photos",
            credits: "24 credits",
            imageUrl: "",
            href: "/tools"
          }
        }
      }
    ],
    presets: [
      {
        label: "MydreamShoots-style package wall",
        settings: {
          anchor: "packages",
          eyebrow: "Photo packages",
          title: "A package catalog built for AI photo subscriptions.",
          subtitle: "Show scene, style, creator, sports, and headshot collections with clear credit costs and delivery promises.",
          source: "creative_packs",
          layout: "editorial"
        },
        blocks: [
          block("pkg_photo", "package", {
            title: "Photo Story Album",
            description: "Scene, editorial, and announcement looks generated from private customer uploads.",
            meta: "40 photos",
            credits: "24 credits",
            imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
            href: "/tools/creator-portrait"
          }),
          block("pkg_headshots", "package", {
            title: "Professional Headshots",
            description: "LinkedIn-ready portraits for founders, operators, and consultants.",
            meta: "20 photos",
            credits: "16 credits",
            imageUrl: "/assets/dreamshoot/editorial-headshot.svg",
            href: "/tools/headshot"
          }),
          block("pkg_editorial", "package", {
            title: "Editorial Studio Set",
            description: "Fashion lighting, magazine crops, and premium social profile imagery.",
            meta: "40 photos",
            credits: "20 credits",
            imageUrl: "/assets/dreamshoot/editorial-headshot.svg",
            href: "/tools/fashion-editorial"
          })
        ]
      }
    ]
  },
  sample_strip: {
    type: "sample_strip",
    label: "Sample Strip",
    category: "Storefront",
    description: "MydreamShoots-style horizontal sample gallery for showing many generated looks.",
    maxBlocks: 20,
    settings: [
      text("anchor", "Anchor", "samples"),
      text("eyebrow", "Eyebrow", "Generated looks"),
      text("title", "Title", "A full shoot library from a handful of selfies."),
      textarea("subtitle", "Subtitle", "Use this band to show the breadth of photo styles available in the AI studio."),
      text("cardBadgeLabel", "Card badge label", "Before AI"),
      textarea("footerBody", "Footer body", "MydreamShoots turns those planning limits into a private album workflow: choose a package, upload source photos, and receive an editorial story without booking a studio shoot."),
      text("footerCtaLabel", "Footer CTA label", "See the AI solution"),
      url("footerCtaHref", "Footer CTA link", "#possibilities"),
      select(
        "speed",
        "Motion",
        [
          ["slow", "Slow drift"],
          ["still", "Still"]
        ],
        "slow"
      )
    ],
    blocks: [
      {
        type: "sample",
        label: "Sample image",
        settings: [text("label", "Label", "Photo editorial"), image("imageUrl", "Image URL"), text("meta", "Meta", "40-photo pack")],
        preset: { label: "Sample image", settings: { label: "Photo editorial", imageUrl: "", meta: "40-photo pack" } }
      }
    ],
    presets: [
      {
        label: "MydreamShoots pain-point wall",
        settings: {
          anchor: "pain-points",
          eyebrow: "AI photo problems",
          title: "Tired of these AI photo problems?",
          subtitle: "Turn the biggest photo objections into a clear before-AI story, then guide customers toward a private AI album.",
          cardBadgeLabel: "Before AI",
          footerBody: "MydreamShoots turns those planning limits into a private album workflow: choose a package, upload source photos, and receive an editorial story without booking a studio shoot.",
          footerCtaLabel: "See the AI solution",
          footerCtaHref: "#possibilities",
          speed: "still"
        },
        blocks: [
          block("pain_expensive", "sample", { label: "Too Expensive", imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png", meta: "Studio photo shoots cost a fortune." }),
          block("pain_time", "sample", { label: "Time-Consuming", imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png", meta: "Trips, visas, and schedules slow everything down." }),
          block("pain_weather", "sample", { label: "Weather Unpredictable", imageUrl: "/assets/dreamshoot/frames/story-beauty-portrait.png", meta: "Rain, wind, and storms can ruin the perfect shot." }),
          block("pain_choices", "sample", { label: "Limited Choices", imageUrl: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png", meta: "Customers cannot book every style, city, or studio they imagine." })
        ]
      },
      {
        label: "MydreamShoots-style sample band",
        settings: {
          anchor: "samples",
          eyebrow: "Generated looks",
          title: "One upload set can become photo, travel, headshot, and fashion photos.",
          subtitle: "A visual shelf gives customers confidence before they register or subscribe.",
          cardBadgeLabel: "Generated style",
          footerBody: "",
          footerCtaLabel: "",
          footerCtaHref: "#packages",
          speed: "slow"
        },
        blocks: [
          block("sample_photo", "sample", { label: "Photo", imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png", meta: "Creator album" }),
          block("sample_headshot", "sample", { label: "Headshot", imageUrl: "/assets/dreamshoot/editorial-headshot.svg", meta: "Profile pack" }),
          block("sample_fashion", "sample", { label: "Editorial", imageUrl: "/assets/dreamshoot/editorial-headshot.svg", meta: "Studio set" }),
          block("sample_travel", "sample", { label: "Sports", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/match-day-avatar.png", meta: "Fan photo pack" })
        ]
      }
    ]
  },
  studio_steps: {
    type: "studio_steps",
    label: "Studio Steps",
    category: "Storefront",
    description: "Customer education section with upload, train, generate, and delivery steps.",
    maxBlocks: 6,
    settings: [
      text("anchor", "Anchor", "workflow"),
      text("eyebrow", "Eyebrow", "How it works"),
      text("title", "Title", "From selfies to private photo albums."),
      textarea("subtitle", "Subtitle", "Explain the complete AI photo journey from upload to private album delivery."),
      image("imageUrl", "Workflow image URL")
    ],
    blocks: [cardBlock],
    presets: [
      {
        label: "Upload to album workflow",
        settings: {
          anchor: "workflow",
          eyebrow: "How it works",
          title: "Customers know exactly what happens after signup.",
          subtitle: "A clear photo-album flow: upload portraits, choose a collection, generate images, and receive a private gallery.",
          imageUrl: "/assets/dreamshoot/beauty-portrait.svg"
        },
        blocks: [
          block("step_upload", "card", { title: "Upload selfies", text: "Customers add clear photos for each person. Uploads stay private inside their photo account.", meta: "01", imageUrl: "" }),
          block("step_train", "card", { title: "Prepare your look", text: "A private creator profile helps keep faces, styling, and scene details consistent.", meta: "02", imageUrl: "" }),
          block("step_choose", "card", { title: "Choose a collection", text: "Pick the photo destination, output count, and credit level that fits the story.", meta: "03", imageUrl: "" }),
          block("step_deliver", "card", { title: "Deliver album", text: "Finished results arrive in a private gallery with credits settled automatically.", meta: "04", imageUrl: "" })
        ]
      }
    ]
  },
  conversion_panel: {
    type: "conversion_panel",
    label: "Conversion Panel",
    category: "Commerce",
    description: "Large offer panel that combines plan, credits, trust, and CTA.",
    maxBlocks: 6,
    settings: [
      text("anchor", "Anchor", "start"),
      text("eyebrow", "Eyebrow", "Start creating"),
      text("title", "Title", "Open a private AI studio account."),
      textarea("subtitle", "Subtitle", "Move customers from inspiration into a private account, plan choice, upload intake, and finished album delivery."),
      text("primaryCta", "Primary CTA", "Create account"),
      url("primaryHref", "Primary link", "/login"),
      text("secondaryCta", "Secondary CTA", "View pricing"),
      url("secondaryHref", "Secondary link", "/pricing")
    ],
    blocks: [statBlock],
    presets: [
      {
        label: "Paid studio CTA",
        settings: {
          anchor: "start",
          eyebrow: "Start creating",
          title: "Launch a private photoshoot in minutes.",
          subtitle: "Choose a plan, upload source portraits, and keep every generated photo album in one private workspace.",
          primaryCta: "Create account",
          primaryHref: "/login",
          secondaryCta: "View pricing",
          secondaryHref: "/pricing"
        },
        blocks: [
          block("cta_metric_outputs", "stat", { value: "40", label: "images in premium packs" }),
          block("cta_metric_private", "stat", { value: "Private", label: "customer albums" }),
          block("cta_metric_credits", "stat", { value: "Credits", label: "clear checkout history" })
        ]
      }
    ]
  },
  dreamshoot_feature_tabs: {
    type: "dreamshoot_feature_tabs",
    label: "MydreamShoots Feature Tabs",
    category: "Storefront",
    description: "Hero-adjacent feature selector for photo packages, videos, virtual try-on, and background changes.",
    maxBlocks: 8,
    settings: [
      text("anchor", "Anchor", "features"),
      text("eyebrow", "Eyebrow", "AI photo tools"),
      text("title", "Title", "Pick what you want to create first."),
      textarea("subtitle", "Subtitle", "Give customers clear creation paths before they upload private AI photos."),
      select(
        "layout",
        "Layout",
        [
          ["split", "Split preview"],
          ["rail", "Button rail"]
        ],
        "split"
      )
    ],
    blocks: [featureTabBlock],
    presets: [
      {
        label: "MydreamShoots feature rail",
        settings: {
          anchor: "features",
          eyebrow: "AI photo tools",
          title: "Choose the photo flow before signup.",
          subtitle: "Let customers choose a clear creation path before they begin a private photo package request.",
          layout: "split"
        },
        blocks: [
          block("tab_packages", "feature_tab", {
            label: "Photo packages",
            title: "AI photo package studio",
            description: "Create headshots, creator portraits, gala scenes, World Cup fan photos, and style previews from everyday uploads.",
            imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
            href: "/tools"
          }),
          block("tab_video", "feature_tab", {
            label: "Video scenes",
            title: "Short-form photo video packs",
            description: "Package generated portraits into social-ready scenes for campaigns and client delivery.",
            imageUrl: "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png",
            href: "/tools"
          }),
          block("tab_tryon", "feature_tab", {
            label: "Virtual try-on",
            title: "Preview outfits and themed looks",
            description: "Use style prompts and pack rules to simulate editorial looks before generation starts.",
            imageUrl: "/assets/dreamshoot/editorial-headshot.svg",
            href: "/tools"
          })
        ]
      }
    ]
  },
  dreamshoot_tool_collection: {
    type: "dreamshoot_tool_collection",
    label: "Paid Tool Collection",
    category: "AI business",
    description: "MydreamShoots-style paid tools directory that turns utility traffic into subscriptions.",
    maxBlocks: 36,
    settings: [
      text("anchor", "Anchor", "tools"),
      text("eyebrow", "Eyebrow", "AI tools"),
      text("title", "Title", "Paid AI tools that lead into private photo packs."),
      textarea("subtitle", "Subtitle", "Offer quick single-purpose tools, then route serious customers into login, credits, and premium scene packs."),
      textarea("categories", "Categories", "Photo AI|AI Photo Edit|Video AI", "Use | to separate category tabs."),
      text("primaryCta", "Primary CTA", "Start private studio"),
      url("primaryHref", "Primary link", "/login"),
      text("secondaryCta", "Secondary CTA", "View packs"),
      url("secondaryHref", "Secondary link", "/collections"),
      select(
        "layout",
        "Layout",
        [
          ["mega_menu", "Mega menu"],
          ["directory", "Directory"],
          ["compact", "Compact"],
          ["dark", "Dark showcase"]
        ],
        "directory"
      )
    ],
    blocks: [dreamshootToolBlock],
    presets: [
      {
        label: "MydreamShoots paid tools directory",
        settings: {
          anchor: "tools",
          eyebrow: "AI tools",
          title: "A paid tool wall that feeds the studio.",
          subtitle: "Reference-style utility categories help customers try simple edits first, then move into private photo packs, credits, and album delivery.",
          categories: "Photo AI|AI Photo Edit|Video AI",
          primaryCta: "Start private studio",
          primaryHref: "/login",
          secondaryCta: "View all tools",
          secondaryHref: "/tools",
          layout: "mega_menu"
        },
        blocks: [
          block("tool_headshot", "tool_card", { title: "Professional headshot maker", description: "Create clean profile portraits for resumes, teams, and founder pages.", category: "Photo AI", badge: "Profile", imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png", href: "/tools/headshot" }),
          block("tool_worldcup", "tool_card", { title: "World Cup fan photos", description: "Build stadium scenes, fan posters, and match-day profile images.", category: "Photo AI", badge: "Sports", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png", href: "/tools/world-cup-fan-photos" }),
          block("tool_bg_changer", "tool_card", { title: "Background changer", description: "Replace a plain selfie background before ordering a full photo package.", category: "AI Photo Edit", badge: "Studio", imageUrl: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png", href: "/tools/background-changer" }),
          block("tool_photo_enhancer", "tool_card", { title: "Photo enhancer", description: "Improve low-light uploads before using them for private model training.", category: "AI Photo Edit", badge: "Studio", imageUrl: "/assets/dreamshoot/frames/story-beauty-portrait.png", href: "/tools/photo-enhancer" }),
          block("tool_image_to_video", "tool_card", { title: "Image to video concept", description: "Turn a finished photo package image into a short motion concept.", category: "Video AI", badge: "Preview", imageUrl: "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png", href: "/tools/image-to-video" }),
          block("tool_fan_motion", "tool_card", { title: "Fan poster motion", description: "Animate World Cup fan posters and match-day profile scenes.", category: "Video AI", badge: "Sports", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/fan-poster.png", href: "/tools/fan-poster-motion" })
        ]
      }
    ]
  },
  dreamshoot_package_taxonomy: {
    type: "dreamshoot_package_taxonomy",
    label: "MydreamShoots Package Taxonomy",
    category: "Storefront",
    description: "Reference-style package taxonomy for headshot, style, travel, gala, creator, sports, and video directions.",
    maxBlocks: 20,
    settings: [
      text("anchor", "Anchor", "package-taxonomy"),
      text("eyebrow", "Eyebrow", "Photo package library"),
      text("title", "Title", "Package categories customers already understand."),
      textarea("subtitle", "Subtitle", "Group the storefront by finished photo direction. Each category can link to the pack wall, a tool page, or search results."),
      select(
        "layout",
        "Layout",
        [
          ["seo_grid", "SEO grid"],
          ["editorial", "Editorial"],
          ["compact", "Compact"]
        ],
        "seo_grid"
      )
    ],
    blocks: [dreamshootTaxonomyBlock],
    presets: [
      {
        label: "MydreamShoots package categories",
        settings: {
          anchor: "package-taxonomy",
          eyebrow: "Photo package library",
          title: "Package categories customers already understand.",
          subtitle: "Mirror the reference-site strategy: broad outcome families on the page, specific paid packs behind the cards.",
          layout: "seo_grid"
        },
        blocks: [
          block("taxonomy_core", "taxonomy_card", { title: "Photo package studio", description: "Headshot, gala, travel, sports, beauty, and creator scenes.", meta: "Core", keywords: "headshots|gala photos|creator portraits", imageUrl: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png", href: "/collections/creative" }),
          block("taxonomy_headshot", "taxonomy_card", { title: "Professional headshots", description: "Profile photos for LinkedIn, founders, resumes, and teams.", meta: "Professional", keywords: "headshot|profile|linkedin", imageUrl: "/assets/dreamshoot/editorial-headshot-gpt2.png", href: "/collections/headshots" }),
          block("taxonomy_gala", "taxonomy_card", { title: "Gala and night-out", description: "Formal looks, evening styling, and red-carpet style portraits.", meta: "Style", keywords: "gala|formal|night out", imageUrl: "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png", href: "/collections/gala" }),
          block("taxonomy_travel", "taxonomy_card", { title: "Travel scenes", description: "Destination-style portraits without booking a photographer.", meta: "Lifestyle", keywords: "travel|destination|vacation", imageUrl: "/assets/dreamshoot/generated/20260619/nature-adventure-solo-v1.png", href: "/collections/travel" }),
          block("taxonomy_sports", "taxonomy_card", { title: "World Cup fan photos", description: "Stadium fan scenes, fan posters, and match-day profile photos.", meta: "Sports", keywords: "world cup|football fan|match day avatar", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/friend-fan-photos.png", href: "/collections/sports" }),
          block("taxonomy_tryon", "taxonomy_card", { title: "Virtual try-on", description: "Preview wardrobe, styling, and creator outfits before generation.", meta: "Try-on", keywords: "try on|outfit|style", imageUrl: "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png", href: "/tools/virtual-try-on" })
        ]
      }
    ]
  },
  dreamshoot_visual_proof: {
    type: "dreamshoot_visual_proof",
    label: "MydreamShoots Visual Proof Gallery",
    category: "Storefront",
    description: "Second-screen proof gallery that sells finished photo outcomes before features.",
    maxBlocks: 8,
    settings: [
      text("anchor", "Anchor", "proof-gallery"),
      text("label", "Small label", "Visual proof gallery"),
      text("title", "Title", "See what your selfies can become."),
      textarea("subtitle", "Subtitle", "Lead with finished albums by intent, not a long feature list."),
      textarea("tabs", "Tabs", "All|Sports|Headshots|Beauty|Creative|Wedding|Seasonal|Video"),
      textarea("badges", "Badges", "Private model|Album-ready|15+ package themes"),
      text("primaryCta", "Primary CTA", "Start this pack"),
      url("primaryHref", "Primary link", "/login")
    ],
    blocks: [dreamshootProofCardBlock],
    presets: [
      {
        label: "Visual proof gallery",
        settings: {
          anchor: "proof-gallery",
          label: "Visual proof gallery",
          title: "See what your selfies can become.",
          subtitle: "Lead with finished albums by intent, not a long feature list.",
          tabs: "All|Sports|Headshots|Beauty|Creative|Wedding|Seasonal|Video",
          badges: "Private model|Album-ready|15+ package themes",
          primaryCta: "Start this pack",
          primaryHref: "/login"
        },
        blocks: [
          block("proof_worldcup", "proof_card", { title: "World Cup fan photos", description: "Stadium posters, match-day portraits, and fan profile scenes.", category: "Sports", badge: "Sports", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/friend-fan-photos.png", href: "/collections/sports" }),
          block("proof_headshots", "proof_card", { title: "Professional portraits", description: "Clean founder, resume, and team-ready headshots.", category: "Headshots", badge: "Business", imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png", href: "/collections/headshots" }),
          block("proof_style", "proof_card", { title: "Style previews", description: "Hairstyle, beauty, and try-on looks before a full album.", category: "Beauty", badge: "Beauty", imageUrl: "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png", href: "/collections/beauty" }),
          block("proof_creative", "proof_card", { title: "Cinematic worlds", description: "Cyberpunk, gala, noir, and editorial scene concepts.", category: "Creative", badge: "Creative", imageUrl: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png", href: "/collections/creative" }),
          block("proof_engagement", "proof_card", { title: "Engagement looks", description: "Announcement-ready portraits, proposal scenes, and romantic album ideas.", category: "Couple", badge: "Couple", imageUrl: "/assets/dreamshoot/frames/sample-engagement.png", href: "/collections/couple" })
        ]
      }
    ]
  },
  dreamshoot_featured_pack: {
    type: "dreamshoot_featured_pack",
    label: "MydreamShoots Featured Pack",
    category: "Storefront",
    description: "Seasonal or campaign pack module with a large offer panel and image collage.",
    maxBlocks: 8,
    settings: [
      text("anchor", "Anchor", "featured-pack"),
      text("label", "Small label", "Featured seasonal pack"),
      text("badge", "Offer badge", "Match-day pack"),
      text("title", "Title", "World Cup fan photos for match-day moments."),
      textarea("subtitle", "Subtitle", "Turn everyday selfies into fan posters, stadium-style portraits, match-day avatars, and private albums built for social sharing."),
      text("primaryCta", "Primary CTA", "Create Fan Photos"),
      url("primaryHref", "Primary link", "/login"),
      text("secondaryCta", "Secondary CTA", "View Sports Packs"),
      url("secondaryHref", "Secondary link", "/collections"),
      text("photos", "Photos stat", "40 photos"),
      text("credits", "Credits stat", "26 credits"),
      text("privacy", "Privacy stat", "Private album"),
      text("includedTitle", "Included title", "Included outputs"),
      textarea("includedOutputs", "Included outputs", "Fan posters|Large portrait graphics for match day|Stadium portraits|Cinematic scenes with floodlights|Match-day avatars|Profile-ready square crops|Social banners|Wide cover images for sharing"),
      textarea("safetyCopy", "Safety copy", "Safe styling: no real player likenesses, official team logos, or protected marks required."),
      text("overlayTitle", "Overlay title", "World Cup Pack"),
      text("overlaySubtitle", "Overlay subtitle", "Match-day looks without a studio."),
      textarea("overlayChips", "Overlay chips", "fan poster|avatar|stadium|social-ready"),
      textarea("bottomNote", "Bottom note", "Seasonal packs rotate around tournaments, holidays, and high-intent photo moments."),
      text("campaignLabel", "Campaign label", "Current campaign: World Cup Fan Photos"),
      text("nextCampaignLabel", "Next campaign label", "Next: Valentine / Graduation Season")
    ],
    blocks: [dreamshootSeasonalImageBlock],
    presets: [
      {
        label: "Featured seasonal pack",
        settings: {
          anchor: "featured-pack",
          label: "Featured seasonal pack",
          badge: "Match-day pack",
          title: "World Cup fan photos for match-day moments.",
          subtitle: "Turn everyday selfies into fan posters, stadium-style portraits, match-day avatars, and private albums built for social sharing.",
          primaryCta: "Create Fan Photos",
          primaryHref: "/login",
          secondaryCta: "View Sports Packs",
          secondaryHref: "/collections",
          photos: "40 photos",
          credits: "26 credits",
          privacy: "Private album",
          includedTitle: "Included outputs",
          includedOutputs: "Fan posters|Large portrait graphics for match day|Stadium portraits|Cinematic scenes with floodlights|Match-day avatars|Profile-ready square crops|Social banners|Wide cover images for sharing",
          safetyCopy: "Safe styling: no real player likenesses, official team logos, or protected marks required.",
          overlayTitle: "World Cup Pack",
          overlaySubtitle: "Match-day looks without a studio.",
          overlayChips: "fan poster|avatar|stadium|social-ready",
          bottomNote: "Seasonal packs rotate around tournaments, holidays, and high-intent photo moments.",
          campaignLabel: "Current campaign: World Cup Fan Photos",
          nextCampaignLabel: "Next: Valentine / Graduation Season"
        },
        blocks: [
          block("seasonal_worldcup_1", "seasonal_image", { label: "Stadium Portrait", meta: "Cinematic fan look", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png", shape: "tall" }),
          block("seasonal_worldcup_2", "seasonal_image", { label: "Friend Fan Photos", meta: "Group-friendly shots", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/friend-fan-photos.png", shape: "wide" }),
          block("seasonal_worldcup_3", "seasonal_image", { label: "Match-day Avatar", meta: "Profile-ready crop", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/match-day-avatar.png", shape: "square" }),
          block("seasonal_worldcup_4", "seasonal_image", { label: "Fan Poster", meta: "Story and feed artwork", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/fan-poster.png", shape: "tall" }),
          block("seasonal_worldcup_5", "seasonal_image", { label: "Social Story", meta: "Mobile-first layout", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/social-story.png", shape: "tall" }),
          block("seasonal_worldcup_6", "seasonal_image", { label: "Banner / Cover", meta: "Wide campaign image", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/banner-cover.png", shape: "wide" })
        ]
      }
    ]
  },
  dreamshoot_package_catalog: {
    type: "dreamshoot_package_catalog",
    label: "MydreamShoots Package Catalog",
    category: "Storefront",
    description: "Complete package catalog section with featured cards and a full category strip.",
    maxBlocks: 32,
    settings: [
      text("anchor", "Anchor", "packages"),
      text("label", "Small label", "Photo package catalog"),
      text("title", "Title", "Choose a photo package first."),
      textarea("subtitle", "Subtitle", "Each card has a clear outcome, credit cost, photo count, and next action."),
      textarea("tabs", "Tabs", "All|Headshots|Beauty|Creative|Sports|Creator|Avatar|Wedding|Cultural|Couple|Boudoir|Seasonal|Travel|Video|Utility"),
      textarea("steps", "Buyer steps", "Pick pack|See credit cost|Generate album"),
      select(
        "source",
        "Catalog source",
        [
          ["creative_packs", "Active creative packs"],
          ["blocks", "Manual catalog blocks"]
        ],
        "creative_packs"
      ),
      range("featuredCount", "Featured cards", 5, 3, 6)
    ],
    blocks: [dreamshootCatalogPackBlock],
    presets: [
      {
        label: "Complete MydreamShoots catalog",
        settings: {
          anchor: "packages",
          label: "Photo package catalog",
          title: "Choose a photo package first.",
          subtitle: "Each card has a clear outcome, credit cost, photo count, and next action.",
          tabs: "All|Headshots|Beauty|Creative|Sports|Creator|Avatar|Wedding|Cultural|Couple|Boudoir|Seasonal|Travel|Video|Utility",
          steps: "Pick pack|See credit cost|Generate album",
          source: "creative_packs",
          featuredCount: 5
        },
        blocks: [
          block("catalog_worldcup", "catalog_pack", { title: "World Cup fan photos", description: "Match-day portraits, fan posters, and stadium-inspired profile images.", category: "Sports", meta: "40 photos", credits: "26 credits", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png", href: "/tools/world-cup-fan-photos" }),
          block("catalog_headshot", "catalog_pack", { title: "Professional Headshots", description: "LinkedIn, founder, resume, and team-ready portraits.", category: "Headshots", meta: "20 photos", credits: "20 credits", imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png", href: "/tools/headshot" }),
          block("catalog_cyberpunk", "catalog_pack", { title: "Cyberpunk", description: "Neon city portraits and future-fashion scenes.", category: "Creative", meta: "20 photos", credits: "26 credits", imageUrl: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png", href: "/tools/cyberpunk-portrait" }),
          block("catalog_gala", "catalog_pack", { title: "Gala Photos", description: "Formal night-out portraits and red-carpet styling.", category: "Creative", meta: "20 photos", credits: "24 credits", imageUrl: "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png", href: "/tools/gala-photo" }),
          block("catalog_wedding", "catalog_pack", { title: "Wedding portraits", description: "Wedding-style albums, couple portraits, and announcement-ready scenes.", category: "Wedding", meta: "24 photos", credits: "24 credits", imageUrl: "/assets/dreamshoot/frames/sample-wedding-trip.png", href: "/tools/wedding-portraits" }),
          block("catalog_indian_wedding", "catalog_pack", { title: "Indian Wedding", description: "Traditional Indian wedding looks with lehenga, saree, sherwani, jewelry, and album-ready portraits.", category: "Cultural", meta: "20 photos", credits: "24 credits", imageUrl: "/assets/dreamshoot/frames/story-wedding-look.png", href: "/tools/indian-wedding" }),
          block("catalog_christmas", "catalog_pack", { title: "Christmas Photos", description: "Solo festive portraits, greeting-card visuals, market scenes, and warm seasonal images.", category: "Seasonal", meta: "20 photos", credits: "20 credits", imageUrl: "/assets/dreamshoot/generated/20260619/christmas-solo-card-v1.png", href: "/tools/christmas-photos" })
        ]
      }
    ]
  },
  dreamshoot_flow_bridge: {
    type: "dreamshoot_flow_bridge",
    label: "MydreamShoots Flow Bridge",
    category: "Storefront",
    description: "How-it-works section that bridges package browsing into pricing.",
    maxBlocks: 8,
    settings: [
      text("anchor", "Anchor", "workflow"),
      text("label", "Small label", "Private album workflow"),
      text("title", "Title", "From upload to private album."),
      textarea("subtitle", "Subtitle", "Follow a clear four-step flow from source photos to a private gallery with visible credit use."),
      image("beforeImage", "Before image"),
      image("afterImage", "After image"),
      image("albumImageOne", "Album image one"),
      image("albumImageTwo", "Album image two"),
      image("albumImageThree", "Album image three"),
      text("bridgeCta", "Bridge CTA", "View plans and credits"),
      url("bridgeHref", "Bridge link", "/pricing")
    ],
    blocks: [cardBlock],
    presets: [
      {
        label: "Upload to album bridge",
        settings: {
          anchor: "workflow",
          label: "Private album workflow",
          title: "From upload to private album.",
          subtitle: "Follow a clear four-step flow from source photos to a private gallery with visible credit use.",
          beforeImage: "/assets/dreamshoot/frames/workflow-upload-source.png",
          afterImage: "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png",
          albumImageOne: "/assets/dreamshoot/generated/20260621-worldcup-pack/friend-fan-photos.png",
          albumImageTwo: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
          albumImageThree: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
          bridgeCta: "View plans and credits",
          bridgeHref: "/pricing"
        },
        blocks: [
          block("flow_upload", "card", { title: "Upload selfies", text: "Use 8-12 clear phone photos per person.", meta: "01" }),
          block("flow_model", "card", { title: "Build private model", text: "Keep identity consistent across packages.", meta: "02" }),
          block("flow_pack", "card", { title: "Pick a package", text: "Choose the finished photo direction.", meta: "03" }),
          block("flow_album", "card", { title: "Generate album", text: "Review, download, upscale, or make video.", meta: "04" })
        ]
      }
    ]
  },
  login_method_panel: {
    type: "login_method_panel",
    label: "Login Method Panel",
    category: "AI business",
    description: "Customer entry section with email and OAuth-style method blocks.",
    maxBlocks: 4,
    settings: [
      text("anchor", "Anchor", "start"),
      text("eyebrow", "Eyebrow", "Start studio"),
      text("title", "Title", "Generate your first private album from a secure account."),
      textarea("subtitle", "Subtitle", "Mirrors MydreamShoots's quick login pattern while routing into the site customer system."),
      text("emailPlaceholder", "Email placeholder", "you@example.com"),
      text("buttonLabel", "Email button", "Continue with email"),
      url("actionHref", "Action link", "/login"),
      media("imageUrl", "Feature image"),
      media("secondaryImageUrl", "Secondary image"),
      text("imageBadge", "Image badge", "Private customer access"),
      text("imageCaption", "Image caption", "Private photo-package access starts here."),
      textarea("imageMeta", "Image supporting copy", "Sign in to keep every upload, request, credit, and delivered album inside one private photo account.")
    ],
    blocks: [loginMethodBlock],
    presets: [
      {
        label: "Email plus login methods",
        settings: {
          anchor: "start",
          eyebrow: "Start studio",
          title: "Upload selfies after a secure customer login.",
          subtitle: "Each site owns its customer system, credits, and private albums.",
          emailPlaceholder: "you@example.com",
          buttonLabel: "Continue with email",
          actionHref: "/login",
          imageUrl: "/assets/site-media/lumen/ref-crops/photo-paris.png?v=20260607a",
          secondaryImageUrl: "/assets/site-media/lumen/hero-crop-portrait-2.png",
          imageBadge: "Private customer access",
          imageCaption: "Magazine-grade destination albums begin with a private sign-in.",
          imageMeta: "Keep scene, style, and reception requests inside one elegant client workspace."
        },
        blocks: [
          block("login_google", "login_method", { label: "Continue with Google", helper: "OAuth-ready entry for production.", kind: "google", href: "/login" }),
          block("login_email", "login_method", { label: "Use email login", helper: "Password login is available for private album access.", kind: "email", href: "/login" })
        ]
      }
    ]
  },
  shoot_pack_marquee: {
    type: "shoot_pack_marquee",
    label: "Shoot Pack Marquee",
    category: "Storefront",
    description: "MydreamShoots-style pack strip for photo, travel, creator, portrait, gala, and sports offers.",
    maxBlocks: 16,
    settings: [
      text("anchor", "Anchor", "packs"),
      text("eyebrow", "Eyebrow", "Popular packs"),
      text("title", "Title", "Photo packs customers can understand immediately."),
      textarea("subtitle", "Subtitle", "Highlight the headshot, creator, travel, gala, sports, beauty, and editorial looks customers already search for."),
      select(
        "source",
        "Content source",
        [
          ["creative_packs", "Active creative packs"],
          ["blocks", "Manual pack blocks"]
        ],
        "creative_packs"
      )
    ],
    blocks: [
      {
        type: "package",
        label: "Pack tile",
        settings: [
          text("title", "Title", "Creator Portraits"),
          textarea("description", "Description", "Polished creator and sports fan portraits."),
          text("meta", "Meta", "40 photos"),
          text("credits", "Credits", "24 credits"),
          image("imageUrl", "Image URL", "/assets/dreamshoot/travel-card.svg"),
          url("href", "Link", "/tools")
        ],
        preset: {
          label: "Pack tile",
          settings: {
            title: "Creator Portraits",
            description: "Polished creator and sports fan portraits.",
            meta: "40 photos",
            credits: "24 credits",
            imageUrl: "/assets/dreamshoot/travel-card.svg",
            href: "/tools"
          }
        }
      }
    ],
    presets: [
      {
        label: "MydreamShoots pack marquee",
        settings: {
          anchor: "packs",
          eyebrow: "Popular packs",
          title: "Sell clear photo packages.",
          subtitle: "Photo, creator, travel, gala, sports, headshot, beauty, and editorial packs become clear shoppable outcomes.",
          source: "creative_packs"
        },
        blocks: [
          block("marquee_photo", "package", { title: "AI Photo Sets", description: "Announcement, profile, and scene visuals.", meta: "40 photos", credits: "24 credits", imageUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png", href: "/tools/creator-portrait" }),
          block("marquee_sports", "package", { title: "World Cup Fan Photos", description: "Stadium fan scenes, fan posters, and creator portrait sets.", meta: "40 photos", credits: "26 credits", imageUrl: "/assets/dreamshoot/generated/20260621-worldcup-pack/banner-cover.png", href: "/tools/world-cup-fan-photos" }),
          block("marquee_gala", "package", { title: "Gala Photos", description: "Formal editorial night-out imagery.", meta: "40 photos", credits: "22 credits", imageUrl: "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png", href: "/tools/gala-photo" })
        ]
      }
    ]
  },
  trust_signal_bar: {
    type: "trust_signal_bar",
    label: "Trust Signal Bar",
    category: "Storefront",
    description: "Compact proof strip for privacy, speed, credits, and delivery assurances.",
    maxBlocks: 6,
    settings: [text("anchor", "Anchor", "trust"), text("title", "Title", "Private, fast, and credit-safe"), textarea("subtitle", "Subtitle", "")],
    blocks: [statBlock],
    presets: [
      {
        label: "Trust signals",
        settings: { anchor: "trust", title: "Built for private AI photo delivery." },
        blocks: [
          block("trust_private", "stat", { value: "Private", label: "customer uploads" }),
          block("trust_credits", "stat", { value: "Clear", label: "credit history" }),
          block("trust_delivery", "stat", { value: "Albums", label: "download-ready images" }),
          block("trust_connect", "stat", { value: "Secure", label: "checkout flow" })
        ]
      }
    ]
  },
  final_cta: {
    type: "final_cta",
    label: "Final CTA",
    category: "Storefront",
    description: "Closing conversion banner with supporting copy and a primary call to action.",
    settings: [
      text("anchor", "Anchor", "journey"),
      text("eyebrow", "Eyebrow", "Final CTA"),
      text("title", "Title", "Open your private AI photo studio."),
      textarea("subtitle", "Subtitle", "Create polished AI photo packs with clear credits, private uploads, and customer-only delivery."),
      text("primaryCta", "Primary CTA", "Start Making"),
      url("primaryHref", "Primary link", "/login"),
      text("secondaryCta", "Secondary CTA", ""),
      url("secondaryHref", "Secondary link", "/pricing"),
      text("badgeLabel", "Image badge label", "Private photo story"),
      text("panelEyebrow", "Panel eyebrow", "what happens after checkout"),
      textarea("panelTitle", "Panel title", "A private, guided generated image workflow from upload to final album delivery."),
      media("backgroundImage", "Background image")
    ],
    blocks: [journeyStepBlock],
    presets: [
      {
        label: "MydreamShoots final journey CTA",
        settings: {
          anchor: "journey",
          eyebrow: "Your photo story",
          title: "Open your private AI photo studio.",
          subtitle: "Create polished AI photo packs with clear credits, private uploads, and customer-only delivery.",
          primaryCta: "Start Making",
          primaryHref: "/login",
          secondaryCta: "See Pricing",
          secondaryHref: "/pricing",
          badgeLabel: "Private photo story",
          panelEyebrow: "what happens after checkout",
          panelTitle: "A private, guided generated image workflow from upload to final album delivery.",
          backgroundImage: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png"
        },
        blocks: [
          block("journey_step_upload", "journey_step", { title: "Upload", description: "Add your best source portraits and style references.", meta: "Included" }),
          block("journey_step_direction", "journey_step", { title: "Direction", description: "Choose the scene mood, styling, and destination look.", meta: "Included" }),
          block("journey_step_delivery", "journey_step", { title: "Delivery", description: "Review the final images inside one private gallery.", meta: "Included" })
        ]
      }
    ]
  },
  pricing_table: {
    type: "pricing_table",
    label: "Pricing Table",
    category: "Commerce",
    description: "Secure checkout pricing section. Prices are read from products, not typed manually.",
    settings: [
      text("anchor", "Anchor", "plans"),
      text("eyebrow", "Eyebrow", "Transparent pricing"),
      text("title", "Title", "Choose your photo package plan."),
      textarea("subtitle", "Subtitle", "Pricing, credits, generated photos, package volume, and delivery timing stay connected to your live offers."),
      media("backgroundImage", "Background image"),
      text("plansMetricLabel", "Plans metric label", "Photo plans"),
      text("plansMetricDetail", "Plans metric detail", "Essential, Premium, Deluxe"),
      text("deliveryMetricLabel", "Delivery metric label", "Delivery"),
      text("deliveryMetricDetail", "Delivery metric detail", "Album turnaround"),
      text("creditsMetricLabel", "Credits metric label", "Credits"),
      text("creditsMetricDetail", "Credits metric detail", "Included every month"),
      text("sidePanelEyebrow", "Side panel eyebrow", "what changes by plan"),
      textarea("sidePanelTitle", "Side panel title", "Choose the credit volume that matches the package sets you want to create."),
      text("inclusionsEyebrow", "Inclusions eyebrow", "what every subscription includes"),
      textarea("inclusionsTitle", "Inclusions title", "Live pricing, private delivery, and a AI photo workflow customers can trust."),
      { id: "featuredProductId", label: "Featured plan", type: "product", source: "products", default: "" },
      text("featuredBadgeLabel", "Featured badge label", "Most popular"),
      text("standardBadgeLabel", "Standard badge label", "Photo plan"),
      text("planSubtitle", "Plan subtitle", "Private destination photo album"),
      textarea("subscriptionBody", "Subscription body", "A guided photo package plan for customers creating headshots, sports fan photos, cinematic scenes, and style previews."),
      text("bestForLabel", "Best-for label", "Best for"),
      text("bestForBody", "Best-for body", "Customers creating polished private photo packages"),
      text("deliveryCardLabel", "Delivery card label", "Delivery"),
      textarea("deliveryCardBody", "Delivery card body", "High-resolution images delivered to your private gallery after payment confirmation."),
      text("checkoutLabel", "Checkout label", "Start your journey"),
      text("previewCheckoutLabel", "Preview CTA label", "Preview checkout"),
      textarea("emptyBody", "Empty state body", "Photo packages are not open yet. Please check back when the next collection release is available."),
      select(
        "productType",
        "Plan source",
        [
          ["subscription", "Subscription plans"]
        ],
        "subscription"
      ),
      checkbox("showCheckoutNote", "Show fulfilment note", true)
    ],
    blocks: [pricingPlanNoteBlock, benefitBlock]
  },
  ai_tool_grid: {
    type: "ai_tool_grid",
    label: "AI Tool Grid",
    category: "AI business",
    description: "Shows only AI tools enabled for the current site.",
    settings: [
      text("anchor", "Anchor", "tools"),
      text("title", "Title", "AI tools installed for this site"),
      textarea("subtitle", "Subtitle"),
      select(
        "layout",
        "Layout",
        [
          ["bento", "Bento"],
          ["list", "List"]
        ],
        "bento"
      )
    ]
  },
  ai_tool_entry: {
    type: "ai_tool_entry",
    label: "AI Tool Entry",
    category: "AI business",
    description: "Hero section for an individual AI tool page.",
    settings: [
      aiApp(),
      text("eyebrow", "Eyebrow", "Customer-facing tool"),
      text("title", "Title", "Image Studio"),
      textarea("subtitle", "Subtitle"),
      media("imageUrl", "Hero image / media asset"),
      text("ctaLabel", "CTA label", "Open workspace")
    ]
  },
  upload_panel: {
    type: "upload_panel",
    label: "Upload Panel",
    category: "AI business",
    description: "Customer private upload surface bound to the current site.",
    settings: [
      text("eyebrow", "Eyebrow", "Private upload intake"),
      text("title", "Title", "Private upload intake"),
      textarea("subtitle", "Subtitle", "Collect source photos and inspiration references before the photo generation begins."),
      select(
        "surface",
        "Surface",
        [
          ["workspace", "Workspace"],
          ["immersive", "Immersive"],
          ["journey", "Journey"]
        ],
        "workspace"
      ),
      textarea("helper", "Helper text"),
      media("imageUrl", "Feature image"),
      text("emptyTitle", "Empty title", "No private uploads yet."),
      textarea("emptyBody", "Empty body", "Add a few source portraits, venue references, or style moodboards to start the album flow.")
    ]
  },
  generation_form: {
    type: "generation_form",
    label: "Generation Form",
    category: "AI business",
    description: "Customer form bound to a site-enabled album experience.",
    settings: [
      aiApp(),
      text("eyebrow", "Eyebrow", "Customer generation"),
      text("title", "Title", "Generation form"),
      textarea("subtitle", "Subtitle", "Choose the photo generator, configure the collection, hold credits, and begin a private album request."),
      select(
        "surface",
        "Surface",
        [
          ["workspace", "Workspace"],
          ["immersive", "Immersive"],
          ["journey", "Journey"]
        ],
        "workspace"
      ),
      textarea("helper", "Helper text"),
      media("imageUrl", "Feature image"),
      text("emptyTitle", "Empty title", "No enabled album experience."),
      textarea("emptyBody", "Empty body", "This studio has not opened private album requests yet.")
    ]
  },
  job_progress: {
    type: "job_progress",
    label: "Album Progress",
    category: "AI business",
    description: "Shows the current customer's private album request state.",
    settings: [
      text("eyebrow", "Eyebrow", "Album requests"),
      text("title", "Title", "Visible album progress"),
      textarea("subtitle", "Subtitle", "Only the current signed-in customer's waiting, creating, review-needed, and delivered photo requests are visible here."),
      select(
        "surface",
        "Surface",
        [
          ["workspace", "Workspace"],
          ["timeline", "Timeline"],
          ["journey", "Journey"]
        ],
        "workspace"
      ),
      media("imageUrl", "Feature image"),
      text("emptyTitle", "Empty title", "No photo requests yet."),
      textarea("emptyBody", "Empty body", "Create the first generation request to start the private album workflow.")
    ]
  },
  album_gallery: {
    type: "album_gallery",
    label: "Album Gallery",
    category: "AI business",
    description: "Shows the current customer's generated results.",
    settings: [
      text("eyebrow", "Eyebrow", "Private album gallery"),
      text("title", "Title", "Customer album"),
      textarea("subtitle", "Subtitle", "Only the current customer's delivered albums and gallery images appear here."),
      select(
        "surface",
        "Surface",
        [
          ["workspace", "Workspace"],
          ["immersive", "Immersive"],
          ["journey", "Journey"]
        ],
        "workspace"
      ),
      media("imageUrl", "Feature image"),
      text("emptyTitle", "Empty title", "No delivered images yet."),
      textarea("emptyBody", "Empty body", "Successful requests will appear here automatically after final delivery."),
      checkbox("showDownloads", "Show download actions", true)
    ]
  },
  search_results: {
    type: "search_results",
    label: "Search Results",
    category: "Content",
    description: "Editable site search results surface bound to current site products, packs, tools, and pages.",
    settings: [
      text("eyebrow", "Eyebrow", "Site search"),
      text("title", "Title", "Search this storefront"),
      textarea("subtitle", "Subtitle", "Search collections, pricing, tools, policies, and photo planning guides."),
      select("headingLevel", "Heading level", [["h1", "H1"], ["h2", "H2"]], "h1"),
      text("emptyTitle", "Empty title", "No matching content yet."),
      textarea("emptyBody", "Empty body", "Try pricing, credits, album, help, or privacy."),
      range("resultLimit", "Result limit", 12, 4, 24, 1)
    ]
  },
  cart_summary: {
    type: "cart_summary",
    label: "Cart Summary",
    category: "Commerce",
    description: "Editable cart and checkout summary bound to selected real site product and price records.",
    settings: [
      text("eyebrow", "Eyebrow", "Checkout summary"),
      text("title", "Title", "Your selected plan"),
      textarea("subtitle", "Subtitle", "Products, prices, credits, and checkout state stay tied to this storefront."),
      select("headingLevel", "Heading level", [["h1", "H1"], ["h2", "H2"]], "h1"),
      text("emptyTitle", "Empty title", "Choose a plan first"),
      textarea("emptyBody", "Empty body", "Open pricing to select a subscription or credit pack."),
      text("returnLabel", "Return button label", "Back to pricing"),
      url("returnHref", "Return button link", "/pricing"),
      checkbox("showCheckoutNote", "Show fulfilment note", true)
    ]
  },
  job_detail: {
    type: "job_detail",
    label: "Album Request Detail",
    category: "AI business",
    description: "Dynamic customer request detail page bound to the selected album request, delivered images, and credit history.",
    settings: [
      text("eyebrow", "Eyebrow", "Album request"),
      text("title", "Title", "Review one private album request."),
      textarea("subtitle", "Subtitle", "Shows the selected customer album request, delivered images, and credit history."),
      checkbox("showLedger", "Show credit history", true),
      checkbox("showAssets", "Show delivered images", true)
    ]
  },
  not_found: {
    type: "not_found",
    label: "404 Content",
    category: "Content",
    description: "Editable not-found section for unknown storefront routes.",
    settings: [
      text("eyebrow", "Eyebrow", "404"),
      text("title", "Title", "This photo story page is not available."),
      textarea("subtitle", "Subtitle", "Send customers back to packages, pricing, login, or the private workspace."),
      text("primaryCta", "Primary CTA", "Return home"),
      url("primaryHref", "Primary link", "/"),
      text("secondaryCta", "Secondary CTA", "View packages"),
      url("secondaryHref", "Secondary link", "/collections")
    ]
  },
  testimonial_wall: {
    type: "testimonial_wall",
    label: "Testimonial Wall",
    category: "Storefront",
    description: "Social proof blocks for studios and customers.",
    maxBlocks: 12,
    settings: [
      text("anchor", "Anchor", "proof"),
      text("title", "Title", "Trusted by studios and creators"),
      textarea("subtitle", "Subtitle"),
      text("summaryTitle", "Summary title", "Loved by creators and solo buyers"),
      textarea("summaryBody", "Summary body", "Thousands of customers have turned everyday selfies into polished AI photo packs."),
      text("summaryRating", "Summary rating", "4.9/5"),
      text("summaryMeta", "Summary meta", "From 10,000+ reviews")
    ],
    blocks: [testimonialBlock],
    presets: [
      {
        label: "MydreamShoots customer proof wall",
        settings: {
          anchor: "reviews",
          title: "Loved by creators and solo buyers",
          subtitle: "Thousands of customers have turned everyday selfies into polished AI photo packs.",
          summaryTitle: "Loved by creators and solo buyers",
          summaryBody: "Thousands of customers have turned everyday selfies into polished AI photo packs.",
          summaryRating: "4.9/5",
          summaryMeta: "From 10,000+ reviews"
        },
        blocks: [
          block("proof_sophia_liam", "testimonial", {
            quote: "We used the gala pack and headshot pack to refresh our brand in a single week.",
            name: "Ava Mercer",
            role: "Creator",
            location: "Australia",
            rating: "5",
            avatarUrl: "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png",
            resultImageUrl: "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png"
          }),
          block("proof_aisha_omar", "testimonial", {
            quote: "The hairstyle preview made it easy to pick the right pack before paying for the full set.",
            name: "Mia Collins",
            role: "Creator",
            location: "UAE",
            rating: "5",
            avatarUrl: "/assets/dreamshoot/frames/story-beauty-portrait.png",
            resultImageUrl: "/assets/dreamshoot/generated/20260618/hairstyle-preview-v1.png"
          }),
          block("proof_emily_james", "testimonial", {
            quote: "The pricing was clear and the private gallery made delivery easy to manage.",
            name: "Lucas Bennett",
            role: "Founder",
            location: "Canada",
            rating: "5",
            avatarUrl: "/assets/dreamshoot/editorial-headshot-gpt2.png",
            resultImageUrl: "/assets/dreamshoot/generated/20260619/nature-adventure-solo-v1.png"
          }),
          block("proof_priya_arjun", "testimonial", {
            quote: "The video add-on turned one favorite portrait into a clean promo clip for social.",
            name: "Nora Whitman",
            role: "Creator",
            location: "Singapore",
            rating: "5",
            avatarUrl: "/assets/dreamshoot/avatar-nora-gpt2-fast.png",
            resultImageUrl: "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.png"
          })
        ]
      }
    ]
  },
  faq: {
    type: "faq",
    label: "FAQ",
    category: "Content",
    description: "Editable question and answer list.",
    maxBlocks: 16,
    settings: [
      text("anchor", "Anchor", "faq"),
      text("eyebrow", "Eyebrow", "Questions before upload"),
      text("title", "Title", "Frequently asked questions"),
      textarea("subtitle", "Subtitle"),
      text("supportEyebrow", "Support card eyebrow", "before they subscribe"),
      textarea(
        "supportBulletList",
        "Support bullets",
        "Privacy for uploaded source photos|Real turnaround expectations|Resolution, download, and revision confidence",
        "Use | to separate checklist bullets."
      )
    ],
    blocks: [faqBlock]
  },
  policy_content: {
    type: "policy_content",
    label: "Policy Content",
    category: "Content",
    description: "Per-site policy body.",
    settings: [
      text("title", "Title", "Policy page"),
      select("headingLevel", "Heading level", [["h1", "H1"], ["h2", "H2"]], "h1"),
      text("lastUpdated", "Last updated", "June 25, 2024"),
      text("contactEmail", "Contact email", "support@mydreamshoots.com"),
      richtext("body", "Body")
    ]
  },
  blog_list: {
    type: "blog_list",
    label: "Blog List",
    category: "Content",
    description: "Photo planning article list with configurable intro copy.",
    settings: [text("title", "Title", "Guides"), select("headingLevel", "Heading level", [["h1", "H1"], ["h2", "H2"]], "h1"), textarea("body", "Intro copy")]
  },
  rich_text: {
    type: "rich_text",
    label: "Rich Text",
    category: "Content",
    description: "General copy section for commercial pages, policies, account copy, and card-based content.",
    maxBlocks: 6,
    settings: [
      text("eyebrow", "Eyebrow", "Page content"),
      text("title", "Title", "Story text section"),
      select("headingLevel", "Heading level", [["h1", "H1"], ["h2", "H2"]], "h2"),
      richtext("body", "Body"),
      media("imageUrl", "Image / media asset"),
      select(
        "tone",
        "Tone",
        [
          ["warm", "Warm storefront"],
          ["light", "Light"],
          ["dark", "Dark"]
        ],
        "warm"
      ),
      select(
        "layout",
        "Layout",
        [
          ["commerce_intro", "Commerce intro"],
          ["compact", "Compact"],
          ["editorial", "Editorial"]
        ],
        "commerce_intro"
      ),
      text("primaryCta", "Primary CTA"),
      url("primaryHref", "Primary CTA link", "/login"),
      text("secondaryCta", "Secondary CTA"),
      url("secondaryHref", "Secondary CTA link", "/pricing")
    ],
    blocks: [cardBlock]
  },
  before_after_gallery: {
    type: "before_after_gallery",
    label: "Before / After Gallery",
    category: "Storefront",
    description: "Visual proof pairs for AI photo transformation.",
    maxBlocks: 8,
    settings: [text("anchor", "Anchor", "results"), text("title", "Title", "Before and after gallery"), textarea("subtitle", "Subtitle")],
    blocks: [beforeAfterBlock]
  },
  header: {
    type: "header",
    label: "Header Plus",
    category: "Global",
    description: "Global header injected into every page.",
    maxBlocks: 48,
    settings: [
      text("title", "Brand title", "Lumen"),
      checkbox("sticky", "Sticky header", true),
      text("ctaLabel", "CTA label", "Start"),
      url("ctaHref", "CTA link", "/login"),
      select(
        "style",
        "Header style",
        [
          ["light", "Light header"],
          ["light_commerce", "Light commerce navigation"],
          ["dark_pills", "Dark pill navigation"]
        ],
        "light"
      ),
      text("mobileLabel", "Mobile menu label", "Menu")
    ],
    blocks: [menuLinkBlock, dreamshootToolBlock]
  },
  footer: {
    type: "footer",
    label: "Footer Plus",
    category: "Global",
    description: "Global footer injected into every page.",
    maxBlocks: 16,
    settings: [
      text("title", "Title", "Footer"),
      text("tagline", "Tagline", "Luxury AI photo studio"),
      textarea("body", "Body"),
      text("productHeading", "Product heading", "Product"),
      text("companyHeading", "Company heading", "Company"),
      text("supportHeading", "Support heading", "Support"),
      text("socialHeading", "Social heading", "Follow Us"),
      textarea("socialBody", "Social body", "Destination photo inspiration, private delivery, and elegant AI-generated albums."),
      url("instagramUrl", "Instagram", ""),
      url("facebookUrl", "Facebook", ""),
      url("pinterestUrl", "Pinterest", ""),
      url("youtubeUrl", "YouTube", ""),
      text("bottomLine", "Bottom line", "Private albums, live pricing, and destination photo storytelling in one storefront."),
      text("copyright", "Copyright", "All rights reserved.")
    ],
    blocks: [menuLinkBlock]
  }
};

export const importedSaasSectionSchemas = getImportedSaasSectionSchemas();

export const sectionSchemas: Record<string, ThemeSectionSchema> = {
  ...importedSaasSectionSchemas,
  ...aiSubscriptionSectionSchemas
};

export const sectionDefinitions = Object.keys(sectionSchemas) as SectionType[];

export function getSectionSchema(type: SectionType): ThemeSectionSchema {
  return sectionSchemas[type] ?? {
    type,
    label: String(type),
    category: "Storefront",
    description: "Reusable storefront section.",
    settings: []
  };
}

export function defaultSettings(fields: ThemeFieldSchema[]): Record<string, ThemeSettingValue> {
  return Object.fromEntries(fields.map((field) => [field.id, field.default ?? ""]));
}

export function defaultBlock(schema: ThemeBlockSchema, index: number): SectionBlockInstance {
  return {
    id: `${schema.type}_${Date.now().toString(36)}_${index}`,
    type: schema.type,
    settings: { ...(schema.preset?.settings ?? defaultSettings(schema.settings)) }
  };
}

export function defaultSection(type: SectionType): SectionInstance {
  const schema = getSectionSchema(type);
  const preset = schema.presets?.[0];
  return {
    type,
    settings: { ...(preset?.settings ?? defaultSettings(schema.settings)) },
    blocks: preset?.blocks ? JSON.parse(JSON.stringify(preset.blocks)) as SectionBlockInstance[] : []
  };
}

export function blockLabel(schema: ThemeBlockSchema | undefined, blockInstance: SectionBlockInstance, index: number): string {
  const title = blockInstance.settings.title ?? blockInstance.settings.label ?? blockInstance.settings.question ?? blockInstance.settings.value;
  return `${schema?.label ?? blockInstance.type} ${title ? `- ${String(title).slice(0, 32)}` : index + 1}`;
}
