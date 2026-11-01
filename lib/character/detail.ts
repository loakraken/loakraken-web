// Pure helpers for the character detail page.
import type { Character } from "./model";
import { isAwakeningPair } from "./skill-type";
import { sourcePlainText } from "./source-text";
import { remainingText } from "../time/remaining";

type Loadout = Character["loadout"];
export type Equipment = Loadout["equipment"][number];
export type Skill = NonNullable<Loadout["skills"]>[number];

/* Position (dealer/support) ------------------------------------------------ */

// Same rule as backend position-v1 (#68). Support nodes can sit on any
// enlightenment tier (e.g. a bard's 2nd-tier 절실한 구원), so match by name.
export const SUPPORT_CLASSES = ["바드", "홀리나이트", "도화가", "발키리"];
export const SUPPORT_NODES = ["절실한 구원", "축복의 오라", "만개", "해방자"];
export const DEALER_NODES = ["진실된 용맹", "심판자", "회귀", "빛의 기사"];
export type Position = "DEALER" | "SUPPORT";

/** Backend `analysis.position` when present, otherwise the same rule locally. */
export function positionOf(data: Character): Position | null {
  const fromBackend = (data.analysis as { position?: unknown }).position;
  if (fromBackend === "DEALER" || fromBackend === "SUPPORT") return fromBackend;
  if (!SUPPORT_CLASSES.includes(data.className)) return "DEALER";
  const nodes = (data.loadout.arkPassive?.effects ?? [])
    .map((effect) => sourcePlainText(effect.description))
    .filter((text) => /^깨달음/.test(text));
  const has = (list: string[]) =>
    nodes.some((text) => list.some((node) => text.includes(node)));
  if (has(SUPPORT_NODES)) return "SUPPORT";
  if (has(DEALER_NODES)) return "DEALER";
  return null;
}

/* Refresh cooldown --------------------------------------------------------- */

export const DEFAULT_CACHE_MS = 5 * 60_000;

export function refreshWindow(
  data: Pick<Character, "fetchedAt"> & { refreshAvailableAt?: string | null },
  now: number,
) {
  const fetched = Date.parse(data.fetchedAt);
  const declared = data.refreshAvailableAt
    ? Date.parse(data.refreshAvailableAt)
    : NaN;
  // Before #62 the backend did not expose the cache expiry; assume its default TTL.
  const availableAt = Number.isFinite(declared)
    ? declared
    : fetched + DEFAULT_CACHE_MS;
  return {
    fetchedAt: fetched,
    availableAt,
    estimated: !Number.isFinite(declared),
    ageMs: Math.max(0, now - fetched),
    remainingMs: Math.max(0, availableAt - now),
  };
}

