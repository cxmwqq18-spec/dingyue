import type { ThemePageJson } from "@/lib/types";
import { dreamshootAiStudioPackage, dreamshootAiStudioTemplates } from "./dreamshoot-ai-studio";
import { portraitCleanStudioPackage, portraitCleanStudioTemplates } from "./portrait-clean-studio";
import { executiveHeadshotProPackage, executiveHeadshotProTemplates } from "./executive-headshot-pro";
import { weddingStoryHousePackage, weddingStoryHouseTemplates } from "./wedding-story-house";
import type { ThemePackageManifest, ThemePackageSiteSettings, ThemePackageTemplateKey } from "./types";

export type { ThemePackageManifest, ThemePackageSiteSettings, ThemePackageTemplateKey } from "./types";
export { dreamshootAiStudioPackage } from "./dreamshoot-ai-studio";
export { portraitCleanStudioPackage } from "./portrait-clean-studio";
export { executiveHeadshotProPackage } from "./executive-headshot-pro";
export { weddingStoryHousePackage } from "./wedding-story-house";

const packages = [
  dreamshootAiStudioPackage,
  portraitCleanStudioPackage,
  executiveHeadshotProPackage,
  weddingStoryHousePackage
];

export function getThemePackages(): ThemePackageManifest[] {
  return packages;
}

function packageTemplates(packageKey: string): Partial<Record<ThemePackageTemplateKey, ThemePageJson>> | undefined {
  if (packageKey === dreamshootAiStudioPackage.key) return dreamshootAiStudioTemplates;
  if (packageKey === portraitCleanStudioPackage.key) return portraitCleanStudioTemplates;
  if (packageKey === executiveHeadshotProPackage.key) return executiveHeadshotProTemplates;
  if (packageKey === weddingStoryHousePackage.key) return weddingStoryHouseTemplates;
  return undefined;
}

export function themePackageTemplateToPageJson(
  packageKey: string,
  templateKey: ThemePackageTemplateKey,
  pageType: string,
  version: number
): ThemePageJson | undefined {
  const template = packageTemplates(packageKey)?.[templateKey];
  if (!template) return undefined;
  return {
    pageType,
    version,
    sectionsOrder: [...template.sectionsOrder],
    sections: JSON.parse(JSON.stringify(template.sections)) as ThemePageJson["sections"]
  };
}
