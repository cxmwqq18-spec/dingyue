// Responsive candidate sets for the Aidreamcapes v2 storefront.
//
// The published v2 pages load their pictures from the relational LivePage rows,
// and the media itself is provisioned outside Git. The same is true of the
// generated width variants, so the index that describes them lives next to the
// code and is regenerated together with the media:
//
//   node scripts/generate-aidreamcapes-v2-responsive-variants.mjs --apply
//
// The index is a plain JSON import, like the shared storefront image manifest,
// so the server and the browser read the same file and the rendered markup
// stays identical on both sides. The committed index is empty, which means no
// image gains a `srcset` until an operator generates the variants on a host
// that has the media.

import manifest from "./aidreamcapes-v2-responsive-image-manifest.json";

export type AidreamcapesV2ResponsiveVariant = { width: number; url: string };

export type AidreamcapesV2ResponsiveEntry = {
  original: string;
  width: number;
  height: number;
  variants: AidreamcapesV2ResponsiveVariant[];
};

export type AidreamcapesV2ResponsiveManifest = Record<string, AidreamcapesV2ResponsiveEntry>;

const imageManifest = manifest as AidreamcapesV2ResponsiveManifest;

function manifestKey(src: string): string {
  return src.trim().split(/[?#]/, 1)[0] ?? "";
}

/** Width candidates for one image, or an empty list when the image has no variant set. */
function responsiveCandidates(src: string): { width: number; url: string }[] {
  const entry = imageManifest[manifestKey(src)];
  if (!entry?.variants?.length) return [];
  const candidates = entry.variants
    .slice()
    .sort((left, right) => left.width - right.width)
    .map((variant) => ({ width: variant.width, url: variant.url }));
  // The published file stays the widest candidate so the browser never has to
  // download a picture that is smaller than the one it has today.
  const widest = candidates.at(-1)?.width ?? 0;
  if (entry.width > widest) candidates.push({ width: entry.width, url: entry.original });
  return candidates;
}

/** Width candidates for one image, or undefined when the image has no variant set. */
export function aidreamcapesV2ResponsiveSrcSet(src: string): string | undefined {
  const candidates = responsiveCandidates(src);
  if (!candidates.length) return undefined;
  return candidates.map((candidate) => `${candidate.url} ${candidate.width}w`).join(", ");
}

/**
 * Image attributes for a responsive candidate list. `sizes` must describe the
 * width the stylesheet actually gives the picture; it is only used when a
 * generated variant set exists for that picture. Every candidate URL goes
 * through the storefront asset resolver (`r.asset`) exactly like the poster
 * mapping, so mirrored EU paths and cache-busting stay consistent.
 */
export function aidreamcapesV2ResponsiveImagePropsFor(
  src: string,
  sizes: string,
  asset: (url: string) => string
): { srcSet?: string; sizes?: string } {
  const candidates = responsiveCandidates(src);
  if (!candidates.length) return {};
  return {
    srcSet: candidates.map((candidate) => `${asset(candidate.url)} ${candidate.width}w`).join(", "),
    sizes
  };
}

/** A `<video>` poster takes one URL, so the variant is chosen up front instead
 * of left to the browser's `srcset` negotiation. The grid card shows a video
 * frame at up to 520 CSS px (`AIDREAMCAPES_V2_TEMPLATE_CARD_SIZES`), so the
 * 640px candidate is the width the card actually renders; when no variant set
 * exists the stored poster stays untouched, exactly like every unpublished
 * variant pipeline so far. */
const PREFERRED_POSTER_WIDTH = 640;

export function aidreamcapesV2ResponsivePosterSrc(src: string): string {
  const entry = imageManifest[manifestKey(src)];
  if (!entry?.variants?.length) return src;
  let best = entry.variants[0];
  for (const variant of entry.variants) {
    if (Math.abs(variant.width - PREFERRED_POSTER_WIDTH) < Math.abs(best.width - PREFERRED_POSTER_WIDTH)) best = variant;
  }
  return best.url;
}
