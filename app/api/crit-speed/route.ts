import { calculateCritSpeed, toResponse } from "@/lib/crit-speed/server";

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    return toResponse({
      ok: false,
      error: { code: "UNSUPPORTED_MEDIA_TYPE", status: 415 },
    });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toResponse({
      ok: false,
      error: { code: "INVALID_REQUEST", status: 400 },
    });
  }
  return toResponse(await calculateCritSpeed(body, request.signal));
}
