import type { Site, ThemePageJson, ThemeSettingValue } from "@/lib/types";

export const AIDREAMSHOOTS_ENGAGEMENT_FRENCH_PATH = "/ai-image-generation/engagement-photo";
const AIDREAMSHOOTS_ENGAGEMENT_LEGACY_PATH = "/collections/engagement-photo";

export const AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY = {
  seoTitle: "Fotos de compromiso con IA para pedidas de mano y anuncios | AIdreamshoots",
  seoDescription: "Crea fotos de compromiso con IA para una pedida de mano, un anuncio de pareja, un primer plano del anillo y recuerdos románticos en un álbum privado.",
  seoKeywords: "fotos de compromiso con IA, fotos de pedida de mano, anuncio de compromiso, fotos de pareja, álbum de fotos privado",
  canonicalPath: AIDREAMSHOOTS_ENGAGEMENT_FRENCH_PATH,
  label: "Fotos de compromiso",
  headline: "Fotos de compromiso con IA para tu pedida de mano",
  metaLabel: "Fotos de compromiso",
  tags: ["Pedida de mano", "Anuncio de compromiso", "Historia de pareja", "Anillo", "Álbum privado"],
  detailTags: ["Álbum privado", "Fotos con IA", "22 créditos", "Modelo privado"],
  detailIntro: "Crea una serie coherente de fotos de compromiso a partir de tus imágenes, revisa el coste en créditos antes de empezar y encuentra cada resultado en tu álbum privado de AIdreamshoots.",
  whatCreates: "Este tema crea un álbum privado con una estética coherente, encuadres románticos, detalles del anillo e imágenes listas para descargar y compartir como anuncio o recuerdo de pareja.",
  bestFor: [
    "Pedidas de mano y anuncios de compromiso",
    "Preparación de un álbum privado de pareja",
    "Fotos para redes sociales e invitaciones",
    "Selección de imágenes listas para descargar"
  ],
  workflow: [
    "Sube fotos nítidas que te pertenezcan o cuyo uso tengas autorizado.",
    "Revisa la dirección del paquete antes de gastar créditos.",
    "Genera un álbum privado y conserva solo los resultados que te convenzan."
  ],
  reviewPoints: [
    "Luz natural y expresiones espontáneas",
    "Encuadres variados: pareja, anillo y detalles de la pedida",
    "Colores cálidos adecuados para un anuncio de compromiso"
  ],
  coverNote: "Revisa la portada y la dirección visual antes de iniciar el paquete.",
  galleryTitle: "13 ejemplos de fotos de compromiso con IA",
  galleryIntro: "Explora trece variaciones originales del tema antes de elegir la dirección que mejor encaja con vuestra historia.",
  ctaEyebrow: "Crea tu serie de compromiso",
  ctaTitle: "Crea tus fotos de compromiso en tu espacio privado.",
  ctaSubtitle: "Sube tus fotos, controla los créditos y recibe una serie coherente en tu galería privada.",
  ctaLabel: "Crear mis fotos de compromiso",
  faqEyebrow: "Preguntas sobre las fotos de compromiso",
  faqTitle: "Resuelve tus dudas antes de empezar",
  faqItems: [
    [
      "¿Puedo crear una serie de compromiso sin una foto reciente de la pareja?",
      "Sí. Usa varias fotos nítidas y autorizadas de cada persona, tomadas desde ángulos y con iluminaciones diferentes para orientar el resultado."
    ],
    [
      "¿La IA puede conservar exactamente mi anillo?",
      "Los detalles pequeños, como un grabado o una piedra, pueden variar. Revisa siempre el anillo y las manos antes de descargar una imagen para publicar."
    ],
    [
      "¿Puedo usar estas imágenes para un anuncio o una invitación?",
      "Sí, si tienes los derechos de las fotos originales, todas las personas representadas han dado su permiso y el canal de publicación cumple sus normas sobre contenido generado con IA."
    ],
    [
      "¿Qué diferencia hay entre una serie de compromiso y una de boda?",
      "La serie de compromiso se centra en la pedida, el anuncio, el anillo y los momentos espontáneos de la pareja. Un tema de boda se enfoca más en la ceremonia, los trajes y la celebración."
    ],
    [
      "¿Cuántas imágenes y créditos incluye?",
      "La página presenta 13 ejemplos visuales; el número de imágenes generadas y el coste de 22 créditos aparecen antes de iniciar la generación."
    ],
    [
      "¿Dónde encuentro las imágenes terminadas?",
      "Los resultados terminados permanecen en tu galería privada. Puedes revisarlos, conservarlos y descargar solo las imágenes que encajen con tu proyecto."
    ]
  ] as const,
  relatedEyebrow: "Paquetes de fotos relacionados",
  relatedTitle: "Sigue explorando",
  relatedSubtitle: "Compara otros temas románticos antes de elegir las fotos originales y la dirección de tu próxima serie.",
  relatedCtaLabel: "Ver todos los paquetes",
  relatedLinks: [
    { label: "Fotos de boda", href: "/ai-image-generation/wedding-photo" },
    { label: "Fotos de San Valentín", href: "/ai-image-generation/valentines-day-photo" },
    { label: "Fotos de Navidad", href: "/ai-image-generation/christmas-photo" }
  ],
  ctaHref: "/app/create"
} as const;

