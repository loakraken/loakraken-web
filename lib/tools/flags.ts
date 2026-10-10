// Runtime tool flags (PM 총괄 2026-10-09 23:24). Read per request from
// server-only env: the image is built once and promoted from staging to
// production, so a build-time value could not tell the two apart.
import { PRODUCTION_URL } from "@/lib/site";

type Env = Record<string, string | undefined>;

/**
 * The crit-speed tool stays hidden on production until every row matches the
 * target sites again. `CRIT_SPEED_TOOL=on|off` overrides; otherwise it is
 * hidden only where SITE_URL explicitly names the production host (www
 * included), so local, e2e and staging keep it. Production also sets
 * CRIT_SPEED_TOOL=off explicitly (PM-프론트 23:41).
 */
export function isCritSpeedEnabled(env: Env = process.env) {
  const flag = env.CRIT_SPEED_TOOL?.trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !isProductionHost(env.SITE_URL);
}

/**
 * The combat-power simulator (backend #240) stays hidden on production until
 * its main items (gems, refine, engravings) are verified against the target
 * sites (PM 총괄 10-10). Same rule as crit-speed: `COMBAT_POWER_SIM=on|off`
 * overrides, otherwise hidden only on the production host.
 */
export function isCombatPowerEnabled(env: Env = process.env) {
  const flag = env.COMBAT_POWER_SIM?.trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !isProductionHost(env.SITE_URL);
}

const PRODUCTION_HOST = new URL(PRODUCTION_URL).hostname;

function isProductionHost(value: string | undefined) {
  if (!value?.trim()) return false;
  try {
    const host = new URL(value.trim()).hostname.toLowerCase().replace(/\.$/, "");
    return host === PRODUCTION_HOST || host === `www.${PRODUCTION_HOST}`;
  } catch {
    return false;
  }
}
