import assert from "node:assert/strict";
import test from "node:test";
import { isArmoryPageEnvelope, tripodLevel } from "../lib/character/armory-page";

const off = { characterName: "상세", enabled: false, source: null, fetchedAt: null, skills: null, skillCode: null, lifeSkills: null };
const on = {
  characterName: "상세",
  enabled: true,
  source: "공식 전투정보실 페이지",
  fetchedAt: "2026-10-11T10:00:00Z",
  skills: [{ name: "합성 포격", tripods: [{ tier: 0, slot: 1, name: "기동 포격", level: 5 }, { tier: 1, slot: 2, name: "연발 포격" }] }],
  skillCode: "CODE",
  lifeSkills: [{ name: "채집", level: 70 }],
};
const envelope = (data: unknown) => ({ code: "CHARACTER_ARMORY_PAGE_SUCCESS", message: "ok", data });

test("armory page envelope: flag off (all null) and on both pass; broken shapes fail", () => {
  assert.equal(isArmoryPageEnvelope(envelope(off)), true);
  assert.equal(isArmoryPageEnvelope(envelope(on)), true);
  assert.equal(isArmoryPageEnvelope({ ...envelope(on), code: "OTHER" }), false);
  assert.equal(isArmoryPageEnvelope(envelope({ ...on, skills: [{ name: "x", tripods: [{ tier: "0" }] }] })), false);
  assert.equal(isArmoryPageEnvelope(envelope({ ...on, enabled: "yes" })), false);
});

test("tripod level joins by skill name, tier and slot; off or missing is null", () => {
  assert.equal(tripodLevel(on, "합성 포격", 0, 1), 5);
  assert.equal(tripodLevel(on, "합성 포격", 1, 2), null);
  assert.equal(tripodLevel(on, "다른 스킬", 0, 1), null);
  assert.equal(tripodLevel(off, "합성 포격", 0, 1), null);
  assert.equal(tripodLevel(undefined, "합성 포격", 0, 1), null);
});
