import type { CreativePack, Site } from "@/lib/types";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { isAidreamcapesSite as isAidreamcapesCapabilitySite } from "@/lib/storefront-context/capabilities";
import { isFrenchStorefrontSite } from "@/lib/storefront-locale";
import { frenchCopy } from "@/lib/french-copy";

export type StorefrontMediaAltLocale = "en" | "es" | "fr";
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
  themeSlug?: string;
  title: string;
};

const weakAltPattern = /^(?:image|photo|picture|preview|thumbnail|hero|featured image|featured pack image|package image|product image|gallery image|story image|destination|example|sample|undefined|null|n\/a)$/i;
const weakAltPhrasePattern = /\b(?:private album workspace preview|private fan-scene album preview|featured pack image|package image|gallery image|gallery preview|image preview|photo preview|visual reference|source reference|storefront browsing|for browsing|for review)\b/i;
const legacyTemplateAltPattern = /\b(?:package gallery|package gallery example|gallery image|gallery scene example|gallery example|package showcase frame|package cover frame|featured package scene|related package scene|private gallery visual frame|private storefront gallery|private gallery workflow|private AI album workflow|visual frame|visual reference|detailed storefront visual|storefront visual showing|finished gallery example|private AI photo example|private AI photo package|how to plan this|image\s+\d+|for mydreamshoots customers)\b/i;
const brandPlacementAltPattern = /\b(?:on|for)\s+(?:mydreamshoots|mydreamshoots\.com|aidreamshoots|aidreamcapes)\b/i;
const storefrontBrandNamePattern = /\b(?:mydreamshoots|mydreamshoots\.com|aidreamshoots|aidreamcapes)\b/gi;
const filenameLikeAltPattern = /^[a-z0-9][a-z0-9 -]{1,72}\s+image$/i;
const urlLikePattern = /\bhttps?:\/\/\S+|(?:^|\s)\/assets\/\S+|(?:^|\s)[\w./-]+\.(?:png|jpe?g|webp|avif|svg)(?:\?\S+)?/gi;
const templatedSceneAltPattern = /\b(?:portrait with polished|theme scene|representative cover image|enhanced portrait preview|ai video theme cover)\b/i;
const productionDirectionAltPattern = /\b(?:scene\s*\d+|escena\s*\d+|framing|encuadre|crop|recorte|lighting|luz|studio\s+light|luz\s+de\s+estudio|visual\s+reference|referencia\s+visual|prompt|production|camera|camara|shot|toma|close[- ]?up|half[- ]?body|wide\s+view|cinematic\s+contrast|editorial\s+lighting)\b/i;
const frenchAltEnglishLeakPattern = /\b(?:showing|against|softly|blurred|background|smiling|three-quarter|candid|seated|confident|focused|everyday|inviting|polished|prompt|custom|set)\b/i;
const spanishAltPattern = /\b(?:imagen|escaparate|retrato|retratos|galeria|galerías|escena|portada|paquete|privad[oa]|generad[oa]|fotos?|videos?)\b/i;
const genericImageParentPattern = /^(?:assets|sites|theme|generated|frames|media|images|20260622-homepage-unique|\d{8}-.+)$/i;
const stableSourceImagePattern = /\/assets\/dreamshoot\/(?:generated\/(?:video-topic-media|pack-covers|pack-galleries|20260622-homepage-unique)|frames\/|seasonal\/|save-the-date\/|wedding-invitation\/)/i;
const canonicalSourceAltByPath: Record<string, string> = {
  "/assets/dreamshoot/wedding-invitation/hero-ai-wedding-invitation-couple-reviewing.jpg": "Bride and groom reviewing wedding invitation cards at a candlelit reception table.",
  "/assets/dreamshoot/wedding-invitation/hero-ai-wedding-invitation-garden-couple.jpg": "Bride and groom holding a floral wedding invitation in a garden at golden hour."
};

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

function imageIdentity(value: string | undefined): string {
  return String(value ?? "").trim().split("#")[0]?.split("?")[0] ?? "";
}