export const AIDREAMSHOOTS_ENGAGEMENT_FRENCH_IMAGE_ALTS = [
  "Pareja celebrando su compromiso junto a un lago al atardecer durante una pedida romántica",
  "Pareja adulta celebrando su compromiso en una terraza urbana al amanecer",
  "Primer plano de las manos de una pareja mostrando un anillo de compromiso en un jardín",
  "Pareja comprometida caminando por una calle europea para anunciar su compromiso",
  "Pareja comprometida junto a un acantilado con un ramo de flores",
  "Pareja celebrando su compromiso con un brindis íntimo en un café luminoso",
  "Pareja comprometida contemplando las montañas con el anillo bien visible",
  "Sesión de fotos de compromiso de una pareja en una galería de arte contemporáneo",
  "Pareja comprometida compartiendo bengalas en la playa al caer la noche",
  "Pareja celebrando su compromiso durante un picnic romántico entre viñedos",
  "Anillo de compromiso junto a una cena íntima con la pareja desenfocada al fondo",
  "Pareja comprometida abrazada bajo un paraguas en una calle lluviosa",
  "Retrato de una pareja comprometida en un campo de flores con luz natural"
] as const;

const PAGE_TEXT_REPLACEMENTS: Record<string, string> = {
  "CATEGORIAS DE FOTOS": "FOTOS DE COMPROMISO",
  "compromiso foto": "Fotos de compromiso",
  "Crea aidreamshoots desde tus fotos, revisa los créditos antes de generar y guarda el resultado en una galería privada de AIdreamshoots.": "Crea tus fotos de compromiso con IA, revisa el coste en créditos antes de empezar y encuentra el resultado en tu álbum privado de AIdreamshoots.",
  "VISTA DEL TEMA": "VISTA PREVIA DEL TEMA",
  "Revisa la portada antes de iniciar el paquete.": "Revisa la portada antes de iniciar el paquete.",
  "Que crea": "Qué puedes crear",
  "Como funciona": "Cómo funciona",
  "12 imagenes del tema": "13 ejemplos del tema",
  "Revisa variaciones visuales antes de iniciar el paquete.": "Explora las variaciones visuales antes de iniciar el paquete.",
  "Paquetes de fotos para perfiles, pareja y álbumes.": "Paquetes de fotos para perfiles, parejas y álbumes privados.",
  "Ideas de fotos y vídeos con IA con IA": "Ideas de fotos y vídeos con IA para tus anuncios",
  "De selfie un album privado.": "Del selfie al álbum privado.",
  "Preguntas frecuentes": "Preguntas frecuentes",
  "¿Listo para probar AIdreamshoots?": "¿Listo para probar AIdreamshoots?",
  "Crear mi primer conjunto de fotos": "Crear mi primera serie de fotos",
  "Ver paquetes": "Ver paquetes",
  "Fotos IA": "Fotos con IA",
  "Galeria privada": "Álbum privado",
  "Modelo privado": "Modelo privado",
  "Iniciar este paquete": "Iniciar este paquete",
  "Retrato profesional pack": "Paquete de retrato profesional",
  "Everyday retrato": "Retrato cotidiano",
  "gala resultado": "Resultado de gala",
  "conjunto de belleza": "Serie de belleza",
  "Private gallery example": "Ejemplo de álbum privado",
  "Ejemplo de galería privada": "Ejemplo de álbum privado",
  "Cuando se descuentan los créditos?": "¿Cuándo se descuentan los créditos?",
  "Qué selfies funcionan mejor?": "¿Qué selfies funcionan mejor?",
  "Puedo probar estilos distintos?": "¿Puedo probar distintos estilos?",
  "Donde veo mis álbumes?": "¿Dónde veo mis álbumes?"
};

