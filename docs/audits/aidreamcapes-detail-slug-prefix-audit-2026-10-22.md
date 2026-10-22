# Aidreamcapes Detail Slug Prefix Audit — 2026-10-22

Status: audit completed 2026-10-22. The 15 non-colliding template pairs, the 5
hub examples, and the 17 data-only example prefixes have since been applied in
production. See
[`aidreamcapes-detail-url-normalization-release-2026-10-22.md`](aidreamcapes-detail-url-normalization-release-2026-10-22.md).

The inventory below is the pre-application audit snapshot. The three template
page-name collisions, the two remaining distinct `-home` picker identities, and
the 674 `workspaceCases` remain. The two hub suffix duplicates now 308 to
`/video-ads` through `detailAliasOf`.

Scope: `site_aidreamcapes` only. MyDreamShoots was not read or written.

## Method

1. Walked every production `LivePage.contentJson` card object containing a
   non-empty `publicSlug`.
2. Compared the slug with `slugify(label)`.
3. Checked each proposed short slug against:
   - every live page path,
   - every other card `publicSlug`,
   - every existing `publicAliases` value.
4. Crawled all 178 sitemap pages on the production origin and extracted every
   clickable anchor whose path is a media-detail path.

Production readback origin:
`http://127.0.0.1:3013` with `x-forwarded-host: www.aivideosugc.com` and
`x-forwarded-proto: https`.

## Inventory

`LivePage` contains 1,005 card objects with `publicSlug` and 987 unique detail
slugs.

| Shape | Unique slugs | Meaning |
|---|---:|---|
| Exact label slug | 268 | `slug === slugify(label)` |
| Prefix | 35 | `<owner-page-leaf>-<label>` |
| Suffix | 678 | `<label>-<full owner path>` |
| Other | 6 | Slug describes the scene rather than the label, or apostrophe drift |

Prefix composition:

- 18 `templateDefinition.card` slugs.
- 17 `examples` item slugs.
- The same 18 template slugs also exist on the matching `picker.cards[0]`
  copies, so 53 card objects share the 35 unique prefix slugs.

Suffix composition:

- 674 `workspaceCases`.
- 4 `picker.cards` on `/` and `/ai-video-generation`.

Public-link crawl:

- 215 unique detail-like anchors were clicked from 178 public pages.
- 206 are card detail links; the other 9 are tool/collection routes that are
  not media cards.
- Of the 206 card detail links:
  - 181 exact label slugs.
  - **16 template prefix slugs.**
  - **4 picker suffix slugs.**
  - **5 example scene slugs that do not match the label.**
- The 17 prefix example cards and 674 `workspaceCases` are not linked from the
  public sitemap pages. The `workspaceCases` can still appear in detail-page
  related lists (51 in the previous audit).

## Template detail links — the class in the screenshot

These are the 18 `templateDefinition.card` / `picker.cards[0]` pairs. Both
copies intentionally share one `publicSlug`, so both must be updated together.

| Live page | Current detail slug | Proposed short slug | Public link | Collision |
|---|---|---|---|---|
| `/ai-image-generation/ugc-still-ad` | `ugc-still-ad-creator-style-photo` | `creator-style-photo` | yes | none |
| `/ai-video-generation/beauty-routine` | `beauty-routine-beauty-routine` | `beauty-routine` | yes | **page path** |
| `/ai-video-generation/black-friday-countdown` | `black-friday-countdown-black-friday-video` | `black-friday-video` | yes | none |
| `/ai-video-generation/fashion-try-on-reel` | `fashion-try-on-reel-outfit-reel` | `outfit-reel` | yes | none |
| `/ai-image-generation/packshot-multi-angle` | `packshot-multi-angle-every-angle` | `every-angle` | yes | none |
| `/ai-image-generation/sale-campaign-key-visual` | `sale-campaign-key-visual-sale-banner` | `sale-banner` | no | none |
| `/ai-image-generation/virtual-try-on` | `virtual-try-on-clothing-try-on` | `clothing-try-on` | yes | none |
| `/ai-image-generation/professional-headshot` | `professional-headshot-team-headshots` | `team-headshots` | yes | none |
| `/ai-image-generation/story-ad-vertical` | `story-ad-vertical-story-ad` | `story-ad` | yes | none |
| `/ai-image-generation/colorway-variations` | `colorway-variations-color-variants` | `color-variants` | yes | none |
| `/ai-image-generation/packaging-mockup` | `packaging-mockup-packaging-preview` | `packaging-preview` | yes | none |
| `/ai-video-generation/home-organization` | `home-organization-home-organizing` | `home-organizing` | yes | none |
| `/ai-video-generation/promo-video` | `promo-video-launch-promo` | `launch-promo` | yes | none |
| `/ai-video-generation/food-video` | `food-video-drink-pour` | `drink-pour` | yes | none |
| `/ai-video-generation/how-to-video` | `how-to-video-how-to-video` | `how-to-video` | yes | **page path** |
| `/ai-video-generation/cinematic-video` | `cinematic-video-brand-film` | `brand-film` | yes | none |
| `/ai-video-generation/spark-ads-style-video` | `spark-ads-style-video-spark-ads-style-video` | `spark-ads-style-video` | yes | **page path** |
| `/ai-image-generation/jewelry-positioning` | `jewelry-positioning-jewelry-on-model` | `jewelry-on-model` | no | none |

