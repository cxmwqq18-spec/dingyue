export type PublicSeoLocale = "en" | "es" | "fr";

type PublicSeoTextOptions = {
  brand: string;
  locale: PublicSeoLocale;
  fallbackTopic?: string;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function readableFallbackTopic(value: unknown): string {
  const normalized = cleanText(value).replace(/^\/+|\/+$/g, "");
  const leaf = normalized.split("/").filter(Boolean).at(-1) || normalized;
  return leaf
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function trimToWordBoundary(value: string, maxLength: number): string {
  const normalized = cleanText(value);
  if (normalized.length <= maxLength) return normalized;
  const shortened = normalized.slice(0, maxLength + 1).replace(/\s+\S*$/, "").trim();
  return (shortened || normalized.slice(0, maxLength).trim()).replace(/[\s,;:|–—-]+$/, "").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function languageTitleExpansion(locale: PublicSeoLocale): string {
  if (locale === "fr") return "avec l’IA";
  if (locale === "es") return "con IA";
  return "with AI";
}

function languageDescriptionSuffix(locale: PublicSeoLocale, brand: string): string {
  if (locale === "fr") return `Découvrez une idée de création vidéo IA pour votre prochain projet avec ${brand}.`;
  if (locale === "es") return `Descubre una idea de vídeo IA para tu próximo proyecto con ${brand}.`;
  return `Explore an AI video idea for your next project with ${brand}.`;
}

function languageDescriptionSupport(locale: PublicSeoLocale): string {
  if (locale === "fr") return " Consultez les exemples et les étapes avant de commencer.";
  if (locale === "es") return " Consulta ejemplos y próximos pasos antes de empezar.";
  return " Review examples and next steps before you begin.";
}

export function normalizePublicSeoTitle(value: unknown, options: PublicSeoTextOptions): string {
  const brand = cleanText(options.brand) || "AI studio";
  const suffix = ` | ${brand}`;
  const fallbackTopic = readableFallbackTopic(options.fallbackTopic) || "AI creative tools";
  const raw = cleanText(value) || `${fallbackTopic}${suffix}`;
  const suffixPattern = new RegExp(`\\s*\\|\\s*${escapeRegExp(brand)}$`, "i");
  let core = raw.replace(suffixPattern, "").trim();
  if (!core) core = fallbackTopic;
  if (core.length < 24) core = `${core} ${languageTitleExpansion(options.locale)}`.trim();

  const maxCoreLength = Math.max(16, 60 - suffix.length);
  core = trimToWordBoundary(core, maxCoreLength);
  return `${core}${suffix}`.trim();
}

export function normalizePublicSeoDescription(value: unknown, options: PublicSeoTextOptions): string {
  const brand = cleanText(options.brand) || "AI studio";
  const fallbackTopic = readableFallbackTopic(options.fallbackTopic);
  let description = cleanText(value);
  if (!description) {
    const topic = fallbackTopic || (options.locale === "fr"
      ? "la création visuelle"
      : options.locale === "es"
        ? "la creación visual"
        : "visual creation");
    description = options.locale === "fr"
      ? `Explorez ${topic} avec des outils IA privés et préparez un résultat clair pour votre prochain projet avec ${brand}.`
      : options.locale === "es"
        ? `Explora ${topic} con herramientas privadas de IA y prepara un resultado claro para tu próximo proyecto con ${brand}.`
        : `Explore ${topic} with private AI tools and prepare a clear result for your next project with ${brand}.`;
  }
  if (description.length < 120) {
    description = `${description.replace(/[.!?]+$/, ".")} ${languageDescriptionSuffix(options.locale, brand)}`;
  }
  if (description.length < 120) description = `${description}${languageDescriptionSupport(options.locale)}`;
  // Keep a small margin for HTML entity encoding (for example apostrophes in
  // French copy) so the serialized meta tag stays within the 160-character
  // search snippet target as well as the decoded value.
  return trimToWordBoundary(description, 150);
}
