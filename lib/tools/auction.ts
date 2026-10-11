// Raid auction bid calculator — pure, client-only. Checked 2026-10-08 with
// 100,000G·4인 and 99,999G·8인 (계산 검증 표본, tests/verification-fixtures).
// "Use it myself" has no market fee (PM 총괄 결정 2026-10-08).
//
// Rules:
// - The winning bid is split equally among the other party members.
// - Selling on the market costs a 5% fee, rounded up (99,999 → 5,000).
// - A counter-bid must be 10% higher, so bidding break-even ÷ 1.1 leaves no
//   room for a profitable counter-bid. The official rule text was not checked, so the UI marks it "추정".
// - A winning bid over 100,000G loses 5% of the part above 100,000 before it
//   is shared (계산 검증 10-11 16:42, PM 총괄 반영 결정).
//   Shared total D(y) = y − 0.05 × max(0, y − 100,000), each gets D ÷ (n − 1),
//   and the break-even above 100,000 solves S − y = D(y) ÷ (n − 1):
//   y = ((n − 1) × S − 5,000) ÷ (n − 0.05).
// Bids and shares round down to whole gold. Everything stays in integer
// arithmetic so large prices never drift.

export const MARKET_FEE_PERCENT = 5;
export const MIN_PARTY = 2;
export const MAX_PARTY = 30;
export const MAX_PRICE = 1_000_000_000;
/** Above this winning bid, 5% of the excess is taken before sharing. */
export const SHARE_FEE_FROM = 100_000;
export const SHARE_FEE_PERCENT = 5;

export const PARTY_PRESETS = [
  { size: 4, label: "4인" },
  { size: 8, label: "8인" },
  { size: 16, label: "16인" },
  { size: 30, label: "30인", hint: "필드 보스·카오스게이트" },
] as const;

export const DEFAULT_PARTY = 8;

export type StrategyId =
  | "preempt"
  | "keep75"
  | "keep50"
  | "keep25"
  | "breakEven"
  | "useMyself";

/** Bid = break-even × num ÷ den. Preempt is ÷1.1, keep N% is ÷(1 + 0.1·N%). */
const RATIOS: Record<Exclude<StrategyId, "useMyself">, [number, number]> = {
  preempt: [10, 11],
  keep75: [40, 43],
  keep50: [20, 21],
  keep25: [40, 41],
  breakEven: [1, 1],
};

export const STRATEGY_ORDER: StrategyId[] = [
  "preempt",
  "keep75",
  "keep50",
  "keep25",
  "breakEven",
  "useMyself",
];

export type Strategy = {
  id: StrategyId;
  bid: number;
  /** Gold each other member receives if this bid wins. */
  share: number;
  /** Sold on the market: gold left over a fair 1/n split (break-even − bid). */
  saleProfit: number;
};

export type AuctionResult = {
  price: number;
  party: number;
  fee: number;
  /** Gold received when sold on the market (price − fee). */
  saleGold: number;
  breakEven: number;
  /** Share each other member gets at break-even. */
  breakEvenShare: number;
  useMyself: number;
  strategies: Strategy[];
};

const scale = (value: number, num: number, den: number) =>
  Math.floor((value * num) / den);

export function marketFee(price: number) {
  return Math.ceil((price * MARKET_FEE_PERCENT) / 100);
}

/** Gold each other member receives when `bid` wins (after the 100,000G fee). */
export function shareOf(bid: number, party: number) {
  // ×20 keeps 5% in whole numbers: 20·D = 20·bid − max(0, bid − 100,000).
  const shared20 = 20 * bid - Math.max(0, bid - SHARE_FEE_FROM);
  return Math.floor(shared20 / (20 * (party - 1)));
}

/** The bid where the winner keeps exactly what each other member gets. */
function evenBid(gold: number, party: number) {
  const others = party - 1;
  const plain = scale(gold, others, party);
  if (plain <= SHARE_FEE_FROM) return plain;
  // y = ((n − 1)·S − 5,000) ÷ (n − 0.05), ×20 top and bottom.
  return Math.max(
    SHARE_FEE_FROM,
    Math.floor((20 * others * gold - SHARE_FEE_FROM) / (20 * party - 1)),
  );
}

export function calculateAuction(price: number, party: number): AuctionResult {
  const fee = marketFee(price);
  const saleGold = price - fee;
  const breakEven = evenBid(saleGold, party);
  const useMyself = evenBid(price, party);
  const strategies = STRATEGY_ORDER.map((id): Strategy => {
    const bid =
      id === "useMyself" ? useMyself : scale(breakEven, ...RATIOS[id]);
    return {
      id,
      bid,
      share: shareOf(bid, party),
      saleProfit: breakEven - bid,
    };
  });
  return {
    price,
    party,
    fee,
    saleGold,
    breakEven,
    breakEvenShare: shareOf(breakEven, party),
    useMyself,
    strategies,
  };
}

/** Accepts "100,000", "100000G", " 1 000 " — digits only after stripping. */
export function parseGold(text: string): number | null {
  const digits = text.replace(/[\s,G골드]/gi, "");
  if (!digits) return null;
  if (!/^\d+$/.test(digits)) return Number.NaN;
  return Number(digits);
}

export function priceError(text: string): string | null {
  const value = parseGold(text);
  if (value === null) return null;
  if (Number.isNaN(value)) return "숫자만 입력해 주세요.";
  if (value < 1) return "1골드 이상 입력해 주세요.";
  if (value > MAX_PRICE) return "10억 골드 이하로 입력해 주세요.";
  return null;
}

export function partyError(value: number): string | null {
  if (!Number.isInteger(value) || value < MIN_PARTY || value > MAX_PARTY)
    return `${MIN_PARTY}~${MAX_PARTY}명 사이로 입력해 주세요.`;
  return null;
}

/** Reads ?price=&party= so a calculation can be shared as a link. */
export function readAuctionParams(params: {
  price?: string | string[];
  party?: string | string[];
}) {
  const one = (value?: string | string[]) =>
    typeof value === "string" ? value.slice(0, 16) : "";
  const priceText = one(params.price);
  const price = parseGold(priceText);
  const party = Number(one(params.party));
  return {
    price:
      price !== null && !priceError(priceText) ? String(price) : "",
    party: partyError(party) ? DEFAULT_PARTY : party,
  };
}

export const formatGold = (value: number) =>
  `${value.toLocaleString("ko-KR")}G`;

export const formatSigned = (value: number) =>
  value > 0 ? `+${formatGold(value)}` : value < 0 ? `−${formatGold(-value)}` : "0G";
