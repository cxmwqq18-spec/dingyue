# Resources menu: two quality-check rows

Internal release note for the Aidreamcapes header navigation change on
2026-10-22. The public menu rows are listed below; the source briefs stay in
this internal document.

## What was requested

1. Remove the `Templates` row from the `Resources` dropdown.
2. Add two rows as the last two rows of the same dropdown.

The briefs for the two new rows, verbatim:

> 缺口定位完成。叔叔剧本 E04「陈家院子（婚礼）」全 6 个片段：正文写「西装」
> 「连衣裙」，参考图却绑的是日常装（藏青夹克）—这是真实穿帮；而内部资产表里
> 「婚礼西装 v1/ 婚礼连衣裙 v1」只存在于内部档案，没进交付包。

> 兜底入口 5 个不漏：发布 / 开拍前先做 / 交付前再过 / 交付前再过 /
> 品牌视觉对模板互查

## What shipped

| Dropdown row | Destination | Public meaning |
|---|---|---|
| Video Review Checklist | `/blog/ai-video-review-checklist` | Every clip is checked against the script, the reference image and the asset library, so a scene never ships with the wrong wardrobe or props. |
| Delivery Checks | `/digital-delivery` | Five checks run before a file is delivered: release readiness, pre-shoot checks, a delivery pass, a second delivery pass, and a brand-visual cross-check against the template. |

The `Templates` row was removed from the dropdown. The top-level `Templates`
menu, the footer templates link, `/templates` and the 178-URL sitemap are
unchanged.

## Why the public rows are not the raw briefs

- The site's source language is English; the Chinese navigation in the review
  screenshots is the browser's own translation of the English page. A row that
  exists only in Chinese would be the one untranslated row in the menu.
- The briefs carry production-internal information: a script code and scene
  name, a wardrobe continuity defect, the state of the internal asset
  registry, and the delivery package contents. The repository contract
  (`Public Frontend Copy Boundary`) keeps that kind of information out of
  user-visible frontend content, so the raw text stays here and the dropdown
  carries the customer-facing version of the same two topics.
- Both rows point at real public pages, so no menu row is a dead link.

## How to change a row

The rows live in the reviewed plan table of
`scripts/plan-aidreamcapes-nav-items.mjs` (`ADDITIONS`). Edit the table, then:

```bash
node --env-file=.env scripts/plan-aidreamcapes-nav-items.mjs --target=production --write-manifest
node --env-file=.env scripts/apply-aidreamcapes-nav-items.mjs --target=production \
  --manifest=scripts/manifests/aidreamcapes-nav-items-production-2026-10-22.json --apply \
  --confirm=site_aidreamcapes-nav-items-production --base-hash=<planHash>
```

The apply writes only `LivePage.contentJson.siteNavigation` on the root page
(`src/components/theme-renderer.tsx` reads the header navigation from there),
verifies the row fingerprint before writing, advances `SiteContentRevision`
once, checks that MyDreamShoots public content did not change, and writes a
field-level inverse next to its report.

A row without a `description` renders as a plain link, like every other row in
this dropdown; a row with one renders as a rich card.

## Evidence

- Production `SiteContentRevision`: 277 -> 278 (removed the `Templates` row),
  278 -> 279 (added the two rows), 279 -> 280 (plain-link row shape).
- Live readback: the `Resources` dropdown lists Inspiration, How-to Guides,
  Blog, FAQ, Glossary, Contact, Video Review Checklist, Delivery Checks.
- `/blog/ai-video-review-checklist`, `/digital-delivery` and `/templates` all
  answer `200`; the sitemap still holds 178 URLs.
- MyDreamShoots public content hash unchanged in every write transaction.
