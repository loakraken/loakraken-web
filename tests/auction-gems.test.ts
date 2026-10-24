import assert from "node:assert/strict";
import test from "node:test";
import {
  gemGrid,
  gemPickSearch,
  gemTarget,
  isGemBoardEnvelope,
  isGemListingsEnvelope,
  isGemSkillsEnvelope,
  parseGemPick,
  pickAfterFailure,
  skillsFor,
} from "../lib/market/auction-gems";

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
  icon: "https://cdn-lostark.game.onstove.com/efui_iconatlas/use/use_12_105.png",
};

const plain = { className: null, skill: null };

test("gem pick from a shared link; anything else is no pick", () => {
  assert.deepEqual(parseGemPick(new URLSearchParams("kind=겁화&level=10")), { kind: "겁화", level: 10, page: 1, ...plain });
  assert.deepEqual(parseGemPick(new URLSearchParams("kind=작열&level=3&page=2")), { kind: "작열", level: 3, page: 2, ...plain });
  assert.equal(parseGemPick(new URLSearchParams("kind=멸화&level=10")), null);
  assert.equal(parseGemPick(new URLSearchParams("kind=겁화&level=11")), null);
  assert.equal(parseGemPick(new URLSearchParams("")), null);
  assert.deepEqual(parseGemPick(new URLSearchParams("kind=겁화&level=10&page=99")), { kind: "겁화", level: 10, page: 1, ...plain });
  assert.equal(gemPickSearch({ kind: "겁화", level: 10, page: 1 }).toString(), new URLSearchParams("kind=겁화&level=10").toString());
});

test("class and skill ride along in the link; a skill needs its class (api #542)", () => {
  assert.deepEqual(parseGemPick(new URLSearchParams("kind=겁화&level=10&class=바드&skill=21170")), {
    kind: "겁화",
    level: 10,
    page: 1,
    className: "바드",
    skill: 21170,
  });
  assert.deepEqual(parseGemPick(new URLSearchParams("kind=겁화&level=10&class=바드")), { kind: "겁화", level: 10, page: 1, className: "바드", skill: null });
  // A skill without a class, a bad code or an overlong class name is dropped.
  assert.deepEqual(parseGemPick(new URLSearchParams("kind=겁화&level=10&skill=21170")), { kind: "겁화", level: 10, page: 1, ...plain });
  assert.equal(parseGemPick(new URLSearchParams("kind=겁화&level=10&class=바드&skill=-3"))?.skill, null);
  // Skill codes are int32 on the backend: a larger number never reaches it.
  assert.equal(parseGemPick(new URLSearchParams("kind=겁화&level=10&class=바드&skill=2147483647"))?.skill, 2147483647);
  assert.equal(parseGemPick(new URLSearchParams("kind=겁화&level=10&class=바드&skill=2147483648"))?.skill, null);
  assert.equal(parseGemPick(new URLSearchParams("kind=겁화&level=10&class=바드&skill=1e20"))?.skill, null);
  assert.equal(parseGemPick(new URLSearchParams(`kind=겁화&level=10&class=${"가".repeat(21)}`))?.className, null);
  assert.equal(
    gemPickSearch({ kind: "겁화", level: 10, page: 2, className: "바드", skill: 21170 }).toString(),
    new URLSearchParams("kind=겁화&level=10&page=2&class=바드&skill=21170").toString(),
  );
  assert.equal(gemPickSearch({ kind: "겁화", level: 10, page: 1, className: null, skill: 21170 }).toString(), new URLSearchParams("kind=겁화&level=10").toString());
});

test("a class's skills for a kind: some work on 겁화 or 작열 only", () => {
  const classes = [
    { className: "바드", skills: [{ code: 21170, name: "사운드 쇼크", kinds: ["겁화", "작열"] }, { code: 21140, name: "윈드 오브 뮤직", kinds: ["작열"] }] },
  ];
  assert.deepEqual(skillsFor(classes, "바드", "겁화").map((s) => s.code), [21170]);
  assert.deepEqual(skillsFor(classes, "바드", "작열").map((s) => s.code), [21170, 21140]);
  assert.deepEqual(skillsFor(classes, "블래스터", "겁화"), []);
  assert.deepEqual(skillsFor(classes, null, "겁화"), []);
});

test("the skill list and a filtered listing follow the contract", () => {
  const skills = {
    code: "AUCTION_GEM_SKILLS_SUCCESS",
    message: "ok",
    data: { checkedOn: "2026-10-18", classes: [{ className: "바드", skills: [{ code: 21170, name: "사운드 쇼크", kinds: ["겁화"] }] }] },
  };
  assert.equal(isGemSkillsEnvelope(skills), true);
  assert.equal(isGemSkillsEnvelope({ ...skills, data: { ...skills.data, classes: [{ className: "바드", skills: [{ code: "21170", name: "x", kinds: [] }] }] } }), false);
  const filtered = {
    code: "AUCTION_LISTINGS_SUCCESS",
    message: "ok",
    data: { totalCount: 2, page: 1, observedAt: "2026-10-18T03:00:00Z", items: [listing], filter: { className: "바드", skill: 21170, skillName: "사운드 쇼크" } },
  };
  assert.equal(isGemListingsEnvelope(filtered), true);
  // Class only, and (until the api ships) no filter field at all.
  assert.equal(isGemListingsEnvelope({ ...filtered, data: { ...filtered.data, filter: { className: "바드", skill: null, skillName: null } } }), true);
  assert.equal(isGemListingsEnvelope({ ...filtered, data: { ...filtered.data, filter: null } }), true);
  const older: Partial<typeof filtered.data> = { ...filtered.data };
  delete older.filter;
  assert.equal(isGemListingsEnvelope({ ...filtered, data: older }), true);
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
  // No icon from an official answer, and none at all from a backend before api #613.
  assert.equal(isGemListingsEnvelope({ ...listings, data: { ...listings.data, items: [{ ...listing, icon: null }] } }), true);
  const older: Partial<typeof listing> = { ...listing };
  delete older.icon;
  assert.equal(isGemListingsEnvelope({ ...listings, data: { ...listings.data, items: [older] } }), true);
  assert.equal(isGemListingsEnvelope({ ...listings, data: { ...listings.data, items: [{ ...listing, icon: 3 }] } }), false);
});

test("a gem's target is its class and skill from the options", () => {
  assert.equal(gemTarget(listing), "바드 · 합성 스킬");
  assert.equal(gemTarget({ ...listing, options: [] }), null);
});

test("filter switched off: a shared address with a class asks again for the same cell without it", () => {
  const shared = { kind: "겁화" as const, level: 10, page: 3, className: "바드", skill: 21170 };
  assert.deepEqual(pickAfterFailure(shared, "GEM_FILTER_DISABLED"), { kind: "겁화", level: 10, page: 1, className: null, skill: null });
  // Nothing to drop, or another failure: no second request.
  assert.equal(pickAfterFailure({ kind: "겁화", level: 10, page: 1 }, "GEM_FILTER_DISABLED"), null);
  assert.equal(pickAfterFailure(shared, "MARKET_SEARCH_BUSY"), null);
  assert.equal(pickAfterFailure(shared, undefined), null);
});
