// Spec-up guide (backend #318, PM-프론트 10-11 16:37 ⑤): candidate upgrades
// ranked by combat power per 10,000 gold. The backend computes every number;
// the screen only formats them and folds what it could not compute.
import type { components } from "../api/spec-up-schema";
import type { Character } from "../character/model";
import { ADVANCED_REFINE_MAX, ARM_GUARD_GRADES, GRADES, isAdvancedRefineOpen, isRefineOpen, isUpgradeGear, KARMA_MAX, KARMA_TREE, POLISH_NONE, type Edits, type Grade } from "../combat-power/model";

const isGrade = (value: unknown): value is Grade => (GRADES as readonly unknown[]).includes(value);

type Schemas = components["schemas"];
export type SpecUp = Schemas["SpecUpResponse"];
export type Candidate = Schemas["CandidateResponse"];
export type Cost = Schemas["CostResponse"];
/** A polish step's `line` and `option` (api #951) are in the contract, optional until that api ships. */
export type SpecUpChange = Schemas["ChangeResponse"];
export type SpecUpEnvelope = { code: string; message: string; data: SpecUp };

// 사용자 결정(PM 총괄 10-26): 전투력 증가 first and the default, then 효율, then 크라켄.
export const SORTS = [
  // The chip (label) is short so the bar stays two rows at 320–390 (PM 총괄 11-08);
  // the caption and sentences say it in full: what is measured, per how much gold
  // (codex P3 11-08: two chips ending in 효율 with different units read alike).
  // describe: read after the chip by screen readers ("/" reads as a slash), PM-프론트 11-08.
  { id: "DELTA", label: "전투력 증가", name: "전투력 증가", unit: null, describe: null },
  { id: "EFFICIENCY", label: "전투력 / 1만G", name: "전투력 효율", unit: "1만G당", describe: "1만 골드당 전투력 순" },
  // api #573: by the Kraken score gained per 100,000 gold (the label said
  // "점수 순", which read as the score itself: codex QA 11-08). Sent only now that the
  // screen knows it; the answer may come back as EFFICIENCY with a reason.
  { id: "KRAKEN", label: "크라켄 / 10만G", name: "크라켄 점수", unit: "10만G당", describe: "10만 골드당 크라켄 점수 순" },
] as const;
export type Sort = (typeof SORTS)[number]["id"];
/** The list a dealer sees first (the tab's first request); sent explicitly, not the api's own default. */
export const DEFAULT_SORT: Sort = "DELTA";
export const isSort = (value: unknown): value is Sort => SORTS.some((s) => s.id === value);
/** An OK cost of 0: shown "추가 비용 없음", its per-gold figure not worked out (PM-프론트 10-18). */
export const isFreeCost = (cost: { status: string; amount?: number | null } | null | undefined) =>
  cost?.status === "OK" && cost.amount === 0;

const sortOf = (sort: string) => SORTS.find((s) => s.id === sort) ?? SORTS[0];
/** In full, for the caption and sentences: "전투력 효율 (1만G당)", "전투력 증가 순". */
export const sortName = (sort: string) => {
  const { name, unit } = sortOf(sort);
  return unit ? `${name} (${unit})` : `${name} 순`;
};
export const sortCaption = sortName;

/**
 * Told on the status line when another list has come (#921): the sort, or for
 * the same sort the cooldown-gem choice. Keys are "SORT:cooldown" (see the guide).
 */
export function listChangeCopy(fromKey: string, sort: string, cooldownGemsIncluded: boolean | null | undefined): string {
  if (fromKey.split(":")[0] === sort)
    return cooldownGemsIncluded ? "작열 보석을 넣어 다시 정렬했어요" : "작열 보석을 빼고 다시 정렬했어요";
  return `${sortName(sort)}으로 정렬했어요`;
}

/**
 * One cache entry per character snapshot, sort and cooldown-gem choice (the
 * tab and the guide share it). The choice is left out (null) for the
 * backend's default.
 */
