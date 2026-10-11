import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PARTY,
  MAX_PARTY,
  MAX_PRICE,
  calculateAuction,
  formatSigned,
  marketFee,
  parseGold,
  partyError,
  priceError,
  readAuctionParams,
  shareOf,
} from "../lib/tools/auction";

const bids = (price: number, party: number) =>
  Object.fromEntries(
    calculateAuction(price, party).strategies.map((s) => [s.id, s.bid]),
  );

test("matches ILOA for 100,000G in a 4-player party", () => {
  const result = calculateAuction(100_000, 4);
  assert.equal(result.fee, 5_000);
  assert.equal(result.saleGold, 95_000);
  assert.equal(result.breakEven, 71_250);
  assert.equal(result.breakEvenShare, 23_750);
  assert.deepEqual(bids(100_000, 4), {
    preempt: 64_772,
    keep75: 66_279,
    keep50: 67_857,
    keep25: 69_512,
    breakEven: 71_250,
    useMyself: 75_000,
  });
  const profits = result.strategies.map((s) => s.saleProfit);
  assert.deepEqual(profits, [6_478, 4_971, 3_393, 1_738, 0, -3_750]);
});

test("matches ILOA rounding for 99,999G in an 8-player party", () => {
  const result = calculateAuction(99_999, 8);
  assert.equal(result.fee, 5_000, "fee rounds up");
  assert.equal(result.breakEven, 83_124, "bids round down");
  assert.equal(result.breakEvenShare, 11_874);
  assert.deepEqual(bids(99_999, 8), {
    preempt: 75_567,
    keep75: 77_324,
    keep50: 79_165,
    keep25: 81_096,
    breakEven: 83_124,
    useMyself: 87_499,
  });
});

test("30-player field boss party matches ILOA", () => {
  const result = calculateAuction(100_000, 30);
  assert.equal(result.breakEven, 91_833);
  assert.equal(result.breakEvenShare, 3_166);
});

test("break-even leaves the winner exactly a fair share", () => {
  for (const party of [2, 4, 8, 16, 30]) {
    const { saleGold, breakEven, breakEvenShare } = calculateAuction(
      1_000_000,
      party,
    );
    // Winner keeps saleGold − bid; others get bid ÷ (n−1). Equal within 1G.
    assert.ok(Math.abs(saleGold - breakEven - breakEvenShare) <= 1, `${party}`);
  }
});

test("bids never decrease across strategies", () => {
  for (const price of [1, 7, 99, 12_345, 987_654_321]) {
    for (const party of [2, 4, 8, 16, 30]) {
      const list = calculateAuction(price, party).strategies.map((s) => s.bid);
      for (let i = 1; i < list.length; i += 1)
        assert.ok(list[i] >= list[i - 1], `${price}/${party}`);
    }
  }
});

test("tiny and huge prices stay whole and finite", () => {
  const one = calculateAuction(1, 2);
  assert.equal(one.fee, 1);
  assert.equal(one.saleGold, 0);
  assert.equal(one.breakEven, 0);
  assert.equal(one.useMyself, 0);
  const big = calculateAuction(MAX_PRICE, 8);
  assert.equal(big.fee, 50_000_000);
  // Above 100,000G the share fee applies: ((7 × 950,000,000) − 5,000) ÷ 7.95.
  assert.equal(big.breakEven, 836_477_358);
  for (const s of big.strategies) assert.ok(Number.isSafeInteger(s.bid));
  assert.equal(marketFee(20), 1);
  assert.equal(marketFee(21), 2);
});

test("price input accepts commas and rejects junk, zero, and overflow", () => {
  assert.equal(parseGold(""), null);
  assert.equal(parseGold("  "), null);
  assert.equal(parseGold("100,000"), 100_000);
  assert.equal(parseGold("1 000G"), 1_000);
  assert.ok(Number.isNaN(parseGold("12a")));
  assert.ok(Number.isNaN(parseGold("-5")));
  assert.ok(Number.isNaN(parseGold("1.5")));
  assert.equal(priceError(""), null);
  assert.equal(priceError("0"), "1골드 이상 입력해 주세요.");
  assert.equal(priceError(String(MAX_PRICE)), null);
  assert.equal(priceError(String(MAX_PRICE + 1)), "10억 골드 이하로 입력해 주세요.");
  assert.equal(priceError("abc"), "숫자만 입력해 주세요.");
});

test("party size is limited to 2..30 whole players", () => {
  assert.equal(partyError(2), null);
  assert.equal(partyError(MAX_PARTY), null);
  assert.ok(partyError(1));
  assert.ok(partyError(31));
  assert.ok(partyError(4.5));
  assert.ok(partyError(Number.NaN));
});

test("shared links fall back to safe defaults", () => {
  assert.deepEqual(readAuctionParams({ price: "100000", party: "4" }), {
    price: "100000",
    party: 4,
  });
  assert.deepEqual(readAuctionParams({ price: "x", party: "99" }), {
    price: "",
    party: DEFAULT_PARTY,
  });
  assert.deepEqual(readAuctionParams({ price: ["1", "2"] }), {
    price: "",
    party: DEFAULT_PARTY,
  });
});

test("signed gold uses a real minus sign", () => {
  assert.equal(formatSigned(1_234), "+1,234G");
  assert.equal(formatSigned(-3_750), "−3,750G");
  assert.equal(formatSigned(0), "0G");
});

test("over 100,000G the winning bid loses 5% of the excess before sharing (게임 내 분배금 기준)", () => {
  // 계산 검증 10-11 16:42 표본(내림). 10만 이하 구간은 예전 값 그대로.
  const cases: [number, number, number, number, number][] = [
    // price, party, break-even, its 1인 share, use-myself
    [140_000, 4, 99_750, 33_250, 105_063],
    [150_000, 4, 106_962, 35_537, 112_658],
    [280_000, 4, 200_759, 65_240, 211_392],
    [280_000, 8, 233_584, 32_414, 245_911],
    [500_000, 16, 446_394, 28_604, 469_905],
    [1_000_000, 30, 919_699, 30_300, 968_113],
  ];
  for (const [price, party, breakEven, share, useMyself] of cases) {
    const result = calculateAuction(price, party);
    assert.equal(result.breakEven, breakEven, `${price}·${party} break-even`);
    assert.equal(result.breakEvenShare, share, `${price}·${party} share`);
    assert.equal(result.useMyself, useMyself, `${price}·${party} use-myself`);
  }
  // A 4-player bid of 199,500 shares 64,841 each, not 66,500.
  assert.equal(shareOf(199_500, 4), 64_841);
  assert.equal(shareOf(100_000, 4), 33_333, "no fee at exactly 100,000");
});

test("break-even still leaves the winner a fair share above 100,000G", () => {
  for (const price of [150_000, 280_000, 1_000_000, MAX_PRICE]) {
    for (const party of [2, 4, 8, 16, 30]) {
      const { saleGold, breakEven, breakEvenShare } = calculateAuction(price, party);
      // Both sides round down (the bid and the share), so up to 2G apart.
      assert.ok(Math.abs(saleGold - breakEven - breakEvenShare) <= 2, `${price}/${party}`);
    }
  }
});
