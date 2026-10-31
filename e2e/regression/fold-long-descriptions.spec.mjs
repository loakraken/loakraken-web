// 회귀(#1112): 긴 화면 설명은 한 줄만 남기고 나머지는 '자세히'로 접는다(지우지 않음).
// 숙제·수집품 랭킹·시세 알림, 그리고 아비도스 제작·생활의 기운·상점 효율·재련 계획·경매 입찰·길드·원정대 랭킹(지인 피드백 #20):
// 한 줄은 보이고, 접힌 글은 닫혀 있다가 Enter로 열린다.
// '자세히'는 누르는 칸 44px, 같은 이름. 잘림 0, 가로 넘침 0(320/360/390/1280).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

/** PushManager without a real push service (as in price-alerts.spec.mjs). */
async function fakePush(page, endpoint) {
  await page.addInitScript((url) => {
    let made = null;
    PushManager.prototype.getSubscription = async () => made;
    PushManager.prototype.subscribe = async (options) => {
      const key = new Uint8Array(options.applicationServerKey).buffer;
      made = {
        endpoint: url,
        options: { applicationServerKey: key, userVisibleOnly: true },
        toJSON: () => ({ endpoint: url, expirationTime: null, keys: { p256dh: "BPkFakeKey", auth: "fakeAuth" } }),
        unsubscribe: async () => {
          made = null;
          return true;
        },
      };
      return made;
    };
  }, endpoint);
}

const PAGES = [
  {
    name: "숙제",
    open: (page) => gotoReady(page, "/tools/homework"),
    lead: "진행 상황은 이 브라우저에만 저장되고, 매주 수요일 06:00에 체크가 풀려요.",
    folded: /무료 더보기를 쓴 관문은/,
  },
  {
    name: "수집품 랭킹",
    open: (page) => gotoReady(page, "/rankings?type=collectibles"),
    lead: "진행도는 공식 수집품의 모은 점수 합 ÷ 최대 점수 합이에요.",
    folded: /같은 원정대 캐릭터는 같은 값/,
  },
  {
    name: "시세 알림",
    open: async (page, width) => {
      await page.context().grantPermissions(["notifications"]);
      await fakePush(page, `https://fcm.googleapis.com/fcm/send/e2e-fold-${width}-${Date.now()}`);
      await gotoReady(page, "/market/alerts");
      await page.getByRole("button", { name: "이 브라우저에서 알림 켜기" }).click();
      await expect(page.getByText("이 브라우저로 알림을 받고 있어요.")).toBeVisible();
    },
    // Alerts fire at or below and at or above: 'reaches', not 'goes over'.
    lead: "가격이 정한 기준에 닿는 순간 한 번 알려요.",
    folded: /6시간 안에 다시 보내지 않아요/,
  },
  // The rest of the screens (feedback #20, v0.3.4): calc basis and counting rules folded.
  {
    name: "아비도스 제작",
    open: (page) => gotoReady(page, "/tools/abidos-craft"),
    lead: "1회 제작에 결과물 10개, 대성공이면 20개가 나와요.",
    folded: /대성공 확률은 기본 5%/,
  },
  {
    name: "생활의 기운",
    open: (page) => gotoReady(page, "/tools/life-energy"),
    lead:
      "생활 스킬마다 생명의 기운 1만당 캐는 평균 수량으로 재료를 정하고(등급마다 내림), 재료를 그대로 팔 때와 캔 재료만으로 아비도스·상급 아비도스 융화 재료를 최대한 만들 때 중 더 많이 버는 쪽을 보여 줘요.",
    folded: /상인으로만 채우고/,
  },
  {
    name: "상점 효율",
    open: (page) => gotoReady(page, "/tools/loa-shop"),
    lead: "구성품 가치 = 수량 × 거래소 1개 가격(묶음 가격 ÷ 묶음 수).",
    folded: /귀속 구성품도/,
  },
  {
    name: "재련 계획",
    open: (page) => gotoReady(page, "/tools/refining"),
    lead: "책은 기본으로 넣고, 책 효과가 매번 적용된다고 보고 계산해요.",
    folded: /그 확률은 공개되지 않았어요/,
  },
  {
    name: "경매 입찰",
    open: (page) => gotoReady(page, "/tools/auction"),
    lead: "경매에 쓴 골드는 낙찰자 몫 없이 나머지 인원에게 고르게 돌아가요.",
    folded: /10만 골드를 넘는 낙찰액/,
  },
  {
    name: "길드 랭킹",
    open: (page) => gotoReady(page, "/rankings?type=guilds"),
    lead: "확인한 길드원은 LOAKraken이 최근 확인한 공개 캐릭터 수로, 실제 길드 인원이 아니에요.",
    folded: /이상 길드원만 세요/,
  },
  {
    name: "원정대 랭킹",
    open: (page) => gotoReady(page, "/rankings?type=roster"),
    lead: "원정대는 서버를 고르면 그 서버, 고르지 않으면 대표 캐릭터의 서버 캐릭터만 세요(인원·전체 평균도 그 서버 기준이에요).",
    folded: /6명보다 적어도 6으로 나눠요/,
  },
];

for (const { name, open, lead, folded } of PAGES)
  for (const width of [320, 360, 390, 1280])
    test(`${name} ${width}: 한 줄만 보이고 나머지는 '자세히' @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, width);
      const line = page.getByText(lead, { exact: true });
      await expect(line).toBeVisible();
      const more = page.locator("details", { has: page.locator("summary", { hasText: /^자세히$/ }) }).filter({ hasText: folded });
      await expect(more).toHaveCount(1);
      await expect(more).not.toHaveAttribute("open", "");
      await expect(more.getByText(folded)).toBeHidden();
      const summary = more.locator("summary");
      expect((await summary.boundingBox()).height, "'자세히' 누르는 칸").toBeGreaterThanOrEqual(44);
      // Keyboard: Enter on the focused summary opens it.
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(more.getByText(folded)).toBeVisible();
      const cut = await line.or(more).evaluateAll((els) =>
        els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent.trim().slice(0, 30)),
      );
      expect(cut, "잘림").toEqual([]);
      await expectNoHorizontalOverflow(page);
    });
