#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const APPLY = process.argv.includes("--apply");
const SITE_ID = "site_mydreamshoots_xby";
const PROVIDER_LABEL = "buming-image";
const MODEL = "gpt-image-2";
const REQUEST_SIZE = "1536x1024";
const QUALITY = "high";
const TARGET_WIDTH = 3840;
const GENERATION_CONCURRENCY = 3;
const BATCH_ID = "save-the-date-themes-vendor-no-crop-20260915-v1";
const PRICE_PER_REQUEST_USD = 0.0075;
const REPORT_PATH = path.resolve(`releases/provider-results/aidreamshoots/save-the-date/${BATCH_ID}.json`);

const commonPromptRules = [
  "one original editorial photograph for a Spanish AI Save the Date theme page",
  "landscape 3:2 composition",
  "natural photographic detail, believable anatomy, clean lighting, polished but human editorial styling",
  "keep every relevant person, object, and important detail completely inside the frame; do not crop the scene at the frame edges",
  "no collage, split screen, mockup, screenshot, UI, border, watermark, brand mark, logo, or readable text",
  "if paper, cards, signs, screens, or invitations appear, keep them blank or use only indistinguishable abstract marks",
  "create the complete original image in this aspect ratio; do not provide a cropped close-up"
].join("; ");

const themes = [
  {
    key: "engagement",
    publicPath: "/ai-save-the-date/engagement",
    sourcePath: "/ai-save-the-date/engagement",
    folder: "engagement",
    label: "Compromiso",
    keyword: "fotos y vídeos de compromiso con IA",
    scenes: [
      ["engaged-couple-garden-portrait", "An engaged adult couple smiling together in a lush flower garden at golden hour, elegant but relaxed outfits.", "Pareja comprometida posando junta en un jardín de flores durante la hora dorada."],
      ["engagement-ring-city-balcony", "An engaged adult couple showing a sparkling engagement ring together on a city balcony at sunset, skyline softly behind them.", "Pareja comprometida mostrando un anillo de compromiso en un balcón con vistas a la ciudad."],
      ["engaged-couple-waterfront-embrace", "An engaged adult couple embracing beside calm waterfront at blue hour, soft city lights and reflections in the distance.", "Pareja comprometida abrazándose junto al agua al anochecer con luces de la ciudad al fondo."],
      ["engagement-picnic-portrait", "An engaged adult couple sharing an intimate picnic on a meadow, a small bouquet and neutral picnic blanket, warm natural light.", "Pareja comprometida disfrutando de un picnic romántico en un prado con un pequeño ramo."],
      ["engagement-couple-coastal-walk", "An engaged adult couple walking hand in hand along a quiet coastal path, ocean horizon and soft morning light.", "Pareja comprometida caminando de la mano por un sendero costero frente al mar."],
      ["engagement-ring-hands-detail", "A tasteful complete still-life of two adult hands resting together with a clear engagement ring, linen fabric and delicate flowers, no cropped fingers at the edges.", "Manos entrelazadas de una pareja con un anillo de compromiso sobre lino y flores delicadas."],
      ["engagement-rooftop-toast", "An engaged adult couple making a gentle champagne toast on a rooftop terrace at twilight, both faces and glasses fully visible.", "Pareja comprometida brindando con champán en una terraza durante el crepúsculo."],
      ["engagement-home-planning", "An engaged adult couple planning their celebration together at a bright home table with blank stationery, a laptop with an abstract blank screen, and flowers.", "Pareja comprometida planificando su celebración en casa con papelería y flores."],
      ["engagement-forest-embrace", "An engaged adult couple embracing on a forest trail in autumn, soft amber leaves and gentle overcast light.", "Pareja comprometida abrazándose en un sendero otoñal rodeado de hojas doradas."],
      ["engagement-beach-sunset-portrait", "An engaged adult couple standing together on a wide beach at sunset, full bodies inside the frame, pastel sky and calm waves.", "Pareja comprometida posando en una playa amplia al atardecer con el mar en calma."],
      ["engagement-celebration-friends", "An engaged adult couple celebrating with a small group of adult friends in a warmly lit garden, joyful but natural candid moment.", "Pareja comprometida celebrando su compromiso con amigos adultos en un jardín iluminado."]
    ]
  },
  {
    key: "proposal",
    publicPath: "/ai-save-the-date/proposal",
    sourcePath: "/ai-save-the-date/proposal",
    folder: "proposal",
    label: "Propuesta",
    keyword: "fotos y vídeos de propuesta con IA",
    scenes: [
      ["proposal-rooftop-surprise-night", "An adult man surprising an adult woman with a proposal on a city rooftop at night, warm string lights, both full faces and hands visible.", "Pareja viviendo una propuesta sorpresa en una azotea iluminada de noche."],
      ["proposal-floral-arch-twilight", "An adult couple at a romantic proposal beneath a floral arch at twilight, the ring moment clearly visible and both people fully framed.", "Pareja celebrando una propuesta bajo un arco floral durante el crepúsculo."],
      ["proposal-beach-sunset", "An adult man kneeling to propose to an adult woman on a quiet beach at sunset, complete figures, ring, shoreline, and sky fully contained.", "Propuesta de matrimonio en la playa al atardecer con la pareja y el anillo visibles."],
      ["proposal-video-recording", "An adult friend discreetly recording a proposal scene on a smartphone from a respectful distance in a garden, no readable screen content.", "Persona grabando una propuesta de matrimonio con un teléfono en un jardín."],
      ["proposal-garden-walk-after-yes", "An adult newly engaged couple walking hand in hand through a flower garden after saying yes, relaxed smiles and natural full-body framing.", "Pareja recién comprometida caminando por un jardín después de aceptar la propuesta."],
      ["proposal-ring-closeup", "A complete editorial still-life of an engagement ring resting in an open velvet ring box beside soft flowers, the whole box fully inside the frame.", "Anillo de compromiso en una caja de terciopelo junto a flores suaves."],
      ["proposal-city-rooftop-candlelight", "An adult couple celebrating a proposal at a candlelit city rooftop table, warm skyline bokeh, both faces and hands clearly visible.", "Pareja celebrando una propuesta en una mesa con velas y vistas urbanas."],
      ["proposal-memory-photos-planning", "An adult couple arranging printed memory photographs and planning a proposal story at a home table, blank backs and no readable writing.", "Pareja organizando fotografías de recuerdos para preparar una historia de propuesta."],
      ["proposal-after-yes-embrace", "An adult couple sharing an emotional embrace immediately after a successful proposal in a softly lit garden, complete faces and upper bodies visible.", "Pareja abrazándose con emoción después de una propuesta aceptada."],
      ["proposal-rooftop-couple-after-yes", "An adult newly engaged couple standing together on a rooftop after the proposal, city lights, relaxed joy, and the ring subtly visible.", "Pareja recién comprometida celebrando en una azotea con la ciudad iluminada."]
    ]
  },
  {
    key: "save-the-date",
    publicPath: "/ai-save-the-date/save-the-date",
    sourcePath: "/ai-save-the-date/save-the-date",
    folder: "save-the-date",
    label: "Guardar la fecha",
    keyword: "fotos y vídeos para guardar la fecha con IA",
    scenes: [
      ["save-the-date-couple-sunset", "An adult couple embracing at sunset on a quiet overlook, elegant wedding-adjacent styling and open sky around them.", "Pareja abrazándose al atardecer para anunciar su fecha de boda."],
      ["save-the-date-video-announcement", "An adult couple recording a personal Save the Date announcement outdoors at golden hour with a blank, non-readable card held naturally.", "Pareja grabando un anuncio de guardar la fecha al aire libre durante la hora dorada."],
      ["save-the-date-garden-portrait", "An adult couple posing in a flower garden for an elegant wedding date announcement, full faces and upper bodies comfortably framed.", "Pareja posando en un jardín de flores para anunciar la fecha de boda."],
      ["save-the-date-outdoor-video-shoot", "An adult couple being filmed by a small camera setup outdoors for a Save the Date video, all equipment and people fully inside the scene.", "Pareja siendo grabada al aire libre para crear un vídeo de guardar la fecha."],
      ["save-the-date-romantic-beach-walk", "An adult couple holding hands during a romantic beach walk at sunset, shoreline, footprints, and complete bodies visible.", "Pareja caminando de la mano por la playa al atardecer para su anuncio de boda."],
      ["save-the-date-couple-ring-announcement", "An adult couple showing an engagement ring together in a warm outdoor portrait, ring and both faces clearly visible.", "Pareja mostrando un anillo de compromiso en un retrato para anunciar su boda."],
      ["save-the-date-planning-together", "An adult couple reviewing wedding plans together at a bright home table with blank stationery, laptop, and soft flowers.", "Pareja planificando su anuncio de guardar la fecha junto a papelería y un portátil."],
      ["save-the-date-ring-detail", "A complete editorial detail of intertwined adult hands and an engagement ring resting above neutral wedding stationery, no readable text and no cropped fingers.", "Manos entrelazadas y anillo de compromiso sobre papelería de boda sin texto legible."],
      ["save-the-date-proposal-memory", "An adult couple revisiting a proposal memory beside calm water at sunset, natural embrace and complete figures within the landscape frame.", "Pareja recordando su propuesta junto al agua durante una puesta de sol."],
      ["save-the-date-destination-beach-portrait", "An adult couple embracing on a bright destination beach for a wedding date announcement, full bodies, horizon, and gentle waves visible.", "Pareja abrazándose en una playa de destino para anunciar su fecha de boda."],
      ["save-the-date-couple-city-walk", "An adult couple walking through a charming city street for a personal Save the Date story, complete figures and warm evening light.", "Pareja caminando por una calle de la ciudad para su historia de guardar la fecha."]
    ]
  },
  {
    key: "wedding-invitation",
    publicPath: "/ai-save-the-date/wedding-invitation",
    sourcePath: "/ai-video-generation/wedding-invitation",
    folder: "wedding-invitation",
    label: "Invitación de boda",
    keyword: "invitaciones de boda con IA",
    scenes: [
      ["wedding-invitation-couple-reviewing", "An adult bride and groom reviewing a blank wedding invitation suite together at a candlelit reception table, both faces and stationery fully visible.", "Pareja revisando una invitación de boda sobre una mesa iluminada con velas."],
      ["wedding-invitation-luxury-stationery", "A complete luxury ivory wedding invitation suite with satin ribbon, wax seal, flowers, and engagement ring arranged as a refined flat lay, no readable text.", "Papelería de invitación de boda en marfil con cinta, sello de cera, flores y anillo."],
      ["wedding-invitation-garden-couple", "An adult couple holding a blank floral wedding invitation together in a garden at golden hour, faces, hands, and card fully visible.", "Pareja sosteniendo una invitación floral de boda en un jardín durante la hora dorada."],
      ["wedding-invitation-card-closeup", "A complete close editorial composition of adult hands holding a blank ivory floral wedding invitation and matching envelope beside roses and candlelight, no cropped fingers.", "Manos sosteniendo una invitación floral de boda y un sobre junto a rosas y velas."],
      ["wedding-invitation-design-selection", "An adult couple comparing blank wedding invitation paper, color swatches, and design options at a table with a laptop showing an abstract blank screen.", "Pareja comparando diseños y colores de invitaciones de boda en una mesa."],
      ["wedding-invitation-reception-table", "A blank ivory wedding invitation and sealed envelope displayed on a candlelit reception table with blush flowers, complete stationery suite visible.", "Invitación de boda y sobre sellado sobre una mesa de recepción con velas y flores."],
      ["wedding-invitation-bridesmaid-review", "An adult bride showing a blank floral wedding invitation to an adult bridesmaid in a bright room filled with flowers, both people fully framed.", "Novia mostrando una invitación floral de boda a una dama de honor."],
      ["wedding-invitation-digital-share", "An adult hand sharing a blank digital wedding invitation from a smartphone at an elegant wedding table setting, no readable screen content.", "Mano compartiendo una invitación digital de boda desde un teléfono móvil."],
      ["wedding-invitation-venue-display", "A blank floral wedding invitation displayed on a wooden easel inside a candlelit reception venue, flowers and surrounding setting fully visible.", "Invitación floral de boda en un caballete dentro de un espacio de recepción iluminado."],
      ["wedding-invitation-envelope-prep", "An adult bride and groom preparing blank wax-sealed wedding invitation envelopes with ribbon, flowers, stamps, and stationery, all hands and materials fully contained.", "Pareja preparando sobres de invitación de boda con cinta, flores y sellos de cera."]
    ]
  },
  {
    key: "wedding-ceremony",
    publicPath: "/ai-save-the-date/wedding-ceremony",
    sourcePath: "/ai-save-the-date/wedding-ceremony",
    folder: "wedding-ceremony",
    label: "Ceremonia de boda",
    keyword: "fotos y vídeos de ceremonia de boda con IA",
    scenes: [
      ["wedding-ceremony-recessional", "An adult newlywed couple walking down the aisle after the ceremony while guests celebrate, complete aisle and people visible.", "Pareja recién casada saliendo por el pasillo mientras los invitados celebran."],
      ["wedding-ceremony-church-atmosphere", "A wide elegant wedding ceremony inside a decorated church with the adult couple near the altar, architecture and guests fully visible.", "Ceremonia de boda en una iglesia decorada con la pareja junto al altar."],
      ["wedding-ceremony-ring-exchange", "An adult couple exchanging wedding rings during a ceremony, both hands, faces, officiant, and floral altar fully visible.", "Pareja intercambiando anillos durante una ceremonia de boda junto al altar floral."],
      ["wedding-ceremony-vows", "An adult couple exchanging vows at a bright wedding ceremony, both faces, hands, officiant, and surrounding flowers comfortably framed.", "Pareja intercambiando votos durante una ceremonia de boda rodeada de flores."],
      ["wedding-ceremony-beach-processional", "An adult bride walking with an adult companion toward a beach ceremony altar, wide shoreline, guests, and complete figures visible.", "Novia caminando hacia un altar de boda en la playa con los invitados al fondo."],
      ["wedding-ceremony-guests-reaction", "Adult wedding guests reacting with joyful emotion during a ceremony, decorated aisle and altar softly visible behind them.", "Invitados emocionados observando una ceremonia de boda en un espacio decorado."],
      ["wedding-ceremony-bouquet-detail", "A complete bridal bouquet of white and blush flowers with wedding rings on a silk ribbon beside it, full arrangement inside the frame.", "Ramo de novia con flores blancas y rosadas junto a los anillos de boda."],
      ["wedding-ceremony-bride-aisle", "An adult bride walking down a flower-lined wedding aisle with an adult parent, guests and full figures visible in a warm ceremony setting.", "Novia caminando por un pasillo floral junto a un familiar antes de la ceremonia."],
      ["wedding-ceremony-officiant-wide", "A wide adult wedding officiant leading a ceremony with the couple and guests visible in a balanced chapel composition.", "Oficiante dirigiendo una ceremonia de boda con la pareja y los invitados visibles."],
      ["wedding-ceremony-first-kiss", "An adult newlywed couple sharing their first kiss beneath a floral wedding arch, full upper bodies, altar, and guests visible.", "Pareja recién casada compartiendo su primer beso bajo un arco floral."],
      ["wedding-ceremony-venue-setup", "A complete elegant wedding ceremony venue prepared with aisle chairs, floral altar, candles, and warm ambient light, no people cropped at the edges.", "Espacio preparado para una ceremonia de boda con sillas, flores, velas y altar."]
    ]
  },
  {
    key: "christmas",
    publicPath: "/ai-save-the-date/christmas",
    sourcePath: "/ai-save-the-date/christmas",
    folder: "christmas",
    label: "Navidad",
    keyword: "fotos y vídeos de Navidad con IA",
    scenes: [
      ["christmas-family-gift", "A joyful adult family opening wrapped Christmas gifts beside a decorated tree in a warm living room, all family members fully visible.", "Familia celebrando la Navidad junto al árbol mientras abre regalos."],
      ["christmas-snowy-cabin", "An adult couple outside a cozy snowy cabin decorated with warm Christmas lights, complete figures, pine trees, and gentle snowfall visible.", "Pareja frente a una cabaña nevada decorada con luces navideñas."],
      ["christmas-santa-lantern", "A festive winter still-life with a red Santa hat, lantern, pine branches, and warm fairy lights on a wooden table, complete arrangement visible.", "Decoración navideña con gorro de Santa, farol, ramas de pino y luces cálidas."],
      ["christmas-photo-capture", "Adult hands photographing a decorated Christmas tree and fireplace with a smartphone, full hands and room context visible, no readable screen content.", "Manos fotografiando un árbol de Navidad decorado junto a una chimenea."],
      ["christmas-gift-wrapping", "An adult wrapping Christmas gifts with kraft paper, ribbon, and evergreen branches at a bright table, full materials and hands inside the frame.", "Persona envolviendo regalos de Navidad con papel, cintas y ramas de pino."],
      ["christmas-couple-market-lights", "An adult couple walking through a Christmas market beneath glowing lights, complete figures, festive stalls, and evening atmosphere visible.", "Pareja paseando por un mercado navideño iluminado durante la noche."],
      ["christmas-kids-baking-cookies", "Children baking Christmas cookies with an adult in a cozy kitchen, complete people, mixing bowls, and festive decorations visible.", "Niños preparando galletas de Navidad con un adulto en una cocina acogedora."],
      ["christmas-living-room-fireplace", "A complete cozy Christmas living room with a decorated tree, fireplace, stockings, wrapped gifts, and warm candlelight.", "Salón acogedor decorado para Navidad con árbol, chimenea, calcetines y regalos."],
      ["christmas-friends-selfie", "A group of adult friends taking a joyful Christmas selfie beside a decorated tree, all faces and phone held fully inside the frame, no readable screen.", "Grupo de amigos adultos tomándose un selfie navideño junto al árbol."],
      ["christmas-cozy-cocoa-portrait", "An adult person enjoying hot cocoa beside a Christmas tree and window with soft winter light, complete portrait and cup visible.", "Persona disfrutando de chocolate caliente junto a un árbol de Navidad."],
      ["christmas-dog-santa-hat", "A friendly dog wearing a simple Santa hat sitting beside a decorated Christmas tree and wrapped gifts, entire dog fully visible.", "Perro con gorro de Santa junto al árbol de Navidad y regalos envueltos."]
    ]
  },
  {
    key: "halloween",
    publicPath: "/ai-save-the-date/halloween",
    sourcePath: "/ai-save-the-date/halloween",
    folder: "halloween",
    label: "Halloween",
    keyword: "fotos y vídeos de Halloween con IA",
    scenes: [
      ["halloween-costume-party", "A group of adults in creative Halloween costumes celebrating at a warmly lit costume party, complete bodies, pumpkins, and decorations visible.", "Grupo de adultos con disfraces celebrando una fiesta de Halloween decorada con calabazas."],
      ["halloween-couple-cosplay", "An adult couple in elegant Halloween costumes posing together under orange and purple lights, both faces and full upper bodies visible.", "Pareja adulta posando con disfraces de Halloween bajo luces naranjas y moradas."],
      ["halloween-ghost-dog", "A friendly dog wearing a playful white ghost costume beside carved pumpkins on a porch, entire dog and decorations fully visible.", "Perro con un disfraz de fantasma junto a calabazas talladas en un porche."],
      ["halloween-pumpkin-portrait", "An adult person holding a carved pumpkin during a golden autumn evening, complete face, hands, pumpkin, and soft leaves visible.", "Persona sosteniendo una calabaza tallada durante una tarde de otoño."],
      ["halloween-neon-party-costumes", "Adults in colorful Halloween costumes dancing at a neon-lit party, full figures and playful decorations contained in the landscape frame.", "Personas adultas bailando con disfraces en una fiesta de Halloween con luces de neón."],
      ["halloween-bat-costume-child", "A child in a black bat costume sitting safely among pumpkins and hay at an autumn festival, complete child and seasonal setting visible.", "Niño con disfraz de murciélago sentado entre calabazas y paja en un festival otoñal."],
      ["halloween-vampire-dog", "A friendly dog wearing a tasteful vampire cape beside autumn pumpkins and warm porch lights, entire dog fully visible.", "Perro con capa de vampiro junto a calabazas y luces cálidas de otoño."],
      ["halloween-haunted-house-night", "A complete atmospheric haunted house at night with moonlight, bare trees, pumpkins, and a clear path, no cropped architecture.", "Casa encantada iluminada por la luna con calabazas y árboles desnudos."],
      ["halloween-pumpkin-wagon-night", "A wooden wagon filled with pumpkins under warm lanterns at a fall Halloween gathering, full wagon and decorations visible.", "Carro de madera lleno de calabazas bajo faroles en una celebración de Halloween."],
      ["halloween-trick-or-treat-vintage", "Adults and children in costumes walking safely along a warmly lit neighborhood street for trick-or-treating, complete figures and homes visible.", "Familias con disfraces recorriendo un vecindario iluminado durante Halloween."],
      ["halloween-baby-skeleton-costumes", "Two babies in gentle skeleton-themed Halloween onesies resting safely on a soft autumn blanket with pumpkins nearby, complete babies and setting visible.", "Dos bebés con pijamas inspirados en esqueletos junto a pequeñas calabazas de Halloween."]
    ]
  },
  {
    key: "thanksgiving",
    publicPath: "/ai-save-the-date/thanksgiving",
    sourcePath: "/ai-save-the-date/thanksgiving",
    folder: "thanksgiving",
    label: "Acción de Gracias",
    keyword: "fotos y vídeos de Acción de Gracias con IA",
    scenes: [
      ["thanksgiving-family-dinner", "An adult family gathered around a Thanksgiving dinner table with autumn flowers and warm candlelight, all people and table fully visible.", "Familia reunida alrededor de una mesa decorada para la cena de Acción de Gracias."],
      ["thanksgiving-kids-pumpkins", "Children and an adult arranging pumpkins and autumn leaves on a porch for Thanksgiving, complete people and seasonal setting visible.", "Niños decorando un porche con calabazas y hojas de otoño para Acción de Gracias."],
      ["thanksgiving-greeting-card", "A complete Thanksgiving still-life with blank cream greeting card, pumpkins, autumn leaves, and warm linen, no readable writing.", "Tarjeta de saludo de Acción de Gracias sin texto junto a calabazas y hojas otoñales."],
      ["thanksgiving-family-cooking", "An adult family cooking together in a bright kitchen for Thanksgiving, complete people, vegetables, and serving dishes visible.", "Familia cocinando junta en una cocina luminosa para la celebración de Acción de Gracias."],
      ["thanksgiving-table-photo", "Adult hands photographing a richly set Thanksgiving table with autumn centerpieces, full hands and table context visible, no readable screen.", "Manos fotografiando una mesa decorada con comida y centros de mesa otoñales."],
      ["thanksgiving-harvest-decor", "A complete autumn harvest arrangement with pumpkins, wheat, apples, linen, and warm neutral light on a wooden table.", "Decoración de cosecha otoñal con calabazas, trigo, manzanas y lino."],
      ["thanksgiving-friendsgiving-toast", "A group of adult friends making a warm toast at a Friendsgiving table, complete faces, glasses, food, and autumn décor visible.", "Amigos adultos brindando juntos en una mesa de Friendsgiving decorada para otoño."],
      ["thanksgiving-home-decor", "A complete cozy home decorated for Thanksgiving with a mantel, autumn wreath, candles, pumpkins, and warm evening light.", "Interior acogedor decorado para Acción de Gracias con corona otoñal, velas y calabazas."],
      ["thanksgiving-dog-porch", "A friendly dog sitting on a porch beside pumpkins, a plaid blanket, and autumn foliage, entire dog and seasonal setting visible.", "Perro sentado en un porche junto a calabazas y hojas de otoño."],
      ["thanksgiving-family-autumn-walk", "An adult family walking together through autumn trees on Thanksgiving, complete figures, leaves, and soft afternoon light visible.", "Familia caminando entre árboles otoñales durante la celebración de Acción de Gracias."],
      ["thanksgiving-turkey-feast", "A complete Thanksgiving feast on a long table with roast turkey, seasonal side dishes, candles, and autumn flowers, no people cropped.", "Banquete de Acción de Gracias con pavo asado, guarniciones, velas y flores otoñales."]
    ]
  },
  {
    key: "new-year",
    publicPath: "/ai-save-the-date/new-year",
    sourcePath: "/ai-save-the-date/new-year",
    folder: "new-year",
    label: "Año Nuevo",
    keyword: "fotos y vídeos de Año Nuevo con IA",
    scenes: [
      ["new-year-city-fireworks", "A wide city skyline at midnight with brilliant New Year fireworks above the buildings, complete skyline and sky visible.", "Fuegos artificiales de Año Nuevo sobre un horizonte urbano iluminado a medianoche."],
      ["new-year-party-sparklers", "A group of adults celebrating New Year with sparklers at an elegant outdoor party, all faces, hands, and lights fully visible.", "Grupo de adultos celebrando el Año Nuevo con bengalas en una fiesta al aire libre."],
      ["new-year-family-celebration", "An adult family celebrating New Year together in a warmly decorated living room, complete people, balloons, and soft lights visible.", "Familia celebrando el Año Nuevo junta en un salón decorado con luces."],
      ["new-year-goals-planning", "An adult person planning new-year goals at a bright desk with blank notebook pages, pen, coffee, and a small plant, no readable writing.", "Persona planificando sus objetivos de Año Nuevo con un cuaderno sin texto legible."],
      ["new-year-cozy-morning", "A cozy winter morning with hot drink, candlelight, soft blanket, and subtle New Year decorations on a complete tabletop scene.", "Mañana de invierno acogedora con bebida caliente, velas y decoración de Año Nuevo."],
      ["new-year-city-countdown-crowd", "Adults gathered safely in a city square for a New Year countdown, complete crowd, illuminated buildings, and festive atmosphere visible.", "Multitud celebrando la cuenta atrás de Año Nuevo en una plaza urbana iluminada."],
      ["new-year-sparkler-closeup", "A complete close editorial composition of adult hands holding a glowing sparkler with soft night bokeh, no cropped hands at the edges.", "Manos sosteniendo una bengala encendida con luces desenfocadas de Año Nuevo."],
      ["new-year-greeting-card-flatlay", "A complete flat lay of a blank New Year greeting card, metallic confetti, ribbon, stars, and winter branches, no readable text.", "Tarjeta de saludo de Año Nuevo sin texto rodeada de confeti y ramas de invierno."],
      ["new-year-champagne-toast", "Adult hands making a champagne toast at an elegant New Year table with complete glasses, bubbles, candles, and festive décor.", "Copas de champán brindando en una mesa elegante de Año Nuevo."],
      ["new-year-friends-countdown", "A group of adult friends counting down to New Year together on a rooftop, complete faces and upper bodies, skyline and lights visible.", "Grupo de amigos adultos haciendo la cuenta atrás de Año Nuevo en una azotea."],
      ["new-year-new-beginnings", "An adult couple walking into a bright sunrise landscape symbolizing new beginnings, complete figures, open sky, and gentle optimism.", "Pareja caminando hacia un paisaje iluminado al amanecer como símbolo de nuevos comienzos."]
    ]
  },
  {
    key: "mothers-day",
    publicPath: "/ai-save-the-date/mothers-day",
    sourcePath: "/ai-save-the-date/mothers-day",
    folder: "mothers-day",
    label: "Día de la Madre",
    keyword: "fotos y vídeos del Día de la Madre con IA",
    scenes: [
      ["mothers-day-family-breakfast", "An adult mother and family sharing a cheerful Mother's Day breakfast at a bright table with flowers, complete people and meal visible.", "Madre y familia compartiendo un desayuno del Día de la Madre con flores."],
      ["mothers-day-garden-portrait", "An adult mother posing with adult family members in a spring garden full of flowers, complete faces and upper bodies visible.", "Madre posando con su familia adulta en un jardín primaveral lleno de flores."],
      ["mothers-day-gift-breakfast", "An adult child presenting a wrapped Mother's Day gift to an adult mother at breakfast, both faces, hands, gift, and table fully visible.", "Hijo entregando un regalo del Día de la Madre durante un desayuno familiar."],
      ["mothers-day-spring-walk", "An adult mother and adult child walking together through a flowering spring park, complete figures and soft daylight visible.", "Madre e hijo paseando juntos por un parque primaveral en flor."],
      ["mothers-day-family-toast", "An adult family making a warm toast to their mother at a Mother's Day table, complete faces, glasses, and flowers visible.", "Familia brindando por su madre alrededor de una mesa del Día de la Madre."],
      ["mothers-day-gift-still-life", "A complete Mother's Day still-life with wrapped gift, pink flowers, ribbon, and a blank card on a linen table, no readable text.", "Regalo del Día de la Madre con flores rosadas, cinta y tarjeta sin texto."],
      ["mothers-day-brunch-table", "A complete spring brunch table prepared for Mother's Day with pastries, fruit, flowers, cups, and soft natural light.", "Mesa de brunch del Día de la Madre con pasteles, fruta y flores primaverales."],
      ["mothers-day-phone-photo", "An adult hand holding a smartphone to capture a happy mother and adult daughter at a Mother's Day breakfast, no readable screen content.", "Mano fotografiando a madre e hija durante un desayuno del Día de la Madre."],
      ["mothers-day-family-baking", "An adult mother baking with adult family members in a bright kitchen for Mother's Day, complete people, bowls, and baked goods visible.", "Madre cocinando con su familia en una cocina luminosa por el Día de la Madre."],
      ["mothers-day-cozy-living-room", "An adult mother relaxing with family in a cozy living room filled with spring flowers and warm afternoon light, complete people visible.", "Madre relajándose con su familia en un salón acogedor decorado con flores."],
      ["mothers-day-pet-portrait", "An adult mother sitting with a friendly pet in a spring garden portrait, complete person, animal, flowers, and soft light visible.", "Madre posando con su mascota en un jardín primaveral lleno de flores."]
    ]
  },
  {
    key: "fathers-day",
    publicPath: "/ai-save-the-date/fathers-day",
    sourcePath: "/ai-save-the-date/fathers-day",
    folder: "fathers-day",
    label: "Día del Padre",
    keyword: "fotos y vídeos del Día del Padre con IA",
    scenes: [
      ["fathers-day-family-portrait", "An adult father posing with adult family members outdoors for Father's Day, complete faces, bodies, and natural greenery visible.", "Padre posando con su familia al aire libre por el Día del Padre."],
      ["fathers-day-sunset-laugh", "An adult father laughing with an adult child at sunset in a park, complete figures and warm sky visible.", "Padre y su hijo riendo juntos en un parque durante la puesta de sol."],
      ["fathers-day-gift-moment", "An adult child giving a wrapped Father's Day gift to an adult father in a bright home, both faces, hands, and gift fully visible.", "Hijo entregando un regalo del Día del Padre a su padre en casa."],
      ["fathers-day-family-dinner-toast", "An adult family making a warm toast to their father around a Father's Day dinner table, complete people, glasses, and meal visible.", "Familia brindando por su padre alrededor de una mesa del Día del Padre."],
      ["fathers-day-woodworking-bond", "An adult father and adult child working together on a safe woodworking project in a bright workshop, complete people and tools visible.", "Padre e hijo trabajando juntos en un proyecto de carpintería en un taller."],
      ["fathers-day-lakeside-fishing", "An adult father and adult child enjoying a peaceful fishing moment beside a lake, complete figures, rods, water, and trees visible.", "Padre e hijo pescando juntos junto a un lago tranquilo."],
      ["fathers-day-baking-together", "An adult father baking with an adult child in a bright kitchen, complete people, mixing bowl, and finished treats visible.", "Padre e hijo preparando dulces juntos en una cocina luminosa."],
      ["fathers-day-picnic-park", "An adult father enjoying a relaxed Father's Day picnic with adult family members in a green park, complete people and blanket visible.", "Padre disfrutando de un picnic del Día del Padre con su familia en el parque."],
      ["fathers-day-gift-flatlay", "A complete Father's Day flat lay with a wrapped gift, leather wallet, watch, handwritten-free blank card, and wood texture.", "Regalo del Día del Padre con reloj, cartera y tarjeta sin texto sobre madera."],
      ["fathers-day-emotional-card", "An adult father reading a blank Father's Day card with a warm emotional smile at home, complete face, hands, and card visible.", "Padre leyendo una tarjeta sin texto del Día del Padre con una sonrisa emotiva."],
      ["fathers-day-backyard-bbq", "An adult family celebrating Father's Day with a relaxed backyard barbecue dinner, complete people, grill, table, and garden visible.", "Familia celebrando el Día del Padre con una barbacoa en el jardín."]
    ]
  }
].map((theme) => ({
  ...theme,
  scenes: theme.scenes.map(([file, visual, alt], index) => ({ file, visual, alt, index }))
}));

