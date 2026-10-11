// Spec-up guide (backend #318, PM-프론트 10-11 16:37 ⑤): candidate upgrades
// ranked by combat power per 10,000 gold. The backend computes every number;
// the screen only formats them and folds what it could not compute.
import type { components } from "../api/spec-up-schema";
import type { Edits } from "../combat-power/model";

type Schemas = components["schemas"];
export type SpecUp = Schemas["SpecUpResponse"];
export type Candidate = Schemas["CandidateResponse"];
export type Cost = Schemas["CostResponse"];
export type SpecUpChange = Schemas["ChangeResponse"];
export type SpecUpEnvelope = { code: string; message: string; data: SpecUp };

export const SORTS = [
  { id: "EFFICIENCY", label: "1만 골드당 효율" },
  { id: "DELTA", label: "전투력 증가" },
] as const;
export type Sort = (typeof SORTS)[number]["id"];
export const isSort = (value: unknown): value is Sort => SORTS.some((s) => s.id === value);

/** One cache entry per character snapshot and sort (the tab and the guide share it). */
export const specUpQuery = (name: string, fetchedAt: string | null | undefined, sort: Sort) =>
  ["spec-up", name, fetchedAt ?? null, sort] as const;

/** Kinds the screen names; a newer kind shows its own code. */
export const SPEC_UP_KIND_LABEL: Record<string, string> = {
  GEM_LEVEL: "보석",
  GEM_LEVEL_ALL: "보석",
  EQUIPMENT_QUALITY: "품질",
  EQUIPMENT_REFINE: "재련",
  ADVANCED_REFINE: "상급 재련",
  ENGRAVING_LEVEL: "각인",
  STONE_ENGRAVING: "스톤",
  POLISH: "연마",
  BRACELET_EFFECT: "팔찌",
  ARK_PASSIVE_POINT: "아크 패시브",
  ARK_GRID_CORE: "아크 그리드",
  KARMA_LEVEL: "카르마",
  ABILITY_STONE: "어빌리티 스톤",
};
export const kindLabel = (kind: string) => SPEC_UP_KIND_LABEL[kind] ?? kind;

/**
 * Gold in Korean units, every digit kept (no rounding): 12,340 → "1만 2,340",
 * 123,456,789 → "1억 2,345만 6,789". The caller adds "G".
 */
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

/** OK rows in the backend's order; the rest folded into one line per reason. */
export function splitCandidates(list: Candidate[]) {
  const ok = list.filter((c) => c.status === "OK");
  const folded = new Map<string, Folded>();
  for (const c of list) {
    if (c.status === "OK") continue;
    const code = c.reasonCode ?? "UNKNOWN";
    const entry = folded.get(code) ?? {
      code,
      reason: c.reason ?? "이 항목은 아직 계산하지 않았어요.",
      kinds: [],
      candidates: [],
    };
    entry.candidates.push(c);
    const label = kindLabel(c.kind);
    if (!entry.kinds.includes(label)) entry.kinds.push(label);
    folded.set(code, entry);
  }
  return { ok, folded: [...folded.values()] };
}

/**
 * The simulator's inputs for one candidate (적용해 보기): the change the
 * backend ran, in the simulator's own edit shape. Kinds the simulator does
 * not edit yet give null, and the screen shows no button for them.
 */
export function editsFor(change: SpecUpChange | null | undefined, base: Edits): Edits | null {
  if (!change) return null;
  switch (change.kind) {
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
    default:
      return null;
  }
}

/** ?try= on the simulator tab carries one change; readTry reads it back. */
export const tryParam = (change: SpecUpChange) => JSON.stringify(change);

export function readTry(text: string | null): SpecUpChange | null {
  if (!text) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
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
  };
}
