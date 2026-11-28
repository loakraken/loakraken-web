import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { defaultPart, PARTS, type PartId, type PartState } from "../lib/refining/model";
import { RefiningQueryError } from "../lib/refining/client";
import {
  fetchSpecialStoneValues,
  observedLine,
  overridesFrom,
  parsePriceInput,
  priceEditsCodec,
  parseSpecialRequest,
  pieceTargets,
  priceFields,
  rankingTargets,
  rankRows,
  rateLabel,
  rowFor,
  rowNote,
  sourceLine,
  specialFailureCopy,
  specialKey,
  stageLabel,
  stoneLabel,
  targetKey,
  targetsOf,
  type SpecialEnvelope,
  type SpecialRow,
} from "../lib/refining/special";
import { isSpecialEnvelope } from "../lib/refining/validate";
import { requestSpecialStoneValues } from "../lib/refining/upstream";
import { isSpecialStoneEnabled } from "../lib/tools/flags";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
// The api's integration-test sample (api develop c570b6e7, SpecialStoneValuesIntegrationTest), as the mock serves it:
// 전율 무기 20 → 21 at the capture's prices, then 업화 무기, 전율 완갑 and 전율 무기 10 (UNSUPPORTED).
const sample = (): SpecialEnvelope => read("./refining-fixtures/special-stone-values.json");
const parts = (over: Partial<Record<PartId, Partial<PartState>>> = {}) =>
  Object.fromEntries(PARTS.map((part) => [part.id, { ...defaultPart(), ...over[part.id] }])) as Record<PartId, PartState>;
const row = (over: Partial<SpecialRow>): SpecialRow => ({ ...sample().data.rows[0], ...over });

test("the api's sample passes the contract, and its weapon row is 계산 검증's 490.4 G", () => {
  const envelope = sample();
  assert.equal(isSpecialEnvelope(envelope), true);
  const weapon = envelope.data.rows[0];
  assert.equal(weapon.valuePerStoneGold, 490.4);
  assert.equal(weapon.averageNeeded, 3000);
  assert.equal(Math.round(weapon.expectedNormalCostGold!), 1_471_202);
  assert.equal(weapon.normalTry?.costWithoutBreathGold, 57_476);
  assert.equal(weapon.normalTry?.costWithMaxBreathGold, 68_301);
  // A status outside the closed set fails the envelope (a new value is a breaking change, contract).
  const broken = sample();
  (broken.data.rows[0] as { status: string }).status = "NEW_STATUS";
  assert.equal(isSpecialEnvelope(broken), false);
  assert.equal(isSpecialEnvelope({ ...sample(), code: "OTHER" }), false);
});

test("the ranking asks for every sourced 전율 stage once: 무기 and 방어구 × 11~24 = 28 (the request maximum)", () => {
  const targets = rankingTargets();
  assert.equal(targets.length, 28);
  assert.equal(new Set(targets.map(targetKey)).size, 28);
  assert.ok(targets.every((t) => t.grade === "JEONYUL" && t.fromStage >= 11 && t.fromStage <= 24));
  assert.notEqual(parseSpecialRequest({ targets }), null);
});

test("each piece's next stage: five armour pieces at one stage are one target; +25 and below 10 have none", () => {
  const state = parts({
    weapon: { grade: "JEONYUL", current: 20 },
    helmet: { grade: "JEONYUL", current: 18 },
    chest: { grade: "JEONYUL", current: 18 },
    pants: { grade: "UPHWA", current: 18 },
    gloves: { grade: "JEONYUL", current: 25 },
  });
  const pieces = pieceTargets(state);
  assert.deepEqual(pieces.map((p) => p.part.id), PARTS.map((p) => p.id));
  assert.deepEqual(pieces.find((p) => p.part.id === "weapon")?.target, { grade: "JEONYUL", equipmentType: "WEAPON", fromStage: 20 });
  assert.equal(pieces.find((p) => p.part.id === "gloves")?.target, null);
  const targets = targetsOf(pieces.map((p) => p.target));
  assert.equal(targets.filter((t) => targetKey(t) === "JEONYUL:ARMOR:18").length, 1);
  assert.equal(targets.filter((t) => targetKey(t) === "UPHWA:ARMOR:18").length, 1);
  assert.notEqual(parseSpecialRequest({ targets }), null);
});

