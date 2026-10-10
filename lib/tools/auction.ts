// Raid auction bid calculator — pure, client-only. Follows ILOA /tools/bid
// (checked 2026-10-08 with 100,000G·4인 and 99,999G·8인); LOALAB differs only
// in also taking the market fee off the "use it myself" price.
//
// Rules:
// - The winning bid is split equally among the other party members.
// - Selling on the market costs a 5% fee, rounded up (ILOA: 99,999 → 5,000).
// - A counter-bid must be 10% higher, so bidding break-even ÷ 1.1 leaves no
//   room for a profitable counter-bid. ILOA and LOALAB share this basis; the
//   official rule text was not checked, so the UI marks it "추정".
// Bids and shares round down to whole gold. Everything stays in integer
// arithmetic so large prices never drift.

export const MARKET_FEE_PERCENT = 5;
export const MIN_PARTY = 2;
export const MAX_PARTY = 30;
export const MAX_PRICE = 1_000_000_000;

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

export function calculateAuction(price: number, party: number): AuctionResult {
  const fee = marketFee(price);
  const saleGold = price - fee;
  const others = party - 1;
  const breakEven = scale(saleGold, others, party);
  const useMyself = scale(price, others, party);
  const strategies = STRATEGY_ORDER.map((id): Strategy => {
    const bid =
      id === "useMyself" ? useMyself : scale(breakEven, ...RATIOS[id]);
    return {
      id,
      bid,
      share: Math.floor(bid / others),
      saleProfit: breakEven - bid,
    };
  });
  return {
    price,
    party,
    fee,
    saleGold,
    breakEven,
    breakEvenShare: Math.floor(breakEven / others),
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
