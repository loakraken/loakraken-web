// Site base URL (ops O-6). Read at request time from the server-only SITE_URL;
// the image is built once without it and promoted from staging to production,
// so anything rendered at build time falls back to the production domain.
export const PRODUCTION_URL = "https://loakraken.gg";
export const SITE_NAME = "LOAKraken";

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
  "/tools/material-quote",
  "/tools/refining",
  "/tools/crit-speed",
  "/tools/auction",
  "/tools/stone",
  "/tools/raid-rewards",
] as const;
