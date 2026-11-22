// Combat-power simulator (backend #240, combat-power-sim-v0). The backend owns
// the formula; this module turns the screen's edits into `changes` and labels
// the answer. Items whose formula is not verified yet come back UNSUPPORTED
// with no number, and the screen says so instead of guessing.
import type { components } from "../api/combat-power-schema";
import { characterNameError, normalizeCharacterName } from "../character/model";
import { rateLimitCopy } from "../api/rate-limit";
import {
  GEM_BASE_WILL,
  GEM_MAX,
  GEM_MIN,
  WILL_SHORT,
  gemEditError,
  gemKey,
  sameGem,
  type CurrentGem,
  type GemEdit,
} from "./ark-gems";

type Schemas = components["schemas"];
export type Change = Schemas["ChangeRequest"];
export type SimulateRequest = Schemas["CombatPowerSimulationRequest"];
export type Simulation = Schemas["CombatPowerSimulationResponse"];
export type Contribution = Schemas["ContributionResponse"];
export type Options = Schemas["CombatPowerOptionsResponse"];
export type SimulateEnvelope = { code: string; message: string; data: Simulation };
export type OptionsEnvelope = { code: string; message: string; data: Options };

export const MAX_CHANGES = 64;
/** Backend #240 range for ARK_PASSIVE_POINT (options has no field for it yet). */
export const ARK_PASSIVE_MAX = 999;

/**
 * 1차판(PM 총괄 2026-10-10 23:59): only the kinds that matched the target
 * site's simulator can be changed — gems, quality, engravings and stones.
 * The rest show their current value as "준비 중" until calc verification
 * finds the cause and they join the 2차판 (no made-up values).
 */
export const OPEN_KINDS: ReadonlySet<string> = new Set([
  "GEM_LEVEL_ALL",
  "GEM_LEVEL",
  "EQUIPMENT_QUALITY",
  "ENGRAVING_LEVEL",
  "STONE_ENGRAVING",
  // backend #332 (bracelet families) and #342 (팔 보호구), sim v8
  "BRACELET_EFFECT",
  "ARM_GUARD",
  // api #460: polish lines take the line's own option and value (무공 too).
  "POLISH",
  // api #838: core grade and point (계산 검증 1,060/1,060), PM 총괄 11-15.
  "ARK_GRID_CORE",
  // api #1079: a gem swapped in a core (계산 검증 G1); the screen and the proxy open it with ARK_GEM_SIM only.
  "ARK_GRID_GEM",
]);
export const isOpen = (kind: Change["kind"]) => OPEN_KINDS.has(kind);

/**
 * Refine opens for the weapon only (api #884, v0.3.11): the backend computes
 * the weapon's refine, while armour refine comes back UNSUPPORTED
 * (MODEL_UNCONFIRMED, api #866) until its formula is confirmed, so armour rows
 * stay "준비 중" (PM 총괄 11-12).
 */
export const isRefineOpen = (type: string | null | undefined, armor = false) =>
  isOpen("EQUIPMENT_REFINE") || type === "무기" || (armor && !!type);

/**
 * 업화 gear, by the api's own rule (CombatPowerRefineModel: the item name contains 업화). The contract has no family
 * field, and grade / tier do not tell 업화 from 전율 (both tier 4 고대).
 */
export const isUpgradeGear = (name: string | null | undefined) => !!name?.includes("업화");

/**
 * 상급 재련, where it opens:
 * - The weapon when it is 업화 (`upgrade`): the api computes it and 계산 검증 matched the baseline (11-21 04:36, 1 → 40
 *   within 0.01 CP). 전율 · 에스더 · special · 결단 weapons have no model, so their field is hidden (currentOf).
 * - Armour with the api's armour CP gate (ARMOR_CP_SIM, `armor`): the api lifts its hold on armour 재련 · 상급 재련 ·
 *   완갑 for a dealer whose item-built CP matches the official CP.
 */
export const isAdvancedRefineOpen = (type: string | null | undefined, armor = false, upgrade = false) =>
  isOpen("EQUIPMENT_ADVANCED_REFINE") || (type === "무기" ? upgrade : armor && !!type);

/**
 * The api's refine bounds (combat-power options refineMin / refineMax / advancedRefineMax; the screen reads them
 * from the options, the proxy guard from here). tests/combat-power-karma.test.ts holds them to the committed
 * options fixture, so the two cannot drift apart unseen.
 */
export const REFINE_MIN = 10;
export const REFINE_MAX = 25;
export const ADVANCED_REFINE_MAX = 40;

/**
 * Ark passive trees the simulator takes, one by one: 도약 (api #842), 진화 (api #965, PM 총괄 11-16).
 * 깨달음 stays "준비 중": the api computes it only at 100 or less (now and new value), and nearly every
 * character is at 101 (계산 검증 11-15: 27 of 28), so it would mostly read '계산 준비 중'. It opens once the
 * api computes above 100 (C-ENL, PM 총괄 11-16).
 */
