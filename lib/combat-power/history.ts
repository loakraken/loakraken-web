// Simulator input history and saved inputs (PM-프론트 10-11 16:37 ②·L6).
// Pure: the screen keeps the state in a reducer and the browser storage
// behind try/catch. Nothing here is sent to the server.
import { KARMA_MAX, KARMA_TREE, NO_EDITS, arkPassiveMax, type Edits } from "./model";

/** How many steps 이전 can go back. */
export const HISTORY_LIMIT = 50;

export type History = { past: Edits[]; present: Edits; future: Edits[] };

export type HistoryAction =
  | { type: "set"; next: Edits | ((present: Edits) => Edits) }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset" }
  | { type: "load"; edits: Edits };

export const startHistory = (present: Edits = NO_EDITS): History => ({ past: [], present, future: [] });

/** A new present pushes the old one onto 이전 and clears 다음. */
function push(history: History, next: Edits): History {
  if (next === history.present) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

export function historyReducer(history: History, action: HistoryAction): History {
  switch (action.type) {
    case "set":
      return push(history, typeof action.next === "function" ? action.next(history.present) : action.next);
    case "undo": {
      if (history.past.length === 0) return history;
      const previous = history.past[history.past.length - 1];
      return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
    }
    case "redo": {
      if (history.future.length === 0) return history;
      const [next, ...rest] = history.future;
      return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: rest };
    }
    // 초기화 and 불러오기 are steps too, so 이전 brings the inputs back.
    case "reset":
      return isEmpty(history.present) ? history : push(history, NO_EDITS);
    case "load":
      return push(history, action.edits);
  }
}

export function isEmpty(edits: Edits) {
  return (Object.keys(NO_EDITS) as (keyof Edits)[]).every((key) =>
    key === "gemAll" ? edits.gemAll == null : Object.keys(edits[key]).length === 0,
  );
}

/* Saved inputs (per browser, per character) ------------------------------- */

const SAVED_PREFIX = "loakraken:combat-power:saved:";
export const savedKey = (name: string) => SAVED_PREFIX + name;

/**
 * What each saved entry was aimed at (PM 총괄 10-12 01:54): the gear's type
 * and name, the gem's name, the polish line's item and option… Edits are
 * keyed by position (equipment index, gem slot), so after the character's
 * gear changes the same key can point at another piece. A load applies only
 * the entries whose target is still the same thing.
 */
export type Targets = Partial<Record<keyof Omit<Edits, "gemAll">, Record<string, string>>>;
export type Saved = { edits: Edits; savedAt: string; targets?: Targets };

/** The parts of the character a saved input can be checked against. */
export type Identity = {
  gems: { slot: number; name: string }[];
  gear: { index: number; type: string; name: string }[];
  polish: { index: number; line: number; item: string; option: string }[];
  bracelet: { line: number; name: string }[];
  armGuard?: { name: string } | null;
  engravings: { name: string }[];
  stones: { name: string }[];
  arkPassive: { tree: string }[];
  cores: { slotIndex: number; name: string }[];
};

/** Every key an edit can use, mapped to what it names on this character. */
export function targetsOf(identity: Identity): Required<Targets> {
  const gear = Object.fromEntries(identity.gear.map((g) => [String(g.index), `${g.type}|${g.name}`]));
  const polish = Object.fromEntries(identity.polish.map((p) => [`${p.index}:${p.line}`, `${p.item}|${p.option}`]));
  return {
    gems: Object.fromEntries(identity.gems.map((g) => [String(g.slot), g.name])),
    refine: gear,
    quality: gear,
    advanced: gear,
    polish,
    // A 연마 step's other option for the line (api #951) is aimed at the same line worn.
    polishOption: polish,
    bracelet: Object.fromEntries(identity.bracelet.map((b) => [String(b.line), b.name])),
    braceletName: Object.fromEntries(identity.bracelet.map((b) => [String(b.line), b.name])),
    armGuard: identity.armGuard ? { level: identity.armGuard.name, grade: identity.armGuard.name } : {},
    engraving: Object.fromEntries(identity.engravings.map((e) => [e.name, e.name])),
    stone: Object.fromEntries(identity.stones.map((e) => [e.name, e.name])),
    arkPassive: Object.fromEntries(identity.arkPassive.map((a) => [a.tree, a.tree])),
    // 깨달음 카르마 레벨 (api #1004) is aimed at the 깨달음 tree.
    karma: Object.fromEntries(identity.arkPassive.filter((a) => a.tree === KARMA_TREE).map((a) => [a.tree, a.tree])),
    core: Object.fromEntries(identity.cores.map((c) => [String(c.slotIndex), c.name])),
  };
}

