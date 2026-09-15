#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const mode = String(args.mode || "plan").toLowerCase();
const theme = String(args.theme || "valentine").toLowerCase();
const resume = Boolean(args.resume);
const sourceManifestPath = path.resolve(args.sourceManifest || `releases/manifests/aidreamshoots-theme-${theme}-20260913-v1.json`);
const batchId = String(args.batch || `aidreamshoots-theme-${theme}-diverse-20260913-v2`);
const manifestPath = path.resolve(args.manifest || `releases/manifests/${batchId}.json`);
const quality = String(args.quality || "low");
const cacheVersion = String(args.cacheVersion || args["cache-version"] || "20260913diverse2");
const confirmation = String(args.confirm || "");
const expectedConfirmation = String(args.expectedConfirmation || "aidreamshoots-diverse-regeneration");
const targetSiteId = String(args.targetSiteId || "site_mydreamshoots_xby");
const assetSiteSlug = String(args.assetSiteSlug || "site_aidreamshoots");
const storefrontName = String(args.storefrontName || "AIdreamshoots");
const locale = String(args.locale || "es").toLowerCase();
const providerId = String(args.providerId || "aiprov_image4_mysub2api");
const outputRoot = path.resolve(".tmp", `${assetSiteSlug}-image-regeneration`, batchId, "outputs");
const finalRoot = path.resolve("public/assets/sites", assetSiteSlug, "generated/regenerated", batchId);
const finalPublicRoot = `/assets/sites/${assetSiteSlug}/generated/regenerated/${batchId}`;
const imageModel = "gpt-image-2";
const imageResolution = String(args.resolution || "1K").trim().toUpperCase();
assert(["1K", "2K", "4K"].includes(imageResolution), `Unsupported image resolution: ${imageResolution}`);
const imageOutputProfiles = {
  "1K": { cover: { width: 1280, height: 960, size: "1024x1024" }, gallery: { width: 1024, height: 1024, size: "1024x1024" } },
  "2K": { cover: { width: 2560, height: 1920, size: "2560x1920" }, gallery: { width: 2048, height: 2048, size: "2048x2048" } },
  // image4/gpt-image-2 returns a native 4:3 high-resolution frame at 2896x2172.
  // Keep that provider-native frame instead of rejecting it or cropping it locally.
  "4K": { cover: { width: 2896, height: 2172, size: "2896x2172" }, gallery: { width: 2896, height: 2172, size: "2896x2172" } }
};
const maxCreateTimeoutMs = Number(args.timeoutMs || (resume ? 600_000 : 300_000));
const minimumCrossAHashDistance = 10;
const minimumCrossDHashDistance = 12;
const minimumCrossColorHashDistance = 24;
const minimumUniqueImageHashCount = 13;
const nativeHighResolutionDimensionTolerance = 8;

function outputProfileForTask(task) {
  return String(task.outputProfile || (task.status === "succeeded" ? "1K" : imageResolution)).trim().toUpperCase();
}

function outputSpecForTask(task) {
  const profile = imageOutputProfiles[outputProfileForTask(task)];
  assert(profile, `${task.id}: unsupported output profile ${outputProfileForTask(task)}`);
  return task.isCover ? profile.cover : profile.gallery;
}

function imageSizeForTask(task) {
  return outputSpecForTask(task).size;
}

