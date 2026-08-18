import "server-only";

import { withSeoDirectorySeo, type SeoDirectoryKind } from "@/lib/dreamshoot-seo-content";
import { loadPublishedStorefrontContext } from "@/lib/storefront-context";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import type { CreativePack, Product, Site, ThemePage } from "@/lib/types";

export async function metadataForPublishedStorefrontPage({
  site,
  page,
  path = page.slug,
  products = [],
  creativePacks = []
}: {
  site: Site;
  page: ThemePage;
  path?: string;
  products?: Product[];
  creativePacks?: CreativePack[];
}) {
  const context = await loadPublishedStorefrontContext({
    siteId: site.id,
    path,
    adapter: {
      async loadPublishedBundle() {
        return {
          site,
          page,
          products: products.filter((product) => product.siteId === site.id),
          creativePacks: creativePacks.filter((pack) => pack.siteId === site.id),
          publication: site.latestPublication
        };
      },
      async loadDraftBundle() {
        throw new Error("published_metadata_adapter_does_not_load_drafts");
      }
    }
  });
  return metadataForSingleThemePage(site, page, context);
}

export async function metadataForPublishedStorefrontDirectoryPage({
  site,
  page,
  kind,
  directorySlug,
  path,
  products = [],
  creativePacks = []
}: {
  site: Site;
  page: ThemePage;
  kind: SeoDirectoryKind;
  directorySlug: string;
  path?: string;
  products?: Product[];
  creativePacks?: CreativePack[];
}) {
  const resolvedPage = {
    ...page,
    publishedJson: withSeoDirectorySeo(page.publishedJson, kind, directorySlug, site)
  };
  return metadataForPublishedStorefrontPage({
    site,
    page: resolvedPage,
    path: path ?? resolvedPage.publishedJson.seo?.canonicalPath ?? page.slug,
    products,
    creativePacks
  });
}
