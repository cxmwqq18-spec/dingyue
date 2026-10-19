import { renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";

export { metadata } from "../../inspirations/page";
export const dynamic = "force-dynamic";

export default async function AIVideosUGCInspirationEntry() {
  return renderAidreamcapesWorkspace({ routeSlug: "aivideosugc", initialView: "inspirations" });
}
