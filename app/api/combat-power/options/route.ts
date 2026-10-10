import { getCombatPowerOptions, toResponse } from "@/lib/combat-power/server";
import { isCombatPowerEnabled } from "@/lib/tools/flags";

export async function GET(request: Request) {
  if (!isCombatPowerEnabled())
    return toResponse({ ok: false, error: { code: "NOT_FOUND", status: 404 } });
  return toResponse(await getCombatPowerOptions(request.signal));
}