const THEME_BRIEFS = {
  valentine: {
    label: "San Valentín",
    request: "una experiencia romántica de San Valentín para una galería privada, con afecto natural y sin convertir cada imagen en una cena con rosas",
    style: "editorial lifestyle photography, intimate but varied, contemporary European romance",
    avoid: "no repetir rosas rojas, mesa de cena, velas, copas de vino, jersey rojo, ramo, caja de regalo o la misma pareja; no usar boda, propuesta, menores, texto legible ni marcas"
  },
  wedding: {
    label: "boda",
    request: "un paquete de retratos de boda privado con ceremonias, preparativos, retratos editoriales y momentos documentales claramente distintos",
    style: "timeless wedding editorial photography with documentary variety",
    avoid: "no repetir altar, ramo, vestido blanco, beso frontal o la misma pareja; no usar estética de San Valentín, Navidad, menores, texto legible ni marcas"
  },
  christmas: {
    label: "Navidad",
    request: "un paquete de recuerdos navideños privados con retratos, interiores, exteriores, detalles y actividades de adultos claramente distintos",
    style: "warm holiday editorial photography with varied family-and-friends storytelling",
    avoid: "no repetir árbol, regalos, jersey rojo, sofá, luces y la misma familia; no usar boda, Halloween, menores como sujetos principales, texto legible ni marcas"
  },
  halloween: {
    label: "Halloween",
    request: "un paquete de fotos de Halloween para adultos con disfraces, retratos, decoración, exteriores y escenas de fiesta claramente distintos",
    style: "cinematic costume-party editorial photography, playful and mysterious without gore",
    avoid: "no repetir calabaza, sombrero de bruja, maquillaje de calavera, mesa de fiesta o la misma persona; no usar sangre, gore, violencia, menores, texto legible ni marcas"
  },
  thanksgiving: {
    label: "Acción de Gracias",
    request: "un paquete de recuerdos de Acción de Gracias con cocina, reunión, retratos, exteriores y detalles de otoño claramente distintos",
    style: "authentic autumn documentary photography with warm but varied storytelling",
    avoid: "no repetir mesa de comedor, pavo, calabazas, velas, suéter naranja o la misma familia; no usar Navidad, Halloween, menores como sujetos principales, texto legible ni marcas"
  },
  avatar: {
    label: "Avatar",
    request: "un paquete de avatares fotográficos para perfiles, comunidades y páginas personales, con identidades adultas originales y estilos visuales variados",
    style: "high-end portrait photography with a broad mix of polished, natural, graphic and cinematic treatments",
    avoid: "no repetir el mismo rostro, recorte, fondo, pose, color dominante o vestuario; no usar texto, logotipos, celebridades, menores ni personajes con copyright",
    directions: [
      "retrato de cabeza y hombros en estudio limpio con fondo geométrico coral y expresión segura",
      "primer plano con luz natural de ventana en una casa creativa, expresión amable y textura de piel real",
      "perfil editorial en blanco y negro con sombra lateral marcada y fondo arquitectónico minimalista",
      "avatar urbano nocturno con reflejos de neón azul y magenta, encuadre de tres cuartos y actitud espontánea",
      "retrato luminoso con fondo degradado suave y styling contemporáneo, composición centrada y respirada",
      "avatar ambiental en un parque al amanecer, rostro nítido y profundidad de campo natural",
      "retrato futurista sobrio con reflejos de vidrio y metal, paleta fría y detalles de moda originales",
      "avatar cálido en un escritorio de creador con micrófono y cuaderno sin texto, gesto conversacional",
      "retrato de moda con encuadre recortado, textura de prendas y una pose editorial asimétrica",
      "retrato artístico con proyección de sombras botánicas sobre el fondo, identidad clara y piel natural",
      "avatar documental en una cafetería tranquila, mirada directa y ambiente cotidiano reconocible",
      "retrato dramático de estudio con luz de borde dorada, fondo oscuro y expresión serena",
      "avatar minimalista de alto contraste con fondo claro, composición icónica y espacio visual limpio"
    ]
  },
  headshot: {
    label: "Retrato profesional",
    request: "un paquete de retratos profesionales para perfiles de trabajo, equipos, CV y páginas personales, con contextos laborales diversos",
    style: "credible professional photography ranging from polished studio portraits to authentic environmental business images",
    avoid: "no repetir el mismo fondo de oficina, traje, pose, sonrisa, encuadre o identidad; no usar texto legible, logotipos, marcas, menores ni estética de gala",
    directions: [
      "retrato corporativo clásico en estudio con blazer azul marino, fondo gris cálido y luz suave de tres puntos",
      "profesional creativo en un coworking luminoso, ropa contemporánea y gesto natural mientras mira a cámara",
      "retrato ambiental de una arquitecta adulta junto a maquetas abstractas sin texto, luz lateral y enfoque editorial",
      "directivo adulto en una terraza urbana al amanecer, sastrería relajada y skyline desenfocado",
      "profesional de tecnología en un laboratorio moderno sin pantallas legibles, luz fría y composición limpia",
      "retrato de una especialista sanitaria adulta en una consulta neutra sin marcas, expresión cálida y luz natural",
      "retrato de cuerpo medio para un perfil de liderazgo, fondo de biblioteca y paleta verde oliva y crema",
      "profesional de la hostelería en una cocina elegante sin texto visible, uniforme sobrio y luz cinematográfica",
      "headshot editorial de una persona adulta con ropa monocromática, fondo de color intenso y sombra gráfica",
      "retrato documental de un profesional en un taller creativo, herramientas desenfocadas y manos relajadas",
      "retrato exterior en un campus o plaza moderna, luz de tarde y expresión segura sin pose rígida",
      "retrato profesional en clave baja con fondo carbón, luz de borde y vestuario formal sin corbata",
      "headshot inclusivo y natural en un estudio blanco, encuadre vertical, sonrisa sutil y textura realista"
    ]
  },
  "gala-photo": {
    label: "Foto de gala",
    request: "un paquete de retratos de gala para eventos, alfombras rojas y celebraciones elegantes, con estilos de noche visualmente distintos",
    style: "luxury event photography with editorial polish, believable flash, varied formal styling and candid human moments",
    avoid: "no repetir alfombra roja, vestido, pose de llegada, copa, fondo dorado o la misma persona; no usar texto, logotipos, marcas de eventos reales ni boda",
    directions: [
      "llegada individual a una alfombra roja con vestido esmeralda, flashes suaves y encuadre de cuerpo entero",
      "pareja adulta elegante conversando en un vestíbulo de teatro, terciopelo oscuro y luz ámbar lateral",
      "retrato de gala en una terraza nocturna con skyline, traje blanco y vestido negro, brisa visible",
      "momento espontáneo detrás del escenario con una artista adulta y cortinas de terciopelo, luz de camerino",
      "retrato editorial sentado en un salón art déco, joyería discreta, composición asimétrica y luz de lámpara",
      "grupo pequeño de adultos brindando sin que las copas dominen la escena, salón contemporáneo y flash documental",
      "retrato de una persona adulta frente a una instalación escultórica iluminada, moda metálica y sombras geométricas",
      "llegada a un evento en una escalera monumental, sastrería negra y movimiento natural de la ropa",
      "retrato íntimo en un lounge de hotel, vestido satinado color zafiro y luz azul profunda",
      "fotografía de prensa editorial sin logos, pose relajada junto a una pared de mármol y luz de flash lateral",
      "baile espontáneo de dos adultos en un salón amplio, ropa formal en tonos vino y marfil, movimiento congelado",
      "retrato nocturno en un jardín iluminado, capa de noche y luces desenfocadas, atmósfera sofisticada",
      "retrato de portada de evento con espacio negativo, styling formal contemporáneo y fondo arquitectónico limpio"
    ]
  },
  "portrait-photo": {
    label: "Foto de retrato",
    request: "un paquete amplio de retratos fotográficos para perfiles, editoriales y recuerdos personales, con personas adultas y estilos muy variados",
    style: "versatile portrait photography across candid, editorial, environmental, intimate and fashion-led approaches",
    avoid: "no repetir el mismo rostro, escenario, dirección de mirada, paleta o pose; no usar texto legible, marcas, menores ni personajes conocidos",
    directions: [
      "retrato natural de una persona adulta caminando por una calle tranquila, luz de mañana y gesto no posado",
      "primer plano íntimo junto a una ventana lluviosa, textura suave, mirada lateral y paleta azul gris",
      "retrato editorial de moda en un fondo de color sólido, pose angular y styling de revista",
      "retrato al aire libre en un bosque otoñal, luz moteada, ropa de punto y profundidad natural",
      "retrato cinematográfico en una cafetería de barrio, luz de tungsteno, expresión pensativa y reflejos",
      "retrato de verano en una terraza con plantas, colores claros, movimiento de cabello y luz solar real",
      "retrato minimalista sentado en una silla de madera, fondo crema, manos visibles y composición serena",
      "retrato urbano nocturno con lluvia y reflejos de escaparates abstractos, actitud confiada",
      "retrato de perfil junto a una pared de piedra, luz dura de tarde y textura arquitectónica",
      "retrato espontáneo de una persona adulta riendo en una reunión pequeña, ambiente social discreto",
      "retrato de belleza natural con maquillaje mínimo, fondo oscuro y luz suave envolvente",
      "retrato experimental con sombra de persiana y color grading cinematográfico, identidad claramente visible",
      "retrato documental en un entorno de trabajo artesanal, objetos desenfocados y gesto concentrado"
    ]
  },
  "black-friday": {
    label: "Black Friday",
    request: "un paquete visual de Black Friday para campañas de moda, compras y creadores, con energía comercial sin texto ni marcas visibles",
    style: "high-impact commercial photography with varied campaign moods, premium contrast and social-ready compositions",
    avoid: "no repetir bolsas de compra, cajas, fondo negro, gesto de sorpresa, color rojo dominante o la misma persona; no incluir texto, precios, logotipos ni marcas",
    directions: [
      "retrato de campaña con prendas negras y doradas sobre fondo carbón, postura fuerte y espacio negativo",
      "persona adulta saliendo de una tienda conceptual sin logos, bolsas abstractas y luz urbana de noche",
      "composición de moda con una chaqueta de cuero, flashes editoriales y fondo plateado texturizado",
      "creador adulto mostrando un producto neutro sin marca en un estudio cálido, gesto auténtico y encuadre social",
      "escena de compra en un mercado interior elegante, movimiento natural, luces puntuales y paleta ámbar",
      "retrato dinámico con prendas de color cobalto y magenta, fondo gráfico sin letras y luz de campaña",
      "mesa de producto minimalista con manos adultas y objetos genéricos, composición de catálogo sin texto",
      "retrato de campaña en una escalera industrial, sastrería negra, contrapicado leve y sombras marcadas",
      "escena de regalo contemporánea con papel mate y manos reales, sin texto legible ni exceso de cajas",
      "fotografía editorial en un probador de moda sin marcas, espejo, reflejos y pose espontánea",
      "campaña de compras al aire libre en una plaza moderna, bolsas lisas, luz de invierno y expresión alegre",
      "retrato de lujo con accesorios metálicos y fondo azul profundo, iluminación de estudio controlada",
      "composición de portada comercial con una persona adulta y un producto abstracto, claridad de miniatura y espacio para diseño posterior"
    ]
  },
  "only-fans": {
    label: "Solo Fans",
    request: "un paquete de retratos de creadoras y creadores adultos para contenido de suscripción, siempre completamente vestidos, elegantes y aptos para una galería privada",
    style: "confident creator-lifestyle photography with tasteful fashion, varied environments and polished but believable intimacy",
    avoid: "no repetir dormitorio, lencería, pose seductora, espejo, luz roja o la misma persona; no desnudez, no sexualización explícita, no texto, marcas ni menores",
    directions: [
      "creador adulto completamente vestido en un estudio con luces de color y micrófono, actitud segura y natural",
      "retrato de moda en un lounge elegante con blazer y pantalón, luz cálida y pose editorial relajada",
      "persona adulta grabando contenido en un escritorio creativo, cámara visible sin marcas y luz de ventana",
      "retrato exterior al atardecer en una azotea, ropa urbana sofisticada y skyline desenfocado",
      "retrato en una sala de música con auriculares y teclado, styling contemporáneo y expresión concentrada",
      "creadora adulta en un camerino de teatro, bata exterior elegante completamente cerrada y luces de espejo",
      "retrato de viaje en una habitación de hotel luminosa, maleta neutra, ropa de día y composición editorial",
      "persona adulta en un taller artístico con pintura y materiales, delantal completo y gesto espontáneo",
      "retrato de fitness lifestyle en un gimnasio boutique, ropa deportiva completamente cubierta y luz lateral",
      "escena de lectura y conversación en una biblioteca privada, vestuario de punto y atmósfera íntima no sexual",
      "retrato nocturno en un bar de hotel, traje de terciopelo y luz azul, expresión confiada y elegante",
      "retrato de belleza en un estudio floral abstracto, ropa satinada completamente cubierta y luz suave",
      "portada de creador con composición limpia, identidad adulta clara, moda original y espacio visual para diseño posterior"
    ]
  },
  "singles-awareness-day": {
    label: "Día de la Conciencia de la Soltería",
    request: "un paquete de celebración personal para adultos solteros, enfocado en autonomía, amistades, hobbies y bienestar sin convertir cada imagen en una cita romántica",
    style: "optimistic lifestyle photography with candid self-expression, editorial variety and warm independent energy",
    avoid: "no repetir pareja romántica, ramo, cena para dos, corazón, pose triste o la misma persona; no usar texto, marcas, menores ni clichés de ruptura",
    directions: [
      "persona adulta disfrutando un café sola junto a una ventana, diario sin texto y luz de mañana",
      "adulto haciendo una excursión en un sendero costero, mochila, viento y paisaje amplio, energía libre",
      "noche de juegos con un pequeño grupo de amistades adultas, risas naturales y ambiente de apartamento",
      "persona adulta cocinando una receta creativa para sí misma en una cocina luminosa, colores vivos",
      "retrato de autocuidado en un estudio de cerámica, manos ocupadas y expresión satisfecha",
      "adulto bailando en una clase de movimiento, ropa cómoda, luz de estudio y sensación de libertad",
      "visita individual a una galería de arte, composición arquitectónica y mirada curiosa",
      "retrato urbano en bicicleta durante la hora dorada, ropa casual y ciudad desenfocada",
      "persona adulta leyendo en un parque con manta y auriculares, entorno verde y calma positiva",
      "salida nocturna con amistades en una terraza, luces cálidas, brindis discreto y alegría no romántica",
      "retrato editorial de una persona adulta celebrando un logro profesional, traje colorido y fondo limpio",
      "viaje en solitario en una estación o andén, maleta pequeña, anticipación y luz cinematográfica",
      "portada de bienestar personal con una persona adulta al aire libre, postura abierta, luz natural y espacio negativo"
    ]
  },
  cyberpunk: {
    label: "Cyberpunk",
    themeAnchor: "una ciudad cyberpunk original con tecnología integrada, neón y arquitectura futurista reconocibles",
    seoSubject: "retrato cyberpunk de una persona adulta",
    request: "un paquete de retratos cyberpunk para adultos con identidad original, diseño de mundo futurista y escenas urbanas variadas",
    style: "cinematic cyberpunk editorial photography with controlled neon, practical light and believable human texture",
    avoid: "no repetir neón magenta, lluvia, máscara, chaqueta de cuero, fondo de ciudad o la misma persona; no usar texto legible, logotipos, personajes conocidos, armas, violencia ni menores",
    directions: [
      "retrato de tres cuartos en una calle peatonal futurista con neón cian y magenta, ropa técnica original y expresión segura",
      "primer plano junto a una ventana de tren elevado, reflejos de anuncios abstractos sin letras y luz azul de madrugada",
      "retrato ambiental en un mercado nocturno futurista con puestos de comida vaporosa, paleta ámbar y verde eléctrico",
      "persona adulta en una azotea con paneles solares y skyline holográfico abstracto, viento visible y encuadre amplio",
      "retrato editorial en un estudio de reparación de robots con herramientas desenfocadas, luz lateral dura y vestuario naranja",
      "escena de bicicleta eléctrica en una avenida mojada, movimiento congelado, casco de diseño y reflejos violeta",
      "retrato minimalista contra una pared de hormigón con una única línea de luz azul, pose escultórica y sombras profundas",
      "persona adulta en un invernadero urbano futurista, plantas bioluminiscentes originales y luz verde suave",
      "retrato desde el interior de un ascensor metálico, composición simétrica, ropa plateada mate y mirada directa",
      "escena de creador adulto en un escritorio con interfaz abstracta sin texto legible, iluminación cálida y detalles físicos reales",
      "retrato nocturno bajo un puente de arquitectura futurista, charcos con reflejos y styling amarillo ácido sin marcas",
      "persona adulta en una estación espacial recreada como set fotográfico, fondo oscuro, luz de borde y gesto sereno",
      "portada cyberpunk con sujeto adulto claramente reconocible, arquitectura futurista, neón equilibrado y espacio negativo"
    ]
  },
  boudoir: {
    label: "Boudoir",
    themeAnchor: "retrato boudoir editorial para adultos, íntimo y elegante, con vestuario completamente cubierto y ambiente privado",
    seoSubject: "retrato boudoir editorial de una persona adulta",
    request: "un paquete de retratos boudoir para adultos, elegante y no explícito, con intimidad fotográfica, diversidad de cuerpos y escenas interiores variadas",
    style: "tasteful boudoir editorial photography, fully clothed, soft natural light and refined private-room storytelling",
    avoid: "no repetir cama, lencería, espejo, pose seductora, luz roja o dormitorio; no desnudez, sexualización explícita, fetichismo, menores, texto ni marcas",
    directions: [
      "persona adulta completamente vestida junto a una ventana de hotel al amanecer, bata satinada cerrada y luz crema",
      "retrato sentado en un sillón de terciopelo, traje sastre oscuro, manos relajadas y composición editorial sobria",
      "primer plano frente a una pared de papel texturizado, camisa blanca abotonada y sombras suaves de persiana",
      "retrato en un baño art déco sin desnudez, vestido de noche completamente cubierto, mármol y luz dorada",
      "persona adulta leyendo en un chaise longue con ropa de punto elegante, ambiente íntimo y natural no posado",
      "retrato de cuerpo medio en un vestidor privado, traje de dos piezas completamente cubierto y espejo secundario desenfocado",
      "escena de autocuidado en una habitación luminosa, bata cerrada, taza de té y flores secas sin romanticismo",
      "retrato editorial de una persona adulta frente a cortinas de lino, vestido largo opaco, postura escultórica y luz lateral",
      "retrato monocromático en un estudio oscuro, camisa de seda completamente cerrada, luz de borde y expresión serena",
      "persona adulta en un salón con tocadiscos sin texto, pantalón de cintura alta, movimiento natural y paleta terracota",
      "retrato en una terraza privada al atardecer, kimono largo cerrado sobre ropa elegante y cielo amplio",
      "retrato documental en una habitación de hotel con maleta abierta y vestuario cotidiano refinado, nada de cama como foco",
      "portada boudoir de adulto completamente vestido, privacidad, elegancia y luz natural inmediatamente reconocibles"
    ]
  },
  holiday: {
    label: "Festivos",
    themeAnchor: "celebración festiva adulta con decoración estacional reconocible, alegría social y detalles originales sin depender de una sola fiesta",
    seoSubject: "foto festiva de personas adultas",
    request: "un paquete de fotos festivas para adultos con celebraciones, reuniones, decoración y actividades estacionales visualmente distintas",
    style: "joyful seasonal lifestyle photography with documentary variety, tactile decoration and polished natural color",
    avoid: "no repetir árbol, regalos, mesa, globos, confeti, rojo dominante o la misma familia; no usar menores como sujetos principales, texto legible, marcas ni una sola festividad en todas las imágenes",
    directions: [
      "retrato de adulto en una calle decorada con guirnaldas de papel, abrigo claro y luz de tarde",
      "grupo pequeño de amistades adultas preparando una mesa de aperitivos coloridos, cocina luminosa y acción natural",
      "persona adulta en un festival de faroles al aire libre, luces cálidas, ropa de noche y fondo profundo",
      "retrato junto a una ventana con decoración de temporada en tonos azul hielo y plata, expresión tranquila",
      "adultos bailando en una sala decorada con flores de papel, iluminación de fiesta y movimiento congelado",
      "detalle de manos adultas envolviendo una artesanía festiva con materiales naturales, sin texto visible",
      "escena de picnic festivo en un parque, mantas, frutas y decoración sostenible, luz solar suave",
      "retrato de una persona adulta cocinando un plato estacional en una cocina de colores vivos, vapor y textura real",
      "celebración nocturna en un patio con faroles y música, grupo de adultos conversando sin copas como foco",
      "retrato editorial con un ramo de flores estacionales y fondo pastel, styling contemporáneo y gesto espontáneo",
      "adulto participando en una feria cultural de temporada, puestos abstractos sin letras y paleta joya",
      "reunión íntima de adultos alrededor de una chimenea decorada con ramas, conversación natural y luz de fuego",
      "portada festiva con adultos, decoración estacional clara, alegría natural y composición abierta para una miniatura"
    ]
  },
  cannes: {
    label: "Cannes",
    themeAnchor: "glamour de la Riviera francesa con costa mediterránea, hoteles elegantes y lenguaje visual de festival cinematográfico sin logos reales",
    seoSubject: "foto de glamour estilo Cannes con una persona adulta",
    request: "un paquete de fotos estilo Cannes para adultos con glamour de Riviera, retratos editoriales, costa y noche de festival sin marcas reales",
    style: "Mediterranean red-carpet editorial photography with cinematic flash, coastal light and sophisticated human moments",
    avoid: "no repetir alfombra roja, vestido negro, palmeras, flash frontal, copa o la misma persona; no usar logos, nombres de festivales reales, celebridades, texto ni marcas",
    directions: [
      "llegada de una persona adulta a una alfombra roja ficticia frente a un hotel de la Riviera, vestido coral y flashes laterales",
      "pareja adulta elegante caminando por un paseo marítimo al amanecer, lino blanco, mar azul y gesto espontáneo",
      "retrato sentado en una terraza de hotel con sombrilla crema, traje marfil y composición de revista",
      "persona adulta en una escalera monumental de piedra, vestido azul profundo, encuadre vertical y luz de tarde",
      "grupo pequeño de adultos conversando en un lounge de festival sin logos, terciopelo verde y luz ámbar",
      "retrato en un barco moderno al atardecer, ropa de resort sofisticada, viento y horizonte mediterráneo",
      "primer plano editorial junto a una pared de flores blancas, joyería discreta y luz de flash suave",
      "persona adulta en un cine antiguo ficticio con carteles abstractos sin texto, sastrería roja oscura y luz dorada",
      "retrato nocturno en un muelle iluminado, vestido satinado color zafiro y reflejos sobre el agua",
      "escena de backstage con artista adulta completamente vestida, cortinas de terciopelo y maquillaje de cámara natural",
      "retrato en un jardín mediterráneo con fuente de piedra, traje verde oliva y sombras de hojas",
      "dos adultos brindando discretamente en una terraza marina, sin copas dominantes, vestuario blanco y negro",
      "portada estilo Cannes con glamour Riviera reconocible, sujeto adulto, arquitectura elegante y espacio negativo"
    ]
  },
  nightlife: {
    label: "Vida nocturna",
    themeAnchor: "vida nocturna urbana adulta con luces de ciudad, música, arquitectura nocturna y energía social sin convertir todas las escenas en un club",
    seoSubject: "retrato de vida nocturna urbana de una persona adulta",
    request: "un paquete de fotos de vida nocturna para adultos con calles, música, terrazas, arte y escenas sociales variadas",
    style: "cinematic urban night photography with practical lights, candid energy and varied low-light color",
    avoid: "no repetir club, neón rojo, copas, baile, taxi o la misma persona; no alcohol como foco, no texto legible, marcas, violencia ni menores",
    directions: [
      "persona adulta caminando por una calle de ciudad después de la lluvia, paraguas transparente y reflejos dorados",
      "grupo pequeño de amistades adultas escuchando música en una azotea, skyline y luces cálidas, conversación natural",
      "retrato en una librería nocturna abierta, lámparas verdes, abrigo elegante y ambiente silencioso",
      "persona adulta en una estación de metro con arquitectura brutalista, luz azul y encuadre de movimiento",
      "escena de jazz en un club íntimo, artista adulta completamente vestida y público desenfocado, sin instrumentos como único foco",
      "retrato junto a una fachada de cine independiente con marquesina abstracta sin letras, paleta ámbar y azul",
      "persona adulta en una terraza de restaurante, comida discreta, velas eléctricas y ciudad desenfocada",
      "retrato nocturno en una galería de arte con instalación luminosa, ropa plateada y sombra geométrica",
      "adultos bailando en una sala con luz violeta y ámbar, encuadre documental, vestuario distinto y alegría natural",
      "persona adulta esperando un tranvía nocturno, abrigo amarillo, luz de parada y composición con líneas profundas",
      "retrato en un mercado nocturno de comida, vapor, colores vivos y gesto espontáneo sin marcas visibles",
      "escena de conversación en el vestíbulo de un hotel, terciopelo azul, sastrería relajada y luz suave",
      "portada de vida nocturna con ciudad reconocible, adulto protagonista, energía sofisticada y composición de miniatura"
    ]
  },
  "rich-lifestyle": {
    label: "Estilo de vida premium",
    themeAnchor: "estilo de vida premium adulto con diseño, viajes, arquitectura y materiales de alta calidad, sin mostrar marcas reales ni ostentación repetitiva",
    seoSubject: "foto de estilo de vida premium de una persona adulta",
    request: "un paquete de fotos de estilo de vida premium para adultos con interiores, viajes, moda y experiencias refinadas visualmente diversas",
    style: "quiet luxury lifestyle photography with editorial restraint, tactile materials and believable aspirational moments",
    avoid: "no repetir coche de lujo, hotel, copa, traje negro, mármol o la misma persona; no logos, marcas, precios, texto legible ni ostentación vacía",
    directions: [
      "persona adulta leyendo en una biblioteca de diseño con madera oscura, camisa de lino y luz de mañana",
      "retrato en una terraza frente al mar con arquitectura minimalista, vestido arena y viento suave",
      "adulto preparando café en una cocina de piedra natural, ropa de casa elegante y luz lateral",
      "escena de viaje en una estación de tren premium, maleta lisa, abrigo camel y líneas arquitectónicas",
      "retrato junto a una piscina de hotel al amanecer, traje de baño sobrio cubierto con camisa ligera y paleta azul",
      "persona adulta en una galería privada de arte, traje verde oliva, escultura abstracta y espacio negativo",
      "comida al aire libre en un jardín mediterráneo, mesa sencilla, flores blancas y conversación de adultos",
      "retrato en un estudio de arquitectura con maquetas abstractas sin texto, sastrería clara y sombras geométricas",
      "adulto en una habitación de hotel con cortinas altas, vestido azul oscuro, maleta abierta y luz de atardecer",
      "escena de navegación en un velero contemporáneo, ropa de resort completamente cubierta y horizonte amplio",
      "retrato nocturno en un lounge de hotel, terciopelo color vino, iluminación tenue y gesto natural",
      "persona adulta caminando por una casa modernista, materiales de piedra y vidrio, encuadre documental elegante",
      "portada de estilo de vida premium con arquitectura refinada, persona adulta y composición limpia para SEO visual"
    ]
  },
  bikini: {
    label: "Bikini",
    themeAnchor: "editorial de moda de playa para adultos con bikini como prenda de verano, poses naturales, cobertura respetuosa y contexto de resort",
    seoSubject: "foto editorial de bikini con una persona adulta",
    request: "un paquete de fotos de bikini para adultos con moda de playa, resort, piscina y costa, siempre no explícito y con variedad editorial",
    style: "tasteful resort fashion photography with natural body diversity, clean composition and varied daylight",
    avoid: "no repetir pose tumbada, playa tropical, pareo, gafas de sol, fondo turquesa o la misma persona; no desnudez, sexualización explícita, menores, texto ni marcas",
    directions: [
      "persona adulta con bikini de color terracota caminando por una playa rocosa al amanecer, camisa abierta como capa y plano amplio",
      "retrato sentado junto a una piscina modernista, bikini azul marino, sombrero de ala ancha y sombras arquitectónicas",
      "escena de resort con adulto completamente cubierto por kimono ligero sobre bikini, plantas tropicales y luz difusa",
      "retrato editorial junto a una cabaña de playa, bikini verde oliva, tabla de surf sin marca y expresión natural",
      "persona adulta en una cala mediterránea con bikini blanco y camisa de lino, viento y composición lateral",
      "retrato de moda en un patio de hotel, bikini naranja, toalla texturada y luz dura de mediodía",
      "adulto leyendo en una tumbona junto a una piscina, bikini negro con pareo completo, ambiente relajado y nada sugestivo",
      "escena de paddleboard en agua tranquila, bikini coral, cuerpo en acción y paisaje dominante",
      "retrato frente a una pared de azulejos de color cobalto, bikini estampado original y encuadre gráfico",
      "persona adulta junto a una ducha exterior de piedra, bikini morado, túnica cerrada y luz de tarde",
      "retrato de grupo pequeño de adultas en un club de playa, bikinis de colores distintos y conversación espontánea",
      "escena costera al atardecer con bikini metálico sutil y chaqueta ligera, silueta natural y horizonte amplio",
      "portada de moda bikini para adultos, contexto de resort claro, cobertura elegante y composición limpia"
    ]
  },
  swimsuit: {
    label: "Bañador",
    themeAnchor: "moda de bañador para adultos en entornos de playa y piscina, con estilo deportivo o resort, cobertura natural y fotografía no explícita",
    seoSubject: "foto editorial de bañador con una persona adulta",
    request: "un paquete de fotos de bañador para adultos con estilos deportivos, resort, natación y vacaciones visualmente distintos",
    style: "modern swimwear and resort editorial photography with active movement, natural poses and diverse environments",
    avoid: "no repetir piscina azul, pose de catálogo, gorro, flotador, palmera o la misma persona; no desnudez, sexualización explícita, menores, texto ni marcas",
    directions: [
      "persona adulta con bañador entero deportivo en una piscina de arquitectura brutalista, luz de mañana y acción natural",
      "retrato en una playa de arena oscura con bañador rojo apagado y chaqueta ligera, viento y paisaje amplio",
      "adulto nadando en una piscina cubierta con ventanales altos, bañador azul, movimiento congelado y luz fría",
      "escena de vacaciones en un muelle de madera, bañador verde y camisa abierta, bolso neutro y mar tranquilo",
      "retrato de moda junto a una piscina de mosaico, bañador amarillo y toalla gráfica sin texto legible",
      "persona adulta haciendo estiramientos antes de nadar, bañador negro deportivo, jardín de hotel y luz lateral",
      "retrato en un lago de montaña, bañador de manga larga, toalla de lana y paisaje natural dominante",
      "grupo pequeño de adultos en una piscina de hotel al atardecer, bañadores de colores distintos, conversación relajada",
      "retrato editorial en una ducha exterior de piedra, bañador blanco opaco, túnica cerrada y luz dorada",
      "persona adulta practicando kayak en una costa tranquila, bañador técnico, chaleco y encuadre documental",
      "retrato junto a una caseta de playa vintage, bañador de rayas original, sombrilla y colores pastel",
      "escena de natación nocturna en piscina iluminada, bañador metalizado sobrio, reflejos y composición cinematográfica",
      "portada de moda de bañador para adultos, entorno acuático reconocible, postura natural y espacio negativo"
    ]
  },
  travel: {
    label: "Viaje",
    themeAnchor: "viaje adulto con destino reconocible por paisaje, arquitectura, transporte o actividad, sin inventar marcas ni texto turístico legible",
    seoSubject: "retrato de viaje de una persona adulta",
    request: "un paquete de fotos de viaje para adultos con escapadas urbanas, naturaleza, transporte y descubrimientos culturales variados",
    style: "editorial travel photography with documentary moments, destination texture and varied natural light",
    avoid: "no repetir maleta, aeropuerto, monumento, mapa, sombrero de viaje o la misma persona; no texto legible, logos, marcas, menores ni postales idénticas",
    directions: [
      "persona adulta caminando por una calle histórica de piedra con cámara compacta y luz de mañana",
      "retrato junto a un tren panorámico en una estación alpina, abrigo cálido, vapor y paisaje amplio",
      "adulto en un mercado costero con frutas y cerámica local sin texto, ropa ligera y color natural",
      "escena de senderismo en un valle verde, mochila pequeña, bastones y luz moteada entre árboles",
      "retrato en una terraza de azotea frente a una ciudad mediterránea, camisa de lino y puesta de sol",
      "persona adulta en una bicicleta junto a un canal urbano, arquitectura reflejada y encuadre de movimiento",
      "retrato de viaje en un ferry al amanecer, viento, chaqueta azul y horizonte marítimo dominante",
      "adulto explorando una galería de arte local, paredes coloridas, mirada curiosa y composición interior",
      "escena de picnic en un mirador de montaña, termo neutro, manta y paisaje como protagonista",
      "retrato nocturno en una calle de faroles, abrigo elegante, lluvia ligera y profundidad cinematográfica",
      "persona adulta cocinando en una clase gastronómica de viaje, ingredientes frescos y acción documental",
      "retrato junto a una casa rural de piedra, maleta pequeña, luz de tarde y vegetación local",
      "portada de viaje con destino visualmente reconocible, persona adulta, aventura y composición abierta"
    ]
  },
  soccer: {
    label: "Fútbol",
    themeAnchor: "afición adulta por el fútbol con energía de estadio, calle y comunidad, usando colores genéricos sin escudos ni marcas reales",
    seoSubject: "foto de afición al fútbol con una persona adulta",
    request: "un paquete de fotos de fútbol para aficionados adultos con estadio, entrenamiento, celebración y cultura deportiva variada",
    style: "dynamic sports lifestyle photography with documentary energy, crisp action and authentic supporter emotion",
    avoid: "no repetir estadio, camiseta, balón, bufanda, celebración de gol o la misma persona; no escudos, marcas, nombres de equipos, texto legible, violencia ni menores",
    directions: [
      "aficionado adulto en una grada genérica antes de un partido, bufanda lisa, luces del estadio y mirada expectante",
      "persona adulta jugando fútbol en una cancha urbana al atardecer, camiseta sin logos y movimiento congelado",
      "grupo de amistades adultas viendo un partido en un bar sin marcas, emoción natural y pantallas sin texto legible",
      "retrato de portero adulto entrenando bajo lluvia ligera, guantes neutros, césped y luz dramática",
      "aficionada adulta con chaqueta deportiva en una calle cercana al estadio, banderas lisas y arquitectura urbana",
      "detalle de botas y balón sobre césped húmedo, manos adultas ajustando cordones y composición baja",
      "retrato de entrenador adulto en una cancha vacía, pizarra sin texto y luz lateral de tarde",
      "celebración contenida de un grupo adulto en una plaza, camisetas de colores distintos sin escudos ni marcas",
      "jugadora adulta practicando un tiro en una cancha de barrio, contrapicado leve y cielo abierto",
      "retrato de viaje de una persona adulta llegando a un estadio, mochila, entradas sin texto y luz azul",
      "familia de adultos y amistades compartiendo una merienda previa al partido en un parque, balón desenfocado",
      "retrato nocturno de aficionado adulto bajo focos de estadio, chaqueta amarilla y expresión emocionada",
      "portada de fútbol para adultos con energía de afición, estadio genérico, colores intensos y espacio negativo"
    ]
  },
  urban: {
    label: "Urbano",
    themeAnchor: "vida urbana adulta con arquitectura, transporte, calles y ritmo de ciudad como elementos visuales claramente reconocibles",
    seoSubject: "retrato urbano de una persona adulta",
    request: "un paquete de retratos urbanos para adultos con arquitectura, desplazamientos, barrios y vida cotidiana visualmente diversa",
    style: "contemporary urban editorial photography with documentary realism, architectural framing and varied city light",
    avoid: "no repetir skyline, grafiti, metro, chaqueta negra, cruce de calle o la misma persona; no logos, texto legible, marcas ni clichés idénticos",
    directions: [
      "persona adulta cruzando una avenida de arquitectura moderna al amanecer, abrigo claro y líneas de fuga",
      "retrato en una cafetería de barrio con grandes ventanales, portátil sin texto y luz de lluvia",
      "adulto esperando un autobús bajo una marquesina transparente, ropa amarilla y reflejos urbanos",
      "persona adulta en una escalera de hormigón, styling monocromático y composición geométrica",
      "retrato caminando junto a un canal urbano, bicicleta, árboles y luz cálida de tarde",
      "escena en un mercado de barrio, bolsas lisas, frutas y conversación natural con el entorno",
      "retrato en una azotea con edificios residenciales, camisa azul, cielo amplio y viento",
      "persona adulta de pie en una azotea urbana abierta al atardecer, pavimento húmedo, arquitectura brutalista y composición ambiental de cuerpo entero",
      "retrato junto a un mural abstracto sin texto, ropa naranja y sombra fuerte de mediodía",
      "adulto trabajando en un estudio creativo urbano, materiales desenfocados y gesto concentrado",
      "escena nocturna en una plaza iluminada, grupo pequeño de adultos y arquitectura como protagonista",
      "retrato en una librería de esquina, estantes, luz cálida y expresión curiosa",
      "portada urbana con adulto protagonista, ciudad reconocible, arquitectura y composición limpia"
    ]
  },
  "street-style": {
    label: "Estilo callejero",
    themeAnchor: "moda street-style adulta con prendas, capas, textura y actitud personal en entornos urbanos reales",
    seoSubject: "foto de moda street-style con una persona adulta",
    request: "un paquete de fotos street-style para adultos con moda urbana, accesorios, movimiento y barrios de distintas atmósferas",
    style: "contemporary street fashion editorial photography with candid movement, tactile clothing and varied urban backdrops",
    avoid: "no repetir sudadera, pared de ladrillo, zapatillas, pose frontal, paleta negra o la misma persona; no logos, marcas, texto legible ni prendas copiadas",
    directions: [
      "retrato de moda adulta en una calle de piedra, gabardina verde, botas y luz de mañana",
      "persona adulta con chaqueta acolchada naranja bajo un paso elevado, encuadre dinámico y sombras geométricas",
      "look monocromático crema en una plaza modernista, bolso neutro y pose relajada de cuerpo entero",
      "retrato con denim y accesorios plateados junto a un escaparate abstracto sin letras, luz azul de tarde",
      "persona adulta con prendas deportivas de diseño caminando por una pista de skate, movimiento natural",
      "styling de sastrería amplia en una estación ferroviaria, maleta lisa y líneas arquitectónicas",
      "retrato con falda estampada y botas en un mercado cubierto, textura de puestos y luz cálida",
      "look de capas de punto en una calle lluviosa, paraguas transparente, reflejos y expresión espontánea",
      "persona adulta con chaqueta de cuero vegano en una azotea, skyline y viento, paleta burdeos y azul",
      "retrato editorial junto a una pared de azulejos, pantalón ancho, gafas originales y sombra dura",
      "grupo pequeño de adultos con estilos distintos en una plaza, interacción natural y composición documental",
      "retrato nocturno de moda con abrigo metálico, luces urbanas desenfocadas y encuadre vertical",
      "portada street-style con moda adulta original, entorno urbano claro, actitud personal y espacio negativo"
    ]
  },
  mafia: {
    label: "Noir cinematográfico",
    themeAnchor: "estética noir cinematográfica adulta con sastrería, arquitectura histórica, sombras y misterio ficticio sin violencia ni armas",
    seoSubject: "retrato noir cinematográfico de una persona adulta",
    request: "un paquete de retratos noir para adultos con misterio, sastrería, interiores dramáticos y narrativa visual ficticia no violenta",
    style: "cinematic neo-noir editorial photography with controlled shadows, period texture and sophisticated fictional storytelling",
    avoid: "no repetir pistola, humo, coche negro, club, sombrero fedora o la misma persona; no armas, violencia, sangre, delito explícito, logos, texto ni menores",
    directions: [
      "persona adulta con sastrería gris en un vestíbulo art déco, luz de persiana y expresión enigmática",
      "retrato junto a una ventana lluviosa en un hotel histórico, vestido verde oscuro y reflejos ámbar",
      "adulto caminando por una calle de piedra con gabardina clara, faroles y sombras largas, sin armas",
      "escena de conversación entre adultos en una biblioteca antigua, trajes distintos, mesa sin objetos peligrosos",
      "retrato en una estación de tren de época, maleta lisa, luz azul y composición de película",
      "persona adulta en un restaurante ficticio de mediados de siglo, mesa vacía, terciopelo y luz lateral",
      "retrato de grupo pequeño de adultos en una galería privada, sastrería variada y misterio social no violento",
      "adulto junto a un coche clásico sin marca, lluvia suave, abrigo beige y reflejos de ciudad",
      "retrato en una escalera de mármol, vestido negro opaco, luz cenital y composición vertical",
      "persona adulta escribiendo en un cuaderno sin texto visible dentro de un despacho con madera oscura",
      "escena nocturna en un teatro vacío, adulto con traje azul, butacas rojas y luz de escenario",
      "retrato frente a una pared de ladrillo y persianas venecianas, camisa blanca y sombra gráfica",
      "portada noir cinematográfica con adulto elegante, misterio ficticio, arquitectura histórica y espacio negativo"
    ]
  },
  "hairstyle-generator": {
    label: "Generador de peinados",
    themeAnchor: "transformación editorial del cabello con peinados claramente visibles, acabado realista y variedad de identidades adultas",
    seoSubject: "foto de peinado generado con IA",
    request: "un paquete de ejemplos de generación de peinados para adultos con cortes, texturas, longitudes y acabados visualmente distintos",
    style: "high-end hair editorial photography with realistic strands, believable volume and varied portrait direction",
    avoid: "no repetir rostro, corte, color de cabello, fondo, encuadre o pose; no texto legible, logos, marcas, menores ni anatomía deformada",
    directions: [
      "retrato de una persona adulta con bob geométrico negro azabache, fondo coral y luz de estudio lateral",
      "persona adulta con rizos naturales voluminosos color castaño, jardín urbano y luz de mañana",
      "retrato de perfil con cabello plateado corto y textura definida, fondo gris mineral y sombra limpia",
      "persona adulta con trenza escultórica larga y accesorios textiles neutros, taller artístico y luz cálida",
      "retrato editorial con corte pixie cobrizo, chaqueta verde y arquitectura moderna desenfocada",
      "cabello ondulado rubio miel movido por el viento en una terraza costera, encuadre amplio y luz dorada",
      "persona adulta con moño alto pulido y flequillo suave, vestuario negro minimalista y fondo azul profundo",
      "retrato de cabello afro corto con forma artística, ropa de color cobalto y sombras geométricas",
      "persona adulta con melena larga azul oscuro en una calle nocturna, reflejos violetas y gesto espontáneo",
      "peinado semirrecogido con flores pequeñas no repetidas en un estudio botánico, luz difusa y piel natural",
      "retrato de una persona adulta con cabello rizado corto y mechas cobre, cafetería luminosa y composición documental",
      "cabello liso muy largo con raya central y acabado editorial, espejo abstracto sin texto y luz de atardecer",
      "portada de generador de peinados con adulto protagonista, cabello distintivo, fondo limpio y espacio negativo"
    ]
  },
  "virtual-try-on": {
    label: "Probador virtual",
    themeAnchor: "visualización realista de prendas sobre adultos con ajuste natural, styling completo y variedad de contextos de moda",
    seoSubject: "foto de probador virtual con ropa para adultos",
    request: "un paquete de ejemplos de probador virtual con conjuntos de moda adultos, siluetas, tejidos y escenarios diversos sin marcas visibles",
    style: "contemporary fashion try-on editorial photography with believable garment fit, tactile fabrics and varied body language",
    avoid: "no repetir prenda, silueta, pose, modelo, espejo, fondo o paleta; no logos, marcas, texto legible, menores ni desnudez",
    directions: [
      "persona adulta con traje sastre color marfil en un estudio de espejos abstractos, pose relajada de cuerpo entero",
      "persona adulta con abrigo acolchado naranja en una calle fría, capas visibles y movimiento natural",
      "modelo adulto con vestido satinado verde en un vestíbulo art déco, luz cálida y encuadre vertical",
      "persona adulta con conjunto denim y botas en una plaza modernista, luz azul de tarde y actitud espontánea",
      "adulto con ropa deportiva neutra en una pista de atletismo, gesto dinámico y prendas claramente visibles",
      "persona adulta con chaqueta de lino y pantalón ancho en un mercado mediterráneo, viento suave y colores arena",
      "modelo adulto con falda plisada y jersey azul en una librería, escaleras y textura de tejido en primer plano",
      "persona adulta con impermeable amarillo bajo lluvia urbana, paraguas transparente y reflejos de pavimento",
      "pareja de adultos con looks formales distintos en una terraza nocturna, skyline y sastrería sin marcas",
      "persona adulta con prendas de punto en una cabaña de montaña, chimenea y composición editorial cálida",
      "modelo adulto con conjunto monocromático violeta en una galería blanca, sombras limpias y pose asimétrica",
      "persona adulta con camisa estampada y pantalón verde en un jardín botánico, luz filtrada y movimiento de tela",
      "portada de probador virtual con adulto vestido con un look contemporáneo, fondo claro y espacio para diseño"
    ]
  },
  "motion-generator": {
    label: "Generador de movimiento",
    themeAnchor: "movimiento corporal congelado con energía fotográfica, gesto legible y sensación de acción realista",
    seoSubject: "foto de movimiento generada con IA",
    request: "un paquete de ejemplos de generación de movimiento para adultos con danza, deporte, desplazamiento y gestos espontáneos claramente distintos",
    style: "dynamic motion photography with controlled shutter effects, crisp anatomy and varied action storytelling",
    avoid: "no repetir acción, dirección de movimiento, fondo, vestuario o persona; no manos deformes, texto, logos, violencia ni menores",
    directions: [
      "adulto bailando en un estudio amplio con tela azul en movimiento, salto lateral y luz de ventana",
      "persona adulta corriendo por una playa al amanecer, arena levantándose y encuadre de cuerpo entero",
      "bailarina adulta girando en un teatro vacío, vestido rojo oscuro y movimiento de falda congelado",
      "ciclista adulto pasando por una calle urbana, reflejos de lluvia y sensación de velocidad sin marcas",
      "persona adulta lanzando una pelota en una cancha de barrio, gesto atlético y cielo abierto",
      "adulto saltando sobre un charco en una plaza, abrigo amarillo y gotas detenidas en el aire",
      "persona adulta practicando una pose de yoga junto al mar, equilibrio claro y viento en la ropa",
      "grupo pequeño de adultos bailando en una sala de ensayo, posiciones distintas y luz magenta suave",
      "adulto girando con una chaqueta amplia en una azotea, skyline y composición diagonal",
      "persona adulta remando en un lago tranquilo, salpicadura de agua y paisaje amplio",
      "retrato de movimiento de una persona adulta tocando batería en un estudio, baquetas nítidas y luz dramática",
      "adulto descendiendo una escalera de hormigón, ropa en movimiento y sombras geométricas",
      "portada de generador de movimiento con acción adulta inequívoca, composición limpia y espacio negativo"
    ]
  },
  "background-changer": {
    label: "Cambiador de fondo",
    themeAnchor: "sujeto principal integrado de forma natural en un entorno nuevo con perspectiva, luz y escala coherentes",
    seoSubject: "foto con fondo cambiado mediante IA",
    request: "un paquete de ejemplos de cambio de fondo para adultos y objetos con integraciones ambientales variadas, sin comparativas divididas ni interfaces",
    style: "photorealistic compositing with natural edge integration, coherent lighting and varied editorial environments",
    avoid: "no collage, antes y después, pantalla de aplicación, halo artificial, fondo repetido, texto, logos ni marcas",
    directions: [
      "retrato de una persona adulta integrada en una biblioteca histórica con luz de ventana y sombras coherentes",
      "persona adulta en una playa volcánica al amanecer, viento en el cabello y horizonte realista",
      "adulto vestido de forma urbana integrado en una estación de metro moderna sin texto legible",
      "retrato de una persona adulta en un invernadero tropical, reflejos verdes y humedad natural",
      "modelo adulto integrado en una azotea de ciudad al atardecer, luz dorada sobre la ropa",
      "persona adulta en un estudio de cerámica, polvo de arcilla y luz lateral que coincide con el sujeto",
      "adulto sentado en una cafetería retro, profundidad de campo y reflejos de neón creíbles",
      "persona adulta integrada en un sendero nevado de montaña, abrigo grueso y luz fría uniforme",
      "retrato de una persona adulta en una galería de arte minimalista, escala arquitectónica clara",
      "adulto junto a una piscina de hotel, reflejos de agua y luz de mediodía natural",
      "persona adulta en una calle de carnaval nocturno, luces desenfocadas y exposición coherente",
      "adulto integrado en un despacho creativo con plantas y madera, sombras suaves y ambiente documental",
      "portada de cambio de fondo con sujeto adulto claramente integrado en un escenario nuevo, composición limpia"
    ]
  },
  "background-remover": {
    label: "Eliminador de fondo",
    themeAnchor: "sujeto recortado con bordes limpios, silueta completa y separación visual clara sobre un fondo neutro",
    seoSubject: "foto con fondo eliminado mediante IA",
    request: "un paquete de ejemplos de eliminación de fondo con personas adultas, productos y objetos diversos presentados con contornos precisos",
    style: "clean product and portrait cutout photography with crisp edges, natural proportions and restrained studio presentation",
    avoid: "no halo, bordes dentados, fondo complejo, collage, cuadrícula de transparencia, texto, logos, marcas ni menores",
    directions: [
      "persona adulta de cuerpo entero con abrigo largo, recorte limpio sobre fondo gris claro y sombra suave",
      "bicicleta urbana sin marca aislada sobre fondo azul pálido, ruedas completas y detalle nítido",
      "silla de diseño de madera aislada sobre fondo crema, contorno preciso y luz lateral suave",
      "persona adulta con vestido amarillo y bolso neutro, silueta completa sobre fondo lila uniforme",
      "par de zapatillas deportivas sin logos aisladas sobre fondo verde salvia, composición de producto",
      "planta tropical en maceta de cerámica, hojas separadas con bordes naturales sobre fondo blanco cálido",
      "adulto con guitarra sin marca en pose de pie, cuerpo e instrumento completamente visibles sobre fondo carbón",
      "cámara fotográfica genérica aislada sobre fondo naranja mate, detalles de botones sin texto legible",
      "persona adulta con bicicleta plegable, recorte de brazos y radios limpio sobre fondo azul cielo",
      "lámpara de mesa escultórica aislada sobre fondo terracota, cable discreto y sombra de contacto",
      "bicicleta plegable urbana aislada sobre fondo azul cobalto, ruedas y cuadro completos con sombra suave",
      "ramo de flores silvestres en jarrón neutro aislado sobre fondo verde oscuro, tallos definidos",
      "lámpara de pie escultórica aislada sobre fondo terracota profundo, silueta completa y sombra de contacto"
    ]
  },
  "magic-eraser": {
    label: "Borrador mágico",
    themeAnchor: "retoque invisible que elimina un elemento no deseado y conserva textura, perspectiva y continuidad del entorno",
    seoSubject: "foto retocada con borrador mágico de IA",
    request: "un paquete de ejemplos de borrado mágico con escenas cotidianas limpias, cada una con un retoque editorial distinto y sin comparativa antes-después",
    style: "natural photo editing with seamless texture reconstruction, believable perspective and documentary realism",
    avoid: "no pantalla de edición, no split screen, no manchas de clonación, no texto, logos, marcas, violencia ni personas menores",
    directions: [
      "plaza histórica despejada de un objeto pequeño, piedra y sombras continuas bajo luz de mañana",
      "playa con arena y huellas reconstruidas de forma natural, adulto caminando al fondo sin pose rígida",
      "cafetería con mesa limpia y decoración coherente, persona adulta leyendo sin texto visible",
      "sendero de bosque con vegetación continua tras borrar un elemento distractor, luz moteada natural",
      "retrato urbano junto a una pared de ladrillo con textura uniforme y arquitectura intacta",
      "mercado cubierto con espacio de suelo limpio y puestos desenfocados, composición documental",
      "salón doméstico con alfombra y madera continuas, adulto sentado y ambiente natural",
      "puente peatonal sobre un río con barandilla y reflejos reconstruidos, cielo nublado",
      "galería de arte con pared blanca y suelo continuo, persona adulta observando una obra abstracta",
      "jardín botánico con hojas y sendero visualmente continuos, luz verde y profundidad realista",
      "calle lluviosa con pavimento y reflejos conservados, adulto con paraguas sin texto legible",
      "mesa de trabajo artesanal ordenada, manos adultas y materiales con textura reconstruida",
      "portada de borrador mágico con escena limpia y retoque invisible, sin interfaz ni comparativa"
    ]
  },
  "photo-enhancer": {
    label: "Mejorador de fotos",
    themeAnchor: "mejora visible de detalle, rango dinámico y textura sin perder naturalidad ni inventar rasgos",
    seoSubject: "foto mejorada con IA",
    request: "un paquete de ejemplos de mejora fotográfica para retratos, paisajes, interiores y objetos con nitidez y luz realistas",
    style: "premium photo enhancement with natural detail recovery, balanced dynamic range and realistic photographic texture",
    avoid: "no piel plástica, halos, sobreenfoque, ruido artificial, texto, logos, marcas, collage ni comparativa antes-después",
    directions: [
      "retrato adulto con detalle natural de piel y cabello en luz de ventana suave, fondo doméstico",
      "paisaje costero con nubes y agua recuperadas, luz de amanecer y profundidad atmosférica",
      "interior de biblioteca con sombras y madera detalladas, exposición equilibrada y ambiente cálido",
      "fotografía nocturna de una calle con luces puntuales limpias, reflejos realistas y poco ruido",
      "retrato de una persona adulta en contraluz con rango dinámico amplio y cabello separado del fondo",
      "detalle de una bicicleta urbana con metal y goma nítidos, fondo desenfocado y luz lateral",
      "fotografía de un mercado de frutas con colores naturales, texturas frescas y composición documental",
      "interior de una cabaña con chimenea, tejidos y madera definidos sin aspecto artificial",
      "retrato de grupo pequeño de adultos con rostros distintos, luz uniforme y anatomía natural",
      "fachada arquitectónica histórica con piedra, ventanas y cielo recuperados, perspectiva limpia",
      "escena de lluvia urbana con gotas, pavimento y luces reflejadas sin halos",
      "objeto artesanal de cerámica con esmalte y pequeñas imperfecciones visibles, fondo neutro",
      "portada de mejorador de fotos con detalle natural, luz equilibrada y composición editorial"
    ]
  },
  "portrait-retouch": {
    label: "Retoque de retrato",
    themeAnchor: "retoque de retrato natural que conserva identidad, textura de piel, expresión y rasgos individuales",
    seoSubject: "retrato retocado con IA",
    request: "un paquete de ejemplos de retoque de retrato para adultos con piel realista, iluminación cuidada y estilos editoriales variados",
    style: "natural beauty retouching with visible skin texture, refined lighting and authentic facial identity",
    avoid: "no rostro plástico, ojos irreales, cambio de identidad, piel porcelana, texto, marcas, menores ni glamour idéntico",
    directions: [
      "retrato adulto de belleza natural junto a una ventana, piel real y fondo crema suave",
      "persona adulta con pecas visibles en un jardín, luz moteada y sonrisa espontánea",
      "retrato masculino adulto con barba natural en un taller, luz lateral y textura editorial",
      "persona adulta mayor con arrugas expresivas en un interior cálido, dignidad y detalle realista",
      "retrato de moda con maquillaje sutil y fondo azul profundo, rasgos individuales preservados",
      "persona adulta con cabello rizado en una terraza de ciudad, viento suave y piel natural",
      "retrato en blanco y negro de adulto con sombras de persiana, contraste elegante y expresión serena",
      "persona adulta riendo en una cafetería, luz de tungsteno y retoque discreto de piel",
      "retrato de perfil con luz dorada de atardecer, poros y cabello definidos sin exageración",
      "adulto con gafas originales en una biblioteca, reflejos controlados y ojos naturales",
      "retrato de una persona adulta en un estudio rojo oscuro, luz de borde y textura de maquillaje real",
      "retrato documental de adulto en un mercado, expresión concentrada y corrección cromática suave",
      "portada de retoque de retrato con identidad adulta clara, piel realista y espacio negativo"
    ]
  },
  "unblur-image": {
    label: "Enfocar imagen",
    themeAnchor: "recuperación de enfoque con detalles definidos en el sujeto principal y bordes naturales sin sobreprocesado",
    seoSubject: "foto enfocada y nítida con IA",
    request: "un paquete de ejemplos de enfoque y recuperación de nitidez para escenas adultas, movimiento, naturaleza y objetos con detalles claros",
    style: "natural sharpening and focus recovery with crisp subject detail, controlled depth and believable optical character",
    avoid: "no halos, bordes dentados, textura inventada, texto ilegible convertido en texto falso, logos, collage ni antes-después",
    directions: [
      "retrato adulto nítido en una calle al amanecer, ojos y cabello definidos con fondo suave",
      "bicicleta en movimiento congelada en una avenida, radios y textura de neumático claros",
      "persona adulta tocando una guitarra en un escenario, manos y cuerdas enfocadas sin marcas",
      "perro de compañía corriendo por un parque, pelaje y patas definidos, sin personas menores",
      "detalle de manos adultas trabajando arcilla, dedos y material enfocados con fondo industrial",
      "paisaje de montaña con pinos y roca nítidos, niebla de profundidad natural",
      "fotografía nocturna de un tranvía sin texto legible, luces y estructura definidas",
      "retrato de adulto bajo lluvia, gotas en el abrigo y rostro enfocado con bokeh realista",
      "plato artesanal de cerámica sobre madera, esmalte y pequeñas imperfecciones nítidas",
      "bailarina adulta en salto, vestido y postura definidos contra un teatro desenfocado",
      "fachada de edificio histórico con piedra y ventanas enfocadas, cielo claro y líneas rectas",
      "persona adulta en una feria nocturna, rostro y luces de fondo con profundidad controlada",
      "cámara fotográfica vintage nítida sobre mesa de madera, lente y diales definidos con luz de estudio"
    ]
  },
  "color-correction": {
    label: "Corrección de color",
    themeAnchor: "color corregido y equilibrado con tonos de piel y materiales naturales, además de una dirección cromática reconocible",
    seoSubject: "foto con corrección de color mediante IA",
    request: "un paquete de ejemplos de corrección de color para retratos, viajes, interiores y escenas urbanas con paletas visualmente variadas",
    style: "editorial color grading with accurate skin tones, intentional palette design and believable light response",
    avoid: "no dominante accidental, piel naranja o verde, saturación extrema, texto, logos, marcas ni repetir una sola paleta",
    directions: [
      "retrato adulto con corrección cálida de amanecer, tonos de piel naturales y fondo de piedra",
      "costa con paleta azul y arena equilibrada, espuma blanca y luz limpia de mediodía",
      "interior de cafetería con tonos ámbar y petróleo, piel realista y sombras profundas",
      "calle urbana nocturna con neón magenta y cian controlado, reflejos húmedos y exposición creíble",
      "paisaje otoñal con verdes musgo y naranjas suaves, árboles y persona adulta en armonía",
      "retrato en blanco y negro con escala de grises rica, textura de piel y luz lateral",
      "mercado mediterráneo con amarillos, turquesas y terracotas naturales, adultos en escena",
      "interior de museo con blancos neutros, acentos rojos y sombras geométricas precisas",
      "montaña nevada con azules fríos y tonos de madera cálidos, adulto con abrigo neutro",
      "jardín botánico con verdes profundos y piel equilibrada, luz filtrada entre hojas",
      "retrato de moda con paleta violeta y dorada, tejidos visibles y contraste editorial",
      "escena lluviosa con grises, azul petróleo y luces amarillas controladas, adulto con paraguas",
      "portada de corrección de color con paleta intencional, sujeto adulto y espacio negativo"
    ]
  },
  "old-photo-restoration": {
    label: "Restauración de fotos antiguas",
    themeAnchor: "restauración fotográfica histórica con detalle recuperado, textura del papel conservada y apariencia de época creíble",
    seoSubject: "foto antigua restaurada con IA",
    request: "un paquete de ejemplos de restauración de fotografías antiguas con retratos, calles, viajes y escenas familiares sin texto legible",
    style: "careful archival photo restoration with period-appropriate tonality, repaired detail and authentic film texture",
    avoid: "no aspecto digital moderno, rostros inventados, texto legible, logos, marcas, menores como sujetos principales ni collage antes-después",
    directions: [
      "retrato de una pareja adulta en un estudio de principios del siglo XX, blanco y negro restaurado",
      "calle europea antigua con tranvía y adultos caminando, papel fotográfico reparado y tonos sepia",
      "viajero adulto junto a una estación histórica, maleta de época y grano de película natural",
      "familia de adultos reunida en un jardín de mediados de siglo, color restaurado suavemente",
      "retrato de una persona adulta con sombrero de época frente a una fachada antigua, contraste recuperado",
      "escena de playa de archivo con adultos vestidos de época, cielo y agua restaurados en tonos suaves",
      "mercado histórico con puestos y adultos, detalle de madera y tejido sin texto visible",
      "interior de una sala antigua con adulto junto a un piano, barniz y sombras reconstruidos",
      "fotografía de viaje en una plaza mediterránea, arquitectura y cielo con colorización discreta",
      "retrato de adulto trabajador en un taller de época, herramientas y manos con detalle recuperado",
      "escena de picnic de adultos en un parque antiguo, manta, árboles y película cálida restaurada",
      "retrato formal de una persona adulta frente a cortina de estudio, textura de papel conservada",
      "portada de restauración de foto antigua con imagen histórica creíble, bordes limpios y espacio negativo"
    ]
  },
  "edit-by-prompt": {
    label: "Editar con instrucciones",
    themeAnchor: "edición creativa guiada por instrucciones con cambios visuales claros y resultado fotográfico coherente",
    seoSubject: "foto editada con instrucciones mediante IA",
    request: "un paquete de ejemplos de edición fotográfica por instrucciones para adultos, objetos y entornos con transformaciones creativas variadas",
    style: "controlled generative photo editing with coherent geometry, natural lighting and editorial storytelling",
    avoid: "no interfaz, no texto legible, no logos, no collage, no cambios contradictorios, no anatomía deformada ni personajes con copyright",
    directions: [
      "convertir un retrato adulto de estudio en una escena de jardín botánico al amanecer, integración de luz natural",
      "editar una calle urbana para añadir lluvia suave y reflejos, manteniendo arquitectura y proporciones reales",
      "transformar un vestuario adulto neutro en sastrería esmeralda, tejido y caída de tela creíbles",
      "cambiar una sala vacía por un estudio de cerámica con herramientas desenfocadas, composición coherente",
      "editar una escena de playa para incluir una cometa colorida sin texto, viento y sombras consistentes",
      "convertir un retrato de día en una escena nocturna con luces de feria y exposición cinematográfica",
      "añadir hojas otoñales y luz dorada a una plaza, conservando el adulto y la arquitectura original",
      "editar un objeto artesanal para situarlo en una mesa de madera con materiales compatibles y escala realista",
      "transformar una azotea urbana en una terraza costera, horizonte y brisa visualmente coherentes",
      "cambiar el color dominante de una habitación a azul petróleo con iluminación y piel naturales",
      "editar un retrato adulto para añadir gafas de diseño sin marca, reflejos correctos y expresión intacta",
      "convertir una escena de interior en una fotografía editorial de museo, paredes, sombras y sujeto coherentes",
      "portada de edición por instrucciones con transformación visible, resultado fotográfico limpio y espacio negativo"
    ]
  },
  "social-cards": {
    label: "Tarjetas para redes",
    themeAnchor: "composición visual lista para redes con sujeto claro, jerarquía de imagen y espacio negativo para diseño posterior",
    seoSubject: "imagen para tarjeta de redes sociales generada con IA",
    request: "un paquete de visuales para tarjetas de redes sociales con retratos, productos, viajes y campañas de estilos diversos sin texto incrustado",
    style: "social-first editorial photography with thumbnail clarity, intentional negative space and varied campaign moods",
    avoid: "no texto legible, hashtags, logotipos, marcas, interfaz de red social, composición repetida ni collage",
    directions: [
      "retrato adulto luminoso en un estudio coral, sujeto a la derecha y espacio negativo limpio a la izquierda",
      "taza artesanal y cuaderno sin texto sobre mesa azul, composición cenital y zona libre para diseño",
      "persona adulta caminando por una costa, horizonte amplio y espacio de cielo para una tarjeta visual",
      "producto de belleza genérico sobre piedra y hojas, luz suave y composición vertical de campaña",
      "grupo pequeño de adultos celebrando en una terraza, encuadre abierto y zona superior despejada",
      "retrato de moda urbana con fondo de color intenso, sujeto lateral y espacio negativo geométrico",
      "paisaje de montaña con viajero adulto pequeño en la escena, profundidad y cielo limpio",
      "plato de comida artesanal sin texto ni marca, mesa de madera y composición editorial cuadrada",
      "creador adulto en un escritorio minimalista con cámara sin marca, luz de ventana y espacio lateral",
      "escena nocturna de ciudad con luces desenfocadas, adulto en silueta y área oscura para diseño",
      "ramo silvestre en jarrón neutro, fondo crema y composición de producto con respiración visual",
      "persona adulta en un museo contemporáneo, arquitectura y figura separadas con espacio negativo",
      "bodegón editorial de jarrón cerámico azul y frasco de fragancia sin etiqueta, espacio negativo para diseño"
    ]
  }
};

