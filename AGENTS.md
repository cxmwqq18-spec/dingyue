# Repository Development Contract

All changes to public storefront data, pages, SEO, media, navigation, sitemap,
robots, JSON-LD, preview, and publishing flows must comply with
[`docs/standards/site-data-seo-single-publication-contract.md`](docs/standards/site-data-seo-single-publication-contract.md).

This is an active implementation contract. Before reporting a public storefront
change as complete, verify the applicable data owner, active publication,
snapshot/readback evidence, and regression checks required by that document.

## Publication Snapshot Switching Rule

During development, testing, release preparation, and production deployment,
do not switch to, restore, import, or silently fall back to any historical
publication or snapshot without the site owner's explicit approval in the
current task. Scripts and runtime code must never choose an older snapshot just
because it is available, newer code fails, or a current-state record is
missing.

When older copy or another historical field is required, create a new candidate
publication from the latest current data and apply only the explicitly
approved field changes. Keep all other pages, routes, media, navigation, SEO,
and facts from the latest current source. Activate the new publication only
after integrity checks and production readback pass. A rollback to an older
publication is an exceptional, explicitly approved operation and must record
the approval, publication ID/version, snapshot hash, and readback result.

## Public Storefront SSR Data Rule

All public, indexable storefront pages, including MyDreamShoots home, catalog
and detail pages, AI Video pages, Save the Date pages, blog pages, policy pages,
and navigation directories, must be complete server-rendered HTML.

- Browser JavaScript must not fetch, XHR, EventSource, prefetch, warm-fetch, or
  otherwise request page copy, navigation, catalog, SEO, media projections, or
  customer runtime data on public pages.
- Editable content must flow through PostgreSQL draft data, the publication
  compiler, and the active immutable publication snapshot before SSR HTML.
  Never replace missing data with hardcoded copy or client fetches.
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
