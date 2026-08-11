import type { CreativePack, Site } from "@/lib/types";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";

export type StorefrontMediaAltLocale = "en" | "es";
export type StorefrontMediaAltRole = "cover" | "gallery" | "card" | "featured" | "related" | "poster" | "article";

type AltSite = Pick<Site, "id" | "slug" | "name" | "primaryDomain" | "branding">;

type PackAltInput = {
  brand?: string;
  category?: string;
  description?: string;
  explicitAlt?: string;
  galleryImageAlts?: string[];
  imageUrl?: string;
  index?: number;
  locale?: StorefrontMediaAltLocale;
  meta?: string;
  role?: StorefrontMediaAltRole;
  title: string;
};

const weakAltPattern = /^(?:image|photo|picture|preview|thumbnail|hero|featured image|featured pack image|package image|product image|gallery image|story image|destination|example|sample|undefined|null|n\/a)$/i;
const weakAltPhrasePattern = /\b(?:private album workspace preview|private fan-scene album preview|featured pack image|package image|gallery image|gallery preview|image preview|photo preview)\b/i;
const urlLikePattern = /\bhttps?:\/\/\S+|(?:^|\s)\/assets\/\S+/gi;

const englishSceneVariants = [
  "close portrait with clear facial detail",
  "half-body editorial portrait in themed lighting",
  "two-person keepsake moment in a styled scene",
  "wide scene showing the setting and mood",
  "candid smile prepared for social sharing",
  "detail crop for a private album preview",
  "group-friendly pose with polished composition",
  "evening-light portrait with cinematic color",
  "vertical profile crop for mobile sharing",
  "lifestyle frame for a download-ready gallery",
  "soft flash portrait with event-style energy",
  "album cover crop for the finished gallery"
];

const spanishSceneVariants = [
  "retrato cercano con detalle facial claro",
  "retrato editorial de medio cuerpo con luz tematica",
  "momento de dos personas en una escena preparada",
  "escena amplia que muestra ambiente y contexto",
  "sonrisa natural lista para compartir",
  "recorte de detalle para vista previa de album privado",
  "pose de grupo con composicion pulida",
  "retrato con luz de tarde y color cinematografico",
  "recorte vertical para compartir en movil",
  "escena de estilo de vida lista para descargar",
  "retrato con flash suave y energia de evento",
  "recorte de portada para la galeria final"
];

const spanishVideoAltTitles: Record<string, string> = {
  "cinematic-portrait-motion": "retrato cinematografico en movimiento",
  "creator-intro-motion": "intro de creador en video",
  "creator-scene-motion": "escena de creador en movimiento",
  "holiday-card-motion": "tarjeta festiva en movimiento",
  "product-showcase-motion": "presentacion de producto en movimiento",
  "prompt-directed-motion": "video guiado por instrucciones",
  "social-profile-clip": "clip para perfil social",
  "travel-route-story": "historia de ruta de viaje",
  "wedding-memory-film": "video de recuerdo de boda"
};

