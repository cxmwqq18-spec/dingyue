import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const statePath = path.resolve(process.cwd(), "data/platform-state.json");
const dryRun = process.argv.includes("--dry-run");
const now = new Date();
const nowIso = now.toISOString();

const specs = [
  {
    sourceSiteId: "site_dreamshoot",
    sourceToken: "dreamshoot",
    sourceSlug: "mydreamshoots",
    targetSiteId: "site_mydreamshoots_xby",
    targetToken: "mydreamshoots_xby",
    targetSlug: "mydreamshoots-xby",
    targetDomain: "mydreamshoots-xby.localhost",
    name: "MyDreamShoots-xby",
    readableBrand: "MyDreamShoots-xby",
    supportEmail: "support@mydreamshoots-xby.localhost",
    market: "Paquetes de fotos con IA, modelos privados, herramientas creativas, creditos y galerias privadas",
    description:
      "MyDreamShoots-xby es una tienda en espanol para crear retratos profesionales, fotos de pareja, headshots y albumes privados con IA desde tus selfies.",
    homeTitle: "MyDreamShoots-xby - generador de fotos con IA online",
    homeDescription:
      "Convierte tus selfies en retratos profesionales, fotos de pareja y albumes privados con MyDreamShoots-xby. Sube tus fotos, revisa creditos y crea resultados con IA desde casa.",
    homeKeywords:
      "generador de fotos IA,retratos IA,fotos de pareja IA,headshots IA,album privado IA,selfies,MyDreamShoots-xby",
    defaultOgImage: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png",
    headerLinks: [
      ["Ver paquetes", "/collections"],
      ["Herramientas", "/tools"],
      ["Como funciona", "#workflow"],
      ["Precios", "/pricing"],
      ["FAQ", "#faq"]
    ],
    footerLinks: [
      ["Ver paquetes", "/collections", "product"],
      ["Herramientas", "/tools", "product"],
      ["Como funciona", "/#workflow", "product"],
      ["Precios", "/pricing", "product"],
      ["Centro de ayuda", "/help", "company"],
      ["Guias", "/blog", "company"],
      ["Sobre nosotros", "/about-us", "company"],
      ["Contacto", "/contact-us", "company"],
      ["Circulo de creadores", "/creators-circle", "company"],
      ["Politica de privacidad", "/privacy", "support"],
      ["Politica de contenido", "/content", "support"],
      ["Terminos de servicio", "/terms", "support"],
      ["Politica de cookies", "/cookies", "support"]
    ]
  },
  {
    sourceSiteId: "site_aidreamcapes",
    sourceToken: "aidreamcapes",
    sourceSlug: "aidreamcapes",
    targetSiteId: "site_aidreamcapes_xby",
    targetToken: "aidreamcapes_xby",
    targetSlug: "aidreamcapes-xby",
    targetDomain: "aidreamcapes-xby.localhost",
    name: "Aidreamcapes-xby",
    readableBrand: "Aidreamcapes-xby",
    supportEmail: "support@aidreamcapes-xby.localhost",
    market: "Retratos de viaje con IA, escenas de destino, paquetes cinematograficos, creditos y galerias privadas",
    description:
      "Aidreamcapes-xby es una tienda en espanol para crear retratos de viaje, escenas de destino, albumes cinematicos y recuerdos privados con IA.",
    homeTitle: "Aidreamcapes-xby - generador de retratos de viaje con IA",
    homeDescription:
      "Transforma tus fotos favoritas en retratos de viaje profesionales con Aidreamcapes-xby. Elige destino, ambiente y estilo desde casa con galerias privadas.",
    homeKeywords:
      "retratos de viaje IA,fotos de viaje IA,generador de fotos IA,albumes de destino,retratos cinematicos,Aidreamcapes-xby",
    defaultOgImage: "/assets/sites/site_aidreamcapes/creative-packs/destination-story.webp?v=20260630webp",
    headerLinks: [
      ["Paquetes de viaje", "/collections"],
      ["Herramientas", "/tools"],
      ["Como funciona", "#workflow"],
      ["Ejemplos", "/collections"],
      ["Ayuda", "/help"]
    ],
    footerLinks: [
      ["Paquetes de viaje", "/collections", "product"],
      ["Motor de retratos de ruta", "/tools/route-portrait-engine", "product"],
      ["Precios", "/pricing", "product"],
      ["Notas de viaje", "/blog", "company"],
      ["Sobre el estudio", "/about-us", "company"],
      ["Contacto del estudio", "/contact-us", "company"],
      ["Centro de ayuda", "/help", "support"],
      ["Promesa de privacidad", "/privacy", "support"],
      ["Terminos del estudio", "/terms", "support"],
      ["Seguridad creativa", "/content", "support"],
      ["Aviso de cookies", "/cookies", "support"]
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
    "social cards": "Tarjetas sociales",
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
    "headshots": "Headshots",
    "seasonal": "Temporada",
    "route portraits": "Retratos de ruta",
    "destination portraits": "Retratos de destino",
    "travel moments": "Momentos de viaje",
    "adventure escapes": "Escapadas de aventura",
    "creator travel kits": "Kits de viaje para creadores",
    "local moments": "Momentos locales",
    "open-air routes": "Rutas al aire libre",
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
    "rooftop skyline set": "Set de skyline en azotea",
    "rainy city album tool": "Herramienta de album urbano lluvioso",
    "private villa portraits": "Retratos de villa privada",
    "snow lodge portraits": "Retratos en refugio de nieve",
    "lake house weekend tool": "Herramienta de casa del lago",
    "shared route album": "Album de ruta compartida",
    "family travel keepsakes": "Recuerdos de viaje familiar",
    "solo traveler profile set": "Set de perfil de viajero solo",
    "travel journal cover maker": "Creador de portada de diario de viaje",
    "private album curator": "Curador de album privado",
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
    "edit by prompt": "Editar con prompt",
    "image to video concept": "Concepto de imagen a video",
    "profile clip maker": "Creador de clip de perfil",
    "fan poster motion": "Poster animado de hincha",
    "creator intro video": "Video intro de creador",
    "product teaser clip": "Clip teaser de producto",
    "animated avatar preview": "Vista previa de avatar animado",
    "fashion reel starter": "Inicio de reel de moda",
    "album story video": "Video narrativo de album"
  })
);

