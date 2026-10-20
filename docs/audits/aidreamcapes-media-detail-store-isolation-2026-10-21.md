# AIVideosUGC media-detail remediation — store isolation verification

Date: 2026-10-21 (Asia/Shanghai)
Scope under test: AIVideosUGC (`site_aidreamcapes`, `www.aivideosugc.com`) media-detail remediation.
Out-of-scope stores that must be provably unchanged: MyDreamShoots (`site_dreamshoot`,
`www.mydreamshoots.com`), Aidreamshoots (`site_mydreamshoots_xby`, `aidreamshoots.eu`),
Aidreamcapes EU (`site_aidreamcapes_xby`, `aidreamcapes.eu`).
Method: read-only. No file was modified except this report. No database write, migration,
publication or snapshot write was issued.

## 0. Summary

| # | Check | Result |
|---|---|---|
| 1 | Git scope: every changed file classified; shared files guarded by site id/slug | **PASS** |
| 2 | Runtime isolation — MyDreamShoots (host mode): 8 pages, 200 + real title, card anchors unchanged vs pre-remediation | **PASS** |
| 3 | Runtime isolation — MyDreamShoots sitemap: URL count, no `/ai-actors/*`, no AIVideosUGC leakage | **PASS** |
| 4 | Runtime isolation — Aidreamshoots (`aidreamshoots.eu`): `/` + directory path 200, content shape unchanged | **PASS** |
| 5 | Runtime — AIVideosUGC detail pages work (`noindex, follow`, canonical, not in sitemap) | **PASS** |
| 6 | Runtime — AIVideosUGC sitemap = 177 URLs, 0 nested actor URLs, 53 flat actor URLs | **PASS** |
| 7 | Database isolation — no `site_dreamshoot` / `site_aidreamshoots` / `site_aidreamcapes_xby` row modified | **PASS** |
| 8 | Cross-store negative checks — new AIVideosUGC redirects do not leak into MyDreamShoots | **PASS** |
| 9 | AIVideosUGC-only defect found (not a store-isolation failure): the **video** media-detail page emits protocol-relative `//app/create` links in host mode (157 anchors); the photo detail page leaks the `/site/aidreamcapes` prefix in host mode | **FAIL (AIVideosUGC feature defect)** |

No MyDreamShoots / Aidreamshoots regression was detected. Item 9 is a new AIVideosUGC defect
and must be fixed before release, but it does not touch another store's output.

---

## 1. Environment and method

Repository: `/Users/a1/orca/workspaces/dingyue/main-2` (Next.js 15.5.22 + Prisma).
Local PostgreSQL: `postgresql://dingyue_local:dingyue_local_dev@127.0.0.1:15433/dingyue_local`
(`PGPASSWORD=dingyue_local_dev`), `SHOW timezone` = `UTC`.

Commits under test (baseline = parent of the remediation commit):

```
git log --oneline -6
f36f56217 Allow fixed video workspace for inspiration scene entries
228fc706d Honor current actor SEO and relational release inventories
97ae1e340 Serve Aidreamcapes media details before workspace entry   <-- remediation commit
6c69591d8 Scope inspiration projection checks to gallery data        <-- PRE-REMEDIATION BASELINE
```

Dev servers used:

* **current** — `http://127.0.0.1:3003`, the running workspace dev server for this checkout.
  Note: the server that was on `:3003` when this audit started had died; it was restarted
  (same command family, `NEXT_DIST_DIR=.next-3003`) and was subsequently replaced by a
  concurrent session's dev server bound to the same port. Both serve the same working tree,
  so "current" == working tree at `f36f56217` plus the concurrent session's uncommitted
  **script-only** edits (see §1.3).
* **baseline** — `http://127.0.0.1:3006`, a separate dev server started from a clean
  `git archive 6c69591d8` export in `/tmp/mds-base0` (own dist dir, `node_modules` symlinked).
  Baseline server stopped and its temp directory removed after the comparison.

Requests used host selection via forwarded headers, e.g.

```
curl -s --max-time 180 -H "x-forwarded-host: www.mydreamshoots.com" \
     -H "x-forwarded-proto: https" http://127.0.0.1:3003/<path>
```

### 1.1 Git scope check

```
git diff --name-only        # (session start) empty — tracked tree was clean
git status --short          # (session start)
?? releases/
?? src/app/api/tmp-debug-page/
```

Both untracked entries pre-existed this audit and were not created by it.

Branch diff (baseline → HEAD):

```
git diff --name-only 6c69591d8..HEAD
git diff --shortstat 6c69591d8..HEAD   # 39 files changed, 6694 insertions(+), 415 deletions(-)
```

