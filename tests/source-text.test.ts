import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSourceText,
  sourcePlainText,
  toneOf,
} from "../lib/character/source-text";

test("official FONT colours become increase/decrease tones without leaking tags", () => {
  const segments = parseSourceText(
    "치명타 피해량이 <FONT COLOR='#99ff99'>52.00%</FONT> 증가하지만, <FONT COLOR='#ff9999'>20.00%</FONT> 감소된 피해를 준다.",
  );
  assert.deepEqual(segments, [
    { text: "치명타 피해량이 ", tone: null },
    { text: "52.00%", tone: "positive" },
    { text: " 증가하지만, ", tone: null },
    { text: "20.00%", tone: "negative" },
    { text: " 감소된 피해를 준다.", tone: null },
  ]);
  assert.equal(segments.some((segment) => segment.text.includes("<")), false);
});

test("non red/green source colours are neutral emphasis, not a judgement", () => {
  for (const color of ["#83E9FF", "#F1D594", "#C2EA55", "#ffff99", "#FFD200"])
    assert.equal(toneOf(`color='${color}'`), "emphasis", color);
  assert.equal(toneOf(`color="#FE2E2E"`), "negative");
  assert.equal(toneOf("color=#9f9"), "positive");
  assert.equal(toneOf("size='12'"), "emphasis");
});

test("BR and paragraphs keep line breaks; nested FONT restores the outer tone", () => {
  assert.equal(sourcePlainText("첫 줄<BR>둘째 줄<br/>셋째"), "첫 줄\n둘째 줄\n셋째");
  assert.equal(sourcePlainText("<P ALIGN='CENTER'>가</P><P>나</P>"), "가\n나");
  assert.deepEqual(
    parseSourceText("<FONT color='#99ff99'>A<FONT color='#ff9999'>B</FONT>C</FONT>D"),
    [
      { text: "A", tone: "positive" },
      { text: "B", tone: "negative" },
      { text: "C", tone: "positive" },
      { text: "D", tone: null },
    ],
  );
});

test("unknown tags are dropped as text, comparisons and entities stay readable", () => {
  assert.equal(
    sourcePlainText("<img src='x' onerror='alert(1)'><script>alert(1)</script>끝"),
    "alert(1)끝",
  );
  assert.equal(sourcePlainText("피해 < 50% &amp; 방어 &gt; 10 &#44608;"), "피해 < 50% & 방어 > 10 김");
  assert.equal(sourcePlainText("</FONT>짝 없는 닫기"), "짝 없는 닫기");
  assert.equal(sourcePlainText("   \n앞뒤 공백\n\n\n\n정리  "), "앞뒤 공백\n\n정리");
});

test("empty and null values produce no segments", () => {
  assert.deepEqual(parseSourceText(null), []);
  assert.deepEqual(parseSourceText(""), []);
  assert.deepEqual(parseSourceText("<FONT COLOR='#99ff99'></FONT>"), []);
});
