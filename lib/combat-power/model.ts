// Combat-power simulator (backend #240, combat-power-sim-v0). The backend owns
// the formula; this module turns the screen's edits into `changes` and labels
// the answer. Items whose formula is not verified yet come back UNSUPPORTED
// with no number, and the screen says so instead of guessing.
import type { components } from "../api/combat-power-schema";
import { characterNameError, normalizeCharacterName } from "../character/model";
import { rateLimitCopy } from "../api/rate-limit";

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
]);
export const isOpen = (kind: Change["kind"]) => OPEN_KINDS.has(kind);

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
  /** Polish grade per `${index}:${line}` (the option itself stays). */
  polish: Record<string, Grade>;
  /** Bracelet grade per line. */
  bracelet: Record<number, Grade>;
  /** Bracelet option family per line (options.braceletOptions name, "없음" removes it; backend #332). */
  braceletName: Record<number, string>;
  engraving: Record<string, number>;
  stone: Record<string, number>;
  arkPassive: Record<string, number>;
  core: Record<number, { grade: string; point: number }>;
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
  bracelet: {},
  braceletName: {},
  engraving: {},
  stone: {},
  arkPassive: {},
  core: {},
  armGuard: {},
};

export const GRADES = ["LOW", "MID", "HIGH"] as const;
export type Grade = (typeof GRADES)[number];
/** Official tooltip colours map to 하·중·상 (backend PolishEffectResponse). */
export const GRADE_LABEL: Record<string, string> = { LOW: "하", MID: "중", HIGH: "상" };

export type Current = {
  gems: { slot: number; level: number }[];
  gear: { index: number; refine: number | null; quality: number | null; advanced?: number | null }[];
  polish?: { index: number; line: number; option: string; grade: Grade | null }[];
  bracelet?: { line: number; name: string; grade: Grade | null }[];
  engravings?: { name: string; level: number }[];
  stones?: { name: string; level: number }[];
  arkPassive?: { tree: string; points: number }[];
  cores?: { slotIndex: number; grade: string; point: number }[];
  armGuard?: { level: number; grade: string } | null;
};

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

/**
 * Only real differences become changes, in a fixed order (gems, gear, then the
 * rest in screen order), so
 * the same edits always send the same body and hit the same cache entry.
 */
export function toChanges(edits: Edits, current: Current): Change[] {
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
    const refine = edits.refine[item.index];
    if (refine != null && item.refine != null && refine !== item.refine)
      changes.push({ kind: "EQUIPMENT_REFINE", index: item.index, refine });
    const quality = edits.quality[item.index];
    if (quality != null && item.quality != null && quality !== item.quality)
      changes.push({ kind: "EQUIPMENT_QUALITY", index: item.index, quality });
    const advanced = edits.advanced[item.index];
    if (advanced != null && item.advanced != null && advanced !== item.advanced)
      changes.push({ kind: "EQUIPMENT_ADVANCED_REFINE", index: item.index, level: advanced });
  }
  for (const line of current.polish ?? []) {
    const grade = edits.polish[`${line.index}:${line.line}`];
    if (grade && grade !== line.grade)
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
  for (const item of current.arkPassive ?? []) {
    const points = edits.arkPassive[item.tree];
    if (points != null && points !== item.points)
      changes.push({ kind: "ARK_PASSIVE_POINT", tree: item.tree, points });
  }
  for (const item of current.cores ?? []) {
    const edit = edits.core[item.slotIndex];
    if (edit && (edit.grade !== item.grade || edit.point !== item.point))
      changes.push({ kind: "ARK_GRID_CORE", slotIndex: item.slotIndex, grade: edit.grade, point: edit.point });
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

/** 팔 보호구 grades the simulator takes (backend #342). */
export const ARM_GUARD_GRADES = ["영웅", "전설", "유물", "고대"] as const;
export const ARM_GUARD_MAX = 25;

/** The effective level a gem shows while editing (its own edit, then the bulk one). */
export function gemLevel(edits: Edits, gem: { slot: number; level: number }) {
  return edits.gems[gem.slot] ?? edits.gemAll ?? gem.level;
}

const KINDS = new Set(Object.keys(KIND_LABEL));
const int = (value: unknown) => Number.isInteger(value);

/** Server-side guard before the body leaves the proxy. */
export function parseSimulateRequest(body: unknown): SimulateRequest | null {
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
    const out: Record<string, unknown> = { kind: change.kind };
    for (const key of ["slot", "index", "line", "level", "refine", "quality", "points", "slotIndex", "point"]) {
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
        text: "이름이 정확한지 확인한 뒤 다시 검색해 주세요.",
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
