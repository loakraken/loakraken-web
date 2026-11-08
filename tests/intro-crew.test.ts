import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CREW, CURSOR_COLORS } from "../components/landing/intro-crew";

// The /about intro ships in the public bundle: its cursors are colours and
// indexes only, with no names in the code.

test("소개 커서는 색만 있고, 구역마다 커서 번호 4개까지", () => {
  assert.equal(CURSOR_COLORS.length, 12);
  for (const color of CURSOR_COLORS) assert.match(color, /^#[0-9a-f]{6}$/);
  assert.deepEqual(Object.keys(CREW).sort(), ["closing", "evidence", "intro", "preview", "roadmap"]);
  for (const [section, crew] of Object.entries(CREW)) {
    assert.ok(crew.length > 0 && crew.length <= 4, section);
    assert.equal(new Set(crew).size, crew.length, section);
    for (const i of crew) assert.ok(Number.isInteger(i) && i >= 0 && i < CURSOR_COLORS.length, `${section}: ${i}`);
  }
});

test("소개 코드의 문자열에 이름이 없음(보이는 글은 건너뛰기 단추뿐)", () => {
  for (const file of ["components/landing/intro-crew.ts", "components/landing/build-intro.tsx"]) {
    const source = readFileSync(file, "utf8");
    const quoted = [...source.matchAll(/(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)].map((m) => m[2]);
    // No quoted Korean anywhere, and the crew file quotes nothing but colours.
    assert.deepEqual(quoted.filter((s) => /[가-힣]/.test(s)), [], file);
    if (file.endsWith("intro-crew.ts")) assert.deepEqual(quoted.filter((s) => !/^#[0-9a-f]{6}$/.test(s)), [], file);
    assert.doesNotMatch(source, /\bTEAMS\b/, file);
  }
  // The only Korean in the component is the skip button's own text.
  const korean = readFileSync("components/landing/build-intro.tsx", "utf8").match(/[가-힣][가-힣 ]*/g) ?? [];
  assert.deepEqual([...new Set(korean.map((s) => s.trim()))], ["소개 건너뛰기"]);
});
