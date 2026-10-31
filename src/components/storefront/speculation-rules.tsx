// Speculation Rules prefetch for the public storefront. Chrome 121+ prefetches
// likely next pages on hover/pointer-down (eagerness "moderate"), which removes
// most of the document round-trip from card -> detail navigation. Plain <a>
// links stay untouched (SEO unchanged); unsupported browsers ignore the script.
// Private surfaces (workspace, login, account, API) are excluded.

const RULES = {
  prefetch: [
    {
      source: "document",
      where: {
        and: [
          { href_matches: "/*" },
          { not: { href_matches: "/app/*" } },
          { not: { href_matches: "/api/*" } },
          { not: { href_matches: "/login*" } },
          { not: { href_matches: "/logout*" } },
          { not: { href_matches: "/account*" } },
          { not: { href_matches: "/site/*" } },
          { not: { selector_matches: "[data-no-prefetch], [data-no-prefetch] *" } }
        ]
      },
      eagerness: "moderate"
    }
  ]
};

export function StorefrontSpeculationRules() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(RULES).replace(/</g, "\\u003c") }}
      type="speculationrules"
    />
  );
}
