export const MYDREAMSHOOTS_HOMEPAGE_VIDEO_COVERS = {
  "/ai-video-generation/talking-photo": "/assets/dreamshoot/generated/homepage-showcase/posters/first-frame-talking-photo.jpg",
  "/ai-video-generation/cinematic-video": "/assets/dreamshoot/generated/homepage-showcase/posters/first-frame-cinematic-video.jpg",
  "/ai-video-generation/music-video": "/assets/dreamshoot/generated/homepage-showcase/posters/first-frame-music-video.jpg",
  "/ai-video-generation/tiktok-video": "/assets/dreamshoot/generated/homepage-showcase/posters/first-frame-tiktok-video.jpg",
  "/ai-video-generation/instagram-reels": "/assets/dreamshoot/generated/homepage-showcase/posters/first-frame-instagram-reels.jpg",
  "/ai-video-generation/product-video": "/assets/dreamshoot/generated/homepage-showcase/posters/first-frame-product-video.jpg",
  "/ai-video-generation/product-ad-video": "/assets/dreamshoot/generated/homepage-showcase/posters/first-frame-product-ad-video.jpg",
  "/ai-video-generation/promo-video": "/assets/dreamshoot/generated/homepage-showcase/posters/first-frame-promo-video.jpg"
} as const satisfies Record<string, string>;

export const MYDREAMSHOOTS_HOMEPAGE_VIDEO_ASPECT_RATIOS = {
  "/ai-video-generation/talking-photo": "16 / 9",
  "/ai-video-generation/cinematic-video": "16 / 9",
  "/ai-video-generation/music-video": "16 / 9",
  "/ai-video-generation/tiktok-video": "9 / 16",
  "/ai-video-generation/instagram-reels": "9 / 16",
  "/ai-video-generation/product-video": "9 / 16",
  "/ai-video-generation/product-ad-video": "9 / 16",
  "/ai-video-generation/promo-video": "9 / 16"
} as const satisfies Record<keyof typeof MYDREAMSHOOTS_HOMEPAGE_VIDEO_COVERS, string>;

export function mydreamshootsHomepageVideoCover(canonicalPath: string): string | undefined {
  return MYDREAMSHOOTS_HOMEPAGE_VIDEO_COVERS[canonicalPath as keyof typeof MYDREAMSHOOTS_HOMEPAGE_VIDEO_COVERS];
}

export function mydreamshootsHomepageVideoAspectRatio(canonicalPath: string): string {
  return MYDREAMSHOOTS_HOMEPAGE_VIDEO_ASPECT_RATIOS[canonicalPath as keyof typeof MYDREAMSHOOTS_HOMEPAGE_VIDEO_ASPECT_RATIOS] ?? "1 / 1";
}
