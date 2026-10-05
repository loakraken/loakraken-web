import { toResponse } from "@/lib/api/respond";
import { getHistory } from "@/lib/character/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return toResponse(
    await getHistory(
      params.get("characterName") ?? "",
      params.get("serverName") ?? "",
      request.signal,
    ),
  );
}
