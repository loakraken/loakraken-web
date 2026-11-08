// 회귀(코덱스 QA 11-04 P2): 공식 초상화를 못 불러오면 시상대는 같은 칸에 직업 아이콘을 보인다.
// 서버에서 그린 효율 랭킹(팔찌·젬)은 하이드레이션 전에 이미지가 실패하면 onError가 없어 깨진
// 이미지 칸이 남았다. 캐릭터 랭킹(브라우저에서 그림)과 같아야 한다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const LISTS = [
  { name: "젬 효율", path: "/rankings?type=gems" },
  { name: "팔찌 효율", path: "/rankings?type=bracelets" },
  { name: "캐릭터", path: "/rankings" },
];

for (const list of LISTS)
  test(`${list.name}: 초상화 404면 깨진 이미지 대신 직업 아이콘 @regression`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // Every official portrait fails (the fixtures' 1×1 stand-in is replaced by a 404).
    await page.route(/^https:\/\/cdn-lostark\.game\.onstove\.com\//, (route) => route.fulfill({ status: 404, body: "" }));
    await gotoReady(page, list.path);
    const podium = page.locator("[data-rank-podium]");
    await expect(podium).toHaveAttribute("data-podium-state", "ready");
    const boxes = podium.locator("[data-portrait-box]");
    await expect(boxes).toHaveCount(3);
    // No slot is left with a broken image: each shows a loaded image or the fallback.
    await expect.poll(() => boxes.evaluateAll((els) => els.map((box) => {
      const img = box.querySelector("img[data-podium-image]");
      if (img) return img.complete && img.naturalWidth > 0 ? "image" : "broken";
      return box.querySelector("[data-portrait-fallback]") ? "fallback" : "empty";
    })), { message: "깨진 이미지 칸 없음" }).toEqual(["fallback", "fallback", "fallback"]);
  });
