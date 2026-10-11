import { toResponse } from "@/lib/api/respond";
import { getArmoryPage } from "@/lib/character/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return toResponse(await getArmoryPage(params.get("characterName") ?? "", request.signal));
}
