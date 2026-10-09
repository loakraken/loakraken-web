// Runtime tool flags (PM 총괄 2026-10-09 23:24). Read per request from
// server-only env: the image is built once and promoted from staging to
// production, so a build-time value could not tell the two apart.
import { PRODUCTION_URL, siteUrl } from "@/lib/site";

type Env = Record<string, string | undefined>;

/**
 * The crit-speed tool stays hidden on production until every row matches the
 * target sites again. `CRIT_SPEED_TOOL=on|off` overrides; otherwise it is
 * hidden only where SITE_URL explicitly names the production domain, so local,
 * e2e and staging keep it.
 */
export function isCritSpeedEnabled(env: Env = process.env) {
  const flag = env.CRIT_SPEED_TOOL?.trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !(env.SITE_URL && siteUrl(env.SITE_URL) === PRODUCTION_URL);
}