const FRENCH_THEME_COPY = {
  "hairstyle-generator": {
    label: "Générateur de coiffure",
    themeAnchor: "une transformation capillaire éditoriale où la coupe, la couleur et la texture sont immédiatement lisibles",
    seoSubject: "portrait adulte avec coiffure générée par IA",
    request: "un ensemble de coiffures adultes avec coupes, textures, longueurs et finitions clairement différentes",
    style: "photographie éditoriale de salon haut de gamme, mèches réalistes, volume naturel et traitements de portrait variés",
    avoid: "ne pas répéter le visage, la coupe, la couleur, le décor, le cadrage ou la pose; aucun texte, logo, mineur ni anatomie déformée"
  },
  "virtual-try-on": {
    label: "Essayage virtuel",
    themeAnchor: "une visualisation réaliste de vêtements adultes avec une coupe crédible, un styling complet et des contextes de mode variés",
    seoSubject: "photo d'essayage virtuel de vêtements pour adulte",
    request: "un ensemble de looks adultes avec silhouettes, tissus, lieux et attitudes de mode différents, sans marque visible",
    style: "photographie de mode contemporaine, matières tactiles, ajustement crédible et langage corporel varié",
    avoid: "ne pas répéter le vêtement, la silhouette, la pose, le modèle, le miroir, le décor ou la palette; aucun logo, texte ni nudité"
  },
  "motion-generator": {
    label: "Générateur de mouvement",
    themeAnchor: "un mouvement corporel figé avec un geste lisible, une anatomie naturelle et une véritable sensation d'action",
    seoSubject: "photo de mouvement générée par IA",
    request: "un ensemble de photos de mouvement pour adultes avec danse, sport, déplacement et gestes spontanés distincts",
    style: "photographie dynamique, vitesse maîtrisée, anatomie nette et récits d'action variés",
    avoid: "ne pas répéter l'action, la direction, le décor, la tenue ou la personne; aucune main déformée, violence, marque ou mineur"
  },
  "background-changer": {
    label: "Changer l'arrière-plan",
    themeAnchor: "un sujet principal intégré naturellement dans un nouvel environnement avec perspective, lumière et échelle cohérentes",
    seoSubject: "photo avec arrière-plan changé par IA",
    request: "un ensemble d'exemples de changement d'arrière-plan pour adultes et objets dans des environnements éditoriaux variés",
    style: "compositing photoréaliste, contours naturels, lumière cohérente et scènes d'environnement diversifiées",
    avoid: "aucun collage, avant-après, écran d'application, halo artificiel, texte, logo ou marque"
  },
  "background-remover": {
    label: "Suppression d'arrière-plan",
    themeAnchor: "un sujet ou un produit détouré avec des contours propres, une silhouette complète et une séparation claire",
    seoSubject: "photo avec arrière-plan supprimé par IA",
    request: "un ensemble de détourages de personnes adultes, produits et objets avec des contours précis et des présentations variées",
    style: "photographie studio de produit et de portrait, bords nets, proportions naturelles et présentation sobre",
    avoid: "aucun halo, bord dentelé, fond complexe, collage, grille de transparence, texte, logo ou marque"
  },
  "magic-eraser": {
    label: "Gomme magique",
    themeAnchor: "un élément indésirable effacé de façon invisible tout en conservant texture, perspective et continuité du décor",
    seoSubject: "photo retouchée avec la gomme magique IA",
    request: "un ensemble de retouches d'effacement dans des scènes quotidiennes avec des reconstructions de texture différentes",
    style: "retouche naturelle, reconstruction crédible des surfaces et réalisme documentaire",
    avoid: "aucune interface, comparaison avant-après, trace de clonage, texte, logo, marque ou violence"
  },
  "photo-enhancer": {
    label: "Amélioration photo",
    themeAnchor: "une récupération naturelle des détails, de la dynamique et de la texture sans inventer les traits du sujet",
    seoSubject: "photo améliorée par IA",
    request: "un ensemble d'exemples d'amélioration pour portraits, paysages, intérieurs et objets avec netteté naturelle",
    style: "amélioration photographique premium, détails récupérés, plage dynamique équilibrée et texture réaliste",
    avoid: "aucune peau plastique, halo, suraccentuation, bruit artificiel, texte, logo, marque ou comparaison"
  },
  "portrait-retouch": {
    label: "Retouche de portrait",
    themeAnchor: "un portrait retouché avec naturel qui conserve identité, texture de peau, expression et traits individuels",
    seoSubject: "portrait adulte retouché par IA",
    request: "un ensemble de retouches de portraits adultes avec lumières, décors et traitements éditoriaux variés",
    style: "retouche beauté naturelle, texture de peau visible, lumière raffinée et identité authentique",
    avoid: "aucun visage plastique, changement d'identité, peau porcelaine, texte, marque, mineur ou glamour uniforme"
  },
  "unblur-image": {
    label: "Rendre une image plus nette",
    themeAnchor: "une récupération de netteté avec détails définis sur le sujet principal et bords naturels sans surtraitement",
    seoSubject: "photo nette et mise au point par IA",
    request: "un ensemble d'exemples de récupération de netteté pour portraits, mouvement, nature et objets",
    style: "accentuation naturelle, détails du sujet précis, profondeur contrôlée et caractère optique crédible",
    avoid: "aucun halo, bord dentelé, texture inventée, faux texte, logo, collage ou comparaison avant-après"
  },
  "color-correction": {
    label: "Correction des couleurs",
    themeAnchor: "une couleur équilibrée avec des tons de peau et de matière naturels, plus une direction chromatique reconnaissable",
    seoSubject: "photo avec correction des couleurs par IA",
    request: "un ensemble de corrections colorimétriques pour portraits, voyages, intérieurs et scènes urbaines variés",
    style: "étalonnage éditorial, tons de peau justes, palette intentionnelle et réponse lumineuse crédible",
    avoid: "aucune dominante accidentelle, peau orange ou verte, saturation extrême, texte, logo ou marque"
  },
  "old-photo-restoration": {
    label: "Restauration de photos anciennes",
    themeAnchor: "une restauration historique avec détails récupérés, texture du papier préservée et tonalité d'époque crédible",
    seoSubject: "photo ancienne restaurée par IA",
    request: "un ensemble de restaurations de portraits, rues, voyages et scènes familiales anciennes",
    style: "restauration d'archives soignée, tonalité adaptée à l'époque, détails réparés et grain authentique",
    avoid: "aucun rendu numérique moderne, visage inventé, texte lisible, logo, marque ou collage avant-après"
  },
  "edit-by-prompt": {
    label: "Modifier avec une consigne",
    themeAnchor: "une modification créative guidée par une consigne avec changement visible et photographie cohérente",
    seoSubject: "photo modifiée avec une consigne par IA",
    request: "un ensemble d'exemples de modification d'images pour adultes, objets et environnements avec transformations variées",
    style: "édition générative contrôlée, géométrie cohérente, lumière naturelle et narration éditoriale",
    avoid: "aucune interface, texte, logo, collage, changement contradictoire, anatomie déformée ou personnage protégé"
  },
  "social-cards": {
    label: "Cartes sociales",
    themeAnchor: "une composition lisible en miniature avec sujet clair, hiérarchie visuelle et espace négatif destiné au design",
    seoSubject: "visuel pour carte de réseau social généré par IA",
    request: "un ensemble de visuels pour réseaux sociaux avec portraits, produits, voyages et campagnes très variés",
    style: "photographie éditoriale pensée pour les réseaux, espace négatif intentionnel et ambiances de campagne variées",
    avoid: "aucun texte lisible, hashtag, logo, marque, interface sociale, composition répétée ou collage"
  }
};

