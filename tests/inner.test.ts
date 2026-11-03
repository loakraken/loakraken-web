import assert from "node:assert/strict";
import test from "node:test";
import {
  AVATAR_SLOTS,
  avatarSlots,
  avatarTendencyText,
  avatarTendencyTotals,
  decorationParts,
  rarestOwned,
} from "../lib/character/inner";

test("avatar slots: twelve in the game's order, worn items placed, empty ones null, others after", () => {
  const avatar = (type: string, name: string, isInner = false) =>
    ({ type, name, icon: null, grade: "영웅", isSet: false, isInner, effects: [], tendencies: [] }) as Parameters<typeof avatarSlots>[0][number];
  const rows = avatarSlots([
    avatar("무기 아바타", "검"),
    avatar("무기 아바타", "검 덧입기", true),
    avatar("이동 효과", "폭풍우"),
    avatar("머리 덧입기 아바타", "모자"),
    avatar("특수 아바타", "기타 장식"),
  ]);
  assert.deepEqual(rows.slice(0, 12).map((row) => row.slot), [...AVATAR_SLOTS]);
  assert.equal(rows[0].avatar?.name, "검");
  assert.equal(rows[1].avatar?.name, "검 덧입기");
  assert.equal(rows[7].avatar?.name, "모자");
  assert.equal(rows[11].avatar?.name, "폭풍우");
  assert.equal(rows[2].avatar, null);
  assert.deepEqual(rows.slice(12).map((row) => [row.slot, row.avatar?.name]), [["특수", "기타 장식"]]);
});

test("아바타 성향 (user 11-02): a line per avatar, totals in the game's order, nothing when none", () => {
  type Avatar = Parameters<typeof avatarTendencyTotals>[0][number];
  const avatar = (tendencies: { type: string | null; point: number | null }[] | undefined) =>
    ({ type: "상의 아바타", name: "a", icon: null, grade: "전설", isSet: false, isInner: false, effects: [], tendencies }) as Avatar;
  const coat = avatar([{ type: "지성", point: 10 }, { type: "담력", point: 5 }, { type: "매력", point: 5 }, { type: "친절", point: 5 }]);
  const pants = avatar([{ type: "담력", point: 5 }, { type: "매력", point: 15 }]);
  // The api's order is kept on the line; zero and nameless points are dropped.
  assert.equal(avatarTendencyText(coat), "지성 10 · 담력 5 · 매력 5 · 친절 5");
  assert.equal(avatarTendencyText(avatar([{ type: "친절", point: 0 }, { type: null, point: 5 }])), "");
  assert.equal(avatarTendencyText(avatar([])), "");
  // Totals: 지성·담력·매력·친절, any other type after them.
  assert.deepEqual(avatarTendencyTotals([pants, avatar([{ type: "새 성향", point: 3 }]), coat]), [
    { type: "지성", point: 10 },
    { type: "담력", point: 10 },
    { type: "매력", point: 20 },
    { type: "친절", point: 5 },
    { type: "새 성향", point: 3 },
  ]);
  // An api before the field (missing or empty everywhere): nothing to show, never zeros.
  assert.deepEqual(avatarTendencyTotals([avatar(undefined), avatar([])]), []);
  assert.equal(avatarTendencyText(avatar(undefined)), "");
});

test("가장 희귀한 보유: lowest share among finished items, unknown shares left out", () => {
  const item = (name: string, point: number, maxPoint: number) => ({ name, point, maxPoint });
  const items = [item("가", 1, 1), item("나", 1, 1), item("다", 0, 1), item("라", 5, 5), item("마", 1, 1)];
  const shares: Record<string, number> = { 가: 40.2, 나: 3.1, 다: 0.4, 라: 3.1 };
  const shareOf = (name: string | null) => (name ? shares[name] ?? null : null);
  // 다 is rarer but not finished; 라 ties 나 later in the list; 마 has no share.
  assert.deepEqual(rarestOwned(items as never, shareOf), { name: "나", share: 3.1 });
  assert.equal(rarestOwned([item("다", 0, 1)] as never, shareOf), null);
});

test("문장·심볼: official addresses become pictures, names stay text, other addresses are dropped", () => {
  const emblem = "https://cdn-lostark.game.onstove.com/efui_iconatlas/playerinfodecobrooch/playerinfodecobrooch_97.png";
  const symbol = "https://cdn-lostark.game.onstove.com/efui_iconatlas/playerinfodecoclassdeco_default/playerinfodecoclassdeco_default_3.png";
  assert.deepEqual(decorationParts({ emblems: [emblem, ` ${emblem} `], symbol }), {
    emblems: [
      { kind: "image", url: emblem, alt: "문장 1" },
      { kind: "image", url: emblem, alt: "문장 2" },
    ],
    symbol: { kind: "image", url: symbol, alt: "심볼" },
  });
  // A name (an older answer) is shown as it is.
  assert.deepEqual(decorationParts({ emblems: ["별빛 문장"], symbol: "새벽 심볼" }), {
    emblems: [{ kind: "text", text: "별빛 문장" }],
    symbol: { kind: "text", text: "새벽 심볼" },
  });
  // Any other host, plain http, a script address or a bare file name: neither a picture nor text.
  assert.deepEqual(
    decorationParts({ emblems: ["https://example.com/a.png", "http://cdn-lostark.game.onstove.com/a.png", "javascript:alert(1)", "emblem-1.png", "  "], symbol: "//example.com/s.png" }),
    { emblems: [], symbol: null },
  );
  assert.deepEqual(decorationParts({ emblems: [], symbol: null }), { emblems: [], symbol: null });
});