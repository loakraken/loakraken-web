// Weekly raid homework and gold — pure model, stored in the browser.
// Follows ILOA /tasks: pick a roster, three gold raids per character, gate and
// "더보기" checks, gold characters n/6, weekly reset on Wednesday 06:00 KST.
// Gold values come from the raid reward data; unknown values stay unknown.
import {
  RAID_DATA,
  modeTotals,
  type Difficulty,
  type Mode,
  type Raid,
} from "./raid-rewards";

export const STORAGE_KEY = "loakraken-homework";
export const GOLD_RAIDS_PER_CHARACTER = RAID_DATA.rules.endContentGoldClearsPerCharacter;
export const GOLD_CHARACTERS = RAID_DATA.rules.goldCharactersPerRoster;
const KST = 9 * 3600_000;
const WEEK = 7 * 86400_000;

/** Start (UTC ms) of the homework week containing `now`: Wednesday 06:00 KST. */
export function weekStart(now: number): number {
  const kst = new Date(now + KST);
  // Days since Wednesday (Wed=3) in KST, then step back past 06:00.
  const day = (kst.getUTCDay() + 7 - 3) % 7;
  let start =
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - day, 6) - KST;
  if (start > now) start -= WEEK;
  return start;
}
export const nextReset = (now: number) => weekStart(now) + WEEK;

export type RaidPlan = {
  raidId: string;
  difficulty: Difficulty;
  /** Per gate: cleared this week. */
  cleared: boolean[];
  /** Per gate: bonus reward bought. */
  more: boolean[];
};
export type Character = {
  name: string;
  server: string;
  className: string;
  itemLevel: number;
  /** Designated to receive gold (at most GOLD_CHARACTERS). */
  gold: boolean;
  raids: RaidPlan[];
};
export type HomeworkState = {
  version: 1;
  /** weekStart() of the week the progress belongs to. */
  week: number;
  characters: Character[];
};

export const emptyState = (now: number): HomeworkState => ({
  version: 1,
  week: weekStart(now),
  characters: [],
});

const raidById = (id: string) => RAID_DATA.raids.find((r) => r.id === id);
export const modeOf = (plan: Pick<RaidPlan, "raidId" | "difficulty">) =>
  raidById(plan.raidId)?.modes.find((m) => m.difficulty === plan.difficulty);

/** Raid modes a character can enter and that pay character gold. */
export function eligibleModes(itemLevel: number): { raid: Raid; mode: Mode }[] {
  return RAID_DATA.raids
    .filter((raid) => !raid.rosterWeekly)
    .flatMap((raid) =>
      raid.modes
        .filter((mode) => mode.difficulty !== "SINGLE" && mode.minItemLevel <= itemLevel)
        .map((mode) => ({ raid, mode })),
    );
}

/**
 * Modes a gold character could enter whose clear gold is not settled
 * (no official value and no two sites agreeing). They stay out of the totals
 * and the screen names them (PM 총괄 2026-10-10 03:05).
 */
export function unsettledModes(characters: Pick<Character, "itemLevel" | "gold" | "raids">[]) {
  const found = new Map<string, { raid: Raid; mode: Mode }>();
  for (const character of characters.filter((c) => c.gold)) {
    const chosen = character.raids.map((plan) => modeOf(plan)).filter((m): m is Mode => !!m);
    const floor = Math.min(...chosen.map((m) => m.minItemLevel), character.itemLevel);
    const taken = new Set(character.raids.map((plan) => plan.raidId));
    // Only what could replace a chosen raid: not the same raid, and at least
    // as high as the lowest raid picked (lower content pays less).
    for (const { raid, mode } of eligibleModes(character.itemLevel))
      if (mode.status === "UNVERIFIED" && !taken.has(raid.id) && mode.minItemLevel >= floor)
        found.set(`${raid.id}/${mode.difficulty}`, { raid, mode });
  }
  return [...found.values()];
}

const planFor = (raid: Raid, mode: Mode): RaidPlan => ({
  raidId: raid.id,
  difficulty: mode.difficulty,
  cleared: mode.gates.map(() => false),
  more: mode.gates.map(() => false),
});

/**
 * Default three raids: the best-paying known mode of each raid the character
 * can enter, highest total gold first. Raids whose gold is not published yet
 * are left out (the user can still add them).
 */
export function autoRaids(itemLevel: number, count = GOLD_RAIDS_PER_CHARACTER): RaidPlan[] {
  const best = new Map<string, { raid: Raid; mode: Mode; gold: number }>();
  for (const { raid, mode } of eligibleModes(itemLevel)) {
    const totals = modeTotals(mode);
    if (!totals) continue;
    const current = best.get(raid.id);
    if (!current || totals.gold > current.gold) best.set(raid.id, { raid, mode, gold: totals.gold });
  }
  // Equal gold: the higher entry level, then the newer raid (later in the
  // table), like the target site (세르카 노말 over 종막 노말, 계산 검증 #277).
  const order = (id: string) => RAID_DATA.raids.findIndex((r) => r.id === id);
  return [...best.values()]
    .sort(
      (a, b) =>
        b.gold - a.gold ||
        b.mode.minItemLevel - a.mode.minItemLevel ||
        order(b.raid.id) - order(a.raid.id),
    )
    .slice(0, count)
    .map(({ raid, mode }) => planFor(raid, mode));
}

