import type { BackendResult } from "./backend";

// Same-origin route response: the result as JSON, no caching, and Retry-After on 429.
export function toResponse(result: BackendResult<unknown>) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (!result.ok && result.error.retryAt)
    headers["Retry-After"] = String(
      Math.max(1, Math.ceil((result.error.retryAt - Date.now()) / 1000)),
    );
  return Response.json(result, {
    status: result.ok ? 200 : result.error.status,
    headers,
  });
}
