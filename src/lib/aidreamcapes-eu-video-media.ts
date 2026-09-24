/**
 * Canonical French storefront video media.
 *
 * Keep this registry site-scoped. The existing asset paths are intentionally
 * stable so old cached pages and CDN objects remain valid; the user-facing
 * language is carried by the French labels, descriptions and alt text below.
 */
export type AidreamcapesEuVideoTopic = {
  slug: string;
  label: string;
  title: string;
  description: string;
  alt: string;
  videoUrl: string;
  posterUrl: string;
  width: 1344;
  height: 768;
  aspectRatio: "16 / 9";
  durationSeconds: 15.083333;
};

const EU_VIDEO_MEDIA: Record<string, AidreamcapesEuVideoTopic> = {
  "talking-photo": {
    slug: "talking-photo",
    label: "Portrait parlant",
    title: "Portrait parlant avec l’IA | Aidreamcapes",
    description: "Animez un portrait pour créer une vidéo parlante naturelle, adaptée aux messages, présentations et contenus sociaux.",
    alt: "Portrait vidéo d’une personne qui s’adresse à la caméra dans un intérieur lumineux.",
    videoUrl: "/assets/sites/site_aidreamcapes_eu/visuals/talking-photo/portrait-parlant.mp4",
    posterUrl: "/assets/sites/site_aidreamcapes_eu/visuals/talking-photo/portrait-parlant-poster.jpg",
    width: 1344,
    height: 768,
    aspectRatio: "16 / 9",
    durationSeconds: 15.083333
  },
  "cinematic-video": {
    slug: "cinematic-video",
    label: "Vidéo cinématographique",
    title: "Vidéo cinématographique avec l’IA | Aidreamcapes",
    description: "Transformez vos photos en scènes vidéo cinématographiques avec une lumière, une ambiance et un mouvement cohérents.",
    alt: "Scène vidéo cinématographique avec une lumière dramatique et une composition narrative.",
    videoUrl: "/assets/sites/site_aidreamcapes_eu/visuals/cinematic-video/video-cinematographique.mp4",
    posterUrl: "/assets/sites/site_aidreamcapes_eu/visuals/cinematic-video/video-cinematographique-poster.jpg",
    width: 1344,
    height: 768,
    aspectRatio: "16 / 9",
    durationSeconds: 15.083333
  },
  "music-video": {
    slug: "music-video",
    label: "Clip musical",
    title: "Clip musical avec l’IA | Aidreamcapes",
    description: "Créez un clip musical et des visuels d’artiste à partir de vos images, avec une direction de scène pensée pour le rythme.",
    alt: "Artiste qui chante devant un microphone sous des lumières de scène colorées.",
    videoUrl: "/assets/sites/site_aidreamcapes_eu/visuals/music-video/clip-musical.mp4",
    posterUrl: "/assets/sites/site_aidreamcapes_eu/visuals/music-video/clip-musical-poster.jpg",
    width: 1344,
    height: 768,
    aspectRatio: "16 / 9",
    durationSeconds: 15.083333
  },
  "tiktok-video": {
    slug: "tiktok-video",
    label: "Vidéo TikTok",
    title: "Vidéo TikTok avec l’IA | Aidreamcapes",
    description: "Créez de courtes vidéos IA pensées pour TikTok, avec une scène lisible et un format facile à partager.",
    alt: "Créatrice portant un imperméable jaune dans une rue urbaine éclairée par la pluie.",
    videoUrl: "/assets/sites/site_aidreamcapes_eu/visuals/tiktok-video/video-tiktok.mp4",
    posterUrl: "/assets/sites/site_aidreamcapes_eu/visuals/tiktok-video/video-tiktok-poster.jpg",
    width: 1344,
    height: 768,
    aspectRatio: "16 / 9",
    durationSeconds: 15.083333
  },
  "product-video": {
    slug: "product-video",
    label: "Vidéo produit",
    title: "Vidéo produit avec l’IA | Aidreamcapes",
    description: "Transformez des images produit en vidéos produit soignées pour présenter les détails, les usages et la valeur de votre offre.",
    alt: "Présentation vidéo d’un sac et d’accessoires sur une table de travail lumineuse.",
    videoUrl: "/assets/sites/site_aidreamcapes_eu/visuals/product-video/video-produit.mp4",
    posterUrl: "/assets/sites/site_aidreamcapes_eu/visuals/product-video/video-produit-poster.jpg",
    width: 1344,
    height: 768,
    aspectRatio: "16 / 9",
    durationSeconds: 15.083333
  },
  "promo-video": {
    slug: "promo-video",
    label: "Vidéo promotionnelle",
    title: "Vidéo promotionnelle avec l’IA | Aidreamcapes",
    description: "Préparez des vidéos promotionnelles IA pour vos campagnes, lancements et annonces avec un message visuel clair.",
    alt: "Présentation vidéo d’une campagne promotionnelle dans un décor de tournage coloré.",
    videoUrl: "/assets/sites/site_aidreamcapes_eu/visuals/promo-video/video-promotionnelle.mp4",
    posterUrl: "/assets/sites/site_aidreamcapes_eu/visuals/promo-video/video-promotionnelle-poster.jpg",
    width: 1344,
    height: 768,
    aspectRatio: "16 / 9",
    durationSeconds: 15.083333
  },
  "product-ad-video": {
    slug: "product-ad-video",
    label: "Publicité produit",
    title: "Publicité produit avec l’IA | Aidreamcapes",
    description: "Créez des publicités vidéo IA à partir de vos images produit pour présenter une offre et guider la décision d’achat.",
    alt: "Démonstration vidéo d’une chaussure dans une scène de publicité produit.",
    videoUrl: "/assets/sites/site_aidreamcapes_eu/visuals/product-ad-video/publicite-produit.mp4",
    posterUrl: "/assets/sites/site_aidreamcapes_eu/visuals/product-ad-video/publicite-produit-poster.jpg",
    width: 1344,
    height: 768,
    aspectRatio: "16 / 9",
    durationSeconds: 15.083333
  },
  "instagram-reels": {
    slug: "instagram-reels",
    label: "Reels Instagram",
    title: "Reels Instagram avec l’IA | Aidreamcapes",
    description: "Créez des Reels Instagram IA à partir de vos images pour raconter une histoire visuelle courte et adaptée au fil mobile.",
    alt: "Créatrice qui filme une scène de rue pour un Reel Instagram sous une lumière de fin de journée.",
    videoUrl: "/assets/sites/site_aidreamcapes_eu/visuals/instagram-reels/reels-instagram.mp4",
    posterUrl: "/assets/sites/site_aidreamcapes_eu/visuals/instagram-reels/reels-instagram-poster.jpg",
    width: 1344,
    height: 768,
    aspectRatio: "16 / 9",
    durationSeconds: 15.083333
  }
};

export const AIDREAMCAPES_EU_VIDEO_TOPIC_SLUGS = Object.freeze(Object.keys(EU_VIDEO_MEDIA));

export function aidreamcapesEuVideoTopic(slug: string | null | undefined): AidreamcapesEuVideoTopic | undefined {
  return slug ? EU_VIDEO_MEDIA[slug.trim().toLowerCase()] : undefined;
}

export function aidreamcapesEuVideoTopicFromPath(path: string | null | undefined): AidreamcapesEuVideoTopic | undefined {
  const match = String(path ?? "").match(/^\/ai-video-generation\/([^/?#]+)/i);
  return aidreamcapesEuVideoTopic(match?.[1]);
}

export function aidreamcapesEuVideoTopicPath(slug: string): string {
  return `/ai-video-generation/${slug}`;
}
