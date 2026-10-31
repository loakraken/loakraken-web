import assert from "node:assert/strict";
import test from "node:test";
import { engravingIconMap, engravingKey, isEngravingIconsEnvelope } from "../lib/character/engraving-icons";

test("engraving icons: matched by the name without spaces", () => {
  const icons = engravingIconMap([
    { key: "예리한둔기", icon: "https://cdn-lostark.game.onstove.com/a.png" },
    { key: "실드 관통", icon: "https://cdn-lostark.game.onstove.com/b.png" },
  ]);
  assert.equal(icons.get(engravingKey("예리한 둔기")), "https://cdn-lostark.game.onstove.com/a.png");
  assert.equal(icons.get(engravingKey("실드관통")), "https://cdn-lostark.game.onstove.com/b.png");
  assert.equal(icons.get(engravingKey("원한")), undefined);
  assert.equal(engravingKey(null), "");
  // Before the backend's warmup: an empty list, no icons.
  assert.equal(engravingIconMap(undefined).size, 0);
});

test("engraving icons: the response shape is checked", () => {
  assert.equal(isEngravingIconsEnvelope({ code: "ENGRAVING_ICONS_SUCCESS", data: { icons: [] } }), true);
  assert.equal(isEngravingIconsEnvelope({ code: "X", data: { icons: [{ key: "원한", icon: "u" }] } }), true);
  for (const bad of [null, {}, { code: 1, data: { icons: [] } }, { code: "X", data: {} }, { code: "X", data: { icons: [{ key: 1, icon: "u" }] } }])
    assert.equal(isEngravingIconsEnvelope(bad), false, JSON.stringify(bad));
});
