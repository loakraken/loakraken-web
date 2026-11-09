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
  /**
   * Outside the default six but given gold in the homework tool (계산 검증 #1466):
   * counted and listed after the six, changed only there, so the panel's own
   * switches never add or remove a row.
   */
  extra: boolean;
};

export type WeeklyGold = {
  server: string;
  /** Saved homework with these characters in (not saved yet: what a first change saves). */
  state: HomeworkState;
  /** The roster's gold characters are all used (another can only take gold after one stops). */
  goldFull: boolean;
  /** Gold characters the homework tool has on other servers. */
  elsewhere: number;
  /** Rows of the six left without gold because other servers' characters use the six. */
  blocked: boolean;
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

/** The homework tool's limit: its gold characters, all servers (its own count). */
const homeworkGoldFull = (state: HomeworkState) => state.characters.filter((c) => c.gold).length >= GOLD_CHARACTERS;
const pickedOf = (siblings: WeeklyGoldSibling[], server: string) =>
  siblings
    .filter((s): s is WeeklyGoldSibling & { itemLevel: number } => s.serverName === server && s.itemLevel != null)
    .map((s) => ({ name: s.characterName, server: s.serverName, className: s.className ?? "", itemLevel: s.itemLevel }));

/** The homework tool's own state with this server's characters added its own way (its six over all servers). */
const homeworkBase = (siblings: WeeklyGoldSibling[], server: string, now: number, saved: HomeworkState | null) =>
  addCharacters(saved ?? emptyState(now), pickedOf(siblings, server));

/**
 * The homework state after one change made in the panel (codex #1466 P1,
 * PM 총괄 option a): this server's characters added exactly as the homework
 * tool adds them (gold by its own six over every server), then the one change.
 * The panel's per-server view is never saved. Turning gold on past the tool's
 * six is refused (the switch is locked then too). null: nothing to save.
 */
export function panelSave(
  siblings: WeeklyGoldSibling[],
  server: string,
  now: number,
  saved: HomeworkState | null,
  name: string,
  change: (character: Character) => Character,
): HomeworkState | null {
  const base = homeworkBase(siblings, server, now, saved);
  const character = base.characters.find((c) => c.name === name && c.server === server);
  if (!character) return null;
  const next = change(character);
  if (next.gold && !character.gold && homeworkGoldFull(base)) return null;
  return replaceCharacter(base, next);
}

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
  const picked = pickedOf(siblings, server);
  if (!picked.length) return null;
  // The six that take gold by default (highest item level); the rows stay
  // these six whatever is saved, so the panel never changes its row count.
  const top = addCharacters(emptyState(now), picked)
    .characters.filter((c) => c.gold)
    .slice(0, GOLD_CHARACTERS)
    .map((c) => c.name);
  // The homework tool's own state, its own six over every server (PM 총괄 11-09, (i)):
  // the panel shows what that tool gives, the first view included. That a 원정대 is
  // one server is not in an official text yet (레퍼런스 2026-11-09).
  const state = homeworkBase(siblings, server, now, saved);
  const chosen = top.map((name) => state.characters.find((c) => c.name === name)!);
  // This server's other gold characters (given gold in the homework tool): the
  // homework total counts them, so the panel does too (계산 검증 #1466 P1).
  const extras = state.characters
    .filter((c) => c.server === server && c.gold && !top.includes(c.name))
    .sort((a, b) => b.itemLevel - a.itemLevel);
  const listed = [...chosen, ...extras];
  const gold = listed.filter((c) => c.gold);
  const summary = rosterSummary({ ...state, characters: gold });
  const elsewhere = state.characters.filter((c) => c.server !== server && c.gold).length;
  return {
    server,
    state,
    // The homework tool's own limit (every saved gold character): a switch it
    // would lock is locked here too, so the panel never saves past six.
    goldFull: homeworkGoldFull(state),
    elsewhere,
    blocked: elsewhere > 0 && homeworkGoldFull(state) && chosen.some((c) => !c.gold),
    rows: listed.map((c, i) => {
      const g = characterGold(c);
      return {
        extra: i >= chosen.length,
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
