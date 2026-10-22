# Aidreamcapes detail-address cleanup: the last six retired addresses

Final cleanup batch for `site_aidreamcapes`, applied on 2026-10-22 after the
674 workspace-case addresses and the template/example renames. It closes the
three open naming decisions from
`docs/audits/aidreamcapes-detail-url-normalization-release-2026-10-22.md`.

Scope is `site_aidreamcapes` only. No MyDreamShoots row, publication,
snapshot, sitemap entry, navigation entry or shared template was touched.

## What was left

| Class | Count | Detail |
|---|---:|---|
| Template cards whose bare slug is the live landing page path | 3 | `beauty-routine`, `how-to-video`, `spark-ads-style-video` |
| Homepage picker cards sharing a name with a hub card | 2 | `trousers-fold-demo-home`, `tinted-balm-vanity-reel-home` |
| Workspace case with apostrophe drift | 1 | `court-gear-from-the-player-s-view` |
| Stored card rows whose slug was neither the label slug nor the label + owner slug | 8 rows / 5 slugs | the three template doubles (two copies each) plus the two homepage cards |

## Decisions

### 1. Rename the card, keep the landing page

The detail route resolves before the `LivePage` route, so a card can never own
its own page path, and the alias runtime refuses a target that a live page
owns. The landing pages keep the exact keyword paths
(`/ai-video-generation/beauty-routine`, `/ai-video-generation/how-to-video`,
`/ai-video-generation/spark-ads-style-video`) because those are the indexable
assets. The visible card name carries the detail address instead:

| Landing page | Old card name | Old address | New card name | New address |
|---|---|---|---|---|
| `/ai-video-generation/beauty-routine` | Beauty Routine | `/ai-video-generation/beauty-routine-beauty-routine` | Beauty Routine Video | `/ai-video-generation/beauty-routine-video` |
| `/ai-video-generation/how-to-video` | How-To Video | `/ai-video-generation/how-to-video-how-to-video` | How-To Product Video | `/ai-video-generation/how-to-product-video` |
| `/ai-video-generation/spark-ads-style-video` | Spark Ads Style Video | `/ai-video-generation/spark-ads-style-video-spark-ads-style-video` | TikTok Spark Ad Video | `/ai-video-generation/tiktok-spark-ad-video` |

Both copies of each card (`templateDefinition.card` and
`visual.picker.cards[0]`) carry the new name and the new slug, and the retired
slug becomes a `publicAliases` entry on the same card, so the retired address
answers 308 in one hop.

### 2. Keep the two homepage scenes separate

`Trousers Fold Demo` and `Tinted Balm Vanity Reel` exist twice: once on the
homepage and once on the video hub. The two copies are different media
(different preview image, prompt and creation tool), so the runtime identity
check refuses to merge them and the homepage copy cannot take the bare slug.
The homepage copies get their own names and addresses; the hub copies keep
theirs:

| Page | Old name / address | New name / address |
|---|---|---|
| `/` | Trousers Fold Demo — `/ai-video-generation/trousers-fold-demo-home` | Folded Trousers Detail — `/ai-video-generation/folded-trousers-detail` |
| `/` | Tinted Balm Vanity Reel — `/ai-video-generation/tinted-balm-vanity-reel-home` | Tinted Balm Detail — `/ai-video-generation/tinted-balm-detail` |
| `/ai-video-generation` | Trousers Fold Demo — `/ai-video-generation/trousers-fold-demo` | unchanged |
| `/ai-video-generation` | Tinted Balm Vanity Reel — `/ai-video-generation/tinted-balm-vanity-reel` | unchanged |

### 3. Drop the apostrophe instead of hyphenating it

`Court Gear from the Player's View` (a workspace case on
`/ai-image-generation/colorway-variations`) stored the slug
`court-gear-from-the-player-s-view`, because the slugifier turned the
apostrophe into a separator. The label keeps its apostrophe and the address
now reads like the card name: `/ai-video-generation/court-gear-from-the-players-view`.
The card still redirects to the canonical scene
`/ai-video-generation/first-person-discovery-court-gear`, and the retired
address keeps a single 308 hop because that alias is listed on the canonical
card only. Listing it on both cards would have made the alias ambiguous and
the runtime would have refused the redirect.

## Applied change

`scripts/manifests/aidreamcapes-card-renames-production-2026-10-22.json`
(contract `aidreamcapes-card-rename-2026-10-22-v1`, plan hash
`16b60be041f191cff49398cc6561336445632ca4c9538aa15530b2cf2ad4d622`).

| Target | Cards | Fields |
|---|---:|---|
| Production | 6 pages / 10 cards | 6 `label`, 5 `publicSlug`, 1 `publicSlug`, 5 `publicAliases` |
| Local | 6 pages / 10 cards | same |

Production `SiteContentRevision` advanced 271 -> 277; local 265 -> 271. The
apply transaction verified that MyDreamShoots public content did not change.

The manifest is the field-level inverse: `beforeSlug`, `beforeLabel` and
`beforeAliases` restore the retired address, so a rollback is a compare-and-set
inverse manifest against the current rows, not a snapshot.

## Verification

- `scripts/aidreamcapes-workspace/smoke-media-slug-aliases.mjs` now covers
  **80 retired addresses** (74 earlier + 6 new) in path mode and host mode:
  162 checks, no errors, production and local.
  Production report:
  `scripts/manifests/aidreamcapes-detail-slug-alias-production-smoke-2026-10-22-rerun2.json`.
  Local report:
  `scripts/manifests/aidreamcapes-detail-slug-alias-local-smoke-2026-10-22-rerun.json`.
- `scripts/aidreamcapes-workspace/smoke-workspace-case-aliases.mjs` still
  passes: 674 retired workspace-case addresses, 37 canonical targets, 713
  checks, no errors.
- The three landing pages answer `200`, stay `index, follow` with a
  self-canonical link, and now link to the new detail addresses.
- The homepage answers `200` and links to `/ai-video-generation/folded-trousers-detail`
  and `/ai-video-generation/tinted-balm-detail`; the hub page links are unchanged.
- The sitemap still holds 178 URLs and lists no detail address.
- Database invariant: **0** stored card rows keep a slug that is neither the
  label slug, the label + owner slug, nor the documented apostrophe form.

## Reproduction

```bash
# read-only plan
node scripts/plan-aidreamcapes-card-renames.mjs --target=production --write-manifest
# field-level apply
node scripts/apply-aidreamcapes-template-detail-slugs.mjs --target=production \
  --manifest=scripts/manifests/aidreamcapes-card-renames-production-2026-10-22.json \
  --apply --confirm=site_aidreamcapes-card-renames-production --base-hash=<planHash>
# release gate
AIDREAMCAPES_AUDIT_ORIGIN=http://127.0.0.1:3013 \
  node scripts/aidreamcapes-workspace/smoke-media-slug-aliases.mjs
```
