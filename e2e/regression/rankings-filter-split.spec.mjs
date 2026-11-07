// 회귀(v0.3.9 릴리스 CI, A7): 첫 로드에서 페이지가 나뉘어 오면(앞부분이 먼저 그려짐) 랭킹 조건의 첫 칸('서버')이 혼자
// 한 줄을 다 차지했다가 다음 칸('직업')이 오며 반으로 줄었다(390, 선택 상자의 화살표 331→161, 하이드레이션 전). 이제 휴대폰
// 폭에서 칸마다 반 줄로 고정이라, 뒤의 칸이 오든 말든 먼저 그려진 칸이 움직이지 않는다. 칸 안에서 이름 뒤에 선택 상자가
// 늦게 와도 같다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/**
 * Plays the filter form arriving in parts: everything after its first part is taken out (and, inside the first
 * label, what comes after its first child), then put back one part at a time in page order. The form keeps its final
 * height meanwhile, so only movement inside it counts. Returns the layout shift and what moved.
 */
const formArriving = (page) =>
  page.evaluate(async () => {
    // Each page's own conditions form (랭킹 조건, 수집품 랭킹 조건, 길드 랭킹 조건, 직업 통계 조건, …).
    const form = [...document.querySelectorAll("form[aria-label]")].find((f) => / 조건$|^랭킹 조건$/.test(f.getAttribute("aria-label")));
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // The form keeps its final height so the content under it stays put, and its rows keep their own
    // heights (a pinned height would otherwise stretch the rows and move them as each one arrives,
    // which a page arriving in parts, whose form simply grows, never does).
    form.style.height = `${form.offsetHeight}px`;
    form.style.alignContent = "flex-start";
    const [first, ...later] = [...form.children];
    for (const part of later) part.remove();
    const [, ...inside] = first.tagName === "LABEL" ? [...first.childNodes] : [];
    for (const node of inside) node.remove();
    await frame();
    const entries = [];
    const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
    observer.observe({ type: "layout-shift" });
    for (const node of inside) {
      first.append(node);
      await frame();
    }
    for (const part of later) {
      form.append(part);
      await frame();
    }
    await frame();
    entries.push(...observer.takeRecords());
    observer.disconnect();
    form.style.height = "";
    form.style.alignContent = "";
    const name = (node) => {
      const el = node?.nodeType === 1 ? node : node?.parentElement;
      return el ? `${el.parentElement?.tagName.toLowerCase()} > ${el.tagName.toLowerCase()}` : "?";
    };
    return {
      value: +entries.reduce((sum, entry) => sum + entry.value, 0).toFixed(4),
      moved: [...new Set(entries.flatMap((entry) => entry.sources.map((source) => name(source.node))))].join(", "),
    };
  });

for (const [label, path] of [
  ["젬 효율", "/rankings?type=gems"],
  ["팔찌 효율", "/rankings?type=bracelets"],
  ["캐릭터", "/rankings"],
  ["수집품", "/rankings?type=collectibles"],
  ["원정대", "/rankings?type=rosters"],
  ["길드", "/rankings?type=guilds"],
  // The class page's conditions use the same filter row (.filters).
  ["직업 통계", `/stats/classes/${encodeURIComponent("블레이드")}`],
])
  for (const width of [320, 390])
    test(`@A7 ${width} ${label}: 랭킹 조건이 나뉘어 와도 먼저 그려진 칸이 움직이지 않는다 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, path);
      await expect(page.getByRole("form", { name: / 조건$|^랭킹 조건$/ }).first()).toBeVisible();
      const late = await formArriving(page);
      expect(late.value, `조건 칸 늦게 온 부분이 민 것 (${late.moved})`).toBe(0);
      if (width !== 390) return;
      // A toggle sharing a row with a select sits on the same bottom line (±1 px).
      const gaps = await page.evaluate(() => {
        const form = [...document.querySelectorAll("form[aria-label]")].find((f) => / 조건$|^랭킹 조건$/.test(f.getAttribute("aria-label")));
        const fields = [...form.querySelectorAll(':scope > label [data-slot="select"], :scope > label input')].map((f) => f.getBoundingClientRect());
        return [...form.querySelectorAll(":scope > [role=group]")].flatMap((group) => {
          const g = group.getBoundingClientRect();
          return fields.filter((f) => f.top < g.bottom && g.top < f.bottom).map((f) => Math.round((g.bottom - f.bottom) * 10) / 10);
        });
      });
      for (const gap of gaps) expect(Math.abs(gap), `단추 줄과 선택 칸 바닥 차이 ${gaps}`).toBeLessThanOrEqual(1);
      // 수집품 at 390: its 단위 toggle and the 서버 select share the first row.
      if (label === "수집품") expect(gaps.length, "단위 단추와 서버 칸이 한 줄").toBeGreaterThan(0);
    });
