import type { StorefrontProfileJson } from "@/lib/types";

// The company behind the site, as named in the site profile. Pages show these values as they
// are stored there (the Organization structured data is built from the same record), so the
// visible text and the structured data cannot drift apart. Nothing here is written into page copy.
export type V2Company = { name: string; address: string; phone: string; phoneHref: string; email: string; taxId: string; taxIdLabel: string };

const clean = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

function countryName(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return code;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

// The tax ID is kept in the footer settings, next to the other company details of the site.
export function aidreamcapesV2Company(identity: StorefrontProfileJson["identity"] | undefined, footerSettings?: Record<string, unknown>): V2Company | undefined {
  const name = clean(identity?.legalName);
  if (!name) return undefined;
  const address = identity?.address;
  const regionLine = [clean(address?.region), clean(address?.postalCode)].filter(Boolean).join(" ");
  const phone = clean(identity?.phone);
  return {
    name,
    address: [clean(address?.line1), clean(address?.line2), clean(address?.city), regionLine, countryName(clean(address?.country))].filter(Boolean).join(", "),
    phone,
    phoneHref: phone.replace(/[^\d+]/g, ""),
    email: clean(identity?.supportEmail),
    taxId: clean(typeof footerSettings?.taxId === "string" ? footerSettings.taxId : undefined),
    taxIdLabel: clean(typeof footerSettings?.taxIdLabel === "string" ? footerSettings.taxIdLabel : undefined) || "Tax ID"
  };
}
