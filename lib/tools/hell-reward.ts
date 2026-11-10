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
  /** Source id of the base table. */
  baseSource?: string;
  /** Base items per kind, key level and stage, once their source is transcribed (optional). */
  base?: Partial<Record<HellKind, Record<string, { stage: number; items: { label: string; qty: number; market: string }[] }[]>>>;
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
    ...Object.values(HELL_DATA.base ?? {}).flatMap((levels) =>
      Object.values(levels ?? {}).flatMap((stages) => stages.flatMap((s) => s.items.map((i) => i.market))),
    ),
  ]),
];

const GRADE_LABEL: Record<Grade, string> = { RARE: "희귀", EPIC: "영웅", RELIC: "유물", ANCIENT: "고대" };

/** "고대" · "희귀~영웅": a graded item's grade text. */
export const gradeText = (g: GradeCount) => g.grades.map((x) => GRADE_LABEL[x]).join("~");

/**
 * The value a user sets is per unit of one item, by its name (graded items per grade):
 * "item:순환 돌파석", "item:팔찌 상자:ANCIENT". Never by row position: a column is a
 * different item at another key level (순환 vs 전이 돌파석), PM 총괄 #1525 P3.
 */
export const unitKey = (name: string, value: number | GradeCount) =>
  `item:${name}${typeof value === "number" ? "" : `:${value.grades.join("~")}${value.random ? ":random" : ""}`}`;

