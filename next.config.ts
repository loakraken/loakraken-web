import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production image ships .next/standalone + .next/static + public only (ops O-4).
  output: "standalone",
  // LOAKraken 개발자 노트 are read from these files per request: ship them
  // beside the server for the pages (and the sitemap) that read them.
  outputFileTracingIncludes: {
    "/news": ["./content/dev-notes/*.md"],
    "/news/dev-notes/[slug]": ["./content/dev-notes/*.md"],
    "/sitemap.xml": ["./content/dev-notes/*.md"],
  },
};

export default nextConfig;
