# Aidreamcapes workspace-case inventory and alias gaps

Read-only inventory of `LivePage.contentJson` workspace cases for
`site_aidreamcapes`, taken against production revision **94** on 2026-10-22.
The inventory itself wrote no content, publication, snapshot, or MyDreamShoots
row. The two reviewed field-level batches that closed the 29 alias gaps were
applied afterwards; see "Applied normalization batch" below.

## What the records are

`workspaceCases` are page-local scenario cards stored at:

```text
sections.<section>.settings.data.workspaceCases[]
```

They are not the public template/picker grid and they are not sitemap entries.
They feed:

- workspace preset resolution (`presets.server.ts`);
- optional media detail ownership (`publicSlug`);
- detail-page related lists (up to six cards).

Each card carries a label, `kind`, preview image, prompt, `sceneSlug`, workspace
`href`, chips, `publicSlug`, and (for reviewed duplicates) `detailAliasOf`.

## Production inventory

| Measure | Count |
|---|---:|
| `workspaceCases` cards | 715 |
| Pages carrying them | 22 |
| `video` / `photo` | 703 / 12 |
| Pages with 37 cards | 19 (18 AI tool pages + `/templates`) |
| Occasion-page cards | 12 (3 pages: 3 + 3 + 6) |
| Still using `<label>-<owner-path>` suffix | 674 |
| Already using an exact label slug | 41 |
| Cards with `detailAliasOf` | 693 |
| Cards without `detailAliasOf` | 22 (9 suffix + 13 exact) |
| Different labels | 142 |
| Different preview images | 52 |
| Different prompts | 54 |
| Different `sceneSlug` values | 715 |

The 715 records are therefore a page × scenario matrix, not 715 unique visuals.
Most copies reuse one of roughly 37–52 base scenes.

## Public behaviour of the 674 long URLs

Every long URL was requested against the current production runtime in host
mode, with redirects disabled.

| Result | Count |
|---|---:|
| `308` | 665 |
| `200` | 9 |
| other | 0 |

Of the 665 redirects:

- **645** go directly to an exact/short canonical detail.
- **20** go to another long suffix URL. That target is itself `200`, so the final
  public address is still long.

The 20 redirects to a long target are:

- 12 Street Interview copies -> `street-interview-snack-bite-ai-video-generation-food-video`;
- 7 Close-up copies -> `close-up-unboxing-makeup-tools-templates`;
- 1 Street Interview copy -> `street-interview-snack-bite-ai-image-generation-jewelry-positioning`.

The 9 long URLs that return `200` directly are:

- 5 Street Interview variants (food, UGC still, virtual try-on, promo, jewelry);
- 1 Close-up variant (`/templates`);
- 3 fashion-try-on variants (Close-up, Cinematic Watch, Daily-Life App).

Together these are **29 records**:

| Cluster | Long `200` | Redirect to long target | Total |
|---|---:|---:|---:|
| Street Interview: Snack Bite | 5 | 13 | 18 |
| Close-up / Quiet Close-up: Makeup Tools | 1 | 7 | 8 |
| Fashion-try-on image variants | 3 | 0 | 3 |
| **Total** | **9** | **20** | **29** |

The remaining 645 long URLs already redirect directly to a short canonical and
need no data change.

## Canonical scene map

All four clusters already own a short canonical card on
`/ai-video-generation/video-ads`:

| Cluster | Canonical slug | Canonical page |
|---|---|---|
| Street Interview: Snack Bite | `street-interview-snack-bite` | `/ai-video-generation/video-ads` |
| Quiet Unboxing: Makeup Tools | `quiet-unboxing-makeup-tools` | `/ai-video-generation/video-ads` |
| Cinematic Watch Detail | `cinematic-watch-detail` | `/ai-video-generation/video-ads` |
| Lifestyle App Recommendation | `lifestyle-app-recommendation` | `/ai-video-generation/video-ads` |

The canonical cards are terminal (`detailAliasOf` absent) and return `200`.

### Why the 29 records did not redirect

- **Street Interview**: the 13 food-variant copies and the canonical card use
  slightly different sentences (`the food and expression in the same frame` vs
  `food and expression together in one frame`). Preset identity includes the
  prompt, so the runtime correctly refuses to merge them. Five other copies
  have further wording variants.
- **Close-up**: the 7 copies point at the `/templates` long target instead of
  the `quiet-unboxing-makeup-tools` canonical. The image and prompt already
  match; only the alias target is wrong.
- **Fashion try-on**: three cards use outfit-picker preview images
  (`img2-tpl-outfit-picker-front-{1,2,3}`) for makeup/watch/app labels. The
  preview URL is part of preset identity, so they cannot redirect to the
  correct canonical images.

