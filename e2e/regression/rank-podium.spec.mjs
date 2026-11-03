// 회귀(A7·A37): 랭킹 6종의 2·1·3 단상, API 초상화·대체 아이콘, 고정 자리와 순위 표식.
// 첫 그림부터 이미지 도착까지 흔들림·잘림 0, 초상화 배경색 무대·위 덮개 빛·1위 테두리 빛·굴러가는 숫자와 줄인 동작을 지킨다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { watchShifts, shiftsSince } from "../support/shifts.mjs";

const LISTS = [
  { name: "캐릭터", path: "/rankings", api: "/api/rankings", metric: 5 },
  { name: "팔찌", path: "/rankings?type=bracelets", api: "/api/rankings/efficiency", metric: 2, server: true },
  { name: "젬", path: "/rankings?type=gems", api: "/api/rankings/efficiency", metric: 2, server: true },
  { name: "수집품", path: "/rankings?type=collectibles", api: "/api/rankings/collectibles", metric: 4 },
  { name: "원정대", path: "/rankings?type=roster", api: "/api/rankings/rosters", metric: 3 },
  // 기본 전투력 평균 목은 3위가 미관측이다. 세 순위가 있는 전투력 합으로 단상을 검사한다.
  { name: "길드", path: "/rankings?type=guilds&sort=CP_SUM", api: "/api/rankings/guilds", metric: 5, guild: true },
];
const podiumOf = (page) => page.locator("[data-rank-podium]");
const frames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const sizeOf = (locator) => locator.evaluateAll((els) => els.map((el) => {
  const r = el.getBoundingClientRect();
  return { width: r.width, height: r.height };
}));

async function themeBeforeLoad(page, theme) {
  await page.addInitScript((value) => localStorage.setItem("loakraken-theme", value), theme);
}

async function expectTextFits(podium) {
  const failures = await podium.evaluate((root) => {
    const failed = [];
    const outside = (rect, box) => rect.left < box.left - 1 || rect.right > box.right + 1 || rect.top < box.top - 1 || rect.bottom > box.bottom + 1;
    for (const el of root.querySelectorAll("[data-podium-name], [data-podium-value]")) {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1 || style.textOverflow === "ellipsis")
        failed.push(el.textContent);
      // 값은 글자마다 한 줄 창(굴러가는 숫자)이다. 창이 값 칸 안에 있어야 한다.
      const digits = [...el.querySelectorAll("[data-podium-digit]")];
      const rects = digits.length ? digits.map((digit) => digit.getBoundingClientRect()) : (() => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return [...range.getClientRects()];
      })();
      for (const rect of rects) if (outside(rect, box)) failed.push(el.textContent);
      // 카드(overflow hidden)가 글을 자르지 않는다.
      if (outside(box, el.closest("[data-podium-place]").getBoundingClientRect())) failed.push(el.textContent);
    }
    return failed;
  });
  expect(failures, "이름·숫자 잘림과 말줄임 없음").toEqual([]);
}

// 이름 글의 마지막 줄 바로 아래에 값이 온다(한 줄 이름도 빈 줄 없이, 이름 자리 아래쪽 정렬).
async function expectValueUnderName(podium) {
  const gaps = await podium.evaluate((root) => [...root.querySelectorAll("[data-podium-place]")].map((place) => {
    const name = place.querySelector("[data-podium-name]");
    const range = document.createRange();
    range.selectNodeContents(name);
    const lines = [...range.getClientRects()];
    const textBottom = Math.max(...lines.map((rect) => rect.bottom));
    const valueTop = Math.min(...[...place.querySelectorAll("[data-podium-value] [data-podium-digit]")].map((digit) => digit.getBoundingClientRect().top));
    return Math.round(valueTop - textBottom);
  }));
  for (const gap of gaps) {
    expect(gap, `이름과 값 사이 ${gaps.join("/")}px`).toBeGreaterThanOrEqual(0);
    expect(gap, `이름과 값 사이 ${gaps.join("/")}px`).toBeLessThanOrEqual(8);
  }
}

