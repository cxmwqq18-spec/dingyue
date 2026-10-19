import { renderAidreamcapesInspirationsPage } from "@/lib/aidreamcapes-guest-workspace";

export { metadata } from "@/app/site/aidreamcapes/app/inspirations/page";
export const dynamic = "force-dynamic";

export default async function AIVideosUGCInspirationsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderAidreamcapesInspirationsPage({
    siteSlug: "aidreamcapes",
    basePath: "/site/aivideosugc",
    query: await searchParams,
  });
}