const pagePaths = new Set(themes.map((theme) => theme.sourcePath));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeUrl(value) {
  return typeof value === "string" ? value.split("?")[0].split("#")[0] : "";
}

function imageUrl(value) {
  return typeof value === "string" && /\.(?:avif|jpe?g|png|webp)(?:[?#]|$)/i.test(value) ? value : "";
}

function walk(value, callback) {
  if (Array.isArray(value)) return value.forEach((child) => walk(child, callback));
  if (!value || typeof value !== "object") return;
  callback(value);
  Object.values(value).forEach((child) => walk(child, callback));
}

function collectImageRefs(...jsonValues) {
  const refs = [];
  const seen = new Set();
  const add = (value) => {
    const normalized = normalizeUrl(value);
    if (!imageUrl(normalized) || seen.has(normalized)) return;
    seen.add(normalized);
    refs.push(normalized);
  };
  for (const json of jsonValues) {
    walk(json, (object) => {
      if (typeof object.imageUrl === "string") add(object.imageUrl);
      if (typeof object.src === "string") add(object.src);
      if (typeof object.url === "string") add(object.url);
      if (Array.isArray(object.galleryImages)) object.galleryImages.forEach(add);
      if (Array.isArray(object.mediaManifest)) {
        object.mediaManifest.forEach((item) => add(item?.src || item?.originalUrl || item?.originalSrc));
      }
    });
  }
  return refs;
}

function providerBaseUrl(value) {
  const base = String(value || "").trim().replace(/\/+$/, "");
  return base.endsWith("/v1") ? base : `${base}/v1`;
}

function imagePayload(body) {
  return body?.data?.[0]?.b64_json
    ?? body?.data?.[0]?.image_base64
    ?? body?.output?.[0]?.b64_json
    ?? body?.output?.[0]?.image_base64
    ?? body?.image_base64;
}

function imageUrlFromResponse(body) {
  return body?.data?.[0]?.url
    ?? body?.data?.[0]?.image_url
    ?? body?.output?.[0]?.url
    ?? body?.output?.[0]?.image_url
    ?? body?.url
    ?? body?.image_url;
}

async function responseImageBuffer(body) {
  const encoded = imagePayload(body);
  if (encoded) return Buffer.from(encoded, "base64");
  const url = imageUrlFromResponse(body);
  if (!url) throw new Error("provider_response_missing_image");
  const response = await fetch(String(url), { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`provider_image_download_failed:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function extensionFor(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "jpg";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  throw new Error("provider_response_unknown_image_format");
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function displayName(theme, scene) {
  return `${theme.key}-${String(scene.index + 1).padStart(2, "0")}-${scene.file}.jpg`;
}

function sceneForSource(theme, sourceUrl, fallbackIndex) {
  const filename = path.basename(sourceUrl).toLowerCase();
  const matched = theme.scenes.find((scene) => filename.includes(scene.file.toLowerCase()));
  if (matched) return matched;
  if (theme.key === "engagement") return theme.scenes[fallbackIndex];
  throw new Error(`scene_source_mapping_missing:${theme.sourcePath}:${filename}`);
}

function buildPrompt(theme, scene) {
  return `Theme: ${theme.label}. Search intent: ${theme.keyword}. Scene: ${scene.visual} ${commonPromptRules}.`;
}

async function writeNoCrop4k(buffer, outputPath) {
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();
  assert(metadata.width && metadata.height, "provider image dimensions are unavailable");
  const height = Math.max(1, Math.round(TARGET_WIDTH * metadata.height / metadata.width));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await image
    .resize(TARGET_WIDTH, height, { fit: "fill", withoutEnlargement: false })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(outputPath);
  return { width: TARGET_WIDTH, height, sourceWidth: metadata.width, sourceHeight: metadata.height };
}

async function existingFileWithExtension(basePath, displayFilename) {
  for (const extension of ["jpg", "png", "webp"]) {
    const candidate = path.join(basePath, "originals", displayFilename.replace(/\.jpg$/i, `.${extension}`));
    try {
      await fs.access(candidate);
      return { path: candidate, extension };
    } catch {
      // Try the next known provider response format.
    }
  }
  return undefined;
}

function patchPageJson(value, assetsBySourceUrl) {
  if (typeof value === "string") {
    const asset = assetsBySourceUrl.get(normalizeUrl(value));
    return asset ? asset.displayUrl : value;
  }
  if (Array.isArray(value)) return value.map((item) => patchPageJson(item, assetsBySourceUrl));
  if (!value || typeof value !== "object") return value;
  const source = normalizeUrl(value.imageUrl || value.src || value.url);
  const asset = assetsBySourceUrl.get(source);
  const next = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, patchPageJson(child, assetsBySourceUrl)]));
  if (!asset) return next;
  return {
    ...next,
    imageUrl: asset.displayUrl,
    ...(typeof value.src === "string" ? { src: asset.displayUrl } : {}),
    ...(typeof value.url === "string" && imageUrl(value.url) ? { url: asset.displayUrl } : {}),
    imageOriginalUrl: asset.originalUrl,
    imageWidth: asset.width,
    imageHeight: asset.height,
    imageAlt: asset.alt,
    ...(typeof value.alt === "string" ? { alt: asset.alt } : {})
  };
}

function patchMediaManifest(value, pageAssets) {
  if (!Array.isArray(value)) return value;
  return value.map((item, index) => {
    const source = normalizeUrl(item?.src || item?.originalUrl || item?.originalSrc);
    const asset = pageAssets.find((candidate) => candidate.sourceUrl === source) || pageAssets[index];
    if (!asset) return item;
    return {
      ...item,
      filename: asset.displayFilename,
      src: asset.displayUrl,
      originalSrc: asset.originalUrl,
      originalUrl: asset.originalUrl,
      width: asset.width,
      height: asset.height,
      alt: asset.alt
    };
  });
}

function patchPage(value, assetsBySourceUrl, pageAssets) {
  const next = patchPageJson(value, assetsBySourceUrl);
  if (next && typeof next === "object" && !Array.isArray(next)) {
    if (next.seo && typeof next.seo === "object" && pageAssets[0]) next.seo.ogImage = pageAssets[0].displayUrl;
    if (Array.isArray(next.mediaManifest)) next.mediaManifest = patchMediaManifest(next.mediaManifest, pageAssets);
  }
  return next;
}

function patchNavigation(settings, assetsByPublicPath) {
  if (!settings || typeof settings !== "object") return settings;
  const next = structuredClone(settings);
  const groups = next.saveTheDateNavigation?.groups;
  if (!Array.isArray(groups)) return next;
  for (const group of groups) {
    for (const item of group.items || []) {
      const asset = assetsByPublicPath.get(item.href);
      if (!asset) continue;
      item.imageUrl = asset.displayUrl;
      item.imageAlt = asset.alt;
    }
  }
  return next;
}

function rawPublicUrl(publicBase, displayFilename, extension) {
  return `${publicBase}/originals/${displayFilename.replace(/\.jpg$/i, `.${extension}`)}`;
}

async function main() {
  if (!APPLY) throw new Error("paid_generation_requires_--apply");
  assertNonProductionWriteTarget();

  const prisma = new PrismaClient();
  const existingReport = await fs.readFile(REPORT_PATH, "utf8")
    .then((value) => JSON.parse(value))
    .catch(() => undefined);
  const report = {
    siteId: SITE_ID,
    scope: "Save the Date menu themes other than Valentine's Day",
    themes: themes.map((theme) => ({ publicPath: theme.publicPath, sourcePath: theme.sourcePath, label: theme.label })),
    providerLabel: PROVIDER_LABEL,
    model: MODEL,
    endpoint: "/v1/images/generations",
    method: "POST",
    requestSize: REQUEST_SIZE,
    quality: QUALITY,
    displayRule: "3840px wide, aspect-preserving derivative; no crop, no stretch; provider response bytes retained as original",
    noAutomaticRetry: true,
    noProviderFallback: true,
    generationConcurrency: GENERATION_CONCURRENCY,
    attempts: existingReport?.attempts ?? []
  };

  let reportWriteChain = Promise.resolve();
  const saveReport = () => {
    reportWriteChain = reportWriteChain.then(() => writeJson(REPORT_PATH, report));
    return reportWriteChain;
  };

  try {
    const pages = await prisma.themePage.findMany({
      where: { siteId: SITE_ID, slug: { in: Array.from(pagePaths) } },
      select: { id: true, slug: true, draftJson: true, publishedJson: true }
    });
    const livePages = await prisma.livePage.findMany({
      where: { siteId: SITE_ID, slug: { in: Array.from(pagePaths) } },
      select: { id: true, slug: true, contentJson: true }
    });
    const pageBySlug = new Map(pages.map((page) => [page.slug, page]));
    const liveBySlug = new Map(livePages.map((page) => [page.slug, page]));
    const tasks = [];
    const pagePlans = [];
    for (const theme of themes) {
      const page = pageBySlug.get(theme.sourcePath);
      const livePage = liveBySlug.get(theme.sourcePath);
      if (!page || !livePage) throw new Error(`theme_page_or_live_page_missing:${theme.sourcePath}`);
      const refs = collectImageRefs(livePage.contentJson, page.publishedJson, page.draftJson);
      assert.equal(refs.length, theme.scenes.length, `${theme.sourcePath}: image count does not match approved scene count`);
      const publicBase = `/assets/sites/site_aidreamshoots/visuals/save-the-date/${theme.folder}/${BATCH_ID}`;
      const pageTasks = refs.map((sourceUrl, index) => {
        const scene = sceneForSource(theme, sourceUrl, index);
        const displayFilename = displayName(theme, scene);
        const task = {
          themeKey: theme.key,
          publicPath: theme.publicPath,
          sourcePath: theme.sourcePath,
          index,
          sourceUrl,
          sourceFilename: path.basename(sourceUrl),
          displayFilename,
          displayUrl: `${publicBase}/${displayFilename}`,
          prompt: buildPrompt(theme, scene),
          alt: scene.alt,
          publicBase
        };
        tasks.push(task);
        return task;
      });
      pagePlans.push({ theme, page, livePage, pageTasks });
    }
    report.totalImages = tasks.length;
    report.estimatedMaxCostUsd = Number((tasks.length * PRICE_PER_REQUEST_USD).toFixed(4));
    report.maxPaidCreateAttempts = tasks.length;

    const provider = await prisma.platformAiProvider.findFirst({
      where: { label: PROVIDER_LABEL, modelType: MODEL, providerType: "image", enabled: true },
      select: { id: true, label: true, aiUrl: true, apiKey: true, modelType: true }
    });
    if (!provider?.apiKey || !provider.aiUrl) throw new Error("configured_vendor_provider_missing_api_credentials");
    const baseUrl = providerBaseUrl(provider.aiUrl);
    const modelsResponse = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      signal: AbortSignal.timeout(30_000)
    });
    if (!modelsResponse.ok) throw new Error(`provider_read_only_models_check_failed:${modelsResponse.status}`);
    report.providerId = provider.id;
    report.providerBaseUrl = baseUrl;
    report.readOnlyModelCheck = { status: modelsResponse.status, ok: true };
    await saveReport();

    const assetsBySourceUrl = new Map();
    let nextIndex = 0;
    let firstError;
    async function worker() {
      while (!firstError) {
        const taskIndex = nextIndex++;
        if (taskIndex >= tasks.length) return;
        const task = tasks[taskIndex];
        const priorAttempt = [...report.attempts].reverse().find((attempt) => attempt.theme === task.themeKey && attempt.displayFilename === task.displayFilename);
        const requestId = priorAttempt?.requestId || `aidreamshoots:${SITE_ID}:${BATCH_ID}:${task.themeKey}:${String(task.index + 1).padStart(2, "0")}`;
        const localBase = path.resolve("public", task.publicBase.slice(1));
        const existingOriginal = await existingFileWithExtension(localBase, task.displayFilename);
        const existingDisplayPath = path.join(localBase, task.displayFilename);
        if (priorAttempt?.status === "succeeded" && existingOriginal) {
          const originalBuffer = await fs.readFile(existingOriginal.path);
          const displayBuffer = await fs.readFile(existingDisplayPath);
          const dimensions = await sharp(displayBuffer).metadata();
          if (dimensions.width !== TARGET_WIDTH || !dimensions.height) throw new Error(`existing_display_not_4k:${task.displayFilename}`);
          const asset = {
            ...task,
            width: dimensions.width,
            height: dimensions.height,
            sourceWidth: priorAttempt.originalWidth,
            sourceHeight: priorAttempt.originalHeight,
            originalUrl: rawPublicUrl(task.publicBase, task.displayFilename, existingOriginal.extension),
            originalExtension: existingOriginal.extension,
            originalBytes: originalBuffer.length,
            originalHash: sha256(originalBuffer),
            displayHash: sha256(displayBuffer),
            originalLocalPath: existingOriginal.path,
            displayLocalPath: existingDisplayPath
          };
          assetsBySourceUrl.set(task.sourceUrl, asset);
          console.log(`reused ${taskIndex + 1}/${tasks.length}: ${task.themeKey}/${task.displayFilename}, original preserved`);
          continue;
        }
        const startedAt = Date.now();
        const attempt = {
          theme: task.themeKey,
          publicPath: task.publicPath,
          sourceFilename: task.sourceFilename,
          displayFilename: task.displayFilename,
          requestId,
          paidCreateAttempt: taskIndex + 1,
          status: "started",
          ...(priorAttempt ? { resumeOfRequestId: priorAttempt.requestId, resumeOfStatus: priorAttempt.status } : {})
        };
        report.attempts.push(attempt);
        await saveReport();
        try {
          const response = await fetch(`${baseUrl}/images/generations`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${provider.apiKey}`,
              "Idempotency-Key": requestId,
              "X-Client-Request-Id": requestId
            },
            body: JSON.stringify({ model: MODEL, prompt: task.prompt, size: REQUEST_SIZE, quality: QUALITY, n: 1, response_format: "b64_json" }),
            signal: AbortSignal.timeout(300_000)
          });
          const body = await response.json().catch(() => ({}));
          attempt.status = response.status;
          attempt.ok = response.ok;
          attempt.elapsedMs = Date.now() - startedAt;
          attempt.providerRequestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "";
          attempt.providerTaskId = body?.id ?? body?.task_id ?? body?.data?.[0]?.id ?? "";
          attempt.responseShape = { hasBase64: Boolean(imagePayload(body)), hasUrl: Boolean(imageUrlFromResponse(body)) };
          await saveReport();
          if (!response.ok) throw new Error(`${task.themeKey}:${task.displayFilename}:provider_create_failed:${response.status}`);

          const rawBuffer = await responseImageBuffer(body);
          const extension = extensionFor(rawBuffer);
          const originalLocalPath = path.join(localBase, "originals", task.displayFilename.replace(/\.jpg$/i, `.${extension}`));
          const displayLocalPath = path.join(localBase, task.displayFilename);
          await fs.mkdir(path.dirname(originalLocalPath), { recursive: true });
          await fs.writeFile(originalLocalPath, rawBuffer);
          const dimensions = await writeNoCrop4k(rawBuffer, displayLocalPath);
          const originalUrl = rawPublicUrl(task.publicBase, task.displayFilename, extension);
          const asset = {
            ...task,
            ...dimensions,
            originalUrl,
            originalExtension: extension,
            originalBytes: rawBuffer.length,
            originalHash: sha256(rawBuffer),
            displayHash: sha256(await fs.readFile(displayLocalPath)),
            originalLocalPath,
            displayLocalPath
          };
          assetsBySourceUrl.set(task.sourceUrl, asset);
          attempt.originalBytes = asset.originalBytes;
          attempt.originalHash = asset.originalHash;
          attempt.displayHash = asset.displayHash;
          attempt.originalWidth = asset.sourceWidth;
          attempt.originalHeight = asset.sourceHeight;
          attempt.outputWidth = asset.width;
          attempt.outputHeight = asset.height;
          attempt.status = "succeeded";
          await saveReport();
          console.log(`succeeded ${taskIndex + 1}/${tasks.length}: ${task.themeKey}/${task.displayFilename} -> ${asset.width}x${asset.height}, original preserved`);
        } catch (error) {
          attempt.status = "failed";
          attempt.error = error instanceof Error ? error.message : String(error);
          attempt.elapsedMs = Date.now() - startedAt;
          await saveReport();
          firstError ??= error;
          return;
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(GENERATION_CONCURRENCY, tasks.length) }, () => worker()));
    if (firstError) throw firstError;
    assert.equal(assetsBySourceUrl.size, tasks.length, "vendor asset count mismatch after generation");

    const assetsByPublicPath = new Map();
    for (const plan of pagePlans) {
      const pageAssets = plan.pageTasks.map((task) => assetsBySourceUrl.get(task.sourceUrl));
      if (pageAssets.some((asset) => !asset)) throw new Error(`generated_asset_missing:${plan.theme.sourcePath}`);
      assetsByPublicPath.set(plan.theme.publicPath, pageAssets[0]);
      plan.assets = pageAssets;
      plan.assetsBySourceUrl = new Map(pageAssets.map((asset) => [asset.sourceUrl, asset]));
      plan.nextDraft = patchPage(plan.page.draftJson, plan.assetsBySourceUrl, pageAssets);
      plan.nextPublished = patchPage(plan.page.publishedJson && Object.keys(plan.page.publishedJson).length ? plan.page.publishedJson : plan.page.draftJson, plan.assetsBySourceUrl, pageAssets);
      plan.nextLive = patchPage(plan.livePage.contentJson, plan.assetsBySourceUrl, pageAssets);
    }

    const settings = await prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { id: true, draftJson: true, publishedJson: true } });
    if (!settings) throw new Error("theme_settings_missing");
    const nextSettingsDraft = patchNavigation(settings.draftJson, assetsByPublicPath);
    const nextSettingsPublished = patchNavigation(settings.publishedJson, assetsByPublicPath);

    await prisma.$transaction(async (tx) => {
      for (const plan of pagePlans) {
        for (const asset of plan.assets) {
          const storageKey = asset.displayUrl.slice(1);
          await tx.mediaAsset.upsert({
            where: { siteId_storageKey: { siteId: SITE_ID, storageKey } },
            create: {
              id: `media_${SITE_ID}_${BATCH_ID}_${asset.themeKey}_${String(asset.index + 1).padStart(2, "0")}`.replace(/[^a-z0-9_]+/gi, "_"),
              siteId: SITE_ID,
              label: asset.displayFilename,
              storageKey,
              mimeType: "image/jpeg",
              usageType: "theme",
              sourceType: `save-the-date-${asset.themeKey}-vendor-api-gpt-image-2-original-preserved-v1`,
              previewUrl: asset.displayUrl,
              originUrl: asset.originalUrl,
              altText: asset.alt,
              notes: "Vendor API original bytes preserved; 4K display derivative is resized without crop."
            },
            update: {
              label: asset.displayFilename,
              previewUrl: asset.displayUrl,
              originUrl: asset.originalUrl,
              sourceType: `save-the-date-${asset.themeKey}-vendor-api-gpt-image-2-original-preserved-v1`,
              altText: asset.alt,
              notes: "Vendor API original bytes preserved; 4K display derivative is resized without crop."
            }
          });
        }
        await tx.themePage.update({ where: { id: plan.page.id }, data: { draftJson: plan.nextDraft, publishedJson: plan.nextPublished } });
        await tx.livePage.update({ where: { id: plan.livePage.id }, data: { contentJson: plan.nextLive } });
      }
      await tx.themeSettings.update({ where: { id: settings.id }, data: { draftJson: nextSettingsDraft, publishedJson: nextSettingsPublished } });
    });

    report.completed = true;
    report.paidCreateAttempts = tasks.length;
    report.actualMaxCostUsd = Number((tasks.length * PRICE_PER_REQUEST_USD).toFixed(4));
    report.publishedDisplayBases = Object.fromEntries(pagePlans.map((plan) => [plan.theme.publicPath, plan.assets[0].publicBase]));
    report.publishedOriginalBases = Object.fromEntries(pagePlans.map((plan) => [plan.theme.publicPath, `${plan.assets[0].publicBase}/originals`]));
    await saveReport();
    console.log(JSON.stringify({
      ok: true,
      themes: themes.length,
      images: tasks.length,
      paidCreateAttempts: tasks.length,
      actualMaxCostUsd: report.actualMaxCostUsd,
      reportPath: REPORT_PATH
    }, null, 2));
  } catch (error) {
    report.completed = false;
    report.failure = error instanceof Error ? error.message : String(error);
    report.paidCreateAttempts = report.attempts.filter((attempt) => attempt.status === "started" || typeof attempt.status === "number" || attempt.status === "succeeded" || attempt.status === "failed").length;
    report.actualMaxCostUsd = Number((report.paidCreateAttempts * PRICE_PER_REQUEST_USD).toFixed(4));
    await saveReport();
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
