// Canonical address for a public media card.
//
// A card can be published as a shortcut for another card: it keeps its own
// public slug so old inbound links keep resolving, and it declares the card
// it stands for through `detailAliasOf`. The storefront answers such a slug
// with a permanent redirect, so a link that points at it costs the visitor
// one extra hop.
//
// The alias is only trusted when the card itself proves it is the same
// product: its scene slug starts with the alias target. The scene slug is
// derived from the product slug, so a shortcut and its target share the same
// prefix. Anything else keeps the card's own slug, and the redirect stays.

import { MEDIA_DETAIL_SLUG_PATTERN } from "./media-detail";

export type MediaCardCanonicalInput = {
  publicSlug?: string;
  detailAliasOf?: string;
  sceneSlug?: string;
};

/** The slug a public link should use for this card. */
export function mediaCardCanonicalSlug(card: MediaCardCanonicalInput | undefined): string | undefined {
  if (!card) return undefined;
  const alias = card.detailAliasOf?.trim();
  const scene = card.sceneSlug?.trim();
  if (alias && scene && MEDIA_DETAIL_SLUG_PATTERN.test(alias) && scene.startsWith(`${alias}-`)) return alias;
  return card.publicSlug?.trim() || undefined;
}