// 스타일 숫자를 추측하지 않고 실제 캐스케이드가 그린 상자·색·텍스트를 검사한다.
async function expectCascade(page) {
  const result = await podiumOf(page).evaluate((root) => {
    const bounds = root.getBoundingClientRect();
    const failures = [];
    for (const box of root.querySelectorAll("[data-portrait-box]")) {
      const child = box.querySelector("[data-podium-image], [data-portrait-fallback]");
      const a = box.getBoundingClientRect();
      const b = child.getBoundingClientRect();
      if (a.width !== b.width || a.height !== b.height || a.x !== b.x || a.y !== b.y)
        failures.push("초상화·대체 아이콘 상자 크기 불일치");
      if (child.tagName === "IMG") {
        const style = getComputedStyle(child);
        if (style.objectFit !== "cover" || style.objectPosition !== "50% 0%")
          failures.push("초상화 머리·어깨 크롭 불일치");
      } else if (child.dataset.portraitFallback === "guild") {
        const circle = child.firstElementChild.getBoundingClientRect();
        if (Math.abs(circle.x + circle.width / 2 - (a.x + a.width / 2)) > 1 ||
            Math.abs(circle.y + circle.height / 2 - (a.y + a.height / 2)) > 1)
          failures.push("길드 첫 글자 중앙 정렬 불일치");
      }
    }
    const luminance = (color) => {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255)
        .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const stage = luminance("rgb(21, 24, 29)");
    for (const place of root.querySelectorAll("[data-podium-place]")) {
      const card = place.getBoundingClientRect();
      const style = getComputedStyle(place);
      const light = getComputedStyle(place, "::before");
      // 무대는 공식 초상화의 평평한 배경색(#15181d)과 같아 경계가 보이지 않는다(두 테마 모두).
      if (style.backgroundColor !== "rgb(21, 24, 29)" || style.backgroundImage !== "none")
        failures.push(`${place.dataset.podiumPlace}위 무대 색 불일치 ${style.backgroundColor} ${style.backgroundImage.slice(0, 30)}`);
      if (card.left < bounds.left || card.right > bounds.right || card.top < bounds.top || card.bottom > bounds.bottom)
        failures.push("카드가 예약한 자리 밖에 있음");
      if (light.position !== "absolute" || light.mixBlendMode !== "screen" || !light.backgroundImage.includes("radial-gradient(") ||
          light.pointerEvents !== "none")
        failures.push("메달 빛 덮개(위에서, screen) 누락");
      if (place.dataset.podiumPlace === "1" && !light.backgroundImage.includes("conic-gradient("))
        failures.push("1위 조명 원뿔 누락");
      for (const child of place.children) {
        const rect = child.getBoundingClientRect();
        if (rect.left < card.left || rect.right > card.right || rect.top < card.top || rect.bottom > card.bottom)
          failures.push(`${place.dataset.podiumPlace}위 카드가 ${child.tagName} 를 자름`);
      }
      for (const text of place.querySelectorAll("[data-podium-name], [data-podium-value]")) {
        const a = luminance(getComputedStyle(text).color);
        if ((Math.max(a, stage) + 0.05) / (Math.min(a, stage) + 0.05) < 4.5) failures.push("무대 위 글 명암비 4.5 미만");
      }
    }
    for (const image of root.querySelectorAll("img[data-podium-image]")) {
      const style = getComputedStyle(image);
      if (style.maskImage !== "none" || style.mixBlendMode !== "normal") failures.push("초상화에 가림·섞기 남음");
    }
    return failures;
  });
  expect(result, "넓은 선택자가 시상대 스타일을 덮지 않음").toEqual([]);

  const marks = await page.locator("table [data-top-rank]").evaluateAll((elements) => {
    const luminance = (color) => {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255)
        .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    return elements.map((el) => {
      const fill = getComputedStyle(el, "::before");
      const text = getComputedStyle(el);
      const a = luminance(text.color), b = luminance(fill.backgroundColor);
      const cell = el.closest("td").getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      return {
        contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        absolute: fill.position === "absolute",
        insideCell: rect.x + rect.width / 2 - parseFloat(fill.width) / 2 >= cell.left &&
          rect.x + rect.width / 2 + parseFloat(fill.width) / 2 <= cell.right &&
          rect.y + rect.height / 2 - parseFloat(fill.height) / 2 >= cell.top &&
          rect.y + rect.height / 2 + parseFloat(fill.height) / 2 <= cell.bottom,
      };
    });
  });
  expect(marks).toHaveLength(3);
  for (const mark of marks) {
    expect(mark.contrast, "실제로 그려진 순위 표식의 명암비").toBeGreaterThanOrEqual(4.5);
    expect(mark.absolute && mark.insideCell, "표식은 셀 안에서만 그림").toBe(true);
  }
}