function imageTopicFromUrl(imageUrl: string | undefined): string {
  const [parent, basename] = imageSlugParts(imageUrl);
  const topic = parent && !genericImageParentPattern.test(parent) ? parent : basename;
  if (!topic) return "Storefront portrait";
  return topic
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function frenchThemeSubject(key: string): string | undefined {
  if (/\b(?:credit|subscription|plan|pricing|checkout)\b/.test(key)) return "Panneau de crédits pour galeries photo privées";
  if (/(black-friday|commercial|sale-campaign|promo)/.test(key)) return "Portrait de campagne commerciale Black Friday";
  if (/(bikini|swimsuit|beach|pool|vacation)/.test(key)) return "Adulte en tenue balnéaire dans un décor de vacances";
  if (/(cannes|riviera)/.test(key)) return "Portrait adulte inspiré de Cannes et de la Riviera";
  if (/(nightlife|night-life|urban-night)/.test(key)) return "Portrait adulte dans une ambiance nocturne urbaine";
  if (/(only-fans|creator-premium)/.test(key)) return "Portrait adulte de créateur dans un style mode élégant";
  if (/(street-style|urban-style)/.test(key)) return "Portrait adulte de style urbain dans une rue contemporaine";
  if (/(rich-lifestyle|premium-lifestyle)/.test(key)) return "Portrait adulte dans un décor lifestyle premium";
  if (/(singles-awareness-day|independence)/.test(key)) return "Portrait adulte célébrant l’autonomie et le bien-être";
  if (/(valentines-photo|valentine)/.test(key)) return "Portrait de couple adulte pour la Saint-Valentin";
  if (/(wedding-photo|wedding)/.test(key)) return "Portrait de couple adulte dans une ambiance de mariage";
  if (/(background-changer|background-replacement|product-style)/.test(key)) return "Sujet intégré dans un nouvel arrière-plan";
  if (/(background-remover|cutout|remove-background)/.test(key)) return "Sujet détouré sur un fond neutre";
  if (/(color-correction|colour-correction|color-grading)/.test(key)) return "Photo aux couleurs rééquilibrées";
  if (/(edit-by-prompt|prompt-edit|custom-edit)/.test(key)) return "Portrait modifié selon une consigne";
  if (/(christmas|thanksgiving|friendsgiving|gratitude|halloween|spooky|costume|holiday|seasonal|winter|new-year)/.test(key)) return "Portrait de fête de saison";
  if (/(fan-scene|supporter|fan-letter|fan-keepsake|backstage|meetup|birthday-fan|fan-card|private-fan)/.test(key)) return "Portrait de supporter pour un album privé";
  if (/(gala|red-carpet|premiere|vip|award|spotlight|formal|evening)/.test(key)) return "Portrait d’événement de style tapis rouge";
  if (/(anime-avatar|avatar)/.test(key)) return "Portrait d’avatar anime stylisé";
  if (/(cyberpunk|neon|noir|mafia)/.test(key)) return "Portrait de personnage au style cinématographique";
  if (/(magic-eraser|object-removal|erase-object)/.test(key)) return "Photo retouchée sans élément indésirable";
  if (/(old-photo-restoration|photo-restoration|restore-photo)/.test(key)) return "Photo ancienne restaurée";
  if (/(portrait-retouch|retouche-portrait|skin-retouch)/.test(key)) return "Portrait retouché au rendu naturel";
  if (/(unblur-image|deblur|sharpen)/.test(key)) return "Photo rendue plus nette";
  if (/(photo-enhancer|magic-upscaler|upscale)/.test(key)) return "Photo améliorée avec davantage de détails";
  if (/(virtual-try-on|try-on|clothing)/.test(key)) return "Adulte présentant une tenue de mode";
  if (/(profile-cards|social-cards|profile|social)/.test(key)) return "Portrait pour une carte de profil social";
  if (/(headshot|professional|business|linkedin|executive)/.test(key)) return "Portrait professionnel";
  if (/(video|motion|clip|animation|teaser)/.test(key)) return "Aperçu de portrait prêt pour la vidéo";
  if (/(product-style|product|upscaler|enhance|utility)/.test(key)) return "Aperçu de produit dans un contexte de vie";
  if (/(creator|media-kit|personal-brand)/.test(key)) return "Portrait de créateur";
  if (/(world-cup|football|soccer|stadium|match-day|game-day|watch-party|championship|tunnel-entrance)/.test(key)) return "Portrait de supporter dans un stade";
  if (/(wedding|engagement|couple|valentine|desi|indian)/.test(key)) return "Portrait de couple souvenir";
  if (/(travel|nature|route|coastal|destination|outdoor|road|mountain|cafe|island|villa)/.test(key)) return "Portrait de voyage dans un décor naturel";
  if (/(beauty|hairstyle|hair|try-on|fashion|boudoir)/.test(key)) return "Portrait beauté";
  return undefined;
}

const frenchEuPackSubjects: Record<string, string> = {
  avatar: "Portrait d’avatar pour profil social",
  "background-changer": "Sujet intégré dans un nouvel arrière-plan",
  "background-remover": "Sujet détouré sur un fond neutre",
  bikini: "Adulte en tenue balnéaire dans un décor de vacances",
  "black-friday": "Portrait de campagne commerciale Black Friday",
  boudoir: "Portrait boudoir adulte à l’éclairage doux",
  cannes: "Portrait adulte inspiré de Cannes et de la Riviera",
  "christmas-photo": "Portrait adulte dans une scène de Noël chaleureuse",
  "color-correction": "Photo aux couleurs rééquilibrées naturellement",
  cyberpunk: "Portrait adulte dans une ville cyberpunk éclairée au néon",
  "edit-by-prompt": "Portrait adulte modifié selon une consigne créative",
  "engagement-photo": "Portrait de couple pour une séance de fiançailles",
  "gala-photo": "Portrait adulte dans une ambiance de gala élégante",
  "hairstyle-generator": "Portrait adulte montrant une coiffure contemporaine",
  "halloween-photo": "Portrait adulte dans une scène de fête d’Halloween",
  headshot: "Portrait professionnel d’un adulte dans un cadre crédible",
  holiday: "Portrait adulte dans une scène festive de saison",
  mafia: "Portrait adulte au style noir inspiré du cinéma",
  "magic-eraser": "Photo retouchée sans élément indésirable",
  "motion-generator": "Portrait adulte composé pour une séquence en mouvement",
  nightlife: "Portrait adulte dans une ambiance nocturne urbaine",
  "old-photo-restoration": "Photo ancienne restaurée avec ses détails préservés",
  "only-fans": "Portrait adulte de créateur dans un style mode élégant",
  "photo-enhancer": "Photo améliorée avec davantage de détails naturels",
  "portrait-photo": "Portrait adulte naturel dans un décor éditorial",
  "portrait-retouch": "Portrait adulte retouché avec un rendu naturel",
  "rich-lifestyle": "Portrait adulte dans un décor lifestyle premium",
  "singles-awareness-day": "Portrait adulte célébrant l’autonomie et le bien-être",
  soccer: "Portrait adulte de supporter dans une ambiance de stade",
  "social-cards": "Portrait adulte conçu pour une carte de profil social",
  "street-style": "Portrait adulte de style urbain dans une rue contemporaine",
  swimsuit: "Adulte en maillot dans un décor de plage ou de piscine",
  "thanksgiving-photo": "Portrait adulte dans une scène chaleureuse d’Action de grâce",
  travel: "Portrait adulte dans un décor de voyage reconnaissable",
  "unblur-image": "Photo rendue plus nette avec des détails lisibles",
  urban: "Portrait adulte dans une scène urbaine contemporaine",
  "valentines-photo": "Portrait de couple adulte pour la Saint-Valentin",
  "virtual-try-on": "Adulte présentant une tenue de mode",
  "wedding-photo": "Portrait de couple adulte dans une ambiance de mariage"
};

function frenchEuPackSubject(themeSlug: string | undefined): string | undefined {
  return frenchEuPackSubjects[normalizeSlug(String(themeSlug ?? ""))];
}

function sourceSpecificAlt(
  imageUrl: string | undefined,
  locale: StorefrontMediaAltLocale,
  theme: string | undefined
): string {
  const canonical = canonicalSourceAltByPath[imageIdentity(imageUrl).toLowerCase()];
  if (canonical && locale === "en") return canonical;
  const sourceTopic = locale === "fr" ? frenchCopy(imageTopicFromUrl(imageUrl)) : imageTopicFromUrl(imageUrl);
  const genericTheme = /^(?:warm festive portrait for a seasonal card album|couple keepsake portrait|professional headshot|creator profile portrait)\.?$/i.test(cleanAltText(theme));
  const themeSubject = genericTheme
    ? ""
    : locale === "en" && /(?:^|-)edit-by-prompt(?:-|$)/.test(normalizeSlug(String(theme ?? "")))
    ? "AI photo edit preview"
    : locale === "fr"
      ? frenchThemeSubject(normalizeSlug(String(theme ?? ""))) || frenchCopy(cleanAltText(theme))
      : cleanAltText(theme);
  const subjectBase = themeSubject || (sourceTopic === "Storefront portrait" ? sourceTopic : sourceTopic);
  const subject = /\b(?:portrait|photo|image|avatar|logo|scene|video|poster)\b/i.test(subjectBase)
    ? subjectBase
    : `${subjectBase} portrait`;
  return compactMediaAltSentence(subject, locale);
}

export function storefrontSourceImageAlt({
  fallback,
  imageUrl,
  locale = "en"
}: {
  fallback?: string;
  imageUrl?: string;
  locale?: StorefrontMediaAltLocale;
}): string {
  return sourceSpecificAlt(imageUrl, locale, fallback);
}

function meaningfulAlt(value: string | undefined): string {
  const cleaned = cleanAltText(value);
  if (!cleaned) return "";
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (weakAltPattern.test(cleaned)) return "";
  if (legacyTemplateAltPattern.test(cleaned)) return "";
  if (productionDirectionAltPattern.test(cleaned)) return "";
  const brandMentions = cleaned.match(storefrontBrandNamePattern)?.length ?? 0;
  if (brandMentions > 0) return "";
  if (brandPlacementAltPattern.test(cleaned.toLowerCase()) && wordCount > 6) return "";
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
  const cleaned = locale === "fr" ? frenchCopy(meaningfulAlt(value)) : meaningfulAlt(value);
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
      /\b(?:portrait|portraits|gallery|galleries|scene|scenes|showing|package|packages|supporter|stadium|generated|private|cover|frame|customer|review|download|with|for|from|before|after|source|quality|result|fit|delivery|business|headshot|neon|travel|lifestyle|football|fan|creator|product|motion|ready|subscription|pricing|panel|album|options|image|images|photo|photos|video|videos|full|screen|view)\b/g
    );
    if (locale === "es" ? englishMarkers > 0 : englishMarkers >= 3) return "";
  }
  if (locale === "fr" && frenchAltEnglishLeakPattern.test(cleaned)) return "";
  if (locale === "fr" && spanishAltPattern.test(cleaned)) return "";
  return cleaned;
}

