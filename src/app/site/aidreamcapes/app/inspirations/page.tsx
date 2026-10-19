import { renderAidreamcapesInspirationsPage } from "@/lib/aidreamcapes-guest-workspace";

export const metadata = {
  title: "Inspirations | AIVideosUGC",
  description: "Explore product video and photo examples and choose an idea for your next project.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AidreamcapesWorkspaceInspirationsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderAidreamcapesInspirationsPage({
    siteSlug: "aidreamcapes",
    basePath: "/site/aidreamcapes",
    query: await searchParams,
  });
}
