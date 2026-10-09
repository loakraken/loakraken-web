import type { MetadataRoute } from "next";
import { SITEMAP_PATHS, siteUrl } from "@/lib/site";

// Per request, like robots.txt; character pages are unbounded and not listed.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = siteUrl();
  return SITEMAP_PATHS.map((path) => ({
    url: `${url}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" || path === "/market" ? "hourly" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