| Class | Files |
|---|---|
| **AIVideosUGC-only** (new modules / v2 theme / AIVideosUGC scripts) | `src/lib/aidreamcapes-workspace/media-detail.ts`, `src/lib/aidreamcapes-workspace/media-detail.server.ts`, `src/lib/aidreamcapes-internal-fetch.ts`, `src/components/storefront/aidreamcapes-v2/{media-detail,page,parts,template-directory,types,visual}.tsx`, `src/components/storefront/aidreamcapes-inspirations-page.tsx`, `src/components/aidreamcapes-workspace/inspirations-embedded.tsx`, `src/lib/aidreamcapes-guest-workspace.tsx`, `src/lib/aidreamcapes-inspirations-types.ts`, `src/lib/aidreamcapes-workspace/inspirations-page.server.ts`, `src/lib/aidreamcapes-workspace/presets.server.ts`, `scripts/apply-aidreamcapes-example-media-slugs.mjs`, `scripts/plan-aidreamcapes-example-media-slugs.mjs`, `scripts/manifests/aidreamcapes-example-media-slugs-2026-10-21.json`, `scripts/manifests/aidreamcapes-example-media-slugs-2026-10-21.production.json`, `scripts/aidreamcapes-workspace/{audit-*,smoke-*,verify-media-detail-remediation}.mjs`, `scripts/smoke-aidreamcapes-release-routes.mjs`, `scripts/deploy-aidreamcapes-release.mjs` (adds an opt-in `--verify-media-details` flag only), `docs/plans/aidreamcapes-media-detail-link-remediation-2026-10-21.md` |
| **Shared but site-guarded** | `src/app/[...path]/page.tsx`, `src/app/site/[siteSlug]/[...path]/page.tsx`, `src/app/site/[siteSlug]/ai-image-generation/[themeSlug]/page.tsx`, `src/lib/seo-indexing.ts`, `src/lib/theme/json-ld.ts`, `src/middleware.ts` |
| **Risk** | none found that can alter MyDreamShoots/Aidreamshoots output (see §1.2 for two AIVideosUGC/Aidreamcapes-EU-only notes) |

### 1.2 Guard analysis for the shared files

| File | Guard | Result |
|---|---|---|
| `src/app/[...path]/page.tsx` (host mode) | media-detail branch is inside `if (hostSiteSlug === "aidreamcapes" && path.length === 2)`; actor branch is `hostSiteSlug === "aidreamcapes"`; retired-path redirect is `hostSiteSlug === "aidreamcapes"` | MyDreamShoots host never enters any new branch |
| `src/app/site/[siteSlug]/[...path]/page.tsx` (path mode) | `isAidreamcapesPathModeSite(publicSite)` = `aidreamcapes` \| `aivideosugc`; retired-path redirect is `publicSlug === "aidreamcapes"` | MyDreamShoots path mode never enters a new branch |
| `src/app/site/[siteSlug]/ai-image-generation/[themeSlug]/page.tsx` | new blocks require `publicSiteSlug(siteSlug) === "aidreamcapes"` | MyDreamShoots slugs unaffected (see note 1) |
| `src/lib/seo-indexing.ts` | `aidreamcapesActorSitemapPathForSite()` returns the path unchanged when `site.id !== AIDREAMCAPES_SITE_ID`; the rewrite loop is inside `if (site.id === AIDREAMCAPES_SITE_ID)` | non-AIVideosUGC sitemaps byte-identical (measured, §2.2) |
| `src/lib/theme/json-ld.ts` | `aidreamcapesPublicActorUrl()` is reachable only through `withAidreamcapesOrigin()`, which is called only by `aidreamcapesV2JsonLd()`, which is reached only when `aidreamcapesV2StoredGraph()` returned a graph — that function returns `undefined` unless `site.id === "site_aidreamcapes"` | non-AIVideosUGC JSON-LD untouched |
| `src/middleware.ts` | `fetchAidreamcapesInternal()` is used only when `isAidreamcapesComPublicHtmlRequest(request)` is true: host slug `aidreamcapes` or path `/site/aidreamcapes…` / `/site/aivideosugc…`. `storefrontSlugForHost()` maps `www.mydreamshoots.com`→`mydreamshoots`, `aidreamshoots.eu`→`aidreamshoots`, `aidreamcapes.eu`→`aidreamcapes-eu` | MyDreamShoots/Aidreamshoots requests keep the plain `fetch()` path |
| `src/lib/aidreamcapes-workspace/media-detail.server.ts` | every query is filtered by `siteId: AIVIDEOSUGC_SITE_ID` (`pagesOwningSlug`, `resolveActorDetail`, `loadAidreamcapesChrome`, `aidreamcapesMissingPageRedirect`, `listMediaDetailSlugs`, `listActorDetailSlugs`) | no cross-store read/write possible |
| `src/components/storefront/aidreamcapes-v2/parts.tsx`, `visual.tsx`, `template-directory.tsx` | every importer of these modules lives inside `src/components/storefront/aidreamcapes-v2/`; the only external entry points are `theme-renderer.tsx` (requires an `aidreamcapes_v2_page` section — only `site_aidreamcapes` pages have them) and `storefront-render.tsx` (`currentSite.id === "site_aidreamcapes" ? AidreamcapesTemplateRenderer : ThemeRenderer`) | MyDreamShoots renders `ThemeRenderer`, not the v2 components whose card links changed |