const spanishVideoAltMeta: Record<string, string> = {
  "a clean short clip for profile and social cards": "clip breve para perfiles y tarjetas sociales",
  "a compact product reveal from image frames": "revelacion breve de producto desde imagenes",
  "a neutral image-to-video preset that follows the written direction": "preset neutral de imagen a video que sigue las instrucciones",
  "a refined moving portrait from customer frames": "retrato en movimiento desde imagenes del cliente",
  "a refined moving portrait with subtle camera drift": "retrato en movimiento con desplazamiento sutil de camara",
  "a short travel scene that follows the uploaded frame order": "escena breve de viaje segun el orden de imagenes subidas",
  "a soft romantic keepsake clip from frame references": "clip romantico de recuerdo desde referencias visuales",
  "a warm seasonal clip from a finished card image": "clip festivo desde una tarjeta terminada",
  "a warm seasonal clip from customer frames": "clip de temporada desde imagenes del cliente",
  "creator motion": "movimiento para creadores",
  "keepsake film": "video de recuerdo",
  "portrait motion": "movimiento de retrato",
  "product teaser": "teaser de producto",
  "seasonal mood": "ambiente de temporada",
  "social cards": "tarjetas sociales",
  "social clips": "clips sociales",
  "travel story": "historia de viaje",
  "wedding memory": "recuerdo de boda"
};

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanAltText(value: string | undefined): string {
  return String(value ?? "")
    .replace(urlLikePattern, " ")
    .replace(/\s*\.+\s*$/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

function spanishVideoAltPhrase(value: string | undefined, fallback: string): string {
  const cleaned = cleanAltText(value);
  if (!cleaned) return fallback;
  const key = normalizeSlug(cleaned);
  const textKey = cleaned.toLowerCase();
  return spanishVideoAltTitles[key] ?? spanishVideoAltMeta[key] ?? spanishVideoAltMeta[textKey] ?? fallback;
}

function imageSlugParts(imageUrl: string | undefined): string[] {
  const value = String(imageUrl ?? "").trim();
  if (!value) return [];
  const path = value.split("#")[0]?.split("?")[0] ?? "";
  const segments = path.split("/").filter(Boolean);
  const filename = segments.at(-1) ?? "";
  const parent = segments.at(-2) ?? "";
  const basename = filename.replace(/\.(?:png|jpe?g|webp|avif|svg)$/i, "");
  return [parent, basename]
    .map((part) => normalizeSlug(part.replace(/(?:-\d+|-\d{8,}|-v\d+)$/i, "").replace(/-cover$/i, "")))
    .filter(Boolean);
}

function imageSequenceCue(imageUrl: string | undefined, locale: StorefrontMediaAltLocale): string {
  const value = String(imageUrl ?? "").trim();
  if (!value) return "";
  const path = value.split("#")[0]?.split("?")[0] ?? "";
  const filename = path.split("/").filter(Boolean).at(-1) ?? "";
  const basename = filename.replace(/\.(?:png|jpe?g|webp|avif|svg)$/i, "");
  const match = basename.match(/(?:^|[-_])(\d{1,3})$/);
  const numeric = match ? Number(match[1]) : 0;
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return locale === "es" ? `, fotograma ${numeric}` : `, frame ${numeric}`;
}

function readableImageCue(imageUrl: string | undefined, locale: StorefrontMediaAltLocale): string {
  const parts = imageSlugParts(imageUrl);
  const key = parts.join(" ");
  const sequenceCue = imageSequenceCue(imageUrl, locale);
  const withSequence = (cue: string) => `${cue}${sequenceCue}`;
  if (!key) return withSequence(locale === "es" ? "encuadre visual de galeria privada" : "private gallery visual frame");

  if (locale === "es") {
    if (/game-day-group-photos/.test(key)) return withSequence("portada de categoria con grupo de aficionados en dia de partido");
    if (/game-day-group-portraits/.test(key)) return withSequence("portada de retratos grupales para dia de partido");
    if (/anime-avatar/.test(key)) return withSequence("encuadre de avatar anime para perfil creativo");
    if (/product-style/.test(key)) return withSequence("encuadre de retrato de estilo de producto para comercio social");
    if (/premiere|red-carpet|flash/.test(key)) return withSequence("encuadre de retrato de estreno con luz de evento");
    if (/christmas|holiday|seasonal|thanksgiving|friendsgiving|gratitude|halloween|spooky|costume|cozy|winter|new-year|family-occasion/.test(key)) return withSequence("encuadre de celebracion festiva para album privado");
    if (/travel|coastal|route|postcard|island|mountain|cafe|street|destination/.test(key)) return withSequence("encuadre de retrato de viaje para galeria privada");
    if (/fan-scene|supporter-photo|fan-keepsake|fan-letter|birthday-fan|spooky-fan|backstage-meetup/.test(key)) return withSequence("portada de album privado con escenas de aficionados");
    if (/world-cup|stadium|football|watch-party|championship|tunnel-entrance|match-day|game-day|(?:^|-)fan(?:-|$)/.test(key)) return withSequence("encuadre de aficionado de futbol en ambiente de estadio");
    return withSequence("encuadre visual de galeria privada con estilo tematico");
  }

  if (/game-day-group-photos/.test(key)) return withSequence("game-day crowd category cover frame");
  if (/game-day-group-portraits/.test(key)) return withSequence("game-day group portrait cover frame");
  if (/anime-avatar/.test(key)) return withSequence("anime avatar portrait frame for a creative profile");
  if (/product-style/.test(key)) return withSequence("product-style portrait frame for creator commerce");
  if (/premiere|red-carpet|flash/.test(key)) return withSequence("premiere event portrait cover frame");
  if (/christmas|holiday|seasonal|thanksgiving|friendsgiving|gratitude|halloween|spooky|costume|cozy|winter|new-year|family-occasion/.test(key)) return withSequence("seasonal celebration album cover frame");
  if (/travel|coastal|route|postcard|island|mountain|cafe|street|destination/.test(key)) return withSequence("destination portrait gallery cover frame");
  if (/fan-scene|supporter-photo|fan-keepsake|fan-letter|birthday-fan|spooky-fan|backstage-meetup/.test(key)) return withSequence("private fan-scene album cover frame");
  if (/world-cup|stadium|football|watch-party|championship|tunnel-entrance|match-day|game-day|(?:^|-)fan(?:-|$)/.test(key)) return withSequence("stadium supporter cover frame");
  return withSequence(`${parts.at(-1)?.replace(/-/g, " ") ?? "private gallery"} visual frame`);
}

function meaningfulAlt(value: string | undefined): string {
  const cleaned = cleanAltText(value);
  if (!cleaned) return "";
  if (weakAltPattern.test(cleaned)) return "";
  if (cleaned.split(/\s+/).length < 8 && weakAltPhrasePattern.test(cleaned)) return "";
  if (cleaned.split(/\s+/).length < 8) return "";
  return cleaned;
}

function languageMarkerCount(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function meaningfulAltForStorefront(
  value: string | undefined,
  locale: StorefrontMediaAltLocale,
  brand: string
): string {
  const cleaned = meaningfulAlt(value);
  if (!cleaned) return "";

  const knownBrands = ["MyDreamShoots", "AIdreamshoots", "AIdreamcapes"];
  const conflictingBrand = knownBrands.find(
    (candidate) => candidate.toLowerCase() !== brand.toLowerCase()
      && cleaned.toLowerCase().includes(candidate.toLowerCase())
  );
  if (conflictingBrand) return "";

  if (locale === "en") {
    const spanishMarkers = languageMarkerCount(
      cleaned.toLowerCase(),
      /\b(?:retrato|retratos|galeria|escena|encuadre|portada|paquete|aficionado|futbol|boda|pareja|celebracion|generad[oa]|privad[oa]|para|con)\b/g
    );
    if (spanishMarkers >= 2) return "";
  } else {
    const englishMarkers = languageMarkerCount(
      cleaned.toLowerCase(),
      /\b(?:portrait|gallery|scene|showing|package|supporter|stadium|generated|private|cover|frame|customer|review|download|with|for)\b/g
    );
    if (englishMarkers >= 3) return "";
  }
  return cleaned;
}

function altConflictsWithImageTheme(value: string, imageUrl: string | undefined): boolean {
  const key = imageSlugParts(imageUrl).join(" ");
  if (!key) return false;
  const cleaned = value.toLowerCase();

  if (/anime-avatar/.test(key)) {
    return /\b(?:football|stadium|world cup|match-day|holiday album|wedding|futbol|mundial|estadio|boda)\b/i.test(cleaned);
  }
  if (/profile-cards/.test(key)) {
    return /\b(?:football|stadium|world cup|match-day|futbol|mundial|estadio)\b/i.test(cleaned);
  }
  if (/product-style/.test(key)) {
    return /\b(?:football|stadium|world cup|match-day|futbol|mundial|estadio)\b/i.test(cleaned);
  }
  if (/ai-video-add-ons/.test(key)) {
    return /\b(?:football|stadium|world cup|wedding|futbol|mundial|estadio|boda)\b/i.test(cleaned);
  }
  if (/world-cup-fan-photos/.test(key)) {
    return /\b(?:product-style|anime|wedding|boda)\b/i.test(cleaned);
  }
  if (/premiere-style-portraits|premiere-flash-portraits|vip-arrival|award-night|spotlight/.test(key)) {
    return /\b(?:seasonal celebration|holiday album|world cup|mundial)\b/i.test(cleaned);
  }
  if (/christmas|holiday|thanksgiving|friendsgiving|gratitude|halloween|spooky|costume|cozy|winter|new-year|family-occasion/.test(key)) {
    return /\b(?:football fan portrait|stadium supporter|world cup|mundial)\b/i.test(cleaned);
  }
  if (/fan-scene|supporter-photo|fan-letter|fan-keepsake|backstage|birthday-fan|fan-card|private-fan-scene/.test(key)) {
    return /\b(?:world cup|football fan portrait in a stadium crowd|mundial|retrato de aficionado de futbol en una escena de estadio)\b/i.test(cleaned);
  }
  if (/stadium-night-fan-sets|game-day-group|watch-party|championship|tunnel-entrance/.test(key)) {
    return /\b(?:seasonal celebration|holiday album|red-carpet|alfombra roja)\b/i.test(cleaned);
  }
  return false;
}

function meaningfulThemeAlignedAltForStorefront(
  value: string | undefined,
  locale: StorefrontMediaAltLocale,
  brand: string,
  imageUrl: string | undefined
): string {
  const cleaned = meaningfulAltForStorefront(value, locale, brand);
  if (!cleaned) return "";
  return altConflictsWithImageTheme(cleaned, imageUrl) ? "" : cleaned;
}

export function storefrontMeaningfulAlt(value: string | undefined): string {
  return meaningfulAlt(value);
}

export function storefrontStoredMediaAlt(value: unknown): string {
  return typeof value === "string" ? meaningfulAlt(value) : "";
}

export function storefrontGalleryMediaPairs(
  galleryImages: unknown,
  galleryImageAlts: unknown,
  limit = 24
): { galleryImageAlts: string[]; galleryImages: string[] } {
  const altItems = Array.isArray(galleryImageAlts) ? galleryImageAlts : [];
  if (!Array.isArray(galleryImages)) return { galleryImageAlts: [], galleryImages: [] };

  const images: string[] = [];
  const alts: string[] = [];
  for (let index = 0; index < galleryImages.length && images.length < limit; index += 1) {
    const image = typeof galleryImages[index] === "string" ? galleryImages[index].trim() : "";
    if (!image) continue;
    images.push(image);
    alts.push(storefrontStoredMediaAlt(altItems[index]));
  }
  return { galleryImageAlts: alts, galleryImages: images };
}

export function storefrontMediaAltLocaleForSite(site: AltSite | undefined): StorefrontMediaAltLocale {
  return isSpanishStorefrontSite(site) ? "es" : "en";
}

export function storefrontMediaBrandName(site: AltSite | undefined): string {
  const host = String(site?.primaryDomain ?? "").toLowerCase();
  const identity = `${site?.id ?? ""} ${site?.slug ?? ""} ${site?.name ?? ""} ${site?.branding?.logoText ?? ""}`.toLowerCase();
  if (host.includes("aidreamshoots.eu") || identity.includes("aidreamshoots")) return "AIdreamshoots";
  if (host.includes("aidreamcapes") || identity.includes("aidreamcapes")) return "AIdreamcapes";
  return "MyDreamShoots";
}

function themeKey(input: Pick<PackAltInput, "category" | "description" | "imageUrl" | "meta" | "title">): string {
  return [
    input.title,
    input.category,
    input.meta
  ].map((value) => normalizeSlug(String(value ?? ""))).join(" ");
}

function themeImageSlugParts(imageUrl: string | undefined): string[] {
  return imageSlugParts(imageUrl).filter((part) =>
    !/^(?:assets|sites|site_[a-z0-9_-]+|site-aidreamcapes|site-mydreamshoots|fan-holiday-theme|categories|covers|gallery|showcase|pack-covers|pack-galleries)$/i.test(part)
  );
}

function contextualThemeKey(input: Pick<PackAltInput, "category" | "description" | "imageUrl" | "meta" | "title">): string {
  return [
    input.title,
    input.category,
    input.meta,
    input.description,
    ...themeImageSlugParts(input.imageUrl)
  ].map((value) => normalizeSlug(String(value ?? ""))).join(" ");
}

function genericSceneSubject(value: string | undefined): boolean {
  return /\b(?:AI image result preview|creator profile portrait|supporter portrait in a private fan-scene album|vista previa de resultado|retrato de creador|retrato de seguidor en un album privado)\b/i.test(String(value ?? ""));
}

function imageSlugHasSpecificTheme(key: string): boolean {
  return /(?:anime-avatar|profile-cards|product-style|world-cup|stadium|football|soccer|watch-party|championship|tunnel-entrance|game-day-group|premiere|red-carpet|christmas|holiday|thanksgiving|friendsgiving|halloween|spooky|travel|coastal|route|destination|wedding|engagement|beauty|hairstyle|fashion|boudoir)/.test(key);
}

function englishThemeSubject(key: string): string | undefined {
  if (/\b(?:credit|subscription|plan|pricing|checkout)\b/.test(key)) {
    return "AI photo credit plan visual for private gallery workflows";
  }
  if (/(christmas|holiday|thanksgiving|friendsgiving|gratitude|halloween|spooky|costume-cast|cozy-card|family-occasion|seasonal|winter|new-year)/.test(key)) {
    return "seasonal celebration portrait in a private holiday album";
  }
  if (/(gala|red-carpet|premiere|vip|award|award-night|spotlight|formal|evening)/.test(key)) {
    return "red-carpet style event portrait with polished evening lighting";
  }
  if (/(fan-scene|supporter-wall|supporter-photo|supporter-set|fan-wall|fan-photo|fan-collection|fan-letter|fan-keepsake|backstage|meetup|birthday-fan|fan-card)/.test(key)) {
    return "supporter portrait in a private fan-scene album";
  }
  if (/(anime-avatar)/.test(key)) {
    return "anime avatar portrait with stylized character lighting for a creative profile";
  }
  if (/(cyberpunk|neon|noir|mafia|anime|avatar|fantasy)/.test(key)) {
    return "stylized creative portrait in an original themed scene";
  }
  if (/(profile-cards|social-cards|avatar-card)/.test(key)) {
    return "social profile card portrait with clean avatar framing and personal-brand styling";
  }
  if (/(headshot|professional|business|linkedin|executive)/.test(key)) {
    return "professional AI headshot with clean studio lighting";
  }
  if (/(video|motion|clip|animation|add-ons?|addon|teaser)/.test(key)) {
    return "AI video add-on visual for a private gallery workflow";
  }
  if (/(product-style)/.test(key)) {
    return "product-style lifestyle portrait with clean studio lighting and creator-commerce framing";
  }
  if (/(product-style|product|upscaler|enhance|utility)/.test(key)) {
    return "AI image result preview for a creator workflow";
  }
  if (/(creator|profile|social|thumbnail|media-kit|personal-brand)/.test(key)) {
    return "creator profile portrait for social and personal-brand use";
  }
  if (/(world-cup|football|soccer|stadium|match-day|game-day|match|watch-party|championship|tunnel-entrance)/.test(key)) {
    return "football fan portrait in a stadium crowd";
  }
  if (/(wedding|engagement|couple|valentine|desi|indian)/.test(key)) {
    return "couple or wedding-inspired portrait for a private keepsake gallery";
  }
  if (/(travel|nature|route|coastal|destination|outdoor|road|mountain|cafe|island|villa)/.test(key)) {
    return "travel-style portrait in a scenic destination setting";
  }
  if (/(beauty|hairstyle|hair|try-on|fashion|boudoir)/.test(key)) {
    return "beauty and styling portrait with editorial lighting";
  }
  return undefined;
}

function spanishThemeSubject(key: string): string | undefined {
  if (/\b(?:credit|subscription|plan|pricing|checkout|credito|suscripcion|plan)\b/.test(key)) {
    return "visual de plan de creditos de fotos IA para flujos de galeria privada";
  }
  if (/(christmas|holiday|thanksgiving|friendsgiving|gratitude|halloween|spooky|costume-cast|cozy-card|family-occasion|seasonal|winter|new-year|navidad|temporada)/.test(key)) {
    return "retrato de celebracion de temporada para un album privado";
  }
  if (/(gala|red-carpet|premiere|vip|award|award-night|spotlight|formal|evening)/.test(key)) {
    return "retrato de evento estilo alfombra roja con luz nocturna pulida";
  }
  if (/(fan-scene|muro de seguidores|seguidores|aficion|fan-letter|fan-keepsake|backstage|meetup|birthday-fan|fan-card)/.test(key)) {
    return "retrato de seguidor en un album privado de escenas de aficionados";
  }
  if (/(anime-avatar|avatar-anime)/.test(key)) {
    return "avatar anime estilizado con luz de personaje para un perfil creativo";
  }
  if (/(cyberpunk|neon|noir|mafia|anime|avatar|fantasy)/.test(key)) {
    return "retrato creativo estilizado en una escena tematica original";
  }
  if (/(profile-cards|social-cards|avatar-card|tarjetas-de-perfil)/.test(key)) {
    return "retrato para tarjeta de perfil social con encuadre de avatar y marca personal";
  }
  if (/(headshot|professional|business|linkedin|executive|profesional)/.test(key)) {
    return "retrato profesional con IA y luz limpia de estudio";
  }
  if (/(video|motion|clip|animation|add-ons?|addon|teaser|video adicional)/.test(key)) {
    return "vista previa de complemento de video IA para una galeria privada";
  }
  if (/(product-style|estilo-de-producto)/.test(key)) {
    return "retrato de estilo de producto con luz limpia de estudio y enfoque de comercio social";
  }
  if (/(product-style|product|upscaler|enhance|utility)/.test(key)) {
    return "vista previa de resultado con IA para un flujo creativo";
  }
  if (/(creator|profile|social|thumbnail|media-kit|personal-brand|creador)/.test(key)) {
    return "retrato de creador para perfil social y marca personal";
  }
  if (/(world-cup|football|soccer|stadium|match-day|game-day|watch-party|championship|tunnel-entrance|deportes)/.test(key)) {
    return "retrato de aficionado de futbol en una escena de estadio";
  }
  if (/(wedding|engagement|couple|valentine|desi|indian|boda|pareja)/.test(key)) {
    return "retrato de pareja o boda para una galeria privada";
  }
  if (/(travel|nature|route|coastal|destination|outdoor|road|mountain|cafe|island|villa|viaje|ruta)/.test(key)) {
    return "retrato de viaje con una escena de destino cinematografica";
  }
  if (/(beauty|hairstyle|hair|try-on|fashion|boudoir|belleza)/.test(key)) {
    return "retrato de belleza y estilo con luz editorial";
  }
  return undefined;
}

function rolePhrase(role: PackAltInput["role"], locale: StorefrontMediaAltLocale): string {
  if (locale === "es") {
    if (role === "cover") return "portada del paquete";
    if (role === "card") return "visual del paquete";
    if (role === "featured") return "escena destacada del paquete";
    if (role === "related") return "escena de paquete relacionado";
    if (role === "poster") return "fotograma de video";
    if (role === "article") return "portada del articulo";
    return "escena de galeria";
  }
  if (role === "cover") return "package cover frame";
  if (role === "card") return "package showcase frame";
  if (role === "featured") return "featured package scene";
  if (role === "related") return "related package scene";
  if (role === "poster") return "video poster frame";
  if (role === "article") return "article cover frame";
  return "gallery scene example";
}

export function storefrontPackMediaAlt(input: PackAltInput): string {
  const locale = input.locale ?? "en";
  const brand = cleanAltText(input.brand) || (locale === "es" ? "AIdreamshoots" : "MyDreamShoots");
  const explicit = meaningfulThemeAlignedAltForStorefront(input.explicitAlt, locale, brand, input.imageUrl);
  if (explicit) return explicit;
  const galleryAlt = input.role === "gallery" && typeof input.index === "number"
    ? meaningfulThemeAlignedAltForStorefront(input.galleryImageAlts?.[input.index], locale, brand, input.imageUrl)
    : "";
  if (galleryAlt) return galleryAlt;

  const title = cleanAltText(input.title) || (locale === "es" ? "paquete de fotos con IA" : "AI photo package");
  const specificKey = themeKey(input);
  const imageKey = themeImageSlugParts(input.imageUrl).join(" ");
  const contextKey = contextualThemeKey(input);
  const specificScene = locale === "es" ? spanishThemeSubject(specificKey) : englishThemeSubject(specificKey);
  const imageScene = locale === "es" ? spanishThemeSubject(imageKey) : englishThemeSubject(imageKey);
  const contextScene = locale === "es" ? spanishThemeSubject(contextKey) : englishThemeSubject(contextKey);
  const scene = imageScene && (imageSlugHasSpecificTheme(imageKey) || !specificScene || genericSceneSubject(specificScene))
    ? imageScene
    : specificScene
      ?? imageScene
      ?? contextScene
      ?? (locale === "es"
        ? "escena de retrato generada con IA para un paquete de fotos privado"
        : "AI portrait subject in a styled scene for a private photo package");
  const variants = locale === "es" ? spanishSceneVariants : englishSceneVariants;
  const variant = variants[Math.max(0, input.index ?? 0) % variants.length];
  const imageCue = readableImageCue(input.imageUrl, locale);
  const role = rolePhrase(input.role, locale);
  return locale === "es"
    ? `${scene}, ${variant}, ${imageCue}, ${role} de ${title} en ${brand}.`
    : `${scene}, ${variant}, ${imageCue}, ${role} for ${title} on ${brand}.`;
}

export function storefrontCreativePackImageAlt({
  brand,
  explicitAlt,
  imageUrl,
  index,
  locale,
  pack,
  role
}: {
  brand?: string;
  explicitAlt?: string;
  imageUrl?: string;
  index?: number;
  locale?: StorefrontMediaAltLocale;
  pack: CreativePack;
  role?: StorefrontMediaAltRole;
}): string {
  return storefrontPackMediaAlt({
    brand,
    category: pack.categoryRecord?.label || pack.category,
    description: pack.description || pack.headline,
    explicitAlt,
    galleryImageAlts: pack.galleryImageAlts,
    imageUrl,
    index,
    locale,
    meta: pack.categoryRecord?.parent?.label,
    role,
    title: pack.name
  });
}

export function storefrontCardImageAlt({
  brand,
  category,
  description,
  explicitAlt,
  imageAlts,
  imageUrl,
  index,
  locale,
  meta,
  role = "card",
  title
}: {
  brand?: string;
  category?: string;
  description?: string;
  explicitAlt?: string;
  imageAlts?: string[];
  imageUrl?: string;
  index?: number;
  locale?: StorefrontMediaAltLocale;
  meta?: string;
  role?: StorefrontMediaAltRole;
  title: string;
}): string {
  return storefrontPackMediaAlt({
    brand,
    category,
    description,
    explicitAlt,
    galleryImageAlts: imageAlts,
    imageUrl,
    index,
    locale,
    meta,
    role,
    title
  });
}

export function storefrontVideoPosterAlt({
  brand,
  locale = "en",
  meta,
  title
}: {
  brand?: string;
  locale?: StorefrontMediaAltLocale;
  meta?: string;
  title: string;
}): string {
  const cleanTitle = locale === "es"
    ? spanishVideoAltPhrase(title, "video con IA")
    : cleanAltText(title) || "AI video";
  const cleanMeta = locale === "es"
    ? spanishVideoAltPhrase(meta, "")
    : cleanAltText(meta);
  const cleanBrand = cleanAltText(brand) || (locale === "es" ? "AIdreamshoots" : "MyDreamShoots");
  return locale === "es"
    ? `Poster de video generado con IA para ${cleanTitle}${cleanMeta ? `, ${cleanMeta}` : ""}, vista previa de galeria privada en ${cleanBrand}.`
    : `AI-generated video poster for ${cleanTitle}${cleanMeta ? `, ${cleanMeta.toLowerCase()}` : ""}, private gallery preview on ${cleanBrand}.`;
}
