const devWatchIgnored = [
  "**/.git/**",
  "**/.codex/**",
  "**/.codex-artifacts/**",
  "**/.next*/**",
  "**/node_modules/**",
  "**/artifacts/**",
  "**/backups/**",
  "**/coverage/**",
  "**/data/customer-assets/**",
  "**/output/**",
  "**/public/assets/**",
  "**/tmp/**",
  "**/work_pdf_translation/**"
];

function mergeWatchIgnored(existingIgnored) {
  const existingGlobs = Array.isArray(existingIgnored)
    ? existingIgnored.filter((value) => typeof value === "string" && value.length > 0)
    : typeof existingIgnored === "string" && existingIgnored.length > 0
      ? [existingIgnored]
      : [];

  return [...new Set([...existingGlobs, ...devWatchIgnored])];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  devIndicators: false,
  typedRoutes: false,
  htmlLimitedBots: /.*/,
  experimental: {
    webpackMemoryOptimizations: true
  },
  onDemandEntries: {
    maxInactiveAge: 60_000,
    // The storefront has dozens of independently addressable theme pages.
    // Keeping only two app entries lets Next evict the catch-all module while
    // a menu navigation or smoke pass is still requesting it, which can
    // surface as a transient 404/ENOENT from the dev server.
    pagesBufferLength: 64
  },
  images: {
    localPatterns: [
      { pathname: "/assets/site-media/**" },
      { pathname: "/assets/customer-assets/**" },
      { pathname: "/assets/dreamshoot/**" }
    ]
  },
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: mergeWatchIgnored(config.watchOptions?.ignored)
      };
    }
    return config;
  },
  async rewrites() {
    // Remote database development can reference newly published media before
    // the corresponding files have been copied into this checkout. Keep local
    // assets authoritative and use the public storefront only as a dev fallback.
    if (process.env.NODE_ENV !== "development" || process.env.STOREFRONT_ASSET_REMOTE_FALLBACK === "0") return [];

    const origins = {
      mydreamshoots: process.env.MYDREAMSHOOTS_ASSET_REMOTE_ORIGIN?.trim() || "https://www.mydreamshoots.com",
      aidreamcapes: process.env.AIDREAMCAPES_ASSET_REMOTE_ORIGIN?.trim() || "https://www.aidreamcapes.com",
      aidreamshootsEu: process.env.AIDREAMSHOOTS_EU_ASSET_REMOTE_ORIGIN?.trim() || "https://aidreamshoots.eu",
      aidreamcapesEu: process.env.AIDREAMCAPES_EU_ASSET_REMOTE_ORIGIN?.trim() || "https://aidreamcapes.eu"
    };

    return {
      afterFiles: [
        {
          source: "/assets/sites/site_aidreamcapes_eu/:path*",
          destination: `${origins.aidreamcapesEu}/assets/sites/site_aidreamcapes_eu/:path*`
        },
        {
          source: "/assets/sites/site_aidreamshoots/:path*",
          destination: `${origins.aidreamshootsEu}/assets/sites/site_aidreamshoots/:path*`
        },
        {
          source: "/assets/sites/site_aidreamcapes/:path*",
          destination: `${origins.aidreamcapes}/assets/sites/site_aidreamcapes/:path*`
        },
        {
          source: "/assets/sites/site_dreamshoot/:path*",
          destination: `${origins.mydreamshoots}/assets/sites/site_dreamshoot/:path*`
        },
        {
          source: "/assets/dreamshoot/:path*",
          destination: `${origins.mydreamshoots}/assets/dreamshoot/:path*`
        }
      ]
    };
  },
  async headers() {
    const publicStorefrontCache = { key: "Cache-Control", value: "public, max-age=60, s-maxage=300, stale-while-revalidate=1800" };
    const publicStorefrontCdnCache = { key: "CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=1800" };
    const publicStorefrontCloudflareCache = { key: "Cloudflare-CDN-Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=1800" };
    const privateStorefrontCache = { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" };
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
      }
    ];
    const noindexPrivateHeaders = [
      ...securityHeaders,
      privateStorefrontCache,
      { key: "X-Robots-Tag", value: "noindex, nofollow" }
    ];
    const publicApiHeaders = [
      ...securityHeaders,
      { key: "X-Robots-Tag", value: "noindex, nofollow" }
    ];
    const publicStorefrontHeaders = [
      ...securityHeaders,
      publicStorefrontCache,
      publicStorefrontCdnCache,
      publicStorefrontCloudflareCache
    ];

    return [
      {
        source: "/assets/:path*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/robots.txt",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
          { key: "Vary", value: "Host, X-Forwarded-Host" }
        ]
      },
      {
        source: "/api/site-slugs/:siteSlug/storefront-section",
        headers: publicApiHeaders
      },
      {
        source: "/api/:path((?!local-assets(?:/|$)|site-slugs/[^/]+/storefront-section(?:/|$)).*)",
        headers: noindexPrivateHeaders
      },
      {
        source: "/api/local-assets/:path*",
        headers: [
          ...securityHeaders,
          { key: "X-Robots-Tag", value: "noindex, nofollow" }
        ]
      },
      {
        source: "/",
        headers: publicStorefrontHeaders
      },
      {
        source: "/collections",
        headers: publicStorefrontHeaders
      },
      {
        source: "/collections/:path*",
        headers: publicStorefrontHeaders
      },
      {
        source: "/ai-image-generation",
        headers: publicStorefrontHeaders
      },
      {
        source: "/ai-image-generation/:path*",
        headers: publicStorefrontHeaders
      },
      {
        source: "/ai-video-generation",
        headers: publicStorefrontHeaders
      },
      {
        source: "/ai-video-generation/:path*",
        headers: publicStorefrontHeaders
      },
      {
        source: "/tools",
        headers: publicStorefrontHeaders
      },
      {
        source: "/tools/:path*",
        headers: publicStorefrontHeaders
      },
      {
        source: "/pricing",
        headers: publicStorefrontHeaders
      },
      {
        source: "/workflow",
        headers: publicStorefrontHeaders
      },
      {
        source: "/privacy",
        headers: publicStorefrontHeaders
      },
      {
        source: "/terms",
        headers: publicStorefrontHeaders
      },
      {
        source: "/cookies",
        headers: publicStorefrontHeaders
      },
      {
        source: "/refunds",
        headers: publicStorefrontHeaders
      },
      {
        source: "/content",
        headers: publicStorefrontHeaders
      },
      {
        source: "/digital-delivery",
        headers: publicStorefrontHeaders
      },
      {
        source: "/policies/:path*",
        headers: publicStorefrontHeaders
      },
      {
        source: "/help",
        headers: publicStorefrontHeaders
      },
      {
        source: "/blog",
        headers: publicStorefrontHeaders
      },
      {
        source: "/blog/:path*",
        headers: publicStorefrontHeaders
      },
      {
        source: "/creators-circle",
        headers: publicStorefrontHeaders
      },
      {
        source: "/partner-registration",
        headers: publicStorefrontHeaders
      },
      {
        source: "/admin",
        headers: noindexPrivateHeaders
      },
      {
        source: "/admin/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/platform",
        headers: noindexPrivateHeaders
      },
      {
        source: "/platform/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/admin/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/admin",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/app/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/app",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/account/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/account",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/cart/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/cart",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/checkout/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/checkout",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/login",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/dashboard/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/dashboard",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/job/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/job",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/search/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug/search",
        headers: noindexPrivateHeaders
      },
      {
        source: "/site/:siteSlug",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/collections",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/collections/:path*",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/ai-image-generation",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/ai-image-generation/:path*",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/ai-video-generation",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/ai-video-generation/:path*",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/tools",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/tools/:path*",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/pricing",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/workflow",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/privacy",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/terms",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/cookies",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/refunds",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/content",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/digital-delivery",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/policies/:path*",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/help",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/blog",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/blog/:path*",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/creators-circle",
        headers: publicStorefrontHeaders
      },
      {
        source: "/site/:siteSlug/partner-registration",
        headers: publicStorefrontHeaders
      },
      {
        source: "/account",
        headers: noindexPrivateHeaders
      },
      {
        source: "/account/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/app/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/app",
        headers: noindexPrivateHeaders
      },
      {
        source: "/cart/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/cart",
        headers: noindexPrivateHeaders
      },
      {
        source: "/checkout/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/checkout",
        headers: noindexPrivateHeaders
      },
      {
        source: "/login",
        headers: noindexPrivateHeaders
      },
      {
        source: "/dashboard/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/dashboard",
        headers: noindexPrivateHeaders
      },
      {
        source: "/job/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/job",
        headers: noindexPrivateHeaders
      },
      {
        source: "/search/:path*",
        headers: noindexPrivateHeaders
      },
      {
        source: "/search",
        headers: noindexPrivateHeaders
      },
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
