// This week's raid gold for a roster (checklist M7·L20·K26): the homework
// tool's own automatic setup, so both screens give the same number. The six
// highest characters of one server take gold (official: six per roster a
// week), each clearing its three best-paying raids (official: three gold
// clears per character), no bonus rewards bought. What the homework tool has
// saved for these characters wins (#14: raids chosen in either screen).
import {
  GOLD_CHARACTERS,
  addCharacters,
  characterGold,
  eligibleModes,
  emptyState,
  modeOf,
  rosterSummary,
  unsettledModes,
  type Character,
  type HomeworkState,
} from "@/lib/tools/homework";
import { DIFFICULTY_LABEL, RAID_DATA, modeTotals } from "@/lib/tools/raid-rewards";

export type WeeklyGoldSibling = {
  characterName: string;
  serverName: string;
  className: string | null;
  itemLevel: number | null;
};

export type WeeklyGoldRow = {
  /** The character as saved (or as the automatic setup would add it). */
  character: Character;
  /** Takes gold this week (homework's 골드 받기). */
  on: boolean;
  name: string;
  className: string;
  itemLevel: number;
  /** Raids counted, best-paying first ("세르카 나이트메어"). */
  raids: string[];
  gold: number;
  bound: number;
};

export type WeeklyGold = {
  server: string;
  /** Saved homework with these characters in (not saved yet: what a first change saves). */
  state: HomeworkState;
  /** The roster's gold characters are all used (another can only take gold after one stops). */
  goldFull: boolean;
  rows: WeeklyGoldRow[];
  total: number;
  bound: number;
  tradable: number;
  /** Gates with no published gold among the raids counted (left out of the totals). */
  unknownGates: number;
  /** Raids a gold character could run whose gold is not settled ("세르카 하드"). */
  unsettled: string[];
};

const raidLabel = (raidId: string, difficulty: keyof typeof DIFFICULTY_LABEL) => {
  const raid = RAID_DATA.raids.find((r) => r.id === raidId);
  return `${raid?.shortName ?? raidId} ${DIFFICULTY_LABEL[difficulty]}`;
};

/**
 * The server's gold characters and their gold, or null when the server has
 * no character with a known item level. `now` only stamps the homework week;
 * `saved` is the homework tool's saved state (null: nothing saved).
 */
export function weeklyGold(
  siblings: WeeklyGoldSibling[],
  server: string,
  now = 0,
  saved: HomeworkState | null = null,
): WeeklyGold | null {
  const picked = siblings
    .filter((s): s is WeeklyGoldSibling & { itemLevel: number } => s.serverName === server && s.itemLevel != null)
    .map((s) => ({ name: s.characterName, server: s.serverName, className: s.className ?? "", itemLevel: s.itemLevel }));
  if (!picked.length) return null;
  // The six that take gold by default (highest item level); the rows stay
  // these six whatever is saved, so the panel never changes its row count.
  const top = addCharacters(emptyState(now), picked)
    .characters.filter((c) => c.gold)
    .slice(0, GOLD_CHARACTERS)
    .map((c) => c.name);
  const state = addCharacters(saved ?? emptyState(now), picked);
  const chosen = top.map((name) => state.characters.find((c) => c.name === name)!);
  const gold = chosen.filter((c) => c.gold);
  const summary = rosterSummary({ ...state, characters: gold });
  return {
    server,
    state,
    goldFull: state.characters.filter((c) => c.gold).length >= GOLD_CHARACTERS,
    rows: chosen.map((c) => {
      const g = characterGold(c);
      return {
        character: c,
        on: c.gold,
        name: c.name,
        className: c.className,
        itemLevel: c.itemLevel,
        raids: c.raids.filter((plan) => modeOf(plan)).map((plan) => raidLabel(plan.raidId, plan.difficulty)),
        gold: c.gold ? g.possible : 0,
        bound: c.gold ? g.possibleBound : 0,
      };
    }),
    total: summary.possible,
    bound: summary.possibleBound,
    tradable: summary.possible - summary.possibleBound,
    unknownGates: summary.unknownGates,
    unsettled: unsettledModes(gold).map(({ raid, mode }) => `${raid.shortName} ${DIFFICULTY_LABEL[mode.difficulty]}`),
  };
}

export type RaidChoice = {
  raidId: string;
  difficulty: Character["raids"][number]["difficulty"];
  /** "세르카 나이트메어" */
  label: string;
  /** In the character's homework (gold goes to the first three in order). */
  on: boolean;
  /** Clear gold of this mode, null when not published. */
  gold: number | null;
};

/**
 * The raids a character can turn on or off in the panel, in one fixed order
 * (the raid's best-paying gold, most first) whether on or off, so a toggle
 * never moves the list (A7). A planned raid shows its planned difficulty.
 */
export function raidChoices(character: Character): RaidChoice[] {
  const gold = (raidId: string, difficulty: RaidChoice["difficulty"]) => {
    const mode = modeOf({ raidId, difficulty });
    return mode ? (modeTotals(mode)?.gold ?? null) : null;
  };
  const best = new Map<string, { difficulty: RaidChoice["difficulty"]; gold: number | null }>();
  for (const { raid, mode } of eligibleModes(character.itemLevel)) {
    const value = modeTotals(mode)?.gold ?? null;
    const current = best.get(raid.id);
    if (!current || (value ?? -1) > (current.gold ?? -1)) best.set(raid.id, { difficulty: mode.difficulty, gold: value });
  }
  const planned = new Map(character.raids.filter((plan) => modeOf(plan)).map((plan) => [plan.raidId, plan]));
  // A planned raid the item level no longer reaches stays listed, last.
  for (const plan of planned.values())
    if (!best.has(plan.raidId)) best.set(plan.raidId, { difficulty: plan.difficulty, gold: -Infinity });
  return [...best.entries()]
    .sort(([, a], [, b]) => (b.gold ?? -1) - (a.gold ?? -1))
    .map(([raidId, top]) => {
      const plan = planned.get(raidId);
      const difficulty = plan?.difficulty ?? top.difficulty;
      return { raidId, difficulty, label: raidLabel(raidId, difficulty), on: !!plan, gold: gold(raidId, difficulty) };
    });
}

/** The character with that raid turned on (added last) or off (removed). */
export function withRaid(character: Character, choice: Pick<RaidChoice, "raidId" | "difficulty">, on: boolean): Character {
  if (!on) return { ...character, raids: character.raids.filter((plan) => plan.raidId !== choice.raidId) };
  if (character.raids.some((plan) => plan.raidId === choice.raidId)) return character;
  const mode = modeOf(choice);
  if (!mode) return character;
  const plan = { raidId: choice.raidId, difficulty: choice.difficulty, cleared: mode.gates.map(() => false), more: mode.gates.map(() => false) };
  return { ...character, raids: [...character.raids, plan] };
}

/** The saved state with one character replaced (the others as they were). */
export const replaceCharacter = (state: HomeworkState, next: Character): HomeworkState => ({
  ...state,
  characters: state.characters.map((c) => (c.name === next.name ? next : c)),
});
