import assert from "node:assert/strict";
import test from "node:test";
import { GAME_UPDATE_COPY, GAME_UPDATE_UNSUPPORTED, isGameUpdate } from "../lib/api/game-update";
import { KRAKEN_NOTE_ALL, guardedGuide, krakenUnavailableCopy, krakenUnavailableNote } from "../lib/spec-up/model";

// 2부 raw-shape guard (api contract draft 11-28, web #1977).
test("game update: the code is known by its exact value only", () => {
  assert.equal(isGameUpdate(GAME_UPDATE_UNSUPPORTED), true);
  for (const other of [null, undefined, "", "MODEL_UNCONFIRMED", "game_update_unsupported"]) assert.equal(isGameUpdate(other), false, String(other));
});

test("game update: the spec-up sort line and note say the game update, never '효율 순' over an empty list", () => {
  assert.equal(krakenUnavailableCopy(GAME_UPDATE_UNSUPPORTED), GAME_UPDATE_COPY.specUp);
  assert.equal(krakenUnavailableNote(GAME_UPDATE_UNSUPPORTED), GAME_UPDATE_COPY.specUpNote);
  assert.doesNotMatch(krakenUnavailableNote(GAME_UPDATE_UNSUPPORTED)!, /효율 순/);
  // The bar holds the room of its longest note: the new one is among them.
  assert.ok(KRAKEN_NOTE_ALL.includes(GAME_UPDATE_COPY.specUpNote));
  // Other codes keep their lines.
  assert.match(krakenUnavailableNote("DISABLED")!, /효율 순$/);
  assert.match(krakenUnavailableCopy("SOMETHING_NEW")!, /보여 드려요\.$/);
});

test("game update: a guide is guarded when every candidate (or the sort reason) carries the code", () => {
  const c = (reasonCode: string | null) => ({ reasonCode });
  assert.equal(guardedGuide({ candidates: [c(GAME_UPDATE_UNSUPPORTED), c(GAME_UPDATE_UNSUPPORTED)] }), true);
  assert.equal(guardedGuide({ candidates: [], krakenSortUnavailableReason: GAME_UPDATE_UNSUPPORTED }), true);
  assert.equal(guardedGuide({ candidates: [c(GAME_UPDATE_UNSUPPORTED), c("MODEL_UNCONFIRMED")] }), false);
  assert.equal(guardedGuide({ candidates: [] }), false);
  assert.equal(guardedGuide({ candidates: [c(null)], krakenSortUnavailableReason: "DISABLED" }), false);
});

test("game update: the simulator line counts the changes", () => {
  assert.equal(GAME_UPDATE_COPY.simulator(2), "바꾼 2개 항목은 게임 업데이트로 바뀐 장비 정보라 아직 계산하지 않아요.");
});
