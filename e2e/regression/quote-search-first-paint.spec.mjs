// 회귀(A7, #1559 CI 1280 flaky: material-quote-box-categories '분류 목록 도착 흔들림' 0.000204): 재료 구매 견적의
// '검색' 단추는 첫 HTML이 나뉘어 와 단추 글자가 늦게 그려져도 움직이지 않는다. 단추는 입력칸 옆 줄 끝에 있어, 글자 없이
// 먼저 그려진 좁은 단추가 글자가 오면 왼쪽으로 넓어지며 왼쪽 끝(과 입력칸)이 움직였다(CI 화면 기록: 둥근 빈 단추 →
// '검색' 알약). 처음부터 끝 폭이어야 한다(#1532 봇 바꾸기와 같은 고침).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** The search button painted without its content first, then the content arriving: the layout shift and what moved. */
const contentArriving = (button) =>
  button.evaluate(async (button) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const box = (r) => `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    const before = box(button.getBoundingClientRect());
    // Cut as the first HTML does, right after the button's start tag: its icon and label and everything after it in
    // the document (each ancestor's later siblings) are not here yet. They come back in page order.
    const content = [...button.childNodes];
    const after = [];
    for (let node = button; node && node !== document.body; node = node.parentElement) {
      const siblings = [];
      for (let next = node.nextSibling; next; next = next.nextSibling) siblings.push(next);
      after.push([node.parentElement, siblings]);
    }
    for (const node of content) node.remove();
    for (const [, siblings] of after) for (const node of siblings) node.remove();
    await frame();
    const entries = [];
    const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
    observer.observe({ type: "layout-shift" });
    button.append(...content);
    await frame();
    for (const [parent, siblings] of after) parent.append(...siblings);
    await frame();
    await frame();
    entries.push(...observer.takeRecords());
    observer.disconnect();
    const name = (source) =>
      `${source.node?.nodeType === 1 ? `${source.node.tagName.toLowerCase()} '${source.node.textContent.trim().slice(0, 12)}'` : source.node?.nodeName ?? "::pseudo"} ${box(source.previousRect)}→${box(source.currentRect)}`;
    return {
      value: +entries.reduce((sum, entry) => sum + entry.value, 0).toFixed(7),
      moved: [...new Set(entries.flatMap((entry) => entry.sources.map((source) => name(source))))].join(", "),
      same: before === box(button.getBoundingClientRect()),
    };
  });

for (const width of [1280, 1024, 768])
  test(`@A7 ${width} 견적 검색 단추: 단추 글자가 늦게 와도 단추와 입력칸이 움직이지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/market/quote");
    // The hidden copy (data-label) is not part of the name: exactly '검색'.
    const button = page.getByRole("button", { name: "검색", exact: true });
    await expect(button).toBeVisible();
    const late = await contentArriving(button);
    expect(late.value, `늦게 온 글자가 민 것 (${late.moved})`).toBe(0);
    expect(late.same, "끝난 뒤 단추 자리는 처음과 같다").toBe(true);
  });
