import { characterNameError, normalizeCharacterName, type Character } from "../character/model";
import { ARK_TREES, COMBAT_STATS, positionOf, statNumber } from "../character/detail";

// Multi-search (K37): several characters side by side. The names come from
// one text field (a party list pasted from the game, or typed) and live in the
// address as ?names=a,b,c so a comparison can be shared.

export const MULTI_SEARCH_LIMIT = 6;

export type ParsedNames = {
  /** Valid, unique names in the order given, at most MULTI_SEARCH_LIMIT. */
  names: string[];
  /** Pieces that are not a character name (shown back to the user). */
  invalid: string[];
  /** Valid names left out over the limit. */
  dropped: string[];
};

/**
 * Splits on commas, spaces, slashes, middle dots and new lines (character
 * names hold letters and digits only, so none of these can be part of one).
 * Duplicates keep the first one.
 */
export function parseNames(input: string): ParsedNames {
  const names: string[] = [];
  const invalid: string[] = [];
  const dropped: string[] = [];
  for (const piece of input.split(/[\s,，、/·|]+/u)) {
    const name = normalizeCharacterName(piece);
    if (!name) continue;
    if (characterNameError(name)) {
      if (!invalid.includes(name)) invalid.push(name);
      continue;
    }
    if (names.includes(name) || dropped.includes(name)) continue;
    if (names.length < MULTI_SEARCH_LIMIT) names.push(name);
    else dropped.push(name);
  }
  return { names, invalid, dropped };
}

/** ?names=a,b,c — anything that is not a valid name is ignored. */
export const namesFromParam = (value: string | null | undefined) => parseNames(value ?? "").names;

export const namesSearch = (names: string[]) =>
  names.length ? `?${new URLSearchParams({ names: names.join(",") })}` : "";

/** What a cell shows: a value, or one short reason why there is none. */
export type Cell<T> = { value: T } | { reason: string };

export type Engraving = { name: string; level: number | null; grade: string | null };

export type Summary = {
  name: string;
  server: string;
  className: string;
  role: "딜러" | "서포터" | null;
  itemLevel: number;
  combatPower: Cell<number>;
  engravings: Cell<Engraving[]>;
  arkPassive: Cell<{ tree: string; value: number }[]>;
  refine: Cell<{ min: number; max: number }>;
  quality: Cell<number>;
  gems: Cell<{ average: number; count: number }>;
  stats: Cell<{ type: string; value: number }[]>;
};

type State = string | undefined;

// The armory sends a section, sends it empty, or leaves it out; the reason
// line says which, in two or three words that fit a cell.
function missing(state: State, empty = "없음") {
  if (state === "NOT_PROVIDED") return { reason: "미제공" };
  if (state === "PROVIDED_EMPTY") return { reason: empty };
  return { reason: empty };
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export function summarize(data: Character): Summary {
  const coverage = data.coverage;
  const position = positionOf(data);

  const effects = (data.loadout.engravings?.arkPassiveEffects ?? []).filter((e) => e.name);
  const engravings: Summary["engravings"] = effects.length
    ? { value: effects.map((e) => ({ name: e.name!, level: e.level ?? null, grade: e.grade ?? null })) }
    : missing(coverage.engravings?.collections?.arkPassiveEffects ?? coverage.engravings?.state, "각인 없음");

  const points = ARK_TREES.flatMap((tree) => {
    const value = data.loadout.arkPassive?.points.find((p) => p.name === tree)?.value;
    return value == null ? [] : [{ tree, value }];
  });
  const arkPassive: Summary["arkPassive"] = points.length
    ? { value: points }
    : missing(coverage.arkPassive?.collections?.points ?? coverage.arkPassive?.state, "포인트 없음");

  const equipment = data.analysis.equipment;
  const refine: Summary["refine"] =
    equipment?.minRefineLevel != null && equipment.maxRefineLevel != null
      ? { value: { min: equipment.minRefineLevel, max: equipment.maxRefineLevel } }
      : missing(coverage.equipment, "장비 없음");
  const quality: Summary["quality"] =
    equipment?.averageQuality != null ? { value: round1(equipment.averageQuality) } : missing(coverage.equipment, "품질 없음");

  const gemSummary = data.analysis.gems;
  const gems: Summary["gems"] =
    gemSummary && gemSummary.count > 0 && gemSummary.averageLevel != null
      ? { value: { average: round1(gemSummary.averageLevel), count: gemSummary.count } }
      : missing(coverage.gems?.collections?.items ?? coverage.gems?.state, "보석 없음");

  // The two highest combat stats ("특화 1816 · 치명 576"), as on the character page.
  const top = COMBAT_STATS.map((type) => ({ type, value: statNumber(data.stats, type) }))
    .filter((s): s is { type: string; value: number } => s.value != null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2);

  return {
    name: data.characterName,
    server: data.serverName,
    className: data.className,
    role: position === "SUPPORT" ? "서포터" : position === "DEALER" ? "딜러" : null,
    itemLevel: data.itemLevel,
    combatPower: data.combatPower != null ? { value: data.combatPower } : { reason: "미제공" },
    engravings,
    arkPassive,
    refine,
    quality,
    gems,
    stats: top.length ? { value: top } : { reason: "특성 없음" },
  };
}

export const valueOf = <T>(cell: Cell<T>): T | null => ("value" in cell ? cell.value : null);

/**
 * Names holding the highest value of a number column, when at least two
 * characters have one and they differ (a tie for everyone marks nobody).
 */
export function bestNames(summaries: Summary[], pick: (s: Summary) => number | null): string[] {
  const values = summaries.map((s) => ({ name: s.name, v: pick(s) })).filter((x): x is { name: string; v: number } => x.v != null);
  if (values.length < 2) return [];
  const max = Math.max(...values.map((x) => x.v));
  const winners = values.filter((x) => x.v === max).map((x) => x.name);
  return winners.length === values.length ? [] : winners;
}
