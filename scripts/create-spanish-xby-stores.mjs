import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const statePath = path.resolve(process.cwd(), "data/platform-state.json");
const dryRun = process.argv.includes("--dry-run");
const stateOnly = process.argv.includes("--state-only");
const now = new Date();
const nowIso = now.toISOString();

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
      ["Ver paquetes", "/collections"],
      ["Herramientas", "/tools"],
      ["Como funciona", "/workflow"],
      ["Precios", "/pricing"],
      ["Preguntas", "/faq"]
    ],
    footerLinks: [
      ["Ver paquetes", "/collections", "product"],
      ["Herramientas", "/tools", "product"],
      ["Como funciona", "/workflow", "product"],
      ["Precios", "/pricing", "product"],
      ["Centro de ayuda", "/faq", "company"],
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
    targetSlug: "aidreamcapes-eu",
    targetDomain: "aidreamcapes.eu",
    name: "AIdreamcapes",
    readableBrand: "AIdreamcapes",
    supportEmail: "support@aidreamcapes.eu",
    market: "Retratos de viaje con IA, escenas de destino, paquetes cinematograficos, creditos y galerias privadas",
    description:
      "AIdreamcapes es una tienda en espanol para crear retratos de viaje, escenas de destino, albumes cinematicos y recuerdos privados con IA.",
    homeTitle: "AIdreamcapes - generador de retratos de viaje con IA",
    homeDescription:
      "Transforma tus fotos favoritas en retratos de viaje profesionales con AIdreamcapes. Elige destino, ambiente y estilo desde casa con galerias privadas.",
    homeKeywords:
      "retratos de viaje IA,fotos de viaje IA,generador de fotos IA,albumes de destino,retratos cinematicos,AIdreamcapes",
    defaultOgImage: "/assets/sites/site_aidreamcapes_eu/creative-packs/destination-story.webp?v=20260717a",
    logoImageUrl: "/assets/sites/site_aidreamcapes_eu/brand/aidreamcapes-logo-refined.svg?v=20260717a",
    headerLinks: [
      ["Paquetes de viaje", "/collections"],
      ["Herramientas", "/tools"],
      ["Como funciona", "/workflow"],
      ["Ejemplos", "/collections"],
      ["Ayuda", "/faq"]
    ],
    footerLinks: [
      ["Paquetes de viaje", "/collections", "product"],
      ["Motor de retratos de ruta", "/tools/route-portrait-engine", "product"],
      ["Precios", "/pricing", "product"],
      ["Notas de viaje", "/blog", "company"],
      ["Sobre el estudio", "/about-us", "company"],
      ["Contacto del estudio", "/contact-us", "company"],
      ["Centro de ayuda", "/faq", "support"],
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
    "aidreamcapes island resort scene cover": "Portada de resort isleno AIdreamcapes",
    "aidreamcapes cinematic travel portrait hero": "Heroe cinematico de retrato de viaje AIdreamcapes"
  })
);

