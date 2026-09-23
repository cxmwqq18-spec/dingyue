#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
const outputRoot = path.resolve(repoRoot, "deliverables/aidreamcapes-eu-video-prompt-pack-2026-09");
const manifestPath = path.join(outputRoot, "asset-manifest.json");
const providerId = "aiprov_image4_mysub2api";
const providerLabel = "image4";
const model = "gpt-image-2";
const maxPaidCreates = 126;
const concurrency = 1;
const requestedSizes = {
  landscape: { size: "3840x2160", displayWidth: 1600 },
  portrait: { size: "2160x3840", displayWidth: 900 },
  square: { size: "2880x2880", displayWidth: 1200 }
};

const themes = [
  {
    slug: "talking-photo", label: "Portrait parlant", category: "Création IA", homepage: true, ratio: "1:1",
    concept: "A retired cartographer in a quiet map archive watches a monochrome portrait on a glass plate come alive; the movement is subtle, intimate, and clearly different from a birthday portrait.",
    assets: [
      ["character", "cartographer-character", "role", "A retired French cartographer with silver hair, olive cardigan, brass compass and ink-stained fingertips; front, side, back, face details, restrained expressions, hands holding a glass photo plate.", "landscape"],
      ["scene", "map-archive-interior", "scene", "A warm map archive with tall drawers, linen-covered table, brass desk lamp as motivated key light, layered shelves, paper textures, no readable text.", "landscape"],
      ["prop", "glass-portrait-plate", "prop", "A translucent glass portrait plate in a walnut frame, a tiny reflected eye movement visible in the image, macro object reference, no text or logo.", "square"]
    ],
    beats: [
      "00-06 — Wide establishing view through a brass compass in the foreground; the cartographer places the glass portrait plate on the linen table while the desk lamp creates a warm pool of light.",
      "06-14 — 50mm side-45-degree medium shot; a slow lateral slide follows her ink-stained thumb as the portrait subject blinks once inside the glass, and her breath catches without exaggeration.",
      "14-24 — 85mm close-up with a gentle push; the reflected eye turns toward her, paper edges lift in the lamp's convection, and she steadies the plate with both hands.",
      "24-30 — Overhead-to-front transition resolves on the living portrait and the cartographer's small relieved smile; end on the glass plate resting safely beside the compass."
    ],
    audio: "Quiet paper friction, lamp hum, a tiny glass resonance, one restrained inhale and a soft whispered 'bonjour'; no BGM.",
    final: "The glass portrait remains stable and alive on the table, with the cartographer's hand resting beside it.",
    negative: "No birthday cake, balloons, window portrait, generic talking-head pose, readable map labels, logo, watermark, warped hands, flickering identity, added background music."
  },
  {
    slug: "cinematic-video", label: "Vidéo cinématographique", category: "Création IA", homepage: true, ratio: "16:9",
    concept: "A snowbound railway signalman guides an arriving night train through an alpine station, built as a compact atmospheric film scene rather than noir detective imagery.",
    assets: [
      ["character", "railway-signalman", "role", "A weathered alpine railway signalman in a navy wool coat, reflective brass buttons, red scarf and leather gloves; full-body front, side, back and face detail reference.", "landscape"],
      ["scene", "alpine-station-night", "scene", "A small alpine railway platform at blue hour, signal tower, snowbanks, wet rails, warm station windows and a red signal lantern as motivated light sources.", "landscape"],
      ["scene", "train-cab-interior", "scene", "A realistic vintage train cab with fogged glass, metal levers, warm instrument glow and snowy track visible ahead; spatially consistent interior reference.", "landscape"],
      ["prop", "brass-signal-lantern", "prop", "A heavy brass railway signal lantern with red glass, worn handle and fresh snow on its rim; clean hero object reference with close material detail.", "square"]
    ],
    beats: [
      "00-06 — 24mm wide tracking shot along the snow-covered platform; the signalman runs toward the tower, red lantern swinging in his gloved hand, steam drifting from the distant train.",
      "06-14 — 50mm side shot with a controlled handheld follow; he climbs the metal stairs and checks the lever, breath visible in the cold while the station window light falls off across the snow.",
      "14-24 — 85mm insert and rack focus from the lantern glass to the approaching headlight; he pulls the lever with both hands as the red signal changes to green.",
      "24-30 — 35mm low-angle dolly beside the rails; the train enters safely, snow shakes from the roof, and the signalman lowers the lantern as the final image settles on the green signal reflected in wet steel."
    ],
    audio: "Boots on packed snow, metal lever strain, distant train horn, steam release and rail vibration; no BGM.",
    final: "The train passes safely under the green signal, with the lantern lowered in the foreground.",
    negative: "No detective, rainy noir alley, gun, readable signage, impossible train movement, floating lantern, logo, watermark, artificial fog without source."
  },
  {
    slug: "music-video", label: "Vidéo musicale", category: "Créatif et lifestyle", homepage: true, ratio: "16:9",
    concept: "A cellist performs inside a dawn greenhouse where vines, condensation and moving sun shutters create the rhythm; the sound is diegetic performance audio, not generic BGM.",
    assets: [
      ["character", "greenhouse-cellist", "role", "A focused young cellist with cropped dark hair, rust linen suit and worn leather shoes; full-body, side, back, face and hand-on-bow details.", "landscape"],
      ["prop", "antique-cello", "prop", "A warm maple cello with visible grain, dark bow hair and a small repaired seam; front, side and bridge detail reference, no branding.", "square"],
      ["scene", "glasshouse-dawn", "scene", "An abandoned botanical greenhouse at dawn with wet glass, hanging vines, stone floor, brass plant tables and motorized roof shutters revealing sunlight.", "landscape"],
      ["scene", "greenhouse-reflection-detail", "scene", "A close environmental reference of cello reflections in condensation-covered glass, leaf shadows and golden sun shafts from the opening roof.", "landscape"]
    ],
    beats: [
      "00-06 — 24mm crane-like rise from dew-covered leaves to the cellist seated between plant tables; the first bow stroke is heard before the face is revealed.",
      "06-14 — 50mm slow orbit around the cello; she leans into a phrase, bow hair flexing against the strings while roof shutters begin opening above her.",
      "14-24 — 85mm macro close-ups of fingertips, vibrating strings and condensation trembling on a leaf; a side-45-degree push keeps the performer anchored in the same space.",
      "24-30 — 35mm backward dolly through the greenhouse aisle; sunlight fills the glasshouse as she finishes the phrase and lowers the bow, leaving the cello resonance in the air."
    ],
    audio: "Live cello bowing, finger taps, greenhouse mechanisms, leaf rustle and room resonance; no added background music.",
    final: "The performer is still framed among sunlit plants, bow lowered and the last natural cello resonance fading.",
    negative: "No concert stage, nightclub, generic music-video lights, lip-sync mismatch, extra instruments, logo, watermark, floating foliage, added BGM."
  },
  {
    slug: "fashion-video", label: "Vidéo mode", category: "Créatif et lifestyle", homepage: false, ratio: "9:16",
    concept: "A model moves through a brutalist gallery wearing a sculptural translucent coat while architectural shutters create changing bands of sunlight.",
    assets: [
      ["character", "brutalist-fashion-model", "role", "A poised adult model with short copper hair, sculptural translucent graphite coat, cream boots and geometric earrings; fashion reference sheet with full-body and fabric movement details.", "portrait"],
      ["prop", "sculptural-coat-detail", "prop", "A translucent graphite coat with layered pleats, matte hardware and sharp shoulder geometry; front, side, folded and moving-fabric reference, no logo.", "portrait"],
      ["scene", "brutalist-gallery", "scene", "A tall brutalist concrete gallery with long skylights, movable vertical shutters, polished stone floor and a single warm sun direction; strong architectural depth.", "portrait"]
    ],
    beats: [
      "00-06 — 24mm vertical establishing shot from floor level; the model enters between concrete columns as shutter shadows travel across the floor.",
      "06-14 — 50mm side tracking shot; she turns through a narrow corridor, one hand lifting the coat edge so the translucent layers catch the warm skylight.",
      "14-24 — 85mm close-up on the shoulder seam, earring and eye line; a restrained arc reveals the fabric's movement while the background falls into architectural bands.",
      "24-30 — 35mm vertical pull-back at the gallery threshold; she stops beneath the brightest shutter opening, coat settling into its final sculptural silhouette."
    ],
    audio: "Soft boot steps, fabric movement, distant gallery ventilation and a single shutter mechanism; no BGM.",
    final: "The model holds a strong silhouette under the final band of skylight with the coat fully readable.",
    negative: "No runway crowd, brand logo, readable text, plastic-looking fabric, duplicate limbs, impossible cloth, beauty filter, watermark."
  },
  {
    slug: "food-video", label: "Vidéo culinaire", category: "Créatif et lifestyle", homepage: false, ratio: "16:9",
    concept: "A Marseille-inspired bakery sequence follows a baker assembling a citrus tart from flour dust to a precise final glaze.",
    assets: [
      ["character", "citrus-baker", "role", "A warm, precise adult baker with dark curly hair, sage apron and flour-marked forearms; front, side, face and hand-action reference sheet.", "landscape"],
      ["prop", "citrus-tart", "prop", "A glossy citrus tart with thin orange slices, pale cream and a clean pastry edge; hero object and macro texture reference, no text.", "square"],
      ["scene", "tile-bakery-kitchen", "scene", "A bright tiled bakery kitchen with marble worktop, copper oven, hanging utensils and morning window light motivated from one side.", "landscape"],
      ["prop", "pastry-tools-and-citrus", "prop", "A rolling pin, offset spatula, sliced citrus and a small copper brush arranged as working tools on marble, clean object reference without labels.", "landscape"]
    ],
    beats: [
      "00-06 — 35mm overhead-to-medium move; the baker dusts flour onto marble and rolls the dough in one continuous purposeful action.",
      "06-14 — 50mm side close medium; she places citrus slices one by one, rotating the tart tin as morning light catches the glaze brush.",
      "14-24 — 100mm macro inserts of knife edge, citrus peel and glaze spreading; steam from the oven briefly softens the background without obscuring the hands.",
      "24-30 — 35mm lateral reveal from oven to cooling rack; she sets the finished tart down, wipes one flour mark from the rim and holds the final composition."
    ],
    audio: "Dough scrape, knife taps, oven hinge, brush on glaze and quiet bakery room tone; no BGM.",
    final: "The finished citrus tart rests on the cooling rack, still warm, with the baker's hand withdrawing from frame.",
    negative: "No birthday cake, floating ingredients, unreadable labels, extra fingers, fake steam source, plastic food, logo, watermark."
  },
  {
    slug: "pet-video", label: "Vidéo avec animaux", category: "Créatif et lifestyle", homepage: false, ratio: "16:9",
    concept: "A rescued greyhound finds a red ribbon in a coastal art studio and returns it to its patient owner, focusing on believable animal behavior.",
    assets: [
      ["character", "rescue-greyhound", "role", "A slender rescued greyhound with brindle coat, one folded ear, amber eyes and a faded blue collar; front, side, back, muzzle and paw detail reference.", "landscape"],
      ["character", "coastal-artist", "role", "An adult coastal artist with linen shirt, rolled sleeves and paint-stained hands; front, side, face and gentle crouching posture reference.", "landscape"],
      ["scene", "coastal-art-studio", "scene", "A sunlit coastal art studio with large salt-fogged windows, canvases, low shelves, woven rug and blue ocean light; realistic dog-scale pathways.", "landscape"],
      ["prop", "red-ribbon", "prop", "A simple red fabric ribbon with frayed edge and salt-damp texture, photographed at dog muzzle scale, no text or logo.", "square"]
    ],
    beats: [
      "00-06 — 24mm low tracking shot at dog height; the greyhound crosses between canvas legs and notices the red ribbon beneath a low table.",
      "06-14 — 50mm side follow; the dog lowers its head, picks up the ribbon without shaking it, and turns toward the artist as ocean light moves across the rug.",
      "14-24 — 85mm close-up on paw placement, muzzle and the artist's hand lowering slowly; the dog pauses, reads the gesture, then steps forward.",
      "24-30 — 35mm medium two-shot; the artist accepts the ribbon, touches the dog's collar and looks toward the open coastal window as the dog settles beside her."
    ],
    audio: "Nails on wood, collar tag, fabric drag, distant gulls, soft dog breath and a quiet appreciative laugh; no BGM.",
    final: "The red ribbon is safe in the artist's hand while the greyhound rests beside her, both framed by the ocean-lit studio.",
    negative: "No aggressive animal, impossible anatomy, talking dog, cartoon eyes, pet-store backdrop, logo, watermark, forced human pose."
  },
  {
    slug: "tiktok-video", label: "Vidéo TikTok", category: "Social et créateurs", homepage: true, ratio: "9:16",
    concept: "A bike mechanic creator demonstrates a magnetic repair trick in a compact neighborhood repair kiosk, paced for a short vertical hook.",
    assets: [
      ["character", "bike-mechanic-creator", "role", "An energetic adult bicycle mechanic with teal work jacket, orange gloves and braided hair; expressive but believable face, hands, front and side reference.", "portrait"],
      ["prop", "folding-bike-tool", "prop", "A compact matte-black folding bicycle tool with magnetic bit holder, shown open, folded and in hand, no brand marks.", "portrait"],
      ["scene", "colorful-bike-kiosk", "scene", "A narrow colorful bicycle repair kiosk with pegboard tools, open service window, wet pavement and late-afternoon side light.", "portrait"],
      ["prop", "loose-bike-chain", "prop", "A realistic bicycle chain with one loose link and grease texture, isolated at repair scale, no logo or text.", "square"]
    ],
    beats: [
      "00-06 — 24mm vertical snap push toward the creator as she catches a falling chain link before it hits the floor, immediately establishing the hook.",
      "06-14 — 35mm handheld side angle; she clips the magnetic tool onto the link, moving continuously while the kiosk background remains readable.",
      "14-24 — 85mm macro cut to the tool tip and chain teeth; a quick rack focus reveals the repaired connection and her controlled half-smile.",
      "24-30 — 50mm vertical pull-back; she spins the repaired wheel and points the bicycle toward the open street, ending on a clean working result with no on-screen text."
    ],
    audio: "Chain click, tool snap, wheel spin, street bicycle bells and one short spoken reaction; no BGM.",
    final: "The wheel spins smoothly in the foreground while the creator rolls the bicycle toward daylight.",
    negative: "No generic rainy selfie, platform UI, captions, hashtags, logos, unreadable text, impossible chain geometry, beauty filter, watermark."
  },
  {
    slug: "instagram-reels", label: "Reels Instagram", category: "Social et créateurs", homepage: true, ratio: "9:16",
    concept: "A ceramic artist turns a rough clay cup into a glazed object through a satisfying vertical transformation in a sunlit studio.",
    assets: [
      ["character", "ceramic-artist", "role", "An adult ceramic artist with dark bun, pale green overshirt and clay-marked hands; front, side, face, hands and apron detail reference.", "portrait"],
      ["prop", "clay-cup-progress", "prop", "A handmade cup shown as raw clay, trimmed form and finished speckled glaze in one consistent object family, no text or logo.", "portrait"],
      ["scene", "sunlit-ceramic-studio", "scene", "A calm ceramic studio with wheel, shelves of vessels, linen curtain and warm window light, with believable dust and work surfaces.", "portrait"],
      ["prop", "blue-glaze-brush", "prop", "A wide ceramic glaze brush, blue glaze bowl and fine bristles, shown in-use scale with realistic wet material.", "square"]
    ],
    beats: [
      "00-06 — 35mm vertical overhead move; the artist lifts a rough clay cup from the wheel and turns it toward the lens, clay dust catching window light.",
      "06-14 — 50mm side tracking shot; match-cut from trimming to brushing blue glaze, with her wrist and the cup rotating continuously.",
      "14-24 — 85mm macro on the glaze pooling around the rim; a small turn of the cup reveals the speckled surface and the artist's focused eyes in reflection.",
      "24-30 — 35mm vertical reveal from worktable to shelf; she places the finished cup beside the raw form, creating a clear before-and-after final image."
    ],
    audio: "Wheel motor, trimming scrape, brush on ceramic, curtain movement and a small satisfied exhale; no BGM.",
    final: "The finished glazed cup and raw clay starting form stand together on the shelf, clearly connected by the transformation.",
    negative: "No generic tutorial graphics, text overlays, duplicate cups, melted ceramic, logo, watermark, impossible hand movement."
  },
  {
    slug: "youtube-video", label: "Vidéo YouTube", category: "Social et créateurs", homepage: false, ratio: "16:9",
    concept: "A long-form restoration creator revives a vintage tabletop radio from dusty disassembly to a warm working dial.",
    assets: [
      ["character", "radio-restoration-host", "role", "A patient adult restoration host with round glasses, denim apron and precise hands; front, side, face and work posture reference.", "landscape"],
      ["prop", "vintage-table-radio", "prop", "A 1950s tabletop radio with walnut case, cloth grille and brass tuning dial; front, back, opened and detail views, no readable station text.", "landscape"],
      ["scene", "restoration-workshop", "scene", "A warm restoration workshop with wooden bench, soldering lamp, drawers, tools and a dark window; key light motivated by the soldering lamp.", "landscape"],
      ["prop", "radio-tube-and-tools", "prop", "A glass radio tube, screwdriver, soldering iron and small screws arranged at working scale, no labels or logos.", "square"]
    ],
    beats: [
      "00-06 — 24mm workshop establishing shot; the host places the dusty radio on the bench and opens the back panel while the soldering lamp switches on.",
      "06-14 — 50mm over-shoulder tracking shot; he removes one brittle tube, compares it with the replacement and keeps the radio chassis anchored in frame.",
      "14-24 — 85mm close-up on solder, fingertips and the tuning mechanism; the dial needle trembles as he reconnects the final wire.",
      "24-30 — 35mm slow push from the host to the restored radio; the cloth grille glows with warm light and the host turns the knob to a stable signal."
    ],
    audio: "Drawer slide, screw turns, solder hiss, radio static resolving into a clean test tone and quiet workshop room tone; no BGM.",
    final: "The restored radio emits a steady warm signal while the host's hand leaves the tuning dial.",
    negative: "No modern laptop studio, brand logos, readable station names, magical repair, sparking danger, watermark, fake UI."
  },
  {
    slug: "social-media-video", label: "Vidéo pour les réseaux sociaux", category: "Social et créateurs", homepage: false, ratio: "9:16",
    concept: "A community-garden creator turns a discarded wooden crate into a herb planter through a brisk social-first sequence.",
    assets: [
      ["character", "community-garden-creator", "role", "An adult community gardener with yellow rain jacket, green gloves and short curly hair; front, side, face and hand-action reference.", "portrait"],
      ["prop", "reclaimed-wood-crate", "prop", "A weathered wooden shipping crate with visible grain, rusty fastener and repairable slat, no branding or text.", "portrait"],
      ["scene", "community-garden-yard", "scene", "A lively urban community garden with raised beds, brick wall, watering station and soft overcast daylight, clear depth layers.", "portrait"],
      ["prop", "herb-seedlings-and-soil", "prop", "Small basil and thyme seedlings, dark soil, hand trowel and twine arranged at planting scale, no packaging text.", "square"]
    ],
    beats: [
      "00-06 — 24mm vertical whip-pan that settles on the damaged crate as the creator drags it into the garden beside a raised bed.",
      "06-14 — 35mm handheld side shot; she tightens the loose slat and lines the inside with fabric while gardeners move naturally in the background.",
      "14-24 — 85mm detail sequence of soil, seedling roots and twine; her gloved fingers press the soil once, then water darkens the surface.",
      "24-30 — 50mm vertical pull-back; the finished herb planter joins the community bed, and the creator steps back as a bee crosses the foreground."
    ],
    audio: "Wood knock, twine pull, soil compression, watering can and garden voices at a distance; no BGM.",
    final: "The reclaimed crate is now a planted herb box integrated into the shared garden.",
    negative: "No generic influencer bedroom, app interface, readable text, logos, impossible plant growth, duplicated hands, watermark."
  },
  {
    slug: "story-video", label: "Vidéo narrative", category: "Social et créateurs", homepage: false, ratio: "16:9",
    concept: "A courier returns a sealed seed packet to a lighthouse keeper across one evening, using two adults, two connected locations and a quiet emotional turn.",
    assets: [
      ["character", "coastal-courier", "role", "An adult courier in weatherproof ochre jacket, canvas satchel and salt-damp hair; full-body, face and hands reference.", "landscape"],
      ["character", "lighthouse-keeper", "role", "An older lighthouse keeper in navy knit sweater, wool cap and brass key ring; front, side, back and restrained reaction reference.", "landscape"],
      ["scene", "harbor-road-dusk", "scene", "A windy harbor road at dusk with wet stone, mooring ropes, low lamps and the lighthouse visible across the water.", "landscape"],
      ["scene", "lighthouse-stairwell", "scene", "A narrow lighthouse stairwell with red-painted rail, rotating beacon light and sea visible through small windows; physical vertical depth.", "landscape"],
      ["prop", "sealed-seed-packet", "prop", "A small wax-sealed paper seed packet with blank surface, creased corners and a single dried leaf tucked under the seal, no readable text.", "square"]
    ],
    beats: [
      "00-06 — 24mm harbor establishing shot; the courier crosses wet stones against wind, clutching the sealed packet while the lighthouse beacon sweeps behind her.",
      "06-14 — 50mm side tracking shot at the lighthouse door; the keeper opens it, recognizes the packet and does not speak, his hand tightening around the brass keys.",
      "14-24 — 85mm alternating close shots held on the same axis; the courier offers the packet, the keeper touches the wax seal, then turns toward the stairwell.",
      "24-30 — 35mm upward dolly in the stairwell; they climb together as the beacon turns, ending on the packet placed beneath a small window facing the sea."
    ],
    audio: "Wind, rope creak, door latch, beacon motor, measured footsteps and one shared breath; no BGM.",
    final: "The sealed packet rests on the lighthouse sill while both characters stand in the rotating beam.",
    negative: "No melodramatic crying, running chase, unreadable letter text, axis crossing, impossible stairwell, logo, watermark, BGM."
  },
  {
    slug: "meme-video", label: "Vidéo meme", category: "Social et créateurs", homepage: false, ratio: "9:16",
    concept: "A deadpan office worker tries to keep a runaway orange from rolling through a serious meeting, with physical timing and no text-based joke.",
    assets: [
      ["character", "deadpan-office-worker", "role", "An adult office worker in pale blue shirt, dark trousers and oversized glasses; front, side, face and restrained reaction reference.", "portrait"],
      ["prop", "runaway-orange", "prop", "A bright imperfect orange with one leaf and realistic rolling texture, hero object reference at desk scale.", "square"],
      ["scene", "quiet-glass-office", "scene", "A quiet glass meeting room with long table, rolling chair, blinds and cool daylight; clean physical paths for the orange.", "portrait"],
      ["prop", "meeting-notebook", "prop", "A blank black notebook, pen and ceramic cup on a meeting table, no readable text or logo.", "square"]
    ],
    beats: [
      "00-06 — 24mm vertical low-angle push; the orange rolls out from beneath the meeting table while the worker continues pointing at the blank notebook.",
      "06-14 — 35mm lateral handheld move; the worker reaches with one foot, misses by a few centimeters and keeps a perfectly neutral face.",
      "14-24 — 85mm close-up on the orange changing direction off a chair leg, then the worker's eyes shifting without moving his head.",
      "24-30 — 50mm vertical pull-back; he catches the orange under the cup just before it reaches the glass door, lifts it into frame and resumes the meeting pose."
    ],
    audio: "Small wheel squeak, orange roll, chair bump, cup clink and one suppressed sigh; no BGM.",
    final: "The orange is held beside the blank notebook while the worker returns to an absurdly serious posture.",
    negative: "No captions, meme text, emojis, platform UI, exaggerated cartoon face, impossible rolling physics, logo, watermark."
  },
  {
    slug: "explainer-video", label: "Vidéo explicative", category: "Professionnel et entreprise", homepage: false, ratio: "16:9",
    concept: "A marine researcher explains household water filtration using a transparent physical demonstration on a real lab bench.",
    assets: [
      ["character", "marine-researcher", "role", "An adult marine researcher with short dark hair, teal lab coat and calm precise gestures; front, side, face and hand reference.", "landscape"],
      ["prop", "transparent-filter-column", "prop", "A transparent layered water filter column with visible gravel, sand and charcoal sections, blank labels removed, clean scientific object reference.", "landscape"],
      ["scene", "coastal-water-lab", "scene", "A coastal water laboratory with stainless bench, glassware, tide chart shapes without readable text and cool window light from one direction.", "landscape"],
      ["prop", "water-samples", "prop", "Three glass sample jars containing cloudy, filtered and clear water, consistent lighting and no labels.", "square"]
    ],
    beats: [
      "00-06 — 24mm lab establishing shot; the researcher places the transparent column at the center of the bench and pours cloudy water from a glass beaker.",
      "06-14 — 50mm side-45-degree medium shot; she traces the water path with one finger while the flow visibly passes through each material layer.",
      "14-24 — 100mm macro shot through the glass; particles slow in the gravel and charcoal, then the camera racks to the clear sample filling below.",
      "24-30 — 35mm controlled pull-back; the three samples align from cloudy to clear beside the column as the researcher closes the valve."
    ],
    audio: "Water pour, valve click, glass contact, low lab ventilation and measured spoken explanation; no BGM.",
    final: "The transparent column and three sample jars remain visible in an ordered before-to-after arrangement.",
    negative: "No floating diagrams, unreadable labels, unsupported medical claims, fake laboratory glow, logo, watermark, BGM."
  },
  {
    slug: "how-to-video", label: "Vidéo tutorielle", category: "Professionnel et entreprise", homepage: false, ratio: "16:9",
    concept: "A climbing instructor teaches a bowline knot on a quiet dock, showing the rope path through continuous physical action.",
    assets: [
      ["character", "climbing-instructor", "role", "An adult climbing instructor in charcoal fleece, orange chalk bag and weathered hands; front, side, face and hand-knot reference.", "landscape"],
      ["prop", "climbing-rope-and-carabiner", "prop", "A blue climbing rope, matte carabiner and anchor ring with clear material detail, no brand markings.", "landscape"],
      ["scene", "quiet-climbing-dock", "scene", "A wooden climbing practice dock beside a calm quarry, anchor posts, rope coils and morning side light with open depth.", "landscape"],
      ["prop", "finished-bowline-knot", "prop", "A correctly tied bowline knot shown from front, side and load-bearing angle, clean instructional object reference.", "square"]
    ],
    beats: [
      "00-06 — 35mm medium establishing shot; the instructor anchors the rope to a post and faces three-quarters to camera, keeping both hands visible.",
      "06-14 — 50mm over-shoulder move; he forms the loop, passes the working end through and keeps tension with his other hand.",
      "14-24 — 85mm macro insert on the rope path; his fingers pull the tail around the standing line while the knot tightens naturally.",
      "24-30 — 35mm side pull-back; he loads the knot against the anchor, checks it with one tug and releases the finished rope into the coil."
    ],
    audio: "Rope fibers tightening, carabiner click, dock creak, water movement and concise spoken instruction; no BGM.",
    final: "The completed bowline sits under light load on the anchor with the instructor's hand giving a final safety check.",
    negative: "No unsafe climbing behavior, impossible knot, missing rope sections, text overlay, logo, watermark, static talking head."
  },
  {
    slug: "talking-head-video", label: "Vidéo face caméra", category: "Professionnel et entreprise", homepage: false, ratio: "16:9",
    concept: "A marine biologist speaks directly to camera at a tide pool, using a shell tray and measured body movement instead of a static studio talking head.",
    assets: [
      ["character", "tidepool-biologist", "role", "An adult marine biologist with short curly hair, weatherproof field jacket and sea-glass pendant; front, side, face and restrained speaking reference.", "landscape"],
      ["scene", "rocky-tidepool", "scene", "A rocky Atlantic tide pool at low tide with seaweed, reflective water, distant cliffs and soft overcast daylight; practical safe standing area.", "landscape"],
      ["prop", "shell-observation-tray", "prop", "A shallow field tray holding shells, seaweed and a hand lens, no labels or logos, natural wet textures.", "square"]
    ],
    beats: [
      "00-06 — 35mm medium shot; the biologist walks into the tide-pool frame carrying the tray, turns to camera and sets it on a flat rock.",
      "06-14 — 50mm side-45-degree move; she crouches, lifts a shell and explains while her hands remain active and the waterline stays visible behind her.",
      "14-24 — 85mm close-up alternating between her eyes, the hand lens and a rippling pool reflection; her expression shifts from concern to curiosity.",
      "24-30 — 35mm slow pull-back; she stands, gestures toward the living pool and leaves the tray in the foreground as the tide moves around it."
    ],
    audio: "Waves, water trickle, shell contact, wind through jacket and clear spoken voice; no BGM.",
    final: "The biologist remains framed with the tide pool and observation tray, still moving naturally rather than posing.",
    negative: "No static studio headshot, teleprompter, captions, brand marks, unsafe wildlife handling, watermark, BGM."
  },
  {
    slug: "product-video", label: "Vidéo produit", category: "Marketing et commerce", homepage: true, ratio: "16:9",
    concept: "A modular travel lamp demonstrates its magnetic parts inside a quiet cabin, with clean product movement and no generic backpack or earbuds imagery.",
    assets: [
      ["prop", "modular-travel-lamp", "product", "A premium modular travel lamp with magnetic base, warm frosted cylinder and brushed aluminum ring; front, side, opened and connection detail reference, no logo.", "landscape"],
      ["scene", "minimal-cabin-night", "scene", "A compact modern cabin at blue hour with wood desk, window to dark pines, wool blanket and a single practical lamp location.", "landscape"],
      ["prop", "lamp-module-detail", "prop", "Close object reference of the lamp's magnetic connector, frosted diffuser and hand-scale assembly, no branding or text.", "square"]
    ],
    beats: [
      "00-06 — 24mm slow tabletop slide; the unlit lamp components rest on the cabin desk while a hand enters and aligns the magnetic base.",
      "06-14 — 50mm controlled orbit; the cylinder clicks into place and the warm light blooms across the wood grain without changing the room geometry.",
      "14-24 — 85mm macro on connector, diffuser and fingertips; the lamp rotates from desk mode to bedside mode as the background remains softly legible.",
      "24-30 — 35mm pull-back to the cabin window; the lamp is now glowing beside a book and blanket, producing a calm final product tableau without readable text."
    ],
    audio: "Magnetic click, soft switch sound, fabric contact and quiet cabin ambience; no BGM.",
    final: "The assembled lamp casts a warm practical pool of light in the cabin, fully visible and stable.",
    negative: "No backpack, earbuds, floating product, logo, readable packaging, impossible reflections, overblown glow, watermark."
  },
  {
    slug: "product-ad-video", label: "Publicité vidéo produit", category: "Marketing et commerce", homepage: true, ratio: "16:9",
    concept: "A recycled running shoe moves from fiber preparation to a dawn trail, using a responsible material story and precise commercial product shots.",
    assets: [
      ["prop", "recycled-running-shoe", "product", "A modern running shoe made from visible recycled textile fibers, slate upper, pale orange lace and textured sole; full product reference with no logo.", "landscape"],
      ["scene", "textile-recycling-workshop", "scene", "A clean textile recycling workshop with fiber spools, cutting table and directional skylight; no readable labels or branding.", "landscape"],
      ["scene", "dawn-coastal-trail", "scene", "A rocky coastal running trail at dawn with wet stone, low grass, sea horizon and crisp directional sunlight.", "landscape"],
      ["prop", "recycled-fiber-spool", "prop", "A spool of multicolored recycled textile fiber with loose strands and visible weave, clean macro material reference.", "square"]
    ],
    beats: [
      "00-06 — 35mm lateral move across recycled fiber spools; the shoe enters frame on a clean worktable, lit by a real skylight.",
      "06-14 — 85mm macro transition from fiber texture to shoe weave, lace eyelet and sole edge; the camera follows a hand checking the material without showing claims.",
      "14-24 — 50mm low tracking shot on the coastal trail; the shoe lands on wet stone, compresses, and pushes forward with believable weight.",
      "24-30 — 35mm wide sunrise reveal; the runner exits toward the sea while one shoe remains in foreground, cleanly lit and sharply readable."
    ],
    audio: "Fiber rustle, cutting table movement, footfall on stone, wind and surf; no BGM.",
    final: "The shoe holds in the foreground with the coastal trail and sunrise behind it, no text or logo required.",
    negative: "No existing brand logo, unsupported sustainability text, floating shoe, impossible foot anatomy, studio spray, watermark, BGM."
  },
  {
    slug: "ugc-ad-video", label: "Publicité UGC", category: "Marketing et commerce", homepage: false, ratio: "9:16",
    concept: "A creator tests a solid sunscreen stick during a real cycling commute, moving from bathroom mirror to bright street without polished studio advertising.",
    assets: [
      ["character", "cycling-ugc-creator", "role", "An adult UGC creator with curly hair, yellow windbreaker and practical helmet; front, side, face and natural hand-to-face movement reference.", "portrait"],
      ["prop", "solid-sunscreen-stick", "product", "A compact unbranded solid sunscreen stick in a matte coral tube with twist base, shown closed, open and in hand, no readable text.", "portrait"],
      ["scene", "small-bathroom-mirror", "scene", "A lived-in small bathroom with mirror, ceramic sink, folded towel and morning window light, believable personal space.", "portrait"],
      ["scene", "sunny-bike-commute", "scene", "A bright European bike lane with trees, parked bicycles and hard midday sun, safe open movement path.", "portrait"]
    ],
    beats: [
      "00-06 — 24mm vertical handheld mirror approach; the creator twists the stick open and applies a small amount to her cheek while moving naturally.",
      "06-14 — 50mm side shot in the bathroom doorway; she closes the cap, grabs her helmet and checks the product in her palm without presenting it like a catalog.",
      "14-24 — 35mm tracking shot outside; she cycles through sun patches, then pauses at a crossing and reapplies to the back of her hand.",
      "24-30 — 85mm close-up on the closed stick clipped into a small bike bag, followed by her moving back into sunlight; no claims or UI appear."
    ],
    audio: "Cap twist, sink tap, helmet buckle, bicycle chain and city ambience; no BGM.",
    final: "The unbranded stick is safely stored in the bike bag while the creator rides away.",
    negative: "No fake testimonials, readable labels, medical claims, beauty filter, studio lighting, logo, watermark, BGM."
  },
  {
    slug: "promo-video", label: "Vidéo promotionnelle", category: "Marketing et commerce", homepage: true, ratio: "16:9",
    concept: "A coastal night market presenter unveils a modular solar lantern installation, making the product launch feel like an event without readable promotional text.",
    assets: [
      ["character", "coastal-market-presenter", "role", "An adult event presenter in cobalt jacket and cream trousers, confident but restrained gestures; front, side, face and hand reference.", "landscape"],
      ["prop", "solar-lantern-system", "product", "A family of modular solar lanterns with frosted shells, small solar panels and warm internal light; hero, stacked and hanging configurations, no logo.", "landscape"],
      ["scene", "coastal-night-market", "scene", "A lively coastal night market with fabric stalls, dark sea beyond, string-free practical lantern points and wet cobblestone reflections.", "landscape"],
      ["scene", "lantern-reveal-plaza", "scene", "A small open plaza prepared for a product reveal, with a central wooden platform, sea wind and a clear audience-free presentation path.", "landscape"],
      ["prop", "launch-display-crate", "prop", "A dark wooden display crate holding unbranded lantern modules and folded instruction cards with no readable text.", "square"]
    ],
    beats: [
      "00-06 — 24mm market establishing shot; the presenter walks through dim stalls carrying one closed lantern while the sea wind moves fabric in the foreground.",
      "06-14 — 50mm side orbit on the plaza; she places the module on the platform and connects two lanterns, each warming from the real internal light source.",
      "14-24 — 85mm detail progression across solar panel, connector and frosted shell; the installation expands as her hands work in a clear sequence.",
      "24-30 — 35mm wide reveal; the lantern system illuminates the plaza and sea-facing market path as the presenter steps aside, leaving a clean launch image."
    ],
    audio: "Market footfall, fabric flap, connector clicks, sea wind and soft crowd reaction; no BGM.",
    final: "The complete modular lantern installation lights the coastal market path with the presenter visible at the edge.",
    negative: "No sale text, prices, logos, fake crowd duplicates, unsupported product claims, floating lanterns, watermark, BGM."
  },
  {
    slug: "video-ad", label: "Publicité vidéo", category: "Marketing et commerce", homepage: false, ratio: "9:16",
    concept: "A traveler uses a compact translation earpiece in a train café, showing a service benefit through human interaction and visual rhythm rather than app UI.",
    assets: [
      ["character", "train-traveler", "role", "An adult traveler with short dark hair, rust coat and canvas shoulder bag; front, side, face and listening reaction reference.", "portrait"],
      ["character", "cafe-companion", "role", "An adult cafe attendant with white shirt, green apron and expressive but natural face; front, side and speaking reference.", "portrait"],
      ["prop", "translation-earpiece", "product", "A small unbranded matte-black translation earpiece with charging case, shown in ear, in hand and closed, no text or logo.", "square"],
      ["scene", "train-cafe-carriage", "scene", "A bright European train café carriage with wood trim, moving landscape beyond windows and practical overhead light, clear two-person seating.", "portrait"],
      ["prop", "folded-phrase-card", "prop", "A blank folded paper phrase card with abstract colored marks but no readable language, held between two people as a neutral conversation prop.", "square"]
    ],
    beats: [
      "00-06 — 24mm vertical train-café establishing shot; the traveler hesitates at the counter while the train curves through a bright landscape.",
      "06-14 — 50mm side two-shot; the attendant speaks, the traveler touches the earpiece and repeats the phrase with a small corrective gesture.",
      "14-24 — 85mm close-up on earpiece, eye contact and the blank phrase card; the translation moment lands through synchronized reaction, not graphics.",
      "24-30 — 35mm pull-back as both people smile and point toward the same passing landmark outside the window, returning the earpiece to its case."
    ],
    audio: "Train rhythm, counter contact, two natural voices, earpiece tap and carriage ambience; no BGM.",
    final: "The traveler closes the earpiece case while both people share the view outside the train window.",
    negative: "No app UI, readable text, fake translation captions, brand logo, impossible lip sync, watermark, BGM."
  },
  {
    slug: "brand-video", label: "Vidéo de marque", category: "Marketing et commerce", homepage: false, ratio: "16:9",
    concept: "An artisan perfume maker distills orange blossom in a Provençal atelier, tracing a sensory brand origin from raw material to bottle.",
    assets: [
      ["character", "provence-perfumer", "role", "An adult artisan perfumer with linen shirt, dark apron and careful hands; front, side, face, hand and profile reference.", "landscape"],
      ["prop", "unbranded-perfume-bottle", "product", "A sculptural clear perfume bottle with warm amber liquid, simple cork cap and no logo or readable text; front, side and glass detail.", "square"],
      ["scene", "orange-blossom-atelier", "scene", "A Provençal perfume atelier with copper still, stone table, orange blossom baskets, linen curtains and warm window light from one side.", "landscape"],
      ["scene", "botanical-preparation-table", "scene", "A close environmental reference of orange blossoms, glass beakers, botanical stems and copper tools on a worn stone worktable, no labels.", "landscape"],
      ["prop", "orange-blossom-basket", "prop", "A woven basket filled with fresh orange blossoms and a few leaves, natural close texture reference without packaging.", "square"]
    ],
    beats: [
      "00-06 — 24mm atelier establishing shot; the perfumer carries the blossom basket past the copper still and places it on the stone table.",
      "06-14 — 50mm lateral move; she measures blossoms into the still, checks the flame and wipes condensation from the copper lid.",
      "14-24 — 85mm macro sequence of petals, glass droplets and amber liquid entering the unbranded bottle; her hand steadies the cork cap.",
      "24-30 — 35mm slow pull-back through the atelier; she places the finished bottle beside the blossom basket as warm afternoon light crosses the stone."
    ],
    audio: "Petals brushing, copper lid, small flame, glass pour and atelier room tone; no BGM.",
    final: "The finished bottle, orange blossoms and copper still share one coherent warm-lit brand-origin tableau.",
    negative: "No logo, readable label, luxury cliché black background, floating liquid, synthetic petals, watermark, BGM."
  }
];

