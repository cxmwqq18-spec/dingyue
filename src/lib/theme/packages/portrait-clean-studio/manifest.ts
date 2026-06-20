import type { ThemePackageManifest, ThemePackageTemplateKey } from "../types";
import { portraitCleanStudioSiteSettings, portraitCleanStudioTemplateLabels, portraitCleanStudioTemplates } from "./templates";

export const portraitCleanStudioPackage: ThemePackageManifest = {
  key: "portrait-clean-studio",
  name: "Portrait Clean Studio",
  description: "Clean portrait and personal-brand storefront package for founder headshots, dating portraits, and modern profile photography.",
  audience: "Founder headshots, personal brands, dating portraits, profile-photo subscriptions, and modern portrait studios.",
  accent: "#2f6fed",
  thumbnailUrl: "/assets/dreamshoot/editorial-headshot.svg",
  source: "internal-theme-package",
  siteSettings: portraitCleanStudioSiteSettings,
  featuredSections: [
    "hero",
    "sample_strip",
    "photo_package_wall",
    "dreamshoot_feature_tabs",
    "studio_steps",
    "pricing_table",
    "conversion_panel",
    "testimonial_wall",
    "faq"
  ],
  templates: (Object.entries(portraitCleanStudioTemplates) as Array<[ThemePackageTemplateKey, typeof portraitCleanStudioTemplates[ThemePackageTemplateKey]]>).map(
    ([key, template]) => ({
      key,
      label: portraitCleanStudioTemplateLabels[key],
      pageType: template.pageType,
      sectionCount: template.sectionsOrder.length
    })
  )
};
