import type { MetadataRoute } from "next";
import { SITEMAP_PATHS, siteUrl } from "@/lib/site";
import { isAccessorySearchEnabled, isCritSpeedEnabled } from "@/lib/tools/flags";
import { devNoteList } from "@/lib/dev-notes/files";

// Per request, like robots.txt; character pages are unbounded and not listed.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = siteUrl();
  // A tool hidden on this deployment is not listed either (web #233).
  const hidden = [!isCritSpeedEnabled() && "/tools/crit-speed", !isAccessorySearchEnabled() && "/market/accessory-search"].filter(Boolean);
  const pages: MetadataRoute.Sitemap = SITEMAP_PATHS.filter((path) => !hidden.includes(path)).map((path) => ({
    url: `${url}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" || path === "/market" ? "hourly" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
  // Each LOAKraken 개발자 노트 is a page of its own (written once, rarely changed).
  const notes: MetadataRoute.Sitemap = devNoteList().map((note) => ({
    url: `${url}/news/dev-notes/${note.slug}`,
    lastModified: note.date,
    changeFrequency: "monthly",
    priority: 0.5,
  }));
  return [...pages, ...notes];
}
