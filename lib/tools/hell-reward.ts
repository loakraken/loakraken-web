// 지옥 · 나락 보상 (빈틈 #3): the fixed reward of one key per clear stage (0-10), by key
// level, valued at market prices. Only the fixed stage reward is in the source; chest
// drops and odds, 풍요, the weapon +25 and 페온 effects are not, so they are not counted.
// Items with no market price take a value the user sets (shown as such, 0 by default).
import raw from "./data/hell-reward.json";

export type HellKind = "hell" | "abyss";
export type Grade = "RARE" | "EPIC" | "RELIC" | "ANCIENT";
export type GradeCount = { grades: Grade[]; count: number; random?: boolean };

/** One stage's fixed reward. A/B pairs: destruction/guardian and destiny/chaos are a choice of one; lava/glacier are both. */
export type StageReward = {
  destruction?: number;
  guardian?: number;
  breakthrough?: number;
  fusion?: number;
  lava?: number;
  glacier?: number;
  boundGold?: number;
  stoneKit?: number;
  bracelet?: GradeCount;
  specialRefine?: number;
  heavenTicket?: number;
  gem?: GradeCount;
  destinyStone?: number;
  chaosStone?: number;
  engraving?: number;
  boundGem?: number;
  cardPack?: number;
};

export type HellData = {
  version: string;
  checkedAt: string;
  source: string;
  sources: Record<string, { title: string; url: string | null; date: string; kind: "OFFICIAL" | "COMMUNITY"; _note?: string }>;
  keyLevels: number[];
  hell: Record<string, { stage: number; reward: StageReward }[]>;
  abyss: Record<string, { stage: number; reward: StageReward }[]>;
};

export const HELL_DATA = raw as HellData;

export const STAGES = Array.from({ length: 11 }, (_, i) => i);

export const stageReward = (kind: HellKind, keyLevel: number, stage: number): StageReward | null =>
  HELL_DATA[kind][String(keyLevel)]?.find((s) => s.stage === stage)?.reward ?? null;

/** Choice pairs: the reward gives one of the two, picked by the player. */
export const CHOICE_PAIRS = [
  ["destruction", "guardian"],
  ["destinyStone", "chaosStone"],
] as const;

/** Consistency problems; the test suite expects none. */
export function checkHellData(data: HellData): string[] {
  const problems: string[] = [];
  const source = data.sources[data.source];
  if (!source) problems.push(`unknown source ${data.source}`);
  else if (source.url === null && !(source.kind === "COMMUNITY" && source._note?.includes("내부 기록")))
    problems.push(`source ${data.source}: url null needs a COMMUNITY '내부 기록' note`);
  for (const kind of ["hell", "abyss"] as const)
    for (const level of data.keyLevels) {
      const stages = data[kind][String(level)];
      if (!stages) {
        problems.push(`${kind} ${level}: missing`);
        continue;
      }
      if (stages.length !== 11 || stages.some((s, i) => s.stage !== i)) problems.push(`${kind} ${level}: stages 0-10 expected`);
      // A higher stage never pays less of the same thing (a gem grade step-up resets the count).
      const last = new Map<string, { n: number; grade: string }>();
      for (const { stage, reward } of stages)
        for (const [key, value] of Object.entries(reward)) {
          const n = typeof value === "number" ? value : value.count;
          const grade = typeof value === "number" ? "" : value.grades.join("~");
          if (!Number.isInteger(n) || n <= 0) problems.push(`${kind} ${level} ${stage} ${key}: bad count`);
          const before = last.get(key);
          if (before && before.grade === grade && n < before.n) problems.push(`${kind} ${level} ${stage} ${key}: lower than stage before`);
          last.set(key, { n, grade });
        }
    }
  return problems;
}
