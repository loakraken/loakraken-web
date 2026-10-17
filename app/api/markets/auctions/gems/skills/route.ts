import { getGemSkills, toResponse } from "@/lib/market/server";

export async function GET(request: Request) {
  return toResponse(await getGemSkills(request.signal));
}
