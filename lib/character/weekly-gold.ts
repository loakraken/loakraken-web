// This week's raid gold for a roster (checklist M7·L20·K26): the homework
// tool's own automatic setup, so both screens give the same number. The six
// highest characters of one server take gold (official: six per roster a
// week), each clearing its three best-paying raids (official: three gold
// clears per character), no bonus rewards bought.
import {
  GOLD_CHARACTERS,
  addCharacters,
  characterGold,
  emptyState,
  modeOf,
  rosterSummary,
  unsettledModes,
} from "@/lib/tools/homework";
import { DIFFICULTY_LABEL, RAID_DATA } from "@/lib/tools/raid-rewards";

export type WeeklyGoldSibling = {
  characterName: string;
  serverName: string;
  className: string | null;
  itemLevel: number | null;
};

export type WeeklyGoldRow = {
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
 * no character with a known item level. `now` only stamps the homework week.
 */
export function weeklyGold(siblings: WeeklyGoldSibling[], server: string, now = 0): WeeklyGold | null {
  const picked = siblings
    .filter((s): s is WeeklyGoldSibling & { itemLevel: number } => s.serverName === server && s.itemLevel != null)
    .map((s) => ({ name: s.characterName, server: s.serverName, className: s.className ?? "", itemLevel: s.itemLevel }));
  if (!picked.length) return null;
  const state = addCharacters(emptyState(now), picked);
  const gold = state.characters.filter((c) => c.gold).slice(0, GOLD_CHARACTERS);
  const summary = rosterSummary({ ...state, characters: gold });
  return {
    server,
    rows: gold.map((c) => {
      const g = characterGold(c);
      return {
        name: c.name,
        className: c.className,
        itemLevel: c.itemLevel,
        raids: c.raids.filter((plan) => modeOf(plan)).map((plan) => raidLabel(plan.raidId, plan.difficulty)),
        gold: g.possible,
        bound: g.possibleBound,
      };
    }),
    total: summary.possible,
    bound: summary.possibleBound,
    tradable: summary.possible - summary.possibleBound,
    unknownGates: summary.unknownGates,
    unsettled: unsettledModes(gold).map(({ raid, mode }) => `${raid.shortName} ${DIFFICULTY_LABEL[mode.difficulty]}`),
  };
}
