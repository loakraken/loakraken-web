// 회귀(A7, CI 11-08): 첫 페이지가 나뉘어 오면 통계 조건 막대의 칸이 이름만 먼저 그려질 수 있다. 이름만 있는 좁은
// '역할' 칸이 서버 칸 옆 줄 끝에 놓였다가, 알약이 오며 넓어져 다음 줄로 내려갔다(360: 202,292 94px → 32,333 250px,
// 흔들림 0.0116). 같은 줄에 키 큰 칸이 오면 앞 칸 이름도 위아래로 다시 가운데 맞춰졌다. 이제 칸마다 자리(줄·폭·높이)가
// 처음부터 정해져 있어, 칸과 그 안의 이름·도움말·조절기가 하나씩 와도 먼저 그려진 것은 움직이지 않는다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

/**
 * Plays the condition bar arriving in parts, in page order: the rows after the first and every field are taken
 * out, then each row, each field (empty) and each part of a field (label, help, control) comes back one at a
 * time. After every step the boxes of everything already drawn in the bar are compared with the step before;
 * returns what moved (by 1px or more), with the step and the box before → after.
 */
const partsArriving = (bar) =>
  bar.evaluate((form) => {
    const rows = [...form.children];
    const plan = rows.map((row) => ({
      row,
      fields: row.tagName === "DIV" ? [...row.children].map((field) => ({ field, parts: [...field.childNodes] })) : [],
    }));
    for (const { row, fields } of plan) {
      for (const { field, parts } of fields) {
        parts.forEach((part) => part.remove());
        field.remove();
      }
      if (row !== rows[0]) row.remove();
    }
    const box = (node) => {
      if (node.nodeType === 1) return node.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect();
    };
    const label = (node) => {
      const el = node.nodeType === 1 ? node : node.parentElement;
      return `${el.tagName.toLowerCase()}${node.nodeType === 3 ? " 글자" : ""}[${node.textContent.trim().slice(0, 6)}]`;
    };
    const round = (r) => `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    const seen = new Map();
    const moved = [];
    const look = (step) => {
      const nodes = [form, ...form.querySelectorAll("*")].flatMap((el) => [
        el,
        ...[...el.childNodes].filter((node) => node.nodeType === 3 && node.textContent.trim()),
      ]);
      for (const node of nodes) {
        const now = box(node);
        if (!now.width || !now.height) continue;
        const before = seen.get(node);
        if (before && (Math.abs(before.x - now.x) >= 1 || Math.abs(before.y - now.y) >= 1))
          moved.push(`${step}: ${label(node)} ${round(before)} → ${round(now)}`);
        seen.set(node, now);
      }
    };
    look("처음");
    for (const [r, { row, fields }] of plan.entries()) {
      if (r > 0) {
        form.append(row);
        look(`줄${r + 1}`);
      }
      for (const [f, { field, parts }] of fields.entries()) {
        row.append(field);
        look(`줄${r + 1} 칸${f + 1}`);
        for (const [p, part] of parts.entries()) {
          field.append(part);
          look(`줄${r + 1} 칸${f + 1} 조각${p + 1}`);
        }
      }
    }
    return moved;
  });

for (const width of [320, 360, 390, 768, 1280])
  test(`@A7 ${width} 통계 조건 막대: 칸이 나뉘어 와도 먼저 그려진 칸이 움직이지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/stats");
    const bar = page.getByRole("form", { name: "통계 조건" });
    await expect(bar.getByRole("radiogroup", { name: "기간" })).toBeVisible();
    // The sample line has its answer, so nothing else changes the bar's height meanwhile.
    await expect(bar.getByRole("note")).toContainText(/표본 [\d,]+명/);
    await page.evaluate(() => document.fonts.ready);
    const before = await bar.boundingBox();
    const moved = await partsArriving(bar);
    expect(moved, "나뉘어 온 칸이 민 것").toEqual([]);
    // Everything is back where it was: the bar itself ends the same size.
    const after = await bar.boundingBox();
    expect(Math.round(after.height)).toBe(Math.round(before.height));
    await expectNoHorizontalOverflow(page);
  });
