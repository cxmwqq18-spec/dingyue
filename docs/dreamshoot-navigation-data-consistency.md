# DreamShoot Navigation Data Consistency

## 2026-07-16 incident

The MyDreamShoots public homepage and signed-in workspace create page showed different navigation menu data on `localhost:3002`:

- `/site/mydreamshoots` Tools dropdown used the public theme/header data path.
- `/site/mydreamshoots/app/create` Tools dropdown used customer workspace relational bootstrap data.
- Browse packages also rendered the same theme set in a different order because the public header used the shared three-column mega menu layout while the customer shell rendered groups directly.

This made the issue look like the create page was refreshing into a separate data set. The actual root cause was split data and layout paths in local path-mode development:

- public path-mode pages defaulted to local JSON/theme preview data unless `STOREFRONT_PATH_MODE_READS=database` was set;
- signed-in customer workspace pages always used relational customer bootstrap data;
- package mega menu column ordering was implemented in the public header but not in the customer shell header.

## Rule

For MyDreamShoots, DreamShoot, and Aidreamcapes customer-facing routes, public navigation and signed-in navigation must use the same effective data source and layout rules.

- Default local path-mode reads for these storefronts must use the relational database.
- Use `STOREFRONT_PATH_MODE_READS=local`, `json`, `legacy`, or `file` only for an intentional local preview that is expected to differ from customer workspace data.
- Header/top-tab dropdown data is site-wide navigation data, not page-body data. `Browse packages` / `Travel Packages` and `Tools` must expose the same package themes, tool items, group headings, item order, and hrefs from every route and entry point for the same storefront.
- Focused detail routes such as `/collections/<slug>` and `/tools/<slug>` may use filtered data for page sections, but they must not feed the header dropdown from that filtered runtime payload.
- Query complete navigation datasets once per cache window and reuse them across routes. Do not create separate homepage, collection-detail, tool-detail, workspace, desktop, or mobile menu datasets that can drift.
- Tools menus must be compared between `/site/<slug>` and `/site/<slug>/app/create`.
- Browse packages menus must be compared between `/site/<slug>` and `/site/<slug>/app/create`.
- Do not rely on creative pack query order to define mega menu layout. Use the shared category ordering and the same three-column mega menu distribution.

## Verification Required

When changing DreamShoot storefront navigation, run a browser comparison for:

- `/site/mydreamshoots` Tools vs `/site/mydreamshoots/app/create` Tools
- `/site/mydreamshoots` Browse packages vs `/site/mydreamshoots/app/create` Browse packages
- Aidreamcapes equivalents when a customer session is available
- Anonymous public route parity for both stores:
  - `/site/<slug>`
  - `/site/<slug>/collections`
  - `/site/<slug>/collections/<collectionSlug>`
  - `/site/<slug>/tools`
  - `/site/<slug>/pricing`
  - `/site/<slug>/faq`
  - `/site/<slug>/login`

The comparison should assert link text, hrefs, group headings, group order, and group item order.

Use the smoke check when a local server is running:

```bash
npm run smoke:storefront-navigation-data
```