Notes (both AIVideosUGC / Aidreamcapes-EU scope, not MyDreamShoots):

1. `src/app/site/[siteSlug]/ai-image-generation/[themeSlug]/page.tsx` now passes `publicSiteSlug(siteSlug)`
   instead of the raw `siteSlug` to `isAidreamcapesEuRetiredPublicPath` / `isAidreamcapesImageThemePath`.
   For the MyDreamShoots slugs (`mydreamshoots`, `dreamshoot`→`mydreamshoots`,
   `mydreamshoots-xby`→`aidreamshoots`) the predicate result is unchanged. The only alias whose
   result changes is the legacy `aidreamcapes-xby` → `aidreamcapes-eu`. Measured equivalence:
   `/site/aidreamcapes-eu/ai-image-generation/urbano` = 404 and
   `/site/aidreamcapes-xby/ai-image-generation/urbano` = 404; both aliases return 200 with the
   same title for `/ai-image-generation/avatar`. No divergence.
2. `src/components/storefront/aidreamcapes-v2/parts.tsx` changes the example-card media kind
   mapping from `clip → video, everything else → photo` to `photo → photo, everything else → video`
   (a `scene` example is now a video). v2 theme only.

### 1.3 Working-tree state during the audit

A concurrent session was editing the same worktree. `git status --short` observed during the run
showed only AIVideosUGC script/plan files plus the Next.js auto-generated files
`tsconfig.json` and `next-env.d.ts`:

```
 M docs/plans/aidreamcapes-media-detail-link-remediation-2026-10-21.md
 M next-env.d.ts
 M scripts/aidreamcapes-workspace/smoke-navigation.mjs
 M scripts/smoke-aidreamcapes-release-routes.mjs
 M scripts/smoke-aidreamcapes-seo-contract.mjs
 M tsconfig.json
```

During the audit the concurrent session committed one further commit,
`8e92d0f81` "Complete media detail slugs for template and gallery cards", which touches only
`scripts/` (manifest plan/apply tooling and audit scripts) and the plan document — no `src/`
runtime file. Its effect on the store-isolation verdicts is therefore nil, but it does mean the
manifest now covers 66 cards across all four public card shapes.

No `src/` runtime file was modified outside the audited commits. `tsconfig.json` and
`next-env.d.ts` are rewritten automatically by `next dev` when it starts; they were restored to
their committed content after the audit.

---

## 2. Runtime isolation

### 2.1 MyDreamShoots in host mode — 200, real title, unchanged card anchors

Every request below used `x-forwarded-host: www.mydreamshoots.com`.
"current" = `:3003`, "baseline" = `:3006` (pre-remediation `6c69591d8`).
The comparison metric is the **multiset of anchor `href` values** (normalised: `&amp;`→`&`,
`?v=<digits>` stripped) plus `<title>`, `<link rel="canonical">` and `<meta name="robots">`.

| Path | current | baseline | title identical | canonical identical | robots | anchors base → current | only-base | only-current |
|---|---|---|---|---|---|---|---|---|
| `/` | 200 | 200 | yes | yes | index, follow | 257 → 257 | 0 | 0 |
| `/ai-image-generation` | 200 | 200 | yes | yes | index, follow | 233 → 233 | 0 | 0 |
| `/ai-image-generation/avatar` | 200 | 200 | yes | yes | index, follow | 192 → 192 | 0 | 0 |
| `/ai-image-generation/background-changer` | 200 | 200 | yes | yes | index, follow | 192 → 192 | 0 | 0 |
| `/ai-video-generation` | 200 | 200 | yes | yes | index, follow | 214 → 214 | 0 | 0 |
| `/ai-video-generation/brand-video` | 200 | 200 | yes | yes | index, follow | 201 → 201 | 0 | 0 |
| `/blog` | 200 | 200 | yes | yes | index, follow | 196 → 196 | 0 | 0 |
| `/pricing` | 200 | 200 | yes | yes | index, follow | 194 → 194 | 0 | 0 |