const phrasePairs = [
  ["MyDreamShoots", "AIdreamshoots"],
  ["MydreamShoots", "AIdreamshoots"],
  ["Mydreamshoots", "AIdreamshoots"],
  ["DreamShootAI", "AIdreamshoots"],
  ["Aidreamcapes", "AIdreamcapes"],
  ["Browse packages", "Ver paquetes"],
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
  if (spec.sourceSiteId === "site_dreamshoot") {
    next = next.replaceAll("professional-headshots", "headshots").replaceAll("professional_headshots", "headshots");
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

function rewriteBrandContactText(value, spec) {
  return String(value ?? "")
    .replaceAll("support@mydreamshoots.com", spec.supportEmail)
    .replaceAll("sales@mydreamshoots.com", spec.supportEmail)
    .replaceAll("support@aidreamcapes.com", spec.supportEmail)
    .replaceAll("sales@aidreamcapes.com", spec.supportEmail)
    .replaceAll("www.mydreamshoots.com", spec.targetDomain)
    .replaceAll("mydreamshoots.com", spec.targetDomain)
    .replaceAll("www.aidreamcapes.com", spec.targetDomain)
    .replaceAll("aidreamcapes.com", spec.targetDomain);
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
      .replaceAll("/assets/dreamshoot/generated/pack-galleries/", "/assets/sites/site_aidreamshoots/creative-packs/pack-galleries/")
      .replaceAll("/assets/dreamshoot/generated/category-covers/mydreamshoots/", "/assets/sites/site_aidreamshoots/creative-packs/category-covers/")
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

function spanishMediaStorageKey(asset, spec) {
  const raw = String(asset.storageKey || asset.label || asset.id || "media").replace(/\\/g, "/");
  const ext = path.extname(raw).toLowerCase() || ".png";
  const name = path.basename(raw, ext) || asset.label || asset.id || "media";
  return `sites/${spec.targetSiteId}/theme/${safeSlug(`${spec.readableBrand}-${name}`)}${ext}`;
}

function spanishizeString(value, spec, idMap) {
  let next = normalizeXbyArtifacts(rewriteFunctionalHref(rewriteIds(value, idMap, spec), spec), spec);
  if (isFunctionalString(next)) return next;
  const directTitle = lookupSpanishTitle(next);
  if (directTitle) return directTitle;
  for (const [from, to] of phrasePairs) next = next.replaceAll(from, to);
  return normalizeXbyArtifacts(collapseBrandRepeats(next), spec);
}

function spanishizeJson(value, spec, idMap) {
  if (Array.isArray(value)) return value.map((item) => spanishizeJson(item, spec, idMap));
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? spanishizeString(value, spec, idMap) : value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, spanishizeJson(item, spec, idMap)]));
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
    ctaLabel: spec.sourceSiteId === "site_dreamshoot" ? "Crear mi primer set" : "Empezar un paquete",
    ctaHref: "/login",
    mobileLabel: "Menu",
    announcement:
      spec.sourceSiteId === "site_dreamshoot"
        ? "Crea sets privados de fotos con IA desde selfies cotidianos."
        : "Crea retratos de viaje con IA desde tus fotos cotidianas."
  };
}

function spanishFooterSettings(spec) {
  return {
    title: spec.readableBrand,
    logoImageUrl: spec.logoImageUrl,
    tagline: spec.sourceSiteId === "site_dreamshoot"
      ? "Sets privados de fotos con IA, creditos visibles y galerias seguras."
      : "Retratos de viaje con IA y albumes privados desde tus fotos.",
    body: spec.description,
    productHeading: "Explorar",
    companyHeading: "Contenido",
    supportHeading: "Soporte",
    socialHeading: "Por que funciona",
    socialBody: "Subidas privadas, creditos visibles, pago claro y entrega dentro de una sola cuenta.",
    contactEmail: spec.supportEmail,
    companyName: "",
    contactAddress: "",
    contactPhone: "",
    taxId: "",
    taxIdLabel: "",
    salesEmail: "",
    instagramUrl: "",
    facebookUrl: "",
    pinterestUrl: "",
    youtubeUrl: "",
    twitterUrl: "",
    bottomLine: "Creditos, generacion y galerias privadas en un solo espacio.",
    copyright: `© 2026 ${spec.readableBrand}. Todos los derechos reservados.`
  };
}

