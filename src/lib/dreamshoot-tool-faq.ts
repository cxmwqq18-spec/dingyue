import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { isAidreamcapesSite as isAidreamcapesCapabilitySite } from "@/lib/storefront-context/capabilities";
import type { SectionBlockInstance, Site } from "@/lib/types";

type ToolFaqSite = Pick<Site, "id" | "slug" | "name" | "primaryDomain"> & { branding: Pick<Site["branding"], "logoText"> };

export type DreamshootToolFaqInput = {
  site?: ToolFaqSite;
  toolSlug: string;
  label: string;
  description?: string;
  category?: string;
  workflow?: string[];
  useCases?: string[];
};

export type DreamshootToolFaqItem = [question: string, answer: string];

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function sanitizeId(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "tool";
}

function isAidreamcapesSite(site: ToolFaqSite | undefined): boolean {
  if (!site) return false;
  return isAidreamcapesCapabilitySite(site);
}

function isSpanishSite(site: ToolFaqSite | undefined): boolean {
  return Boolean(site && isSpanishStorefrontSite(site));
}

function brandName(input: DreamshootToolFaqInput): string {
  if (input.site?.branding.logoText) return input.site.branding.logoText;
  return isAidreamcapesSite(input.site) ? "Aidreamcapes" : "myDreamshoots";
}

function shortDescription(value: string): string {
  const text = cleanText(value);
  if (!text) return "";
  const firstSentence = text.match(/^(.+?[.!?])(?:\s|$)/)?.[1];
  return cleanText(firstSentence ?? text);
}