export const OPEN_ARK_PASSIVE_TREES: ReadonlySet<string> = new Set<string>(["도약", "진화"]);
export const isArkPassiveOpen = (tree: string) => isOpen("ARK_PASSIVE_POINT") || OPEN_ARK_PASSIVE_TREES.has(tree);

/**
 * The in-game maximum of a tree's points, so the input cannot reach a combat
 * power that cannot exist (the api takes 0~999; PM 총괄 11-15). 도약 70 = 팔찌
 * 고대 +18, 전투 레벨 51 이상 +40, 카르마 랭크 +12. Source: official game guide
 * '아크 패시브', https://m-lostark.game.onstove.com/GameGuide/Pages/아크%20패시브
 * (최근수정일 2026-06-24), read by 레퍼런스 and 계산 검증 11-15.
 * 진화 140 = 고대 방어구 24 × 5 + 전투 레벨 20: official notice no. 13307 (2025-12-10, 4티어 추가·진화
 * 포인트 상향) and a public analysis post (2025-12-11); the api holds the same cap (api #965,
 * combat-power/ark-passive-coefficients.json evolutionMaxPoints). PM 총괄 11-16.
 * 깨달음 101 = 장신구 61 + 전투 레벨 20 + 카르마 6 + 물약 14: official guides '아크 패시브' (2026-06-24) and
 * '장신구 연마' (2025-06-24), 물약 from a public tip post (2025-01-20); 계산 검증 record '전투력 시뮬레이터 남은 4종
 * 기준 정리' (2026-11-15: 27 of 28 official characters at 101, none above); the api's limit too (api #965). It
 * holds a saved value while the tree is locked.
 */
export const ARK_PASSIVE_TREE_MAX: Readonly<Record<string, number>> = { 도약: 70, 진화: 140, 깨달음: 101 };
/** The note beside a tree's points field (review P3 #1706): its in-game maximum; none without a known one. */
export const arkPassiveNote = (tree: string) => (tree in ARK_PASSIVE_TREE_MAX ? `최대 ${arkPassiveMax(tree)}` : undefined);
export const arkPassiveMax = (tree: string) => ARK_PASSIVE_TREE_MAX[tree] ?? ARK_PASSIVE_MAX;

/**
 * The 혼돈의 별 : 무기 core counts through weapon attack and the api does not
 * compute it yet (api #838, WEAPON_CORE_REASON), so its row stays "준비 중".
 */
export const WEAPON_CORE = "혼돈의 별 코어 : 무기";
export const isCoreOpen = (name: string) => isOpen("ARK_GRID_CORE") && !name.trim().startsWith(WEAPON_CORE);

/** 전율 gear has no advanced refining (the backend's refine model reads the
 * same name: "전율 장비에는 상급 재련이 없습니다."). */
export const hasNoAdvancedRefine = (name: string | null | undefined) => !!name?.includes("전율");
export const NO_ADVANCED_REFINE = "전율 장비에는 상급 재련이 없어요.";

/** Weapon and armour: the slots that take refine and quality in the first cut. */
export const GEAR_TYPES = ["무기", "투구", "상의", "하의", "장갑", "어깨"] as const;

/** Labels for the kinds the backend knows; a newer kind shows its own name. */
export const KIND_LABEL: Record<string, string> = {
  GEM_LEVEL_ALL: "보석 일괄",
  GEM_LEVEL: "보석",
  EQUIPMENT_REFINE: "재련",
  EQUIPMENT_ADVANCED_REFINE: "상급 재련",
  EQUIPMENT_QUALITY: "품질",
  POLISH: "연마",
  BRACELET_EFFECT: "팔찌",
  ENGRAVING_LEVEL: "각인",
  STONE_ENGRAVING: "스톤",
  ARK_PASSIVE_POINT: "아크 패시브",
  ARK_GRID_CORE: "아크 그리드",
  ARK_GRID_GEM: "아크 그리드 젬",
  ARM_GUARD: "팔 보호구",
};