Observed titles / canonicals (current):

```
/                              <title>AI Video & Photo Generator | myDreamshoots
                               <link rel="canonical" href="https://www.mydreamshoots.com/">
/ai-image-generation           <title>Browse private AI photo packages | myDreamshoots
                               <link rel="canonical" href="https://www.mydreamshoots.com/ai-image-generation">
/ai-image-generation/avatar    <title>AI Avatars for Profiles, Gaming Handles, and Community Identity | myDreamshoots
                               <link rel="canonical" href="https://www.mydreamshoots.com/ai-image-generation/avatar">
/ai-image-generation/background-changer
                               <title>AI Background Changer Photos for Portrait Scenes, Product Context, and Profile Refreshes | myDreamshoots
/ai-video-generation           <title>AI Video Generation for Private Motion Clips | myDreamshoots
/ai-video-generation/brand-video
                               <title>AI Brand Video Generator for Brand Stories | myDreamshoots
/blog                          <title>MyDreamShoots Guides for AI photo and video packages
/pricing                       <title>myDreamshoots Pricing | AI Photo and Video Credits
```

**MyDreamShoots media cards still link into the workspace — actual observed card hrefs:**

```
/                                6 ×  href="/app/create"
/ai-image-generation             5 ×  href="/app/create"
/ai-image-generation/avatar       5 ×  href="/app/create"
                                 3 ×  href="/app/create?category=avatar"
/ai-image-generation/background-changer
                                 5 ×  href="/app/create"
                                 3 ×  href="/app/create?category=background-changer"
/ai-video-generation              5 ×  href="/app/create"
/ai-video-generation/brand-video  5 ×  href="/app/create"
                                 4 ×  href="/app/create?videoMode=brand-video#step-video"
```

Exact anchor markup observed on `/ai-image-generation/avatar` (current):

```html
<a href="/app/create?category=avatar" class="mt-7 inline-flex items-center gap-2 self-start rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#101114] …">
<a href="/app/create?category=avatar" class="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#14161a] px-5 py-3 text-sm font-bold text-white …">
<a href="/app/create" class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[13px] border px-2 py-2 text-[0.78rem] font-semibold text-white …">
```

The `/ai-image-generation/<slug>` and `/ai-video-generation/<slug>` links that *do* appear on
MyDreamShoots pages are MyDreamShoots' **own** published pages, not media-detail routes. Every
one of them is present in the MyDreamShoots sitemap:

```
home : 59 distinct /ai-*-generation links | 59 are in MDS sitemap | 0 NOT in sitemap
aig  : 64 distinct /ai-*-generation links | 64 are in MDS sitemap | 0 NOT in sitemap
avatar: 61 distinct /ai-*-generation links | 61 are in MDS sitemap | 0 NOT in sitemap
avg  : 65 distinct /ai-*-generation links | 65 are in MDS sitemap | 0 NOT in sitemap
```

MyDreamShoots pages also contain **zero** AIVideosUGC v2 markers
(`class="adc2` = 0, `v-pick-card` = 0, `aidreamcapes_v2` section type = 0), so the components
whose card links changed in this branch are never rendered for this store.

`/app/create` for the MyDreamShoots host answers `307` (guest sign-in redirect) with
`<title>Workspace</title>` — unchanged behaviour.

### 2.2 MyDreamShoots sitemap

```
curl -H "x-forwarded-host: www.mydreamshoots.com" http://127.0.0.1:3003/sitemap.xml   → 200
```

```
total urls: 130   unique: 130
hosts: [('www.mydreamshoots.com', 130)]
nested actor urls (/ai-actors/(men|women)/…): 0
flat actor urls  (/ai-actors/<name>):       0
any "/ai-actors" in document:                none
any "aivideosugc" in document:              none
```

Baseline vs current: 130 URLs vs 130 URLs, **identical set and identical order**.

`/ai-image-generation/*` (42) and `/ai-video-generation/*` (28) entries in the MyDreamShoots
sitemap are MyDreamShoots' own image-theme and video pages.

### 2.3 Aidreamshoots (`aidreamshoots.eu`)

