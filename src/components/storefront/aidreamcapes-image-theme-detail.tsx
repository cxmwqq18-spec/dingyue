import { EcommerceStyleImageThemeDetail } from "@/components/storefront/ecommerce-main-image-detail";
import { imageThemeDetailContentFromSection } from "@/lib/aidreamcapes-image-theme-content";
import type { SectionInstance, Site } from "@/lib/types";

export function AidreamcapesImageThemeDetail({ section, site }: { section: SectionInstance; site: Site }) {
  const content = imageThemeDetailContentFromSection(section);
  return content ? <EcommerceStyleImageThemeDetail content={content} site={site} /> : null;
}
