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
  /** Per kind and key level, the market item a column is, where settled; `bound`: the ones an in-game text shows as bound. */
  marketItems: Record<HellKind, Record<string, { _note: string; bound: (keyof StageReward)[]; items: Partial<Record<keyof StageReward, string>> }>>;
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

/**
 * What each column is worth per unit. MARKET: one market item whose name is the same
 * at every key level. BOUND_GOLD: gold itself (bound to the character). MANUAL: no
 * market price, or the item it stands for is not settled per key level yet (PM 총괄
 * 11-09: not guessed); the user's value, 0 until set.
 */
export type Pricing = { kind: "MARKET"; name: string } | { kind: "BOUND_GOLD" } | { kind: "MANUAL"; why: "NO_MARKET" | "UNSETTLED" };

export const COLUMNS: { key: keyof StageReward; label: string; pricing: Pricing; bound?: boolean }[] = [
  { key: "boundGold", label: "귀속 골드", pricing: { kind: "BOUND_GOLD" }, bound: true },
  { key: "lava", label: "용암의 숨결", pricing: { kind: "MARKET", name: "용암의 숨결" } },
  { key: "glacier", label: "빙하의 숨결", pricing: { kind: "MARKET", name: "빙하의 숨결" } },
  { key: "destruction", label: "파괴석", pricing: { kind: "MANUAL", why: "UNSETTLED" } },
  { key: "guardian", label: "수호석", pricing: { kind: "MANUAL", why: "UNSETTLED" } },
  { key: "breakthrough", label: "돌파석", pricing: { kind: "MANUAL", why: "UNSETTLED" } },
  { key: "fusion", label: "융화 재료", pricing: { kind: "MANUAL", why: "UNSETTLED" } },
  { key: "specialRefine", label: "특수 재련 돌파석", pricing: { kind: "MANUAL", why: "UNSETTLED" } },
  { key: "destinyStone", label: "운명의 돌", pricing: { kind: "MANUAL", why: "UNSETTLED" } },
  { key: "chaosStone", label: "혼돈의 돌", pricing: { kind: "MANUAL", why: "UNSETTLED" } },
  { key: "stoneKit", label: "어빌리티 스톤 키트", pricing: { kind: "MANUAL", why: "NO_MARKET" } },
  { key: "bracelet", label: "팔찌 상자", pricing: { kind: "MANUAL", why: "NO_MARKET" } },
  { key: "gem", label: "젬", pricing: { kind: "MANUAL", why: "NO_MARKET" } },
  { key: "heavenTicket", label: "천상 도전권", pricing: { kind: "MANUAL", why: "NO_MARKET" } },
  { key: "engraving", label: "귀속 유물 각인서(랜덤)", pricing: { kind: "MANUAL", why: "NO_MARKET" }, bound: true },
  { key: "boundGem", label: "귀속 보석", pricing: { kind: "MANUAL", why: "NO_MARKET" }, bound: true },
  { key: "cardPack", label: "전설 카드팩(랜덤)", pricing: { kind: "MANUAL", why: "NO_MARKET" } },
];

/** The settled market items of one kind and key level (empty where none is settled). */
export const levelItems = (kind: HellKind, keyLevel: number): HellData["marketItems"][HellKind][string] | null =>
  HELL_DATA.marketItems[kind][String(keyLevel)] ?? null;

/** Every market name the tool may ask a price for. */
export const MARKET_NAMES = [
  ...new Set([
    ...COLUMNS.flatMap((c) => (c.pricing.kind === "MARKET" ? [c.pricing.name] : [])),
    ...Object.values(HELL_DATA.marketItems).flatMap((levels) => Object.values(levels).flatMap((l) => Object.values(l.items) as string[])),
  ]),
];

const GRADE_LABEL: Record<Grade, string> = { RARE: "희귀", EPIC: "영웅", RELIC: "유물", ANCIENT: "고대" };

