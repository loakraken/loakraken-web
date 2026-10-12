import { NextResponse } from "next/server";
import type { NavFlags } from "@/components/site/nav-data";
import { isAccessorySearchEnabled, isCombatPowerEnabled, isCritSpeedEnabled } from "@/lib/tools/flags";

// Per request: the flags come from this deployment's environment.
export const dynamic = "force-dynamic";

/** Runtime flags for the site menu (web #237). */
export function GET() {
  const flags: NavFlags = {
    critSpeed: isCritSpeedEnabled(),
    combatPower: isCombatPowerEnabled(),
    accessorySearch: isAccessorySearchEnabled(),
  };
  return NextResponse.json(flags, { headers: { "Cache-Control": "private, max-age=300" } });
}