Result: 15 can be shortened immediately; 3 collide with the live template
landing page path and cannot use the bare product name without a page-level
decision.

## Visible example links with scene-based slugs

`/ai-video-generation` renders five example cards whose slug does not end with
the card label:

| Current URL | Card label | Proposed URL |
|---|---|---|
| `/ai-video-generation/a-clip-sized-for-the-feed` | Sneaker Photo for the Feed | `/ai-video-generation/sneaker-photo-for-the-feed` |
| `/ai-video-generation/an-actor-matched-to-the-buyer` | An Avatar Holds the Shaker | `/ai-video-generation/an-avatar-holds-the-shaker` |
| `/ai-video-generation/a-showcase-in-a-real-room` | Perfume Bottle in a Room | `/ai-video-generation/perfume-bottle-in-a-room` |
| `/ai-video-generation/the-same-product-walkthrough` | Bento Box Walkthrough | `/ai-video-generation/bento-box-walkthrough` |
| `/ai-video-generation/a-spoken-ad-with-a-person-on-camera` | Bottle Ad With a Person | `/ai-video-generation/bottle-ad-with-a-person` |

All five proposed paths are free. These are not prefix/suffix duplication;
they are a naming-policy decision. If every detail URL must end with its card
label, they should be renamed in the same operation.

## Picker suffix links — duplicate identities

| Current URL | Label | Preferred slug | Why it cannot simply change |
|---|---|---|---|
| `/ai-video-generation/trousers-fold-demo-home` | Trousers Fold Demo | `trousers-fold-demo` | Different card already owns that slug on `/ai-video-generation` |
| `/ai-video-generation/tinted-balm-vanity-reel-home` | Tinted Balm Vanity Reel | `tinted-balm-vanity-reel` | Different card already owns that slug on `/ai-video-generation` |
| `/ai-video-generation/streamer-reaction-app-ai-video-generation` | Streamer Reaction: App | `streamer-reaction-app` | Different card owns it on `/ai-video-generation/video-ads`; current 200, not 308 |
| `/ai-video-generation/lifestyle-app-recommendation-ai-video-generation` | Lifestyle App Recommendation | `lifestyle-app-recommendation` | Different card owns it on `/ai-video-generation/video-ads`; current 200, not 308 |

The two `-home` cards use different image sources from the hub cards, so they
are not exact media duplicates. The two hub copies have the same images but
their stored scene identity differs from the canonical card, so the existing
`detailAliasOf` guard does not collapse them.

## Data-only prefix cards

Seventeen example cards on sale/occasion pages use
`<page-leaf>-<label>` and are not linked from any sitemap page:

- `/ai-image-generation/sale-campaign-key-visual`: 7 cards.
- `/occasions/black-friday`: 3 cards.
- `/occasions/holidays`: 3 cards.
- `/occasions/sale-discount`: 4 cards.

All proposed label-only paths are free. They can be cleaned up later without
changing any visible page.