const FRENCH_ALT_SCENES = {
  "hairstyle-generator": [
    "carré noir géométrique en studio corail",
    "boucles brunes volumineuses dans un jardin urbain",
    "cheveux courts argentés photographiés de profil",
    "tresse sculpturale dans un atelier chaleureux",
    "coupe pixie cuivrée devant une architecture moderne",
    "chevelure ondulée blond miel sur une terrasse côtière",
    "chignon haut et frange douce sur fond bleu",
    "cheveux afro courts avec ombres géométriques",
    "longue chevelure bleu nuit dans une rue éclairée",
    "demi-attache fleurie dans un studio botanique",
    "boucles courtes avec mèches cuivrées dans un café",
    "cheveux très longs et lisses près d'un miroir abstrait",
    "coiffure distinctive dans un portrait de salon épuré"
  ],
  "virtual-try-on": [
    "tailleur ivoire dans un studio aux miroirs abstraits",
    "manteau orange dans une rue froide",
    "robe verte satinée dans un vestibule Art déco",
    "ensemble denim sur une place moderniste",
    "tenue de sport neutre sur une piste",
    "veste en lin dans un marché méditerranéen",
    "jupe plissée et pull bleu en librairie",
    "imperméable jaune sous la pluie urbaine",
    "deux adultes en looks habillés sur une terrasse",
    "maille chaleureuse dans un chalet de montagne",
    "silhouette violette dans une galerie blanche",
    "chemise imprimée dans un jardin botanique",
    "look contemporain présenté sur un fond clair"
  ],
  "motion-generator": [
    "danse adulte avec un tissu bleu en mouvement",
    "course sur une plage au lever du soleil",
    "rotation d'une danseuse dans un théâtre vide",
    "cycliste adulte dans une rue mouillée",
    "lancer de balle sur un terrain de quartier",
    "saut au-dessus d'une flaque en ville",
    "équilibre de yoga face à la mer",
    "groupe d'adultes dansant en salle de répétition",
    "veste ample en rotation sur un toit",
    "rameur adulte sur un lac calme",
    "batteur adulte dans un studio sombre",
    "descente dynamique d'un escalier en béton",
    "action adulte clairement lisible avec espace négatif"
  ],
  "background-changer": [
    "portrait intégré dans une bibliothèque historique",
    "adulte sur une plage volcanique à l'aube",
    "sujet urbain dans une station de métro moderne",
    "portrait intégré dans une serre tropicale",
    "adulte sur un toit de ville au coucher du soleil",
    "sujet dans un atelier de céramique",
    "adulte assis dans un café rétro",
    "portrait intégré à un sentier enneigé",
    "sujet adulte dans une galerie minimaliste",
    "adulte au bord d'une piscine d'hôtel",
    "portrait dans une rue de carnaval nocturne",
    "sujet intégré dans un bureau créatif",
    "intégration réaliste dans un nouvel environnement"
  ],
  "background-remover": [
    "adulte en manteau long détouré sur fond gris",
    "vélo urbain sans marque sur fond bleu pâle",
    "chaise en bois isolée sur fond crème",
    "adulte en robe jaune sur fond lilas",
    "paire de baskets neutres sur fond vert sauge",
    "plante tropicale en pot sur fond blanc chaud",
    "adulte avec guitare sans marque sur fond charbon",
    "appareil photo générique sur fond orange mat",
    "vélo pliant détouré sur fond bleu ciel",
    "lampe sculpturale sur fond terracotta",
    "vélo urbain complet sur fond cobalt",
    "vase de fleurs sauvages sur fond vert sombre",
    "lampadaire sculptural détouré avec ombre douce"
  ],
  "magic-eraser": [
    "place historique nettoyée avec texture de pierre continue",
    "plage et empreintes de sable naturellement reconstruites",
    "table de café débarrassée avec décor cohérent",
    "sentier forestier réparé sous une lumière tachetée",
    "mur de briques uniforme autour d'un portrait",
    "sol d'un marché couvert sans élément distrayant",
    "salon domestique avec tapis et bois continus",
    "passerelle et reflets d'une rivière reconstruits",
    "galerie blanche avec sol parfaitement continu",
    "jardin botanique sans objet parasite",
    "chaussée mouillée avec reflets préservés",
    "table d'artisanat rangée avec matières cohérentes",
    "scène nettoyée sans interface ni comparaison"
  ],
  "photo-enhancer": [
    "portrait adulte détaillé à la lumière d'une fenêtre",
    "paysage côtier avec eau et nuages récupérés",
    "bibliothèque intérieure aux textures de bois précises",
    "rue nocturne avec lumières propres et peu de bruit",
    "portrait en contre-jour au large éventail dynamique",
    "vélo urbain avec métal et caoutchouc détaillés",
    "marché de fruits aux couleurs naturelles",
    "chalet avec bois, tissus et feu bien définis",
    "petit groupe adulte aux visages naturels",
    "façade historique aux pierres et fenêtres nettes",
    "pluie urbaine avec gouttes et reflets réalistes",
    "objet artisanal en céramique aux détails visibles",
    "composition éditoriale avec lumière équilibrée"
  ],
  "portrait-retouch": [
    "portrait naturel près d'une fenêtre",
    "adulte avec taches de rousseur dans un jardin",
    "portrait masculin barbu dans un atelier",
    "portrait d'une personne adulte aux traits expressifs",
    "portrait de mode au maquillage discret",
    "cheveux bouclés sur une terrasse urbaine",
    "portrait noir et blanc aux ombres de persienne",
    "adulte souriant dans un café chaleureux",
    "profil adulte dans la lumière dorée",
    "portrait avec lunettes et reflets contrôlés",
    "portrait éditorial sous une lumière rouge sombre",
    "portrait documentaire dans un marché",
    "portrait retouché avec identité et peau naturelles"
  ],
  "unblur-image": [
    "portrait adulte net dans une rue matinale",
    "vélo en mouvement avec roues précises",
    "guitariste adulte aux mains et cordes nettes",
    "chien courant avec pelage défini",
    "mains adultes travaillant l'argile avec précision",
    "montagne aux pins et rochers détaillés",
    "tramway nocturne aux lignes clairement visibles",
    "portrait adulte sous la pluie avec bokeh naturel",
    "céramique artisanale nette sur une table en bois",
    "danseuse adulte en saut dans un théâtre",
    "façade historique aux pierres bien définies",
    "adulte dans une fête nocturne avec profondeur",
    "appareil photo vintage aux détails précis"
  ],
  "color-correction": [
    "portrait adulte aux tons chauds de l'aube",
    "côte bleue et sable aux couleurs équilibrées",
    "café aux tons ambre et pétrole",
    "rue nocturne aux néons cyan et magenta maîtrisés",
    "paysage d'automne vert mousse et orange doux",
    "portrait en noir et blanc aux gris riches",
    "marché méditerranéen aux couleurs naturelles",
    "musée aux blancs neutres et accents rouges",
    "montagne enneigée aux bleus et bois chaleureux",
    "jardin botanique aux verts profonds",
    "portrait mode violet et doré",
    "scène pluvieuse gris et bleu pétrole",
    "composition à palette chromatique intentionnelle"
  ],
  "old-photo-restoration": [
    "couple adulte dans un studio du début du siècle",
    "rue européenne ancienne avec tramway",
    "voyageur adulte devant une gare historique",
    "adultes réunis dans un jardin des années cinquante",
    "portrait d'époque avec chapeau et façade ancienne",
    "plage d'archives avec vêtements de période",
    "marché historique aux détails de bois et de tissu",
    "adulte près d'un piano dans un intérieur ancien",
    "place méditerranéenne aux couleurs restaurées",
    "adulte au travail dans un atelier d'époque",
    "pique-nique d'adultes dans un parc ancien",
    "portrait formel devant un rideau de studio",
    "photo historique restaurée avec texture de papier"
  ],
  "edit-by-prompt": [
    "portrait transformé dans un jardin botanique",
    "rue urbaine éditée avec pluie et reflets",
    "sujet adulte habillé d'un tailleur émeraude",
    "pièce transformée en atelier de céramique",
    "plage éditée avec une comète colorée",
    "portrait de jour converti en scène nocturne",
    "place enrichie de feuilles d'automne dorées",
    "objet artisanal placé sur une table en bois",
    "toit urbain transformé en terrasse côtière",
    "pièce recolorée en bleu pétrole naturel",
    "portrait adulte avec lunettes sans marque",
    "intérieur transformé en galerie de musée",
    "transformation guidée propre et clairement visible"
  ],
  "social-cards": [
    "portrait adulte sur fond corail avec espace négatif",
    "tasse artisanale et carnet sans texte sur table bleue",
    "adulte en promenade sur une côte dégagée",
    "produit beauté neutre sur pierre et feuillage",
    "petit groupe adulte sur une terrasse festive",
    "portrait de mode urbaine sur fond intense",
    "voyageur adulte dans un paysage montagneux",
    "plat artisanal présenté sur une table en bois",
    "créateur adulte à un bureau avec caméra neutre",
    "silhouette adulte dans une ville nocturne",
    "vase de fleurs sauvages sur fond crème",
    "adulte dans un musée à l'architecture claire",
    "nature morte d'un vase bleu et d'un flacon neutre"
  ]
};

