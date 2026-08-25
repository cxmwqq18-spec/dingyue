import type { ReactNode } from "react";

/**
 * Public storefront media is ordinary server-rendered HTML. Preview behavior
 * belongs in a private/admin surface and must not add a client data runtime to
 * SEO pages.
 */
export function DreamshootShowcasePreview({ children }: { children: ReactNode; className?: string }) {
  return children;
}
