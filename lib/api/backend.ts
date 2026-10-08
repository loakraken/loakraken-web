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

/**
 * The incoming request's X-Forwarded-For, passed through untouched so the
 * backend can rate-limit public traffic per client (backend #108). The edge
 * proxy overwrites it in production; outside a request (tests, scripts) there
 * is none and nothing is sent.
 */
export async function incomingForwardedFor(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    return (await headers()).get("x-forwarded-for");
  } catch (error) {
    const { unstable_rethrow } = await import("next/navigation");
    unstable_rethrow(error);
    return null;
  }
}

export async function requestBackend<T>(
  url: URL | null,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    isValid: (body: unknown) => body is T;
    errorCodes: Record<number, readonly string[]>;
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    timeoutMs?: number;
    /** Overrides the incoming request header (tests). */
    forwardedFor?: string | null;
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
  const forwardedFor =
    options.forwardedFor !== undefined
      ? options.forwardedFor
      : await incomingForwardedFor();
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(forwardedFor && { "X-Forwarded-For": forwardedFor }),
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
      if (status === 429) code = "LOST_ARK_RATE_LIMITED";
      return {
        ok: false,
        error: {
          code,
          status,
          ...(status === 429 && {
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
