// (ours, M42) 특수 재련 돌파석 가치: the refining api's special-stone-values (api #1099, #1101, #1105). Shared by the
// 재련 계산기 section (components/tools/refining-special.tsx) and 프론트2's X4 (a) 원정대 quick switch, so both read the
// same query key, the same request rules and the same words.
// Value of one stone at a stage = E[normal refine cost fromStage → +1] ÷ (stones per try ÷ the official base rate);
// the api computes it (계산 검증 PASS 11-22: 무기 20 → 21 = 490.4 G at the capture's prices). The page only ranks and
// shows it.
import type { components } from "../api/refining-schema";
import { RefiningQueryError, postSpecialStoneValues } from "./client";
import { PARTS, refiningFailureCopy, type PartId, type PartState } from "./model";

type Schemas = components["schemas"];
export type SpecialRequest = Schemas["SpecialStoneValuesRequest"];
export type SpecialTarget = Schemas["SpecialStoneTargetRequest"];
export type SpecialPrice = Schemas["SpecialStonePriceRequest"];
export type SpecialValues = Schemas["SpecialStoneValuesResponse"];
export type SpecialRow = Schemas["SpecialStoneRowResponse"];
export type SpecialEnvelope = { code: string; message: string; data: SpecialValues };
export type SpecialBasis = NonNullable<SpecialRequest["priceBasis"]>;

/** Request bounds (the contract): 1–28 targets, fromStage 10–24, ≤ 32 prices of 0–1e9 G with ≤ 2 decimals. */
export const SPECIAL_MAX_TARGETS = 28;
export const SPECIAL_MIN_FROM = 10;
export const SPECIAL_MAX_FROM = 24;
export const SPECIAL_MAX_PRICES = 32;
export const SPECIAL_MAX_PRICE = 1_000_000_000;
const NAME_MAX = 32;
/** The stages with a sourced per-try count: 전율 11 → 12 … 24 → 25 (10 → 11 is UNSUPPORTED, api answer 1). */
export const SPECIAL_RANKED_FROM = 11;

const GRADES = ["UPHWA", "JEONYUL"] as const;
const TYPES = ["WEAPON", "ARMOR", "ARM_GUARD"] as const;
const BASES = ["CURRENT_MIN_PRICE", "RECENT_PRICE", "YDAY_AVG_PRICE"] as const;

export const targetKey = (t: Pick<SpecialTarget, "grade" | "equipmentType" | "fromStage">) =>
  `${t.grade}:${t.equipmentType}:${t.fromStage}`;

/** The full ranking: 전율 무기 and 방어구, every sourced stage (14 × 2 = 28, the request maximum). */
export function rankingTargets(): SpecialTarget[] {
  return (["WEAPON", "ARMOR"] as const).flatMap((equipmentType) =>
    Array.from({ length: SPECIAL_MAX_FROM - SPECIAL_RANKED_FROM + 1 }, (_, i) => ({
      grade: "JEONYUL" as const,
      equipmentType,
      fromStage: SPECIAL_RANKED_FROM + i,
    })),
  );
}

export type PieceTarget = {
  part: (typeof PARTS)[number];
  /** null: no next stage to value (already +25, or below the api's range). */
  target: SpecialTarget | null;
};

/**
 * Each piece's next stage as the api's target, in the page's part order. The five armour pieces share one type, so two
 * at the same stage are one target (the api answers 400 to a duplicate): use `targetsOf` for the request.
 */
export function pieceTargets(parts: Record<PartId, PartState>): PieceTarget[] {
  return PARTS.map((part) => {
    const state = parts[part.id];
    const from = state.current;
    const ok = Number.isInteger(from) && from >= SPECIAL_MIN_FROM && from <= SPECIAL_MAX_FROM;
    return {
      part,
      target: ok ? { grade: state.grade, equipmentType: part.type as SpecialTarget["equipmentType"], fromStage: from } : null,
    };
  });
}

/** The distinct targets, first seen first. */
export function targetsOf(list: readonly (SpecialTarget | null)[]): SpecialTarget[] {
  const seen = new Set<string>();
  return list.flatMap((t) => {
    if (!t || seen.has(targetKey(t))) return [];
    seen.add(targetKey(t));
    return [t];
  });
}

