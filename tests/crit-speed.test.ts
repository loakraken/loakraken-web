import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CATEGORY_LABEL,
  DEFAULT_SETTINGS,
  classStateSources,
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

test("crit damage (backend #133) validates and groups under its own axis", () => {
  const value = fixture();
  assert.deepEqual(value.data.crit.damage, { base: 200, observed: 0, total: 200 });
  // 언새늘: 200 + bracelet 8.40 (calc-verification team, matches ILOA/LOPEC).
  value.data.sources.push({
    kind: "OBSERVED",
    category: "BRACELET",
    axis: "CRIT_DAMAGE",
    name: "팔찌",
    value: 8.4,
    text: "치명타 피해 +8.40%",
  });
  value.data.crit.damage = { base: 200, observed: 8.4, total: 208.4 };
  assert.equal(isCritSpeedEnvelope(value), true);
  assert.deepEqual(
    groupSources(value.data.sources, "CRIT_DAMAGE").map((g) => [g.category, g.total]),
    [["BRACELET", 8.4]],
  );
  assert.equal(
    groupSources(value.data.sources, "CRIT").some((g) =>
      g.items.some((item) => item.axis === "CRIT_DAMAGE"),
    ),
    false,
  );
});

test("additive backend changes never blank the screen", () => {
  // A future axis/category the contract does not know yet is accepted and
  // simply not grouped under any known axis.
  const future = fixture();
  future.data.sources.push({
    kind: "OBSERVED",
    category: "GEM",
    axis: "CRIT_RESIST",
    name: "미래 출처",
    value: 1,
    text: "새 효과",
  });
  assert.equal(isCritSpeedEnvelope(future), true);
  for (const axis of ["CRIT", "CRIT_DAMAGE", "ATTACK_SPEED", "MOVE_SPEED"] as const)
    assert.equal(
      groupSources(future.data.sources, axis).some((g) => g.items.some((i) => i.name === "미래 출처")),
      false,
    );
  // A backend from before #133 has no crit.damage.
  const older = fixture();
  delete older.data.crit.damage;
  assert.equal(isCritSpeedEnvelope(older), true);
  // Wrong shapes are still rejected.
  const broken = fixture();
  broken.data.crit.damage = { base: "200" };
  assert.equal(isCritSpeedEnvelope(broken), false);
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

test("class-state assumption (backend #193): on by default, only 'off' is sent", () => {
  assert.equal("classState" in toAssumptions(DEFAULT_SETTINGS), false);
  assert.equal(toAssumptions({ ...DEFAULT_SETTINGS, classState: false }).classState, false);
  const parsed = parseCritSpeedRequest({ characterName: "언새늘", assumptions: { classState: false } });
  assert.equal(parsed?.assumptions.classState, false);
  assert.equal(parseCritSpeedRequest({ characterName: "언새늘", assumptions: { classState: "no" } }), null);
  const value = fixture();
  value.data.sources.push({
    kind: "ASSUMED",
    category: "ASSUMPTION",
    axis: "CRIT",
    name: "혼돈 상태 가정(피냄새 Lv.3)",
    value: 23,
    text: "혼돈 상태에서 치명타 적중률이 23.0% 로 변경된다.",
  });
  assert.deepEqual(
    classStateSources(value.data.sources).map((s) => s.name),
    ["혼돈 상태 가정(피냄새 Lv.3)"],
  );
});

test("ARK_GRID sources get a label and an older backend without skills still validates (backend #193)", () => {
  assert.equal(CATEGORY_LABEL.ARK_GRID, "아크 그리드");
  const value = fixture();
  value.data.sources.push({
    kind: "OBSERVED",
    category: "ARK_GRID",
    axis: "CRIT",
    name: "아크 그리드",
    value: 1.5,
    text: "치명타 적중률 +1.5%",
  });
  assert.equal(isCritSpeedEnvelope(value), true);
  assert.ok(groupSources(value.data.sources, "CRIT").some((g) => g.category === "ARK_GRID"));
  delete value.data.skills;
  assert.equal(isCritSpeedEnvelope(value), true);
});