/** What the user has changed, keyed by the target the backend uses. */
export type Edits = {
  gemAll: number | null;
  gems: Record<number, number>;
  refine: Record<number, number>;
  quality: Record<number, number>;
  /** Advanced refining step per equipment index (search advancedRefineLevel, web #374). */
  advanced: Record<number, number>;
  /** Polish grade per `${index}:${line}` (the option stays, unless polishOption names another). */
  polish: Record<string, Grade>;
  /**
   * Another option for a polish line, per `${index}:${line}`, as the request's option ("추가 피해 %", a % option
   * ending in " %"), or POLISH_NONE for a line with no scoring option. Only a spec-up 연마 step sets it: the
   * step buys another accessory, so its lines change option, not only grade (api #951).
   */
  polishOption: Record<string, string>;
  /** Bracelet grade per line. */
  bracelet: Record<number, Grade>;
  /** Bracelet option family per line (options.braceletOptions name, "없음" removes it; backend #332). */
  braceletName: Record<number, string>;
  engraving: Record<string, number>;
  stone: Record<string, number>;
  arkPassive: Record<string, number>;
  /** 깨달음 카르마 레벨 (api #1004), keyed by the tree (깨달음), apart from its points. */
  karma: Record<string, number>;
  core: Record<number, { grade: string; point: number }>;
  /** 아크 그리드 젬 swapped in, per gemKey (`${slotIndex}:${index}`; api #1079). */
  arkGem: Record<string, GemEdit>;
  /** 팔 보호구(완갑) step and grade (backend #342). */
  armGuard: { level?: number; grade?: string };
};
export const NO_EDITS: Edits = {
  gemAll: null,
  gems: {},
  refine: {},
  quality: {},
  advanced: {},
  polish: {},
  polishOption: {},
  bracelet: {},
  braceletName: {},
  engraving: {},
  stone: {},
  arkPassive: {},
  karma: {},
  core: {},
  arkGem: {},
  armGuard: {},
};

/** The POLISH option of a line with no scoring option (0 combat power, no grade; api #951). */
export const POLISH_NONE = "NONE";
/** How such a line reads on screen, the api's own words for it: never the raw code. */
export const POLISH_NONE_TEXT = "점수 옵션 없는 줄";

/**
 * A polish option as the screen names it: the request's " %" mark dropped ("추가 피해 %" → "추가 피해"),
 * and POLISH_NONE in words.
 */
export const polishOptionText = (option: string) =>
  option === POLISH_NONE ? POLISH_NONE_TEXT : option.replace(/\s*%$/, "");

/**
 * The table value of a polish option the line changes to (a 연마 step's new accessory, api #951), e.g.
 * "추가 피해 %" HIGH → "+2.60%". The request option says % or flat by its " %"; null when not in the table.
 */
export function polishSwapValue(
  values: PolishValues | undefined,
  option: string,
  grade: string,
  part?: string | null,
): string | null {
  const percent = /\s%$/.test(option);
  const name = option.replace(/\s*%$/, "");
  // The row for this accessory's part when it is known (목걸이·귀걸이·반지 each list their own options).
  const row = values?.options.find(
    (item) => item.option === name && item.percent === percent && (!part || item.parts.includes(part)),
  );
  if (!row) return null;
  return (grade === "LOW" ? row.low : grade === "MID" ? row.mid : grade === "HIGH" ? row.high : null) ?? null;
}

export const GRADES = ["LOW", "MID", "HIGH"] as const;
export type Grade = (typeof GRADES)[number];
/** Official tooltip colours map to 하·중·상 (backend PolishEffectResponse). */
export const GRADE_LABEL: Record<string, string> = { LOW: "하", MID: "중", HIGH: "상" };

export type Current = {
  /** `label`: the row's visible name (gemLabels); `name`, the gem's own, stays its identity. */
  gems: { slot: number; level: number; name?: string; label?: string }[];
  /** `upgrade`: 업화 gear (isUpgradeGear); the weapon's 상급 재련 opens only then. */
  gear: { index: number; type?: string | null; refine: number | null; quality: number | null; advanced?: number | null; upgrade?: boolean }[];
  /** `value` is the worn line's text value ("+1.60%"), `part` the accessory's type (목걸이 …), when known. */
  polish?: { index: number; line: number; option: string; grade: Grade | null; value?: string; part?: string | null }[];
  bracelet?: { line: number; name: string; grade: Grade | null }[];
  engravings?: { name: string; level: number }[];
  stones?: { name: string; level: number }[];
  arkPassive?: { tree: string; points: number }[];
  /** 깨달음 카르마 레벨 worn, only where the screen edits it (isKarmaSimEnabled) and the level was read. */
  karma?: number | null;
  cores?: { slotIndex: number; name?: string; grade: string; point: number }[];
  /** The gems a swap can start from (ARK_GEM_SIM on; currentGems). */
  arkGems?: CurrentGem[];
  armGuard?: { level: number; grade: string } | null;
  /** Armour 재련 · 상급 재련 open on this screen (ARMOR_CP_SIM). Unset: as before, the weapon's refine only. */
  armor?: boolean;
};

