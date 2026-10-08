// Ability stone faceting optimizer — pure, client-only. Mirrors ILOA
// /tools/stone (checked 2026-10-09).
//
// Rules (verified by the calc-verification team against the official
// "어빌리티 스톤 자동 세공" probability tables, max error 0.00094%p):
// - Three lines (increase 1, increase 2, decrease) share one success chance.
// - It starts at 75%; a success lowers it 10%p, a failure raises it 10%p,
//   clamped to 25..75%.
// - Each line has the same number of slots (10, 9, 8 or 6).
// The advice picks, at every slot, the line that maximises the chance of
// reaching the goal (manual optimal play). The official auto-facet policy
// differs by 1–2%p and is not modelled here.

export const SLOT_OPTIONS = [10, 9, 8, 6] as const;
export type Slots = (typeof SLOT_OPTIONS)[number];
export const DEFAULT_SLOTS: Slots = 10;

/** Upper bound on decrease-line successes; `null` = no limit. */
export const DECREASE_OPTIONS = [
  { max: 4, label: "4 이하", hint: "감소 각인 없음" },
  { max: 6, label: "6 이하", hint: "감소 Lv1까지" },
  { max: 9, label: "9 이하", hint: "감소 Lv2까지" },
  { max: null, label: "제한 없음", hint: "" },
] as const;
export const DEFAULT_DECREASE = 4;

/** Success chance by step: 25, 35, …, 75%. */
export const CHANCES = [25, 35, 45, 55, 65, 75] as const;
const START_STEP = 5;

export type LineIndex = 0 | 1 | 2;
export const LINE_NAMES = ["증가 각인 1", "증가 각인 2", "감소 각인"] as const;

/** Increase-line minimums; either order counts (9/7 also accepts 7/9). */
export type Goal = { id: string; label: string; pairs: [number, number][] };

export const GOAL_PRESETS: Goal[] = [
  { id: "77", label: "77돌", pairs: [[7, 7]] },
  {
    id: "97",
    label: "97돌",
    pairs: [
      [9, 7],
      [10, 6],
    ],
  },
  { id: "96", label: "96돌", pairs: [[9, 6]] },
  { id: "99", label: "99돌", pairs: [[9, 9]] },
  { id: "76", label: "76돌", pairs: [[7, 6]] },
  { id: "66", label: "66돌", pairs: [[6, 6]] },
];
export const DEFAULT_GOALS = ["77", "97"];
export const MAX_GOALS = 3;

export const goalText = (goal: Goal) =>
  goal.pairs.map(([a, b]) => `${a}/${b}`).join(" · ");

/** Preset id, or a custom goal written "x9-7". */
export function goalFromId(id: string): Goal | null {
  const preset = GOAL_PRESETS.find((goal) => goal.id === id);
  if (preset) return preset;
  const match = /^x(\d{1,2})-(\d{1,2})$/.exec(id);
  if (!match) return null;
  const [a, b] = [Number(match[1]), Number(match[2])];
  if (a > 10 || b > 10) return null;
  return { id, label: a === 10 || b === 10 ? `${a}/${b}돌` : `${a}${b}돌`, pairs: [[a, b]] };
}

export function meetsGoal(goal: Goal, a: number, b: number) {
  return goal.pairs.some(
    ([x, y]) => (a >= x && b >= y) || (a >= y && b >= x),
  );
}

export type Move = { line: LineIndex; success: boolean };

export type StoneState = {
  used: [number, number, number];
  hits: [number, number, number];
  step: number;
};

export function replay(slots: number, moves: Move[]): StoneState {
  const state: StoneState = { used: [0, 0, 0], hits: [0, 0, 0], step: START_STEP };
  for (const move of moves) {
    if (state.used[move.line] >= slots) throw new Error("line is full");
    state.used[move.line] += 1;
    if (move.success) {
      state.hits[move.line] += 1;
      state.step = Math.max(0, state.step - 1);
    } else {
      state.step = Math.min(CHANCES.length - 1, state.step + 1);
    }
  }
  return state;
}

export const chanceOf = (state: StoneState) => CHANCES[state.step];
export const isFinished = (slots: number, state: StoneState) =>
  state.used.every((u) => u >= slots);

/**
 * Optimal success probability for one goal. States are memoised in a
 * Float32Array (≈7MB for 10 slots) indexed by (used, hits) per line and the
 * chance step; float precision is plenty for display.
 */