/** "고대" · "희귀~영웅": a graded item's grade text. */
export const gradeText = (g: GradeCount) => g.grades.map((x) => GRADE_LABEL[x]).join("~");

/** The value a user sets is per unit of one line: graded items per grade ("bracelet:ANCIENT"). */
export const unitKey = (key: keyof StageReward, value: number | GradeCount) =>
  typeof value === "number" ? key : `${key}:${value.grades.join("~")}${value.random ? ":random" : ""}`;

export type StageLine = {
  key: keyof StageReward;
  unitKey: string;
  label: string;
  qty: number;
  /** 1 unit's value; null while a market price is not in yet. */
  unit: number | null;
  value: number;
  pricing: Pricing;
  bound: boolean;
  /**
   * Market lines only: BOUND (an in-game text shows it bound; valued at the market price,
   * a modelling choice shown as such) or UNCONFIRMED (no source says whether it trades).
   */
  trade: "BOUND" | "UNCONFIRMED" | null;
  /** A market line whose price did not come back: valued by the user like a manual line (0 until set). */
  unpriced: boolean;
  /** The other half of a choose-one pair, not counted (its value was lower). */
  notChosen: boolean;
};

export type StageValue = {
  lines: StageLine[];
  total: number;
  /** Lines valued at market prices. */
  market: number;
  boundGold: number;
  /** Lines valued by the user's own numbers. */
  manual: number;
};

/**
 * One stage's reward valued: market lines by `market(name)`, bound gold at face
 * value, the rest by `manual(unitKey)` (0 when unset). Of a choose-one pair only the
 * higher-valued half counts (ties: the first); both are listed.
 */
export function stageValue(
  reward: StageReward,
  market: (name: string) => number | null,
  manual: (unitKey: string) => number,
  settled: ReturnType<typeof levelItems> = null,
  /** Prices have come back (a market line without one then takes the user's value). */
  loaded = true,
): StageValue {
  const lines: StageLine[] = [];
  for (const column of COLUMNS) {
    const value = reward[column.key];
    if (value === undefined) continue;
    const qty = typeof value === "number" ? value : value.count;
    const key = unitKey(column.key, value);
    const named = settled?.items[column.key];
    const pricing: Pricing = named ? { kind: "MARKET", name: named } : column.pricing;
    const price = pricing.kind === "MARKET" ? market(pricing.name) : null;
    const unpriced = pricing.kind === "MARKET" && price == null && loaded;
    const unit = pricing.kind === "MARKET" ? (unpriced ? manual(key) : price) : pricing.kind === "BOUND_GOLD" ? 1 : manual(key);
    const name = named ?? column.label;
    const label = typeof value === "number" ? name : `${name} (${gradeText(value)}${value.random ? " 랜덤" : ""})`;
    const trade = pricing.kind !== "MARKET" ? null : settled?.bound.includes(column.key) ? "BOUND" : "UNCONFIRMED";
    lines.push({
      key: column.key,
      unitKey: key,
      label,
      qty,
      unit,
      value: (unit ?? 0) * qty,
      pricing,
      bound: !!column.bound || trade === "BOUND",
      trade,
      unpriced,
      notChosen: false,
    });
  }
  for (const [a, b] of CHOICE_PAIRS) {
    const la = lines.find((l) => l.key === a);
    const lb = lines.find((l) => l.key === b);
    if (!la || !lb) continue;
    (lb.value > la.value ? la : lb).notChosen = true;
  }
  const counted = lines.filter((l) => !l.notChosen);
  const sum = (pick: (l: StageLine) => boolean) => counted.filter(pick).reduce((n, l) => n + l.value, 0);
  return {
    lines,
    total: sum(() => true),
    market: sum((l) => l.pricing.kind === "MARKET" && !l.unpriced),
    boundGold: sum((l) => l.pricing.kind === "BOUND_GOLD"),
    manual: sum((l) => l.pricing.kind === "MANUAL" || l.unpriced),
  };
}

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
