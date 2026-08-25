import type { JsonLdNode } from "@/lib/theme/json-ld";

export function StorefrontJsonLd({ nodes }: { nodes: JsonLdNode[] }) {
  return <>{nodes.map((node, index) => <script dangerouslySetInnerHTML={{ __html: JSON.stringify(node).replace(/</g, "\\u003c") }} id={`storefront-json-ld-${index}`} key={index} type="application/ld+json" />)}</>;
}
