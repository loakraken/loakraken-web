// Simulator input history and saved inputs (PM-프론트 10-11 16:37 ②·L6).
// Pure: the screen keeps the state in a reducer and the browser storage
// behind try/catch. Nothing here is sent to the server.
import { NO_EDITS, type Edits } from "./model";

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

export type Saved = { edits: Edits; savedAt: string };

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
    bracelet: grades("bracelet") as Edits["bracelet"],
    engraving: numbers("engraving"),
    stone: numbers("stone"),
    arkPassive: numbers("arkPassive"),
    core: cores as Edits["core"],
  };
  return { edits, savedAt: raw.savedAt };
}

export const serializeSaved = (edits: Edits, savedAt: Date) =>
  JSON.stringify({ edits, savedAt: savedAt.toISOString() } satisfies Saved);
