import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CREW, CURSOR_COLORS, CURSOR_ROLES } from "../components/landing/intro-crew";

// The /about intro ships in the public bundle: its cursors are indexes with a
// colour and a role pill. The roles are crafts the page needs, never a team or
// a tool (user 11-09): the list is pinned here, so any other word fails.
const ROLES = ["레이아웃", "문구", "타이포", "색상", "아이콘", "모션", "데이터", "차트", "검색", "접근성", "성능", "검수"];

test("소개 커서: 색 12개, 역할 이름 12개(정해진 목록 그대로), 구역마다 커서 번호 4개까지", () => {
  assert.equal(CURSOR_COLORS.length, 12);
  for (const color of CURSOR_COLORS) assert.match(color, /^#[0-9a-f]{6}$/);
  assert.deepEqual([...CURSOR_ROLES], ROLES);
  assert.deepEqual(Object.keys(CREW).sort(), ["closing", "evidence", "intro", "preview", "roadmap"]);
  for (const [section, crew] of Object.entries(CREW)) {
    assert.ok(crew.length > 0 && crew.length <= 4, section);
    assert.equal(new Set(crew).size, crew.length, section);
    for (const i of crew) assert.ok(Number.isInteger(i) && i >= 0 && i < CURSOR_COLORS.length, `${section}: ${i}`);
  }
});

test("소개 코드의 문자열: 역할 이름표 밖에 이름 없음(보이는 글은 건너뛰기 단추뿐)", () => {
  for (const file of ["components/landing/intro-crew.ts", "components/landing/build-intro.tsx"]) {
    const source = readFileSync(file, "utf8");
    const quoted = [...source.matchAll(/(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)].map((m) => m[2]);
    const korean = quoted.filter((s) => /[가-힣]/.test(s));
    if (file.endsWith("intro-crew.ts")) {
      // The crew file quotes colours and the pinned roles, nothing else.
      assert.deepEqual(korean, ROLES, file);
      assert.deepEqual(quoted.filter((s) => !/^#[0-9a-f]{6}$/.test(s) && !ROLES.includes(s)), [], file);
    } else assert.deepEqual(korean, [], file);
    assert.doesNotMatch(source, /\bTEAMS\b/, file);
  }
  // The only Korean in the component is the skip button's own text.
  const korean = readFileSync("components/landing/build-intro.tsx", "utf8").match(/[가-힣][가-힣 ]*/g) ?? [];
  assert.deepEqual([...new Set(korean.map((s) => s.trim()))], ["소개 건너뛰기"]);
});
