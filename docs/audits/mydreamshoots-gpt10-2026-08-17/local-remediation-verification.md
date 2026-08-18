# MyDreamShoots Priority Blog Remediation - Local Verification

Status: **local only, not published**
Verification date: **2026-08-18**

## Scope

This implementation changes only the nine approved MyDreamShoots blog URLs:

1. `/blog/cyberpunk-photo-package-guide`
2. `/blog/mafia-photo-package-guide`
3. `/blog/magic-upscaler-photo-package-guide`
4. `/blog/nature-photo-package-guide`
5. `/blog/outdoor-creator-scenes-photo-package-guide`
6. `/blog/valentine-photos-photo-package-guide`
7. `/blog/virtual-try-on-photo-package-guide`
8. `/blog/wedding-portraits-photo-package-guide`
9. `/blog/world-cup-fan-photos-photo-package-guide`

No test or production deployment was run. Local-only database rows were updated for the nine approved MyDreamShoots articles and the three required Aidreamcapes policy pages; no online or production database was changed. Aidreamcapes blog content, global policy copy, footer content, product-page headings, login links, and other blog copy remain out of scope.

## Implemented

- Added explicit source-controlled content overrides for the nine URLs, keyed from the current active package entities to the retained historical blog slugs.
- Removed the nine conflicting legacy redirect entries while leaving all other legacy redirects unchanged.
- Added optional `relatedLinks`, `secondaryTargetLabel`, `secondaryTargetHref`, and `authorType` article settings with fallback behavior for every other blog page.
- Changed the nine BlogPosting authors to `Organization`; body FAQs remain ordinary article content and do not create FAQPage structured data.
- Preserved each original publication date, set `updatedAt` to `2026-08-18`, retained self-canonical/index/follow configuration, and kept current cover assets with page-specific alt text.
- Generated only the nine local page records, their MyDreamShoots SEO map entries, and matching local publication snapshot entries in `data/platform-state.json`; the same nine records were then synced to the disposable local PostgreSQL store and its state snapshot.
- Added a scoped CLI mode with `--dry-run`, `--site-id`, `--slugs`, and `--db`. Database writes require a local host, `ALLOW_LOCAL_BLOG_DB_SYNC=1`, and an explicit `LOCAL_BLOG_DB_CONTAINER_CONFIRMED=1` confirmation for mapped local container ports.
- Added an equally scoped policy-page sync mode for Aidreamcapes. It updates `/shipping`, `/children-privacy`, and `/state-privacy` in the local JSON source, relational `ThemePage` rows, and the local `PlatformStateDocument` sitemap snapshot without touching other site content.

## Content Metrics

| Page | Body characters | H2 | FAQ H3 | Related links |
|---|---:|---:|---:|---:|
| Cyberpunk | 5,052 | 6 | 3 | 3 |
| Mafia | 4,304 | 5 | 3 | 3 |
| Magic Upscaler | 4,691 | 6 | 3 | 3 |
| Nature | 4,432 | 6 | 3 | 3 |
| Outdoor Creator | 4,547 | 6 | 4 | 3 |
| Valentine's Day | 3,835 | 5 | 3 | 3 |
| Virtual Try-On | 4,466 | 6 | 3 | 3 |
| Wedding | 4,462 | 6 | 4 | 3 |
| Soccer | 4,409 | 6 | 3 | 3 |

The highest normalized five-word Jaccard similarity is **0.0253**, between the Valentine's Day and Wedding pages. The internal warning threshold is 0.70. No repeated substantive paragraph was found across the nine articles.

## Verification Results

Passed:

- Scoped content generator dry-run for exactly nine slugs.
- `scripts/smoke-mydreamshoots-priority-blog-remediation.mjs`.
- `smoke:mydreamshoots-seo-indexing`.
- `smoke:storefront-media-alt`.
- `guard:mydreamshoots-content`.
- Customer-facing Chinese-character scan across all touched storefront files.
- Semantic state diff: only the nine MyDreamShoots pages, MyDreamShoots SEO entries, and two matching local publication snapshots changed; no other site changed.
- `npm run typecheck`.
- Local PostgreSQL migration status reports `Database schema is up to date`; the missing `Product.metadata` column and the current storefront single-source columns were applied only to the disposable local database, then all existing migration history was marked applied to baseline the pre-existing schema.
- `npm run build` (existing image and unused-variable lint warnings remain; no build-blocking errors).
- Playwright: 36/36 checks passed across the nine host routes and nine `/site/mydreamshoots` routes at desktop and 390px mobile viewports. All responses were HTTP 200 with no target-route redirects. The machine-readable result and screenshots are in `local-playwright/report.json` and `local-playwright/`.
- BlogPosting assertions: one `BlogPosting` per article, `Organization` author, `dateModified` set to `2026-08-18`, canonical/image/headline present, and no `FAQPage` schema.
- Internal link resolution, including the Soccer page's content-policy link in the `/site/mydreamshoots` route, completed with final HTTP 200 responses.
- Fresh local preview verification: all nine host routes and all nine `/site/mydreamshoots` path-mode routes return `200` with no `Location`, unique H1/Title values, self-referencing canonicals, Organization-author BlogPosting JSON-LD, and no FAQPage schema.
- Fresh local preview sitemap verification: MyDreamShoots and Aidreamcapes both pass directory coverage; Aidreamcapes now includes `/shipping`, `/children-privacy`, and `/state-privacy`.

Environment residuals outside this nine-page change:

- `smoke:mydreamshoots-seo-ssr` now reaches its pricing assertion after the local schema fix, but fails because local Price rows are draft/manual and lack verified provider `price_...` identifiers. No Stripe or other paid provider was contacted, and no verification status was fabricated.
- `smoke:public-seo-ssr` remains blocked by its separate `aidreamshoots.eu/tools` redirect expectation; the local 3003 preview does not serve the external `.eu` host route as a 200 response. This is outside the nine `.com` blog pages and the policy sitemap fix.
- The older all-site `smoke:dreamshoot-blog-content` remains a separate global-contract check: it expects 38 MyDreamShoots and 28 Aidreamcapes articles while the local state contains 28 and 4, and assumes MyDreamShoots targets use `/collections/*`. It was not expanded into this nine-page change.
- The full public-route Playwright smoke against the user-owned 3002 process was left out after one request exceeded its own wait; targeted page and sitemap checks completed on the fresh 3003 preview process.

## Database Safety

The configured database URL resolves to `127.0.0.1:15433`, mapped by the local Colima container `dingyue-postgres-local` to PostgreSQL 16. Scoped writes required explicit local-container confirmation and updated only the approved page records, snapshots, and schema baseline. No production or remote database operation was run.

## Publication Gates

- Replace the local Virtual Try-On cover with an approved source-person / garment-reference / AI-preview workflow asset before publication.
- Complete brand and legal review before publishing the retained World Cup legacy URL; visible content is already generic Soccer and contains no official affiliation claim.
- Populate verified provider-backed public prices before relying on the embedded pricing assertion; do not mark manual local prices as provider-verified.
- Re-run the scoped generator and smoke against the final clean commit before any future content release workflow is considered.
