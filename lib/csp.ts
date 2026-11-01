// Content Security Policy, enforced (v0.3.5; it was report-only before).
//
// Scripts run only with this request's nonce ('strict-dynamic' lets those
// scripts load the page's own chunks): no 'unsafe-inline', and no 'unsafe-eval'
// outside development (React's dev error stacks need it). Next reads the nonce
// from the request's CSP header and puts it on its own scripts; the root layout
// puts it on the two pre-paint scripts. Response validation (Ajv) runs on the
// server only, so nothing in the browser compiles code.
// Styles keep 'unsafe-inline': React writes style="" attributes, which nonces
// cannot cover, and a style cannot run code.
// Images: this site and the official game image hosts. Fonts are self-hosted.
const IMAGES = "https://cdn-lostark.game.onstove.com https://lostark.game.onstove.com";

export function contentSecurityPolicy(nonce: string, dev = process.env.NODE_ENV !== "production") {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${IMAGES}`,
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** A fresh, unguessable nonce for one request (a random UUID: 122 random bits, base64). */
export const newNonce = () => btoa(crypto.randomUUID());