```
curl -H "x-forwarded-host: aidreamshoots.eu" http://127.0.0.1:3003/                     → 200
curl -H "x-forwarded-host: aidreamshoots.eu" http://127.0.0.1:3003/ai-image-generation   → 200
curl -H "x-forwarded-host: aidreamshoots.eu" http://127.0.0.1:3003/sitemap.xml           → 200
```

```
/                    <title>AIdreamshoots - generador de fotos con IA | Aidreamshoots
                     <link rel="canonical" href="https://aidreamshoots.eu/"/>
                     <meta name="robots" content="index, follow">
/ai-image-generation <title>Explorar paquetes privados de fotografías | Aidreamshoots
                     <link rel="canonical" href="https://aidreamshoots.eu/ai-image-generation">
sitemap: 117 URLs, host aidreamshoots.eu only, 0 "/ai-actors" entries
```

Baseline vs current (pre-remediation `6c69591d8`):

| Path | title identical | canonical identical | robots | anchors base → current | only-base | only-current |
|---|---|---|---|---|---|---|
| `/` | yes | yes | index, follow | 225 → 225 | 0 | 0 |
| `/ai-image-generation` | yes | yes | index, follow | 273 → 273 | 0 | 0 |

Aidreamshoots sitemap: 117 URLs vs 117 URLs, identical set and identical order.
No `class="adc2"` v2 marker is present on the Aidreamshoots pages.

### 2.4 Cross-store negative checks (new behaviour must not leak)

```
# AIVideosUGC: retired v2 path now redirects
curl -D- -H "x-forwarded-host: www.aivideosugc.com"  …/ai-video-generation/url-to-ad
  HTTP/1.1 301 Moved Permanently
  location: https://www.aivideosugc.com/ai-video-generation/url-to-video

# MyDreamShoots: same path must NOT redirect to the AIVideosUGC target
curl -D- -H "x-forwarded-host: www.mydreamshoots.com" …/ai-video-generation/url-to-ad
  HTTP/1.1 404 Not Found

# MyDreamShoots: nested actor path must NOT 308 to the flat actor address
curl -D- -H "x-forwarded-host: www.mydreamshoots.com" …/ai-actors/men/adrian
  HTTP/1.1 404 Not Found
```

### 2.5 AIVideosUGC feature behaviour

New media-detail pages (`x-forwarded-host: www.aivideosugc.com`):

```
/ai-video-generation/food-video-drink-pour            → 200
   <title>Drink Pour | AIVideosUGC
   <meta name="robots" content="noindex, follow">
   <link rel="canonical" href="https://www.aivideosugc.com/ai-video-generation/food-video-drink-pour">
   not present in sitemap.xml (0 matches)

/ai-image-generation/virtual-try-on-clothing-try-on   → 200
   <title>Clothing Try-On | AIVideosUGC
   <meta name="robots" content="noindex, follow">
   <link rel="canonical" href="https://www.aivideosugc.com/ai-image-generation/virtual-try-on-clothing-try-on">
   <h1>Clothing Try-On</h1>
   not present in sitemap.xml (0 matches)
```

Actor addresses:

```
/ai-actors/men/adrian   → HTTP/1.1 308 Permanent Redirect
                           location: https://www.aivideosugc.com/ai-actors/adrian
/ai-actors/adrian       → HTTP/1.1 200 OK
                           <title>Adrian · Hospital AI Actor | AIVideosUGC
                           <meta name="robots" content="index, follow, max-image-preview:large">
                           <link rel="canonical" href="https://www.aivideosugc.com/ai-actors/adrian">
```

JSON-LD of the flat actor page contains **0** nested actor URLs and the flat URL:

```
nested actor urls in JSON-LD: []
flat actor urls in JSON-LD: ['https://www.aivideosugc.com/ai-actors/adrian',
                             'https://www.aivideosugc.com/ai-actors/men']
```

(The nested address still appears once inside the RSC flight payload as the stored page's
`seo.canonicalPath` / `seo.canonical`, i.e. as source data, not as a published URL.)

AIVideosUGC sitemap:

```
total urls: 177   unique: 177
hosts: [('www.aivideosugc.com', 177)]
nested actor urls (/ai-actors/(men|women)/…): 0
flat actor urls  (/ai-actors/<name>):       53
hub actor urls (/ai-actors/men|women|scene|age-range): 4
```

Baseline vs current for the AIVideosUGC sitemap — the intended change, AIVideosUGC only:

```
base (6c69591d8): {'total': 177, 'nested': 53, 'flat': 0}
current          : {'total': 177, 'nested':  0, 'flat': 53}
base-only  (53): /ai-actors/men/adrian, /ai-actors/men/avery, /ai-actors/men/caleb, …
curr-only (53): /ai-actors/adrian,   /ai-actors/akio,   /ai-actors/amara,   …
```

