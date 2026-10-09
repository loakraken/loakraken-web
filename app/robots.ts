import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/lib/site";

// Per request: staging gets the same image with a different SITE_URL.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const url = siteUrl();
  if (!isIndexable(url)) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${url}/sitemap.xml`,
    host: url,
  };
}