// Every slot changes the semantic scene, not only the camera angle. The same
// matrix is reused by future theme batches, while THEME_BRIEFS supplies the
// theme-specific subject and exclusion rules.
const DIVERSITY_SLOTS = [
  { key: "quiet-city-walk", scene: "dos adultos caminan por una calle europea de piedra al amanecer, conversando mientras pasan bicicletas y fachadas antiguas", action: "caminar y mirarse de forma espontánea", wardrobe: "gabardinas ligeras, denim y zapatos urbanos, sin prendas rojas coordinadas", lighting: "luz fría de mañana con reflejos dorados en las ventanas", framing: "plano documental de cuerpo entero con líneas de fuga y mucho contexto", avoid: "mesa, rosas, velas, vino, regalo" },
  { key: "coastal-wind", scene: "una pareja adulta está en una costa rocosa con el mar abierto y viento visible en la ropa y el cabello", action: "reírse mientras contemplan el horizonte, sin posar para la cámara", wardrobe: "capas de lino y prendas de punto en azul, arena y verde salvia", lighting: "sol bajo entre nubes y atmósfera marina limpia", framing: "plano lateral amplio con la pareja en un tercio y paisaje dominante", avoid: "interior, comedor, ramo, calabazas, árbol" },
  { key: "botanical-picnic", scene: "dos adultos comparten un picnic sencillo en un jardín botánico con cítricos, manta de cuadros y plantas exuberantes", action: "servirse fruta y conversar sentados en el suelo", wardrobe: "camisas claras, falda estampada y tonos verdes, sin jersey rojo", lighting: "luz natural filtrada por hojas, sombras moteadas suaves", framing: "plano cenital oblicuo que prioriza la manta y el entorno", avoid: "rosas, velas, copas, caja de regalo, ceremonia" },
  { key: "retro-diner", scene: "una pareja adulta se encuentra en una cafetería retro de carretera con taburetes cromados y un jukebox sin texto legible", action: "compartir batidos y sonreír durante una conversación", wardrobe: "estilo vintage de los años setenta en mostaza, crema y azul petróleo", lighting: "luz de neón suave mezclada con luz de ventana", framing: "plano medio simétrico desde el otro lado de la barra", avoid: "vino, cena elegante, flores, velas, vestido de novia" },
  { key: "bookshop-browse", scene: "dos adultos hojean libros en una librería independiente alta y luminosa, con escaleras y estanterías profundas", action: "recomendarse un libro y compartir una mirada cómplice", wardrobe: "ropa de ciudad en camel, azul marino y marfil", lighting: "luz cenital difusa y pequeñas zonas cálidas entre estantes", framing: "plano de tres cuartos con capas de estanterías y profundidad", avoid: "carteles legibles, rosas, mesa de cena, calabazas, regalos" },
  { key: "train-platform", scene: "una pareja adulta espera un tren en un andén histórico con dos maletas pequeñas y arquitectura ferroviaria reconocible", action: "despedirse o prepararse para un viaje compartido", wardrobe: "abrigos de viaje, bufandas y cuero en tonos oliva y coñac", lighting: "hora azul con luces prácticas del andén", framing: "plano vertical de cuerpo entero con perspectiva de las vías", avoid: "flores, altar, velas, comedor, texto legible" },
  { key: "ceramics-studio", scene: "dos adultos trabajan juntos en un taller de cerámica con arcilla, torno y piezas imperfectas alrededor", action: "reírse con las manos manchadas de arcilla mientras crean una pieza", wardrobe: "delantales de lona y ropa cómoda en terracota, gris y crema", lighting: "luz lateral de grandes ventanas industriales", framing: "plano cercano de acción con manos y rostros en planos distintos", avoid: "manos deformes, ramo, vino, regalos, disfraces" },
  { key: "rainy-rooftop", scene: "una pareja adulta se encuentra en una azotea urbana después de la lluvia, con charcos y luces de la ciudad al fondo", action: "bailar suavemente bajo una chaqueta compartida", wardrobe: "sastrería negra, camisa blanca y accesorios plateados", lighting: "neón magenta y azul reflejado en el pavimento mojado", framing: "plano americano dinámico con reflejo en primer plano", avoid: "cena, velas, rosas, texto, estética de boda" },
  { key: "cinema-queue", scene: "dos adultos esperan fuera de un cine de barrio durante una noche lluviosa, bajo un paraguas transparente", action: "compartir palomitas y reír antes de entrar", wardrobe: "chaquetas casuales, bufandas y colores mostaza, burdeos y carbón", lighting: "luz cálida del escaparate con ambiente azul de lluvia", framing: "plano medio en tres cuartos, paraguas como marco circular", avoid: "cartel legible, regalo, vino, ramo, altar" },
  { key: "mountain-cabin", scene: "una pareja adulta pasa una mañana tranquila en una cabaña de montaña con chimenea, mapas y mantas de lana", action: "jugar a un juego de mesa sencillo junto al fuego", wardrobe: "prendas de punto beige, verde bosque y azul pizarra", lighting: "luz de fuego mezclada con luz fría de montaña por la ventana", framing: "plano amplio de ambiente con la pareja en un lateral", avoid: "rosas, mesa de cena romántica, copas, árbol navideño" },
  { key: "evening-fair", scene: "dos adultos pasean por una feria nocturna con una noria iluminada, puestos desenfocados y movimiento alrededor", action: "ganar un pequeño premio y celebrarlo con una sonrisa", wardrobe: "chaquetas de cuero, prendas amarillas y azul cobalto", lighting: "bombillas festivas y exposición nocturna natural", framing: "plano de movimiento a nivel de los ojos con fondo profundo", avoid: "calabazas, velas, ramo, caja de regalo, texto legible" },
  { key: "sculpture-gallery", scene: "una pareja adulta recorre una galería de arte contemporáneo con esculturas abstractas y paredes blancas", action: "observar una obra desde lados opuestos y conversar sobre ella", wardrobe: "moda editorial minimalista en blanco, negro y naranja quemado", lighting: "iluminación de museo limpia y sombras geométricas", framing: "composición arquitectónica simétrica con mucho espacio negativo", avoid: "rosas, cena, corazones, altar, marcas" },
  { key: "hands-wrapped-letter", scene: "detalle de las manos de dos adultos envolviendo una carta y un pequeño objeto en papel estampado sobre una mesa de madera clara", action: "preparar un recuerdo personal sin mostrar texto legible", wardrobe: "mangas de lino en colores distintos, sin pareja vestida igual", lighting: "luz de ventana suave con sombras de papel y cinta", framing: "primer plano cenital de manos y materiales, sin mostrar una escena de cena", avoid: "caras duplicadas, texto legible, rosas, velas, vino, collage" }
];