AIVideosUGC card links now point at the detail pages (as designed), e.g. on the AIVideosUGC home:

```
46 distinct href="/ai-(image|video)-generation/<slug>" links on the home page
20 × <a class="v-pick-card" …>   first v-pick-card href: /ai-video-generation/canvas-tote-product-detail
53 actor cards → <a class="btn btn-grad" href="/ai-actors/ari"> … (flat addresses)
```

---

## 3. Database isolation (read-only SELECTs)

```
PGPASSWORD=dingyue_local_dev psql -h 127.0.0.1 -p 15433 -U dingyue_local -d dingyue_local
```

### 3.1 `MAX("updatedAt")` of `LivePage` per site

```
           id           |      slug       |     primaryDomain     | livepages |      max_updated_at
------------------------+-----------------+-----------------------+-----------+-------------------------
 site_aidreamcapes      | aidreamcapes    | www.aivideosugc.com   |       268 | 2026-10-20 19:43:13.556
 site_dreamshoot        | mydreamshoots   | www.mydreamshoots.com |       107 | 2026-10-04 18:31:29.867
 site_aidreamcapes_xby  | aidreamcapes-eu | aidreamcapes.eu       |        97 | 2026-09-30 03:45:08.052
 site_mydreamshoots_xby | aidreamshoots   | aidreamshoots.eu      |        97 | 2026-09-27 14:59:13.581
 site_grownstride_test  | grownstride     | test.grownstride.com  |        95 | 2026-08-23 17:25:41.911
 site_lumen             | lumen           | lumen.localhost       |        23 | 2026-08-16 11:40:49.873
 site_atlas             | atlas           | atlas.localhost       |        20 | 2026-08-16 11:40:49.873
```

Rows updated after 2026-10-19 (the remediation window) — one site only:

```
      siteId       | rows_updated_after_2026_10_19
-------------------+-------------------------------
 site_aidreamcapes |                           251
```

MyDreamShoots (`site_dreamshoot`), Aidreamshoots (`site_mydreamshoots_xby`) and Aidreamcapes EU
(`site_aidreamcapes_xby`) have **no** row updated after 2026-10-19.

Write batches on `site_aidreamcapes` (UTC):

```
2026-10-05 01:48 |  1
2026-10-19 14:10 | 40
2026-10-19 14:30 | 53
2026-10-20 09:35 | 116
2026-10-20 09:53 |  1
2026-10-20 10:56 | 15
2026-10-20 10:57 |  2
2026-10-20 13:09 |  1
2026-10-20 18:59 |  4     <-- media-slug manifest batch
2026-10-20 19:03 |  1
2026-10-20 19:43 | 18
```

### 3.2 Every site-scoped content table, `MAX("updatedAt")` per site

```
+----------------------+------------------------+------+----------------------------+
|        table         |        site_id         | rows |        max_updated         |
+----------------------+------------------------+------+----------------------------+
| LivePage             | site_aidreamcapes      |  268 | 2026-10-20 19:43:13.556+00 |
| LivePage             | site_dreamshoot        |  107 | 2026-10-04 18:31:29.867+00 |
| LivePage             | site_aidreamcapes_xby  |   97 | 2026-09-30 03:45:08.052+00 |
| LivePage             | site_mydreamshoots_xby |   97 | 2026-09-27 14:59:13.581+00 |
| MediaAsset           | site_aidreamcapes      |  789 | 2026-10-20 09:35:23.733+00 |
| MediaAsset           | site_dreamshoot        |  768 | 2026-09-11 11:02:01.105+00 |
| MediaAsset           | site_mydreamshoots_xby | 1074 | 2026-09-27 14:59:13.705+00 |
| ThemePage            | site_aidreamcapes      |   92 | 2026-10-14 02:55:25.486+00 |
| ThemePage            | site_dreamshoot        |   97 | 2026-09-27 06:34:44.187+00 |
| ThemePage            | site_mydreamshoots_xby |  100 | 2026-09-27 14:59:13.631+00 |
| Product              | site_aidreamcapes      |    8 | 2026-10-15 17:01:56.696+00 |
| Product              | site_dreamshoot        |    7 | 2026-09-01 10:02:37.671+00 |
| Product              | site_mydreamshoots_xby |   14 | 2026-09-20 07:35:21.719+00 |
| CreativePack         | site_aidreamcapes      |  107 | 2026-09-21 04:25:31.713+00 |
| CreativePack         | site_dreamshoot        |   44 | 2026-09-01 03:47:31.318+00 |
| CreativePack         | site_mydreamshoots_xby |   70 | 2026-09-20 07:35:21.851+00 |
| StorefrontProfile    | site_aidreamcapes      |    1 | 2026-10-13 08:50:12.51+00  |
| StorefrontProfile    | site_dreamshoot        |    1 | 2026-09-05 11:44:21.221+00 |
| StorefrontProfile    | site_mydreamshoots_xby |    1 | 2026-09-20 07:35:21.038+00 |
| SiteDomain           | site_aidreamcapes      |    5 | 2026-10-13 08:41:35.56+00  |
| SiteDomain           | site_dreamshoot        |    2 | 2026-08-16 11:40:49.469+00 |
| SiteDomain           | site_mydreamshoots_xby |    1 | 2026-09-20 07:35:20.986+00 |
| ThemeSettings        | site_aidreamcapes      |    1 | 2026-10-19 14:10:40.303+00 |
| ThemeSettings        | site_dreamshoot        |    1 | 2026-09-27 06:34:44.206+00 |
| ThemeSettings        | site_mydreamshoots_xby |    1 | 2026-09-27 14:59:13.67+00  |
| SiteTheme / VideoTheme / VideoThemeExample / ToolCategory / ToolMenuItem / Price /
| CreativePackCategory / SiteAiApp | all four stores | — | all ≤ 2026-10-14, AIVideosUGC-only newest |
+----------------------+------------------------+------+----------------------------+
```

