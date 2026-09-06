import type { JsonLdNode } from "@/lib/theme/json-ld";

export function StorefrontJsonLd({ nodes, preserveBodyMarker = false }: { nodes: JsonLdNode[]; preserveBodyMarker?: boolean }) {
  return <>{nodes.map((node, index) => <script dangerouslySetInnerHTML={{ __html: JSON.stringify(node).replace(/</g, "\\u003c") }} data-storefront-json-ld={preserveBodyMarker ? "body-marker" : undefined} id={`storefront-json-ld-${index}`} key={index} type={preserveBodyMarker ? "application/json" : "application/ld+json"} />)}</>;
}
