import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

// Every source the pages load from (security check after v0.3.2): this site,
// and the official game image hosts (portraits, icons, class icons). Fonts are
// self-hosted (next/font). Scripts allow 'unsafe-inline': the two pre-paint
// scripts in the root layout and the page data scripts the App Router writes
// into every page are inline; enforcing needs a per-request nonce instead. The
// response validator (ajv) still compiles its schemas in the browser with
// new Function, so 'unsafe-eval' stays until it moves to the server (#1027).
// Report-only for now: a missed source shows as a console report, never a
// broken page; the policy is enforced in a later release, without those two.
const IMAGES = "https://cdn-lostark.game.onstove.com https://lostark.game.onstove.com";
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${IMAGES}`,
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

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
          { key: "Content-Security-Policy-Report-Only", value: CSP },
          { key: "Permissions-Policy", value: PERMISSIONS },
        ],
      },
    ];
  },
};

export default nextConfig;