const SLOT_ALT_LABELS = {
  "quiet-city-walk": "paseo urbano tranquilo",
  "coastal-wind": "costa ventosa",
  "botanical-picnic": "picnic botánico",
  "retro-diner": "cafetería retro",
  "bookshop-browse": "librería independiente",
  "train-platform": "andén ferroviario",
  "ceramics-studio": "taller de cerámica",
  "rainy-rooftop": "azotea lluviosa",
  "cinema-queue": "cine de barrio",
  "mountain-cabin": "cabaña de montaña",
  "evening-fair": "feria nocturna",
  "sculpture-gallery": "galería de arte",
  "hands-wrapped-letter": "detalle artesanal"
};

const HALLOWEEN_SLOT_OVERRIDES = {
  "quiet-city-walk": { scene: "dos adultos con disfraces originales de bruja elegante y vampiro caminan por una calle antigua con escaparates decorados con telarañas y faroles naranjas", action: "caminar y mirarse de forma espontánea mientras llevan pequeños accesorios de disfraz", wardrobe: "capa negra, sombrero de ala ancha y abrigo de terciopelo, sin sangre ni armas", lighting: "hora azul con luz naranja de faroles y ventanas decoradas", framing: "plano documental de cuerpo entero con la arquitectura antigua y la decoración de Halloween claramente visibles", avoid: "mar, picnic, cerámica, mesa de fiesta, texto legible", themeAnchor: "disfraces completos de bruja y vampiro, telarañas decorativas y faroles naranjas" },
  "coastal-wind": { scene: "una pareja adulta con máscaras de carnaval oscuras y capas de Halloween está en un acantilado frente al mar, con niebla y un farol antiguo", action: "sujetarse las máscaras mientras el viento mueve las capas y contemplar el horizonte", wardrobe: "capas negras, máscaras venecianas originales y botas, sin disfraces reconocibles con copyright", lighting: "atardecer gris con niebla marina y un halo ámbar del farol", framing: "plano lateral amplio con el acantilado, la niebla y las máscaras como elementos inequívocos", avoid: "interior, picnic, bicicletas, calabaza tallada, mesa", themeAnchor: "máscaras venecianas de Halloween, capas oscuras, niebla y farol antiguo" },
  "botanical-picnic": { scene: "dos adultos disfrazados celebran un picnic nocturno de Halloween en un jardín botánico, rodeados de hojas otoñales, flores oscuras y pequeñas linternas", action: "compartir dulces de Halloween y conversar sobre una manta, sin posar rígidamente", wardrobe: "vestuario de hechicero y criatura nocturna con detalles morados y verde bosque, completamente cubiertos", lighting: "luz de luna mezclada con pequeñas linternas violetas y sombras de hojas", framing: "plano cenital oblicuo que prioriza la manta, los dulces temáticos y el jardín nocturno", avoid: "playa, batidos, cerámica, vino, mesa de cena romántica", themeAnchor: "picnic nocturno de Halloween, dulces temáticos, linternas violetas y disfraces originales" },
  "retro-diner": { scene: "una pareja adulta disfrazada de esqueleto glamuroso y adivina retro comparte batidos en un diner decorado para Halloween, con guirnaldas naranjas y una calabaza tallada al fondo", action: "compartir batidos y sonreír durante una conversación de fiesta", wardrobe: "maquillaje de calavera artístico no gore, pañuelo vintage y ropa naranja quemado y negro", lighting: "neón violeta y naranja mezclado con luz de ventana nocturna", framing: "plano medio simétrico desde el otro lado de la barra, con decoración de Halloween visible", avoid: "costa, picnic, galería blanca, sangre, texto legible", themeAnchor: "diner de Halloween, maquillaje de calavera artístico, neón violeta y calabaza tallada" },
  "bookshop-browse": { scene: "dos adultos con disfraces de Halloween hojean libros en una librería antigua convertida en tienda de magia, con velas eléctricas, telarañas y frascos decorativos sin texto", action: "recomendarse un grimorio sin letras legibles y compartir una mirada cómplice", wardrobe: "capa de terciopelo, sombrero pequeño y vestuario gótico editorial, sin símbolos religiosos reales", lighting: "luz cálida de lámparas antiguas y acentos morados entre las estanterías", framing: "plano de tres cuartos con estanterías profundas y decoración sobrenatural claramente visible", avoid: "carteles legibles, playa, cena, batidos, personajes con copyright", themeAnchor: "librería de magia de Halloween, telarañas, frascos decorativos y vestuario gótico" },
  "train-platform": { scene: "una pareja adulta con disfraces de Halloween espera un tren en un andén histórico cubierto de niebla, con maletas antiguas, cuervos decorativos y un farol", action: "mirar hacia las vías y sostener una pequeña linterna mientras se preparan para una aventura", wardrobe: "abrigo victoriano, capa corta y accesorios de explorador sobrenatural, sin armas", lighting: "hora azul con niebla, luces del andén y una tenue luz verde de ambiente", framing: "plano vertical de cuerpo entero con vías, niebla y siluetas decorativas", avoid: "flores, altar, picnic, tren moderno brillante, texto legible", themeAnchor: "andén embrujado de Halloween, niebla, farol, cuervos decorativos y disfraces" },
  "ceramics-studio": { scene: "dos adultos disfrazados trabajan en un taller de cerámica creando máscaras y pequeños cuencos de Halloween, rodeados de arcilla y piezas decorativas", action: "reírse con las manos manchadas de arcilla mientras dan forma a una máscara festiva", wardrobe: "delantales oscuros con pequeños detalles de murciélago, ropa cómoda y guantes de arcilla", lighting: "luz lateral de ventanas industriales mezclada con una guirnalda naranja", framing: "plano cercano de acción con manos, máscara de arcilla y rostros en planos distintos", avoid: "manos deformes, ramo, vino, regalos románticos, escena genérica sin Halloween", themeAnchor: "taller de cerámica de Halloween, máscaras de arcilla, murciélagos decorativos y luz naranja" },
  "rainy-rooftop": { scene: "una pareja adulta con máscaras de Halloween celebra una fiesta íntima en una azotea urbana después de la lluvia, con charcos, telarañas y luces de ciudad", action: "bailar suavemente bajo una sombrilla negra mientras levantan sus máscaras", wardrobe: "sastrería negra, máscaras originales y accesorios plateados, sin sangre ni armas", lighting: "neón magenta, azul y naranja reflejado en el pavimento mojado", framing: "plano americano dinámico con máscaras, telarañas y reflejo en primer plano", avoid: "cena, rosas, altar, playa, texto legible", themeAnchor: "fiesta de máscaras de Halloween en una azotea lluviosa, telarañas y neón" },
  "cinema-queue": { scene: "dos adultos disfrazados esperan fuera de un cine de barrio durante una noche de Halloween, bajo un paraguas transparente y junto a carteles abstractos sin texto", action: "compartir palomitas y reír antes de entrar a una proyección de terror", wardrobe: "disfraz de gato negro y explorador paranormal, maquillaje sutil y ropa de calle", lighting: "luz cálida del escaparate con ambiente azul de lluvia y pequeños acentos rojos", framing: "plano medio en tres cuartos, paraguas como marco circular y decoración de Halloween alrededor", avoid: "cartel legible, regalo, vino, ramo, altar", themeAnchor: "noche de cine de Halloween, disfraces originales, palomitas y decoración de terror sin gore" },
  "mountain-cabin": { scene: "una pareja adulta con disfraces de Halloween pasa la noche en una cabaña de montaña decorada con velas eléctricas, máscaras colgadas y una chimenea", action: "jugar a contar historias de fantasmas junto al fuego mientras sostienen tazas oscuras", wardrobe: "capas de lana, accesorios de criatura nocturna y maquillaje artístico discreto", lighting: "luz de fuego mezclada con luz fría de montaña por la ventana y detalles naranjas", framing: "plano amplio de ambiente con la pareja en un lateral y la decoración de Halloween visible", avoid: "rosas, árbol navideño, playa, cena romántica, texto legible", themeAnchor: "cabaña embrujada de Halloween, historias de fantasmas, máscaras y chimenea" },
  "evening-fair": { scene: "dos adultos disfrazados pasean por una feria nocturna de Halloween con una noria iluminada, puestos de carnaval oscuro y actores con máscaras originales", action: "ganar un pequeño premio de feria y celebrarlo con una sonrisa", wardrobe: "chaquetas de cuero, sombreros de carnaval y detalles amarillos y violeta", lighting: "bombillas naranjas, luces violetas y exposición nocturna natural", framing: "plano de movimiento a nivel de los ojos con la feria embrujada y la noria al fondo", avoid: "playa, picnic, cena, calabaza repetida, texto legible", themeAnchor: "feria nocturna de Halloween, noria, máscaras de carnaval y luces naranjas y violetas" },
  "sculpture-gallery": { scene: "una pareja adulta con vestuario de Halloween recorre una galería de arte contemporáneo con esculturas abstractas inspiradas en máscaras, sombras y criaturas fantásticas", action: "observar una obra desde lados opuestos y conversar sobre ella", wardrobe: "moda editorial negra, naranja quemado y marfil con máscaras escultóricas originales", lighting: "iluminación de museo limpia con sombras violetas y formas geométricas", framing: "composición arquitectónica simétrica con una escultura de Halloween como punto focal", avoid: "rosas, cena, corazones, altar, marcas o personajes conocidos", themeAnchor: "exposición de arte de Halloween, máscaras escultóricas, sombras violetas y moda gótica" },
  "hands-wrapped-letter": { scene: "detalle de las manos de dos adultos preparando una invitación y un pequeño paquete de dulces de Halloween sobre una mesa de madera, con papel negro y naranja", action: "envolver el paquete con cinta verde oscura sin mostrar texto legible", wardrobe: "mangas distintas de terciopelo negro y naranja quemado, con anillos de disfraz", lighting: "luz de ventana suave con sombras de papel y una pequeña luz violeta", framing: "primer plano cenital de manos, dulces, cinta y materiales temáticos, sin mostrar una cena", avoid: "caras duplicadas, texto legible, rosas, vino, collage", themeAnchor: "manualidad de Halloween con papel negro y naranja, dulces temáticos y cinta verde oscura" }
};

