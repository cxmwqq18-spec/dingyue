# AIVideosUGC video detail prompt spec

Scope: `site_aidreamcapes` public video detail pages
(`/ai-video-generation/<publicSlug>`).

## Why this document exists

The storefront video detail pages used free-form one-line prompts
(70-500 characters). They had no product lock, no camera language, no sound
split, no time axis, no shot list and no negative block, so a model received
an undirected description and filled the rest itself.

The prompts are now compiled from three sources:

1. The Wan3.0 creator manual
   (`3000课程21个skill/Wan3.0视频创作者手册.md`) - the multi-shot formula, the
   timed shot blocks, the long-form 30 second structure and the hard switches.
2. The ecommerce/UGC prompt skill
   (`3000课程21个skill/.agents/skills/ecommerce-ugc-prompt/SKILL.md`) - the
   product lock, the writing tracks, the shot library, the voice and sound
   split, the compliance red lines and the delivery checklist.
3. The platform prompt format (`src/lib/video-prompt-format.ts`) - the
   section labels the workspace already understands, their order, and the
   validator.

## The prompt format

Every prompt uses the platform sections, in this order:

```
Subject / Character
Action / Motion
Scene / Environment
Camera / Shot / Lens
Lighting / Atmosphere
Style / Mood / Palette
Sound / Audio
Duration / Aspect Ratio / Resolution
Continuity
Negative Constraints
```

`Action / Motion` carries the Wan3.0 timed shot list, the English form of the
manual's `镜头1[0-3秒]…` multi-shot formula:

```
Film logic: the action of this template, every shot is part of it.
Shot 1 [0.0-3.0s] | Establishing the product: ... Camera: ... Transition: ...
Shot 2 [3.0-6.5s] | The front face: ... Camera: ... Transition: ...
```

`Negative Constraints` is the last section. That is the concatenation
contract: a later step that adds a caption, voiceover or extra constraint
block appends it after the negatives, and the negative block never has to be
rewritten.

Three rules the prompt deliberately does not decide:

- **Captions and on-screen text.** The workspace owns a subtitle switch
  (`options.subtitle`), and a human decides per job. The plan refuses any
  prompt that mentions captions.
- **Voiceover wording.** The skill asks for spoken lines, but a template
  cannot know the customer's product claim. The prompt states the delivery,
  not the words.
- **The aspect ratio, duration and resolution.** The workspace passes them as
  request settings, so the `Duration / Aspect Ratio / Resolution` section
  defers to the external setting and only names the template default.

## Tracks

| Track | Cards | Structure | Camera | Sound |
|---|---|---|---|---|
| `ugc-action` | 580 | hook, one imperfect use, visible result, second angle, settle | handheld 26mm/35mm, one reframe | handling + room tone, no music |
| `brand-texture` | 168 | light across the surface, into the material, outline revealed, same light | 50mm drift, 85mm push in, one arc | room tone + ambient bed |
| `product-display` | 92 | establishing, front face, hands take over, material close-up, closing hold | 35mm to 50mm push in, gentle arc, 100mm macro | handling sound + low retail BGM |
| `ugc-talking` | 53 | presenter to camera, show the product, detail under the voice, back to the presenter, close | handheld 35mm/85mm, one focus hunt | voice delivery + room tone, no music |

Every shot carries its own camera move and its own transition line, and the
`Continuity` section states the flow rule: the same hands, room, light
direction and screen direction carry from shot to shot, so the cut reads as
one continuous action.

## The product lock

Every prompt opens with the same lock, which is the skill's product lock card
reduced to what a generic, unbranded template can promise:

> The uploaded product photo is the only reference for the product. Reproduce
> it exactly: same shape, proportions, colour, material, surface texture and
> label area, with nothing added, removed, redesigned or recoloured, and no
> second product in frame.

The closing `Continuity` section repeats it as the continuity lock and names
the final frame, because the platform validator requires an ending image.

## Scope: every card that can render a detail page

893 video cards can render a public detail page, 189 canonical cards and 704
alias owner cards. A slug is such a card when exactly one page owns it, and
the card that page renders is the first card of that page with the slug.

**Alias cards count.** An alias card owns a page of its own. When the alias
redirect does not apply, that page renders the alias card and its own prompt,
so an alias card needs the same rewrite as any other detail page.

The alias redirect also compares the prompt text, so rewriting a canonical
card without rewriting its alias copy silently disables the redirect. The
rewrite therefore covers both.