/**
 * One cache entry per (targets in order, basis, prices): the rows come back in request order, so the order is part of
 * the key; prices are sorted by name (the same overrides in another order are the same request).
 */
export function specialKey(request: SpecialRequest) {
  const prices = [...(request.prices ?? [])].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return JSON.stringify([
    request.priceBasis ?? "CURRENT_MIN_PRICE",
    request.targets.map(targetKey),
    prices.map((p) => [p.name, p.unitPriceGold]),
  ]);
}

export const specialQueryKey = (request: SpecialRequest) => ["refining-special", specialKey(request)] as const;

const isInt = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
/** At most two decimal places, checked on the cents (0.1 + 0.2 style floats stay accepted). */
const twoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
export const isPriceValue = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= SPECIAL_MAX_PRICE && twoDecimals(value);

/**
 * Server-side allow-list before any backend call (the proxy route): the contract's bounds, no duplicate target, no
 * duplicate price name. Unknown fields are dropped. An unused price name is the api's 400 (only it knows the stages).
 */
export function parseSpecialRequest(body: unknown): SpecialRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (!Array.isArray(input.targets) || input.targets.length < 1 || input.targets.length > SPECIAL_MAX_TARGETS) return null;
  const targets: SpecialTarget[] = [];
  const seen = new Set<string>();
  for (const raw of input.targets) {
    if (!raw || typeof raw !== "object") return null;
    const t = raw as Record<string, unknown>;
    if (!GRADES.includes(t.grade as never) || !TYPES.includes(t.equipmentType as never)) return null;
    if (!isInt(t.fromStage, SPECIAL_MIN_FROM, SPECIAL_MAX_FROM)) return null;
    const target = {
      grade: t.grade as SpecialTarget["grade"],
      equipmentType: t.equipmentType as SpecialTarget["equipmentType"],
      fromStage: t.fromStage as number,
    };
    if (seen.has(targetKey(target))) return null;
    seen.add(targetKey(target));
    targets.push(target);
  }
  const request: SpecialRequest = { targets };
  if (input.priceBasis !== undefined) {
    if (!BASES.includes(input.priceBasis as never)) return null;
    request.priceBasis = input.priceBasis as SpecialBasis;
  }
  if (input.prices !== undefined) {
    if (!Array.isArray(input.prices) || input.prices.length > SPECIAL_MAX_PRICES) return null;
    const names = new Set<string>();
    const prices: SpecialPrice[] = [];
    for (const raw of input.prices) {
      if (!raw || typeof raw !== "object") return null;
      const p = raw as Record<string, unknown>;
      if (typeof p.name !== "string" || p.name.trim() !== p.name || p.name.length < 1 || p.name.length > NAME_MAX) return null;
      if (!isPriceValue(p.unitPriceGold) || names.has(p.name)) return null;
      names.add(p.name);
      prices.push({ name: p.name, unitPriceGold: p.unitPriceGold });
    }
    if (prices.length) request.prices = prices;
  }
  return request;
}

/** A price the user typed: '1,234.5' → 1234.5; empty → undefined (no override); not a valid price → null. */
export function parsePriceInput(text: string): number | null | undefined {
  const trimmed = text.replace(/[,\s]/g, "");
  if (trimmed === "") return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return isPriceValue(value) ? value : null;
}

/** The longest price text a field takes (the input's maxLength): '1,000,000,000.00' is 16. */
export const PRICE_TEXT_MAX = 16;

/** One typed price the address keeps: a name in the request's bounds and a text that is a valid price. */
const keptEntry = (name: string, text: unknown): text is string =>
  name.length >= 1 &&
  name.length <= NAME_MAX &&
  typeof text === "string" &&
  text.length <= PRICE_TEXT_MAX &&
  typeof parsePriceInput(text) === "number";

/**
 * The typed prices in the address ('stone' on /tools/refining; every input lives there, #889): name → the text as
 * typed. Only valid prices are written, and reading drops a bad entry on its own (PM-프론트 #1974, flag-on blocker 1):
 * a half-typed or wrong text in one field never costs the others on a reload. At most 32 (the request's bound).
 * No valid typed price: no parameter.
 */
