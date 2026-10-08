import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isCardCollectionEnvelope,
  slotsFor,
  sortCards,
} from "../lib/character/card-collection";
import { requestCardCollection } from "../lib/character/related";

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`./card-fixtures/card-collection-${name}.json`, import.meta.url), "utf8"),
  );
const origin = "http://127.0.0.1:8080";

test("backend samples (dealer, supporter, empty) satisfy the hand-checked shape", () => {
  for (const name of ["dealer", "supporter", "empty"])
    assert.equal(isCardCollectionEnvelope(fixture(name)), true, name);
  const reordered = fixture("dealer");
  reordered.data.elementRecords.dealer.reverse();
  assert.equal(isCardCollectionEnvelope(reordered), false);
  const badEffect = fixture("dealer");
  badEffect.data.sets[0].effects[0].active = "yes";
  assert.equal(isCardCollectionEnvelope(badEffect), false);
});

test("slots follow the role and 도감 sorts by grade, awakening, name", () => {
  const dealer = fixture("dealer").data;
  assert.equal(slotsFor(dealer)[0].setName, "세상을 구하는 빛");
  const supporter = fixture("supporter").data;
  assert.equal(slotsFor(supporter)[0].setName, "남겨진 바람의 절벽");
  const sorted = sortCards(dealer.cards);
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (a.grade === b.grade) assert.ok(a.awakeCount >= b.awakeCount);
  }
});

test("card collection requests validate the name and pass through allow-listed errors", async () => {
  let calls = 0;
  const fetcher = (async (url: URL) => {
    calls++;
    assert.equal(url.pathname, "/api/v1/characters/card-collection");
    return Response.json(fixture("dealer"));
  }) as unknown as typeof fetch;
  assert.equal((await requestCardCollection("언새늘", origin, { fetcher })).ok, true);
  assert.equal((await requestCardCollection("", origin, { fetcher })).ok, false);
  assert.equal(calls, 1);
  const disabled = await requestCardCollection("언새늘", origin, {
    fetcher: (async () =>
      Response.json({ code: "CARD_COLLECTION_DISABLED" }, { status: 503 })) as typeof fetch,
  });
  assert.deepEqual(disabled.ok ? null : disabled.error, { code: "CARD_COLLECTION_DISABLED", status: 503 });
});
