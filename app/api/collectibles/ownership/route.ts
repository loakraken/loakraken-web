import { toResponse } from "@/lib/api/respond";
import { getCollectibleOwnership } from "@/lib/character/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return toResponse(await getCollectibleOwnership(params.get("type") ?? "", request.signal));
}
