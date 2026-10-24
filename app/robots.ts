import type { MetadataRoute } from "next";
import { robotsRules } from "@/lib/robots";
import { isIndexable, siteUrl } from "@/lib/site";

// Per request: staging gets the same image with a different SITE_URL.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const url = siteUrl();
  return robotsRules(url, isIndexable(url));
}
