export const MYDREAMSHOOTS_HOMEPAGE_VIDEO_COVERS = {
  "/ai-video-generation/talking-photo": "/assets/dreamshoot/talking-photo/make-a-photo-talk-without-recording-another-take.webp",
  "/ai-video-generation/cinematic-video": "/assets/dreamshoot/cinematic-video/create-a-more-cinematic-video-without-a-full-film-crew.webp",
  "/ai-video-generation/music-video": "/assets/dreamshoot/music-video/ai-music-video-generator-for-artist-visuals-and-performance-concepts.webp",
  "/ai-video-generation/tiktok-video": "/assets/dreamshoot/tiktok-video/turn-your-photos-and-ideas-into-tiktok-first-videos.webp",
  "/ai-video-generation/instagram-reels": "/assets/dreamshoot/instagram-reels/turn-photos-and-ideas-into-reels-that-fit-your-feed.webp",
  "/ai-video-generation/product-video": "/assets/dreamshoot/product-video/show-the-product-clearly-before-you-ask-someone-to-buy-it.webp",
  "/ai-video-generation/product-ad-video": "/assets/dreamshoot/product-ad-video/ai-product-ad-video-new-product-unboxing-creative.jpg",
  "/ai-video-generation/promo-video": "/assets/dreamshoot/promo-video/promo-video-product-launch-presentation.jpg",
  "/ai-video-generation/motion-generator": "/assets/dreamshoot/generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-01.webp"
} as const satisfies Record<string, string>;

export function mydreamshootsHomepageVideoCover(canonicalPath: string): string | undefined {
  return MYDREAMSHOOTS_HOMEPAGE_VIDEO_COVERS[canonicalPath as keyof typeof MYDREAMSHOOTS_HOMEPAGE_VIDEO_COVERS];
}
