import { permanentRedirect } from "next/navigation";

// The standalone dark inspirations page retired to a single 308 hop: the same
// SSR gallery lives embedded in the workspace at /app/create/inspirations.
export const dynamic = "force-dynamic";

export default async function AidreamcapesWorkspaceInspirationsPage() {
  permanentRedirect("/site/aidreamcapes/app/create/inspirations");
}
