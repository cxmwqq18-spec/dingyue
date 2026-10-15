import { AidreamcapesGuestCreateWorkspace } from "@/components/storefront/aidreamcapes-guest-workspace";
import { AidreamcapesInspirationsPage } from "@/components/storefront/aidreamcapes-inspirations-page";
import { aidreamcapesCreateIntentFromSearchParams } from "@/lib/aidreamcapes-create-intent";
import {
  AIDREAMCAPES_INSPIRATIONS_SITE_ID,
  AIDREAMCAPES_INSPIRATIONS_SITE_SLUG,
  getAidreamcapesInspirationCards
} from "@/lib/aidreamcapes-inspirations";

// Server-side render entry points for Aidreamcapes guest create and inspiration
// routes. The inspiration library is available with or without a session.

type GuestRouteQuery = Record<string, string | string[] | undefined>;

function searchParamsLikeFromQuery(query: GuestRouteQuery) {
  return {
    get(name: string): string | null {
      const value = query[name];
      if (Array.isArray(value)) return value.length ? String(value[0] ?? "") : null;
      return value === undefined ? null : String(value);
    }
  };
}

function querySuffix(query: GuestRouteQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) if (item !== undefined) params.append(key, String(item));
    } else if (value !== undefined) {
      params.append(key, String(value));
    }
  }
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

export async function renderAidreamcapesGuestCreatePage({ query = {}, siteSlug }: {
  query?: GuestRouteQuery;
  siteSlug: string;
}) {
  // The prefill is parsed on the server from the same intent helper the signed-in
  // workspace uses, so the complete SSR HTML already contains the URL prefill and
  // no browser data fetch is needed.
  const intent = aidreamcapesCreateIntentFromSearchParams(searchParamsLikeFromQuery(query));
  return <AidreamcapesGuestCreateWorkspace initialIntent={intent} initialReturnTo={`/app/create${querySuffix(query)}`} siteId={AIDREAMCAPES_INSPIRATIONS_SITE_ID} siteSlug={siteSlug === AIDREAMCAPES_INSPIRATIONS_SITE_SLUG ? AIDREAMCAPES_INSPIRATIONS_SITE_SLUG : siteSlug} />;
}

export async function renderAidreamcapesInspirationsPage({ siteSlug, basePath = "" }: {
  query?: GuestRouteQuery;
  siteSlug: string;
  basePath?: string;
}) {
  const cards = siteSlug === AIDREAMCAPES_INSPIRATIONS_SITE_SLUG ? await getAidreamcapesInspirationCards() : [];
  return <AidreamcapesInspirationsPage cards={cards} basePath={basePath} />;
}
