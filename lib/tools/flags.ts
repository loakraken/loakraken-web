// Runtime tool flags (PM 총괄 2026-10-09 23:24). Read per request from
// server-only env: the image is built once and promoted from staging to
// production, so a build-time value could not tell the two apart.
import { PRODUCTION_URL } from "@/lib/site";

type Env = Record<string, string | undefined>;

/**
 * The crit-speed tool stays hidden on production until every row is
 * re-verified. `CRIT_SPEED_TOOL=on|off` overrides; otherwise it is
 * hidden only where SITE_URL explicitly names the production host (www
 * included), so local, e2e and staging keep it. Production also sets
 * CRIT_SPEED_TOOL=off explicitly (PM-프론트 23:41).
 */
/**
 * T4 악세 경매 검색기 (N13, backend #431). The backend route exists only with
 * loakraken.features.auction-search on, so the screen stays hidden on
 * production until both are opened. `ACCESSORY_SEARCH_TOOL=on|off` overrides,
 * otherwise hidden only on the production host.
 */
export function isAccessorySearchEnabled(env: Env = process.env) {
  const flag = env.ACCESSORY_SEARCH_TOOL?.trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !isProductionHost(env.SITE_URL);
}

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
 * The character "스펙업" tab (backend #318, PM-프론트 16:37 ⑤) stays hidden on
 * production until the backend opens spec-up.enabled there too. Same rule:
 * `SPEC_UP_GUIDE=on|off` overrides, otherwise hidden only on the production
 * host. A backend that answers SPEC_UP_DISABLED also hides it (the tab says so).
 */
export function isSpecUpEnabled(env: Env = process.env) {
  const flag = env.SPEC_UP_GUIDE?.trim().toLowerCase();
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

/**
 * The collectible ranking tab (backend #295/#304, checklist K33; off on the
 * backend until it ships). Same rule: `COLLECTIBLE_RANKING=on|off` overrides,
 * otherwise hidden only on the production host.
 */
export function isCollectibleRankingEnabled(env: Env = process.env) {
  const flag = env.COLLECTIBLE_RANKING?.trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !isProductionHost(env.SITE_URL);
}

/**
 * The bracelet and gem efficiency ranking tabs (api #444, checklist L38·L39).
 * Same rule: `EFFICIENCY_RANKING=on|off` overrides, otherwise hidden only on
 * the production host until its backend ships there.
 */
export function isEfficiencyRankingEnabled(env: Env = process.env) {
  const flag = env.EFFICIENCY_RANKING?.trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !isProductionHost(env.SITE_URL);
}

/**
 * The guild ranking tab (api #302, checklist L36·K28; off on the backend
 * until it ships). Same rule: `GUILD_RANKING=on|off` overrides, otherwise
 * hidden only on the production host.
 */
export function isGuildRankingEnabled(env: Env = process.env) {
  const flag = env.GUILD_RANKING?.trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !isProductionHost(env.SITE_URL);
}

/**
 * Popular guilds on the guild ranking (api #467, checklist M21). The backend
 * opens the route only with both RANKING_GUILDS_ENABLED and the popular
 * characters flag on. Same rule: `POPULAR_GUILDS=on|off` overrides,
 * otherwise hidden only on the production host.
 */
export function isPopularGuildsEnabled(env: Env = process.env) {
  const flag = env.POPULAR_GUILDS?.trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !isProductionHost(env.SITE_URL);
}

/**
 * Title equip shares (api #314, checklist L13·K11·L44): the 통계 '칭호' tab and
 * the share beside each roster title. Off on the backend until it ships.
 * Same rule: `TITLE_STATS=on|off` overrides, otherwise hidden only on the
 * production host.
 */
export function isTitleStatsEnabled(env: Env = process.env) {
  const flag = env.TITLE_STATS?.trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !isProductionHost(env.SITE_URL);
}

/**
 * Character page indexing (api #177, API list #12; PM 총괄 10-13). Off unless
 * `CHARACTER_INDEXING=on` — every deployment, not only production — so
 * every character page stays noindex until it is turned on on purpose.
 */
export function isCharacterIndexingEnabled(env: Env = process.env) {
  return env.CHARACTER_INDEXING?.trim().toLowerCase() === "on";
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
