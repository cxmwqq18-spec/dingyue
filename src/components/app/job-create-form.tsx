"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, Lightbulb, MapPin, Play, Sparkles, Trash2, UploadCloud, WandSparkles } from "lucide-react";
import { getToolBlocksForMenu } from "@/components/storefront/dreamshoot-tools-mega-menu";
import type { AiWorkflowConfig, AiWorkflowField, AiWorkflowStep, CreativePack, CreativePackCategory, PublicCustomer, SectionBlockInstance, Site, SiteAiApp, ThemeRuntimeAsset, ThemeRuntimeCustomerModel, ToolMenuItem } from "@/lib/types";
import { csrfHeader, customerJsonHeaders } from "@/lib/client-csrf";
import { customerImageUploadErrorMessage, prepareCustomerImageUploadFile } from "@/lib/client-image-upload";
import { invalidateCustomerAssets, loadCustomerAssets } from "@/components/app/customer-assets-client-cache";
import { DreamshootShowcasePreviewClient as DreamshootShowcasePreview } from "@/components/storefront/dreamshoot-showcase-preview-client";
import { creativePackCollectionHref, creativePackMatchesCategory, getPhotoPackageMegaGroups, photoPackageSlug, type PhotoPackageMegaGroup } from "@/lib/photo-package-taxonomy";
import { withStorefrontPublicWatermarkUrl } from "@/lib/storefront-public-watermark-url";
import { themeValueToString } from "@/lib/theme-values";

type CreateMode = "theme" | "tool";
type PackageAudience = "self" | "partner" | "both";
type UploadTarget = "primary" | "partner";
type JobCreateLocale = "en" | "es";
type PromptBuilderKey = "shot" | "scene" | "lighting" | "finish";
type PromptBuilderGroup = {
  id: PromptBuilderKey;
  label: string;
  spanishLabel: string;
  options: string[];
  spanishOptions: string[];
};
type OperationContext = {
  action?: string;
  note?: string;
  source?: string;
};
type RetryDraftFormValue = string | number | boolean;
export type JobCreateRetryDraft = {
  key: string;
  mode: CreateMode;
  creativePackId?: string;
  toolId?: string;
  primaryAssetIds?: string[];
  partnerAssetIds?: string[];
  outputCount?: number;
  prompt?: string;
  formValues?: Record<string, RetryDraftFormValue>;
  customerModelId?: string;
  packageAudience?: PackageAudience;
};
type SubscriptionStatus = "loading" | "active" | "required" | "admin";

type CreatedJobFeedback = {
  workerDispatch?: {
    status?: "skipped" | "sent" | "failed";
    error?: string;
  };
  customerBalance?: PublicCustomer["balance"];
  note?: string;
};
type JobCreateSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain"> & {
  __storefrontBasePath?: string;
};
type ToolPresetKind = "photo" | "video";
type VideoToolSelection = {
  id: string;
  title: string;
  href?: string;
};
type PackageGalleryExample = {
  src: string;
  alt: string;
};

function previewImageAttrs(src: string, title: string, meta = "") {
  return {
    "aria-label": `View ${title} full screen`,
    "data-dreamshoot-preview-meta": meta,
    "data-dreamshoot-preview-src": src,
    "data-dreamshoot-preview-title": title,
    "data-dreamshoot-showcase-preview": "image",
    role: "button",
    tabIndex: 0
  } as const;
}

function comparablePreviewImageUrl(value: string): string {
  return value.trim().split(/[?#]/)[0] ?? value.trim();
}

function jobT(spanish: boolean, english: string, spanishText: string): string {
  return spanish ? spanishText : english;
}

const DEFAULT_THEME_OUTPUT_COUNT = 1;
const DEFAULT_MAX_SOURCE_ASSETS = 15;
const LEGACY_WORKFLOW_MAX_SOURCE_ASSETS = 4;
const COLLAPSED_CATEGORY_LIMIT = Number.POSITIVE_INFINITY;
const COLLAPSED_THEME_CARD_LIMIT = Number.POSITIVE_INFINITY;
const COLLAPSED_TOOL_CARD_LIMIT = Number.POSITIVE_INFINITY;
const TOOL_PROMPT_FIELD_ID = "prompt";
const TOOL_PROMPT_BLOCKLIST = [
  "child sexual",
  "csam",
  "exploit minor",
  "explicit minor",
  "nude child",
  "underage nude",
  "rape",
  "sexual assault",
  "non-consensual",
  "gore",
  "beheading",
  "terrorist",
  "bomb making",
  "kill yourself"
];
const FOUR_LINE_CLAMP_STYLE: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 4,
  overflow: "hidden"
};
const THREE_LINE_CLAMP_STYLE: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3,
  overflow: "hidden"
};

type ToolPreset = {
  id: string;
  title: string;
  description: string;
  category: string;
  kind?: ToolPresetKind;
  href?: string;
  creditCost?: number;
  backendSlug?: string;
  prompt: string;
};

const STANDALONE_VIDEO_TOOL_IDS = new Set([
  "album-story-video",
  "animated-avatar",
  "creator-intro-video",
  "fan-poster-motion",
  "fashion-reel",
  "image-to-video",
  "product-teaser-clip",
  "profile-clip",
  "travel-motion-concept"
]);

function promptGroup(id: PromptBuilderKey, label: string, spanishLabel: string, options: string[], spanishOptions = options): PromptBuilderGroup {
  return { id, label: id === "shot" && label === "Shot" ? "Framing" : label, spanishLabel, options, spanishOptions };
}

const DEFAULT_PROMPT_BUILDER_GROUPS: PromptBuilderGroup[] = [
  {
    id: "shot",
    label: "Shot",
    spanishLabel: "Plano",
    options: ["Close-up portrait", "Waist-up portrait", "Three-quarter body", "Full-body editorial"],
    spanishOptions: ["Retrato cercano", "Retrato medio", "Tres cuartos", "Editorial cuerpo completo"]
  },
  {
    id: "scene",
    label: "Scene",
    spanishLabel: "Escena",
    options: ["Clean studio", "City street", "Travel landmark", "Warm indoor set"],
    spanishOptions: ["Estudio limpio", "Calle urbana", "Destino de viaje", "Interior calido"]
  },
  {
    id: "lighting",
    label: "Lighting",
    spanishLabel: "Luz",
    options: ["Soft window light", "Golden hour", "Cinematic rim light", "Bright editorial flash"],
    spanishOptions: ["Luz suave de ventana", "Hora dorada", "Contraluz cinematica", "Flash editorial brillante"]
  },
  {
    id: "finish",
    label: "Finish",
    spanishLabel: "Acabado",
    options: ["Photorealistic", "Premium headshot", "Magazine editorial", "Social profile ready"],
    spanishOptions: ["Fotorrealista", "Headshot premium", "Editorial de revista", "Listo para perfil social"]
  }
];

const CATEGORY_PROMPT_BUILDER_GROUPS: Record<string, PromptBuilderGroup[]> = {
  headshots: [
    promptGroup("shot", "Shot", "Plano", ["LinkedIn headshot", "Founder portrait", "Team page crop", "Speaker bio portrait"]),
    promptGroup("scene", "Scene", "Escena", ["Modern office", "Neutral studio wall", "Conference green room", "Brand-color backdrop"]),
    promptGroup("lighting", "Lighting", "Luz", ["Soft corporate light", "Clean studio key light", "Natural window light", "Polished editorial flash"]),
    promptGroup("finish", "Finish", "Acabado", ["Resume-ready crop", "Founder profile polish", "Team directory consistent", "Professional retouch"])
  ],
  wedding: [
    promptGroup("shot", "Shot", "Plano", ["Ceremony couple portrait", "Bride or groom solo", "Invitation cover frame", "Album storytelling portrait"]),
    promptGroup("scene", "Scene", "Escena", ["Ceremony aisle", "Garden reception", "Destination terrace", "Elegant bridal suite"]),
    promptGroup("lighting", "Lighting", "Luz", ["Romantic window light", "Golden ceremony glow", "Soft candlelight", "Reception flash polish"]),
    promptGroup("finish", "Finish", "Acabado", ["Fine-art wedding editorial", "Album-ready romance", "Invitation-ready crop", "Luxury ceremony retouch"])
  ],
  couple: [
    promptGroup("shot", "Shot", "Plano", ["Natural couple portrait", "Close embrace", "Walking hand-in-hand", "Candid laugh frame"]),
    promptGroup("scene", "Scene", "Escena", ["Cozy cafe corner", "City date night", "Garden path", "Home lifestyle set"]),
    promptGroup("lighting", "Lighting", "Luz", ["Warm evening glow", "Soft lifestyle light", "String-light ambience", "Natural outdoor shade"]),
    promptGroup("finish", "Finish", "Acabado", ["Romantic album look", "Lifestyle couple polish", "Keepsake print finish", "Soft cinematic color"])
  ],
  dating: [
    promptGroup("shot", "Shot", "Plano", ["Friendly profile portrait", "Candid lifestyle frame", "Outdoor smile shot", "Smart casual portrait"]),
    promptGroup("scene", "Scene", "Escena", ["Coffee shop table", "Bookstore aisle", "City park path", "Weekend street corner"]),
    promptGroup("lighting", "Lighting", "Luz", ["Flattering daylight", "Warm cafe light", "Soft shade", "Gentle golden hour"]),
    promptGroup("finish", "Finish", "Acabado", ["Approachable profile ready", "Natural skin texture", "Authentic dating crop", "Clean social polish"])
  ],
  fashion: [
    promptGroup("shot", "Shot", "Plano", ["Runway-inspired full body", "Editorial half body", "Lookbook pose", "Accessory detail frame"]),
    promptGroup("scene", "Scene", "Escena", ["Minimal fashion studio", "Backstage dressing area", "Urban editorial wall", "Luxury fitting room"]),
    promptGroup("lighting", "Lighting", "Luz", ["High-fashion flash", "Softbox studio light", "Dramatic side light", "Glossy magazine highlights"]),
    promptGroup("finish", "Finish", "Acabado", ["Magazine cover finish", "Lookbook color grade", "Luxury wardrobe polish", "Editorial retouch"])
  ],
  beauty: [
    promptGroup("shot", "Shot", "Plano", ["Hair detail portrait", "Makeup close-up", "Salon preview frame", "Beauty editorial crop"]),
    promptGroup("scene", "Scene", "Escena", ["Salon chair", "Vanity mirror setup", "Clean beauty studio", "Soft bathroom light"]),
    promptGroup("lighting", "Lighting", "Luz", ["Soft glam light", "Mirror glow", "Clean complexion light", "Glossy beauty flash"]),
    promptGroup("finish", "Finish", "Acabado", ["Natural skin texture", "Hair color preview", "Makeup campaign polish", "Beauty retouch"])
  ],
  travel: [
    promptGroup("shot", "Shot", "Plano", ["Destination portrait", "Walking travel frame", "Scenic overlook pose", "Postcard crop"]),
    promptGroup("scene", "Scene", "Escena", ["Coastal village", "Old-city street", "Mountain overlook", "Boutique hotel terrace"]),
    promptGroup("lighting", "Lighting", "Luz", ["Sunset travel glow", "Clear morning light", "Cafe window light", "Soft vacation shade"]),
    promptGroup("finish", "Finish", "Acabado", ["Postcard-ready color", "Private route album look", "Travel editorial polish", "Natural vacation texture"])
  ],
  seasonal: [
    promptGroup("shot", "Shot", "Plano", ["Holiday card portrait", "Gift-ready solo frame", "Festive couple crop", "Family keepsake style"]),
    promptGroup("scene", "Scene", "Escena", ["Christmas tree corner", "Warm fireplace room", "Snowy street lights", "Gift wrapping table"]),
    promptGroup("lighting", "Lighting", "Luz", ["Twinkle light glow", "Warm indoor candlelight", "Soft snowy daylight", "Cozy evening ambience"]),
    promptGroup("finish", "Finish", "Acabado", ["Greeting-card ready", "Warm festive color", "Keepsake album polish", "Seasonal social crop"])
  ],
  sports: [
    promptGroup("shot", "Shot", "Plano", ["Match-day fan poster", "Stadium portrait", "Jersey hero shot", "Victory celebration frame"]),
    promptGroup("scene", "Scene", "Escena", ["Stadium stands", "Fan zone lights", "Locker-room tunnel", "Match poster backdrop"]),
    promptGroup("lighting", "Lighting", "Luz", ["Stadium floodlights", "Energetic poster glow", "Night-game contrast", "Sharp sports flash"]),
    promptGroup("finish", "Finish", "Acabado", ["Fan avatar ready", "Poster-style crop", "Dynamic sports editorial", "Social banner polish"])
  ],
  creator: [
    promptGroup("shot", "Shot", "Plano", ["Profile hero portrait", "Newsletter author shot", "Creator workspace frame", "Personal brand cover"]),
    promptGroup("scene", "Scene", "Escena", ["Creator desk", "Podcast corner", "Minimal lifestyle studio", "City creator backdrop"]),
    promptGroup("lighting", "Lighting", "Luz", ["Clean creator light", "Soft screen glow", "Modern studio light", "Natural brand daylight"]),
    promptGroup("finish", "Finish", "Acabado", ["Profile update ready", "Landing-page polish", "Social header crop", "Personal brand consistency"])
  ],
  creative: [
    promptGroup("shot", "Shot", "Plano", ["Cinematic hero portrait", "Noir close-up", "Cyberpunk city frame", "Fantasy editorial pose"]),
    promptGroup("scene", "Scene", "Escena", ["Neon rain street", "Moody noir alley", "Dramatic studio set", "Surreal poster backdrop"]),
    promptGroup("lighting", "Lighting", "Luz", ["Neon edge light", "Low-key noir contrast", "Colored rim light", "Poster-grade spotlight"]),
    promptGroup("finish", "Finish", "Acabado", ["Cinematic poster finish", "Stylized but realistic", "High-contrast color grade", "Gallery hero crop"])
  ],
  cyberpunk: [
    promptGroup("shot", "Shot", "Plano", ["Neon city portrait", "Futuristic street crop", "Rain-lit profile frame", "Techwear editorial pose"]),
    promptGroup("scene", "Scene", "Escena", ["Neon rain street", "Futuristic city alley", "Holographic sign backdrop", "Night market light spill"]),
    promptGroup("lighting", "Lighting", "Luz", ["Neon edge light", "Magenta cyan contrast", "Wet pavement reflections", "Colored rim light"]),
    promptGroup("finish", "Finish", "Acabado", ["Cyberpunk poster finish", "High-contrast neon grade", "Sharp futuristic portrait", "Cinematic city crop"])
  ],
  gala: [
    promptGroup("shot", "Shot", "Plano", ["Formal gala portrait", "Red-carpet half body", "Black-tie profile crop", "Evening editorial pose"]),
    promptGroup("scene", "Scene", "Escena", ["Grand event entrance", "Luxury ballroom corner", "Velvet backdrop", "Champagne reception setting"]),
    promptGroup("lighting", "Lighting", "Luz", ["Polished event flash", "Warm chandelier glow", "Soft red-carpet key light", "Elegant rim light"]),
    promptGroup("finish", "Finish", "Acabado", ["Luxury evening polish", "Magazine gala finish", "Black-tie retouch", "Formal album hero"])
  ],
  noir: [
    promptGroup("shot", "Shot", "Plano", ["Vintage noir portrait", "Tailored suit close-up", "Classic character half body", "Film-still profile frame"]),
    promptGroup("scene", "Scene", "Escena", ["Smoky jazz-club interior", "Rainy old-city street", "Shadowed private office", "Vintage lounge backdrop"]),
    promptGroup("lighting", "Lighting", "Luz", ["Low-key noir contrast", "Venetian blind shadows", "Warm practical lamp glow", "Soft rim light"]),
    promptGroup("finish", "Finish", "Acabado", ["Classic noir polish", "Elegant character styling", "Black-and-white film mood", "Cinematic album hero"])
  ],
  nature: [
    promptGroup("shot", "Shot", "Plano", ["Outdoor adventure portrait", "Scenic trail profile", "Mountain overlook pose", "Golden-hour lifestyle crop"]),
    promptGroup("scene", "Scene", "Escena", ["Forest path", "Mountain overlook", "Lakeside clearing", "Open meadow backdrop"]),
    promptGroup("lighting", "Lighting", "Luz", ["Golden-hour sunlight", "Soft forest shade", "Natural backlight", "Clear outdoor contrast"]),
    promptGroup("finish", "Finish", "Acabado", ["Natural adventure polish", "Travel-ready landscape color", "Realistic outdoor texture", "Scenic profile finish"])
  ],
  avatar: [
    promptGroup("shot", "Shot", "Plano", ["Profile icon portrait", "Character bust", "Mascot-inspired crop", "Expressive avatar frame"]),
    promptGroup("scene", "Scene", "Escena", ["Clean icon background", "Soft gradient studio", "Gaming profile backdrop", "Sticker-ready frame"]),
    promptGroup("lighting", "Lighting", "Luz", ["Readable face light", "Soft illustrated glow", "Crisp icon contrast", "Profile badge shine"]),
    promptGroup("finish", "Finish", "Acabado", ["Avatar-ready silhouette", "Profile icon clarity", "Stylized original look", "Small-size readability"])
  ],
  video: [
    promptGroup("shot", "Shot", "Plano", ["Motion keyframe portrait", "Intro clip frame", "Reel cover image", "Storyboard hero shot"]),
    promptGroup("scene", "Scene", "Escena", ["Clean motion backdrop", "Creator intro set", "Product teaser stage", "Social reel frame"]),
    promptGroup("lighting", "Lighting", "Luz", ["Motion-friendly key light", "Soft animated glow", "Clean separation light", "Reel cover contrast"]),
    promptGroup("finish", "Finish", "Acabado", ["Video cover ready", "Smooth motion staging", "Storyboard clarity", "Short-form social polish"])
  ],
  utility: [
    promptGroup("shot", "Shot", "Plano", ["Before-after portrait", "Cleanup preview crop", "Retouch detail frame", "Background replacement view"]),
    promptGroup("scene", "Scene", "Escena", ["Neutral backdrop", "Clean studio replacement", "Simple product surface", "Plain profile background"]),
    promptGroup("lighting", "Lighting", "Luz", ["Balanced correction light", "Even studio light", "Natural restored exposure", "Clean shadow control"]),
    promptGroup("finish", "Finish", "Acabado", ["Practical enhancement", "Realistic cleanup", "Natural detail recovery", "Ready-to-use export"])
  ],
  boudoir: [
    promptGroup("shot", "Shot", "Plano", ["Tasteful private portrait", "Elegant seated pose", "Soft robe editorial", "Confident studio frame"]),
    promptGroup("scene", "Scene", "Escena", ["Private studio set", "Soft bedroom corner", "Elegant lounge chair", "Minimal fabric backdrop"]),
    promptGroup("lighting", "Lighting", "Luz", ["Soft directional light", "Warm intimate glow", "Gentle window shadow", "Low-key elegant contrast"]),
    promptGroup("finish", "Finish", "Acabado", ["Tasteful album polish", "Non-explicit elegance", "Soft luxury retouch", "Private gallery finish"])
  ],
  cultural: [
    promptGroup("shot", "Shot", "Plano", ["Ceremony portrait", "Traditional outfit detail", "Family keepsake frame", "Formal celebration pose"]),
    promptGroup("scene", "Scene", "Escena", ["Ceremony hall", "Textile-rich backdrop", "Garden celebration", "Formal portrait studio"]),
    promptGroup("lighting", "Lighting", "Luz", ["Warm ceremony light", "Soft textile detail light", "Elegant indoor glow", "Natural celebration daylight"]),
    promptGroup("finish", "Finish", "Acabado", ["Respectful editorial polish", "Album-ready tradition", "Detailed fabric clarity", "Formal keepsake finish"])
  ],
  copy: [
    promptGroup("shot", "Shot", "Plano", ["Campaign hero image", "Product story portrait", "Ad concept frame", "Landing-page visual"]),
    promptGroup("scene", "Scene", "Escena", ["Brand moodboard set", "Clean campaign backdrop", "Product-friendly table", "Commercial lifestyle scene"]),
    promptGroup("lighting", "Lighting", "Luz", ["Commercial softbox", "Clean ad lighting", "Bright product light", "Brand-color accent glow"]),
    promptGroup("finish", "Finish", "Acabado", ["Campaign-ready polish", "Copy-safe clean frame", "Ad layout friendly", "Brand story consistency"])
  ]
};

