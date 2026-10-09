// Requests that spend the visitor's limit must come from this site's own pages.
/** Only this site's own pages may start a refill (it spends the visitor's limit). */
export function isSameSite(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