function parseArgs(list) {
  const result = {};
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (!item.startsWith("--")) continue;
    const raw = item.slice(2);
    const equalsIndex = raw.indexOf("=");
    const rawKey = equalsIndex >= 0 ? raw.slice(0, equalsIndex) : raw;
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (equalsIndex >= 0) {
      result[key] = raw.slice(equalsIndex + 1);
      continue;
    }
    const next = list[index + 1];
    if (!next || next.startsWith("--")) result[key] = true;
    else { result[key] = next; index += 1; }
  }
  return result;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function sourceTaskSort(a, b) {
  const aCover = /cover/i.test(`${a.label} ${a.oldStorageKey}`);
  const bCover = /cover/i.test(`${b.label} ${b.oldStorageKey}`);
  if (aCover !== bCover) return aCover ? -1 : 1;
  const aNumber = Number(String(a.label).match(/-(\d{2})\./)?.[1] || 999);
  const bNumber = Number(String(b.label).match(/-(\d{2})\./)?.[1] || 999);
  return aNumber - bNumber;
}

function targetPackId(sourceTask) {
  const context = (sourceTask.contexts || []).find((value) => String(value).startsWith("creative-pack:"));
  return String(context || "").replace(/^creative-pack:/, "").split(":")[0] || "";
}

function buildPrompt({ brief, slot, slotIndex, isCover }) {
  const themedSlot = theme === "halloween"
    ? { ...slot, ...(HALLOWEEN_SLOT_OVERRIDES[slot.key] || {}) }
    : slot;
  const creativeDirection = brief.directions?.[slotIndex] || "";
  const hasOpenThemeDirection = Boolean(creativeDirection);
  const storefrontLanguage = locale === "fr" ? "French" : "Spanish";
  return [
    "Use case: photorealistic-natural.",
    `Asset type: ${isCover ? "dedicated package cover image" : "standalone gallery image"} for an AI photo package on the ${storefrontLanguage} ${storefrontName} storefront.`,
    `Primary request: ${brief.request}.`,
    hasOpenThemeDirection
      ? `Open creative direction ${String(slotIndex + 1).padStart(2, "0")} of 13: ${creativeDirection}. Treat this as an art direction, not a rigid template: vary identity, expression, styling details, lens feel, crop and environmental texture naturally while preserving the category intent.`
      : `Mandatory theme anchor: ${themedSlot.themeAnchor || brief.label}. This anchor must be clearly visible and recognizable in the final image; do not produce a generic lifestyle photo.`,
    `Theme anchor: ${brief.themeAnchor || brief.label}. Keep this anchor visibly recognizable while allowing the scene, styling, composition and photographic treatment to change from slot to slot.`,
    ...(hasOpenThemeDirection ? [
      "Human direction: use original fictional consenting adults with different identities from every other slot; choose a natural gesture and believable anatomy appropriate to the direction.",
      `Visual language: ${brief.style}. Choose the lighting and camera treatment that best serves this direction; do not repeat a fixed studio recipe across the package.`,
      `${isCover ? "Make this the clearest package cover with an immediately readable subject and category." : "Make this a standalone gallery image with a visual idea different from the cover and every other slot."}`
    ] : [
      `Scene slot ${String(slotIndex + 1).padStart(2, "0")} of 13 (${themedSlot.key}): ${themedSlot.scene}.`,
      `Action and human direction: ${themedSlot.action}. Use original fictional consenting adults with different identities from every other slot.`,
      `Wardrobe and styling: ${themedSlot.wardrobe}.`,
      `Lighting and mood: ${themedSlot.lighting}; ${brief.style}.`,
      `Composition and camera: ${themedSlot.framing}. ${isCover ? "Make this the clearest package cover with an immediately readable environment." : "Make this a standalone gallery image with a visual idea different from the cover and every other slot."}`
    ]),
    "Materials and texture: natural skin, anatomically correct hands, believable fabric, skin, paper, wood, stone and environmental texture; no plastic finish.",
    `Diversity guard: this slot must use its own location, action, wardrobe, palette and focal object. Do not borrow the visual recipe of another slot. Specifically avoid: ${themedSlot.avoid}.`,
    `Theme exclusions: ${brief.avoid}.`,
    "Text: none; do not include readable letters, captions, menus, logos, watermarks, UI or branded marks.",
    "Output constraints: one complete image, no collage, grid, split screen, duplicated faces, extra fingers, deformed anatomy, celebrities, copyrighted characters, minors, explicit nudity, gore or violence. Create an original image, not a variation of the source asset or any other package image."
  ].join("\n");
}

function altText(brief, slot, slotIndex) {
  if (locale === "fr") {
    const frenchBrief = FRENCH_THEME_COPY[theme];
    const sceneLabel = FRENCH_ALT_SCENES[theme]?.[slotIndex] || "scène éditoriale originale";
    return `${frenchBrief?.label || brief.label} — ${frenchBrief?.seoSubject || "photo adulte"} : ${sceneLabel}.`;
  }
  const sceneLabel = brief.directions?.[slotIndex] || SLOT_ALT_LABELS[slot.key] || slot.key.replaceAll("-", " ");
  const subject = brief.seoSubject || `fotografía de ${brief.label.toLowerCase()}`;
  return `${brief.label}: ${subject} en ${sceneLabel}, imagen generada con IA para la galería privada de ${storefrontName}, variación visual ${String(slotIndex + 1).padStart(2, "0")}.`;
}

function artDirection({ brief, slot, slotIndex, isCover }) {
  const themedSlot = theme === "halloween"
    ? { ...slot, ...(HALLOWEEN_SLOT_OVERRIDES[slot.key] || {}) }
    : slot;
  const dedicatedDirection = brief.directions?.[slotIndex];
  if (locale === "fr" && dedicatedDirection) {
    return [
      `Ancre thématique : ${brief.themeAnchor || brief.label}.`,
      `Direction visuelle indépendante : ${dedicatedDirection}.`,
      `Traitement photographique : ${brief.style}. Choisir une lumière, une focale, une texture et une gestuelle qui servent cette scène sans reprendre une autre image du pack.`,
      `Fonction : ${isCover ? "couverture 4:3 avec visage et haut du corps dans une zone sûre" : `image de galerie carrée, variation ${String(slotIndex + 1).padStart(2, "0")}`}.`
    ].join(" ");
  }
  return [
    `Ancre thématique : ${brief.themeAnchor || brief.label}.`,
    `Sujet et scène : ${themedSlot.scene}.`,
    `Action : ${themedSlot.action}.`,
    `Vêtements et accessoires : ${themedSlot.wardrobe}.`,
    `Lumière et ambiance : ${themedSlot.lighting}.`,
    `Composition et caméra : ${themedSlot.framing}.`,
    isCover ? "Fonction : couverture 4:3, visage et haut du corps dans une zone sûre." : `Fonction : image de galerie indépendante, variation ${String(slotIndex + 1).padStart(2, "0")} en format carré.`
  ].join(" ");
}

function plannedManifest(source) {
  assert(THEME_BRIEFS[theme], `Unsupported theme: ${theme}`);
  assert(Array.isArray(source.tasks) && source.tasks.length === 13, "The source batch must contain exactly 13 rendered assets.");
  assert(DIVERSITY_SLOTS.length === source.tasks.length, "The diversity matrix must match the 13 asset slots.");
  const ordered = [...source.tasks].sort(sourceTaskSort);
  const brief = locale === "fr"
    ? { ...THEME_BRIEFS[theme], ...FRENCH_THEME_COPY[theme], directions: FRENCH_ALT_SCENES[theme] }
    : THEME_BRIEFS[theme];
  const targetId = targetPackId(ordered[0]);
  assert(targetId, "Could not resolve the target creative pack id from the source manifest.");
  const tasks = ordered.map((oldTask, index) => {
    const slot = DIVERSITY_SLOTS[index];
    const isCover = /cover/i.test(`${oldTask.label} ${oldTask.oldStorageKey}`);
    const prompt = buildPrompt({ brief, slot, slotIndex: index, isCover });
    const fileName = `${theme}-${String(index).padStart(2, "0")}-${slot.key}-${sha256(prompt).slice(0, 12)}.webp`;
    return {
      id: `${batchId}-${String(index + 1).padStart(2, "0")}`,
      sourceTaskId: oldTask.id,
      sourceLabel: oldTask.label,
      oldStorageKey: oldTask.oldStorageKey,
      oldReferences: oldTask.references || [],
      contexts: oldTask.contexts || [],
      targetPackId: targetId,
      slotIndex: index,
      slotKey: slot.key,
      isCover,
      outputProfile: imageResolution,
      prompt,
      artDirection: artDirection({ brief, slot, slotIndex: index, isCover }),
      altText: altText(brief, slot, index),
      filename: fileName,
      stageFile: path.join(outputRoot, fileName),
      outputRelative: path.posix.join("sites", assetSiteSlug, "generated/regenerated", batchId, fileName),
      publicUrl: `${finalPublicRoot}/${fileName}`,
      finalFile: path.join(finalRoot, fileName),
      status: "planned",
      providerRequestId: "",
      error: ""
    };
  });
  assert.equal(new Set(tasks.map((task) => task.prompt)).size, 13, "Every image must have a unique prompt.");
  assert.equal(new Set(tasks.map((task) => task.artDirection)).size, 13, "Every image must have an independent art direction.");
  assert.equal(new Set(tasks.map((task) => task.altText)).size, 13, "Every image must have an independent alt text.");
  return {
    schemaVersion: 2,
    kind: `${assetSiteSlug}-diverse-image-regeneration`,
    mode: "planned",
    batchId,
    createdAt: new Date().toISOString(),
    sourceBatchId: source.batchId,
    filters: source.filters,
    targetSite: source.targetSite,
    targetPackId: targetId,
    provider: {
      id: providerId,
      label: "image4",
      model: imageModel,
      quality,
      resolution: imageResolution,
      size: imageResolution === "4K" ? "cover=3840x2880,gallery=2880x2880" : imageOutputProfiles[imageResolution].gallery.size,
      outputProfile: imageResolution,
      attemptsPerCreate: 1,
      fallback: "disabled",
      noAutomaticRetry: true
    },
    diversity: {
      strategy: "semantic-13-slot-matrix-plus-average-difference-color-hash-gate",
      slotKeys: tasks.map((task) => task.slotKey),
      requiredUniquePrompts: 13,
      minimumCrossAHashDistance,
      minimumCrossDHashDistance,
      minimumCrossColorHashDistance
    },
    safety: {
      maxPaidCreateAttempts: tasks.length,
      selectedPaidCreateAttempts: tasks.length,
      noAutomaticRetry: true,
      noProviderFallback: true,
      sourceAssetsAreReferencesOnly: true
    },
    counts: {
      generationTasks: tasks.length,
      uniquePrompts: new Set(tasks.map((task) => task.prompt)).size,
      uniqueArtDirections: new Set(tasks.map((task) => task.artDirection)).size,
      uniqueAlts: new Set(tasks.map((task) => task.altText)).size
    },
    tasks
  };
}

