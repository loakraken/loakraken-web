import { toResponse } from "@/lib/api/respond";
import { getRank } from "@/lib/character/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return toResponse(await getRank(params.get("characterName") ?? "", request.signal));
}