function altConflictsWithImageTheme(value: string, imageUrl: string | undefined): boolean {
  const key = imageSlugParts(imageUrl).join(" ");
  if (!key) return false;
  const cleaned = value.toLowerCase();

  if (/edit-by-prompt/.test(key)) {
    return /\b(?:social cards?|social profile|profile card|social-cards)\b/i.test(cleaned);
  }

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

const galleryFallbackScenes = [
  "portrait showing clear facial detail against a softly blurred background",
  "smiling portrait in a relaxed setting",
  "three-quarter portrait with the surrounding scene visible",
  "candid portrait with a natural expression",
  "seated portrait in a comfortable setting",
  "profile portrait with a softly lit background",
  "confident portrait with vivid surroundings",
  "portrait focused on the subject's face and expression",
  "lifestyle portrait in an everyday setting",
  "portrait during a social moment",
  "distinctive pose that highlights the theme",
  "natural portrait with an inviting atmosphere"
];
const spanishGalleryFallbackScenes = [
  "retrato con rasgos faciales nítidos sobre un fondo suavemente desenfocado",
  "retrato sonriente en un entorno relajado",
  "retrato de tres cuartos con el entorno visible",
  "retrato espontáneo con una expresión natural",
  "retrato sentado en un entorno cómodo",
  "retrato de perfil con un fondo suavemente iluminado",
  "retrato seguro con un entorno lleno de color",
  "retrato centrado en el rostro y la expresión",
  "retrato de estilo de vida en un entorno cotidiano",
  "retrato durante un momento social",
  "pose distintiva que resalta el tema",
  "retrato natural con un ambiente acogedor"
];
const frenchGalleryFallbackScenes = [
  "portrait montrant des traits nets sur un arrière-plan doucement flouté",
  "portrait souriant dans un cadre détendu",
  "portrait de trois-quarts laissant voir le décor",
  "portrait spontané à l’expression naturelle",
  "portrait assis dans un cadre confortable",
  "portrait de profil sur un arrière-plan légèrement éclairé",
  "portrait assuré dans un décor vivant",
  "portrait centré sur le visage et l’expression",
  "portrait lifestyle dans un cadre quotidien",
  "portrait pris pendant un moment convivial",
  "pose distinctive qui souligne le thème",
  "portrait naturel à l’atmosphère accueillante"
];

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
  const altOffset = altItems.length === galleryImages.length + 1 ? 1 : 0;

  const images: string[] = [];
  const alts: string[] = [];
  for (let index = 0; index < galleryImages.length && images.length < limit; index += 1) {
    const image = typeof galleryImages[index] === "string" ? galleryImages[index].trim() : "";
    if (!image) continue;
    images.push(image);
    const storedAlt = storefrontStoredMediaAlt(altItems[index + altOffset]);
    alts.push(storedAlt || galleryFallbackScenes[index % galleryFallbackScenes.length]);
  }
  return { galleryImageAlts: alts, galleryImages: images };
}

