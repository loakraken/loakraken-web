// "더보기" (bonus reward) profit per raid gate: what the bonus box is worth
// at market prices minus the gold it costs. Data in data/more-reward.json
// holds only sure values (official notice 13307, or two target sites with the
// same number); refining material quantities are not public and come from
// the user (PM 총괄 2026-10-10 결정 ②).
import raw from "./data/more-reward.json";
import { RAID_DATA, type Difficulty } from "./raid-rewards";

export type MoreItem = { name: string; qty: number };
export type MoreGate = {
  gate: number;
  cost: number;
  costSource: string;
  items: MoreItem[];
};
export type MoreMode = { label: string; gates: MoreGate[] };
export type MoreRaid = { id: string; name: string; modes: MoreMode[] };
export type MoreData = {
  version: number;
  checkedAt: string;
  rule: string;
  sources: Record<string, { title: string; url: string; date: string }>;
  raids: MoreRaid[];
};

export const MORE_DATA = raw as MoreData;

/** Tradeable refining materials whose bonus-box quantity the user enters. */
export const INPUT_MATERIALS = [
  "운명의 파괴석 결정",
  "운명의 수호석 결정",
  "위대한 운명의 돌파석",
  "운명의 파괴석",
  "운명의 수호석",
  "운명의 돌파석",
  "운명의 파편",
] as const;

export const gateKey = (raidId: string, mode: string, gate: number) =>
  `${raidId}/${mode}/${gate}`;

const DIFFICULTIES_BY_LABEL: Record<string, Difficulty[]> = {
  나이트메어: ["NIGHTMARE"],
  하드: ["HARD"],
  노말: ["NORMAL"],
  "노말 · 싱글": ["NORMAL", "SINGLE"],
  "1단계": ["STAGE_1"],
  "2단계": ["STAGE_2"],
  "3단계": ["STAGE_3"],
};

/**
 * Bound gold a clear of this gate pays, which the bonus cost spends first
 * (official notice 13148). A row shared by normal and single mode needs the
 * same value in both; otherwise (or with no value) it is null.
 */
export function boundGoldFor(raidId: string, modeLabel: string, gate: number) {
  const raid = RAID_DATA.raids.find((r) => r.id === raidId);
  const values = (DIFFICULTIES_BY_LABEL[modeLabel] ?? []).map(
    (difficulty) =>
      raid?.modes.find((m) => m.difficulty === difficulty)?.gates.find((g) => g.gate === gate)
        ?.boundGold ?? null,
  );
  const known = values.filter((v): v is number => v !== null);
  if (known.length === 0 || known.length !== values.length) {
    // A single mode the table does not list shares the normal row's reward.
    const single = raid?.modes.some((m) => m.difficulty === "SINGLE");
    return known.length === 1 && !single ? known[0] : null;
  }
  return known.every((v) => v === known[0]) ? known[0] : null;
}

export type ValueLine = {
  name: string;
  qty: number;
  /** Gold per item; null when there is no price and the user gave none. */
  unit: number | null;
  value: number;
  entered: boolean;
};

export type GateResult = {
  cost: number;
  /** Cost after leaving out the bound-gold part, when that option is on. */
  paid: number;
  value: number;
  gain: number;
  lines: ValueLine[];
  /** Items with no price: counted as 0. */
  unpriced: string[];
  /** The user entered at least one refining material quantity. */
  hasInput: boolean;
};

export function gateResult(
  gate: MoreGate,
  entered: Partial<Record<string, number>>,
  unitValue: (name: string) => number | null,
  boundGold: number | null,
  excludeBound: boolean,
): GateResult {
  const fixed = gate.items.map((item) => ({ ...item, entered: false }));
  const typed = INPUT_MATERIALS.flatMap((name) => {
    const qty = Math.max(0, Math.floor(entered[name] ?? 0));
    return qty > 0 ? [{ name, qty, entered: true }] : [];
  });
  const lines = [...fixed, ...typed].map((item) => {
    const unit = unitValue(item.name);
    return { ...item, unit, value: unit == null ? 0 : item.qty * unit };
  });
  const value = lines.reduce((sum, line) => sum + line.value, 0);
  const paid = excludeBound
    ? Math.max(0, gate.cost - Math.min(gate.cost, boundGold ?? 0))
    : gate.cost;
  return {
    cost: gate.cost,
    paid,
    value,
    gain: value - paid,
    lines: lines.sort((a, b) => b.value - a.value),
    unpriced: lines.filter((line) => line.unit == null).map((line) => line.name),
    hasInput: typed.length > 0,
  };
}

/** Every item name the screen needs a price for (fixed items + inputs). */
export function priceNames(data: MoreData = MORE_DATA) {
  const names = new Set<string>(INPUT_MATERIALS);
  for (const raid of data.raids)
    for (const mode of raid.modes)
      for (const gate of mode.gates) for (const item of gate.items) names.add(item.name);
  return [...names];
}

/** Data checks for tests: costs positive, gates in order, known sources. */
export function checkMoreData(data: MoreData = MORE_DATA): string[] {
  const problems: string[] = [];
  for (const raid of data.raids)
    for (const mode of raid.modes)
      mode.gates.forEach((gate, i) => {
        const where = `${raid.id} ${mode.label} ${gate.gate}관문`;
        if (gate.gate !== i + 1) problems.push(`${where}: 관문 순서`);
        if (!(gate.cost > 0)) problems.push(`${where}: 더보기 골드`);
        if (!data.sources[gate.costSource]) problems.push(`${where}: 출처 ${gate.costSource}`);
        for (const item of gate.items)
          if (!(Number.isInteger(item.qty) && item.qty > 0)) problems.push(`${where}: ${item.name} 수량`);
      });
  return problems;
}

/**
 * Bound exchange materials valued through what they trade into. Only fixed
 * recipes are here: 은총의 파편 ×60 → 지평의 재련 재료 상자 with fixed
 * contents (user's 제작소 capture, 계산 검증 2026-10-10 18:12; matches
 * 일로아 497.33 at the same prices). 고통의 가시·죽음의 손·사령의 잔영 trade into
 * pouches with a choice whose odds are not published, so they stay user input.
 */
export const EXCHANGES: Record<string, { per: number; into: string; contents: MoreItem[] }> = {
  "은총의 파편": {
    per: 60,
    into: "지평의 재련 재료 상자",
    contents: [
      { name: "운명의 파편", qty: 22500 },
      { name: "운명의 파괴석 결정", qty: 2000 },
      { name: "운명의 수호석 결정", qty: 4000 },
      { name: "위대한 운명의 돌파석", qty: 60 },
    ],
  },
};

/** Exchange items whose recipe has a choice with unpublished odds. */
export const CHOICE_EXCHANGES = ["고통의 가시", "죽음의 손", "사령의 잔영"] as const;

/** Gold per exchange item from its fixed recipe; null if a content has no price. */
export function exchangeValue(name: string, price: (name: string) => number | null) {
  const recipe = EXCHANGES[name];
  if (!recipe) return null;
  let total = 0;
  for (const item of recipe.contents) {
    const unit = price(item.name);
    if (unit == null) return null;
    total += unit * item.qty;
  }
  return total / recipe.per;
}
