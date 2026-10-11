// Raid contribution check (checklist L41, 계산 검증 PR #380, PM 총괄 판정
// 2026-10-12 "관문별 범위 + 내 위치"): for a gate, the damage one player
// usually deals — a lower bound (one share × 0.9) and an upper bound (× 1.2) —
// and where the player's own damage sits between them. Every number is the
// verified sample's; the screen shows each gate's basis date, not its source.
import DATA from "./data/raid-contribution.json";

export type ContributionGate = {
  raid: string;
  difficulty: string;
  gate: number;
  boss: string | null;
  players: number;
  /** HOLD (계산 검증 10-12): not settled — no numbers, "데이터 없음". */
  status: "CONFIRMED" | "HOLD";
  /** 억 */
  low: number | null;
  /** 1인분(억), when the source gives it */
  reference: number | null;
  /** 억 */
  high: number | null;
  basisDate: string;
};

export const GATES: ContributionGate[] = DATA.gates.map((g) => ({
  raid: g.raid,
  difficulty: g.difficulty,
  gate: g.gate,
  boss: g.boss,
  players: g.players,
  status: g.status === "CONFIRMED" ? "CONFIRMED" : "HOLD",
  low: g.low,
  reference: g.reference,
  high: g.high,
  basisDate: g.basisDate,
}));

export const gateId = (g: Pick<ContributionGate, "raid" | "difficulty" | "gate">) => `${g.raid}|${g.difficulty}|${g.gate}`;

/** Raids in the sample's order, then their difficulties, then gates. */
export const RAIDS = [...new Set(GATES.map((g) => g.raid))];
export const difficultiesOf = (raid: string) => [...new Set(GATES.filter((g) => g.raid === raid).map((g) => g.difficulty))];
export const gatesOf = (raid: string, difficulty: string) =>
  GATES.filter((g) => g.raid === raid && g.difficulty === difficulty);

export type Band = "BELOW_LOW" | "IN_RANGE" | "ABOVE_HIGH";

/**
 * 내 위치(%) = (내 피해량 − 하한) ÷ (상한 − 하한) × 100, one decimal. Below 0
 * is under the lower bound, above 100 over the upper one.
 */
export function position(damage: number, gate: { low: number; high: number }) {
  const pct = Math.round(((damage - gate.low) / (gate.high - gate.low)) * 1000) / 10;
  const band: Band = pct < 0 ? "BELOW_LOW" : pct > 100 ? "ABOVE_HIGH" : "IN_RANGE";
  return { pct, band };
}

/** Accepts "1,740.4", "1740억", " 2088.5 " — a number of 억, or null when empty. */
export function parseDamage(text: string): number | null {
  const cleaned = text.replace(/[\s,억]/g, "");
  if (!cleaned) return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

export const formatEok = (value: number) =>
  `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`;