export function storefrontMediaAltLocaleForSite(site: AltSite | undefined): StorefrontMediaAltLocale {
  if (isFrenchStorefrontSite(site)) return "fr";
  return isSpanishStorefrontSite(site) ? "es" : "en";
}

export function storefrontMediaBrandName(site: AltSite | undefined): string {
  const host = String(site?.primaryDomain ?? "").toLowerCase();
  if (host === "aidreamshoots.eu" || site?.slug === "aidreamshoots") return "AIdreamshoots";
  if (site && isAidreamcapesCapabilitySite(site)) return "AIdreamcapes";
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
  return /(?:anime-avatar|profile-cards|social-cards|product-style|world-cup|stadium|football|soccer|watch-party|championship|tunnel-entrance|game-day-group|premiere|red-carpet|gala|mafia|cyberpunk|noir|christmas|holiday|thanksgiving|friendsgiving|halloween|spooky|new-year|fan-scene|supporter-photo|supporter-set|fan-wall|fan-photo|birthday-fan|fan-card|private-fan|travel|coastal|route|destination|nature|outdoor|wedding|engagement|valentine|desi|indian|beauty|hairstyle|fashion|boudoir|creator|try-on|upscaler)/.test(key);
}

function englishThemeSubject(key: string): string | undefined {
  if (/(edit-by-prompt)/.test(key)) {
    return "AI photo edit preview";
  }
  if (/\b(?:credit|subscription|plan|pricing|checkout)\b/.test(key)) {
    return "Credit plan panel for private photo galleries";
  }
  if (/(fan-scene|supporter-wall|supporter-photo|supporter-set|fan-wall|fan-photo|fan-collection|fan-letter|fan-keepsake|backstage|meetup|birthday-fan|fan-card|private-fan)/.test(key)) {
    return "Supporter portrait for a fan album";
  }
  if (/(gala|red-carpet|premiere|vip|award|award-night|spotlight|formal|evening)/.test(key)) {
    return "Red-carpet event portrait";
  }
  if (/(christmas-couple)/.test(key)) {
    return "Christmas couple portrait";
  }
  if (/(christmas-photos)/.test(key)) {
    return "Solo Christmas portrait";
  }
  if (/(thanksgiving)/.test(key)) {
    return "Thanksgiving group portrait";
  }
  if (/(halloween)/.test(key)) {
    return "Halloween party portrait";
  }
  if (/(holiday|seasonal)/.test(key)) {
    return "Seasonal holiday portrait";
  }
  if (/(cyberpunk|neon)/.test(key)) {
    return "Neon cyberpunk portrait";
  }
  if (/(mafia|noir)/.test(key)) {
    return "Noir character portrait";
  }
  if (/(anime-avatar)/.test(key)) {
    return "Stylized anime avatar portrait";
  }
  if (/(avatar)/.test(key)) {
    return "Social avatar portrait";
  }
  if (/(profile-cards|social-cards|avatar-card)/.test(key)) {
    return "Social profile card portrait";
  }
  if (/(headshot|professional|business|linkedin|executive)/.test(key)) {
    return "Professional headshot";
  }
  if (/(video|motion|clip|animation|add-ons?|addon|teaser)/.test(key)) {
    return "Motion-ready portrait preview";
  }
  if (/(product-style)/.test(key)) {
    return "Product lifestyle image";
  }
  if (/(product-style|product|upscaler|enhance|utility)/.test(key)) {
    return "Enhanced portrait preview";
  }
  if (/(creator-portraits)/.test(key)) {
    return "Creator portrait";
  }
  if (/(creator|profile|thumbnail|media-kit|personal-brand)/.test(key)) {
    return "Creator profile portrait";
  }
  if (/(world-cup|football|soccer|stadium|match-day|game-day|match|watch-party|championship|tunnel-entrance)/.test(key)) {
    return "Football fan portrait in a stadium";
  }
  if (/(indian-wedding)/.test(key)) {
    return "Indian wedding-style portrait with rich celebration styling";
  }
  if (/(desi-wedding)/.test(key)) {
    return "Desi wedding-style portrait with traditional celebration styling";
  }
  if (/(christmas|thanksgiving|friendsgiving|gratitude|halloween|spooky|costume-cast|cozy-card|family-occasion|winter|new-year)/.test(key)) {
    if (/(christmas-couple)/.test(key)) return "Christmas couple portrait";
    if (/(christmas-photos)/.test(key)) return "Solo Christmas portrait";
    if (/(thanksgiving)/.test(key)) return "Thanksgiving group portrait";
    if (/(halloween)/.test(key)) return "Halloween party portrait";
    return "Seasonal holiday portrait";
  }
  if (/(wedding|engagement|couple|valentine|desi|indian)/.test(key)) {
    return "Couple keepsake portrait";
  }
  if (/(travel|nature|route|coastal|destination|outdoor|road|mountain|cafe|island|villa)/.test(key)) {
    return "Travel portrait in a scenic setting";
  }
  if (/(beauty|hairstyle|hair|try-on|fashion|boudoir)/.test(key)) {
    if (/(hairstyle)/.test(key)) return "Hairstyle preview portrait";
    if (/(fashion)/.test(key)) return "Editorial fashion portrait";
    return "Beauty portrait";
  }
  return undefined;
}

