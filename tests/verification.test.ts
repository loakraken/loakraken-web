// Regression against the calc-verification team's samples (backend repo
// src/test/resources/verification, copied to tests/verification-fixtures —
// source commits in tests/verification-fixtures/README.md).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateAuction } from "../lib/tools/auction";

const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`./verification-fixtures/${path}`, import.meta.url), "utf8"));

test("auction bids match every verified case", () => {
  const sample = read("auction/iloa-loalab-2026-10-09.json");
  assert.ok(sample.cases.length >= 3);
  for (const c of sample.cases) {
    const r = calculateAuction(c.price, c.party);
    const bid = Object.fromEntries(r.strategies.map((s) => [s.id, s.bid]));
    const actual: Record<string, number> = {
      fee: r.fee,
      saleGold: r.saleGold,
      saleBreakEven: r.breakEven,
      useMyself: r.useMyself,
      preempt: bid.preempt,
      keep75: bid.keep75,
      keep50: bid.keep50,
      keep25: bid.keep25,
      breakEvenShare: r.breakEvenShare,
    };
    for (const [key, value] of Object.entries(c.expected as Record<string, number>))
      assert.equal(actual[key], value, `${c.price}/${c.party} ${key}`);
  }
});
