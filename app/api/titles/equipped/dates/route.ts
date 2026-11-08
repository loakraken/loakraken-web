import { toResponse } from "@/lib/api/respond";
import { titleEquipQuery } from "@/lib/stats/title-equip";
import { getTitleDates } from "@/lib/stats/server";

export async function GET(request: Request) {
  // The same server check as the shares: a name the api would refuse is dropped.
  const { server } = titleEquipQuery({ server: new URL(request.url).searchParams.get("server") ?? undefined });
  return toResponse(await getTitleDates(server, request.signal));
}