function spanishThemeSubject(key: string): string | undefined {
  if (/\b(?:credit|subscription|plan|pricing|checkout|credito|suscripcion|plan)\b/.test(key)) {
    return "panel de creditos para galerias privadas";
  }
  if (/(christmas|thanksgiving|friendsgiving|gratitude|halloween|spooky|costume-cast|cozy-card|family-occasion|winter|new-year|navidad|temporada)/.test(key)) {
    return "retrato de celebracion de temporada";
  }
  if (/(fan-scene|muro de seguidores|seguidores|aficion|fan-letter|fan-keepsake|backstage|meetup|birthday-fan|fan-card|private-fan)/.test(key)) {
    return "retrato de aficionado para album privado";
  }
  if (/(holiday|seasonal)/.test(key)) {
    return "retrato de celebracion de temporada";
  }
  if (/(gala|red-carpet|premiere|vip|award|award-night|spotlight|formal|evening)/.test(key)) {
    return "retrato de evento estilo alfombra roja";
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
    return "retrato profesional";
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
    return "retrato de belleza";
  }
  return undefined;
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

function compactMediaAltSentence(
  value: string,
  locale: StorefrontMediaAltLocale
): string {
  const fallback = locale === "es" ? "imagen de escaparate" : locale === "fr" ? "image de présentation" : "Storefront image";
  const base = cleanAltText(value)
    .replace(/\s*,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  const spanishBase = locale === "es"
    ? base
      .replace(/\bportraits?\b/gi, "retrato")
      .replace(/\bgalleries?\b/gi, "galería")
      .replace(/\bscenes?\b/gi, "escena")
      .replace(/\bshowing\b/gi, "que muestra")
      .replace(/\bpackages?\b/gi, "paquete")
      .replace(/\bsupporter\b/gi, "aficionado")
      .replace(/\bstadium\b/gi, "estadio")
      .replace(/\bgenerated\b/gi, "generado")
      .replace(/\bprivate\b/gi, "privado")
      .replace(/\bcovers?\b/gi, "portada")
      .replace(/\bframes?\b/gi, "fotograma")
      .replace(/\bcustomer\b/gi, "cliente")
      .replace(/\breviews?\b/gi, "reseña")
      .replace(/\bdownload\b/gi, "descargar")
      .replace(/\bwith\b/gi, "con")
      .replace(/\bfrom\b/gi, "de")
      .replace(/\bbefore\b/gi, "antes")
      .replace(/\bafter\b/gi, "después")
      .replace(/\bsource\b/gi, "fuente")
      .replace(/\bquality\b/gi, "calidad")
      .replace(/\bresult\b/gi, "resultado")
      .replace(/\bfit\b/gi, "ajuste")
      .replace(/\bdelivery\b/gi, "entrega")
      .replace(/\bbusiness\b/gi, "profesional")
      .replace(/\bheadshots?\b/gi, "retrato profesional")
      .replace(/\bneon\b/gi, "neón")
      .replace(/\btravel\b/gi, "viaje")
      .replace(/\blifestyle\b/gi, "estilo de vida")
      .replace(/\bfootball\b/gi, "fútbol")
      .replace(/\bfan\b/gi, "aficionado")
      .replace(/\bcreator\b/gi, "creador")
      .replace(/\bproduct\b/gi, "producto")
      .replace(/\bmotion\b/gi, "movimiento")
      .replace(/\bready\b/gi, "listo")
      .replace(/\bsubscription\b/gi, "suscripción")
      .replace(/\bpricing\b/gi, "precios")
      .replace(/\balbum\b/gi, "álbum")
      .replace(/\boptions?\b/gi, "opciones")
      .replace(/\bimages?\b/gi, "imágenes")
      .replace(/\bphotos?\b/gi, "fotos")
      .replace(/\bvideos?\b/gi, "vídeos")
      .replace(/\bfull screen\b/gi, "pantalla completa")
      .replace(/\bview\b/gi, "vista")
      .replace(/\s+/g, " ")
      .trim()
    : base;
  return compactAltSentence(spanishBase || fallback, locale);
}

export function storefrontAccessibleMediaAlt({
  fallback,
  imageUrl,
  locale = "en",
  value
}: {
  fallback?: string;
  imageUrl?: string;
  index?: number;
  locale?: StorefrontMediaAltLocale;
  value?: string;
}): string {
  const cleanedValue = meaningfulAlt(value);
  const spanishEnglishMediaAltPattern = /\b(?:portrait|portraits|gallery|scene|showing|package|supporter|stadium|generated|private|cover|frame|customer|review|download|with|for|from|before|after|source|quality|result|fit|delivery|business|headshot|neon|travel|lifestyle|football|fan|creator|product|motion|ready|subscription|pricing|panel|album|options|image|images|photo|photos|video|videos|full|screen|view)\b/i;
  const localizedValue = locale === "es" && spanishEnglishMediaAltPattern.test(cleanedValue)
    ? ""
    : locale === "fr" && spanishAltPattern.test(cleanedValue)
      ? ""
      : locale === "fr" && frenchAltEnglishLeakPattern.test(cleanedValue)
        ? ""
      : locale === "fr" ? frenchCopy(cleanedValue) : cleanedValue;
  const cleanedFallback = meaningfulAlt(fallback);
  const localizedFallback = locale === "es" && spanishEnglishMediaAltPattern.test(cleanedFallback)
    ? ""
    : locale === "fr" && spanishAltPattern.test(cleanedFallback)
      ? ""
      : locale === "fr" && frenchAltEnglishLeakPattern.test(cleanedFallback)
        ? ""
      : locale === "fr" ? frenchCopy(cleanedFallback) : cleanedFallback;
  const imageThemeKey = themeImageSlugParts(imageUrl).join(" ");
  const themedAlt = locale === "es"
    ? spanishThemeSubject(imageThemeKey)
    : locale === "fr"
      ? frenchThemeSubject(imageThemeKey)
      : englishThemeSubject(imageThemeKey);
  const genericFileAlt = localizedValue && filenameLikeAltPattern.test(localizedValue);
  if (localizedValue && !genericFileAlt) return localizedValue;
  const base = genericFileAlt
    ? themedAlt || localizedValue
    : localizedValue || localizedFallback || themedAlt || (locale === "es" ? "imagen de escaparate" : locale === "fr" ? "image de présentation" : "Storefront image");
  return compactMediaAltSentence(base, locale);
}

export function storefrontPackMediaAlt(input: PackAltInput): string {
  const locale = input.locale ?? "en";
  const brand = cleanAltText(input.brand) || (locale === "es" ? "AIdreamshoots" : locale === "fr" ? "AIdreamcapes" : "MyDreamShoots");
  const explicit = meaningfulThemeAlignedAltForStorefront(input.explicitAlt, locale, brand, input.imageUrl);
  const isPackGalleryImage = input.role === "gallery" || /\/pack-galleries\//i.test(String(input.imageUrl ?? ""));
  const rawGalleryAlt = (input.role === "gallery" || isPackGalleryImage)
    && typeof input.index === "number"
    ? meaningfulThemeAlignedAltForStorefront(input.galleryImageAlts?.[input.index], locale, brand, input.imageUrl)
    : "";
  const galleryAlt = /\bcover\b/i.test(rawGalleryAlt) ? "" : rawGalleryAlt;
  const normalizedGalleryAlt = cleanAltText(rawGalleryAlt).toLowerCase();
  const galleryAltRepeatsEarlier = isPackGalleryImage && normalizedGalleryAlt && typeof input.index === "number"
    ? input.galleryImageAlts
      ?.slice(0, input.index)
      .some((candidate) => cleanAltText(candidate).toLowerCase() === normalizedGalleryAlt)
    : false;

  const specificKey = themeKey(input);
  const imageKey = themeImageSlugParts(input.imageUrl).join(" ");
  const contextKey = contextualThemeKey(input);
  const euPackSubject = locale === "fr" ? frenchEuPackSubject(input.themeSlug) : undefined;
  const imageEuPackSlug = locale === "fr"
    ? Object.keys(frenchEuPackSubjects)
      .sort((left, right) => right.length - left.length)
      .find((slug) => imageKey.includes(slug))
    : undefined;
  const imageEuPackSubject = locale === "fr" ? frenchEuPackSubject(imageEuPackSlug) : undefined;
  const specificScene = locale === "es" ? spanishThemeSubject(specificKey) : locale === "fr" ? frenchThemeSubject(specificKey) : englishThemeSubject(specificKey);
  const imageScene = locale === "es" ? spanishThemeSubject(imageKey) : locale === "fr" ? frenchThemeSubject(imageKey) : englishThemeSubject(imageKey);
  const contextScene = locale === "es" ? spanishThemeSubject(contextKey) : locale === "fr" ? frenchThemeSubject(contextKey) : englishThemeSubject(contextKey);
  const scene = euPackSubject
    ?? imageEuPackSubject
    ?? (imageScene && (imageSlugHasSpecificTheme(imageKey) || !specificScene || genericSceneSubject(specificScene))
      ? imageScene
      : specificScene
        ?? imageScene
        ?? contextScene
        ?? (locale === "es"
          ? "retrato estilizado para una galeria privada"
          : locale === "fr" ? "portrait stylisé pour une galerie privée" : "Portrait image"));
  const sourceAlt = sourceSpecificAlt(input.imageUrl, locale, input.title || imageScene || specificScene || contextScene);
  const normalizedExplicit = cleanAltText(explicit).toLowerCase();
  const genericSceneAlts = [specificScene, imageScene, contextScene]
    .map((value) => cleanAltText(value).toLowerCase())
    .filter(Boolean);
  // A canonical subject such as "Professional headshot" is useful as a
  // theme label but cannot distinguish two different source images. Let the
  // stable filename or gallery scene fallback add the visual distinction.
  const explicitIsGenericScene = genericSceneAlts.includes(normalizedExplicit) || /^(?:warm festive portrait for a seasonal card album|couple keepsake portrait|professional headshot|creator profile portrait)\.?$/i.test(normalizedExplicit);
  if (input.role === "card" && /\/pack-covers\//i.test(imageIdentity(input.imageUrl)) && (!explicit || explicitIsGenericScene)) {
    return compactMediaAltSentence(sourceAlt, locale);
  }
  if (!isPackGalleryImage && stableSourceImagePattern.test(imageIdentity(input.imageUrl)) && (!explicit || explicitIsGenericScene)) {
    return compactMediaAltSentence(sourceAlt, locale);
  }
  const usableExplicit = templatedSceneAltPattern.test(explicit) || explicitIsGenericScene && stableSourceImagePattern.test(imageIdentity(input.imageUrl)) ? "" : explicit;
  const usableGalleryAlt = templatedSceneAltPattern.test(galleryAlt) || explicitIsGenericScene ? "" : galleryAlt;
  if (usableExplicit) return compactMediaAltSentence(usableExplicit, locale);
  if (usableGalleryAlt && !galleryAltRepeatsEarlier) return compactMediaAltSentence(usableGalleryAlt, locale);
  if (isPackGalleryImage && (input.galleryImageAlts?.length ?? 0) > 0 && typeof input.index === "number") {
    const fallbackScenes = locale === "es"
      ? spanishGalleryFallbackScenes
      : locale === "fr" ? frenchGalleryFallbackScenes : galleryFallbackScenes;
    const fallback = fallbackScenes[input.index % fallbackScenes.length];
    // Keep the scene qualifier in the first clause. The compacting helper
    // intentionally trims comma-separated text when an alt is long; a dash
    // prevents every fallback image from collapsing to the same theme label.
    return compactMediaAltSentence(`${scene} — ${fallback}`, locale);
  }
  if (stableSourceImagePattern.test(imageIdentity(input.imageUrl))) return sourceAlt;
  const fallbackScene = locale === "es"
    ? "retrato"
    : locale === "fr" ? "portrait" : "Portrait image";
  const naturalScene = scene || fallbackScene;
  return compactMediaAltSentence(naturalScene, locale);
}

function storedAltForPackImage(pack: CreativePack, imageUrl: string | undefined): string | undefined {
  const identity = imageIdentity(imageUrl);
  if (!identity) return undefined;
  const images = [pack.imageUrl, ...(pack.galleryImages ?? [])]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  const imageIndex = images.findIndex((candidate) => imageIdentity(candidate) === identity);
  if (imageIndex < 0) return undefined;
  const alts = pack.galleryImageAlts ?? [];
  if (alts.length === images.length) return alts[imageIndex];
  if (imageIndex > 0 && alts.length === images.length - 1) return alts[imageIndex - 1];
  return undefined;
}

function directAltForPackImage(pack: CreativePack, imageUrl: string | undefined): string | undefined {
  const identity = imageIdentity(imageUrl);
  if (!identity) return undefined;
  const images = [pack.imageUrl, ...(pack.galleryImages ?? [])]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
  const imageIndex = images.findIndex((candidate) => imageIdentity(candidate) === identity);
  if (imageIndex < 0) return undefined;
  const alts = pack.galleryImageAlts ?? [];
  const offset = alts.length === images.length + 1 ? 0 : alts.length === images.length - 1 ? 1 : 0;
  return alts[imageIndex - offset];
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
  // Published snapshots have historically stored either 13 alts (cover plus
  // twelve gallery images) or 12 gallery-only alts. Resolve the canonical
  // description by URL first so either representation stays aligned.
  const directAlt = directAltForPackImage(pack, imageUrl);
  const isGalleryRole = role === "gallery" || /\/pack-galleries\//i.test(String(imageUrl ?? ""));
  const storedAlt = isGalleryRole
    ? undefined
    : role === "card" && explicitAlt
      ? explicitAlt
      : directAlt || storedAltForPackImage(pack, imageUrl);
  const storedGalleryAlts = pack.galleryImageAlts ?? [];
  const galleryImageAlts = /\bcover\b/i.test(storedGalleryAlts[0] ?? "")
    ? storedGalleryAlts.slice(1)
    : storedGalleryAlts;
  return storefrontPackMediaAlt({
    brand,
    category: pack.categoryRecord?.label || pack.category,
    description: pack.description || pack.headline,
    // A resource has one canonical description, even when it appears in a
    // card, a gallery, or a related-package block.
    explicitAlt: storedAlt || explicitAlt,
    galleryImageAlts,
    imageUrl,
    index,
    locale,
    meta: pack.categoryRecord?.parent?.label,
    role,
    themeSlug: pack.categoryRecord?.slug || pack.category,
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
    : cleanAltText(title) || (locale === "fr" ? "vidéo IA" : "AI video");
  return compactMediaAltSentence(
    locale === "es" ? `Imagen de portada para ${cleanTitle}` : locale === "fr" ? `Image de couverture pour ${cleanTitle}` : `Poster frame for ${cleanTitle}`,
    locale
  );
}
