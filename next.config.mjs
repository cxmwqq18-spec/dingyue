/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  typedRoutes: false,
  htmlLimitedBots: /.*/,
  images: {
    localPatterns: [
      { pathname: "/assets/site-media/**" },
      { pathname: "/assets/customer-assets/**" },
      { pathname: "/assets/dreamshoot/**" }
    ]
  },
  async headers() {
    const publicStorefrontCache = { key: "Cache-Control", value: "public, max-age=60, s-maxage=300, stale-while-revalidate=1800" };
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
    const publicStorefrontHeaders = [
      ...securityHeaders,
      publicStorefrontCache
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
        source: "/api/:path*",
        headers: noindexPrivateHeaders
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
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
