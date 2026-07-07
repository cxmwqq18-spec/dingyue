import type { JsonLdNode } from "@/lib/theme/json-ld";

export function StorefrontJsonLd({ nodes }: { nodes: JsonLdNode[] }) {
  const html = nodes
    .map((node, index) => {
      const json = JSON.stringify(node).replace(/</g, "\\u003c");
      return `<script id="storefront-json-ld-${index}" type="application/ld+json">${json}</script>`;
    })
    .join("");

  return (
    <div
      data-storefront-json-ld=""
      dangerouslySetInnerHTML={{ __html: html }}
      suppressHydrationWarning
    />
  );
}