export const specUpQuery = (
  name: string,
  fetchedAt: string | null | undefined,
  sort: Sort,
  includeCooldownGems: boolean | null = null,
) => ["spec-up", name, fetchedAt ?? null, sort, includeCooldownGems] as const;

/**
 * Kinds the screen names. A kind the web does not know yet (the api adds kinds ahead of the web, PM 총괄 11-15)
 * reads "기타", never its code: the list, the detail card and the folded reasons stay readable, and such a row
 * opens nothing in the simulator (editsFor gives null).
 */
export const SPEC_UP_KIND_LABEL: Record<string, string> = {
  GEM_LEVEL: "보석",
  GEM_LEVEL_ALL: "보석",
  EQUIPMENT_QUALITY: "품질",
  EQUIPMENT_REFINE: "재련",
  ADVANCED_REFINE: "상급 재련",
  // The list's 상급 재련 candidates (업화 gear) come as EQUIPMENT_ADVANCED_REFINE (백엔드 11-21): without it they read "기타".
  EQUIPMENT_ADVANCED_REFINE: "상급 재련",
  ENGRAVING_LEVEL: "각인",
  STONE_ENGRAVING: "스톤",
  POLISH: "연마",
  BRACELET_EFFECT: "팔찌",
  ARK_PASSIVE_POINT: "아크 패시브",
  ARK_GRID_CORE: "아크 그리드",
  KARMA_LEVEL: "카르마",
  ABILITY_STONE: "어빌리티 스톤",
};
export const UNKNOWN_KIND_LABEL = "기타";

/**
 * 연마 rows with a combat-power gain (api spec-up.polish-cp, PM 총괄 11-15): the gain is for the accessory with its
 * two scoring lines at this candidate's grades; a current flat-value 공격력 / 무기 공격력 line is dropped, except
 * when the current two scoring lines are already both 상, where the flat line becomes this candidate's flat line.
 * One fixed line in the row's detail card says so; it shows only when the row has a ΔCP, so it stays hidden while
 * the api flag is off.
 */
// 계산 검증's sentence (11-15 14:05, against api #945), verbatim: do not reword. It wraps in the card.
export const POLISH_BASIS =
  "점수에 쓰는 연마 효과 두 줄을 이 후보의 등급으로 바꾼 장신구로 셈해요. 지금 붙은 고정값 공격력·무기 공격력 줄은 빼고 셈해요. 다만 지금 두 줄이 이미 모두 상이면, 고정값 줄을 이 후보의 고정값 줄로 바꿔 셈해요. 그 밖의 줄은 그대로예요.";
export const polishBasis = (candidate: Pick<Candidate, "kind" | "deltaCombatPower">) =>
  candidate.kind === "POLISH" && candidate.deltaCombatPower != null ? POLISH_BASIS : null;
export const kindLabel = (kind: string) =>
  Object.hasOwn(SPEC_UP_KIND_LABEL, kind) ? SPEC_UP_KIND_LABEL[kind] : UNKNOWN_KIND_LABEL;

/**
 * The 스펙업 tab's lead sentence (the tab draws it, not the guide, so it is in the server HTML: the tab's LCP at
 * 320 on a slow network, #1858). A supporter's depends on their first answer (`pathOpen`: 추천 순서 by score runs).
 */
export function specUpLead({ supporter, pathOpen, pathEnabled }: { supporter: boolean; pathOpen: boolean; pathEnabled: boolean }) {
  if (supporter)
    return pathOpen
      ? // A supporter's first view is 추천 순서 by score once it runs (PM 총괄 11-15).
        "바꿨을 때 오르는 서포터 점수와 드는 골드를 함께 보고, 처음에는 올리는 차례대로 고른 추천 순서를 보여 드려요. 아래에서 다른 정렬로 바꿀 수 있어요."
      : "바꿨을 때 오르는 서포터 점수와 드는 골드를 함께 보고, 10만 골드당 점수가 높은 순서로 보여 드려요.";
  return pathEnabled
    ? // The dealer's first view is 추천 순서 (layout A, 11-02).
      "바꿨을 때 오르는 전투력과 드는 골드를 함께 보고, 처음에는 올리는 차례대로 고른 추천 순서를 보여 드려요. 아래에서 다른 정렬로 바꿀 수 있어요."
    : // The dealer's first list is 전투력 증가 (DEFAULT_SORT, 마케팅 11-01: the line said 효율 order).
      "바꿨을 때 오르는 전투력과 드는 골드를 함께 보고, 처음에는 전투력이 많이 오르는 순서로 보여 드려요. 정렬은 아래에서 바꿀 수 있어요.";
}

