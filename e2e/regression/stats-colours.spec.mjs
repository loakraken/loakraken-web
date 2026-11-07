// 통계 색(사용자 11-08): 역할은 무채색 세 단계 + 서포터 직업 딜러는 빗금, 직업군은 7색.
// 색은 늘 이름과 함께(범례·줄 이름), 막대는 바탕과 3:1 이상, 직업 막대는 그 직업군의 색.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const block = (page) => page.getByRole("region", { name: "표본 구성" });
const part = (page, name) => block(page).getByRole("group", { name, exact: true });

/** A bar's fill: its background colour, or "hatch" for the striped 서포터 직업 딜러. */
const fill = (locator) =>
  locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return style.backgroundImage.includes("gradient") ? "hatch" : style.backgroundColor;
  });

/** Contrast of a bar's colour with the nearest opaque background around it (non-text: >= 3). */
const barContrast = (locator) =>
  locator.evaluate((el) => {
    const rgb = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    let bg = null;
    for (let n = el.parentElement?.parentElement; n && !bg; n = n.parentElement) {
      const v = rgb(getComputedStyle(n).backgroundColor);
      if (v.length >= 3 && (v.length < 4 || v[3] === 1)) bg = v;
    }
    const [a, b] = [lum(rgb(getComputedStyle(el).backgroundColor)), lum(bg ?? [255, 255, 255])].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });

// The dim theme is a stored choice (data-theme), the other two follow the OS.
const setTheme = (page, scheme) =>
  scheme === "dim" && page.evaluate(() => document.documentElement.setAttribute("data-theme", "dim"));

for (const scheme of ["light", "dark", "dim"])
  test(`통계 역할·직업군 색 ${scheme} @regression`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme === "light" ? "light" : "dark" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoReady(page, "/stats");
    await setTheme(page, scheme);
    await expect(block(page)).toBeVisible();

    // 역할: 딜러 직업 · 서포터 직업 딜러(빗금) · 서포터, 서로 다른 칠.
    const roleBars = part(page, "역할").locator("li [aria-hidden=true] > i");
    await expect(roleBars).toHaveCount(3);
    const roles = await Promise.all([0, 1, 2].map((i) => fill(roleBars.nth(i))));
    expect(roles[1], "서포터 직업 딜러는 빗금").toBe("hatch");
    expect(new Set(roles).size, `역할 칠 ${roles.join(" / ")}`).toBe(3);
    for (const i of [0, 2]) expect(await barContrast(roleBars.nth(i)), `역할 막대 ${i} 대비`).toBeGreaterThanOrEqual(3);

    // 직업군: 줄마다 다른 색, 바탕과 3:1 이상, 이름은 줄에 그대로.
    const groupRows = part(page, "직업군").getByRole("listitem");
    const groupBars = groupRows.locator("[aria-hidden=true] > i");
    const count = await groupBars.count();
    expect(count).toBeGreaterThanOrEqual(5);
    const groups = [];
    for (let i = 0; i < count; i++) {
      groups.push(await fill(groupBars.nth(i)));
      expect(await barContrast(groupBars.nth(i)), `직업군 막대 ${i} 대비`).toBeGreaterThanOrEqual(3);
    }
    expect(new Set(groups).size, `직업군 색 ${groups.join(" / ")}`).toBe(count);

    // 서포터 직업별 역할: 서포터 · 딜러 앞의 색 표시가 역할 줄과 같은 칠.
    const split = part(page, "서포터 직업별 역할").getByRole("listitem").first();
    await expect(split).toContainText(/서포터 [\d.]+% · 딜러 [\d.]+%/);

    // 전체 인구 · 직업별: 직업군 범례 7개, 버서커 막대는 범례 '전사'와 같은 색.
    await gotoReady(page, "/stats?tab=population");
    await setTheme(page, scheme);
    const panel = page.getByRole("tabpanel");
    await panel.getByRole("group", { name: "전체 인구 보기" }).getByRole("button", { name: "직업별" }).click();
    const legend = panel.getByRole("list", { name: "직업군 색" });
    await expect(legend.getByRole("listitem")).toHaveText(["전사", "무도가", "헌터", "마법사", "암살자", "스페셜리스트", "가디언나이트"]);
    const warrior = await legend
      .getByRole("listitem")
      .filter({ hasText: "전사" })
      .evaluate((el) => getComputedStyle(el, "::before").backgroundColor);
    const berserker = panel.getByRole("listitem").filter({ hasText: "버서커" }).locator("[aria-hidden=true] > i");
    await expect(berserker).toHaveCSS("background-color", warrior);
  });
