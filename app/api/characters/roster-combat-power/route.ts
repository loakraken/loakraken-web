import { toResponse } from "@/lib/api/respond";
import { getRosterPower } from "@/lib/character/server";

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("characterName") ?? "";
  return toResponse(await getRosterPower(name, request.signal));
}
