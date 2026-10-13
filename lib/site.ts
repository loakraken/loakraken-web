// Site base URL (ops O-6). Read at request time from the server-only SITE_URL;
// the image is built once without it and promoted from staging to production,
// so anything rendered at build time falls back to the production domain.
export const PRODUCTION_URL = "https://loakraken.gg";
export const SITE_NAME = "LOAKraken";

/**
 * The community Discord invite (header and footer read it from here). A
 * non-expiring invite to the rules channel (PM 10:21); change it here only.
 */
export const DISCORD_URL = "https://discord.gg/7ewP2Zq9UV";

/** Origin of the running site; an unset or invalid SITE_URL means production. */
export function siteUrl(env: string | undefined = process.env.SITE_URL) {
  if (!env) return PRODUCTION_URL;
  try {
    const url = new URL(env);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : PRODUCTION_URL;
  } catch {
    return PRODUCTION_URL;
  }
}

/** Only the production domain may be indexed; staging and local stay hidden. */
export const isIndexable = (url = siteUrl()) => url === PRODUCTION_URL;

/** Fixed public pages listed in the sitemap (character pages are unbounded). */
export const SITEMAP_PATHS = [
  "/",
  "/about",
  "/market",
  "/tools",
  "/tools/material-quote",
  "/tools/refining",
  "/tools/crit-speed",
  "/tools/auction",
  "/tools/loa-shop",
  "/tools/abidos-craft",
  "/tools/raid-rewards",
  "/tools/more-reward",
  "/tools/contribution",
  "/tools/raid-cheatsheet",
  "/tools/homework",
  "/stats",
  "/rankings",
  "/multi-search",
  "/news",
  "/schedule",
  "/schedule/adventure-island",
  "/schedule/chaos-gate",
  "/schedule/field-boss",
  "/schedule/origin-island",
  "/schedule/island",
  "/schedule/sailing",
  "/schedule/rowen",
  "/privacy",
  "/contact",
] as const;
