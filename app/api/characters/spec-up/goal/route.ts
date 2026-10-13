import { getSpecUpGoal, toResponse } from "@/lib/spec-up/server";
import { isSpecUpEnabled } from "@/lib/tools/flags";

export async function GET(request: Request) {
  if (!isSpecUpEnabled())
    return toResponse({ ok: false, error: { code: "SPEC_UP_DISABLED", status: 404 } });
  const params = new URL(request.url).searchParams;
  return toResponse(
    await getSpecUpGoal(params.get("characterName") ?? "", params.get("targetCombatPower"), request.signal),
  );
}