/**
 * Each gem row's visible name (and its level select's name with '레벨'), by slot (QA v0.3.15 RC P2-1: on real data the
 * rows read only the gem's name, '6레벨 광휘의 보석 (귀속)' eleven times). The skill the official gem effects give
 * for the slot comes first, as the spec-up list names a gem ('<skill> · <gem>'); rows that would still read the same
 * (no skill, or the same skill and gem twice) add their slot ('(3번 칸)'). Display only: the gem's own name stays the
 * row's identity (input history).
 */
export function gemLabels(
  gems: readonly { slot: number; name: string }[],
  skills: readonly { gemSlot?: number | null; name?: string | null }[] | null | undefined,
): Map<number, string> {
  const skillOf = new Map<number, string>();
  for (const effect of skills ?? []) if (effect.gemSlot != null && effect.name) skillOf.set(effect.gemSlot, effect.name);
  const base = gems.map((gem) => [gem.slot, skillOf.has(gem.slot) ? `${skillOf.get(gem.slot)} · ${gem.name}` : gem.name] as const);
  const count = new Map<string, number>();
  for (const [, name] of base) count.set(name, (count.get(name) ?? 0) + 1);
  return new Map(base.map(([slot, name]) => [slot, (count.get(name) ?? 0) > 1 ? `${name} (${slot + 1}번 칸)` : name]));
}

/** The tree whose karma level the simulator edits, and the request's range (api #1004 KARMA_MAX_LEVEL). */
export const KARMA_TREE = "깨달음";
export const KARMA_MAX = 30;

/**
 * The 깨달음 karma level of the point named 깨달음 (not the first point with a level: 진화 and 도약 carry one too).
 * - The api's karmaLevel (api #1023) when the field is there: it wins over the description.
 * - The field absent (an api before #1023; the contract keeps it optional for the deploy order) or null: read the
 *   description ("6랭크 29레벨") as the api reads it (CombatPowerRefineModel.karmaLevel: the first "N레벨").
 * null when neither gives a level in the request's range (0~30): the field stays hidden, as the api would answer
 * that it could not read it. A field outside that range is not read from the description instead.
 */
export function karmaLevelOf(
  points: readonly { name?: string | null; description?: string | null; karmaLevel?: number | null }[] | null | undefined,
) {
  const point = points?.find((item) => item.name === KARMA_TREE);
  if (!point) return null;
  const parsed = point.description?.match(/(\d+)레벨/)?.[1];
  const value = point.karmaLevel != null ? point.karmaLevel : parsed == null ? null : Number(parsed);
  return value != null && Number.isInteger(value) && value >= 0 && value <= KARMA_MAX ? value : null;
}

export type PolishValues = NonNullable<Options["polishValues"]>;

/**
 * The official tooltip value of a polish option at a grade (backend #254),
 * e.g. 추가 피해 HIGH → "+2.60%". The table is for 고대 1680 장신구 only, so it
 * applies only when this accessory's own line matches it: its current value
 * equals the table at its current grade (or, grade unknown, at some grade).
 * Another tier's accessory (other values) gets the grade alone (PM-프론트 #447
 * P1). The same name can be a % or a flat option (공격력·무기 공격력), told
 * apart by the current value's "%". null when it does not fit or has no cell.
 */
export function polishValue(
  values: PolishValues | undefined,
  option: string,
  current: { value: string; grade: string | null },
  grade: string,
): string | null {
  const percent = current.value.includes("%");
  const row = values?.options.find((item) => item.option === option && item.percent === percent);
  if (!row) return null;
  const at = (g: string) => (g === "LOW" ? row.low : g === "MID" ? row.mid : g === "HIGH" ? row.high : null) ?? null;
  const fits = current.grade ? at(current.grade) === current.value : [row.low, row.mid, row.high].includes(current.value);
  return fits ? at(grade) : null;
}

/** "상(+2.60%)" when the value is known, else just "상" (PM-프론트 #370 P2). */
export function gradeWithValue(grade: string, value: string | null) {
  const label = GRADE_LABEL[grade] ?? grade;
  return value ? `${label}(${value})` : label;
}

/** "치명타 피해 +8.40%" → "치명타 피해": the effect name the backend echoes back. */
export const braceletName = (text: string) =>
  text.split(/\s*[+\-−]?\d/)[0].trim() || text.trim();

/** The refine steps the api takes (options refineMin..refineMax); unknown until the options load. */
export type RefineRange = { min: number; max: number } | null | undefined;

/**
 * A refine edit the api takes, or null: the weapon only (isRefineOpen), inside
 * the options range, and not the step worn. A saved pick of +8 (the weapon's own
 * step, under refineMin 10) read after the weapon was honed in game, a spec-up
 * step past refineMax or an armour step would be refused (codex #1555, #1567),
 * so they count as no edit and the row shows the step worn. Until the options
 * arrive the range is unknown, so nothing is sent yet: the edit goes out with
 * the first answer that has the range, or never if it is outside (codex #1572 P3).
 */