/** A column whose item is not settled (나락): its value stays with that kind, level and column. */
export const unsettledKey = (scope: string, key: keyof StageReward) => `unsettled:${scope}:${key}`;

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
  /** "hell:1730": where an unsettled column's value belongs. */
  scope = "",
): StageValue {
  const lines: StageLine[] = [];
  for (const column of COLUMNS) {
    const value = reward[column.key];
    if (value === undefined) continue;
    const qty = typeof value === "number" ? value : value.count;
    const named = settled?.items[column.key];
    const pricing: Pricing = named ? { kind: "MARKET", name: named } : column.pricing;
    const key =
      pricing.kind === "MANUAL" && pricing.why === "UNSETTLED" ? unsettledKey(scope, column.key) : unitKey(named ?? column.label, value);
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

/**
 * One key opens ONE of the boxes offered (official notice for 나락, a community post for
 * 지옥; PM 총괄 11-10): each table column is one box. A choose-one pair stays inside its box.
 */
export const BOXES: { id: string; label: string; keys: (keyof StageReward)[] }[] = [
  { id: "stone", label: "파괴석 · 수호석 상자", keys: ["destruction", "guardian"] },
  { id: "breakthrough", label: "돌파석 상자", keys: ["breakthrough"] },
  { id: "fusion", label: "융화 재료 상자", keys: ["fusion"] },
  { id: "breath", label: "재련 보조 상자", keys: ["lava", "glacier"] },
  { id: "gold", label: "귀속 골드 상자", keys: ["boundGold"] },
  { id: "kit", label: "어빌리티 스톤 키트 상자", keys: ["stoneKit"] },
  { id: "bracelet", label: "팔찌 상자", keys: ["bracelet"] },
  { id: "special", label: "특수 재련 상자", keys: ["specialRefine"] },
  { id: "heaven", label: "천상 도전권 상자", keys: ["heavenTicket"] },
  { id: "gem", label: "젬 상자", keys: ["gem"] },
  { id: "destiny", label: "운명 · 혼돈의 돌 상자", keys: ["destinyStone", "chaosStone"] },
  { id: "engraving", label: "각인서 상자", keys: ["engraving"] },
  { id: "boundGem", label: "보석 상자", keys: ["boundGem"] },
  { id: "card", label: "카드팩 상자", keys: ["cardPack"] },
];

/** The base ('(기본)') materials every opened box also gives, valued once (×10 with 풍요). */
export type BaseLine = {
  label: string;
  /** By item name: the same item as a box line shares the user's value. */
  unitKey: string;
  qty: number;
  /** 1 unit's value; null while prices are not in yet. */
  unit: number | null;
  value: number;
  /** No price came back: the user's value, 0 until set (계산 검증 #1530; the same path as box lines). */
  unpriced: boolean;
};
export type BaseValue = { lines: BaseLine[]; value: number };

export type BoxValue = {
  id: string;
  label: string;
  lines: StageLine[];
  /** The box's own items (choose-one pairs: the counted half). */
  contents: number;
  /** contents + the base (null base: contents only). */
  value: number;
};

/**
 * The boxes of one stage, best first (ties keep the table order). Each box is worth its own
 * items plus the base every box gives; the base is null where its amounts are not in the data.
 */
export function rankBoxes(stage: StageValue, base: BaseValue | null): BoxValue[] {
  const boxes = BOXES.flatMap((box) => {
    const lines = stage.lines.filter((l) => box.keys.includes(l.key));
    if (!lines.length) return [];
    const contents = lines.filter((l) => !l.notChosen).reduce((n, l) => n + l.value, 0);
    return [{ id: box.id, label: box.label, lines, contents, value: contents + (base?.value ?? 0) }];
  });
  return boxes.map((b, i) => ({ b, i })).sort((x, y) => y.b.value - x.b.value || x.i - y.i).map(({ b }) => b);
}

export type BaseItem = { label: string; qty: number; market: string };

/**
 * The base ('(기본)') items of one kind, key level and stage, or null while their amounts
 * are not in the data file (the page then says so; never an unlabelled base).
 */
export function stageBase(kind: HellKind, keyLevel: number, stage: number): BaseItem[] | null {
  return HELL_DATA.base?.[kind]?.[String(keyLevel)]?.find((s) => s.stage === stage)?.items ?? null;
}

/**
 * The boxes in a held order (set by the user's last choice or re-sort; a price refresh does
 * not move them, PM-프론트 #1530 P2), and the best box by the values now. The headline always
 * takes `best`, so it is never an old box after prices change (PM 총괄 11-10). Boxes not in
 * the held order (none in practice) follow at the end.
 */
export function heldView(ranked: BoxValue[], held: string[]) {
  const list = [...held.flatMap((id) => ranked.filter((b) => b.id === id)), ...ranked.filter((b) => !held.includes(b.id))];
  return { list, best: ranked[0] ?? null, stale: list[0]?.id !== ranked[0]?.id };
}

/** Base items with a market name each, valued; `abundance` (풍요) multiplies the quantities by 10. */
export function baseValue(
  items: { label: string; qty: number; market: string }[],
  market: (name: string) => number | null,
  abundance: boolean,
  manual: (unitKey: string) => number = () => 0,
  /** Prices have come back (an item without one then takes the user's value). */
  loaded = true,
): BaseValue {
  const lines = items.map((item) => {
    const qty = item.qty * (abundance ? 10 : 1);
    const key = unitKey(item.market, qty);
    const price = market(item.market);
    const unpriced = price == null && loaded;
    const unit = unpriced ? manual(key) : price;
    return { label: item.label, unitKey: key, qty, unit, value: (unit ?? 0) * qty, unpriced };
  });
  return { lines, value: lines.reduce((n, l) => n + l.value, 0) };
}

/** Consistency problems; the test suite expects none. */
export function checkHellData(data: HellData): string[] {
  const problems: string[] = [];
  if (data.base) {
    if (!data.baseSource || !data.sources[data.baseSource]) problems.push("base: unknown source");
    for (const [kind, levels] of Object.entries(data.base))
      for (const [level, stages] of Object.entries(levels ?? {})) {
        if (stages.length !== 11 || stages.some((s, i) => s.stage !== i)) problems.push(`base ${kind} ${level}: stages 0-10 expected`);
        // A higher stage never gives less of the same base item.
        stages.forEach((s, i) =>
          s.items.forEach((item, j) => {
            if (!Number.isInteger(item.qty) || item.qty <= 0) problems.push(`base ${kind} ${level} ${s.stage} ${item.label}: bad qty`);
            if (i > 0 && item.qty < stages[i - 1].items[j].qty) problems.push(`base ${kind} ${level} ${s.stage} ${item.label}: lower than stage before`);
          }),
        );
      }
  }
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
