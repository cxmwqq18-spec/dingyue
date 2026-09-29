export type AidreamshootsVideoTopicMedia = {
  poster: string;
  video: string;
  alt: string;
  durationSeconds: number;
};

export const AIDREAMSHOOTS_HOMEPAGE_VIDEO_TITLES: Record<string, string> = {
  "talking-photo": "Foto parlante",
  "cinematic-video": "Vídeo cinematográfico",
  "music-video": "Vídeo musical",
  "tiktok-video": "Vídeo para TikTok",
  "instagram-reels": "Reels de Instagram",
  "product-video": "Vídeo de producto",
  "product-ad-video": "Anuncio de producto en vídeo",
  "promo-video": "Vídeo promocional",
  "motion-generator": "Generador de movimiento"
};

export const AIDREAMSHOOTS_HOMEPAGE_VIDEO_SUBTITLES: Record<string, string> = {
  "talking-photo": "Crea un vídeo parlante a partir de un retrato.",
  "cinematic-video": "Convierte tus fotos en escenas de vídeo cinematográficas.",
  "music-video": "Crea conceptos visuales para artistas y actuaciones.",
  "tiktok-video": "Crea vídeos cortos con IA para TikTok.",
  "instagram-reels": "Crea vídeos verticales con IA para Instagram.",
  "product-video": "Convierte imágenes de producto en vídeos de producto con IA.",
  "product-ad-video": "Crea anuncios de vídeo con IA a partir de imágenes de producto.",
  "promo-video": "Crea vídeos promocionales con IA para campañas.",
  "motion-generator": "Convierte tus fotos en vídeos con movimiento generado por IA."
};

/**
 * Canonical public media for the eight Spanish AI-video topic pages.
 * Keep this list limited to media that is actually rendered on aidreamshoots.eu;
 * legacy showcase images are intentionally not added here.
 */
export const AIDREAMSHOOTS_HOMEPAGE_VIDEO_MEDIA: Record<string, AidreamshootsVideoTopicMedia> = {
  "talking-photo": {
    poster: "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo-poster.jpg",
    video: "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo.mp4?subtitlefix=20260929es1",
    alt: "Mujer mayor hablando a la cámara en un vídeo de fotografía parlante.",
    durationSeconds: 30
  },
  "cinematic-video": {
    poster: "/assets/sites/site_aidreamshoots/visuals/cinematic-video/cinematic-video-poster.jpg",
    video: "/assets/sites/site_aidreamshoots/visuals/cinematic-video/cinematic-video.mp4",
    alt: "Persona adulta en una escena cinematográfica con iluminación dramática y composición cuidada.",
    durationSeconds: 30
  },
  "music-video": {
    poster: "/assets/sites/site_aidreamshoots/visuals/music-video/music-video-poster.jpg",
    video: "/assets/sites/site_aidreamshoots/visuals/music-video/music-video.mp4",
    alt: "Artista adulta preparando una propuesta visual para una canción en un estudio de producción.",
    durationSeconds: 30
  },
  "tiktok-video": {
    poster: "/assets/sites/site_aidreamshoots/visuals/tiktok-video/tiktok-video-poster.jpg",
    video: "/assets/sites/site_aidreamshoots/visuals/tiktok-video/tiktok-video.mp4?subtitlefix=20260929es1",
    alt: "Creadora adulta preparando un vídeo corto para TikTok con cámara y accesorios coloridos.",
    durationSeconds: 30
  },
  "instagram-reels": {
    poster: "/assets/sites/site_aidreamshoots/visuals/instagram-reels/instagram-reels-poster.jpg",
    video: "/assets/sites/site_aidreamshoots/visuals/instagram-reels/instagram-reels.mp4",
    alt: "Creadora adulta preparando un Reel en un estudio casero con cámara y accesorios de grabación.",
    durationSeconds: 30
  },
  "product-video": {
    poster: "/assets/sites/site_aidreamshoots/visuals/product-video/product-video-poster.jpg",
    video: "/assets/sites/site_aidreamshoots/visuals/product-video/product-video.mp4?subtitlefix=20260929es1",
    alt: "Producto de consumo sin marca presentado en un estudio comercial con iluminación limpia y precisa.",
    durationSeconds: 15
  },
  "product-ad-video": {
    poster: "/assets/sites/site_aidreamshoots/visuals/product-ad-video/product-ad-video-poster.jpg",
    video: "/assets/sites/site_aidreamshoots/visuals/product-ad-video/product-ad-video.mp4?subtitlefix=20260929es1",
    alt: "Presentadora adulta mostrando un producto sin marca en una escena centrada en una decisión de compra.",
    durationSeconds: 15
  },
  "promo-video": {
    poster: "/assets/sites/site_aidreamshoots/visuals/promo-video/promo-video-poster.jpg",
    video: "/assets/sites/site_aidreamshoots/visuals/promo-video/promo-video.mp4?subtitlefix=20260929es1",
    alt: "Persona adulta presentando un adelanto de lanzamiento con iluminación promocional y ambiente dinámico.",
    durationSeconds: 15
  }
};

export function aidreamshootsVideoTopicSlugForPath(path: string): string | undefined {
  const match = String(path ?? "").match(/^\/ai-video-generation\/([^/]+)$/i);
  const slug = match?.[1]?.toLowerCase();
  return slug && AIDREAMSHOOTS_HOMEPAGE_VIDEO_MEDIA[slug] ? slug : undefined;
}