/** A row with no combat power: the 전투력 cell shows a dash, and the 크라켄 점수 footer counts it (one test for both). */
export const noCombatPower = (candidate: { deltaCombatPower?: number | null }) => candidate.deltaCombatPower == null;

/**
 * A candidate's kind as the screen names it. 완갑 rows come as kind EQUIPMENT_REFINE with change.kind ARM_GUARD (api,
 * 백엔드 11-21): named 완갑, as the path names the same step, not 재련.
 */
export const candidateKindLabel = (candidate: { kind: string; change?: { kind?: string | null } | null }) =>
  candidate.change?.kind === "ARM_GUARD" ? "완갑" : kindLabel(candidate.kind);

/** The site reads a gem by its role (보석은 '10겁 8작', user 10-22): gemType → word. */
const GEM_ROLE: Record<string, string> = { DAMAGE: "겁화", COOLDOWN: "작열" };

/**
 * A gem row's target as the site writes gems: a 광휘 gem does either role, so
 * two rows of one skill read "터닝 슬래쉬 · 6레벨 광휘" twice although one is
 * the damage gem and one the cooldown gem. With gemType the 광휘 keeps its
 * own name (the gem the player owns and finds in the inventory) and adds the
 * role its price follows: "… 6레벨 광휘(겁화)" / "… 6레벨 광휘(작열)".
 * Other targets (and an unknown gemType) stay as they come.
 */
export function gemTarget(target: string, gemType: string | null | undefined) {
  const role = gemType ? GEM_ROLE[gemType] : undefined;
  if (!role) return target;
  return target.replace(/(\d+레벨 광휘)$/, `$1(${role})`);
}

/**
 * Gold in Korean units, every digit kept (no rounding): 12,340 → "1만 2,340",
 * 123,456,789 → "1억 2,345만 6,789". The caller adds "G".
 */
/**
 * The room a cost cell holds from the start (A7): the widest text of the same
 * size with one more leading digit, all eights ("62만" → "888만 8,888G"). The
 * minute's price refresh (a few tens of percent) then never widens its column.
 */
export function costRoom(amount: number) {
  const a = Math.abs(Math.trunc(amount));
  const units = [
    ["조", 1_000_000_000_000],
    ["억", 100_000_000],
    ["만", 10_000],
  ] as const;
  const eights = (n: number) => Number("8".repeat(n)).toLocaleString("ko-KR");
  const top = units.findIndex(([, size]) => a >= size);
  if (top < 0) return "8만 8,888G";
  const [unit, size] = units[top];
  const head = `${eights(String(Math.floor(a / size)).length + 1)}${unit}`;
  return [head, ...units.slice(top + 1).map(([u]) => `8,888${u}`), "8,888"].join(" ") + "G";
}

/**
 * The price time of a gem cost (api #759): "21:05 시세" when fresh, "이전 시세
 * 21:05" when the backend used the last-known price (stale) — never shown as
 * current. A date is added when it is not today (KST). null for a cost without
 * a price time (not a gem cost, or a backend from before #759).
 */
