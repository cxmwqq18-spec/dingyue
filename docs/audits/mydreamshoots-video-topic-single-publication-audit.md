# MyDreamShoots Video Topic Publication Audit

Status: `PUBLISH_BLOCKED`

Standard: [`site-data-seo-single-publication-contract.md`](../standards/site-data-seo-single-publication-contract.md)

Scope: the 18 public MyDreamShoots AI video topic pages under
`/ai-video-generation/*`, their SEO output, JSON-LD, sitemap eligibility,
media, navigation, and synchronization path.

Audit date: 2026-08-23

## Result

The topic copy migration is partially complete: all 18 topics have their body,
SEO fields, FAQ, hero metadata, and alt text in `ThemePage` draft/published
JSON, and the frontend topic renderer no longer imports the old content maps.

This is not sufficient for the active publication contract. The current public
video topic flow is not yet a single immutable publication projection. Do not
report this module as `PASS` or perform a production SEO release until the P0
items below are closed.

## Evidence

The local target database active pointer resolves to:

```text
siteId: site_dreamshoot
publicationId: pub_site_dreamshoot_mt4kjrhh_285b2280
publicationVersion: 58
snapshotHash: 480b1002a7ecef4cac3b449db294e35da44cd61655de28f4ae76a580bbf5e4c2
```

That immutable snapshot has 18 `/ai-video-generation/*` page records, but it
has zero video route projections, zero page entities, zero media projections,
and zero link projections. Therefore these indexable pages have no complete
published owner/revision contract.

The current checks that passed are useful but narrower than this standard:

- `node scripts/smoke-mydreamshoots-video-topic-db-content.mjs`: 18 ThemePage
  records contain content and basic SEO parity.
- `npm run smoke:mydreamshoots-video-framework`: taxonomy/database framework
  checks passed.
- `npm run smoke:mydreamshoots-seo-indexing`: current sitemap implementation
  checks passed.
- `npm run smoke:mydreamshoots-publication-snapshot`: the existing snapshot
  contract passed, but that contract only models policy and AI image leaf
  routes, not video topics.

`npm run guard:mydreamshoots-publication-immutability` currently fails for
existing non-video sync scripts. That is a repository-level publication blocker
that must be closed independently; it must not be treated as a video-module
pass.

## P0 Findings

### 1. No published route/entity/media/link projection for video topics

The immutable snapshot validator accepts only `policy` and
`ai-image-theme-leaf` render routes. The video pages are instead accepted by a
special section-type branch. This violates the route inventory and per-page
entity requirements in sections 2.4, 4, 5, and 6 of the standard.

Evidence:

- `src/lib/publication-snapshot-integrity.ts` validates only those two route
  kinds.
- `src/lib/storefront-context/snapshot.ts` resolves video paths from a page's
  section type instead of a published route entity.
- The active v58 snapshot evidence above has no video entity, media, or link
  projections.

Required correction:

1. Add an `ai-video-theme-leaf` published route kind, or generalize the route
   entity model without weakening existing image/page checks.
2. Compile one published route, page entity, content revision, media entity,
   CTA link reference, and related-link references for every public video
   topic.
3. Make publication preflight reject an indexable video page that lacks any of
   those records.

### 2. Public routing still reads relational ThemePage and VideoTheme records

The public route checks `state.videoThemes`, `findPage`, and relational slug
redirects before it resolves the active snapshot. The code explicitly permits
newer relational records to bypass the immutable route projection. The tool
resolver also uses `VideoTheme` records to make a page routable.

Evidence:

- `src/app/site/[siteSlug]/[...path]/page.tsx`
- `src/lib/storefront-render.tsx`

Required correction:

1. Resolve every video topic request solely through
   `resolvePublishedRouteDisposition` / `resolveEffectivePublishedPage`.
2. Compile redirects into the active snapshot; do not fetch a relational
   redirect during a public request.
3. Treat missing or invalid snapshot entries as 404/noindex or a blocked
   publication, never as a valid relational fallback.

### 3. Header/video navigation has a second public data source

The header reads VideoTheme and VideoThemeCategory records from render data and
combines them with static taxonomy definitions. Those menu labels, order, and
cover images are not a revisioned navigation projection inside the active
publication.

Evidence:

- `src/components/theme-renderer.tsx`
- `src/lib/storefront-render.tsx`

Required correction:

Compile the visible AI Video Generation menu, including label, target page
entity, root-relative href, media reference, ordering, and revision into the
publication snapshot. Render the header only from that projection.

### 4. The video sync script writes `ThemePage.publishedJson`

The sync script writes draft and `publishedJson` directly before it builds a
new immutable publication. Direct writes create a second publish boundary and
are prohibited by section 7.3 of the standard.

Evidence:

- `scripts/sync-mydreamshoots-video-topic-pages.mjs`

Required correction:

1. Keep the sync/import path limited to approved source/draft data plus media
   records.
2. Make the formal publish service the only operation that creates a published
   page projection and atomically activates a new publication.
3. Tighten `guard-mydreamshoots-publication-immutability.mjs` so indirect
   `data: pageData` publishedJson writes are detected.

## Compliant Parts

- The old video body maps are now seed-only scripts and are not imported by
  the public topic renderer or topic JSON-LD generator.
- The 18 topic pages have separate ThemePage records and content, rather than
  sharing one generated body.
- Each stored topic payload includes its canonical path, title, description,
  keywords, hero source/alt, and FAQ data.
- The local runtime refuses file JSON fallback for the checked public route.

These are `PARTIAL` improvements, not a complete SEO publication closure.

## Closure Criteria

Mark the module `PASS` only after a candidate active publication contains all
18 video topic route/entity/media/link/navigation projections, the public
renderer, metadata, JSON-LD, sitemap, robots, and header consume the same
resolver result, and the following evidence is recorded against the target
database and public domain:

1. Snapshot integrity and hash/revision readback.
2. Per-route HTTP, canonical, unique H1, OG/Twitter URL, FAQ/Breadcrumb
   JSON-LD, media alt, CTA, related link, robots, and sitemap parity.
3. Database-outage and missing-active-publication failure tests.
4. `guard:mydreamshoots-publication-immutability` with no failures.
5. Public-domain readback, not only local origin verification.
