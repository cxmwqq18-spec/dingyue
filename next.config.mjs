/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  typedRoutes: false,
  images: {
    localPatterns: [
      { pathname: "/assets/site-media/**" },
      { pathname: "/assets/customer-assets/**" },
      { pathname: "/assets/dreamshoot/**" }
    ]
  },
  async headers() {
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

    return [
      {
        source: "/assets/:path*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      },
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