export function costPriceNote(
  cost: { priceObservedAt?: string | null; stale?: boolean | null } | null | undefined,
  now: number,
): { stale: boolean; text: string } | null {
  if (!cost?.priceObservedAt) return null;
  const at = Date.parse(cost.priceObservedAt);
  if (!Number.isFinite(at)) return null;
  const kst = (ms: number) => new Date(ms + 9 * 3_600_000);
  const d = kst(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  const today = kst(now).toISOString().slice(0, 10) === d.toISOString().slice(0, 10);
  const when = today ? time : `${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} ${time}`;
  return cost.stale ? { stale: true, text: `이전 시세 ${when}` } : { stale: false, text: `${when} 시세` };
}

/**
 * CHARACTER_NOT_CACHED on the character page: the page shows the character, but
 * the backend's copy of it ran out while the page stayed open, so "load it first"
 * read as wrong (user 11-08). `again` is what to do after 갱신 ("열어", "찾아").
 */
export const notCachedText = (again: string) =>
  `캐릭터 정보를 받은 지 오래되었어요. 위의 갱신 버튼으로 다시 받은 뒤 ${again} 주세요.`;

export function koreanGold(amount: number) {
  if (!Number.isFinite(amount)) return "—";
  const sign = amount < 0 ? "−" : "";
  let rest = Math.abs(Math.trunc(amount));
  const parts: string[] = [];
  for (const [unit, size] of [
    ["조", 1_000_000_000_000],
    ["억", 100_000_000],
    ["만", 10_000],
  ] as const) {
    const n = Math.floor(rest / size);
    if (n > 0) parts.push(`${n.toLocaleString("ko-KR")}${unit}`);
    rest %= size;
  }
  if (rest > 0 || parts.length === 0) parts.push(rest.toLocaleString("ko-KR"));
  return sign + parts.join(" ");
}

export type Folded = { code: string; reason: string; kinds: string[]; candidates: Candidate[] };

/**
 * The minute's price refresh keeps the rows where they are (A7: rows do not
 * move without a press): candidates already listed keep their place, new ones
 * follow in the backend's order. A new sort is a new order.
 */
export function keepOrder(list: Candidate[], ids: readonly string[] | null) {
  if (!ids) return list;
  const at = new Map(ids.map((id, i) => [id, i]));
  return list
    .map((candidate, i) => ({ candidate, rank: at.get(candidate.id) ?? ids.length + i }))
    .sort((a, b) => a.rank - b.rank)
    .map((row) => row.candidate);
}

/**
 * Several stages of one target (각인 0→2 / 0→3 / 0→4, one gem slot's 9·10레벨,
 * one part's +19 / +20) as one row (사용자 제보 #26): the first stage in the list's
 * order heads the group, so the group takes the place of its best stage; the
 * other stages follow under it, in the same order. A candidate without a
 * change is a target of its own.
 */
export function groupStages(list: Candidate[]): { head: Candidate; more: Candidate[] }[] {
  const groups = new Map<string, { head: Candidate; more: Candidate[] }>();
  for (const c of list) {
    const ch = c.change;
    const key = ch ? `${ch.kind}:${ch.slot ?? ""}:${ch.index ?? ""}:${ch.name ?? ""}` : `id:${c.id}`;
    const group = groups.get(key);
    if (group) group.more.push(c);
    else groups.set(key, { head: c, more: [] });
  }
  return [...groups.values()];
}

/**
 * A computed (OK) row the 크라켄 점수 split cannot rank: no Δ점수 and no reason from the api (빈 보석 칸 rows,
 * v0.3.15). The web's own code, never the api's; it folds with a plain sentence instead of being dropped. Where the
 * api says why (krakenScoreReasonCode · krakenScoreReason, api #1042; optional until it ships) the 크라켄 점수 fold uses
 * its code and sentence (splitKrakenCandidates), over a combat-power reason too.
 */
export const KRAKEN_UNSCORED = "WEB_KRAKEN_UNSCORED";
export const KRAKEN_UNSCORED_REASON = "이 항목은 크라켄 점수를 아직 계산하지 않았어요.";

/**
 * Whether the api counts a row in a 크라켄 점수 list's total (SpecUpService: ranked = OK or a Δ점수): the rows
 * the answer's first `limit` were taken from, ranked on screen or folded.
 */
export const krakenRanked = (c: Pick<Candidate, "status" | "deltaKrakenScore">) => c.status === "OK" || c.deltaKrakenScore != null;

/**
 * The ranked rows (`ranked`, by default OK) in the list's order; every other row folded into one line per
 * reason, so no row is left off the screen.
 */
export function splitCandidates(
  list: Candidate[],
  ranked: (c: Candidate) => boolean = (c) => c.status === "OK",
  /** The reason a folded row shows when it is not the combat-power one (크라켄 점수: the score's own, api #1042). */
  ownReason: (c: Candidate) => { code: string; reason: string } | null = () => null,
) {
  const ok = list.filter(ranked);
  const folded = new Map<string, Folded>();
  for (const c of list) {
    if (ranked(c)) continue;
    const own = ownReason(c);
    const unscored = c.status === "OK" && !c.reasonCode;
    // An unscored row says why when the api does (krakenScoreReasonCode, api #1042: 빈 보석 칸); else the web's line.
    const code = own?.code ?? c.reasonCode ?? (unscored ? KRAKEN_UNSCORED : "UNKNOWN");
    const entry = folded.get(code) ?? {
      code,
      reason: own?.reason ?? c.reason ?? (unscored ? KRAKEN_UNSCORED_REASON : "이 항목은 아직 계산하지 않았어요."),
      kinds: [],
      candidates: [],
    };
    entry.candidates.push(c);
    const label = candidateKindLabel(c);
    if (!entry.kinds.includes(label)) entry.kinds.push(label);
    folded.set(code, entry);
  }
  // Not ranked, so in a fixed order (reason code, then id) whatever order the
  // list came in: a new order of the ranked rows moves nothing under them (A7, #857).
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {
    ok,
    folded: [...folded.values()]
      .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
      .map((entry) => {
        const candidates = [...entry.candidates].sort(byId);
        return { ...entry, candidates, kinds: [...new Set(candidates.map((c) => candidateKindLabel(c)))] };
      }),
  };
}

/**
 * The simulator's inputs for one candidate (적용해 보기): the change the
 * backend ran, in the simulator's own edit shape. Kinds the simulator does
 * not edit yet give null, and the screen shows no button for them.
 * `gearType` names the slot of an equipment index (무기, 투구 …): refine opens
 * for the weapon only (api #884), so without it a refine step gives null (#1567).
 * `armor` (ARMOR_CP_SIM): armour 재련 and 상급 재련 open too (the api's armour CP gate, PM 총괄 11-21).
 */
export function editsFor(
  change: SpecUpChange | null | undefined,
  base: Edits,
  gearType?: GearType,
  armor = false,
): Edits | null {
  if (!change) return null;
  switch (change.kind) {
    case "EQUIPMENT_REFINE":
      return change.index != null && change.refine != null && gearType && isRefineOpen(gearType(change.index), armor)
        ? { ...base, refine: { ...base.refine, [change.index]: change.refine } }
        : null;
    case "GEM_LEVEL":
      return change.slot != null && change.level != null
        ? { ...base, gems: { ...base.gems, [change.slot]: change.level } }
        : null;
    case "GEM_LEVEL_ALL":
      return change.level != null ? { ...base, gemAll: change.level } : null;
    case "EQUIPMENT_QUALITY":
      return change.index != null && change.quality != null
        ? { ...base, quality: { ...base.quality, [change.index]: change.quality } }
        : null;
    case "ENGRAVING_LEVEL":
      return change.name && change.level != null
        ? { ...base, engraving: { ...base.engraving, [change.name]: change.level } }
        : null;
    case "STONE_ENGRAVING":
      return change.name && change.level != null
        ? { ...base, stone: { ...base.stone, [change.name]: change.level } }
        : null;
    // 상급 재련: an 업화 weapon (gearType.upgrade), or armour with ARMOR_CP_SIM, inside 0..ADVANCED_REFINE_MAX.
    case "EQUIPMENT_ADVANCED_REFINE":
      return change.index != null &&
        change.level != null &&
        change.level >= 0 &&
        change.level <= ADVANCED_REFINE_MAX &&
        gearType &&
        isAdvancedRefineOpen(gearType(change.index), armor, gearType.upgrade?.(change.index) ?? false)
        ? { ...base, advanced: { ...base.advanced, [change.index]: change.level } }
        : null;
    // 완갑 (api #809): the simulator edits 팔 보호구 by level and grade; a step
    // without a grade keeps the one worn.
    case "ARM_GUARD":
      return change.level != null
        ? { ...base, armGuard: { ...base.armGuard, level: change.level, ...(change.grade ? { grade: change.grade } : {}) } }
        : null;
    // 연마 (api #951): one line of the accessory a path step buys, its option and grade, or "NONE" (a line with
    // no scoring option, no grade). Sent as it is, so opening the path gives the step's combat power. A change
    // without a line, option or grade (a list row's, which names the line's text) opens nothing.
    case "POLISH": {
      if (change.index == null || change.line == null || !change.option || change.option.length > 32) return null;
      const key = `${change.index}:${change.line}`;
      if (change.option === POLISH_NONE) {
        const polish = Object.fromEntries(Object.entries(base.polish).filter(([at]) => at !== key)) as Edits["polish"];
        return { ...base, polish, polishOption: { ...base.polishOption, [key]: POLISH_NONE } };
      }
      return isGrade(change.grade)
        ? {
            ...base,
            polish: { ...base.polish, [key]: change.grade },
            polishOption: { ...base.polishOption, [key]: change.option },
          }
        : null;
    }
    // 깨달음 카르마 (api #1004): a KARMA_LEVEL step's change is ARK_PASSIVE_POINT 깨달음 with karmaLevel (no
    // points). Point changes still open nothing here (깨달음 points stay locked).
    case "ARK_PASSIVE_POINT":
      return change.tree === KARMA_TREE && isKarmaLevel(change.karmaLevel)
        ? { ...base, karma: { ...base.karma, [KARMA_TREE]: change.karmaLevel } }
        : null;
    default:
      return null;
  }
}

const isKarmaLevel = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= KARMA_MAX;

/** A 깨달음 karma-level change (api #1004 karmaChange: ARK_PASSIVE_POINT with karmaLevel). */
export const isKarmaChange = (change: SpecUpChange) => change.kind === "ARK_PASSIVE_POINT" && change.karmaLevel != null;

/** The slot type of an equipment index ("무기", "투구" …), from the character on screen. */
/** The slot of an equipment index (무기, 투구 …); `upgrade` says whether it is 업화 (isUpgradeGear), when known. */
export type GearType = ((index: number) => string | null | undefined) & { upgrade?: (index: number) => boolean };

/** Change indexes are positions in loadout.equipment, as the simulator's own rows. */
export const gearTypeOf = (data: Pick<Character, "loadout"> | null | undefined): GearType =>
  Object.assign((index: number) => data?.loadout.equipment[index]?.type, {
    upgrade: (index: number) => isUpgradeGear(data?.loadout.equipment[index]?.name),
  });

/** ?try= on the simulator tab carries one change; readTry reads it back. */
export const tryParam = (change: SpecUpChange) => JSON.stringify(change);

/** ?try= for a whole path (스펙업 목표 "시뮬레이터에서 열기"). */
export const tryPathParam = (changes: SpecUpChange[]) => JSON.stringify(changes);

function parseJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function readTry(text: string | null): SpecUpChange | null {
  return changeOf(parseJson(text));
}

/** One change or a list of them, in order; anything unreadable is left out. */
export function readTryPath(text: string | null): SpecUpChange[] {
  const value = parseJson(text);
  const list = Array.isArray(value) ? value : [value];
  return list.slice(0, 64).flatMap((item) => {
    const change = changeOf(item);
    return change ? [change] : [];
  });
}

function changeOf(value: unknown): SpecUpChange | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.kind !== "string") return null;
  const int = (key: string) => (Number.isInteger(v[key]) ? (v[key] as number) : null);
  return {
    kind: v.kind,
    slot: int("slot"),
    index: int("index"),
    level: int("level"),
    refine: int("refine"),
    quality: int("quality"),
    name: typeof v.name === "string" ? v.name : null,
    // 완갑 (ARM_GUARD): the grade a step raises it to. Dropped here, a grade-up
    // step opened with the old grade and other numbers than the path (#1256
    // codex P1). From the address, so only the known grades are read.
    // Optional in the contract: only a change that has one carries it back.
    ...((ARM_GUARD_GRADES as readonly unknown[]).includes(v.grade) ? { grade: v.grade as string } : {}),
    // 연마 step lines (api #951): the line, its option ("NONE" too) and LOW·MID·HIGH. Dropped, a path opened
    // with the steps' 연마 left out and other numbers than the path.
    ...(v.kind === "POLISH"
      ? {
          line: int("line"),
          option: typeof v.option === "string" && v.option.length <= 32 ? v.option : null,
          ...(isGrade(v.grade) ? { grade: v.grade } : {}),
        }
      : {}),
    // 깨달음 카르마 steps (api #1004): the tree and the level. Dropped, a path opened without its karma step.
    ...(v.kind === "ARK_PASSIVE_POINT" && v.tree === KARMA_TREE && isKarmaLevel(v.karmaLevel)
      ? { tree: KARMA_TREE, karmaLevel: v.karmaLevel }
      : {}),
  };
}