export function relativeAgo(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

/** Refresh cooldown left (whole seconds, rounded up), shared format. */
export function remainingLabel(ms: number) {
  return remainingText(Math.ceil(ms / 1000) * 1000) ?? "0초";
}

/* Equipment ---------------------------------------------------------------- */

// 완갑 (팔 보호구) is equipment, right under the weapon (user 10-26): before,
// it fell into the leftovers and read as a special item.
const ARMOR_ORDER = ["투구", "어깨", "상의", "하의", "장갑", "무기", "완갑"];
/** Shown in their own place (the equipment foot), never as 내실 special equipment. */
export const NOT_SPECIAL = ["보주"];
const ACCESSORY_ORDER = ["목걸이", "귀걸이", "반지"];
export const SLOT_LABEL: Record<string, string> = { 투구: "머리" };

export function groupEquipment(equipment: Equipment[]) {
  const byOrder = (order: string[]) =>
    order.flatMap((type) => equipment.filter((item) => item.type === type));
  const known = new Set([
    ...ARMOR_ORDER,
    ...ACCESSORY_ORDER,
    "어빌리티 스톤",
    "보주",
    "팔찌",
  ]);
  return {
    armor: byOrder(ARMOR_ORDER),
    accessories: byOrder(ACCESSORY_ORDER),
    stone: equipment.find((item) => item.type === "어빌리티 스톤") ?? null,
    // Under the stone in the accessory column (user 10-31 layout).
    orb: equipment.find((item) => item.type === "보주") ?? null,
    bracelet: equipment.find((item) => item.type === "팔찌") ?? null,
    others: equipment.filter((item) => !known.has(item.type ?? "")),
  };
}

/**
 * A bracelet line "치명타 피해 +6.80%" → name and value, the value set at the
 * line's end (compact bracelet row, user 11-01). A sentence or a two-line
 * effect stays whole.
 */
export function splitEffect(text: string): { name: string; value: string } | null {
  if (text.includes("\n")) return null;
  const match = /^(.+?)\s+([+-]\d[\d,.]*%?)$/.exec(text.trim());
  return match ? { name: match[1], value: match[2] } : null;
}

export const GRADE_LABEL = { HIGH: "상", MID: "중", LOW: "하" } as const;
export type EffectGrade = keyof typeof GRADE_LABEL;
export const isGrade = (value: unknown): value is EffectGrade =>
  value === "HIGH" || value === "MID" || value === "LOW";

/** In-game quality tiers (game convention, not a site's palette). */
export function qualityTier(quality: number | null | undefined) {
  if (quality == null) return "none";
  if (quality >= 100) return "max";
  if (quality >= 90) return "high";
  if (quality >= 70) return "good";
  if (quality >= 30) return "normal";
  if (quality >= 10) return "low";
  return "poor";
}

export function averageQuality(
  groups: { group: string; average: number | null }[] | undefined,
  group: string,
) {
  const value = groups?.find((item) => item.group === group)?.average;
  return value == null ? null : Math.round(value * 10) / 10;
}

/* Ark passive -------------------------------------------------------------- */

export const ARK_TREES = ["진화", "깨달음", "도약"] as const;

export function parsePassiveNode(description: string | null | undefined) {
  const text = sourcePlainText(description);
  const match =
    /^(진화|깨달음|도약)\s*(\d+)티어\s*(.+?)\s*Lv\.?\s*(\d+)\s*$/.exec(text);
  if (!match)
    return { tree: null, tier: null, node: text || null, level: null };
  return {
    tree: match[1],
    tier: Number(match[2]),
    node: match[3],
    level: Number(match[4]),
  };
}

/** e.g. "44444" — relic/legendary engraving book levels in display order. */
/**
 * Engravings by relic count, highest first (user 10-31), so the code players
 * read off the list ("유물 43000") runs high to low; a tie goes to the higher
 * stone level, then keeps the official order.
 */
export function sortEngravings<T extends { level: number | null; abilityStoneLevel?: number | null }>(effects: T[]) {
  return effects
    .map((effect, index) => ({ effect, index }))
    .sort(
      (a, b) =>
        (b.effect.level ?? -1) - (a.effect.level ?? -1) ||
        (b.effect.abilityStoneLevel ?? -1) - (a.effect.abilityStoneLevel ?? -1) ||
        a.index - b.index,
    )
    .map(({ effect }) => effect);
}

export function engravingBookString(
  effects: { level: number | null }[] | undefined,
) {
  if (!effects?.length || effects.some((effect) => effect.level == null))
    return null;
  return effects.map((effect) => effect.level).join("");
}

/* Skills ------------------------------------------------------------------- */

/**
 * Skills a player actually invested in (the source lists every class skill).
 * 각성기·초각성기 are left out: both of each pair are listed and which one is
 * equipped is unknown, so they show only under '전체 스킬 보기'.
 */
export function activeSkills(skills: Skill[] | undefined) {
  return (skills ?? []).filter(
    (skill) =>
      !isAwakeningPair(skill.skillType) &&
      ((skill.level ?? 0) > 1 || skill.tripods.length > 0 || skill.rune !== null || skill.gemEffects.length > 0),
  );
}

export function skillSummary(skills: Skill[] | undefined) {
  const active = activeSkills(skills);
  const partBreak = active.filter((skill) => skill.partBreakLevel != null);
  return {
    active,
    partBreakCount: partBreak.length,
    partBreakLevel: partBreak.length
      ? Math.max(...partBreak.map((skill) => skill.partBreakLevel ?? 0))
      : null,
    counterCount: active.filter((skill) => skill.counter === true).length,
  };
}

/**
 * The gems set on the skill named `name` as chips
 * ("10겁", "8작"): level plus kind, with the gem and its effect for the card.
 * A radiance gem (both kinds) reads its kind from the effect text.
 */
export function skillGems(gems: Character["loadout"]["gems"], name: string | null | undefined) {
  if (!gems || !name) return [];
  return (gems.effects?.skills ?? [])
    .filter((effect) => effect.name === name)
    .flatMap((effect) => {
      const gem = gems.items.find((item) => item.slot === effect.gemSlot);
      if (!gem) return [];
      const kind = gemKindOf(gem.name, effect.description);
      return [{ gem, effect, label: `${gem.level ?? ""}${kind}`, cooldown: isCooldownGem(kind) }];
    });
}

/** gemKind, with an unnamed or unknown gem read from its effect like a radiance gem. */
function gemKindOf(name: string | null | undefined, effect: readonly string[] | null | undefined): GemKind {
  return gemKind(name, effect) ?? gemKind("광휘", effect)!;
}

/**
 * Gems set on skills that are not in the skill list (an identity skill, a
 * skill outside the skill window): the official gem effects name the skill,
 * but no skill row can show them (checklist L34, "그 외 장착 보석").
 */
export function otherSkillGems(gems: Character["loadout"]["gems"], skillNames: (string | null | undefined)[]) {
  const listed = new Set(skillNames.filter((name): name is string => !!name));
  const names = [...new Set((gems?.effects?.skills ?? []).map((effect) => effect.name))];
  return names.filter((name) => name && !listed.has(name)).flatMap((name) => skillGems(gems, name));
}

/** Gem slots a character can fill (the game's gem window). */
export const GEM_SLOTS = 11;

/**
 * Gems by kind for the skill tab summary: damage (겁화·멸화, or a radiance
 * gem whose effect raises damage), cooldown (작열·홍염, or a radiance gem
 * that cuts cooldown), and empty slots.
 */
export function gemCounts(gems: Character["loadout"]["gems"]) {
  const items = gems?.items ?? [];
  let damage = 0;
  let cooldown = 0;
  for (const gem of items) {
    const effect = gems?.effects?.skills.find((skill) => skill.gemSlot === gem.slot);
    if (isCooldownGem(gemKindOf(gem.name, effect?.description))) cooldown += 1;
    else damage += 1;
  }
  return { damage, cooldown, empty: Math.max(0, GEM_SLOTS - items.length) };
}

/* Stats -------------------------------------------------------------------- */

export const COMBAT_STATS = ["치명", "특화", "신속", "제압", "인내", "숙련"];

export function statNumber(stats: Character["stats"], type: string) {
  const value = stats.find((stat) => stat.type === type)?.value;
  return value && /^\d+$/.test(value) ? Number(value) : null;
}

/* Gems --------------------------------------------------------------------- */

export type GemKind = "겁" | "작" | "멸" | "홍";

/**
 * The short kind players read ("10겁 8작"): 겁화 → 겁 and 작열 → 작 (T4),
 * 멸화 → 멸 and 홍염 → 홍 (T3). A radiance gem (광휘) does either, so it reads
 * its official skill effect: a cooldown cut is 작, anything else 겁.
 */
export function gemKind(name: string | null | undefined, effect?: readonly string[] | null): GemKind | null {
  if (!name) return null;
  if (/겁화/.test(name)) return "겁";
  if (/작열/.test(name)) return "작";
  if (/멸화/.test(name)) return "멸";
  if (/홍염/.test(name)) return "홍";
  if (/광휘/.test(name)) return /재사용/.test((effect ?? []).join(" ")) ? "작" : "겁";
  return null;
}

/** 작·홍 cut cooldowns; 겁·멸 raise damage. */
export const isCooldownGem = (kind: GemKind) => kind === "작" || kind === "홍";

/** "기본 공격력 +4.95%" style line from the gem set description, if present. */
export function gemBaseAttack(description: string | null | undefined) {
  const match = /기본\s*공격력[^\d+]*\+?\s*([\d.]+)\s*%/.exec(
    sourcePlainText(description) ?? "",
  );
  return match ? Number(match[1]) : null;
}

/**
 * Ability stone 세공 bonus (F-5), e.g. "기본 공격력 +1.50%". Read from the
 * stone's tooltip effect groups: a group titled with 보너스 first, otherwise
 * any 기본 공격력 line. Null when the stone shows no active bonus.
 */
export function stoneBonus(stone: Equipment | null | undefined) {
  const groups = stone?.detail?.effects ?? [];
  const line = (lines: string[]) =>
    lines
      .map((value) => sourcePlainText(value)?.trim() ?? "")
      .find((value) => /\+\s*[\d.]+\s*%/.test(value));
  const titled = groups.find((group) => /보너스/.test(group.title));
  const found =
    (titled && line(titled.lines)) ??
    line(groups.flatMap((group) => group.lines).filter((value) => /기본\s*공격력/.test(value)));
  if (!found) return null;
  const match = /([가-힣 ]+?)\s*\+\s*([\d.]+)\s*%/.exec(found);
  return match
    ? `${match[1].trim()} +${Number(match[2]).toFixed(2)}%`
    : found;
}