test("the proxy allow-list holds the contract's bounds before any backend call", () => {
  const t = (fromStage: number, extra: object = {}) => ({ grade: "JEONYUL", equipmentType: "WEAPON", fromStage, ...extra });
  assert.equal(parseSpecialRequest(null), null);
  assert.equal(parseSpecialRequest({ targets: [] }), null);
  assert.equal(parseSpecialRequest({ targets: [...rankingTargets(), t(10)] }), null, "29 targets");
  assert.equal(parseSpecialRequest({ targets: [t(20), t(20)] }), null, "duplicate");
  assert.equal(parseSpecialRequest({ targets: [t(9)] }), null);
  assert.equal(parseSpecialRequest({ targets: [t(25)] }), null);
  assert.equal(parseSpecialRequest({ targets: [t(20.5)] }), null);
  assert.equal(parseSpecialRequest({ targets: [{ ...t(20), grade: "ANCIENT" }] }), null);
  assert.equal(parseSpecialRequest({ targets: [t(20)], priceBasis: "MAGIC" }), null);
  const price = (name: string, unitPriceGold: unknown) => ({ targets: [t(20)], prices: [{ name, unitPriceGold }] });
  assert.equal(parseSpecialRequest(price("용암의 숨결", 433.456)), null, "three decimals");
  assert.equal(parseSpecialRequest(price("용암의 숨결", 1_000_000_001)), null);
  assert.equal(parseSpecialRequest(price("용암의 숨결", -1)), null);
  assert.equal(parseSpecialRequest(price("용암의 숨결", "433")), null);
  assert.equal(parseSpecialRequest(price("", 1)), null);
  assert.equal(parseSpecialRequest(price("가".repeat(33), 1)), null);
  assert.equal(
    parseSpecialRequest({ targets: [t(20)], prices: [{ name: "용암의 숨결", unitPriceGold: 1 }, { name: "용암의 숨결", unitPriceGold: 2 }] }),
    null,
  );
  // Kept: UPHWA / ARM_GUARD / 10 (the api answers UNSUPPORTED rows), 0.1 + 0.2 style decimals, unknown fields dropped.
  assert.deepEqual(
    parseSpecialRequest({
      targets: [{ grade: "UPHWA", equipmentType: "ARM_GUARD", fromStage: 10, extra: 1 }],
      priceBasis: "RECENT_PRICE",
      prices: [{ name: "용암의 숨결", unitPriceGold: 0.1 + 0.2, other: true }],
      more: "dropped",
    }),
    {
      targets: [{ grade: "UPHWA", equipmentType: "ARM_GUARD", fromStage: 10 }],
      priceBasis: "RECENT_PRICE",
      prices: [{ name: "용암의 숨결", unitPriceGold: 0.1 + 0.2 }],
    },
  );
  assert.deepEqual(parseSpecialRequest({ targets: [t(20)], prices: [] }), { targets: [t(20)] });
});

test("the proxy refuses before any backend call; a busy solver keeps its own code and Retry-After", async () => {
  let calls = 0;
  const answer = (body: unknown, status: number, headers: Record<string, string> = {}) =>
    (async () => {
      calls++;
      return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
    }) as typeof fetch;
  const origin = "http://127.0.0.1:8080";
  const refused = await requestSpecialStoneValues({ targets: [] }, origin, { fetcher: answer(sample(), 200) });
  assert.deepEqual(refused, { ok: false, error: { code: "INVALID_REQUEST", status: 400 } });
  assert.equal(calls, 0);
  const answered = await requestSpecialStoneValues({ targets: rankingTargets() }, origin, { fetcher: answer(sample(), 200) });
  assert.equal(answered.ok, true);
  const busy = await requestSpecialStoneValues({ targets: rankingTargets() }, origin, {
    fetcher: answer({ code: "REFINING_SOLVE_BUSY", message: "busy", data: null }, 429, { "Retry-After": "3" }),
  });
  assert.equal(busy.ok, false);
  if (!busy.ok) {
    assert.equal(busy.error.code, "REFINING_SOLVE_BUSY");
    assert.equal(busy.error.status, 429);
    assert.ok(busy.error.retryAt && busy.error.retryAt > Date.now());
  }
  const pending = await requestSpecialStoneValues({ targets: rankingTargets() }, origin, {
    fetcher: answer({ code: "REFINING_PRICE_PENDING", message: "pending", data: null }, 409),
  });
  assert.equal(!pending.ok && pending.error.code, "REFINING_PRICE_PENDING");
});

test("a busy solver is asked once more after Retry-After, never twice", async () => {
  const busy = new RefiningQueryError({ code: "REFINING_SOLVE_BUSY", status: 429, retryAt: 3_000 });
  const waits: number[] = [];
  const wait = async (ms: number) => {
    waits.push(ms);
  };
  let calls = 0;
  const once = await fetchSpecialStoneValues({ targets: rankingTargets() }, undefined, {
    post: async () => {
      if (calls++ === 0) throw busy;
      return sample();
    },
    now: () => 1_000,
    wait,
  });
  assert.equal(once.data.rows[0].valuePerStoneGold, 490.4);
  assert.equal(calls, 2);
  assert.deepEqual(waits, [2_000]);
  calls = 0;
  await assert.rejects(
    fetchSpecialStoneValues({ targets: rankingTargets() }, undefined, {
      post: async () => {
        calls++;
        throw busy;
      },
      now: () => 1_000,
      wait,
    }),
    (error) => error === busy,
  );
  assert.equal(calls, 2);
  // Any other failure is not retried.
  calls = 0;
  const other = new RefiningQueryError({ code: "REFINING_PRICE_PENDING", status: 409 });
  await assert.rejects(
    fetchSpecialStoneValues({ targets: rankingTargets() }, undefined, {
      post: async () => {
        calls++;
        throw other;
      },
      wait,
    }),
  );
  assert.equal(calls, 1);
});

