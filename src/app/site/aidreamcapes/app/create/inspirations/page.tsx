import { renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";

export const metadata = {
  title: "Inspirations | AIVideosUGC",
  description: "Browse product video and photo examples, filter by category, and start a version for your own product.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AidreamcapesInspirationEntry() {
  return renderAidreamcapesWorkspace({ routeSlug: "aidreamcapes", initialView: "inspirations" });
}
