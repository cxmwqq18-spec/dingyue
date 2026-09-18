const aidreamcapesEuMarkers = [
  "/assets/sites/site_aidreamcapes_eu/",
  "site_aidreamcapes_eu"
];

function containsAidreamcapesEuReference(value: unknown): boolean {
  if (typeof value === "string") return aidreamcapesEuMarkers.some((marker) => value.includes(marker));
  if (Array.isArray(value)) return value.some(containsAidreamcapesEuReference);
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).some(containsAidreamcapesEuReference);
}

/**
 * The English Aidreamcapes storefront has a separate published asset
 * namespace. A historical mirror import left a few EU records attached to
 * the English site id, so keep those records out of the English SSR payload.
 * Other site ids, including Aidreamcapes EU, are intentionally untouched.
 */
export function isolateAidreamcapesEnglishCollection<T>(siteId: string, items: T[]): T[] {
  if (siteId !== "site_aidreamcapes") return items;
  return items.filter((item) => !containsAidreamcapesEuReference(item));
}

export function isolateAidreamcapesEnglishValue<T>(siteId: string, value: T): T | undefined {
  if (siteId !== "site_aidreamcapes") return value;
  return containsAidreamcapesEuReference(value) ? undefined : value;
}
