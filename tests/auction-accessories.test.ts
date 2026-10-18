import assert from "node:assert/strict";
import test from "node:test";
import {
  accessorySearch,
  isAccessoryBoardEnvelope,
  isAccessoryListingsEnvelope,
  isPicked,
  parseAccessoryFilter,
  parseAccessoryPick,
  polishText,
} from "../lib/market/auction-accessories";

const cell = {
  levels: ["HIGH", "MID"],
  label: "상중",
  optionLabels: ["적주피 상", "추피 중"],
  minBuyPrice: 900_000,
  totalCount: 7,
  previousDayChangeRate: -3,
  observedAt: "2026-10-13T03:00:00Z",
  status: "READY" as const,
};

test("filters from a shared link fall back to 고대 · 딜러 · 품질 70", () => {
  assert.deepEqual(parseAccessoryFilter(new URLSearchParams("")), { grade: "ANCIENT", role: "DEALER", minQuality: 70 });
  assert.deepEqual(parseAccessoryFilter(new URLSearchParams("grade=RELIC&role=SUPPORT&minQuality=0")), { grade: "RELIC", role: "SUPPORT", minQuality: 0 });
  assert.deepEqual(parseAccessoryFilter(new URLSearchParams("grade=X&role=Y&minQuality=75")), { grade: "ANCIENT", role: "DEALER", minQuality: 70 });
});

test("a pick needs a slot and one or two grades; the address keeps both", () => {
  assert.deepEqual(parseAccessoryPick(new URLSearchParams("slot=EARRING&levels=HIGH,MID&page=2")), { slot: "EARRING", levels: ["HIGH", "MID"], page: 2 });
  assert.equal(parseAccessoryPick(new URLSearchParams("slot=BRACELET&levels=HIGH")), null);
  assert.equal(parseAccessoryPick(new URLSearchParams("slot=RING&levels=HIGH,MID,LOW")), null);
  assert.equal(parseAccessoryPick(new URLSearchParams("slot=RING&levels=TOP")), null);
  const search = accessorySearch({ grade: "RELIC", role: "DEALER", minQuality: 70 }, { slot: "RING", levels: ["LOW", "MID"], page: 1 });
  assert.equal(search.toString(), new URLSearchParams("grade=RELIC&slot=RING&levels=LOW,MID").toString());
  assert.equal(accessorySearch({ grade: "ANCIENT", role: "DEALER", minQuality: 70 }, null).toString(), "");
});

test("picked cell, polish words and the board contract", () => {
  assert.equal(isPicked({ slot: "NECKLACE", levels: ["HIGH", "MID"], page: 1 }, "NECKLACE", cell), true);
  assert.equal(isPicked({ slot: "NECKLACE", levels: ["MID", "HIGH"], page: 1 }, "NECKLACE", cell), false);
  assert.equal(isPicked({ slot: "RING", levels: ["HIGH", "MID"], page: 1 }, "NECKLACE", cell), false);
  const listing = {
    name: "합성 목걸이", grade: "고대", quality: 88, buyPrice: 1, bidPrice: 0, bidStartPrice: 0, endDate: null, tradeAllowCount: 2,
    options: [
      { type: "ACCESSORY_UPGRADE", name: "적주피", value: 2, percentage: true, level: "HIGH" as const, className: null },
      { type: "STAT", name: "힘", value: 12000, percentage: false, level: null, className: null },
      { type: "ACCESSORY_UPGRADE", name: "추피", value: 1.6, percentage: true, level: "MID" as const, className: null },
    ],
    icon: null,
  };
  assert.equal(polishText(listing), "적주피 상 · 추피 중");
  const board = {
    code: "AUCTION_ACCESSORIES_SUCCESS",
    message: "ok",
    data: {
      ruleVersion: "auction-board-v1", grade: "ANCIENT", role: "DEALER", minQuality: 70, complete: true,
      slots: [{ slot: "NECKLACE", slotName: "목걸이", options: [{ key: "ENEMY_DAMAGE", officialName: "적에게 주는 피해 증가", shortName: "적주피", values: [0.55, 1.2, 2] }], cells: [cell] }],
    },
  };
  assert.equal(isAccessoryBoardEnvelope(board), true);
  assert.equal(isAccessoryBoardEnvelope({ ...board, code: "AUCTION_GEMS_SUCCESS" }), false);
  // Listings: filter is always null here; a backend before api #548·#613 sends neither it nor icons.
  const listings = {
    code: "AUCTION_LISTINGS_SUCCESS",
    message: "ok",
    data: { totalCount: 1, page: 1, observedAt: "2026-10-18T12:00:00Z", filter: null, items: [{ ...listing, icon: "https://cdn-lostark.game.onstove.com/a.png" }] },
  };
  assert.equal(isAccessoryListingsEnvelope(listings), true);
  const older: Partial<typeof listing> = { ...listing };
  delete older.icon;
  assert.equal(isAccessoryListingsEnvelope({ ...listings, data: { totalCount: 1, page: 1, observedAt: "2026-10-18T12:00:00Z", items: [older] } }), true);
  assert.equal(isAccessoryListingsEnvelope({ ...listings, data: { ...listings.data, items: [{ ...listing, icon: 3 }] } }), false);
});