export function refineEdit(
  edit: number | null | undefined,
  item: Current["gear"][number],
  range: RefineRange,
  armor = false,
): number | null {
  if (edit == null || item.refine == null || edit === item.refine || !isRefineOpen(item.type, armor)) return null;
  if (!range || edit < range.min || edit > range.max) return null;
  return edit;
}

/**
 * The other option a polish line is set to (a spec-up 연마 step, api #951), or null when it keeps the worn
 * one. Not while POLISH is locked (the card cannot show or undo it). A line set back to its worn option (a
 * later step's reset line on the same accessory, api #951) is the worn line: its grade, if another, is an
 * ordinary grade edit. Without the worn value the % mark cannot be told, so the option stays as given.
 */
export function polishSwapOf(
  edits: Edits,
  line: { index: number; line: number; option: string; value?: string },
): string | null {
  const option = edits.polishOption[`${line.index}:${line.line}`];
  if (option == null || !isOpen("POLISH")) return null;
  if (line.value != null && option === (line.value.includes("%") ? `${line.option} %` : line.option)) return null;
  return option;
}

/** 연마 한꺼번에 (PM 총괄 11-21, X1): every line at one grade, or every line with no scoring option. */
export type PolishPreset = Grade | typeof POLISH_NONE;
type PolishLine = { index: number; line: number; option: string; grade: Grade | null; value?: string };

/**
 * Every polish line at once (one setEdits, one 이전 step). A grade keeps each line's own option, the worn one (a
 * line set to another option or to no scoring option goes back to its worn option first), at that grade: the
 * values are the official polish table's, as for one line. POLISH_NONE makes every line a line with no scoring
 * option (no grade). A grade a line already wears is no edit, so it sends nothing for that line.
 */
export function polishPreset(edits: Edits, lines: readonly PolishLine[], preset: PolishPreset): Edits {
  const keys = lines.map((line) => `${line.index}:${line.line}`);
  const keep = <T,>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([at]) => !keys.includes(at)));
  if (preset === POLISH_NONE)
    return {
      ...edits,
      polish: keep(edits.polish) as Edits["polish"],
      polishOption: { ...keep(edits.polishOption), ...Object.fromEntries(keys.map((key) => [key, POLISH_NONE])) },
    };
  const graded = lines.flatMap((line, i) => (line.grade === preset ? [] : [[keys[i], preset] as const]));
  return { ...edits, polish: { ...keep(edits.polish), ...Object.fromEntries(graded) }, polishOption: keep(edits.polishOption) };
}

/** The preset every line is at now (its button pressed), or null when the lines differ or there are none. */
export function polishPresetOf(edits: Edits, lines: readonly PolishLine[]): PolishPreset | null {
  if (lines.length === 0) return null;
  const states = lines.map((line) => {
    const swap = polishSwapOf(edits, line);
    if (swap === POLISH_NONE) return POLISH_NONE;
    if (swap != null) return null;
    return edits.polish[`${line.index}:${line.line}`] ?? line.grade;
  });
  return states.every((state) => state != null && state === states[0]) ? (states[0] as PolishPreset) : null;
}

/** A polish line back to the one worn: its other option and grade go (one 이전 step). */
export function wornPolish(edits: Edits, key: string): Edits {
  const drop = <T,>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([at]) => at !== key));
  return { ...edits, polish: drop(edits.polish) as Edits["polish"], polishOption: drop(edits.polishOption) };
}

/**
 * Only real differences become changes, in a fixed order (gems, gear, then the
 * rest in screen order), so
 * the same edits always send the same body and hit the same cache entry.
 */
