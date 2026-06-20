import type { ThemePackageManifest, ThemePackageTemplateKey } from "../types";
import { executiveHeadshotProSiteSettings, executiveHeadshotProTemplateLabels, executiveHeadshotProTemplates } from "./templates";

export const executiveHeadshotProPackage: ThemePackageManifest = {
  key: "executive-headshot-pro",
  name: "Executive Headshot Pro",
  description: "Business-facing storefront package for founder headshots, recruiting visuals, speaker bios, and leadership team portrait delivery.",
  audience: "Founders, agencies, recruiting teams, talent operations, speaker programs, and B2B portrait operators.",
  accent: "#1d4ed8",
  thumbnailUrl: "/assets/dreamshoot/editorial-headshot.svg",
  source: "internal-theme-package",
  siteSettings: executiveHeadshotProSiteSettings,
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
  templates: (Object.entries(executiveHeadshotProTemplates) as Array<[ThemePackageTemplateKey, typeof executiveHeadshotProTemplates[ThemePackageTemplateKey]]>).map(
    ([key, template]) => ({
      key,
      label: executiveHeadshotProTemplateLabels[key],
      pageType: template.pageType,
      sectionCount: template.sectionsOrder.length
    })
  )
};
