# Google Official SEO Audit - 2026-07-13

## Scope

Audited the current Next.js storefront implementation against Google Search Central guidance, focusing on crawlability, indexability, metadata, canonical URLs, robots.txt, sitemaps, links, structured data, JavaScript rendering, images, and page experience signals.

Primary local targets:

- `www.mydreamshoots.com`
- `www.aidreamcapes.com`

Local verification used the running Next server with production `Host` headers. Live production verification used Chromium with a Googlebot user agent after deploying the production fix.

## Google Official Baseline

- Google Search technical requirements: Googlebot must not be blocked, the page should return HTTP `200`, and the page must contain indexable content.
  Source: https://developers.google.com/search/docs/essentials/technical
- Google should be able to see the page as a user does, including access to important CSS and JavaScript resources.
  Source: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Links should be crawlable as `<a>` elements with `href` attributes.
  Source: https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- `robots.txt` manages crawler access and traffic; use `noindex` or authentication for pages that should not appear in Search.
  Source: https://developers.google.com/search/docs/crawling-indexing/robots/intro
- Sitemaps help Google discover important URLs, but do not guarantee crawling or indexing.
  Source: https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
- Canonical signals should be clear, absolute, and consistent. Self-referential canonicals are recommended.
  Source: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Structured data gives Google explicit clues about page meaning.
  Source: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- Page experience checks include Core Web Vitals, HTTPS, mobile presentation, intrusive interstitials, and clear main content.
  Source: https://developers.google.com/search/docs/appearance/page-experience

## Current Live Production Snapshot

### Pass

- `https://www.mydreamshoots.com/` returns `200` in Chromium, has canonical `https://www.mydreamshoots.com/`, `robots=index, follow`, one H1, JSON-LD, and no missing image alt text in the sampled page.
- `https://www.aidreamcapes.com/` returns `200` in Chromium, has canonical `https://www.aidreamcapes.com/`, `robots=index, follow`, one H1, JSON-LD, and no missing image alt text in the sampled page.
- Both live `sitemap.xml` responses returned `200` in Chromium and did not include private URL patterns in the sampled checks.
- `/login` on both live domains returns `X-Robots-Tag: noindex, nofollow`.
- Both live `robots.txt` files now include the app-generated `User-Agent: *`, `Allow: /`, and the correct host-specific sitemap line.
- Live `/search` pages now return `X-Robots-Tag: noindex, nofollow`.
- Both live sitemaps use the correct production host and the sampled checks found no private URL patterns.

### Notes

- Cloudflare Managed Content-Signal is prepended to live `robots.txt` and includes `Disallow: /` for non-search/AI crawlers such as `Google-Extended`, `GPTBot`, and `ClaudeBot`. This does not block Google Search's Googlebot under the sampled `User-Agent: *` search-crawl rules.
- Command-line clients from this machine previously received `Connection reset by peer` from the Cloudflare edge for the production hostnames. Chromium can load the same pages, but Cloudflare logs and Google Search Console URL Inspection remain the best authoritative production crawl checks.

## Local Findings

### Pass

- Public storefront pages return HTTP `200` locally with production host headers.
- Public pages include useful `<title>`, meta description, canonical URL, `robots` metadata, one H1, crawlable internal links, image `alt` attributes, and JSON-LD.
- Private or account-like pages are blocked from indexing with `X-Robots-Tag: noindex, nofollow` and route-level noindex metadata.
- `robots.txt` is generated, includes the correct production sitemap line per host, and no longer blocks private UI paths that rely on `noindex` headers.
- `sitemap.xml` is host-aware and excludes private paths such as login, admin, app, account, cart, checkout, job, and search.
- JSON-LD blocks parse successfully and include `Organization`, `WebSite`, `SoftwareApplication`, `BreadcrumbList`, and `FAQPage` on tested home pages.
- Next config uses `htmlLimitedBots: /.*/`, which favors full HTML output for bots instead of relying only on client-side hydration.
- TypeScript type check passed.

### Evidence

MyDreamShoots local host-header checks:

- `/`: `200`, canonical `https://www.mydreamshoots.com/`, `robots=index, follow`, 1 H1, 150 anchors, 12 images, 0 missing alt, 1 JSON-LD block.
- `/pricing`: `200`, canonical `https://www.mydreamshoots.com/pricing`, `robots=index, follow`, 1 H1.
- `/creators-circle`: `200`, canonical `https://www.mydreamshoots.com/creators-circle`, `robots=index, follow`, 1 H1.
- `/login`: `200`, `X-Robots-Tag: noindex, nofollow`.
- `/robots.txt`: `200`, includes `Sitemap: https://www.mydreamshoots.com/sitemap.xml`, no `Disallow` rules.
- `/sitemap.xml`: `200`, 32 URLs, no private URL patterns.

Aidreamcapes local host-header checks:

- `/`: `200`, canonical `https://www.aidreamcapes.com/`, `robots=index, follow`, 1 H1, 0 missing image alt, 1 JSON-LD block.
- `/robots.txt`: `200`, includes `Sitemap: https://www.aidreamcapes.com/sitemap.xml`.
- `/sitemap.xml`: `200`, 36 URLs, no private URL patterns.

Smoke checks:

- `npm run smoke:public-seo-policy`: passed.
- `npm run smoke:mydreamshoots-seo-indexing`: passed.
- `npm run smoke:storefront-seo-fingerprint`: passed.
- `npm run smoke:dreamshoot-public-seo-templates`: passed.
- `npm run typecheck`: passed.

## Follow-Up Remediation

- Removed private UI `Disallow` rules from `robots.txt` so Google can see `X-Robots-Tag` and meta `noindex` on private/login/search paths.
- Added `X-Robots-Tag: noindex, nofollow` coverage for additional private UI paths such as `/admin`, `/dashboard`, `/job`, `/search`, and their `/site/:siteSlug/...` equivalents.
- Updated the sitemap route to prefer `X-Forwarded-Host` before `Host`, which keeps generated sitemap URLs aligned behind Cloudflare or another reverse proxy.
- Updated SEO smoke tests so they validate the current short canonical redirects, noindex-via-header strategy, host-aware sitemaps, and synthetic partner pages.
- Deployed production release `/www/wwwroot/mydreamshoots.com/releases/google-seo-noindex-2f96189-20260713050823` and restarted `mydreamshoots.service`.

## Risks / Follow-Up

- Direct command-line requests from this machine to `https://www.mydreamshoots.com/` and `https://www.aidreamcapes.com/` previously returned `Connection reset by peer`; DNS resolves through Cloudflare. Chromium reached both sites with `200`, but Search Console URL Inspection should still be used to confirm Google's actual crawl result.
- `npm run smoke:seo-tdk-editor` failed because local database state had no `site_dreamshoot` site admin session prerequisite. This is a test data issue for the editor smoke, not evidence that public SEO output is broken.
- Core Web Vitals were not measured in this pass. Run PageSpeed Insights or Search Console Core Web Vitals on production URLs.

## Conclusion

The current live public pages are broadly aligned with Google Search Central's minimum technical requirements, and the deployed production fix resolves the prior `robots.txt` / `noindex` mismatch for sampled private/search paths. Complete confirmation should still be done in Google Search Console URL Inspection and Core Web Vitals/PageSpeed Insights.
