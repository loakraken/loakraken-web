import { toResponse } from "@/lib/api/respond";
import { getItemTooltips } from "@/lib/character/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return toResponse(await getItemTooltips(params.get("characterName") ?? "", request.signal));
}