test("one cache key per request: price order does not matter, target order does", () => {
  const [a, b] = rankingTargets();
  const p1 = { name: "용암의 숨결", unitPriceGold: 400 };
  const p2 = { name: "운명의 파편", unitPriceGold: 0.1 };
  assert.equal(specialKey({ targets: [a, b], prices: [p1, p2] }), specialKey({ targets: [a, b], prices: [p2, p1] }));
  assert.notEqual(specialKey({ targets: [a, b] }), specialKey({ targets: [b, a] }));
  assert.equal(specialKey({ targets: [a] }), specialKey({ targets: [a], priceBasis: "CURRENT_MIN_PRICE" }));
  assert.notEqual(specialKey({ targets: [a] }), specialKey({ targets: [a], priceBasis: "RECENT_PRICE" }));
});

test("typed prices: only valid ones that differ from the market go, sorted by name", () => {
  assert.equal(parsePriceInput(""), undefined);
  assert.equal(parsePriceInput("  "), undefined);
  assert.equal(parsePriceInput("1,234.5"), 1234.5);
  assert.equal(parsePriceInput("0"), 0);
  assert.equal(parsePriceInput("1.234"), null);
  assert.equal(parsePriceInput("-1"), null);
  assert.equal(parsePriceInput("1e3"), null);
  assert.equal(parsePriceInput("1000000001"), null);
  const fields = priceFields(sample().data);
  // The OK row's materials then its breath; UNSUPPORTED rows add nothing.
  assert.deepEqual(
    fields.map((f) => [f.name, f.role]),
    [...sample().data.rows[0].normalTry!.materials.map((m) => [m.name, "material"]), ["용암의 숨결", "breath"]],
  );
  assert.equal(fields.find((f) => f.name === "용암의 숨결")?.market, 433);
  assert.deepEqual(
    overridesFrom({ "용암의 숨결": "400", "운명의 파편": "0.08", "위대한 운명의 돌파석": "x", "없는 재료": "5" }, fields),
    [{ name: "용암의 숨결", unitPriceGold: 400 }],
  );
});

test("ranked by value per stone, highest first; ties weapon then the lower stage; the rest after in order", () => {
  const rows = [
    row({ equipmentType: "ARMOR", fromStage: 20, valuePerStoneGold: 420.6 }),
    row({ status: "UNSUPPORTED", valuePerStoneGold: null, fromStage: 10 }),
    row({ equipmentType: "WEAPON", fromStage: 21, valuePerStoneGold: 453.3 }),
    row({ equipmentType: "WEAPON", fromStage: 20, valuePerStoneGold: 490.4 }),
    row({ equipmentType: "ARMOR", fromStage: 19, valuePerStoneGold: 453.3 }),
    row({ status: "PRICE_MISSING", valuePerStoneGold: null, fromStage: 12, missingPrices: ["용암의 숨결"] }),
  ];
  assert.deepEqual(
    rankRows(rows).map((r) => `${r.status}:${r.equipmentType}:${r.fromStage}`),
    ["OK:WEAPON:20", "OK:WEAPON:21", "OK:ARMOR:19", "OK:ARMOR:20", "UNSUPPORTED:WEAPON:10", "PRICE_MISSING:WEAPON:12"],
  );
  assert.equal(rowFor(sample().data, { grade: "JEONYUL", equipmentType: "WEAPON", fromStage: 20 })?.valuePerStoneGold, 490.4);
  assert.equal(rowFor(sample().data, { grade: "JEONYUL", equipmentType: "ARMOR", fromStage: 20 }), null);
  assert.equal(rowFor(sample().data, null), null);
});

