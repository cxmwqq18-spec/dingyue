# Repository Development Contract

All changes to public storefront data, pages, SEO, media, navigation, sitemap,
robots, JSON-LD, preview, and publishing flows must comply with
[`docs/standards/site-data-seo-single-publication-contract.md`](docs/standards/site-data-seo-single-publication-contract.md).

The publication/snapshot portions of that historical contract are superseded by
[`docs/no-snapshot-incremental-release.md`](docs/no-snapshot-incremental-release.md).
Before reporting a public storefront change as complete, verify the relational
data owner, derived-state revision, origin/public readback, and regression checks.

## No-Snapshot Publication Rule

During development, testing, release preparation, and production deployment,
do not switch to, restore, import, or silently fall back to any historical
publication or snapshot without the site owner's explicit approval in the
current task. Scripts and runtime code must never choose an older snapshot just
because it is available, newer code fails, or a current-state record is
missing.

Historical publications and snapshots are audit-only and cannot be activated,
restored, imported, or used as rollback sources. Copy/content rollback is an
explicit field-level inverse manifest against current relational data. Online
edits win conflicts unless a new operation explicitly targets that field.

## Public Storefront SSR Data Rule

All public, indexable storefront pages, including MyDreamShoots home, catalog
and detail pages, AI Video pages, Save the Date pages, blog pages, policy pages,
and navigation directories, must be complete server-rendered HTML.

- Browser JavaScript must not fetch, XHR, EventSource, prefetch, warm-fetch, or
  otherwise request page copy, navigation, catalog, SEO, media projections, or
  customer runtime data on public pages.
- Editable content must flow through PostgreSQL relational source data. The
  compiler may refresh `SitePublishedState` as a derived cache, but it is never
  a deployment/import/rollback source. Never replace missing data with hardcoded
  copy, historical snapshots, or client fetches.
- Public page content must be read only from `LivePage.contentJson`.
  `ThemePage`, `draftJson`, and `publishedJson` are legacy admin migration
  storage and must never be queried or used as a fallback by public SSR,
  metadata, sitemap, robots, navigation, or directory loaders.
- A committed `LivePage` update is live on the next server request. Do not
  require a publication action, content snapshot, deployment, or cache refresh
  for it to become visible.
- `use client` is allowed only for explicitly reviewed, non-data presentation
  behavior and cannot become a public data source.
- Private `/account`, `/app`, checkout, authentication, customer generation,
  and admin routes retain their authenticated client APIs.
- New public routes default to SSR-only and must pass static and no-JavaScript
  storefront regression checks before release.

## Public Frontend Copy Boundary

### First Principle

The sole purpose of a public frontend page is to communicate product
information to end users, build understanding, support decisions, and enable
interaction.

Therefore, information that is not written for end users must never enter
user-visible frontend content.

### Required Distinction

Strictly distinguish between the following:

1. **Internal information**: product intent, page goals, SEO strategy, search
   intent, content structure, design notes, development requirements, editing
   notes, task descriptions, prompts, annotation requirements, and any other
   information used to guide generation or implementation.
2. **Public copy**: content that end users can naturally read on a production
   page and that directly helps them understand the product, its features,
   value, use, or a relevant decision.

### Mandatory Constraints

- Only public copy may be rendered in the frontend.
- Internal information must not appear in any user-visible area directly, or
  after rewriting, concatenation, summarization, transformation, or any other
  variation.
- If it is unclear whether content is internal information or public copy,
  treat it as internal information by default.
- SEO is a constraint for optimizing page content; it is not display content
  itself.
- Page-structure descriptions are generation inputs; they are not webpage
  copy.
- Do not store internal instructions that do not belong in production frontend
  content in HTML comments, hidden DOM, frontend variables, or client-side
  data.
- Before completing any change to a public page, inspect every added or changed
  visible string and confirm that it meets this standard: it is copy that a
  formal website would directly write for its end users.

This rule takes precedence over wording-reuse requirements in content
generation tasks.

## Aidreamcapes Store Isolation Rule

Aidreamcapes-only work is strictly isolated from MyDreamShoots. When a task
names Aidreamcapes, the allowed write target is limited to Aidreamcapes-owned
runtime data, pages, routes, SEO, media, navigation, assets, and deployment
records for `site_aidreamcapes` and its Aidreamcapes domains.

The following are explicitly out of scope and must not be edited, migrated,
seeded, regenerated, synchronized, or overwritten as part of an Aidreamcapes
task:

- MyDreamShoots data, pages, SEO, media, routes, navigation, assets, or
  deployment records (`site_dreamshoot`, `mydreamshoots`,
  `www.mydreamshoots.com`).
- MyDreamShoots-only source files, content manifests, generated state, and
  database records.
- Shared templates, shared navigation, shared theme defaults, shared
  components, migrations, sync scripts, or deployment configuration when the
  change could alter MyDreamShoots behavior.

Read-only comparison or regression checks against MyDreamShoots are allowed,
but they must not produce writes. If an Aidreamcapes fix appears to require a
shared layer or would change MyDreamShoots behavior, stop and request explicit
approval before editing that layer.

Before reporting an Aidreamcapes change complete:

1. Inspect `git diff --name-only` and confirm every changed file is within the
   Aidreamcapes scope.
2. Review database or sync commands for an explicit `site_aidreamcapes`
   filter; never run an unscoped cross-store update.
3. Confirm no MyDreamShoots production route, content, asset, SEO, or
   navigation output changed. Any detected change is a release blocker until
   the user explicitly approves it.
