import type { MetadataRoute } from "next";

/**
 * AI crawlers and AI assistants' fetchers (user 10-25: the site's content is not
 * for training or AI answers). Each gets its own group that disallows
 * everything; search engines (Googlebot, Yeti, Bingbot, ...) are not listed and
 * keep the open group. Google-Extended and Applebot-Extended are the vendors'
 * opt-out tokens for AI use; their search crawlers stay allowed.
 */
export const AI_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
  "Meta-ExternalFetcher",
  "cohere-ai",
  "cohere-training-data-crawler",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot",
  "Timpibot",
  "YouBot",
  "AI2Bot",
] as const;

/** robots.txt: everything closed off a non-production address; else open except /api/ and AI agents. */
export function robotsRules(url: string, indexable: boolean): MetadataRoute.Robots {
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: "/api/" },
      { userAgent: [...AI_AGENTS], disallow: "/" },
    ],
    sitemap: `${url}/sitemap.xml`,
    host: url,
  };
}