/**
 * 크라켄 점수 정렬 (api #573): the ranked rows are every candidate with a score
 * change, in the answer's order — a candidate the combat power simulator
 * cannot price can still raise the score (its cost then comes too). The rest
 * fold by reason as before.
 */
export function splitKrakenCandidates(list: Candidate[]) {
  // Rows with no Δ점수 fold, an OK one too (it was dropped before: neither ranked nor folded).
  // A row folds here for want of a Δ점수, so the score's own reason (krakenScoreReasonCode, api #1042) comes first,
  // before a combat-power one (a supporter's UNSUPPORTED row carries both).
  return splitCandidates(
    list,
    (c) => c.deltaKrakenScore != null,
    (c) => (c.krakenScoreReasonCode ? { code: c.krakenScoreReasonCode, reason: c.krakenScoreReason ?? KRAKEN_UNSCORED_REASON } : null),
  );
}

/** Why the 크라켄 점수 sort could not be used; the list then comes in 전투력 효율 order. */
export function krakenUnavailableCopy(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const why =
    reason === "DISABLED"
      ? "크라켄 점수 (10만G당) 정렬은 아직 준비 중이에요."
      : reason === "INPUT_PENDING"
        ? "점수 계산에 필요한 정보를 아직 모으고 있어요."
        : reason === "ROLE_UNKNOWN"
          ? "이 캐릭터의 역할(딜러·서포터)을 확인하지 못했어요."
          : reason === "SUPPORTER_PENDING"
            ? "서포터의 크라켄 점수 (10만G당) 정렬은 준비 중이에요."
            : reason === "SCORE_UNAVAILABLE"
              ? "이 캐릭터의 크라켄 점수를 계산하지 못했어요."
              : "지금은 크라켄 점수 (10만G당)으로 정렬할 수 없어요.";
  return `${why} ${sortName("EFFICIENCY")}으로 보여 드려요.`;
}

// The same, short enough for the sort bar (the sentence above is read out).
const KRAKEN_NOTES: Record<string, string> = {
  DISABLED: "점수 정렬 준비 중",
  INPUT_PENDING: "점수 정보 모으는 중",
  ROLE_UNKNOWN: "역할 확인 못 함",
  SUPPORTER_PENDING: "서포터 점수 준비 중",
  SCORE_UNAVAILABLE: "점수 계산 못 함",
};
const KRAKEN_NOTE_OTHER = "지금은 점수 정렬 불가";

/** "점수 정렬 준비 중 · 효율 순": what the bar shows in place of the cooldown toggle. */
export function krakenUnavailableNote(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return `${KRAKEN_NOTES[reason] ?? KRAKEN_NOTE_OTHER} · 효율 순`;
}

/** Every note the bar can show, for holding the room of the longest one. */
export const KRAKEN_NOTE_ALL = [...Object.values(KRAKEN_NOTES), KRAKEN_NOTE_OTHER].map((why) => `${why} · 효율 순`);
