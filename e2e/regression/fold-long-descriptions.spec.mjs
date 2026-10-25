// 회귀(#1112): 긴 화면 설명은 한 줄만 남기고 나머지는 '자세히'로 접는다(지우지 않음).
// 숙제·수집품 랭킹·시세 알림: 한 줄은 보이고, 접힌 글은 닫혀 있다가 Enter로 열린다.
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
