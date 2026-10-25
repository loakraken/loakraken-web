import assert from "node:assert/strict";
import test from "node:test";
import { classChip, classIconUrl } from "../lib/stats/class-icons";

test("class icons: every playable class has the official SVG; others get a chip", () => {
  const classes = [
    "버서커", "디스트로이어", "워로드", "홀리나이트", "슬레이어", "발키리", "배틀마스터", "인파이터", "기공사",
    "창술사", "스트라이커", "브레이커", "데빌헌터", "블래스터", "호크아이", "스카우터", "건슬링어", "바드",
    "서머너", "아르카나", "소서리스", "블레이드", "데모닉", "리퍼", "소울이터", "도화가", "기상술사", "환수사",
    "가디언나이트",
  ];
  for (const name of classes)
    assert.match(classIconUrl(name) ?? "", /^https:\/\/cdn-lostark\.game\.onstove\.com\/2018\/obt\/assets\/images\/common\/class\/[a-z_]+\.svg$/, name);
  // The site's own pairings that are not the obvious name.
  assert.equal(classIconUrl("소서리스"), "https://cdn-lostark.game.onstove.com/2018/obt/assets/images/common/class/elementalmaster.svg");
  assert.equal(classIconUrl("환수사")?.endsWith("/wildsoul.svg"), true);
  assert.equal(classIconUrl("도화가")?.endsWith("/artist.svg"), true);
  // Not known (a new class, or a prototype key): no address, a two-letter chip.
  assert.equal(classIconUrl("새직업"), null);
  assert.equal(classIconUrl("constructor"), null);
  assert.equal(classChip("새직업"), "새직");
});
