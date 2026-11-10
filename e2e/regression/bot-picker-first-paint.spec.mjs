// 회귀(A7, #1530 CI tablet 360 flaky): 홈 히어로의 '봇 바꾸기' 단추는 첫 HTML이 나뉘어 와 단추 글자가 늦게
// 그려져도 움직이지 않는다. 단추는 봇 칸의 오른쪽 아래에 붙어 있는데, 글자 없는 단추는 안쪽 여백+테두리(26px)만큼
// 좁고 빈 inline-block이라 줄의 기준선에 얹혀 감싼 상자가 39px로 높았다. 글자가 오면 68x32가 되며 왼쪽 위 모서리가
// 움직였다(CI: div.botPicker 292,486 26x39 → 250,492 68x32, 깨기 225ms 전). 처음부터 같은 상자여야 한다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** The trigger painted without its label first, then the label arriving: the layout shift and what moved. */
const labelArriving = (page) =>
  page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const trigger = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "봇 바꾸기");
    if (!trigger) return { found: false, value: 0, moved: "" };
    const before = trigger.getBoundingClientRect();
    // Cut as the first HTML does, right after the trigger's start tag: its label and everything after it in the
    // document (each ancestor's later siblings) are not here yet. They come back in page order.
    const label = [...trigger.childNodes];
    const after = [];
    for (let node = trigger; node && node !== document.body; node = node.parentElement) {
      const siblings = [];
      for (let next = node.nextSibling; next; next = next.nextSibling) siblings.push(next);
      after.push([node.parentElement, siblings]);
    }
    for (const node of label) node.remove();
    for (const [, siblings] of after) for (const node of siblings) node.remove();
    await frame();
    const entries = [];
    const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
    observer.observe({ type: "layout-shift" });
    trigger.append(...label);
    await frame();
    for (const [parent, siblings] of after) parent.append(...siblings);
    await frame();
    await frame();
    entries.push(...observer.takeRecords());
    observer.disconnect();
    const box = (r) => `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    const name = (source) =>
      `${source.node?.nodeType === 1 ? `${source.node.tagName.toLowerCase()}.${String(source.node.className).split(" ")[0]}` : source.node?.nodeName ?? "::pseudo"} ${box(source.previousRect)}→${box(source.currentRect)}`;
    const end = trigger.getBoundingClientRect();
    return {
      found: true,
      value: +entries.reduce((sum, entry) => sum + entry.value, 0).toFixed(7),
      moved: [...new Set(entries.flatMap((entry) => entry.sources.map((source) => name(source))))].join(", "),
      same: box(before) === box(end),
    };
  });

for (const width of [320, 360, 390, 1280])
  test(`@A7 ${width} 봇 바꾸기: 단추 글자가 늦게 와도 단추가 움직이지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await gotoReady(page, "/");
    await expect(page.getByRole("button", { name: "봇 바꾸기" })).toBeVisible();
    const late = await labelArriving(page);
    expect(late.found).toBe(true);
    expect(late.value, `늦게 온 글자가 민 것 (${late.moved})`).toBe(0);
    expect(late.same, "끝난 뒤 단추 자리는 처음과 같다").toBe(true);
  });
