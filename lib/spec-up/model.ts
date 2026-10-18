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
  // api #573: by the Kraken score gained per gold. Sent only now that the
  // screen knows it; the answer may come back as EFFICIENCY with a reason.
  { id: "KRAKEN", label: "크라켄 점수 순" },
] as const;
export type Sort = (typeof SORTS)[number]["id"];
export const isSort = (value: unknown): value is Sort => SORTS.some((s) => s.id === value);
/** "1만 골드당 효율 순", "크라켄 점수 순" (a label already ending in 순 keeps it once). */
export const sortCaption = (sort: string) => {
  const label = SORTS.find((s) => s.id === sort)?.label ?? SORTS[0].label;
  return label.endsWith(" 순") ? label : `${label} 순`;
};

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
  // Not ranked, so in a fixed order (reason code, then id) whatever order the
  // list came in: a new order of the ranked rows moves nothing under them (A7, #857).
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {
    ok,
    folded: [...folded.values()]
      .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
      .map((entry) => {
        const candidates = [...entry.candidates].sort(byId);
        return { ...entry, candidates, kinds: [...new Set(candidates.map((c) => kindLabel(c.kind)))] };
      }),
  };
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
  };
}

/**
 * 크라켄 점수 순 (api #573): the ranked rows are every candidate with a score
 * change, in the answer's order — a candidate the combat power simulator
 * cannot price can still raise the score (its cost then comes too). The rest
 * fold by reason as before.
 */
export function splitKrakenCandidates(list: Candidate[]) {
  const scored = list.filter((c) => c.deltaKrakenScore != null);
  const { folded } = splitCandidates(list.filter((c) => c.deltaKrakenScore == null));
  return { ok: scored, folded };
}

/** Why 크라켄 점수 순 could not be used; the list then comes in 1만 골드당 효율 order. */
export function krakenUnavailableCopy(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const why =
    reason === "DISABLED"
      ? "크라켄 점수 순은 아직 준비 중이에요."
      : reason === "INPUT_PENDING"
        ? "점수 계산에 필요한 정보를 아직 모으고 있어요."
        : reason === "ROLE_UNKNOWN"
          ? "이 캐릭터의 역할(딜러·서포터)을 확인하지 못했어요."
          : reason === "SUPPORTER_PENDING"
            ? "서포터의 크라켄 점수 순은 준비 중이에요."
            : reason === "SCORE_UNAVAILABLE"
              ? "이 캐릭터의 크라켄 점수를 계산하지 못했어요."
              : "지금은 크라켄 점수 순으로 정렬할 수 없어요.";
  return `${why} 1만 골드당 효율 순으로 보여 드려요.`;
}