function normalizePath(value: string | undefined): string {
  const path = String(value ?? "").split("?")[0].split("#")[0].replace(/\/+$/, "");
  return path || "/";
}

export function isAidreamshootsEngagementFrenchPage(
  site: Pick<Site, "id"> | undefined,
  pagePath: string | undefined
): boolean {
  if (site?.id !== "site_mydreamshoots_xby") return false;
  const normalizedPath = normalizePath(pagePath);
  return normalizedPath === AIDREAMSHOOTS_ENGAGEMENT_FRENCH_PATH || normalizedPath === AIDREAMSHOOTS_ENGAGEMENT_LEGACY_PATH;
}

export function aidreamshootsEngagementFrenchImageAlt(index: number, fallback = "Foto de compromiso creada con IA"): string {
  return AIDREAMSHOOTS_ENGAGEMENT_FRENCH_IMAGE_ALTS[index] ?? fallback;
}

export function aidreamshootsEngagementFrenchCoverAlt(): string {
  return "Portada de una serie de fotos de compromiso con IA junto a un lago al atardecer";
}

export function aidreamshootsEngagementFrenchRelatedLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("wedding") || normalized.includes("boda") || normalized.includes("mariage")) return "Fotos de boda";
  if (normalized.includes("valentine") || normalized.includes("san valentin") || normalized.includes("saint-valentin")) return "Fotos de San Valentín";
  if (normalized.includes("christmas") || normalized.includes("navidad") || normalized.includes("noël")) return "Fotos de Navidad";
  if (normalized.includes("portrait") || normalized.includes("retrato")) return "Retratos profesionales";
  if (normalized.includes("beauty") || normalized.includes("belleza")) return "Serie de belleza";
  return "Inspiración romántica";
}

function localizeString(value: string): string {
  const exact = PAGE_TEXT_REPLACEMENTS[value.trim()];
  if (exact) return exact;
  return value
    .split("|")
    .map((part) => PAGE_TEXT_REPLACEMENTS[part.trim()] ?? part)
    .join("|");
}

function localizeValue(value: ThemeSettingValue, key = ""): ThemeSettingValue {
  const protectedKey = /(?:href|url|slug|anchor|id|path|image|logo|canonical|keyword)/i.test(key);
  if (typeof value === "string") return protectedKey ? value : localizeString(value);
  if (Array.isArray(value)) return value.map((item) => localizeValue(item, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, localizeValue(nestedValue as ThemeSettingValue, nestedKey)])
    ) as ThemeSettingValue;
  }
  return value;
}

/**
 * Applies only the engagement-photo page copy at render time. The stored page
 * JSON remains untouched, so this cannot change the Spanish storefront or any
 * other site/page.
 */
export function localizeAidreamshootsEngagementFrenchPageJson(page: ThemePageJson): ThemePageJson {
  const sections = Object.fromEntries(
    Object.entries(page.sections).map(([sectionId, section]) => [
      sectionId,
      {
        ...section,
        settings: Object.fromEntries(
          Object.entries(section.settings).map(([key, value]) => [key, localizeValue(value, key)])
        ),
        blocks: section.blocks?.map((block) => ({
          ...block,
          settings: Object.fromEntries(
            Object.entries(block.settings).map(([key, value]) => [key, localizeValue(value, key)])
          )
        }))
      }
    ])
  ) as ThemePageJson["sections"];
  return {
    ...page,
    sections,
    seo: {
      ...page.seo,
      title: AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.seoTitle,
      description: AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.seoDescription,
      keywords: AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.seoKeywords,
      canonicalPath: AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.canonicalPath,
      canonical: AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.canonicalPath,
      index: true,
      follow: true,
      robots: { index: true, follow: true, maxImagePreview: "large" }
    },
    relatedLinks: AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY.relatedLinks.map((link) => ({ ...link }))
  };
}
