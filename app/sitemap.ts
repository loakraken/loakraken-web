import type { MetadataRoute } from "next";
import { SITEMAP_PATHS, siteUrl } from "@/lib/site";
import { isCritSpeedEnabled } from "@/lib/tools/flags";

// Per request, like robots.txt; character pages are unbounded and not listed.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = siteUrl();
  // A tool hidden on this deployment is not listed either (web #233).
  const hidden = isCritSpeedEnabled() ? [] : ["/tools/crit-speed"];
  return SITEMAP_PATHS.filter((path) => !hidden.includes(path)).map((path) => ({
    url: `${url}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" || path === "/market" ? "hourly" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