function slugifyFile(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assetPrompt(theme, asset, index) {
  const [type, name, role, description, orientation] = asset;
  const shape = orientation === "portrait" ? "vertical 9:16" : orientation === "square" ? "square 1:1" : "horizontal 16:9";
  const common = "Photorealistic, premium editorial reference asset for an AI video production pack. Fictional adults only where applicable. No logos, no readable text, no watermark, no UI, no public figures, no collage with unrelated subjects, no duplicated limbs, no accidental extra objects.";
  if (type === "character") {
    return `${common}\nCreate a structured ${shape} ${role} consistency board for the theme ${theme.label}. ${description} Show a clear front view, side view, back view, face detail and two restrained expression or action details in one coherent reference board. Preserve the same identity, clothing, proportions, materials and key features across every view. Neutral clean background, soft studio light, no text labels.`;
  }
  if (type === "scene") {
    return `${common}\nCreate a structured ${shape} scene reference board for the theme ${theme.label}. ${description} The main environment occupies most of the image; include clear spatial anchors, foreground, midground and background, the motivated light source and the path available for the video action. Keep architecture and props physically consistent, with no people unless the description requires a scale cue. No text labels.`;
  }
  return `${common}\nCreate a structured ${shape} ${role} reference asset for the theme ${theme.label}. ${description} Show a hero three-quarter view plus the key side, material, scale and in-use detail needed for image-to-video reference. Keep the object consistent in shape, color, surface and proportions. Neutral controlled background, no packaging copy, no text labels.`;
}

function makeAssets(theme) {
  return theme.assets.map((raw, index) => {
    const [type, name, role, description, orientation] = raw;
    const extension = "jpg";
    const base = `${String(index + 1).padStart(2, "0")}-${slugifyFile(name)}`;
    return {
      id: `image${index + 1}`,
      type,
      role,
      name,
      description,
      orientation,
      prompt: assetPrompt(theme, raw, index),
      displayPath: `assets/${theme.slug}/${type}/${base}.${extension}`,
      originalPath: `assets/${theme.slug}/${type}/${base}.original.png`,
      baseName: base
    };
  });
}

function videoPrompt(theme, assets) {
  const refs = assets.map((asset) => `@${asset.id} = ${asset.displayPath}`).join("\n");
  const timeline = theme.beats.map((beat) => beat).join("\n");
  return `Use the uploaded reference images exactly as follows:\n${refs}\n\nCreate a 30-second ${theme.ratio} Seedance 2.5 video for “${theme.label}”. ${theme.concept}\n\nContinuity and visual identity: preserve every referenced character, animal, product, prop and environment exactly. Do not invent a second version of any subject. Keep physical scale, light direction, material behavior and screen direction consistent. Use a compact eight-shot rhythm inside the four beats below; each beat may contain a motivated cut or match cut, but never a random montage.\n\nTimeline and shot direction:\n${timeline}\n\nCamera and image language: vary framing between establishing, medium, close and macro detail; use one primary camera move per shot, with motivated lateral tracking, push, orbit, pull-back, handheld follow or rack focus. Respect the 180-degree axis, 30-degree continuity rule and real-world camera placement. Keep the subject doing a visible task rather than posing. Use foreground, midground and background depth from actual scene elements.\n\nLighting and color: every highlight has a named practical source with believable falloff. Use one main depth mechanism only, with controlled exposure separation and restrained atmospheric softness. palette=${theme.label === "Vidéo musicale" ? "botanical amber, moss green, wet glass blue" : "theme-specific natural editorial palette"}; saturation=moderate; film_stock=natural 35mm texture; grain=barely visible; halation=none.\n\nAudio: ${theme.audio}\n\nFinal image: ${theme.final}\n\nNegative constraints: ${theme.negative}`;
}

function buildManifest() {
  return {
    schemaVersion: "1.0",
    pack: "aidreamcapes-eu-video-prompt-pack-2026-09",
    locale: { labels: "fr-FR", prompts: "en-US" },
    videoModel: { provider: "image4", model: "gpt-image-2 for image assets; Seedance 2.5 for video prompt target", durationSeconds: 30 },
    limits: { maxAssetsPerTheme: 6, maxPaidImageCreates: maxPaidCreates, attemptsPerCreate: 1, automaticRetry: false, providerFallback: false },
    themes: themes.map((theme, index) => {
      const assets = makeAssets(theme);
      return {
        order: index + 1,
        slug: theme.slug,
        labelFr: theme.label,
        categoryFr: theme.category,
        homepagePriority: theme.homepage,
        videoAspectRatio: theme.ratio,
        concept: theme.concept,
        assetCount: assets.length,
        assets,
        videoPrompt: videoPrompt(theme, assets)
      };
    })
  };
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sectionForTheme(theme, entry) {
  const assetLines = entry.assets.map((asset) => `| ${asset.id} | ${asset.type} | ${asset.role} | ${asset.displayPath} | ${asset.originalPath} |`).join("\n");
  const promptLines = entry.assets.map((asset) => `#### ${asset.id} — ${asset.name}\n\n**资产用途：** ${asset.description}\n\n**供应商生图提示词：**\n\n${asset.prompt}`).join("\n\n");
  return `## ${entry.order}. ${theme.label}\n\n- **分类：** ${theme.category}\n- **Slug：** \`${theme.slug}\`\n- **首页重点：** ${theme.homepage ? "是" : "否"}\n- **视频画幅：** ${theme.ratio}\n- **主题创意：** ${theme.concept}\n- **本主题素材数量：** ${entry.assetCount} 张\n\n### 独立素材清单\n\n| 引用 | 类型 | 角色 | 展示文件 | 供应商原图 |\n|---|---|---|---|---|\n${assetLines}\n\n### 素材生成提示词\n\n${promptLines}\n\n### Seedance 2.5 视频提示词\n\n\`\`\`text\n${entry.videoPrompt}\n\`\`\`\n\n### 主题级检查\n\n- 素材均为本主题独立资产，未跨主题复用。\n- 视频提示词仅引用本主题素材。\n- 30 秒时间结构、动作状态、镜头、光源、声音与最终画面已明确。\n- 默认无 BGM；声音仅来自现场环境、动作或画面内人声。\n`;
}

async function buildDocs() {
  const manifest = buildManifest();
  await fs.mkdir(outputRoot, { recursive: true });
  for (const entry of manifest.themes) {
    for (const asset of entry.assets) {
      await fs.mkdir(path.dirname(path.join(outputRoot, asset.displayPath)), { recursive: true });
    }
  }
  await writeJson(manifestPath, manifest);
  const homepageCount = manifest.themes.filter((theme) => theme.homepagePriority).length;
  const totalAssets = manifest.themes.reduce((total, theme) => total + theme.assetCount, 0);
  const markdown = [
    "# Aidreamcapes EU 视频提示词与灵活素材资产包",
    "",
    "> 法语主题标签；英文生图提示词与 Seedance 2.5 视频提示词。每个主题使用独立角色/主体、场景和道具资产。",
    "",
    `- 主题总数：${manifest.themes.length}（首页重点 ${homepageCount} 个）`,
    `- 资产总数：${totalAssets} 张（单主题最多 6 张）`,
    "- 图像供应商：image4 / gpt-image-2",
    "- 视频目标模型：Seedance 2.5，30 秒",
    "- 资产引用：每个主题从 @Image1 开始，仅引用自己的资产",
    "- 付费生成安全：每张素材最多 1 次请求；无自动重试、无供应商 fallback",
    "",
    "## 使用说明",
    "",
    "每个主题章节自包含资产清单、供应商生图提示词和 Seedance 视频提示词。展示文件用于视频参考，`.original.*` 文件为供应商返回的原始文件；不得覆盖原始文件或裁剪改变画幅。",
    "",
    "## 主题章节",
    "",
    ...manifest.themes.map((entry) => sectionForTheme(themes[entry.order - 1], entry))
  ].join("\n");
  await fs.writeFile(path.join(outputRoot, "aidreamcapes-eu-video-prompts.seedance-2.5.md"), `${markdown}\n`, "utf8");
  await fs.writeFile(path.join(outputRoot, "README.zh-CN.md"), `# Aidreamcapes EU 视频提示词与素材包\n\n本目录包含 21 个法语视频主题的 Seedance 2.5 提示词、供应商生图提示词、独立素材、资产清单和质量报告。\n\n视频提示词总文档：\`aidreamcapes-eu-video-prompts.seedance-2.5.md\`。\n\n图像供应商：项目现有 image4 / gpt-image-2。每个主题素材独立生成，供应商原图与展示衍生图分开保存。\n`, "utf8");
  await fs.writeFile(path.join(outputRoot, "qc-report.md"), `# 质量检查报告\n\n- [x] 主题清单：${manifest.themes.length} 个\n- [x] 首页重点：${homepageCount} 个\n- [x] 单主题素材上限：6 张\n- [x] 当前规划素材总数：${totalAssets} 张\n- [x] 每个主题使用独立资产命名空间\n- [x] 视频目标：Seedance 2.5 / 30 秒\n- [x] 付费生成上限：${maxPaidCreates} 次，单素材一次请求\n- [ ] 供应商素材生成：待执行\n- [ ] 原图哈希归档：待执行\n- [ ] 预览图：待执行\n- [ ] 压缩包：待执行\n`, "utf8");
  return manifest;
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  const v1Match = trimmed.match(/^(.*?\/v1)(?:\/.*)?$/);
  return v1Match?.[1] ?? `${trimmed}/v1`;
}

function imageBufferFromBody(body) {
  const encoded = body?.data?.[0]?.b64_json ?? body?.data?.[0]?.image_base64 ?? body?.output?.[0]?.b64_json ?? body?.output?.[0]?.image_base64 ?? body?.image_base64;
  return encoded ? Buffer.from(encoded, "base64") : undefined;
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findUnique({ where: { id: providerId } });
    assert(provider, `${providerId}: provider not found`);
    assert.equal(provider.label, providerLabel);
    assert.equal(provider.modelType, model);
    assert.equal(provider.providerType, "image");
    assert.equal(provider.enabled, true);
    assert(provider.apiKey && provider.aiUrl, "image4 provider missing URL or API key");
    const baseUrl = normalizeBaseUrl(provider.aiUrl);
    return { provider, baseUrl, origin: new URL(baseUrl).origin };
  } finally {
    await prisma.$disconnect();
  }
}

async function downloadProviderUrl(url, origin, apiKey) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, "https:", "provider image URL must use HTTPS");
  assert.equal(parsed.origin, origin, "provider image URL origin mismatch");
  const response = await fetch(parsed, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`provider_image_download_failed:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function createImage(provider, entry, asset) {
  const requestId = `aidreamcapes-eu-video-assets:${entry.slug}:${asset.id}:${crypto.randomUUID()}`;
  const target = requestedSizes[asset.orientation];
  let response;
  try {
    response = await fetch(`${provider.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.provider.apiKey}`,
        "Idempotency-Key": requestId,
        "X-Client-Request-Id": requestId
      },
      body: JSON.stringify({ model, prompt: asset.prompt, size: target.size, quality: String(provider.provider.imageQuality || "high"), n: 1, response_format: "b64_json" })
    });
  } catch (error) {
    throw new Error(`provider_request_failed:${requestId}:${String(error?.message || error)}`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`provider_create_failed:${response.status}:request=${requestId}`);
  const buffer = imageBufferFromBody(body) ?? (body?.data?.[0]?.url ? await downloadProviderUrl(String(body.data[0].url), provider.origin, provider.provider.apiKey) : undefined);
  if (!buffer) throw new Error(`provider_empty_image_payload:request=${requestId}`);
  return { buffer, requestId, providerResponseId: body?.id ?? body?.data?.[0]?.id ?? null, size: target.size, quality: String(provider.provider.imageQuality || "high") };
}

async function writeAssetBundle(entry, asset, result) {
  const dir = path.join(outputRoot, "assets", entry.slug, asset.type);
  await fs.mkdir(dir, { recursive: true });
  const source = sharp(result.buffer).rotate();
  const metadata = await source.metadata();
  assert(metadata.width && metadata.height, `${entry.slug}/${asset.id}: missing provider dimensions`);
  const expectedRatio = asset.orientation === "portrait" ? 9 / 16 : asset.orientation === "square" ? 1 : 16 / 9;
  assert(Math.abs((metadata.width / metadata.height) - expectedRatio) < 0.02, `${entry.slug}/${asset.id}: provider aspect ratio mismatch ${metadata.width}x${metadata.height}`);
  const originalPath = path.join(outputRoot, asset.originalPath);
  const displayPath = path.join(outputRoot, asset.displayPath);
  await fs.mkdir(path.dirname(originalPath), { recursive: true });
  await fs.writeFile(originalPath, result.buffer, { flag: "wx" });
  const displayWidth = requestedSizes[asset.orientation].displayWidth;
  const displayHeight = Math.max(1, Math.round(displayWidth * metadata.height / metadata.width));
  await source.resize(displayWidth, displayHeight, { fit: "inside", withoutEnlargement: false }).jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true }).toFile(displayPath);
  const displayBuffer = await fs.readFile(displayPath);
  return {
    ...asset,
    providerRequestId: result.requestId,
    providerResponseId: result.providerResponseId,
    requestedSize: result.size,
    providerOriginal: { path: asset.originalPath, format: metadata.format, width: metadata.width, height: metadata.height, sha256: sha256(result.buffer) },
    display: { path: asset.displayPath, format: "jpeg", width: displayWidth, height: displayHeight, sha256: sha256(displayBuffer) }
  };
}

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function makePreview(entry) {
  const files = [];
  for (const asset of entry.assets) {
    const file = path.join(outputRoot, asset.displayPath);
    if (await exists(file)) files.push({ asset, file });
  }
  if (!files.length) return null;
  const cellWidth = 360;
  const cellHeight = 260;
  const columns = Math.min(3, files.length);
  const rows = Math.ceil(files.length / columns);
  const composites = [];
  for (let index = 0; index < files.length; index += 1) {
    const thumb = await sharp(files[index].file).resize(cellWidth, cellHeight - 36, { fit: "contain", background: "#111318" }).jpeg({ quality: 88 }).toBuffer();
    const canvas = sharp({ create: { width: cellWidth, height: cellHeight, channels: 3, background: "#111318" } });
    const label = Buffer.from(`<svg width="${cellWidth}" height="36"><rect width="100%" height="100%" fill="#111318"/><text x="12" y="24" fill="#ffffff" font-family="Arial" font-size="14">${files[index].asset.id} · ${files[index].asset.type}</text></svg>`);
    const cell = await canvas.composite([{ input: thumb, top: 0, left: 0 }, { input: label, top: cellHeight - 36, left: 0 }]).jpeg({ quality: 90 }).toBuffer();
    composites.push({ input: cell, top: Math.floor(index / columns) * cellHeight, left: (index % columns) * cellWidth });
  }
  const out = path.join(outputRoot, "previews", `${entry.slug}.jpg`);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await sharp({ create: { width: columns * cellWidth, height: rows * cellHeight, channels: 3, background: "#111318" } }).composite(composites).jpeg({ quality: 90 }).toFile(out);
  return `previews/${entry.slug}.jpg`;
}

async function writeSupplierReport(report) {
  await writeJson(path.join(outputRoot, "supplier-run-report.json"), {
    provider: providerLabel,
    providerId,
    model,
    endpoint: "POST /v1/images/generations",
    attemptsPerCreate: 1,
    automaticRetry: false,
    providerFallback: false,
    maxPaidCreates,
    paidCreatesAttempted: report.length,
    generated: report.filter((item) => item.status === "succeeded").length,
    failed: report.filter((item) => item.status === "failed").length,
    report
  });
}

async function generateAssets(manifest, continueOnError = false, skipFailed = false) {
  const tasks = manifest.themes.flatMap((entry) => entry.assets.map((asset) => ({ entry, asset })));
  assert(tasks.length <= maxPaidCreates, `paid_create_cap_exceeded:${tasks.length}>${maxPaidCreates}`);
  const provider = await loadProvider();
  let previousReport = null;
  try { previousReport = JSON.parse(await fs.readFile(path.join(outputRoot, "supplier-run-report.json"), "utf8")); } catch {}
  const report = Array.isArray(previousReport?.report) ? previousReport.report : [];
  const failedKeys = new Set(report.filter((item) => item.status === "failed").map((item) => `${item.theme}/${item.asset}`));
  let cursor = 0;
  let firstError;
  await writeSupplierReport(report);
  async function worker(workerIndex) {
    while (!firstError) {
      const task = tasks[cursor++];
      if (!task) return;
      const taskKey = `${task.entry.slug}/${task.asset.id}`;
      if (skipFailed && failedKeys.has(taskKey)) {
        if (!report.some((item) => item.theme === task.entry.slug && item.asset === task.asset.id && item.status === "skipped_failed")) {
          report.push({ theme: task.entry.slug, asset: task.asset.id, status: "skipped_failed", reason: "previous_provider_empty_payload_not_retried" });
          await writeSupplierReport(report);
        }
        continue;
      }
      const originalPath = path.join(outputRoot, task.asset.originalPath);
      if (await exists(originalPath)) {
        report.push({ theme: task.entry.slug, asset: task.asset.id, status: "skipped_existing", originalPath: task.asset.originalPath });
        await writeSupplierReport(report);
        continue;
      }
      const startedAt = Date.now();
      try {
        console.log(`supplier create ${task.entry.slug}/${task.asset.id} worker=${workerIndex + 1}/${concurrency}`);
        const result = await createImage(provider, task.entry, task.asset);
        const written = await writeAssetBundle(task.entry, task.asset, result);
        report.push({ theme: task.entry.slug, asset: task.asset.id, status: "succeeded", requestId: result.requestId, providerResponseId: result.providerResponseId, requestedSize: result.size, elapsedMs: Date.now() - startedAt, originalPath: written.providerOriginal.path, displayPath: written.display.path, originalSha256: written.providerOriginal.sha256, displaySha256: written.display.sha256 });
        await writeSupplierReport(report);
      } catch (error) {
        report.push({ theme: task.entry.slug, asset: task.asset.id, status: "failed", elapsedMs: Date.now() - startedAt, error: String(error?.message || error) });
        await writeSupplierReport(report);
        firstError ??= error;
        if (!continueOnError) return;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, (_, index) => worker(index)));
  if (firstError && !continueOnError) throw firstError;
  for (const entry of manifest.themes) await makePreview(entry);
  const qcPath = path.join(outputRoot, "qc-report.md");
  const successes = report.filter((item) => item.status === "succeeded" || item.status === "skipped_existing").length;
  const failures = report.filter((item) => item.status === "failed").length;
  await fs.writeFile(qcPath, `# 质量检查报告\n\n- [x] 主题清单：${manifest.themes.length} 个\n- [x] 首页重点：${manifest.themes.filter((theme) => theme.homepagePriority).length} 个\n- [x] 单主题素材上限：6 张\n- [x] 规划素材总数：${tasks.length} 张\n- [x] 供应商：image4 / gpt-image-2\n- [x] 供应商成功或已存在：${successes} 张\n- [${failures ? " " : "x"}] 供应商失败：${failures} 张\n- [x] 单素材最多一次请求，无自动重试和 fallback\n- [x] 供应商原图与展示衍生图分开保存\n- [x] 每个主题使用独立素材命名空间\n`, "utf8");
  return report;
}

async function zipPack() {
  const zipPath = path.join(outputRoot, "aidreamcapes-eu-video-prompt-pack.zip");
  await fs.rm(zipPath, { force: true });
  await execFileAsync("zip", ["-qr", zipPath, "."], { cwd: outputRoot, maxBuffer: 1024 * 1024 });
  return zipPath;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const manifest = await buildDocs();
  console.log(JSON.stringify({ mode: args.has("--generate") ? "generate" : "build", outputRoot, themes: manifest.themes.length, homepageThemes: manifest.themes.filter((theme) => theme.homepagePriority).length, assets: manifest.themes.reduce((sum, theme) => sum + theme.assetCount, 0), maxPaidCreates, provider: providerLabel, model }, null, 2));
  if (!args.has("--generate")) return;
  assert(args.has("--confirm-paid"), "Paid generation requires --confirm-paid.");
  await generateAssets(manifest, args.has("--continue-on-error"), args.has("--skip-failed"));
  const zipPath = await zipPack();
  console.log(JSON.stringify({ ok: true, zipPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
