import type { ThemePackageManifest, ThemePackageTemplateKey } from "../types";
import { dreamshootAiStudioSiteSettings, dreamshootAiStudioTemplateLabels, dreamshootAiStudioTemplates, type MydreamShootsAiStudioTemplateKey } from "./templates";

export const dreamshootAiStudioPackage: ThemePackageManifest = {
  key: "dreamshoot-ai-studio",
  name: "MydreamShoots Studio",
  description: "AI photo subscription storefront package with conversion, pricing, packages, upload, generation, progress, album, policy, help, and content templates.",
  audience: "AI photo packages, headshots, creator portraits, style previews, seasonal cards, AI video, and private album subscription stores.",
  accent: "#2f6fed",
  thumbnailUrl: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
  source: "internal-theme-package",
  siteSettings: dreamshootAiStudioSiteSettings,
  featuredSections: [
    "hero",
    "brand_logo_strip",
    "sample_strip",
    "photo_package_wall",
    "dreamshoot_package_taxonomy",
    "dreamshoot_tool_collection",
    "media_banner",
    "before_after_gallery",
    "dreamshoot_feature_tabs",
    "studio_steps",
    "pricing_table",
    "conversion_panel",
    "testimonial_wall",
    "faq"
  ],
  templates: (Object.entries(dreamshootAiStudioTemplates).filter(([key]) => !["tools", "creators-circle", "partner-registration", "about-us", "contact-us"].includes(key)) as Array<[ThemePackageTemplateKey, typeof dreamshootAiStudioTemplates[ThemePackageTemplateKey]]>).map(
    ([key, template]) => ({
      key,
      label: dreamshootAiStudioTemplateLabels[key],
      pageType: template.pageType,
      sectionCount: template.sectionsOrder.length
    })
  ) satisfies ThemePackageManifest["templates"]
};

export type { MydreamShootsAiStudioTemplateKey };
