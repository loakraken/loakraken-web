// 회귀(QA v0.3.12 후보 P3, #1632): 캐릭터 주소로 바로 열면 '조회 중' 화면은 서버가 먼저 보낸 기다림 화면이고 React가
// 살리지 않아, 캔버스에 그리는 구슬이 답이 올 때까지 비어 있었다(64px 빈 상자). 이제 서버가 같은 구슬의 정지 화면(움직임
// 줄이기 화면과 같은 프레임)을 SVG로 함께 보낸다. 구슬 자리(64×64)와 상태 문장 · 링크 위치는 그대로(프론트 #1585 비교의
// 기준), 사이트 안에서 들어가면 지금처럼 캔버스가 그린다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const STATUS = "캐릭터 정보를 조회하고 있어요.";

// The loading screen's three rows as the grid places them: the orb cell (its first child: the canvas on
// develop, the 64×64 box now), the status line and the links row.
const rows = (page) =>
  page.locator("main[aria-busy]").evaluate((main) => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    };
    return {
      width: innerWidth,
      orb: r(main.firstElementChild),
      status: r(main.querySelector('[role="status"]')),
      links: r(main.querySelector("a")),
    };
  });

for (const width of [320, 360, 1280])
  test(`${width}: 주소로 바로 열어도 조회 중 화면에 구슬이 보이고, 구슬 · 문장 · 링크 자리는 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    // '로딩긴' answers 8 s late (tests/mock-backend.mjs): the server's waiting screen stays up.
    await page.goto(`/character/${encodeURIComponent("로딩긴")}`, { waitUntil: "commit" });
    const main = page.locator("main[aria-busy]");
    await expect(main.getByRole("status")).toHaveText(STATUS);
    // Places first (so they are checked on develop's screen too): the 64px orb cell centred, then 22px,
    // the status line, 22px, the links — the layout the screen had before the still frame.
    const at = await rows(page);
    test.info().annotations.push({ type: "rows", description: JSON.stringify(at) });
    expect(at.orb, "구슬 자리").toMatchObject({ x: Math.round((at.width - 64) / 2), w: 64, h: 64 });
    expect(at.status.y, "상태 문장은 구슬 아래 22px").toBe(at.orb.y + 64 + 22);
    expect(Math.abs(at.links.y - (at.status.y + at.status.h + 22)), "링크 줄은 문장 아래 22px").toBeLessThanOrEqual(1);
    // The still frame is there and draws: dots in a colour, inside the orb's own 64×64 cell.
    const still = main.locator("svg");
    await expect(still).toBeVisible();
    const drawn = await still.evaluate((svg) => {
      const paths = [...svg.querySelectorAll("path")];
      const box = svg.getBoundingClientRect();
      const cell = svg.parentElement.getBoundingClientRect();
      return {
        paths: paths.length,
        painted: paths.filter((p) => p.getAttribute("d") && !/^(none|rgba\(0, 0, 0, 0\))$/.test(getComputedStyle(p).stroke) && parseFloat(getComputedStyle(p).strokeWidth) > 0).length,
        inside: Math.round(box.x) === Math.round(cell.x) && Math.round(box.y) === Math.round(cell.y) && Math.round(box.width) === 64 && Math.round(box.height) === 64,
      };
    });
    expect(drawn.paths, "정지 구슬의 점 묶음").toBeGreaterThan(10);
    expect(drawn.painted, "모든 묶음이 색으로 그려짐(점 = 둥근 끝 선)").toBe(drawn.paths);
    expect(drawn.inside, "64×64 구슬 자리 안").toBe(true);
  });

// Dark (system dark → data-theme="dark" before paint): the still takes the dark orb's colours.
test("어두운 화면에서도 정지 구슬은 어두운 구슬 색 @regression", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(`/character/${encodeURIComponent("로딩긴")}`, { waitUntil: "commit" });
  const still = page.locator("main[aria-busy] svg");
  await expect(still).toBeVisible();
  const fills = await still.evaluate((svg) =>
    [...svg.querySelectorAll("path")].map((p) => {
      const probe = document.createElement("span");
      // Resolve both custom colours the way the browser writes them, to compare with the computed fill.
      probe.style.color = p.style.getPropertyValue("--orb-d");
      document.body.append(probe);
      const dark = getComputedStyle(probe).color;
      probe.style.color = p.style.getPropertyValue("--orb-l");
      const light = getComputedStyle(probe).color;
      probe.remove();
      return { fill: getComputedStyle(p).stroke, dark, light };
    }),
  );
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  expect(fills.every((f) => f.fill === f.dark), "모든 점 묶음이 어두운 색").toBe(true);
  expect(fills.some((f) => f.dark !== f.light), "밝은 색과 다름").toBe(true);
});

// In-app (the browser renders the screen itself): no still frame, the canvas draws as before.
test("사이트 안에서 검색해 들어가면 정지 화면 없이 캔버스 구슬 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/");
  const search = page.getByRole("textbox", { name: "캐릭터 이름" });
  await search.fill("로딩긴");
  await search.press("Enter");
  const main = page.locator("main[aria-busy]");
  await expect(main.getByRole("status")).toHaveText(STATUS);
  await expect(main.locator("canvas")).toBeVisible();
  await expect(main.locator("svg")).toHaveCount(0);
});

// codex #1633 P3: more of the orb's screens. Dim (stored choice 'dim' → data-theme="dim") takes the dark colours.
test("흐린 화면(dim)에서도 정지 구슬은 어두운 구슬 색 @regression", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("loakraken-theme", "dim"));
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(`/character/${encodeURIComponent("로딩긴")}`, { waitUntil: "commit" });
  const still = page.locator("main[aria-busy] svg");
  await expect(still).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dim");
  const strokes = await still.evaluate((svg) =>
    [...svg.querySelectorAll("path")].map((p) => {
      const probe = document.createElement("span");
      probe.style.color = p.style.getPropertyValue("--orb-d");
      document.body.append(probe);
      const dark = getComputedStyle(probe).color;
      probe.remove();
      return { stroke: getComputedStyle(p).stroke, dark };
    }),
  );
  expect(strokes.every((s) => s.stroke === s.dark), "모든 점 묶음이 어두운 색").toBe(true);
});

// Reduced motion: a direct load still shows the still frame (the same frame the canvas would hold).
test("움직임 줄이기에서도 주소로 바로 열면 정지 구슬 @regression", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(`/character/${encodeURIComponent("로딩긴")}`, { waitUntil: "commit" });
  await expect(page.locator("main[aria-busy] svg")).toBeVisible();
  expect(await page.locator("main[aria-busy] svg path").count()).toBeGreaterThan(10);
});

// In-app (and under reduced motion): the canvas really draws — pixels on it, not only an element there.
for (const reduced of [false, true])
  test(`사이트 안에서 들어가면 캔버스에 구슬이 그려진다${reduced ? "(움직임 줄이기)" : ""} @regression`, async ({ page }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoReady(page, "/");
    const search = page.getByRole("textbox", { name: "캐릭터 이름" });
    await search.fill("로딩긴");
    await search.press("Enter");
    const main = page.locator("main[aria-busy]");
    await expect(main.getByRole("status")).toHaveText(STATUS);
    await expect(main.locator("svg")).toHaveCount(0);
    const canvas = main.locator("canvas");
    await expect
      .poll(
        () =>
          canvas.evaluate((c) => {
            const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
            let painted = 0;
            for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted += 1;
            return painted;
          }),
        { message: "캔버스에 그려진 점" },
      )
      .toBeGreaterThan(50);
  });
