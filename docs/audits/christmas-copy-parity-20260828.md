# Christmas Copy Parity Audit

Date: 2026-08-28

## Baselines

- Copy baseline: `ai-christmas-photo-and-video-final/01_page_copy_final.md`
- Section/order baseline: `ai-christmas-photo-and-video-final/02_page_structure_final.md`
- Presentation cross-check: `ai-christmas-photo-and-video-final/03_page_prototype.html`
- Runtime records: `ThemePage` for `/ai-save-the-date/christmas`, local draft and published JSON
- Public runtime snapshot: `SitePublishedState` for `site_dreamshoot`

The ZIP contains a real Christmas design package. The earlier audit conclusion that no Christmas package existed is superseded by this package.

## Executive Result

The current page is not a one-to-one copy of the supplied package.

- Draft and published page data contain most of the `01_page_copy_final.md` body, but several strings are changed, shortened, duplicated, or incorrectly cased.
- The published quality section is empty (`intro: ""`, `blocks: []`), which causes the large blank area shown in the screenshot.
- The current draft now contains a local repair for that empty section, but it is not yet in the published snapshot.
- The package's copy file and HTML prototype are not identical. `01_page_copy_final.md` is treated as the text authority; the prototype is used to flag design-package drift.

## Differences Against `01_page_copy_final.md`

| Area | Design copy | Current data | Result |
| --- | --- | --- | --- |
| H1 / hero title | `Create AI Christmas Photos and Videos` | `Create AI Christmas Photo and Videos` | Missing plural `s` |
| Hero CTA | `Create Christmas Content` | `Create christmas content` | Wrong capitalization |
| Canonical route | `/holidays-events/christmas` | `seo.canonicalPath: /ai-save-the-date/christmas` while `seo.canonical` points to `/holidays-events/christmas` | Internal route and canonical disagree |
| Definition heading | `What Is AI Christmas Photo and Video Creation?` | Missing `?` | Punctuation mismatch |
| Photo ideas intro | No standalone intro; six card descriptions only | Section intro repeats the Family card description | Extra duplicated customer copy |
| Photo idea 5 heading | `Pet Christmas Photos` | `Pet Christmas Photo` | Singular mismatch |
| Video ideas intro | No standalone intro; four card descriptions only | Section intro repeats the Family Memory card description | Extra duplicated customer copy |
| Photo vs Video body | Includes `topic keyword and search intent ... rather than a Video-only page` | Replaced with `so you can choose the right way to share the occasion` | Expected sentence missing and replacement added |
| FAQ answers 1-4 | Short exact answers in design copy | Expanded/rephrased answers | Not one-to-one |
| Final CTA body | `Start with the person, pet, place, memory, or greeting you want to create, then choose the Christmas visual direction that supports it.` | SEO-style description about cards, memories, portraits, winter scenes, pets, social posts, and greetings | Design sentence missing; extra/replacement copy |
| Quality section | Structure calls for Accuracy & Quality; copy file supplies the checklist facts through workflow and FAQ | Published section has no intro and no blocks | Data loss / blank section |

## Exact Matches

The following areas currently match the copy file text substantially or exactly:

- SEO title and meta description.
- Hero body paragraph.
- Definition body paragraph.
- Photo idea descriptions except the `Pet Christmas Photos` heading.
- All seven workflow step descriptions.
- All eleven scene idea labels.
- FAQ questions and answers 5, 6, 8, 9, and 10.
- Final CTA heading.

## Package-Internal Conflicts

These are conflicts inside the supplied design package and must be resolved before claiming absolute one-to-one parity:

- `01_page_copy_final.md` says the FAQ has 10 questions; the prototype shows 8 and uses shorter answers.
- The copy file describes six photo-idea cards and four video-idea cards; the prototype shows six photo cards but only two video cards, plus a separate Source Media section.
- `02_page_structure_final.md` lists Source Media and Accuracy & Quality as sections; the current data has no Source Media section and has a Quality section whose published content is empty.
- The prototype uses `Christmas Photo and Video Questions` as the FAQ heading, while the copy file uses `FAQ`.
- The prototype's Photo vs Video paragraph is shorter and differs from both the copy file and current runtime copy.

## Release State

The local draft repair is verified by `npm run smoke:christmas-quality-content` and SSR content checks. The formal `publishedJson` and `SitePublishedState` remain unchanged until a reviewed release is approved; publishing now would also include the other dirty page drafts.
