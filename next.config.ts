import type { NextConfig } from "next";

// The Content Security Policy is set per page request with a nonce (proxy.ts,
// lib/csp.ts), enforced.

// Device features no page uses stay off, for this site and anything it embeds.
const PERMISSIONS = "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()";

const nextConfig: NextConfig = {
  // Production image ships .next/standalone + .next/static + public only (ops O-4).
  output: "standalone",
  // No X-Powered-By: it names the framework to anyone probing the site.
  poweredByHeader: false,
  // LOAKraken 개발자 노트 are read from these files per request: ship them
  // beside the server for the pages (and the sitemap) that read them.
  outputFileTracingIncludes: {
    "/news": ["./content/dev-notes/*.md"],
    "/news/dev-notes/[slug]": ["./content/dev-notes/*.md"],
    "/sitemap.xml": ["./content/dev-notes/*.md"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Permissions-Policy", value: PERMISSIONS },
        ],
      },
    ];
  },
};

export default nextConfig;
