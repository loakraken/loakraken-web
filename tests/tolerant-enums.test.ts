// #125: a response enum value the backend adds later must not blank a screen.
// The validators accept it and the item reads "알 수 없음" (or is skipped).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { labelOf, UNKNOWN_LABEL } from "../lib/api/tolerant";
import {
  elementLabel,
  isCardCollectionEnvelope,
  orderedSlots,
  slotsFor,
} from "../lib/character/card-collection";
import { coverageLabel } from "../lib/character/model";
import { isPopularEnvelope } from "../lib/character/popular";
import { isCharacterEnvelope } from "../lib/character/validate";
import { noticeLabel, rewardLabel } from "../lib/home/model";
import { isNewsEnvelope, isScheduleEnvelope } from "../lib/home/validate";
import { isTabId } from "../lib/market/board";
import { quoteStatusCopy } from "../lib/market/model";
import {
  isBoardEnvelope,
  isQuoteEnvelope,
  isTabsEnvelope,
} from "../lib/market/validate";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const NEW = "SOMETHING_NEW";

test("home: a new reward kind or notice category keeps the response", () => {
  const schedule = read("./home-fixtures/home-schedule.json");
  schedule.data.adventureIslands[0].rewardKinds.push(NEW);
  assert.equal(isScheduleEnvelope(schedule), true);
  const news = read("./home-fixtures/home-news.json");
  news.data.notices[0].category = NEW;
  assert.equal(isNewsEnvelope(news), true);
  assert.equal(rewardLabel(NEW), UNKNOWN_LABEL);
  assert.equal(rewardLabel("GOLD"), "골드");
  assert.equal(noticeLabel(NEW), UNKNOWN_LABEL);
  assert.equal(noticeLabel(null), "공지");
  // Types are still checked: a number is not a category.
  news.data.notices[0].category = 3;
  assert.equal(isNewsEnvelope(news), false);
});

test("market: a new tab is skipped, a new quote status reads as unknown", () => {
  const tabs = read("./market-fixtures/market-tabs.json");
  tabs.data.tabs.push({ ...tabs.data.tabs[0], tab: NEW, label: "새 탭" });
  assert.equal(isTabsEnvelope(tabs), true);
  assert.deepEqual(
    tabs.data.tabs.filter((t: { tab: string }) => isTabId(t.tab)).length,
    tabs.data.tabs.length - 1,
  );
  const board = read("./market-fixtures/market-board.json");
  board.data.tab = NEW;
  assert.equal(isBoardEnvelope(board), true);
  const quote = read("./market-fixtures/material-quote.json");
  quote.data.items[0].status = NEW;
  assert.equal(isQuoteEnvelope(quote), true);
  assert.equal(quoteStatusCopy(NEW).label, UNKNOWN_LABEL);
  assert.equal(quoteStatusCopy("PRICED").label, "계산됨");
});

test("character: new coverage state, position or finding category keep the page", () => {
  const envelope = {
    code: "CHARACTER_SEARCH_SUCCESS",
    message: "성공",
    data: read("./fixtures/character-full-data.json"),
  };
  envelope.data.coverage.equipment = NEW;
  envelope.data.analysis.position = NEW;
  envelope.data.analysis.diagnostics.findings[0].category = NEW;
  assert.equal(isCharacterEnvelope(envelope), true);
  assert.equal(coverageLabel(NEW), UNKNOWN_LABEL);
  assert.equal(coverageLabel("PROVIDED"), "데이터 제공");
});

test("card records: an unknown or reordered element still renders", () => {
  const sample = read("./card-fixtures/card-collection-dealer.json");
  sample.data.elementRecords.dealer.reverse();
  sample.data.elementRecords.dealer[0].element = NEW;
  assert.equal(isCardCollectionEnvelope(sample), true);
  const slots = slotsFor(sample.data);
  assert.deepEqual(
    slots.map((slot) => slot.element),
    ["LIGHT", "DARK", "LIGHTNING", "EARTH", "WATER", NEW],
  );
  assert.equal(orderedSlots(sample.data.elementRecords.supporter)[0].element, "LIGHT");
  assert.equal(elementLabel(NEW), UNKNOWN_LABEL);
  assert.equal(elementLabel("FIRE"), "화");
});

test("popular: a new sample status keeps the list", () => {
  const popular = read("./popular-fixtures/characters-popular.json");
  popular.data.sampleStatus = NEW;
  assert.equal(isPopularEnvelope(popular), true);
});

test("labelOf ignores inherited keys", () => {
  assert.equal(labelOf({ A: "가" }, "constructor"), UNKNOWN_LABEL);
  assert.equal(labelOf({ A: "가" }, undefined, "-"), "-");
});