## Applied normalization batch

Both batches were applied to production `site_aidreamcapes` through field-level
compare-and-set manifests against the current relational rows. No `publicSlug`,
`publicAliases`, sitemap entry, page anchor, publication, or snapshot was
touched, and the MyDreamShoots public-content hash was verified unchanged inside
both write transactions.

### Batch 1 - alias and identity normalization

`scripts/manifests/aidreamcapes-workspace-case-aliases-production-2026-10-22.json`
(plan hash `43ee9e7aabac464fd1c6e2d3d96290d2a911d0a2df47e75cc451f58b352fee14`).

| Operation | Count |
|---|---:|
| Street Interview prompt normalization to the canonical food wording | 7 |
| Fashion-try-on preview image correction | 3 |
| `detailAliasOf` writes/repoints | 29 |
| Canonical quiet-unboxing scene pin | 1 |

20 pages / 32 cards were rewritten; `SiteContentRevision` advanced 94 -> 114.

### Batch 2 - quiet-unboxing scene correction

The first batch pinned the canonical `quiet-unboxing-makeup-tools` card to
`texture_closeup`. That made the nine `Close-up` copies match, but it broke the
eight pre-existing `Close Unboxing` copies whose labels derive `process_demo`,
so those eight retired addresses answered `200` instead of `308`.

`scripts/manifests/aidreamcapes-workspace-case-quiet-scene-fix-production-2026-10-22.json`
(plan hash `23ad6945df49576e1b12ecbfc00cf89241a3609d61a7c7fbd27566a2d90ac119`)
restores the canonical card's original derived scene and pins the nine close-up
copies to `process_demo` instead: 10 pages / 10 cards, 10 `sceneId` writes, and
`SiteContentRevision` advanced 261 -> 271.

The two batches are separated by a concurrent site-wide content refresh outside
this project (150 further pages, revision 114 -> 261). The corrective batch was
re-planned against that state, and its compare-and-set plan refused to write
when a reviewed page had changed.

### Final state

| Check | Result |
|---|---|
| Retired workspace-case addresses | 674 |
| `308` to a short canonical detail | 674 |
| Still `200` | 0 |
| Redirecting to another long address | 0 |
| Distinct canonical targets | 37 |
| Database invariant (`1 owner, exact slug, terminal`) | 674 / 674 |
| `detailAliasOf` on workspace cases | 702 (674 suffix + 28 exact) |
| Workspace cases without an alias | 13 (all exact, all unlinked) |
| Duplicate `publicSlug` owners | 0 |

### Verification

- `scripts/aidreamcapes-workspace/smoke-workspace-case-aliases.mjs` - 713
  checks: every retired address answers `308` with the exact short path, all 37
  canonical targets answer `200` with a self-canonical link, `noindex, follow`
  and exactly one workspace CTA, the sitemap lists neither the retired nor the
  canonical detail addresses, and the homepage answers `200`.
  Report: `scripts/manifests/aidreamcapes-workspace-case-aliases-production-smoke-2026-10-22.json`.
- `scripts/aidreamcapes-workspace/smoke-media-slug-aliases.mjs` - the earlier
  74-address gate still passes in both path and host mode (150 checks).
  Report: `scripts/manifests/aidreamcapes-detail-slug-alias-production-smoke-2026-10-22-rerun.json`.
- The 22 pages that carry workspace cases answer `200`, stay `index, follow` and
  self-canonical, and the sitemap still holds 178 URLs.
- MyDreamShoots rows were not written; the protected hash assertion inside both
  apply transactions passed.

### Reproduction

```bash
# read-only plan
PRISMA_BASE=<release> node --env-file=<release>/.env \
  scripts/plan-aidreamcapes-workspace-case-aliases.mjs --target=production \
  --write-manifest --out=<plan.json>

# field-level apply (production needs the explicit confirmation and plan hash)
PRISMA_BASE=<release> node --env-file=<release>/.env \
  scripts/apply-aidreamcapes-workspace-case-aliases.mjs --target=production \
  --manifest=<plan.json> --apply \
  --confirm=site_aidreamcapes-workspace-case-aliases-production \
  --base-hash=<planHash>

# release gate
PRISMA_BASE=<release> AIDREAMCAPES_AUDIT_ORIGIN=http://127.0.0.1:3013 \
  AIDREAMCAPES_AUDIT_MANIFEST=<plan.json> \
  node scripts/aidreamcapes-workspace/smoke-workspace-case-aliases.mjs
```

Both apply runs wrote a field-level inverse next to their report
(`*-rollback.json`), so a rollback is a compare-and-set inverse manifest against
the current rows, not a snapshot or a publication.

