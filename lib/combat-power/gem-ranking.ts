// (ours, M49) 바꿔 본 젬 순위: one row per gem swap from its own one-change /simulate answer (api #1079), ranked by
// the 전투력 increase. The component (components/tools/ark-gem-ranking.tsx) asks and draws; this decides the rows.
import { gemText, WILL_SHORT, WILL_SHORT_TEXT, type CurrentGem, type GemEdit } from "./ark-gems";
import type { Simulation } from "./model";

export type GemSwap = { key: string; gem: CurrentGem; swap: GemEdit };

export type GemRankRow =
  | { key: string; state: "OK"; label: string; to: string; percent: number }
  | { key: string; state: "NOT_COMPUTED"; label: string; to: string; why: string }
  | { key: string; state: "WAITING"; label: string; to: string };

/** The gem's name on screen: the core's own name (after ': ') and the gem's place in it, counted from 1. */
export const gemName = (gem: { core: string; index: number }) => `${gem.core.replace(/^.*:\s*/, "")} 젬 ${gem.index + 1}`;

export const FAILED_TEXT = "계산하지 못했어요. 잠시 뒤 다시 바꿔 보세요.";

/** One swap's answer as a row: its increase, or why it has none (the api's sentence first), or still waiting. */
export function rowOf(item: GemSwap, data: Simulation | undefined, failed: boolean): GemRankRow {
  const label = gemName(item.gem);
  const to = gemText(item.swap);
  if (!data) return failed ? { key: item.key, state: "NOT_COMPUTED", label, to, why: FAILED_TEXT } : { key: item.key, state: "WAITING", label, to };
  const line = data.contributions[0];
  if (line?.status === "OK" && data.deltaPercent != null) return { key: item.key, state: "OK", label, to, percent: data.deltaPercent };
  const why = line?.basis || (line?.reasonCode === WILL_SHORT ? WILL_SHORT_TEXT : "이 젬은 계산하지 않았어요.");
  return { key: item.key, state: "NOT_COMPUTED", label, to, why };
}

/** Ranked by the increase (higher first; the gems' own order on a tie), then the rows without a number, in order. */
export function rankRows(rows: GemRankRow[]): GemRankRow[] {
  const ok = rows.flatMap((row, i) => (row.state === "OK" ? [{ row, i }] : []));
  ok.sort((a, b) => b.row.percent - a.row.percent || a.i - b.i);
  return [...ok.map((x) => x.row), ...rows.filter((row) => row.state !== "OK")];
}

/** '+0.41%' / '−0.12%' / '0.00%'. */
export const percentText = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)}%`;
