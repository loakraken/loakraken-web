// (ours, M49 phase 2, web #1969) 젬 가공 순위: for each ark grid gem worn, the api ranks the ways to process a new gem
// and swap it in (api gem-ranking #1095): success probability, expected combat-power gain, expected cost and gold per 1%.
// Not lib/combat-power/gem-ranking.ts, which ranks the swaps the user typed (phase 1).
import type { components } from "../api/combat-power-schema";
import { characterNameError, normalizeCharacterName } from "../character/model";
import { combatPowerFailureCopy } from "./model";

type Schemas = components["schemas"];
export type GemRankingRequest = Schemas["GemRankingRequest"];
export type GemRanking = Schemas["GemRankingResponse"];
export type GemRankingRow = Schemas["GemRankingRowResponse"];
export type GemRankingEnvelope = { code: string; message: string; data: GemRanking };
export type GemGrade = GemRankingRequest["grade"];

export const GEM_GRADES: { value: GemGrade; label: string }[] = [
  { value: "HERO", label: "영웅" },
  { value: "RARE", label: "희귀" },
];
/** Every row the api has (the web groups them per gem itself, contract §6). */
export const RANKING_LIMIT = 200;
const RESET_TICKET_MAX = 10_000_000;
const PHEON_MAX = 100_000;

/** A typed gold amount: empty → null (not given), a whole number in range, or invalid. */
export function goldField(text: string, max: number): { value: number | null; invalid: boolean } {
  const t = text.trim().replace(/,/g, "");
  if (!t) return { value: null, invalid: false };
  if (!/^\d+$/.test(t)) return { value: null, invalid: true };
  const value = Number(t);
  return value <= max ? { value, invalid: false } : { value: null, invalid: true };
}
export const resetTicketField = (text: string) => goldField(text, RESET_TICKET_MAX);
export const pheonField = (text: string) => goldField(text, PHEON_MAX);

/** The request the page sends: all four policies, both 초기화 ways (on only with a ticket price), every row. */
export function rankingRequest(name: string, grade: GemGrade, resetTicket: number | null, pheon: number | null): GemRankingRequest {
  const prices = {
    ...(resetTicket != null ? { resetTicketGold: resetTicket } : {}),
    ...(pheon != null ? { pheonGold: pheon } : {}),
  };
  return { characterName: name, grade, ...(Object.keys(prices).length ? { prices } : {}), limit: RANKING_LIMIT };
}

const POLICIES = ["ALL", "A_OR_B", "A", "A_AND_B"] as const;

/** Server-side allow-list before any backend call (contract §1). */
export function parseGemRankingRequest(body: unknown): GemRankingRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (typeof input.characterName !== "string" || characterNameError(input.characterName)) return null;
  if (input.grade !== "HERO" && input.grade !== "RARE") return null;
  if (input.policies !== undefined) {
    if (!Array.isArray(input.policies) || input.policies.some((p) => !POLICIES.includes(p as never))) return null;
    if (new Set(input.policies).size !== input.policies.length) return null;
  }
  if (input.reset !== undefined) {
    if (!Array.isArray(input.reset) || input.reset.some((r) => typeof r !== "boolean")) return null;
    if (new Set(input.reset).size !== input.reset.length) return null;
  }
  let prices: GemRankingRequest["prices"];
  if (input.prices !== undefined) {
    if (!input.prices || typeof input.prices !== "object" || Array.isArray(input.prices)) return null;
    const p = input.prices as Record<string, unknown>;
    const inRange = (v: unknown, max: number) => v === undefined || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max);
    if (!inRange(p.resetTicketGold, RESET_TICKET_MAX) || !inRange(p.pheonGold, PHEON_MAX)) return null;
    prices = {
      ...(p.resetTicketGold !== undefined ? { resetTicketGold: p.resetTicketGold as number } : {}),
      ...(p.pheonGold !== undefined ? { pheonGold: p.pheonGold as number } : {}),
    };
  }
  const limit = input.limit ?? RANKING_LIMIT;
  if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > RANKING_LIMIT) return null;
  return {
    characterName: normalizeCharacterName(input.characterName),
    grade: input.grade,
    ...(input.policies !== undefined ? { policies: input.policies as GemRankingRequest["policies"] } : {}),
    ...(input.reset !== undefined ? { reset: input.reset as boolean[] } : {}),
    ...(prices ? { prices } : {}),
    limit: limit as number,
  };
}

export type GemGroup = {
  key: string;
  slotIndex: number;
  gemIndex: number;
  coreName: string;
  current: GemRankingRow["currentGem"];
  /** The api's best way for this gem (its first row), then the others in the api's order. */
  best: GemRankingRow;
  others: GemRankingRow[];
};

/** Rows per worn gem (slotIndex · gemIndex, 0-based as the character's ark grid), in the order of each gem's best row. */
export function groupByGem(rows: readonly GemRankingRow[]): GemGroup[] {
  const groups = new Map<string, GemGroup>();
  for (const row of rows) {
    const key = `${row.slotIndex}:${row.gemIndex}`;
    const group = groups.get(key);
    if (group) group.others.push(row);
    else
      groups.set(key, {
        key,
        slotIndex: row.slotIndex,
        gemIndex: row.gemIndex,
        coreName: row.coreName,
        current: row.currentGem,
        best: row,
        others: [],
      });
  }
  return [...groups.values()];
}

/** What the processing aims for, in our words; an unknown policy shows its code (contract: strings can grow). */
export function wayText(row: Pick<GemRankingRow, "policy" | "targetTotal" | "reset">): string {
  const policy =
    { ALL: "효과 상관없이", A_OR_B: "주요 효과 하나 이상", A: "첫 주요 효과", A_AND_B: "주요 효과 둘 다" }[row.policy] ?? row.policy;
  return `${policy} · 포인트 합 ${row.targetTotal} 이상${row.reset ? " · 초기화 사용" : ""}`;
}

const MISSING: Record<string, string> = { GEM: "젬 시세", PHEON: "페온 1개 골드", RESET_TICKET: "초기화권 가격" };
/** The prices a row's cost waits on, in our words ('젬 시세 · 페온 1개 골드'). */
export const missingText = (missing: readonly string[]) => missing.map((m) => MISSING[m] ?? m).join(" · ");

export const probabilityText = (p: number) => `${(Math.round(p * 1000) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
export const gainText = (pct: number) => `+${pct.toLocaleString("ko-KR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%`;
export const gemsText = (n: number) => n.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
export const goldText = (g: number) => `${Math.round(g).toLocaleString("ko-KR")}G`;

export function gemRankingFailureCopy(error: { code: string }) {
  if (error.code === "GEM_RANKING_BUSY")
    return { title: "지금은 계산하는 사람이 많아요", text: "잠시 뒤 다시 계산해 주세요. 다시 계산할 수 있을 때까지 단추에 남은 시간이 보여요." };
  if (error.code === "INVALID_REQUEST")
    return { title: "값을 확인해 주세요", text: "초기화권 가격은 1,000만 골드, 페온 1개 골드는 10만 골드까지 넣을 수 있어요." };
  return combatPowerFailureCopy(error);
}
