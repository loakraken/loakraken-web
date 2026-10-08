import { toResponse } from "@/lib/api/respond";
import { getNews } from "@/lib/home/server";

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 8);
  return toResponse(await getNews(limit, request.signal));
}