export function toChanges(edits: Edits, current: Current, range?: RefineRange): Change[] {
  const changes: Change[] = [];
  const allLevel = edits.gemAll;
  if (allLevel != null && current.gems.some((gem) => gem.level !== allLevel))
    changes.push({ kind: "GEM_LEVEL_ALL", level: allLevel });
  for (const gem of current.gems) {
    const level = edits.gems[gem.slot];
    const base = allLevel ?? gem.level;
    if (level != null && level !== base)
      changes.push({ kind: "GEM_LEVEL", slot: gem.slot, level });
  }
  for (const item of current.gear) {
    const refine = refineEdit(edits.refine[item.index], item, range, current.armor);
    if (refine != null) changes.push({ kind: "EQUIPMENT_REFINE", index: item.index, refine });
    const quality = edits.quality[item.index];
    if (quality != null && item.quality != null && quality !== item.quality)
      changes.push({ kind: "EQUIPMENT_QUALITY", index: item.index, quality });
    // Only where 상급 재련 is open (an 업화 weapon; armour with ARMOR_CP_SIM): elsewhere no edit reaches here, as before.
    const advanced = edits.advanced[item.index];
    if (
      advanced != null &&
      item.advanced != null &&
      advanced !== item.advanced &&
      isAdvancedRefineOpen(item.type, current.armor, item.upgrade) &&
      advanced >= 0 &&
      advanced <= ADVANCED_REFINE_MAX
    )
      changes.push({ kind: "EQUIPMENT_ADVANCED_REFINE", index: item.index, level: advanced });
  }
  // Nothing for polish while the card is locked: it cannot show or undo an edit (review P3 #1700).
  for (const line of isOpen("POLISH") ? (current.polish ?? []) : []) {
    const key = `${line.index}:${line.line}`;
    const grade = edits.polish[key];
    const option = polishSwapOf(edits, line);
    // A line with no scoring option has no grade (api #951).
    if (option === POLISH_NONE) changes.push({ kind: "POLISH", index: line.index, line: line.line, option });
    else if (option != null) {
      const to = grade ?? line.grade;
      if (to) changes.push({ kind: "POLISH", index: line.index, line: line.line, option, grade: to });
    } else if (grade && grade !== line.grade)
      changes.push({ kind: "POLISH", index: line.index, line: line.line, option: line.option, grade });
  }
  for (const line of current.bracelet ?? []) {
    // The family (braceletOptions name) or the grade, or both (backend #332).
    const name = edits.braceletName[line.line] ?? line.name;
    const grade = edits.bracelet[line.line] ?? line.grade;
    if ((name !== line.name || grade !== line.grade) && grade)
      changes.push({ kind: "BRACELET_EFFECT", line: line.line, name, grade });
  }
  for (const item of current.engravings ?? []) {
    const level = edits.engraving[item.name];
    if (level != null && level !== item.level)
      changes.push({ kind: "ENGRAVING_LEVEL", name: item.name, level });
  }
  for (const item of current.stones ?? []) {
    const level = edits.stone[item.name];
    if (level != null && level !== item.level)
      changes.push({ kind: "STONE_ENGRAVING", name: item.name, level });
  }
  // Nothing for a row the screen keeps locked: it cannot show or undo an edit.
  for (const item of (current.arkPassive ?? []).filter((item) => isArkPassiveOpen(item.tree))) {
    const points = edits.arkPassive[item.tree];
    // Over the in-game maximum (an old saved input, say): not sent.
    if (points != null && points !== item.points && points <= arkPassiveMax(item.tree))
      changes.push({ kind: "ARK_PASSIVE_POINT", tree: item.tree, points });
  }
  // 깨달음 카르마 레벨 (api #1004): its own field, never with points.
  const karma = edits.karma[KARMA_TREE];
  if (current.karma != null && karma != null && karma !== current.karma && karma >= 0 && karma <= KARMA_MAX)
    changes.push({ kind: "ARK_PASSIVE_POINT", tree: KARMA_TREE, karmaLevel: karma });
  for (const item of (current.cores ?? []).filter((item) => isCoreOpen(item.name ?? ""))) {
    const edit = edits.core[item.slotIndex];
    if (edit && (edit.grade !== item.grade || edit.point !== item.point))
      changes.push({ kind: "ARK_GRID_CORE", slotIndex: item.slotIndex, grade: edit.grade, point: edit.point });
  }
  // A gem swap goes out only when it differs from the gem worn and is one the api takes (gemEditError).
  for (const gem of current.arkGems ?? []) {
    const swap = edits.arkGem[gemKey(gem)];
    if (swap && !sameGem(swap, gem.edit) && !gemEditError(swap, gem.series)) changes.push(gemChange(gem, swap));
  }
  const guard = current.armGuard;
  if (guard) {
    const level = edits.armGuard.level ?? guard.level;
    const grade = edits.armGuard.grade ?? guard.grade;
    if (level !== guard.level || grade !== guard.grade) changes.push({ kind: "ARM_GUARD", level, grade });
  }
  return changes.slice(0, MAX_CHANGES);
}

/** Supporters and unjudged roles are not computed at all (backend #332): one line, not one per row. */
export const ROLE_REASONS: ReadonlySet<string> = new Set(["SUPPORTER_MODEL_PENDING", "ROLE_UNKNOWN"]);

/**
 * The armour CP gate's reason (api PR3): the item-built CP misses the official CP by more than the gate, so the api
 * does not compute armour 재련 · 상급 재련 · 완갑 for this character. Its own sentence goes in basis / reason.
 */
export const ARMOR_CP_RESIDUAL = "ARMOR_CP_RESIDUAL_HIGH";

/**
 * A change the api does not compute for this character (the armour CP gate), or a gem swap that leaves its core
 * short of 의지력 (ARK_GRID_WILL_SHORT, api #1079: which gem the game turns off is not known): '계산하지 않음', never
 * 'coming soon'.
 * One test for the 바꾼 것 row and the 예상 전투력 note, so the two never say different things (v0.3.15 RC P1-1).
 */
