import { test } from "node:test";
import assert from "node:assert/strict";
import { classGroup, groupShares } from "../lib/stats/class-groups";
import { classIconUrl } from "../lib/stats/class-icons";

test("직업군: every class with an official icon has a group", () => {
  const classes = [
    "디스트로이어", "워로드", "버서커", "홀리나이트", "슬레이어", "발키리", "배틀마스터", "인파이터", "기공사", "창술사",
    "스트라이커", "브레이커", "데빌헌터", "블래스터", "호크아이", "스카우터", "건슬링어", "바드", "서머너", "아르카나",
    "소서리스", "블레이드", "데모닉", "리퍼", "소울이터", "도화가", "기상술사", "환수사", "가디언나이트", "차원술사",
  ];
  for (const name of classes) {
    assert.ok(classIconUrl(name), `${name} is a known class`);
    assert.notEqual(classGroup(name), "기타", name);
  }
  assert.equal(classGroup("새직업"), "기타");
});

test("직업군 비율: grouped counts sum to the rows, largest first", () => {
  const shares = groupShares([
    { className: "바드", count: 6 },
    { className: "버서커", count: 5 },
    { className: "슬레이어", count: 3 },
    { className: "새직업", count: 1 },
  ]);
  assert.deepEqual(
    shares.map((s) => [s.group, s.count]),
    [["전사", 8], ["마법사", 6], ["기타", 1]],
  );
  assert.equal(Math.round(shares.reduce((sum, s) => sum + s.share, 0)), 100);
  assert.deepEqual(groupShares([]), []);
});