## The asset gap

The storefront assets of every video card:

| Asset | Count | Status |
|---|---|---|
| Scene reference (the template preview) | 893 | exists |
| Scene reference already in 9:16 | 849 | exists |
| Scene reference in 1:1 or 16:9 | 39 | needs a 9:16 recut |
| Scene reference with no recorded size | 5 | needs a size check |
| Product back or side reference | 0 | **missing** |
| Product material close-up | 0 | **missing** |

One product photo cannot show the back, the label area or a true material
close-up. Without those references the model invents a second product or a
fabricated surface, and the skill's e-commerce track (a back view, a
readable label, a macro insert) cannot be executed.

The asset plan therefore names three reference photos per template:

1. `scene` - the template preview, 9:16
2. `product-back` - a clean studio back and side view
3. `product-macro` - a raking-light material close-up

The image prompt for each missing photo, with its target file name, lives in
`scripts/manifests/aidreamcapes-video-detail-prompts-local-2026-10-22-assets.json`
(1830 rows: 893 back views, 893 macro details, 44 scene recuts). A template may
only reference a second angle once the file exists in `/public`.

## The pipeline

```
# 0. preview one card before anything is written
node scripts/aidreamcapes-video-prompts/preview.mjs <slug>

# 1. compile the manifest (read only)
DATABASE_URL=... DATABASE_TARGET=local DINGYUE_ENV=local \
  node scripts/aidreamcapes-video-prompts/plan-v3.mjs

# 2. report the change, write nothing
DATABASE_URL=... DATABASE_TARGET=local DINGYUE_ENV=local \
  node scripts/apply-aidreamcapes-video-detail-prompts.mjs \
  --manifest=scripts/manifests/aidreamcapes-video-detail-prompts-local-2026-10-22-v3.json

# 3. apply, with compare-and-set
... --apply

# 4. read back every planned card: prompt digest, aspect, duration
DATABASE_URL=... node scripts/verify-aidreamcapes-video-detail-prompts-v3.mjs

# 5. put a local database back into the published state
... node scripts/reset-aidreamcapes-video-detail-prompts-to-source.mjs --apply
```

The v3 plan is a one-shot compare-and-set plan: replaying the same file after
it has been applied reports every card as skipped, because the stored value no
longer matches the recorded `fromSha`. Idempotency is proven by re-planning:
`plan-v3` then reports zero changed fields and the applier writes nothing.

Files:

- `scripts/aidreamcapes-video-prompts/spec-v3.mjs` - Wan3.0 blocks, per track
  beats and lengths, voice lines, negatives
- `scripts/aidreamcapes-video-prompts/facts.mjs` - product facts extracted from
  the card's own text
- `scripts/aidreamcapes-video-prompts/plan-v3.mjs` - v3 manifest builder and
  validator
- `scripts/aidreamcapes-video-prompts/preview.mjs` - print one card's prompt
- `scripts/verify-aidreamcapes-video-detail-prompts-v3.mjs` - readback of the
  stored prompt digest, aspect and duration
- `scripts/aidreamcapes-video-prompts/spec.mjs` - the retired v2 sections, kept
  so the v2 manifest stays replayable
- `scripts/aidreamcapes-video-prompts/compile.mjs` - card to prompt compiler
- `scripts/aidreamcapes-video-prompts/plan.mjs` - manifest builder
- `scripts/apply-aidreamcapes-video-detail-prompts.mjs` - compare-and-set applier
- `scripts/reset-aidreamcapes-video-detail-prompts-to-source.mjs` - the local
  inverse of the rewrite
- `scripts/manifests/aidreamcapes-video-detail-prompts-source-2026-10-22.json` -
  the frozen pre-rewrite copy, so the plan is reproducible and idempotent
- `scripts/manifests/aidreamcapes-video-detail-prompts-local-2026-10-22-v3.json` -
  the applied v3 plan, one entry per card, with the per track duration
- `scripts/manifests/aidreamcapes-video-detail-prompts-local-2026-10-22.json` -
  the retired v2 plan
- `scripts/manifests/aidreamcapes-video-detail-prompts-local-2026-10-22-assets.json` -
  the image pipeline input

The plan stores the digest of the target instead of its text. The applier
recompiles the target from the frozen source with the same spec version and
writes it only when the digest matches, so a plan stays small and any drift
between the plan and the apply is caught.

## The write rules

