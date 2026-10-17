import { toResponse } from "@/lib/api/respond";
import { titleEquipQuery } from "@/lib/stats/title-equip";
import { getTitleEquip } from "@/lib/stats/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = titleEquipQuery({ server: params.get("server") ?? undefined, activeDays: Number(params.get("activeDays")) });
  return toResponse(await getTitleEquip(query, request.signal));
}
