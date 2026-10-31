import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, newNonce } from "@/lib/csp";

// One nonce per page request: the enforced CSP goes on the request (Next reads
// it to put the nonce on its scripts; the layout reads x-nonce) and on the
// response (the browser enforces it). Pages are rendered per request because of
// this (a static page has no request to take a nonce from).
export function proxy(request: NextRequest) {
  const nonce = newNonce();
  const policy = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

// Pages only: not the API, Next's static files and images, or files with an
// extension (icons, fonts, robots.txt, sitemap.xml); not link prefetches.
export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/static|_next/image|.*\\.[a-z0-9]+$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