| Live page | Current slug | Proposed slug |
|---|---|---|
| `/ai-image-generation/sale-campaign-key-visual` | `sale-campaign-key-visual-lunch-box-on-the-last-day` | `lunch-box-on-the-last-day` |
| `/ai-image-generation/sale-campaign-key-visual` | `sale-campaign-key-visual-wallet-unboxing-with-offer-space` | `wallet-unboxing-with-offer-space` |
| `/ai-image-generation/sale-campaign-key-visual` | `sale-campaign-key-visual-cardigan-ready-for-season-end` | `cardigan-ready-for-season-end` |
| `/ai-image-generation/sale-campaign-key-visual` | `sale-campaign-key-visual-tote-with-space-for-the-offer` | `tote-with-space-for-the-offer` |
| `/ai-image-generation/sale-campaign-key-visual` | `sale-campaign-key-visual-running-shoes-before-the-jog` | `running-shoes-before-the-jog` |
| `/ai-image-generation/sale-campaign-key-visual` | `sale-campaign-key-visual-sandals-tried-on-at-the-market` | `sandals-tried-on-at-the-market` |
| `/ai-image-generation/sale-campaign-key-visual` | `sale-campaign-key-visual-suitcase-with-room-for-the-offer` | `suitcase-with-room-for-the-offer` |
| `/occasions/black-friday` | `black-friday-gaming-monitor-framed-for-a-black-friday-post` | `gaming-monitor-framed-for-a-black-friday-post` |
| `/occasions/black-friday` | `black-friday-lunch-bag-packed-for-a-black-friday-deal` | `lunch-bag-packed-for-a-black-friday-deal` |
| `/occasions/black-friday` | `black-friday-gift-box-ready-for-a-black-friday-offer` | `gift-box-ready-for-a-black-friday-offer` |
| `/occasions/holidays` | `holidays-winter-jacket-revealed-from-a-gift-box` | `winter-jacket-revealed-from-a-gift-box` |
| `/occasions/holidays` | `holidays-gift-bottle-held-in-both-hands` | `gift-bottle-held-in-both-hands` |
| `/occasions/holidays` | `holidays-skincare-gift-set-lifted-from-tissue` | `skincare-gift-set-lifted-from-tissue` |
| `/occasions/sale-discount` | `sale-discount-gold-necklace-revealed-from-tissue` | `gold-necklace-revealed-from-tissue` |
| `/occasions/sale-discount` | `sale-discount-running-jacket-checked-in-a-mirror` | `running-jacket-checked-in-a-mirror` |
| `/occasions/sale-discount` | `sale-discount-quilted-jacket-lifted-from-a-gift-box` | `quilted-jacket-lifted-from-a-gift-box` |
| `/occasions/sale-discount` | `sale-discount-hand-applies-balm-from-a-plain-jar` | `hand-applies-balm-from-a-plain-jar` |

## Remaining long tail

- 674 `workspaceCases` still use `<label>-<full owner path>`.
  - 639 sit on 18 tool/directory pages.
  - 35 sit on `/templates`.
  - None are linked from sitemap pages; 51 appeared in detail-page related
    lists in the previous audit.
- One `workspaceCases` slug has apostrophe drift:
  `/ai-video-generation/court-gear-from-the-player-s-view` should be
  `court-gear-from-the-players-view`.
- The previous scope decision intentionally left these directory copies alone.

## Why collisions happen

The detail route is resolved before the `LivePage` route. A card cannot use its
owner page's slug: the detail would shadow the indexable template page. The
alias runtime also rejects an alias when a live page owns that path.

Three template cards have exactly this collision because the template landing
page already uses the product name:

- `/ai-video-generation/beauty-routine`
- `/ai-video-generation/how-to-video`
- `/ai-video-generation/spark-ads-style-video`

Options, in ascending order of change size:

1. Keep the current double slug for these three as an explicit exception.
2. Rename the template landing page (for example
   `/ai-video-generation/beauty-video-templates`) and redirect the old page,
   freeing the bare product name for the detail card.
3. Merge the card detail into the landing page so the card links directly to
   the page. This breaks the current one-detail-per-card contract and needs a
   runtime rule change.

## Root cause

The historical planner
`scripts/plan-aidreamcapes-example-media-slugs.mjs` encodes:

`<pageSlugLeaf>-<slugify(cardLabel)>`

with the leaf omitted only on `/ai-image-generation` and
`/ai-video-generation`. That rule generated the template prefixes and the
17 data-only example prefixes. Do not rerun the old planner to generate new
content. Any new slug plan should use the card label as the base, then apply
an explicit collision suffix only when the bare slug is already owned.

## Recommended sequence

1. **Phase 1 — done (2026-10-22):** 15 non-colliding template pairs and the 5
   hub examples are live; 20 old addresses 308 to their new canonical details.
2. **Phase 2 — partially done (2026-10-22):** the 17 data-only example prefix
   cards are live; the apostrophe `workspaceCases` slug is still pending.
3. **Phase 3 — needs a decision:** the 3 page-name collisions and the 2
   remaining distinct `-home` picker identities; the other 2 hub suffixes are
   already 308 to `/video-ads`.
4. **Phase 4 — separate project:** the 674 directory `workspaceCases`.

Production evidence:
[`aidreamcapes-detail-url-normalization-release-2026-10-22.md`](aidreamcapes-detail-url-normalization-release-2026-10-22.md).

All media detail pages are `noindex, follow` and excluded from the sitemap, so
Phase 1/2 URL moves do not change indexable copy. The template landing pages
remain unchanged.