- Only `site_aidreamcapes` rows are read or written.
- Only `prompt`, `aspect` and `duration` of a named card change. No page,
  navigation, SEO, media or snapshot row is touched.
- Every operation is a compare-and-set. A card whose stored value no longer
  matches the recorded digest is skipped, so an online edit always wins.
- The compiler never invents product facts. Every sentence comes from the
  card's own stored prompt, image alternative text, label and chips.

## The 30 second runtime

The templates run on a 30 second axis, which is the Wan3.0 manual's native
output length and the length its long-form examples use. The shot windows are
derived from the duration, so a template that moves to 15 seconds only needs
its card duration changed:

| Track | Shots | 30 second windows |
|---|---|---|
| `ugc-action`, `product-display`, `ugc-talking` | 5 | 0-6, 6-12.9, 12.9-20.1, 20.1-26.1, 26.1-30 |
| `brand-texture` | 4 | 0-8.1, 8.1-15.9, 15.9-24, 24-30 |

The workspace offers 15 and 30 seconds for video
(`WORKSPACE_VIDEO_DURATIONS`), the card duration flows into the preset
(`DURATIONS` in `presets.server.ts` accepts 6, 10, 15 and 30), and the
provider adapter sends the duration as it is. The 影灵 adapter
(`yinglingapi.com`, handled in the ai-worker dispatch route) passes
`duration: Number(params.videoParams.duration)` straight through, so 15 and 30
both reach the model unchanged.

What the platform side still owns is the provider capability list
(`PlatformAiProvider.videoDurations`). It has to declare 30 for the
30 second option to be runnable, and the provider mapper currently filters
`videoDurations` to `[6, 10, 15]`. That is a platform change, separate from
this prompt work.

## v3: Wan3.0 structure and the skill's beats

v2 wrote the platform's nine labelled sections with a timed shot list inside
`Action / Motion`. Review found three defects: the beats were a generic camera
exercise with no selling point, the sound block said "no spoken dialogue" so
there was no product explanation at all, and every track ran 30 seconds even
though the skill gives UGC and brand films 15.

v3 replaces the section grammar with the Wan3.0 manual's own:

```
A 30-second vertical 9:16 e-commerce product display film for <product>, <place>.

【Reference】【Overall Style】【Product Lock】【Action Logic】
【0.0-5.0s | Wide display】…【5.0-11.0s | Front close-up】…【11.0-17.0s | Hand turns it】…
【17.0-23.0s | The action】…【23.0-27.5s | Point held】…【27.5-30.0s | Closing hold】
【Camera】【Sound】【Continuity】【Negative】
```

`【Negative】` is always the last block, so a later step can append after it.
The content follows the ecommerce/UGC skill:

| Track | Skill length | Beats |
|---|---|---|
| `product-display` | 9:16, 10-30s -> 30s | 远景陈列 / 正面特写 / 手入画翻背面 / 使用 / 卖点收尾 / 定格 |
| `ugc-action` | 9:16, 15s | 0-3 钩子 / 3-8 演示 / 8-12 证据 / 12-15 收口 |
| `ugc-talking` | 9:16, 15s | 钩子 / 展示 / 证据 / 收口, talk to camera throughout |
| `brand-texture` | 10-15s -> 15s | 氛围 / 使用瞬间 / 材质微距 / 定格 |

The sound block follows the skill's voice formula: it names the delivery
(pace, tone, accent) and writes the five short spoken lines (hook, point,
demo, evidence, close) from the card's own facts. Captions and subtitles are
still the workspace switch and a human decision, so no prompt mentions them.
The brand track stays silent.

Product facts (`facts.mjs`) are extracted from the card's own text: the noun
phrase after `plain` / `generic`, or the first sellable head noun in the
scene; the subject, the verb, the place, and one visible trait from the
original direction. Nothing is invented, and a card that names no product
(`balcony-railing-greeting`) gets a presenter film with a subject lock instead
of a product lock.

## Gates

- `node scripts/smoke-aidreamcapes-release-routes.mjs` - detail pages answer
  200, stay noindex, and keep exactly one workspace CTA
- `node scripts/smoke-aidreamcapes-seo-contract.mjs` - canonical, robots and
  sitemap exclusion for every derived detail page
- `node scripts/guard-public-storefront-ssr.mjs` - the prompt is complete
  server-rendered HTML, and the browser fetches no page data
- `node scripts/guard-live-storefront-ssr.mjs` - the same rule on the live row