const phrasePairs = [
  ["MyDreamShoots", "MyDreamShoots-xby"],
  ["MydreamShoots", "MyDreamShoots-xby"],
  ["Mydreamshoots", "MyDreamShoots-xby"],
  ["DreamShootAI", "MyDreamShoots-xby"],
  ["Aidreamcapes", "Aidreamcapes-xby"],
  ["Browse packages", "Ver paquetes"],
  ["Travel Packages", "Paquetes de viaje"],
  ["Tools", "Herramientas"],
  ["How it works", "Como funciona"],
  ["Pricing", "Precios"],
  ["Examples", "Ejemplos"],
  ["Help", "Ayuda"],
  ["FAQ", "FAQ"],
  ["Sign in", "Iniciar sesion"],
  ["Sign out", "Cerrar sesion"],
  ["Create my first photo set", "Crear mi primer set de fotos"],
  ["Start a package", "Empezar un paquete"],
  ["Create private AI photo sets from everyday selfies.", "Crea sets privados de fotos con IA desde selfies cotidianos."],
  ["Create AI travel portraits from everyday uploads.", "Crea retratos de viaje con IA desde tus fotos cotidianas."],
  ["Private uploads", "Subidas privadas"],
  ["Credit cost shown upfront", "Coste en creditos visible antes de generar"],
  ["Download your favorites", "Descarga tus favoritos"],
  ["Private gallery", "Galeria privada"],
  ["private gallery", "galeria privada"],
  ["Customer login", "Acceso de cliente"],
  ["Customer workspace", "Espacio privado del cliente"],
  ["Account and billing", "Cuenta y facturacion"],
  ["Job progress", "Progreso del pedido"],
  ["Job detail", "Detalle del pedido"],
  ["Private album", "Album privado"],
  ["Privacy policy", "Politica de privacidad"],
  ["Refund policy", "Politica de reembolsos"],
  ["Cookie policy", "Politica de cookies"],
  ["Content policy", "Politica de contenido"],
  ["Terms of Service", "Terminos de servicio"],
  ["Digital delivery policy", "Politica de entrega digital"],
  ["Shipping and Digital Delivery Policy", "Politica de entrega digital"],
  ["Help center", "Centro de ayuda"],
  ["Help Center", "Centro de ayuda"],
  ["About Us", "Sobre nosotros"],
  ["Contact Us", "Contacto"],
  ["Guides", "Guias"],
  ["Search", "Buscar"],
  ["Cart", "Carrito"],
  ["credits", "creditos"],
  ["Credits", "Creditos"],
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
  ["Choose", "Elegir"]
];

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
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

function spanishTitle(value) {
  return lookupSpanishTitle(value) ?? titleCaseFromSlug(value);
}

function mapId(id, spec, prefix, slug) {
  const sourceId = String(id ?? "");
  let next = sourceId;
  const sourceSlugToken = spec.sourceSlug.replaceAll("-", "_");
  if (next.includes(spec.sourceSiteId)) {
    next = next.replaceAll(spec.sourceSiteId, spec.targetSiteId);
  } else if (next.includes(sourceSlugToken)) {
    next = next.replaceAll(sourceSlugToken, spec.targetToken);
  } else if (next.includes(spec.sourceToken)) {
    next = next.replaceAll(spec.sourceToken, spec.targetToken);
  }
  if (next !== sourceId) return next;
  return `${prefix}_${spec.targetToken}_${safeSlug(slug ?? sourceId)}`;
}

function buildIdMaps(source, spec) {
  const map = new Map([[spec.sourceSiteId, spec.targetSiteId]]);
  for (const page of source.pages) map.set(page.id, mapId(page.id, spec, "page", page.slug));
  for (const product of source.products) {
    map.set(product.id, mapId(product.id, spec, "prod", product.name));
    for (const price of product.prices) map.set(price.id, mapId(price.id, spec, "price", price.label));
  }
  for (const category of source.creativePackCategories) map.set(category.id, mapId(category.id, spec, "cat", category.slug));
  for (const pack of source.creativePacks) map.set(pack.id, mapId(pack.id, spec, "pack", pack.category || pack.name));
  for (const category of source.toolCategories) map.set(category.id, mapId(category.id, spec, "tool_cat", category.slug));
  for (const item of source.toolMenuItems) map.set(item.id, mapId(item.id, spec, "tool_menu", item.slug));
  for (const asset of source.mediaAssets) map.set(asset.id, mapId(asset.id, spec, "media", asset.storageKey || asset.label));
  for (const theme of source.siteThemes) map.set(theme.id, mapId(theme.id, spec, "theme", theme.themeId));
  for (const publication of source.publications) map.set(publication.id, mapId(publication.id, spec, "pub", publication.version));
  for (const app of source.aiApps) map.set(app.id, mapId(app.id, spec, "sai", app.routeKey));
  for (const group of source.gatewayGroups) map.set(group.id, mapId(group.id, spec, "gw", group.name));
  return map;
}

function isFunctionalString(value) {
  return (
    /^https?:\/\//i.test(value) ||
    value.startsWith("/") ||
    value.includes("@") ||
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

function rewriteIds(value, idMap, spec) {
  let next = value;
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

function spanishizeString(value, spec, idMap) {
  let next = rewriteIds(value, idMap, spec);
  if (isFunctionalString(next)) return next;
  const directTitle = lookupSpanishTitle(next);
  if (directTitle) return directTitle;
  for (const [from, to] of phrasePairs) next = next.replaceAll(from, to);
  return next;
}

function spanishizeJson(value, spec, idMap) {
  if (Array.isArray(value)) return value.map((item) => spanishizeJson(item, spec, idMap));
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? spanishizeString(value, spec, idMap) : value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, spanishizeJson(item, spec, idMap)]));
}

const englishVisiblePattern =
  /\b(the|and|for|with|from|your|private|photo|photos|portrait|portraits|tool|tools|create|choose|upload|uploads|credits|gallery|workspace|packages|pricing|checkout|review|download|discover|every|before|after|source|account|customer|album|albums|travel|studio|profile|generator|builder|maker|route|scene|scenes|plans|monthly|yearly|start|view|return|support|privacy|terms|cookie|content|help|search|cart)\b/i;

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
  "imageBadge",
  "imageCaption",
  "intro",
  "journeyDescriptions",
  "journeyTitle",
  "label",
  "meta",
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
  "summaryTitle",
  "supportHeading",
  "tagline",
  "text",
  "title",
  "value"
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

