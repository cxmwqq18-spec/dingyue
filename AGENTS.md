# Repository Development Contract

All changes to public storefront data, pages, SEO, media, navigation, sitemap,
robots, JSON-LD, preview, and publishing flows must comply with
[`docs/standards/site-data-seo-single-publication-contract.md`](docs/standards/site-data-seo-single-publication-contract.md).

This is an active implementation contract. Before reporting a public storefront
change as complete, verify the applicable data owner, active publication,
snapshot/readback evidence, and regression checks required by that document.

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
