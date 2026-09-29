import type { JsonLdNode } from "@/lib/theme/json-ld";

export function StorefrontJsonLd({ nodes, preserveBodyMarker = false }: { nodes: JsonLdNode[]; preserveBodyMarker?: boolean }) {
  const html = nodes
    .map((node, index) => {
      const json = JSON.stringify(node).replace(/</g, "\\u003c");
      const marker = preserveBodyMarker ? ' data-storefront-json-ld="body-marker"' : "";
      const type = preserveBodyMarker ? "application/json" : "application/ld+json";
      return `<script${marker} id="storefront-json-ld-${index}" type="${type}">${json}</script>`;
    })
    .join("");

  return (
    <div
      data-storefront-json-ld-container={preserveBodyMarker ? "body-marker" : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
      suppressHydrationWarning
    />
  );
}
