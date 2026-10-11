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

/**
 * The roster receipt stays hidden on production until its growth costs and
 * the refine gold are matched again (PM 총괄, v0.2.0). Same rule:
 * `RECEIPT_TOOL=on|off` overrides, otherwise hidden only on the production
 * host.
 */
export function isReceiptEnabled(env: Env = process.env) {
  const flag = env.RECEIPT_TOOL?.trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !isProductionHost(env.SITE_URL);
}

/**
 * The character "세팅 점검" tab stays hidden on production while its rules
 * are still few (user 10-11, PM 총괄 14:56). Same rule: `SETTING_CHECK_TAB=on|off`
 * overrides, otherwise hidden only on the production host.
 */
export function isSettingCheckEnabled(env: Env = process.env) {
  const flag = env.SETTING_CHECK_TAB?.trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !isProductionHost(env.SITE_URL);
}

/**
 * Official armory page details (tripod levels, skill code; backend flag off
 * by default). The web asks for them only where ARMORY_PAGE allows it:
 * `ARMORY_PAGE=on|off` overrides, otherwise never on the production host, so
 * production sends no request while the backend keeps it off (PM #507 P2).
 */
export function isArmoryPageEnabled(env: Env = process.env) {
  const flag = env.ARMORY_PAGE?.trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !isProductionHost(env.SITE_URL);
}

/**
 * The roster ranking tab (backend #298, off on the backend until it ships).
 * Same rule: `ROSTER_RANKING=on|off` overrides, otherwise hidden only on the
 * production host.
 */
export function isRosterRankingEnabled(env: Env = process.env) {
  const flag = env.ROSTER_RANKING?.trim().toLowerCase();
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