export function addCharacters(
  state: HomeworkState,
  picked: Omit<Character, "gold" | "raids">[],
): HomeworkState {
  const known = new Set(state.characters.map((c) => c.name));
  let goldLeft = GOLD_CHARACTERS - state.characters.filter((c) => c.gold).length;
  const added = [...picked]
    .filter((c) => !known.has(c.name))
    .sort((a, b) => b.itemLevel - a.itemLevel)
    .map((c) => {
      const gold = goldLeft > 0;
      if (gold) goldLeft -= 1;
      return { ...c, gold, raids: autoRaids(c.itemLevel) };
    });
  return { ...state, characters: [...state.characters, ...added] };
}

/** Clears weekly progress when a new week started; keeps the setup. */
export function rollWeek(state: HomeworkState, now: number): HomeworkState {
  const week = weekStart(now);
  if (state.week === week) return state;
  return {
    ...state,
    week,
    characters: state.characters.map((c) => ({
      ...c,
      raids: c.raids.map((r) => ({
        ...r,
        cleared: r.cleared.map(() => false),
        more: r.more.map(() => false),
      })),
    })),
  };
}

export type GoldSummary = {
  /** Gold from cleared gates minus every bonus reward bought (net). */
  earned: number;
  earnedBound: number;
  /** Everything planned, minus the bonus rewards already bought. */
  possible: number;
  possibleBound: number;
  /** Gold spent on bonus rewards ("더보기"), also by non-gold characters. */
  moreSpent: number;
  /** Planned gold that cannot be counted (unpublished values). */
  unknownGates: number;
};

const zero = (): GoldSummary => ({
  earned: 0,
  earnedBound: 0,
  possible: 0,
  possibleBound: 0,
  moreSpent: 0,
  unknownGates: 0,
});

/**
 * Gold one character adds to the roster this week. A bonus reward is paid
 * from bound gold first (official notice 13148, 2025-06-25: where both can be
 * used, bound gold is spent first), so per gate bound = max(0, bound − cost)
 * and the rest of the cost comes out of tradable gold. Raids past the weekly
 * gold limit, and characters not designated for gold, earn nothing but still
 * pay for the bonus rewards they buy.
 */
export function characterGold(character: Character): GoldSummary {
  const out = zero();
  character.raids.forEach((plan, index) => {
    const mode = modeOf(plan);
    if (!mode) return;
    const paysGold = character.gold && index < GOLD_RAIDS_PER_CHARACTER;
    mode.gates.forEach((gate, i) => {
      // A bonus reward can only be bought on a cleared gate: the planned total
      // takes every ticked bonus, the earned total and the spending only
      // count the cleared ones.
      const cost = plan.more[i] ? (gate.moreCost ?? 0) : 0;
      const paid = plan.cleared[i] ? cost : 0;
      out.moreSpent += paid;
      if (!paysGold) {
        out.possible -= cost;
        out.earned -= paid;
        return;
      }
      if (gate.gold === null || gate.boundGold === null) {
        out.unknownGates += 1;
        return;
      }
      const net = gate.gold - cost;
      const bound = Math.max(0, gate.boundGold - cost);
      out.possible += net;
      out.possibleBound += bound;
      if (plan.cleared[i]) {
        out.earned += net;
        out.earnedBound += bound;
      }
    });
  });
  return out;
}

export function rosterSummary(state: HomeworkState) {
  const total = zero();
  let raids = 0;
  let raidsDone = 0;
  let gates = 0;
  let gatesDone = 0;
  for (const c of state.characters) {
    const g = characterGold(c);
    for (const key of Object.keys(total) as (keyof GoldSummary)[]) total[key] += g[key];
    for (const plan of c.raids) {
      raids += 1;
      gates += plan.cleared.length;
      const done = plan.cleared.filter(Boolean).length;
      gatesDone += done;
      if (done === plan.cleared.length && done > 0) raidsDone += 1;
    }
  }
  return {
    ...total,
    goldCharacters: state.characters.filter((c) => c.gold).length,
    raids,
    raidsDone,
    gates,
    gatesDone,
  };
}

/** Parses stored JSON defensively; anything unexpected starts fresh. */
export function parseState(text: string | null, now: number): HomeworkState {
  if (!text) return emptyState(now);
  try {
    const value = JSON.parse(text) as HomeworkState;
    if (value?.version !== 1 || !Array.isArray(value.characters) || typeof value.week !== "number")
      return emptyState(now);
    const characters = value.characters
      .filter((c) => c && typeof c.name === "string" && typeof c.itemLevel === "number")
      .map((c) => ({
        ...c,
        gold: !!c.gold,
        raids: (Array.isArray(c.raids) ? c.raids : []).filter((r) => {
          const mode = modeOf(r);
          return mode && Array.isArray(r.cleared) && r.cleared.length === mode.gates.length;
        }),
      }));
    return rollWeek({ version: 1, week: value.week, characters }, now);
  } catch {
    return emptyState(now);
  }
}

export function formatCountdown(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  return days > 0 ? `${days}일 ${hours}시간` : hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
}
