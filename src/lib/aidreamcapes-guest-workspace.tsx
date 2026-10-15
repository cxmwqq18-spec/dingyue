import { aidreamcapesWorkspaceEntry, renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";
import { AidreamcapesInspirationsPage } from "@/components/storefront/aidreamcapes-inspirations-page";
import {
  AIDREAMCAPES_INSPIRATIONS_SITE_ID,
  AIDREAMCAPES_INSPIRATIONS_SITE_SLUG,
  getAidreamcapesInspirationCards
} from "@/lib/aidreamcapes-inspirations";

// Server-side entry points for Aidreamcapes guest workspace and inspiration
// routes. Guests receive the complete workspace shell and public catalog; task,
// asset, account, and generation operations remain customer-authenticated.

type GuestRouteQuery = Record<string, string | string[] | undefined>;

export async function renderAidreamcapesGuestCreatePage({ query = {} }: {
  query?: GuestRouteQuery;
  siteSlug: string;
}) {
  const entry = aidreamcapesWorkspaceEntry(query);
  return renderAidreamcapesWorkspace({
    routeSlug: "aidreamcapes",
    ...entry,
    initialView: entry.initialView ?? "agent"
  });
}

export async function renderAidreamcapesInspirationsPage({ siteSlug, basePath = "" }: {
  query?: GuestRouteQuery;
  siteSlug: string;
  basePath?: string;
}) {
  const cards = siteSlug === AIDREAMCAPES_INSPIRATIONS_SITE_SLUG ? await getAidreamcapesInspirationCards() : [];
  return <AidreamcapesInspirationsPage cards={cards} basePath={basePath} />;
}