async function expectPlaces(page, item, sourceRows) {
  const podium = podiumOf(page);
  const table = page.getByRole("table").first();
  await expect(podium).toHaveAttribute("data-podium-state", "ready");
  const places = podium.locator("[data-podium-place]");
  await expect(places).toHaveCount(3);
  // Each card stacks its content at its foot; the winner's card starts
  // highest and its portrait is the largest.
  const rects = await places.evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return { rank: Number(el.dataset.podiumPlace), x: r.x, y: r.y, bottom: r.bottom, portrait: el.querySelector("[data-portrait-box]").getBoundingClientRect().height };
  }));
  expect([...rects].sort((a, b) => a.x - b.x).map((r) => r.rank)).toEqual([2, 1, 3]);
  for (const rank of [2, 3]) {
    expect(rects.find((r) => r.rank === 1).y).toBeLessThan(rects.find((r) => r.rank === rank).y);
    expect(rects.find((r) => r.rank === 1).portrait).toBeGreaterThan(rects.find((r) => r.rank === rank).portrait);
    expect(rects.find((r) => r.rank === rank).bottom).toBe(rects.find((r) => r.rank === 1).bottom);
  }

  for (const rank of [1, 2, 3]) {
    const place = podium.locator(`[data-podium-place="${rank}"]`);
    const row = table.locator("tbody tr").filter({ has: page.locator(`[data-top-rank="${rank}"]`) });
    const apiRow = sourceRows.find((r) => r.rank === rank);
    const name = apiRow.characterName ?? apiRow.guildName;
    await expect(place.locator("[data-podium-name]")).toHaveText(name);
    await expect(row.getByRole("rowheader").getByRole("link")).toHaveText(name);
    const href = await row.getByRole("rowheader").getByRole("link").getAttribute("href");
    await expect(place.locator("[data-podium-name]")).toHaveAttribute("href", href);
    // 보조 설명(수집품 점수·길드 관측 인원)을 빼고 주 지표의 같은 숫자를 비교한다.
    const value = await row.locator("th, td").nth(item.metric).evaluate((el) =>
      [...el.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join("").trim(),
    );
    // 화면 읽기 프로그램과 검사는 숨긴 값 글을 읽고, 숫자 창은 장식이다.
    await expect(place.locator("[data-podium-value] [data-value-text]")).toHaveText(value);
    await expect(place.locator("[data-podium-value] [data-podium-digit]").first()).toBeVisible();
    expect(await place.locator("[data-podium-value] > [aria-hidden]").count()).toBe(1);
    expect(await place.locator("[data-podium-value] [data-podium-digit]").evaluateAll((els) =>
      els.map((el) => el.firstElementChild?.textContent === "0123456789" ? el.style.getPropertyValue("--d") : el.textContent).join(""))).toBe(value);
    await expect(place.locator(`svg[data-place="${rank}"]`)).toHaveCount(1);
    if (item.guild) {
      await expect(place.locator('[data-portrait-fallback="guild"]')).toHaveCount(1);
      await expect(place.locator("[data-podium-image]")).toHaveCount(0);
    } else if (apiRow.imageUrl) {
      await expect(place.locator("img[data-podium-image]")).toHaveAttribute("src", apiRow.imageUrl);
    } else {
      await expect(place.locator('[data-portrait-fallback="class"]')).toHaveCount(1);
      await expect(place.locator('[data-portrait-fallback="class"] > span')).toHaveAttribute("aria-hidden", "true");
      await expect(place.locator("[data-podium-image]")).toHaveCount(0);
    }
  }

  const marks = await table.locator("tbody tr").evaluateAll((rows) => rows.map((row) => {
    const cell = row.querySelector("td");
    return { rank: Number(cell.textContent), mark: cell.querySelector("[data-top-rank]")?.dataset.topRank ?? null, height: row.getBoundingClientRect().height };
  }));
  for (const row of marks)
    expect(row.mark).toBe(row.rank >= 1 && row.rank <= 3 ? String(row.rank) : null);
  const fourth = marks.find((row) => row.rank === 4);
  if (fourth) for (const row of marks.filter((row) => row.rank <= 3))
    expect(row.height, "표식이 행 높이를 늘리지 않음").toBeLessThanOrEqual(fourth.height);
  // 수집품·원정대·길드 목은 3행만 있다. 아래 별도 검사에서 같은 4위 행을 덧붙여 비교한다.
  await expectTextFits(podium);
  await expectCascade(page);
}

