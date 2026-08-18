"use client";

import { useServerInsertedHTML } from "next/navigation";
import { useRef } from "react";

import type { JsonLdNode } from "@/lib/theme/json-ld";

export function StorefrontJsonLd({ nodes }: { nodes: JsonLdNode[] }) {
  const inserted = useRef(false);
  useServerInsertedHTML(() => (
    inserted.current
      ? null
      : (() => {
          inserted.current = true;
          return (
            <>
              {nodes.map((node, index) => (
                <script
                  dangerouslySetInnerHTML={{ __html: JSON.stringify(node).replace(/</g, "\\u003c") }}
                  id={`storefront-json-ld-${index}`}
                  key={index}
                  type="application/ld+json"
                />
              ))}
            </>
          );
        })()
  ));
  return null;
}
