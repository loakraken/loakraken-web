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
};

/** What the user has changed, keyed by the target the backend uses. */
export type Edits = {
  gemAll: number | null;
  gems: Record<number, number>;
  refine: Record<number, number>;
  quality: Record<number, number>;
};
export const NO_EDITS: Edits = { gemAll: null, gems: {}, refine: {}, quality: {} };

export type Current = {
  gems: { slot: number; level: number }[];
  gear: { index: number; refine: number | null; quality: number | null }[];
};

/**
 * Only real differences become changes, in a fixed order (gems, then gear), so
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
  }
  return changes.slice(0, MAX_CHANGES);
}

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
      return rateLimitCopy();
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