export const notComputedHere = (item: { reasonCode?: string | null }) =>
  item.reasonCode === ARMOR_CP_RESIDUAL || item.reasonCode === WILL_SHORT;

/** 팔 보호구 grades the simulator takes (backend #342). */
export const ARM_GUARD_GRADES = ["영웅", "전설", "유물", "고대"] as const;
export const ARM_GUARD_MAX = 25;

/** The effective level a gem shows while editing (its own edit, then the bulk one). */
/** One gem swap as the api takes it (api #1079): the gem by core slot and gem index, then the gem swapped in. */
export const gemChange = (gem: { slotIndex: number; index: number }, swap: GemEdit): Change => ({
  kind: "ARK_GRID_GEM",
  slotIndex: gem.slotIndex,
  index: gem.index,
  gemType: swap.gemType,
  willEfficiency: swap.willEfficiency,
  point: swap.point,
  effects: swap.effects.map((effect) => ({ name: effect.name, level: effect.level })),
});

export function gemLevel(edits: Edits, gem: { slot: number; level: number }) {
  return edits.gems[gem.slot] ?? edits.gemAll ?? gem.level;
}

const KINDS = new Set(Object.keys(KIND_LABEL));
const int = (value: unknown) => Number.isInteger(value);

/**
 * A 깨달음 카르마 change as the api takes it (api #1004): ARK_PASSIVE_POINT, tree 깨달음, a level 0~30, no points or
 * level beside it. Only with KARMA_SIM on: off (production until the api switch opens), the proxy forwards none
 * (PM 총괄 #1815 P2).
 */
const karmaAllowed = (out: Record<string, unknown>, karma: boolean) =>
  karma &&
  out.kind === "ARK_PASSIVE_POINT" &&
  out.tree === KARMA_TREE &&
  out.points === undefined &&
  out.level === undefined &&
  (out.karmaLevel as number) >= 0 &&
  (out.karmaLevel as number) <= KARMA_MAX;

/**
 * Exactly these fields on the change as it came in (`raw`, before the general pass drops unknown keys): an extra key
 * is a local 400, never stripped and sent on (PM-프론트 #1843 P2).
 */
const only = (raw: Record<string, unknown>, keys: string[]) =>
  Object.keys(raw).every((key) => key === "kind" || keys.includes(key)) && keys.every((key) => raw[key] !== undefined);

/**
 * 재련 · 상급 재련 · 완갑: exactly the fields the simulator sends, inside the api's bounds.
 * - 상급 재련 always: index + level, 0..ADVANCED_REFINE_MAX (the 업화 weapon's opens without a flag, PM 총괄 11-21). The
 *   proxy cannot tell armour from the weapon (index is the search answer's equipment position), so an armour index
 *   passes too: the api's armour switch (spec-up.armor-cp-gate.enabled) is what holds armour 상급 재련, as it holds
 *   armour 재련 (backend must hold).
 * - 재련 with ARMOR_CP_SIM on: index + refine, REFINE_MIN..REFINE_MAX; off, as before (the weapon's, api #884).
 * - 완갑 (api #342): level 0..ARM_GUARD_MAX and a grade the simulator offers (the api rejects others; PM-프론트 P3).
 */
const changeAllowed = (raw: Record<string, unknown>, out: Record<string, unknown>, armor: boolean) => {
  if (out.kind === "EQUIPMENT_ADVANCED_REFINE")
    return only(raw, ["index", "level"]) && (out.index as number) >= 0 && (out.level as number) >= 0 && (out.level as number) <= ADVANCED_REFINE_MAX;
  if (out.kind === "EQUIPMENT_REFINE" && armor)
    return only(raw, ["index", "refine"]) && (out.index as number) >= 0 && (out.refine as number) >= REFINE_MIN && (out.refine as number) <= REFINE_MAX;
  if (out.kind === "ARM_GUARD")
    return (
      only(raw, ["level", "grade"]) &&
      (out.level as number) >= 0 &&
      (out.level as number) <= ARM_GUARD_MAX &&
      (ARM_GUARD_GRADES as readonly unknown[]).includes(out.grade)
    );
  return true;
};

const gemLevelOk = (n: unknown) => int(n) && (n as number) >= GEM_MIN && (n as number) <= GEM_MAX;

/**
 * 아크 그리드 젬 (api #1079), only with ARK_GEM_SIM on (off: production until its api ships, the proxy forwards none):
 * exactly slotIndex · index · gemType · willEfficiency · point · effects, a type the api knows, 1~5 bounds, two
 * options of only name (≤16) and level. Which type and options fit the core is the api's check (it knows the core).
 * Returns the clean fields, or null.
 */