function withoutRepeatedSafetySentence(value: string, brand: string): string {
  return cleanText(value)
    .replace(new RegExp(`\\s*${brand}\\s+does not recreate[^.]*\\.`, "ig"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toolDescription(input: DreamshootToolFaqInput): string {
  const fallback = `${input.label} helps customers create private AI results from approved source photos.`;
  return withoutRepeatedSafetySentence(shortDescription(input.description || input.workflow?.[0] || input.useCases?.[0] || fallback), brandName(input)) || fallback;
}

function toolUseCase(input: DreamshootToolFaqInput) {
  const haystack = `${input.toolSlug} ${input.label} ${input.description ?? ""} ${input.category ?? ""} ${(input.workflow ?? []).join(" ")}`.toLowerCase();
  if (/video|motion|clip|film/.test(haystack)) {
    return {
      noun: "motion concept",
      upload: "Use one strong still image with a clear subject, balanced composition, and enough background space for movement.",
      review: "Watch for face drift, unnatural motion, warped hands, flicker, background stretching, and any text or logo distortion before downloading."
    };
  }
  if (/upscal|enhance|restore|quality|sharpen/.test(haystack)) {
    return {
      noun: "enhanced image",
      upload: "Use the cleanest version of the image you have, preferably without heavy compression, screenshots, extreme blur, or pasted text.",
      review: "Inspect edges, skin texture, eyes, product details, text-like marks, and over-sharpened areas before using the enhanced file."
    };
  }
  if (/background|remove|replace/.test(haystack)) {
    return {
      noun: "background-edited image",
      upload: "Use a photo where the subject is separated from the background, with clear edges around hair, hands, clothing, or product details.",
      review: "Check subject edges, shadows, reflections, background realism, logos, text-like marks, and crop quality before publishing."
    };
  }
  if (/headshot|linkedin|resume|team|founder|professional/.test(haystack)) {
    return {
      noun: "professional headshot set",
      upload: "Use recent portraits with good light, a visible face, natural expression, and several angles if the page asks for more than one source image.",
      review: "Check identity consistency, eyes, teeth, hairline, skin texture, jacket edges, background realism, and professional suitability before posting."
    };
  }
  if (/fan|game|stadium|supporter|world cup|watch party/.test(haystack)) {
    return {
      noun: "fan-scene album",
      upload: "Use permission-safe portraits or group photos with visible faces and no protected logos, official marks, or unauthorized public-figure references.",
      review: "Check faces, group spacing, hands, jersey-like details, unofficial marks, captions, and any wording that might imply a real endorsement."
    };
  }
  if (/holiday|christmas|thanksgiving|halloween|seasonal|keepsake|card/.test(haystack)) {
    return {
      noun: "seasonal album",
      upload: "Use clear portraits or group photos with permission from everyone shown, plus simple mood direction for cards, keepsakes, or private album covers.",
      review: "Check faces, hands, card-ready crops, background details, festive objects, text-like marks, and whether the result feels appropriate to share."
    };
  }
  if (/creator|portrait|avatar|profile|social|media kit|brand/.test(haystack)) {
    return {
      noun: "creator portrait set",
      upload: "Use portraits or references that reflect the creator style you want, with permission-safe images, visible faces, and enough detail for profile-ready crops.",
      review: "Check face consistency, pose, expression, wardrobe, background, crop options, and whether the image fits the profile, media kit, or campaign channel."
    };
  }
  if (/product|try.?on|fashion|style|beauty|hairstyle|gala/.test(haystack)) {
    return {
      noun: "style preview",
      upload: "Use clear source photos or references that show the subject, outfit, hair, product, or visual direction without confusing filters or copyrighted assets.",
      review: "Check fit expectations, product shape, hair or clothing edges, face identity, background artifacts, and whether the result should be treated as a preview."
    };
  }
  return {
    noun: "private AI image set",
    upload: "Use clear source photos or references you own or have permission to process, with the subject visible and the intended edit easy to understand.",
    review: "Inspect faces, hands, eyes, background artifacts, crop quality, text-like marks, logos, and realism before using a result publicly."
  };
}

function frenchToolUseCase(input: DreamshootToolFaqInput) {
  const haystack = `${input.toolSlug} ${input.label} ${input.description ?? ""}`.toLowerCase();
  if (/christmas|winter|holiday/.test(haystack)) {
    return {
      noun: "un album photo de saison",
      upload: "Importez des portraits ou des photos de groupe nettes, avec l’accord des personnes représentées et une ambiance festive précise.",
      review: "Vérifiez les visages, les mains, les éléments décoratifs et les recadrages avant de télécharger la série."
    };
  }
  if (/thanksgiving|friendsgiving/.test(haystack)) {
    return {
      noun: "un album souvenir de groupe",
      upload: "Importez des photos de groupe lumineuses dont vous détenez les droits, puis indiquez l’ambiance chaleureuse recherchée.",
      review: "Vérifiez les visages, les mains, la table, les détails d’automne et la cohérence de chaque souvenir."
    };
  }
  if (/halloween|costume|birthday|new-year|countdown/.test(haystack)) {
    return {
      noun: "un album de célébration privé",
      upload: "Importez des portraits clairs et autorisés, puis décrivez les couleurs, les costumes ou l’ambiance originale souhaitée.",
      review: "Vérifiez les visages, les mains, les accessoires, les recadrages et l’absence de marques ou de personnages protégés."
    };
  }
  if (/stadium|game-day|watch-party|supporter|fan|backstage/.test(haystack)) {
    return {
      noun: "un album privé pour fans",
      upload: "Importez des portraits ou des photos de groupe dont vous avez l’autorisation, avec des visages visibles et une direction claire.",
      review: "Vérifiez les visages, les groupes, les mains, les symboles et l’absence de logo officiel ou d’affiliation trompeuse."
    };
  }
  return {
    noun: "un album photo privé",
    upload: "Importez des photos nettes dont vous détenez les droits ou l’autorisation de traitement, avec un sujet bien visible.",
    review: "Vérifiez les visages, les mains, les arrière-plans, les recadrages et les éventuels artefacts avant le partage."
  };
}

export function dreamshootToolDetailFaqItems(input: DreamshootToolFaqInput): DreamshootToolFaqItem[] {
  const label = cleanText(input.label) || "this AI tool";
  const useCase = toolUseCase({ ...input, label });
  const brand = brandName(input);
  const aidreamcapes = isAidreamcapesSite(input.site);
  const spanish = isSpanishSite(input.site);
  const description = toolDescription({ ...input, label });
  if (input.site?.id === "site_aidreamcapes_xby") {
    const frenchUseCase = frenchToolUseCase({ ...input, label });
    const workspace = "votre galerie privée Aidreamcapes";
    return [
      [`À quoi sert ${label} ?`, `${label} permet de créer ${frenchUseCase.noun} à partir de photos autorisées. ${description} Vous pouvez vérifier le résultat, les crédits et la confidentialité avant le téléchargement.`],
      [`Quelles photos importer pour ${label} ?`, `${frenchUseCase.upload} Évitez les captures d’écran, les images trop petites et les personnes dont l’utilisation n’est pas autorisée.`],
      [`Comment décrire le résultat de ${label} ?`, "Indiquez l’usage final, le cadrage, l’ambiance, les couleurs et les éléments à éviter. Préférez une direction originale aux références à une personne publique ou à une marque protégée."],
      [`Comment les crédits sont-ils gérés avec ${label} ?`, "Le coût en crédits est affiché avant le lancement de la demande. Les crédits réservés sont ensuite débités ou libérés selon l’état enregistré de la génération."],
      [`Où trouver les résultats de ${label} ?`, `Les résultats terminés restent liés à votre compte et apparaissent dans ${workspace}, où vous pouvez les vérifier et les télécharger.`],
      [`Que vérifier avant de partager les résultats de ${label} ?`, `${frenchUseCase.review} Confirmez également les autorisations, les règles de la plateforme et l’éventuelle mention de contenu généré par IA avant toute publication.`]
    ];
  }
  if (spanish) {
    const workspace = aidreamcapes ? "galeria privada de Aidreamcapes" : `galeria privada de ${brand}`;
    return [
      [`Para que sirve ${label}?`, `${label} ayuda a crear un ${useCase.noun} privado desde fotos fuente aprobadas. ${description}`],
      [`Que fotos debo subir para ${label}?`, useCase.upload.replace(/^Use\b/, "Usa").replace(/^Upload\b/, "Sube")],
      [`Como debo describir el resultado de ${label}?`, "Describe el uso final, recorte, ambiente, fondo, ropa o movimiento de forma concreta, y evita identidades publicas no autorizadas, marcas oficiales o afiliaciones falsas."],
      [`Como se usan los creditos en ${label}?`, "Los creditos se muestran antes de empezar, pueden reservarse durante el procesamiento y se liquidan o liberan segun el estado registrado del pedido."],
      [`Donde aparecen los resultados de ${label}?`, `Los resultados terminados quedan vinculados a la cuenta iniciada y aparecen en la ${workspace} para revisar, descargar y conservar historial.`],
      [`Que debo revisar antes de publicar resultados de ${label}?`, "Revisa permisos, identidad, manos, ojos, marcas, recortes, artefactos, reglas de la plataforma y cualquier aviso de IA necesario antes de compartir."]
    ];
  }
  const workspace = aidreamcapes ? "Aidreamcapes private gallery" : `${brand} private workspace`;
  const ownershipLine = aidreamcapes
    ? "Keep requests original, avoid unauthorized public-figure likenesses, official team marks, protected logos, venue marks, trademarks, and captions that imply a real endorsement."
    : "Use only photos and references you own or have permission to process, and avoid unauthorized people, protected logos, official marks, or misleading commercial claims.";
  return [
    [
      `What is ${label} best for?`,
      `${label} is best for creating a ${useCase.noun} from approved source photos. ${description} The page is meant for customers who want to compare the expected output, privacy path, and credit requirement before starting generation.`
    ],
    [
      `Which photos should I upload for ${label}?`,
      `${useCase.upload} Better source material usually improves identity consistency, crop quality, background realism, and the number of usable results in the finished private gallery.`
    ],
    [
      `How should I write direction for ${label}?`,
      `Give practical direction about the final use, crop, mood, scene, outfit, background, or motion goal instead of asking for a vague makeover. ${ownershipLine}`
    ],
    [
      `How are credits handled when using ${label}?`,
      `${brand} shows the credit requirement before a supported ${label} request starts. Credits can be reserved while processing runs, then settled or released according to the recorded job status, so you can compare this tool with other paid AI photo and video options before committing.`
    ],
    [
      `Where do ${label} results appear?`,
      `Finished ${label} outputs stay connected to the signed-in account and appear in the ${workspace} for review, download, and account history. Results are not public by default, but you control anything you download, publish, or send outside the workspace.`
    ],
    [
      `What should I review before publishing ${label} outputs?`,
      `${useCase.review} Also confirm subject permission, destination platform rules, AI disclosure needs, and any sensitive context before using the output on profiles, creator channels, ads, websites, printed material, or social posts.`
    ]
  ];
}

export function dreamshootToolDetailFaqSectionSettings(input: DreamshootToolFaqInput): Record<string, string> {
  const label = cleanText(input.label) || "AI tool";
  const spanish = isSpanishSite(input.site);
  const useCase = toolUseCase({ ...input, label });
  return {
    anchor: "faq",
    layout: "visual_faq",
    eyebrow: spanish ? `Preguntas de ${label}` : `${label} FAQ`,
    title: spanish ? `FAQ de ${label}` : `${label} FAQ`,
    subtitle: spanish
      ? `Respuestas sobre ${label}, fotos fuente, creditos, entrega privada y revision antes de descargar.`
      : `Specific answers about ${label}, source-photo preparation, credits, private delivery, and quality review.`,
    journeyTitle: spanish ? "Antes de crear" : "Before you create",
    journeyTitles: spanish ? "Objetivo|Subida|Creditos|Revision" : "Goal|Upload|Credits|Review",
    journeyDescriptions: spanish
      ? `Elige el resultado.|Prepara fotos aprobadas.|Revisa costos antes de generar.|Descarga desde tu galeria privada.`
      : `Choose the ${useCase.noun}.|Prepare approved photos.|Check costs before generation.|Download from your private gallery.`
  };
}

export function dreamshootToolDetailFaqBlocks(input: DreamshootToolFaqInput, idPrefix = ""): SectionBlockInstance[] {
  const baseId = sanitizeId(idPrefix || `faq_tool_${input.toolSlug || input.label}`);
  return dreamshootToolDetailFaqItems(input).map(([question, answer], index) => ({
    id: `${baseId}_${index + 1}`,
    type: "faq_item",
    settings: { question, answer }
  }));
}