Only `site_aidreamcapes` rows carry a 2026-10 timestamp. Every MyDreamShoots and Aidreamshoots
row in every site-scoped content table is older than 2026-10-05.

### 3.3 AIVideosUGC relational shape (read-only)

```
LivePage rows for site_aidreamcapes matching '/ai-actors/%':  53 nested rows
   e.g. /ai-actors/men/adrian      seo.canonicalPath = /ai-actors/men/adrian
        /ai-actors/women/amara     seo.canonicalPath = /ai-actors/women/amara
   (the flat address is a rendering projection; the stored rows were not migrated)
```

---

## 4. Finding (AIVideosUGC-only defect, release blocker for the new feature)

**The new media-detail page emits protocol-relative internal links in host mode.**

Reproduced with `x-forwarded-host: www.aivideosugc.com`:

```
GET /ai-video-generation/food-video-drink-pour  → 200
  href="//app/create"
  href="//app/create/ai-video-generation"
  href="//about-us"
  href="//ai-actors/men"
  href="//templates"
  … 157 anchors, all prefixed with "//"
```

Reproduced twice (03:45 and 04:11 Asia/Shanghai) against the same running dev server.

A `//host/path` reference is a network-path reference: the browser resolves `//app/create` to
`https://app/create`, i.e. a broken destination. Every internal link on the video detail page
(including the workspace CTA) is affected in host mode.

Cause (host mode only): `src/app/site/[siteSlug]/[...path]/page.tsx` calls
`renderAidreamcapesMediaDetailPage({ …, basePath: routePath("/") })`, and in host mode
`storefrontPathForRouteMode()` returns `"/"` for the root. `publicResolvers(basePath)` in
`src/lib/aidreamcapes-guest-workspace.tsx` then builds `` `${basePath}${value}` `` = `"//" + value`.

Path mode is correct, which confirms the diagnosis:

```
GET /site/aidreamcapes/ai-video-generation/food-video-drink-pour → 200
  href="/site/aidreamcapes/app/create/ai-video-generation"
  href="/site/aidreamcapes/app/create/text-to-video"
  0 occurrences of href="//"
```

Route-specific detail — the two detail routes are served by different handlers and show
different link shapes in host mode:

| Detail route | Handler | `basePath` | Observed internal links (host mode) |
|---|---|---|---|
| `/ai-video-generation/<slug>` | `src/app/site/[siteSlug]/[...path]/page.tsx` (catch-all) | `routePath("/")` = `"/"` | `//app/create` … — **broken** |
| `/ai-image-generation/<slug>` | `src/app/site/[siteSlug]/ai-image-generation/[themeSlug]/page.tsx` (dedicated route) | `` `/site/${siteSlug}` `` = `"/site/aidreamcapes"` | `/site/aidreamcapes/app/create/ai-image-generation` — resolves, but leaks the internal path prefix on a host-mode URL |

The rest of the AIVideosUGC surface is unaffected: the flat actor page and the actor directory
page have 0 occurrences of `href="//"`, and the AIVideosUGC home page renders ordinary
root-relative links (`/about-us`, `/ai-actors/men`, `/app/create/ai-image-generation`).