async function expectEffects(page, reduced = false) {
  const podium = podiumOf(page);
  const effects = await podium.evaluate((root) => document.getAnimations()
    .filter((animation) => animation.effect?.target instanceof Element && root.contains(animation.effect.target))
    .map((animation) => ({
      rank: Number(animation.effect.target.closest("[data-podium-place]").dataset.podiumPlace),
      pseudo: animation.effect.pseudoElement ?? null,
      // CSS 모듈이 이름 앞뒤에 파일 이름·해시를 붙인다.
      name: /podium-[a-z]+/.exec(animation.animationName)?.[0] ?? animation.animationName,
      target: animation.effect.pseudoElement === "::after" ? "shine" : animation.effect.target.closest("[data-podium-digit]") ? "digit" : "other",
      duration: animation.effect.getTiming().duration,
      iterations: animation.effect.getTiming().iterations,
      props: [...new Set(animation.effect.getKeyframes().flatMap((frame) => Object.keys(frame)
        .filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key))))],
    })));
  const shine = await podium.locator('[data-podium-place="1"]').evaluate((el) => getComputedStyle(el, "::after").backgroundImage);
  expect(shine, "1위 테두리 빛").toContain("conic-gradient(");
  if (reduced) {
    expect(effects, "줄인 동작에서 단상 애니메이션 없음").toEqual([]);
    // 줄인 동작에서도 숫자 창은 제자리 값을 보이고, 테두리 빛은 정지한 호로 남는다.
    expect(shine).toContain("200deg");
    return;
  }
  // 반복하는 애니메이션은 없다(성능): 1위 테두리 빛 한 번, 숫자 창마다 한 번.
  expect(effects.filter((effect) => effect.target === "shine")).toEqual([
    // 키프레임 목록에 사용자 속성(--shine)은 나오지 않는다: 애니메이션 이름으로 확인한다.
    { rank: 1, pseudo: "::after", name: "podium-shine", target: "shine", duration: 2400, iterations: 1, props: [] },
  ]);
  const digits = effects.filter((effect) => effect.target === "digit");
  expect(digits.length).toBeGreaterThanOrEqual(3);
  expect(effects.filter((effect) => effect.target === "other")).toEqual([]);
  for (const effect of digits) {
    expect(effect.props).toEqual(["transform"]);
    expect(effect.name).toBe("podium-roll");
    expect(effect.duration).toBe(1100);
    expect(effect.iterations).toBe(1);
  }
  // 위 덮개 빛이 초상화 위에 있어도 눌림은 초상화 칸을 가로채지 않는다.
  for (const image of await podium.locator("img[data-podium-image]").all()) {
    await image.scrollIntoViewIfNeeded();
    expect(await image.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
    })).toBe(true);
  }
}

