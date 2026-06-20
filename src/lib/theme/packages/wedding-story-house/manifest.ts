import type { ThemePackageManifest, ThemePackageTemplateKey } from "../types";
import { weddingStoryHouseSiteSettings, weddingStoryHouseTemplateLabels, weddingStoryHouseTemplates } from "./templates";

export const weddingStoryHousePackage: ThemePackageManifest = {
  key: "wedding-story-house",
  name: "Wedding Story House",
  description: "Wedding-focused storefront package for ceremony collections, bridal portraits, reception recaps, and private couple albums.",
  audience: "Wedding studios, ceremony portrait operators, bridal storytelling brands, and anniversary-focused album subscriptions.",
  accent: "#b86d44",
  thumbnailUrl: "/assets/dreamshoot/couple-studio-hero.svg",
  source: "internal-theme-package",
  siteSettings: weddingStoryHouseSiteSettings,
  featuredSections: [
    "hero",
    "brand_logo_strip",
    "sample_strip",
    "luxury_highlight",
    "destination_showcase",
    "example_gallery",
    "photo_package_wall",
    "occasion_showcase",
    "before_after_gallery",
    "studio_steps",
    "pricing_table",
    "trust_signal_bar",
    "conversion_panel",
    "final_cta",
    "testimonial_wall",
    "faq",
    "ai_tool_entry",
    "upload_panel",
    "generation_form",
    "job_progress",
    "album_gallery"
  ],
  templates: (Object.entries(weddingStoryHouseTemplates) as Array<[ThemePackageTemplateKey, typeof weddingStoryHouseTemplates[ThemePackageTemplateKey]]>).map(
    ([key, template]) => ({
      key,
      label: weddingStoryHouseTemplateLabels[key],
      pageType: template.pageType,
      sectionCount: template.sectionsOrder.length
    })
  )
};