async function imageFingerprints(filePath) {
  const luminance = await sharp(filePath).resize(8, 8, { fit: "fill" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  let total = 0;
  for (const value of luminance.data) total += value;
  const average = total / luminance.data.length;
  let averageHash = 0n;
  luminance.data.forEach((value, index) => {
    if (value >= average) averageHash |= 1n << BigInt(index);
  });

  const gradient = await sharp(filePath).resize(9, 8, { fit: "fill" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  let differenceHash = 0n;
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const index = row * 9 + column;
      if (gradient.data[index] >= gradient.data[index + 1]) differenceHash |= 1n << BigInt(row * 8 + column);
    }
  }

  const color = await sharp(filePath).resize(8, 8, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = [0, 0, 0];
  for (let index = 0; index < color.data.length; index += 3) {
    for (let channel = 0; channel < 3; channel += 1) channels[channel] += color.data[index + channel];
  }
  for (let channel = 0; channel < 3; channel += 1) channels[channel] /= 64;
  let colorHash = 0n;
  for (let pixel = 0; pixel < 64; pixel += 1) {
    const index = pixel * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      if (color.data[index + channel] >= channels[channel]) colorHash |= 1n << BigInt(pixel * 3 + channel);
    }
  }
  return { averageHash, differenceHash, colorHash };
}

async function colorHistogram(filePath) {
  const { data } = await sharp(filePath).resize(32, 32, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const histogram = Array(24).fill(0);
  for (let index = 0; index < data.length; index += 3) {
    for (let channel = 0; channel < 3; channel += 1) histogram[channel * 8 + Math.min(7, Math.floor(data[index + channel] / 32))] += 1;
  }
  const total = 32 * 32;
  return histogram.map((value) => value / total);
}

function colorHistogramDistance(first, second) {
  return first.reduce((sum, value, index) => sum + Math.abs(value - second[index]), 0) / 2;
}

function bitDistance(a, b) {
  let value = a ^ b;
  let distance = 0;
  while (value) { distance += Number(value & 1n); value >>= 1n; }
  return distance;
}

function imagePayload(body) {
  return body?.data?.[0]?.b64_json ?? body?.data?.[0]?.image_base64 ?? body?.output?.[0]?.b64_json ?? body?.output?.[0]?.image_base64 ?? body?.image_base64;
}

function redactedBody(body) {
  return JSON.parse(JSON.stringify(body, (key, value) => {
    if (/(?:b64|base64)/i.test(key) && typeof value === "string") return `[omitted:${value.length}]`;
    return value;
  }));
}

async function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function atomicCopy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const pending = `${target}.pending`;
  fs.copyFileSync(source, pending);
  fs.renameSync(pending, target);
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findUnique({ where: { id: providerId } });
    assert(provider?.enabled && provider.apiKey && provider.aiUrl, `Configured provider ${providerId} is not enabled or is missing credentials.`);
    assert.equal(provider.providerType, "image", `Configured provider ${providerId} is not an image provider.`);
    assert.equal(provider.modelType, imageModel, `Configured provider ${providerId} is not configured for ${imageModel}.`);
    return { id: provider.id, label: provider.label, baseUrl: normalizeBaseUrl(provider.aiUrl), apiKey: provider.apiKey, model: provider.modelType };
  } finally { await prisma.$disconnect(); }
}

async function checkProviderReadOnly(provider) {
  const response = await fetch(`${provider.baseUrl}/models`, { headers: { Authorization: `Bearer ${provider.apiKey}` }, signal: AbortSignal.timeout(30_000) });
  assert(response.ok, `Provider read-only model check failed with ${response.status}.`);
  return { status: response.status, modelAvailable: true };
}

function existingProviderAuditPath(task) {
  return path.join(path.dirname(manifestPath), `${batchId}-${task.id}-provider.json`);
}

function existingProviderResultUrl(task) {
  const auditPath = existingProviderAuditPath(task);
  if (!fs.existsSync(auditPath)) return null;
  const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  const result = audit.response?.data?.[0];
  if (audit.status !== 200 || typeof result?.url !== "string" || !result.url.startsWith("https://")) return null;
  return { audit, url: result.url };
}

async function downloadExistingProviderResult(resultUrl, provider) {
  const response = await fetch(resultUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${provider.apiKey}` },
    signal: AbortSignal.timeout(maxCreateTimeoutMs)
  });
  assert(response.ok, `Existing provider result download failed with ${response.status}.`);
  return Buffer.from(await response.arrayBuffer());
}

async function stageProviderImage(manifest, task, buffer, requestId, { recovered = false } = {}) {
  const oriented = await sharp(buffer).rotate().toBuffer();
  const providerMetadata = await sharp(oriented).metadata();
  const target = outputSpecForTask(task);
  if (imageResolution === "4K") {
    assert(Math.abs((providerMetadata.width || 0) - target.width) <= nativeHighResolutionDimensionTolerance, `${task.id}: unexpected native 4K width: ${providerMetadata.width}, expected approximately ${target.width}`);
    assert(Math.abs((providerMetadata.height || 0) - target.height) <= nativeHighResolutionDimensionTolerance, `${task.id}: unexpected native 4K height: ${providerMetadata.height}, expected approximately ${target.height}`);
    assert(Math.abs((providerMetadata.width / providerMetadata.height) - (target.width / target.height)) < 0.01, `${task.id}: native 4K output ratio mismatch: ${providerMetadata.width}x${providerMetadata.height}, expected approximately ${target.width}x${target.height}`);
  }
  fs.mkdirSync(path.dirname(task.stageFile), { recursive: true });
  await sharp(oriented)
    .resize(target.width, target.height, { fit: "cover", position: task.isCover ? "top" : "attention" })
    .webp({ quality: 92, smartSubsample: true })
    .toFile(task.stageFile);
  const outputBuffer = fs.readFileSync(task.stageFile);
  const metadata = await sharp(outputBuffer).metadata();
  assert.equal(metadata.width, target.width, `${task.id}: unexpected output width.`);
  assert.equal(metadata.height, target.height, `${task.id}: unexpected output height.`);
  task.outputHash = sha256(outputBuffer);
  task.outputProfile = imageResolution;
  task.outputFingerprints = Object.fromEntries(Object.entries(await imageFingerprints(task.stageFile)).map(([key, value]) => [key, value.toString(16)]));
  task.outputBytes = outputBuffer.length;
  task.providerRequestId = requestId;
  task.status = "succeeded";
  task.error = "";
  manifest.runtime.succeeded += 1;
  if (recovered) manifest.runtime.recoveredProviderResults = Number(manifest.runtime.recoveredProviderResults || 0) + 1;
  manifest.runtime.providerRequestIds.push({ taskId: task.id, requestId, recovered });
  await writeJson(manifestPath, manifest);
  console.log(`${recovered ? "recovered" : "succeeded"} ${task.id} (${manifest.runtime.succeeded}/${manifest.tasks.length})`);
}

async function generate(manifest) {
  assert(confirmation === expectedConfirmation, `Generation requires --confirm=${expectedConfirmation}.`);
  const maxPaidAttempts = Number(args.maxPaidAttempts || manifest.tasks.length);
  assert(Number.isInteger(maxPaidAttempts) && maxPaidAttempts === manifest.tasks.length, `This run requires exactly ${manifest.tasks.length} paid create attempts at most.`);
  if (resume) assert(manifest.runtime, "Resume requires an existing generation runtime in the manifest.");
  const provider = await loadProvider();
  const modelCheck = await checkProviderReadOnly(provider);
  manifest.provider = {
    ...manifest.provider,
    id: provider.id,
    label: provider.label,
    model: provider.model,
    resolution: imageResolution,
    outputProfile: imageResolution,
    endpoint: `${provider.baseUrl}/images/generations`,
    modelCheck
  };
  if (resume) {
    manifest.runtime.failed = 0;
    manifest.runtime.resumedAt = new Date().toISOString();
    manifest.runtime.recoveryAttempts = Number(manifest.runtime.recoveryAttempts || 0);
  } else {
    manifest.runtime = { paidCreateAttempts: 0, succeeded: 0, failed: 0, qualityFailed: 0, startedAt: new Date().toISOString(), providerRequestIds: [] };
  }
  fs.mkdirSync(outputRoot, { recursive: true });
  console.log(JSON.stringify({ operation: resume ? "paid-create-recovery-and-resume" : "paid-create", endpoint: `${provider.baseUrl}/images/generations`, model: provider.model, quality, resolution: imageResolution, sizes: { cover: imageOutputProfiles[imageResolution].cover.size, gallery: imageOutputProfiles[imageResolution].gallery.size }, maxPaidCreateAttempts: maxPaidAttempts, attemptsPerCreate: 1, retry: false, fallback: false, timeoutMs: maxCreateTimeoutMs }, null, 2));

  for (const task of manifest.tasks) {
    if (resume && task.status === "succeeded" && fs.existsSync(task.stageFile)) continue;
    if (task.status === "planned") {
      const existingResult = existingProviderResultUrl(task);
      if (existingResult) {
        const requestId = existingResult.audit.requestId || "recovered-from-provider-audit";
        try {
          const recoveredBuffer = await downloadExistingProviderResult(existingResult.url, provider);
          manifest.runtime.paidCreateAttempts += 1;
          await stageProviderImage(manifest, task, recoveredBuffer, requestId, { recovered: true });
          continue;
        } catch (error) {
          task.status = "unknown_provider_state";
          task.error = error instanceof Error ? error.message : String(error);
          manifest.runtime.failed += 1;
          await writeJson(manifestPath, manifest);
          throw new Error(`${task.id}: existing provider result could not be recovered; stopped without a duplicate create: ${task.error}`);
        }
      }
    }
    const recoveringUnknownState = resume && task.status === "unknown_provider_state";
    const idempotencyKey = `${expectedConfirmation}:${manifest.batchId}:${task.id}`;
    const startedAt = Date.now();
    let response;
    let body = {};
    try {
      response = await fetch(`${provider.baseUrl}/images/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}`, "Idempotency-Key": idempotencyKey, "X-Client-Request-Id": task.id },
        body: JSON.stringify({
          model: provider.model,
          prompt: task.prompt,
          size: imageSizeForTask(task),
          quality,
          resolution: imageResolution,
          aspect_ratio: "4:3",
          output_format: "jpeg",
          n: 1,
          response_format: "b64_json"
        }),
        signal: AbortSignal.timeout(maxCreateTimeoutMs)
      });
      body = await response.json().catch(() => ({}));
    } catch (error) {
      task.status = "unknown_provider_state";
      task.error = error instanceof Error ? error.message : String(error);
      manifest.runtime.failed += 1;
      await writeJson(path.join(path.dirname(manifestPath), `${manifest.batchId}-provider-audit.json`), manifest.runtime);
      await writeJson(manifestPath, manifest);
      throw new Error(`${task.id}: ambiguous provider create state; stopped without retry: ${task.error}`);
    }
    const requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "";
    const auditSuffix = recoveringUnknownState ? `-recovery-${manifest.runtime.recoveryAttempts + 1}` : "";
    await writeJson(path.join(path.dirname(manifestPath), `${manifest.batchId}-${task.id}-provider${auditSuffix}.json`), {
      taskId: task.id, providerId: provider.id, providerLabel: provider.label, model: provider.model, endpoint: `${provider.baseUrl}/images/generations`, idempotencyKey, clientRequestId: task.id, requestId, status: response.status, elapsedMs: Date.now() - startedAt, response: redactedBody(body), retryPolicy: "no-retry"
    });
    if (recoveringUnknownState) manifest.runtime.recoveryAttempts += 1;
    manifest.runtime.paidCreateAttempts += 1;
    if (!response.ok) {
      task.status = "failed";
      task.error = `provider_status_${response.status}`;
      manifest.runtime.failed += 1;
      await writeJson(manifestPath, manifest);
      throw new Error(`${task.id}: provider create failed with ${response.status}; stopped without retry.`);
    }
    const encoded = imagePayload(body);
    assert(encoded, `${task.id}: provider returned no image payload.`);
    const buffer = Buffer.from(encoded, "base64");
    await stageProviderImage(manifest, task, buffer, requestId);
  }

  const qualityResult = await evaluateDiversity(manifest);
  manifest.diversityResult = qualityResult;
  manifest.runtime.qualityFailed = qualityResult.pass ? 0 : qualityResult.failures.length;
  manifest.runtime.completedAt = new Date().toISOString();
  await writeJson(manifestPath, manifest);
  assert(qualityResult.pass, `Diversity gate failed; no assets were applied: ${qualityResult.failures.join("; ")}`);
  console.log(JSON.stringify({ ok: true, paidCreateAttempts: manifest.runtime.paidCreateAttempts, diversity: qualityResult }, null, 2));
}

async function evaluateDiversity(manifest) {
  const failures = [];
  const prompts = new Set(manifest.tasks.map((task) => task.prompt));
  const directions = new Set(manifest.tasks.map((task) => task.artDirection));
  const alts = new Set(manifest.tasks.map((task) => task.altText));
  if (prompts.size !== manifest.tasks.length) failures.push(`unique_prompts=${prompts.size}/${manifest.tasks.length}`);
  if (directions.size !== manifest.tasks.length) failures.push(`unique_art_directions=${directions.size}/${manifest.tasks.length}`);
  if (alts.size !== manifest.tasks.length) failures.push(`unique_alts=${alts.size}/${manifest.tasks.length}`);
  const hashes = [];
  const outputHashes = new Set();
  for (const task of manifest.tasks) {
    assert(fs.existsSync(task.stageFile), `Missing staged image: ${task.stageFile}`);
    const buffer = fs.readFileSync(task.stageFile);
    outputHashes.add(sha256(buffer));
    const metadata = await sharp(buffer).metadata();
    const target = outputSpecForTask(task);
    if (metadata.width !== target.width || metadata.height !== target.height) failures.push(`dimensions:${task.id}`);
    hashes.push({ id: task.id, hashes: await imageFingerprints(task.stageFile) });
  }
  if (outputHashes.size !== minimumUniqueImageHashCount) failures.push(`unique_output_hashes=${outputHashes.size}/${minimumUniqueImageHashCount}`);
  let minAverageDistance = 64;
  let minDifferenceDistance = 64;
  let minColorDistance = 192;
  let closestAveragePair = null;
  let closestDifferencePair = null;
  let closestColorPair = null;
  const visuallyClosePairs = [];
  for (let i = 0; i < hashes.length; i += 1) {
    for (let j = i + 1; j < hashes.length; j += 1) {
      const averageDistance = bitDistance(hashes[i].hashes.averageHash, hashes[j].hashes.averageHash);
      const differenceDistance = bitDistance(hashes[i].hashes.differenceHash, hashes[j].hashes.differenceHash);
      const colorDistance = bitDistance(hashes[i].hashes.colorHash, hashes[j].hashes.colorHash);
      if (averageDistance < minAverageDistance) { minAverageDistance = averageDistance; closestAveragePair = [hashes[i].id, hashes[j].id]; }
      if (differenceDistance < minDifferenceDistance) { minDifferenceDistance = differenceDistance; closestDifferencePair = [hashes[i].id, hashes[j].id]; }
      if (colorDistance < minColorDistance) { minColorDistance = colorDistance; closestColorPair = [hashes[i].id, hashes[j].id]; }
      if (averageDistance < minimumCrossAHashDistance && differenceDistance < minimumCrossDHashDistance && colorDistance < minimumCrossColorHashDistance) {
        visuallyClosePairs.push({ pair: [hashes[i].id, hashes[j].id], averageDistance, differenceDistance, colorDistance });
      }
    }
  }
  if (visuallyClosePairs.length) failures.push(`cross_image_visual_similarity_pairs=${visuallyClosePairs.length}`);
  return { pass: failures.length === 0, minimumCrossAHashDistance, minimumCrossDHashDistance, minimumCrossColorHashDistance, actualMinimumCrossAHashDistance: minAverageDistance, actualMinimumCrossDHashDistance: minDifferenceDistance, actualMinimumCrossColorDistance: minColorDistance, closestAveragePair, closestDifferencePair, closestColorPair, visuallyClosePairs, uniqueOutputHashes: outputHashes.size, failures };
}

async function apply(manifest) {
  assert(confirmation === expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert(manifest.runtime?.succeeded === manifest.tasks.length && manifest.runtime?.failed === 0, "All paid tasks must succeed before apply.");
  assert(manifest.diversityResult?.pass === true, "Diversity gate must pass before apply.");
  assertDatabaseTarget({ expectedTarget: "local" });
  assertNonProductionWriteTarget();
  const prisma = new PrismaClient();
  try {
    const pack = await prisma.creativePack.findUnique({ where: { id: manifest.targetPackId }, include: { categoryRecord: true } });
    assert(pack, `Target creative pack not found: ${manifest.targetPackId}`);
    assert(pack.siteId === targetSiteId, `Unexpected target site: ${pack.siteId}`);
    const backupPath = path.join(path.dirname(manifestPath), `${manifest.batchId}-apply-backup.json`);
    await writeJson(backupPath, { createdAt: new Date().toISOString(), target: "local", pack });
    for (const task of manifest.tasks) {
      assert(fs.existsSync(task.stageFile), `Missing staged image: ${task.stageFile}`);
      atomicCopy(task.stageFile, task.finalFile);
    }
    const cover = manifest.tasks.find((task) => task.isCover);
    const gallery = manifest.tasks.filter((task) => !task.isCover).sort((a, b) => a.slotIndex - b.slotIndex);
    assert(cover && gallery.length === 12, "The planned batch must contain one cover and twelve gallery images.");
    const brief = locale === "fr" ? { ...THEME_BRIEFS[theme], ...FRENCH_THEME_COPY[theme] } : THEME_BRIEFS[theme];
    for (const task of [cover, ...gallery]) task.altText = altText(brief, DIVERSITY_SLOTS[task.slotIndex], task.slotIndex);
    const url = (task) => `${task.publicUrl}?v=${cacheVersion}`;
    const nextPack = {
      imageUrl: url(cover),
      galleryImages: gallery.map(url),
      galleryImageAlts: [cover, ...gallery].map((task) => task.altText)
    };
    await prisma.$transaction(async (tx) => {
      if (pack.categoryRecord) {
        await tx.creativePackCategory.update({ where: { id: pack.categoryRecord.id }, data: { imageUrl: nextPack.imageUrl } });
      }
      await tx.creativePack.update({ where: { id: pack.id }, data: nextPack });
      for (const task of [cover, ...gallery]) {
        const storageKey = task.outputRelative;
        const mediaId = `media_${targetSiteId}_${sha256(storageKey).slice(0, 16)}`;
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId: targetSiteId, storageKey } },
          create: { id: mediaId, siteId: targetSiteId, label: task.altText, storageKey, mimeType: "image/webp", usageType: "package", sourceType: "ai-diverse-regeneration", previewUrl: url(task), originUrl: url(task), altText: task.altText },
          update: { label: task.altText, mimeType: "image/webp", usageType: "package", sourceType: "ai-diverse-regeneration", previewUrl: url(task), originUrl: url(task), altText: task.altText }
        });
      }
    }, { timeout: 120_000 });
    const readback = await prisma.creativePack.findUnique({ where: { id: pack.id }, select: { imageUrl: true, galleryImages: true, galleryImageAlts: true } });
    assert.equal(readback?.imageUrl, nextPack.imageUrl, "Cover readback failed.");
    assert.deepEqual(readback?.galleryImages, nextPack.galleryImages, "Gallery readback failed.");
    manifest.apply = { target: "local", appliedAt: new Date().toISOString(), generated: manifest.tasks.length, backupPath, finalRoot, protectedChanged: false, unrelatedChanged: false };
    manifest.mode = "applied";
    await writeJson(manifestPath, manifest);
    console.log(JSON.stringify({ ok: true, mode: "applied", batchId: manifest.batchId, targetPackId: pack.id, generated: manifest.tasks.length, cover: nextPack.imageUrl, gallery: nextPack.galleryImages }, null, 2));
  } finally { await prisma.$disconnect(); }
}

async function main() {
  assert(["plan", "generate", "apply", "reevaluate"].includes(mode), `Unsupported mode: ${mode}`);
  if (mode === "plan") {
    const source = readJson(sourceManifestPath);
    const manifest = plannedManifest(source);
    await writeJson(manifestPath, manifest);
    console.log(JSON.stringify({ ok: true, mode, manifestPath, batchId, targetPackId: manifest.targetPackId, generationTasks: manifest.tasks.length, uniquePrompts: manifest.counts.uniquePrompts, slotKeys: manifest.diversity.slotKeys }, null, 2));
    return;
  }
  const manifest = readJson(manifestPath);
  assert(manifest.batchId === batchId, `Manifest batch id ${manifest.batchId} does not match ${batchId}.`);
  if (mode === "generate") await generate(manifest);
  else if (mode === "reevaluate") {
    assert(manifest.runtime?.succeeded === manifest.tasks.length, "Re-evaluate requires all staged tasks to be present.");
    const qualityResult = await evaluateDiversity(manifest);
    manifest.diversityResult = qualityResult;
    manifest.runtime.qualityFailed = qualityResult.pass ? 0 : qualityResult.failures.length;
    await writeJson(manifestPath, manifest);
    console.log(JSON.stringify({ ok: qualityResult.pass, mode, batchId, diversity: qualityResult }, null, 2));
    if (!qualityResult.pass) process.exitCode = 1;
  }
  else await apply(manifest);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