function shouldScrubText(key, value) {
  if (!visibleTextKeys.has(key) || nonVisibleKeys.has(key)) return false;
  if (isFunctionalString(value)) return false;
  return englishVisiblePattern.test(value);
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
  if (key === "productHeading") return "Explorar";
  if (key === "companyHeading") return "Contenido";
  if (key === "supportHeading") return "Soporte";
  return my
    ? `${brand} permite crear fotos privadas con IA desde selfies, revisar creditos antes de generar y descargar resultados desde una galeria privada.`
    : `${brand} permite crear retratos de viaje con IA desde fotos fuente, revisar creditos antes de generar y descargar resultados desde una galeria privada.`;
}

function scrubEnglishJson(value, spec, context = {}) {
  if (Array.isArray(value)) return value.map((item) => scrubEnglishJson(item, spec, context));
  if (!value || typeof value !== "object") return value;
  const next = {};
  for (const [key, item] of Object.entries(value)) {
    const childContext = key === "slug" && typeof item === "string" ? { ...context, slug: item } : context;
    if (typeof item === "string") {
      if (shouldScrubText(key, item)) {
        next[key] = lookupSpanishTitle(item) ?? genericSpanishText(key, spec, context);
      } else {
        next[key] = item;
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

function targetPageId(page, spec, idMap) {
  return idMap.get(page.id) ?? `${spec.targetSiteId}_${pageSuffix(page)}`;
}

function pageTitleForSlug(slug, spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  const titles = my
    ? {
        "/": "Inicio",
        "/pricing": "Precios",
        "/collections": "Paquetes de fotos",
        "/tools": "Herramientas de fotos IA",
        "/tools/headshot": "Generador de headshots",
        "/login": "Acceso de cliente",
        "/app": "Espacio privado",
        "/app/jobs/progress": "Progreso del pedido",
        "/app/jobs/detail": "Detalle del pedido",
        "/album": "Album privado",
        "/account": "Cuenta y facturacion",
        "/help": "Centro de ayuda",
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
        "/tools/route-portrait-engine": "Motor de retratos de ruta",
        "/login": "Acceso de cliente",
        "/app": "Espacio privado",
        "/app/jobs/progress": "Progreso del pedido",
        "/app/jobs/detail": "Detalle del pedido",
        "/album": "Album privado",
        "/account": "Cuenta y facturacion",
        "/help": "Guia de soporte",
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
  if (slug.includes("cookies")) return "Politica de cookies";
  if (slug.includes("/blog/")) return "Guia";
  return titleCaseFromSlug(slug);
}

function seoForSlug(slug, spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  const common = {
    "/": [spec.homeTitle, spec.homeDescription, spec.homeKeywords],
    "/pricing": [
      `${spec.readableBrand} precios - planes y creditos para fotos con IA`,
      `Compara planes, paquetes de creditos, checkout seguro y acceso a galerias privadas antes de crear imagenes con ${spec.readableBrand}.`,
      `precios IA,creditos IA,planes de fotos IA,${spec.readableBrand}`
    ],
    "/collections": [
      my ? `Paquetes de fotos con IA | ${spec.readableBrand}` : `Paquetes de retratos de viaje con IA | ${spec.readableBrand}`,
      my
        ? `Explora paquetes de headshots, pareja, belleza, creador, deporte y retratos cinematicos con creditos visibles y albumes privados.`
        : `Explora paquetes de viaje, costa, ciudad, ruta, postal y retratos cinematicos con creditos visibles y galerias privadas.`,
      my ? `paquetes de fotos IA,headshots IA,retratos IA,album privado` : `retratos de viaje IA,paquetes de destino IA,galeria privada`
    ],
    "/tools": [
      my ? `Herramientas de fotos con IA | ${spec.readableBrand}` : `Herramientas de retratos de viaje con IA | ${spec.readableBrand}`,
      my
        ? `Usa herramientas de ${spec.readableBrand} para headshots, fondos, retoque, video corto, probador virtual y paquetes privados.`
        : `Usa herramientas de ${spec.readableBrand} para retratos de ruta, luz costera, escenas alpinas, postales y galerias privadas.`,
      my ? `herramientas IA,fotos IA,headshot IA,cambiador de fondo` : `herramientas viaje IA,retratos de ruta,luz costera IA`
    ],
    "/login": [
      `Iniciar sesion | ${spec.readableBrand}`,
      `Accede a ${spec.readableBrand} para gestionar subidas privadas, creditos, pedidos de generacion, albumes y descargas.`,
      `${spec.readableBrand} login,cuenta IA,galeria privada`
    ],
    "/app": [
      `Espacio privado | ${spec.readableBrand}`,
      `Gestiona fotos fuente, creditos, paquetes, generacion con IA y resultados privados desde tu espacio de ${spec.readableBrand}.`,
      `workspace IA,album privado,creditos IA`
    ],
    "/cart": [
      `Carrito y checkout | ${spec.readableBrand}`,
      `Revisa tu plan de creditos, saldo de cuenta y checkout seguro antes de continuar en ${spec.readableBrand}.`,
      `checkout IA,creditos IA,carrito`
    ],
    "/about-us": [
      `Sobre ${spec.readableBrand}`,
      `${spec.readableBrand} ofrece una experiencia privada para convertir fotos fuente en resultados con IA, creditos claros y galerias de cliente.`,
      `sobre ${spec.readableBrand},fotos IA privadas,galerias privadas`
    ],
    "/contact-us": [
      `Contacto | ${spec.readableBrand}`,
      `Contacta con ${spec.readableBrand} para soporte de cuenta, creditos, facturacion, privacidad, paquetes y entrega de galerias.`,
      `contacto ${spec.readableBrand},soporte IA,ayuda cuenta`
    ],
    "/help": [
      `Centro de ayuda | ${spec.readableBrand}`,
      `Resuelve dudas sobre fotos fuente, creditos, checkout, privacidad, reembolsos, paquetes y entrega privada en ${spec.readableBrand}.`,
      `ayuda ${spec.readableBrand},soporte fotos IA,creditos IA`
    ]
  };
  const fallback = common[slug] ?? [
    `${pageTitleForSlug(slug, spec)} | ${spec.readableBrand}`,
    `Consulta ${pageTitleForSlug(slug, spec).toLowerCase()} en ${spec.readableBrand}, con experiencia privada, creditos claros y flujo de generacion con IA.`,
    `${spec.readableBrand},fotos IA,creditos IA,galeria privada`
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

function patchPageJson(pageJson, slug, spec) {
  const next = clone(pageJson) ?? {};
  next.locale = "es-ES";
  next.seo = seoForSlug(slug, spec);
  const my = spec.sourceSiteId === "site_dreamshoot";
  if (slug === "/") {
    patchSection(next, "hero_1", {
      headline: my
        ? "Crea retratos de estudio y sesiones tematicas con IA desde tus selfies."
        : "Crea retratos de viaje con IA desde tus fotos cotidianas.",
      subheadline: my
        ? "Sube fotos claras una vez y crea headshots, retratos de pareja, posters, belleza, perfiles y albumes privados. Veras el coste en creditos antes de generar."
        : "Elige un destino, una luz y un ambiente; sube tus fotos y recibe albumes privados de retratos cinematicos con creditos visibles.",
      heroBadge: my ? "Estudio de paquetes de fotos IA" : "Estudio de retratos de viaje IA",
      authRibbon: "Planes desde $24.50/mes",
      authPrimaryLabel: "Continuar con email",
      authEmailPlaceholder: "Correo electronico",
      authButtonLabel: my ? "Crear mi primer set con email" : "Crear mi primer album con email",
      imageBadge: my ? "15+ categorias de paquetes" : "Rutas, costa, ciudad y destinos",
      imageCaption: my ? "Elige un paquete y genera un album privado." : "Elige una escena de viaje y genera tu galeria privada.",
      socialProofLabel: "Subidas privadas · Creditos visibles · Descarga tus favoritos",
      bulletList: my
        ? "Sube fotos claras que sean tuyas o tengas permiso para usar.|Elige headshots, pareja, creador, belleza, deporte y albumes tematicos.|Revisa creditos antes de generar.|Recibe resultados en una galeria privada."
        : "Sube fotos claras que sean tuyas o tengas permiso para usar.|Elige costa, ciudad, ruta, retiro, postal o escena editorial.|Revisa creditos antes de generar.|Recibe retratos en una galeria privada."
    });
  }
  if (slug === "/pricing") {
    patchSection(next, "pricing_intro_1", {
      eyebrow: "Precios",
      title: my ? "Planes de creditos para paquetes de fotos con IA" : "Planes de creditos para retratos de viaje",
      subtitle: "Elige creditos mensuales o recargas puntuales. Los creditos se muestran antes de cada generacion."
    });
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
      subtitle: "Empieza con una herramienta, revisa el resultado esperado y continua al espacio privado."
    });
  }
  if (slug === "/login") {
    patchSection(next, "login_1", {
      eyebrow: "Acceso de cliente",
      title: `Inicia sesion para gestionar ${spec.readableBrand}.`,
      subtitle: "Tus subidas, creditos, pedidos y albumes permanecen dentro de tu cuenta privada."
    });
  }
  if (slug === "/app") {
    patchSection(next, "launcher_1", {
      eyebrow: "Espacio privado",
      title: my ? "Crea fotos privadas con IA desde tus subidas." : "Crea retratos de viaje desde tus subidas.",
      subtitle: "Prepara fotos fuente, elige un paquete, revisa creditos y sigue el progreso desde una sola cuenta."
    });
  }
  if (slug === "/about-us") {
    patchSection(next, "about_intro_1", {
      eyebrow: "Sobre nosotros",
      title: `Sobre ${spec.readableBrand}`,
      subtitle: spec.description
    });
  }
  if (slug === "/contact-us") {
    patchSection(next, "contact_intro_1", {
      eyebrow: "Contacto",
      title: `Contacta con ${spec.readableBrand}`,
      subtitle: `Escribenos para soporte de cuenta, creditos, paquetes, privacidad o entrega de galerias.`
    });
  }
  patchBlocksByHref(next, spec);
  return scrubEnglishJson(next, spec, { slug });
}

function patchSettingsJson(settings, spec, idMap, pages) {
  const next = spanishizeJson(clone(settings) ?? {}, spec, idMap);
  next.locale = "es-ES";
  next.navigation = next.navigation ?? {};
  next.navigation.headerLinks = spec.headerLinks.map(([label, href]) => ({ label, href }));
  next.navigation.footerLinks = spec.footerLinks.map(([label, href, group]) => ({ label, href, group }));
  next.seo = {
    siteTitle: spec.readableBrand,
    siteDescription: spec.description,
    siteKeywords: spec.homeKeywords,
    titleTemplate: `%s | ${spec.readableBrand}`,
    defaultOgImage: spec.defaultOgImage,
    robots: { index: true, follow: true },
    pages: Object.fromEntries(pages.map((page) => [page.id, seoForSlug(page.slug, spec)]))
  };
  next.globalSections = next.globalSections ?? {};
  next.globalSections.header = next.globalSections.header ?? { type: "header", settings: {}, blocks: [] };
  next.globalSections.header.settings = {
    ...(next.globalSections.header.settings ?? {}),
    title: spec.readableBrand,
    ctaLabel: spec.sourceSiteId === "site_dreamshoot" ? "Crear mi primer set" : "Empezar un paquete",
    ctaHref: "/login",
    mobileLabel: "Menu",
    announcement:
      spec.sourceSiteId === "site_dreamshoot"
        ? "Crea sets privados de fotos con IA desde selfies cotidianos."
        : "Crea retratos de viaje con IA desde tus fotos cotidianas."
  };
  next.globalSections.header.blocks = (next.globalSections.header.blocks ?? []).map((block) => {
    const label = spec.headerLinks.find(([, href]) => block.settings?.href === href)?.[0];
    return label ? { ...block, settings: { ...(block.settings ?? {}), label } } : block;
  });
  next.globalSections.footer = next.globalSections.footer ?? { type: "footer", settings: {}, blocks: [] };
  next.globalSections.footer.settings = {
    ...(next.globalSections.footer.settings ?? {}),
    title: spec.readableBrand,
    tagline: spec.sourceSiteId === "site_dreamshoot"
      ? "Sets privados de fotos con IA, creditos visibles y galerias seguras."
      : "Retratos de viaje con IA y albumes privados desde tus fotos.",
    body: spec.description,
    productHeading: "Explorar",
    companyHeading: "Contenido",
    supportHeading: "Soporte",
    socialHeading: "Por que funciona",
    socialBody: "Subidas privadas, creditos visibles, checkout claro y entrega dentro de una sola cuenta.",
    contactEmail: spec.supportEmail,
    salesEmail: "",
    bottomLine: "Creditos, generacion y galerias privadas en un solo espacio.",
    copyright: `© 2026 ${spec.readableBrand}. Todos los derechos reservados.`
  };
  next.globalSections.footer.blocks = spec.footerLinks.map(([label, href, group], index) => ({
    id: `${spec.targetToken}_footer_${group}_${index + 1}`,
    type: "menu_link",
    settings: { label, href, group }
  }));
  return scrubEnglishJson(next, spec, { slug: "/settings" });
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

function buildDataset(source, spec) {
  const idMap = buildIdMaps(source, spec);
  const branding = {
    ...(source.branding && typeof source.branding === "object" && !Array.isArray(source.branding) ? clone(source.branding) : {}),
    logoText: spec.readableBrand,
    market: spec.market,
    description: spec.description
  };
  const pages = source.pages
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((page) => {
      const draftJson = patchPageJson(spanishizeJson(page.draftJson, spec, idMap), page.slug, spec);
      const publishedJson = patchPageJson(spanishizeJson(page.publishedJson, spec, idMap), page.slug, spec);
      return {
        id: targetPageId(page, spec, idMap),
        siteId: spec.targetSiteId,
        pageType: page.pageType,
        templateKey: page.templateKey,
        slug: page.slug,
        title: pageTitleForSlug(page.slug, spec),
        draftJson,
        publishedJson
      };
    });
  const settings = source.settings
    ? {
        id: `settings_${spec.targetSiteId}`,
        siteId: spec.targetSiteId,
        draftJson: patchSettingsJson(source.settings.draftJson, spec, idMap, pages),
        publishedJson: patchSettingsJson(source.settings.publishedJson, spec, idMap, pages)
      }
    : undefined;
  const products = source.products.map((product) => {
    const productId = idMap.get(product.id);
    return {
      id: productId,
      siteId: spec.targetSiteId,
      name: spanishTitle(product.name),
      type: product.type,
      status: product.status,
      prices: product.prices.map((price) => ({
        id: idMap.get(price.id),
        siteId: spec.targetSiteId,
        productId,
        label: spanishTitle(price.label),
        amountCents: price.amountCents,
        currency: price.currency,
        interval: price.interval,
        creditsGranted: price.creditsGranted,
        stripePriceId: `manual_${idMap.get(price.id)}`,
        metadata: spanishizeJson(price.metadata, spec, idMap)
      }))
    };
  });
  const creativePackCategories = sortByParent(source.creativePackCategories).map((category) => {
    const label = spanishTitle(category.label || category.slug);
    return {
      id: idMap.get(category.id),
      siteId: spec.targetSiteId,
      parentId: category.parentId ? idMap.get(category.parentId) : null,
      slug: category.slug,
      label,
      description:
        spec.sourceSiteId === "site_dreamshoot"
          ? `Paquetes de ${label.toLowerCase()} con fotos fuente privadas, creditos visibles y entrega en galeria.`
          : `Retratos de ${label.toLowerCase()} con ambiente de viaje, creditos visibles y entrega privada.`,
      heroTitle: spec.sourceSiteId === "site_dreamshoot" ? `${label} con IA` : `${label} con estilo de viaje`,
      heroSubtitle:
        spec.sourceSiteId === "site_dreamshoot"
          ? "Elige el estilo, revisa creditos y genera un album privado."
          : "Elige la ruta visual, revisa creditos y genera una galeria privada.",
      icon: category.icon,
      imageUrl: category.imageUrl,
      sortOrder: category.sortOrder,
      status: category.status
    };
  });
  const creativePacks = source.creativePacks.map((pack) => {
    const name = spanishTitle(pack.name || pack.category);
    return {
      id: idMap.get(pack.id),
      siteId: spec.targetSiteId,
      categoryId: pack.categoryId ? idMap.get(pack.categoryId) : null,
      name,
      headline: name,
      description:
        spec.sourceSiteId === "site_dreamshoot"
          ? `Crea ${name.toLowerCase()} con ${spec.readableBrand}: sube fotos claras, revisa creditos y recibe resultados en un album privado.`
          : `Crea ${name.toLowerCase()} con ${spec.readableBrand}: elige ambiente de destino, revisa creditos y recibe una galeria privada.`,
      prompt: spanishizeString(pack.prompt ?? "", spec, idMap) || null,
      category: pack.category,
      aiAppSlug: pack.aiAppSlug,
      status: pack.status,
      creditCost: pack.creditCost,
      outputCount: pack.outputCount,
      trainingRequired: pack.trainingRequired,
      generationCount: pack.generationCount,
      conversionRate: pack.conversionRate,
      imageUrl: pack.imageUrl,
      galleryImages: spanishizeJson(pack.galleryImages, spec, idMap)
    };
  });
  const toolCategories = sortByParent(source.toolCategories).map((category) => {
    const label = spanishTitle(category.label || category.slug);
    return {
      id: idMap.get(category.id),
      siteId: spec.targetSiteId,
      parentId: category.parentId ? idMap.get(category.parentId) : null,
      slug: category.slug,
      label,
      description: spec.sourceSiteId === "site_dreamshoot"
        ? `Herramientas para ${label.toLowerCase()}, edicion y creacion privada con IA.`
        : `Herramientas para ${label.toLowerCase()}, escenas de viaje y galerias privadas con IA.`,
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
      description:
        spec.sourceSiteId === "site_dreamshoot"
          ? `Usa ${title.toLowerCase()} para transformar subidas privadas en resultados listos para perfiles, contenido o albumes.`
          : `Usa ${title.toLowerCase()} para preparar retratos de viaje, escenas de destino y galerias privadas.`,
      badge: spanishizeString(item.badge ?? "", spec, idMap) || null,
      icon: item.icon,
      imageUrl: item.imageUrl,
      href: item.href,
      detailJson: spanishizeJson(item.detailJson, spec, idMap),
      sortOrder: item.sortOrder,
      status: item.status
    };
  });
  const mediaAssets = source.mediaAssets.map((asset) => ({
    id: idMap.get(asset.id),
    siteId: spec.targetSiteId,
    label: spanishTitle(asset.label || asset.storageKey),
    storageKey: asset.storageKey,
    mimeType: asset.mimeType,
    usageType: asset.usageType,
    sourceType: asset.sourceType,
    previewUrl: asset.previewUrl,
    originUrl: asset.originUrl,
    altText: asset.altText ? spanishizeString(asset.altText, spec, idMap) : null,
    notes: asset.notes ? spanishizeString(asset.notes, spec, idMap) : null
  }));
  const siteAiApps = source.aiApps.map((app) => ({
    id: idMap.get(app.id),
    siteId: spec.targetSiteId,
    aiAppId: app.aiAppId,
    aiApp: app.aiApp ? clone(app.aiApp) : undefined,
    enabled: app.enabled,
    creditCost: app.creditCost,
    routeKey: app.routeKey,
    workflowConfig: spanishizeJson(app.workflowConfig, spec, idMap),
    providerConfig: spanishizeJson(app.providerConfig, spec, idMap)
  }));
  const gatewayGroups = source.gatewayGroups.map((group) => ({
    id: idMap.get(group.id),
    siteId: spec.targetSiteId,
    name: `${spec.readableBrand} image quota`,
    status: group.status,
    modelAllowlist: clone(group.modelAllowlist) ?? [],
    monthlyQuota: group.monthlyQuota,
    usedQuota: 0,
    retryStatusCodes: clone(group.retryStatusCodes) ?? [],
    rateLimitPerMinute: group.rateLimitPerMinute,
    accountPoolMode: group.accountPoolMode,
    unavailableReason: group.unavailableReason ? spanishizeString(group.unavailableReason, spec, idMap) : null
  }));
  const siteThemes = source.siteThemes.map((theme) => ({
    id: idMap.get(theme.id),
    siteId: spec.targetSiteId,
    name: `${spec.readableBrand} ${theme.status === "published" ? "Publicado" : "Borrador"}`,
    themeId: mapId(theme.themeId, spec, "theme_id", theme.themeKey),
    themeKey: theme.themeKey,
    status: theme.status,
    templates: scrubEnglishJson(spanishizeJson(theme.templates, spec, idMap), spec, { slug: "/theme" }),
    settings: patchSettingsJson(theme.settings, spec, idMap, pages),
    source: theme.source,
    createdBy: theme.createdBy
  }));
  const themePublications = source.publications.length
    ? source.publications.map((publication) => {
        const snapshot = scrubEnglishJson(spanishizeJson(publication.snapshot, spec, idMap), spec, { slug: "/publication" });
        return {
          id: idMap.get(publication.id),
          siteId: spec.targetSiteId,
          version: publication.version,
          snapshot,
          pageCount: publication.pageCount,
          sectionCount: publication.sectionCount,
          snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot), "utf8"),
          publishedBy: publication.publishedBy || "platform",
          publishedAt: nowIso
        };
      })
    : [
        {
          id: `pub_${spec.targetToken}_v1`,
          siteId: spec.targetSiteId,
          version: 1,
          snapshot: {
            siteId: spec.targetSiteId,
            settings: settings?.publishedJson,
            pages: pages.map((page) => ({ id: page.id, slug: page.slug, publishedJson: page.publishedJson }))
          },
          pageCount: pages.length,
          sectionCount: pages.reduce((sum, page) => sum + Object.keys(page.publishedJson?.sections ?? {}).length, 0),
          snapshotBytes: 0,
          publishedBy: "platform",
          publishedAt: nowIso
        }
      ];
  for (const publication of themePublications) {
    if (!publication.snapshotBytes) publication.snapshotBytes = Buffer.byteLength(JSON.stringify(publication.snapshot), "utf8");
  }
  const ownerAdmin = source.admins.find((admin) => admin.role === "owner") ?? source.admins[0];
  const admins = source.admins.map((admin, index) => {
    const isOwner = admin.id === ownerAdmin?.id || admin.role === "owner";
    const email = isOwner ? `owner@${spec.targetSlug}.localhost` : admin.email;
    return {
      id: isOwner ? `admin_${spec.targetToken}_owner` : `admin_${spec.targetToken}_${safeSlug(email)}`,
      siteId: spec.targetSiteId,
      email,
      passwordHash: admin.passwordHash,
      displayName: isOwner ? `${spec.readableBrand} Owner` : admin.displayName || `Admin ${index + 1}`,
      role: admin.role
    };
  });
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
    connect: {
      stripeAccountId: `acct_${spec.targetToken}_local`,
      status: source.connect?.onboardingStatus ?? "ready",
      chargesEnabled: Boolean(source.connect?.chargesEnabled ?? true),
      payoutsEnabled: Boolean(source.connect?.payoutsEnabled ?? true)
    },
    themeSettings: settings ? { draftJson: settings.draftJson, publishedJson: settings.publishedJson } : undefined,
    pages
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
    admins,
    settings,
    pages,
    products,
    siteAiApps,
    gatewayGroups,
    creativePackCategories,
    creativePacks,
    toolCategories,
    toolMenuItems,
    mediaAssets,
    siteThemes,
    themePublications
  };
}

async function fetchSource(siteId) {
  const source = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      domains: true,
      admins: { orderBy: { createdAt: "asc" } },
      connect: true,
      settings: true,
      pages: { orderBy: [{ slug: "asc" }, { id: "asc" }] },
      products: { include: { prices: { orderBy: [{ interval: "asc" }, { id: "asc" }] } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      aiApps: { include: { aiApp: true }, orderBy: [{ routeKey: "asc" }, { id: "asc" }] },
      gatewayGroups: { orderBy: [{ name: "asc" }, { id: "asc" }] },
      creativePackCategories: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      creativePacks: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      toolCategories: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      toolMenuItems: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      mediaAssets: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      siteThemes: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      publications: { orderBy: [{ version: "asc" }] }
    }
  });
  if (!source) throw new Error(`Missing source site ${siteId}`);
  if (!source.settings) throw new Error(`Missing theme settings for ${siteId}`);
  return source;
}

async function clearConfigRowsForSite(siteId) {
  await prisma.auditLog.deleteMany({ where: { siteId, action: "site.spanish_xby.sync" } });
  await prisma.themePublication.deleteMany({ where: { siteId } });
  await prisma.siteTheme.deleteMany({ where: { siteId } });
  await prisma.mediaAsset.deleteMany({ where: { siteId } });
  await prisma.toolMenuItem.deleteMany({ where: { siteId } });
  await prisma.toolCategory.deleteMany({ where: { siteId } });
  await prisma.creativePack.updateMany({ where: { siteId }, data: { categoryId: null } });
  await prisma.creativePack.deleteMany({ where: { siteId } });
  await prisma.creativePackCategory.deleteMany({ where: { siteId } });
  await prisma.aiGatewayGroup.deleteMany({ where: { siteId } });
  await prisma.siteAiApp.deleteMany({ where: { siteId } });
  await prisma.price.deleteMany({ where: { siteId } });
  await prisma.product.deleteMany({ where: { siteId } });
  await prisma.themePage.deleteMany({ where: { siteId } });
  await prisma.themeSettings.deleteMany({ where: { siteId } });
  await prisma.siteAdmin.deleteMany({ where: { siteId } });
  await prisma.siteDomain.deleteMany({ where: { siteId } });
  await prisma.stripeConnectAccount.deleteMany({ where: { siteId } });
}

async function upsertDataset(dataset) {
  const { site } = dataset;
  await prisma.site.upsert({
    where: { id: site.id },
    create: {
      id: site.id,
      name: site.name,
      slug: site.slug,
      status: site.status,
      primaryDomain: site.primaryDomain,
      timezone: site.timezone,
      currency: site.currency,
      signupCreditGrant: site.signupCreditGrant,
      branding: site.branding
    },
    update: {
      name: site.name,
      slug: site.slug,
      status: site.status,
      primaryDomain: site.primaryDomain,
      timezone: site.timezone,
      currency: site.currency,
      signupCreditGrant: site.signupCreditGrant,
      branding: site.branding
    }
  });
  await prisma.stripeConnectAccount.upsert({
    where: { siteId: site.id },
    create: {
      id: `connect_${site.id}`,
      siteId: site.id,
      stripeAccountId: site.connect.stripeAccountId,
      onboardingStatus: site.connect.status,
      chargesEnabled: site.connect.chargesEnabled,
      payoutsEnabled: site.connect.payoutsEnabled
    },
    update: {
      stripeAccountId: site.connect.stripeAccountId,
      onboardingStatus: site.connect.status,
      chargesEnabled: site.connect.chargesEnabled,
      payoutsEnabled: site.connect.payoutsEnabled
    }
  });
  for (const domain of dataset.domains) {
    await prisma.siteDomain.upsert({
      where: { id: domain.id },
      create: domain,
      update: {
        domain: domain.domain,
        isPrimary: domain.isPrimary,
        status: domain.status,
        allowedAiProviderIds: domain.allowedAiProviderIds
      }
    });
  }
  for (const admin of dataset.admins) {
    await prisma.siteAdmin.upsert({
      where: { id: admin.id },
      create: admin,
      update: {
        email: admin.email,
        passwordHash: admin.passwordHash,
        displayName: admin.displayName,
        role: admin.role
      }
    });
  }
  if (dataset.settings) {
    await prisma.themeSettings.upsert({
      where: { siteId: site.id },
      create: dataset.settings,
      update: {
        draftJson: dataset.settings.draftJson,
        publishedJson: dataset.settings.publishedJson
      }
    });
  }
  for (const page of dataset.pages) {
    await prisma.themePage.upsert({
      where: { siteId_slug: { siteId: page.siteId, slug: page.slug } },
      create: page,
      update: {
        pageType: page.pageType,
        templateKey: page.templateKey,
        title: page.title,
        draftJson: page.draftJson,
        publishedJson: page.publishedJson
      }
    });
  }
  for (const product of dataset.products) {
    await prisma.product.upsert({
      where: { id: product.id },
      create: {
        id: product.id,
        siteId: product.siteId,
        name: product.name,
        type: product.type,
        status: product.status
      },
      update: {
        name: product.name,
        type: product.type,
        status: product.status
      }
    });
    for (const price of product.prices) {
      await prisma.price.upsert({
        where: { id: price.id },
        create: price,
        update: {
          label: price.label,
          amountCents: price.amountCents,
          currency: price.currency,
          interval: price.interval,
          creditsGranted: price.creditsGranted,
          stripePriceId: price.stripePriceId,
          metadata: price.metadata
        }
      });
    }
  }
  for (const app of dataset.siteAiApps) {
    await prisma.siteAiApp.upsert({
      where: { id: app.id },
      create: {
        id: app.id,
        siteId: app.siteId,
        aiAppId: app.aiAppId,
        enabled: app.enabled,
        creditCost: app.creditCost,
        routeKey: app.routeKey,
        workflowConfig: app.workflowConfig,
        providerConfig: app.providerConfig
      },
      update: {
        enabled: app.enabled,
        creditCost: app.creditCost,
        routeKey: app.routeKey,
        workflowConfig: app.workflowConfig,
        providerConfig: app.providerConfig
      }
    });
  }
  for (const group of dataset.gatewayGroups) {
    await prisma.aiGatewayGroup.upsert({
      where: { id: group.id },
      create: group,
      update: {
        name: group.name,
        status: group.status,
        modelAllowlist: group.modelAllowlist,
        monthlyQuota: group.monthlyQuota,
        usedQuota: group.usedQuota,
        retryStatusCodes: group.retryStatusCodes,
        rateLimitPerMinute: group.rateLimitPerMinute,
        accountPoolMode: group.accountPoolMode,
        unavailableReason: group.unavailableReason
      }
    });
  }
  for (const category of dataset.creativePackCategories) {
    await prisma.creativePackCategory.upsert({
      where: { id: category.id },
      create: category,
      update: {
        parentId: category.parentId,
        slug: category.slug,
        label: category.label,
        description: category.description,
        heroTitle: category.heroTitle,
        heroSubtitle: category.heroSubtitle,
        icon: category.icon,
        imageUrl: category.imageUrl,
        sortOrder: category.sortOrder,
        status: category.status
      }
    });
  }
  for (const pack of dataset.creativePacks) {
    await prisma.creativePack.upsert({
      where: { id: pack.id },
      create: pack,
      update: {
        categoryId: pack.categoryId,
        name: pack.name,
        headline: pack.headline,
        description: pack.description,
        prompt: pack.prompt,
        category: pack.category,
        aiAppSlug: pack.aiAppSlug,
        status: pack.status,
        creditCost: pack.creditCost,
        outputCount: pack.outputCount,
        trainingRequired: pack.trainingRequired,
        generationCount: pack.generationCount,
        conversionRate: pack.conversionRate,
        imageUrl: pack.imageUrl,
        galleryImages: pack.galleryImages
      }
    });
  }
  for (const category of dataset.toolCategories) {
    await prisma.toolCategory.upsert({
      where: { id: category.id },
      create: category,
      update: {
        parentId: category.parentId,
        slug: category.slug,
        label: category.label,
        description: category.description,
        icon: category.icon,
        sortOrder: category.sortOrder,
        status: category.status
      }
    });
  }
  for (const item of dataset.toolMenuItems) {
    await prisma.toolMenuItem.upsert({
      where: { id: item.id },
      create: item,
      update: {
        categoryId: item.categoryId,
        slug: item.slug,
        title: item.title,
        description: item.description,
        badge: item.badge,
        icon: item.icon,
        imageUrl: item.imageUrl,
        href: item.href,
        detailJson: item.detailJson,
        sortOrder: item.sortOrder,
        status: item.status
      }
    });
  }
  for (const asset of dataset.mediaAssets) {
    await prisma.mediaAsset.upsert({
      where: { id: asset.id },
      create: asset,
      update: {
        label: asset.label,
        storageKey: asset.storageKey,
        mimeType: asset.mimeType,
        usageType: asset.usageType,
        sourceType: asset.sourceType,
        previewUrl: asset.previewUrl,
        originUrl: asset.originUrl,
        altText: asset.altText,
        notes: asset.notes
      }
    });
  }
  for (const theme of dataset.siteThemes) {
    await prisma.siteTheme.upsert({
      where: { id: theme.id },
      create: theme,
      update: {
        name: theme.name,
        themeId: theme.themeId,
        themeKey: theme.themeKey,
        status: theme.status,
        templates: theme.templates,
        settings: theme.settings,
        source: theme.source,
        createdBy: theme.createdBy
      }
    });
  }
  for (const publication of dataset.themePublications) {
    await prisma.themePublication.upsert({
      where: { siteId_version: { siteId: publication.siteId, version: publication.version } },
      create: {
        id: publication.id,
        siteId: publication.siteId,
        version: publication.version,
        snapshot: publication.snapshot,
        pageCount: publication.pageCount,
        sectionCount: publication.sectionCount,
        snapshotBytes: publication.snapshotBytes,
        publishedBy: publication.publishedBy,
        publishedAt: new Date(publication.publishedAt)
      },
      update: {
        snapshot: publication.snapshot,
        pageCount: publication.pageCount,
        sectionCount: publication.sectionCount,
        snapshotBytes: publication.snapshotBytes,
        publishedBy: publication.publishedBy,
        publishedAt: new Date(publication.publishedAt)
      }
    });
  }
  await prisma.auditLog.create({
    data: {
      id: `audit_${dataset.spec.targetToken}_${Date.now()}`,
      siteId: site.id,
      actorId: "platform",
      actorType: "platform",
      action: "site.spanish_xby.sync",
      targetType: "site",
      targetId: site.id,
      metadata: {
        sourceSiteId: dataset.spec.sourceSiteId,
        targetSlug: dataset.spec.targetSlug,
        pages: dataset.pages.length,
        products: dataset.products.length,
        creativePacks: dataset.creativePacks.length,
        tools: dataset.toolMenuItems.length
      }
    }
  });
}

function removeSiteScopedRows(state, siteIds) {
  const scopedKeys = [
    "siteDomains",
    "siteAdmins",
    "products",
    "siteAiApps",
    "aiGatewayGroups",
    "creativePacks",
    "mediaAssets",
    "siteThemes",
    "themePublications",
    "creativePackCategories",
    "toolCategories",
    "toolMenuItems"
  ];
  state.sites = (state.sites ?? []).filter((item) => !siteIds.has(item.id));
  for (const key of scopedKeys) state[key] = (state[key] ?? []).filter((item) => !siteIds.has(item.siteId));
}

function mergeState(datasets) {
  if (!fs.existsSync(statePath)) throw new Error(`Missing local state file: ${statePath}`);
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const targetIds = new Set(datasets.map((dataset) => dataset.site.id));
  removeSiteScopedRows(state, targetIds);
  for (const dataset of datasets) {
    state.sites.push(dataset.site);
    state.siteDomains.push(...dataset.domains);
    state.siteAdmins.push(...dataset.admins.map((admin) => ({ ...admin, createdAt: nowIso })));
    state.products.push(...dataset.products);
    state.siteAiApps.push(...dataset.siteAiApps);
    state.aiGatewayGroups.push(...dataset.gatewayGroups);
    state.creativePackCategories.push(...dataset.creativePackCategories);
    state.creativePacks.push(...dataset.creativePacks);
    state.toolCategories.push(...dataset.toolCategories);
    state.toolMenuItems.push(...dataset.toolMenuItems);
    state.mediaAssets.push(...dataset.mediaAssets);
    state.siteThemes.push(...dataset.siteThemes);
    state.themePublications.push(...dataset.themePublications);
  }
  return state;
}

function summarize(dataset) {
  return {
    siteId: dataset.site.id,
    slug: dataset.site.slug,
    domain: dataset.site.primaryDomain,
    pages: dataset.pages.length,
    products: dataset.products.length,
    prices: dataset.products.reduce((sum, product) => sum + product.prices.length, 0),
    creativePackCategories: dataset.creativePackCategories.length,
    creativePacks: dataset.creativePacks.length,
    toolCategories: dataset.toolCategories.length,
    toolMenuItems: dataset.toolMenuItems.length,
    mediaAssets: dataset.mediaAssets.length,
    siteThemes: dataset.siteThemes.length,
    themePublications: dataset.themePublications.length
  };
}

async function main() {
  const datasets = [];
  for (const spec of specs) {
    const source = await fetchSource(spec.sourceSiteId);
    datasets.push(buildDataset(source, spec));
  }
  if (!dryRun) {
    for (const dataset of datasets) await clearConfigRowsForSite(dataset.site.id);
    for (const dataset of datasets) await upsertDataset(dataset);
    const nextState = mergeState(datasets);
    fs.writeFileSync(statePath, `${JSON.stringify(nextState, null, 2)}\n`);
  }
  console.log(JSON.stringify({ ok: true, dryRun, statePath, sites: datasets.map(summarize) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
