import {
  characterNameError,
  normalizeCharacterName,
  type CharacterResult,
} from "./model";
import { isCharacterEnvelope } from "./validate";

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_FOUND"],
  429: ["LOST_ARK_RATE_LIMITED"],
  502: ["LOST_ARK_API_ERROR"],
  503: [
    "LOST_ARK_NOT_CONFIGURED",
    "CHARACTER_CACHE_UNAVAILABLE",
    "CHARACTER_STORAGE_UNAVAILABLE",
  ],
  504: ["LOST_ARK_API_TIMEOUT"],
};

export function retryAt(header: string | null, now = Date.now()) {
  if (header && /^\d+$/.test(header))
    return now + Math.min(Number(header), 86400) * 1000;
  const parsed = header ? Date.parse(header) : NaN;
  return Number.isFinite(parsed) && parsed > now ? parsed : now + 60_000;
}

export async function requestCharacter(
  name: string,
  origin: string | undefined,
  options: {
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<CharacterResult> {
  if (characterNameError(name))
    return { ok: false, error: { code: "INVALID_REQUEST", status: 400 } };
  let url: URL;
  try {
    if (!origin) throw new Error("Missing origin");
    const base = new URL(origin);
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== "/"
    )
      throw new Error("Invalid origin");
    url = new URL("/api/v1/characters/search", base);
    url.searchParams.set("characterName", normalizeCharacterName(name));
    // Siblings are fetched separately (backend #54) so a siblings failure never
    // blocks the detail page and a cache miss costs one external call, not two.
    url.searchParams.set("includeSiblings", "false");
  } catch {
    return {
      ok: false,
      error: { code: "FRONTEND_API_NOT_CONFIGURED", status: 503 },
    };
  }

  const timeout = AbortSignal.timeout(options.timeoutMs ?? 15_000);
  const signal = options.signal
    ? AbortSignal.any([timeout, options.signal])
    : timeout;
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      headers: { Accept: "application/json" },
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
          errorCodes[response.status]?.includes(body.code)
        )
          code = body.code;
      } catch {
        /* Never expose upstream error bodies or HTML. */
      }
      const status = errorCodes[response.status] ? response.status : 502;
      if (status === 429) code = "LOST_ARK_RATE_LIMITED";
      return {
        ok: false,
        error: {
          code,
          status,
          ...(status === 429
            ? { retryAt: retryAt(response.headers.get("retry-after")) }
            : {}),
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
    if (!isCharacterEnvelope(body))
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
