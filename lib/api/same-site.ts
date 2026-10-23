// Requests that spend the visitor's limit must come from this site's own pages.
/**
 * Only this site's own pages may start a refill (it spends the visitor's limit).
 * A browser says so with Sec-Fetch-Site; one without it (Safari before 16.4)
 * still sends Origin on a POST, checked against the host the browser asked
 * for. That is the Host header (kept by the edge, which also sets
 * X-Forwarded-Host), not request.url: inside the Next server request.url can
 * carry the server's own host name, which refused every such browser.
 */
export function isSameSite(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = new URL(origin).host;
    const asked = [
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim(),
      request.headers.get("host"),
      new URL(request.url).host,
    ];
    return asked.some((value) => value === host);
  } catch {
    return false;
  }
}
