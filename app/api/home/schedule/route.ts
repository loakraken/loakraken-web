import { toResponse } from "@/lib/api/respond";
import { getSchedule } from "@/lib/home/server";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  return toResponse(await getSchedule(date, request.signal));
}
