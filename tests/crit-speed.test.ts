import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEFAULT_SETTINGS,
  groupSources,
  parseCritSpeedRequest,
  toAssumptions,
} from "../lib/crit-speed/model";
import { isCritSpeedEnvelope } from "../lib/crit-speed/validate";
import { requestCritSpeed } from "../lib/crit-speed/upstream";

const fixture = () =>
  JSON.parse(
    readFileSync(
      new URL("./crit-speed-fixtures/crit-speed.json", import.meta.url),
      "utf8",
    ),
  );
const origin = "http://127.0.0.1:8080";

test("backend-generated crit-speed fixture satisfies the contract", () => {
  assert.equal(isCritSpeedEnvelope(fixture()), true);
  // Unknown enum values are tolerated (tests/tool-contract.test.ts); a wrong
  // shape is not.
  const broken = fixture();
  broken.data.sources[0].value = "20.61";
  assert.equal(isCritSpeedEnvelope(broken), false);
  const wrongCode = fixture();
  wrongCode.code = "OTHER";
  assert.equal(isCritSpeedEnvelope(wrongCode), false);
});

test("settings become assumptions with buff presets summed and own class excluded", () => {
  assert.deepEqual(toAssumptions(DEFAULT_SETTINGS), {
    backAttack: true,
    critPet: false,
    critSynergyCount: 0,
    supportCritRate: 0,
    tripodCritRate: 0,
    extraCritRate: 0,
    extraAttackSpeed: 14,
    extraMoveSpeed: 14,
  });
  const assumptions = toAssumptions(
    {
      ...DEFAULT_SETTINGS,
      synergy: ["배틀마스터", "건슬링어", "스트라이커", "데빌헌터", "모르는직업"],
      buffs: ["support", "feast", "food"],
      attackSpeed: 10,
      moveSpeed: 95,
      supportCritRate: 2.1,
    },
    "건슬링어",
  );
  assert.equal(assumptions.critSynergyCount, 3, "own class and unknown dropped, capped at 3");
  assert.equal(assumptions.extraAttackSpeed, 27);
  assert.equal(assumptions.extraMoveSpeed, 100, "clamped to the contract maximum");
  assert.equal(assumptions.supportCritRate, 2.1);
  assert.equal(
    toAssumptions({ ...DEFAULT_SETTINGS, tripodCritRate: Number.NaN }).tripodCritRate,
    0,
  );
});

test("requests are allow-listed before the backend", () => {
  assert.deepEqual(
    parseCritSpeedRequest({
      characterName: " 언새늘 ",
      assumptions: { backAttack: true, critSynergyCount: 2, extraAttackSpeed: 14, extra: 1 },
      other: true,
    }),
    {
      characterName: "언새늘",
      assumptions: { backAttack: true, critSynergyCount: 2, extraAttackSpeed: 14 },
    },
  );
  assert.deepEqual(
    parseCritSpeedRequest({ characterName: "언새늘", assumptions: { extraAttackSpeed: -10 } })?.assumptions,
    { extraAttackSpeed: -10 },
    "v2 accepts slowdowns",
  );
  assert.deepEqual(parseCritSpeedRequest({ characterName: "언새늘" }), {
    characterName: "언새늘",
    assumptions: {},
  });
  for (const bad of [
    null,
    [],
    { characterName: "" },
    { characterName: "이름!" },
    { characterName: "언새늘", assumptions: [] },
    { characterName: "언새늘", assumptions: { backAttack: "yes" } },
    { characterName: "언새늘", assumptions: { critSynergyCount: 4 } },
    { characterName: "언새늘", assumptions: { critSynergyCount: 1.5 } },
    { characterName: "언새늘", assumptions: { supportCritRate: 31 } },
    { characterName: "언새늘", assumptions: { extraMoveSpeed: -101 } },
  ])
    assert.equal(parseCritSpeedRequest(bad), null, JSON.stringify(bad));
});

test("v2 swiftness table marks the current and optimal rows", () => {
  const { speed, crit } = fixture().data;
  assert.ok(speed.swiftnessTable.some((row: { current: boolean }) => row.current));
  assert.ok(speed.swiftnessPerPercent > 0 && crit.critStatPerPercent > 0);
  assert.equal(
    toAssumptions({ ...DEFAULT_SETTINGS, buffs: [], attackSpeed: -10 }).extraAttackSpeed,
    -10,
  );
});

test("sources group by axis and category with totals", () => {
  const groups = groupSources(fixture().data.sources, "CRIT");
  const accessory = groups.find((g) => g.category === "ACCESSORY")!;
  assert.equal(accessory.items.length, 2);
  assert.equal(accessory.total, 3.1);
  assert.ok(groups.every((g) => g.items.every((i) => i.axis === "CRIT")));
  assert.deepEqual(
    groupSources(fixture().data.sources, "MOVE_SPEED").map((g) => g.category)[0],
    "STAT",
  );
});

test("crit-speed requests validate input and pass through allow-listed errors", async () => {
  let calls = 0;
  const fetcher = (async (url: URL, init: RequestInit) => {
    calls++;
    assert.equal(url.pathname, "/api/v1/characters/crit-speed");
    assert.equal(init.method, "POST");
    assert.equal(JSON.parse(String(init.body)).characterName, "언새늘");
    return Response.json(fixture());
  }) as unknown as typeof fetch;
  assert.equal((await requestCritSpeed({ characterName: "언새늘" }, origin, { fetcher })).ok, true);
  assert.equal(
    (await requestCritSpeed({ characterName: "언새늘", assumptions: { critSynergyCount: 9 } }, origin, { fetcher })).ok,
    false,
  );
  assert.equal(calls, 1);
  const missing = await requestCritSpeed({ characterName: "없는캐릭" }, origin, {
    fetcher: (async () =>
      Response.json({ code: "CHARACTER_NOT_FOUND" }, { status: 404 })) as typeof fetch,
  });
  assert.deepEqual(missing.ok ? null : missing.error, {
    code: "CHARACTER_NOT_FOUND",
    status: 404,
  });
});
