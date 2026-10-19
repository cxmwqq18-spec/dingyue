import { renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";

// Resolve the fixed entry to the standalone canonical URL before any private
// runtime loads. Gallery filters then survive the fixed-route normalization.
export { metadata } from "../../inspirations/page";
export const dynamic = "force-dynamic";

export default async function AidreamcapesInspirationEntry() {
  return renderAidreamcapesWorkspace({ routeSlug: "aidreamcapes", initialView: "inspirations" });
}