export function createSolver(slots: number, decreaseMax: number | null, goal: Goal) {
  const pairs = ((slots + 1) * (slots + 2)) / 2;
  const memo = new Float32Array(pairs * pairs * pairs * CHANCES.length).fill(
    Number.NaN,
  );
  const pi = (u: number, s: number) => (u * (u + 1)) / 2 + s;
  const limit = decreaseMax ?? slots;

  function value(
    u1: number, s1: number,
    u2: number, s2: number,
    u3: number, s3: number,
    step: number,
  ): number {
    if (s3 > limit) return 0;
    if (!meetsGoal(goal, s1 + slots - u1, s2 + slots - u2)) return 0;
    if (u1 === slots && u2 === slots && u3 === slots) return 1;
    const key =
      ((pi(u1, s1) * pairs + pi(u2, s2)) * pairs + pi(u3, s3)) *
        CHANCES.length +
      step;
    const cached = memo[key];
    if (!Number.isNaN(cached)) return cached;
    const p = CHANCES[step] / 100;
    const up = Math.max(0, step - 1);
    const down = Math.min(CHANCES.length - 1, step + 1);
    let best = 0;
    if (u1 < slots)
      best = Math.max(best, p * value(u1 + 1, s1 + 1, u2, s2, u3, s3, up) + (1 - p) * value(u1 + 1, s1, u2, s2, u3, s3, down));
    if (u2 < slots)
      best = Math.max(best, p * value(u1, s1, u2 + 1, s2 + 1, u3, s3, up) + (1 - p) * value(u1, s1, u2 + 1, s2, u3, s3, down));
    if (u3 < slots)
      best = Math.max(best, p * value(u1, s1, u2, s2, u3 + 1, s3 + 1, up) + (1 - p) * value(u1, s1, u2, s2, u3 + 1, s3, down));
    memo[key] = best;
    return best;
  }

  const at = (state: StoneState) =>
    value(state.used[0], state.hits[0], state.used[1], state.hits[1], state.used[2], state.hits[2], state.step);

  /** Chance of reaching the goal if `line` is faceted next (null if full). */
  function ifNext(state: StoneState, line: LineIndex): number | null {
    if (state.used[line] >= slots) return null;
    const p = CHANCES[state.step] / 100;
    const hit = structuredCloneState(state);
    hit.used[line] += 1;
    hit.hits[line] += 1;
    hit.step = Math.max(0, state.step - 1);
    const miss = structuredCloneState(state);
    miss.used[line] += 1;
    miss.step = Math.min(CHANCES.length - 1, state.step + 1);
    return p * at(hit) + (1 - p) * at(miss);
  }

  return { at, ifNext };
}

const structuredCloneState = (state: StoneState): StoneState => ({
  used: [...state.used],
  hits: [...state.hits],
  step: state.step,
});

export type Advice = {
  goal: Goal;
  /** Best achievable chance from the current state. */
  chance: number;
  /** Chance per line if faceted next; null when the line is full. */
  perLine: (number | null)[];
  /** Lines whose chance ties the best (within float noise). */
  best: LineIndex[];
};

export function advise(
  solver: ReturnType<typeof createSolver>,
  goal: Goal,
  state: StoneState,
): Advice {
  const perLine = ([0, 1, 2] as const).map((line) => solver.ifNext(state, line));
  const chance = solver.at(state);
  const top = Math.max(...perLine.map((v) => v ?? -1));
  const best = ([0, 1, 2] as const).filter((line) => {
    const v = perLine[line];
    return v !== null && top > 0 && top - v <= Math.max(1e-6, top * 1e-4);
  });
  return { goal, chance, perLine, best };
}

/** Stones needed so the goal is reached with probability q (geometric). */
export function stonesFor(chance: number, q: number): number | null {
  if (chance <= 0) return null;
  if (chance >= 1) return 1;
  return Math.ceil(Math.log(1 - q) / Math.log(1 - chance));
}

export const LUCK_QUANTILES = [
  { q: 0.25, label: "운이 좋으면" },
  { q: 0.5, label: "보통" },
  { q: 0.9, label: "운이 나빠도" },
] as const;

export function formatChance(chance: number) {
  if (chance <= 0) return "0%";
  if (chance >= 1) return "100%";
  const percent = chance * 100;
  if (percent < 0.01) return "0.01% 미만";
  if (percent < 1) return `${percent.toFixed(2)}%`;
  return `${percent.toFixed(1)}%`;
}

// Moves travel in the URL as "1s2f3s…" (line number + s/f).
export function encodeMoves(moves: Move[]) {
  return moves.map((m) => `${m.line + 1}${m.success ? "s" : "f"}`).join("");
}

export function decodeMoves(slots: number, text: string): Move[] {
  if (!/^([123][sf])*$/.test(text) || text.length > 60) return [];
  const moves: Move[] = [];
  for (let i = 0; i < text.length; i += 2)
    moves.push({
      line: (Number(text[i]) - 1) as LineIndex,
      success: text[i + 1] === "s",
    });
  try {
    replay(slots, moves);
    return moves;
  } catch {
    return [];
  }
}