test("our words: stage, rate, stone, row notes, source without a site name, the price time", () => {
  assert.equal(stageLabel({ equipmentType: "WEAPON", fromStage: 20 }), "무기 +20 → +21");
  assert.equal(stageLabel({ equipmentType: "ARMOR", fromStage: 11 }), "방어구 +11 → +12");
  assert.equal(rateLabel(150), "1.5%");
  assert.equal(rateLabel(50), "0.5%");
  assert.equal(stoneLabel({ stone: null }), "돌파석");
  assert.equal(stoneLabel({ stone: "순환 돌파석" }), "순환 돌파석");
  assert.equal(rowNote(sample().data.rows[0]), null);
  assert.equal(rowNote(sample().data.rows[1]), "특수 재련 1회 소모량을 아직 확인하고 있어요.");
  assert.equal(rowNote(row({ status: "PRICE_MISSING", missingPrices: ["용암의 숨결"] })), "시세가 없는 재료가 있어 계산하지 않았어요: 용암의 숨결");
  assert.equal(rowNote(row({ status: "UNSUPPORTED", reasonCode: "NEW_CODE", reason: "api의 문장" })), "api의 문장");
  assert.equal(sourceLine(sample().data.perTrySource), `1회 소모량: ${sample().data.perTrySource.name}, 2026.11.22 확인(한 곳 자료)`);
  assert.equal(observedLine("2026-11-22T07:00:00Z"), "시세 16:00 이후");
  assert.equal(observedLine(null), null);
  assert.equal(observedLine("not a date"), null);
  assert.equal(specialFailureCopy({ code: "REFINING_SOLVE_BUSY" }).title, "계산이 몰려 있어요");
  assert.equal(specialFailureCopy({ code: "REFINING_PRICE_PENDING" }).title, "재료 시세를 모으고 있어요");
});

test("SPECIAL_STONE is off unless set on", () => {
  assert.equal(isSpecialStoneEnabled({}), false);
  assert.equal(isSpecialStoneEnabled({ SPECIAL_STONE: "true" }), false);
  assert.equal(isSpecialStoneEnabled({ SPECIAL_STONE: " ON " }), true);
});

test("typed prices in the address: only valid prices are written, a bad entry drops alone (PM-프론트 #1974 blocker 1)", () => {
  assert.deepEqual(priceEditsCodec.parse('{"용암의 숨결":"400","운명의 파편":"0.1"}'), { "용암의 숨결": "400", "운명의 파편": "0.1" });
  assert.equal(priceEditsCodec.parse("not json"), null);
  assert.equal(priceEditsCodec.parse("[]"), null);
  // Each bad entry goes on its own; the good ones stay.
  const good = { "용암의 숨결": "400" };
  for (const bad of [
    { "운명의 파편": 400 },
    { "운명의 파편": "4oo" },
    { "운명의 파편": "1.234" },
    { "운명의 파편": "1".repeat(17) },
    { "운명의 파편": "" },
    { ["가".repeat(33)]: "1" },
  ])
    assert.deepEqual(priceEditsCodec.parse(JSON.stringify({ ...good, ...bad })), good, JSON.stringify(bad));
  // The longest valid text (16, the input's maxLength) is kept.
  assert.deepEqual(priceEditsCodec.parse(JSON.stringify({ x: "1,000,000,000.00" })), { x: "1,000,000,000.00" });
  // At most 32 (the request's bound): the first 32.
  const many = Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`n${i}`, "1"]));
  assert.equal(Object.keys(priceEditsCodec.parse(JSON.stringify(many))!).length, 32);
  // Writing: empty, blank and invalid text never reach the address.
  assert.equal(priceEditsCodec.format({}), "");
  assert.equal(priceEditsCodec.format({ "용암의 숨결": "  " }), "");
  assert.equal(priceEditsCodec.format({ "용암의 숨결": "400", "운명의 파편": "", "빙하의 숨결": "4oo", x: "1.234" }), '{"용암의 숨결":"400"}');
  // What is written reads back the same.
  const written = priceEditsCodec.format({ "용암의 숨결": "1,234.5", "운명의 파편": "0.08" });
  assert.deepEqual(priceEditsCodec.parse(written), { "용암의 숨결": "1,234.5", "운명의 파편": "0.08" });
});
test("a material with no market price is a field too, and any valid typed price for it goes (codex #1974 re-run P2)", () => {
  const values = sample().data;
  const missing = { ...values.rows[0], status: "PRICE_MISSING" as const, normalTry: null, valuePerStoneGold: null, missingPrices: ["상급 아비도스 융화 재료", "용암의 숨결"] };
  const onlyMissing = priceFields({ ...values, rows: [missing] });
  assert.deepEqual(onlyMissing, [
    { name: "상급 아비도스 융화 재료", market: null, role: "material" },
    { name: "용암의 숨결", market: null, role: "breath" },
  ]);
  // An OK row's market price wins over the same name missing elsewhere.
  const mixed = priceFields({ ...values, rows: [values.rows[0], missing] });
  assert.equal(mixed.find((f) => f.name === "용암의 숨결")?.market, 433);
  assert.deepEqual(overridesFrom({ "상급 아비도스 융화 재료": "221" }, onlyMissing), [{ name: "상급 아비도스 융화 재료", unitPriceGold: 221 }]);
  assert.deepEqual(overridesFrom({ "상급 아비도스 융화 재료": "" }, onlyMissing), []);
});