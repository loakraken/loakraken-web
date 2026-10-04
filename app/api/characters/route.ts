import { getCharacter } from "@/lib/character/server";

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("characterName") ?? "";
  const result = await getCharacter(name, request.signal);
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