Scope: AIVideosUGC only (`www.aivideosugc.com` host mode). MyDreamShoots, Aidreamshoots and
Aidreamcapes EU never render this component, and their anchor multisets are byte-identical to
the pre-remediation baseline (§2.1, §2.3). This is a defect of the new feature, not a
store-isolation regression, and it does not affect the PASS verdicts above.

Suggested fix (not applied — this audit is read-only): normalise the root base path before
prefixing, e.g. treat `basePath === "/"` as `""` inside `publicResolvers` (or pass `""` instead
of `routePath("/")`), and make the dedicated `[themeSlug]` route use the same host-aware
resolver so host mode does not emit the `/site/<slug>` prefix.

---

## 5. Commands executed

```bash
# git scope
git status --short
git diff --name-only
git log --oneline -6
git diff --name-only 6c69591d8..HEAD
git diff --shortstat 6c69591d8..HEAD
git show 97ae1e340 -- src/lib/seo-indexing.ts src/lib/theme/json-ld.ts src/middleware.ts
git show 97ae1e340 -- 'src/app/[...path]/page.tsx' 'src/app/site/[siteSlug]/[...path]/page.tsx' \
                     'src/app/site/[siteSlug]/ai-image-generation/[themeSlug]/page.tsx'
git show 97ae1e340 -- src/components/storefront/aidreamcapes-v2/ src/lib/aidreamcapes-internal-fetch.ts
git show 228fc706d

# baseline server
git archive 6c69591d8 | tar -x -C /tmp/mds-base0
cd /tmp/mds-base0 && ln -s <repo>/node_modules node_modules && cp <repo>/.env.local .env.local
__NEXT_DISABLE_MEMORY_WATCHER=1 NEXT_DIST_DIR=/tmp/mds-base0/.next-b0 \
  node_modules/.bin/next dev -H 127.0.0.1 -p 3006

# runtime reads (host-mode selection via forwarded headers)
curl -s --max-time 180 -H "x-forwarded-host: www.mydreamshoots.com"  -H "x-forwarded-proto: https" \
     http://127.0.0.1:3003/{,ai-image-generation,ai-image-generation/avatar,ai-image-generation/background-changer,ai-video-generation,ai-video-generation/brand-video,blog,pricing,sitemap.xml}
curl -s --max-time 180 -H "x-forwarded-host: aidreamshoots.eu"      -H "x-forwarded-proto: https" \
     http://127.0.0.1:3003/{,ai-image-generation,sitemap.xml}
curl -s --max-time 180 -H "x-forwarded-host: www.aivideosugc.com"   -H "x-forwarded-proto: https" \
     http://127.0.0.1:3003/{,ai-actors,ai-actors/adrian,ai-actors/men/adrian,ai-image-generation/virtual-try-on-clothing-try-on,ai-video-generation/food-video-drink-pour,sitemap.xml}
curl -s -o /dev/null -D - --max-time 180 -H "x-forwarded-host: www.mydreamshoots.com" \
     http://127.0.0.1:3003/ai-actors/men/adrian
curl -s -o /dev/null -D - --max-time 180 -H "x-forwarded-host: www.mydreamshoots.com" \
     http://127.0.0.1:3003/ai-video-generation/url-to-ad

# database (read-only SELECTs only)
psql "postgresql://dingyue_local:dingyue_local_dev@127.0.0.1:15433/dingyue_local" \
     -c "SHOW timezone;" -c "SELECT now();" \
     -c "SELECT s.\"id\", s.\"slug\", s.\"primaryDomain\", COUNT(lp.*), MAX(lp.\"updatedAt\"), MIN(lp.\"updatedAt\")
         FROM \"Site\" s LEFT JOIN \"LivePage\" lp ON lp.\"siteId\" = s.\"id\" GROUP BY 1,2,3 ORDER BY 5 DESC;"
```

Cleanup performed: baseline dev server stopped, `/tmp/mds-base*` removed, `tsconfig.json` and
`next-env.d.ts` restored to their committed content.

## 6. Verdict

The AIVideosUGC media-detail remediation is **store-isolated**. MyDreamShoots, Aidreamshoots
and Aidreamcapes EU produce byte-identical anchor sets, titles, canonicals, robots directives and
sitemap contents compared with the pre-remediation baseline, and no row of those stores was
written to. The only defect found is a link-formatting bug on the new AIVideosUGC media-detail
page in host mode (§4), which must be fixed before the feature ships.
