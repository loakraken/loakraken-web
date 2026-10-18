// 회귀(#902, A6): 남은 시간 글자는 첫 HTML(서버 시각)과 하이드레이션 직후가 같아야 한다.
// 브라우저의 분 시계가 05:38:40을 05:38:00으로 읽어 "3시간 21분"이 바로 "3시간 22분"으로 바뀌었고,
// 바뀐 숫자의 폭이 다르면 그 줄이 움직였다(06:00 직전 CI 실패). 분 단위 글자만 비교한다(초 단위는
// 원래 매초 바뀜). 서버가 그린 분과 읽는 분이 다르면(분 경계를 넘김) 다시 연다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const MINUTE_TEXT = /^(\d+일 \d+시간|\d+시간 \d+분)$/;
const minuteOf = (ms) => Math.floor(ms / 60_000);

for (const path of ["/", "/schedule"])
  test(`@A6 ${path} 남은 시간 글자가 첫 HTML과 하이드레이션 직후 같다 @regression`, async ({ page }) => {
    let seen = null;
    for (let attempt = 0; attempt < 3 && !seen; attempt += 1) {
      let html = "";
      let servedAt = 0;
      const onResponse = async (r) => {
        if (r.request().resourceType() !== "document") return;
        servedAt = Date.parse(r.headers().date ?? "");
        html = await r.text().catch(() => "");
      };
      page.on("response", onResponse);
      await gotoReady(page, path);
      await page.waitForTimeout(600);
      page.off("response", onResponse);
      const read = await page.evaluate(() => ({
        now: Date.now(),
        texts: [...document.querySelectorAll("main b")].map((n) => n.textContent.trim()),
      }));
      // Crossed a minute between the server render and now: the change is real, open again.
      if (!servedAt || minuteOf(servedAt) !== minuteOf(read.now)) continue;
      const first = [...html.matchAll(/<b(?:\s[^>]*)?>([^<]*)<\/b>/g)].map((m) => m[1].trim()).filter((t) => MINUTE_TEXT.test(t));
      const after = read.texts.filter((t) => MINUTE_TEXT.test(t));
      seen = { first, after };
    }
    expect(seen, "분 경계를 세 번 다 넘김").not.toBeNull();
    expect(seen.first.length, "첫 HTML에 분 단위 남은 시간이 있음").toBeGreaterThan(0);
    expect(seen.after, "하이드레이션 직후 남은 시간 = 첫 HTML").toEqual(seen.first);
  });
