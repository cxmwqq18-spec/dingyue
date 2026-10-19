// Migration input only. Public SSR reads the reviewed labels stored in LivePage.
export const AIDREAMCAPES_BREADCRUMB_NAMES = {
  '/ai-video-generation': 'AI Video Generation',
  '/ai-video-generation/ai-actors': 'AI Actors',
  '/ai-actors': 'AI Actors',
  '/ai-video-generation/ai-twin': 'AI Twin',
  '/ai-video-generation/before-after-videos': 'Before & After Videos',
  '/ai-video-generation/beauty-routine': 'Beauty Routine',
  '/ai-video-generation/black-friday-countdown': 'Black Friday Countdown',
  '/ai-video-generation/cinematic-video': 'Cinematic Video',
  '/ai-video-generation/fashion-try-on-reel': 'Fashion Try-On Reel',
  '/ai-video-generation/food-video': 'Food Video',
  '/ai-video-generation/home-organization': 'Home Organization',
  '/ai-video-generation/how-to-video': 'How-To Video',
  '/ai-video-generation/image-to-video': 'Image to Video',
  '/ai-video-generation/product-videos': 'Product Videos',
  '/ai-video-generation/promo-video': 'Promo Video',
  '/ai-video-generation/spark-ads-style-video': 'Spark Ads Style Video',
  '/ai-video-generation/spokesperson-videos': 'Spokesperson Videos',
  '/ai-video-generation/text-to-video': 'Text to Video',
  '/ai-video-generation/video-ads': 'Video Ads',
  '/ai-video-generation/url-to-video': 'URL to Video',
  '/ai-image-generation': 'AI Image Generation',
  '/ai-image-generation/change-background': 'Change Background',
  '/ai-image-generation/colorway-variations': 'Colorway Variations',
  '/ai-image-generation/white-background-photos': 'White Background Photos',
  '/ai-image-generation/social-ad-photos': 'Social Ad Photos',
  '/ai-image-generation/jewelry-positioning': 'Jewelry Positioning',
  '/ai-image-generation/lifestyle-photos': 'Lifestyle Photos',
  '/ai-image-generation/model-photos': 'Model Photos',
  '/ai-image-generation/packaging-mockup': 'Packaging Mockup',
  '/ai-image-generation/packshot-multi-angle': 'Multi-Angle Packshot',
  '/ai-image-generation/professional-headshot': 'Professional Headshot',
  '/ai-image-generation/sale-campaign-key-visual': 'Sale Campaign Key Visual',
  '/ai-image-generation/story-ad-vertical': 'Vertical Story Ad',
  '/ai-image-generation/ugc-still-ad': 'UGC Still Ad',
  '/ai-image-generation/virtual-try-on': 'Virtual Try-On',
  '/industries/fashion-clothing': 'Fashion & Clothing',
  '/industries/shoes': 'Shoes',
  '/industries/beauty-skincare': 'Beauty & Skincare',
  '/industries/electronics': 'Electronics',
  '/industries/health-wellness': 'Health & Wellness',
  '/industries/food-drinks': 'Food & Drinks',
  '/platforms/tiktok-ads': 'TikTok Ads',
  '/platforms/instagram-ads': 'Instagram Ads',
  '/platforms/facebook-ads': 'Facebook Ads',
  '/platforms/youtube-shorts-ads': 'YouTube Shorts Ads',
  '/platforms/amazon-product-photos': 'Amazon Product Photos',
  '/platforms/shopify-product-photos': 'Shopify Product Photos',
  '/guides': 'Guides',
  '/inspiration': 'Inspiration',
  '/ai-info': 'AI Info',
  '/about-us': 'About Us',
  '/contact-us': 'Contact Us'
};

export function aidreamcapesBreadcrumbs(slug, current) {
  if (slug === '/ai-actors') return [{ label: 'Home', href: '/' }, { label: 'AI Actors', href: '/ai-actors' }];
  if (!Array.isArray(current) || !current.length) return current;
  const root = ['ai-video-generation', 'ai-image-generation'].find(segment => slug === `/${segment}` || slug.startsWith(`/${segment}/`));
  if (root) {
    const parent = `/${root}`;
    if (!AIDREAMCAPES_BREADCRUMB_NAMES[slug]) throw new Error(`Review breadcrumb label for ${slug}`);
    return [{ label: 'Home', href: '/' }, { label: AIDREAMCAPES_BREADCRUMB_NAMES[parent], href: parent }, ...(slug === parent ? [] : [{ label: AIDREAMCAPES_BREADCRUMB_NAMES[slug], href: slug }])];
  }
  return current.map(crumb => ({ ...crumb, label: AIDREAMCAPES_BREADCRUMB_NAMES[crumb.href] ?? crumb.label }));
}

export function aidreamcapesActorBreadcrumbJsonLd(jsonLd) {
  const next = structuredClone(jsonLd);
  function visit(value) {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object') return;
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
    if (types.includes('BreadcrumbList')) {
      value.itemListElement = aidreamcapesBreadcrumbs('/ai-actors').map((item, index) => ({
        '@type': 'ListItem', position: index + 1, name: item.label, item: `https://www.aivideosugc.com${item.href}`
      }));
    }
    Object.values(value).forEach(visit);
  }
  visit(next);
  return next;
}
