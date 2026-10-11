// Raid cheat sheet ("컨닝페이퍼"): per gate, the main boss patterns with a
// short description and counterplay. Static data in data/raid-cheatsheet.json.
// Raid ids and difficulties point into raid-rewards.json, so names and gate
// counts come from one place. Text is our own summary of the cited sources;
// sources are kept for review only and never shown on screen.
import raw from "./data/raid-cheatsheet.json";
import { RAID_DATA, type Difficulty, type RaidData } from "./raid-rewards";

/** OFFICIAL: lostark.game.onstove.com. INVEN: 로스트아크 인벤. TARGET_SITE:
 * a target site checked page by page. OTHER: anything else; a pattern backed
 * only by OTHER sources needs two of them. */
export type SourceKind = "OFFICIAL" | "INVEN" | "TARGET_SITE" | "OTHER";
export type CheatSource = { title: string; url: string; checkedAt: string; kind: SourceKind };

/** HP bar counts: `from` is where the pattern starts (higher), `to` where it
 * ends; equal for a one-time trigger. null when no source gives it. */
export type HpBarRange = { from: number | null; to: number | null };

export type Pattern = {
  id: string;
  name: string;
  description: string;
  counterplay: string;
  hpBars: HpBarRange | null;
  sources: string[];
};
export type CheatGate = {
  gate: number;
  boss: string;
  /** Total HP bars of the boss, null when unknown. */
  hpBars: number | null;
  patterns: Pattern[];
  /** Why `patterns` is empty; required exactly when it is. */
  missingReason: string | null;
};
export type CheatDifficulty = { difficulty: Difficulty; gates: CheatGate[] };
export type CheatRaid = { raidId: string; difficulties: CheatDifficulty[] };
export type CheatSheetData = {
  version: string;
  checkedAt: string;
  sources: Record<string, CheatSource>;
  raids: CheatRaid[];
};

export const CHEATSHEET_DATA = raw as CheatSheetData;

export const DESCRIPTION_MAX = 80;
export const COUNTERPLAY_MAX = 100;

// Screen text names no source or site and adds no vague hedges (PM 총괄 데이터 규칙).
const FORBIDDEN_TEXT = /일로아|로펙|클로아|인벤|나무위키|공지|출처|다를 수 있/;

/** Consistency problems in the data; the test suite expects none. */
export function checkCheatSheet(data: CheatSheetData, rewards: RaidData = RAID_DATA): string[] {
  const problems: string[] = [];
  for (const [id, source] of Object.entries(data.sources)) {
    if (!/^https:\/\//.test(source.url)) problems.push(`source ${id}: url must be https`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.checkedAt)) problems.push(`source ${id}: bad checkedAt`);
  }
  const raidIds = new Set<string>();
  for (const raid of data.raids) {
    if (raidIds.has(raid.raidId)) problems.push(`${raid.raidId}: duplicate raid`);
    raidIds.add(raid.raidId);
    const reward = rewards.raids.find((r) => r.id === raid.raidId);
    if (!reward) {
      problems.push(`${raid.raidId}: not in raid-rewards`);
      continue;
    }
    const seen = new Set<Difficulty>();
    for (const difficulty of raid.difficulties) {
      const where = `${raid.raidId}/${difficulty.difficulty}`;
      if (seen.has(difficulty.difficulty)) problems.push(`${where}: duplicate difficulty`);
      seen.add(difficulty.difficulty);
      const mode = reward.modes.find((m) => m.difficulty === difficulty.difficulty);
      if (!mode) problems.push(`${where}: difficulty not in raid-rewards`);
      else if (difficulty.gates.length !== mode.gates.length)
        problems.push(`${where}: ${difficulty.gates.length} gates, raid-rewards has ${mode.gates.length}`);
      difficulty.gates.forEach((gate, i) => {
        const at = `${where} G${gate.gate}`;
        if (gate.gate !== i + 1) problems.push(`${at}: gate out of order`);
        if (!gate.boss.trim()) problems.push(`${at}: no boss name`);
        if (gate.hpBars !== null && (!Number.isInteger(gate.hpBars) || gate.hpBars <= 0))
          problems.push(`${at}: bad hp bars ${gate.hpBars}`);
        if (gate.patterns.length === 0 && !gate.missingReason?.trim())
          problems.push(`${at}: no patterns and no missingReason`);
        if (gate.patterns.length > 0 && gate.missingReason !== null)
          problems.push(`${at}: missingReason set but patterns present`);
        const patternIds = new Set<string>();
        for (const pattern of gate.patterns) {
          const p = `${at} ${pattern.id}`;
          if (!/^[a-z0-9-]+$/.test(pattern.id)) problems.push(`${p}: id must be kebab-case`);
          if (patternIds.has(pattern.id)) problems.push(`${p}: duplicate pattern id`);
          patternIds.add(pattern.id);
          for (const [field, text, max] of [
            ["name", pattern.name, 30],
            ["description", pattern.description, DESCRIPTION_MAX],
            ["counterplay", pattern.counterplay, COUNTERPLAY_MAX],
          ] as const) {
            if (!text.trim()) problems.push(`${p}: empty ${field}`);
            if (text.length > max) problems.push(`${p}: ${field} over ${max} chars`);
            if (FORBIDDEN_TEXT.test(text)) problems.push(`${p}: ${field} names a source or hedges`);
          }
          const range = pattern.hpBars;
          if (range) {
            for (const v of [range.from, range.to])
              if (v !== null && (!Number.isInteger(v) || v < 0)) problems.push(`${p}: bad hp bar ${v}`);
            if (range.from !== null && range.to !== null && range.from < range.to)
              problems.push(`${p}: hp bars from below to`);
            if (gate.hpBars !== null && range.from !== null && range.from > gate.hpBars)
              problems.push(`${p}: hp bars above the boss total`);
          }
          if (!pattern.sources.length) problems.push(`${p}: no source`);
          const known = pattern.sources.filter((s) => data.sources[s]);
          if (known.length !== pattern.sources.length) problems.push(`${p}: unknown source`);
          if (known.length && known.every((s) => data.sources[s].kind === "OTHER") && known.length < 2)
            problems.push(`${p}: only one OTHER source`);
        }
      });
    }
  }
  return problems;
}

/** Cheat sheet of one raid and difficulty, or null when there is none yet. */
export function cheatSheetFor(raidId: string, difficulty: Difficulty): CheatDifficulty | null {
  const raid = CHEATSHEET_DATA.raids.find((r) => r.raidId === raidId);
  return raid?.difficulties.find((d) => d.difficulty === difficulty) ?? null;
}
