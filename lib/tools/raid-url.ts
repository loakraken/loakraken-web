// What the raid tools keep in the address (M51, PM 총괄 11-21): 레이드 컨닝페이퍼's raid, difficulty and gate, and
// 레이드 보상표's filter and per-card difficulty. Each value is checked against the static data, so a hand-edited or
// stale address falls back instead of showing something the data does not have.
import { CHEATSHEET_DATA } from "./raid-cheatsheet";
import { RAID_DATA, type Category, type Difficulty } from "./raid-rewards";
import { intCodec, oneOfCodec, type UrlCodec } from "./url-state";

/** 레이드 컨닝페이퍼: a raid of the sheet. */
export const CHEATSHEET_RAID_CODEC = oneOfCodec(CHEATSHEET_DATA.raids.map((r) => r.raidId));
/**
 * 레이드 컨닝페이퍼: "" is the raid's first difficulty (kept out of the address); otherwise any difficulty of any raid
 * of the sheet (one the picked raid lacks falls back to its first).
 */
export const CHEATSHEET_DIFFICULTY_CODEC: UrlCodec<Difficulty | ""> = oneOfCodec<Difficulty | "">([
  "",
  ...new Set(CHEATSHEET_DATA.raids.flatMap((r) => r.difficulties.map((d) => d.difficulty))),
]);
/** 레이드 컨닝페이퍼: gate 1–9 (one the difficulty lacks falls back to its first). */
export const CHEATSHEET_GATE_CODEC = intCodec(1, 9);

/** 레이드 보상표: the category filter chips. */
export const RAID_FILTERS: readonly (Category | "ALL")[] = ["ALL", "KAZEROS", "SHADOW", "EPIC", "ABYSS", "LEGION", "EXTREME"];
export const RAID_FILTER_CODEC = oneOfCodec(RAID_FILTERS);

/** A card's pick the address keeps: a raid of the data, one of its difficulties, not its first (the card's default). */
const keptPick = (id: string, difficulty: string | undefined) => {
  const raid = RAID_DATA.raids.find((r) => r.id === id);
  return !!raid && raid.modes[0].difficulty !== difficulty && raid.modes.some((mode) => mode.difficulty === difficulty);
};

/**
 * 레이드 보상표: a card's difficulty, "raidId:DIFFICULTY" pairs comma-joined, sorted by raid so the same picks are the
 * same address. Only exactly "raid:difficulty" is read (codex #1895 P3: "…:HARD:garbage" is dropped), and a pair whose
 * raid or difficulty the data does not have, or that names the card's first difficulty, is left out both ways (codex
 * #1895 P3: HARD → NORMAL left the default pair in the address).
 */
export const RAID_DIFFICULTIES_CODEC: UrlCodec<Partial<Record<string, Difficulty>>> = {
  parse: (raw) =>
    Object.fromEntries(
      raw.split(",").flatMap((pair) => {
        const parts = pair.split(":");
        return parts.length === 2 && keptPick(parts[0], parts[1]) ? [[parts[0], parts[1] as Difficulty]] : [];
      }),
    ),
  format: (value) =>
    Object.entries(value)
      .filter(([id, difficulty]) => keptPick(id, difficulty))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, difficulty]) => `${id}:${difficulty}`)
      .join(","),
};
