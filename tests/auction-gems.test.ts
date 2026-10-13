import assert from "node:assert/strict";
import test from "node:test";
import { gemGrid, gemPickSearch, gemTarget, isGemBoardEnvelope, isGemListingsEnvelope, parseGemPick } from "../lib/market/auction-gems";

const cell = (kind: "겁화" | "작열", level: number, pending = false) => ({
  kind,
  level,
  itemName: `${level}레벨 ${kind}의 보석`,
  minBuyPrice: pending ? null : 2_500_000,
  totalCount: pending ? null : 25,
  previousDayChangeRate: pending ? null : 25,
  observedAt: pending ? null : "2026-10-13T03:00:00Z",
  status: pending ? ("PENDING" as const) : ("READY" as const),
});
const listing = {
  name: "10레벨 겁화의 보석",
  grade: "고대",
  quality: null,
  buyPrice: 2_500_000,
  bidPrice: 0,
  bidStartPrice: 2_000_000,
  endDate: "2026-10-14T03:00:00Z",
  tradeAllowCount: 2,
  options: [{ type: "GEM_SKILL_DAMAGE", name: "합성 스킬", value: 44, percentage: true, level: null, className: "바드" }],
};

test("gem pick from a shared link; anything else is no pick", () => {
  assert.deepEqual(parseGemPick(new URLSearchParams("kind=겁화&level=10")), { kind: "겁화", level: 10, page: 1 });
  assert.deepEqual(parseGemPick(new URLSearchParams("kind=작열&level=3&page=2")), { kind: "작열", level: 3, page: 2 });
  assert.equal(parseGemPick(new URLSearchParams("kind=멸화&level=10")), null);
  assert.equal(parseGemPick(new URLSearchParams("kind=겁화&level=11")), null);
  assert.equal(parseGemPick(new URLSearchParams("")), null);
  assert.deepEqual(parseGemPick(new URLSearchParams("kind=겁화&level=10&page=99")), { kind: "겁화", level: 10, page: 1 });
  assert.equal(gemPickSearch({ kind: "겁화", level: 10, page: 1 }).toString(), new URLSearchParams("kind=겁화&level=10").toString());
});

test("board cells by kind and level; a missing cell is blank", () => {
  const at = gemGrid({ ruleVersion: "auction-board-v1", complete: false, cells: [cell("겁화", 10), cell("작열", 1, true)] });
  assert.equal(at("겁화", 10)?.minBuyPrice, 2_500_000);
  assert.equal(at("작열", 1)?.status, "PENDING");
  assert.equal(at("겁화", 9), undefined);
});

test("gem board and listings envelopes follow the contract", () => {
  const board = { code: "AUCTION_GEMS_SUCCESS", message: "ok", data: { ruleVersion: "auction-board-v1", complete: true, cells: [cell("겁화", 10)] } };
  assert.equal(isGemBoardEnvelope(board), true);
  assert.equal(isGemBoardEnvelope({ ...board, data: { ...board.data, cells: [{ ...cell("겁화", 10), level: "10" }] } }), false);
  const listings = { code: "AUCTION_LISTINGS_SUCCESS", message: "ok", data: { totalCount: 14, page: 1, observedAt: "2026-10-13T03:00:00Z", items: [listing] } };
  assert.equal(isGemListingsEnvelope(listings), true);
  assert.equal(isGemListingsEnvelope({ ...listings, code: "AUCTION_GEMS_SUCCESS" }), false);
});

test("a gem's target is its class and skill from the options", () => {
  assert.equal(gemTarget(listing), "바드 · 합성 스킬");
  assert.equal(gemTarget({ ...listing, options: [] }), null);
});
