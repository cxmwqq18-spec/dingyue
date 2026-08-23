# AI Subscription Platform

Multi-site AI subscription SaaS MVP inspired by the store-management shape of ShopFire/XFCart, but implemented as a new Next.js product rather than a PHP clone.

## What Is Implemented

- Platform dashboard at `/platform`
- Platform password login at `/platform/login`
- Platform can create cloned sites from an existing site
- Platform can add site-scoped domains and initialize site admins
- Platform shows per-site model readiness, album readiness, Connect readiness, AI gateway policy, and recent worker/order/audit activity
- Site storefront at `/site/lumen`
- Site admin at `/site/lumen/admin`
- Site admin password login at `/site/lumen/admin/login`
- Customer-demo-ready site admin backend with DreamShoot-style modules:
  - photoshoot pack/theme editor with credits, output count, training requirement, and bound AI tool
  - customer AI model training board for selfie intake, provider model IDs, failure reasons, and ready/failed states
  - private album handoff board for generated customer albums, cover asset, visibility, and delivery status
  - theme media library for storefront/policy/pack assets separated from customer private uploads
  - customer status and manual credit adjustment tools
  - AI tool enablement, credit-cost, and worker route editor
  - failed job rerun panel
  - subscriptions, orders, credit ledger, and sensitive activity trail
- Store-style block designer at `/site/lumen/admin/design`
- Site customer password login at `/site/lumen/login`
- Site customer workspace at `/site/lumen/app`
- Job detail and worker callback test page at `/site/lumen/app/jobs/[jobId]`
- Site-scoped customers, products, AI apps, credits, jobs, and published theme pages
- PostgreSQL-backed relational persistence through Prisma
- Prisma schema for the production data model
- Persisted Stripe webhook idempotency and credit grants in dev mode
- Persisted AI worker status/result callbacks with reserve, consume, and release credit settlement
- Site admin can edit installed AI tool enablement, credit cost, and worker route
- Site admin can update customer status and apply manual credit adjustments
- Site admin can rerun failed/refunded generation jobs with a new reserved job
- Customer workspace can create and delete private input assets
- Worker success outputs are saved as private output assets for the customer album
- Asset download links are generated through site/customer scoped API routes
- Site-level AI gateway policy covers model allowlist, quota, retry status codes, rate limit, and account-pool mode
- Theme JSON rendering with `sectionsOrder` and section instances

## Core Boundaries

- `site_id` is the tenant boundary.
- Customers are unique by `(site_id, email)`.
- Each site has its own Stripe Connect account.
- Pricing sections read product data, not static admin text.
- N8N is only an AI worker; it does not receive Stripe webhooks or mutate credits.
- Draft designer changes do not affect the storefront until a publish snapshot is created.
- Customer sessions are scoped by site cookie name.
- Platform, site admin, and customer sessions use separate cookies.
- Platform and site admin mutation APIs reject unauthenticated requests.
- Customer asset, checkout, and job APIs reject requests without the matching site/customer session.
- Worker result replay does not double-settle credits.
- Stripe webhook replay does not double-grant credits.
- Site admin actions are constrained by `site_id` route parameters.
- Rerun jobs do not mutate the original failed job; they create a new job linked by `requestJson.rerunOf`.
- Customer assets are constrained by `(site_id, customer_id)` and soft-deleted with `deletedAt`.
- Local asset downloads are dev-mode signed links; production should replace the body with S3-compatible signed object URLs.
- Site cloning copies theme pages/settings, products/prices, AI app installs, and gateway policy, but does not copy customers, jobs, ledger, or assets.
- Site cloning also copies photoshoot pack templates and theme media references into the new site namespace.
- AI gateway policy borrows the subscription/account-pool shape from sub2api-style systems without coupling billing or credits to the worker.
- DreamShootAI-style reference shape implemented in this demo: upload-to-training, model readiness, themed photo packs, generated private albums, and credit-backed checkout/worker settlement.

## Run

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3000/`
- `http://localhost:3000/platform`
- `http://localhost:3000/platform/login`
- `http://localhost:3000/site/lumen`
- `http://localhost:3000/site/lumen/login`
- `http://localhost:3000/site/lumen/app`
- `http://localhost:3000/site/lumen/admin`
- `http://localhost:3000/site/lumen/admin/login`
- `http://localhost:3000/site/lumen/admin/design`

Seed credentials:

- Platform: `platform@local.test` / `platform123`
- Lumen site admin: `owner@lumen.localhost` / `lumen123`
- Atlas site admin: `owner@atlas.localhost` / `atlas123`
- Lumen customer: `mara@northpier.studio` / `mara123`
- Newly cloned site admin: the owner password entered in the create-site form, or `${slug}123` if omitted by API.

## Verify Current Working Block

Run the dev server in one terminal:

```bash
npm run dev
```

Then run:

```bash
npm run typecheck
npm run smoke:core
```

The smoke script resets the JSON state, verifies platform/admin/customer routes are blocked before login, signs into the
platform, creates a cloned site from `site_lumen`, signs into the new site's admin, adds a domain, updates the new site's
AI gateway policy, signs into Lumen admin, verifies the DreamShoot-style backend sections render, logs a customer into
`site_lumen`, creates a generation job, reserves credits, creates and deletes a private input asset, generates signed asset
download links, edits an AI tool's credit cost and worker route, edits a photoshoot pack, edits a theme media asset, marks
a customer model ready, hides an album, updates a customer status, applies a manual credit adjustment, posts a worker
success callback, verifies the output became a private album asset, replays the callback to verify idempotency, creates and
fails another job, reruns the failed job, posts a Stripe webhook credit grant, and replays the webhook to verify no duplicate
grant.

## Production Notes

The website runtime reads and writes PostgreSQL through Prisma. The retired JSON state file has been removed; only `archive/legacy/platform-state.json` remains as an explicit historical migration fixture and is never a runtime or deployment fallback. A missing or unavailable database is surfaced as an error instead of serving stale file content.

Production implementation must still:

- verify Stripe signatures,
- create Checkout sessions in the connected account scope,
- verify worker HMAC signatures,
- run timeout compensation for accepted jobs with no result callback,
- maintain PostgreSQL + Prisma migrations,
- replace dev-mode signed asset links with real S3-compatible signed URLs,
- harden RBAC, audit log coverage, rate limits, and deployment secrets before real customers.