export const priceEditsCodec = {
  parse(raw: string): Record<string, string> | null {
    try {
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const kept = Object.entries(value as Record<string, unknown>)
        .filter(([name, text]) => keptEntry(name, text))
        .slice(0, SPECIAL_MAX_PRICES);
      return Object.fromEntries(kept) as Record<string, string>;
    } catch {
      return null;
    }
  },
  format(value: Record<string, string>): string {
    const kept = Object.entries(value)
      .filter(([name, text]) => keptEntry(name, text))
      .slice(0, SPECIAL_MAX_PRICES);
    return kept.length ? JSON.stringify(Object.fromEntries(kept)) : "";
  },
};

/** market null: the market has no price for it (a PRICE_MISSING row names it), so only a typed price can fill it. */
export type PriceField = { name: string; market: number | null; role: "material" | "breath" };

/**
 * The prices a user can change: every material and breath the OK rows' one normal try uses, at the value the api used
 * (read from a market-only answer, so it is the market price at that basis), then the names a PRICE_MISSING row lacks
 * (no market price: typing one is the only way to value that stage; codex #1974 re-run P2). First seen first.
 */
export function priceFields(values: SpecialValues | null | undefined): PriceField[] {
  const fields = new Map<string, PriceField>();
  for (const row of values?.rows ?? []) {
    const normal = row.normalTry;
    if (row.status !== "OK" || !normal) continue;
    for (const m of normal.materials)
      if (!fields.has(m.name)) fields.set(m.name, { name: m.name, market: m.unitPriceGold, role: "material" });
    if (normal.breath && !fields.has(normal.breath.name))
      fields.set(normal.breath.name, { name: normal.breath.name, market: normal.breath.unitPriceGold, role: "breath" });
  }
  for (const row of values?.rows ?? []) {
    if (row.status !== "PRICE_MISSING") continue;
    for (const name of row.missingPrices)
      if (!fields.has(name)) fields.set(name, { name, market: null, role: /숨결$/.test(name) ? "breath" : "material" });
  }
  return [...fields.values()];
}

/**
 * The overrides to send: each typed, valid price that is not the market's own value, for a name the market answer
 * uses (a name no stage uses would be the api's 400). Sorted by name, so the key does not follow typing order.
 */
