# Aidreamcapes pilot actor image source

For the four prompts in `aidreamcapes-pilot-four-prompts`, use the actor portrait actually selected by the creation flow: the `image.src` value from the LivePage `/ai-actors` mapping returned by `provider.ts` `getWorkspaceActors`. The corresponding files are under `/public/ai-image-generation/actors/` and follow `ac1-actor-card-{id}-r{rev}-640.webp`.

Do not use `actors.json.imageUrl` or the old `actors/{id}.webp` library image for these prompt attachments. Those are old alias/library portraits and do not match the creation flow selection.

| Character | Selected actor image |
| --- | --- |
| Jon | `ac1-actor-card-outdoor-2-r1-640.webp` |
| Mila | `ac1-actor-card-indoor-2-r1-640.webp` |
| Dev | `ac1-actor-card-home-1-r1-640.webp` |
| Elise | `ac1-actor-card-terrace-1-r3-640.webp` |

Keep the same file in both the DOCX character portrait and that prompt's attachment manifest.
