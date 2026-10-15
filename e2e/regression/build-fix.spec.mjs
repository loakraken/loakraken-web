// 회귀(M26 2단계): 직업 상세에서 세팅을 눌러 고정하면 그 세팅을 쓰는 캐릭터만 남겨 다시 세고(주소에 남음),
// 3개까지만 고정되며(넘으면 누를 수 없다는 것을 글로), 하나씩·모두 풀 수 있다. '이 세팅을 쓰는 상위 30명' 표.
// 주소의 고정이 통계에 없으면 안내와 모두 풀기. 첫 로드·고정·풀기 흔들림 0, 휴대폰에서 고정 줄 44.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, shiftsSince, watchShifts } from "../support/shifts.mjs";

const BLADE = `/stats/classes/${encodeURIComponent("블레이드")}`;
const section = (page, title) => page.getByRole("region", { name: title, exact: true });
const row = (page, title, name) => section(page, title).getByRole("button", { name: new RegExp(`^${name} 고정`) });

for (const width of [1280, 360])
  test(`@M26 ${width} 고정하면 다시 세고, 3개까지, 하나씩·모두 풀기 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, BLADE);
    const bar = page.getByRole("group", { name: "고정한 세팅" });
    await expect(bar).toContainText("세팅을 누르면");
    const top = page.getByRole("region", { name: "이 세팅을 쓰는 상위 30명" });
    await expect(top.getByRole("row")).toHaveCount(31);
    await page.waitForTimeout(500);
    const load = await shiftsSince(page);
    expect(load.all, `첫 로드 흔들림 (${load.moved})`).toBe(0);

    // Fix one: pressed, in the address, said in the bar with the recounted sample.
    const fixOne = await shiftsDuring(page, () => row(page, "각인 채용률", "원한").click(), 1500);
    await expect(page).toHaveURL(/fixEngraving=%EC%9B%90%ED%95%9C/);
    await expect(row(page, "각인 채용률", "원한")).toHaveAttribute("aria-pressed", "true");
    await expect(bar.getByRole("button", { name: "원한 고정 풀기" })).toBeVisible();
    await expect(bar).toContainText(/이 세팅을 쓰는 [\d,]+명으로 다시 셌어요/);
    expect(fixOne.all, `고정 흔들림 (${fixOne.moved})`).toBe(0);

    // Up to three; then an unfixed row cannot be pressed and says why.
    await row(page, "주력 전투 특성", "특화").click();
    await expect(page).toHaveURL(/fixTopStat=/);
    await row(page, "팔찌 전투 특성", "치명").click();
    await expect(page).toHaveURL(/fixBracelet=/);
    await expect(bar).toContainText("고정은 3개까지");
    const blocked = row(page, "아크 패시브 진화", "140 포인트");
    await expect(blocked).toHaveAttribute("aria-disabled", "true");
    await expect(blocked).toHaveAccessibleName(/고정은 3개까지예요/);
    // Pressed anyway (a disabled control waits otherwise): nothing is added.
    await blocked.click({ force: true });
    await page.waitForTimeout(300);
    await expect(page).not.toHaveURL(/fixEvolution=/);

    // One freed from the bar, then all.
    const free = await shiftsDuring(page, () => bar.getByRole("button", { name: "주력 특화 고정 풀기" }).click(), 1500);
    await expect(page).not.toHaveURL(/fixTopStat=/);
    expect(free.all, `풀기 흔들림 (${free.moved})`).toBe(0);
    await bar.getByRole("button", { name: "모두 풀기" }).click();
    await expect(page).not.toHaveURL(/fix[A-Z]/);
    await expect(bar).toContainText("세팅을 누르면");
    await expectNoHorizontalOverflow(page);
  });

test("@M26 주소의 고정이 통계에 없으면 안내하고 모두 풀 수 있다 @regression", async ({ page }) => {
  await gotoReady(page, `${BLADE}?fixEngraving=${encodeURIComponent("없는각인")}`);
  await expect(page.getByText("고정한 세팅 가운데 지금 이 조건의 통계에 없는 것이 있어요.")).toBeVisible();
  await page.getByRole("button", { name: "고정 모두 풀기" }).click();
  await expect(page).not.toHaveURL(/fixEngraving/);
  await expect(section(page, "각인 채용률")).toBeVisible();
});

test("@M26 표본이 적은 조건은 상위 목록 대신 그렇게 알린다 @regression", async ({ page }) => {
  await gotoReady(page, `/stats/classes/${encodeURIComponent("기상술사")}`);
  await expect(page.getByRole("region", { name: "이 세팅을 쓰는 상위 30명" })).toContainText(/명보다 적어 목록을 보여 드리지 않아요/);
});

// A37: only a name (with its full name on hover) may end in "…"; headers, dates
// and numbers show whole ('순…', '10. …' were cut at every width).
for (const width of [1280, 360])
  test(`@A37 ${width} 상위 30명 표: 이름 말고는 어떤 칸도 잘리지 않음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, BLADE);
    const top = page.getByRole("region", { name: "이 세팅을 쓰는 상위 30명" });
    await expect(top.getByRole("rowheader")).toHaveCount(30);
    const cut = await top.locator("th, td").evaluateAll((cells) =>
      cells
        .filter((el) => !(el.tagName === "TH" && el.getAttribute("scope") === "row"))
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => `${el.textContent.trim()} ${el.clientWidth}<${el.scrollWidth}`),
    );
    expect([...new Set(cut)], "잘린 칸(이름 제외)").toEqual([]);
    // The date is the short form (10.15).
    const dates = await top.locator("tbody tr").evaluateAll((rows) => rows.map((r) => r.lastElementChild.textContent.trim()));
    expect(dates.filter((d) => d !== "-" && !/^\d{1,2}\.\d{1,2}$/.test(d)), "날짜 짧은 형식").toEqual([]);
  });