const GROUPS = [
  "gems",
  "refine",
  "quality",
  "advanced",
  "polish",
  "polishOption",
  "bracelet",
  "braceletName",
  "engraving",
  "stone",
  "arkPassive",
  "karma",
  "core",
  "armGuard",
] as const;

/**
 * Applies a saved input to the character as it is now: entries whose target
 * changed are left out and counted. An old save without targets cannot be
 * checked, so it is not applied at all (legacy) — a wrong number is worse
 * than asking to save again.
 */
export function applySaved(saved: Saved, identity: Identity): { edits: Edits; skipped: number } | { legacy: true } {
  if (!saved.targets) return { legacy: true };
  const now = targetsOf(identity);
  let skipped = 0;
  const edits: Edits = { ...saved.edits };
  for (const group of GROUPS) {
    const kept: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(saved.edits[group])) {
      const was = saved.targets[group]?.[key];
      if (was !== undefined && was === now[group][key]) kept[key] = value;
      else skipped++;
    }
    (edits as Record<string, unknown>)[group] = kept;
  }
  return { edits, skipped };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * Reads what `saveEdits` wrote, keeping only well-formed entries: a value
 * typed in an older version or by hand must not reach the request.
 */
export function parseSaved(text: string | null): Saved | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || !isRecord(raw.edits) || typeof raw.savedAt !== "string") return null;
  const source = raw.edits;
  const numbers = (key: keyof Edits): Record<string, number> => {
    const value = source[key];
    if (!isRecord(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, number] => isNumber(entry[1])),
    );
  };
  const grades = (key: "polish" | "bracelet") => {
    const value = source[key];
    if (!isRecord(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(([, v]) => v === "LOW" || v === "MID" || v === "HIGH"),
    );
  };
  const cores = isRecord(source.core)
    ? Object.fromEntries(
        Object.entries(source.core).filter(
          ([, v]) => isRecord(v) && typeof v.grade === "string" && isNumber(v.point),
        ),
      )
    : {};
  const edits: Edits = {
    gemAll: isNumber(source.gemAll) ? source.gemAll : null,
    gems: numbers("gems"),
    refine: numbers("refine"),
    quality: numbers("quality"),
    advanced: numbers("advanced"),
    polish: grades("polish") as Edits["polish"],
    // An older save has none; a value too long for the request (32) is left out.
    polishOption: isRecord(source.polishOption)
      ? Object.fromEntries(
          Object.entries(source.polishOption).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0 && entry[1].length <= 32,
          ),
        )
      : {},
    bracelet: grades("bracelet") as Edits["bracelet"],
    engraving: numbers("engraving"),
    stone: numbers("stone"),
    // Held to the tree's in-game maximum (도약 70), so the field shows what is sent (review P3 #1706).
    arkPassive: Object.fromEntries(
      Object.entries(numbers("arkPassive")).map(([tree, points]) => [tree, Math.min(points, arkPassiveMax(tree))]),
    ),
    // An older save has none; only the karma range the request takes (0~30, api #1004).
    karma: Object.fromEntries(
      Object.entries(numbers("karma")).filter(([tree, level]) => tree === KARMA_TREE && Number.isInteger(level) && level >= 0 && level <= KARMA_MAX),
    ),
    core: cores as Edits["core"],
    braceletName: isRecord(source.braceletName)
      ? Object.fromEntries(
          Object.entries(source.braceletName).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        )
      : {},
    armGuard: isRecord(source.armGuard)
      ? {
          ...(isNumber(source.armGuard.level) && { level: source.armGuard.level }),
          ...(typeof source.armGuard.grade === "string" && { grade: source.armGuard.grade }),
        }
      : {},
  };
  let targets: Targets | undefined;
  if (isRecord(raw.targets)) {
    targets = {};
    for (const group of GROUPS) {
      const value = raw.targets[group];
      if (isRecord(value))
        targets[group] = Object.fromEntries(
          Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        );
    }
  }
  return { edits, savedAt: raw.savedAt, targets };
}

/** Saves the edits with what each one is aimed at on this character now. */
export function serializeSaved(edits: Edits, savedAt: Date, identity: Identity) {
  const now = targetsOf(identity);
  const targets: Targets = {};
  for (const group of GROUPS) {
    const keys = Object.keys(edits[group]);
    if (keys.length) targets[group] = Object.fromEntries(keys.map((key) => [key, now[group][key] ?? ""]));
  }
  return JSON.stringify({ edits, savedAt: savedAt.toISOString(), targets } satisfies Saved);
}
