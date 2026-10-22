// 로아샵 효율(/tools/loa-shop, 체크리스트 L45). 패키지 구성·판매가·판매 기간은 공식 상점 공지,
// 블루 크리스탈 100개 = 로열 크리스탈 2,750은 공식 상점. 재료 시세는 목 서버 합성 시세라
// 값 자체가 아니라 계산 관계와 표시 규칙(미확인, 교환소 시세가 없으면 이득 없음)을 본다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const RATE = /게임 안 크리스탈 교환소 시세\(블루 크리스탈 100개당 골드\)/;

test.describe("로아샵 효율 @smoke", () => {
  // The checks below read packages that were on sale until 10-21 (한가위): the
  // browser clock is set inside that sale, so they do not fold away as the real
  // date moves on. The past-items test sets its own date after the sale.
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-14T12:00:00+09:00"));
  });

  test("교환소 시세가 없으면 골드 가치와 판매가만, 기준일·판매 기간·구매 보너스 문구는 공지 그대로", async ({ page }) => {
    await gotoReady(page, "/tools/loa-shop");
    await expect(page.getByRole("heading", { level: 1, name: "로아샵 효율" })).toBeVisible();
    await expect(page.getByText(/공식 상점 공지 기준 · 확인 2026-10-22/)).toBeVisible();
    const growth = page.getByRole("region", { name: "[3+1] 월간 운명의 성장 패키지+" });
    await expect(growth.getByText("3회 구매 + 보너스 = 4세트 기준 (1회 33,000)")).toBeVisible();
    await expect(growth.getByText("본 상품 3회 구매 시, 동일한 구성품의 보너스 상품을 추가 지급합니다.")).toBeVisible();
    await expect(growth.getByText("2026년 8월 19일(수) 정기 점검 후 ~ 별도 안내 시")).toBeVisible();
    await expect(page.getByRole("textbox", { name: RATE })).toHaveValue("");
    await expect(page.getByText(/로열 크리스탈로 환산한 가치/)).toHaveCount(0);
    // A23(#864): with no rate each card shows its break-even rate and how to get the gain.
    await expect(page.getByText(/교환소 시세를 넣으면 이득을 계산해요\.$/).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("시세가 없는 구성품은 0이 아니라 미확인이고, 그 패키지는 이득을 계산하지 않는다", async ({ page }) => {
    await gotoReady(page, "/tools/loa-shop");
    await page.getByRole("textbox", { name: RATE }).fill("27300");
    const growth = page.getByRole("region", { name: "[3+1] 월간 운명의 성장 패키지+" });
    // 목 서버에서 용암의 숨결은 시세가 없다.
    await expect(growth.getByRole("row", { name: /^용암의 숨결/ })).toContainText("미확인");
    await expect(growth.getByText("확인된 구성품 합계")).toBeVisible();
    await expect(growth.getByText("미확인 구성품이 있어 이득을 계산하지 않았어요.")).toBeVisible();
  });

  test("교환소 시세를 넣으면 공식 크리스탈 경로로 이득을 내고, 이 브라우저에만 남는다", async ({ page }) => {
    const sent = [];
    page.on("request", (request) => sent.push(`${request.url()} ${request.postData() ?? ""}`));
    await gotoReady(page, "/tools/loa-shop");
    await page.getByRole("textbox", { name: RATE }).fill("27300");
    const pass = page.getByRole("region", { name: "[한정] 아이템 레벨 1,700 달성" });
    // 2,600 크리스탈 × 273G = 709,800G → × 2,750 ÷ 27,300 = 71,500 로열 크리스탈, 판매가 55,000.
    await expect(pass.getByText("로열 크리스탈로 환산한 가치 71,500")).toBeVisible();
    await expect(pass.getByText(/\+16,500/)).toBeVisible();
    await expect(pass.getByText("같은 로열 크리스탈로 공식 상점에서 크리스탈을 사면 2,000개, 이 상품은 2,600개예요.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: RATE })).toHaveValue("27300");
    expect(sent.filter((line) => line.includes("27300")), "입력한 시세를 서버로 보내지 않는다").toEqual([]);
  });

  // PM 총괄 판정(비교 기준 방식): 거래 불가 품목(백엔드 UNTRADEABLE)은 골드 합계에서 빼고 이득은 계산한다.
  // 합계 제목은 '거래 가능한 구성품 가치', 줄에 '거래 불가 n개 제외'를 글로 적는다. 시세가 없는 거래 가능
  // 품목은 지금처럼 미확인이고 이득을 막는다(목 서버: 생명의 기운 회복물약 2종은 UNTRADEABLE).
  test("거래 불가 구성품은 합계에서 빼고 '거래 불가 n개 제외'로 적으며, 이득은 계산한다", async ({ page }) => {
    await gotoReady(page, "/tools/loa-shop");
    const life = page.getByRole("region", { name: "[주간] 한가위 미니 생활 패키지" });
    await expect(life.getByRole("row", { name: /^고급 생명의 기운 회복물약/ })).toContainText("거래 불가");
    await expect(life.getByRole("rowheader", { name: /거래 가능한 구성품 가치/ })).toContainText("거래 불가 2개 제외");
    await expect(life.getByText("미확인", { exact: true })).toHaveCount(0);
    await page.getByRole("textbox", { name: RATE }).fill("27300");
    await expect(life.getByText(/로열 크리스탈로 환산한 가치/)).toBeVisible();
    // 시세가 없는 거래 가능 품목(용암의 숨결)은 그대로 미확인이고 이득을 계산하지 않는다.
    const growth = page.getByRole("region", { name: "[3+1] 월간 운명의 성장 패키지+" });
    await expect(growth.getByRole("rowheader", { name: /확인된 구성품 합계/ })).toBeVisible();
    await expect(growth.getByText(/로열 크리스탈로 환산한 가치/)).toHaveCount(0);
  });

  // PM 총괄 판정(#831): 판매가 끝난 패키지는 목록에서 빼고 아래 '지난 상품 n개' 접기(기본 접힘)에 둔다.
  // 종료 시각은 공지 기준 KST(정기 점검 전 = 수요일 06:00). 접기 제목은 누름 영역 44px이고, 펼쳐도
  // 위 내용은 움직이지 않는다. 브라우저 시계만 10월 22일로 옮겨 본다.
  test("판매가 끝난 패키지는 '지난 상품' 접기에 모이고, 펼쳐도 위가 움직이지 않는다", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-22T12:00:00+09:00"));
    await gotoReady(page, "/tools/loa-shop");
    const past = page.locator("details", { hasText: "지난 상품" });
    const summary = past.locator("summary");
    await expect(summary).toHaveText("지난 상품 4개");
    await expect(past).not.toHaveAttribute("open", "");
    await expect(page.getByRole("region", { name: "[3+1] 월간 운명의 성장 패키지+" })).toBeVisible();
    await expect(page.getByRole("region", { name: "한가위 미니 전투 지원 패키지" })).toBeHidden();

    // 44px on phones and touch screens (hit-44; a mouse keeps the drawn size): the four points
    // 21px from the centre all land on the summary.
    await summary.scrollIntoViewIfNeeded();
    const misses = await summary.evaluate((node) => {
      if (!matchMedia("(max-width: 699px), (pointer: coarse)").matches) return 0;
      const b = node.getBoundingClientRect();
      const [cx, cy] = [b.left + b.width / 2, b.top + b.height / 2];
      return [[cx, cy - 21], [cx, cy + 21], [cx - 21, cy], [cx + 21, cy]].filter(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return !(hit === node || node.contains(hit));
      }).length;
    });
    expect(misses).toBe(0);

    const y = async () => (await summary.boundingBox()).y;
    const before = await y();
    await summary.click();
    await expect(past).toHaveAttribute("open", "");
    await expect(page.getByRole("region", { name: "한가위 미니 전투 지원 패키지" })).toBeVisible();
    await expect(page.getByRole("region", { name: "한가위 미니 전투 지원 패키지" })).toContainText("판매 기간이 지났어요");
    expect(Math.abs((await y()) - before)).toBeLessThanOrEqual(1);
  });

  // PM 총괄 판정(P3): 페온은 값을 정하지 않고 거래 불가처럼 합계에서 뺀다. 페온만 든 패키지는 계산하지 않고 안내한다.
  test("페온만 든 패키지는 '페온 1개 제외'와 안내만 보이고 미확인으로 막지 않는다", async ({ page }) => {
    await gotoReady(page, "/tools/loa-shop");
    const peon = page.getByRole("region", { name: "[할인] 한가위 페온 [50개]" });
    await expect(peon.getByRole("row", { name: /^페온/ })).toContainText("제외");
    await expect(peon.getByRole("rowheader", { name: /거래 가능한 구성품 가치/ })).toContainText("페온 1개 제외");
    await expect(peon.getByText("페온만 들어 있어 골드로 매길 구성품이 없어요.")).toBeVisible();
    await expect(peon.getByText("미확인", { exact: true })).toHaveCount(0);
    await page.getByRole("textbox", { name: RATE }).fill("27300");
    await expect(peon.getByText(/로열 크리스탈로 환산한 가치/)).toHaveCount(0);
    await expect(peon.getByText("페온만 들어 있어 골드로 매길 구성품이 없어요.")).toBeVisible();
  });

  // PM 총괄 10-17(A23): 교환소 시세를 넣지 않아도 '시세가 N골드 이하면 이득'을 보여 준다(기본값은 넣지 않음).
  test("교환소 시세가 없으면 손익 분기 시세를 보여 주고, 넣으면 이득을 계산한다", async ({ page }) => {
    await gotoReady(page, "/tools/loa-shop");
    const battle = page.getByRole("region", { name: "한가위 미니 전투 지원 패키지" });
    await expect(battle.getByText(/^게임 안 크리스탈 교환소 시세가 [\d,]+골드 이하면 이득이에요\.$/)).toBeVisible();
    await expect(battle.getByText("블루 크리스탈 100개당 시세예요. 교환소 시세를 넣으면 이득을 계산해요.")).toBeVisible();
    // 크리스탈만으로 판매가를 넘는 패키지
    const level = page.getByRole("region", { name: "[한정] 아이템 레벨 1,700 달성" });
    await expect(level.getByText("교환소 시세와 상관없이 이득이에요.")).toBeVisible();
    await page.getByRole("textbox", { name: RATE }).fill("27300");
    await expect(battle.getByText(/로열 크리스탈로 환산한 가치/)).toBeVisible();
  });
});
