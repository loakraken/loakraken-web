import assert from "node:assert/strict";
import test from "node:test";
import { COLLECTIBLE_SPRITE, collectibleSpriteIcon } from "../lib/character/collectible-sprite";

test("collectible sprite: the 11 official types map to the armory sprite (spaces ignored)", () => {
  assert.equal(COLLECTIBLE_SPRITE, "https://cdn-lostark.game.onstove.com/2018/obt/assets/images/pc/sprite/sprite_profile.png");
  const types = [
    "거인의 심장", "섬의 마음", "모코코 씨앗", "위대한 미술품", "항해 모험물", "세계수의 잎",
    "이그네아의 징표", "오르페우스의 별", "기억의 오르골", "크림스네일의 해도", "누크만의 환영석",
  ];
  for (const type of types) assert.ok(collectibleSpriteIcon(type), type);
  assert.deepEqual(collectibleSpriteIcon("크림스네일의해도"), { x: 0, y: -216, width: 24, height: 18 });
  assert.deepEqual(collectibleSpriteIcon("모코코 씨앗"), { x: -234, y: -92, width: 23, height: 22 });
  // A type we do not know (a new one) keeps the API badge.
  assert.equal(collectibleSpriteIcon("합성 잎"), null);
  assert.equal(collectibleSpriteIcon(null), null);
});