// 430: 큰 휴대폰 폭. 카드 여백 때문에 480 이하는 좁은 배치(글자 12px, 값 두 줄 자리)를 쓴다.
for (const item of LISTS) for (const width of [320, 360, 430, 1280]) for (const theme of ["light", "dark"]) {
  const smoke = (width === 320 && theme === "light") || (width === 360 && theme === "dark") ? " @smoke" : "";
  test(`${item.name} 단상 ${width}px ${theme}: 첫 그림·초상화·순위·무대 빛 @regression${smoke}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await themeBeforeLoad(page, theme);
    await watchShifts(page);
    await page.addInitScript(() => {
      window.__podiumFrames = [];
      const sample = () => {
        const el = document.querySelector("[data-rank-podium]");
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width && r.height) window.__podiumFrames.push({ x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, ready: el.dataset.podiumState === "ready" });
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    let releaseRows, releaseImages;
    const rowGate = new Promise((resolve) => { releaseRows = resolve; });
    const imageGate = new Promise((resolve) => { releaseImages = resolve; });
    let sourceRows;
    if (!item.server) await page.route((url) => url.pathname === item.api, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      sourceRows = body.envelope.data.rows;
      await rowGate;
      await route.fulfill({ response, json: body });
    });
    await page.route("https://cdn-lostark.game.onstove.com/armory/**", async (route) => {
      await imageGate;
      await route.fallback();
    });
    try {
      const response = await page.goto(item.path, { waitUntil: "domcontentloaded" });
      // 클라이언트 조회도 첫 HTML부터 같은 시상대 상자가 있어야 한다.
      expect(await response.text()).toMatch(/<section[^>]*data-rank-podium=""/);
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme ?? "light")).toBe(theme);
      const podium = podiumOf(page);
      await expect(podium).toHaveCount(1);
      await page.evaluate(() => document.fonts.ready);
      await frames(page);
      if (!item.server) {
        await expect(podium).toHaveAttribute("data-podium-state", "loading");
        await expect(podium).toHaveAttribute("aria-busy", "true");
        await expect(podium.locator("[data-podium-place]")).toHaveCount(0);
        await expect.poll(() => sourceRows?.length ?? 0).toBeGreaterThanOrEqual(3);
      } else {
        const api = `${item.api}?${new URL(item.path, "http://local").searchParams}`;
        sourceRows = (await (await page.request.get(api)).json()).envelope.data.rows;
      }
      releaseRows();
      await expect(podium).toHaveAttribute("data-podium-state", "ready");
      const boxes = podium.locator("[data-portrait-box]");
      await expect(boxes).toHaveCount(3);
      const before = await sizeOf(boxes);
      if (!item.guild) {
        await expect(podium.locator("img[data-podium-image]").first()).toHaveJSProperty("complete", false);
      }
      releaseImages();
      for (const image of await podium.locator("img[data-podium-image]").all()) {
        await image.scrollIntoViewIfNeeded();
        await expect(image).toHaveJSProperty("complete", true);
        expect(await image.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
      }
      expect(await sizeOf(boxes), "이미지 로딩 전후 같은 크기").toEqual(before);
      await expectPlaces(page, item, sourceRows);
      await expectValueUnderName(podium);
      await frames(page);
      const shift = await shiftsSince(page);
      expect(shift.all, `첫 그림 흔들림 (${shift.moved})`).toBe(0);
      const samples = await page.evaluate(() => window.__podiumFrames);
      expect(samples.length).toBeGreaterThan(1);
      if (!item.server) expect(samples.some((sample) => !sample.ready)).toBe(true);
      expect(samples.some((sample) => sample.ready)).toBe(true);
      for (const key of ["x", "y", "width", "height"])
        expect(Math.max(...samples.map((sample) => Math.abs(sample[key] - samples[0][key]))), `단상 ${key} 고정`).toBe(0);
      if (width === 320) await expectNoHorizontalOverflow(page);
      await expectEffects(page);
    } finally {
      releaseRows();
      releaseImages();
    }
  });
}

// 서버 HTML이 흘러 들어오는 동안 브라우저는 반쯤 읽은 카드를 그릴 수 있다(CI 360, 젬 효율:
// 순위 칩이 아직 없을 때 그린 1위 열이 칩이 오자 30px 올라갔다). 뒤쪽 요소가 아직 없을 때와
// 다 왔을 때 앞쪽 요소의 자리가 같아야 한다. 카드의 뒤쪽 자식, 뒤쪽 카드를 빼서 확인한다.
for (const width of [320, 360, 430, 1280]) {
  test(`${width}px: 반쯤 읽은 카드·목록도 앞쪽 자리가 그대로다(스트리밍 중 그림) @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/rankings?type=gems");
    const podium = podiumOf(page);
    await expect(podium).toHaveAttribute("data-podium-state", "ready");
    const moved = await podium.evaluate((root) => {
      const box = (el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`; };
      const failures = [];
      const list = root.querySelector("ol");
      const places = [...list.children];
      for (const place of places) {
        const kids = [...place.children];
        const before = kids.map(box);
        for (let cut = kids.length - 1; cut >= 1; cut--) {
          kids.slice(cut).forEach((kid) => kid.remove());
          kids.slice(0, cut).forEach((kid, i) => {
            const now = box(kid);
            if (now !== before[i]) failures.push(`${place.dataset.podiumPlace}위 ${kid.tagName.toLowerCase()}${kid.getAttribute("class") ? "." + kid.getAttribute("class").split("_")[1] : ""}: ${before[i]} → ${now} (뒤 ${kids.length - cut}개 없음)`);
          });
          place.append(...kids.slice(cut));
        }
      }
      const before = places.map(box);
      for (let cut = places.length - 1; cut >= 1; cut--) {
        places.slice(cut).forEach((place) => place.remove());
        places.slice(0, cut).forEach((place, i) => {
          if (box(place) !== before[i]) failures.push(`${place.dataset.podiumPlace}위 카드: ${before[i]} → ${box(place)}`);
        });
        list.append(...places.slice(cut));
      }
      return failures;
    });
    expect(moved, "뒤쪽이 늦게 와도 앞쪽은 움직이지 않음").toEqual([]);
  });
}

for (const item of LISTS) for (const theme of ["light", "dim", "dark"]) {
  test(`${item.name} ${theme}: 줄인 동작에서 정적인 무대 빛 @regression`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await themeBeforeLoad(page, theme);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoReady(page, item.path);
    await expect(podiumOf(page)).toHaveAttribute("data-podium-state", "ready");
    await expectEffects(page, true);
    await expectTextFits(podiumOf(page));
    await expectCascade(page);
    await expectNoHorizontalOverflow(page);
  });
}

test("단상: 2쪽은 없음, 순위 있는 줄만(짧은 목록은 있는 만큼), 순위 없는 목은 빈 칸 @regression", async ({ page }) => {
  for (const item of LISTS) {
    await gotoReady(page, `${item.path}${item.path.includes("?") ? "&" : "?"}page=2`);
    await expect(podiumOf(page)).toHaveCount(0);
  }
  // 두 순위와 '-'만 있는 기본 길드 목: 순위 있는 두 줄만 단상에(QA v0.3.8: 있는 만큼 보임).
  await gotoReady(page, "/rankings?type=guilds");
  await expect(podiumOf(page)).toHaveAttribute("data-podium-state", "ready");
  await expect(podiumOf(page).locator("[data-podium-place]")).toHaveCount(2);
  for (const path of [
    "/rankings?type=collectibles&unit=CHARACTER",
    `/rankings?type=guilds&server=${encodeURIComponent("아만")}`,
    `/rankings?className=${encodeURIComponent("환수사")}`,
  ]) {
    await gotoReady(page, path);
    // 카드 수는 표의 순위 있는 줄 수(최대 3). 없으면 카드가 없다: 불러오는 동안 잡아 둔 칸은
    // 보이지 않게 남고(흔들림 없음), 첫 그림부터 없다고 알면 칸도 없다.
    const ranked = await page.getByRole("table").first().locator("tbody tr").evaluateAll((rows) =>
      rows.filter((row) => /^\d+$/.test(row.querySelector("td")?.textContent?.trim() ?? "")).length);
    const podium = podiumOf(page);
    await expect(page.locator("[data-podium-place]")).toHaveCount(Math.min(3, ranked));
    if (!ranked && (await podium.count())) {
      await expect(podium).toHaveAttribute("data-podium-state", "empty");
      await expect(podium).toHaveAttribute("aria-hidden", "true");
    }
    for (const row of await page.getByRole("table").locator("tbody tr").all()) {
      if ((await row.locator("td").first().innerText()).trim() === "-")
        await expect(row.locator("[data-top-rank]")).toHaveCount(0);
    }
  }
});

for (const item of LISTS.filter((item) => !item.server)) {
  test(`${item.name}: 짧은 목에 같은 4위 행을 넣어 표식 높이 비교 @regression`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.route((url) => url.pathname === item.api, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.envelope.data.rows = json.envelope.data.rows.slice(0, 3);
      const fourth = { ...json.envelope.data.rows[0], rank: 4, characterName: "높이비교캐릭터", guildName: "높이비교길드" };
      json.envelope.data.rows.push(fourth);
      await route.fulfill({ response, json });
    });
    await gotoReady(page, item.path);
    const table = page.getByRole("table").first();
    const heights = await table.locator("tbody tr").evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
    expect(heights).toHaveLength(4);
    for (const height of heights.slice(0, 3)) expect(height).toBeLessThanOrEqual(heights[3]);
    await expect(table.locator("tbody tr").nth(3).locator("[data-top-rank]")).toHaveCount(0);
  });
}

for (const width of [320, 360, 430, 1280]) {
  test(`${width}px: 긴 이름·큰 숫자·구형 응답의 초상화 없음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route((url) => url.pathname === "/api/rankings", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      // The game's name limit is 12 characters (Korean, Latin, numbers).
      const names = ["가".repeat(12), "W".repeat(12), "긴캐릭터이름긴캐릭터이름"];
      json.envelope.data.rows.slice(0, 3).forEach((row, index) => {
        row.characterName = names[index];
        row.combatPower = 99_999_999.88;
        // imageUrl이 아예 없는 예전 응답도 클래스 아이콘을 같은 자리에 그린다.
        delete row.imageUrl;
      });
      await route.fulfill({ response, json });
    });
    await gotoReady(page, "/rankings");
    const podium = podiumOf(page);
    await expect(podium).toHaveAttribute("data-podium-state", "ready");
    await expect(podium.locator('[data-portrait-fallback="class"]')).toHaveCount(3);
    await expectTextFits(podium);
    await expectValueUnderName(podium);
    await expectNoHorizontalOverflow(page);
  });
}

for (const width of [320, 1280]) {
  test(`${width}px: 길드 쪽 자동 보정 전후에도 예약한 자리가 같다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    let releaseFirst, releaseCorrected;
    const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
    const correctedGate = new Promise((resolve) => { releaseCorrected = resolve; });
    let correcting = false;
    await page.route((url) => url.pathname === "/api/rankings/guilds", async (route) => {
      if (new URL(route.request().url()).searchParams.get("page") === "3") await firstGate;
      else {
        correcting = true;
        await correctedGate;
      }
      await route.fallback();
    });
    try {
      // '길드'는 세 길드 모두와 일치한다. 3쪽은 비어 있고 1쪽에는 순위 1·2·3이 있다.
      await page.goto(`/rankings?type=guilds&sort=CP_SUM&guild=${encodeURIComponent("길드")}&page=3`, { waitUntil: "domcontentloaded" });
      const podium = podiumOf(page);
      await expect(podium).toHaveAttribute("data-podium-state", "loading");
      const before = await podium.boundingBox();
      await page.evaluate(() => document.fonts.ready);
      await frames(page);
      releaseFirst();
      await expect.poll(() => correcting).toBe(true);
      await expect(podium).toHaveAttribute("data-podium-state", "loading");
      expect(await podium.boundingBox()).toEqual(before);
      releaseCorrected();
      await expect(podium).toHaveAttribute("data-podium-state", "ready");
      await expect(page).not.toHaveURL(/page=3/);
      expect(await podium.boundingBox()).toEqual(before);
      await frames(page);
      const shift = await shiftsSince(page);
      expect(shift.all, `쪽 보정 흔들림 (${shift.moved})`).toBe(0);
    } finally {
      releaseFirst();
      releaseCorrected();
    }
  });
}

for (const item of LISTS.filter((item) => !item.server)) {
  test(`${item.name}: 늦게 도착한 두 행은 잡아 둔 칸 안에 그리고 칸 크기는 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await watchShifts(page);
    let releaseRows;
    const gate = new Promise((resolve) => { releaseRows = resolve; });
    let requested = false;
    await page.route((url) => url.pathname === item.api, async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.envelope.data.rows = json.envelope.data.rows.slice(0, 2);
      requested = true;
      await gate;
      await route.fulfill({ response, json });
    });
    try {
      await page.goto(item.path, { waitUntil: "domcontentloaded" });
      const podium = podiumOf(page);
      await expect(podium).toHaveAttribute("data-podium-state", "loading");
      const before = await podium.boundingBox();
      await expect.poll(() => requested).toBe(true);
      await page.evaluate(() => document.fonts.ready);
      await frames(page);
      releaseRows();
      // 순위 있는 두 줄은 카드 둘로(있는 만큼), 없으면 빈 칸 그대로. 어느 쪽이든 칸은 같은 크기.
      await expect(podium).not.toHaveAttribute("data-podium-state", "loading");
      const cards = await podium.locator("[data-podium-place]").count();
      if (cards) {
        await expect(podium).toHaveAttribute("data-podium-state", "ready");
        expect(cards).toBeLessThanOrEqual(2);
      } else {
        await expect(podium).toHaveAttribute("data-podium-state", "empty");
        await expect(podium).toHaveAttribute("aria-hidden", "true");
      }
      expect(await podium.boundingBox()).toEqual(before);
      await frames(page);
      const shift = await shiftsSince(page);
      expect(shift.all, `짧은 목록 흔들림 (${shift.moved})`).toBe(0);
    } finally {
      releaseRows();
    }
  });
}