function normalizePromptCategoryToken(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function promptBuilderCategoryForPack(pack: CreativePack): string {
  const identityText = [
    pack.id,
    pack.name,
    pack.aiAppSlug,
    pack.categoryRecord?.slug,
    pack.categoryRecord?.label
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\b(mafia|noir|noir-portrait|film-noir)\b/.test(identityText)) return "noir";
  if (/\b(cyberpunk|neon-city)\b/.test(identityText)) return "cyberpunk";
  if (/\b(gala|black-tie|red-carpet)\b/.test(identityText)) return "gala";
  if (/\b(nature|nature-adventure|outdoor-adventure)\b/.test(identityText)) return "nature";

  const candidateTokens = [
    pack.category,
    pack.categoryRecord?.slug,
    pack.categoryRecord?.label,
    pack.categoryRecord?.parent?.slug,
    pack.categoryRecord?.parent?.label
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizePromptCategoryToken);
  for (const token of candidateTokens) {
    if (CATEGORY_PROMPT_BUILDER_GROUPS[token]) return token;
  }
  const text = `${candidateTokens.join(" ")} ${pack.name} ${pack.headline} ${pack.description}`.toLowerCase();
  if (/\b(christmas|holiday|santa|snow-lodge)\b/.test(text)) return "seasonal";
  if (/\b(world-cup|fan-photo|match-day|stadium|jersey)\b/.test(text)) return "sports";
  if (/\b(hairstyle|haircut|hair|makeup|beauty)\b/.test(text)) return "beauty";
  if (/\b(cyberpunk|noir|mafia)\b/.test(text)) return "creative";
  if (/\b(wedding|bridal|groom|bride|desi-wedding|indian-wedding)\b/.test(text)) return "wedding";
  if (/\b(valentine|engagement|couple)\b/.test(text)) return "couple";
  if (/\b(professional-headshot|headshot)\b/.test(text)) return "headshots";
  if (/\b(creator|profile-card|social-card|personal-brand)\b/.test(text)) return "creator";
  if (/\b(fashion|gala|virtual-try-on|lookbook)\b/.test(text)) return "fashion";
  if (/\b(anime|avatar)\b/.test(text)) return "avatar";
  if (/\b(video|motion|reel|clip)\b/.test(text)) return "video";
  if (/\b(upscaler|enhance|utility|background|retouch)\b/.test(text)) return "utility";
  if (/\b(product-style|product|copy|campaign)\b/.test(text)) return "copy";
  if (/\b(route|travel|coastal|old-quarter|island|resort|cafe|street|scenic|overlook|alpine|trail|road|trip|postcard|lagoon|villa|rooftop|market|rainy|desert|lake|rail|journal|traveler|wellness|retreat|journey)\b/.test(text)) return "travel";
  if (/\b(boudoir)\b/.test(text)) return "boudoir";
  return "";
}

function promptBuilderGroupsForPack(pack?: CreativePack): PromptBuilderGroup[] {
  if (!pack) return DEFAULT_PROMPT_BUILDER_GROUPS;
  const category = promptBuilderCategoryForPack(pack);
  return category ? CATEGORY_PROMPT_BUILDER_GROUPS[category] : DEFAULT_PROMPT_BUILDER_GROUPS;
}

function isVideoToolPreset(preset: Pick<ToolPreset, "id" | "title" | "category">) {
  const text = `${preset.id} ${preset.title} ${preset.category}`.toLowerCase();
  return STANDALONE_VIDEO_TOOL_IDS.has(preset.id) || /\b(video|motion|clip|reel|animated)\b/i.test(text);
}

const SPANISH_TOOL_PRESET_COPY: Record<string, Partial<Pick<ToolPreset, "title" | "description" | "category" | "prompt">>> = {
  "headshot-generator": {
    title: "Generador de retratos profesionales",
    description: "Crea perfiles de trabajo, retratos de equipo y fotos de fundador a partir de selfies claras.",
    category: "Creadores de retrato",
    prompt: "Crea un retrato profesional pulido con luz natural, fondo limpio y expresion segura."
  },
  "anime-avatar": {
    title: "Creador de avatar anime",
    description: "Convierte una selfie clara en conceptos de avatar estilizado para perfiles, redes y campanas.",
    category: "Creadores de retrato",
    prompt: "Crea un avatar anime inspirado en el retrato subido, conservando rasgos faciales reconocibles."
  },
  "wedding-portraits": {
    title: "Retratos de boda",
    description: "Crea conceptos elegantes de pareja, ceremonia y celebracion antes de montar un album completo.",
    category: "Creadores de retrato",
    prompt: "Crea conceptos de retrato de boda con luz romantica, estilo elegante y composicion lista para album."
  },
  "gala-photo": {
    title: "Creador de foto de gala",
    description: "Previsualiza retratos formales con luz de alfombra roja, vestuario pulido y recortes listos para redes.",
    category: "Creadores de retrato",
    prompt: "Crea un retrato formal de gala con luz nocturna, atuendo pulido y composicion editorial."
  },
  "nature-adventure": {
    title: "Fotos de aventura natural",
    description: "Coloca al cliente en escenas de exterior, senderismo y retrato inspirado en viajes.",
    category: "Creadores de retrato",
    prompt: "Crea un retrato de aventura al aire libre en un paisaje natural con luz cinematica pero realista."
  },
  "edit-by-prompt": {
    title: "Editar con instrucciones",
    description: "Describe una edicion concreta y previsualizala antes de gastar creditos del paquete.",
    category: "Herramientas de retoque"
  },
  "background-changer": {
    title: "Cambiador de fondo",
    description: "Sustituye el fondo de una selfie antes de pedir un paquete completo.",
    category: "Herramientas de retoque",
    prompt: "Sustituye el fondo por un estudio limpio manteniendo al sujeto natural y realista."
  },
  "background-remover": {
    title: "Eliminador de fondo",
    description: "Recorta fondos de producto o retrato para fotos privadas mas limpias.",
    category: "Herramientas de retoque",
    prompt: "Elimina el fondo de forma limpia y conserva los bordes del sujeto para un resultado transparente o neutro."
  },
  "magic-eraser": {
    title: "Borrador magico",
    description: "Elimina pequenas distracciones de retratos, tarjetas y escenas generadas.",
    category: "Herramientas de retoque",
    prompt: "Elimina objetos distractores manteniendo la imagen circundante realista y natural."
  },
  "photo-enhancer": {
    title: "Mejorador de foto",
    description: "Mejora subidas con poca luz antes de usarlas para entrenar un modelo privado.",
    category: "Herramientas de retoque",
    prompt: "Mejora nitidez, exposicion y balance de color conservando un aspecto fotografico realista."
  },
  "portrait-retouch": {
    title: "Retoque de retrato",
    description: "Limpia piel, cabellos sueltos e iluminacion sin cambiar la identidad del cliente.",
    category: "Herramientas de retoque",
    prompt: "Retoca el retrato de forma ligera con textura natural de piel, luz equilibrada y sin cambio de identidad."
  },
  "unblur-image": {
    title: "Enfocar imagen",
    description: "Recupera fotos suaves del telefono antes de entrar en un flujo de generacion pagado.",
    category: "Herramientas de retoque",
    prompt: "Mejora la claridad y reduce el desenfoque manteniendo la imagen realista."
  },
  "color-correction": {
    title: "Correccion de color",
    description: "Equilibra tonos para fotos de perfil, carteles y vistas previas de paquetes.",
    category: "Herramientas de retoque",
    prompt: "Corrige balance de color, exposicion y contraste para un resultado limpio y natural."
  },
  "old-photo-restoration": {
    title: "Restauracion de foto antigua",
    description: "Repara fotos desvanecidas y preparalas para entrega en album privado.",
    category: "Herramientas de retoque",
    prompt: "Restaura la foto antigua reduciendo rayones, mejorando contraste y conservando la identidad original."
  },
  "image-to-video": {
    title: "Concepto de imagen a video",
    description: "Convierte una imagen terminada del paquete en un breve concepto con movimiento.",
    category: "Creadores de movimiento",
    prompt: "Crea un concepto corto con movimiento a partir de la imagen subida, camara sutil y animacion natural."
  },
  "profile-clip": {
    title: "Creador de clip de perfil",
    description: "Crea movimiento para redes a partir de retratos profesionales o de creador.",
    category: "Creadores de movimiento",
    prompt: "Crea un clip breve de perfil usando el retrato subido con movimiento sutil y encuadre pulido."
  },
  "creator-intro-video": {
    title: "Video intro de creador",
    description: "Convierte retratos de creador en clips intro breves para perfiles y reels.",
    category: "Creadores de movimiento",
    prompt: "Crea un concepto compacto de intro con ritmo pulido y encuadre listo para perfil."
  },
  "fan-poster-motion": {
    title: "Movimiento de poster fan",
    description: "Anima posters de fans y escenas de perfil para dias de partido.",
    category: "Creadores de movimiento",
    prompt: "Crea un concepto corto de poster deportivo con movimiento energico pero realista."
  },
  "product-teaser-clip": {
    title: "Clip teaser de producto",
    description: "Crea ideas simples de movimiento para resultados con estilo de producto.",
    category: "Creadores de movimiento",
    prompt: "Crea un teaser breve de producto con encuadre limpio y movimiento comercial sutil."
  },
  "route-portrait-composer": {
    title: "Compositor de retrato de ruta",
    description: "Crea retratos de viaje escenicos desde fotos cotidianas de referencia y notas de destino.",
    category: "Herramientas de retrato de viaje",
    prompt: "Crea un retrato de viaje realista con estilo listo para ruta, luz natural y ambiente de destino."
  },
  "city-walk-editor": {
    title: "Editor de paseo urbano",
    description: "Da forma a escenas de calle, cafe, plaza y casco antiguo sin planear una sesion fisica.",
    category: "Herramientas de retrato de viaje",
    prompt: "Crea un retrato de paseo por casco antiguo con luz natural, vestuario creible y encuadre editorial de viaje."
  },
  "coastal-light-maker": {
    title: "Creador de luz costera",
    description: "Previsualiza luz de playa, acantilado, marina y resort para albumes privados.",
    category: "Herramientas de destino",
    prompt: "Crea un retrato costero de viaje con luz calida, profundidad realista y estilo relajado de vacaciones."
  },
  "scenic-overlook-story": {
    title: "Historia de mirador escenico",
    description: "Convierte retratos privados en escenas de montana, terraza y mirador con encuadre de postal.",
    category: "Herramientas de destino",
    prompt: "Crea un retrato en mirador con paisaje panoramico, pose natural y luz cinematica pero realista."
  },
  "postcard-crop-set": {
    title: "Set de recortes tipo postal",
    description: "Prepara recortes para perfil, historia y tarjeta de recuerdo desde retratos de ruta.",
    category: "Herramientas de entrega",
    prompt: "Crea un set de recortes de postal de viaje con color consistente, composicion limpia y encuadre listo para redes."
  },
  "travel-motion-concept": {
    title: "Concepto de movimiento de viaje",
    description: "Crea ideas breves de historia en movimiento desde retratos de viaje terminados.",
    category: "Herramientas de entrega",
    prompt: "Crea un concepto corto de retrato de viaje con movimiento sutil de camara y atmosfera natural de destino."
  }
};

function normalizeToolId(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\/tools\//, "")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function fieldValueDefault(field: AiWorkflowField): string | number | boolean {
  if ("default" in field && field.default !== undefined) return field.default;
  if ((field.type === "select" || field.type === "radio") && field.options[0]) return field.options[0].value;
  if (field.type === "number") return field.min ?? 0;
  if (field.type === "boolean") return false;
  return "";
}

function fieldsFromParameterSchema(app: SiteAiApp): AiWorkflowField[] {
  return app.aiApp.parameterSchema.map((field) => (
    field.type === "select"
      ? {
          id: field.id,
          label: field.label,
          type: "select",
          required: true,
          options: (field.options ?? []).map((option) => ({ label: option, value: option })),
          default: field.options?.[0] ?? ""
        }
      : {
          id: field.id,
          label: field.label,
          type: "text",
          required: true,
          placeholder: field.label,
          default: ""
        }
  ));
}

function defaultWorkflow(app: SiteAiApp): AiWorkflowConfig {
  return {
    version: 1,
    flowName: app.aiApp.name,
    description: app.aiApp.description,
    submitLabel: "Start generation",
    materialRules: [
      "Use clear private photos where the face or product is visible.",
      `Attach at least one private upload and use up to ${DEFAULT_MAX_SOURCE_ASSETS} source photos.`,
      "Only files in this signed-in customer account are available here."
    ],
    steps: [
      {
        id: "source_photos",
        title: "Select private photos",
        description: "Choose private uploads for this request.",
        kind: "asset_select",
        assetRules: { min: 1, max: DEFAULT_MAX_SOURCE_ASSETS, roles: ["input"], accept: ["image/*"], required: true }
      },
      {
        id: "generation_options",
        title: "Set generation options",
        description: "Choose the direction for the generated album.",
        kind: "fields",
        fields: fieldsFromParameterSchema(app)
      },
      {
        id: "review_request",
        title: "Review request",
        description: "Confirm credits, delivery and selected private photos.",
        kind: "review"
      }
    ]
  };
}

function workflowFor(app?: SiteAiApp): AiWorkflowConfig | undefined {
  if (!app) return undefined;
  const config = app.workflowConfig ?? defaultWorkflow(app);
  const hasAsset = config.steps.some((step) => step.kind === "asset_select");
  const hasFields = config.steps.some((step) => step.kind === "fields");
  return {
    ...config,
    steps: [
      ...(hasAsset ? [] : defaultWorkflow(app).steps.filter((step) => step.kind === "asset_select")),
      ...config.steps,
      ...(hasFields ? [] : [defaultWorkflow(app).steps.find((step) => step.kind === "fields") as AiWorkflowStep])
    ]
  };
}

function workflowFields(workflow?: AiWorkflowConfig): AiWorkflowField[] {
  return workflow?.steps.flatMap((step) => step.kind === "fields" ? step.fields ?? [] : []) ?? [];
}

function assetRules(workflow?: AiWorkflowConfig) {
  return workflow?.steps.find((step) => step.kind === "asset_select")?.assetRules ?? { min: 1, max: DEFAULT_MAX_SOURCE_ASSETS, roles: ["input"] };
}

function maxAssetsForWorkflow(workflow?: AiWorkflowConfig): number {
  const configuredMax = assetRules(workflow).max;
  if (!configuredMax || configuredMax <= 0 || configuredMax === LEGACY_WORKFLOW_MAX_SOURCE_ASSETS) {
    return DEFAULT_MAX_SOURCE_ASSETS;
  }
  return Math.min(configuredMax, DEFAULT_MAX_SOURCE_ASSETS);
}

function valuesFor(app?: SiteAiApp): Record<string, string | number | boolean> {
  return Object.fromEntries(workflowFields(workflowFor(app)).map((field) => [field.id, fieldValueDefault(field)]));
}

function assetsForRules(assets: ThemeRuntimeAsset[], workflow?: AiWorkflowConfig): ThemeRuntimeAsset[] {
  const roles = assetRules(workflow).roles ?? ["input"];
  return assets.filter((asset) => roles.includes(asset.role) && asset.subjectRole !== "video_frame");
}

function initialSelectedAssets(assets: ThemeRuntimeAsset[], workflow?: AiWorkflowConfig): string[] {
  const maxAssets = maxAssetsForWorkflow(workflow);
  return assetsForRules(assets, workflow).slice(0, maxAssets).map((asset) => asset.id);
}

function mergeAssetLists(primary: ThemeRuntimeAsset[], secondary: ThemeRuntimeAsset[]): ThemeRuntimeAsset[] {
  const filteredPrimary = primary.filter((asset) => asset.subjectRole !== "video_frame");
  const seen = new Set(filteredPrimary.map((asset) => asset.id));
  return [...filteredPrimary, ...secondary.filter((asset) => asset.subjectRole !== "video_frame" && !seen.has(asset.id))];
}

function mergeRequestAssetIds(primaryIds: string[], partnerIds: string[], maxAssets: number, requirePartnerGroup: boolean): string[] {
  const limit = Math.max(1, Math.min(DEFAULT_MAX_SOURCE_ASSETS, Math.trunc(maxAssets)));
  const primary = Array.from(new Set(primaryIds.filter(Boolean)));
  const primarySet = new Set(primary);
  const partner = Array.from(new Set(partnerIds.filter((id) => id && !primarySet.has(id))));
  if (!requirePartnerGroup || !primary.length || !partner.length || limit < 2) {
    return Array.from(new Set([...primary, ...partner])).slice(0, limit);
  }
  const primaryBudget = Math.max(1, limit - 1);
  const selectedPrimary = primary.slice(0, primaryBudget);
  const selectedPartner = partner.slice(0, limit - selectedPrimary.length);
  return Array.from(new Set([...selectedPrimary, ...selectedPartner])).slice(0, limit);
}

function packsForApp(packs: CreativePack[], aiAppSlug: string): CreativePack[] {
  return packs.filter((pack) => pack.status === "active" && pack.aiAppSlug === aiAppSlug);
}

function collectionSlugFromHref(href: string | undefined): string {
  const path = (href ?? "").split("?")[0]?.split("#")[0] ?? "";
  const fromCollectionsPath = path.split("/collections/")[1] ?? "";
  const pathParts = path.split("/").filter(Boolean);
  const fallbackPathPart = pathParts[pathParts.length - 1] ?? "";
  return photoPackageSlug(fromCollectionsPath || fallbackPathPart);
}

function megaGroupItemMatchesPack(item: PhotoPackageMegaGroup["items"][number], pack: CreativePack): boolean {
  if (item.packId) return item.packId === pack.id;
  const itemHrefSlug = collectionSlugFromHref(item.href);
  const packHrefSlug = collectionSlugFromHref(creativePackCollectionHref(pack));
  return creativePackMatchesCategory(pack, item.slug) ||
    creativePackMatchesCategory(pack, item.label) ||
    (itemHrefSlug !== "all" && creativePackMatchesCategory(pack, itemHrefSlug)) ||
    (itemHrefSlug !== "all" && itemHrefSlug === packHrefSlug);
}

function megaGroupItemForPack(pack: CreativePack, groups: PhotoPackageMegaGroup[]): PhotoPackageMegaGroup["items"][number] | undefined {
  for (const group of groups) {
    const item = group.items.find((groupItem) => megaGroupItemMatchesPack(groupItem, pack));
    if (item) return item;
  }
  return undefined;
}

function workspacePackageLabel(pack: CreativePack, groups: PhotoPackageMegaGroup[]): string {
  return megaGroupItemForPack(pack, groups)?.label || pack.name;
}

function workspacePackageHref(pack: CreativePack, groups: PhotoPackageMegaGroup[]): string {
  return megaGroupItemForPack(pack, groups)?.href || creativePackCollectionHref(pack);
}

function creativePackMatchesMegaGroup(pack: CreativePack, category: string, groups: PhotoPackageMegaGroup[]): boolean {
  const selectedSlug = photoPackageSlug(category);
  if (!selectedSlug || selectedSlug === "all") return true;
  const selectedGroup = groups.find((group) => photoPackageSlug(group.slug) === selectedSlug);
  if (selectedGroup) return selectedGroup.items.some((item) => megaGroupItemMatchesPack(item, pack));
  return creativePackMatchesCategory(pack, selectedSlug);
}

function megaGroupsInPackagePanelOrder(groups: PhotoPackageMegaGroup[]): PhotoPackageMegaGroup[] {
  const columns: PhotoPackageMegaGroup[][] = [[], [], []];
  groups.forEach((group, index) => {
    columns[index % columns.length]?.push(group);
  });
  return columns.flat();
}

function orderedCreativePacksFromMegaGroups(activePacks: CreativePack[], groups: PhotoPackageMegaGroup[]): CreativePack[] {
  const ordered: CreativePack[] = [];
  const seen = new Set<string>();
  groups.forEach((group) => {
    group.items.forEach((item) => {
      const match = activePacks.find((pack) => !seen.has(pack.id) && megaGroupItemMatchesPack(item, pack));
      if (!match) return;
      ordered.push(match);
      seen.add(match.id);
    });
  });
  activePacks.forEach((pack) => {
    if (seen.has(pack.id)) return;
    ordered.push(pack);
    seen.add(pack.id);
  });
  return ordered;
}

function modeForInitialState(initialCreativePackId: string | undefined, initialToolId: string | undefined, initialPack: CreativePack | undefined, creativePacks: CreativePack[]): CreateMode {
  if (initialCreativePackId) return "theme";
  if (initialToolId && !initialCreativePackId) return "tool";
  if (initialPack?.id) return "theme";
  return creativePacks.some((pack) => pack.status === "active") ? "theme" : "tool";
}

function fieldsForMode(fields: AiWorkflowField[], mode: CreateMode): AiWorkflowField[] {
  const filteredFields = fields.filter((field) => {
    const id = field.id.toLowerCase();
    const label = field.label.toLowerCase();
    return !["style", "prompt", "outputcount", "output_count"].includes(id) && !label.includes("style");
  });
  if (mode === "theme") return filteredFields;
  const hasPrompt = filteredFields.some((field) => field.id === TOOL_PROMPT_FIELD_ID);
  return hasPrompt
    ? filteredFields
    : [
        {
          id: TOOL_PROMPT_FIELD_ID,
          label: "Prompt",
          type: "textarea",
          required: true,
          placeholder: "Describe the exact edit or image direction you want.",
          default: "",
          helpText: "Keep it specific, lawful, and safe for private generation."
        },
        ...filteredFields
      ];
}

function valuesForMode(app: SiteAiApp | undefined, mode: CreateMode): Record<string, string | number | boolean> {
  const baseValues = valuesFor(app);
  delete baseValues.style;
  delete baseValues.outputCount;
  delete baseValues.output_count;
  if (mode === "theme") {
    const cleanValues = { ...baseValues };
    delete cleanValues.prompt;
    cleanValues.outputCount = DEFAULT_THEME_OUTPUT_COUNT;
    return cleanValues;
  }
  return { [TOOL_PROMPT_FIELD_ID]: "", ...baseValues };
}

function blockedPromptTerm(prompt: string): string | undefined {
  const normalized = prompt.toLowerCase().replace(/\s+/g, " ").trim();
  return TOOL_PROMPT_BLOCKLIST.find((term) => normalized.includes(term));
}

function uploadLabelForFile(file: File, index: number, total: number): string {
  const base = file.name.replace(/\.[^.]+$/, "").trim() || "private photo";
  return total > 1 ? `${base} ${index + 1}` : base;
}

function localizeToolPreset(preset: ToolPreset, spanish: boolean): ToolPreset {
  if (!spanish) return preset;
  const copy = SPANISH_TOOL_PRESET_COPY[preset.id];
  return copy ? { ...preset, ...copy } : preset;
}

function statusLabel(status: string, spanish: boolean): string {
  if (!spanish) return status.replace(/_/g, " ");
  if (status === "ready") return "listo";
  if (status === "training") return "entrenando";
  if (status === "failed") return "fallido";
  if (status === "queued") return "en cola";
  return status.replace(/_/g, " ");
}

function imageCountLabel(count: number, spanish: boolean): string {
  return spanish ? `${count} imagen${count === 1 ? "" : "es"}` : `${count} image${count === 1 ? "" : "s"}`;
}

function photoCountLabel(count: number, spanish: boolean): string {
  return spanish ? `${count} foto${count === 1 ? "" : "s"}` : `${count} photo${count === 1 ? "" : "s"}`;
}

function jobErrorMessage(error?: string, status?: number, spanish = false): string {
  if (status === 401 || error === "customer_login_required") {
    return jobT(spanish, "Please sign in again before starting this photo set.", "Vuelve a iniciar sesion antes de empezar este set de fotos.");
  }
  if (status === 403 || error?.includes("csrf")) {
    return jobT(spanish, "Your secure session expired. Refresh the page, then try again.", "Tu sesion segura expiro. Actualiza la pagina e intentalo de nuevo.");
  }
  if (error === "asset_not_found_for_customer") {
    return jobT(spanish, "One selected private photo is no longer available in this account. Reselect your photos and try again.", "Una foto privada seleccionada ya no esta disponible en esta cuenta. Vuelve a seleccionar tus fotos e intentalo de nuevo.");
  }
  if (error === "couple_source_groups_required") {
    return jobT(spanish, "Couple mode requires at least one selected photo in both Your photos and Partner photos.", "El modo pareja requiere al menos una foto seleccionada en Tus fotos y Fotos de pareja.");
  }
  if (error === "not_enough_source_assets") {
    return jobT(spanish, "Select the required private photos before starting this request.", "Selecciona las fotos privadas requeridas antes de iniciar esta solicitud.");
  }
  if (error === "too_many_source_assets") {
    return jobT(spanish, "Too many private photos are selected for this package. Reduce the selection and try again.", "Hay demasiadas fotos privadas seleccionadas para este paquete. Reduce la seleccion e intentalo de nuevo.");
  }
  if (error === "missing_required_prompt_input") {
    return jobT(spanish, "This tool is missing a required setting. Reopen the tool or choose a photo package and try again.", "A esta herramienta le falta un ajuste obligatorio. Abrela de nuevo o elige un paquete e intentalo otra vez.");
  }
  if (error === "insufficient_credits") {
    return jobT(spanish, "You do not have enough credits for this request. Please add credits or choose a smaller package.", "No tienes creditos suficientes para esta solicitud. Anade creditos o elige un paquete mas pequeno.");
  }
  if (error === "subscription_required") {
    return jobT(spanish, "Choose an active subscription before starting generation. Credits are your monthly balance, but generation also requires a current plan.", "Elige una suscripcion activa antes de generar. Los creditos son tu saldo mensual, pero la generacion tambien requiere un plan vigente.");
  }
  if (error === "generation_job_already_running") {
    return jobT(spanish, "One photo request is already running. Wait for it to finish before starting a new one.", "Ya hay una solicitud de fotos en curso. Espera a que termine antes de iniciar otra.");
  }
  if (error === "customer_past_due") {
    return jobT(spanish, "Your account needs billing attention before starting a new request.", "Tu cuenta necesita revisar la facturacion antes de iniciar una nueva solicitud.");
  }
  if (error === "customer_blocked") {
    return jobT(spanish, "This account cannot start new requests right now. Contact support for help.", "Esta cuenta no puede iniciar nuevas solicitudes ahora. Contacta con soporte para recibir ayuda.");
  }
  if (error === "site_ai_app_not_found" || error === "ai_app_not_found" || error === "ai_app_not_enabled_for_site") {
    return jobT(spanish, "This AI tool is no longer available. Choose another tool and try again.", "Esta herramienta IA ya no esta disponible. Elige otra e intentalo de nuevo.");
  }
  if (error === "creative_pack_not_found_for_site" || error === "creative_pack_tool_mismatch") {
    return jobT(spanish, "This photo package is no longer available for the selected tool. Choose the package again and retry.", "Este paquete de fotos ya no esta disponible para la herramienta seleccionada. Vuelve a elegir el paquete e intentalo de nuevo.");
  }
  if (error === "job_create_timeout") {
    return jobT(spanish, "The job service timed out while creating this request. Please try again in a moment.", "El servicio tardo demasiado al crear esta solicitud. Intentalo de nuevo en un momento.");
  }
  return jobT(spanish, "We could not start this photo set. Please check your selection and try again.", "No pudimos iniciar este set de fotos. Revisa tu seleccion e intentalo de nuevo.");
}

function displayMaterialRule(rule: string, spanish = false): string {
  const normalized = rule
    .replace(/source photos/gi, "private photos")
    .replace(/Attach\s+1[-–]4\s+private uploads before starting the request\./i, "Attach the private photos you want to use before starting the request.")
    .replace(/1[-–]4\s+private upload files/i, "one or more private upload files")
    .replace(/1\s*[-–]\s*4\s+uploaded images/i, "one or more uploaded images");
  if (!spanish) return normalized;
  return normalized
    .replace(/Use clear private photos where the face or product is visible\./i, "Usa fotos privadas claras donde el rostro o el producto sea visible.")
    .replace(/Attach the private photos you want to use before starting the request\./i, "Adjunta las fotos privadas que quieres usar antes de iniciar la solicitud.")
    .replace(/Only files in this signed-in customer account are available here\./i, "Aqui solo estan disponibles los archivos de esta cuenta con sesion iniciada.")
    .replace(/one or more private upload files/i, "uno o mas archivos privados subidos")
    .replace(/one or more uploaded images/i, "una o mas imagenes subidas")
    .replace(/private photos/gi, "fotos privadas");
}

function toolBlockText(block: SectionBlockInstance, key: string, fallback = ""): string {
  const value = themeValueToString(block.settings[key], fallback).trim();
  return value || fallback;
}

function toolSlugFromHref(href: string): string {
  const path = href.split("?")[0]?.split("#")[0] ?? "";
  const fromToolsPath = path.split("/tools/")[1] ?? "";
  const pathParts = path.split("/").filter(Boolean);
  const fallbackPathPart = pathParts[pathParts.length - 1] ?? "";
  return normalizeToolId(fromToolsPath || fallbackPathPart);
}

function toolPresetIdForBlock(block: SectionBlockInstance): string {
  const href = toolBlockText(block, "href", "");
  const blockId = block.id.replace(/^default_tool_/, "").replace(/^tool_menu_/, "");
  return toolSlugFromHref(href) || normalizeToolId(blockId) || normalizeToolId(toolBlockText(block, "title", ""));
}

function defaultToolDescription(title: string, category: string, kind: ToolPresetKind): string {
  if (kind === "video") return `Open ${title} in the Image to Video workspace.`;
  if (/edit|retouch|cleanup|restore|background|enhance|upscal/i.test(category)) {
    return `Use ${title} with your private uploads before ordering a full photo package.`;
  }
  return `Use ${title} with your private selfies to prepare a focused photo result.`;
}

function photoBackendForTool(siteAiApps: SiteAiApp[], toolId: string): SiteAiApp | undefined {
  const enabledPhotoApps = siteAiApps.filter((app) => app.enabled !== false && app.aiApp.appType !== "video" && normalizeToolId(app.aiApp.slug) !== "video-generator");
  const exactBackend = enabledPhotoApps.find((app) => normalizeToolId(app.aiApp.slug) === toolId || normalizeToolId(app.routeKey) === toolId);
  const imageBackend = enabledPhotoApps.find((app) => normalizeToolId(app.aiApp.slug) === "image-generator");
  return exactBackend ?? imageBackend ?? enabledPhotoApps[0];
}

function videoBackendForTool(siteAiApps: SiteAiApp[]): SiteAiApp | undefined {
  return siteAiApps.find((app) => app.enabled !== false && (app.aiApp.appType === "video" || normalizeToolId(app.aiApp.slug) === "video-generator"));
}

function buildToolPresets(site: JobCreateSite, siteAiApps: SiteAiApp[], toolMenuItems: ToolMenuItem[]): ToolPreset[] {
  const videoBackend = videoBackendForTool(siteAiApps);
  const presets = getToolBlocksForMenu(site, toolMenuItems).map((block) => {
    const id = toolPresetIdForBlock(block);
    const title = toolBlockText(block, "title", "AI photo tool");
    const category = toolBlockText(block, "categoryTitle", toolBlockText(block, "category", "Photo AI"));
    const kind: ToolPresetKind = isVideoToolPreset({ id, title, category }) ? "video" : "photo";
    const backend = kind === "photo" ? photoBackendForTool(siteAiApps, id) : undefined;
    const description = toolBlockText(block, "description", defaultToolDescription(title, category, kind));
    return {
      id,
      title,
      description,
      category,
      kind,
      href: toolBlockText(block, "href", `/tools/${id}`),
      creditCost: kind === "video" ? videoBackend?.creditCost : backend?.creditCost,
      backendSlug: kind === "photo" ? backend?.aiApp.slug : undefined,
      prompt: toolBlockText(block, "prompt", "")
    } satisfies ToolPreset;
  }).filter((preset) => preset.kind === "video" || Boolean(preset.backendSlug));
  return orderToolPresetsForMegaPanel(Array.from(new Map(presets.map((preset) => [preset.id, preset])).values()));
}

function orderedToolCategories(categories: string[]): string[] {
  const preferred = ["Photo AI", "AI Photo Edit", "Video AI"];
  const ordered = preferred.filter((category) => categories.includes(category));
  return [...ordered, ...categories.filter((category) => !ordered.includes(category))];
}

function orderToolPresetsForMegaPanel(presets: ToolPreset[]): ToolPreset[] {
  const categories = Array.from(new Set(presets.map((preset) => preset.category)));
  const detailGroups = orderedToolCategories(categories).map((category) => ({
    category,
    items: presets.filter((preset) => preset.category === category)
  }));
  const columnCount = Math.min(3, Math.max(1, detailGroups.length));
  const columns = Array.from({ length: columnCount }, () => [] as typeof detailGroups);
  detailGroups.forEach((group, index) => {
    columns[index % columnCount]?.push(group);
  });
  return columns.flatMap((column) => column.flatMap((group) => group.items));
}

function packageAudienceOptionsForLocale(spanish: boolean): Array<{ id: PackageAudience; title: string; description: string; helper: string }> {
  return [
    {
      id: "self",
      title: jobT(spanish, "For Myself", "Para mi"),
      description: jobT(spanish, "Generate photos of the primary person in this model.", "Genera fotos de la persona principal de este modelo."),
      helper: jobT(spanish, "Uses your selected photos as the main subject.", "Usa tus fotos seleccionadas como sujeto principal.")
    },
    {
      id: "partner",
      title: jobT(spanish, "For My Partner", "Para mi pareja"),
      description: jobT(spanish, "Generate photos focused on the partner profile.", "Genera fotos centradas en el perfil de la pareja."),
      helper: jobT(spanish, "Uses partner photos as the main subject when partner samples are selected.", "Usa las fotos de pareja como sujeto principal cuando hay muestras seleccionadas.")
    },
    {
      id: "both",
      title: jobT(spanish, "For Both of Us", "Para ambos"),
      description: jobT(spanish, "Generate couple-style photos using both profiles.", "Genera fotos de estilo pareja usando ambos perfiles."),
      helper: jobT(spanish, "Combines your photos and partner photos for couple-style outputs.", "Combina tus fotos y las de tu pareja para resultados de pareja.")
    }
  ];
}

export function JobCreateForm({
  siteId,
  siteSlug,
  site,
  customer,
  siteAiApps: rawSiteAiApps,
  creativePacks = [],
  creativePackCategories = [],
  toolMenuItems = [],
  initialCreativePackId,
  initialToolId,
  assets = [],
  externalSourceAssets,
  externalPrimaryAssetIds,
  externalPartnerAssetIds,
  customerModels = [],
  emptyTitle = "No enabled album experience.",
  emptyBody = "Enable an album experience for this site before publishing this form.",
  tone = "dark",
  preferProvidedAssets = false,
  preferredMode,
  preferredModeRequest,
  preferredToolId,
  operationContext,
  retryDraft,
  subscriptionStatus = "active",
  trainingMode = "single",
  locale = "en",
  onJobCreated,
  onContinueToSources: _onContinueToSources,
  onReviewCurrentRequest,
  onOpenUploadManager: _onOpenUploadManager,
  onVideoToolSelected
}: {
  siteId: string;
  siteSlug: string;
  site?: JobCreateSite;
  customer: PublicCustomer;
  siteAiApps: SiteAiApp[];
  creativePacks?: CreativePack[];
  creativePackCategories?: CreativePackCategory[];
  toolMenuItems?: ToolMenuItem[];
  initialCreativePackId?: string;
  initialToolId?: string;
  assets?: ThemeRuntimeAsset[];
  externalSourceAssets?: ThemeRuntimeAsset[];
  externalPrimaryAssetIds?: string[];
  externalPartnerAssetIds?: string[];
  customerModels?: ThemeRuntimeCustomerModel[];
  emptyTitle?: string;
  emptyBody?: string;
  tone?: "dark" | "light";
  preferProvidedAssets?: boolean;
  preferredMode?: CreateMode;
  preferredModeRequest?: number;
  preferredToolId?: string;
  operationContext?: OperationContext;
  retryDraft?: JobCreateRetryDraft | null;
  subscriptionStatus?: SubscriptionStatus;
  trainingMode?: "single" | "couple";
  locale?: JobCreateLocale;
  onJobCreated?: (jobId: string, feedback?: CreatedJobFeedback) => void;
  onContinueToSources?: () => void;
  onReviewCurrentRequest?: () => void;
  onOpenUploadManager?: () => void;
  onVideoToolSelected?: (tool: VideoToolSelection) => void;
}) {
  const spanish = locale === "es";
  const siteAiApps = useMemo(() => Array.isArray(rawSiteAiApps) ? rawSiteAiApps : [], [rawSiteAiApps]);
  const normalizedInitialToolId = normalizeToolId(initialToolId);
  const menuSite = useMemo<JobCreateSite>(() => site ?? {
    id: siteId,
    slug: siteSlug,
    name: siteSlug,
    primaryDomain: "",
    branding: { logoText: siteSlug, market: "", description: "" }
  }, [site, siteId, siteSlug]);
  const toolPresets = useMemo(() => buildToolPresets(menuSite, siteAiApps, toolMenuItems).map((preset) => localizeToolPreset(preset, spanish)), [menuSite, siteAiApps, toolMenuItems, spanish]);
  const packageAudienceOptions = useMemo(() => packageAudienceOptionsForLocale(spanish), [spanish]);
  const initialPack =
    creativePacks.find((pack) => pack.status === "active" && pack.id === initialCreativePackId) ??
    creativePacks.find((pack) => pack.status === "active" && (normalizeToolId(pack.aiAppSlug) === normalizedInitialToolId || pack.id === initialToolId));
  const initialToolPreset = toolPresets.find((preset) => preset.id === normalizedInitialToolId) ?? toolPresets[0];
  const initialApp =
    (initialToolPreset?.backendSlug ? siteAiApps.find((app) => app.aiApp.slug === initialToolPreset.backendSlug) : undefined) ??
    (initialToolId ? siteAiApps.find((app) => normalizeToolId(app.aiApp.slug) === normalizedInitialToolId || app.aiApp.slug === initialToolId) : undefined) ??
    (initialPack ? siteAiApps.find((app) => app.aiApp.slug === initialPack.aiAppSlug) ?? siteAiApps[0] : siteAiApps[0]);
  const initialMode = modeForInitialState(initialCreativePackId, initialToolId, initialPack, creativePacks);
  const [aiAppSlug, setAiAppSlug] = useState(initialApp?.aiApp.slug ?? "");
  const [selectedToolId, setSelectedToolId] = useState(() => initialToolPreset?.id ?? normalizeToolId(initialApp?.aiApp.slug));
  const [creativePackId, setCreativePackId] = useState(() => initialPack?.id ?? packsForApp(creativePacks, initialApp?.aiApp.slug ?? "")[0]?.id ?? "");
  const [createMode, setCreateMode] = useState<CreateMode>(initialMode);
  const [themeCategory, setThemeCategory] = useState("all");
  const [formValues, setFormValues] = useState<Record<string, string | number | boolean>>(() => valuesForMode(initialApp, initialMode));
  const [themeOutputCount, setThemeOutputCount] = useState(DEFAULT_THEME_OUTPUT_COUNT);
  const [themeOutputCountDraft, setThemeOutputCountDraft] = useState(String(DEFAULT_THEME_OUTPUT_COUNT));
  const initialAvailableAssets = externalSourceAssets?.length ? mergeAssetLists(externalSourceAssets, assets) : assets;
  const [availableAssets, setAvailableAssets] = useState(initialAvailableAssets);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(() => externalPrimaryAssetIds ?? initialSelectedAssets(initialAvailableAssets, workflowFor(initialApp)));
  const [partnerSelectedAssetIds, setPartnerSelectedAssetIds] = useState<string[]>(() => externalPartnerAssetIds ?? []);
  const [selectedCustomerModelId, setSelectedCustomerModelId] = useState(() => customerModels.find((model) => model.status === "ready")?.id ?? customerModels[0]?.id ?? "");
  const [packageAudience, setPackageAudience] = useState<PackageAudience>(() => customerModels[0]?.modelType === "couple" ? "both" : "self");
  const [message, setMessage] = useState(() => jobT(spanish, "Choose a package, upload or select selfies, then review your private AI photoshoot.", "Elige un paquete, sube o selecciona selfies y revisa tu sesion privada con IA."));
  const [dialogMessage, setDialogMessage] = useState("");
  const [dialogTone, setDialogTone] = useState<"info" | "success" | "error">("info");
  const [pending, setPending] = useState(false);
  const [uploadingSources, setUploadingSources] = useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [packagePromptDraft, setPackagePromptDraft] = useState("");
  const [promptBuilderSelections, setPromptBuilderSelections] = useState<Partial<Record<PromptBuilderKey, string>>>({});
  const [deletingAssetIds, setDeletingAssetIds] = useState<string[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(() => !preferProvidedAssets && assets.length === 0);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const localAssetMutationRef = useRef(0);
  const sourceUploadInputRef = useRef<HTMLInputElement | null>(null);
  const packageDetailRef = useRef<HTMLDivElement | null>(null);
  const pendingUploadTargetRef = useRef<UploadTarget>("primary");
  const routedVideoToolIdsRef = useRef<Set<string>>(new Set());
  const preferredRouteKeyRef = useRef<string | null>(null);
  const appliedRetryDraftKeyRef = useRef<string | null>(null);
  const preferredRouteStateRef = useRef<{
    createMode: CreateMode;
    creativePackId: string;
    orderedActiveCreativePacks: CreativePack[];
    selectedToolId: string;
    toolPresets: ToolPreset[];
    visibleCreativePacks: CreativePack[];
    updateCreateMode: (nextMode: CreateMode) => void;
    updateCreativePack: (pack: CreativePack) => void;
    updateToolPreset: (preset: ToolPreset) => void;
  } | null>(null);
  const selectedApp = siteAiApps.find((app) => app.aiApp.slug === aiAppSlug) ?? siteAiApps[0];
  const activeCreativePacks = useMemo(() => creativePacks.filter((pack) => pack.status === "active"), [creativePacks]);
  const packageMegaGroups = useMemo(() => getPhotoPackageMegaGroups(activeCreativePacks, creativePackCategories), [activeCreativePacks, creativePackCategories]);
  const orderedPackageMegaGroups = useMemo(() => megaGroupsInPackagePanelOrder(packageMegaGroups), [packageMegaGroups]);
  const orderedActiveCreativePacks = useMemo(() => orderedCreativePacksFromMegaGroups(activeCreativePacks, orderedPackageMegaGroups), [activeCreativePacks, orderedPackageMegaGroups]);
  const visibleCreativePacks = themeCategory === "all"
    ? orderedActiveCreativePacks
    : orderedActiveCreativePacks.filter((pack) => creativePackMatchesMegaGroup(pack, themeCategory, packageMegaGroups));
  const categoryOptions = [
    { slug: "all", label: jobT(spanish, "All packages", "Todos los paquetes"), themeCount: orderedActiveCreativePacks.length },
    ...orderedPackageMegaGroups.map((group) => ({
      slug: photoPackageSlug(group.slug),
      label: group.label,
      sortOrder: group.sortOrder,
      themeCount: group.items.length
    }))
  ];
  const displayedCategoryOptions = showAllCategories ? categoryOptions : categoryOptions.slice(0, COLLAPSED_CATEGORY_LIMIT);
  const hasMoreCategories = categoryOptions.length > COLLAPSED_CATEGORY_LIMIT;
  const displayedCreativePacks = showAllOptions ? visibleCreativePacks : visibleCreativePacks.slice(0, COLLAPSED_THEME_CARD_LIMIT);
  const displayedToolPresets = showAllOptions ? toolPresets : toolPresets.slice(0, COLLAPSED_TOOL_CARD_LIMIT);
  const hiddenOptionCount = createMode === "theme"
    ? Math.max(visibleCreativePacks.length - displayedCreativePacks.length, 0)
    : Math.max(toolPresets.length - displayedToolPresets.length, 0);
  const appPacks = packsForApp(orderedActiveCreativePacks, selectedApp?.aiApp.slug ?? "");
  const selectedPack = (createMode === "theme" ? orderedActiveCreativePacks : appPacks).find((pack) => pack.id === creativePackId) ?? (createMode === "theme" ? visibleCreativePacks[0] ?? orderedActiveCreativePacks[0] : appPacks[0]);
  const selectedPackId = selectedPack?.id ?? "";
  const selectedPackPrompt = selectedPack?.prompt?.trim() || selectedPack?.description || selectedPack?.headline || "";
  const selectedWorkflow = workflowFor(selectedApp);
  const selectedToolPreset = toolPresets.find((preset) => preset.id === selectedToolId);
  const selectedToolPresetId = selectedToolPreset?.id ?? "";
  const selectedToolPrompt = String(formValues[TOOL_PROMPT_FIELD_ID] || selectedToolPreset?.prompt || "");
  const selectedToolIsVideo = createMode === "tool" && selectedToolPreset?.kind === "video";
  const selectionPreviewImage = createMode === "theme" ? withStorefrontPublicWatermarkUrl(selectedPack?.imageUrl) : undefined;
  const selectionTitle = createMode === "theme" ? selectedPack ? workspacePackageLabel(selectedPack, packageMegaGroups) : jobT(spanish, "Photo package", "Paquete de fotos") : selectedToolPreset?.title ?? selectedApp?.aiApp.name ?? jobT(spanish, "AI tool", "Herramienta IA");
  const selectionDescription = createMode === "theme"
    ? selectedPack?.description || selectedPack?.headline || jobT(spanish, "Choose this package, attach selfies, then review credits before generation.", "Elige este paquete, adjunta selfies y revisa los creditos antes de generar.")
    : selectedToolPreset?.description ?? jobT(spanish, "Choose this focused tool, attach selfies, then review credits before generation.", "Elige esta herramienta, adjunta selfies y revisa los creditos antes de generar.");
  const selectedPackageGalleryExamples = useMemo<PackageGalleryExample[]>(() => {
    if (createMode !== "theme" || !selectedPack) return [];
    const excluded = new Set(
      [selectionPreviewImage, withStorefrontPublicWatermarkUrl(selectedPack.imageUrl)]
        .filter((image): image is string => Boolean(image))
        .map((image) => comparablePreviewImageUrl(image))
        .filter(Boolean)
    );
    const seen = new Set<string>();
    const examples: PackageGalleryExample[] = [];
    (selectedPack.galleryImages ?? []).forEach((image, imageIndex) => {
      const src = withStorefrontPublicWatermarkUrl(image);
      const key = comparablePreviewImageUrl(src);
      if (!src || !key || excluded.has(key) || seen.has(key)) return;
      seen.add(key);
      const altOffset = selectedPack.galleryImageAlts?.length === (selectedPack.galleryImages?.length ?? 0) + 1 ? 1 : 0;
      const explicitAlt = selectedPack.galleryImageAlts?.[imageIndex + altOffset]?.trim();
      examples.push({
        src,
        alt: explicitAlt || `${selectionTitle} gallery example ${examples.length + 1}`
      });
    });
    if (!examples.length && selectionPreviewImage) {
      examples.push({
        src: selectionPreviewImage,
        alt: `${selectionTitle} cover preview`
      });
    }
    return examples.slice(0, 12);
  }, [createMode, selectedPack, selectionPreviewImage, selectionTitle]);
  const sourceAssets = assetsForRules(availableAssets, selectedWorkflow);
  const selectedCustomerModel = customerModels.find((model) => model.id === selectedCustomerModelId) ?? customerModels[0];
  const selectedFields = workflowFields(selectedWorkflow);
  const selectedAssetRules = assetRules(selectedWorkflow);
  const minAssets = Math.max(1, selectedAssetRules.min ?? 1);
  const effectiveMaxAssets = maxAssetsForWorkflow(selectedWorkflow);
  const materialRules = selectedWorkflow?.materialRules?.length ? selectedWorkflow.materialRules : selectedApp ? defaultWorkflow(selectedApp).materialRules ?? [] : [];
  const modeFields = fieldsForMode(selectedFields, createMode);
  const modeSubmitLabel = createMode === "theme"
    ? jobT(spanish, "Start photo package", "Iniciar paquete")
    : selectedToolIsVideo
      ? jobT(spanish, "Open video workspace", "Abrir espacio de video")
      : jobT(spanish, "Start tool", "Iniciar herramienta");
  const requestOutputCount = createMode === "theme" ? themeOutputCount : selectedPack?.outputCount ?? 1;
  const unitCreditCost = createMode === "theme" ? selectedPack?.creditCost ?? selectedApp?.creditCost ?? 0 : selectedToolIsVideo ? 0 : selectedToolPreset?.creditCost ?? selectedApp?.creditCost ?? 0;
  const billableOutputCount = createMode === "theme" ? Math.max(1, requestOutputCount) : 1;
  const selectionCreditCost = unitCreditCost * billableOutputCount;
  const selectionUnitCostLabel = createMode === "theme"
    ? jobT(spanish, `${unitCreditCost} per image`, `${unitCreditCost} por imagen`)
    : selectedToolIsVideo
      ? jobT(spanish, "Uses video workspace", "Usa el espacio de video")
      : jobT(spanish, `${unitCreditCost} per request`, `${unitCreditCost} por solicitud`);
  const selectionOutputLabel = createMode === "theme" ? String(requestOutputCount) : selectedToolIsVideo ? jobT(spanish, "Video workspace", "Espacio de video") : jobT(spanish, "Tool result", "Resultado de herramienta");
  const configureSelectionLabel = createMode === "theme" ? jobT(spanish, "Configure package", "Configurar paquete") : selectedToolIsVideo ? jobT(spanish, "Open video workspace", "Abrir espacio de video") : jobT(spanish, "Configure tool", "Configurar herramienta");
  const requiresCoupleSampleGroups = trainingMode === "couple";
  const selectedRequestAssetIds = mergeRequestAssetIds(selectedAssetIds, partnerSelectedAssetIds, effectiveMaxAssets, requiresCoupleSampleGroups);
  const light = tone === "light";
  const pricingHref = `/site/${siteSlug}/pricing`;
  const subscriptionGateMessage = selectedToolIsVideo
    ? ""
    : subscriptionStatus === "loading"
    ? jobT(spanish, "Checking your subscription before generation. You can keep preparing photos while this loads.", "Revisando tu suscripcion antes de generar. Puedes seguir preparando fotos mientras carga.")
    : subscriptionStatus === "required"
      ? selectionCreditCost > 0 && selectionCreditCost <= customer.balance.available
        ? jobT(spanish, "No active subscription is attached, but your available credits can start this paid request.", "No hay una suscripcion activa, pero tus creditos disponibles pueden iniciar esta solicitud pagada.")
        : jobT(spanish, "Start a subscription or add enough credits before generating.", "Activa una suscripcion o anade creditos suficientes antes de generar.")
      : subscriptionStatus === "admin"
        ? jobT(spanish, "Site admin access is active. Subscription is not required, and credits will still be reserved for this request.", "El acceso de administrador esta activo. No se requiere suscripcion y los creditos se reservaran igualmente.")
      : "";
  const subscriptionBypassActive = subscriptionStatus === "admin";
  const hasCreditsForRequest = selectedToolIsVideo || (selectionCreditCost > 0 && selectionCreditCost <= customer.balance.available);
  const subscriptionHardGate = subscriptionStatus === "required" && !hasCreditsForRequest;
  const creditsUsageNote = createMode === "theme"
    ? jobT(spanish, `${unitCreditCost} credits are spent for each generated image. This request will spend ${selectionCreditCost} credits for ${requestOutputCount} image${requestOutputCount === 1 ? "" : "s"}.`, `Se gastan ${unitCreditCost} creditos por cada imagen generada. Esta solicitud gastara ${selectionCreditCost} creditos por ${requestOutputCount} imagen${requestOutputCount === 1 ? "" : "es"}.`)
    : selectedToolIsVideo
      ? jobT(spanish, "This tool opens the Image to Video workspace. No photo request is submitted from this form.", "Esta herramienta abre el espacio Image to Video. No se envia una solicitud de fotos desde este formulario.")
      : jobT(spanish, `${selectionCreditCost} credits are spent for this tool request.`, `Esta solicitud de herramienta gastara ${selectionCreditCost} creditos.`);
  const subscriptionGateClass = subscriptionHardGate
    ? (light ? "border-[#efb483] bg-[#fff5eb] text-[#8c4a13]" : "border-[#f59e0b]/35 bg-[#f59e0b]/10 text-[#ffdca8]")
    : (light ? "border-[#dfd3c4] bg-white text-[#625d56]" : "border-white/10 bg-white/[0.05] text-white/68");
  const hasRequiredCoupleSampleGroups = !requiresCoupleSampleGroups || (selectedAssetIds.length > 0 && partnerSelectedAssetIds.length > 0);
  const coupleSampleRequirementMessage = jobT(spanish, "Couple mode requires at least one selected photo in both Your photos and Partner photos.", "El modo pareja requiere al menos una foto seleccionada en Tus fotos y Fotos de pareja.");
  const sampleRequirementMessage = requiresCoupleSampleGroups && !hasRequiredCoupleSampleGroups
    ? coupleSampleRequirementMessage
    : jobT(spanish, `Select at least ${minAssets} private photo before starting. Add more angles for stronger results.`, `Selecciona al menos ${minAssets} foto privada antes de empezar. Anade mas angulos para mejores resultados.`);
  const canStartRequest = selectedToolIsVideo || Boolean(aiAppSlug && hasRequiredCoupleSampleGroups && selectedRequestAssetIds.length >= minAssets && selectedRequestAssetIds.length <= effectiveMaxAssets && (subscriptionStatus === "active" || subscriptionBypassActive || hasCreditsForRequest));
  const selectedSourceAssets = sourceAssets.filter((asset) => selectedRequestAssetIds.includes(asset.id));
  const primarySourceAssets = sourceAssets.filter((asset) => selectedAssetIds.includes(asset.id));
  const partnerSourceAssets = sourceAssets.filter((asset) => partnerSelectedAssetIds.includes(asset.id));
  const isCoupleFlow = trainingMode === "couple" || selectedCustomerModel?.modelType === "couple" || packageAudience === "both";
  const selectedModelLabel = selectedCustomerModel?.label ?? (selectedSourceAssets.length ? jobT(spanish, "Uploaded selfies", "Selfies subidas") : jobT(spanish, "No model selected", "Ningun modelo seleccionado"));
  const textClass = light ? "text-[#171514]" : "text-white";
  const mutedClass = light ? "text-[#6f675e]" : "text-white/62";
  const eyebrowClass = light ? "text-[#9b6b42]" : "text-white/48";
  const panelClass = light ? "border-[#eadfce] bg-white text-[#171514]" : "border-white/10 bg-white/[0.04] text-white";
  const subtlePanelClass = light ? "border-[#eadfce] bg-[#fffaf3]" : "border-white/10 bg-black/16";
  const dialogStatusClass = dialogTone === "error"
    ? (light ? "border-[#f0b7a5] bg-[#fff1ee] text-[#8d2d1b]" : "border-red-400/30 bg-red-500/10 text-red-100")
    : dialogTone === "success"
      ? (light ? "border-[#b9d8bd] bg-[#f1fff2] text-[#286139]" : "border-emerald-300/25 bg-emerald-400/10 text-emerald-100")
      : (light ? "border-[#dfd3c4] bg-white text-[#625d56]" : "border-white/10 bg-white/[0.05] text-white/72");
  const fieldClass = light
    ? "border-[#dfd3c4] bg-white text-[#171514] placeholder:text-[#9d9388]"
    : "border-white/10 bg-white/[0.05] text-white placeholder:text-white/35";
  const primaryButtonClass = light
    ? "bg-[linear-gradient(135deg,#ff8a5c_0%,#ec4bdd_52%,#16dcf0_100%)] text-white shadow-[0_14px_34px_-24px_rgba(236,75,221,0.75)] hover:brightness-105"
    : "bg-white text-[#14161a]";
  const selectedCardClass = light ? "border-[#ff8a5c]/55 bg-[linear-gradient(135deg,#fff1e7_0%,#fff8ef_58%,#edfaff_100%)] text-[#171514] shadow-[0_16px_42px_-34px_rgba(224,105,63,0.5)]" : "border-white bg-white text-[#14161a]";
  const neutralCardClass = light ? "border-[#eadfce] bg-white text-[#171514]" : "border-white/10 bg-white/[0.04] text-white";
  const selectedPillClass = light ? "bg-[#132329] text-white" : "bg-[#14161a] text-white";
  const selectedSoftPillClass = light ? "bg-white text-[#c65f32] ring-1 ring-[#ffd0b8]" : "bg-[#14161a]/10 text-[#14161a]";
  const neutralPillClass = light ? "bg-[#f1eadf] text-[#5f574f]" : "bg-white/[0.08] text-white/74";
  const selectedPromptBuilderGroups = useMemo(() => promptBuilderGroupsForPack(selectedPack), [selectedPack]);
  const promptBuilderSummary = selectedPromptBuilderGroups
    .map((group) => promptBuilderSelections[group.id])
    .filter((value): value is string => Boolean(value?.trim()))
    .join(", ");
  const promptBuilderDirectionText = useMemo(() => {
    const builderText = promptBuilderSummary
      ? jobT(spanish, `Visual plan: ${promptBuilderSummary}.`, `Plan visual: ${promptBuilderSummary}.`)
      : "";
    const selectionText = selectionTitle
      ? jobT(spanish, `Selected style: ${selectionTitle}.`, `Estilo seleccionado: ${selectionTitle}.`)
      : "";
    return [selectionText, builderText].filter(Boolean).join("\n");
  }, [promptBuilderSummary, selectionTitle, spanish]);
  const promptBuilderApplied = Boolean(promptBuilderDirectionText && packagePromptDraft.includes(promptBuilderDirectionText));

  useEffect(() => {
    if (createMode === "theme" && selectedPackId) {
      setPackagePromptDraft(selectedPackPrompt);
      setPromptBuilderSelections({});
    }
  }, [createMode, selectedPackId, selectedPackPrompt]);

  useEffect(() => {
    if (createMode !== "tool" || !selectedToolPresetId) return;
    setPackagePromptDraft((current) => current || selectedToolPrompt);
  }, [createMode, selectedToolPresetId, selectedToolPrompt]);

  useEffect(() => {
    setAvailableAssets((current) => mergeAssetLists(current, assets));
  }, [assets]);

  useEffect(() => {
    if (!externalSourceAssets) return;
    setAvailableAssets((current) => mergeAssetLists(externalSourceAssets, current));
  }, [externalSourceAssets]);

  useEffect(() => {
    if (!externalPrimaryAssetIds) return;
    setSelectedAssetIds(externalPrimaryAssetIds.slice(0, DEFAULT_MAX_SOURCE_ASSETS));
  }, [externalPrimaryAssetIds]);

  useEffect(() => {
    if (!externalPartnerAssetIds) return;
    setPartnerSelectedAssetIds(externalPartnerAssetIds.slice(0, DEFAULT_MAX_SOURCE_ASSETS));
  }, [externalPartnerAssetIds]);

  useEffect(() => {
    if (selectedCustomerModelId && customerModels.some((model) => model.id === selectedCustomerModelId)) return;
    const nextModel = customerModels.find((model) => model.status === "ready") ?? customerModels[0];
    if (nextModel) {
      setSelectedCustomerModelId(nextModel.id);
      setPackageAudience(nextModel.modelType === "couple" ? "both" : "self");
    }
  }, [customerModels, selectedCustomerModelId]);

  useEffect(() => {
    let cancelled = false;
    const loadAssets = (refresh = false) => {
      if (refresh) invalidateCustomerAssets(siteId, customer.id);
      const mutationVersion = localAssetMutationRef.current;
      setLoadingAssets(true);
      loadCustomerAssets(siteId, customer.id, 100, "source-picker")
        .then((result) => {
          if (!cancelled) {
            let nextAssets = result;
            setAvailableAssets((current) => {
              nextAssets = mutationVersion === localAssetMutationRef.current ? result : mergeAssetLists(current, result);
              return nextAssets;
            });
            setSelectedAssetIds((current) => current.filter((id) => nextAssets.some((asset) => asset.id === id)));
            setPartnerSelectedAssetIds((current) => current.filter((id) => nextAssets.some((asset) => asset.id === id)));
            setLoadingAssets(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoadingAssets(false);
        });
    };
    const handleAssetsUpdated = () => loadAssets(true);
    if (preferProvidedAssets) {
      setLoadingAssets(false);
    } else {
      loadAssets();
    }
    window.addEventListener("customer-assets:updated", handleAssetsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("customer-assets:updated", handleAssetsUpdated);
    };
  }, [customer.id, preferProvidedAssets, siteId]);

  function selectedTotalAfterToggle(assetId: string, target: "primary" | "partner", currentTargetIds: string[]): number {
    const nextTargetIds = currentTargetIds.includes(assetId)
      ? currentTargetIds.filter((id) => id !== assetId)
      : [...currentTargetIds, assetId];
    const otherIds = target === "primary" ? partnerSelectedAssetIds : selectedAssetIds;
    return new Set([...nextTargetIds, ...otherIds]).size;
  }

  function toggleAsset(assetId: string, target: "primary" | "partner" = "primary") {
    const setter = target === "primary" ? setSelectedAssetIds : setPartnerSelectedAssetIds;
    setter((current) => {
      if (!current.includes(assetId) && selectedTotalAfterToggle(assetId, target, current) > effectiveMaxAssets) return current;
      return current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId];
    });
  }

  function updateAiApp(nextSlug: string, nextMode: CreateMode = createMode) {
    setAiAppSlug(nextSlug);
    const nextApp = siteAiApps.find((app) => app.aiApp.slug === nextSlug);
    setCreativePackId(packsForApp(orderedActiveCreativePacks, nextSlug)[0]?.id ?? "");
    setFormValues(valuesForMode(nextApp, nextMode));
    setSelectedAssetIds(initialSelectedAssets(availableAssets, workflowFor(nextApp)).slice(0, DEFAULT_MAX_SOURCE_ASSETS));
    setPartnerSelectedAssetIds([]);
  }

  function updateCreativePack(pack: CreativePack) {
    setCreateMode("theme");
    setCreativePackId(pack.id);
    setPackagePromptDraft(pack.prompt?.trim() || pack.description || pack.headline || "");
    setPromptBuilderSelections({});
    if (pack.aiAppSlug !== aiAppSlug) {
      updateAiApp(pack.aiAppSlug, "theme");
      setCreativePackId(pack.id);
    }
  }

  function updateField(id: string, value: string | number | boolean) {
    setFormValues((current) => ({ ...current, [id]: value }));
  }

  function normalizeThemeOutputCount(value: string): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_THEME_OUTPUT_COUNT;
  }

  function updateThemeOutputCountDraft(value: string) {
    setThemeOutputCountDraft(value);
    setThemeOutputCount(value.trim() ? normalizeThemeOutputCount(value) : DEFAULT_THEME_OUTPUT_COUNT);
  }

  function commitThemeOutputCountDraft() {
    const nextCount = themeOutputCountDraft.trim() ? normalizeThemeOutputCount(themeOutputCountDraft) : DEFAULT_THEME_OUTPUT_COUNT;
    setThemeOutputCount(nextCount);
    setThemeOutputCountDraft(String(nextCount));
  }

  function setPromptBuilderOption(groupId: PromptBuilderKey, value: string) {
    setPromptBuilderSelections((current) => ({
      ...current,
      [groupId]: current[groupId] === value ? undefined : value
    }));
  }

  function applyPromptBuilderDirection() {
    if (!promptBuilderDirectionText) return;
    const currentPrompt = packagePromptDraft.trim();
    const nextPrompt = currentPrompt.includes(promptBuilderDirectionText)
      ? currentPrompt
      : [currentPrompt, promptBuilderDirectionText].filter(Boolean).join("\n\n");
    setPackagePromptDraft(nextPrompt);
    if (createMode === "tool") updateField(TOOL_PROMPT_FIELD_ID, nextPrompt);
  }

  function updateCreateMode(nextMode: CreateMode) {
    setCreateMode(nextMode);
    setMessage(nextMode === "theme"
      ? jobT(spanish, "Choose a package, upload or select selfies, then review your private AI photoshoot.", "Elige un paquete, sube o selecciona selfies y revisa tu sesion privada con IA.")
      : jobT(spanish, "Describe the result you want, attach selfies, then review this tool request.", "Describe el resultado que quieres, adjunta selfies y revisa esta solicitud."));
    setFormValues((current) => {
      if (nextMode === "theme") {
        const next: Record<string, string | number | boolean> = { ...current, outputCount: themeOutputCount };
        delete next.prompt;
        delete next.style;
        delete next.output_count;
        return next;
      }
      return {
        ...current,
        [TOOL_PROMPT_FIELD_ID]: String(current[TOOL_PROMPT_FIELD_ID] || toolPresets.find((preset) => preset.id === selectedToolId)?.prompt || "")
      };
    });
    if (nextMode === "theme" && !creativePackId) {
      setCreativePackId(appPacks[0]?.id ?? orderedActiveCreativePacks[0]?.id ?? "");
    }
  }

  const handleVideoToolPreset = useCallback((preset: ToolPreset) => {
    setCreateMode("tool");
    setSelectedToolId(preset.id);
    setPromptBuilderSelections({});
    setPackageDialogOpen(false);
    setDialogMessage("");
    setDialogTone("info");
    setMessage(jobT(spanish, `${preset.title} opens in the Image to Video workspace.`, `${preset.title} se abre en el espacio Image to Video.`));
    onVideoToolSelected?.({ id: preset.id, title: preset.title, href: preset.href });
  }, [onVideoToolSelected, spanish]);

  function updateToolPreset(preset: ToolPreset) {
    if (preset.kind === "video") {
      handleVideoToolPreset(preset);
      return;
    }
    if (!preset.backendSlug) return;
    setCreateMode("tool");
    setSelectedToolId(preset.id);
    setPromptBuilderSelections({});
    if (preset.backendSlug !== aiAppSlug) {
      setAiAppSlug(preset.backendSlug);
      const nextApp = siteAiApps.find((app) => app.aiApp.slug === preset.backendSlug);
      setSelectedAssetIds(initialSelectedAssets(availableAssets, workflowFor(nextApp)).slice(0, DEFAULT_MAX_SOURCE_ASSETS));
    }
    setFormValues((current) => ({
      ...valuesForMode(siteAiApps.find((app) => app.aiApp.slug === preset.backendSlug), "tool"),
      ...current,
      [TOOL_PROMPT_FIELD_ID]: String(current[TOOL_PROMPT_FIELD_ID] || preset.prompt)
    }));
    setMessage(jobT(spanish, "Describe the result you want, attach selfies, then review this tool request.", "Describe el resultado que quieres, adjunta selfies y revisa esta solicitud."));
  }

  function openPackageDialog() {
    if (createMode === "tool" && selectedToolPreset?.kind === "video") {
      handleVideoToolPreset(selectedToolPreset);
      return;
    }
    setDialogMessage("");
    setDialogTone("info");
    if (createMode === "theme" && selectedPack) {
      setPackagePromptDraft((current) => current || selectedPack.prompt?.trim() || selectedPack.description || selectedPack.headline || "");
    }
    if (createMode === "tool" && selectedToolPreset) {
      setPackagePromptDraft((current) => current || String(formValues[TOOL_PROMPT_FIELD_ID] || selectedToolPreset.prompt || ""));
    }
    setPackageDialogOpen(true);
  }

  function revealPackageDetail() {
    if (typeof window === "undefined") return;
    window.setTimeout(() => {
      packageDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function selectCreativePackAndReveal(pack: CreativePack) {
    updateCreativePack(pack);
    setDialogMessage("");
    setDialogTone("info");
    setPackagePromptDraft(pack.prompt?.trim() || pack.description || pack.headline || "");
    setPackageDialogOpen(false);
    revealPackageDetail();
  }

  function selectToolPresetAndOpen(preset: ToolPreset) {
    if (preset.kind === "video") {
      handleVideoToolPreset(preset);
      return;
    }
    updateToolPreset(preset);
    setDialogMessage("");
    setDialogTone("info");
    setPackagePromptDraft(String(formValues[TOOL_PROMPT_FIELD_ID] || preset.prompt || ""));
    setPackageDialogOpen(true);
  }

  function updateThemeCategory(nextCategory: string) {
    setThemeCategory(nextCategory);
    const nextPacks = nextCategory === "all"
      ? orderedActiveCreativePacks
      : orderedActiveCreativePacks.filter((pack) => creativePackMatchesMegaGroup(pack, nextCategory, packageMegaGroups));
    if (nextPacks.length && !nextPacks.some((pack) => pack.id === creativePackId)) {
      updateCreativePack(nextPacks[0]);
      setThemeCategory(nextCategory);
    }
    revealPackageDetail();
  }

  function reviewCurrentRequest() {
    if (onReviewCurrentRequest) {
      onReviewCurrentRequest();
      return;
    }
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", "#review-current-request");
    window.setTimeout(() => {
      document.getElementById("review-current-request")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function continueToReviewOrSelfies() {
    openPackageDialog();
  }

  function openSourceUploadPicker() {
    sourceUploadInputRef.current?.click();
  }

  preferredRouteStateRef.current = {
    createMode,
    creativePackId,
    orderedActiveCreativePacks,
    selectedToolId,
    toolPresets,
    visibleCreativePacks,
    updateCreateMode,
    updateCreativePack,
    updateToolPreset
  };

  useEffect(() => {
    const handleOpenUpload = (event: Event) => {
      const target = (event as CustomEvent<{ target?: UploadTarget }>).detail?.target;
      pendingUploadTargetRef.current = target === "partner" ? "partner" : "primary";
      openSourceUploadPicker();
    };
    window.addEventListener("customer-workspace:open-source-upload", handleOpenUpload);
    return () => window.removeEventListener("customer-workspace:open-source-upload", handleOpenUpload);
  }, []);

  useEffect(() => {
    const normalizedToolId = normalizeToolId(initialToolId);
    if (!normalizedToolId) return;
    const initialVideoPreset = toolPresets.find((preset) => preset.id === normalizedToolId && preset.kind === "video");
    if (!initialVideoPreset || routedVideoToolIdsRef.current.has(initialVideoPreset.id)) return;
    routedVideoToolIdsRef.current.add(initialVideoPreset.id);
    handleVideoToolPreset(initialVideoPreset);
  }, [handleVideoToolPreset, initialToolId, toolPresets]);

  useEffect(() => {
    const preferredRouteKey = `${preferredMode ?? ""}|${preferredToolId ?? ""}|${preferredModeRequest}`;
    if (!preferredMode && !preferredToolId) return;
    if (preferredRouteKeyRef.current === preferredRouteKey) return;
    preferredRouteKeyRef.current = preferredRouteKey;
    const routeState = preferredRouteStateRef.current;
    if (!routeState) return;
    const normalizedPreferredToolId = preferredToolId ? normalizeToolId(preferredToolId) : "";
    if (preferredMode === "tool" || normalizedPreferredToolId) {
      const nextPreset =
        routeState.toolPresets.find((preset) => preset.id === normalizedPreferredToolId) ??
        routeState.toolPresets.find((preset) => preset.id === routeState.selectedToolId) ??
        routeState.toolPresets[0];
      routeState.updateCreateMode("tool");
      if (nextPreset) routeState.updateToolPreset(nextPreset);
      return;
    }
    if (preferredMode === routeState.createMode) return;
    const nextPack =
      routeState.orderedActiveCreativePacks.find((pack) => pack.id === routeState.creativePackId) ??
      routeState.visibleCreativePacks[0] ??
      routeState.orderedActiveCreativePacks[0];
    routeState.updateCreateMode("theme");
    if (nextPack) routeState.updateCreativePack(nextPack);
  }, [preferredMode, preferredModeRequest, preferredToolId]);

  useEffect(() => {
    const action = operationContext?.action?.trim();
    const note = operationContext?.note?.trim();
    if (!action && !note) return;
    const summary = [
      action ? jobT(spanish, `Selected operation: ${action}.`, `Operacion seleccionada: ${action}.`) : "",
      note ? jobT(spanish, `Direction: ${note}`, `Direccion: ${note}`) : ""
    ].filter(Boolean).join(" ");
    if (createMode === "tool" && summary) {
      setFormValues((current) => {
        const currentPrompt = String(current[TOOL_PROMPT_FIELD_ID] ?? "").trim();
        if (currentPrompt.includes(summary)) return current;
        return {
          ...current,
          [TOOL_PROMPT_FIELD_ID]: currentPrompt ? `${summary}\n\n${currentPrompt}` : summary
        };
      });
    }
  }, [createMode, operationContext?.action, operationContext?.note, preferredModeRequest, spanish]);

  useEffect(() => {
    if (!retryDraft) {
      appliedRetryDraftKeyRef.current = null;
      return;
    }
    if (appliedRetryDraftKeyRef.current === retryDraft.key) return;
    appliedRetryDraftKeyRef.current = retryDraft.key;
    const nextMode: CreateMode = retryDraft.mode === "tool" ? "tool" : "theme";
    const availableAssetIds = new Set(availableAssets.map((asset) => asset.id));
    const restoredPrimaryIds = (retryDraft.primaryAssetIds ?? [])
      .filter((assetId) => availableAssetIds.has(assetId))
      .slice(0, DEFAULT_MAX_SOURCE_ASSETS);
    const restoredPrimarySet = new Set(restoredPrimaryIds);
    const restoredPartnerIds = (retryDraft.partnerAssetIds ?? [])
      .filter((assetId) => availableAssetIds.has(assetId) && !restoredPrimarySet.has(assetId))
      .slice(0, DEFAULT_MAX_SOURCE_ASSETS);
    const restoredOutputCount = retryDraft.outputCount !== undefined && Number.isFinite(retryDraft.outputCount) && retryDraft.outputCount > 0
      ? Math.trunc(retryDraft.outputCount)
      : undefined;
    const retryValues = retryDraft.formValues ?? {};

    setCreateMode(nextMode);
    setPromptBuilderSelections({});
    setDialogMessage("");
    setDialogTone("info");
    setPackageDialogOpen(false);
    setSelectedAssetIds(restoredPrimaryIds);
    setPartnerSelectedAssetIds(restoredPartnerIds);
    if (retryDraft.packageAudience) setPackageAudience(retryDraft.packageAudience);
    if (retryDraft.customerModelId && customerModels.some((model) => model.id === retryDraft.customerModelId)) {
      setSelectedCustomerModelId(retryDraft.customerModelId);
    }
    if (restoredOutputCount !== undefined) {
      setThemeOutputCount(restoredOutputCount);
      setThemeOutputCountDraft(String(restoredOutputCount));
    }
    if (retryDraft.prompt !== undefined) {
      setPackagePromptDraft(retryDraft.prompt);
    }

    if (nextMode === "tool") {
      const normalizedToolId = normalizeToolId(retryDraft.toolId);
      const nextPreset =
        toolPresets.find((preset) => preset.id === normalizedToolId) ??
        toolPresets.find((preset) => preset.id === selectedToolId) ??
        toolPresets[0];
      if (nextPreset) {
        setSelectedToolId(nextPreset.id);
        if (nextPreset.backendSlug) setAiAppSlug(nextPreset.backendSlug);
      }
      const nextApp = nextPreset?.backendSlug
        ? siteAiApps.find((app) => app.aiApp.slug === nextPreset.backendSlug)
        : selectedApp;
      setFormValues({
        ...valuesForMode(nextApp, "tool"),
        ...retryValues,
        ...(retryDraft.prompt !== undefined ? { [TOOL_PROMPT_FIELD_ID]: retryDraft.prompt } : {})
      });
    } else {
      const nextPack = retryDraft.creativePackId
        ? orderedActiveCreativePacks.find((pack) => pack.id === retryDraft.creativePackId)
        : undefined;
      if (nextPack) {
        setCreativePackId(nextPack.id);
        setAiAppSlug(nextPack.aiAppSlug);
      }
      const nextApp = nextPack
        ? siteAiApps.find((app) => app.aiApp.slug === nextPack.aiAppSlug)
        : selectedApp;
      setFormValues({
        ...valuesForMode(nextApp, "theme"),
        ...retryValues,
        ...(restoredOutputCount !== undefined ? { outputCount: restoredOutputCount } : {})
      });
    }

    setMessage(jobT(spanish, "Previous failed request restored. Review the setup, then start generation again.", "Solicitud fallida restaurada. Revisa la configuracion y vuelve a iniciar la generacion."));
  }, [availableAssets, customerModels, orderedActiveCreativePacks, retryDraft, selectedApp, selectedToolId, siteAiApps, spanish, toolPresets]);

  async function uploadSourceFiles(files: FileList | null) {
    const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setMessage(jobT(spanish, "Choose one or more image files before uploading.", "Elige uno o mas archivos de imagen antes de subir."));
      return;
    }
    setUploadingSources(true);
    setMessage(jobT(spanish, `Uploading ${imageFiles.length} private photo${imageFiles.length === 1 ? "" : "s"}...`, `Subiendo ${imageFiles.length} foto${imageFiles.length === 1 ? "" : "s"} privada${imageFiles.length === 1 ? "" : "s"}...`));
    const createdAssets: ThemeRuntimeAsset[] = [];
    for (const [index, file] of imageFiles.entries()) {
      const preparedUpload = await prepareCustomerImageUploadFile(file);
      const formData = new FormData();
      formData.append("file", preparedUpload.file);
      formData.append("label", uploadLabelForFile(file, index, imageFiles.length));
      formData.append("role", "input");
      const response = await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets`, {
        method: "POST",
        headers: csrfHeader(`customer_csrf_${siteId}`),
        body: formData
      });
      const result = (await response.json().catch(() => ({}))) as { asset?: ThemeRuntimeAsset; error?: string };
      if (!response.ok || !result.asset) {
        setMessage(customerImageUploadErrorMessage(file.name, result.error, spanish));
        setUploadingSources(false);
        return;
      }
      createdAssets.push(result.asset);
    }
    invalidateCustomerAssets(siteId, customer.id);
    localAssetMutationRef.current += 1;
    setAvailableAssets((current) => [...createdAssets, ...current.filter((asset) => !createdAssets.some((created) => created.id === asset.id))]);
    const createdIds = createdAssets.map((asset) => asset.id);
    const nextPrimaryIds = pendingUploadTargetRef.current === "partner" ? selectedAssetIds : [...createdIds, ...selectedAssetIds].slice(0, effectiveMaxAssets);
    const nextPartnerIds = pendingUploadTargetRef.current === "partner" ? [...createdIds, ...partnerSelectedAssetIds].slice(0, effectiveMaxAssets) : partnerSelectedAssetIds;
    if (pendingUploadTargetRef.current === "partner") {
      setPartnerSelectedAssetIds(nextPartnerIds);
    } else {
      setSelectedAssetIds(nextPrimaryIds);
    }
    const keepIds = Array.from(new Set([...nextPrimaryIds, ...nextPartnerIds])).slice(0, DEFAULT_MAX_SOURCE_ASSETS * 2);
    void syncCurrentSourceAssets(keepIds);
    setMessage(jobT(spanish, `${createdAssets.length} private photo${createdAssets.length === 1 ? "" : "s"} uploaded. Select the selfies you want to use.`, `${createdAssets.length} foto${createdAssets.length === 1 ? "" : "s"} privada${createdAssets.length === 1 ? "" : "s"} subida${createdAssets.length === 1 ? "" : "s"}. Selecciona las selfies que quieres usar.`));
    setUploadingSources(false);
  }

  async function deleteSourceAsset(asset: ThemeRuntimeAsset) {
    if (deletingAssetIds.includes(asset.id)) return;
    const confirmed = window.confirm(jobT(spanish, `Delete "${asset.label}" from your private model photos?`, `Eliminar "${asset.label}" de tus fotos privadas del modelo?`));
    if (!confirmed) return;
    setDeletingAssetIds((current) => [...current, asset.id]);
    setMessage(jobT(spanish, "Deleting private photo...", "Eliminando foto privada..."));
    const response = await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets/${asset.id}`, {
      method: "DELETE",
      headers: csrfHeader(`customer_csrf_${siteId}`)
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setDeletingAssetIds((current) => current.filter((id) => id !== asset.id));
    if (!response.ok) {
      setMessage(result.error?.includes("csrf")
        ? jobT(spanish, "Your secure session expired. Refresh the page, then try again.", "Tu sesion segura expiro. Actualiza la pagina e intentalo de nuevo.")
        : jobT(spanish, "We could not delete this private photo. Please try again.", "No pudimos eliminar esta foto privada. Intentalo de nuevo."));
      return;
    }
    invalidateCustomerAssets(siteId, customer.id);
    localAssetMutationRef.current += 1;
    setAvailableAssets((current) => current.filter((item) => item.id !== asset.id));
    setSelectedAssetIds((current) => current.filter((id) => id !== asset.id));
    setPartnerSelectedAssetIds((current) => current.filter((id) => id !== asset.id));
    setMessage(jobT(spanish, "Private photo deleted.", "Foto privada eliminada."));
  }

  async function deleteSelectedSourceAssets(assetIds: string[]) {
    const remoteIds = Array.from(new Set(assetIds.filter(Boolean))).filter((assetId) => !deletingAssetIds.includes(assetId));
    if (!remoteIds.length) return;
    const confirmed = window.confirm(jobT(spanish, `Delete ${remoteIds.length} selected private photo${remoteIds.length === 1 ? "" : "s"}?`, `Eliminar ${remoteIds.length} foto${remoteIds.length === 1 ? "" : "s"} privada${remoteIds.length === 1 ? "" : "s"} seleccionada${remoteIds.length === 1 ? "" : "s"}?`));
    if (!confirmed) return;
    setDeletingAssetIds((current) => Array.from(new Set([...current, ...remoteIds])));
    setMessage(remoteIds.length === 1
      ? jobT(spanish, "Deleting private photo...", "Eliminando foto privada...")
      : jobT(spanish, `Deleting ${remoteIds.length} private photos...`, `Eliminando ${remoteIds.length} fotos privadas...`));
    const response = await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets`, {
      method: "DELETE",
      headers: {
        ...csrfHeader(`customer_csrf_${siteId}`),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ assetIds: remoteIds })
    });
    setDeletingAssetIds((current) => current.filter((id) => !remoteIds.includes(id)));
    if (!response.ok) {
      setMessage(jobT(spanish, "We could not delete every selected private photo. Please refresh and try again.", "No pudimos eliminar todas las fotos privadas seleccionadas. Actualiza e intentalo de nuevo."));
      return;
    }
    invalidateCustomerAssets(siteId, customer.id);
    localAssetMutationRef.current += 1;
    setAvailableAssets((current) => current.filter((item) => !remoteIds.includes(item.id)));
    setSelectedAssetIds((current) => current.filter((id) => !remoteIds.includes(id)));
    setPartnerSelectedAssetIds((current) => current.filter((id) => !remoteIds.includes(id)));
    setMessage(jobT(spanish, `${remoteIds.length} private photo${remoteIds.length === 1 ? "" : "s"} deleted.`, `${remoteIds.length} foto${remoteIds.length === 1 ? "" : "s"} privada${remoteIds.length === 1 ? "" : "s"} eliminada${remoteIds.length === 1 ? "" : "s"}.`));
  }

  async function syncCurrentSourceAssets(keepAssetIds: string[]) {
    await fetch(`/api/sites/${siteId}/customers/${customer.id}/assets`, {
      method: "PATCH",
      headers: {
        ...csrfHeader(`customer_csrf_${siteId}`),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action: "keep_current_samples", keepAssetIds })
    }).catch(() => null);
  }

  async function createJob(event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    const showDialogError = (text: string) => {
      setDialogTone("error");
      setDialogMessage(text);
      setMessage(text);
    };
    if (createMode === "theme" && !selectedPack) {
      showDialogError(jobT(spanish, "Choose a photo package before starting.", "Elige un paquete de fotos antes de empezar."));
      return;
    }
    if (createMode === "tool" && selectedToolPreset?.kind === "video") {
      handleVideoToolPreset(selectedToolPreset);
      return;
    }
    if (subscriptionStatus === "loading") {
      showDialogError(jobT(spanish, "We are still checking your subscription. Try again in a moment.", "Aun estamos revisando tu suscripcion. Intentalo en un momento."));
      return;
    }
    if (subscriptionHardGate) {
      showDialogError(jobT(spanish, "Choose a subscription or add enough credits before starting generation. Your workspace setup stays saved.", "Elige una suscripcion o anade creditos suficientes antes de generar. La configuracion de tu espacio queda guardada."));
      return;
    }
    if (selectedRequestAssetIds.length < minAssets) {
      showDialogError(jobT(spanish, `Select at least ${minAssets} private photo before starting this request.`, `Selecciona al menos ${minAssets} foto privada antes de iniciar esta solicitud.`));
      return;
    }
    if (!hasRequiredCoupleSampleGroups) {
      showDialogError(coupleSampleRequirementMessage);
      return;
    }
    if (selectedRequestAssetIds.length > effectiveMaxAssets) {
      showDialogError(jobT(spanish, `Use up to ${effectiveMaxAssets} private photos for this photo set.`, `Usa hasta ${effectiveMaxAssets} fotos privadas para este set.`));
      return;
    }
    if (selectionCreditCost > customer.balance.available) {
      showDialogError(jobT(spanish, `This request needs ${selectionCreditCost} credits, but ${customer.balance.available} are available. Add credits or choose a smaller package.`, `Esta solicitud necesita ${selectionCreditCost} creditos, pero tienes ${customer.balance.available}. Anade creditos o elige un paquete menor.`));
      return;
    }
    const missingField = modeFields.find((field) => field.required && (formValues[field.id] === "" || formValues[field.id] === undefined || formValues[field.id] === null));
    if (missingField) {
      showDialogError(jobT(spanish, `Complete ${missingField.label} before starting.`, `Completa ${missingField.label} antes de empezar.`));
      return;
    }
    if (createMode === "tool") {
      const prompt = String(formValues[TOOL_PROMPT_FIELD_ID] ?? "").trim();
      const blockedTerm = blockedPromptTerm(prompt);
      if (blockedTerm) {
        showDialogError(jobT(spanish, "This prompt includes unsafe or disallowed content. Please revise it before starting.", "Estas instrucciones incluyen contenido no permitido. Revisalas antes de empezar."));
        return;
      }
    }
    const requestFields: Record<string, unknown> = Object.fromEntries(modeFields.map((field) => [field.id, formValues[field.id] ?? fieldValueDefault(field)]));
    if (createMode === "theme") {
      requestFields.outputCount = themeOutputCount;
      requestFields.packageAudience = packageAudience;
      requestFields.customerModelLabel = selectedModelLabel;
      requestFields.creativePackName = selectedPack?.name ?? "";
      requestFields.creativePackPrompt = selectedPack?.prompt ?? "";
      requestFields.packagePrompt = packagePromptDraft.trim();
      requestFields.userDirection = packagePromptDraft.trim();
      requestFields.promptBuilder = promptBuilderSummary;
      requestFields.primaryAssetIds = selectedAssetIds;
      requestFields.partnerAssetIds = isCoupleFlow ? partnerSelectedAssetIds : [];
      requestFields.trainingMode = trainingMode;
      delete requestFields.style;
    } else {
      requestFields.toolPresetId = selectedToolId;
      requestFields.toolPresetTitle = toolPresets.find((preset) => preset.id === selectedToolId)?.title ?? "";
      requestFields.customerModelLabel = selectedModelLabel;
      requestFields.prompt = packagePromptDraft.trim() || String(formValues[TOOL_PROMPT_FIELD_ID] ?? "");
      requestFields.promptBuilder = promptBuilderSummary;
      requestFields.primaryAssetIds = selectedAssetIds;
      requestFields.partnerAssetIds = isCoupleFlow ? partnerSelectedAssetIds : [];
      requestFields.trainingMode = trainingMode;
    }
    setPending(true);
    setDialogTone("info");
    setDialogMessage(subscriptionBypassActive
      ? jobT(spanish, "Creating the admin job and reserving credits. Keep this window open until the request status page opens.", "Creando la solicitud de administrador y reservando creditos. Manten esta ventana abierta hasta que se abra el estado.")
      : jobT(spanish, "Creating the job and reserving credits. Keep this window open until the request status page opens.", "Creando la solicitud y reservando creditos. Manten esta ventana abierta hasta que se abra el estado."));
    setMessage(subscriptionBypassActive
      ? jobT(spanish, "Starting your admin photo set and holding credits...", "Iniciando tu set de administrador y reservando creditos...")
      : jobT(spanish, "Starting your photo set and holding credits...", "Iniciando tu set de fotos y reservando creditos..."));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(`/api/sites/${siteId}/ai/jobs`, {
        method: "POST",
        headers: customerJsonHeaders(siteId),
        signal: controller.signal,
        body: JSON.stringify({
          customerId: customer.id,
          aiAppSlug,
          params: {
            mode: createMode,
            creativePackId: createMode === "theme" ? selectedPack?.id : undefined,
            fields: requestFields,
            workflowVersion: selectedWorkflow?.version ?? 1,
            customerModelId: selectedCustomerModel?.id,
            assetIds: selectedRequestAssetIds,
            primaryAssetIds: selectedAssetIds,
            partnerAssetIds: isCoupleFlow ? partnerSelectedAssetIds : [],
            subscriptionBypassRequested: subscriptionBypassActive ? "site_admin" : undefined
          }
        })
      });
    } catch (error) {
      window.clearTimeout(timeout);
      setPending(false);
      const text = error instanceof DOMException && error.name === "AbortError"
        ? jobT(spanish, "This request is taking longer than expected. Refresh the All tab before retrying so you do not duplicate a request that may have started.", "Esta solicitud esta tardando mas de lo esperado. Actualiza la pestana Todo antes de reintentar para no duplicarla.")
        : jobT(spanish, "The network failed while starting this request. Please check the connection and try again.", "La red fallo al iniciar esta solicitud. Revisa la conexion e intentalo de nuevo.");
      showDialogError(text);
      return;
    }
    window.clearTimeout(timeout);
    const result = (await response.json().catch(() => ({}))) as { error?: string; job?: { id: string }; customerBalance?: PublicCustomer["balance"]; workerDispatch?: CreatedJobFeedback["workerDispatch"]; note?: string };
    if (!response.ok || !result.job) {
      setPending(false);
      showDialogError(jobErrorMessage(result.error, response.status, spanish));
      return;
    }
    const dispatchStatus = result.workerDispatch?.status;
    const dispatchMessage =
      dispatchStatus === "failed"
        ? jobT(spanish, `Job created, but the generator did not accept it: ${result.workerDispatch?.error ?? "worker_dispatch_failed"}. Opening the request status page.`, `Solicitud creada, pero el generador no la acepto: ${result.workerDispatch?.error ?? "worker_dispatch_failed"}. Abriendo la pagina de estado.`)
        : dispatchStatus === "skipped"
          ? subscriptionBypassActive
            ? jobT(spanish, "Admin job created and credits are held, but no generator is configured for this environment. Opening the request status page.", "Solicitud de administrador creada y creditos reservados, pero no hay generador configurado en este entorno. Abriendo estado.")
            : jobT(spanish, "Job created and credits are held, but no generator is configured for this environment. Opening the request status page.", "Solicitud creada y creditos reservados, pero no hay generador configurado en este entorno. Abriendo estado.")
          : jobT(spanish, "Job created. Opening the request status page so you can follow generation progress.", "Solicitud creada. Abriendo la pagina de estado para seguir el progreso.");
    setDialogTone("success");
    setDialogMessage(dispatchMessage);
    setMessage(dispatchMessage);
    setPending(false);
    setPackageDialogOpen(false);
    onJobCreated?.(result.job.id, { customerBalance: result.customerBalance, workerDispatch: result.workerDispatch, note: result.note });
  }

  function renderPhotoPicker(title: string, description: string, target: "primary" | "partner", selectedIds: string[]) {
    const deletingSelected = selectedIds.some((id) => deletingAssetIds.includes(id));
    return (
      <div className={`grid gap-3 rounded-[16px] border p-3 ${subtlePanelClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${textClass}`}>{title}</p>
            <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${light ? "border-[#eadfce] bg-white text-[#625d56]" : "border-white/10 bg-white/[0.05] text-white/62"}`}>
              {jobT(spanish, `${selectedIds.length} selected`, `${selectedIds.length} seleccionadas`)}
            </span>
            {selectedIds.length ? (
              <button
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-55 ${light ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : "border-rose-300/25 bg-rose-500/12 text-rose-100 hover:bg-rose-500/18"}`}
                disabled={deletingSelected}
                onClick={() => void deleteSelectedSourceAssets(selectedIds)}
                type="button"
              >
                {deletingSelected ? jobT(spanish, "Deleting", "Eliminando") : jobT(spanish, "Delete selected", "Eliminar seleccionadas")}
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {sourceAssets.map((asset) => {
            const checked = selectedIds.includes(asset.id);
            const deleting = deletingAssetIds.includes(asset.id);
            return (
              <div className={`group relative overflow-hidden rounded-[14px] border transition ${checked ? (light ? "border-[#ff8a5c] bg-[#fff1e7] text-[#171514] shadow-[0_12px_30px_-24px_rgba(224,105,63,0.58)]" : "border-white bg-white text-[#14161a]") : (light ? "border-[#eadfce] bg-white text-[#171514]" : "border-white/10 bg-black/18 text-white")} ${deleting ? "opacity-55" : ""}`} key={`${target}_${asset.id}`}>
                <img alt={asset.label} className="aspect-[4/5] w-full cursor-zoom-in object-cover" src={asset.previewUrl} {...previewImageAttrs(asset.previewUrl, asset.label, jobT(spanish, "Private source image", "Imagen fuente privada"))} />
                <button
                  aria-label={jobT(spanish, `Delete ${asset.label}`, `Eliminar ${asset.label}`)}
                  className="absolute left-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/62 text-white opacity-90 shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={deleting}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void deleteSourceAsset(asset);
                  }}
                  title={jobT(spanish, "Delete private photo", "Eliminar foto privada")}
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
                <button
                  aria-pressed={checked}
                  className="absolute inset-x-0 bottom-0 top-[52%] cursor-pointer"
                  disabled={deleting}
                  onClick={() => toggleAsset(asset.id, target)}
                  type="button"
                >
                  <span className="sr-only">{checked ? jobT(spanish, "Deselect", "Quitar seleccion") : jobT(spanish, "Select", "Seleccionar")} {asset.label}</span>
                </button>
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/76 to-transparent p-2 text-white">
                  <span className="block truncate text-xs font-semibold">{asset.label}</span>
                </span>
                <input aria-label={jobT(spanish, `Use ${asset.label}`, `Usar ${asset.label}`)} checked={checked} className="absolute right-2 top-2 z-10 h-4 w-4" disabled={deleting} onChange={() => toggleAsset(asset.id, target)} type="checkbox" />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderPromptBuilderPanel(compact = false) {
    return (
      <div className={`grid gap-4 rounded-[16px] border p-4 ${panelClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${eyebrowClass}`}>
              {jobT(spanish, "Step 03 · Advanced direction", "Paso 03 · Direccion avanzada")}
            </p>
            <h4 className={`mt-2 text-base font-semibold ${textClass}`}>{jobT(spanish, "Build a clearer image prompt", "Construye un prompt mas claro")}</h4>
            <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>
              {jobT(spanish, "Choose a shot plan or write your own note. We combine this with the selected package prompt and source photos.", "Elige un plan visual o escribe tu nota. Lo combinamos con el paquete seleccionado y las fotos fuente.")}
            </p>
          </div>
          <WandSparkles className={`h-5 w-5 shrink-0 ${light ? "text-[#c65f32]" : "text-[#31d4ff]"}`} strokeWidth={1.8} />
        </div>
        <div className={compact ? "grid gap-3" : "grid gap-3 md:grid-cols-2 xl:grid-cols-4"}>
          {selectedPromptBuilderGroups.map((group) => (
            <div className={`rounded-[14px] border p-3 ${subtlePanelClass}`} key={group.id}>
              <div className="flex items-center gap-2">
                {group.id === "shot" ? <Camera className="h-4 w-4 text-[#31d4ff]" strokeWidth={1.8} /> : null}
                {group.id === "scene" ? <MapPin className="h-4 w-4 text-[#75d89a]" strokeWidth={1.8} /> : null}
                {group.id === "lighting" ? <Lightbulb className="h-4 w-4 text-[#ffd166]" strokeWidth={1.8} /> : null}
                {group.id === "finish" ? <Sparkles className="h-4 w-4 text-[#ff5ebd]" strokeWidth={1.8} /> : null}
                <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${eyebrowClass}`}>{spanish ? group.spanishLabel : group.label}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(spanish ? group.spanishOptions : group.options).map((option, index) => {
                  const canonicalOption = group.options[index] ?? option;
                  const active = promptBuilderSelections[group.id] === canonicalOption;
                  return (
                    <button
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                        active
                          ? (light ? "border-[#ff8a5c] bg-[#fff1e7] text-[#b9542d]" : "border-white bg-white text-[#14161a]")
                          : (light ? "border-[#dfd3c4] bg-white text-[#706961] hover:border-[#bcae9f] hover:text-[#171514]" : "border-white/10 bg-white/[0.05] text-white/62 hover:bg-white/[0.09] hover:text-white")
                      }`}
                      key={canonicalOption}
                      onClick={() => setPromptBuilderOption(group.id, canonicalOption)}
                      type="button"
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <label className={`grid gap-2 text-sm font-medium ${textClass}`}>
          {jobT(spanish, "Your creative direction", "Tu direccion creativa")}
          <textarea
            className={`${compact ? "min-h-[96px]" : "min-h-[118px]"} rounded-[14px] border px-4 py-3 ${fieldClass}`}
            onChange={(event) => {
              setPackagePromptDraft(event.target.value);
              if (createMode === "tool") updateField(TOOL_PROMPT_FIELD_ID, event.target.value);
            }}
            placeholder={jobT(spanish, "Example: waist-up portrait, basketball court energy, natural motion, sharp face detail, soft background depth.", "Ejemplo: retrato medio, energia de cancha, movimiento natural, rostro nitido, fondo suave.")}
            value={packagePromptDraft}
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`text-xs leading-5 ${mutedClass}`}>
            {promptBuilderSummary
              ? promptBuilderApplied
                ? jobT(spanish, `Applied prompt cues: ${promptBuilderSummary}`, `Senales aplicadas: ${promptBuilderSummary}`)
                : jobT(spanish, `Selected prompt cues: ${promptBuilderSummary}`, `Senales seleccionadas: ${promptBuilderSummary}`)
              : jobT(spanish, "Use the chips for fast structure, then edit the final text freely.", "Usa los chips para estructurar rapido y edita el texto final libremente.")}
          </p>
          <button
            className={`inline-flex items-center justify-center gap-2 rounded-[14px] border px-4 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
              light ? "border-[#dfd3c4] bg-white text-[#706961] hover:border-[#bcae9f] hover:text-[#171514]" : "border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/[0.1] hover:text-white"
            }`}
            disabled={!promptBuilderSummary || promptBuilderApplied}
            onClick={applyPromptBuilderDirection}
            type="button"
          >
            <WandSparkles className="h-4 w-4" strokeWidth={1.8} />
            {promptBuilderApplied ? jobT(spanish, "Cues applied", "Senales aplicadas") : jobT(spanish, "Apply cues", "Aplicar senales")}
          </button>
        </div>
      </div>
    );
  }

  if (!siteAiApps.length) {
    return (
      <div className={`rounded-[20px] border border-dashed p-5 text-sm ${light ? "border-[#d8cab9] bg-[#fffaf3] text-[#706961]" : "border-white/12 bg-white/[0.03] text-white/68"}`}>
        <p className={`font-semibold ${textClass}`}>{emptyTitle}</p>
        <p className="mt-2 leading-6">{emptyBody}</p>
      </div>
    );
  }

  return (
    <DreamshootShowcasePreview>
    <form className="grid gap-5" onSubmit={createJob}>
      <div className="grid gap-5">
        <div className="grid gap-3">
        {operationContext?.action || operationContext?.note ? (
          <div className={`rounded-[16px] border p-4 ${light ? "border-[#eadfce] bg-[#fffaf3]" : "border-[#31d4ff]/35 bg-[#31d4ff]/8"}`}>
            <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${eyebrowClass}`}>{jobT(spanish, "Applied workspace action", "Accion aplicada del espacio")}</p>
            <p className={`mt-2 text-sm font-semibold ${textClass}`}>{operationContext.action ?? jobT(spanish, "Custom operation", "Operacion personalizada")}</p>
            {operationContext.source ? <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>{operationContext.source}</p> : null}
            {operationContext.note ? (
              <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>{operationContext.note}</p>
            ) : (
              <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>{jobT(spanish, "Choose a package or tool using the operation selected in the left panel.", "Elige un paquete o herramienta con la operacion seleccionada en el panel izquierdo.")}</p>
            )}
          </div>
        ) : null}
        <div>
          <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${eyebrowClass}`}>{jobT(spanish, "Step 01", "Paso 01")}</p>
          <h3 className={`mt-2 text-xl font-semibold ${textClass}`}>{createMode === "theme" ? jobT(spanish, "Choose a photo package", "Elige un paquete de fotos") : jobT(spanish, "Choose a tool", "Elige una herramienta")}</h3>
          <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>
            {createMode === "theme"
              ? jobT(spanish, "Photo packages set the style direction, estimated outputs, credit use, and selfie needs before you upload or select images.", "Los paquetes definen estilo, resultados estimados, uso de creditos y selfies necesarias antes de subir o elegir imagenes.")
              : jobT(spanish, "Tools use your selfies and notes to create a focused private result.", "Las herramientas usan tus selfies y notas para crear un resultado privado concreto.")}
          </p>
        </div>
        <div className={`inline-flex w-fit max-w-full rounded-full border p-1 text-xs font-semibold ${light ? "border-[#dfd3c4] bg-[#f8f1e6]" : "border-white/10 bg-white/[0.04]"}`}>
          {[
            { mode: "theme" as const, label: jobT(spanish, "Photo packages", "Paquetes de fotos") },
            { mode: "tool" as const, label: jobT(spanish, "Tools", "Herramientas") }
          ].map((item) => {
            const active = createMode === item.mode;
            return (
              <button
                className={`rounded-full px-4 py-2 transition ${
                  active ? (light ? "bg-[linear-gradient(135deg,#ff8a5c_0%,#ec4bdd_55%,#16dcf0_100%)] text-white shadow-[0_10px_26px_-20px_rgba(236,75,221,0.75)]" : "bg-white text-[#14161a]") : (light ? "text-[#706961] hover:bg-white hover:text-[#171514] disabled:pointer-events-none disabled:opacity-40" : "text-white/64 hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-40")
                }`}
                disabled={item.mode === "theme" ? !orderedActiveCreativePacks.length : !toolPresets.length}
                key={item.mode}
                onClick={() => {
                  if (item.mode === "theme") {
                    const nextPack = orderedActiveCreativePacks.find((pack) => pack.id === creativePackId) ?? visibleCreativePacks[0] ?? orderedActiveCreativePacks[0];
                    updateCreateMode("theme");
                    if (nextPack) updateCreativePack(nextPack);
                    return;
                  }
                  updateCreateMode("tool");
                  const nextPreset = toolPresets.find((preset) => preset.id === selectedToolId) ?? toolPresets[0];
                  if (nextPreset) updateToolPreset(nextPreset);
                }}
                type="button"
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {createMode === "theme" && packageMegaGroups.length > 1 ? (
          <div className={`rounded-[18px] border p-2 ${light ? "border-[#eadfce] bg-[#fffaf3]" : "border-white/10 bg-black/10"}`}>
            <div className="flex flex-wrap gap-2">
            {displayedCategoryOptions.map((category) => {
              const active = themeCategory === category.slug;
              return (
                <button
                  aria-label={`${category.label}: ${category.themeCount} ${jobT(spanish, "themes", "temas")}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    active ? (light ? "border-[#ff8a5c] bg-[#fff1e7] text-[#b9542d] shadow-[0_10px_28px_-22px_rgba(255,138,92,0.8)]" : "border-white bg-white text-[#14161a]") : (light ? "border-[#dfd3c4] bg-white text-[#706961] hover:border-[#bcae9f] hover:text-[#171514]" : "border-white/10 bg-white/[0.04] text-white/68 hover:text-white")
                  }`}
                  data-workspace-package-category-count={category.themeCount}
                  data-workspace-package-category-option={category.slug}
                  key={category.slug}
                  onClick={() => updateThemeCategory(category.slug)}
                  type="button"
                >
                  <span>{category.label}</span>
                  <span className="shrink-0 rounded-full bg-current/10 px-1.5 py-0.5 text-[10px] leading-none opacity-75">{category.themeCount}</span>
                </button>
              );
            })}
            {hasMoreCategories ? (
              <button
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${light ? "border-[#dfd3c4] bg-white text-[#706961] hover:border-[#bcae9f] hover:text-[#171514]" : "border-white/10 bg-white/[0.04] text-white/68 hover:text-white"}`}
                onClick={() => setShowAllCategories((current) => !current)}
                type="button"
              >
                {showAllCategories ? jobT(spanish, "Show less", "Mostrar menos") : jobT(spanish, `View ${categoryOptions.length - displayedCategoryOptions.length} more`, `Ver ${categoryOptions.length - displayedCategoryOptions.length} mas`)}
              </button>
            ) : null}
            </div>
          </div>
        ) : null}
        <div
          className={`grid scroll-mt-28 overflow-hidden rounded-[18px] border ${light ? "border-[#eadfce] bg-white" : "border-white/10 bg-black/20"} ${createMode === "theme" ? "items-start lg:grid-cols-[minmax(360px,1.25fr)_minmax(320px,0.75fr)]" : ""}`}
          id="workspace-package-detail"
          ref={packageDetailRef}
        >
          {createMode === "theme" ? (
            <div className={`relative aspect-[4/3] min-h-[260px] w-full self-start ${light ? "bg-[#f7f0e7]" : "bg-white/[0.04]"}`}>
              {selectionPreviewImage ? (
                <img alt={selectionTitle} className="absolute inset-0 h-full w-full cursor-zoom-in object-contain" data-workspace-selected-package-image="true" src={selectionPreviewImage} {...previewImageAttrs(selectionPreviewImage, selectionTitle, jobT(spanish, "Selected package", "Paquete seleccionado"))} />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <Sparkles className="h-8 w-8 opacity-60" strokeWidth={1.8} />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">{jobT(spanish, "Current selection", "Seleccion actual")}</p>
                <p className="mt-2 text-lg font-semibold leading-tight">{selectionTitle}</p>
              </div>
            </div>
          ) : null}
          <div className="grid content-between gap-5 p-4">
            <div>
              <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${eyebrowClass}`}>{createMode === "theme" ? jobT(spanish, "Selected package", "Paquete seleccionado") : jobT(spanish, "Selected tool", "Herramienta seleccionada")}</p>
              <h4 className={`mt-3 text-xl font-semibold ${textClass}`}>{selectionTitle}</h4>
              <p className={`mt-3 text-sm leading-6 ${mutedClass}`}>{selectionDescription}</p>
              {createMode === "tool" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${neutralPillClass}`}>{selectedToolPreset?.category ?? jobT(spanish, "Tool", "Herramienta")}</span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${neutralPillClass}`}>{selectedToolIsVideo ? jobT(spanish, "Image to Video workspace", "Espacio Image to Video") : selectedApp?.aiApp.name ?? jobT(spanish, "AI tool", "Herramienta IA")}</span>
                </div>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className={`rounded-[14px] border p-3 ${subtlePanelClass}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}>{jobT(spanish, "Required credits", "Creditos requeridos")}</p>
                <p className={`mt-2 text-xl font-semibold ${textClass}`}>{selectionCreditCost}</p>
                <p className={`mt-1 text-[11px] leading-4 ${mutedClass}`}>{selectionUnitCostLabel}</p>
              </div>
              <div className={`rounded-[14px] border p-3 ${subtlePanelClass}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}>{jobT(spanish, "Selfies", "Selfies")}</p>
                <p className={`mt-2 text-xl font-semibold ${textClass}`}>{selectedRequestAssetIds.length}/{effectiveMaxAssets}</p>
              </div>
              <div className={`rounded-[14px] border p-3 ${subtlePanelClass}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}>{jobT(spanish, "Output", "Resultado")}</p>
                <p className={`mt-2 text-xl font-semibold ${textClass}`}>{selectionOutputLabel}</p>
              </div>
            </div>
            <p className={`text-xs leading-5 ${mutedClass}`}>{creditsUsageNote}</p>
            {subscriptionGateMessage ? (
              <div className={`rounded-[12px] border px-3 py-2 text-xs leading-5 ${subscriptionGateClass}`} role={subscriptionHardGate ? "alert" : "status"}>
                <span>{subscriptionGateMessage}</span>
                {subscriptionHardGate ? (
                  <a className="ml-2 inline-flex font-semibold underline underline-offset-4" href={pricingHref}>
                    {jobT(spanish, "Choose a plan", "Elegir plan")}
                  </a>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                className={`inline-flex items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-xs font-semibold transition active:scale-[0.98] ${primaryButtonClass}`}
                onClick={openPackageDialog}
                type="button"
              >
                {configureSelectionLabel}
                <Play className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <button
                className={`inline-flex items-center justify-center gap-2 rounded-[14px] border px-4 py-2.5 text-xs font-semibold transition ${
                  light ? "border-[#dfd3c4] bg-white text-[#706961] hover:border-[#bcae9f] hover:text-[#171514]" : "border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/[0.1] hover:text-white"
                }`}
                onClick={openPackageDialog}
                type="button"
              >
                {jobT(spanish, "Review and start", "Revisar e iniciar")}
              </button>
            </div>
          </div>
        </div>
        {createMode === "theme" && selectedPackageGalleryExamples.length ? (
          <div className={`grid gap-4 rounded-[18px] border p-4 ${subtlePanelClass}`} data-workspace-package-gallery="true">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${eyebrowClass}`}>{jobT(spanish, "Case gallery", "Galeria de ejemplos")}</p>
                <h3 className={`mt-2 text-lg font-semibold leading-tight ${textClass}`}>
                  {jobT(spanish, `${selectedPackageGalleryExamples.length} ${selectionTitle} image examples`, `${selectedPackageGalleryExamples.length} ejemplos de ${selectionTitle}`)}
                </h3>
              </div>
              <p className={`max-w-2xl text-xs leading-5 ${mutedClass}`}>
                {jobT(spanish, "Review the package examples before configuring the request. Click any example to view it full screen.", "Revisa los ejemplos del paquete antes de configurar la solicitud. Haz clic en cualquier ejemplo para verlo en pantalla completa.")}
              </p>
            </div>
            <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {selectedPackageGalleryExamples.map((example, index) => (
                <figure
                  className={`group overflow-hidden rounded-[14px] border ${light ? "border-[#eadfce] bg-white" : "border-white/10 bg-black/20"}`}
                  key={`${example.src}_${index}`}
                >
                  <div className="relative aspect-square overflow-hidden bg-white/[0.08]">
                    <img
                      alt={example.alt}
                      className="h-full w-full cursor-zoom-in object-contain transition duration-500 group-hover:brightness-110"
                      data-workspace-package-gallery-image="true"
                      decoding="async"
                      fetchPriority={index < 4 ? "auto" : "low"}
                      loading={index < 4 ? "eager" : "lazy"}
                      sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 16rem"
                      src={example.src}
                      {...previewImageAttrs(example.src, example.alt, jobT(spanish, "Package gallery example", "Ejemplo de galeria"))}
                    />
                    <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/58 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/82">
                      {jobT(spanish, `Example ${String(index + 1).padStart(2, "0")}`, `Ejemplo ${String(index + 1).padStart(2, "0")}`)}
                    </span>
                  </div>
                </figure>
              ))}
            </div>
          </div>
        ) : null}
        <div className={createMode === "theme" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"}>
          {createMode === "theme" ? displayedCreativePacks.map((pack) => {
            const active = pack.id === selectedPack?.id;
            const packageCardTitle = workspacePackageLabel(pack, packageMegaGroups);
            const packageCardHref = workspacePackageHref(pack, packageMegaGroups);
            const packageCardCopy = pack.description.trim() || (pack.headline.trim() !== packageCardTitle.trim() ? pack.headline.trim() : "");
            const packageCardImage = withStorefrontPublicWatermarkUrl(pack.imageUrl);
            return (
              <button
                aria-label={packageCardCopy ? `${packageCardTitle}. ${packageCardCopy}` : packageCardTitle}
                className={`grid min-h-[268px] content-start gap-3 rounded-[16px] border p-3 text-left transition hover:-translate-y-0.5 ${
                  active ? selectedCardClass : neutralCardClass
                }`}
                data-workspace-package-href={packageCardHref}
                data-workspace-package-option={pack.id}
                data-workspace-package-title={packageCardTitle}
                key={pack.id}
                onClick={() => selectCreativePackAndReveal(pack)}
                type="button"
              >
                <span className="overflow-hidden rounded-[12px] bg-white/[0.08]" data-dreamshoot-preview-disabled="true">
                  {packageCardImage ? (
                    <img className="aspect-[4/3] w-full object-cover" src={packageCardImage} alt={packageCardTitle} />
                  ) : (
                    <span className="flex aspect-[4/3] items-center justify-center">
                      <Sparkles className="h-6 w-6 opacity-60" strokeWidth={1.8} />
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-base font-semibold leading-5">{packageCardTitle}</span>
                      {packageCardCopy ? (
                        <span
                          aria-label={packageCardCopy}
                          className={active ? "mt-2 block text-sm leading-5 text-[#5f5a54]" : `mt-2 block text-sm leading-5 ${mutedClass}`}
                          style={THREE_LINE_CLAMP_STYLE}
                          title={packageCardCopy}
                        >
                          {packageCardCopy}
                        </span>
                      ) : null}
                    </span>
                    {active ? <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={1.8} /> : null}
                  </span>
                  <span className="mt-3 flex flex-wrap gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? selectedPillClass : neutralPillClass}`}>
                      {jobT(spanish, `${pack.creditCost} credits per image`, `${pack.creditCost} creditos por imagen`)}
                    </span>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? selectedSoftPillClass : neutralPillClass}`}>
                      {jobT(spanish, `${pack.outputCount} outputs`, `${pack.outputCount} resultados`)}
                    </span>
                  </span>
                </span>
              </button>
            );
          }) : displayedToolPresets.map((preset) => {
            const active = preset.id === selectedToolId;
            const presetIsVideo = preset.kind === "video";
            const presetCreditCost = preset.creditCost ?? selectedApp?.creditCost ?? 0;
            return (
              <button
                className={`grid min-h-[188px] content-start gap-3 rounded-[16px] border p-4 text-left transition hover:-translate-y-0.5 ${
                  active ? selectedCardClass : neutralCardClass
                }`}
                data-workspace-tool-href={preset.href ?? ""}
                data-workspace-tool-kind={preset.kind ?? "photo"}
                data-workspace-tool-option={preset.id}
                data-workspace-tool-title={preset.title}
                key={preset.id}
                onClick={() => selectToolPresetAndOpen(preset)}
                type="button"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-base font-semibold leading-5">{preset.title}</span>
                    <span
                      aria-label={preset.description}
                      className={active ? "mt-2 block text-sm leading-6 text-[#5f5a54]" : `mt-2 block text-sm leading-6 ${mutedClass}`}
                      style={FOUR_LINE_CLAMP_STYLE}
                      title={preset.description}
                    >
                      {preset.description}
                    </span>
                  </span>
                  {active ? <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={1.8} /> : null}
                </span>
                <span className="mt-1 flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? selectedSoftPillClass : neutralPillClass}`}>
                    {preset.category}
                  </span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? selectedPillClass : neutralPillClass}`}>
                    {presetIsVideo ? jobT(spanish, "Video workspace", "Espacio de video") : jobT(spanish, `${presetCreditCost} credits`, `${presetCreditCost} creditos`)}
                  </span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? selectedSoftPillClass : neutralPillClass}`}>
                    {presetIsVideo ? jobT(spanish, "Image to Video", "Image to Video") : jobT(spanish, "Tool result", "Resultado de herramienta")}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {hiddenOptionCount > 0 || showAllOptions ? (
          <div className="flex justify-center">
            <button
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${light ? "border-[#dfd3c4] bg-white text-[#706961] hover:border-[#bcae9f] hover:text-[#171514]" : "border-white/10 bg-white/[0.04] text-white/68 hover:border-white/24 hover:text-white"}`}
              onClick={() => setShowAllOptions((current) => !current)}
              type="button"
            >
              {showAllOptions
                ? jobT(spanish, "Show fewer options", "Mostrar menos opciones")
                : jobT(spanish, `View ${hiddenOptionCount} more ${createMode === "theme" ? "packages" : "tools"}`, `Ver ${hiddenOptionCount} ${createMode === "theme" ? "paquetes" : "herramientas"} mas`)}
            </button>
          </div>
        ) : null}
      </div>
      <div className={`grid gap-4 rounded-[16px] border p-4 ${panelClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${eyebrowClass}`}>{jobT(spanish, "Request setup", "Configuracion")}</p>
            <h4 className={`mt-2 text-base font-semibold ${textClass}`}>
              {createMode === "theme" ? jobT(spanish, "Confirm the package rules before uploading selfies.", "Confirma las reglas del paquete antes de subir selfies.") : jobT(spanish, "Confirm the tool rules before uploading selfies.", "Confirma las reglas de la herramienta antes de subir selfies.")}
            </h4>
          </div>
          {createMode === "theme" ? (
            <label className={`grid min-w-[150px] gap-2 text-sm font-medium ${textClass}`}>
              {jobT(spanish, "Estimated outputs", "Resultados estimados")}
              <input
                className={`rounded-[14px] border px-4 py-2.5 ${fieldClass}`}
                min={1}
                onBlur={commitThemeOutputCountDraft}
                onChange={(event) => updateThemeOutputCountDraft(event.target.value)}
                type="number"
                value={themeOutputCountDraft}
              />
            </label>
          ) : null}
        </div>
        {createMode === "theme" && selectedPack ? (
          <div className={`rounded-[14px] border p-3 ${subtlePanelClass}`}>
            <p className={`text-sm font-semibold ${textClass}`}>{selectedPack.name}</p>
            <p className={`mt-1 text-sm leading-6 ${mutedClass}`}>{selectedPack.description || selectedPack.headline}</p>
          </div>
        ) : null}
        <div className="grid gap-2 md:grid-cols-2">
          {materialRules.map((rule) => (
            <div className={`flex gap-2 text-sm leading-6 ${light ? "text-[#625d56]" : "text-white/68"}`} key={rule}>
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#75d89a]" strokeWidth={1.8} />
              <span>{displayMaterialRule(rule, spanish)}</span>
            </div>
          ))}
        </div>
        <p className={`text-xs leading-5 ${light ? "text-[#776f66]" : "text-white/52"}`}>
          {createMode === "theme"
            ? jobT(spanish, `Default is ${DEFAULT_THEME_OUTPUT_COUNT} image. Adjust this number if you want a different delivery estimate.`, `El valor predeterminado es ${DEFAULT_THEME_OUTPUT_COUNT} imagen. Ajusta el numero si quieres otra estimacion.`)
            : jobT(spanish, "Tool requests use one focused result type. Add clear notes and selected selfies before review.", "Las herramientas usan un resultado concreto. Anade notas claras y selfies seleccionadas antes de revisar.")}
        </p>
      </div>
      {renderPromptBuilderPanel()}
      {createMode === "tool" ? (
      <div className="grid gap-4 md:grid-cols-2">
        {modeFields.filter((field) => field.id !== TOOL_PROMPT_FIELD_ID).map((field) => (
          <label className={`grid gap-2 text-sm font-medium ${textClass}`} key={field.id}>
            {field.label}
            {field.type === "select" || field.type === "radio" ? (
              <select
                className={`rounded-[18px] border px-4 py-3 ${fieldClass}`}
                onChange={(event) => updateField(field.id, event.target.value)}
                value={String(formValues[field.id] ?? field.options[0]?.value ?? "")}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                className={`min-h-[104px] rounded-[18px] border px-4 py-3 ${fieldClass}`}
                onChange={(event) => updateField(field.id, event.target.value)}
                placeholder={field.placeholder ?? field.label}
                value={String(formValues[field.id] ?? "")}
              />
            ) : field.type === "number" ? (
              <input
                className={`rounded-[18px] border px-4 py-3 ${fieldClass}`}
                max={field.max}
                min={field.min}
                onChange={(event) => updateField(field.id, Number(event.target.value))}
                step={field.step}
                type="number"
                value={Number(formValues[field.id] ?? field.min ?? 0)}
              />
            ) : field.type === "boolean" ? (
              <span className={`inline-flex items-center gap-2 rounded-[18px] border px-4 py-3 ${fieldClass}`}>
                <input checked={Boolean(formValues[field.id])} onChange={(event) => updateField(field.id, event.target.checked)} type="checkbox" />
                <span>{field.helpText ?? jobT(spanish, "Enabled", "Activado")}</span>
              </span>
            ) : field.type === "text" ? (
              <input
                className={`rounded-[18px] border px-4 py-3 ${fieldClass}`}
                onChange={(event) => updateField(field.id, event.target.value)}
                placeholder={field.placeholder ?? field.label}
                value={String(formValues[field.id] ?? "")}
              />
            ) : null}
            {field.helpText ? <span className={`text-xs leading-5 ${light ? "text-[#776f66]" : "text-white/52"}`}>{field.helpText}</span> : null}
          </label>
        ))}
      </div>
      ) : null}
      <div className="sr-only" id="source-photos">
        <input
          accept="image/*"
          multiple
          onChange={(event) => {
            void uploadSourceFiles(event.target.files);
            event.target.value = "";
          }}
          ref={sourceUploadInputRef}
          type="file"
        />
      </div>
      <div className="hidden" id="legacy-source-photos">
        <div>
          <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${eyebrowClass}`}>{jobT(spanish, "Step 02 · Private model", "Paso 02 · Modelo privado")}</p>
          <h3 className={`mt-2 text-xl font-semibold ${textClass}`}>{jobT(spanish, "Upload selfies for your private model", "Sube selfies para tu modelo privado")}</h3>
          <p className={`mt-2 text-sm leading-6 ${light ? "text-[#625d56]" : "text-white/68"}`}>
            {jobT(spanish, `Add at least one clear selfie or reference photo. Each request can use up to ${effectiveMaxAssets} photos inside this signed-in workspace.`, `Anade al menos una selfie clara o foto de referencia. Cada solicitud puede usar hasta ${effectiveMaxAssets} fotos dentro de este espacio.`)}
          </p>
          <label className={`mt-3 inline-flex cursor-pointer items-center gap-2 rounded-[14px] px-4 py-2 text-xs font-semibold active:scale-[0.98] ${primaryButtonClass} ${uploadingSources ? "pointer-events-none opacity-55" : ""}`}>
            <UploadCloud className="h-4 w-4" strokeWidth={1.8} />
            {uploadingSources ? jobT(spanish, "Uploading selfies", "Subiendo selfies") : jobT(spanish, "Upload selfies in batch", "Subir selfies en lote")}
            <input
              accept="image/*"
              className="sr-only"
              multiple
              onChange={(event) => {
                void uploadSourceFiles(event.target.files);
                event.target.value = "";
              }}
              type="file"
            />
          </label>
          <p className={`mt-2 text-xs leading-5 ${light ? "text-[#776f66]" : "text-white/52"}`}>
            {jobT(spanish, "Select multiple image files at once. Uploaded photos appear below for browsing, selection, and removal before generation.", "Selecciona varias imagenes a la vez. Las fotos subidas aparecen abajo para revisar, seleccionar y eliminar antes de generar.")}
          </p>
        </div>
        {sourceAssets.length ? (
          <div className="grid gap-3">
            {isCoupleFlow ? (
              <>
                {renderPhotoPicker(jobT(spanish, "Your photos", "Tus fotos"), jobT(spanish, `Select photos for the primary person. Use 1-${effectiveMaxAssets} photos for this request.`, `Selecciona fotos de la persona principal. Usa 1-${effectiveMaxAssets} fotos para esta solicitud.`), "primary", selectedAssetIds)}
                {renderPhotoPicker(jobT(spanish, "Partner photos", "Fotos de pareja"), jobT(spanish, "Select photos for the partner. These are combined with your photos before generation.", "Selecciona fotos de la pareja. Se combinan con tus fotos antes de generar."), "partner", partnerSelectedAssetIds)}
              </>
            ) : (
              renderPhotoPicker(jobT(spanish, "Browse uploaded photos", "Explorar fotos subidas"), jobT(spanish, `${sourceAssets.length} private photos are ready. Select 1-${effectiveMaxAssets} images that should drive this request.`, `${sourceAssets.length} fotos privadas listas. Selecciona 1-${effectiveMaxAssets} imagenes que guiaran esta solicitud.`), "primary", selectedAssetIds)
            )}
          </div>
        ) : loadingAssets ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6" aria-busy="true" aria-label={jobT(spanish, "Loading private photos", "Cargando fotos privadas")}>
            {[0, 1, 2, 3].map((item) => (
              <div className={`overflow-hidden rounded-[14px] border ${light ? "border-[#eadfce] bg-white" : "border-white/10 bg-black/18"}`} key={item}>
                <div className={`aspect-[4/5] animate-pulse ${light ? "bg-[#f1eadf]" : "bg-white/[0.07]"}`} />
                <div className="p-2">
                  <div className={`h-3 w-20 rounded-full ${light ? "bg-[#eadfce]" : "bg-white/[0.08]"}`} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`rounded-[18px] border border-dashed p-4 text-sm leading-6 ${light ? "border-[#d8cab9] bg-[#fffaf3] text-[#706961]" : "border-white/12 bg-black/16 text-white/68"}`}>
            <p>{jobT(spanish, "No selfies are ready yet. Upload private photos here to keep this request in one flow.", "Aun no hay selfies listas. Sube fotos privadas aqui para mantener la solicitud en un solo flujo.")}</p>
            <p className={`mt-3 text-xs leading-5 ${light ? "text-[#776f66]" : "text-white/52"}`}>
              {jobT(spanish, "Use the Upload selfies button above to stay in this generation flow.", "Usa el boton de subir selfies de arriba para seguir en este flujo.")}
            </p>
          </div>
        )}
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-[16px] border p-4 ${subtlePanelClass}`}>
          <div>
            <p className={`text-sm font-semibold ${textClass}`}>{jobT(spanish, "Selected model photos", "Fotos seleccionadas del modelo")}</p>
            <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>
              {jobT(spanish, `${selectedRequestAssetIds.length} selected, ${minAssets} required, up to ${effectiveMaxAssets} for this request.`, `${selectedRequestAssetIds.length} seleccionadas, ${minAssets} requeridas, hasta ${effectiveMaxAssets} para esta solicitud.`)}
            </p>
          </div>
          <button
            className={`inline-flex items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-xs font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${primaryButtonClass}`}
            disabled={selectedRequestAssetIds.length > effectiveMaxAssets}
            onClick={reviewCurrentRequest}
            type="button"
          >
            {jobT(spanish, "Continue to review", "Continuar a revision")}
          </button>
        </div>
      </div>
      <div className="hidden" id="review-current-request">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${eyebrowClass}`}>{jobT(spanish, "Step 03 · Confirm package", "Paso 03 · Confirmar paquete")}</p>
            <h3 className={`mt-2 text-xl font-semibold ${textClass}`}>{jobT(spanish, "Choose model, audience, credits, then generate.", "Elige modelo, audiencia y creditos, luego genera.")}</h3>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${mutedClass}`}>
              {jobT(spanish, "Match the target Studio flow: select the model that should drive this request, choose who the package is for, confirm credits and outputs, then start generation.", "Sigue el flujo del estudio: selecciona el modelo, define para quien es el paquete, confirma creditos y resultados, y empieza a generar.")}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${light ? "border-[#eadfce] bg-[#fffaf3] text-[#625d56]" : "border-white/10 bg-white/[0.05] text-white/62"}`}>
            {jobT(spanish, `${customer.balance.available} credits available`, `${customer.balance.available} creditos disponibles`)}
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(340px,0.75fr)]">
          <div className={`grid gap-4 rounded-[16px] border p-4 ${subtlePanelClass}`}>
            <div>
              <p className={`text-sm font-semibold ${textClass}`}>{jobT(spanish, "Select your model", "Selecciona tu modelo")}</p>
              <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>
                {jobT(spanish, "Use a trained model when available, or continue with the uploaded selfies selected in this request.", "Usa un modelo entrenado si esta disponible o continua con las selfies seleccionadas en esta solicitud.")}
              </p>
            </div>
            {customerModels.length ? (
              <select
                className={`rounded-[14px] border px-4 py-3 text-sm ${fieldClass}`}
                onChange={(event) => setSelectedCustomerModelId(event.target.value)}
                value={selectedCustomerModelId}
              >
                {customerModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label} · {statusLabel(model.status, spanish)} · {model.inputAssetCount}/{model.minInputAssets} {jobT(spanish, "photos", "fotos")}
                  </option>
                ))}
              </select>
            ) : (
              <div className={`rounded-[14px] border border-dashed p-3 text-sm leading-6 ${light ? "border-[#d8cab9] bg-white text-[#706961]" : "border-white/12 bg-black/18 text-white/64"}`}>
                {jobT(spanish, "No trained model is ready yet. This request will use the selected private selfies.", "Aun no hay modelo entrenado listo. Esta solicitud usara las selfies privadas seleccionadas.")}
              </div>
            )}
            <div>
              <p className={`text-sm font-semibold ${textClass}`}>{jobT(spanish, "Subject focus", "Enfoque del sujeto")}</p>
              <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>
                {jobT(spanish, "Choose whether the result should center on you, your partner, or both.", "Elige si el resultado debe centrarse en ti, en tu pareja o en ambos.")}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {packageAudienceOptions.map((option) => {
                const active = packageAudience === option.id;
                return (
                  <button
                    className={`min-h-[104px] rounded-[14px] border p-3 text-left transition ${
                      active ? selectedCardClass : neutralCardClass
                    }`}
                    key={option.id}
                    onClick={() => setPackageAudience(option.id)}
                    type="button"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold">{option.title}</span>
                      {active ? <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.8} /> : null}
                    </span>
                    <span className={`mt-2 block text-xs leading-5 ${active ? (light ? "text-[#5f5a54]" : "text-[#30343a]") : mutedClass}`}>
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
            {selectedSourceAssets.length ? (
              <div className="grid gap-2">
                <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}>{jobT(spanish, "Selected selfies", "Selfies seleccionadas")}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {selectedSourceAssets.slice(0, 10).map((asset) => (
                    <div className={`overflow-hidden rounded-[12px] border ${light ? "border-[#eadfce] bg-white" : "border-white/10 bg-black/18"}`} key={asset.id}>
                      <img alt={asset.label} className="aspect-[4/5] w-full cursor-zoom-in object-cover" src={asset.previewUrl} {...previewImageAttrs(asset.previewUrl, asset.label, jobT(spanish, "Selected selfie", "Selfie seleccionada"))} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className={`grid content-between gap-4 rounded-[16px] border p-4 ${light ? "border-[#eadfce] bg-white" : "border-white/10 bg-black/24"}`}>
            <div className="grid gap-3">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}>{createMode === "theme" ? jobT(spanish, "Package", "Paquete") : jobT(spanish, "Tool", "Herramienta")}</p>
                <p className={`mt-2 text-lg font-semibold ${textClass}`}>{selectionTitle}</p>
                <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>{selectionDescription}</p>
              </div>
                {[
                  { label: jobT(spanish, "Model", "Modelo"), value: selectedModelLabel },
                  { label: jobT(spanish, "Subject focus", "Enfoque del sujeto"), value: packageAudienceOptions.find((option) => option.id === packageAudience)?.title ?? jobT(spanish, "For Myself", "Para mi") },
                  { label: jobT(spanish, "Selfies", "Selfies"), value: jobT(spanish, `${selectedRequestAssetIds.length}/${effectiveMaxAssets} selected`, `${selectedRequestAssetIds.length}/${effectiveMaxAssets} seleccionadas`) },
                  { label: jobT(spanish, "Required credits", "Creditos requeridos"), value: `${selectionCreditCost}` },
                  { label: createMode === "theme" ? jobT(spanish, "Price per image", "Precio por imagen") : selectedToolIsVideo ? jobT(spanish, "Workspace", "Espacio") : jobT(spanish, "Price per request", "Precio por solicitud"), value: selectedToolIsVideo ? jobT(spanish, "Image to Video", "Image to Video") : `${unitCreditCost}` },
                  { label: jobT(spanish, "Output", "Resultado"), value: createMode === "theme" ? imageCountLabel(requestOutputCount, spanish) : selectionOutputLabel }
                ].map((item) => (
                <div className={`flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2 ${subtlePanelClass}`} key={item.label}>
                  <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${eyebrowClass}`}>{item.label}</span>
                  <span className={`max-w-[58%] truncate text-right text-sm font-semibold ${textClass}`}>{item.value}</span>
                </div>
              ))}
              <p className={`text-xs leading-5 ${mutedClass}`}>{creditsUsageNote}</p>
              {operationContext?.action || operationContext?.note ? (
                <div className={`rounded-[12px] border p-3 ${subtlePanelClass}`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}>{jobT(spanish, "Workspace action", "Accion del espacio")}</p>
                  <p className={`mt-2 text-sm font-semibold ${textClass}`}>{operationContext.action ?? jobT(spanish, "Custom operation", "Operacion personalizada")}</p>
                  {operationContext.note ? <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>{operationContext.note}</p> : null}
                </div>
              ) : null}
            </div>
            <div className="grid gap-3">
              <p className={`text-xs leading-5 ${mutedClass}`}>
                {selectedToolIsVideo
                  ? jobT(spanish, "Open the video workspace to upload frame images and write the motion prompt.", "Abre el espacio de video para subir fotogramas y escribir el prompt de movimiento.")
                  : selectedRequestAssetIds.length > effectiveMaxAssets
                  ? jobT(spanish, `Use up to ${effectiveMaxAssets} private photos before starting.`, `Usa hasta ${effectiveMaxAssets} fotos privadas antes de empezar.`)
                  : sampleRequirementMessage}
              </p>
              {subscriptionGateMessage ? (
                <div className={`rounded-[12px] border px-3 py-2 text-xs leading-5 ${subscriptionGateClass}`} role={subscriptionHardGate ? "alert" : "status"}>
                  <span>{subscriptionGateMessage}</span>
                  {subscriptionHardGate ? (
                    <a className="ml-2 inline-flex font-semibold underline underline-offset-4" href={pricingHref}>
                      {jobT(spanish, "Choose a plan", "Elegir plan")}
                    </a>
                  ) : null}
                </div>
              ) : null}
              <button
                className={`inline-flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${primaryButtonClass}`}
                disabled={pending || !canStartRequest}
                onClick={openPackageDialog}
                type="button"
              >
                <Play className="h-4 w-4" strokeWidth={1.8} />
                {jobT(spanish, "Review and start", "Revisar e iniciar")}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
      {packageDialogOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/72 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={jobT(spanish, "Photo package generation settings", "Ajustes de generacion del paquete")}>
          <div className={`flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[18px] border shadow-[0_30px_100px_-40px_rgba(0,0,0,0.95)] ${light ? "border-[#eadfce] bg-white text-[#171514]" : "border-white/14 bg-[#121821] text-white"}`}>
            <div className={`flex shrink-0 items-start justify-between gap-4 border-b p-5 ${light ? "border-[#eadfce] bg-white" : "border-white/10 bg-[#121821]"}`}>
              <div>
                <p className={`font-mono text-[10px] uppercase tracking-[0.18em] ${eyebrowClass}`}>{createMode === "theme" ? jobT(spanish, "Photo package", "Paquete de fotos") : jobT(spanish, "AI tool", "Herramienta IA")}</p>
                <h3 className={`mt-2 text-2xl font-semibold ${textClass}`}>{selectionTitle}</h3>
              </div>
              <button
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${light ? "border-[#dfd3c4] text-[#706961] hover:bg-[#fffaf3]" : "border-white/12 text-white/64 hover:bg-white/[0.06] hover:text-white"}`}
                onClick={() => setPackageDialogOpen(false)}
                type="button"
              >
                {jobT(spanish, "Close", "Cerrar")}
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-5 pt-4">
              <p className={`text-sm leading-6 ${mutedClass}`}>{selectionDescription}</p>
              <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
                <div className="grid gap-4">
                  <label className={`grid gap-2 text-sm font-medium ${textClass}`}>
                    {jobT(spanish, "Select your model", "Selecciona tu modelo")}
                    {customerModels.length ? (
                      <select
                        className={`rounded-[14px] border px-4 py-3 ${fieldClass}`}
                        onChange={(event) => setSelectedCustomerModelId(event.target.value)}
                        value={selectedCustomerModelId}
                      >
                        {customerModels.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.label} · {statusLabel(model.status, spanish)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`rounded-[14px] border border-dashed p-3 text-sm leading-6 ${light ? "border-[#d8cab9] bg-[#fffaf3] text-[#706961]" : "border-white/12 bg-black/18 text-white/64"}`}>
                        {jobT(spanish, "No trained model is ready yet. This request will use the selected uploaded selfies.", "Aun no hay modelo entrenado listo. Esta solicitud usara las selfies subidas seleccionadas.")}
                      </span>
                    )}
                  </label>

                  <div>
                    <p className={`text-sm font-semibold ${textClass}`}>{jobT(spanish, "Subject focus", "Enfoque del sujeto")}</p>
                    <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>
                      {jobT(spanish, "Choose whether the result should center on you, your partner, or both.", "Elige si el resultado debe centrarse en ti, en tu pareja o en ambos.")}
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {packageAudienceOptions.map((option) => {
                      const active = packageAudience === option.id;
                      return (
                        <button
                          className={`min-h-[112px] rounded-[14px] border p-3 text-left transition ${active ? selectedCardClass : neutralCardClass}`}
                          key={option.id}
                          onClick={() => setPackageAudience(option.id)}
                          type="button"
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold">{option.title}</span>
                            {active ? <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.8} /> : null}
                          </span>
                          <span className={`mt-2 block text-xs leading-5 ${active ? (light ? "text-[#5f5a54]" : "text-[#30343a]") : mutedClass}`}>
                            {option.description}
                          </span>
                          <span className={`mt-2 block text-[11px] leading-4 ${active ? (light ? "text-[#756b63]" : "text-[#4b525c]") : mutedClass}`}>
                            {option.helper}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {createMode === "theme" ? (
                    <label className={`grid gap-2 text-sm font-medium ${textClass}`}>
                      {jobT(spanish, "Estimated outputs", "Resultados estimados")}
                      <input
                        className={`rounded-[14px] border px-4 py-3 ${fieldClass}`}
                        min={1}
                        onBlur={commitThemeOutputCountDraft}
                        onChange={(event) => updateThemeOutputCountDraft(event.target.value)}
                        type="number"
                        value={themeOutputCountDraft}
                      />
                    </label>
                  ) : null}

                  {renderPromptBuilderPanel(true)}

                <div className={`grid gap-3 rounded-[14px] border p-3 ${subtlePanelClass}`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${eyebrowClass}`}>{jobT(spanish, "Selected uploads", "Subidas seleccionadas")}</p>
                  {isCoupleFlow ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { title: jobT(spanish, "Your photos", "Tus fotos"), assets: primarySourceAssets },
                        { title: jobT(spanish, "Partner photos", "Fotos de pareja"), assets: partnerSourceAssets }
                      ].map((group) => (
                        <div key={group.title}>
                          <p className={`text-sm font-semibold ${textClass}`}>{group.title} · {group.assets.length}</p>
                          <div className="mt-2 grid grid-cols-4 gap-2">
                            {group.assets.slice(0, 8).map((asset) => (
                              <img alt={asset.label} className="aspect-square cursor-zoom-in rounded-[8px] object-cover" key={asset.id} src={asset.previewUrl} {...previewImageAttrs(asset.previewUrl, asset.label, group.title)} />
                            ))}
                            {!group.assets.length ? (
                              <span className={`col-span-4 rounded-[8px] border border-dashed px-3 py-4 text-center text-xs leading-5 ${light ? "border-[#d8cab9] text-[#706961]" : "border-white/12 text-white/52"}`}>
                                {jobT(spanish, "Required for Couple mode.", "Obligatorio en modo pareja.")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">
                      {primarySourceAssets.slice(0, 10).map((asset) => (
                        <img alt={asset.label} className="aspect-square cursor-zoom-in rounded-[8px] object-cover" key={asset.id} src={asset.previewUrl} {...previewImageAttrs(asset.previewUrl, asset.label, jobT(spanish, "Selected upload", "Subida seleccionada"))} />
                      ))}
                    </div>
                  )}
                  {!selectedRequestAssetIds.length ? (
                    <p className={`text-xs leading-5 ${mutedClass}`}>{jobT(spanish, `Select at least ${minAssets} private photo, or upload samples from the left panel for stronger results.`, `Selecciona al menos ${minAssets} foto privada o sube muestras desde el panel izquierdo para mejores resultados.`)}</p>
                  ) : null}
                </div>
              </div>

              <div className={`grid content-between gap-4 rounded-[16px] border p-4 ${light ? "border-[#eadfce] bg-[#fffaf3]" : "border-white/10 bg-black/24"}`}>
                <div className="grid gap-3">
                  {[
                    { label: jobT(spanish, "Model", "Modelo"), value: selectedModelLabel },
                    { label: jobT(spanish, "Subject focus", "Enfoque del sujeto"), value: packageAudienceOptions.find((option) => option.id === packageAudience)?.title ?? jobT(spanish, "For Myself", "Para mi") },
                    { label: jobT(spanish, "Primary", "Principal"), value: photoCountLabel(selectedAssetIds.length, spanish) },
                    { label: jobT(spanish, "Partner", "Pareja"), value: isCoupleFlow ? photoCountLabel(partnerSelectedAssetIds.length, spanish) : jobT(spanish, "Not used", "No usado") },
                    { label: jobT(spanish, "Required credits", "Creditos requeridos"), value: `${selectionCreditCost}` },
                    { label: createMode === "theme" ? jobT(spanish, "Price per image", "Precio por imagen") : selectedToolIsVideo ? jobT(spanish, "Workspace", "Espacio") : jobT(spanish, "Price per request", "Precio por solicitud"), value: selectedToolIsVideo ? jobT(spanish, "Image to Video", "Image to Video") : `${unitCreditCost}` },
                    { label: jobT(spanish, "Output", "Resultado"), value: createMode === "theme" ? imageCountLabel(requestOutputCount, spanish) : selectionOutputLabel }
                  ].map((item) => (
                    <div className={`flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2 ${subtlePanelClass}`} key={item.label}>
                      <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${eyebrowClass}`}>{item.label}</span>
                      <span className={`max-w-[58%] truncate text-right text-sm font-semibold ${textClass}`}>{item.value}</span>
                    </div>
                  ))}
                  <p className={`text-xs leading-5 ${mutedClass}`}>{creditsUsageNote}</p>
                </div>
                <div className="grid gap-3">
                  <p className={`text-xs leading-5 ${mutedClass}`}>
                    {jobT(spanish, "The request sends the selected package, prompt notes, primary photos, partner photos, subject focus, model, and output count to the generation job.", "La solicitud envia al trabajo de generacion el paquete, notas, fotos principales, fotos de pareja, enfoque del sujeto, modelo y cantidad de resultados.")}
                  </p>
                  {subscriptionGateMessage ? (
                    <div className={`rounded-[12px] border px-3 py-2 text-xs leading-5 ${subscriptionGateClass}`} role={subscriptionHardGate ? "alert" : "status"}>
                      <span>{subscriptionGateMessage}</span>
                      {subscriptionHardGate ? (
                        <a className="ml-2 inline-flex font-semibold underline underline-offset-4" href={pricingHref}>
                          {jobT(spanish, "Choose a plan", "Elegir plan")}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  {dialogMessage ? (
                    <div className={`rounded-[12px] border px-3 py-2 text-xs leading-5 ${dialogStatusClass}`} role={dialogTone === "error" ? "alert" : "status"}>
                      {dialogMessage}
                    </div>
                  ) : null}
                  <button
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${primaryButtonClass}`}
                    disabled={pending || !canStartRequest}
                    onClick={(event) => {
                      event.preventDefault();
                      void createJob(event);
                    }}
                    type="button"
                  >
                    <Play className="h-4 w-4" strokeWidth={1.8} />
                    {pending ? jobT(spanish, "Creating job...", "Creando solicitud...") : modeSubmitLabel}
                  </button>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-[16px] border p-4 ${panelClass}`}>
        <div>
          <p className={`text-sm font-semibold ${textClass}`}>{createMode === "theme" ? jobT(spanish, "Photo package mode", "Modo paquete de fotos") : jobT(spanish, "Tool mode", "Modo herramienta")}</p>
          <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>{message}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${light ? "border-[#dfd3c4] bg-[#fffaf3] text-[#625d56]" : "border-white/10 bg-white/[0.04] text-white/68"}`}>
            {selectedToolIsVideo ? jobT(spanish, "Video workspace", "Espacio de video") : jobT(spanish, `${selectionCreditCost} credits`, `${selectionCreditCost} creditos`)}
          </span>
          <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${light ? "border-[#dfd3c4] bg-[#fffaf3] text-[#625d56]" : "border-white/10 bg-white/[0.04] text-white/68"}`}>
            {jobT(spanish, `${customer.balance.available} available`, `${customer.balance.available} disponibles`)}
          </span>
          <button className={`rounded-[14px] px-4 py-2.5 text-xs font-semibold active:scale-[0.98] ${primaryButtonClass}`} onClick={continueToReviewOrSelfies} type="button">
            {jobT(spanish, "Review request", "Revisar solicitud")}
          </button>
        </div>
      </div>
    </form>
    </DreamshootShowcasePreview>
  );
}
