// 회귀(M33 시세 알림): 알림 켜기 → 조건 추가·지우기 → 다시 열어도 그대로 → 끄기. 로그인 없이 이 브라우저에만
// 관리 토큰을 두고, 켜고 끄고 더하고 지워도 흔들림 0. 브라우저 푸시 서비스는 부르지 않는다(구독 함수를 가짜로).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, shiftsSince, watchShifts } from "../support/shifts.mjs";

/** PushManager without a real push service: one fake subscription per page, keyed to the key it was made with. */
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

for (const width of [1280, 360])
  test(`@M33 ${width} 켜기·추가·지우기·끄기, 흔들림 0 @regression`, async ({ page, context }) => {
    await context.grantPermissions(["notifications"]);
    await page.setViewportSize({ width, height: 900 });
    await fakePush(page, `https://fcm.googleapis.com/fcm/send/e2e-${width}-${Date.now()}`);
    await watchShifts(page);
    await gotoReady(page, "/market/alerts");
    await expect(page.getByRole("heading", { name: "시세 알림", level: 1 })).toBeVisible();
    await expect(page.getByText("알림을 켜면 건 알림이 여기에 보여요.")).toBeVisible();
    const load = await shiftsSince(page);
    expect(load.all, `첫 로드 흔들림 (${load.moved})`).toBe(0);

    const on = await shiftsDuring(page, () => page.getByRole("button", { name: "이 브라우저에서 알림 켜기" }).click(), 2000);
    await expect(page.getByText("이 브라우저로 알림을 받고 있어요.")).toBeVisible();
    await expect(page.getByText("아직 건 알림이 없어요.", { exact: false })).toBeVisible();
    expect(on.all, `켜기 흔들림 (${on.moved})`).toBe(0);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("loakraken.priceAlerts") ?? "null"));
    expect(stored?.subscriptionId).toMatch(/^[0-9a-f-]{36}$/);

    const add = page.getByRole("region", { name: "알림 추가" });
    await expect(add.getByText("지금 판매 최저가 95G")).toBeVisible();
    await add.getByLabel("기준 가격(골드)").fill("90");
    const first = await shiftsDuring(page, () => add.getByRole("button", { name: "알림 추가" }).click(), 1500);
    const list = page.getByRole("region", { name: /^내 알림/ });
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(list.getByRole("listitem").first()).toContainText("아비도스 융화 재료");
    await expect(list.getByRole("listitem").first()).toContainText("90G 이하");
    await expect(list.getByRole("listitem").first()).toContainText("기다리는 중");
    expect(first.all, `추가 흔들림 (${first.moved})`).toBe(0);

    await add.getByRole("radio", { name: "이상이 되면" }).click();
    await add.getByLabel("기준 가격(골드)").fill("90");
    await add.getByRole("button", { name: "알림 추가" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(list.getByRole("listitem").nth(1)).toContainText("90G 이상");
    await expect(list.getByRole("listitem").nth(1)).toContainText("지금 맞음");
    await expect(list.getByRole("heading", { name: /2 \/ 10/ })).toBeVisible();

    // Opened again: the token in this browser brings the same alerts back.
    await page.reload();
    await expect(page.getByText("이 브라우저로 알림을 받고 있어요.")).toBeVisible();
    await expect(list.getByRole("listitem")).toHaveCount(2);

    const remove = await shiftsDuring(
      page,
      () => list.getByRole("button", { name: "아비도스 융화 재료 90G 이하 알림 지우기" }).click(),
      1500,
    );
    await expect(list.getByRole("listitem")).toHaveCount(1);
    expect(remove.all, `지우기 흔들림 (${remove.moved})`).toBe(0);

    const off = await shiftsDuring(page, () => page.getByRole("button", { name: "알림 끄기" }).click(), 1500);
    await expect(page.getByText("알림을 껐어요. 구독과 알림 조건을 모두 지웠어요.")).toBeVisible();
    await expect(page.getByRole("button", { name: "이 브라우저에서 알림 켜기" })).toBeVisible();
    await expect(page.getByText("알림을 켜면 건 알림이 여기에 보여요.")).toBeVisible();
    expect(off.all, `끄기 흔들림 (${off.moved})`).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem("loakraken.priceAlerts"))).toBeNull();
    await expectNoHorizontalOverflow(page);
  });

test("@M33 권한을 거절하면 켜지 않고 이유를 알린다 @regression", async ({ page }) => {
  await fakePush(page, "https://fcm.googleapis.com/fcm/send/e2e-denied");
  await page.addInitScript(() => {
    Notification.requestPermission = async () => "denied";
  });
  await gotoReady(page, "/market/alerts");
  await page.getByRole("button", { name: "이 브라우저에서 알림 켜기" }).click();
  await expect(page.getByText("알림 권한이 꺼져 있어요. 사이트 설정에서 알림을 허용해 주세요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "이 브라우저에서 알림 켜기" })).toBeEnabled();
});

test("@M33 푸시 서비스가 확인 알림을 받지 않으면 저장하지 않는다 @regression", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await fakePush(page, "https://fcm.googleapis.com/fcm/send/e2e-undelivered");
  await gotoReady(page, "/market/alerts");
  await page.getByRole("button", { name: "이 브라우저에서 알림 켜기" }).click();
  await expect(page.getByText("확인 알림을 보내지 못했어요. 알림 권한을 확인하고 다시 켜 주세요.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("loakraken.priceAlerts"))).toBeNull();
});

test("@M33 만료된 구독은 지우고 다시 켜라고 알린다 @regression", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "loakraken.priceAlerts",
      JSON.stringify({ subscriptionId: "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b", token: "q9Vd2kX4mN7pR1sT5uW8yZ0aB3cE6fH9jL2nP5rS8tU" }),
    ),
  );
  await gotoReady(page, "/market/alerts");
  await expect(page.getByText("알림 구독이 만료됐어요. 알림을 다시 켜 주세요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "이 브라우저에서 알림 켜기" })).toBeVisible();
});

test("@M33 관리 토큰 없이는 조건을 읽거나 바꿀 수 없고, 다른 사이트에서 바꿀 수 없다 @regression", async ({ request }) => {
  const id = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
  const read = await request.get(`/api/alerts/subscriptions/${id}/conditions`);
  expect(read.status()).toBe(400);
  const cross = await request.post("/api/alerts/subscriptions", {
    headers: { Origin: "https://example.com", "Sec-Fetch-Site": "cross-site" },
    data: { endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: { p256dh: "a", auth: "b" } },
  });
  expect(cross.status()).toBe(403);
  const items = await request.get("/api/alerts/items");
  expect(items.status()).toBe(200);
  expect((await items.json()).envelope.data.length).toBeGreaterThan(0);
});
