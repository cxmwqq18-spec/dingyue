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
const legacyTemplateAltPattern = /\b(?:package gallery example|gallery scene example|package showcase frame|package cover frame|featured package scene|related package scene|private gallery visual frame|private storefront gallery|private gallery workflow|private AI album workflow|visual frame|detailed storefront visual|storefront visual showing|finished gallery example|private AI photo example|how to plan this)\b/i;
const brandPlacementAltPattern = /\b(?:on|for)\s+(?:mydreamshoots|mydreamshoots\.com|aidreamshoots|aidreamcapes)\b/i;
const storefrontBrandNamePattern = /\b(?:mydreamshoots|mydreamshoots\.com|aidreamshoots|aidreamcapes)\b/gi;
const urlLikePattern = /\bhttps?:\/\/\S+|(?:^|\s)\/assets\/\S+/gi;

const englishImageDetails = [
  "close-up facial framing",
  "half-body editorial pose",
  "two-person keepsake composition",
  "wide environmental setting",
  "candid social-ready smile",
  "detail crop for review",
  "group-friendly composition",
  "evening cinematic color",
  "vertical profile crop",
  "lifestyle download crop",
  "soft event-style flash",
  "album cover crop"
];

const spanishImageDetails = [
  "encuadre cercano del rostro",
  "pose editorial de medio cuerpo",
  "composicion de recuerdo en pareja",
  "escena amplia con contexto",
  "sonrisa natural para compartir",
  "recorte de detalle para revisar",
  "composicion pensada para grupo",
  "color cinematografico de tarde",
  "recorte vertical para perfil",
  "recorte de estilo de vida",
  "flash suave de evento",
  "recorte de portada de album"
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

function meaningfulAlt(value: string | undefined): string {
  const cleaned = cleanAltText(value);
  if (!cleaned) return "";
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (weakAltPattern.test(cleaned)) return "";
  if (legacyTemplateAltPattern.test(cleaned)) return "";
  if (brandPlacementAltPattern.test(cleaned.toLowerCase()) && wordCount > 6) return "";
  const brandMentions = cleaned.match(storefrontBrandNamePattern)?.length ?? 0;
  if (brandMentions > 1) return "";
  if (brandMentions > 0 && wordCount > 9) return "";
  if (wordCount < 4 && weakAltPhrasePattern.test(cleaned)) return "";
  if (wordCount < 3) return "";
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
  return /\b(?:creator profile portrait|styled portrait prepared for a private gallery|enhanced image preview|vista previa de resultado|retrato de creador|retrato estilizado para una galeria privada)\b/i.test(String(value ?? ""));
}

function imageSlugHasSpecificTheme(key: string): boolean {
  return /(?:anime-avatar|profile-cards|social-cards|product-style|world-cup|stadium|football|soccer|watch-party|championship|tunnel-entrance|game-day-group|premiere|red-carpet|gala|mafia|cyberpunk|noir|christmas|holiday|thanksgiving|friendsgiving|halloween|spooky|travel|coastal|route|destination|nature|outdoor|wedding|engagement|valentine|desi|indian|beauty|hairstyle|fashion|boudoir|creator|try-on|upscaler)/.test(key);
}

function englishThemeSubject(key: string): string | undefined {
  if (/\b(?:credit|subscription|plan|pricing|checkout)\b/.test(key)) {
    return "Credit plan panel for private photo galleries";
  }
  if (/(christmas|holiday|thanksgiving|friendsgiving|gratitude|halloween|spooky|costume-cast|cozy-card|family-occasion|seasonal|winter|new-year)/.test(key)) {
    return "Seasonal celebration portrait";
  }
  if (/(gala|red-carpet|premiere|vip|award|award-night|spotlight|formal|evening)/.test(key)) {
    return "Red-carpet event portrait";
  }
  if (/(fan-scene|supporter-wall|supporter-photo|supporter-set|fan-wall|fan-photo|fan-collection|fan-letter|fan-keepsake|backstage|meetup|birthday-fan|fan-card)/.test(key)) {
    return "Supporter portrait for a fan album";
  }
  if (/(anime-avatar)/.test(key)) {
    return "Stylized anime avatar portrait";
  }
  if (/(cyberpunk|neon|noir|mafia|anime|avatar|fantasy)/.test(key)) {
    return "Cinematic character portrait";
  }
  if (/(profile-cards|social-cards|avatar-card)/.test(key)) {
    return "Social profile card portrait";
  }
  if (/(headshot|professional|business|linkedin|executive)/.test(key)) {
    return "Professional studio headshot";
  }
  if (/(video|motion|clip|animation|add-ons?|addon|teaser)/.test(key)) {
    return "Motion-ready portrait preview";
  }
  if (/(product-style)/.test(key)) {
    return "Product-style lifestyle portrait";
  }
  if (/(product-style|product|upscaler|enhance|utility)/.test(key)) {
    return "Enhanced image preview";
  }
  if (/(creator|profile|social|thumbnail|media-kit|personal-brand)/.test(key)) {
    return "Creator profile portrait";
  }
  if (/(world-cup|football|soccer|stadium|match-day|game-day|match|watch-party|championship|tunnel-entrance)/.test(key)) {
    return "Football fan portrait in a stadium";
  }
  if (/(wedding|engagement|couple|valentine|desi|indian)/.test(key)) {
    return "Couple keepsake portrait";
  }
  if (/(travel|nature|route|coastal|destination|outdoor|road|mountain|cafe|island|villa)/.test(key)) {
    return "Travel portrait in a scenic setting";
  }
  if (/(beauty|hairstyle|hair|try-on|fashion|boudoir)/.test(key)) {
    return "Beauty portrait with editorial lighting";
  }
  return undefined;
}

function spanishThemeSubject(key: string): string | undefined {
  if (/\b(?:credit|subscription|plan|pricing|checkout|credito|suscripcion|plan)\b/.test(key)) {
    return "panel de creditos para galerias privadas";
  }
  if (/(christmas|holiday|thanksgiving|friendsgiving|gratitude|halloween|spooky|costume-cast|cozy-card|family-occasion|seasonal|winter|new-year|navidad|temporada)/.test(key)) {
    return "retrato de celebracion de temporada";
  }
  if (/(gala|red-carpet|premiere|vip|award|award-night|spotlight|formal|evening)/.test(key)) {
    return "retrato de evento estilo alfombra roja";
  }
  if (/(fan-scene|muro de seguidores|seguidores|aficion|fan-letter|fan-keepsake|backstage|meetup|birthday-fan|fan-card)/.test(key)) {
    return "retrato de aficionado para album privado";
  }
  if (/(anime-avatar|avatar-anime)/.test(key)) {
    return "avatar anime estilizado";
  }
  if (/(cyberpunk|neon|noir|mafia|anime|avatar|fantasy)/.test(key)) {
    return "retrato de personaje cinematografico";
  }
  if (/(profile-cards|social-cards|avatar-card|tarjetas-de-perfil)/.test(key)) {
    return "retrato para tarjeta de perfil social";
  }
  if (/(headshot|professional|business|linkedin|executive|profesional)/.test(key)) {
    return "retrato profesional con luz de estudio";
  }
  if (/(video|motion|clip|animation|add-ons?|addon|teaser|video adicional)/.test(key)) {
    return "retrato listo para video";
  }
  if (/(product-style|estilo-de-producto)/.test(key)) {
    return "retrato de estilo de producto";
  }
  if (/(product-style|product|upscaler|enhance|utility)/.test(key)) {
    return "vista previa de imagen mejorada";
  }
  if (/(creator|profile|social|thumbnail|media-kit|personal-brand|creador)/.test(key)) {
    return "retrato de creador para perfil social";
  }
  if (/(world-cup|football|soccer|stadium|match-day|game-day|watch-party|championship|tunnel-entrance|deportes)/.test(key)) {
    return "retrato de aficionado en estadio";
  }
  if (/(wedding|engagement|couple|valentine|desi|indian|boda|pareja)/.test(key)) {
    return "retrato de pareja para recuerdo";
  }
  if (/(travel|nature|route|coastal|destination|outdoor|road|mountain|cafe|island|villa|viaje|ruta)/.test(key)) {
    return "retrato de viaje en destino";
  }
  if (/(beauty|hairstyle|hair|try-on|fashion|boudoir|belleza)/.test(key)) {
    return "retrato de belleza con luz editorial";
  }
  return undefined;
}

function conciseImageDetail(index: number | undefined, locale: StorefrontMediaAltLocale): string {
  const details = locale === "es" ? spanishImageDetails : englishImageDetails;
  return details[Math.max(0, index ?? 0) % details.length];
}

function compactAltSentence(value: string, locale: StorefrontMediaAltLocale): string {
  const cleaned = cleanAltText(value)
    .replace(/\s*,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
  const maxLength = locale === "es" ? 118 : 112;
  if (sentence.length <= maxLength) return sentence;
  const firstClause = sentence.split(",")[0]?.trim();
  if (firstClause && firstClause.length >= 12 && firstClause.length <= maxLength) return firstClause.endsWith(".") ? firstClause : `${firstClause}.`;
  return `${sentence.slice(0, maxLength - 1).replace(/\s+\S*$/, "").replace(/[,\s]+$/g, "")}.`;
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
        ? "retrato estilizado para una galeria privada"
        : "Styled portrait prepared for a private gallery");
  const detail = conciseImageDetail(input.index, locale);
  const fallbackScene = locale === "es"
    ? "retrato estilizado para una galeria privada"
    : "Styled portrait prepared for a private gallery";
  const naturalScene = scene || fallbackScene;
  return locale === "es"
    ? compactAltSentence(`${naturalScene}, ${detail}`, locale)
    : compactAltSentence(`${naturalScene}, ${detail}`, locale);
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
  locale = "en",
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
  return locale === "es"
    ? compactAltSentence(`Imagen de portada para ${cleanTitle}`, locale)
    : compactAltSentence(`Poster frame for ${cleanTitle}`, locale);
}