function spanishHeaderBlocks(blocks, spec) {
  const my = spec.sourceSiteId === "site_dreamshoot";
  return (blocks ?? []).map((block, index) => {
    const settings = block.settings ?? {};
    const href = typeof settings.href === "string" ? settings.href : "";
    const description = typeof settings.description === "string" ? settings.description : "";
    const looksLikeToolCard = href.startsWith("/tools") || /Input:|Output:|Cost:|you own/i.test(description);
    if (!looksLikeToolCard) {
      const label = spec.headerLinks.find(([, linkHref]) => settings.href === linkHref)?.[0];
      return label ? { ...block, settings: { ...settings, label } } : block;
    }
    const title = spanishTitle(settings.title ?? settings.label ?? `Herramienta ${index + 1}`);
    return {
      ...block,
      settings: {
        ...settings,
        title,
        label: settings.label ? spanishTitle(settings.label) : title,
        description: spanishToolCardDescription(title, spec),
        category: my ? "Fotos IA" : "Retratos de viaje",
        badge: spanishTitle(settings.badge ?? (my ? "Herramienta" : "Ruta"))
      }
    };
  });
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
  /\b(the|and|for|with|from|your|private|photo|photos|portrait|portraits|tool|tools|create|choose|upload|uploads|credits|gallery|workspace|packages|pricing|checkout|review|download|discover|every|before|after|source|account|customer|album|albums|travel|studio|profile|generator|builder|maker|route|scene|scenes|plans|monthly|yearly|start|view|return|support|privacy|terms|cookie|content|help|search|cart|use|case|cases|featured|personal|model|video)\b/i;

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

function looksSpanishText(value) {
  const text = String(value ?? "");
  return spanishSignalPattern.test(text);
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

function spanishPageSlug(slug) {
  return slug === "/help" ? "/faq" : slug;
}

function spanishDreamshootCategorySlug(slug, spec) {
  const raw = String(slug ?? "");
  if (spec.sourceSiteId !== "site_dreamshoot") return raw;
  const normalized = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized === "professional-headshots" ? "headshots" : raw;
}

function spanishDreamshootPackCategory(category, spec) {
  const raw = String(category ?? "");
  if (spec.sourceSiteId !== "site_dreamshoot") return raw;
  const normalized = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized === "professional-headshots" || normalized === "professional-headshot" ? "headshots" : raw;
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
  return idMap.get(page.id) ?? `${spec.targetSiteId}_${pageSuffix(page)}`;
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
  return titleCaseFromSlug(slug);
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

function patchPageJson(pageJson, slug, spec) {
  slug = spanishPageSlug(slug);
  const next = clone(pageJson) ?? {};
  next.locale = "es-ES";
  next.seo = seoForSlug(slug, spec);
  const my = spec.sourceSiteId === "site_dreamshoot";
  const copy = xbyPageCopy(slug, spec);
  patchPolicyPage(next, slug, spec);
  patchSpanishXbyCommonSections(next, slug, spec);
  if (slug === "/") {
    patchSection(next, "hero_1", {
      headline: my
        ? "Crea retratos de estudio y sesiones tematicas con IA desde tus selfies."
        : "Crea retratos de viaje con IA desde tus fotos cotidianas.",
      subheadline: my
        ? "Sube fotos claras una vez y crea retratos profesionales, retratos de pareja, carteles, belleza, perfiles y albumes privados. Veras el coste en creditos antes de generar."
        : "Elige un destino, una luz y un ambiente; sube tus fotos y recibe albumes privados de retratos cinematicos con creditos visibles.",
      heroBadge: my ? "Estudio de paquetes de fotos IA" : "Estudio de retratos de viaje IA",
      authRibbon: "Planes desde $24.50/mes",
      authPrimaryLabel: "Continuar con email",
      authEmailPlaceholder: "Correo electronico",
      authButtonLabel: my ? "Crear mi primer set con email" : "Crear mi primer album con email",
      imageBadge: my ? "15+ categorias de paquetes" : "Rutas, costa, ciudad y destinos",
      imageCaption: my ? "Elige un paquete y genera un album privado." : "Elige una escena de viaje y genera tu galeria privada.",
      socialProofLabel: my
        ? "Selfies privados · Creditos visibles · Albumes descargables"
        : "Retratos fuente · Rutas claras · Galerias privadas",
      bulletList: my
        ? "Usa selfies propios o autorizados con buena luz.|Elige retratos profesionales, pareja, creador, belleza o deporte.|Comprueba creditos antes de iniciar el render.|Guarda favoritos en un album privado."
        : "Prepara retratos fuente con permiso y buena nitidez.|Define costa, ciudad, ruta, retiro, postal o escena editorial.|Confirma creditos antes de enviar la escena.|Recibe una galeria privada de viaje."
    });
  }
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
  return normalizeSpanishCollectionReferences(scrubEnglishJson(next, spec, { slug }), spec);
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
    return patchPageJson(
      {
        ...template,
        sectionsOrder: template.content_for_page
      },
      slug,
      spec
    );
  }
  if (template.sections) return patchPageJson(template, slug, spec);
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
  const next = spanishizeJson(clone(settings) ?? {}, spec, idMap);
  next.locale = "es-ES";
  next.navigation = next.navigation ?? {};
  next.navigation.headerLinks = spec.headerLinks.map(([label, href]) => ({ label, href }));
  next.navigation.footerLinks = spec.footerLinks.map(([label, href, group]) => ({ label, href, group }));
  next.seo = spanishSiteSeo(spec, pages);
  next.globalSections = next.globalSections ?? {};
  next.globalSections.header = next.globalSections.header ?? { type: "header", settings: {}, blocks: [] };
  next.globalSections.header.settings = {
    ...(next.globalSections.header.settings ?? {}),
    ...spanishHeaderSettings(spec)
  };
  next.globalSections.header.blocks = (next.globalSections.header.blocks ?? []).map((block) => {
    const label = spec.headerLinks.find(([, href]) => block.settings?.href === href)?.[0];
    return label ? { ...block, settings: { ...(block.settings ?? {}), label } } : block;
  });
  next.globalSections.footer = next.globalSections.footer ?? { type: "footer", settings: {}, blocks: [] };
  next.globalSections.footer.settings = {
    ...(next.globalSections.footer.settings ?? {}),
    ...spanishFooterSettings(spec)
  };
  next.globalSections.footer.blocks = spec.footerLinks.map(([label, href, group], index) => ({
    id: `${spec.targetToken}_footer_${group}_${index + 1}`,
    type: "menu_link",
    settings: { label, href, group }
  }));
  return scrubEnglishJson(patchSpanishGlobalSections(patchSiteSeoContainers(next, spec, pages), spec), spec, { slug: "/settings" });
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
  const usedCategoryIds = new Set(
    source.creativePacks
      .map((pack) => pack.categoryId ? idMap.get(pack.categoryId) : null)
      .filter(Boolean)
  );
  const parentRows = dreamshootXbyCreativeParentGroups.map((group, index) => ({
    id: `cat_${spec.targetToken}_group_${group.slug}`,
    siteId: spec.targetSiteId,
    parentId: null,
    slug: group.slug,
    label: group.label,
    description: `Paquetes de ${group.label.toLowerCase()} con fotos fuente privadas, creditos visibles y entrega en galeria.`,
    heroTitle: `${group.label} con IA`,
    heroSubtitle: "Elige el estilo, revisa creditos y genera un album privado.",
    icon: group.icon,
    imageUrl: null,
    sortOrder: index * 100,
    status: "active"
  }));
  const parentIdBySlug = new Map(parentRows.map((group) => [group.slug, group.id]));
  const parentSortOrderBySlug = new Map(parentRows.map((group) => [group.slug, group.sortOrder]));
  const groupedChildren = categories
    .filter((category) => !usedCategoryIds.size || usedCategoryIds.has(category.id))
    .map((category) => {
      const parentGroup = dreamshootXbyCreativeParentGroup(category);
      const parentSortOrder = parentSortOrderBySlug.get(parentGroup.slug) ?? 0;
      const childSortOrder = Number.isFinite(Number(category.sortOrder)) ? Number(category.sortOrder) : 0;
      return {
        ...category,
        parentId: parentIdBySlug.get(parentGroup.slug),
        sortOrder: parentSortOrder + Math.max(1, childSortOrder + 1)
      };
    });
  return [...parentRows, ...groupedChildren];
}

function buildDataset(source, spec) {
  const idMap = buildIdMaps(source, spec);
  const branding = {
    ...(source.branding && typeof source.branding === "object" && !Array.isArray(source.branding) ? clone(source.branding) : {}),
    logoText: spec.readableBrand,
    logoImageUrl: spec.logoImageUrl,
    market: spec.market,
    description: spec.description
  };
  const pages = source.pages
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((page) => {
      const pageSlug = spanishPageSlug(page.slug);
      const draftJson = patchPageJson(spanishizeJson(page.draftJson, spec, idMap), pageSlug, spec);
      const publishedJson = patchPageJson(spanishizeJson(page.publishedJson, spec, idMap), pageSlug, spec);
      return {
        id: targetPageId(page, spec, idMap),
        siteId: spec.targetSiteId,
        pageType: page.pageType,
        templateKey: page.templateKey,
        slug: pageSlug,
        title: pageTitleForSlug(pageSlug, spec),
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
      headline: name,
      description:
        spec.sourceSiteId === "site_dreamshoot"
          ? `Crea ${name.toLowerCase()} con ${spec.readableBrand}: sube fotos claras, revisa creditos y recibe resultados en un album privado.`
          : `Crea ${name.toLowerCase()} con ${spec.readableBrand}: elige ambiente de destino, revisa creditos y recibe una galeria privada.`,
      prompt: spanishCreativePackPrompt(name, spec),
      category: spanishDreamshootPackCategory(pack.category, spec),
      aiAppSlug: pack.aiAppSlug,
      status: pack.status,
      creditCost: pack.creditCost,
      outputCount: pack.outputCount,
      trainingRequired: pack.trainingRequired,
      generationCount: pack.generationCount,
      conversionRate: pack.conversionRate,
      imageUrl: pack.imageUrl ? spanishizeString(pack.imageUrl, spec, idMap) : null,
      galleryImages: spanishizeJson(pack.galleryImages, spec, idMap)
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
      description: spec.sourceSiteId === "site_dreamshoot"
        ? `Herramientas para ${labelLower}, edicion y creacion privada con IA.`
        : `Herramientas para ${labelLower}, escenas de viaje y galerias privadas con IA.`,
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
      imageUrl: item.imageUrl ? spanishizeString(item.imageUrl, spec, idMap) : null,
      href: spanishizeString(item.href, spec, idMap),
      detailJson: spanishToolDetailJson(item, title, spec, idMap),
      sortOrder: item.sortOrder,
      status: item.status
    };
  });
  const mediaAssets = source.mediaAssets.map((asset) => ({
    id: idMap.get(asset.id),
    siteId: spec.targetSiteId,
    label: spanishizeString(spanishTitle(asset.label || asset.storageKey), spec, idMap),
    storageKey: spanishMediaStorageKey(asset, spec),
    mimeType: asset.mimeType,
    usageType: asset.usageType,
    sourceType: asset.sourceType,
    previewUrl: asset.previewUrl ? spanishizeString(asset.previewUrl, spec, idMap) : null,
    originUrl: asset.originUrl ? spanishizeString(asset.originUrl, spec, idMap) : null,
    altText: asset.altText ? spanishizeString(asset.altText, spec, idMap) : null,
    notes: asset.notes ? spanishizeString(asset.notes, spec, idMap) : null
  }));
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
  const siteThemes = source.siteThemes.map((theme) => {
    const templates = patchThemeTemplates(spanishizeJson(theme.templates, spec, idMap), spec);
    return {
      id: idMap.get(theme.id),
      siteId: spec.targetSiteId,
      name: `${spec.readableBrand} ${theme.status === "published" ? "Publicado" : "Borrador"}`,
      themeId: mapId(theme.themeId, spec, "theme_id", theme.themeKey),
      themeKey: theme.themeKey,
      status: theme.status,
      templates: scrubEnglishJson(templates, spec, { slug: "/theme" }),
      settings: patchSettingsJson(theme.settings, spec, idMap, pages),
      source: theme.source,
      createdBy: theme.createdBy
    };
  });
  const themePublications = source.publications.length
    ? source.publications.map((publication) => {
        const snapshot = scrubEnglishJson(
          patchPublicationSnapshot(
            patchSiteSeoContainers(spanishizeJson(publication.snapshot, spec, idMap), spec, pages),
            spec,
            idMap,
            pages
          ),
          spec,
          { slug: "/publication" }
        );
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

function copyMissingStaticAssets(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) return 0;
  fs.mkdirSync(targetDir, { recursive: true });
  let copied = 0;
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copied += copyMissingStaticAssets(sourcePath, targetPath);
      continue;
    }
    if (!entry.isFile() || fs.existsSync(targetPath)) continue;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    copied += 1;
  }
  return copied;
}

function syncStaticAssets(spec) {
  const sourceDir = path.resolve(process.cwd(), "public/assets/sites", spec.sourceSiteId);
  const targetDir = path.resolve(process.cwd(), "public/assets/sites", spec.targetSiteId);
  return copyMissingStaticAssets(sourceDir, targetDir);
}

async function main() {
  const datasets = [];
  const assetCopies = [];
  for (const spec of specs) {
    const source = await fetchSource(spec.sourceSiteId);
    datasets.push(buildDataset(source, spec));
  }
  if (!dryRun) {
    if (!stateOnly) {
      for (const dataset of datasets) await clearConfigRowsForSite(dataset.site.id);
      for (const dataset of datasets) await upsertDataset(dataset);
    }
    const nextState = mergeState(datasets);
    fs.writeFileSync(statePath, `${JSON.stringify(nextState, null, 2)}\n`);
    for (const spec of specs) assetCopies.push({ siteId: spec.targetSiteId, copied: syncStaticAssets(spec) });
  }
  console.log(JSON.stringify({ ok: true, dryRun, stateOnly, statePath, sites: datasets.map(summarize), assetCopies }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
