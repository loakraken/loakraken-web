import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production image ships .next/standalone + .next/static + public only (ops O-4).
  output: "standalone",
};

export default nextConfig;