function gemFields(raw: Record<string, unknown>, gem: boolean): Record<string, unknown> | null {
  if (!gem || !only(raw, ["slotIndex", "index", "gemType", "willEfficiency", "point", "effects"])) return null;
  const { slotIndex, index, gemType, willEfficiency, point, effects } = raw;
  if (!int(slotIndex) || (slotIndex as number) < 0 || !int(index) || (index as number) < 0) return null;
  if (typeof gemType !== "string" || !Object.hasOwn(GEM_BASE_WILL, gemType)) return null;
  if (!gemLevelOk(willEfficiency) || !gemLevelOk(point)) return null;
  if (!Array.isArray(effects) || effects.length !== 2) return null;
  const clean = [];
  for (const effect of effects) {
    if (!effect || typeof effect !== "object") return null;
    const { name, level } = effect as Record<string, unknown>;
    if (!only(effect as Record<string, unknown>, ["name", "level"])) return null;
    if (typeof name !== "string" || !name || name.length > 16 || !gemLevelOk(level)) return null;
    clean.push({ name, level });
  }
  return { kind: "ARK_GRID_GEM", slotIndex, index, gemType, willEfficiency, point, effects: clean };
}

/**
 * Server-side guard before the body leaves the proxy. `karma`: KARMA_SIM on this deployment; `armor`: ARMOR_CP_SIM
 * on this deployment; `gem`: ARK_GEM_SIM on this deployment (ARK_GRID_GEM, api #1079).
 */
export function parseSimulateRequest(
  body: unknown,
  { karma = false, armor = false, gem = false }: { karma?: boolean; armor?: boolean; gem?: boolean } = {},
): SimulateRequest | null {
  if (!body || typeof body !== "object") return null;
  const { characterName, changes } = body as Record<string, unknown>;
  if (typeof characterName !== "string" || characterNameError(characterName))
    return null;
  if (!Array.isArray(changes) || changes.length > MAX_CHANGES) return null;
  const clean: Change[] = [];
  for (const raw of changes) {
    if (!raw || typeof raw !== "object") return null;
    const change = raw as Record<string, unknown>;
    if (typeof change.kind !== "string" || !KINDS.has(change.kind)) return null;
    if (change.kind === "ARK_GRID_GEM") {
      const fields = gemFields(change, gem);
      if (!fields) return null;
      clean.push(fields as Change);
      continue;
    }
    const out: Record<string, unknown> = { kind: change.kind };
    // karmaLevel: 깨달음 카르마 레벨 (api #1004); dropped here, the api got 깨달음 without a level (web #1781).
    for (const key of ["slot", "index", "line", "level", "refine", "quality", "points", "slotIndex", "point", "karmaLevel"]) {
      if (change[key] === undefined) continue;
      if (!int(change[key])) return null;
      out[key] = change[key];
    }
    for (const key of ["option", "grade", "name", "tree"]) {
      if (change[key] === undefined) continue;
      if (typeof change[key] !== "string" || (change[key] as string).length > 32)
        return null;
      out[key] = change[key];
    }
    if (out.karmaLevel !== undefined && !karmaAllowed(out, karma)) return null;
    if (!changeAllowed(change, out, armor)) return null;
    clean.push(out as Change);
  }
  return { characterName: normalizeCharacterName(characterName), changes: clean };
}

/** True when at least one changed item has a verified number. */
export const hasComputed = (data: Simulation) =>
  data.contributions.some((item) => item.status === "OK" && item.delta != null);

export function combatPowerFailureCopy(error: { code: string }) {
  switch (error.code) {
    case "INVALID_REQUEST":
      return {
        title: "입력값을 확인해 주세요",
        text: "바꾼 값이 허용 범위를 벗어났어요.",
      };
    case "CHARACTER_NOT_FOUND":
      return {
        title: "캐릭터를 찾지 못했어요",
        text: "이름을 한 번 더 확인하고 다시 검색해 볼까요?",
      };
    case "CHARACTER_NOT_CACHED":
    case "CHANGE_TARGET_NOT_FOUND":
      return {
        title: "캐릭터 정보가 바뀌었어요",
        text: "장비나 보석이 갱신돼 바꾼 대상을 찾지 못했어요. 캐릭터를 다시 불러와 주세요.",
      };
    case "LOST_ARK_RATE_LIMITED":
    case "CLIENT_RATE_LIMITED":
      return rateLimitCopy(error);
    case "FRONTEND_API_NOT_CONFIGURED":
    case "NOT_FOUND":
      return {
        title: "계산 서비스 연결을 준비하고 있어요",
        text: "서비스 연결 설정이 끝나면 이용할 수 있어요.",
      };
    default:
      return {
        title: "계산하지 못했어요",
        text: "잠시 후 다시 시도해 주세요.",
      };
  }
}
