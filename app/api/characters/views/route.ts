import { toResponse } from "@/lib/api/respond";
import { getViews } from "@/lib/character/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return toResponse(
    await getViews(params.get("characterName") ?? "", request.signal),
  );
}