test.describe("휴대폰", () => {
  test.use({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });
  test("@M26 고정할 수 있는 줄은 44×44 네 모서리가 그 줄 @regression @A36", async ({ page }) => {
    await gotoReady(page, BLADE);
    for (const [title, name] of [["각인 채용률", "원한"], ["각인 채용률", "아드레날린"], ["팔찌 전투 특성", "특화"], ["팔찌 전투 특성", "치명"]]) {
      const target = row(page, title, name);
      await target.evaluate((el) => el.scrollIntoView({ block: "center" }));
      const misses = await target.evaluate((el) => {
        const b = el.getBoundingClientRect();
        const cx = b.left + 30;
        const cy = b.top + b.height / 2;
        const out = [];
        for (const [x, y] of [[cx - 21, cy - 21], [cx + 21, cy - 21], [cx - 21, cy + 21], [cx + 21, cy + 21]]) {
          const hit = document.elementFromPoint(x, y);
          if (hit && el.contains(hit)) continue;
          out.push(hit?.closest("button, a[href]")?.textContent?.trim().slice(0, 12) ?? "빈 곳");
        }
        return out;
      });
      expect(misses, `${title} ${name}: 44×44 네 모서리`).toEqual([]);
    }
  });

  // A37: the fixed columns took all of a phone's width and the name column got 0 (30 names unseen).
  test("@A37 상위 30명 표: 이름 칸은 읽을 폭을 갖고, 넘치면 말줄임 + 전체 이름 @regression", async ({ page }) => {
    await gotoReady(page, BLADE);
    const top = page.getByRole("region", { name: "이 세팅을 쓰는 상위 30명" });
    const names = top.getByRole("rowheader");
    await expect(names).toHaveCount(30);
    const cells = await names.evaluateAll((els) =>
      els.map((el) => {
        const link = el.querySelector("a");
        return {
          name: link?.textContent ?? "",
          width: Math.round(el.getBoundingClientRect().width),
          title: link?.getAttribute("title") ?? "",
          cut: el.scrollWidth > el.clientWidth,
          ellipsis: getComputedStyle(el).textOverflow === "ellipsis",
        };
      }),
    );
    expect(cells.filter((c) => c.width < 80).map((c) => `${c.name} ${c.width}px`), "이름 칸 80px 이상").toEqual([]);
    expect(cells.filter((c) => c.title !== c.name).map((c) => c.name), "전체 이름 툴팁").toEqual([]);
    expect(cells.filter((c) => c.cut && !c.ellipsis).map((c) => c.name), "넘치면 말줄임").toEqual([]);
    // The table scrolls inside its own region; the page itself does not.
    await expectNoHorizontalOverflow(page);
  });
});