export function overridesFrom(edits: Readonly<Record<string, string>>, fields: readonly PriceField[]): SpecialPrice[] {
  return fields
    .flatMap((field) => {
      const value = parsePriceInput(edits[field.name] ?? "");
      // No market price: any valid typed price goes. Else only one that is not the market's own value.
      if (value == null || (field.market != null && Math.abs(value - field.market) < 1e-9)) return [];
      return [{ name: field.name, unitPriceGold: value }];
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .slice(0, SPECIAL_MAX_PRICES);
}

/** OK rows by value per stone, highest first (ties: weapon, then the lower stage); the rest after, in request order. */
export function rankRows(rows: readonly SpecialRow[]): SpecialRow[] {
  const ok = rows.filter((row) => row.status === "OK" && row.valuePerStoneGold != null);
  const rest = rows.filter((row) => !ok.includes(row));
  ok.sort(
    (a, b) =>
      b.valuePerStoneGold! - a.valuePerStoneGold! ||
      (a.equipmentType === b.equipmentType ? 0 : a.equipmentType === "WEAPON" ? -1 : 1) ||
      a.fromStage - b.fromStage,
  );
  return [...ok, ...rest];
}

export const rowFor = (values: SpecialValues | null | undefined, target: SpecialTarget | null) =>
  target ? (values?.rows.find((row) => targetKey(row) === targetKey(target)) ?? null) : null;

const TYPE_LABEL: Record<SpecialTarget["equipmentType"], string> = { WEAPON: "무기", ARMOR: "방어구", ARM_GUARD: "완갑" };
const GRADE_LABEL: Record<SpecialTarget["grade"], string> = { UPHWA: "업화", JEONYUL: "전율" };
export const stageLabel = (t: Pick<SpecialTarget, "equipmentType" | "fromStage">) =>
  `${TYPE_LABEL[t.equipmentType]} +${t.fromStage} → +${t.fromStage + 1}`;
export const gradeLabel = (grade: SpecialTarget["grade"]) => GRADE_LABEL[grade];
/** 'base rate' in bp → '1.5%'. */
export const rateLabel = (bp: number) => `${(bp / 100).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;
/** The stone's name, or '돌파석' while 순환 / 전이 is not sourced (stone null, contract). */
export const stoneLabel = (row: Pick<SpecialRow, "stone">) => row.stone ?? "돌파석";

/** The row's state in our words. A reason code we do not know shows the api's own sentence. */
export function rowNote(row: SpecialRow): string | null {
  if (row.status === "OK") return null;
  if (row.status === "PRICE_MISSING")
    return row.missingPrices.length
      ? `시세가 없는 재료가 있어 계산하지 않았어요: ${row.missingPrices.join(", ")}`
      : "시세가 없는 재료가 있어 계산하지 않았어요.";
  if (row.reasonCode === "SPECIAL_REFINE_UNSOURCED") return "특수 재련 1회 소모량을 아직 확인하고 있어요.";
  return row.reason ?? "계산하지 않았어요.";
}

/** Where the per-try counts come from, without a site name (public repo rule; the api gives none). */
export function sourceLine(source: SpecialValues["perTrySource"]) {
  return `1회 소모량: ${source.name}, ${source.capturedOn.replaceAll("-", ".")} 확인${source.singleSource ? "(한 곳 자료)" : ""}`;
}

const hhmm = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Seoul",
});
/** pricesObservedAt is the earliest observation the values use (contract), so the prices are from then on. */
export function observedLine(observedAt: string | null | undefined) {
  if (!observedAt) return null;
  const date = new Date(observedAt);
  return Number.isNaN(date.getTime()) ? null : `시세 ${hhmm.format(date)} 이후`;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

/** The longest wait for a busy solver before the one retry (Retry-After is a few seconds). */
const BUSY_WAIT_MAX_MS = 10_000;

/**
 * One call, and when the solver seat is busy (429 REFINING_SOLVE_BUSY: user-priced requests share one private seat and a
 * second at the same time is refused at once, api #1101 / #1105), one more after Retry-After. A second busy answer is
 * the caller's to show.
 */
export async function fetchSpecialStoneValues(
  request: SpecialRequest,
  signal?: AbortSignal,
  options: { post?: typeof postSpecialStoneValues; now?: () => number; wait?: typeof sleep } = {},
): Promise<SpecialEnvelope> {
  const post = options.post ?? postSpecialStoneValues;
  try {
    return await post(request, signal);
  } catch (error) {
    if (!(error instanceof RefiningQueryError) || error.info.code !== "REFINING_SOLVE_BUSY") throw error;
    const now = (options.now ?? Date.now)();
    const ms = Math.min(BUSY_WAIT_MAX_MS, Math.max(1_000, (error.info.retryAt ?? now + 1_000) - now));
    await (options.wait ?? sleep)(ms, signal);
    return post(request, signal);
  }
}

/** The query both consumers use: same key, same retry rule. Values change only with the prices; no focus refetch. */
export const specialQuery = (request: SpecialRequest) => ({
  queryKey: specialQueryKey(request),
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchSpecialStoneValues(request, signal),
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
});

export function specialFailureCopy(error: { code: string }) {
  switch (error.code) {
    case "REFINING_PRICE_PENDING":
      return { title: "재료 시세를 모으고 있어요", text: "돌파석 가치는 재료 시세로 계산해요. 1분쯤 뒤 다시 계산해 주세요." };
    case "REFINING_SOLVE_BUSY":
      return { title: "계산이 몰려 있어요", text: "바꾼 시세로 하는 계산은 한 번에 하나씩 해요. 잠시 뒤 다시 계산해 주세요." };
    case "INVALID_REQUEST":
      return { title: "재료 값을 확인해 주세요", text: "재료 값은 0~10억 골드, 소수 둘째 자리까지 넣어 주세요." };
    case "NOT_FOUND":
      return { title: "돌파석 가치를 아직 열지 않았어요", text: "준비가 끝나면 여기에 단계별 가치가 나와요." };
    default:
      return refiningFailureCopy(error);
  }
}
