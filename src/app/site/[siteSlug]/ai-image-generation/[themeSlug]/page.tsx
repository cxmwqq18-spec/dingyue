import type { Metadata } from "next";
import CatchAllPage, { generateMetadata as generateCatchAllMetadata } from "../../[...path]/page";

type RouteParams = Promise<{ siteSlug: string; themeSlug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function catchAllParams(params: { siteSlug: string; themeSlug: string }) {
  return Promise.resolve({
    siteSlug: params.siteSlug,
    path: ["ai-image-generation", params.themeSlug]
  });
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const resolved = await params;
  return generateCatchAllMetadata({ params: catchAllParams(resolved) });
}

export default async function ImageThemePage({
  params,
  searchParams
}: {
  params: RouteParams;
  searchParams?: SearchParams;
}) {
  const resolved = await params;
  return CatchAllPage({
    params: catchAllParams(resolved),
    searchParams
  });
}
