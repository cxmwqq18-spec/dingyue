# tpl-ugc competitor decomposition
Main competitor: Tagshop AI /templates (live capture 2026-10-10, `bench/live-20261010/ts-templates.json/.jpg`)
Supplement: Tagshop category filter bar shown on the same page; approved template vocabulary list (205 names in CollectionPage JSON-LD).

## Competitor blocks (top to bottom)

### 1. Hero
- H1 (31 chars): "See It. Recreate It. Launch It."
- Lead (157 chars): "Find a style you love and recreate it with your own product. No prompts required – just select a template, add your product, and generate content in minutes."
- Links: Try Now (/app), Book Demo

### 2. Template gallery
- Category filter chips: All, Skincare, Beauty, Fashion, Food & Drink, Technology, Fitness, Home Decor, Explore More
- Each card follows the naming formula: category + technique + format (examples from the live list):
  - "Skincare Routine TikTok UGC" (30)
  - "Fashion Try-On Cinematic Reel" (27)
  - "Talking Head Product Demo UGC" (29)
  - "Sports Product UGC Review" (25)
  - "Jewelry ASMR Unboxing Reel" (27)
  - "GRWM Fashion Get Ready Reel" (27)

### 3. H2 "Brands are Switching to AI Video Ads" (36 chars)
- Customer testimonials (we have no testimonials: do not reproduce)

### 4. H2 "Frequently Asked Questions" (26 chars)
- 11 questions, template/tool generic (see comp-b99b6d032753 FAQ extraction)

## Mapping decisions (strict)
| Competitor block | Our block | Handling |
|---|---|---|
| Hero (H1 + lead) | PageHero h1/lead + maker | Mirror formula, keep main keyword in h1 |
| Category chips (gallery) | visual.picker.chips | Use competitor chip names only |
| Template cards (formula names) | visual.picker.cards | Rename with formula where image matches; else delete -> pending image |
| Testimonials | — | Delete (no real data, T031 pending) |
| FAQ | faq | Mirror question phrasing, our facts |
| (ross requirement) | visual steps (3) | Keep |

Kept: hero/maker, 3 steps, picker (chips + cards), FAQ, CTA.
Deleted sections: overview, input_guide, results, scene_recipes, after_download, fit, examples, visual.uses, visual.input, visual.outputs, visual.after, intro, tip, ideas (competitor page has no such blocks).
