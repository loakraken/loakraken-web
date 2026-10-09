import { toResponse } from "@/lib/api/respond";
import { getTitles } from "@/lib/character/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return toResponse(await getTitles(params.get("characterName") ?? "", request.signal));
}
