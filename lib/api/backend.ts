// Shared server-side access to the LOAKraken backend: origin validation, one
// request with a timeout, no retries, and error bodies that never leak upstream
// detail beyond an allow-listed code.

export type BackendFailure = { code: string; status: number; retryAt?: number };
export type BackendResult<T> =
  { ok: true; envelope: T } | { ok: false; error: BackendFailure };

export function retryAfterAt(header: string | null, now = Date.now()) {
  if (header && /^\d+$/.test(header))
    return now + Math.min(Number(header), 86400) * 1000;
  const parsed = header ? Date.parse(header) : NaN;
  return Number.isFinite(parsed) && parsed > now ? parsed : now + 60_000;
}

export function backendUrl(origin: string | undefined, path: string) {
  if (!origin) return null;
  try {
    const base = new URL(origin);
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== "/"
    )
      return null;
    return new URL(path, base);
  } catch {
    return null;
  }
}

/** What the web server tells the backend about the request it is serving. */
export type ForwardContext = {
  /** Incoming X-Forwarded-For, untouched (per-client limits, backend #108). */
  forwardedFor: string | null;
  /** Correlation id shared with the backend logs (O-8). */
  requestId: string;
  /** A search-engine crawler by User-Agent: the backend's separate bot bucket. */
  bot: boolean;
};

const REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;
/** Crawlers and link-preview fetchers that announce themselves. */
export const BOT_AGENT =
  /bot\b|bot\/|crawl|spider|slurp|yeti|daumoa|facebookexternalhit|kakaotalk-scrap|embedly/i;

/**
 * Builds the context from incoming headers. Only these three values are ever
 * forwarded; nothing else from the incoming request (an incoming
 * X-Loakraken-Bot included) reaches the backend.
 */
export function forwardContext(incoming: Pick<Headers, "get"> | null): ForwardContext {
  const id = incoming?.get("x-request-id")?.trim() ?? "";
  return {
    forwardedFor: incoming?.get("x-forwarded-for") || null,
    requestId: REQUEST_ID.test(id) ? id : crypto.randomUUID(),
    bot: BOT_AGENT.test(incoming?.get("user-agent") ?? ""),
  };
}

/**
 * The context of the request being served. The edge proxy overwrites or
 * appends X-Forwarded-For in production (the backend reads from the right);
 * outside a request (tests, scripts) there is no address and no bot flag, and
 * a fresh request id is made.
 */
export async function incomingContext(): Promise<ForwardContext> {
  try {
    const { headers } = await import("next/headers");
    return forwardContext(await headers());
  } catch (error) {
    const { unstable_rethrow } = await import("next/navigation");
    unstable_rethrow(error);
    return forwardContext(null);
  }
}

export function forwardHeaders(context: ForwardContext): Record<string, string> {
  return {
    ...(context.forwardedFor && { "X-Forwarded-For": context.forwardedFor }),
    "X-Request-Id": context.requestId,
    ...(context.bot && { "X-Loakraken-Bot": "1" }),
  };
}

export async function requestBackend<T>(
  url: URL | null,
  options: {
    method?: "GET" | "POST" | "DELETE";
    body?: unknown;
    /** Headers of the caller's own (an alert subscription's manage token); never the incoming ones. */
    headers?: Record<string, string>;
    isValid: (body: unknown) => body is T;
    errorCodes: Record<number, readonly string[]>;
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    timeoutMs?: number;
    /** Overrides the incoming request context (tests). */
    context?: ForwardContext;
  },
): Promise<BackendResult<T>> {
  if (!url)
    return {
      ok: false,
      error: { code: "FRONTEND_API_NOT_CONFIGURED", status: 503 },
    };
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 15_000);
  const signal = options.signal
    ? AbortSignal.any([timeout, options.signal])
    : timeout;
  const context = options.context ?? (await incomingContext());
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...options.headers,
        ...forwardHeaders(context),
        ...(options.body !== undefined && {
          "Content-Type": "application/json",
        }),
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal,
    });
    if (!response.ok) {
      let code = "LOST_ARK_API_ERROR";
      try {
        const body: unknown = await response.json();
        if (
          body &&
          typeof body === "object" &&
          "code" in body &&
          typeof body.code === "string" &&
          options.errorCodes[response.status]?.includes(body.code)
        )
          code = body.code;
      } catch {
        /* Never expose upstream error bodies or HTML. */
      }
      const status = options.errorCodes[response.status]
        ? response.status
        : 502;
      // Every 429 reads as the rate limit, except a 429 code the caller allow-lists
      // for its own meaning (e.g. CARD_COLLECTION_REFRESH_COOLDOWN).
      if (status === 429 && !options.errorCodes[429]?.includes(code)) code = "LOST_ARK_RATE_LIMITED";
      return {
        ok: false,
        error: {
          code,
          status,
          ...(status === 429 && {
            retryAt: retryAfterAt(response.headers.get("retry-after")),
          }),
          // A busy 503 that says when to come back (MARKET_SEARCH_BUSY): same wait.
          ...(status === 503 &&
            response.headers.get("retry-after") && {
              retryAt: retryAfterAt(response.headers.get("retry-after")),
            }),
        },
      };
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (signal.aborted) throw error;
      return {
        ok: false,
        error: { code: "INVALID_API_RESPONSE", status: 502 },
      };
    }
    if (!options.isValid(body))
      return {
        ok: false,
        error: { code: "INVALID_API_RESPONSE", status: 502 },
      };
    return { ok: true, envelope: body };
  } catch {
    return {
      ok: false,
      error: {
        code: timeout.aborted ? "LOST_ARK_API_TIMEOUT" : "LOST_ARK_API_ERROR",
        status: timeout.aborted ? 504 : 502,
      },
    };
  }
}
