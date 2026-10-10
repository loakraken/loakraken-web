import { toResponse } from "@/lib/api/respond";
import { getPopular } from "@/lib/character/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return toResponse(
    await getPopular(params.get("period") ?? "24h", Number(params.get("limit") ?? 10), request.signal),
  );
}
