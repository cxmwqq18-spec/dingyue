# New directory page design studies

Created 2026-10-17 with the built-in `image_gen` tool. Design review artifacts only; no routes, runtime content, navigation, database records, or deployments were changed by this design task.

## Deliverables

- `ai-twin-desktop.png` — `/ai-twin`: asymmetric hero, illustrative presenter concept, creative-direction examples, three-step brief workflow.
- `text-to-video-desktop.png` — `/text-to-video`: centered hero, brief/storyboard demo, selected-shot workflow, product-example gallery.
- `new-directory-prompts.json` — exact generation prompts.

## Research and original composition

Browsed and visually inspected these live desktop pages with Playwright at 1440 × 1100:

- https://tagshop.ai/ai-twin — reference for hero and supporting process hierarchy. Its functional identity/voice cloning claims, customer logos, and outcome claims were not adopted.
- https://tagshop.ai/text-to-video-ai — reference for a centered headline, wide prompt workspace demo, and supporting feature/process sections. Its one-click generation promise, model selectors, statistics, and avatar counts were not adopted.
- https://www.aivideosugc.com — source for the black/lavender visual direction and currently described product workflow: product facts/photos, brief, editable storyboard, selected shot generation, version comparison, assembly, review and download. Homepage labels AI Twin as a preview/concept. The web text reader failed for this domain; a live Playwright navigation and screenshot succeeded.

Both new designs use the requested all-caps `AIVIDEOSUGC` wordmark. Their original compositions adapt the brand's dark studio aesthetic with calm lavender accents, clear hierarchy, warm product photography, restrained borders, readable typography, and clear action labels.

## Copy and capability decisions

AI Twin headline: “Shape your next digital presenter.” Explicit hero qualification: “Concept preview. Face and voice cloning are not available here.” Portraits carry “Illustrative concept” labels. The action explores a concept or available AI presenters; no cloning, identity fidelity, privacy guarantees, or generation availability is implied. Process copy describes visual direction, product messaging and a workspace handoff.

Text-to-video headline: “Your words. Your next product video.” The main description promises the documented workflow rather than instant output: “Describe your product, audience and message. Refine an editable storyboard, generate selected shots and assemble the clips you choose.” The main action builds a video brief. A clearly labelled example storyboard separates illustrative product imagery from actual customer output.

All visible strings were visually reviewed as end-user copy. No SEO instructions, developer annotations, internal task descriptions, fabricated reviews, performance figures, guarantees, or invented prices appear. Generic serum imagery illustrates a product direction; no medical, efficacy or testimonial claim appears.

## Visual review and scope

Both PNGs were opened after generation and checked for brand spelling, copy accuracy, legibility, hierarchy, complete page composition, concept labels and capability boundaries. The built-in outputs are 1095 × 1437. Raster text is a design reference; any later implementation should use reviewed relational page content and real semantic HTML under the repository's current no-snapshot and SSR rules.

This task only creates files inside `releases/aidreamcapes-refinements-20261017/designs/`. No public storefront state changed, so relational revision/origin readback and production regression checks do not apply to these offline image artifacts. No public deployment is claimed.
