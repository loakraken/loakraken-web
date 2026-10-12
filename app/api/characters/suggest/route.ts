import { toResponse } from "@/lib/api/respond";
import { getSuggest } from "@/lib/character/server";

export async function GET(request: Request) {
  return toResponse(await getSuggest(new URL(request.url).searchParams.get("q") ?? "", request.signal));
}
