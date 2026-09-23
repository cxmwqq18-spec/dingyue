import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, buildTunneledDatabaseUrl } from "./lib/database-target.mjs";

const apply = process.argv.includes("--apply");
const skipAssets = process.argv.includes("--skip-assets");
const target = process.argv.find((arg) => arg.startsWith("--target="))?.slice("--target=".length) ?? "local";
const reportPathArg = process.argv.find((arg) => arg.startsWith("--report="))?.slice("--report=".length);
const translationCachePathArg = process.argv.find((arg) => arg.startsWith("--translation-cache="))?.slice("--translation-cache=".length);
const localConfirm = "--confirm=aidreamshoots-from-mydreamshoots";
const productionConfirm = "--confirm=aidreamshoots-from-mydreamshoots-production";
const publicSyncConfirm = "--allow-aidreamshoots-public-sync";
if (target === "remote") {
  if (!process.argv.includes(productionConfirm)) throw new Error(`remote apply requires ${productionConfirm}`);
  process.env.DINGYUE_ENV = "remote";
  process.env.DATABASE_TARGET = "remote";
  process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 });
} else if (target !== "local") {
  throw new Error(`Unsupported target: ${target}`);
}
assertDatabaseTarget({ expectedTarget: target });
if (apply && !process.argv.includes(target === "remote" ? productionConfirm : localConfirm)) {
  throw new Error(`apply requires ${target === "remote" ? productionConfirm : localConfirm}`);
}
if (apply && !process.argv.includes(publicSyncConfirm)) {
  throw new Error(`AIdreamshoots public sync is fail-closed; apply requires ${publicSyncConfirm}`);
}
// Resolve the target before Prisma is constructed. Prisma reads DATABASE_URL
// during construction, so doing this in the reverse order would make a
// remote run silently use the local database client.
const prisma = new PrismaClient();
const now = new Date();
const nowIso = now.toISOString();
const SOURCE_COPY_TRANSLATION_VERSION = "aidreamshoots-es-source-copy-v1";
const defaultTranslationCachePath = path.join(process.cwd(), ".tmp", "aidreamshoots-spanish-copy", "translation-cache.json");
const translationCachePath = translationCachePathArg ? path.resolve(process.cwd(), translationCachePathArg) : defaultTranslationCachePath;
let sourceCopyTranslations = new Map();
const untranslatedSourceCopy = new Set();
const explicitNonPublicPaths = new Map([
  ["/ai-video-generation/image-to-video", "source_route_not_found"],
  ["/ai-video-generation/text-to-video", "source_route_not_found"],
  ["/partner-registration", "source_route_not_found"]
]);

// The Spanish Save the Date pages are generated and reviewed independently
// from the English source site. Keep the source-copy sync from replacing
// their relational content or deleting their vendor-generated media.
const AIDREAMSHOOTS_PROTECTED_SAVE_THE_DATE_PATHS = new Set([
  "/ai-save-the-date/valentines-day",
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/proposal",
  "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/wedding-invitation",
  "/ai-video-generation/wedding-invitation",
  "/ai-save-the-date/wedding-ceremony",
  "/ai-save-the-date/christmas",
  "/ai-save-the-date/halloween",
  "/ai-save-the-date/thanksgiving",
  "/ai-save-the-date/new-year",
  "/ai-save-the-date/mothers-day",
  "/ai-save-the-date/fathers-day"
]);

function isAidreamshootsProtectedSaveTheDatePath(value) {
  return AIDREAMSHOOTS_PROTECTED_SAVE_THE_DATE_PATHS.has(value);
}

function isAidreamshootsProtectedSaveTheDateAsset(value) {
  return typeof value === "string"
    && value.startsWith("assets/sites/site_aidreamshoots/");
}

function collectAidreamshootsTargetAssetReferences(value, output = new Set()) {
  if (typeof value === "string") {
    const normalized = value.split(/[?#]/)[0].replace(/^\//, "");
    if (isAidreamshootsProtectedSaveTheDateAsset(normalized)) output.add(normalized);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAidreamshootsTargetAssetReferences(item, output);
    return output;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectAidreamshootsTargetAssetReferences(item, output);
  }
  return output;
}

function protectAidreamshootsSaveTheDateDataset(dataset, targetCurrent) {
  if (dataset.spec.targetSiteId !== "site_mydreamshoots_xby") return dataset;

  const currentLiveBySlug = new Map((targetCurrent.livePages ?? []).map((row) => [row.slug, row]));
  const currentThemeBySlug = new Map((targetCurrent.pages ?? []).map((row) => [row.slug, row]));
  dataset.pages = dataset.pages.map((row) => {
    if (!isAidreamshootsProtectedSaveTheDatePath(row.slug)) return row;
    const current = currentLiveBySlug.get(row.slug);
    return current ? {
      id: current.id,
      siteId: current.siteId,
      pageType: current.pageType,
      templateKey: current.templateKey,
      slug: current.slug,
      title: current.title,
      contentJson: current.contentJson
    } : row;
  });
  dataset.themePages = dataset.themePages.map((row) => {
    if (!isAidreamshootsProtectedSaveTheDatePath(row.slug)) return row;
    const current = currentThemeBySlug.get(row.slug);
    return current ? {
      id: current.id,
      siteId: current.siteId,
      pageType: current.pageType,
      templateKey: current.templateKey,
      slug: current.slug,
      title: current.title,
      draftJson: current.draftJson,
      publishedJson: current.publishedJson,
      draftMeta: current.draftMeta
    } : row;
  });

  const protectedReferences = new Set();
  for (const page of currentLiveBySlug.values()) {
    if (isAidreamshootsProtectedSaveTheDatePath(page.slug)) collectAidreamshootsTargetAssetReferences(page.contentJson, protectedReferences);
  }
  for (const page of currentThemeBySlug.values()) {
    if (isAidreamshootsProtectedSaveTheDatePath(page.slug)) {
      collectAidreamshootsTargetAssetReferences(page.draftJson, protectedReferences);
      collectAidreamshootsTargetAssetReferences(page.publishedJson, protectedReferences);
    }
  }
  const protectedMedia = (targetCurrent.mediaAssets ?? []).filter((row) => protectedReferences.has(row.storageKey));
  const mediaByStorageKey = new Map((dataset.mediaAssets ?? []).map((row) => [row.storageKey, row]));
  for (const row of protectedMedia) if (!mediaByStorageKey.has(row.storageKey)) mediaByStorageKey.set(row.storageKey, row);
  dataset.mediaAssets = [...mediaByStorageKey.values()];
  dataset.protection = {
    saveTheDate: {
      enabled: true,
      paths: [...AIDREAMSHOOTS_PROTECTED_SAVE_THE_DATE_PATHS],
      preservedPages: dataset.pages.filter((row) => isAidreamshootsProtectedSaveTheDatePath(row.slug)).length,
      preservedMediaAssets: protectedMedia.length
    }
  };
  return dataset;
}

const specs = [
  {
    sourceSiteId: "site_dreamshoot",
    sourceToken: "dreamshoot",
    sourceSlug: "mydreamshoots",
    targetSiteId: "site_mydreamshoots_xby",
    targetToken: "mydreamshoots_xby",
    targetSlug: "aidreamshoots",
    targetDomain: "aidreamshoots.eu",
    name: "AIdreamshoots",
    readableBrand: "AIdreamshoots",
    supportEmail: "support@aidreamshoots.eu",
    market: "Paquetes de fotos con IA, modelos privados, herramientas creativas, creditos y galerias privadas",
    description:
      "AIdreamshoots es una tienda en espanol para crear retratos profesionales, fotos de pareja y albumes privados con IA desde tus selfies.",
    homeTitle: "AIdreamshoots - generador de fotos con IA online",
    homeDescription:
      "Convierte tus selfies en retratos profesionales, fotos de pareja y albumes privados con AIdreamshoots. Sube tus fotos, revisa creditos y crea resultados con IA desde casa.",
    homeKeywords:
      "generador de fotos IA,retratos profesionales IA,fotos de pareja IA,album privado IA,selfies,AIdreamshoots",
    defaultOgImage: "/assets/sites/site_aidreamshoots/og/aidreamshoots-og.png",
    logoImageUrl: "/assets/sites/site_aidreamshoots/brand/aidreamshoots-logo-refined.svg?v=20260717a",
    headerLinks: [
      ["Generacion de imagenes con IA", "/ai-image-generation"],
      ["Generacion de video con IA", "/ai-video-generation"],
      ["Mejores paquetes", "/best-packages"],
      ["Como funciona", "/workflow"],
      ["Blog", "/blog"],
      ["Precios", "/pricing"],
      ["Espacio de trabajo", "/app/create"]
    ],
    footerLinks: [
      ["Generacion de imagenes con IA", "/ai-image-generation", "product"],
      ["Generacion de video con IA", "/ai-video-generation", "product"],
      ["Mejores paquetes", "/best-packages", "product"],
      ["Como funciona", "/workflow", "product"],
      ["Precios", "/pricing", "product"],
      ["Blog", "/blog", "company"],
      ["Sobre nosotros", "/about-us", "company"],
      ["Contacto", "/contact-us", "company"],
      ["Circulo de creadores", "/creators-circle", "company"],
      ["Politica de reembolsos", "/refunds", "company"],
      ["Politica de privacidad", "/privacy", "support"],
      ["Politica de contenido", "/content", "support"],
      ["Terminos de servicio", "/terms", "support"],
      ["Politica de cookies", "/cookies", "support"]
    ]
  }
];

const titleTranslations = new Map(
  Object.entries({
    "starter": "Inicial",
    "starter yearly": "Inicial anual",
    "pro": "Pro",
    "pro yearly": "Pro anual",
    "premium": "Premium",
    "premium yearly": "Premium anual",
    "one-shot trial": "Prueba unica",
    "small credit pack": "Paquete pequeno de creditos",
    "medium credit pack": "Paquete medio de creditos",
    "large credit pack": "Paquete grande de creditos",
    "trailhead": "Punto de partida",
    "trailhead yearly": "Punto de partida anual",
    "wayfinder": "Explorador",
    "wayfinder yearly": "Explorador anual",
    "field atlas": "Atlas de campo",
    "field atlas yearly": "Atlas de campo anual",
    "extra 150 route credits": "150 creditos extra de ruta",
    "professional headshots": "Retratos profesionales",
    "world cup fan photos": "Fotos de hincha del Mundial",
    "hairstyle": "Peinados",
    "cyberpunk": "Cyberpunk",
    "gala photos": "Fotos de gala",
    "mafia": "Noir cinematografico",
    "nature": "Naturaleza",
    "travel scene pack": "Pack de escenas de viaje",
    "virtual try-on": "Probador virtual",
    "profile cards": "Tarjetas de perfil",
    "creator portraits": "Retratos para creadores",
    "fashion editorial": "Editorial de moda",
    "fashion editorial set": "Set editorial de moda",
    "anime avatar": "Avatar anime",
    "product style": "Estilo de producto",
    "social cards": "Tarjetas para redes",
    "wedding portraits": "Retratos de boda",
    "indian wedding": "Boda india",
    "desi wedding": "Boda desi",
    "valentine photos": "Fotos de San Valentin",
    "engagement": "Compromiso",
    "boudoir": "Boudoir",
    "holiday": "Festivos",
    "christmas couple": "Pareja navidena",
    "christmas photos": "Fotos de Navidad",
    "ai video add-ons": "Complementos de video IA",
    "ai video add ons": "Complementos de video IA",
    "magic upscaler": "Mejora magica",
    "creator": "Creador",
    "avatar": "Avatar",
    "wedding": "Boda",
    "cultural": "Cultural",
    "couple": "Pareja",
    "creative": "Creativo",
    "beauty": "Belleza",
    "sports": "Deportes",
    "sports scenes": "Escenas deportivas",
    "creator profiles": "Perfiles de creador",
    "creator intro": "Intro de creador",
    "reel idea": "Idea de reel",
    "couple photos": "Fotos de pareja",
    "album ready": "Album listo",
    "commerce": "Comercio",
    "social": "Social",
    "style": "Estilo",
    "preview": "Vista previa",
    "album": "Album",
    "video": "Video",
    "utility": "Utilidades",
    "headshots": "Retratos profesionales",
    "seasonal": "Temporada",
    "route portraits": "Retratos de ruta",
    "destination portraits": "Retratos de destino",
    "destination themes": "Temas de destino",
    "photo package themes": "Temas de paquetes de fotos",
    "travel moments": "Momentos de viaje",
    "adventure escapes": "Escapadas de aventura",
    "creator travel kits": "Kits de viaje para creadores",
    "local moments": "Momentos locales",
    "open-air routes": "Rutas al aire libre",
    "lifestyle routes": "Rutas lifestyle",
    "professional celebrations": "Celebraciones profesionales",
    "nature portrait studio": "Estudio de retrato natural",
    "city light night walks": "Paseos nocturnos con luz urbana",
    "evening route portraits": "Retratos de ruta al atardecer",
    "soft editorial room portraits": "Retratos editoriales de interior",
    "hairstyle try on stories": "Historias de prueba de peinado",
    "professional headshot studio": "Estudio de retratos profesionales",
    "milestone postcard sets": "Sets de postal para hitos",
    "holiday couple cards": "Tarjetas festivas de pareja",
    "gala night portraits": "Retratos de noche de gala",
    "heritage celebration portraits": "Retratos de celebracion familiar",
    "travel story kits": "Kits de historia de viaje",
    "route portrait packages": "Paquetes de retratos de ruta",
    "route portrait albums": "Albumes de retrato de ruta",
    "coastal light sets": "Sets de luz costera",
    "old quarter walks": "Paseos por casco antiguo",
    "island balcony scenes": "Escenas de balcon isleno",
    "cafe & street stories": "Historias de cafe y calle",
    "cafe and street stories": "Historias de cafe y calle",
    "scenic outlooks": "Miradores escenicos",
    "alpine trail frames": "Marcos de sendero alpino",
    "roadside escape frames": "Escapadas de carretera",
    "route moodboards": "Moodboards de ruta",
    "postcard story sets": "Sets de postal narrativa",
    "lagoon route studies": "Estudios de ruta en laguna",
    "private villa stays": "Estancias en villa privada",
    "rooftop city nights": "Noches urbanas en azotea",
    "market morning walks": "Paseos de mercado matinal",
    "rainy city breaks": "Escapadas de ciudad lluviosa",
    "desert road stories": "Historias de carretera desertica",
    "lake house weekends": "Fines de semana en casa del lago",
    "snow lodge escapes": "Escapadas en refugio de nieve",
    "rail journey portraits": "Retratos de viaje en tren",
    "travel journal covers": "Portadas de diario de viaje",
    "solo traveler profiles": "Perfiles de viajero solo",
    "shared route albums": "Albumes de ruta compartida",
    "family travel keepsakes": "Recuerdos de viaje familiar",
    "golden hour route stories": "Historias de ruta en hora dorada",
    "wellness retreat scenes": "Escenas de retiro wellness",
    "route portrait engine": "Motor de retratos de ruta",
    "coastal light composer": "Compositor de luz costera",
    "island balcony studio": "Estudio de balcon isleno",
    "scenic outlook maker": "Creador de miradores escenicos",
    "old quarter walk tool": "Herramienta de casco antiguo",
    "editorial getaway builder": "Constructor de escapadas editoriales",
    "cafe corner story tool": "Herramienta de cafe y calle",
    "alpine trail scene tool": "Herramienta de sendero alpino",
    "route moodboard tool": "Herramienta de moodboard de ruta",
    "postcard story set maker": "Creador de postales narrativas",
    "lagoon portrait mixer": "Mezclador de retratos de laguna",
    "desert road portraits": "Retratos de carretera desertica",
    "rail journey frames": "Marcos de viaje en tren",
    "market morning portraits": "Retratos de mercado matinal",
    "rooftop skyline set": "Set de horizonte urbano en azotea",
    "rainy city album tool": "Herramienta de album urbano lluvioso",
    "private villa portraits": "Retratos de villa privada",
    "snow lodge portraits": "Retratos en refugio de nieve",
    "lake house weekend tool": "Herramienta de casa del lago",
    "shared route album": "Album de ruta compartida",
    "family travel keepsakes": "Recuerdos de viaje familiar",
    "solo traveler profile set": "Set de perfil de viajero solo",
    "travel journal cover maker": "Creador de portada de diario de viaje",
    "private album curator": "Curador de album privado",
    "workflow": "Como funciona",
    "how it works": "Como funciona",
    "professional headshot maker": "Creador de retratos profesionales",
    "creator portrait studio": "Estudio de retratos para creadores",
    "world cup fan photos": "Fotos de hincha del Mundial",
    "cyberpunk portrait maker": "Creador de retratos cyberpunk",
    "gala photo maker": "Creador de fotos de gala",
    "noir character portraits": "Retratos noir de personaje",
    "anime avatar builder": "Constructor de avatar anime",
    "nature adventure photos": "Fotos de aventura natural",
    "product lifestyle photos": "Fotos lifestyle de producto",
    "background changer": "Cambiador de fondo",
    "background remover": "Eliminador de fondo",
    "magic eraser": "Borrador magico",
    "photo enhancer": "Mejorador de fotos",
    "portrait retouch": "Retoque de retrato",
    "unblur image": "Enfocar imagen",
    "color correction": "Correccion de color",
    "old photo restoration": "Restauracion de fotos antiguas",
    "edit by prompt": "Editar con instrucciones",
    "image to video concept": "Concepto de imagen a video",
    "profile clip maker": "Creador de clip de perfil",
    "fan poster motion": "Poster animado de hincha",
    "creator intro video": "Video intro de creador",
    "product teaser clip": "Clip teaser de producto",
    "animated avatar preview": "Vista previa de avatar animado",
    "fashion reel starter": "Inicio de reel de moda",
    "album story video": "Video narrativo de album",
    "free": "Incluido",
    "all": "Todo",
    "professional": "Profesional",
    "photo ai": "Foto IA",
    "ai photo edit": "Edicion de fotos IA",
    "video ai": "Video IA",
    "profile": "Perfil",
    "scene": "Escena",
    "outdoor": "Exterior",
    "studio": "Estudio",
    "social": "Redes",
    "retouch": "Retoque",
    "restore": "Restaurar",
    "prompt": "Instruccion",
    "destination tools": "Herramientas de destino",
    "travel moment tools": "Herramientas de momentos de viaje",
    "creator travel tools": "Herramientas de viaje para creadores",
    "work profiles": "Perfiles profesionales",
    "city": "Ciudad",
    "adventure": "Aventura",
    "postcard": "Postal",
    "itinerary": "Itinerario",
    "street": "Calle",
    "scenic": "Panoramico",
    "overlook": "Mirador",
    "walk": "Paseo",
    "trail": "Sendero",
    "moodboard": "Tablero visual",
    "lagoon": "Laguna",
    "desert": "Desierto",
    "rail": "Tren",
    "market": "Mercado",
    "skyline": "Horizonte",
    "rain": "Lluvia",
    "wellness": "Bienestar",
    "snow": "Nieve",
    "lake": "Lago",
    "author": "Autor",
    "founder": "Fundador",
    "designer": "Diseno",
    "proof": "Prueba",
    "catalog": "Catalogo",
    "motion": "Movimiento",
    "signature": "Firma visual",
    "current campaign: world cup fan photos": "Campana actual: fotos de hincha del Mundial",
    "current focus: private travel albums": "Enfoque actual: albumes privados de viaje",
    "next: valentine / graduation season": "Proximo: San Valentin / graduacion",
    "next: costero light / old quarter walks": "Proximo: luz costera / casco antiguo",
    "included outputs": "Resultados incluidos",
    "match-day pack": "Pack de partido",
    "destacado seasonal pack": "Pack destacado de temporada",
    "destacado package": "Paquete destacado",
    "mundial pack": "Pack del Mundial",
    "destino pack": "Pack de destino",
    "match-day avatar": "Avatar de partido",
    "costero": "Costero",
    "mydreamshoots hairstyle preview": "Vista previa de peinado AIdreamshoots",
    "mydreamshoots headshot": "Retrato profesional AIdreamshoots",
    "mydreamshoots world cup match day avatar": "Avatar de partido del Mundial AIdreamshoots",
    "mydreamshoots world cup banner cover": "Portada del Mundial AIdreamshoots",
    "mydreamshoots world cup friend fan photos": "Fotos de hinchas del Mundial AIdreamshoots",
    "mydreamshoots world cup fan poster": "Poster de hincha del Mundial AIdreamshoots",
    "mydreamshoots world cup stadium portrait": "Retrato de estadio del Mundial AIdreamshoots",
    "mydreamshoots world cup social story": "Historia para redes del Mundial AIdreamshoots",
    "private album workspace": "Espacio de album privado",
    "flow before upload": "Antes de subir fotos",
    "adventure tools": "Herramientas de aventura",
    "mydreamshoots nature adventure": "Aventura natural AIdreamshoots",
    "aidreamcapes cafe street portrait cover": "Portada de retrato de cafe y calle AIdreamcapes",
    "mydreamshoots beauty portrait": "Retrato de belleza AIdreamshoots",
    "mydreamshoots creator portrait": "Retrato de creador AIdreamshoots",
    "mydreamshoots holiday portrait": "Retrato festivo AIdreamshoots",
    "mydreamshoots social cards": "Tarjetas para redes AIdreamshoots",
    "mydreamshoots travel scene": "Escena de viaje AIdreamshoots",
    "hero credit studio card": "Tarjeta de creditos del estudio",
    "hero package wall": "Muro de paquetes del inicio",
    "pricing credits visual": "Visual de creditos y precios",
    "aidreamcapes coastal escape portrait cover": "Portada de escapada costera AIdreamcapes",
    "aidreamcapes editorial getaway portrait cover": "Portada de escapada editorial AIdreamcapes",
    "aidreamcapes island resort scene cover": "Portada de retrato en un resort isleño con paisaje tropical para un album privado de AIdreamcapes",
    "aidreamcapes cinematic travel portrait hero": "Heroe cinematico de retrato de viaje AIdreamcapes"
  })
);

const phrasePairs = [
  ["Home", "Inicio"],
  ["Operated by", "Gestionado por"],
  ["A guided place to compare AI photo directions, review credits, and keep finished work organized.", "Un espacio guiado para comparar estilos de fotos con IA, revisar créditos y mantener organizados los trabajos terminados."],
  ["Explore escena ideas", "Explora ideas de escenas"],
  ["Explore scene ideas", "Explora ideas de escenas"],
  ["Premium paquetes puede usa un privado identity workflow so resultados stay more consistent across different escenas.", "Los paquetes Premium pueden usar un flujo de identidad privada para mantener resultados más coherentes entre escenas."],
  ["premium paquetes puede usa un privado identidad flujo so resultados stay more consistent across diferente escenas.", "Los paquetes Premium pueden usar un flujo de identidad privada para mantener resultados más coherentes entre escenas."],
  ["Revisar la live credit requirement shown con la producto antes starting la solicitud.", "Revisa el requisito de créditos que aparece con el producto antes de iniciar la solicitud."],
  ["Como funciona ia video generacion brand video?", "¿Cómo funciona la generación de vídeo con IA para vídeos de marca?"],
  ["usa solo fuente material you own o tiene permission para usa. Revisar la complete result antes publishing.", "Usa solo material fuente propio o autorizado. Revisa el resultado completo antes de publicarlo."],
  ["Use only source material you own or have permission to use. Review the complete result before publishing.", "Usa solo material fuente propio o autorizado. Revisa el resultado completo antes de publicarlo."],
  ["View All guardar la fecha Estilos", "Ver todos los estilos de Guardar la fecha"],
  ["Create AI videos, professional AI headshots and photo sets from your images", "Crea videos con IA, retratos profesionales y conjuntos de fotos desde tus imagenes"],
  ["Create AI videos, Professional AI Headshots & Photo Sets from Your Images", "Crea videos con IA, retratos profesionales y conjuntos de fotos desde tus imagenes"],
  ["What is AIdreamshoots?", "Que es AIdreamshoots?"],
  ["How do I use AIdreamshoots?", "Como uso AIdreamshoots?"],
  ["What can I create with AIdreamshoots?", "Que puedo crear con AIdreamshoots?"],
  ["Is AIdreamshoots free?", "AIdreamshoots es gratis?"],
  ["Who operates AIdreamshoots?", "Quien gestiona AIdreamshoots?"],
  ["Are my uploads and personal data private?", "Mis subidas y datos personales son privados?"],
  ["What is the refund policy?", "Cual es la politica de reembolsos?"],
  ["Email address", "Correo electronico"],
  ["AI Headshots", "Retratos profesionales con IA"],
  ["Creating AI videos, personalized Save the Date videos, and professional photo sets from your images—all in one private workspace.", "Crea videos con IA, videos personalizados de Save the Date y conjuntos de fotos profesionales desde tus imagenes, todo en un espacio privado."],
  ["Create AI videos, personalized Save the Date videos, and professional photo sets from your images—all in one private workspace.", "Crea videos con IA, videos personalizados de Save the Date y conjuntos de fotos profesionales desde tus imagenes, todo en un espacio privado."],
  ["AIdreamshoots is an AI photo and video creator platform with creativity creators from all over the world. Creators are not simply content distributors. At their best, they are brokers of trust.", "AIdreamshoots es una plataforma de creacion de fotos y videos con IA para personas creativas de todo el mundo. Los creadores convierten ideas en resultados de confianza."],
  ["Subidas, imagen y video generations, historial de creditos, y privado galerias stay connected to la cliente's signed-in cuenta.", "Las subidas, generaciones de imagenes y videos, historial de creditos y galerias privadas permanecen vinculados a tu cuenta."],
  ["Uploads, image and video generations, credit history, and private galleries stay connected to the customer's signed-in account.", "Las subidas, generaciones de imagenes y videos, historial de creditos y galerias privadas permanecen vinculados a tu cuenta."],
  ["Revisar tu active plan, remaining creditos, top-up options, checkout history, y paquete usage antes starting la next IA foto conjunto.", "Revisa tu plan activo, creditos restantes, recargas, historial de pago y uso de paquetes antes de iniciar tu proximo conjunto de fotos con IA."],
  ["Review your active plan, remaining credits, top-up options, checkout history, and package usage before starting the next AI photo set.", "Revisa tu plan activo, creditos restantes, recargas, historial de pago y uso de paquetes antes de iniciar tu proximo conjunto de fotos con IA."],
  ["terminados profesional retrato profesional maker outputs stay connected to la signed-in cuenta y appear in la myᕲreamshoots privado espacio para revisa, download, y cuenta history. resultados son not public con default, ", "Los resultados de retratos profesionales permanecen en tu cuenta y aparecen en tu espacio privado para revisar, descargar y consultar el historial. Por defecto no son publicos."],
  ["View All guardar la fecha Estilos", "Ver todos los estilos de Save the Date"],
  ["Use one CTA ese matches la destination: learn more, register, shop la offer, join la launch, watch la reveal, o another real next step.", "Usa una llamada a la accion que coincida con el destino: saber mas, registrarse, comprar la oferta, unirse al lanzamiento, ver la revelacion u otro siguiente paso real."],
  ["tu selected plan, credit amount, y checkout status stay connected to tu AIdreamshoots cuenta. Creditos son added despues payment confirmation.", "Tu plan seleccionado, cantidad de creditos y estado del pago permanecen vinculados a tu cuenta de AIdreamshoots. Los creditos se anaden despues de confirmar el pago."],
  ["Your selected plan, credit amount, and checkout status stay connected to your myDreamshoots account. Credits are added after payment confirmation.", "Tu plan seleccionado, cantidad de creditos y estado del pago permanecen vinculados a tu cuenta de AIdreamshoots. Los creditos se anaden despues de confirmar el pago."],
  ["Avoid sending unnecessary private photos through external channels. The workspace is the preferred place for source photos and private generation records; support usually needs identifiers and a description before any additional image reference.", "Evita enviar fotos privadas innecesarias por canales externos. El espacio privado es el lugar recomendado para fotos fuente y registros de generacion; soporte suele necesitar identificadores y una descripcion antes de pedir imagenes adicionales."],
  ["View all herramientas", "Ver todas las herramientas"],
  ["Subidas, imagen y video generations, historial de creditos, y privado galerias stay connected to la cliente's signed-in cuenta.", "Las subidas, generaciones de imagenes y videos, historial de creditos y galerias privadas permanecen vinculados a tu cuenta."],
  ["Revisar tu active plan, remaining creditos, top-up options, checkout history, y paquete usage antes starting la next IA foto conjunto.", "Revisa tu plan activo, creditos restantes, recargas, historial de pago y uso de paquetes antes de iniciar tu proximo conjunto de fotos con IA."],
  ["terminados profesional retrato profesional maker outputs stay connected to la signed-in cuenta y appear in la myᕲreamshoots privado espacio para revisa, download, y cuenta history. resultados son not public con default, ", "Los resultados de retratos profesionales permanecen en tu cuenta y aparecen en tu espacio privado para revisar, descargar y consultar el historial. Por defecto no son publicos."],
  ["View All guardar la fecha Estilos", "Ver todos los estilos de Save the Date"],
  ["Use one CTA ese matches la destination: learn more, register, shop la offer, join la launch, watch la reveal, o another real next step.", "Usa una llamada a la accion que coincida con el destino: saber mas, registrarse, comprar la oferta, unirse al lanzamiento, ver la revelacion u otro siguiente paso real."],
  ["tu selected plan, credit amount, y checkout status stay connected to tu AIdreamshoots cuenta. Creditos son added despues payment confirmation.", "Tu plan seleccionado, cantidad de creditos y estado del pago permanecen vinculados a tu cuenta de AIdreamshoots. Los creditos se anaden despues de confirmar el pago."],
  ["Subidas, generations, historial de creditos, y albums stay connected to la cliente's signed-in cuenta.", "Las subidas, generaciones, historial de creditos y albumes permanecen vinculados a tu cuenta."],
  ["terminados imagenes o clips stay connected to la signed-in AIdreamshoots espacio o galeria privada para revisa, download, y cuenta history. resultados son not public con default, but clientes still control anything they ", "Las imagenes o clips terminados permanecen en tu espacio o galeria privada para revisar, descargar y consultar el historial. Por defecto no son publicos, y tu controlas lo que compartes."],
  ["What is myDreamshoots?", "Que es AIdreamshoots?"],
  ["How do I use myDreamshoots?", "Como uso AIdreamshoots?"],
  ["What can I create with myDreamshoots?", "Que puedo crear con AIdreamshoots?"],
  ["Is myDreamshoots free?", "AIdreamshoots es gratis?"],
  ["How do plans, credits, and promotions work?", "Como funcionan los planes, creditos y promociones?"],
  ["When are credits used?", "Cuando se usan los creditos?"],
  ["What photos should I upload?", "Que fotos debo subir?"],
  ["Can I create couple or group photos?", "Puedo crear fotos de pareja o grupo?"],
  ["How does the AI photo generator work?", "Como funciona el generador de fotos con IA?"],
  ["How does the AI video workflow work?", "Como funciona el flujo de video con IA?"],
  ["How do virtual looks, hairstyle, and styling tools work?", "Como funcionan los looks virtuales, peinados y herramientas de estilo?"],
  ["Who operates myDreamshoots?", "Quien gestiona AIdreamshoots?"],
  ["Can I use AI photos on social media, profiles, or business pages?", "Puedo usar fotos con IA en redes, perfiles o paginas profesionales?"],
  ["Are my uploads and personal data private?", "Mis subidas y datos personales son privados?"],
  ["What is the refund policy?", "Cual es la politica de reembolsos?"],
  ["AI Video & Photo Creation", "Creacion de video y fotos con IA"],
  ["Create AI Videos, Professional AI Headshots & Photo Sets from Your Images", "Crea videos con IA, retratos profesionales y conjuntos de fotos a partir de tus imagenes"],
  ["Review credits before generation", "Revisa los creditos antes de generar"],
  ["Training policy - ", "Politica de entrenamiento - "],
  ["Source-photo retention - Source photos follow the published ", "Retencion de fotos fuente - Las fotos fuente siguen el periodo publicado de "],
  ["Refund review - ", "Revision de reembolsos - "],
  ["Requests should be submitted within ", "Las solicitudes deben enviarse en un plazo de "],
  ["Secure account workflow - Uploads, requests, credit review, and galleries stay inside your signed-in account.", "Flujo seguro de cuenta - Las subidas, solicitudes, revision de creditos y galerias permanecen en tu cuenta."],
  ["AI video & photo workflows", "Flujos de video y fotos con IA"],
  ["Upload your photos and choose what you want to create—from AI videos and personalized Save the Date videos to professional AI headshots, portraits, couple photos, seasonal images, and creative photo sets. Review examples and credit costs before generation, then access your finished results in your workspace.", "Sube tus fotos y elige lo que quieres crear: videos con IA, videos personalizados de Save the Date, retratos profesionales, retratos de pareja, imagenes de temporada y conjuntos creativos. Revisa ejemplos y creditos antes de generar y accede a tus resultados en tu espacio privado."],
  ["Create AI videos and photo sets for social content, Save the Date moments, professional profiles, portraits, couple photos, seasonal images, and creative projects.", "Crea videos y conjuntos de fotos con IA para contenido social, momentos de Save the Date, perfiles profesionales, retratos, fotos de pareja, imagenes de temporada y proyectos creativos."],
  ["Start Creating with Email", "Empieza a crear con tu correo"],
  ["Continue with Google", "Continuar con Google"],
  ["Private uploads, requests, galleries", "Subidas, solicitudes y galerias privadas"],
  ["shown before generation", "mostrado antes de generar"],
  ["Browse image and video themes customers have already created.", "Explora temas de imagenes y videos que ya han creado nuestros clientes."],
  ["Customer-created examples", "Ejemplos creados por clientes"],
  ["These examples use materials customers created in private accounts. Scan the theme labels to choose a direction for your own set.", "Estos ejemplos usan materiales creados por clientes en cuentas privadas. Revisa las etiquetas para elegir una direccion para tu propio conjunto."],
  ["Featured AI Photo Generators", "Generadores de fotos con IA destacados"],
  ["Start with your photos", "Empieza con tus fotos"],
  ["Featured AI Video Generators", "Generadores de video con IA destacados"],
  ["How it works", "Como funciona"],
  ["Homepage tutorial screenshot showing the AI headshot hero, navigation, and account signup panel.", "Captura del tutorial de inicio con el hero de retrato profesional con IA, la navegacion y el panel de registro."],
  ["Upload approved source photos, choose a workflow, review the credit cost, and generate inside your signed-in workspace.", "Sube fotos fuente autorizadas, elige un flujo, revisa el coste en creditos y genera dentro de tu espacio privado."],
  ["Watch the myDreamshoots AI image tutorial", "Ver el tutorial de imagenes con IA de AIdreamshoots"],
  ["Use a supported AI Video workflow when you want to turn an approved image or image set into a short motion result, then review the full clip before publishing.", "Usa un flujo de video con IA compatible para convertir una imagen o conjunto autorizado en un resultado breve y revisa el clip completo antes de publicarlo."],
  ["What Our Customers Say", "Lo que dicen nuestros clientes"],
  ["Our users love us and we love them!", "A nuestros usuarios les encanta y a nosotros tambien."],
  ["myDreamshoots is an AI photo and video creator platform with creativity creators from all over the world. Creators are not simply content distributors. At their best, they are brokers of trust.", "AIdreamshoots es una plataforma de creacion de fotos y videos con IA para personas creativas de todo el mundo. Los creadores no son simples distribuidores de contenido: ayudan a convertir ideas en resultados de confianza."],
  ["Positive reviews", "Opiniones positivas"],
  ["Fan photos", "Fotos de hincha"],
  ["VIP-style set", "Conjunto de estilo premium"],
  ["Christmas album", "Album de Navidad"],
  ["Credit planning", "Planificacion de creditos"],
  ["Creator workflow", "Flujo de creador"],
  ["Clear credits", "Creditos claros"],
  ["Team portraits", "Retratos de equipo"],
  ["Motion previews", "Vistas previas de movimiento"],
  ["Sports fan set", "Conjunto de aficionado al deporte"],
  ["Profile images", "Imagenes de perfil"],
  ["Holiday cards", "Tarjetas festivas"],
  ["Private gallery", "Galeria privada"],
  ["Creator scenes", "Escenas de creador"],
  ["Headshots and cards", "Retratos profesionales y tarjetas"],
  ["Profile refresh", "Renovacion de perfil"],
  ["Social content", "Contenido social"],
  ["FAQ", "Preguntas frecuentes"],
  ["Questions before upload", "Preguntas antes de subir fotos"],
  ["Clear answers about source photos, packages, credits, AI images, short videos, styling tools, privacy, publishing, and delivery.", "Respuestas claras sobre fotos fuente, paquetes, creditos, imagenes con IA, videos cortos, herramientas de estilo, privacidad, publicacion y entrega."],
  ["Your photo flow", "Tu flujo de fotos"],
  ["Upload|Choose Pack|Generate|Download", "Subir|Elegir paquete|Generar|Descargar"],
  ["Add clean source photos.|Pick a scene or style.|AI builds your set.|Download from the private gallery.", "Anade fotos fuente claras.|Elige una escena o estilo.|La IA crea tu conjunto.|Descarga desde la galeria privada."],
  ["Create Now", "Crear ahora"],
  ["AI VIDEO + PHOTO CREATION", "CREACION DE VIDEO Y FOTOS CON IA"],
  ["Creating AI videos, personalized Save the Date videos, and professional photo sets from your images—all in one private workspace.", "Crea videos con IA, videos personalizados de Save the Date y conjuntos de fotos profesionales desde tus imagenes, todo en un espacio privado."] ,
  ["MyDreamShoots", "AIdreamshoots"],
  ["MydreamShoots", "AIdreamshoots"],
  ["Mydreamshoots", "AIdreamshoots"],
  ["DreamShootAI", "AIdreamshoots"],
  ["Aidreamcapes", "AIdreamcapes"],
  ["Browse packages", "Ver paquetes"],
  ["Ready to try", "Listo para probar"],
  ["Read the refund policy", "Lee la politica de reembolsos"],
  ["Watch the", "Ver el"],
  ["View all photos", "Ver todas las fotos"],
  ["View all videos", "Ver todos los videos"],
  ["View all video themes", "Ver todos los temas de video"],
  ["Free tools preview. Credits generate.", "Herramientas incluidas para vista previa. Los creditos se consumen al generar."],
  ["Free tools vista previa. Creditos generate.", "Herramientas incluidas para vista previa. Los creditos se consumen al generar."],
  ["Travel portrait credit plans", "Planes de creditos para retratos de viaje"],
  ["Viaje portrait credit plans", "Planes de creditos para retratos de viaje"],
  ["From source photos to a private travel gallery.", "De fotos fuente a una galeria privada de viaje."],
  ["From fotos fuente to a private travel gallery.", "De fotos fuente a una galeria privada de viaje."],
  ["Upload photos you own, choose the photo package you want, review the visible credit cost, generate the private request, and download finished images from your account gallery.", "Sube fotos propias o autorizadas, elige el paquete, revisa el coste visible en creditos, genera la solicitud privada y descarga los resultados desde tu galeria."],
  ["Subir fotos you own, choose the photo package you want, review the visible credit cost, generate the private request, and download finished images from your account gallery.", "Sube fotos propias o autorizadas, elige el paquete, revisa el coste visible en creditos, genera la solicitud privada y descarga los resultados desde tu galeria."],
  ["Upload clear photos you own or have permission to use.|Choose headshots, fan posters, creator portraits, beauty previews, and themed albums.|Review the credit cost before generation starts.|Download finished results from your private gallery.", "Sube fotos claras propias o autorizadas.|Elige retratos profesionales, posters de hincha, retratos de creador, vistas de belleza y albumes tematicos.|Revisa el coste en creditos antes de generar.|Descarga resultados desde tu galeria privada."],
  ["Subir fotos you own or have permission to use.|Choose headshots, fan posters, creator portraits, beauty previews, and themed albums.|Review the credit cost before generation starts.|Download finished results from your private gallery.", "Sube fotos claras propias o autorizadas.|Elige retratos profesionales, posters de hincha, retratos de creador, vistas de belleza y albumes tematicos.|Revisa el coste en creditos antes de generar.|Descarga resultados desde tu galeria privada."],
  ["Use photos you own or have permission to use. Choose a package, review the credit cost, generate private results, and download favorites.", "Usa fotos propias o autorizadas. Elige un paquete, revisa el coste en creditos, genera resultados privados y descarga tus favoritos."],
  ["Use fotos you own or have permission to use. Choose a package, review the credit cost, generate private results, and download favorites.", "Usa fotos propias o autorizadas. Elige un paquete, revisa el coste en creditos, genera resultados privados y descarga tus favoritos."],
  ["Plan the destination mood, attach source photos you own, review route credits, generate a private travel portrait request, and collect finished images in your account gallery.", "Define el ambiente de destino, adjunta retratos fuente propios o autorizados, revisa creditos de ruta, genera una solicitud privada y recoge las imagenes en tu galeria."],
  ["Plan the destination mood, attach fotos fuente you own, review creditos de ruta, generate a private travel portrait request, and collect finished images in your account gallery.", "Define el ambiente de destino, adjunta retratos fuente propios o autorizados, revisa creditos de ruta, genera una solicitud privada y recoge las imagenes en tu galeria."],
  ["Starter, Pro, and Premium map to real product prices, credits, and checkout records.", "Inicial, Pro y Premium se conectan con precios reales, creditos y registros de pago."],
  ["Starter, Pro, and Premium map to real product prices, creditos, and checkout records.", "Inicial, Pro y Premium se conectan con precios reales, creditos y registros de pago."],
  ["Upload your selfies, choose a style, review the credit cost, and download a private photo set.", "Sube tus selfies, elige un estilo, revisa el coste en creditos y descarga un set privado."],
  ["Subir your selfies, choose a style, review the credit cost, and download a private photo set.", "Sube tus selfies, elige un estilo, revisa el coste en creditos y descarga un set privado."],
  ["Monthly credits, one-time top-ups, and site-scoped galleries in one storefront.", "Creditos mensuales, recargas puntuales y galerias del sitio en una sola tienda."],
  ["Monthly creditos, one-time top-ups, and site-scoped galleries in one storefront.", "Creditos mensuales, recargas puntuales y galerias del sitio en una sola tienda."],
  ["Collect source portraits and style references in one site-scoped workspace.", "Reune retratos fuente y referencias de estilo en un espacio privado del sitio."],
  ["Collect retratos fuente and style references in one site-scoped workspace.", "Reune retratos fuente y referencias de estilo en un espacio privado del sitio."],
  ["Create social profile motion from headshots or creator portraits.", "Crea clips de perfil para redes desde retratos profesionales o retratos de creador."],
  ["Crear social profile motion from retratos profesionales or creator portraits.", "Crea clips de perfil para redes desde retratos profesionales o retratos de creador."],
  ["Start from a known package like headshots, World Cup fan photos, cyberpunk, gala, nature, beauty, creator, or product-style scenes instead of writing a blank prompt.", "Empieza desde un paquete conocido como retratos profesionales, fotos de hincha del Mundial, cyberpunk, gala, naturaleza, belleza, creador o escenas de producto, sin escribir instrucciones desde cero."],
  ["Start from a known package like retratos profesionales, World Cup fan photos, cyberpunk, gala, nature, beauty, creator, or product-style scenes instead of writing a blank prompt.", "Empieza desde un paquete conocido como retratos profesionales, fotos de hincha del Mundial, cyberpunk, gala, naturaleza, belleza, creador o escenas de producto, sin escribir instrucciones desde cero."],
  ["Create work-ready AI headshots for LinkedIn, resumes, founder bios, speaker pages, and team profiles. Credit cost is shown before generation.", "Crea retratos profesionales listos para LinkedIn, curriculos, biografias de fundadores, ponentes y equipos. El coste en creditos se muestra antes de generar."],
  ["Crear work-ready retratos profesionales for LinkedIn, resumes, founder bios, speaker pages, and team profiles. Credit cost is shown before generation.", "Crea retratos profesionales listos para LinkedIn, curriculos, biografias de fundadores, ponentes y equipos. El coste en creditos se muestra antes de generar."],
  ["Credit cost is shown before generation.", "El coste en creditos se muestra antes de generar."],
  ["Turn source photos into train-window, platform, and slow travel portrait scenes.", "Convierte fotos fuente en escenas de tren, anden y viaje pausado."],
  ["Turn fotos fuente into train-window, platform, and slow travel portrait scenes.", "Convierte fotos fuente en escenas de tren, anden y viaje pausado."],
  ["Each Aidreamcapes page is designed around a clear travel portrait outcome so customers know what to upload, what credits are reserved, and where finished images will arrive.", "Cada pagina de AIdreamcapes se orienta a un resultado claro de retrato de viaje para que el cliente sepa que subir, que creditos se reservan y donde llegaran las imagenes finales."],
  ["Each AIdreamcapes page is designed around a clear travel portrait outcome so customers know what to upload, what credits are reserved, and where finished images will arrive.", "Cada pagina de AIdreamcapes se orienta a un resultado claro de retrato de viaje para que el cliente sepa que subir, que creditos se reservan y donde llegaran las imagenes finales."],
  ["Each AIdreamcapes page is designed around a clear travel portrait outcome so customers know what to upload, what creditos are reserved, and where finished images will arrive.", "Cada pagina de AIdreamcapes se orienta a un resultado claro de retrato de viaje para que el cliente sepa que subir, que creditos se reservan y donde llegaran las imagenes finales."],
  ["Travel Packages", "Paquetes de viaje"],
  ["Tools", "Herramientas"],
  ["How it works", "Como funciona"],
  ["Pricing", "Precios"],
  ["Examples", "Ejemplos"],
  ["Help", "Ayuda"],
  ["FAQ", "Preguntas"],
  ["All|Sports|Headshots|Beauty|Creative|Lifestyle|Seasonal|Video", "Todo|Deportes|Retratos profesionales|Belleza|Creativo|Estilo de vida|Temporada|Video"],
  ["All|Sports|Headshots|Beauty|Creative|Travel|Seasonal|Video", "Todo|Deportes|Retratos profesionales|Belleza|Creativo|Viaje|Temporada|Video"],
  ["All|Sports|Headshots|Beauty|Creative|Wedding|Seasonal|Video", "Todo|Deportes|Retratos profesionales|Belleza|Creativo|Boda|Temporada|Video"],
  ["All|Deportes|Retratos profesionales|Beauty|Creative|Lifestyle|Seasonal|Video", "Todo|Deportes|Retratos profesionales|Belleza|Creativo|Estilo de vida|Temporada|Video"],
  ["All|Deportes|Retratos profesionales|Beauty|Creative|Viaje|Seasonal|Video", "Todo|Deportes|Retratos profesionales|Belleza|Creativo|Viaje|Temporada|Video"],
  ["All|Deportes|Retratos profesionales|Beauty|Creative|Wedding|Seasonal|Video", "Todo|Deportes|Retratos profesionales|Belleza|Creativo|Boda|Temporada|Video"],
  ["All|", "Todo|"],
  ["|Beauty|", "|Belleza|"],
  ["|Creative|", "|Creativo|"],
  ["|Wedding|", "|Boda|"],
  ["|Seasonal|", "|Temporada|"],
  ["Beauty set", "Set de belleza"],
  ["Login Method Panel", "Panel de acceso"],
  ["Customer image themes", "Temas de imagen del cliente"],
  ["Customer temas de destino", "Temas de destino del cliente"],
  ["Customer travel video themes", "Temas de video de viaje del cliente"],
  ["Optional note", "Nota opcional"],
  ["See examples of what your selfies can become: headshots, fan posters, creator portraits, style previews, and seasonal albums.", "Mira ejemplos de lo que tus selfies pueden convertirse: retratos profesionales, carteles de hincha, retratos de creador, vistas previas de estilo y albumes de temporada."],
  ["Sign in", "Iniciar sesion"],
  ["Sign out", "Cerrar sesion"],
  ["Destination themes", "Temas de destino"],
  ["destination themes", "temas de destino"],
  ["Destino themes", "Temas de destino"],
  ["photo package themes", "temas de paquetes de fotos"],
  ["Upload source photos", "Subir fotos fuente"],
  ["Upload photos", "Subir fotos"],
  ["Start this photo set", "Iniciar este set de fotos"],
  ["Open this step", "Abrir este paso"],
  ["Open step", "Abrir paso"],
  ["Open tool", "Abrir herramienta"],
  ["Choose tool", "Elegir herramienta"],
  ["Choose a tool", "Elegir herramienta"],
  ["Track progress", "Seguir progreso"],
  ["Download albums", "Descargar albumes"],
  ["Private intake", "Subidas privadas"],
  ["Live progress", "Progreso en vivo"],
  ["Private delivery", "Entrega privada"],
  ["Tool first", "Herramienta primero"],
  ["Private customer account", "Cuenta privada de cliente"],
  ["Album-ready workflow", "Flujo listo para album"],
  ["Live credits and delivery", "Creditos y entrega en vivo"],
  ["Create my first photo set", "Crear mi primer set de fotos"],
  ["Start a package", "Empezar un paquete"],
  ["How credits work for private AI photo packages.", "Como funcionan los creditos para paquetes privados de fotos con IA."],
  ["Credits for private AI photo packages.", "Creditos para paquetes privados de fotos con IA."],
  ["private AI photo packages", "paquetes privados de fotos con IA"],
  ["AI photo packages", "paquetes de fotos con IA"],
  ["AI photo package", "paquete de fotos con IA"],
  ["Create private AI photo sets from everyday selfies.", "Crea sets privados de fotos con IA desde selfies cotidianos."],
  ["Create AI travel portraits from everyday uploads.", "Crea retratos de viaje con IA desde tus fotos cotidianas."],
  ["Private uploads", "Subidas privadas"],
  ["Credit cost shown upfront", "Coste en creditos visible antes de generar"],
  ["Download your favorites", "Descarga tus favoritos"],
  ["Private gallery", "Galeria privada"],
  ["private gallery", "galeria privada"],
  ["Private model", "Modelo privado"],
  ["Privado model", "Modelo privado"],
  ["Album-ready", "Listo para album"],
  ["Album ready", "Listo para album"],
  ["Full package catalog", "Catalogo completo de paquetes"],
  ["15+ package themes", "15+ temas de paquete"],
  ["Uploaded", "Subidas"],
  ["Uploads", "Subidas"],
  ["uploaded", "subidas"],
  ["uploads", "subidas"],
  ["Customer login", "Acceso de cliente"],
  ["Customer workspace", "Espacio privado del cliente"],
  ["Account and billing", "Cuenta y facturacion"],
  ["Job progress", "Progreso del pedido"],
  ["Job detail", "Detalle del pedido"],
  ["Private album", "Album privado"],
  ["Privacy policy", "Politica de privacidad"],
  ["Refund policy", "Politica de reembolsos"],
  ["Refunds", "Reembolsos"],
  ["Cookie policy", "Politica de cookies"],
  ["Content policy", "Politica de contenido"],
  ["Terms of Service", "Terminos de servicio"],
  ["Digital delivery policy", "Politica de entrega digital"],
  ["Shipping and Digital Delivery Policy", "Politica de entrega digital"],
  ["Help center", "Centro de ayuda"],
  ["Help Center", "Centro de ayuda"],
  ["About Us", "Sobre nosotros"],
  ["Contact Us", "Contacto"],
  ["Company address", "Direccion de empresa"],
  ["What to include", "Que incluir"],
  ["Support", "Soporte"],
  ["Sales", "Ventas"],
  ["Guides", "Guias"],
  ["Search", "Buscar"],
  ["Cart", "Carrito"],
  ["Photo AI|AI Photo Edit|Video AI", "Fotos IA|Edicion IA|Video IA"],
  ["Photo Package Edit|Photo AI|AI Video", "Edicion de paquetes|Fotos IA|Video IA"],
  ["Route Portrait Edit|Route Portrait|AI Video", "Edicion de ruta|Retratos de ruta|Video IA"],
  ["Start Ruta Portrait Engine", "Abrir motor de retratos de ruta"],
  ["Continue with guides on retratos fuente, destination references, route mood, credit planning, and private album review.", "Continua con guias sobre retratos fuente, referencias de destino, ambiente de ruta, planificacion de creditos y revision de album privado."],
  ["Use the account area to check plan status, route set usage, credit reservations, receipts, and add-on creditos before the next destination album.", "Usa el area de cuenta para revisar estado del plan, uso de rutas, reservas de creditos, recibos y creditos adicionales antes del siguiente album de destino."],
  ["Search products, packs, tools, and content for this site.", "Busca productos, paquetes, herramientas y contenido de este sitio."],
  ["Search photo packages, AI tools, pricing, and help guides.", "Busca paquetes de fotos, herramientas IA, precios y guias."],
  ["Search route portrait packages, tools, pricing, and help guides.", "Busca paquetes de retrato de ruta, herramientas, precios y guias."],
  ["Find travel portrait tools, coastal light set packages, destination guidance, pricing, source-photo help, privacy details, refund information, and private gallery support.", "Encuentra herramientas de retratos de viaje, paquetes de luz costera, guias de destino, precios, ayuda con fotos fuente, privacidad, reembolsos y soporte de galeria privada."],
  ["Find travel portrait tools, coastal light set packages, destination guidance, pricing, source-photo help, privacy details, refund information, and galeria privada support.", "Encuentra herramientas de retratos de viaje, paquetes de luz costera, guias de destino, precios, ayuda con fotos fuente, privacidad, reembolsos y soporte de galeria privada."],
  ["Route credits", "Creditos de ruta"],
  ["route credits", "creditos de ruta"],
  ["Ruta creditos", "Creditos de ruta"],
  ["Photo credits", "Creditos de fotos"],
  ["photo credits", "creditos de fotos"],
  ["starter credits", "creditos iniciales"],
  ["starter creditos", "creditos iniciales"],
  ["credits", "creditos"],
  ["Credits", "Creditos"],
  ["Headshots", "Retratos profesionales"],
  ["headshots", "retratos profesionales"],
  ["Headshot", "Retrato profesional"],
  ["headshot", "retrato profesional"],
  ["Hairstyle previews", "Vistas previas de peinado"],
  ["hairstyle previews", "vistas previas de peinado"],
  ["Style previews", "Vistas previas de estilo"],
  ["style previews", "vistas previas de estilo"],
  ["previews", "vistas previas"],
  ["Previews", "Vistas previas"],
  ["Preview", "Vista previa"],
  ["preview", "vista previa"],
  ["monthly", "mensual"],
  ["yearly", "anual"],
  ["Output count", "Cantidad de resultados"],
  ["Style", "Estilo"],
  ["Core", "Principal"],
  ["Profile", "Perfil"],
  ["Creator", "Creador"],
  ["Sports", "Deportes"],
  ["Getaway", "Escapada"],
  ["Route", "Ruta"],
  ["Coastal", "Costero"],
  ["Island", "Isla"],
  ["Travel", "Viaje"],
  ["Studio", "Estudio"],
  ["Private", "Privado"],
  ["Create", "Crear"],
  ["Upload", "Subir"],
  ["Download", "Descargar"],
  ["Generate", "Generar"],
  ["Review", "Revisar"],
  ["Choose", "Elegir"],
  ["Use cases", "Casos de uso"],
  ["Personal AI Model", "Modelo IA privado"],
  ["AI Video", "Video IA"],
  ["AI Video Add-ons", "Complementos de video IA"],
  ["Featured", "Destacado"],
  ["History", "Historial"],
  ["Stripe", "Pago"],
  ["Free", "Incluido"],
  ["free entry", "entrada sin coste"],
  ["credit history", "historial de creditos"],
  ["ledger check", "revision de saldo"],
  ["More field notes", "Mas notas de campo"],
  ["Most Popular", "Mas elegido"],
  ["Best Value", "Mejor valor"],
  ["Select plan", "Seleccionar plan"],
  ["Choose a plan first", "Elige un plan primero"],
  ["Elegir a plan", "Elegir plan"],
  ["Revisar creditos first", "Revisa los creditos primero"],
  ["Back to pricing", "Volver a precios"],
  ["Sign in to continue", "Iniciar sesion para continuar"],
  ["Current account", "Cuenta actual"],
  ["Current balance", "Saldo actual"],
  ["Selected plan", "Plan seleccionado"],
  ["Checkout summary", "Resumen de pago"],
  ["Open pricing to select a monthly or yearly subscription plan.", "Abre precios para elegir una suscripcion mensual o anual."],
  ["Open pricing to select a subscription or one-time credit pack.", "Abre precios para elegir una suscripcion o una recarga puntual."],
  ["Open pricing to select a subscription or credit pack.", "Abre precios para elegir una suscripcion o un paquete de creditos."],
  ["Fast sign-in for returning customers.", "Acceso rapido para clientes que vuelven."],
  ["Password login is available for galeria privada access.", "Accede con contrasena para entrar a tu galeria privada."],
  ["When are creditos used?", "Cuando se usan los creditos?"],
  ["When are creditos spent?", "Cuando se descuentan los creditos?"],
  ["What happens if I cancel a plan?", "Que pasa si cancelo un plan?"],
  ["Can unused creditos be reviewed?", "Puedo revisar los creditos sin usar?"],
  ["Pick a destination brief", "Define una ruta visual"],
  [
    "Pick a coastal, old city, island resort, alpine trail frame, road trip, or postcard direction.",
    "Elige costa, casco antiguo, isla, sendero alpino, carretera o postal como direccion visual."
  ],
  ["source portraits", "retratos fuente"],
  ["source photos", "fotos fuente"],
  ["source photo", "foto fuente"],
  ["Source portraits", "Retratos fuente"],
  ["Source photos", "Fotos fuente"],
  ["Source photo", "Foto fuente"],
  ["choose route cues", "elige pistas de ruta"],
  ["choose destination cues", "elige pistas de destino"],
  ["confirm creditos", "confirma creditos"],
  ["receive cinematic travel portraits", "recibe retratos de viaje cinematicos"],
  ["private destination album", "album privado de destino"],
  ["Elegir a destination", "Elegir destino"],
  ["Choose Destination", "Elegir destino"],
  ["Destination", "Destino"],
  ["Field Notes", "Notas de campo"],
  ["AI photo guide", "Guia de fotos IA"],
  ["Viaje guide", "Guia de viaje"],
  ["Why customers buy", "Por que elegirlo"],
  ["Upload", "Subir"],
  ["Deliver", "Entrega"],
  ["Step 01", "Paso 01"],
  ["Step 02", "Paso 02"],
  ["Step 03", "Paso 03"],
  ["Step 04", "Paso 04"],
  ["Fan posters", "Posters de hincha"],
  ["World Cup", "Mundial"],
  ["fan poster", "poster de hincha"],
  ["Large portrait graphics for match day", "Graficos grandes de retrato para dia de partido"],
  ["Stadium portraits", "Retratos de estadio"],
  ["stadium", "estadio"],
  ["Cinematic scenes with floodlights", "Escenas cinematicas con focos"],
  ["Match-day avatars", "Avatares de partido"],
  ["Profile-ready square crops", "Recortes cuadrados listos para perfil"],
  ["Perfil-ready square crops", "Recortes cuadrados listos para perfil"],
  ["Social banners", "Banners sociales"],
  ["Wide cover images for sharing", "Imagenes anchas de portada para compartir"],
  ["social-ready", "listo para redes"],
  ["gallery-ready", "listo para galeria"],
  ["Seasonal packs rotate around tournaments, holidays, and personal fan-photo moments.", "Los paquetes de temporada giran en torno a torneos, festivos y momentos personales de aficion."],
  ["Travel packages rotate around coasts, cities, resorts, trails, cafe moments, and postcard-ready memories.", "Los paquetes de viaje rotan entre costas, ciudades, resorts, senderos, momentos de cafe y recuerdos tipo postal."],
  ["Viaje packages rotate around coasts, cities, resorts, trails, cafe moments, and postcard-ready memories.", "Los paquetes de viaje rotan entre costas, ciudades, resorts, senderos, momentos de cafe y recuerdos tipo postal."],
  ["Route portraits", "Retratos de ruta"],
  ["Ruta portraits", "Retratos de ruta"],
  ["Coastal getaway scenes", "Escenas de escapada costera"],
  ["Costero getaway scenes", "Escenas de escapada costera"],
  ["Old city walk crops", "Recortes de paseo por casco antiguo"],
  ["Island resort frames", "Marcos de resort isleno"],
  ["Isla resort frames", "Marcos de resort isleno"],
  ["Mountain trail portraits", "Retratos de sendero de montana"],
  ["Cafe street stories", "Historias de cafe y calle"],
  ["Itinerary moodboards", "Moodboards de itinerario"],
  ["Postcard social cards", "Tarjetas para redes tipo postal"]
  ,["Spend creditos only after the request is clear, with the cost shown before the private job starts.", "Gasta creditos solo cuando la solicitud este clara, con el coste visible antes de iniciar el pedido privado."]
  ,["Use creditos for the package you selected, with the cost shown before the request starts.", "Usa creditos para el paquete elegido, con el coste visible antes de iniciar la solicitud."]
  ,["From retratos fuente to a route-led album.", "De retratos fuente a un album guiado por ruta."]
  ,["Viaje style signals for coasts, cities, trails, resorts, and postcard albums", "Senales visuales para costas, ciudades, senderos, resorts y albumes tipo postal"]
  ,["Warm seaside", "Costa calida"]
  ,["Cafe streets", "Calles con cafe"]
  ,["Old city", "Casco antiguo"]
  ,["Outdoor escape", "Escapada exterior"]
  ,["Social crops", "Recortes sociales"]
  ,["Package catalog", "Catalogo de paquetes"]
  ,["Try route portraits, coastal light sets, old quarter walks, alpine trail frames, pricing, subidas, privacy, or refunds.", "Busca retratos de ruta, sets de luz costera, paseos por casco antiguo, marcos alpinos, precios, subidas, privacidad o reembolsos."]
  ,["Try starter, pro, video, try-on, gala, privacy, subidas, or refunds.", "Busca inicial, pro, video, probador, gala, privacidad, subidas o reembolsos."]
  ,["Cinematic worlds", "Mundos cinematicos"]
  ,["Turn finished package outputs into short social-friendly motion concepts.", "Convierte resultados terminados en conceptos breves de movimiento para redes."]
  ,["Crear personal fan portraits, match-day posters, and profile avatars from your own selfies. For personal fan use only; do not use official marks or player likenesses without permission.", "Crea retratos personales de hincha, posters de partido y avatares de perfil desde tus propios selfies. Uso personal de aficion; no uses marcas oficiales ni imagen de jugadores sin permiso."]
  ,["Privado destination albums", "Albumes privados de destino"]
  ,["Elegir creditos around the number of coastal sets, old-city walks, resort scenes, and route portraits you want to finish this month.", "Elige creditos segun la cantidad de sets costeros, paseos urbanos, escenas de resort y retratos de ruta que quieras terminar este mes."]
  ,["Choose credits around the number of coastal sets, old-city walks, resort scenes, and route portraits you want to finish this month.", "Elige creditos segun la cantidad de sets costeros, paseos urbanos, escenas de resort y retratos de ruta que quieras terminar este mes."]
  ,["Adventure Tools", "Herramientas de aventura"]
  ,["Herramientas para adventure tools, escenas de viaje y galerias privadas con IA.", "Herramientas para aventuras, escenas de viaje y galerias privadas con IA."]
  ,["Crear personal fan portraits, match-day posters, and profile avatars from your own selfies. Personal fan use only.", "Crea retratos personales de hincha, posters de partido y avatares de perfil desde tus propios selfies. Solo para uso personal de aficion."]
  ,["Prepara retratos, portadas y material social dentro de la cuenta del sitio.", "Prepara retratos, portadas y material para redes dentro de la cuenta del sitio."]
  ,["Historia social", "Historia para redes"]
  ,["Recorte social", "Recorte para redes"]
  ,["Cookie Policy", "Politica de cookies"]
  ,["Select video frames", "Seleccionar fotogramas de video"]
  ,["Elegir video theme", "Elegir tema de video"]
  ,["Video theme", "Tema de video"]
  ,["Revisar request", "Revisar solicitud"]
  ,["Subir or select ordered image frames, choose a video theme, and generate one private video clip.", "Sube o selecciona fotogramas ordenados, elige un tema de video y genera un clip privado."]
  ,["Hero Alt", "Hero alternativo"]
  ,["Hero", "Heroe"]
  ,["Upscaler Utility", "Mejora de resolucion"]
  ,["Mafia Noir", "Noir cinematografico"]
  ,["See what your selfies can become.", "Mira lo que pueden crear tus selfies."]
  ,["AI photo packages for every profile, post, and private album.", "Paquetes de fotos IA para perfiles, publicaciones y albumes privados."]
  ,["paquetes de fotos con IA for every profile, post, and private album.", "Paquetes de fotos IA para perfiles, publicaciones y albumes privados."]
  ,["Destino-inspired profile photos, vacation scenes, and cinematic outdoor looks.", "Fotos de perfil inspiradas en destino, escenas de vacaciones y exteriores cinematicos."]
  ,["Viaje-style portraits", "Retratos estilo viaje"]
  ,["Creator lifestyle", "Retratos lifestyle de creador"]
  ,["Portfolio, creator, campaign, and personal-brand scenes for everyday buyers.", "Escenas de portafolio, creador, campana y marca personal para clientes cotidianos."]
  ,["Privado generated albums", "Albumes generados privados"]
  ,["All|Destination|Coastal|City|Adventure|Postcard", "Todo|Destino|Costero|Ciudad|Aventura|Postal"]
  ,["All|Destino|Costero|City|Adventure|Postcard", "Todo|Destino|Costero|Ciudad|Aventura|Postal"]
  ,["All tools|Destination|Coastal|Resort|City|Street|Adventure|Itinerary|Postcard|Moments|Creator", "Todas|Destino|Costero|Resort|Ciudad|Calle|Aventura|Itinerario|Postal|Momentos|Creador"]
  ,["All tools|Destino|Costero|Resort|City|Street|Adventure|Itinerary|Postcard|Moments|Creador", "Todas|Destino|Costero|Resort|Ciudad|Calle|Aventura|Itinerario|Postal|Momentos|Creador"]
  ,["Route portraits from everyday photos|Coastal, mountain, city, and cafe scenes|Private travel albums with visible credits|Scenic portraits from private uploads", "Retratos de ruta desde fotos cotidianas|Escenas de costa, montana, ciudad y cafe|Albumes privados de viaje con creditos visibles|Retratos escenicos desde subidas privadas"]
  ,["Postcard, itinerary, editorial, and social-ready travel visuals for creators.", "Visuales de viaje tipo postal, itinerario, editorial y redes para creadores."]
  ,["Street, cafe, balcony, sunset, and shared-trip portrait tools.", "Herramientas de retrato para calle, cafe, balcon, atardecer y viaje compartido."]
  ,["Postcard sets, itinerary moodboards, and editorial travel story tools.", "Sets de postal, moodboards de itinerario y herramientas editoriales de historia de viaje."]
  ,["Scenic Outlook Maker", "Creador de mirador escenico"]
  ,["Scenic Outlook Maker details", "Detalles del creador de mirador escenico"]
  ,["Postcard Story Set Maker", "Creador de sets de postal"]
  ,["Postcard Story Set Maker details", "Detalles del creador de sets de postal"]
  ,["Rainy City Album Tool", "Herramienta de album urbano lluvioso"]
  ,["Rainy City Album Tool details", "Detalles de la herramienta de album urbano lluvioso"]
  ,["Cafe & Street Stories", "Historias de cafe y calle"]
  ,["Scenic Outlooks", "Miradores escenicos"]
  ,["Postcard Story Sets", "Sets de historia postal"]
  ,["Postcard crops, story covers, memory cards, and profile banners.", "Recortes de postal, portadas de historia, tarjetas de recuerdo y banners de perfil."]
  ,["Rooftop City Nights", "Noches urbanas en azotea"]
  ,["Rainy City Breaks", "Escapadas urbanas con lluvia"]
];

const dreamshootCollectionHrefAliases = {
  creator: "creator-portraits",
  deportes: "world-cup-fan-photos",
  lifestyle: "travel-scene-pack",
  nature: "travel-scene-pack",
  "professional-headshots": "headshots",
  seasonal: "holiday",
  sports: "world-cup-fan-photos",
  travel: "travel-scene-pack",
  viaje: "travel-scene-pack",
  video: "ai-video-add-ons"
};

const aidreamcapesCollectionHrefAliases = {
  adventure: "road-trip-frames",
  city: "old-quarter-walks",
  coastal: "coastal-light-sets",
  costero: "coastal-light-sets",
  destination: "route-portrait-albums",
  destino: "route-portrait-albums",
  postcard: "postcard-story-sets",
  postal: "postcard-story-sets",
  "cafe-street-journals": "cafe-street-stories",
  "destination-portrait-albums": "route-portrait-albums",
  "coastal-getaways": "coastal-light-sets",
  "old-city-walks": "old-quarter-walks",
  "mountain-trails": "alpine-trail-frames",
  "itinerary-moodboards": "route-moodboards",
  "postcard-social-sets": "postcard-story-sets",
  "travel-profile-stories": "solo-traveler-profiles",
  "lagoon-route-studys": "lagoon-route-studies"
};

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function compatibilityAliasPageJson(value, canonicalPath) {
  const next = clone(value) ?? {};
  next.seo = { ...(next.seo ?? {}), canonicalPath };
  return next;
}

function safeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item";
}

function normalizeTitle(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function titleCaseFromSlug(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9\s_-]+/g, " ")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function lookupSpanishTitle(value) {
  const normalized = normalizeTitle(value);
  const slugKey = String(value ?? "").trim().toLowerCase().replace(/[-_]+/g, " ");
  const symbolKey = slugKey.replace(/&/g, "and").replace(/\s+/g, " ");
  return titleTranslations.get(normalized) ?? titleTranslations.get(slugKey) ?? titleTranslations.get(symbolKey) ?? null;
}

const spanishWordTranslations = new Map(Object.entries({
  ai: "IA", the: "la", and: "y", or: "o", for: "para", with: "con", from: "desde", your: "tu", our: "nuestros", is: "es", are: "son", this: "este", that: "ese", it: "lo", create: "crear", created: "creados", creating: "creando", choose: "elige", chosen: "elegido", upload: "sube", uploaded: "subidas", review: "revisa", reviewed: "revisado", before: "antes", after: "despues", then: "despues", access: "accede", finished: "terminados", results: "resultados", customers: "clientes", customer: "cliente", private: "privado", requests: "solicitudes", request: "solicitud", account: "cuenta", workspace: "espacio", gallery: "galeria", galleries: "galerias", package: "paquete", packages: "paquetes", set: "conjunto", sets: "conjuntos", cost: "coste", costs: "costes", credits: "creditos", examples: "ejemplos", example: "ejemplo", source: "fuente", photos: "fotos", photo: "foto", generation: "generacion", generate: "generar", generated: "generado", day: "dia", days: "dias", retention: "retencion", period: "periodo", video: "video", videos: "videos", image: "imagen", images: "imagenes", professional: "profesional", headshot: "retrato profesional", portrait: "retrato", portraits: "retratos", wedding: "boda", valentines: "San Valentin", gala: "gala", black: "negro", friday: "viernes", only: "solo", fans: "fans", singles: "solteros", awareness: "conciencia", holiday: "festivos", swimsuit: "banador", travel: "viaje", soccer: "futbol", urban: "urbano", street: "calle", style: "estilo", hairstyle: "peinado", generator: "generador", virtual: "virtual", try: "prueba", on: "en", motion: "movimiento", background: "fondo", changer: "cambiador", remover: "eliminador", magic: "magico", eraser: "borrador", old: "antiguas", restoration: "restauracion", social: "redes", cards: "tarjetas", edit: "editar", by: "con", prompt: "instrucciones", best: "mejores", themes: "temas", presets: "preajustes", engagement: "compromiso", lifestyle: "estilo de vida", creative: "creativo", christmas: "navidad", halloween: "halloween", nightlife: "vida nocturna", rich: "premium", tools: "herramientas", thanksgiving: "accion de gracias", enhancer: "mejorador", unblur: "enfocar", color: "color", correction: "correccion", retouch: "retoque", product: "producto", content: "contenido", cinematic: "cinematografico", scene: "escena", scenes: "escenas", "add-ons": "complementos", creator: "creador", profile: "perfil", winter: "invierno", spring: "primavera", mother: "madre", mothers: "madres", new: "nuevo", year: "ano", proposal: "propuesta", save: "guardar", date: "fecha", family: "familia", beauty: "belleza", nature: "naturaleza", adventure: "aventura" }));

function translateSpanishWords(value) {
  const placeholders = [];
  const protectedValue = String(value ?? "").replace(/\{[^{}]+\}/g, (token) => {
    const placeholder = `__XBY_PLACEHOLDER_${placeholders.length}__`;
    placeholders.push([placeholder, token]);
    return placeholder;
  });
  const translated = protectedValue.replace(/[A-Za-z][A-Za-z-]*/g, (word) => {
    if (/^__XBY_PLACEHOLDER_\d+__$/.test(word)) return word;
    return spanishWordTranslations.get(word.toLowerCase()) ?? word;
  });
  return placeholders.reduce((result, [placeholder, token]) => result.replaceAll(placeholder, token), translated);
}

// The source catalogue contains a few generations of copy written in English,
// Spanish, and an earlier partial machine translation. Keep the repair local
// to the Spanish XBY projection: this is deliberately not a shared runtime
// translator and it never touches URLs, asset paths, ids, or slugs.
function polishSpanishText(value) {
  if (typeof value !== "string" || !value.trim()) return value;
  if (
    value.startsWith("/") ||
    /^https?:\/\//i.test(value) ||
    value.includes("assets/") ||
    /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/i.test(value.trim())
  ) return value;

  const protectedTokens = [];
  let next = value.replace(/https?:\/\/[^\s|]+|\/[^\s|]+|[\w.+-]+@[\w.-]+/g, (token) => {
    const marker = `__XBY_COPY_TOKEN_${protectedTokens.length}__`;
    protectedTokens.push([marker, token]);
    return marker;
  });

  const phrasePairs = [
    ["IA video generacion", "Generación de vídeo con IA"],
    ["IA imagen generacion", "Generación de imágenes con IA"],
    ["IA guardar la fecha", "Guardar la fecha con IA"],
    ["Videos Save the Date con IA", "Vídeos para guardar la fecha con IA"],
    ["Crea videos Save the Date", "Crea vídeos para guardar la fecha"],
    ["A guided place to compare AI photo directions, review credits, and keep finished work organized.", "Un espacio guiado para comparar estilos de fotos con IA, revisar créditos y mantener organizados los trabajos terminados."],
    ["Explore escena ideas", "Explora ideas de escenas"],
    ["Explore scene ideas", "Explora ideas de escenas"],
    ["Premium paquetes puede usa un privado identity workflow so resultados stay more consistent across different escenas.", "Los paquetes Premium pueden usar un flujo de identidad privada para mantener resultados más coherentes entre escenas."],
    ["premium paquetes puede usa un privado identidad flujo so resultados stay more consistent across diferente escenas.", "Los paquetes Premium pueden usar un flujo de identidad privada para mantener resultados más coherentes entre escenas."],
    ["Revisar la live credit requirement shown con la producto antes starting la solicitud.", "Revisa el requisito de créditos que aparece con el producto antes de iniciar la solicitud."],
    ["Como funciona ia video generacion brand video?", "¿Cómo funciona la generación de vídeo con IA para vídeos de marca?"],
    ["usa solo fuente material you own o tiene permission para usa. Revisar la complete result antes publishing.", "Usa solo material fuente propio o autorizado. Revisa el resultado completo antes de publicarlo."],
    ["Use only source material you own or have permission to use. Review the complete result before publishing.", "Usa solo material fuente propio o autorizado. Revisa el resultado completo antes de publicarlo."],
    ["IA video", "vídeo con IA"],
    ["video generacion", "generación de vídeo"],
    ["imagen generacion", "generación de imágenes"],
    ["How creditos work", "Cómo funcionan los créditos"],
    ["Prepare better fotos fuente", "Prepara mejores fotos fuente"],
    ["Use a privado identity flow", "Usa un flujo de identidad privada"],
    ["Check creditos antes generacion", "Revisa los créditos antes de generar"],
    ["What should I sube?", "¿Qué debo subir?"],
    ["WHAT este CREATES", "QUÉ CREA"],
    ["Revisar antes sharing", "Revisa antes de compartir"],
    ["First-party evidence required", "Se necesitan pruebas de primera mano"],
    ["FIRST-PARTY producto EVIDENCE", "PRUEBAS DE PRODUCTO DE PRIMERA MANO"],
    ["Results-based refund revisa", "Revisión de reembolso según el resultado"],
    ["View all", "Ver todo"],
    ["Save the Date", "Guardar la fecha"],
    ["save the date", "guardar la fecha"],
    ["AI-generated", "generado con IA"],
    ["Text to video", "Texto a vídeo"],
    ["image to video", "imagen a vídeo"],
    ["How it works", "Cómo funciona"],
    ["See", "Ver"],
    ["see", "ver"],
    ["Explore", "Explora"],
    ["Match the", "Adapta el"],
    ["Design for the final format", "Diseña para el formato final"],
    ["Review disclosure", "Revisa la divulgación"],
    ["Review rights and context", "Revisa los derechos y el contexto"],
    ["Review source rights", "Revisa los derechos del material fuente"],
    ["Follow actual rules", "Sigue las reglas actuales"],
    ["Evidence is required before this page proves the workflow", "Se necesitan pruebas antes de considerar validado este flujo"],
    ["Evidence is required before this page proves the workflow", "Se necesitan pruebas antes de considerar validado este flujo"],
    ["this page proves the workflow", "esta página demuestra el flujo"],
    ["Review the live credit requirement shown with the product before starting the request.", "Revisa el requisito de créditos que aparece con el producto antes de iniciar la solicitud."],
    ["add a verified image for video input state that reflects the current workflow.", "añade una imagen verificada del estado de entrada de vídeo que refleje el flujo actual."],
    ["Brand video", "vídeo de marca"],
    ["Fashion video", "vídeo de moda"],
    ["Food video", "vídeo gastronómico"],
    ["Talking photo", "foto parlante"],
    ["Promo video", "vídeo promocional"],
    ["UGC Ad video", "vídeo publicitario UGC"],
    ["Pet video", "vídeo de mascotas"],
    ["Video Ad", "anuncio de vídeo"],
    ["Talking Head video", "vídeo de presentación"],
    ["TikTok video", "vídeo para TikTok"],
    ["Instagram Reels", "Reels de Instagram"],
    ["Cinematic video", "vídeo cinematográfico"],
    ["Product Ad video", "vídeo publicitario de producto"],
    ["Meme video", "vídeo de memes"],
    ["YouTube video", "vídeo para YouTube"],
    ["Explainer video", "vídeo explicativo"],
    ["Music video", "vídeo musical"],
    ["Story video", "vídeo narrativo"],
    ["Wedding Invitation", "invitación de boda"],
    ["Motion generator", "generador de movimiento"],
    ["How To video", "vídeo tutorial"],
    ["Social Media video", "vídeo para redes sociales"],
    ["Product video", "vídeo de producto"],
    ["What makes", "Qué hace que"],
    ["What is", "Qué es"],
    ["Use only", "Usa solo"],
    ["Use the", "Usa el"],
    ["Check faces", "Revisa los rostros"],
    ["Check fingers", "Revisa los dedos"],
    ["Prepare horizontal", "Prepara versiones horizontales"],
    ["Open movimiento generador", "Abre el generador de movimiento"],
    ["Select approved clips", "Selecciona clips autorizados"],
    ["Create in the signed-in workflow", "Crea dentro del flujo con sesión iniciada"],
    ["Create in la signed-in workflow", "Crea dentro del flujo con sesión iniciada"],
    ["la live espacio es la fuente of truth", "el espacio activo es la fuente de verdad"],
    ["la paquete does not include", "el paquete no incluye"],
    ["No first-party input capture was included", "No se incluyó una captura de entrada de primera mano"],
    ["Verified fuente asset - pending capture.", "Recurso fuente verificado; captura pendiente."],
    ["An intimate", "Un momento íntimo"],
    ["A warm", "Un"],
    ["A romantic", "Un"],
    ["A high-impact", "Una propuesta de gran impacto"],
    ["A person writing", "Una persona escribe"],
    ["Hands holding", "Unas manos sostienen"],
    ["Hands preparing", "Unas manos preparan"],
    ["Hand holding", "Una mano sostiene"],
    ["Close-up of", "Primer plano de"],
    ["A father", "Un padre"],
    ["A family", "Una familia"],
    ["Bride and groom", "La pareja de novios"],
    ["Engaged couple", "Una pareja comprometida"],
    ["People ask", "Las personas buscan"],
    ["Turn finished", "Convierte los resultados terminados"],
    ["Turn a", "Convierte un"],
    ["Tell stories", "Cuenta historias"],
    ["What happens next", "Qué ocurre después"],
    ["inside the image", "dentro de la imagen"],
    ["before sharing", "antes de compartir"],
    ["before publishing", "antes de publicar"],
    ["before generation", "antes de generar"],
    ["before starting", "antes de empezar"],
    ["short-form", "de formato corto"],
    ["ready for social", "listo para redes"],
    ["first-party", "de primera mano"],
    ["private workspace", "espacio privado"],
    ["private gallery", "galería privada"],
    ["credit cost", "coste en créditos"],
    ["credit requirements", "requisitos de créditos"],
    ["output controls", "controles de salida"],
    ["source material", "material fuente"],
    ["source asset", "recurso fuente"],
    ["source photos", "fotos fuente"],
    ["photo package", "paquete de fotos"],
    ["photo packages", "paquetes de fotos"],
    ["video theme", "tema de vídeo"],
    ["video themes", "temas de vídeo"],
    ["short videos", "vídeos cortos"],
    ["social media", "redes sociales"],
    ["digital delivery", "entrega digital"],
    ["all rights reserved", "todos los derechos reservados"],
    ["Follow Us", "Síguenos"],
    ["Studio footer", "Pie del estudio"],
    ["monthly", "mensual"],
    ["quarterly", "trimestral"],
    ["semiannually", "semestral"],
    ["yearly", "anual"]
  ];
  for (const [from, to] of phrasePairs) next = next.replaceAll(from, to);

  const wordPairs = new Map(Object.entries({
    the: "el", a: "un", an: "un", and: "y", or: "o", with: "con", from: "desde", for: "para", to: "para", in: "en", on: "en", at: "en", of: "de", your: "tu", our: "nuestro", their: "su", this: "este", that: "ese", these: "estos", those: "esos", what: "qué", how: "cómo", why: "por qué", when: "cuándo", where: "dónde", who: "quién", which: "qué", is: "es", are: "son", was: "fue", were: "fueron", be: "ser", been: "sido", has: "tiene", have: "tiene", can: "puede", should: "debe", must: "debe", will: "hará", do: "hacer", does: "hace", use: "usa", uses: "usa", select: "selecciona", selected: "seleccionado", open: "abre", add: "añade", keep: "mantén", include: "incluye", included: "incluido", required: "necesario", approved: "autorizado", current: "actual", available: "disponible", clear: "claro", clean: "limpio", main: "principal", final: "final", public: "público", private: "privado", content: "contenido", idea: "idea", ideas: "ideas", scene: "escena", scenes: "escenas", family: "familia", families: "familias", memories: "recuerdos", seasonal: "de temporada", high: "alta", quality: "calidad", output: "resultado", outputs: "resultados", party: "fiesta", short: "corto", quick: "rápido", business: "negocio", social: "redes", product: "producto", products: "productos", headshot: "retrato profesional", headshots: "retratos profesionales", image: "imagen", images: "imágenes", video: "vídeo", videos: "vídeos", destination: "destino", source: "fuente", media: "contenido multimedia", horizontal: "horizontal", vertical: "vertical", visuals: "elementos visuales", guidance: "orientación", filming: "grabación", framing: "encuadre", footage: "material de vídeo", capture: "captura", classic: "clásico", warm: "cálido", primary: "principal", hero: "principal", moment: "momento", moments: "momentos", intimate: "íntimo", romantic: "romántico", behind: "detrás", planned: "planificado", realism: "realismo", hands: "manos", faces: "rostros", fingers: "dedos", props: "accesorios", overall: "general", relying: "depender", generated: "generado", text: "texto", messaging: "mensajes", sharing: "compartir", work: "funciona", works: "funciona", makes: "hace", inside: "dentro", outside: "fuera", people: "personas", person: "persona", couple: "pareja", couples: "parejas", father: "padre", mother: "madre", children: "niños", child: "niño", wedding: "boda", invitation: "invitación", party: "fiesta", celebrate: "celebrar", celebration: "celebración", story: "historia", stories: "historias", telling: "contar", account: "cuenta", results: "resultados", download: "descargar", upload: "subir", review: "revisar", generate: "generar", generation: "generación", create: "crear", creating: "crear", created: "creados", choose: "elegir", before: "antes", after: "después", prepare: "prepara", check: "revisa", credits: "créditos", creditos: "créditos", photos: "fotos", photo: "foto", gallery: "galería", galleries: "galerías", package: "paquete", packages: "paquetes", sets: "conjuntos", set: "conjunto", plans: "planes", plan: "plan", pricing: "precios", tools: "herramientas", themes: "temas", theme: "tema", styles: "estilos", style: "estilo", privacy: "privacidad", refund: "reembolso", refunds: "reembolsos", policy: "política", policies: "políticas", delivery: "entrega", account: "cuenta", workspace: "espacio", customer: "cliente", customers: "clientes", monthly: "mensual", quarterly: "trimestral", semiannually: "semestral", yearly: "anual", new: "nuevo", year: "año", christmas: "Navidad", halloween: "Halloween", easter: "Pascua", thanksgiving: "Acción de Gracias", valentine: "San Valentín", valentines: "San Valentín", mothers: "madres", mother: "madre", father: "padre", "father’s": "padre", memories: "recuerdos", friendsgiving: "comida de amigos", autumn: "otoño", winter: "invierno", spring: "primavera", summer: "verano", nature: "naturaleza", travel: "viaje", lifestyle: "estilo de vida", cinematic: "cinematográfico", professional: "profesional", creative: "creativo", realistic: "realista", bright: "luminoso", dark: "oscuro", background: "fondo", lighting: "iluminación", movement: "movimiento", camera: "cámara", angle: "ángulo", location: "ubicación", names: "nombres", dates: "fechas", places: "lugares", brand: "marca", brands: "marcas", fashion: "moda", food: "gastronómico", pet: "mascota", pets: "mascotas", talking: "hablado", promo: "promocional", ad: "anuncio", ugc: "UGC", meme: "meme", music: "música", explainer: "explicativo", story: "historia", how: "cómo", tutorial: "tutorial", see: "ver", explore: "explora", publishing: "publicar", publish: "publicar", disclosure: "divulgación", rights: "derechos", context: "contexto", review: "revisar", need: "necesitar", needs: "necesita", wanted: "quería", look: "aspecto", looks: "aspectos", different: "diferente", stronger: "más sólido", strong: "sólido", visual: "visual", visuals: "elementos visuales", recognizable: "reconocible", transformation: "transformación", ordinary: "cotidiano", costume: "disfraz", costumes: "disfraces", spooky: "terrorífico", cute: "tierno", dramatic: "dramático", "high-energy": "de mucha energía", flowers: "flores", brunch: "brunch", gift: "regalo", gifts: "regalos", details: "detalles", mobile: "móvil", posts: "publicaciones", format: "formato", formats: "formatos", crops: "recortes", square: "cuadrado", friendly: "amable", haunted: "embrujado", house: "casa", broadens: "amplía", beyond: "más allá de", highlights: "destaca", shareable: "fácil de compartir", friendly: "amable", enough: "suficiente", users: "usuarios", imagine: "imaginar", uploading: "subir", uploads: "subidas", permission: "permiso", own: "propio", owned: "propio", license: "licencia", licensing: "licencia", final: "final", result: "resultado", results: "resultados", instruction: "instrucción", instructions: "instrucciones", first: "primero", second: "segundo", behind: "detrás", present: "presentar", presenter: "presentador", direct: "directo", modern: "moderno", office: "oficina", founder: "fundador", luxury: "lujo", launches: "lanzamientos", launch: "lanzamiento", period: "época", historical: "histórico", literary: "literario", tone: "tono", generic: "genérico", lose: "pierden", authenticity: "autenticidad", premium: "premium", authority: "autoridad", deliberate: "deliberado", calm: "tranquilo", exaggeration: "exageración", avoid: "evita", want: "quieres", every: "cada", all: "todo", one: "uno", real: "real", useful: "útil", simple: "sencillo", show: "mostrar", showing: "mostrando", opening: "apertura", frame: "fotograma", frames: "fotogramas", "camera-movement": "movimiento de cámara", paced: "con ritmo", pacing: "ritmo", control: "control", controlled: "controlado", movement: "movimiento", direction: "dirección", structure: "estructura", relationship: "relación", decisions: "decisiones", strategy: "estrategia", framework: "marco", layered: "por capas", problem: "problema", value: "valor", explaining: "explicando", verification: "verificación", cues: "señales", smartphone: "teléfono móvil", breakfast: "desayuno", dinner: "cena", table: "mesa", turkey: "pavo", fireplace: "chimenea", wrapped: "envuelto", ribbon: "cinta", ribbons: "cintas", ornaments: "adornos", greenery: "vegetación", ring: "anillo", rings: "anillos", rose: "rosa", petals: "pétalos", candlelight: "luz de velas", glasses: "vasos", lights: "luces", tribute: "homenaje", authentic: "auténtico", daughter: "hija", son: "hijo", laughing: "riendo", workshop: "taller", kiss: "beso", arch: "arco", ceremony: "ceremonia", guests: "invitados", aisle: "pasillo", standing: "de pie", recording: "grabación", tripod: "trípode", kitchen: "cocina", bright: "luminoso", unread: "sin leer", boss: "jefe", asking: "pidiendo", tiny: "pequeño", change: "cambio", message: "mensaje", messages: "mensajes", meeting: "reunión", people: "personas", user: "usuario", users: "usuarios", needs: "necesita", choose: "elige", create: "crear", build: "crear", built: "creado", turn: "convierte", turns: "convierte", meaningful: "importante", behind: "detrás", clear: "claro", personal: "personal", reveal: "revelación", reaction: "reacción", closing: "cierre", keep: "mantén", important: "importante", details: "detalles", editable: "editable", layers: "capas", verified: "verificado", standard: "estándar", necessary: "necesario", show: "mostrar", proves: "demuestra", workflow: "flujo", proof: "prueba", evidence: "prueba", required: "necesaria", available: "disponible", options: "opciones", option: "opción", actual: "actual", reflection: "reflexión", mood: "ambiente", shot: "plano", shots: "planos", design: "diseño", lighting: "iluminación", "sci-fi": "ciencia ficción", concepts: "conceptos", moodboard: "panel de inspiración", period: "época", brand: "marca", storytelling: "narración", authority: "autoridad", atmosphere: "atmósfera", premium: "premium", deliberate: "deliberado", standard: "estándar", ordinary: "cotidiano", expensive: "caro", historical: "histórico", literary: "literario", emotional: "emocional", restraint: "contención", founder: "fundador", seated: "sentado", warm: "cálido", practical: "práctica", light: "luz", environment: "entorno", calm: "tranquilo", credibility: "credibilidad", misleading: "engañoso", claims: "afirmaciones", page: "página", pages: "páginas", includes: "incluye", include: "incluye", without: "sin", relying: "depender", clear: "claro", coherent: "coherente", identity: "identidad", stable: "estable", movement: "movimiento", camera: "cámara", controlled: "controlado", output: "resultado", intent: "objetivo", errors: "errores", loading: "carga", current: "actual", service: "servicio", details: "detalles", deletion: "eliminación", storage: "almacenamiento", processing: "procesamiento", handles: "gestiona", follows: "sigue", according: "según", already: "ya", spent: "gastados", successful: "completas", failed: "fallidas", requests: "solicitudes", attached: "adjuntos", related: "relacionados", return: "volver", read: "lee", watch: "ver", about: "sobre", help: "ayuda", search: "buscar", cart: "carrito", featured: "destacado", personal: "personal", model: "modelo", ready: "listo", try: "probar", preserve: "conservar", keep: "mantener", avoid: "evitar", not: "no", want: "querer", need: "necesitar", you: "tú", has: "tiene", have: "tiene", it: "lo"
  }));
  next = next.replace(/\b[A-Za-z][A-Za-z’'-]*\b/g, (word) => wordPairs.get(word.toLowerCase()) ?? word);
  next = next
    .replace(/\bimagenes\b/gi, "imágenes")
    .replace(/\bgeneracion\b/gi, "generación")
    .replace(/\bcreditos\b/gi, "créditos")
    .replace(/\bgaleria(s)?\b/gi, "galería$1")
    .replace(/\balbumes\b/gi, "álbumes")
    .replace(/\bpolitica\b/gi, "política")
    .replace(/\bterminos\b/gi, "términos")
    .replace(/\bpublicos\b/gi, "públicos")
    .replace(/\bprivados\b/gi, "privados")
    .replace(/\bano\b/gi, "año")
    .replace(/\bmas\b/gi, "más")
    .replace(/\banade\b/gi, "añade")
    .replace(/\bDireccion\b/g, "Dirección")
    .replace(/\bComo\b/g, "Cómo")
    .replace(/\bQue\b/g, "Qué")
    .replace(/\bCual\b/g, "Cuál")
    .replace(/\bSesion\b/g, "Sesión")
    .replace(/\bPolitica\b/g, "Política")
    .replace(/\bTerminos\b/g, "Términos")
    .replace(/\bCatalogo\b/g, "Catálogo")
    .replace(/\bCreador\b/g, "Creador")
    .replace(/\bcinematico\b/gi, "cinematográfico")
    .replace(/\bmagico\b/gi, "mágico")
    .replace(/\bpequeno\b/gi, "pequeño")
    .replace(/\bpeinados\b/gi, "peinados")
    .replace(/\bSenales\b/g, "Señales");
  next = next.replace(/\s{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
  next = next.replaceAll("galeríun", "galería");
  return protectedTokens.reduce((result, [marker, token]) => result.replaceAll(marker, token), next);
}

function spanishTitle(value) {
  return polishSpanishText(translateSpanishWords(lookupSpanishTitle(value) ?? titleCaseFromSlug(value)));
}

function mapId(id, spec, prefix, slug) {
  const sourceId = String(id ?? "");
  const digest = crypto.createHash("sha256").update(sourceId).digest("hex").slice(0, 16);
  return `${prefix}_${spec.targetToken}_${digest}`;
}

function buildIdMaps(source, spec, target = {}) {
  const map = new Map([[spec.sourceSiteId, spec.targetSiteId]]);
  const bySlug = (rows = []) => new Map(rows.map((row) => [row.slug, row.id]));
  const pages = bySlug(target.livePages);
  const themePages = bySlug(target.themePages);
  const packCategories = bySlug(target.creativePackCategories);
  const toolCategories = bySlug(target.toolCategories);
  const toolMenuItems = bySlug(target.toolMenuItems);
  const videoCategories = bySlug(target.videoThemeCategories);
  const videoThemes = bySlug(target.videoThemes);
  for (const page of source.livePages) map.set(page.id, pages.get(spanishPageSlug(page.slug)) ?? mapId(page.id, spec, "page", page.slug));
  for (const page of source.pages) map.set(page.id, themePages.get(spanishPageSlug(page.slug)) ?? map.get(page.id) ?? mapId(page.id, spec, "theme_page", page.slug));
  for (const product of source.products) {
    map.set(product.id, mapId(product.id, spec, "prod", product.name));
    for (const price of product.prices) map.set(price.id, mapId(price.id, spec, "price", price.label));
  }
  for (const category of source.creativePackCategories) map.set(category.id, packCategories.get(spanishDreamshootCategorySlug(category.slug, spec)) ?? mapId(category.id, spec, "cat", category.slug));
  for (const pack of source.creativePacks) map.set(pack.id, mapId(pack.id, spec, "pack", pack.category || pack.name));
  for (const category of source.toolCategories) map.set(category.id, toolCategories.get(category.slug) ?? mapId(category.id, spec, "tool_cat", category.slug));
  for (const item of source.toolMenuItems) map.set(item.id, toolMenuItems.get(item.slug) ?? mapId(item.id, spec, "tool_menu", item.slug));
  for (const category of source.videoThemeCategories) map.set(category.id, videoCategories.get(category.slug) ?? mapId(category.id, spec, "video_cat", category.slug));
  for (const theme of source.videoThemes) map.set(theme.id, videoThemes.get(theme.slug) ?? mapId(theme.id, spec, "video", theme.slug));
  for (const example of source.videoThemeExamples) map.set(example.id, mapId(example.id, spec, "video_example", example.name));
  for (const redirect of source.videoThemeSlugRedirects) map.set(redirect.id, mapId(redirect.id, spec, "video_redirect", redirect.oldSlug));
  for (const asset of source.mediaAssets) {
    map.set(asset.id, mapId(asset.id, spec, "media", asset.storageKey || asset.label));
  }
  for (const theme of source.siteThemes) map.set(theme.id, mapId(theme.id, spec, "theme", theme.themeId));
  for (const app of source.aiApps) map.set(app.id, mapId(app.id, spec, "sai", app.routeKey));
  return map;
}

function isFunctionalString(value) {
  return (
    /^https?:\/\//i.test(value) ||
    value.startsWith("/") ||
    /^[^\s<>"']+@[^\s<>"']+$/.test(value) ||
    value.includes("assets/") ||
    value.includes(".webp") ||
    value.includes(".png") ||
    value.includes(".svg") ||
    value.includes(".jpg") ||
    value.includes(".jpeg") ||
    value.includes("n8n.") ||
    value.includes("gpt-") ||
    value.includes("manual_") ||
    value.includes("sha256:")
  );
}

const sourceCopyStructuralKeys = new Set([
  "id", "siteId", "themeId", "pageId", "sectionId", "blockId", "productId", "priceId", "categoryId", "parentId",
  "mediaId", "assetId", "slug", "path", "href", "primaryHref", "secondaryHref", "canonicalPath", "canonical", "url",
  "previewUrl", "originUrl", "src", "imageUrl", "videoUrl", "poster", "posterUrl", "thumbnail", "thumbnailUrl",
  "storageKey", "filename", "mimeType", "contentType", "sourceType", "pageType", "templateKey", "routeKey", "appSlug",
  "aiAppSlug", "sortOrder", "position", "order", "status", "currency", "interval", "type", "provider", "model", "modelId",
  "createdAt", "updatedAt", "width", "height", "fit", "locale", "language", "inLanguage", "sectionsOrder", "className",
  "themeKey", "version", "source", "createdBy", "fieldType", "headingLevel", "index", "limit", "count", "billingCycle",
  "defaultBillingCycle", "productType", "creditCost", "outputCount", "durationSeconds", "maxFrames", "generationCount", "conversionRate",
  "layout", "mode", "variant", "appearance", "displayMode", "objectFit", "objectPosition", "alignment", "direction"
].map((key) => key.toLowerCase()));

function isSourceCopyStructuralKey(key) {
  return sourceCopyStructuralKeys.has(String(key ?? "").toLowerCase());
}

function isSourceReferenceString(value) {
  const text = String(value ?? "").trim();
  return /^(?:https?:|mailto:|data:|\/|assets\/|site_|prod_|price_|page_|media_|tool_|pack_|video_|ai_)/i.test(text) || /^[^\s<>"']+@[^\s<>"']+$/.test(text);
}

function isSourceCopyString(key, value) {
  return typeof value === "string" && value.trim().length > 0 && !isSourceCopyStructuralKey(key) && !isSourceReferenceString(value);
}

function collectSourceCopyStrings(value, key = "", output = []) {
  if (isSourceCopyString(key, value)) {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectSourceCopyStrings(item, key, output));
    return output;
  }
  if (value && typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) collectSourceCopyStrings(childValue, childKey, output);
  }
  return output;
}

function protectSourceCopyTokens(value) {
  const protectedValues = [];
  const protectedValue = String(value ?? "").replace(
    /<[^>]+>|https?:\/\/[^\s<>"']+|mailto:[^\s<>"']+|\/[^\s<>"']+|\{\{[^{}]+\}\}|\{[^{}]+\}|\$\{[^}]+\}/g,
    (token) => {
      const marker = `⟦XBY_COPY_TOKEN_${protectedValues.length}⟧`;
      protectedValues.push([marker, token]);
      return marker;
    }
  );
  return { value: protectedValue, protectedValues };
}

function restoreSourceCopyTokens(value, protectedValues) {
  return protectedValues.reduce((result, [marker, token]) => result.replaceAll(marker, token), value);
}

function normalizeTranslatedSourceCopy(value, spec, idMap = new Map(), applySourceCopyPhrases = true) {
  let next = normalizeXbyArtifacts(
    rewriteFunctionalHref(
      rewriteIds(
        rewriteBrandContactText(String(value ?? ""), spec),
        idMap,
        spec
      ),
      spec
    ),
    spec
  ).replace(/\b(?:my|mi|mis)Dreamshoots\b/gi, spec.readableBrand);
  if (!applySourceCopyPhrases) return next;
  const sourceCopyPhrasePairs = [
    ["Save the Date", "Guardar la fecha"],
    ["Create New Year Visuals", "Crea imágenes de Año Nuevo"],
    ["Browse all current", "Explora todos los"],
    ["Brand Video", "Vídeo de marca"],
    ["Talking Head Video", "Vídeo con presentador"],
    ["Fashion Video", "Vídeo de moda"],
    ["Music Video", "Vídeo musical"],
    ["Food Video", "Vídeo gastronómico"],
    ["Pet Video", "Vídeo de mascotas"],
    ["Product Video", "Vídeo de producto"],
    ["Explainer Video", "Vídeo explicativo"],
    ["Image to Video", "Imagen a vídeo"],
    ["Text to Video", "Texto a vídeo"],
    ["Video Ad", "Anuncio de vídeo"],
    ["Social Media Video", "Vídeo para redes sociales"],
    ["UGC Ad Video", "Vídeo publicitario UGC"],
    ["AI Video Generation", "Generación de vídeo con IA"],
    ["AI Photo", "Foto con IA"],
    ["Talking Photo", "Foto parlante"],
    ["Analytics", "Analítica"],
    ["Professional headshot maker", "Generador de retratos profesionales"],
    ["Explore", "Explora"],
    ["state", "estado"]
  ];
  for (const [from, to] of sourceCopyPhrasePairs) {
    next = next.replace(new RegExp(from.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "gi"), to);
  }
  return next;
}

const sourceCopyManualTranslations = new Map([
  [
    "<h3>Company</h3><p>myDreamshoots.com</p><h3>Address</h3><p>8 THE GREEN STE B, DOVER, DE, 19901, US</p><h3>Contact Us</h3><p><a href=\"mailto:support@mydreamshoots.com\">support@mydreamshoots.com</a></p>",
    "<h3>Empresa</h3><p>AIdreamshoots.eu</p><h3>Dirección</h3><p>8 THE GREEN STE B, DOVER, DE, 19901, EE. UU.</p><h3>Contacto</h3><p><a href=\"mailto:support@aidreamshoots.eu\">support@aidreamshoots.eu</a></p>"
  ]
]);

function readSourceCopyTranslationCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(translationCachePath, "utf8"));
    if (parsed?.version !== SOURCE_COPY_TRANSLATION_VERSION || !parsed.entries || typeof parsed.entries !== "object") return new Map();
    return new Map(Object.entries(parsed.entries));
  } catch {
    return new Map();
  }
}

function writeSourceCopyTranslationCache(cache) {
  fs.mkdirSync(path.dirname(translationCachePath), { recursive: true });
  fs.writeFileSync(translationCachePath, `${JSON.stringify({
    version: SOURCE_COPY_TRANSLATION_VERSION,
    sourceLocale: "en",
    targetLocale: "es-ES",
    updatedAt: new Date().toISOString(),
    entries: Object.fromEntries(cache)
  }, null, 2)}\n`, { mode: 0o600 });
}

function chunkSourceCopyValues(values) {
  const chunks = [];
  let current = [];
  let chars = 0;
  for (const value of values) {
    const nextChars = chars + value.length + 64;
    if (current.length && (current.length >= 10 || nextChars > 4200)) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(value);
    chars += value.length + 64;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

async function translateSourceCopyBatch(values) {
  const protectedValues = values.map(protectSourceCopyTokens);
  const markers = values.map((_, index) => `[[[XBY_COPY_${index}]]]`);
  const query = protectedValues.map((item, index) => `${markers[index]}\n${item.value}`).join("\n\n");
  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=es&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`Spanish translation service returned ${response.status}`);
  const payload = await response.json();
  const translated = Array.isArray(payload) ? String(payload[0] ?? "") : "";
  const result = new Map();
  for (let index = 0; index < markers.length; index += 1) {
    const start = translated.indexOf(markers[index]);
    if (start < 0) throw new Error(`Spanish translation response lost marker ${markers[index]}`);
    const valueStart = start + markers[index].length + 1;
    const nextMarker = index + 1 < markers.length ? translated.indexOf(markers[index + 1], valueStart) : translated.length;
    if (nextMarker < 0) throw new Error(`Spanish translation response lost marker ${markers[index + 1]}`);
    const rawTranslatedValue = translated.slice(valueStart, nextMarker).trim();
    const expectedTokens = protectedValues[index].protectedValues.map(([marker]) => marker);
    if (expectedTokens.some((marker) => !rawTranslatedValue.includes(marker))) {
      result.set(values[index], { status: "untranslated", value: values[index], reason: "protected_token_changed" });
    } else {
      result.set(values[index], { status: "translated", value: restoreSourceCopyTokens(rawTranslatedValue, protectedValues[index].protectedValues) });
    }
  }
  return result;
}

async function prepareSourceCopyTranslations(source) {
  const values = [...new Set([
    ...collectSourceCopyStrings(source.livePages ?? []),
    ...collectSourceCopyStrings(source.pages ?? []),
    ...collectSourceCopyStrings(source.settings ?? {}),
    ...collectSourceCopyStrings(source.storefrontProfile ?? {}),
    ...collectSourceCopyStrings(source.products ?? []),
    ...collectSourceCopyStrings(source.creativePackCategories ?? []),
    ...collectSourceCopyStrings(source.creativePacks ?? []),
    ...collectSourceCopyStrings(source.toolCategories ?? []),
    ...collectSourceCopyStrings(source.toolMenuItems ?? []),
    ...collectSourceCopyStrings(source.videoThemeCategories ?? []),
    ...collectSourceCopyStrings(source.videoThemes ?? []),
    ...collectSourceCopyStrings(source.videoThemeExamples ?? []),
    ...collectSourceCopyStrings(source.mediaAssets ?? [])
  ])];
  const cache = readSourceCopyTranslationCache();
  for (const [sourceValue, translatedValue] of sourceCopyManualTranslations) {
    if (values.includes(sourceValue)) cache.set(sourceValue, { status: "translated", value: translatedValue, reason: "manual_source_copy_translation" });
  }
  const missing = values.filter((value) => !cache.has(value));
  const chunks = chunkSourceCopyValues(missing);
  for (let offset = 0; offset < chunks.length; offset += 4) {
    const batch = chunks.slice(offset, offset + 4);
    const results = await Promise.all(batch.map((chunk) => translateSourceCopyBatch(chunk)));
    for (const result of results) for (const [sourceValue, translatedValue] of result) cache.set(sourceValue, translatedValue);
    writeSourceCopyTranslationCache(cache);
    console.log(`translated ${Math.min(offset + batch.length, chunks.length)}/${chunks.length} Spanish source-copy batches`);
  }
  sourceCopyTranslations = cache;
  const untranslated = [...cache.values()].filter((entry) => entry?.status !== "translated").length;
  return { sourceCopyStrings: values.length, translated: values.length - untranslated, untranslated, cachePath: translationCachePath };
}

function translateSourceString(value, key, spec, idMap = new Map()) {
  const isCopy = isSourceCopyString(key, value);
  const rewritten = normalizeTranslatedSourceCopy(value, spec, idMap, isCopy);
  if (!isCopy) return rewritten;
  const manual = sourceCopyManualTranslations.get(value);
  if (manual) return normalizeTranslatedSourceCopy(manual, spec, idMap);
  const entry = sourceCopyTranslations.get(value);
  if (entry?.status === "translated") return normalizeTranslatedSourceCopy(entry.value, spec, idMap);
  untranslatedSourceCopy.add(value);
  return rewritten;
}

function translateSourceJson(value, spec, idMap = new Map(), key = "") {
  if (Array.isArray(value)) return value.map((item) => translateSourceJson(item, spec, idMap, key));
  if (!value || typeof value !== "object") return typeof value === "string" ? translateSourceString(value, key, spec, idMap) : value;
  return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
    childKey,
    translateSourceJson(childValue, spec, idMap, childKey)
  ]));
}

function rewriteBrandContactText(value, spec) {
  return String(value ?? "")
    .replaceAll("support@mydreamshoots.com", spec.supportEmail)
    .replaceAll("sales@mydreamshoots.com", spec.supportEmail)
    .replaceAll("support@aidreamcapes.com", spec.supportEmail)
    .replaceAll("sales@aidreamcapes.com", spec.supportEmail)
    .replaceAll("www.mydreamshoots.com", spec.targetDomain)
    .replaceAll("mydreamshoots.com", spec.targetDomain)
    .replaceAll("www.aidreamcapes.com", spec.targetDomain)
    .replaceAll("aidreamcapes.com", spec.targetDomain)
    .replace(/@mydreamshoots/gi, "@aidreamshoots")
    .replace(/mydreamshoots/gi, spec.readableBrand);
}

function rewriteIds(value, idMap, spec) {
  let next = rewriteBrandContactText(value, spec);
  const entries = [...idMap.entries()].sort((a, b) => b[0].length - a[0].length);
  const placeholders = [];
  entries.forEach(([sourceId, targetId], index) => {
    if (!sourceId || !next.includes(sourceId)) return;
    const placeholder = `__SPANISH_XBY_ID_${index}__`;
    next = next.replaceAll(sourceId, placeholder);
    placeholders.push([placeholder, targetId]);
  });
  for (const [placeholder, targetId] of placeholders) next = next.replaceAll(placeholder, targetId);
  return next.replaceAll(`/${spec.sourceSlug}`, `/${spec.targetSlug}`);
}

function normalizeHrefSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function rewriteFunctionalHref(value, spec) {
  if (value === "/packages") return "/collections";
  const match = value.match(/^\/collections\/([^/?#]+)(.*)$/i);
  if (!match) return value;
  const aliases = spec.sourceSiteId === "site_dreamshoot" ? dreamshootCollectionHrefAliases : aidreamcapesCollectionHrefAliases;
  const canonical = aliases[normalizeHrefSlug(match[1])];
  return canonical ? `/collections/${canonical}${match[2] ?? ""}` : value;
}

function collapseBrandRepeats(value) {
  return String(value ?? "")
    .replace(/\bAIdreamshoots(?:-xby)+\b/g, "AIdreamshoots")
    .replace(/\bAIdreamcapes(?:-xby)+\b/g, "AIdreamcapes");
}

function normalizeXbyArtifacts(value, spec) {
  let next = String(value ?? "")
    .replaceAll(`${spec.targetSiteId}_xby`, spec.targetSiteId)
    .replaceAll(`${spec.targetToken}_xby`, spec.targetToken)
    .replaceAll(`${spec.targetSlug}-xby`, spec.targetSlug)
    .replaceAll(`${spec.readableBrand}-xby`, spec.readableBrand)
    .replaceAll(`${spec.readableBrand.toLowerCase()}-xby`, spec.readableBrand.toLowerCase());
  if (spec.targetSiteId === "site_aidreamcapes_xby") {
    next = next
      .replaceAll("/assets/sites/site_aidreamcapes_xby/", "/assets/sites/site_aidreamcapes_eu/")
      .replaceAll("/assets/sites/site_aidreamcapes/", "/assets/sites/site_aidreamcapes_eu/")
      .replaceAll("aidreamcapes-xby-logo-refined.svg", "aidreamcapes-logo-refined.svg");
  }
  if (spec.targetSiteId === "site_mydreamshoots_xby") {
    next = next
      .replaceAll("/assets/dreamshoot/generated/pack-galleries/", "/assets/sites/site_aidreamshoots/visuals/generated/pack-galleries/")
      .replaceAll("/assets/dreamshoot/generated/category-covers/mydreamshoots/", "/assets/sites/site_aidreamshoots/visuals/generated/category-covers/")
      .replaceAll("/assets/dreamshoot/brand/dreamshootai-icon-180.png", "/assets/sites/site_aidreamshoots/brand/aidreamshoots-icon-180.png")
      .replaceAll("/assets/dreamshoot/brand/dreamshootai-icon-192.png", "/assets/sites/site_aidreamshoots/brand/aidreamshoots-icon-192.png")
      .replaceAll("/assets/dreamshoot/brand/dreamshootai-icon-512.png", "/assets/sites/site_aidreamshoots/brand/aidreamshoots-icon-512.png")
      .replaceAll("/assets/dreamshoot/brand/dreamshootai-logo-refined.svg", "/assets/sites/site_aidreamshoots/brand/aidreamshoots-logo-refined.svg")
      .replaceAll("/assets/sites/site_mydreamshoots_xby/brand/mydreamshoots-xby-logo-refined.svg", "/assets/sites/site_aidreamshoots/brand/aidreamshoots-logo-refined.svg")
      .replaceAll("/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png", "/assets/sites/site_aidreamshoots/og/aidreamshoots-og.png")
      .replaceAll("/assets/dreamshoot/", "/assets/sites/site_aidreamshoots/visuals/");
  }
  if (/\/assets\/sites\/[^"'\s]+\/brand\/[^"'\s]*logo-refined\.svg/i.test(next)) {
    next = spec.logoImageUrl;
  }
  return next;
}

function sourceAssetDescriptor(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\/)?(assets\/dreamshoot|assets\/sites\/site_dreamshoot|sites\/site_dreamshoot)(\/[^?#|\s"'<>]+)(\?[^#|\s"'<>]+)?$/);
  if (!match) return null;
  const prefix = match[2];
  const tail = match[3];
  const sourceAliasTail = {
    "/generated/pack-galleries/world-cup-fan-photos/brazil-soccer-fan-stadium-celebration.webp": "/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-01.webp",
    "/generated/pack-galleries/gala-photos/black-tie-red-carpet-gala-portrait.webp": "/generated/pack-galleries/gala-photos/gala-photos-01.webp"
  }[tail];
  const query = match[4] ?? "";
  const sourceCandidates = prefix === "assets/dreamshoot"
    ? [
        path.join(process.cwd(), "public", "assets", "dreamshoot", tail.slice(1)),
        path.join(process.cwd(), "public", "assets", "dreamshoot", tail.replace(/^\/theme\//, "").replace(/^\//, "")),
        ...(sourceAliasTail ? [path.join(process.cwd(), "public", "assets", "dreamshoot", sourceAliasTail.slice(1))] : [])
      ]
    : [
        path.join(process.cwd(), "public", "assets", "sites", "site_dreamshoot", tail.slice(1)),
        path.join(process.cwd(), "public", "assets", "dreamshoot", tail.slice(1)),
        path.join(process.cwd(), "public", "assets", "dreamshoot", tail.replace(/^\/theme\//, "").replace(/^\//, ""))
      ];
  let sourceFile = sourceCandidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!sourceFile) sourceFile = findSourceAssetByBasename(path.basename(tail));
  const targetRelative = prefix === "assets/dreamshoot"
    ? `assets/sites/site_aidreamshoots/visuals${tail}`
    : `assets/sites/site_aidreamshoots/visuals/site-theme${tail}`;
  const brandedTargetRelative = targetRelative.replace(/mydreamshoots/gi, "aidreamshoots");
  return {
    sourceFile,
    targetRelative: brandedTargetRelative,
    targetUrl: `/${brandedTargetRelative}${query}`,
    storageKey: brandedTargetRelative.replace(/^assets\//, ""),
    sourceValue: value,
    sourceAliasTail: sourceAliasTail ?? null
  };
}

function collectSourceAssetReferences(value, output = new Set()) {
  if (typeof value === "string") {
    for (const candidate of value.split("|")) {
      if (/^(?:\/?assets\/dreamshoot|\/?assets\/sites\/site_dreamshoot|\/?sites\/site_dreamshoot)\//i.test(candidate)) output.add(candidate);
    }
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSourceAssetReferences(item, output);
    return output;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectSourceAssetReferences(item, output);
  }
  return output;
}

const sourceAssetBasenameCache = new Map();
function findSourceAssetByBasename(basename) {
  if (sourceAssetBasenameCache.has(basename)) return sourceAssetBasenameCache.get(basename);
  const worldCupAlias = {
    "worldcup-match-day-avatar.png": "match-day-avatar.png",
    "worldcup-banner-cover.png": "banner-cover.png",
    "worldcup-friend-fan-photos.png": "friend-fan-photos.png",
    "worldcup-fan-poster.png": "fan-poster.png",
    "worldcup-stadium-portrait.png": "stadium-portrait.png",
    "worldcup-social-story.png": "social-story.png",
    "story-video-fictional-noir-character-conflict.webp": "story-video-fictional-noir-character-conflict-v2.webp"
  }[basename];
  const roots = [
    path.join(process.cwd(), "public", "assets", "dreamshoot"),
    path.join(process.cwd(), "public", "assets", "sites", "site_dreamshoot")
  ];
  const stack = [...roots];
  let found;
  while (stack.length && !found) {
    const current = stack.pop();
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(candidate);
      else if (entry.isFile() && (entry.name === basename || (worldCupAlias && entry.name === worldCupAlias && (candidate.includes("20260621-worldcup-pack") || candidate.includes("video-topic-clean/story-video"))))) {
        found = candidate;
        break;
      }
    }
  }
  sourceAssetBasenameCache.set(basename, found);
  return found;
}

function spanishMediaStorageKey(asset, spec) {
  const raw = String(asset.storageKey || asset.label || asset.id || "media").replace(/\\/g, "/");
  const ext = path.extname(raw).toLowerCase() || ".png";
  const name = path.basename(raw, ext) || asset.label || asset.id || "media";
  return `sites/${spec.targetSiteId}/theme/${safeSlug(`${spec.readableBrand}-${name}`)}${ext}`;
}

function spanishizeString(value, spec, idMap) {
  let next = normalizeXbyArtifacts(rewriteFunctionalHref(rewriteIds(value, idMap, spec), spec), spec);
  next = next
    .replace(/www\.mydreamshoots\.com/gi, spec.targetDomain)
    .replace(/mydreamshoots\.com/gi, spec.targetDomain)
    .replace(/\bmydreamshoots\b/gi, spec.readableBrand)
    .replace(/\bmydreamshootsai\b/gi, spec.readableBrand);
  if (isFunctionalString(next)) return next;
  const cached = sourceCopyTranslations.get(value) ?? sourceCopyTranslations.get(next);
  if (cached?.status === "translated") return normalizeTranslatedSourceCopy(cached.value, spec, idMap);
  if (cached?.status === "untranslated") return normalizeTranslatedSourceCopy(value, spec, idMap);
  const exactBeforeWordTranslation = phrasePairs.find(([from]) => from.toLowerCase() === next.toLowerCase());
  if (exactBeforeWordTranslation) return polishSpanishText(exactBeforeWordTranslation[1]);
  const directTitle = lookupSpanishTitle(next);
  if (directTitle) return polishSpanishText(directTitle);
  const exactPhrase = phrasePairs.find(([from]) => from.toLowerCase() === next.toLowerCase());
  if (exactPhrase) return polishSpanishText(exactPhrase[1]);
  for (const [from, to] of phrasePairs) next = next.replaceAll(from, to);
  next = normalizeXbyArtifacts(collapseBrandRepeats(translateSpanishWords(next)), spec);
  if (/maker outputs stay connected/i.test(next)) return "Los resultados de retratos profesionales permanecen en tu cuenta y aparecen en tu espacio privado para revisar, descargar y consultar el historial. Por defecto no son publicos.";
  if (/^View All .*Estilos$/i.test(next)) return "Ver todos los estilos de Save the Date";
  if (/Use one CTA .*matches/i.test(next)) return "Usa una llamada a la accion que coincida con el destino: saber mas, registrarse, comprar la oferta, unirse al lanzamiento, ver la revelacion u otro siguiente paso real.";
  if (/selected plan, credit amount/i.test(next)) return "Tu plan seleccionado, cantidad de creditos y estado del pago permanecen vinculados a tu cuenta de AIdreamshoots. Los creditos se anaden despues de confirmar el pago.";
  return polishSpanishText(next.replace(/myᕲreamshoots/gi, spec.readableBrand));
}

function spanishizeJson(value, spec, idMap, key = "") {
  const machineKeys = new Set(["id", "siteId", "sectionsOrder", "slug", "imageSlugs", "videoSlugs", "anchor", "canonicalPath", "templateKey", "pageType", "routeKey", "themeKey", "aiAppSlug", "categoryId", "parentId", "href", "primaryHref", "secondaryHref", "imageUrl", "videoUrl", "posterUrl", "storageKey", "type", "status", "mode", "layout", "source", "createdBy", "version", "index", "sortOrder", "creditCost", "outputCount", "durationSeconds", "maxFrames", "generationCount", "conversionRate"]);
  if (Array.isArray(value)) return value.map((item) => spanishizeJson(item, spec, idMap, key));
  if (!value || typeof value !== "object") {
    return typeof value === "string" && machineKeys.has(key)
      ? normalizeXbyArtifacts(rewriteFunctionalHref(rewriteIds(value, idMap, spec), spec), spec)
      : typeof value === "string" ? spanishizeString(value, spec, idMap) : value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    typeof item === "string" && machineKeys.has(key)
      ? normalizeXbyArtifacts(rewriteFunctionalHref(rewriteIds(rewriteBrandContactText(item, spec), idMap, spec), spec), spec)
      : spanishizeJson(item, spec, idMap, key)
  ]));
}

function targetProfile(source, spec, idMap = new Map()) {
  const sourceProfile = source.storefrontProfile;
  const sourcePublished = sourceProfile?.publishedJson && typeof sourceProfile.publishedJson === "object" ? sourceProfile.publishedJson : {};
  const sourceDraft = sourceProfile?.draftJson && typeof sourceProfile.draftJson === "object" ? sourceProfile.draftJson : {};
  const sourceIdentity = sourcePublished.identity ?? sourceDraft.identity ?? {};
  const policyFacts = clone(sourcePublished.policyFacts ?? sourceDraft.policyFacts ?? {});
  const identity = {
    ...clone(sourceIdentity),
    legalName: sourceIdentity.legalName || "BLYDEYUS INC",
    supportEmail: spec.supportEmail,
    sameAs: []
  };
  return {
    id: `profile_${spec.targetSiteId}`,
    siteId: spec.targetSiteId,
    draftJson: { ...translateSourceJson(clone(sourceDraft), spec, idMap), identity: { ...identity, supportEmail: spec.supportEmail }, policyFacts },
    publishedJson: { ...translateSourceJson(clone(sourcePublished), spec, idMap), identity: { ...identity, supportEmail: spec.supportEmail }, policyFacts },
    draftMeta: { revision: 1, updatedAt: nowIso, etag: `${spec.targetSlug}-sync` }
  };
}

function spanishPricePublicReference(metadata, spec) {
  const family = String(metadata?.planFamily ?? metadata?.packSize ?? "").toLowerCase();
  const cadence = String(metadata?.billingCadence ?? "").toLowerCase();
  const cadenceLabel = cadence === "yearly" ? "anual" : cadence === "monthly" ? "mensual" : "";
  if (metadata?.oneShot) return `${spec.readableBrand} prueba unica de creditos`;
  if (family === "small") return `${spec.readableBrand} paquete pequeno de creditos`;
  if (family === "medium") return `${spec.readableBrand} paquete medio de creditos`;
  if (family === "large") return `${spec.readableBrand} paquete grande de creditos`;
  if (spec.sourceSiteId === "site_dreamshoot") {
    const familyLabel = {
      starter: "inicial",
      pro: "pro",
      premium: "premium"
    }[family] ?? "fotos IA";
    return `${spec.readableBrand} plan ${familyLabel}${cadenceLabel ? ` ${cadenceLabel}` : ""} de creditos para fotos IA`;
  }
  const familyLabel = {
    trailhead: "punto de partida",
    wayfinder: "explorador",
    field_atlas: "atlas de campo"
  }[family] ?? "ruta";
  return `${spec.readableBrand} plan ${familyLabel}${cadenceLabel ? ` ${cadenceLabel}` : ""} de creditos para retratos de viaje`;
}

function spanishPriceMetadata(metadata, spec, idMap) {
  const original = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  const next = spanishizeJson(original, spec, idMap) ?? {};
  if (!next || typeof next !== "object" || Array.isArray(next)) return next;
  if (Object.hasOwn(original, "planFamily")) next.planFamily = original.planFamily;
  if (Object.hasOwn(original, "packSize")) next.packSize = original.packSize;
  if (Object.hasOwn(original, "billingCadence")) next.billingCadence = original.billingCadence;
  const sourceText = (key) => String(original[key] ?? "").toLowerCase();
  const mixedText = (key) => `${sourceText(key)} ${String(next[key] ?? "").toLowerCase()}`;
  const my = spec.sourceSiteId === "site_dreamshoot";
  if (typeof next.editingLabel === "string") {
    const text = mixedText("editingLabel");
    if (text.includes("standard editing")) next.editingLabel = "Edicion estandar";
    else if (text.includes("advanced editing")) next.editingLabel = "Edicion avanzada";
    else if (text.includes("premium editing")) next.editingLabel = "Edicion premium y retoque";
    else if (text.includes("source-photo review")) next.editingLabel = "Revision de fotos fuente";
    else if (text.includes("route-aware editing")) next.editingLabel = "Edicion sensible a la ruta";
    else if (text.includes("premium scene continuity")) next.editingLabel = "Continuidad premium de escena";
  }
  if (typeof next.planSubtitle === "string") {
    const text = mixedText("planSubtitle");
    if (text.includes("practical starting plan")) {
      next.planSubtitle = "Un plan inicial para primeros albumes privados y perfiles rapidos.";
    } else if (text.includes("several albums")) {
      next.planSubtitle = "Mas creditos mensuales para varios albumes, ediciones y pruebas de estilo.";
    } else if (text.includes("highest credit allowance")) {
      next.planSubtitle = "La mayor bolsa de creditos para albumes repetidos, ideas de video y resultados premium.";
    } else if (text.includes("one focused route portrait album")) {
      next.planSubtitle = "Para un album enfocado de retratos de ruta.";
    } else if (text.includes("testing several destination moods")) {
      next.planSubtitle = "Para probar varios ambientes de destino.";
    } else if (text.includes("full travel image library")) {
      next.planSubtitle = "Para creadores que preparan una biblioteca completa de imagenes de viaje.";
    } else {
      next.planSubtitle = my
        ? "Creditos claros para crear albumes privados con IA."
        : "Creditos claros para crear retratos de viaje privados.";
    }
  }
  if (typeof next.discountLabel === "string") {
    const text = mixedText("discountLabel");
    if (text.includes("30% off")) next.discountLabel = "30% de descuento";
    else if (text.includes("pay 6, get 12")) next.discountLabel = "Paga 6, recibe 12";
    else if (text.includes("route launch price")) next.discountLabel = "Precio de lanzamiento de ruta";
  }
  if (typeof next.yearlySavingsLabel === "string") {
    const savingsText = mixedText("yearlySavingsLabel").toLowerCase();
    if (savingsText.includes("annual savings") || savingsText.includes("yearly savings")) {
      next.yearlySavingsLabel = "Ahorro anual indicado al pagar";
    }
  }
  if (typeof next.publicReference === "string") next.publicReference = spanishPricePublicReference(original, spec);
  return next;
}

function spanishProductMetadata(metadata, spec, idMap) {
  const original = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  const next = spanishizeJson(original, spec, idMap) ?? {};
  if (!next || typeof next !== "object" || Array.isArray(next)) return next;
  if (typeof original.badgeLabel === "string") {
    const badge = original.badgeLabel.toLowerCase();
    next.badgeLabel = badge.includes("most popular") ? "Más popular" : badge.includes("best value") ? "Mejor valor" : badge.includes("photo plan") ? "Plan de fotos" : next.badgeLabel;
  }
  if (typeof original.summary === "string") {
    const summary = original.summary.toLowerCase();
    next.summary = summary.includes("practical starting plan")
      ? "Un plan inicial para primeros álbumes privados y perfiles rápidos."
      : summary.includes("several albums")
        ? "Más créditos para varios álbumes, ediciones y pruebas de estilo."
        : summary.includes("highest credit allowance")
          ? "La mayor bolsa de créditos para álbumes repetidos, ideas de vídeo y resultados premium."
          : next.summary;
  }
  if (Array.isArray(original.features)) {
    next.features = [
      "Crea álbumes privados de fotos después de generar",
      "Editor de fotos con IA y prompts",
      "Filtros fotográficos especiales con IA",
      "Crea fotos con instrucciones escritas en segundos",
      "Crea vídeos con IA",
      "Mejorador mágico para imágenes de alta resolución",
      "Sin marca de agua",
      ...(original.features.some((feature) => /4k|ultra-high|alta calidad/i.test(String(feature))) ? ["Resultados de alta calidad en 4K"] : [])
    ];
  }
  return next;
}

function spanishCreativePackPrompt(name, spec) {
  return spec.sourceSiteId === "site_dreamshoot"
    ? `Crea ${name.toLowerCase()} para ${spec.readableBrand} con fotos fuente autorizadas, estilo claro, creditos visibles y entrega en album privado.`
    : `Crea ${name.toLowerCase()} para ${spec.readableBrand} con ambiente de destino, retratos fuente autorizados, creditos visibles y entrega en galeria privada.`;
}

function spanishSiteSeo(spec, pages) {
  return {
    siteTitle: spec.readableBrand,
    siteDescription: spec.description,
    siteKeywords: spec.homeKeywords,
    titleTemplate: `%s | ${spec.readableBrand}`,
    defaultOgImage: spec.defaultOgImage,
    robots: { index: true, follow: true },
    pages: Object.fromEntries(pages.map((page) => [page.id, seoForSlug(page.slug, spec)]))
  };
}

function patchSiteSeoContainers(value, spec, pages) {
  const seo = spanishSiteSeo(spec, pages);
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (
      node.seo &&
      typeof node.seo === "object" &&
      !Array.isArray(node.seo) &&
      ("siteTitle" in node.seo || "siteDescription" in node.seo || "siteKeywords" in node.seo || "titleTemplate" in node.seo)
    ) {
      node.seo = { ...node.seo, ...seo };
    }
    if (node.settings_data?.current && typeof node.settings_data.current === "object" && !Array.isArray(node.settings_data.current)) {
      node.settings_data.current.seo = { ...(node.settings_data.current.seo ?? {}), ...seo };
    }
    if (node.settings_data?.draft && typeof node.settings_data.draft === "object" && !Array.isArray(node.settings_data.draft)) {
      node.settings_data.draft.seo = { ...(node.settings_data.draft.seo ?? {}), ...seo };
    }
    for (const child of Object.values(node)) visit(child);
  };
  visit(value);
  return value;
}

function spanishHeaderSettings(spec) {
  return {
    title: spec.readableBrand,
    logoImageUrl: spec.logoImageUrl,
    ctaLabel: "Empezar a crear",
    ctaHref: "/app/create",
    mobileLabel: "Menu"
  };
}

function spanishFooterSettings(spec) {
  return {
    title: spec.readableBrand,
    logoImageUrl: spec.logoImageUrl,
    contactEmail: spec.supportEmail
  };
}

function spanishHeaderBlocks(blocks, spec) {
  const labelForHref = (href) => {
    const exact = spec.headerLinks.find(([, linkHref]) => href === linkHref)?.[0];
    if (exact) return exact;
    if (href.startsWith("/ai-image-generation")) return spec.headerLinks.find(([, linkHref]) => linkHref === "/ai-image-generation")?.[0];
    if (href.startsWith("/ai-video-generation")) return spec.headerLinks.find(([, linkHref]) => linkHref === "/ai-video-generation")?.[0];
    return undefined;
  };
  return (blocks ?? []).map((block, index) => {
    const settings = block.settings ?? {};
    const href = typeof settings.href === "string" ? settings.href : "";
    const label = labelForHref(href);
    return label ? { ...block, settings: { ...settings, label } } : block;
  });
}

function spanishSaveTheDateNavigation(value) {
  const next = clone(value) ?? {};
  const labels = {
    "valentines-day": "San Valentin",
    engagement: "Compromiso",
    proposal: "Propuesta",
    "save-the-date": "Guardar la fecha",
    "wedding-invitation": "Invitacion de boda",
    "wedding-ceremony": "Ceremonia de boda",
    christmas: "Navidad",
    halloween: "Halloween",
    thanksgiving: "Accion de gracias",
    "new-year": "Ano nuevo",
    "mothers-day": "Dia de la madre",
    "fathers-day": "Dia del padre"
  };
  const descriptions = {
    "valentines-day": "Crea un video romantico de San Valentin con IA a partir de fotos de pareja para compartir por correo, webs de boda y redes.",
    engagement: "Crea fotos y videos de compromiso con IA a partir de imagenes de pareja para una historia de anuncio o guardar la fecha.",
    proposal: "Crea un video de propuesta con IA a partir de tus fotos y planifica la escena, la reaccion, el anillo y el cierre para compartir.",
    "save-the-date": "Crea un video para guardar la fecha con IA a partir de fotos aprobadas de la pareja y una fecha de boda confirmada.",
    "wedding-invitation": "Crea una revelacion de invitacion de boda refinada con detalles del evento faciles de leer.",
    "wedding-ceremony": "Convierte fotos aprobadas de la ceremonia en una historia de video con votos, anillos, pasillo, invitados, primer beso y salida.",
    christmas: "Crea fotos y videos de Navidad con IA para tarjetas, recuerdos familiares, retratos festivos, escenas de invierno y redes.",
    halloween: "Crea fotos y videos de Halloween con IA para disfraces, mascotas, calabazas, fiestas y escenas de temporada.",
    thanksgiving: "Crea fotos y videos de Accion de Gracias con IA para cenas familiares, Friendsgiving, saludos y recuerdos de otono.",
    "new-year": "Crea fotos y videos de Ano nuevo con IA para fuegos artificiales, cuenta atras, saludos, celebraciones familiares y nuevos comienzos.",
    "mothers-day": "Crea fotos y videos del Dia de la madre con IA para celebraciones familiares, regalos, brunch y saludos emotivos.",
    "fathers-day": "Crea fotos y videos del Dia del padre con IA para retratos familiares, regalos, recuerdos al aire libre y agradecimientos."
  };
  const groupLabels = {
    "love-wedding": "Amor y boda",
    "seasonal-holidays": "Fiestas de temporada"
  };
  next.menuLabel = "Guardar la fecha";
  next.groups = (next.groups ?? []).map((group) => ({
    ...group,
    label: groupLabels[group.slug] ?? group.label,
    items: (group.items ?? []).map((item) => {
      const label = labels[item.slug] ?? item.label;
      return {
        ...item,
        label,
        imageAlt: `Escena de ${String(label).toLowerCase()} para un video creado con IA.`,
        description: descriptions[item.slug] ?? `Crea ${String(label).toLowerCase()} con IA a partir de fotos aprobadas y prepara una pieza privada para compartir.`
      };
    })
  }));
  return next;
}

function patchSpanishLegacyGlobalSettings(value, spec) {
  const next = clone(value) ?? {};
  const headerSettings = next.sections?.header_plus?.settings;
  if (headerSettings && typeof headerSettings === "object" && !Array.isArray(headerSettings)) {
    headerSettings.announce_title = spec.sourceSiteId === "site_dreamshoot"
      ? "Convierte tus fotos en videos con IA, videos personalizados para guardar la fecha, retratos profesionales y sets de fotos tematicos."
      : "Convierte tus fotos cotidianas en retratos de viaje con IA y galerias privadas listas para compartir.";
  }
  return next;
}

function patchSpanishGlobalSections(value, spec) {
  const visit = (node, key = "") => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item));
      return;
    }
    const type = String(node.type ?? key).toLowerCase();
    if ((type === "header" || type === "header_plus") && node.settings && typeof node.settings === "object" && !Array.isArray(node.settings)) {
      node.settings = { ...node.settings, ...spanishHeaderSettings(spec) };
      node.blocks = spanishHeaderBlocks(node.blocks, spec);
    }
    if ((type === "footer" || type === "footer_plus") && node.settings && typeof node.settings === "object" && !Array.isArray(node.settings)) {
      node.settings = { ...node.settings, ...spanishFooterSettings(spec) };
    }
    for (const [childKey, child] of Object.entries(node)) visit(child, childKey);
  };
  visit(value);
  return value;
}

function spanishToolDetailJson(item, title, spec, _idMap) {
  const imageTool = spec.sourceSiteId === "site_dreamshoot";
  const topic = title.toLowerCase();
  return {
    title,
    eyebrow: imageTool ? "Herramienta de fotos IA" : "Herramienta de retratos de viaje",
    ctaLabel: imageTool ? "Crear set privado" : "Crear ruta privada",
    subtitle: imageTool
      ? `Usa ${topic} para transformar subidas privadas en resultados listos para perfiles, contenido o albumes.`
      : `Usa ${topic} para preparar retratos de viaje, escenas de destino y galerias privadas.`,
    useCases: imageTool
      ? ["Fotos de perfil mas limpias", "Galeria privada de resultados", "Planificacion con creditos visibles"]
      : ["Retratos de destino", "Planificacion de galeria privada", "Guia para fotos fuente"],
    workflow: imageTool
      ? [
          "Sube fotos fuente claras.",
          "Elige el estilo y revisa los creditos.",
          "Genera resultados privados.",
          "Guarda tus favoritos en la galeria."
        ]
      : [
          "Elige la direccion de destino.",
          "Sube retratos fuente y notas de ambiente.",
          "Confirma los creditos antes de generar.",
          "Revisa las imagenes finales en la galeria privada."
        ],
    guideTitle: imageTool ? `Guia de ${title}` : `Flujo de ${title}`,
    guideBody: imageTool
      ? `${title} ayuda a convertir fotos fuente claras en resultados privados. Revisa los creditos antes de generar y conserva los resultados dentro de tu cuenta de ${spec.readableBrand}.`
      : `${title} ayuda a definir ambiente, luz y direccion de viaje. Sube fotos claras, revisa creditos visibles y guarda los resultados dentro de tu galeria privada.`,
    detailTitle: imageTool ? `Para que sirve ${title}` : `Detalles de ${title}`,
    detailBody: imageTool
      ? "Esta herramienta mantiene el flujo enfocado antes de pasar a un paquete privado mas amplio."
      : "Esta herramienta mantiene la solicitud enfocada en un resultado cinematico para no empezar desde instrucciones en blanco."
  };
}

function spanishAiApp(app, spec, idMap) {
  if (!app) return undefined;
  const next = spanishizeJson(clone(app), spec, idMap);
  next.name = spec.sourceSiteId === "site_dreamshoot" ? "Estudio de imagenes IA" : "Estudio de retratos de viaje IA";
  next.description =
    spec.sourceSiteId === "site_dreamshoot"
      ? "Generacion privada de fotos con entrega en album firmado."
      : "Generacion privada de retratos de viaje con entrega en galeria firmada.";
  return next;
}

function spanishWorkflowConfig(config, spec, idMap, app) {
  const next = spanishizeJson(config, spec, idMap);
  if (!next || typeof next !== "object" || Array.isArray(next)) return next;
  const identity = `${app?.routeKey ?? ""} ${app?.aiApp?.name ?? ""} ${app?.aiApp?.appType ?? ""}`.toLowerCase();
  if (identity.includes("video") && typeof next.description === "string") {
    next.description =
      spec.sourceSiteId === "site_dreamshoot"
        ? "Ordena imagenes de un set, elige movimiento y genera un clip privado para revisar dentro del album."
        : "Prepara fotogramas de viaje, marca el ritmo de la ruta y crea una pieza privada para la galeria.";
  }
  return next;
}

const englishVisiblePattern =
  /\b(the|and|for|with|from|your|private|photo|photos|portrait|portraits|tool|tools|create|choose|upload|uploads|credits|gallery|workspace|packages|pricing|checkout|review|download|discover|every|before|after|source|account|customer|album|albums|travel|studio|profile|generator|builder|maker|route|scene|scenes|plans|monthly|yearly|start|view|return|support|privacy|terms|cookie|content|help|search|cart|use|case|cases|featured|personal|model|video|ready|try|read|watch|about|generation|subject|preserve|keep|one|realistic|only|current|complete|final|result|results|opening|frame|movement|motion|brand|family|children|woman|man|couple|friends|content|scene|lighting|mood|image|images|camera|style|best|clear|useful|works|supports|avoid|do|not|want|need|you|can|will|has|have|is|are|this|that|it)\b/i;

const strongEnglishPattern =
  /\b(yes|source photos?|generation jobs?|orders?|stay connected|signed-in|not public|refund eligibility|follows|already spent|successful generations|failed requests|according|request status|add clean|add clear|pick a|pick the|pick your|builds your|from the|kind of|before uploading|spending|paid plans|unlock|private model creation|gallery delivery|one account|your active plan|remaining|top-up|checkout history|package usage|before starting|current customer only|answers about|travel package choice|delivery|refunds|spend visible|finished galleries|profile story|then upload|needs|keeps each request|anchored|route references|private delivery|choose destination cues|approve|build a|contact information|free tools preview|plans unlock|open the site-enabled tool|hold creditos?|helps customers|plan source photos|download galeria|source photos)\b/i;

const visibleTextKeys = new Set([
  "answer",
  "authButtonLabel",
  "authPrimaryLabel",
  "authRibbon",
  "badge",
  "body",
  "bottomLine",
  "buttonLabel",
  "category",
  "companyHeading",
  "cta",
  "ctaLabel",
  "description",
  "detailBody",
  "detailTitle",
  "eyebrow",
  "guideBody",
  "guideTitle",
  "headline",
  "helper",
  "imageBadge",
  "imageCaption",
  "intro",
  "journeyDescriptions",
  "journeyTitle",
  "label",
  "meta",
  "name",
  "primaryCta",
  "primaryLabel",
  "productHeading",
  "question",
  "quote",
  "secondaryCta",
  "secondaryLabel",
  "socialBody",
  "socialHeading",
  "socialProofLabel",
  "subtitle",
  "subheadline",
  "summaryBody",
  "summaryMeta",
  "summaryTitle",
  "supportHeading",
  "tagline",
  "text",
  "title",
  "value"
]);

const visibleContainerKeys = new Set([
  "availabilityNote",
  "altText",
  "bodyParagraphs",
  "bulletList",
  "expertTip",
  "imageAlt",
  "imageListAlt",
  "directorySubtitle",
  "linkLabel",
  "linkList",
  "marketComparison",
  "rightItems",
  "sidePanelBody",
  "playLabel",
  "imageAllLabel",
  "videoAllLabel"
]);

const nonVisibleKeys = new Set([
  "anchor",
  "canonicalPath",
  "card_name",
  "className",
  "defaultOgImage",
  "href",
  "id",
  "imageUrl",
  "logoImageUrl",
  "ogImage",
  "originUrl",
  "previewUrl",
  "routeKey",
  "source",
  "storageKey",
  "style",
  "templateKey",
  "type",
  "version"
]);

const spanishSignalPattern =
  /\b(para|con|desde|antes|despues|privad[oa]s?|creditos?|galeria|galerias|albumes?|fotos?|retratos?|viaje|ruta|rutas|destino|sube|elige|revisa|recibe|descarga|cuenta|saldo|pedido|pedidos|entrega|ayuda|soporte|precios|herramientas|paquetes|politica|terminos|sesion|correo|contrasena|actualizado|contacto|guia|notas|campo|estudio|selfies)\b/i;

const mixedEnglishPattern =
  /\b(the|and|with|from|your|you|choose|upload|review|before|after|private|source|account|customer|workspace|pricing|checkout|download|view|start|support|privacy|terms|help|create|credits|gallery|live|packs|warm|festive|seasonal|styling|snowy|winter|framing|group|tool|tools|photo|photos|portrait|portraits|image|images|works|working|ready|content|team|page|studio|day|easy|wanted|looks|look|different|useful|posted|same|week)\b/i;

function looksSpanishText(value) {
  const text = String(value ?? "");
  return spanishSignalPattern.test(text);
}

function looksMixedLanguage(value) {
  const text = String(value ?? "");
  return looksSpanishText(text) && mixedEnglishPattern.test(text);
}

function shouldScrubText(key, value) {
  if (!visibleTextKeys.has(key) || nonVisibleKeys.has(key)) return false;
  if (isFunctionalString(value)) return false;
  if (!englishVisiblePattern.test(value)) return false;
  return strongEnglishPattern.test(value) || !looksSpanishText(value);
}

function genericSpanishText(key, spec, context) {
  const pageTitle = pageTitleForSlug(context.slug ?? "/", spec);
  const my = spec.sourceSiteId === "site_dreamshoot";
  const brand = spec.readableBrand;
  const pageTopic = pageTitle.toLowerCase();
  if (key === "category") return my ? "Foto IA" : "Viaje IA";
  if (key === "badge" || key === "meta" || key === "value") return "Privado";
  if (key === "eyebrow") return pageTitle;
  if (key === "question") return `Como funciona ${pageTopic}?`;
  if (key === "answer") {
    return my
      ? `Sube fotos claras, elige un paquete, revisa los creditos y recibe resultados en una galeria privada de ${brand}.`
      : `Sube fotos claras, elige una direccion de viaje, revisa los creditos y recibe retratos en una galeria privada de ${brand}.`;
  }
  if (key.toLowerCase().includes("cta") || key.toLowerCase().includes("button") || key === "label" || key.includes("Label")) {
    if (context.slug === "/pricing") return "Ver precios";
    if (context.slug === "/tools") return "Abrir herramienta";
    if (context.slug === "/collections") return my ? "Ver paquete" : "Ver ruta";
    if (context.slug === "/login") return "Iniciar sesion";
    return "Empezar";
  }
  if (key === "journeyDescriptions" || key === "bulletList") {
    return my
      ? "Sube fotos claras.|Elige un paquete.|Revisa creditos.|Descarga tu album privado."
      : "Sube fotos claras.|Elige una ruta visual.|Revisa creditos.|Descarga tu galeria privada.";
  }
  if (key === "title" || key === "headline" || key === "summaryTitle" || key === "detailTitle" || key === "guideTitle" || key === "journeyTitle") {
    return pageTitle;
  }
  if (key === "tagline" || key === "bottomLine" || key === "socialHeading") {
    return my ? "Fotos privadas con IA y creditos visibles." : "Retratos de viaje con IA y galerias privadas.";
  }
  if (key === "summaryMeta") return my ? "Casos de uso de fotos IA" : "Casos de uso de viaje";
  if (key === "productHeading") return "Explorar";
  if (key === "companyHeading") return "Contenido";
  if (key === "supportHeading") return "Soporte";
  return my
    ? `${brand} permite crear fotos privadas con IA desde selfies, revisar creditos antes de generar y descargar resultados desde una galeria privada.`
    : `${brand} permite crear retratos de viaje con IA desde fotos fuente, revisar creditos antes de generar y descargar resultados desde una galeria privada.`;
}

function scrubEnglishJson(value, spec, context = {}) {
  if (Array.isArray(value)) return value.map((item) => scrubEnglishJson(item, spec, context));
  if (typeof value === "string") {
    if (context.visibleContainer && !isFunctionalString(value)) {
      const translated = spanishizeString(value, spec, context.idMap ?? new Map());
      const visibleEnglish = englishVisiblePattern.test(translated) &&
        (strongEnglishPattern.test(translated) || !looksSpanishText(translated) || looksMixedLanguage(translated));
      if (!visibleEnglish) return translated;
      return translated;
    }
    return isFunctionalString(value) ? value : polishSpanishText(value);
  }
  if (!value || typeof value !== "object") return value;
  const next = {};
  for (const [key, item] of Object.entries(value)) {
    const childContext = {
      ...context,
      fieldKey: key,
      idMap: context.idMap ?? new Map(),
      ...(key === "slug" && typeof item === "string" ? { slug: item } : {}),
      visibleContainer: context.visibleContainer || visibleContainerKeys.has(key) || visibleTextKeys.has(key)
    };
    if (typeof item === "string") {
      const visibleContainerEnglish = childContext.visibleContainer && !isFunctionalString(item) && englishVisiblePattern.test(item) &&
        (strongEnglishPattern.test(item) || !looksSpanishText(item) || looksMixedLanguage(item));
      if (shouldScrubText(key, item) || visibleContainerEnglish) {
        next[key] = lookupSpanishTitle(item) ?? spanishizeString(item, spec, childContext.idMap ?? new Map());
      } else {
        next[key] = isFunctionalString(item) ? item : polishSpanishText(item);
      }
    } else {
      next[key] = scrubEnglishJson(item, spec, childContext);
    }
  }
  return next;
}

function pageSuffix(page) {
  return safeSlug(page.slug === "/" ? "home" : page.slug);
}

function spanishPageSlug(slug) {
  return slug;
}

function spanishDreamshootCategorySlug(slug, spec) {
  return String(slug ?? "");
}

function spanishDreamshootPackCategory(category, spec) {
  return String(category ?? "");
}

function normalizeSpanishCollectionReferences(value, spec) {
  const visit = (node) => {
    if (typeof node === "string") {
      return spec.sourceSiteId === "site_dreamshoot"
        ? node.replace(/\/collections\/professional-headshots\b/g, "/collections/headshots")
        : node;
    }
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== "object") return node;
    for (const [key, child] of Object.entries(node)) node[key] = visit(child);
    return node;
  };
  return visit(value);
}

function targetPageId(page, spec, idMap) {
  return `page_${spec.targetSiteId}_${pageSuffix(page)}`;
}

function pageTitleForSlug(slug, spec) {
  slug = spanishPageSlug(slug);
  const my = spec.sourceSiteId === "site_dreamshoot";
  const titles = my
    ? {
        "/": "Inicio",
        "/pricing": "Precios",
        "/collections": "Paquetes de fotos",
        "/tools": "Herramientas de fotos IA",
        "/workflow": "Como funciona",
        "/tools/headshot": "Generador de retratos profesionales",
        "/login": "Acceso de cliente",
        "/app": "Espacio privado",
        "/app/jobs/progress": "Progreso del pedido",
        "/app/jobs/detail": "Detalle del pedido",
        "/album": "Album privado",
        "/account": "Cuenta y facturacion",
        "/faq": "Centro de ayuda",
        "/about-us": "Sobre nosotros",
        "/contact-us": "Contacto",
        "/blog": "Guias",
        "/search": "Buscar",
        "/cart": "Carrito",
        "/404": "Pagina no encontrada"
      }
    : {
        "/": "Inicio",
        "/pricing": "Precios",
        "/collections": "Paquetes de viaje",
        "/tools": "Herramientas de viaje IA",
        "/workflow": "Flujo de viaje",
        "/tools/route-portrait-engine": "Motor de retratos de ruta",
        "/login": "Acceso de cliente",
        "/app": "Espacio privado",
        "/app/jobs/progress": "Progreso del pedido",
        "/app/jobs/detail": "Detalle del pedido",
        "/album": "Album privado",
        "/account": "Cuenta y facturacion",
        "/faq": "Guia de soporte",
        "/about-us": "Sobre el estudio",
        "/contact-us": "Contacto",
        "/blog": "Notas de viaje",
        "/search": "Buscar",
        "/cart": "Carrito",
        "/404": "Pagina no encontrada"
      };
  if (titles[slug]) return titles[slug];
  if (slug.includes("privacy")) return "Politica de privacidad";
  if (slug.includes("refund")) return "Politica de reembolsos";
  if (slug.includes("shipping")) return "Entrega digital";
  if (slug.includes("terms")) return "Terminos de servicio";
  if (slug.includes("content")) return "Politica de contenido";
  if (slug.includes("cookie")) return "Politica de cookies";
  if (slug.includes("/blog/")) return "Guia";
  const translated = translateSpanishWords(titleCaseFromSlug(slug));
  return translated || "Pagina";
}

function fallbackSeoDescriptionForSlug(slug, spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  const page = pageTitleForSlug(slug, spec).toLowerCase();
  if (slug.includes("privacy")) {
    return my
      ? `${spec.readableBrand} explica como protege selfies, pedidos, creditos, albumes privados y solicitudes de datos de clientes.`
      : `${spec.readableBrand} resume privacidad para retratos fuente, rutas visuales, pagos, galerias y soporte de cuenta.`;
  }
  if (slug.includes("refund")) {
    return my
      ? `Revisa como ${spec.readableBrand} evalua creditos no usados, fallos tecnicos, pedidos entregados y solicitudes de reembolso.`
      : `Consulta el proceso de ${spec.readableBrand} para revisar creditos de ruta, entregas incompletas y reembolsos de viaje.`;
  }
  if (slug.includes("shipping")) {
    return my
      ? `${spec.readableBrand} entrega resultados digitales dentro de una galeria privada, sin envios fisicos ni mezcla con otros escaparates.`
      : `${spec.readableBrand} entrega albumes de destino en la cuenta privada, con tiempos ligados a cola, fotos fuente y proveedor.`;
  }
  if (slug.includes("terms")) {
    return my
      ? `Terminos de ${spec.readableBrand} para cuenta, fotos autorizadas, creditos, paquetes, seguridad y descarga privada.`
      : `Terminos de ${spec.readableBrand} para rutas visuales, retratos autorizados, creditos, pedidos y uso responsable.`;
  }
  if (slug.includes("content")) {
    return my
      ? `Politica de contenido de ${spec.readableBrand} para selfies permitidos, instrucciones seguras, paquetes creativos y revision.`
      : `Politica creativa de ${spec.readableBrand} para fotos fuente, escenas de destino, seguridad y limites de publicacion.`;
  }
  if (slug.includes("cookie")) {
    return my
      ? `${spec.readableBrand} usa cookies esenciales para sesion, seguridad, pagos, galeria privada y continuidad de pedidos.`
      : `${spec.readableBrand} usa cookies necesarias para acceso, creditos, rutas guardadas, soporte y entrega de galerias.`;
  }
  if (slug.includes("account")) {
    return my
      ? `Abre cuenta en ${spec.readableBrand} para revisar saldo, pedidos, albumes, sesiones y ajustes privados.`
      : `Gestiona en ${spec.readableBrand} rutas guardadas, creditos, pedidos, galerias de viaje y datos de cuenta.`;
  }
  if (slug.includes("album")) {
    return my
      ? `Los albumes de ${spec.readableBrand} reunen resultados descargables, favoritos y entregas privadas por cliente.`
      : `Las galerias de ${spec.readableBrand} guardan retratos de destino, favoritos y descargas dentro de la cuenta.`;
  }
  if (slug.includes("job")) {
    return my
      ? `Sigue en ${spec.readableBrand} el estado de generacion, reservas de creditos, entregas y revisiones de cada pedido.`
      : `Comprueba en ${spec.readableBrand} el progreso de ruta, la reserva de creditos y la entrega de cada galeria.`;
  }
  if (slug.includes("upload")) {
    return my
      ? `Sube selfies claros a ${spec.readableBrand} antes de elegir paquete, coste en creditos y album privado.`
      : `Sube retratos fuente a ${spec.readableBrand} para preparar destino, ambiente, creditos y galeria privada.`;
  }
  if (slug.includes("/blog/")) {
    return my
      ? `Guia de ${spec.readableBrand} sobre preparacion de selfies, creditos, estilos y resultados privados para fotos IA.`
      : `Nota de ${spec.readableBrand} para preparar fotos fuente, destino, luz, ruta y revision de galeria.`;
  }
  const variants = my
    ? [
        `${spec.readableBrand} presenta ${page} con orientacion para selfies autorizados, paquetes de fotos IA y entrega privada.`,
        `Usa ${page} en ${spec.readableBrand} para planificar creditos, fotos fuente y resultados descargables sin mezclar tiendas.`,
        `${spec.readableBrand} organiza ${page} alrededor de cuenta privada, seguridad de subidas y albumes listos para revisar.`
      ]
    : [
        `${spec.readableBrand} presenta ${page} con foco en retratos de viaje, destino elegido y galeria privada.`,
        `Usa ${page} en ${spec.readableBrand} para preparar ruta visual, creditos claros y entrega de album de destino.`,
        `${spec.readableBrand} organiza ${page} para fotos fuente autorizadas, escenas de viaje y descarga privada.`
      ];
  const index = [...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0) % variants.length;
  return variants[index];
}

function fallbackSeoKeywordsForSlug(slug, spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  const topic = pageTitleForSlug(slug, spec).toLowerCase();
  return my
    ? `${spec.readableBrand},${topic},fotos IA,creditos privados,album digital`
    : `${spec.readableBrand},${topic},retratos de viaje,creditos de ruta,galeria privada`;
}

function seoForSlug(slug, spec) {
  slug = spanishPageSlug(slug);
  const my = spec.sourceSiteId === "site_dreamshoot";
  const common = {
    "/": [spec.homeTitle, spec.homeDescription, spec.homeKeywords],
    "/pricing": [
      my
        ? `Precios de retratos y sets IA | ${spec.readableBrand}`
        : `Creditos para retratos de viaje | ${spec.readableBrand}`,
      my
        ? `Calcula creditos para retratos profesionales, perfiles, pareja, creador y albumes privados antes de generar fotos con ${spec.readableBrand}.`
        : `Organiza creditos para rutas visuales, escenas costeras, ciudad, postales y albumes de destino con ${spec.readableBrand}.`,
      my
        ? `precios retratos IA,creditos retratos profesionales,set fotos IA,${spec.readableBrand}`
        : `creditos retratos viaje,precios fotos destino,rutas visuales IA,${spec.readableBrand}`
    ],
    "/collections": [
      my ? `Paquetes de fotos con IA | ${spec.readableBrand}` : `Paquetes de retratos de viaje con IA | ${spec.readableBrand}`,
      my
        ? `Explora paquetes de retratos profesionales, pareja, belleza, creador, deporte y retratos cinematicos con creditos visibles y albumes privados.`
        : `Explora paquetes de viaje, costa, ciudad, ruta, postal y retratos cinematicos con creditos visibles y galerias privadas.`,
      my ? `paquetes de fotos IA,retratos profesionales IA,retratos IA,album privado` : `retratos de viaje IA,paquetes de destino IA,galeria privada`
    ],
    "/tools": [
      my ? `Herramientas de fotos con IA | ${spec.readableBrand}` : `Herramientas de retratos de viaje con IA | ${spec.readableBrand}`,
      my
        ? `Usa herramientas de ${spec.readableBrand} para retratos profesionales, fondos, retoque, video corto, probador virtual y paquetes privados.`
        : `Usa herramientas de ${spec.readableBrand} para retratos de ruta, luz costera, escenas alpinas, postales y galerias privadas.`,
      my ? `herramientas IA,fotos IA,retratos profesionales IA,cambiador de fondo` : `herramientas viaje IA,retratos de ruta,luz costera IA`
    ],
    "/login": [
      my ? `Estudio privado de fotos | ${spec.readableBrand}` : `Bitacora privada de viaje | ${spec.readableBrand}`,
      my
        ? `Entra para guardar selfies, perfiles, pedidos, creditos y albumes de retratos creados con ${spec.readableBrand}.`
        : `Entra para revisar fotos fuente, rutas elegidas, creditos, pedidos y galerias de viaje en ${spec.readableBrand}.`,
      my
        ? `${spec.readableBrand} acceso,estudio privado fotos,album IA`
        : `${spec.readableBrand} acceso,bitacora viaje IA,galeria de ruta`
    ],
    "/app": [
      my ? `Estudio privado de fotos | ${spec.readableBrand}` : `Panel privado de rutas | ${spec.readableBrand}`,
      my
        ? `Gestiona selfies fuente, paquetes elegidos, saldo de creditos, pedidos y albumes descargables dentro de ${spec.readableBrand}.`
        : `Organiza retratos fuente, rutas visuales, creditos reservados, pedidos y galerias de destino dentro de ${spec.readableBrand}.`,
      my ? `estudio privado IA,album privado,creditos fotos` : `panel rutas IA,galeria viaje,creditos destino`
    ],
    "/workflow": [
      my ? `Como funciona ${spec.readableBrand}` : `Flujo de retratos de viaje | ${spec.readableBrand}`,
      my
        ? `Sigue el flujo de ${spec.readableBrand}: sube fotos autorizadas, elige paquete, revisa creditos y descarga tu album privado.`
        : `Conoce el flujo de ${spec.readableBrand}: define destino, sube retratos fuente, confirma creditos y recibe una galeria privada.`,
      my ? `flujo fotos IA,como funciona,album privado` : `flujo viaje IA,retratos de ruta,galeria privada`
    ],
    "/cart": [
      my ? `Revision de creditos para fotos | ${spec.readableBrand}` : `Revision de creditos de ruta | ${spec.readableBrand}`,
      my
        ? `Confirma el plan, saldo y pago de creditos antes de abrir nuevos sets privados en ${spec.readableBrand}.`
        : `Confirma creditos, saldo y pago antes de reservar retratos de destino en ${spec.readableBrand}.`,
      my ? `pago fotos IA,creditos set privado,carrito IA` : `pago viaje IA,creditos ruta,carrito retratos`
    ],
    "/about-us": [
      my ? `Sobre un estudio de selfies a album | ${spec.readableBrand}` : `Sobre un atlas privado de retratos | ${spec.readableBrand}`,
      my
        ? `${spec.readableBrand} convierte selfies cotidianos en retratos de perfil, pareja, creador y albumes privados con creditos visibles.`
        : `${spec.readableBrand} convierte fotos fuente en recuerdos de viaje, rutas visuales y galerias privadas con direccion cinematica.`,
      my
        ? `sobre ${spec.readableBrand},selfies a retratos,albumes IA`
        : `sobre ${spec.readableBrand},retratos de viaje,atlas visual IA`
    ],
    "/contact-us": [
      my ? `Soporte para sets y perfiles | ${spec.readableBrand}` : `Contacto para rutas y entregas | ${spec.readableBrand}`,
      my
        ? `Escribe a ${spec.readableBrand} sobre cuenta, creditos, paquetes de perfil, privacidad, facturacion o entrega de albumes.`
        : `Contacta con ${spec.readableBrand} para dudas de rutas, destino, creditos, privacidad, pedidos y entrega de galerias.`,
      my
        ? `contacto ${spec.readableBrand},soporte sets IA,ayuda album`
        : `contacto ${spec.readableBrand},soporte viaje IA,ayuda rutas`
    ],
    "/faq": [
      my ? `Ayuda para crear fotos IA | ${spec.readableBrand}` : `Guia de rutas visuales | ${spec.readableBrand}`,
      my
        ? `Encuentra respuestas sobre selfies fuente, paquetes, creditos, pago, privacidad, reintentos y albumes privados en ${spec.readableBrand}.`
        : `Revisa como preparar fotos fuente, elegir ambiente de viaje, controlar creditos, recibir galerias y pedir soporte en ${spec.readableBrand}.`,
      my
        ? `ayuda fotos IA,soporte selfies,creditos album`
        : `ayuda retratos viaje,soporte rutas,creditos destino`
    ],
    "/blog": [
      my ? `Guias para mejores fotos IA | ${spec.readableBrand}` : `Notas de campo para retratos de viaje | ${spec.readableBrand}`,
      my
        ? `Aprende a preparar selfies, elegir paquetes, comparar creditos y usar albumes privados para perfiles, pareja y contenido.`
        : `Lee notas para preparar fotos fuente, definir destino, luz, escenas de ruta y revisar galerias privadas de viaje.`,
      my
        ? `guias fotos IA,selfies para IA,albumes privados`
        : `notas viaje IA,retratos de ruta,fotos fuente destino`
    ]
  };
  const fallback = common[slug] ?? [
    `${pageTitleForSlug(slug, spec)} | ${spec.readableBrand}`,
    fallbackSeoDescriptionForSlug(slug, spec),
    fallbackSeoKeywordsForSlug(slug, spec)
  ];
  return {
    title: fallback[0],
    description: fallback[1],
    keywords: fallback[2],
    canonicalPath: slug,
    index: !["/login", "/app", "/cart", "/account", "/search", "/404"].some((prefix) => slug === prefix || slug.startsWith(`${prefix}/`)),
    follow: true,
    ogImage: spec.defaultOgImage,
    robots: {
      index: !["/login", "/app", "/cart", "/account", "/search", "/404"].some((prefix) => slug === prefix || slug.startsWith(`${prefix}/`)),
      follow: true
    }
  };
}

function patchSection(pageJson, sectionId, settings) {
  const section = pageJson.sections?.[sectionId];
  if (!section) return;
  section.settings = { ...(section.settings ?? {}), ...settings };
  for (const [key, value] of Object.entries(settings)) {
    if (key in section && value !== undefined) section[key] = value;
  }
}

function patchBlocksByHref(pageJson, spec) {
  const labelsByHref = new Map(spec.headerLinks.map(([label, href]) => [href, label]));
  for (const section of Object.values(pageJson.sections ?? {})) {
    for (const block of section.blocks ?? []) {
      const href = block.settings?.href;
      if (href && labelsByHref.has(href)) block.settings.label = labelsByHref.get(href);
    }
  }
}

function xbyPageCopy(slug, spec) {
  slug = spanishPageSlug(slug);
  const brand = spec.readableBrand;
  const my = spec.sourceSiteId === "site_dreamshoot";
  const copy = {
    "/pricing": my
      ? {
          eyebrow: "Creditos de estudio",
          title: "Planes para retratos, perfiles y albumes IA.",
          subtitle: "El saldo se consulta antes de cada render, con recargas para probar estilos sin cambiar de cuenta.",
          body: `${brand} separa planes mensuales y paquetes puntuales para que pruebes retratos profesionales, pareja, creador y fondos sin perder el control del presupuesto.`
        }
      : {
          eyebrow: "Mapa de creditos",
          title: "Creditos para rutas, destinos y galerias de viaje.",
          subtitle: "Cada escena indica coste, salida estimada y estado antes de empezar la generacion.",
          body: `${brand} organiza creditos alrededor de rutas visuales: costa, ciudad, carretera, postal o escapada editorial, siempre con saldo visible.`
        },
    "/login": my
      ? {
          eyebrow: "Estudio privado",
          title: "Entra a tu mesa de retratos IA.",
          subtitle: "Tus selfies, sets, creditos, pedidos y albumes quedan guardados para volver cuando quieras.",
          body: "Accede con email para continuar paquetes de perfil, pareja, creador o belleza desde el mismo historial privado."
        }
      : {
          eyebrow: "Bitacora privada",
          title: "Abre tu cuaderno de rutas visuales.",
          subtitle: "Tus fotos fuente, creditos, pedidos de destino y galerias se mantienen juntos en una cuenta privada.",
          body: "Vuelve para revisar escenas, ajustar pedidos de viaje y descargar albumes cuando la ruta este lista."
        },
    "/about-us": my
      ? {
          eyebrow: "Sobre el estudio",
          title: `Que hace ${brand}`,
          subtitle: "Un flujo sencillo para convertir selfies reales en material visual util.",
          body: `${brand} esta pensado para personas que necesitan retratos rapidos sin montar una sesion: subes selfies claras, eliges un paquete y revisas creditos antes de generar.`
        }
      : {
          eyebrow: "Sobre el atlas",
          title: `La idea detras de ${brand}`,
          subtitle: "Un estudio de rutas imaginadas para recuerdos de viaje privados.",
          body: `${brand} combina fotos fuente, direccion de destino y control de creditos para producir galerias que parecen venir de una escapada bien planificada.`
        },
    "/contact-us": my
      ? {
          eyebrow: "Soporte de estudio",
          title: "Ayuda para sets, perfiles y albumes.",
          subtitle: `Escribe a ${spec.supportEmail} sobre creditos, acceso, privacidad o una entrega pendiente.`,
          body: "Incluye el email de tu cuenta, el paquete elegido y cualquier detalle del resultado que quieras revisar."
        }
      : {
          eyebrow: "Contacto de ruta",
          title: "Soporte para escenas, destino y entrega.",
          subtitle: `Escribe a ${spec.supportEmail} si necesitas revisar creditos, rutas, privacidad o una galeria de viaje.`,
          body: "Cuanto mas claro sea el destino, la luz y el pedido, mas rapido podremos ubicar la solicitud."
        },
    "/faq": my
      ? {
          eyebrow: "Ayuda practica",
          title: "Respuestas para crear fotos IA sin friccion.",
          subtitle: "Prepara selfies claras, entiende creditos, revisa reintentos y encuentra tu album privado.",
          body: "Esta guia cubre el flujo de AIdreamshoots desde la subida hasta la descarga, con foco en privacidad y control de saldo."
        }
      : {
          eyebrow: "Guia de viaje IA",
          title: "Como preparar una ruta visual antes de generar.",
          subtitle: "Define destino, ambiente, fotos fuente, creditos y entrega privada antes de abrir el pedido.",
          body: "Esta guia ayuda a ordenar escenas de costa, ciudad, carretera o postal para que el resultado tenga una direccion clara."
        },
    "/blog": my
      ? {
          eyebrow: "Guias de retrato",
          title: "Ideas para selfies, perfiles y albumes IA.",
          subtitle: "Consejos para elegir fotos fuente, paquetes y creditos antes de crear resultados privados.",
          body: "Lee guias cortas para mejorar selfies, comparar estilos y preparar sets que sirvan para perfiles, pareja o contenido."
        }
      : {
          eyebrow: "Notas de campo",
          title: "Preparacion de retratos de viaje con IA.",
          subtitle: "Notas para definir ruta, luz, lugar y narrativa antes de generar una galeria privada.",
          body: "Explora criterios para fotos fuente, continuidad de escena, ambiente de destino y entrega de albumes de ruta."
        },
    "/cart": my
      ? {
          eyebrow: "Revision de estudio",
          title: "Confirma creditos antes de crear nuevos sets.",
          subtitle: "Tu plan, saldo y pago quedan conectados a la misma cuenta de albumes privados.",
          body: "Usa esta pagina para revisar costes antes de seguir con retratos profesionales, pareja, creador o paquetes tematicos."
        }
      : {
          eyebrow: "Revision de ruta",
          title: "Confirma creditos antes de reservar una escena.",
          subtitle: "El saldo, el plan y el pago quedan unidos a tus rutas y galerias privadas.",
          body: "Revisa el coste antes de generar costa, ciudad, postal, carretera o cualquier album de destino."
        }
  };
  return copy[slug] ?? null;
}

function patchSectionsByType(pageJson, type, settings) {
  for (const section of Object.values(pageJson.sections ?? {})) {
    if (section.type !== type) continue;
    section.settings = { ...(section.settings ?? {}), ...settings };
  }
}

function patchSectionBlocks(pageJson, sectionId, blocks) {
  const section = pageJson.sections?.[sectionId];
  if (!section?.blocks?.length) return;
  section.blocks = section.blocks.map((block, index) => {
    const update = blocks[index % blocks.length] ?? {};
    const topLevel = Object.fromEntries(Object.entries(update).filter(([key]) => key in block));
    return {
      ...block,
      ...topLevel,
      settings: { ...(block.settings ?? {}), ...update }
    };
  });
}

function patchBlocksByType(pageJson, type, blocks) {
  for (const section of Object.values(pageJson.sections ?? {})) {
    if (section.type !== type || !section.blocks?.length) continue;
    section.blocks = section.blocks.map((block, index) => {
      const update = blocks[index % blocks.length] ?? {};
      const topLevel = Object.fromEntries(Object.entries(update).filter(([key]) => key in block));
      return {
        ...block,
        ...topLevel,
        settings: { ...(block.settings ?? {}), ...update }
      };
    });
  }
}

function patchSectionObject(section, settings) {
  section.settings = { ...(section.settings ?? {}), ...settings };
  for (const [key, value] of Object.entries(settings)) {
    if (key in section && value !== undefined) section[key] = value;
  }
}

function patchSectionObjectBlocks(section, blocks) {
  if (!section?.blocks?.length) return;
  section.blocks = section.blocks.map((block, index) => {
    const update = blocks[index % blocks.length] ?? {};
    const topLevel = Object.fromEntries(Object.entries(update).filter(([key]) => key in block));
    return {
      ...block,
      ...topLevel,
      settings: { ...(block.settings ?? {}), ...update }
    };
  });
}

function patchSpanishXbyVisibleResiduals(pageJson, slug, spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  const clean = (value) => {
    if (typeof value !== "string") return value;
    const replacements = [
      ["FAQ", "Preguntas"],
      ["Photo AI|AI Photo Edit|Video AI", "Fotos IA|Edicion IA|Video IA"],
      ["Photo Package Edit|Photo AI|AI Video", "Edicion de paquetes|Fotos IA|Video IA"],
      ["Route Portrait Edit|Route Portrait|AI Video", "Edicion de ruta|Retratos de ruta|Video IA"],
      ["Start Ruta Portrait Engine", "Abrir motor de retratos de ruta"],
      [
        "Continue with guides on retratos fuente, destination references, route mood, credit planning, and private album review.",
        "Continua con guias sobre retratos fuente, referencias de destino, ambiente de ruta, planificacion de creditos y revision de album privado."
      ],
      [
        "Use the account area to check plan status, route set usage, credit reservations, receipts, and add-on creditos before the next destination album.",
        "Usa el area de cuenta para revisar estado del plan, uso de rutas, reservas de creditos, recibos y creditos adicionales antes del siguiente album de destino."
      ]
    ];
    let next = value;
    for (const [from, to] of replacements) next = next.replaceAll(from, to);
    return next;
  };
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node.type === "faq") {
      node.settings = {
        ...(node.settings ?? {}),
        title: my ? "Preguntas frecuentes" : "Preguntas de viaje"
      };
      if ("title" in node) node.title = node.settings.title;
    }
    if (node.type === "free_tools" || node.type === "free_tools_grid" || /free_tools/i.test(String(node.id ?? ""))) {
      node.settings = {
        ...(node.settings ?? {}),
        categories: my ? "Fotos IA|Edicion IA|Video IA" : "Edicion de ruta|Retratos de ruta|Video IA",
        primaryCta: my ? "Abrir herramienta" : "Abrir motor de retratos de ruta"
      };
    }
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string") node[key] = clean(value);
      else visit(value);
    }
  };
  visit(pageJson);
  if (slug === "/tools") {
    patchSection(pageJson, "free_tools_1", {
      categories: my ? "Fotos IA|Edicion IA|Video IA" : "Edicion de ruta|Retratos de ruta|Video IA",
      primaryCta: my ? "Abrir herramienta" : "Abrir motor de retratos de ruta"
    });
  }
  if (slug.includes("/blog/")) {
    patchSection(pageJson, "blog_list_1", {
      body: my
        ? "Continua con guias sobre fotos fuente, estilos, creditos y revision de album privado."
        : "Continua con guias sobre retratos fuente, referencias de destino, ambiente de ruta, planificacion de creditos y revision de album privado."
    });
  }
  if (slug === "/account") {
    patchSection(pageJson, "billing_intro_1", {
      body: my
        ? "Usa el area de cuenta para revisar plan, creditos, recibos, reservas y albumes antes del siguiente set."
        : "Usa el area de cuenta para revisar estado del plan, uso de rutas, reservas de creditos, recibos y creditos adicionales antes del siguiente album de destino."
    });
  }
}

function faqBlocksForSlug(slug, spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  if (my) {
    return [
      {
        question: "Cuando se descuentan los creditos?",
        answer: "Los creditos se reservan cuando confirmas una generacion. Si el pedido falla, el flujo devuelve el saldo segun el estado del trabajo."
      },
      {
        question: "Que selfies funcionan mejor?",
        answer: "Usa fotos claras, con una persona visible, poca compresion y permiso para usar la imagen dentro de tu cuenta privada."
      },
      {
        question: "Puedo probar estilos distintos?",
        answer: "Si. Puedes elegir paquetes de perfil, pareja, creador, belleza o temporada y revisar el coste antes de empezar."
      },
      {
        question: "Donde veo mis albumes?",
        answer: "Los resultados aparecen en tu espacio privado, junto con favoritos, historial de pedidos y descargas."
      }
    ];
  }
  return [
    {
      question: "Cuando se descuentan los creditos de ruta?",
      answer: "El saldo se reserva al confirmar una escena. Cada paquete muestra coste, salidas y estado antes de enviar el pedido."
    },
    {
      question: "Como elijo un destino visual?",
      answer: "Puedes partir de costa, casco antiguo, balcon, carretera, montana o postal, y anadir notas de ambiente en el pedido."
    },
    {
      question: "Necesito fotos de viaje reales?",
      answer: "No. Bastan fotos fuente claras de las personas; la ruta visual se define con el paquete y las notas de estilo."
    },
    {
      question: "Como reviso una galeria terminada?",
      answer: "Entra a tu espacio privado para ver estado, imagenes finales, favoritos y entregas del album."
    }
  ];
}

function ruleCardsForSlug(slug, spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  return my
    ? [
        { meta: "saldo claro", title: "Coste antes del render", description: "Cada paquete muestra creditos y salidas antes de iniciar el trabajo." },
        { meta: "fotos fuente", title: "Selfies con permiso", description: "Usa imagenes propias o autorizadas para mantener el album privado y correcto." },
        { meta: "historial", title: "Pedidos trazables", description: "El espacio privado conserva creditos, trabajos, favoritos y descargas." },
        { meta: "reintentos", title: "Estado visible", description: "Puedes revisar si un pedido esta en cola, procesando, terminado o requiere atencion." }
      ]
    : [
        { meta: "ruta visual", title: "Destino definido", description: "Elige ambiente, luz y tipo de escena antes de enviar el pedido." },
        { meta: "fotos fuente", title: "Retratos claros", description: "Sube imagenes nitidas de las personas para sostener la continuidad del album." },
        { meta: "creditos", title: "Saldo de ruta", description: "El pago y el espacio privado muestran reservas, gasto y devoluciones cuando aplica." },
        { meta: "entrega", title: "Galeria privada", description: "Los resultados quedan ligados al viaje elegido y se descargan desde la cuenta." }
      ];
}

function journeyCardsForSlug(slug, spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  return my
    ? [
        { meta: "Paso 01", title: "Subir selfies", text: "Elige fotos claras, variadas y con permiso de uso." },
        { meta: "Paso 02", title: "Elegir paquete", text: "Compara retratos profesionales, pareja, creador, belleza o albumes tematicos." },
        { meta: "Paso 03", title: "Revisar creditos", text: "Confirma saldo y coste antes de generar." },
        { meta: "Paso 04", title: "Descargar album", text: "Guarda favoritos desde tu galeria privada." }
      ]
    : [
        { meta: "Paso 01", title: "Subir retratos", text: "Usa fotos fuente nitidas de las personas que apareceran en la ruta." },
        { meta: "Paso 02", title: "Elegir destino", text: "Define costa, casco antiguo, balcon, carretera, montana o postal." },
        { meta: "Paso 03", title: "Confirmar escena", text: "Revisa creditos, salidas y notas de ambiente antes de enviar." },
        { meta: "Paso 04", title: "Recibir galeria", text: "Descarga el album privado cuando el pedido termine." }
      ];
}

function trustStatsForSlug(slug, spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  return my
    ? [
        { label: "creditos visibles", value: "saldo" },
        { label: "album privado", value: "historial" },
        { label: "fotos fuente", value: "permiso" },
        { label: "pago claro", value: "seguro" }
      ]
    : [
        { label: "ruta visual", value: "brief" },
        { label: "creditos claros", value: "saldo" },
        { label: "galeria privada", value: "entrega" },
        { label: "estado de pedido", value: "visible" }
      ];
}

function flowCardsForSpec(spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  return my
    ? [
        { meta: "01", title: "Subir selfies", text: "Prepara fotos claras y autorizadas para mantener el set privado." },
        { meta: "02", title: "Elegir estilo", text: "Selecciona retratos, pareja, creador, belleza o escenas tematicas." },
        { meta: "03", title: "Confirmar creditos", text: "Revisa coste y salidas antes de iniciar la generacion." },
        { meta: "04", title: "Guardar album", text: "Descarga favoritos desde una galeria ligada a tu cuenta." }
      ]
    : [
        { meta: "01", title: "Subir retratos", text: "Usa fotos fuente nitidas de las personas incluidas en la ruta." },
        { meta: "02", title: "Elegir destino", text: "Define costa, ciudad, balcon, montana, carretera o postal." },
        { meta: "03", title: "Confirmar escena", text: "Revisa creditos, salidas y notas antes de enviar el pedido." },
        { meta: "04", title: "Recibir galeria", text: "Descarga los retratos finales desde la cuenta privada." }
      ];
}

function visualProofBlocks(spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  return my
    ? [
        { title: "Fotos de hincha del Mundial", description: "Crea escenas de estadio, poster y avatar con creditos visibles antes de generar.", badge: "Deportes", category: "Deportes" },
        { title: "Retratos profesionales", description: "Prepara retratos para perfiles, equipos, fundadores y canales profesionales.", badge: "Perfil", category: "Perfil" },
        { title: "Vistas de peinado", description: "Prueba corte, color y acabado visual antes de abrir un set mas amplio.", badge: "Belleza", category: "Belleza" },
        { title: "Mundos cinematicos", description: "Explora cyberpunk, gala, noir y escenas editoriales desde fotos fuente propias.", badge: "Creativo", category: "Creativo" },
        { title: "Retratos de viaje", description: "Crea perfiles con ambiente de destino, exteriores cinematicos y recuerdos privados.", badge: "Viaje", category: "Viaje" }
      ]
    : [
        { title: "Costa luminosa", description: "Retratos con luz marina, terrazas y calma de destino.", badge: "Costa", category: "Costa" },
        { title: "Casco antiguo", description: "Calles de piedra, cafe, museo y balcones para albumes urbanos.", badge: "Ciudad", category: "Ciudad" },
        { title: "Balcon isleno", description: "Escenas de resort, piscina y atardecer suave para recuerdos privados.", badge: "Isla", category: "Isla" },
        { title: "Ruta alpina", description: "Montana, senderos y refugios con direccion visual clara.", badge: "Aventura", category: "Aventura" },
        { title: "Postal privada", description: "Tarjetas, recortes sociales y portada de diario para viajes imaginados.", badge: "Postal", category: "Postal" }
      ];
}

function featureTabBlocks(spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  return my
    ? [
        { label: "Ver paquete", title: "Elegir resultado final", description: "Parte de un paquete guiado: perfil, pareja, creador, belleza, deporte o escena editorial." },
        { label: "Ver movimiento", title: "Convertir imagen en clip", description: "Transforma resultados terminados en ideas de video corto para perfiles o campanas privadas." },
        { label: "Ver herramientas", title: "Preparar fotos fuente", description: "Ajusta fondo, nitidez, color o retoque antes de gastar creditos en un paquete." }
      ]
    : [
        { label: "Ver ruta", title: "Elegir ambiente completo", description: "Selecciona costa, casco antiguo, isla, montana o postal antes de confirmar creditos." },
        { label: "Planear fotos", title: "Preparar referencias", description: "Anade retratos claros, notas de vestuario y ambiente para una galeria coherente." },
        { label: "Ver galeria", title: "Recibir album privado", description: "Sigue el estado del pedido y descarga resultados desde la misma cuenta." }
      ];
}

function sampleStripBlocks(spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  return my
    ? [
        { label: "Retratos profesionales", meta: "Perfil" },
        { label: "Peinados", meta: "Belleza" },
        { label: "Cyberpunk", meta: "Neon" },
        { label: "Naturaleza", meta: "Exterior" },
        { label: "Noir cinematografico", meta: "Privado" },
        { label: "Mundial", meta: "Hinchas" }
      ]
    : [
        { label: "Destino", meta: "Album de viaje" },
        { label: "Costa", meta: "Luz marina" },
        { label: "Casco antiguo", meta: "Cafe y calles" },
        { label: "Isla", meta: "Terraza" },
        { label: "Montana", meta: "Sendero" },
        { label: "Postal", meta: "Recorte social" }
      ];
}

function brandStripBlocks(spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  return my
    ? [
        { name: "Casos de uso", badge: "Prueba" },
        { name: "Catalogo de paquetes", badge: "Catalogo" },
        { name: "Modelo IA privado", badge: "Privado" },
        { name: "Clips breves", badge: "Movimiento" },
        { name: "Estilos guiados", badge: "Estilo" }
      ]
    : [
        { name: "Casos de viaje", badge: "Prueba" },
        { name: "Rutas visuales", badge: "Catalogo" },
        { name: "Modelo IA privado", badge: "Privado" },
        { name: "Itinerarios", badge: "Ruta" },
        { name: "Galerias privadas", badge: "Destino" }
      ];
}

function featuredPackBlocks(spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  return my
    ? [
        { label: "Poster de hincha", meta: "Estilo cinematico" },
        { label: "Grupo", meta: "Album privado" },
        { label: "Avatar de partido", meta: "Perfil" },
        { label: "Portada", meta: "Privado" },
        { label: "Historia social", meta: "Movil" },
        { label: "Banner", meta: "Portada" }
      ]
    : [
        { label: "Destino", meta: "Album de viaje" },
        { label: "Costa", meta: "Luz marina" },
        { label: "Casco antiguo", meta: "Cafe y calles" },
        { label: "Isla", meta: "Terraza" },
        { label: "Montana", meta: "Sendero" },
        { label: "Postal", meta: "Recorte social" }
      ];
}

function packageCatalogBlocks(spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  return my
    ? [
        { meta: "Perfil", category: "Retratos", description: "Crea resultados privados desde selfies claros, con creditos visibles antes de generar." },
        { meta: "Belleza", category: "Estilo", description: "Prueba peinado, maquillaje o ambiente visual antes de abrir un set privado." },
        { meta: "Creador", category: "Contenido", description: "Prepara retratos, portadas y material social dentro de la cuenta del sitio." },
        { meta: "Deportes", category: "Hinchas", description: "Crea posters personales, avatares y escenas de estadio con fotos propias." },
        { meta: "Album", category: "Privado", description: "Guarda favoritos y descargas en una galeria ligada a la cuenta." }
      ]
    : [
        { meta: "Destino", category: "Ruta", description: "Crea retratos de viaje desde fotos fuente claras, destino definido y creditos visibles." },
        { meta: "Costa", category: "Luz", description: "Prepara escenas de mar, terraza y calma costera para una galeria privada." },
        { meta: "Ciudad", category: "Casco antiguo", description: "Convierte retratos fuente en paseos urbanos, cafe, piedra y luz de calle." },
        { meta: "Aventura", category: "Exterior", description: "Define senderos, carretera, montana o refugio antes de reservar creditos." },
        { meta: "Postal", category: "Recuerdo", description: "Genera portadas, recortes sociales y albumes de destino desde una cuenta privada." }
      ];
}

function taxonomyBlocks(spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  return my
    ? [
        { meta: "Perfil", title: "Retratos profesionales", description: "Perfiles para LinkedIn, fundadores, curriculos, ponentes y equipos." },
        { meta: "Belleza", title: "Belleza y estilos", description: "Prueba peinado, color, retoque y acabados visuales desde selfies claros." },
        { meta: "Creativo", title: "Mundos cinematicos", description: "Escenas cyberpunk, gala, noir y editoriales para albumes privados." },
        { meta: "Deportes", title: "Fotos de hincha", description: "Posters personales y escenas de estadio con creditos visibles antes de generar." },
        { meta: "Video", title: "Video y movimiento", description: "Convierte resultados terminados en clips sociales privados." },
        { meta: "Creador", title: "Retratos de creador", description: "Material visual para perfiles, portadas y contenido personal." }
      ]
    : [
        { meta: "Destino", title: "Albumes de retrato de ruta", description: "Retratos con direccion de destino, luz y continuidad de album." },
        { meta: "Costa", title: "Sets de luz costera", description: "Escenas de mar, balcon, terraza y calma para recuerdos privados." },
        { meta: "Ciudad", title: "Paseos por casco antiguo", description: "Cafe, calles de piedra, plazas y ambiente urbano cinematografico." },
        { meta: "Aventura", title: "Escapadas de aventura", description: "Senderos, carretera, montana y exteriores con ruta visual clara." },
        { meta: "Itinerario", title: "Moodboards de itinerario", description: "Notas de ambiente, vestuario, clima y continuidad para planear la galeria." },
        { meta: "Postal", title: "Sets de postal", description: "Portadas, recortes sociales y albumes listos para recuerdo privado." }
      ];
}

function testimonialBlocks(spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  return my
    ? [
        { name: "Perfil renovado", role: "Profesional", quote: "Prepare un set privado para perfil y equipo con coste visible antes de generar.", location: "Retratos profesionales" },
        { name: "Poster de hincha", role: "Deportes", quote: "Con selfies propios pude crear posters personales y avatar de partido sin sesion de estudio.", location: "Mundial" },
        { name: "Album de creador", role: "Contenido", quote: "Los resultados quedaron guardados con mis creditos y favoritos dentro de la misma cuenta.", location: "Creador" },
        { name: "Vista de estilo", role: "Belleza", quote: "Probe peinado, color y ambiente antes de abrir un paquete mas grande.", location: "Estilo" },
        { name: "Set privado", role: "Album", quote: "Subi fotos claras, revise creditos y descargue mis imagenes desde la galeria privada.", location: "Galeria" },
        { name: "Plan de paquete", role: "Credito", quote: "La pagina deja claro que se gasta, que se genera y donde queda cada resultado.", location: "Flujo" }
      ]
    : [
        { name: "Ruta costera", role: "Creador", quote: "Defini luz marina y recibi una galeria coherente sin organizar una sesion en destino.", location: "Costa" },
        { name: "Paseo urbano", role: "Autor", quote: "Las fotos fuente se transformaron en una serie de calle, cafe y casco antiguo.", location: "Ciudad" },
        { name: "Album editorial", role: "Fundador", quote: "El saldo, la ruta y las descargas quedaron unidos a la misma cuenta privada.", location: "Destino" },
        { name: "Postal privada", role: "Diseno", quote: "Use notas de ambiente y creditos visibles para crear recuerdos de viaje consistentes.", location: "Postal" }
      ];
}

function spanishToolCardDescription(title, spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  const lower = title.toLowerCase();
  return my
    ? `Usa ${lower} con fotos propias o autorizadas. Revisa el resultado esperado, el coste en creditos y continua hacia un album privado de ${spec.readableBrand}.`
    : `Usa ${lower} con retratos fuente autorizados. Define destino, ambiente y creditos antes de guardar resultados en una galeria privada de ${spec.readableBrand}.`;
}

function patchSpanishToolCollectionBlocks(section, spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  section.blocks = (section.blocks ?? []).map((block, index) => {
    const settings = block.settings ?? {};
    const title = spanishTitle(settings.title ?? `Herramienta ${index + 1}`);
    return {
      ...block,
      settings: {
        ...settings,
        title,
        description: spanishToolCardDescription(title, spec),
        category: my ? "Fotos IA" : "Retratos de viaje",
        badge: spanishTitle(settings.badge ?? (my ? "Herramienta" : "Ruta")),
        primaryCta: my ? "Abrir herramienta" : "Abrir ruta"
      }
    };
  });
}

function patchSpanishXbyCommonSections(next, slug, spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  for (const [sectionId, section] of Object.entries(next.sections ?? {})) {
    if (!section || typeof section !== "object") continue;
    section.settings = section.settings ?? {};
    if (section.type === "faq") {
      section.settings = {
        ...section.settings,
        subtitle: my
          ? "Respuestas sobre selfies fuente, creditos, privacidad, entrega y reintentos."
          : "Respuestas sobre fotos fuente, destino, creditos, privacidad y entrega de ruta.",
        journeyDescriptions: my
          ? "Sube fotos claras.|Elige un paquete.|Revisa creditos visibles.|Descarga el album privado."
          : "Sube retratos claros.|Elige una direccion de viaje.|Confirma creditos visibles.|Revisa la galeria privada."
      };
      patchSectionBlocks(next, sectionId, faqBlocksForSlug(slug, spec));
    }
    if (section.type === "feature_grid") {
      patchSectionObject(section, {
        eyebrow: my ? "Proceso de set" : "Proceso de ruta",
        title: my ? "De selfie a album privado." : "De fotos fuente a una galeria privada.",
        subtitle: my
          ? "Las herramientas prueban ideas, los creditos activan paquetes y los albumes se entregan en privado."
          : "Las rutas conectan fotos fuente, ambiente, creditos visibles y una galeria privada."
      });
      patchSectionObjectBlocks(section, journeyCardsForSlug(slug, spec));
    }
    if (section.type === "free_tools" || section.type === "free_tools_grid" || section.type === "dreamshoot_tool_collection" || section.type === "aidreamcapes_tool_collection" || /free_tools/i.test(sectionId)) {
      patchSectionObject(section, {
        categories: my ? "Fotos IA|Edicion IA|Video IA" : "Edicion de ruta|Retratos de ruta|Video IA",
        primaryCta: my ? "Abrir herramienta" : "Abrir motor de retratos de ruta"
      });
      patchSpanishToolCollectionBlocks(section, spec);
    }
    if (section.type === "photo_package_wall") {
      section.settings = {
        ...section.settings,
        eyebrow: my ? "Catalogo privado" : "Rutas visuales",
        title: my ? "Paquetes de fotos para perfiles, pareja y albumes." : "Paquetes de destino para retratos de viaje.",
        subtitle: my
          ? "Elige una direccion visual, revisa creditos y genera resultados dentro de tu cuenta."
          : "Elige costa, ciudad, isla, montana o postal y revisa creditos antes de generar."
      };
    }
    if (section.type === "pricing_table") {
      section.settings = {
        ...section.settings,
        title: my ? "Planes de creditos para fotos IA" : "Planes de creditos para viajes IA",
        subtitle: my
          ? "Compra creditos para sets privados, herramientas y albumes de retrato."
          : "Compra creditos para rutas, escenas de destino y galerias privadas.",
        featuredBadgeLabel: my ? "Popular en perfiles" : "Popular en rutas"
      };
    }
    if (section.type === "feature_tabs") {
      patchSectionObject(section, {
        subtitle: my
          ? "Cada pedido queda unido a fotos fuente, paquete elegido, creditos visibles y entrega privada."
          : "Cada ruta queda unida a fotos fuente, referencias de destino, creditos visibles y entrega privada."
      });
    }
    if (section.type === "dreamshoot_feature_tabs" || section.type === "aidreamcapes_feature_tabs") {
      patchSectionObject(section, {
        eyebrow: my ? "Opciones de creacion" : "Flujo de ruta",
        title: my ? "Elige el tipo de resultado antes de generar." : "Elige destino, referencias y entrega.",
        subtitle: my
          ? "Cada pestana conecta estilo, fotos fuente y creditos visibles."
          : "Cada pestana conecta ambiente de viaje, retratos fuente y galeria privada."
      });
      patchSectionObjectBlocks(section, featureTabBlocks(spec));
    }
    if (section.type === "proof") {
      section.settings = {
        ...section.settings,
        subtitle: my
          ? "Elige el tipo de set privado antes de subir fotos o gastar creditos."
          : "Elige una direccion visual antes de confirmar creditos y galeria.",
        summaryBody: my
          ? "Fotos fuente, creditos y albumes terminados quedan ligados a una cuenta privada."
          : "Fotos fuente, creditos y galerias de viaje terminadas quedan ligados a una cuenta privada."
      };
    }
    if (section.type === "testimonial_wall") {
      patchSectionObject(section, {
        title: my ? "Resultados privados para perfiles, hinchas y creadores." : "Historias de albumes privados de viaje.",
        subtitle: my
          ? "Ejemplos de clientes que revisan creditos, generan un set y descargan desde su cuenta."
          : "Ejemplos de rutas con fotos fuente, destino claro, creditos visibles y entrega privada.",
        summaryTitle: my ? "Casos de fotos IA" : "Casos de viaje IA",
        summaryMeta: my ? "Albumes privados" : "Galerias privadas",
        summaryBody: my
          ? "Cada pedido mantiene fotos fuente, saldo y resultados dentro del sitio."
          : "Cada ruta mantiene fotos fuente, saldo y resultados dentro del sitio."
      });
      patchSectionObjectBlocks(section, testimonialBlocks(spec));
    }
    if (section.type === "login_method_panel") {
      section.settings = {
        ...section.settings,
        imageCaption: my
          ? "Cada foto fuente, credito y album queda unido a tu cuenta privada."
          : "Cada foto fuente, credito y galeria de viaje queda unida a tu cuenta privada."
      };
    }
    if (section.type === "trust_signal_bar" || /trust/i.test(sectionId)) {
      const title = my ? "Privacidad, saldo y entrega" : "Ruta, saldo y galeria";
      const body = my
        ? `${spec.readableBrand} mantiene fotos fuente, pedidos, creditos, descargas y soporte dentro de la cuenta del sitio.`
        : `${spec.readableBrand} mantiene fotos fuente, rutas, historial de creditos, resultados, descargas y soporte dentro de la cuenta del sitio.`;
      patchSectionObject(section, { title, body });
    }
    if (section.type === "tool_banner" || section.type === "tool_entry" || section.type === "ai_tool_entry" || section.type === "media_banner") {
      const subtitle = my
        ? "Sube fotos fuente, elige estilo, confirma creditos y recibe el resultado en tu album privado."
        : "Sube fotos fuente, elige destino, confirma creditos y recibe una galeria privada de viaje.";
      patchSectionObject(section, { subtitle });
    }
    if (section.type === "upload") {
      section.settings = {
        ...section.settings,
        helper: my
          ? "Sube fotos fuente solo para el cliente actual."
          : "Sube solo las fotos fuente necesarias para la ruta elegida."
      };
    }
    if (section.type === "upload_panel") {
      const title = my ? "Subida privada de fotos fuente" : "Subida privada de retratos fuente";
      const helper = my
        ? "Sube selfies o retratos claros antes de iniciar un paquete de fotos IA."
        : "Sube retratos claros y referencias de destino antes de iniciar una ruta visual.";
      patchSectionObject(section, { title, helper });
    }
    if (section.type === "job_progress") {
      const title = my ? "Estado de generacion" : "Estado de la ruta";
      patchSectionObject(section, { title });
    }
    if (section.type === "media_banner") {
      const eyebrow = my ? "Galeria privada" : "Galeria de destino";
      const title = my ? "Resultados guardados en tu album privado." : "Retratos de viaje guardados en tu galeria privada.";
      const subtitle = my
        ? "Revisa, marca favoritos y descarga resultados desde la misma cuenta."
        : "Revisa escenas, marca favoritos y descarga albumes de viaje desde la misma cuenta.";
      patchSectionObject(section, { eyebrow, title, subtitle });
    }
    if (section.type === "brand_logo_strip") {
      patchSectionObject(section, {
        title: my
          ? "Selfies privados · Creditos visibles · Albumes descargables"
          : "Rutas visuales · Creditos claros · Galerias privadas"
      });
      patchSectionObjectBlocks(section, brandStripBlocks(spec));
    }
    if (section.type === "dreamshoot_flow_bridge" || section.type === "aidreamcapes_flow_bridge") {
      const cards = flowCardsForSpec(spec);
      patchSectionObject(section, {
        label: my ? "Flujo de creacion" : "Flujo de ruta",
        title: my ? "De fotos fuente a un album privado." : "De fotos fuente a una galeria privada de viaje.",
        subtitle: my
          ? "Elige paquete, confirma creditos y conserva resultados en tu espacio privado."
          : "Define destino, confirma creditos y conserva resultados en tu galeria privada.",
        bridgeCta: my ? "Elegir creditos para mi set" : "Elegir creditos para mi ruta",
        beforeLabel: "Antes",
        afterLabel: "Despues"
      });
      patchSectionObjectBlocks(section, cards);
    }
    if (section.type === "dreamshoot_featured_pack" || section.type === "aidreamcapes_featured_pack") {
      patchSectionObject(section, {
        badge: my ? "Pack de partido" : "Firma visual",
        label: my ? "Pack destacado de temporada" : "Paquete destacado",
        title: my ? "Set destacado para crear sin partir de cero." : "Ruta destacada con destino definido.",
        subtitle: my
          ? "Convierte selfies cotidianos en imagenes listas para perfil, poster o album privado."
          : "Convierte retratos fuente en una historia visual de viaje con luz y ambiente consistentes.",
        overlayTitle: my ? "Pack del Mundial" : "Pack de destino",
        overlaySubtitle: my ? "Looks de partido sin estudio." : "Retratos de viaje sin organizar una sesion en destino.",
        campaignLabel: my ? "Campana actual: fotos de hincha del Mundial" : "Enfoque actual: albumes privados de viaje",
        nextCampaignLabel: my ? "Proximo: San Valentin / graduacion" : "Proximo: luz costera / casco antiguo",
        includedTitle: "Resultados incluidos",
        safetyCopy: my
          ? "Las fotos fuente, creditos y resultados permanecen dentro de una cuenta privada."
          : "Las fotos fuente, creditos y resultados de viaje permanecen dentro de una cuenta privada.",
        primaryCta: my ? "Crear set privado" : "Crear ruta privada",
        secondaryCta: my ? "Ver paquetes" : "Ver rutas"
      });
      patchSectionObjectBlocks(section, featuredPackBlocks(spec));
    }
    if (section.type === "dreamshoot_visual_proof" || section.type === "aidreamcapes_visual_proof") {
      patchSectionObject(section, {
        title: my ? "Mira lo que pueden crear tus selfies." : "Explora resultados de viaje antes de elegir ruta.",
        subtitle: my
          ? "Ejemplos de retratos, carteles, estilos y albumes privados creados con creditos visibles."
          : "Ejemplos de costa, ciudad, isla, montana y postal para orientar tu galeria privada."
      });
      patchSectionObjectBlocks(section, visualProofBlocks(spec));
    }
    if (section.type === "dreamshoot_package_catalog" || section.type === "aidreamcapes_package_catalog") {
      patchSectionObject(section, {
        tabs: my
          ? "Todo|Retratos|Belleza|Creativo|Deportes|Creador|Video|Utilidades"
          : "Todo|Destino|Costero|Ciudad|Aventura|Postal",
        label: my ? "Catalogo de paquetes" : "Catalogo de rutas",
        steps: my
          ? "Elegir paquete|Revisar creditos|Generar album"
          : "Elegir destino|Revisar creditos|Generar galeria",
        title: my ? "Catalogo de fotos IA" : "Catalogo de retratos de viaje",
        subtitle: my
          ? "Elige un paquete, revisa creditos y crea resultados privados desde tus fotos."
          : "Elige una ruta visual, revisa creditos y crea una galeria privada de viaje."
      });
      patchSectionObjectBlocks(section, packageCatalogBlocks(spec));
    }
    if (section.type === "dreamshoot_package_taxonomy" || section.type === "aidreamcapes_package_taxonomy") {
      patchSectionObject(section, {
        eyebrow: my ? "Categorias de fotos" : "Categorias de viaje",
        title: my ? "Explora resultados antes de generar." : "Explora rutas antes de generar.",
        subtitle: my
          ? "Compara perfiles, belleza, deportes, creador, video y albumes privados."
          : "Compara destino, costa, ciudad, aventura, itinerario y postal."
      });
      patchSectionObjectBlocks(section, taxonomyBlocks(spec));
    }
    if (section.type === "sample_strip") {
      patchSectionObject(section, {
        eyebrow: my ? "Muestras de estilo" : "Muestras de destino",
        title: my ? "Categorias privadas de fotos IA." : "Direcciones privadas de viaje.",
        subtitle: my ? "Escoge una direccion visual antes de gastar creditos." : "Escoge una ruta visual antes de gastar creditos."
      });
      patchSectionObjectBlocks(section, sampleStripBlocks(spec));
    }
    if (section.type === "before_after_gallery") {
      section.settings = {
        ...section.settings,
        title: my ? "Compara foto fuente y resultado final." : "Revisa el ambiente de ruta antes de confirmar.",
        subtitle: my
          ? "Observa la direccion del paquete antes de iniciar otra generacion."
          : "Comprueba destino, luz y estilo antes de reservar creditos."
      };
    }
    if (section.type === "album_gallery") {
      patchSectionObject(section, {
        title: my ? "Albumes generados privados" : "Albumes privados de destino",
        emptyTitle: my ? "Aun no hay albumes" : "Aun no hay galerias de viaje",
        emptyBody: my
          ? "Cuando una generacion termine, los resultados apareceran aqui."
          : "Cuando una ruta termine, los retratos apareceran aqui."
      });
    }
    if (section.type === "search_results") {
      patchSectionObject(section, {
        title: my ? "Buscar AIdreamshoots" : "Buscar AIdreamcapes",
        eyebrow: "Buscar",
        emptyTitle: "Aun no hay resultados coincidentes.",
        emptyBody: my
          ? "Busca planes, paquetes, video, probador, gala, privacidad, subidas o reembolsos."
          : "Busca retratos de ruta, luz costera, casco antiguo, marcos alpinos, precios, subidas, privacidad o reembolsos."
      });
    }
    if (section.type === "form") {
      section.settings = {
        ...section.settings,
        helper: my
          ? "Elige un paquete de perfil, retoque, video o escena y sube las fotos que necesita."
          : "Elige una historia de ruta, destino o escena y sube las fotos fuente necesarias."
      };
    }
    if (section.type === "contact_details" || /contact_details/i.test(sectionId)) {
      const title = my ? "Datos de contacto" : "Contacto del estudio";
      section.settings = {
        ...section.settings,
        title
      };
      if ("title" in section) section.title = title;
    }
    if (section.type === "rich_text" && /billing|account/i.test(sectionId)) {
      const eyebrow = my ? "Cuenta y creditos" : "Cuenta y saldo de ruta";
      section.settings = {
        ...section.settings,
        eyebrow,
        title: my ? "Cuenta, creditos y albumes." : "Cuenta, rutas y creditos.",
        body: my
          ? "Revisa plan activo, creditos restantes, recargas, pago y uso de paquetes antes del siguiente set IA."
          : "Revisa plan activo, creditos restantes, rutas, pago y entrega antes del siguiente retrato de viaje."
      };
      if ("eyebrow" in section) section.eyebrow = eyebrow;
    }
    if (section.type === "rich_text" && /pricing_intro/i.test(sectionId)) {
      patchSectionObject(section, {
        eyebrow: "Precios",
        title: my ? "Creditos para paquetes privados de fotos IA." : "Creditos de ruta para albumes privados de viaje.",
        subtitle: my
          ? "Elige creditos segun los retratos, estilos, videos y albumes que quieras terminar este mes."
          : "Elige creditos segun los sets costeros, paseos urbanos, escenas de resort y retratos de ruta que quieras terminar este mes.",
        body: my
          ? "Los planes conectan saldo, pago, generacion y entrega privada en una sola cuenta."
          : "Los planes conectan saldo, pago, ruta visual y galeria privada en una sola cuenta."
      });
    }
    if (section.type === "rich_text" && /about_values/i.test(sectionId)) {
      patchSectionObject(section, {
        eyebrow: my ? "Enfoque del estudio" : "Enfoque de ruta",
        title: my ? "Fotos fuente, creditos visibles y albumes privados." : "Fotos fuente, destino claro y albumes privados.",
        subtitle: my
          ? "Cada pagina de AIdreamshoots ayuda a saber que subir, que creditos se usan y donde llegan los resultados."
          : "Cada pagina de AIdreamcapes ayuda a saber que subir, que ruta elegir y donde llegan las imagenes finales."
      });
      patchSectionObjectBlocks(section, ruleCardsForSlug(slug, spec));
    }
  }
}

function patchSpanishXbyHomepage(next, slug, spec) {
  if (spec.sourceSiteId !== "site_dreamshoot" || slug !== "/") return;
  const sections = next.sections ?? {};
  const homepageBullets = "Sube fotos claras.|Elige un paquete.|Revisa creditos visibles.|Descarga tu album privado.";
  const homepageFaqBlocks = [
    {
      body: "AIdreamshoots es un estudio privado de fotos y videos con IA para crear retratos, conjuntos de imagenes y clips breves desde fotos fuente autorizadas.",
      answer: "Convierte fotos fuente autorizadas en retratos tematicos, imagenes de grupo, recursos para perfiles, tarjetas de temporada y escenas breves listas para movimiento.",
      question: "Que es AIdreamshoots?",
      bulletList: homepageBullets,
      imageAlt: "Retrato profesional creado desde fotos fuente autorizadas.",
      linkList: "Explorar paquetes::/ai-image-generation|Ver herramientas de video::/ai-video-generation"
    },
    {
      body: "El flujo mantiene la seleccion de fotos, el paquete, los creditos y los resultados dentro de tu cuenta privada.",
      answer: "Sube fotos claras, elige un paquete o una herramienta, revisa el coste en creditos y descarga el album cuando termine.",
      question: "Como uso AIdreamshoots?",
      bulletList: homepageBullets,
      linkList: "Ver el flujo::/workflow|Abrir mi espacio::/login"
    },
    {
      body: "Puedes preparar retratos profesionales, fotos de pareja, estilos de belleza, escenas de deporte, imagenes de creador y conjuntos de temporada.",
      answer: "Si. Elige el paquete que encaje con tu perfil, pareja, creador, belleza, deporte o idea editorial y revisa el coste antes de generar.",
      question: "Que tipos de fotos puedo crear?",
      bulletList: homepageBullets,
      linkList: "Comparar paquetes::/ai-image-generation|Ver herramientas::/ai-video-generation"
    },
    {
      body: "Puedes empezar revisando ejemplos, paquetes y costes antes de decidir que quieres generar.",
      answer: "La cuenta y la galeria son privadas. Revisa las opciones disponibles y el coste en creditos antes de iniciar cada pedido.",
      question: "Puedo probar AIdreamshoots?",
      bulletList: homepageBullets,
      linkList: "Ver precios::/pricing|Consultar herramientas::/ai-video-generation"
    },
    {
      body: "Los planes y paquetes muestran el coste en creditos antes de generar para que puedas elegir el alcance del pedido.",
      answer: "Elige un plan o una recarga, revisa el saldo y confirma el pedido solo cuando el coste y los resultados esperados esten claros.",
      question: "Como funcionan los planes y paquetes?",
      bulletList: homepageBullets,
      linkList: "Ver precios::/pricing|Revisar terminos::/terms"
    },
    {
      body: "Los creditos conectan el plan, el pedido, la generacion y la entrega del album dentro de la misma cuenta.",
      answer: "Los creditos se reservan cuando confirmas una generacion. Si el pedido falla, el flujo devuelve el saldo segun el estado del trabajo.",
      question: "Cuando se descuentan los creditos?",
      bulletList: homepageBullets,
      linkList: "Ver precios::/pricing|Contactar soporte::/contact-us"
    },
    {
      body: "Las fotos claras, variadas y autorizadas ayudan a mantener identidad, detalle y continuidad en el resultado.",
      answer: "Usa fotos claras, con una persona visible, poca compresion y permiso para usar la imagen dentro de tu cuenta privada.",
      question: "Que fotos fuente funcionan mejor?",
      bulletList: homepageBullets,
      imageAlt: "Retrato profesional creado desde fotos fuente autorizadas.",
      linkList: "Revisar el flujo::/workflow"
    },
    {
      body: "Los paquetes pueden incluir retratos individuales, parejas, grupos y escenas de temporada, siempre dentro del espacio privado.",
      answer: "Si. Elige un paquete de pareja o grupo y sube fotos autorizadas de las personas que quieres incluir.",
      question: "Puedo crear fotos de pareja o grupo?",
      bulletList: homepageBullets,
      imageAlt: "Pareja en un retrato de temporada creado con IA.",
      linkList: "Explorar paquetes de pareja::/ai-image-generation"
    },
    {
      body: "Los generadores de fotos convierten una seleccion de fotos fuente en resultados preparados para perfiles, contenido o albumes.",
      answer: "Elige un generador o paquete, revisa los requisitos de fotos y confirma el coste antes de crear el resultado.",
      question: "Como funciona un generador de fotos con IA?",
      bulletList: homepageBullets,
      imageAlt: "Retrato de creador listo para un perfil social.",
      linkList: "Ver generadores de fotos::/ai-image-generation"
    },
    {
      body: "Las herramientas de video convierten una imagen o un conjunto autorizado en una pieza breve para revisar dentro de tu cuenta.",
      answer: "Usa una herramienta de video compatible, revisa el coste y comprueba el clip completo antes de publicarlo o descargarlo.",
      question: "Puedo crear videos con IA?",
      bulletList: homepageBullets,
      imageAlt: "Resultado de video breve creado desde una imagen autorizada.",
      linkList: "Ver herramientas de video::/ai-video-generation|Revisar el flujo::/workflow"
    },
    {
      body: "Puedes probar peinados, color, vestuario y ambientes visuales antes de abrir un conjunto mas amplio.",
      answer: "Si. Elige un estilo, sube fotos claras y revisa el coste antes de generar una nueva variacion.",
      question: "Puedo probar estilos distintos?",
      bulletList: homepageBullets,
      imageAlt: "Retrato de estilo virtual con peinado y vestuario.",
      linkList: "Explorar herramientas::/ai-video-generation"
    },
    {
      body: "Los pedidos, creditos, favoritos y descargas quedan ligados al espacio privado de la cuenta que los creo.",
      answer: "Los resultados aparecen en tu espacio privado junto con favoritos, historial de pedidos y descargas disponibles.",
      question: "Donde veo mis albumes?",
      bulletList: homepageBullets,
      linkList: "Abrir mi espacio::/login|Contactar soporte::/contact-us"
    },
    {
      body: "Puedes seguir el pedido desde la confirmacion de creditos hasta la generacion, revision y entrega del album.",
      answer: "El estado del pedido muestra si esta en cola, procesando, terminado o requiere atencion antes de la descarga.",
      question: "Como sigo un pedido?",
      bulletList: homepageBullets,
      linkList: "Abrir mi espacio::/app|Ver el flujo::/workflow"
    },
    {
      body: "Las fotos y resultados se mantienen dentro de la cuenta correspondiente y no se publican como una galeria abierta por defecto.",
      answer: "Usa solo fotos propias o autorizadas. Las subidas y los resultados permanecen ligados a tu cuenta privada de AIdreamshoots.",
      question: "Como se protegen mis fotos?",
      bulletList: homepageBullets,
      linkList: "Leer la politica de privacidad::/privacy|Revisar la politica de contenido::/contenido"
    },
    {
      body: "Si una generacion falla, el estado del pedido determina si los creditos se liberan, se repite el trabajo o se revisa una solicitud.",
      answer: "Escribe a soporte con el correo de la cuenta y el pedido afectado para revisar creditos, fallo tecnico y opciones disponibles.",
      question: "Que ocurre si un pedido falla?",
      bulletList: homepageBullets,
      linkList: "Leer la politica de reembolsos::/refunds|Contactar soporte::/contact-us"
    }
  ];
  const homepageTestimonials = [
    { name: "Perfil renovado", role: "Profesional", quote: "Prepare un conjunto privado para perfil y equipo con coste visible antes de generar.", location: "Retratos profesionales" },
    { name: "Poster de hincha", role: "Deportes", quote: "Con selfies propios pude crear posters personales y avatar de partido sin sesion de estudio.", location: "Mundial" },
    { name: "Album de creador", role: "Contenido", quote: "Los resultados quedaron guardados con mis creditos y favoritos dentro de la misma cuenta.", location: "Creador" },
    { name: "Vista de estilo", role: "Belleza", quote: "Probe peinado, color y ambiente antes de abrir un paquete mas grande.", location: "Estilo" },
    { name: "Conjunto privado", role: "Album", quote: "Subi fotos claras, revise creditos y descargue mis imagenes desde la galeria privada.", location: "Galeria" },
    { name: "Plan de paquete", role: "Credito", quote: "La pagina deja claro que se gasta, que se genera y donde queda cada resultado.", location: "Flujo" },
    { name: "Perfil de equipo", role: "Profesional", quote: "Prepare un conjunto para mi equipo y revise el coste antes de generar.", location: "Equipos" },
    { name: "Contenido social", role: "Creador", quote: "Pude comparar estilos y guardar los resultados dentro de mi cuenta privada.", location: "Contenido" }
  ];
  const homepageBrandBlocks = [
    { name: "Casos de uso", badge: "Prueba" },
    { name: "Catalogo de paquetes", badge: "Catalogo" },
    { name: "Modelo IA privado", badge: "Privado" },
    { name: "Clips breves", badge: "Movimiento" },
    { name: "Estilos guiados", badge: "Estilo" },
    { name: "Perfiles y equipos", badge: "Perfil" },
    { name: "Contenido social", badge: "Contenido" },
    { name: "Albumes privados", badge: "Album" }
  ];

  patchSectionObject(sections.hero_1, {
    eyebrow: "Creacion de fotos y videos con IA",
    headline: "Crea videos con IA, retratos profesionales y conjuntos de fotos desde tus imagenes",
    heroBadge: "Creacion de fotos y videos con IA",
    authRibbon: "Revisa los creditos antes de generar",
    bulletList: "Politica de entrenamiento - {LIVE_TRAINING_POLICY_STATEMENT}|Retencion de fotos fuente - Las fotos fuente siguen el periodo de retencion publicado de {LIVE_SOURCE_MEDIA_RETENTION_DAYS} dias.|Revision de reembolsos - {LIVE_REFUND_REVIEW_POLICY_STATEMENT} Las solicitudes deben enviarse dentro de {LIVE_REFUND_WINDOW_DAYS} dias.|Flujo seguro de cuenta - Las subidas, solicitudes, revision de creditos y galerias permanecen en tu cuenta.",
    imageBadge: "Fotos y videos privados con IA",
    subheadline: "Sube tus fotos y elige que quieres crear: videos con IA, retratos profesionales, fotos de pareja, imagenes de temporada y conjuntos creativos. Revisa ejemplos y costes antes de generar y encuentra los resultados en tu espacio privado.",
    imageCaption: "Crea videos y conjuntos de fotos con IA para perfiles, contenido social, retratos, parejas, temporadas y proyectos creativos.",
    highlightWord: "Retratos profesionales con IA",
    authButtonLabel: "Empieza a crear con tu correo",
    authPrimaryLabel: "Continuar con Google",
    socialProofLabel: "Subidas, solicitudes y galerias privadas",
    authEmailPlaceholder: "Correo electronico"
  });
  // Keep the target homepage on the same renderer contract as the English
  // source. Older target snapshots used the unsupported `principal` type,
  // which made the homepage audit look synced while rendering a different
  // section implementation.
  if (sections.hero_1 && typeof sections.hero_1 === "object") sections.hero_1.type = "hero";
  patchSectionObject(sections.generation_showcase_1, {
    title: "Explora temas de fotos y videos creados por clientes.",
    eyebrow: "Ejemplos creados por clientes",
    subtitle: "Estos ejemplos usan materiales creados por clientes en cuentas privadas. Revisa las etiquetas para elegir una direccion para tu propio conjunto.",
    imageTitle: "Generadores de fotos con IA destacados",
    primaryCta: "Empieza con tus fotos",
    videoTitle: "Generadores de video con IA destacados",
    imageAllLabel: "Ver todas las fotos",
    videoAllLabel: "Ver todos los videos"
  });
  patchSectionObject(sections.pricing_1, {
    sidePanelTitle: "Planes desde {LIVE_LOWEST_ACTIVE_PLAN_PRICE}, con saldo de creditos y periodicidad visibles en cada opcion."
  });
  patchSectionObject(sections.tutorial_video_1, {
    title: "Como funciona",
    eyebrow: "Como funciona",
    imageAlt: "Captura del tutorial de inicio con un retrato profesional con IA, la navegacion y el panel de registro.",
    subtitle: "Sube fotos fuente autorizadas, elige un flujo, revisa el coste en creditos y genera dentro de tu espacio privado.",
    playLabel: "Ver el tutorial de imagenes con IA de AIdreamshoots",
    supportingCopy: "Usa un flujo de video con IA compatible para convertir una imagen o conjunto autorizado en un resultado breve y revisa el clip completo antes de publicarlo."
  });
  patchSectionObject(sections.proof_1, {
    title: "Resultados privados para perfiles, hinchas y creadores.",
    subtitle: "Ejemplos de clientes que revisan creditos, generan un conjunto y descargan desde su cuenta.",
    summaryTitle: "Casos de fotos IA",
    summaryMeta: "Albumes privados",
    summaryBody: "Cada pedido mantiene fotos fuente, saldo y resultados dentro del sitio."
  });
  patchSectionObjectBlocks(sections.proof_1, homepageTestimonials);
  patchSectionObject(sections.faq_1, {
    title: "Preguntas frecuentes",
    eyebrow: "Preguntas antes de subir fotos",
    imageAlt: "Retrato festivo con luz calida para un album de temporada.",
    subtitle: "Respuestas sobre fotos fuente, paquetes, creditos, videos con IA, estilos, privacidad y entrega.",
    imageListAlt: "Retrato festivo con luz calida|Retrato de pareja en una escena de invierno|Retrato de pareja listo para una tarjeta|Retrato de grupo en una mesa calida|Retrato de fiesta con vestuario cinematografico|Conjunto de retratos de temporada con luz festiva",
    journeyTitle: "Tu flujo de fotos",
    journeyTitles: "Subir|Elegir paquete|Generar|Descargar",
    journeyDescriptions: homepageBullets
  });
  if (sections.faq_1?.blocks?.length) {
    sections.faq_1.blocks = sections.faq_1.blocks.map((block, index) => ({
      ...block,
      settings: {
        ...(block.settings ?? {}),
        ...(homepageFaqBlocks[index % homepageFaqBlocks.length] ?? {})
      }
    }));
  }
  patchSectionObject(sections.conversion_1, {
    title: "Listo para probar AIdreamshoots?",
    eyebrow: "Creacion privada con IA",
    subtitle: "Crea videos con IA, retratos profesionales y conjuntos de fotos desde tus imagenes dentro de un espacio privado.",
    primaryCta: "Crear ahora",
    secondaryCta: "Elegir plan"
  });
  patchSectionObjectBlocks(sections.conversion_1, [
    { label: "creditos iniciales", value: "200" },
    { label: "paquetes de estilo", value: "15+" },
    { label: "Entrega", value: "Privada" }
  ]);
  patchSectionObject(sections.brand_strip_1, {
    title: "Para creadores, perfiles, equipos y comunidades que quieren resultados privados."
  });
  patchSectionObjectBlocks(sections.brand_strip_1, homepageBrandBlocks);
}

function policyKindForSlug(slug) {
  const normalized = String(slug ?? "").toLowerCase();
  if (normalized.includes("cookie")) return "cookies";
  if (normalized.includes("refund")) return "refunds";
  if (normalized.includes("shipping")) return "shipping";
  if (normalized.includes("terms")) return "terms";
  if (normalized.includes("content")) return "content";
  if (normalized.includes("privacy")) return "privacy";
  return null;
}

function policyCopyForKind(kind, spec) {
  const brand = spec.readableBrand;
  const my = spec.sourceSiteId === "site_dreamshoot";
  const support = spec.supportEmail;
  const domain = spec.targetDomain;
  const generic = {
    title: "Politica",
    eyebrow: "Politica",
    intro: `${brand} mantiene cuentas, creditos, pedidos y entregas dentro del sitio correspondiente.`,
    body: `<h3>1. Alcance</h3><p>Esta politica describe como ${brand} gestiona cuentas, subidas, creditos, pedidos, soporte y entregas digitales dentro de ${domain}.</p><h3>2. Datos y operaciones</h3><p>La informacion se utiliza para operar el servicio solicitado, proteger la cuenta, resolver incidencias y mantener registros de credito y entrega.</p><h3>3. Contacto</h3><p>Escribe a <a href="mailto:${support}">${support}</a> para dudas relacionadas con esta politica.</p>`
  };
  const copies = {
    privacy: my
      ? {
          title: "Politica de privacidad",
          eyebrow: "Privacidad de selfies",
          intro: "Como cuidamos cuentas, selfies fuente, creditos, pedidos y albumes privados.",
          body: `<h3>1. Informacion que tratamos</h3><p>${brand} usa el correo de cuenta, sesiones, selfies fuente, selecciones de paquete, instrucciones creativas, resultados generados, pedidos, suscripciones, movimientos de creditos, mensajes de soporte y senales tecnicas necesarias para seguridad y fiabilidad.</p><h3>2. Uso de la informacion</h3><p>Usamos esos datos para crear retratos solicitados, reservar y liquidar creditos, entregar albumes privados, resolver incidencias, prevenir abuso, mejorar guias de fotos fuente y mostrar el espacio privado correcto despues de iniciar sesion.</p><h3>3. Fotos privadas</h3><p>Las subidas y resultados quedan ligados a la cuenta del cliente en ${domain}. No se venden como imagenes de stock ni se publican en galerias abiertas por defecto.</p><h3>4. Pagos y conservacion</h3><p>Los pagos se procesan con un proveedor conectado. Guardamos referencias de pedido, pago, reservas, devoluciones y suscripcion, no numeros completos de tarjeta. Algunos registros se conservan para soporte, seguridad, cumplimiento y acceso del cliente.</p><h3>5. Opciones del cliente</h3><p>Puedes pedir acceso, correccion, eliminacion o revision escribiendo a <a href="mailto:${support}">${support}</a> con el correo de la cuenta y el pedido afectado.</p>`
        }
      : {
          title: "Politica de privacidad",
          eyebrow: "Privacidad de rutas",
          intro: "Como protegemos fotos fuente, notas de destino, creditos y galerias de viaje.",
          body: `<h3>1. Informacion que tratamos</h3><p>${brand} usa correo de cuenta, sesiones, fotos fuente, notas de ruta, paquete elegido, instrucciones creativas, resultados, pedidos, movimientos de creditos, mensajes de soporte y metadatos tecnicos para operar una galeria privada de viaje.</p><h3>2. Uso de la informacion</h3><p>Usamos esos datos para crear retratos de destino, mantener saldo y pedidos correctos, entregar galerias privadas, solucionar fallos, prevenir abuso y mejorar la orientacion de escena.</p><h3>3. Fotos y rutas privadas</h3><p>Las subidas y resultados permanecen asociados al sitio ${domain} y a la cuenta iniciada. No se transfieren a otros escaparates ni se publican como muestras publicas por defecto.</p><h3>4. Pagos y conservacion</h3><p>Los pagos los procesa un proveedor conectado. Conservamos estados de pago, ordenes, suscripciones, reservas, reversiones y reembolsos cuando es necesario para soporte, cumplimiento y seguridad.</p><h3>5. Opciones del cliente</h3><p>Para acceso, eliminacion, correccion o privacidad, escribe a <a href="mailto:${support}">${support}</a> e incluye email de cuenta y datos del pedido.</p>`
        },
    terms: my
      ? {
          title: "Terminos de servicio",
          eyebrow: "Terminos de estudio",
          intro: "Reglas para usar paquetes de fotos IA, creditos, cuenta privada y albumes.",
          body: `<h3>1. Aceptacion</h3><p>Al usar ${brand}, crear cuenta, comprar creditos, subir fotos o iniciar un paquete aceptas estos terminos.</p><h3>2. Uso permitido</h3><p>Debes subir imagenes propias o con permiso, usar instrucciones licitas y evitar contenido que vulnere privacidad, identidad, propiedad intelectual o normas de seguridad.</p><h3>3. Creditos y pedidos</h3><p>Los creditos se muestran antes de generar. Pueden reservarse, gastarse, liberarse o devolverse segun el estado del pedido y la politica aplicable.</p><h3>4. Resultados</h3><p>Los albumes se entregan digitalmente en la cuenta privada. La calidad depende de fotos fuente, paquete, disponibilidad tecnica y reglas de proveedor.</p><h3>5. Soporte</h3><p>Para cuenta, pedidos o terminos, escribe a <a href="mailto:${support}">${support}</a>.</p>`
        }
      : {
          title: "Terminos del estudio",
          eyebrow: "Terminos de ruta",
          intro: "Reglas para crear retratos de viaje, usar creditos y recibir galerias privadas.",
          body: `<h3>1. Aceptacion</h3><p>Al usar ${brand}, comprar creditos, subir fotos fuente o confirmar una ruta visual aceptas estos terminos.</p><h3>2. Uso permitido</h3><p>Debes tener derecho sobre las fotos que subes y no solicitar escenas que vulneren privacidad, derechos de terceros, seguridad o propiedad intelectual.</p><h3>3. Creditos de ruta</h3><p>Los costes se muestran antes de enviar una escena. Las reservas, gastos y devoluciones se reflejan en el historial de la cuenta.</p><h3>4. Entrega</h3><p>Las galerias se entregan digitalmente en el espacio privado. El resultado depende de fotos fuente, direccion de destino, notas y disponibilidad tecnica.</p><h3>5. Contacto</h3><p>Para revisar terminos, pedidos o cuenta, escribe a <a href="mailto:${support}">${support}</a>.</p>`
        },
    cookies: my
      ? {
          title: "Politica de cookies",
          eyebrow: "Cookies del estudio",
          intro: `Cookies para sesion, checkout, seguridad y continuidad de sets en ${brand}.`,
          body: `<h3>1. Sesion del estudio</h3><p>${brand} usa cookies esenciales y almacenamiento local para mantener acceso, proteger el checkout, recordar el paquete elegido y conservar el avance de pedidos de fotos IA.</p><h3>2. Senales de fiabilidad</h3><p>Podemos leer datos tecnicos limitados para detectar fallos de carga, abuso, errores de pago y estado de generacion dentro del estudio.</p><h3>3. Gestion del navegador</h3><p>Puedes borrar o bloquear cookies desde tu navegador. Si bloqueas las esenciales, puede fallar el acceso a cuenta, carrito, pago, album o descarga.</p><h3>4. Soporte</h3><p>Para dudas sobre cookies del estudio escribe a <a href="mailto:${support}">${support}</a>.</p>`
        }
      : {
          title: "Aviso de cookies",
          eyebrow: "Cookies de ruta",
          intro: `Cookies para mantener rutas visuales, cuenta, saldo y entrega privada en ${brand}.`,
          body: `<h3>1. Continuidad de ruta</h3><p>${brand} usa cookies necesarias y almacenamiento local para reconocer la sesion, conservar elecciones de destino, proteger formularios y mantener pagos o galerias de viaje en curso.</p><h3>2. Diagnostico operativo</h3><p>Usamos senales tecnicas acotadas para revisar rendimiento, intentos de abuso, errores de ruta, estado de credito y disponibilidad de entrega.</p><h3>3. Preferencias del cliente</h3><p>La gestion se realiza desde el navegador. Al desactivar cookies esenciales, algunas rutas, pagos, accesos o galerias privadas pueden dejar de funcionar.</p><h3>4. Contacto</h3><p>Para consultas sobre cookies de AIdreamcapes escribe a <a href="mailto:${support}">${support}</a>.</p>`
        },
    refunds: my
      ? {
          title: "Politica de reembolsos",
          eyebrow: "Reembolsos de sets",
          intro: "Como revisamos creditos no usados, pedidos fallidos y suscripciones.",
          body: `<h3>1. Elegibilidad</h3><p>Puedes pedir revision de creditos comprados y no usados cuando no hayan sido reservados, consumidos ni asociados a una generacion completada.</p><h3>2. Ventana de revision</h3><p>Envia la solicitud con email de cuenta, pedido y motivo. Revisamos pago, historial de creditos y trabajos de fotos antes de decidir.</p><h3>3. Creditos usados</h3><p>Los creditos gastados en paquetes entregados normalmente no son reembolsables porque ya se usaron recursos de proveedor, almacenamiento y entrega.</p><h3>4. Fallos tecnicos</h3><p>Si un fallo de ${brand} impide la entrega, soporte puede liberar creditos, reintentar el trabajo, entregar creditos de reemplazo o aprobar reembolso tras revision.</p><h3>5. Contacto</h3><p>Escribe a <a href="mailto:${support}">${support}</a> para facturacion o reembolsos.</p>`
        }
      : {
          title: "Politica de reembolsos",
          eyebrow: "Reembolsos de ruta",
          intro: "Como revisamos creditos de destino, trabajos fallidos y reservas.",
          body: `<h3>1. Elegibilidad</h3><p>Las solicitudes se revisan segun uso de creditos, estado de pago, suscripcion y entrega de la galeria.</p><h3>2. Creditos reservados</h3><p>Si una ruta falla por un problema tecnico, soporte puede liberar la reserva, repetir el trabajo o emitir creditos de reemplazo.</p><h3>3. Creditos usados</h3><p>Los creditos de galerias entregadas normalmente no se reembolsan porque el procesamiento de escena ya fue consumido.</p><h3>4. Calidad de fotos fuente</h3><p>Fotos borrosas, baja luz, permisos insuficientes o notas contradictorias pueden limitar la elegibilidad.</p><h3>5. Contacto</h3><p>Escribe a <a href="mailto:${support}">${support}</a> con email de cuenta, pedido y ruta afectada.</p>`
        },
    content: my
      ? {
          title: "Politica de contenido",
          eyebrow: "Contenido permitido",
          intro: "Reglas para selfies, instrucciones creativas, paquetes y resultados privados.",
          body: `<h3>1. Subidas permitidas</h3><p>Sube fotos propias o autorizadas, con personas identificables solo cuando tienes permiso para usarlas.</p><h3>2. Contenido no permitido</h3><p>No solicites suplantacion, acoso, abuso, desnudez no consentida, menores en contextos sensibles, documentos privados o usos ilegales.</p><h3>3. Paquetes creativos</h3><p>Los estilos de ${brand} deben usarse para retratos, perfiles, pareja, creador, belleza o albumes privados dentro de un uso responsable.</p><h3>4. Revision</h3><p>Podemos bloquear pedidos, rechazar instrucciones o retirar resultados que infrinjan esta politica.</p><h3>5. Contacto</h3><p>Escribe a <a href="mailto:${support}">${support}</a> para dudas de contenido.</p>`
        }
      : {
          title: "Politica de contenido",
          eyebrow: "Seguridad creativa",
          intro: "Reglas para fotos fuente, notas de destino y retratos de viaje.",
          body: `<h3>1. Subidas permitidas</h3><p>Sube retratos, referencias de vestuario, inspiracion de lugar o notas creativas sobre las que tengas derechos o permiso.</p><h3>2. Contenido no permitido</h3><p>No uses ${brand} para suplantacion, acoso, abuso, desnudez no consentida, menores en contextos sensibles, documentos privados o fines ilegales.</p><h3>3. Escenas de destino</h3><p>Las rutas visuales deben describir ambientes, luz y narrativa sin reclamar ubicaciones reales falsas o permisos que no existen.</p><h3>4. Revision</h3><p>Podemos rechazar pedidos o retirar salidas que violen esta politica.</p><h3>5. Contacto</h3><p>Escribe a <a href="mailto:${support}">${support}</a> para revisar una solicitud.</p>`
        },
    shipping: my
      ? {
          title: "Entrega digital",
          eyebrow: "Entrega de albumes privados",
          intro: `${brand} entrega sets, creditos, descargas y albumes desde el espacio privado del cliente.`,
          body: `<h3>1. Sin paquete fisico</h3><p>${brand} no envia productos por correo postal. El set terminado, las descargas y los movimientos de creditos viven dentro de la cuenta privada.</p><h3>2. Donde llega el resultado</h3><p>Entra con el email usado al comprar o generar para abrir el album, revisar favoritos y descargar archivos disponibles.</p><h3>3. Plazos variables</h3><p>La entrega depende del volumen de cola, nitidez de selfies, numero de salidas y respuesta del proveedor de generacion.</p><h3>4. Si falta una imagen</h3><p>Escribe a <a href="mailto:${support}">${support}</a> con email de cuenta, paquete elegido y pedido para revisar el estado del set.</p>`
        }
      : {
          title: "Entrega digital",
          eyebrow: "Galerias de viaje digitales",
          intro: `${brand} entrega rutas visuales, creditos y galerias descargables sin envio fisico.`,
          body: `<h3>1. Entrega online</h3><p>${brand} no gestiona envio postal. Cada retrato de viaje, reserva de creditos y archivo final queda asociado a la cuenta iniciada.</p><h3>2. Acceso a la ruta</h3><p>Usa el mismo correo para revisar escena, destino, progreso, resultados y descargas dentro de la galeria privada.</p><h3>3. Ritmo de produccion</h3><p>El tiempo puede cambiar por cola tecnica, detalle de la ruta, calidad de fotos fuente, cantidad de imagenes y revisiones automaticas.</p><h3>4. Soporte de entrega</h3><p>Si una ruta no aparece, escribe a <a href="mailto:${support}">${support}</a> con email de cuenta, nombre de paquete y contexto del destino.</p>`
        }
  };
  return copies[kind] ?? generic;
}

function patchPolicyPage(next, slug, spec) {
  const kind = policyKindForSlug(slug);
  if (!kind) return;
  const copy = policyCopyForKind(kind, spec);
  for (const section of Object.values(next.sections ?? {})) {
    if (!section || typeof section !== "object") continue;
    if (["policy_content", "rich_text", "footer"].includes(section.type)) {
      section.settings = {
        ...(section.settings ?? {}),
        eyebrow: copy.eyebrow,
        title: copy.title,
        subtitle: copy.intro,
        body: section.type === "policy_content" ? copy.body : copy.intro,
        lastUpdated: "9 de julio de 2026",
        contactEmail: spec.supportEmail
      };
    }
  }
}

const spanishVideoTopicNames = {
  "brand-video": "vídeos de marca",
  "cinematic-video": "vídeos cinematográficos",
  "explainer-video": "vídeos explicativos",
  "fashion-video": "vídeos de moda",
  "food-video": "vídeos gastronómicos",
  "how-to-video": "vídeos tutoriales",
  "instagram-reels": "Reels para Instagram",
  "meme-video": "vídeos de memes",
  "motion-generator": "generadores de movimiento",
  "music-video": "vídeos musicales",
  "pet-video": "vídeos de mascotas",
  "product-ad-video": "anuncios de productos",
  "product-video": "vídeos de productos",
  "promo-video": "vídeos promocionales",
  "social-media-video": "vídeos para redes sociales",
  "story-video": "vídeos narrativos",
  "talking-head-video": "vídeos con presentador",
  "talking-photo": "fotos parlantes",
  "tiktok-video": "vídeos para TikTok",
  "ugc-ad-video": "anuncios UGC",
  "video-ad": "anuncios de vídeo",
  "youtube-video": "vídeos para YouTube"
};

const spanishSaveTheDateNames = {
  christmas: "Navidad",
  easter: "Pascua",
  engagement: "compromiso",
  "fathers-day": "Día del Padre",
  halloween: "Halloween",
  "mothers-day": "Día de la Madre",
  "new-year": "Año Nuevo",
  proposal: "propuesta",
  "save-the-date": "Guardar la fecha",
  thanksgiving: "Acción de Gracias",
  "valentines-day": "San Valentín",
  "wedding-anniversary": "aniversario de boda",
  "wedding-ceremony": "ceremonia de boda"
};

function spanishVideoTopicName(slug) {
  return spanishVideoTopicNames[String(slug).split("/").pop()] ?? "vídeos con IA";
}

function spanishSaveTheDateName(slug) {
  return spanishSaveTheDateNames[String(slug).split("/").pop()] ?? "Guardar la fecha";
}

function targetSeoForSlug(slug, spec) {
  const base = seoForSlug(slug, spec);
  if (spec.sourceSiteId !== "site_dreamshoot") return base;
  const collectionTopicLabels = {
    headshot: "Retratos profesionales",
    professional: "Retratos profesionales",
    avatar: "Avatares con IA",
    beauty: "Retratos de belleza",
    creative: "Retratos creativos",
    "gala-photos": "Fotos de gala",
    "black-friday": "Fotos de Black Friday",
    "only-fans": "Fotos para creadores",
    "world-cup-fan-photos": "Fotos de hincha",
    "ai-video-add-ons": "Complementos de vídeo con IA",
    seasonal: "Fotos de temporada"
  };
  if (slug === "/ai-image-generation" || slug === "/collections") {
    return {
      ...base,
      title: `Generadores de fotos con IA | ${spec.readableBrand}`,
      description: `Explora paquetes de retratos profesionales, pareja, belleza, creador, deporte y álbumes privados con créditos visibles en ${spec.readableBrand}.`,
      keywords: `generadores de fotos con IA,paquetes de fotos IA,retratos profesionales,álbum privado,${spec.readableBrand}`,
      canonicalPath: "/collections"
    };
  }
  if (slug.startsWith("/ai-image-generation/") || slug.startsWith("/collections/")) {
    const rawTopic = slug.split("/").filter(Boolean).at(-1) ?? "fotos";
    const topic = collectionTopicLabels[rawTopic] ?? spanishResidualFallback("title", slug, spec);
    return {
      ...base,
      title: `${topic} con IA | ${spec.readableBrand}`,
      description: `Crea ${topic.toLowerCase()} desde tus fotos, revisa los créditos antes de generar y guarda el resultado en un álbum privado.`,
      keywords: `${topic.toLowerCase()},fotos con IA,paquetes privados,${spec.readableBrand}`,
      canonicalPath: `/collections/${rawTopic}`
    };
  }
  if (slug === "/ai-video-generation") {
    return {
      ...base,
      title: `Generadores de vídeo con IA | ${spec.readableBrand}`,
      description: `Explora temas públicos de vídeo con IA, revisa los créditos y abre la guía de estilo que quieras en ${spec.readableBrand}.`,
      keywords: `generadores de vídeo con IA,temas de vídeo IA,vídeos privados,${spec.readableBrand}`
    };
  }
  if (slug.startsWith("/ai-video-generation/")) {
    const topic = spanishVideoTopicName(slug);
    return {
      ...base,
      title: `${topic.charAt(0).toUpperCase()}${topic.slice(1)} con IA | ${spec.readableBrand}`,
      description: `Crea ${topic} desde tus fotos, revisa los créditos antes de generar y guarda el resultado en una galería privada de ${spec.readableBrand}.`,
      keywords: `${topic},vídeos con IA,generación de vídeo,galería privada,${spec.readableBrand}`
    };
  }
  if (slug.startsWith("/ai-save-the-date/")) {
    const occasion = spanishSaveTheDateName(slug);
    return {
      ...base,
      title: `${occasion.charAt(0).toUpperCase()}${occasion.slice(1)}: fotos y vídeos con IA | ${spec.readableBrand}`,
      description: `Crea fotos y vídeos de ${occasion.toLowerCase()} con IA, revisa los créditos y conserva el resultado en un espacio privado.`,
      keywords: `${occasion},guardar la fecha,fotos con IA,vídeos con IA,${spec.readableBrand}`
    };
  }
  const fixed = {
    "/pricing": ["Precios de fotos y vídeos con IA | AIdreamshoots", "Compara planes de créditos para retratos, vídeos, perfiles, pareja, creador y álbumes privados."] ,
    "/about-us": ["Sobre AIdreamshoots", "Conoce AIdreamshoots, un estudio privado para crear retratos, vídeos y álbumes con IA desde tus fotos."],
    "/best-ai-image": ["Mejores generadores de fotos con IA | AIdreamshoots", "Compara ideas de retratos, perfiles, belleza y estilos de fotos con IA para elegir tu próximo conjunto privado."],
    "/best-ai-video": ["Mejores generadores de vídeo con IA | AIdreamshoots", "Explora estilos de vídeo con IA para convertir tus fotos en clips privados, claros y fáciles de revisar."],
    "/best-packages": ["Mejores paquetes de fotos con IA | AIdreamshoots", "Elige paquetes de retratos, perfiles, pareja, creador y álbumes privados con créditos visibles."],
    "/best-save-the-date": ["Mejores vídeos para guardar la fecha | AIdreamshoots", "Explora temas para crear vídeos de compromiso, boda y celebraciones con tus propias fotos."],
    "/blog": ["Guías para crear mejores fotos con IA | AIdreamshoots", "Aprende a preparar fotos fuente, elegir paquetes, revisar créditos y guardar resultados en álbumes privados."],
    "/creators-circle": ["Círculo de creadores | AIdreamshoots", "Descubre cómo los creadores pueden preparar experiencias de fotos con IA para sus comunidades y clientes."],
    "/digital-delivery": ["Política de entrega digital | AIdreamshoots", "Consulta cómo AIdreamshoots entrega conjuntos, vídeos, créditos y álbumes dentro de tu cuenta privada."],
    "/faq": ["Preguntas frecuentes sobre fotos con IA | AIdreamshoots", "Respuestas sobre fotos fuente, paquetes, créditos, pagos, privacidad, reintentos y álbumes privados."],
    "/help": ["Centro de ayuda | AIdreamshoots", "Encuentra respuestas sobre fotos fuente, paquetes, créditos, pagos, privacidad y entrega privada."],
    "/tools": ["Herramientas de fotos y vídeo con IA | AIdreamshoots", "Elige una herramienta para preparar fotos, crear vídeos y revisar créditos antes de generar."],
    "/workflow": ["Cómo funciona AIdreamshoots", "Sube fotos autorizadas, elige un paquete, revisa el coste en créditos y descarga tus resultados privados."],
    "/404": ["Página no encontrada | AIdreamshoots", "La página que buscas no está disponible. Vuelve al inicio para explorar paquetes y herramientas."],
    "/state-privacy": ["Aviso de privacidad estatal | AIdreamshoots", "Consulta el aviso de privacidad aplicable a tu cuenta de AIdreamshoots."],
    "/policies/state-privacy": ["Aviso de privacidad estatal | AIdreamshoots", "Consulta el aviso de privacidad aplicable a tu cuenta de AIdreamshoots."]
  }[slug];
  return fixed ? { ...base, title: fixed[0], description: fixed[1], keywords: `${fixed[0].replace(/\|.*/, "")},fotos con IA,${spec.readableBrand}` } : base;
}

function targetPageTitleForSlug(slug, spec, fallback) {
  return fallback;
}

function spanishResidualFallback(key, slug, spec) {
  if (slug.startsWith("/ai-video-generation/")) {
    const topic = spanishVideoTopicName(slug);
    if (/question/i.test(key)) return `¿Cómo funciona ${topic} con IA?`;
    if (/answer|body|description|intro|subtitle|exampleBody|noteBody/i.test(key)) return `Crea ${topic} desde tus fotos, revisa los créditos y guarda el resultado en una galería privada de ${spec.readableBrand}.`;
    if (/title|headline|heroTitle/i.test(key)) return `Ideas para ${topic} con IA`;
    if (/eyebrow|label|meta/i.test(key)) return "Vídeo con IA";
    if (/cta/i.test(key)) return "Crear vídeo";
    if (/alt/i.test(key)) return `Ejemplo de ${topic} creado con IA`;
  }
  if (slug.startsWith("/ai-save-the-date/")) {
    const occasion = spanishSaveTheDateName(slug);
    if (/question/i.test(key)) return `¿Cómo crear contenido de ${occasion.toLowerCase()} con IA?`;
    if (/answer|body|description|intro|subtitle|exampleBody|noteBody/i.test(key)) return `Crea fotos y vídeos de ${occasion.toLowerCase()} con tus propias imágenes, revisa cada detalle y comparte el resultado cuando esté listo.`;
    if (/title|headline|heroTitle/i.test(key)) return `Ideas de ${occasion.toLowerCase()} con IA`;
    if (/eyebrow|label|meta/i.test(key)) return "Guardar la fecha con IA";
    if (/cta/i.test(key)) return "Crear ahora";
    if (/alt/i.test(key)) return `Ejemplo de ${occasion.toLowerCase()} creado con IA`;
  }
  const common = {
    "/about-us": { title: "Sobre AIdreamshoots", body: "AIdreamshoots convierte tus fotos en retratos, vídeos y álbumes privados con IA.", eyebrow: "Sobre AIdreamshoots" },
    "/faq": { title: "Preguntas frecuentes", body: "Encuentra respuestas sobre fotos fuente, paquetes, créditos, pagos, privacidad y entrega privada.", eyebrow: "Ayuda" },
    "/help": { title: "Centro de ayuda", body: "Encuentra respuestas sobre fotos fuente, paquetes, créditos, pagos, privacidad y entrega privada.", eyebrow: "Ayuda" },
    "/workflow": { title: "Cómo funciona AIdreamshoots", body: "Sube fotos autorizadas, elige un paquete, revisa los créditos y guarda los resultados en tu álbum privado.", eyebrow: "Cómo funciona" },
    "/best-ai-image": { title: "Mejores fotos con IA", body: "Explora retratos, perfiles, belleza y estilos de fotos con IA.", eyebrow: "Fotos con IA" },
    "/best-ai-video": { title: "Mejores vídeos con IA", body: "Explora estilos de vídeo con IA para convertir tus fotos en clips privados.", eyebrow: "Vídeos con IA" },
    "/best-packages": { title: "Mejores paquetes de fotos con IA", body: "Elige paquetes privados para perfiles, pareja, creador, belleza y álbumes.", eyebrow: "Paquetes de fotos con IA" },
    "/blog": { title: "Guías de fotos con IA", body: "Aprende a preparar fotos fuente, elegir paquetes y revisar tus resultados privados.", eyebrow: "Guías" },
    "/creators-circle": { title: "Círculo de creadores", body: "Prepara experiencias de fotos con IA para tu comunidad y tus clientes.", eyebrow: "Creadores" },
    "/tools": { title: "Herramientas de fotos con IA", body: "Elige una herramienta, revisa el coste y crea resultados privados.", eyebrow: "Herramientas" },
    "/digital-delivery": { title: "Política de entrega digital", body: "Tus conjuntos, vídeos, créditos y álbumes se entregan dentro de tu cuenta privada.", eyebrow: "Entrega digital" }
  }[slug];
  if (common) return /title|headline|heroTitle/i.test(key) ? common.title : /eyebrow|label|meta/i.test(key) ? common.eyebrow : common.body;
  return "Contenido de AIdreamshoots";
}

function patchSpanishTargetPageCopy(next, slug, spec) {
  if (spec.sourceSiteId !== "site_dreamshoot") return next;
  // Public page content is a translated source document. Keep every
  // scenario-specific field from that document; policy-specific copy is
  // handled by patchPolicyPage before this boundary.
  next.seo = targetSeoForSlug(slug, spec);
  return next;
}

// Some older target page records were produced by a partial translation pass:
// they contain Spanish grammar with English nouns and fragments such as
// "Contact us sobre la Creadors Circle". That copy is still public even when
// the page title and SEO fields look correct. Keep this final repair scoped to
// the Spanish target and to public copy fields; IDs, URLs, slugs, asset paths,
// prompts, and generation parameters remain untouched.
const targetSpanishCopyEnglishPattern =
  /\b(?:the|and|with|from|your|you|choose|upload|review|before|after|private|source|account|customer|workspace|pricing|checkout|download|view|start|support|privacy|terms|help|create|credits|gallery|live|packs|warm|festive|seasonal|styling|snowy|winter|framing|group|tool|tools|photo|photos|portrait|portraits|image|images|works|working|ready|content|team|page|studio|day|easy|wanted|looks|look|different|useful|posted|same|week|company|address|website|email|announcement|story|stories|both|polished|sequence|future|proposal|contact|circle|creators|creator|short-form|reels|shorts|carousel|demonstrate|newsletter|owners|photographers|consultants|performance|partners|match|learn|launch|rules|full|name|tell|publish|cadence|promote|confirm|respect|platform|follow|billing|order|payment|reference|answered|used|happened|whether|missing|delayed|clearly|include|relevant|transaction|involved|details|issue|resolution|operator|organized|operating|focus|shapes|product|projects|transformations|files|available|through|generation|generating|export|format|layout|crop|requires|verify|verified|accurate|share|event|scene|visual|directly|next|steps|step|plan|planned|input|outputs|production|planning|included|what|why|how|can|make|should|only|each|every|into|around|instead|rather|more|gather|film|crew|lookbook|runway|cooking|plating|culinary|process|editorial|campaign|channel|audience|apply|application|earn|actually|delivery|notice|state|frequently|asked|operated|guided|explore|training|credit|fits|subscribe|something|creation|personalized|themed|space|workflows|workflow|flow|digital|results|started|hold|between|blank|means|moving|disconnected|unclear|costs|final|need|needs|real|occasion|give|path|technology|policy|encryption|rest|transit|like|under|aspect|specific|offer|lakeside|sunset|presenting|newly|engaged|smiling|together|rooftop|garden|partner|visible|holding|flowers|showing|surprise|framed|mountains|golden|hour|ring-reveal|identity|joined|outdoors|beach|sparklers|replace|typography|testimonials|become|reuse|helps|know|arrive|finished|earrings|clothing|fasteners|close|another|person|facts|editable|landscape|vertical|square|variations|destination|candles|an|a|is|are|was|were|has|have|will|does|not|who|which|when|where|must|may|might|our|their|their|own|away|edge|edges|remain|possible|clear|clean|all|one|two|sequence|sequences|correct|correctly|check|checking|publish|publishing|replace|write|written|read|reading|send|sends|follow|follows|works|working|keep|keeps|inside|outside|over|under|without|within|across|between|through|toward|towards|against|during|while|such|than|then|also|just|only|very|more|most|less|least|same|different|strong|soft|hard|high|low|quality|safe|safety|responsible|rights|permission|license|licensed|owner|owners|control|controlled|use|uses|using|used|make|makes|made|build|builds|built|turn|turns|turned|tell|tells|told|show|shows|shown|share|shared|sharing|download|downloads|uploaded|uploading|generation|generated|generators|generator|video|videos|image|images|photo|photos|family|families|friends|friend|couple|couples|man|woman|children|child|father|mother|home|house|city|street|road|mountain|lake|river|sea|beach|garden|forest|room|office|studio|camera|light|lighting|color|colors|black|white|blue|green|red|yellow|dress|shirt|jacket|ring|rings|gift|gifts|food|table|dinner|breakfast|coffee|phone|screen|card|cards|poster|posters|profile|profiles|social|media|short|long|wide|narrow|close-up|wide-angle|camera-facing|direct-to-camera|voiceover|sound|music|rhythm|timing|hook|hooks|opening|close|closing|ending|beginning|middle|part|parts|section|sections|title|titles|description|descriptions|body|bodies|intro|intros|subtitle|subtitles|question|questions|answer|answers|label|labels|caption|captions|alt|alternate|primary|secondary|button|buttons|link|links|note|notes|tip|tips|example|examples|idea|ideas|direction|directions|style|styles|theme|themes|topic|topics|topics|category|categories|tag|tags|values|value|reason|reasons|benefit|benefits|feature|features|included|include|includes|cost|costs|price|prices|plan|plans|monthly|quarterly|yearly|annual|month|months|year|years|credits|credit|amount|total|trial|free|paid|popular|value|select|selected|selection|choose|choice|start|started|starting|begin|begins|continue|continued|back|next|previous|open|opens|close|closed|return|returns|home|about|contact|privacy|policy|policies|terms|service|services|refund|refunds|cookie|cookies|delivery|shipping|digital|help|faq|frequently|asked|support|search|cart|login|logout|sign|signed|in|out|email|password|name|full|address|company|operator|founder|team|community|creator|creators|partner|partners|campaign|campaigns|channel|channels|audience|customer|customers|client|clients|followers|members|group|groups|newsletter|photographer|photographers|consultant|consultants|performance|growth|assets|resource|resources|trust|match|learn|lesson|launch|launches|apply|application|submit|submission|promote|promotion|rules|respect|platform|platforms|disclose|disclosure|appropriate|collecting|outside|specific|offer|offers|path|route|routes|sends|sent|issue|issues|resolution|resolved|billing|order|orders|payment|payments|reference|references|transaction|transactions|happened|missing|delayed|different|expected|expect|expects|follow-up|clear|clearly|relevant|relevance|details|detail|describe|describes|description|involved|page|pages|area|areas|workflow|workflows|flow|flows|generation|generating|generated|output|outputs|result|results|finished|finish|final|complete|completed|review|reviews|revisar|check|verify|verified|accurate|accuracy|publish|publishing|share|sharing|event|events|moment|moments|occasion|occasions|announcement|announcements|invite|invitation|invitations|save|date|proposal|engagement|wedding|ceremony|birthday|holiday|halloween|christmas|thanksgiving|valentines|mother|mothers|father|fathers|new|year|easter|anniversary|lakeside|sunset|sunrises|presenting|newly|engaged|smiling|together|rooftop|garden|partner|partners|visible|holding|flowers|showing|surprise|framed|mountains|golden|hour|ring|rings|identity|identities|joined|outdoors|beach|sparklers|earrings|clothing|fasteners|facts|editable|landscape|vertical|square|variations|candles|become|reuse|helps|know|arrive|finished|another|person|people|use|uses|using|used|make|makes|made|build|builds|built|turn|turns|turned|tell|tells|told|show|shows|shown|read|reading|write|written|send|sends|follow|follows|keep|keeps|inside|outside|over|under|without|within|across|between|through|toward|towards|against|during|while|such|than|then|also|just|very|most|less|least|strong|soft|hard|high|low|quality|safe|safety|responsible|rights|permission|license|licensed|owner|owners|control|controlled|camera|lighting|colors|dress|shirt|jacket|gift|gifts|food|table|dinner|breakfast|coffee|phone|screen|card|cards|poster|posters|profile|profiles|social|media|short|long|wide|narrow|voiceover|sound|music|rhythm|timing|hook|hooks|opening|closing|ending|beginning|middle|section|sections|primary|secondary|button|buttons|link|links|note|notes|tip|tips|example|examples|idea|ideas|direction|directions|style|styles|theme|themes|topic|topics|category|categories|tag|tags|values|value|reason|reasons|benefit|benefits|feature|features|price|prices|plan|plans|monthly|quarterly|yearly|annual|trial|free|paid|popular|select|selected|selection|choice|continue|continued|back|previous|open|opens|close|closed|return|returns|home|about|contact|privacy|policy|policies|terms|service|services|refund|refunds|cookie|cookies|delivery|shipping|digital|help|faq|search|cart|login|logout|sign|signed|email|password|full|address|company|operator|founder|team|community|followers|members)\b/i;

const targetSpanishCopyEnglishPatternSafe =
  /\b(?:the|and|with|from|your|you|choose|upload|review|before|after|private|source|account|customer|workspace|pricing|checkout|download|view|start|support|privacy|terms|help|create|credits|gallery|live|packs|seasonal|styling|winter|framing|group|tool|tools|photo|photos|portrait|portraits|image|images|works|working|ready|content|team|page|studio|day|easy|wanted|looks|look|different|useful|company|address|website|email|announcement|story|stories|both|polished|sequence|future|proposal|contact|circle|creators|creator|short-form|reels|shorts|carousel|demonstrate|newsletter|owners|photographers|consultants|performance|partners|match|learn|launch|rules|full|name|tell|publish|cadence|promote|confirm|respect|platform|follow|billing|order|payment|reference|answered|used|happened|whether|missing|delayed|clearly|include|relevant|transaction|involved|details|issue|resolution|operator|organized|operating|focus|shapes|product|projects|transformations|files|available|through|generation|generating|export|format|layout|crop|requires|verify|verified|accurate|share|event|scene|visual|directly|next|steps|step|plan|planned|input|outputs|production|planning|included|what|why|how|can|make|should|only|each|every|into|around|instead|rather|more|gather|film|crew|process|editorial|campaign|channel|audience|apply|application|delivery|notice|state|frequently|asked|operated|guided|explore|training|credit|fits|subscribe|something|creation|personalized|themed|space|workflows|workflow|flow|digital|results|started|hold|held|between|blank|means|moving|disconnected|unclear|costs|final|need|needs|real|occasion|give|path|technology|policy|encryption|rest|transit|like|under|aspect|specific|offer|lakeside|sunset|presenting|newly|engaged|smiling|together|rooftop|garden|partner|visible|holding|flowers|showing|surprise|framed|mountains|golden|hour|ring-reveal|identity|joined|outdoors|beach|sparklers|become|reuse|helps|know|arrive|finished|earrings|clothing|fasteners|close|another|person|people|facts|editable|landscape|vertical|square|variations|destination|candles|is|are|was|were|has|have|will|does|not|who|which|when|where|must|may|might|our|their|own|away|edge|edges|remain|possible|clear|clean|all|one|two|correct|check|checking|write|written|read|reading|send|sends|inside|outside|without|within|across|toward|against|during|while|such|than|then|also|very|most|less|strong|soft|hard|high|low|quality|safe|safety|responsible|rights|permission|license|licensed|owner|control|using|uses|make|makes|made|build|builds|built|turn|turns|turned|tell|tells|told|show|shows|shown|shared|sharing|uploaded|uploading|generator|generators|family|families|friends|friend|couple|couples|man|woman|children|child|father|mother|home|house|city|street|road|mountain|lake|river|sea|forest|room|office|camera|light|lighting|color|colors|black|white|blue|green|red|yellow|dress|shirt|jacket|gift|gifts|food|table|dinner|breakfast|coffee|phone|screen|card|cards|poster|posters|profile|profiles|social|media|short|long|wide|narrow|voiceover|sound|music|rhythm|timing|hook|hooks|opening|closing|ending|beginning|middle|part|parts|section|sections|title|titles|description|descriptions|body|intro|subtitle|subtitles|question|questions|answer|answers|label|labels|caption|captions|alt|primary|secondary|button|buttons|link|links|note|notes|tip|tips|example|examples|idea|ideas|direction|directions|style|styles|theme|themes|topic|topics|category|categories|tag|tags|value|values|reason|reasons|benefit|benefits|feature|features|price|prices|plans|monthly|quarterly|yearly|annual|month|months|year|years|amount|total|trial|free|paid|popular|select|selected|selection|choice|continue|continued|back|previous|open|opens|closed|return|returns|about|refund|refunds|cookie|cookies|shipping|search|cart|login|logout|sign|signed|email|password|founder|community|followers|members|submit|submission|promotion|disclose|disclosure|appropriate|collecting|outside|specific|offers|sent|issues|resolved|expected|expects|follow-up|describe|describes|involved|area|areas|output|result|finish|complete|completed|reviews|accuracy|events|moments|invite|invitation|invitations|save|date|proposal|engagement|wedding|ceremony|birthday|holiday|halloween|christmas|thanksgiving|valentines|mothers|fathers|new|year|easter|anniversary|sunrises|ring|rings|identities|replace|typography|testimonials)\b/i;

// A second, deliberately targeted list catches English fragments that were
// embedded in otherwise Spanish topic-page cards and image captions. Keep
// this separate so the broad legacy matcher above remains auditable.
const targetSpanishCopyEnglishPatternAdditional =
  /\b(?:treat|human|venue|happy|grooming|material|behavior|behaviour|detail|craftsperson|place|proof|meaning|expectation|qualified|reaction|twist|optional|natural|six|right|joke|quote|separate|shoot|would|slow|wider|era|collaboration|energy|workplace|culture|meme|reply|deadpan|pov|customer|spokesperson|speaker|testimonial|urgency|scarcity|relationship-led|establishes|personality|emotional|role|introduction|launch|reused|everywhere|key|caption|replying|sure|request|revision|scene|references|generated|features|states|inventing|interface|campaign|variants|routine|full|love|polished|verify|name|venue|link|permission|futuristic|world|scale|imagination|stillness|expressive|historic|textures|aloud|voices|thank|being|needed|forget|viewers|leaving|first|seconds|whole|video|subscription|tasteful|content-safe|consenting|adults|written|safe|edits|changes|adjustments|variations|soft|editorial|elegant|styling|boudoir|instrucciones)\b/i;

const targetSpanishCopyExactTranslations = new Map([
  ["Ideas de fotos y vídeos con IA con IA", "Ideas de fotos y vídeos con IA"],
  ["Crear creador subscription perfil fotos, tasteful promocional retratos, bio imágenes, y privado content-safe visual conjuntos para consenting adults.", "Crea fotos de perfil y promocionales para creadores, con retratos cuidados, biografías visuales y conjuntos privados para adultos con consentimiento."],
  ["Crear tasteful privado boudoir-inspired retratos con soft editorial luz, elegant styling, y consent-first revisa.", "Crea retratos boudoir privados con luz editorial suave, estilo elegante y revisión centrada en el consentimiento."],
  ["usa un written instrucciones para solicitud safe foto edits, escena changes, estilo adjustments, y privado imagen variations.", "Usa instrucciones escritas para solicitar ediciones seguras de fotos, cambios de escena, ajustes de estilo y variaciones privadas de imagen."],
  ["Customer media is not used to train models.", "Las fotos de clientes no se utilizan para entrenar modelos."],
  ["Listo para probar la AIdreamshoots's mejores IA Maker?", "¿Listo para probar los mejores generadores de IA de AIdreamshoots?"],
  ["Company", "Empresa"],
  ["Address", "Dirección"],
  ["Operator", "Operador"],
  ["Company address", "Dirección de la empresa"],
  ["Published business correspondence address.", "Dirección de correspondencia publicada de la empresa."],
  ["Creators Circle", "Círculo de creadores"],
  ["Creator Circle", "Círculo de creadores"],
  ["Contact us", "Contacto"],
  ["Contact Us", "Contacto"],
  ["Contact us about the Creators Circle", "Contacta con el Círculo de creadores"],
  ["Email partnership details", "Detalles de la colaboración por correo"],
  ["Back to Creators Circle", "Volver al Círculo de creadores"],
  ["Short-form creators", "Creadores de contenido corto"],
  ["Newsletter and group owners", "Responsables de boletines y comunidades"],
  ["Photographers and consultants", "Fotógrafos y consultores"],
  ["Performance partners", "Colaboradores de campañas"],
  ["Full name", "Nombre completo"],
  ["Website", "Sitio web"],
  ["Trust", "Confianza"],
  ["Assets", "Recursos"],
  ["Growth", "Crecimiento"],
  ["Match", "Encaje"],
  ["Learn", "Aprende"],
  ["Rules", "Reglas"],
  ["Operator", "Operador"],
  ["What's included", "Qué incluye"],
  ["Production planning", "Planificación de producción"],
  ["Privacy and disclosure", "Privacidad y divulgación"],
  ["A testable plan", "Un plan que se pueda probar"],
  ["Before you submit", "Antes de enviar"],
  ["What we look for in partner channels.", "Qué buscamos en los canales de colaboradores."],
  ["Email", "Correo electrónico"],
  ["Support", "Soporte"],
  ["Content", "Contenido"],
  ["Shorts", "vídeos cortos"],
  ["Reels, TikTok, Shorts, and carousel creators who can demonstrate package ideas clearly.", "Creadores de Reels, TikTok, vídeos cortos y carruseles que puedan mostrar con claridad las ideas de los paquetes."],
  ["Followers sign in, upload, pay, generate, and download inside AIdreamshoots, so you promote the experience without handling personal photos.", "Tus seguidores inician sesión, suben fotos, pagan, generan y descargan dentro de AIdreamshoots; tú promocionas la experiencia sin gestionar fotos personales."],
  ["Partners must disclose AI use where appropriate and avoid collecting customer uploads outside AIdreamshoots.", "Los colaboradores deben informar del uso de IA cuando corresponda y evitar recopilar fotos de clientes fuera de AIdreamshoots."],
  ["Contact us over email", "Contacta por correo electrónico"],
  ["Privacy and disclosure", "Privacidad y divulgación"],
  ["Training política", "Política de entrenamiento"],
  ["Subidas, solicitudes, credit revisa, y galerías stay dentro tu signed-in cuenta.", "Las subidas, solicitudes, revisiones de créditos y galerías permanecen dentro de tu cuenta con la sesión iniciada."],
  ["Secure cuenta flujo", "Flujo seguro de cuenta"],
  ["por qué personas subscribe", "por qué suscribirse"],
  ["quién fits", "para quién es"],
  ["Explora foto paquetes", "Explora paquetes de fotos"],
  ["Privado cliente flow", "Flujo privado de cliente"],
  ["contenido angles incluido", "Ideas de contenido incluidas"],
  ["Room para paid channels", "Espacio para canales de pago"],
  ["publicar con un partner route ese sends clientes para AIdreamshoots paquetes, precios, o un specific offer.", "Publica una ruta de colaboración que dirija a tus clientes a los paquetes, precios u ofertas concretas de AIdreamshoots."],
  ["qué we aspecto para en partner channels.", "Qué buscamos en los canales de colaboradores."],
  ["antes tú submit", "antes de enviar"],
  ["Ayudaful creativo encuadre", "Encuadre creativo útil"],
  ["listo para crear something desde tu fotos?", "¿Listo para crear algo con tus fotos?"],
  ["IA imagen + vídeo CREATION", "CREACIÓN DE IMÁGENES Y VÍDEOS CON IA"],
  ["Crear IA imágenes, vídeo con IAs, personalized guardar la fecha vídeos, y themed foto paquetes en uno privado espacio.", "Crea imágenes y vídeos con IA, vídeos personalizados para guardar la fecha y paquetes de fotos temáticos en un espacio privado."],
  ["Privado digital resultados", "Resultados digitales privados"],
  ["Privado cliente espacio", "Espacio privado del cliente"],
  ["Workflows", "Flujos de trabajo"],
  ["Entregay", "Entrega"],
  ["No IA training en tu fotos", "Tus fotos no se usan para entrenar modelos de IA"],
  ["30-dia auto-delete", "Eliminación automática en 30 días"],
  ["We started con la fotos personas ya tiene.", "Empezamos con las fotos que ya tienes."],
  ["Crear para un real occasion", "Crear para una ocasión real"],
  ["Visible créditos, un privado espacio, y entrega digital give clientes un claro path desde sube y generación para revisa y descargar.", "Los créditos visibles, el espacio privado y la entrega digital ofrecen a los clientes un camino claro desde la subida y la generación hasta la revisión y la descarga."],
  ["la fundador detrás la producto y its dirección.", "La persona fundadora detrás del producto y de su dirección."],
  ["Announce la milestone antes designing la invitación.", "Anuncia el momento importante antes de diseñar la invitación."],
  ["qué la flujo creates", "Qué crea este flujo"],
  ["cómo compromiso Announcements Differ desde Other boda momentos", "En qué se diferencian los anuncios de compromiso de otros momentos de boda"],
  ["Pre-publish revisa", "Revisión antes de publicar"],
  ["Replace generado texto con real editable typography.", "Sustituye el texto generado por tipografía editable y real."]
  , ["un claro path desde question para resolution.", "Un camino claro desde la pregunta hasta la solución."]
  , ["compromiso Announcement", "Anuncio de compromiso"]
  , ["redes & boda Website", "Redes y sitio web de boda"]
  , ["Training política", "Política de entrenamiento"]
  , ["credit revisa", "revisión de créditos"]
  , ["plan uno polished historia para tu boda website, email, mensajes, y redes publicaciones. antes publicar, verify cada name, fecha, venue detail, link, música right, y retrato permiso.", "Planifica una historia cuidada para tu boda en el sitio web, el correo, los mensajes y las redes. Antes de publicar, verifica cada nombre, fecha, lugar, enlace, música y permiso de retrato."]
  , ["Venue establishing plano — orient viewers antes people-focused escenas.", "Plano general del lugar para orientar al público antes de las escenas centradas en las personas."]
  , ["AI-GENERATED escena REFERENCES", "Referencias de escenas generadas con IA"]
  , ["mostrar features, workflows, states, y valor sin inventing UI behavior.", "Muestra funciones, flujos, estados y valor sin inventar comportamientos de la interfaz."]
  , ["Campaign variants", "Variantes de campaña"]
  , ["la offer es sólido, but urgency overwhelms la producto valor o la terms hijo too vague.", "La oferta es sólida, pero la urgencia eclipsa el valor del producto o las condiciones son demasiado vagas."]
  , ["Training & Routine", "Entrenamiento y rutina"]
  , ["un relationship-led retrato ese establishes personality, trust, human presence, y la emocional role de la plano.", "Un retrato centrado en la relación que transmite personalidad, confianza, presencia humana y el papel emocional de la escena."]
  , ["Happy birthday, Mia. I hope today feels easy, joyful, y full de la personas tú love.", "Feliz cumpleaños, Mia. Espero que hoy sea sencillo, alegre y esté lleno de las personas que quieres."]
  , ["Example script “Happy birthday, Mia. I hope today feels easy, joyful, y full de la personas tú love.”", "Guion de ejemplo: «Feliz cumpleaños, Mia. Espero que hoy sea sencillo, alegre y esté lleno de las personas que quieres». "]
  , ["Post-proposal celebración o redes announcement", "Celebración posterior a la propuesta o anuncio en redes"]
  , ["Share la announcement", "Comparte el anuncio"]
  , ["valentine's dia boda announcement", "anuncio de boda de San Valentín"]
  , ["la same creativo es reused everywhere y key producto detail, captions, o CTA texto become hard para lee.", "El mismo creativo se reutiliza en todas partes y los detalles del producto, los textos y las llamadas a la acción resultan difíciles de leer."]
  , ["un marca wants para participate en meme culture sin looking like un company forcing internet slang.", "Una marca quiere participar en la cultura de los memes sin parecer una empresa que fuerza la jerga de internet."]
  , ["un company update necesita un human entrega sin implying un unverified spokesperson relación.", "Una actualización de empresa necesita una entrega humana sin insinuar una relación con un portavoz no verificado."]
  , ["necesitar para say thank tú, congratulations, o I am thinking de tú,", "necesitar un vídeo para decir gracias, dar la enhorabuena o decir que piensas en alguien,"]
]);

const targetSpanishCopyMachineKeys = new Set([
  "id", "siteId", "sectionsOrder", "slug", "href", "primaryHref", "secondaryHref", "imageUrl", "videoUrl", "posterUrl",
  "storageKey", "canonicalPath", "routeKey", "type", "status", "pageType", "layout", "anchor", "contentKey", "kind", "src",
  "url", "className", "templateKey", "themeKey", "aiAppSlug", "categoryId", "parentId", "card_name", "ogImage", "originUrl",
  "previewUrl", "logoImageUrl", "source", "version", "sortOrder", "creditCost", "outputCount", "durationSeconds", "maxFrames",
  "generationCount", "conversionRate", "prompt", "filename", "sourceRevision", "pageKey", "requiredSections", "toolSlug", "collectionSlug", "productType", "themeTone", "focusKeyword"
]);

function targetSpanishTopicLabel(slug, spec) {
  if (slug.startsWith("/ai-video-generation/")) return spanishVideoTopicName(slug);
  if (slug.startsWith("/ai-save-the-date/")) return spanishSaveTheDateName(slug).toLowerCase();
  if (slug.startsWith("/ai-image-generation/") || slug.startsWith("/collections/")) {
    return spanishResidualFallback("title", slug, spec).replace(/^Contenido de /, "").toLowerCase();
  }
  return "fotos y vídeos con IA";
}

function targetSpanishFallbackCopy(key, slug, spec) {
  const topic = targetSpanishTopicLabel(slug, spec);
  const normalizedKey = String(key ?? "").toLowerCase();
  if (normalizedKey === "question") return `¿Cómo funciona ${topic} con IA?`;
  if (normalizedKey.includes("cta") || normalizedKey.includes("button") || normalizedKey.includes("primarylabel") || normalizedKey.includes("secondarylabel")) {
    return normalizedKey.includes("secondary") ? "Ver paquetes" : "Empezar a crear";
  }
  if (normalizedKey === "eyebrow" || normalizedKey === "label" || normalizedKey === "meta" || normalizedKey === "badge") return "Fotos y vídeos con IA";
  if (normalizedKey.includes("alt") || normalizedKey.includes("caption")) return `Ejemplo visual de ${topic} creado con IA.`;
  if (normalizedKey === "title" || normalizedKey.includes("headline") || normalizedKey.includes("heading")) return `Ideas de ${topic} con IA`;
  if (normalizedKey === "answer" || normalizedKey.includes("body") || normalizedKey.includes("description") || normalizedKey.includes("intro") || normalizedKey.includes("subtitle") || normalizedKey.includes("text") || normalizedKey.includes("paragraph")) {
    return `Crea ${topic} desde tus fotos, revisa los créditos antes de generar y guarda el resultado en una galería privada de ${spec.readableBrand}.`;
  }
  return `Usa fotos propias o autorizadas, revisa los detalles y conserva tus resultados de ${topic} en tu espacio privado.`;
}

function repairSpanishTargetVisibleCopy(value, slug, spec, key = "") {
  if (spec.sourceSiteId !== "site_dreamshoot") return value;
  if (Array.isArray(value)) return value.map((item) => repairSpanishTargetVisibleCopy(item, slug, spec, key));
  if (!value || typeof value !== "object") {
    if (typeof value !== "string" || targetSpanishCopyMachineKeys.has(key) || isFunctionalString(value)) return value;
    const exact = targetSpanishCopyExactTranslations.get(value.trim());
    if (exact) return exact;
    const polished = polishSpanishText(value);
    const englishHits = [
      ...(polished.match(targetSpanishCopyEnglishPatternSafe) ?? []),
      ...(polished.match(targetSpanishCopyEnglishPatternAdditional) ?? [])
    ];
    const visibleKey = visibleTextKeys.has(key) || visibleContainerKeys.has(key) || /(?:text|title|description|body|intro|subtitle|question|answer|label|name|meta|eyebrow|headline|caption|alt|chip|list|item|cta|placeholder|note|tip|process|heading|problem|solution|script|highlight|support|usage|role|content)/i.test(key);
    if (!visibleKey || englishHits.length === 0) return polished;
    return polished;
  }
  if (Array.isArray(value)) return value.map((item) => repairSpanishTargetVisibleCopy(item, slug, spec, key));
  return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
    childKey,
    repairSpanishTargetVisibleCopy(childValue, slug, spec, childKey)
  ]));
}

function repairSpanishPublicValue(value, slug, spec, key) {
  return repairSpanishTargetVisibleCopy(value, slug, spec, key);
}

function patchPageJson(pageJson, slug, spec) {
  slug = spanishPageSlug(slug);
  const next = clone(pageJson) ?? {};
  next.locale = "es-ES";
  return translateSourcePageJson(next, slug, spec);
  /* Legacy targeted copy overrides intentionally remain below for reference only. */
  if (slug === "/pricing") {
    patchSection(next, "pricing_intro_1", {
      eyebrow: copy?.eyebrow ?? "Precios",
      title: copy?.title ?? (my ? "Planes de creditos para paquetes de fotos con IA" : "Planes de creditos para retratos de viaje"),
      subtitle: copy?.subtitle ?? "Elige creditos mensuales o recargas puntuales. Los creditos se muestran antes de cada generacion.",
      body: copy?.body
    });
    patchSection(next, "pricing_1", {
      title: my ? "Tabla de planes de estudio" : "Tabla de creditos de ruta",
      subtitle: copy?.body,
      featuredBadgeLabel: my ? "Mas usado en perfiles" : "Mas usado en rutas"
    });
    patchSection(next, "plan_rules_1", {
      eyebrow: my ? "Reglas de uso" : "Reglas de ruta",
      title: my ? "Antes de generar un set." : "Antes de abrir una ruta.",
      body: copy?.body,
      primaryCta: my ? "Elegir plan de estudio" : "Elegir creditos de ruta"
    });
    patchSection(next, "faq_1", {
      title: my ? "Preguntas de creditos" : "Preguntas de ruta",
      eyebrow: copy?.eyebrow,
      subtitle: copy?.subtitle,
      journeyTitle: my ? "Del selfie al album" : "De la idea a la galeria",
      journeyTitles: my ? "Subir|Elegir paquete|Revisar saldo|Descargar" : "Subir|Elegir destino|Confirmar escena|Descargar",
      journeyDescriptions: my
        ? "Fotos claras y autorizadas.|Elige el tipo de set.|Comprueba creditos antes de generar.|Guarda tus favoritos."
        : "Retratos fuente nitidos.|Selecciona ruta visual.|Revisa creditos y salidas.|Recibe tu album privado."
    });
    patchSection(next, "conversion_1", {
      title: my ? "Listo para crear un set privado?" : "Listo para preparar una ruta?",
      subtitle: copy?.subtitle,
      primaryCta: my ? "Crear set privado" : "Abrir ruta privada",
      secondaryCta: my ? "Comparar planes" : "Ver paquetes de viaje"
    });
    patchSectionBlocks(next, "faq_1", faqBlocksForSlug(slug, spec));
    patchSectionBlocks(next, "plan_rules_1", ruleCardsForSlug(slug, spec));
    patchSectionBlocks(next, "trust_1", trustStatsForSlug(slug, spec));
  }
  if (slug === "/collections") {
    patchSection(next, "taxonomy_1", {
      eyebrow: my ? "Paquetes de fotos" : "Paquetes de viaje",
      title: my ? "Elige el paquete antes de generar." : "Elige una ruta visual antes de generar.",
      subtitle: my
        ? "Compara estilos, creditos, requisitos de fotos fuente y resultados esperados."
        : "Compara destinos, luz, estilo, creditos y entrega privada."
    });
    patchSection(next, "packages_1", {
      eyebrow: my ? "Catalogo" : "Rutas visuales",
      title: my ? "Paquetes privados para perfiles, pareja y creadores." : "Paquetes de retratos de viaje y destino."
    });
  }
  if (slug === "/tools") {
    patchSection(next, "free_tools_1", {
      eyebrow: "Herramientas",
      title: my ? "Herramientas de IA para editar, probar y crear fotos." : "Herramientas de IA para preparar retratos de viaje.",
      subtitle: my
        ? "Elige una herramienta de foto, confirma que tipo de resultado crea y sigue al album privado."
        : "Abre una herramienta de ruta, revisa ambiente y destino, y continua hacia la galeria privada."
    });
  }
  if (slug === "/login") {
    patchSection(next, "login_1", {
      eyebrow: copy?.eyebrow ?? "Acceso de cliente",
      title: copy?.title ?? `Inicia sesion para gestionar ${spec.readableBrand}.`,
      subtitle: copy?.subtitle ?? "Tus subidas, creditos, pedidos y albumes permanecen dentro de tu cuenta privada.",
      imageBadge: my ? "Selfies privados" : "Fotos de ruta",
      buttonLabel: "Iniciar sesion"
    });
    patchSection(next, "plan_rules_1", {
      eyebrow: my ? "Cuenta de estudio" : "Cuenta de viaje",
      title: copy?.title,
      body: copy?.body,
      primaryCta: "Iniciar sesion"
    });
    patchSectionBlocks(next, "login_1", my
      ? [
          { label: "Entrar con email", helper: "Acceso para continuar albumes, creditos y pedidos guardados." },
          { label: "Usar contrasena", helper: "Disponible para volver a tu galeria privada." }
        ]
      : [
          { label: "Entrar a la bitacora", helper: "Acceso rapido para rutas, escenas y galerias de viaje." },
          { label: "Usar email y clave", helper: "Mantiene pedidos de destino dentro de tu cuenta privada." }
        ]);
    patchSectionBlocks(next, "plan_rules_1", ruleCardsForSlug(slug, spec));
    patchSectionBlocks(next, "trust_1", trustStatsForSlug(slug, spec));
  }
  if (slug === "/app") {
    patchSection(next, "launcher_1", {
      eyebrow: "Espacio privado",
      title: my ? "Crea fotos privadas con IA desde tus subidas." : "Crea retratos de viaje desde tus subidas.",
      subtitle: "Prepara fotos fuente, elige un paquete, revisa creditos y sigue el progreso desde una sola cuenta."
    });
  }
  if (slug === "/about-us") {
    patchSection(next, "intro_1", {
      eyebrow: copy?.eyebrow ?? "Sobre nosotros",
      title: copy?.title ?? `Sobre ${spec.readableBrand}`,
      subtitle: copy?.subtitle,
      body: copy?.body ?? spec.description
    });
    patchSection(next, "content_1", {
      title: copy?.title ?? `Sobre ${spec.readableBrand}`,
      body: copy?.body ?? spec.description,
      lastUpdated: "9 de julio de 2026",
      contactEmail: spec.supportEmail
    });
  }
  if (slug === "/contact-us") {
    patchSection(next, "intro_1", {
      eyebrow: copy?.eyebrow ?? "Contacto",
      title: copy?.title ?? `Contacta con ${spec.readableBrand}`,
      subtitle: copy?.subtitle,
      body: copy?.body
    });
    patchSection(next, "content_1", {
      title: copy?.title ?? "Contacto",
      body: copy?.body ?? `Escribenos para soporte de cuenta, creditos, paquetes, privacidad o entrega de galerias.`,
      lastUpdated: "9 de julio de 2026",
      contactEmail: spec.supportEmail
    });
  }
  if (slug === "/faq") {
    patchSection(next, "intro_1", {
      eyebrow: copy?.eyebrow,
      title: copy?.title,
      subtitle: copy?.subtitle,
      body: copy?.body
    });
    patchSection(next, "faq_1", {
      title: my ? "Preguntas frecuentes de fotos IA" : "Preguntas frecuentes de rutas",
      eyebrow: copy?.eyebrow,
      subtitle: copy?.subtitle,
      journeyTitle: my ? "Ruta de soporte" : "Mapa de soporte",
      journeyTitles: my ? "Subir|Elegir paquete|Revisar creditos|Descargar" : "Subir|Elegir destino|Confirmar creditos|Recibir",
      journeyDescriptions: my
        ? "Prepara selfies claros.|Selecciona el set adecuado.|Comprueba saldo y estado.|Descarga favoritos."
        : "Prepara retratos claros.|Selecciona ambiente de viaje.|Confirma coste y salidas.|Recibe la galeria privada."
    });
    patchSection(next, "plan_rules_1", {
      eyebrow: my ? "Buenas practicas" : "Antes del viaje",
      title: my ? "Como evitar pedidos bloqueados." : "Como preparar una escena consistente.",
      body: copy?.body,
      primaryCta: my ? "Ver paquetes de fotos" : "Ver rutas visuales"
    });
    patchSectionBlocks(next, "faq_1", faqBlocksForSlug(slug, spec));
    patchSectionBlocks(next, "plan_rules_1", ruleCardsForSlug(slug, spec));
  }
  if (slug === "/blog") {
    patchSection(next, "blog_intro_1", {
      eyebrow: copy?.eyebrow,
      title: copy?.title,
      subtitle: copy?.subtitle,
      body: copy?.body
    });
    patchSection(next, "blog_list_1", {
      title: my ? "Guias de selfies y estilos" : "Notas de ruta y destino",
      body: copy?.body,
      guideType: my ? "Guia de fotos IA" : "Nota de viaje IA"
    });
    patchSection(next, "packages_strip_1", {
      eyebrow: my ? "Proceso de retrato" : "Proceso de ruta",
      title: my ? "De selfie a album privado." : "De destino a galeria privada.",
      subtitle: copy?.subtitle
    });
    patchSection(next, "conversion_1", {
      eyebrow: my ? "Estudio activo" : "Ruta activa",
      title: my ? "Convierte la guia en un set." : "Convierte la nota en una ruta.",
      subtitle: copy?.subtitle,
      primaryCta: my ? "Crear set privado" : "Crear ruta privada",
      secondaryCta: my ? "Ver paquetes" : "Ver paquetes de viaje"
    });
    patchSectionBlocks(next, "packages_strip_1", journeyCardsForSlug(slug, spec));
  }
  if (slug.includes("/blog/")) {
    patchSection(next, "blog_detail_1", {
      eyebrow: my ? "Guia de fotos IA" : "Nota de viaje IA",
      title: my ? "Como preparar fotos fuente para mejores retratos." : "Como preparar fotos fuente para una ruta visual.",
      subtitle: my
        ? "La calidad del set empieza antes de generar: luz clara, angulos variados y permiso de uso."
        : "La continuidad de una galeria de viaje empieza con retratos claros y una direccion de destino concreta.",
      body: my
        ? "Usa selfies recientes, nitidos y con luz natural. Evita filtros pesados, gafas oscuras, recortes extremos y fotos de grupo cuando quieras retratos profesionales, pareja o creador consistentes. Anade notas de vestuario, ambiente y uso final para que el album privado tenga una direccion clara."
        : "Usa retratos fuente nitidos y anade notas de destino, luz, clima, vestuario y ambiente. Una ruta visual funciona mejor cuando el pedido indica costa, casco antiguo, balcon, carretera, montana o postal, con creditos revisados antes de generar.",
      guideType: my ? "Guia de estudio" : "Nota de campo"
    });
    patchSection(next, "packages_strip_1", {
      eyebrow: my ? "Siguiente paso" : "Siguiente ruta",
      title: my ? "Convierte la guia en un set privado." : "Convierte la nota en una galeria de viaje.",
      subtitle: my
        ? "Elige un paquete, sube fotos fuente y revisa creditos antes de generar."
        : "Elige una ruta visual, sube retratos fuente y revisa creditos antes de generar."
    });
  }
  if (slug === "/cart") {
    patchSection(next, "cart_intro_1", {
      eyebrow: copy?.eyebrow,
      title: copy?.title,
      subtitle: copy?.subtitle,
      body: copy?.body
    });
    patchSection(next, "cart_1", {
      eyebrow: copy?.eyebrow,
      title: copy?.title,
      subtitle: copy?.subtitle,
      emptyTitle: my ? "Elige creditos de estudio" : "Elige creditos de ruta",
      emptyBody: my
        ? "Abre precios para seleccionar una suscripcion o recarga para tus proximos sets."
        : "Abre precios para seleccionar creditos antes de preparar una escena de destino.",
      returnLabel: "Volver a precios"
    });
    patchSection(next, "pricing_1", {
      title: my ? "Planes disponibles para fotos IA" : "Planes disponibles para rutas",
      subtitle: copy?.body,
      featuredBadgeLabel: my ? "Mas usado en perfiles" : "Mas usado en rutas"
    });
    patchSection(next, "plan_rules_1", {
      eyebrow: my ? "Antes de pagar" : "Antes de reservar",
      title: my ? "Comprueba saldo y paquete." : "Comprueba saldo y destino.",
      body: copy?.body,
      primaryCta: my ? "Elegir plan de estudio" : "Elegir plan de ruta"
    });
    patchSection(next, "conversion_1", {
      title: my ? "Preparado para crear?" : "Preparado para viajar en imagen?",
      subtitle: copy?.subtitle,
      primaryCta: my ? "Crear set privado" : "Crear ruta privada",
      secondaryCta: my ? "Comparar precios" : "Ver rutas"
    });
    patchSectionBlocks(next, "plan_rules_1", ruleCardsForSlug(slug, spec));
  }
  if (slug === "/search") {
    patchSection(next, "search_intro_1", {
      eyebrow: "Buscar",
      title: my ? "Busca paquetes, herramientas y guias de fotos IA." : "Busca rutas, herramientas y notas de viaje IA.",
      subtitle: my
        ? "Encuentra retratos profesionales, pareja, creador, fondos, planes de creditos, privacidad y soporte."
        : "Encuentra paquetes de costa, ciudad, ruta, herramientas de retrato, creditos, privacidad y soporte.",
      body: my
        ? "Busca paquetes de fotos IA, herramientas de edicion, planes, politicas, reembolsos y guias para preparar fotos fuente."
        : "Busca retratos de viaje, paquetes de destino, herramientas de ruta, precios, privacidad, reembolsos y guias para fotos fuente."
    });
    patchSection(next, "conversion_1", {
      eyebrow: my ? "Listo para crear" : "Listo para viajar",
      title: my ? "Abre un paquete privado desde la busqueda." : "Abre una ruta privada desde la busqueda.",
      subtitle: my ? "Revisa creditos antes de generar tu siguiente set." : "Revisa creditos antes de generar tu siguiente galeria.",
      primaryCta: my ? "Ver paquetes" : "Ver rutas",
      secondaryCta: "Ver precios"
    });
  }
  if (slug === "/404") {
    patchSection(next, "not_found_1", {
      eyebrow: "Pagina no encontrada",
      title: "No encontramos esta pagina.",
      subtitle: my
        ? "Vuelve a paquetes de fotos IA, precios, acceso de cliente o tu espacio privado."
        : "Vuelve a paquetes de viaje, precios, acceso de cliente o tu espacio privado.",
      primaryCta: my ? "Ver paquetes" : "Ver rutas",
      secondaryCta: "Ir al inicio"
    });
    patchSection(next, "conversion_1", {
      eyebrow: "Volver",
      title: my ? "Continua desde un paquete disponible." : "Continua desde una ruta disponible.",
      subtitle: my ? "Los enlaces principales siguen dentro de este sitio." : "Los enlaces principales siguen dentro de este sitio.",
      primaryCta: my ? "Ver paquetes" : "Ver rutas",
      secondaryCta: "Ir al inicio"
    });
  }
  if (slug === "/app" || slug === "/app/jobs/progress" || slug === "/app/jobs/detail" || slug === "/album" || slug === "/account") {
    patchSection(next, "launcher_1", {
      eyebrow: "Espacio privado",
      title: my ? "Crea fotos privadas con IA desde tus subidas." : "Crea retratos de viaje desde tus subidas.",
      subtitle: my
        ? "Prepara fotos fuente, elige paquete, revisa creditos y sigue el progreso."
        : "Prepara fotos fuente, elige ruta, revisa creditos y sigue el progreso."
    });
    patchSection(next, "job_intro_1", {
      eyebrow: my ? "Estado del pedido" : "Estado de la ruta",
      title: my ? "Sigue cada generacion hasta la entrega." : "Sigue cada ruta visual hasta la entrega.",
      subtitle: my
        ? "Consulta seleccion de paquete, subidas, reserva de creditos, generacion, revision y album privado."
        : "Consulta destino, subidas, reserva de creditos, generacion, revision y galeria privada.",
      body: my
        ? "El estado se actualiza cuando el generador devuelve progreso o resultados."
        : "El estado se actualiza cuando el generador devuelve progreso o resultados de ruta."
    });
    patchSection(next, "album_intro_1", {
      eyebrow: my ? "Album privado" : "Galeria de viaje",
      title: my ? "Resultados guardados para descarga." : "Retratos de viaje guardados para descarga.",
      subtitle: my
        ? "Revisa, compara, marca favoritos y descarga desde la cuenta correcta."
        : "Revisa rutas, compara escenas, marca favoritos y descarga desde la cuenta correcta."
    });
    patchSection(next, "billing_intro_1", {
      eyebrow: "Cuenta y creditos",
      title: my ? "Revisa saldo, pagos y albumes." : "Revisa saldo, pagos y rutas.",
      subtitle: my
        ? "El historial muestra planes, recargas, reservas y gasto de creditos."
        : "El historial muestra planes, recargas, reservas y gasto de creditos de ruta."
    });
  }
  if (copy) {
    patchSectionsByType(next, "trust_signal_bar", {
      title: my ? "Privacidad, saldo y entrega" : "Ruta, saldo y galeria"
    });
  }
  patchBlocksByType(next, "trust_signal_bar", trustStatsForSlug(slug, spec));
  patchBlocksByType(next, "rich_text", ruleCardsForSlug(slug, spec));
  patchBlocksByHref(next, spec);
  patchSpanishXbyVisibleResiduals(next, slug, spec);
  return repairSpanishTargetVisibleCopy(
    normalizeSpanishCollectionReferences(scrubEnglishJson(next, spec, { slug }), spec),
    slug,
    spec
  );
}

function translateSourcePageJson(pageJson, slug, spec, idMap = new Map()) {
  const next = translateSourceJson(clone(pageJson) ?? {}, spec, idMap);
  next.locale = "es-ES";
  if (explicitNonPublicPaths.has(slug)) {
    next.seo = {
      ...(next.seo ?? {}),
      canonicalPath: slug,
      index: false,
      follow: false,
      robots: { ...(next.seo?.robots ?? {}), index: false, follow: false }
    };
  }
  return normalizeSpanishCollectionReferences(next, spec);
}

function templateSlugFromKey(key) {
  const map = {
    index: "/",
    page: "/about-us",
    "about-us": "/about-us",
    "contact-us": "/contact-us",
    product: "/pricing",
    collection: "/collections",
    tools: "/tools",
    login: "/login",
    cart: "/cart",
    help: "/faq",
    blog: "/blog",
    "blog-detail": "/blog/preparing-source-photos",
    search: "/search",
    album: "/album",
    "app-home": "/app",
    "job-progress": "/app/jobs/progress",
    "job-detail": "/app/jobs/detail",
    "account-billing": "/account",
    privacy: "/policies/privacy",
    terms: "/policies/terms",
    cookies: "/policies/cookies",
    refunds: "/policies/refunds",
    content: "/policies/content",
    shipping: "/policies/shipping",
    "404": "/404"
  };
  return map[key] ?? `/${String(key ?? "").replace(/^\/+/, "")}`;
}

function patchTemplateJson(template, key, spec) {
  if (!template || typeof template !== "object") return template;
  const slug = templateSlugFromKey(key);
  if (template.sections && !template.sectionsOrder && Array.isArray(template.content_for_page)) {
    return translateSourcePageJson(
      {
        ...template,
        sectionsOrder: template.content_for_page
      },
      slug,
      spec
    );
  }
  if (template.sections) return translateSourcePageJson(template, slug, spec);
  return template;
}

function patchThemeTemplates(templates, spec) {
  const next = clone(templates) ?? {};
  for (const [key, template] of Object.entries(next)) {
    next[key] = patchTemplateJson(template, key, spec);
  }
  return next;
}

function patchPublicationSnapshot(snapshot, spec, idMap, pages) {
  const next = clone(snapshot) ?? {};
  if (Array.isArray(next.pages)) {
    next.pages = next.pages.map((page) => {
      const pageSlug = spanishPageSlug(page.slug);
      return {
        ...page,
        slug: pageSlug,
        publishedJson: patchPageJson(page.publishedJson, pageSlug, spec)
      };
    });
  }
  if (next.saasTheme?.templates) next.saasTheme.templates = patchThemeTemplates(next.saasTheme.templates, spec);
  if (next.saasTheme?.settings) next.saasTheme.settings = patchSettingsJson(next.saasTheme.settings, spec, idMap, pages);
  if (next.themeSettings) next.themeSettings = patchSettingsJson(next.themeSettings, spec, idMap, pages);
  if (next.settings) next.settings = patchSettingsJson(next.settings, spec, idMap, pages);
  return patchSpanishGlobalSections(next, spec);
}

function patchSettingsJson(settings, spec, idMap, pages) {
  const next = translateSourceJson(clone(settings) ?? {}, spec, idMap);
  next.locale = "es-ES";
  next.navigation = next.navigation ?? {};
  const existingHeaderLinks = Array.isArray(next.navigation.headerLinks) ? next.navigation.headerLinks : [];
  const existingFooterLinks = Array.isArray(next.navigation.footerLinks) ? next.navigation.footerLinks : [];
  next.navigation.headerLinks = spec.headerLinks.map(([label, href], index) => ({
    ...(existingHeaderLinks[index] ?? {}),
    label,
    href
  }));
  next.navigation.footerLinks = spec.footerLinks.map(([label, href, group], index) => ({
    ...(existingFooterLinks[index] ?? {}),
    label,
    href,
    group
  }));
  next.globalSections = next.globalSections ?? {};
  next.globalSections.header = next.globalSections.header ?? { type: "header", settings: {}, blocks: [] };
  next.globalSections.header.settings = {
    ...(next.globalSections.header.settings ?? {}),
    ...spanishHeaderSettings(spec)
  };
  next.globalSections.header.blocks = spanishHeaderBlocks(next.globalSections.header.blocks, spec);
  next.globalSections.footer = next.globalSections.footer ?? { type: "footer", settings: {}, blocks: [] };
  next.globalSections.footer.settings = {
    ...(next.globalSections.footer.settings ?? {}),
    ...spanishFooterSettings(spec)
  };
  const existingFooterBlocks = Array.isArray(next.globalSections.footer.blocks) ? next.globalSections.footer.blocks : [];
  next.globalSections.footer.blocks = spec.footerLinks.map(([label, href, group], index) => ({
    ...(existingFooterBlocks[index] ?? { id: `${spec.targetToken}_footer_${group}_${index + 1}`, type: "menu_link" }),
    settings: {
      ...(existingFooterBlocks[index]?.settings ?? {}),
      label,
      href,
      group
    }
  }));
  next.globalSections = patchSpanishGlobalSections(next.globalSections, spec);
  // The translated source settings, including SEO, remain the source of truth.
  // Only system navigation and global UI labels are normalized here.
  return next;
}

function sortByParent(rows) {
  const remaining = [...rows];
  const done = new Set();
  const sorted = [];
  while (remaining.length) {
    const index = remaining.findIndex((row) => !row.parentId || done.has(row.parentId) || !remaining.some((other) => other.id === row.parentId));
    const [row] = remaining.splice(index < 0 ? 0 : index, 1);
    sorted.push(row);
    done.add(row.id);
  }
  return sorted;
}

const dreamshootXbyCreativeParentGroups = [
  {
    slug: "retratos-y-perfiles",
    label: "Retratos y perfiles",
    icon: "badge-check",
    keywords: ["headshot", "profile", "creator", "social", "avatar"]
  },
  {
    slug: "pareja-y-boda",
    label: "Pareja y boda",
    icon: "heart",
    keywords: ["wedding", "desi", "indian", "valentine", "engagement", "couple"]
  },
  {
    slug: "estilo-y-fantasia",
    label: "Estilo y fantasia",
    icon: "sparkles",
    keywords: ["cyberpunk", "gala", "mafia", "noir", "nature", "travel-scene", "boudoir"]
  },
  {
    slug: "belleza-y-editorial",
    label: "Belleza y editorial",
    icon: "camera",
    keywords: ["beauty", "hairstyle", "try-on", "fashion", "editorial"]
  },
  {
    slug: "temporada-y-deporte",
    label: "Temporada y deporte",
    icon: "trophy",
    keywords: ["world-cup", "sports", "holiday", "christmas"]
  },
  {
    slug: "video-y-utilidades",
    label: "Video y utilidades",
    icon: "layers",
    keywords: ["video", "upscaler", "utility", "product"]
  }
];

function dreamshootXbyCreativeParentGroup(category) {
  const haystack = `${category.slug ?? ""} ${category.label ?? ""}`.toLowerCase();
  return dreamshootXbyCreativeParentGroups.find((group) => group.keywords.some((keyword) => haystack.includes(keyword))) ?? dreamshootXbyCreativeParentGroups[0];
}

function normalizeDreamshootXbyCreativePackCategories(categories, source, spec, idMap) {
  if (spec.sourceSiteId !== "site_dreamshoot") return categories;
  return categories;
}

function buildDataset(source, spec, targetState = {}) {
  const idMap = buildIdMaps(source, spec, targetState);
  const branding = {
    ...(source.branding && typeof source.branding === "object" && !Array.isArray(source.branding) ? clone(source.branding) : {}),
    logoText: spec.readableBrand,
    logoImageUrl: spec.logoImageUrl,
    market: spec.market,
    description: spec.description
  };
  const pages = source.livePages
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((page) => {
      const pageSlug = spanishPageSlug(page.slug);
      const contentJson = translateSourcePageJson(page.contentJson, pageSlug, spec, idMap);
      return {
        id: targetPageId(page, spec, idMap),
        siteId: spec.targetSiteId,
        pageType: page.pageType,
        templateKey: page.templateKey,
        slug: pageSlug,
        title: targetPageTitleForSlug(pageSlug, spec, spanishizeString(page.title || pageSlug, spec, idMap)),
        contentJson
      };
    });
  // The Spanish host keeps the legacy `/collections` directory as a public
  // compatibility entrypoint. It canonicalizes to `/ai-image-generation`,
  // but the catch-all route needs a relational page row for the directory
  // lookup. This is target-only and does not alter the English source.
  if (spec.targetSiteId === "site_mydreamshoots_xby") {
    const imageRoot = pages.find((page) => page.slug === "/ai-image-generation");
    if (imageRoot && !pages.some((page) => page.slug === "/collections")) {
      pages.push({
        ...imageRoot,
        id: `page_${spec.targetSiteId}_collections_alias`,
        slug: "/collections",
        title: imageRoot.title,
        contentJson: compatibilityAliasPageJson(imageRoot.contentJson, "/ai-image-generation")
      });
    }
    const videoRoot = pages.find((page) => page.slug === "/ai-video-generation");
    if (videoRoot && !pages.some((page) => page.slug === "/tools")) {
      pages.push({
        ...videoRoot,
        id: `page_${spec.targetSiteId}_tools_alias`,
        slug: "/tools",
        title: videoRoot.title,
        contentJson: compatibilityAliasPageJson(videoRoot.contentJson, "/ai-video-generation")
      });
    }
  }
  const themePages = source.pages
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((page) => {
      const pageSlug = spanishPageSlug(page.slug);
      return {
        id: targetPageId(page, spec, idMap),
        siteId: spec.targetSiteId,
        pageType: page.pageType,
        templateKey: page.templateKey,
        slug: pageSlug,
        title: targetPageTitleForSlug(pageSlug, spec, spanishizeString(page.title || pageSlug, spec, idMap)),
        draftJson: translateSourcePageJson(page.draftJson, pageSlug, spec, idMap),
        publishedJson: translateSourcePageJson(page.publishedJson, pageSlug, spec, idMap),
        draftMeta: clone(page.draftMeta)
      };
    });
  if (spec.targetSiteId === "site_mydreamshoots_xby") {
    const imageRoot = themePages.find((page) => page.slug === "/ai-image-generation");
    if (imageRoot && !themePages.some((page) => page.slug === "/collections")) {
      themePages.push({
        ...imageRoot,
        id: `theme_page_${spec.targetSiteId}_collections_alias`,
        slug: "/collections",
        title: imageRoot.title,
        draftJson: compatibilityAliasPageJson(imageRoot.draftJson, "/ai-image-generation"),
        publishedJson: compatibilityAliasPageJson(imageRoot.publishedJson, "/ai-image-generation")
      });
    }
    const videoRoot = themePages.find((page) => page.slug === "/ai-video-generation");
    if (videoRoot && !themePages.some((page) => page.slug === "/tools")) {
      themePages.push({
        ...videoRoot,
        id: `theme_page_${spec.targetSiteId}_tools_alias`,
        slug: "/tools",
        title: videoRoot.title,
        draftJson: compatibilityAliasPageJson(videoRoot.draftJson, "/ai-video-generation"),
        publishedJson: compatibilityAliasPageJson(videoRoot.publishedJson, "/ai-video-generation")
      });
    }
  }
  const settings = source.settings
    ? {
        id: `settings_${spec.targetSiteId}`,
        siteId: spec.targetSiteId,
        draftJson: patchSettingsJson(source.settings.draftJson, spec, idMap, pages),
        publishedJson: patchSettingsJson(source.settings.publishedJson, spec, idMap, pages)
      }
    : undefined;
  const targetProductsByKey = new Map();
  for (const product of targetState.products ?? []) {
    const key = normalizeTitle(product.name);
    const current = targetProductsByKey.get(key) ?? { product: undefined, prices: [] };
    current.product = current.product?.status === "active" ? current.product : product;
    current.prices.push(...(product.prices ?? []));
    targetProductsByKey.set(key, current);
  }
  const products = source.products.map((product) => {
    const targetProduct = targetProductsByKey.get(normalizeTitle(spanishTitle(product.name)));
    const productId = targetProduct?.product?.id ?? idMap.get(product.id);
    const targetPrices = targetProduct?.prices ?? [];
    return {
      id: productId,
      siteId: spec.targetSiteId,
      name: spanishTitle(product.name),
      type: product.type,
      status: product.status,
      metadata: spanishProductMetadata(product.metadata, spec, idMap),
      prices: product.prices.map((price) => ({
        id: targetPrices.find((candidate) => candidate.productId === productId && candidate.interval === price.interval)?.id
          ?? targetPrices.find((candidate) => candidate.interval === price.interval)?.id
          ?? idMap.get(price.id),
        siteId: spec.targetSiteId,
        productId,
        label: spanishTitle(price.label),
        amountCents: price.amountCents,
        currency: price.currency,
        interval: price.interval,
        creditsGranted: price.creditsGranted,
        stripePriceId: null,
        status: price.status,
        providerVerifiedAt: null,
        providerFingerprint: null,
        metadata: spanishPriceMetadata(price.metadata, spec, idMap)
      }))
    };
  });
  const creativePackCategories = normalizeDreamshootXbyCreativePackCategories(sortByParent(source.creativePackCategories).map((category) => {
    const label = spanishTitle(category.label || category.slug);
    return {
      id: idMap.get(category.id),
      siteId: spec.targetSiteId,
      parentId: category.parentId ? idMap.get(category.parentId) : null,
      slug: spanishDreamshootCategorySlug(category.slug, spec),
      label,
      description: category.description ? repairSpanishPublicValue(spanishizeString(category.description, spec, idMap), `/collections/${category.slug}`, spec, "description") : null,
      heroTitle: category.heroTitle ? repairSpanishPublicValue(spanishizeString(category.heroTitle, spec, idMap), `/collections/${category.slug}`, spec, "heroTitle") : null,
      heroSubtitle: category.heroSubtitle ? repairSpanishPublicValue(spanishizeString(category.heroSubtitle, spec, idMap), `/collections/${category.slug}`, spec, "heroSubtitle") : null,
      icon: category.icon,
      imageUrl: category.imageUrl ? spanishizeString(category.imageUrl, spec, idMap) : null,
      sortOrder: category.sortOrder,
      status: category.status
    };
  }), source, spec, idMap);
  const creativePacks = source.creativePacks.map((pack) => {
    const name = spanishTitle(pack.name || pack.category);
    return {
      id: idMap.get(pack.id),
      siteId: spec.targetSiteId,
      categoryId: pack.categoryId ? idMap.get(pack.categoryId) : null,
      name,
      headline: repairSpanishPublicValue(spanishizeString(pack.headline || pack.name || pack.category, spec, idMap), `/collections/${pack.category}`, spec, "headline"),
      description: repairSpanishPublicValue(spanishizeString(pack.description, spec, idMap), `/collections/${pack.category}`, spec, "description"),
      prompt: pack.prompt ? spanishizeString(pack.prompt, spec, idMap) : null,
      category: spanishDreamshootPackCategory(pack.category, spec),
      aiAppSlug: pack.aiAppSlug,
      status: pack.status,
      creditCost: pack.creditCost,
      outputCount: pack.outputCount,
      trainingRequired: pack.trainingRequired,
      generationCount: pack.generationCount,
      conversionRate: pack.conversionRate,
      imageUrl: pack.imageUrl ? spanishizeString(pack.imageUrl, spec, idMap) : null,
      galleryImages: spanishizeJson(pack.galleryImages, spec, idMap),
      galleryImageAlts: repairSpanishPublicValue(spanishizeJson(pack.galleryImageAlts, spec, idMap), `/collections/${pack.category}`, spec, "alt")
    };
  });
  const toolCategories = sortByParent(source.toolCategories).map((category) => {
    const label = spanishTitle(category.label || category.slug);
    const labelLower = label.toLowerCase();
    return {
      id: idMap.get(category.id),
      siteId: spec.targetSiteId,
      parentId: category.parentId ? idMap.get(category.parentId) : null,
      slug: category.slug,
      label,
      description: category.description ? repairSpanishPublicValue(spanishizeString(category.description, spec, idMap), `/tools/${category.slug}`, spec, "description") : null,
      icon: category.icon,
      sortOrder: category.sortOrder,
      status: category.status
    };
  });
  const toolMenuItems = source.toolMenuItems.map((item) => {
    const title = spanishTitle(item.title || item.slug);
    return {
      id: idMap.get(item.id),
      siteId: spec.targetSiteId,
      categoryId: item.categoryId ? idMap.get(item.categoryId) : null,
      slug: item.slug,
      title,
      description: item.description ? repairSpanishPublicValue(spanishizeString(item.description, spec, idMap), `/tools/${item.slug}`, spec, "description") : null,
      badge: repairSpanishPublicValue(spanishizeString(item.badge ?? "", spec, idMap), `/tools/${item.slug}`, spec, "badge") || null,
      icon: item.icon,
      imageUrl: item.imageUrl ? spanishizeString(item.imageUrl, spec, idMap) : null,
      href: spanishizeString(item.href, spec, idMap),
      detailJson: repairSpanishPublicValue(spanishizeJson(item.detailJson, spec, idMap), `/tools/${item.slug}`, spec, "detail"),
      sortOrder: item.sortOrder,
      status: item.status
    };
  });
  const mediaAssets = source.mediaAssets.map((asset) => {
    const publicUrl = asset.previewUrl || asset.originUrl || asset.storageKey;
    const mirrored = sourceAssetDescriptor(publicUrl, spec);
    const targetUrl = mirrored?.targetUrl ?? spanishizeString(publicUrl, spec, idMap);
    const baseStorageKey = mirrored?.storageKey ?? spanishMediaStorageKey(asset, spec);
    const suffix = crypto.createHash("sha256").update(String(asset.id)).digest("hex").slice(0, 8);
    const ext = path.extname(baseStorageKey);
    const stem = ext ? baseStorageKey.slice(0, -ext.length) : baseStorageKey;
    const storageKey = `${stem}-${suffix}${ext}`;
    return {
      id: idMap.get(asset.id),
      siteId: spec.targetSiteId,
      label: spanishizeString(spanishTitle(asset.label || asset.storageKey), spec, idMap),
      storageKey,
      mimeType: asset.mimeType,
      usageType: asset.usageType,
      sourceType: asset.sourceType,
      previewUrl: targetUrl || null,
      originUrl: targetUrl || null,
      altText: asset.altText ? spanishizeString(asset.altText, spec, idMap) : null,
      notes: asset.notes ? spanishizeString(asset.notes, spec, idMap) : null
    };
  });
  const siteAiApps = source.aiApps.map((app) => ({
      id: idMap.get(app.id),
      siteId: spec.targetSiteId,
      aiAppId: app.aiAppId,
    aiApp: spanishAiApp(app.aiApp, spec, idMap),
    enabled: app.enabled,
    creditCost: app.creditCost,
    routeKey: app.routeKey,
    workflowConfig: spanishWorkflowConfig(app.workflowConfig, spec, idMap, app),
    providerConfig: spanishizeJson(app.providerConfig, spec, idMap)
  }));
  const siteThemes = source.siteThemes.map((theme) => {
    const templates = patchThemeTemplates(spanishizeJson(theme.templates, spec, idMap), spec);
    return {
      id: idMap.get(theme.id),
      siteId: spec.targetSiteId,
      name: `${spec.readableBrand} ${theme.status === "published" ? "Publicado" : "Borrador"}`,
      themeId: mapId(theme.themeId, spec, "theme_id", theme.themeKey),
      themeKey: theme.themeKey,
      status: theme.status,
      templates,
      settings: patchSettingsJson(theme.settings, spec, idMap, pages),
      source: theme.source,
      createdBy: theme.createdBy
    };
  });
  const videoThemeCategories = source.videoThemeCategories.map((category) => ({
    id: idMap.get(category.id),
    siteId: spec.targetSiteId,
    parentId: category.parentId ? idMap.get(category.parentId) : null,
    slug: category.slug,
    label: spanishTitle(category.label || category.slug),
    description: repairSpanishPublicValue(spanishizeString(category.description || `Videos de ${spanishTitle(category.label || category.slug).toLowerCase()} con IA.`, spec, idMap), `/ai-video-generation/${category.slug}`, spec, "description"),
    icon: category.icon,
    accentColor: category.accentColor,
    imageUrl: category.imageUrl ? spanishizeString(category.imageUrl, spec, idMap) : null,
    sortOrder: category.sortOrder,
    status: category.status
  }));
  const videoThemes = source.videoThemes.map((theme) => ({
    id: idMap.get(theme.id),
    siteId: spec.targetSiteId,
    categoryId: theme.categoryId ? idMap.get(theme.categoryId) : null,
    slug: theme.slug,
    name: spanishTitle(theme.name || theme.slug),
    headline: repairSpanishPublicValue(spanishTitle(theme.headline || theme.name || theme.slug), `/ai-video-generation/${theme.slug}`, spec, "headline"),
    description: repairSpanishPublicValue(spanishizeString(theme.description, spec, idMap), `/ai-video-generation/${theme.slug}`, spec, "description"),
    prompt: spanishizeString(theme.prompt, spec, idMap),
    status: theme.status,
    creditCost: theme.creditCost,
    modelPricing: spanishizeJson(theme.modelPricing, spec, idMap),
    durationSeconds: theme.durationSeconds,
    maxFrames: theme.maxFrames,
    generationCount: theme.generationCount,
    sortOrder: theme.sortOrder,
    imageUrl: theme.imageUrl ? spanishizeString(theme.imageUrl, spec, idMap) : null,
    galleryImages: spanishizeJson(theme.galleryImages, spec, idMap)
  }));
  const videoThemeExamples = source.videoThemeExamples.map((example) => ({
    id: idMap.get(example.id),
    siteId: spec.targetSiteId,
    themeId: idMap.get(example.themeId),
    name: spanishTitle(example.name),
    description: example.description ? repairSpanishPublicValue(spanishizeString(example.description, spec, idMap), "/ai-video-generation", spec, "description") : null,
    imageUrl: example.imageUrl ? spanishizeString(example.imageUrl, spec, idMap) : null,
    galleryImages: spanishizeJson(example.galleryImages, spec, idMap),
    prompt: spanishizeString(example.prompt, spec, idMap),
    status: example.status,
    sortOrder: example.sortOrder
  }));
  const videoThemeSlugRedirects = source.videoThemeSlugRedirects.map((redirect) => ({
    id: idMap.get(redirect.id),
    siteId: spec.targetSiteId,
    themeId: redirect.themeId ? idMap.get(redirect.themeId) : null,
    oldSlug: redirect.oldSlug
  }));
  const site = {
    id: spec.targetSiteId,
    name: spec.name,
    slug: spec.targetSlug,
    status: "active",
    primaryDomain: spec.targetDomain,
    currency: source.currency,
    timezone: source.timezone,
    signupCreditGrant: source.signupCreditGrant,
    branding,
    themeSettings: settings ? { draftJson: settings.draftJson, publishedJson: settings.publishedJson } : undefined
  };
  const domains = [
    {
      id: `dom_${spec.targetToken}_primary`,
      siteId: spec.targetSiteId,
      domain: spec.targetDomain,
      isPrimary: true,
      status: "active",
      allowedAiProviderIds: []
    }
  ];
  return {
    spec,
    site,
    domains,
    settings,
    pages,
    themePages,
    profile: targetProfile(source, spec, idMap),
    products,
    siteAiApps,
    creativePackCategories,
    creativePacks,
    toolCategories,
    toolMenuItems,
    mediaAssets,
    siteThemes,
    videoThemeCategories,
    videoThemes,
    videoThemeExamples,
    videoThemeSlugRedirects
  };
}

async function fetchSource(siteId) {
  const source = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      domains: true,
      settings: true,
      storefrontProfile: true,
      livePages: { orderBy: [{ slug: "asc" }, { id: "asc" }] },
      pages: { orderBy: [{ slug: "asc" }, { id: "asc" }] },
      products: { include: { prices: { orderBy: [{ interval: "asc" }, { id: "asc" }] } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      aiApps: { include: { aiApp: true }, orderBy: [{ routeKey: "asc" }, { id: "asc" }] },
      creativePackCategories: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      creativePacks: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      toolCategories: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      toolMenuItems: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      videoThemeCategories: { orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] },
      videoThemes: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] },
      videoThemeExamples: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      videoThemeSlugRedirects: { orderBy: [{ oldSlug: "asc" }, { id: "asc" }] },
      mediaAssets: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      siteThemes: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }
    }
  });
  if (!source) throw new Error(`Missing source site ${siteId}`);
  if (!source.settings) throw new Error(`Missing theme settings for ${siteId}`);
  return source;
}

async function readTargetState(client, siteId) {
  const [livePages, themePages, creativePackCategories, toolCategories, toolMenuItems, videoThemeCategories, videoThemes, mediaAssets, products] = await Promise.all([
    client.livePage.findMany({ where: { siteId }, select: { id: true, slug: true } }),
    client.themePage.findMany({ where: { siteId }, select: { id: true, slug: true } }),
    client.creativePackCategory.findMany({ where: { siteId }, select: { id: true, slug: true } }),
    client.toolCategory.findMany({ where: { siteId }, select: { id: true, slug: true } }),
    client.toolMenuItem.findMany({ where: { siteId }, select: { id: true, slug: true } }),
    client.videoThemeCategory.findMany({ where: { siteId }, select: { id: true, slug: true } }),
    client.videoTheme.findMany({ where: { siteId }, select: { id: true, slug: true } }),
    client.mediaAsset.findMany({ where: { siteId }, select: { id: true, storageKey: true } }),
    client.product.findMany({ where: { siteId }, include: { prices: true } })
  ]);
  return { livePages, themePages, creativePackCategories, toolCategories, toolMenuItems, videoThemeCategories, videoThemes, mediaAssets, products };
}

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}

function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

const protectedModels = ["customer", "customerProfile", "customerSession", "subscription", "order", "paymentEvent", "creditLedger", "creditBalance", "generationJob", "assetUpload", "album", "customerAssetDownload", "customerModel", "siteAdmin", "siteAdminSession", "siteApiKey", "stripeConnectAccount", "aiGatewayGroup"];

async function protectedFingerprint(client, siteId) {
  const result = {};
  for (const model of protectedModels) {
    const rows = await client[model].findMany({ where: { siteId }, orderBy: { id: "asc" } });
    result[model] = hash(rows);
  }
  return result;
}

// The sync is intentionally scoped to one site's public surface. Fingerprint
// every other site's public rows before and after the transaction so a bad
// where clause cannot silently bleed into another storefront.
const isolationModels = [
  "siteDomain", "themeSettings", "storefrontProfile", "livePage", "themePage", "product",
  "creativePackCategory", "creativePack", "toolCategory", "toolMenuItem", "videoThemeCategory",
  "videoTheme", "videoThemeExample", "videoThemeSlugRedirect", "mediaAsset", "siteTheme", "siteAiApp"
];

async function publicIsolationFingerprint(client, excludedSiteId) {
  const sites = await client.site.findMany({ where: { id: { not: excludedSiteId } }, select: { id: true }, orderBy: { id: "asc" } });
  const result = {};
  for (const site of sites) {
    const rows = { site: await client.site.findUnique({ where: { id: site.id } }) };
    for (const model of isolationModels) {
      rows[model] = await client[model].findMany({ where: { siteId: site.id }, orderBy: { id: "asc" } });
    }
    result[site.id] = hash(rows);
  }
  return result;
}

async function copyMedia(dataset) {
  if (skipAssets) return { copied: 0, missing: [] };
  let copied = 0;
  const missing = [];
  const references = new Set(dataset.sourceMediaReferences ?? []);
  for (const source of dataset.sourceMediaAssets ?? []) references.add(source.previewUrl || source.originUrl || source.storageKey);
  for (const reference of references) {
    const candidate = sourceAssetDescriptor(reference);
    if (!candidate?.sourceFile) {
      if (candidate) missing.push(candidate.sourceValue);
      continue;
    }
    const destination = path.join(process.cwd(), "public", candidate.targetRelative);
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(candidate.sourceFile, destination);
      copied += 1;
    }
  }
  for (const reference of references) {
    const candidate = sourceAssetDescriptor(reference);
    if (!candidate?.sourceFile) continue;
    const destination = path.join(process.cwd(), "public", candidate.targetRelative);
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(candidate.sourceFile, destination);
      copied += 1;
    }
  }
  const sourceRoot = path.join(process.cwd(), "public", "assets", "dreamshoot");
  const copyTree = (current, relative = "") => {
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const sourcePath = path.join(current, entry.name);
      const childRelative = path.join(relative, entry.name).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        copyTree(sourcePath, childRelative);
        continue;
      }
      if (!entry.isFile()) continue;
      const destination = path.join(process.cwd(), "public", "assets", "sites", "site_aidreamshoots", "visuals", childRelative);
      if (!fs.existsSync(destination)) {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(sourcePath, destination);
        copied += 1;
      }
    }
  };
  copyTree(sourceRoot);
  return { copied, missing };
}

function rowKey(row, key) {
  if (typeof key === "function") return key(row);
  return String(row?.[key] ?? "");
}

function manifestCollection(name, desired, current, { key = "id", fields = null } = {}) {
  const desiredRows = Array.isArray(desired) ? desired.filter(Boolean) : desired ? [desired] : [];
  const currentRows = Array.isArray(current) ? current.filter(Boolean) : current ? [current] : [];
  const desiredByKey = new Map(desiredRows.map((row) => [rowKey(row, key), row]));
  const currentByKey = new Map(currentRows.map((row) => [rowKey(row, key), row]));
  const missing = [...desiredByKey.keys()].filter((item) => !currentByKey.has(item)).sort();
  const extra = [...currentByKey.keys()].filter((item) => !desiredByKey.has(item)).sort();
  const changed = [];
  for (const [item, desiredRow] of desiredByKey) {
    const currentRow = currentByKey.get(item);
    if (!currentRow) continue;
    const comparedFields = fields ?? Object.keys(desiredRow).filter((field) => !["id", "siteId"].includes(field));
    const fieldChanges = comparedFields.filter((field) => stable(desiredRow[field]) !== stable(currentRow[field]));
    if (fieldChanges.length) changed.push({ key: item, fields: fieldChanges });
  }
  return {
    entity: name,
    currentCount: currentRows.length,
    desiredCount: desiredRows.length,
    missing,
    extra,
    changed,
    desiredHash: hash(desiredRows),
    currentHash: hash(currentRows)
  };
}

function buildPlanManifest(source, targetCurrent, dataset, targetBefore, unrelatedBefore) {
  const currentCounts = summary(dataset, null, targetCurrent).targetCurrent;
  const collections = [
    manifestCollection("Site", dataset.site, targetCurrent, { fields: ["name", "slug", "status", "primaryDomain", "timezone", "currency", "signupCreditGrant", "branding"] }),
    manifestCollection("SiteDomain", dataset.domains, targetCurrent.domains, { key: "domain", fields: ["isPrimary", "status", "allowedAiProviderIds"] }),
    manifestCollection("ThemeSettings", dataset.settings, targetCurrent.settings),
    manifestCollection("StorefrontProfile", dataset.profile, targetCurrent.profile),
    manifestCollection("LivePage", dataset.pages, targetCurrent.livePages, { key: "slug", fields: ["pageType", "templateKey", "title", "contentJson"] }),
    manifestCollection("ThemePage", dataset.themePages, targetCurrent.pages, { key: "slug", fields: ["pageType", "templateKey", "title", "draftJson", "publishedJson", "draftMeta"] }),
    manifestCollection("Product", dataset.products, targetCurrent.products, { key: (row) => row.name, fields: ["type", "status", "prices"] }),
    manifestCollection("CreativePackCategory", dataset.creativePackCategories, targetCurrent.creativePackCategories, { key: "slug", fields: ["parentId", "label", "description", "heroTitle", "heroSubtitle", "icon", "imageUrl", "sortOrder", "status"] }),
    manifestCollection("CreativePack", dataset.creativePacks, targetCurrent.creativePacks, { key: (row) => `${row.category}|${row.name}`, fields: ["categoryId", "name", "headline", "description", "prompt", "category", "aiAppSlug", "status", "creditCost", "outputCount", "trainingRequired", "generationCount", "conversionRate", "imageUrl", "galleryImages", "galleryImageAlts"] }),
    manifestCollection("ToolCategory", dataset.toolCategories, targetCurrent.toolCategories, { key: "slug", fields: ["parentId", "label", "description", "icon", "sortOrder", "status"] }),
    manifestCollection("ToolMenuItem", dataset.toolMenuItems, targetCurrent.toolMenuItems, { key: "slug", fields: ["categoryId", "title", "description", "badge", "icon", "imageUrl", "href", "detailJson", "sortOrder", "status"] }),
    manifestCollection("VideoThemeCategory", dataset.videoThemeCategories, targetCurrent.videoThemeCategories, { key: "slug", fields: ["parentId", "label", "description", "icon", "accentColor", "imageUrl", "sortOrder", "status"] }),
    manifestCollection("VideoTheme", dataset.videoThemes, targetCurrent.videoThemes, { key: "slug", fields: ["categoryId", "name", "headline", "description", "prompt", "status", "creditCost", "modelPricing", "durationSeconds", "maxFrames", "generationCount", "sortOrder", "imageUrl", "galleryImages"] }),
    manifestCollection("VideoThemeExample", dataset.videoThemeExamples, targetCurrent.videoThemeExamples, { key: "name", fields: ["themeId", "description", "imageUrl", "galleryImages", "prompt", "status", "sortOrder"] }),
    manifestCollection("VideoThemeSlugRedirect", dataset.videoThemeSlugRedirects, targetCurrent.videoThemeSlugRedirects, { key: "oldSlug", fields: ["themeId"] }),
    manifestCollection("MediaAsset", dataset.mediaAssets, targetCurrent.mediaAssets, { key: "storageKey", fields: ["label", "mimeType", "usageType", "sourceType", "previewUrl", "originUrl", "altText", "notes"] }),
    manifestCollection("SiteTheme", dataset.siteThemes, targetCurrent.siteThemes, { key: (row) => `${row.themeKey}|${row.status}`, fields: ["name", "themeId", "themeKey", "status", "templates", "settings", "source", "createdBy"] }),
    manifestCollection("SiteAiApp", dataset.siteAiApps, targetCurrent.siteAiApps, { key: "routeKey", fields: ["enabled", "creditCost", "routeKey", "workflowConfig"] })
  ];
  return {
    schema: "aidreamshoots-public-sync-plan/v1",
    createdAt: nowIso,
    mode: apply ? "production-apply" : "plan",
    source: { siteId: dataset.spec.sourceSiteId, domain: "www.mydreamshoots.com", counts: summary(dataset).source },
    target: { siteId: dataset.spec.targetSiteId, domain: dataset.spec.targetDomain, counts: currentCounts },
    scope: {
      allowedSiteId: dataset.spec.targetSiteId,
      allowedDomain: dataset.spec.targetDomain,
      compatibilityAliases: { "/collections": "/ai-image-generation", "/tools": "/ai-video-generation" },
      homepageProtection: {
        enabled: dataset.spec.targetSiteId === "site_mydreamshoots_xby",
        excludedFromWrite: ["LivePage:/", "ThemePage:/", "ThemeSettings"]
      },
      saveTheDateProtection: dataset.protection?.saveTheDate ?? { enabled: false },
      explicitNonPublicPaths: Object.fromEntries(explicitNonPublicPaths),
      publicEntities: collections.map((item) => item.entity),
      protectedTables: protectedModels,
      excludedFromWrite: ["site_dreamshoot", "site_aidreamcapes", "customer", "order", "paymentEvent", "subscription", "creditLedger", "creditBalance", "generationJob", "assetUpload", "album", "session", "shared templates", "LivePage:/", "ThemePage:/", "ThemeSettings"]
    },
    collections,
    translation: dataset.translation ?? null,
    protection: { targetProtectedFingerprint: targetBefore, unrelatedPublicFingerprint: unrelatedBefore },
    media: { targetNamespace: "/assets/sites/site_aidreamshoots/", sourceNamespace: "/assets/dreamshoot/", checksumRequired: true }
  };
}

function writePlanManifest(manifest) {
  const filePath = reportPathArg
    ? path.resolve(process.cwd(), reportPathArg)
    : path.join(process.cwd(), "releases", "manifests", `aidreamshoots-sync-${target}-${apply ? "apply" : "plan"}-${nowIso.replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return filePath;
}

function assetChecksumSummary(dataset) {
  const assets = [];
  const missing = [];
  const aliases = [];
  for (const asset of dataset.mediaAssets ?? []) {
    for (const url of new Set([asset.previewUrl, asset.originUrl].filter(Boolean))) {
      const relative = url.split("?")[0].replace(/^\//, "");
      if (!relative.startsWith("assets/sites/site_aidreamshoots/") || relative.includes("..")) {
        missing.push({ id: asset.id, url, reason: "outside_target_namespace" });
        continue;
      }
      const filePath = path.join(process.cwd(), "public", relative);
      if (!fs.existsSync(filePath)) {
        missing.push({ id: asset.id, url, reason: "file_missing" });
        continue;
      }
      const contents = fs.readFileSync(filePath);
      const descriptor = sourceAssetDescriptor(url);
      if (descriptor?.sourceAliasTail) aliases.push({ id: asset.id, url, sourceAliasTail: descriptor.sourceAliasTail });
      assets.push({ id: asset.id, url, bytes: contents.length, sha256: crypto.createHash("sha256").update(contents).digest("hex") });
    }
  }
  return { checked: assets.length, missing, aliases, assets };
}

async function upsertPublicRows(tx, rows, delegate, update, key = "id") {
  for (const row of rows) {
    const where = key === "siteId_slug"
      ? { siteId_slug: { siteId: row.siteId, slug: row.slug } }
      : key === "siteId_storageKey"
        ? { siteId_storageKey: { siteId: row.siteId, storageKey: row.storageKey } }
        : { id: row.id };
    await delegate.upsert({ where, create: row, update: update(row) });
  }
}

async function applyDataset(dataset, targetCurrent) {
  const targetId = dataset.site.id;
  const preserveHomepage = targetId === "site_mydreamshoots_xby";
  const writablePages = dataset.pages.filter((row) => !preserveHomepage || row.slug !== "/");
  const writableThemePages = dataset.themePages.filter((row) => !preserveHomepage || row.slug !== "/");
  if (preserveHomepage) {
    if (writablePages.some((row) => row.slug === "/") || writableThemePages.some((row) => row.slug === "/")) throw new Error("homepage_protection_filter_failed");
    if (!targetCurrent.livePages.some((row) => row.slug === "/")) throw new Error("homepage_protection_requires_existing_live_page");
    if (!targetCurrent.pages.some((row) => row.slug === "/")) throw new Error("homepage_protection_requires_existing_theme_page");
    if (!targetCurrent.settings) throw new Error("homepage_protection_requires_existing_theme_settings");
  }
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Site" WHERE "id" = ${targetId} FOR UPDATE`;
    await tx.site.update({ where: { id: targetId }, data: { name: dataset.site.name, slug: dataset.site.slug, status: dataset.site.status, primaryDomain: dataset.site.primaryDomain, timezone: dataset.site.timezone, currency: dataset.site.currency, signupCreditGrant: dataset.site.signupCreditGrant, branding: dataset.site.branding } });
    await tx.siteDomain.upsert({ where: { domain: dataset.spec.targetDomain }, create: dataset.domains[0], update: { isPrimary: true, status: "active", allowedAiProviderIds: [] } });
    await tx.siteDomain.updateMany({ where: { siteId: targetId, domain: { not: dataset.spec.targetDomain } }, data: { isPrimary: false } });
    if (!preserveHomepage) {
      await tx.themeSettings.upsert({ where: { siteId: targetId }, create: dataset.settings, update: { draftJson: dataset.settings.draftJson, publishedJson: dataset.settings.publishedJson } });
    }
    await tx.storefrontProfile.upsert({ where: { siteId: targetId }, create: dataset.profile, update: { draftJson: dataset.profile.draftJson, publishedJson: dataset.profile.publishedJson, draftMeta: dataset.profile.draftMeta } });
    const pageUpdate = (row) => ({ pageType: row.pageType, templateKey: row.templateKey, title: row.title, contentJson: row.contentJson });
    await upsertPublicRows(tx, writablePages, tx.livePage, pageUpdate, "siteId_slug");
    await tx.livePage.deleteMany({ where: { siteId: targetId, slug: { notIn: [...writablePages.map((row) => row.slug), ...(preserveHomepage ? ["/"] : [])] } } });
    const themePageUpdate = (row) => ({ pageType: row.pageType, templateKey: row.templateKey, title: row.title, draftJson: row.draftJson, publishedJson: row.publishedJson, draftMeta: row.draftMeta });
    await upsertPublicRows(tx, writableThemePages, tx.themePage, themePageUpdate, "siteId_slug");
    await tx.themePage.deleteMany({ where: { siteId: targetId, slug: { notIn: [...writableThemePages.map((row) => row.slug), ...(preserveHomepage ? ["/"] : [])] } } });
    for (const product of dataset.products) {
      await tx.product.upsert({ where: { id: product.id }, create: { id: product.id, siteId: product.siteId, name: product.name, type: product.type, status: product.status, metadata: product.metadata }, update: { name: product.name, type: product.type, status: product.status, metadata: product.metadata } });
      for (const price of product.prices) await tx.price.upsert({ where: { id: price.id }, create: { ...price, stripePriceId: null, providerVerifiedAt: null, providerFingerprint: null, status: price.status ?? "draft" }, update: { productId: price.productId, label: price.label, amountCents: price.amountCents, currency: price.currency, interval: price.interval, creditsGranted: price.creditsGranted, metadata: price.metadata, status: price.status ?? "draft", stripePriceId: null, providerVerifiedAt: null, providerFingerprint: null } });
    }
    await tx.product.updateMany({ where: { siteId: targetId, id: { notIn: dataset.products.map((row) => row.id) } }, data: { status: "inactive" } });
    await tx.price.updateMany({ where: { siteId: targetId, id: { notIn: dataset.products.flatMap((product) => product.prices.map((price) => price.id)) } }, data: { status: "draft", stripePriceId: null } });
    const packCategoryUpdate = (row) => ({ parentId: row.parentId, slug: row.slug, label: row.label, description: row.description, heroTitle: row.heroTitle, heroSubtitle: row.heroSubtitle, icon: row.icon, imageUrl: row.imageUrl, sortOrder: row.sortOrder, status: row.status });
    await upsertPublicRows(tx, dataset.creativePackCategories, tx.creativePackCategory, packCategoryUpdate);
    await tx.creativePackCategory.updateMany({ where: { siteId: targetId, id: { notIn: dataset.creativePackCategories.map((row) => row.id) } }, data: { status: "inactive" } });
    const packUpdate = (row) => ({ categoryId: row.categoryId, name: row.name, headline: row.headline, description: row.description, prompt: row.prompt, category: row.category, aiAppSlug: row.aiAppSlug, status: row.status, creditCost: row.creditCost, outputCount: row.outputCount, trainingRequired: row.trainingRequired, generationCount: row.generationCount, conversionRate: row.conversionRate, imageUrl: row.imageUrl, galleryImages: row.galleryImages, galleryImageAlts: row.galleryImageAlts });
    await upsertPublicRows(tx, dataset.creativePacks, tx.creativePack, packUpdate);
    await tx.creativePack.updateMany({ where: { siteId: targetId, id: { notIn: dataset.creativePacks.map((row) => row.id) } }, data: { status: "inactive" } });
    const categoryUpdate = (row) => ({ parentId: row.parentId, slug: row.slug, label: row.label, description: row.description, icon: row.icon, sortOrder: row.sortOrder, status: row.status });
    await upsertPublicRows(tx, dataset.toolCategories, tx.toolCategory, categoryUpdate);
    await tx.toolCategory.updateMany({ where: { siteId: targetId, id: { notIn: dataset.toolCategories.map((row) => row.id) } }, data: { status: "inactive" } });
    const toolUpdate = (row) => ({ categoryId: row.categoryId, slug: row.slug, title: row.title, description: row.description, badge: row.badge, icon: row.icon, imageUrl: row.imageUrl, href: row.href, detailJson: row.detailJson, sortOrder: row.sortOrder, status: row.status });
    await upsertPublicRows(tx, dataset.toolMenuItems, tx.toolMenuItem, toolUpdate);
    await tx.toolMenuItem.updateMany({ where: { siteId: targetId, id: { notIn: dataset.toolMenuItems.map((row) => row.id) } }, data: { status: "inactive" } });
    const videoCategoryUpdate = (row) => ({ parentId: row.parentId, slug: row.slug, label: row.label, description: row.description, icon: row.icon, accentColor: row.accentColor, imageUrl: row.imageUrl, sortOrder: row.sortOrder, status: row.status });
    await upsertPublicRows(tx, sortByParent(dataset.videoThemeCategories), tx.videoThemeCategory, videoCategoryUpdate);
    await tx.videoThemeCategory.updateMany({ where: { siteId: targetId, id: { notIn: dataset.videoThemeCategories.map((row) => row.id) } }, data: { status: "inactive" } });
    const videoUpdate = (row) => ({ categoryId: row.categoryId, slug: row.slug, name: row.name, headline: row.headline, description: row.description, prompt: row.prompt, status: row.status, creditCost: row.creditCost, modelPricing: row.modelPricing, durationSeconds: row.durationSeconds, maxFrames: row.maxFrames, generationCount: row.generationCount, sortOrder: row.sortOrder, imageUrl: row.imageUrl, galleryImages: row.galleryImages });
    await upsertPublicRows(tx, dataset.videoThemes, tx.videoTheme, videoUpdate);
    await tx.videoTheme.updateMany({ where: { siteId: targetId, id: { notIn: dataset.videoThemes.map((row) => row.id) } }, data: { status: "inactive" } });
    const exampleUpdate = (row) => ({ themeId: row.themeId, name: row.name, description: row.description, imageUrl: row.imageUrl, galleryImages: row.galleryImages, prompt: row.prompt, status: row.status, sortOrder: row.sortOrder });
    await upsertPublicRows(tx, dataset.videoThemeExamples, tx.videoThemeExample, exampleUpdate);
    await tx.videoThemeExample.updateMany({ where: { siteId: targetId, id: { notIn: dataset.videoThemeExamples.map((row) => row.id) } }, data: { status: "inactive" } });
    await upsertPublicRows(tx, dataset.videoThemeSlugRedirects, tx.videoThemeSlugRedirect, (row) => ({ themeId: row.themeId, oldSlug: row.oldSlug }));
    await tx.videoThemeSlugRedirect.deleteMany({ where: { siteId: targetId, id: { notIn: dataset.videoThemeSlugRedirects.map((row) => row.id) } } });
    const mediaUpdate = (row) => ({ label: row.label, storageKey: row.storageKey, mimeType: row.mimeType, usageType: row.usageType, sourceType: row.sourceType, previewUrl: row.previewUrl, originUrl: row.originUrl, altText: row.altText, notes: row.notes });
    // Media files are preflighted outside this transaction. Only update rows
    // whose public metadata actually differs; re-upserting all 758 assets over
    // the production tunnel made the original transaction exceed its timeout.
    const currentMediaByStorageKey = new Map((targetCurrent?.mediaAssets ?? []).map((row) => [row.storageKey, row]));
    const mediaRowsToWrite = dataset.mediaAssets.filter((row) => {
      const current = currentMediaByStorageKey.get(row.storageKey);
      if (!current) return true;
      return ["label", "storageKey", "mimeType", "usageType", "sourceType", "previewUrl", "originUrl", "altText", "notes"]
        .some((field) => stable(row[field]) !== stable(current[field]));
    });
    await upsertPublicRows(tx, mediaRowsToWrite, tx.mediaAsset, mediaUpdate);
    await tx.mediaAsset.deleteMany({ where: { siteId: targetId, id: { notIn: dataset.mediaAssets.map((row) => row.id) } } });
    const themeUpdate = (row) => ({ name: row.name, themeId: row.themeId, themeKey: row.themeKey, status: row.status, templates: row.templates, settings: row.settings, source: row.source, createdBy: row.createdBy });
    await upsertPublicRows(tx, dataset.siteThemes, tx.siteTheme, themeUpdate);
    await tx.siteTheme.updateMany({ where: { siteId: targetId, id: { notIn: dataset.siteThemes.map((row) => row.id) } }, data: { status: "inactive" } });
    for (const app of dataset.siteAiApps) {
      const existing = await tx.siteAiApp.findUnique({ where: { siteId_aiAppId: { siteId: targetId, aiAppId: app.aiAppId } }, select: { id: true, providerConfig: true } });
      if (existing) {
        await tx.siteAiApp.update({ where: { id: existing.id }, data: { enabled: app.enabled, creditCost: app.creditCost, routeKey: app.routeKey, workflowConfig: app.workflowConfig } });
      } else {
        await tx.siteAiApp.create({ data: { id: app.id, siteId: app.siteId, aiAppId: app.aiAppId, enabled: app.enabled, creditCost: app.creditCost, routeKey: app.routeKey, workflowConfig: app.workflowConfig, providerConfig: null } });
      }
    }
    await tx.auditLog.create({ data: { id: `audit_${dataset.spec.targetToken}_${Date.now()}`, siteId: targetId, actorId: "platform", actorType: "platform", action: "site.aidreamshoots.sync", targetType: "site", targetId, metadata: { sourceSiteId: dataset.spec.sourceSiteId, publicPages: dataset.pages.length, writablePages: writablePages.length, packages: dataset.creativePacks.length, videos: dataset.videoThemes.length, media: dataset.mediaAssets.length, homepageProtection: preserveHomepage ? { enabled: true, excludedFromWrite: ["LivePage:/", "ThemePage:/", "ThemeSettings"] } : { enabled: false } } } });
  }, { timeout: 1800000, maxWait: 20000 });
}

function summary(dataset, targetBefore, targetCurrent) {
  return {
    source: { livePages: dataset.pages.length, themePages: dataset.themePages.length, packCategories: dataset.creativePackCategories.length, packs: dataset.creativePacks.length, tools: dataset.toolMenuItems.length, videoCategories: dataset.videoThemeCategories.length, videos: dataset.videoThemes.length, media: dataset.mediaAssets.length },
    targetBefore: targetBefore ?? null,
    targetCurrent: targetCurrent ? {
      livePages: targetCurrent.livePages.length,
      themePages: targetCurrent.pages.length,
      packCategories: targetCurrent.creativePackCategories.length,
      packs: targetCurrent.creativePacks.length,
      tools: targetCurrent.toolMenuItems.length,
      videoCategories: targetCurrent.videoThemeCategories.length,
      videos: targetCurrent.videoThemes.length,
      media: targetCurrent.mediaAssets.length
    } : null
  };
}

async function main() {
  const spec = specs[0];
  const source = await fetchSource(spec.sourceSiteId);
  const targetState = await readTargetState(prisma, spec.targetSiteId);
  const targetCurrent = await fetchSource(spec.targetSiteId);
  const targetBefore = await protectedFingerprint(prisma, spec.targetSiteId);
  const unrelatedBefore = await publicIsolationFingerprint(prisma, spec.targetSiteId);
  const translation = await prepareSourceCopyTranslations(source);
  const dataset = protectAidreamshootsSaveTheDateDataset(buildDataset(source, spec, targetState), targetCurrent);
  dataset.sourceMediaAssets = source.mediaAssets;
  dataset.sourceMediaReferences = [...collectSourceAssetReferences(source)];
  dataset.translation = {
    ...translation,
    untranslatedFields: translation.untranslated
  };
  const manifest = buildPlanManifest(source, targetCurrent, dataset, targetBefore, unrelatedBefore);
  manifest.summary = summary(dataset, targetBefore, targetCurrent);
  const planPath = writePlanManifest(manifest);
  if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", target, sourceSiteId: spec.sourceSiteId, targetSiteId: spec.targetSiteId, planPath, protectedFingerprint: targetBefore, translation: dataset.translation, summary: summary(dataset, targetBefore, targetCurrent) }, null, 2));
    return;
  }
  if (target === "remote" && skipAssets) throw new Error("production_sync_cannot_skip_asset_preflight");
  const media = await copyMedia(dataset);
  if (media.missing.length) throw new Error(`source_media_missing:${media.missing.slice(0, 10).join(",")}`);
  const assetChecksums = assetChecksumSummary(dataset);
  if (assetChecksums.missing.length) throw new Error(`target_media_missing:${assetChecksums.missing.slice(0, 10).map((item) => item.url).join(",")}`);
  manifest.media = { ...manifest.media, copied: media.copied, sourceReferencesMissing: media.missing, checksums: assetChecksums };
  fs.writeFileSync(planPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await applyDataset(dataset, targetCurrent);
  const targetAfter = await protectedFingerprint(prisma, spec.targetSiteId);
  if (stable(targetBefore) !== stable(targetAfter)) throw new Error("protected_target_records_changed");
  const unrelatedAfter = await publicIsolationFingerprint(prisma, spec.targetSiteId);
  if (stable(unrelatedBefore) !== stable(unrelatedAfter)) throw new Error("unrelated_site_public_records_changed");
  manifest.verification = { targetProtectedFingerprint: targetAfter, unrelatedPublicFingerprint: unrelatedAfter, media: assetChecksums };
  fs.writeFileSync(planPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ ok: true, mode: "applied", target, sourceSiteId: spec.sourceSiteId, targetSiteId: spec.targetSiteId, planPath, media, protectedFingerprint: targetAfter, unrelatedPublicFingerprint: unrelatedAfter, translation: dataset.translation, summary: summary(dataset, targetBefore, targetCurrent) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
