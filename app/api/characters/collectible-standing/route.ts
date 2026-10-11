import { toResponse } from "@/lib/api/respond";
import { getCollectibleStanding } from "@/lib/character/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return toResponse(await getCollectibleStanding(params.get("characterName") ?? "", request.signal));
}
