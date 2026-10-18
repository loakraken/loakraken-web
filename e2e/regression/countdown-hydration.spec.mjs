// 회귀(#902, A6): 남은 시간 글자는 첫 HTML(서버 시각)과 하이드레이션 직후가 같아야 한다.
// 브라우저의 분 시계가 05:38:40을 05:38:00으로 읽어 "3시간 21분"이 바로 "3시간 22분"으로 바뀌었고,
// 바뀐 숫자의 폭이 다르면 그 줄이 움직였다(06:00 직전 CI 실패). 분 단위 글자만 비교한다(초 단위는
// 원래 매초 바뀜). 서버가 그린 분과 읽는 분이 다르면(분 경계를 넘김) 다시 연다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const MINUTE_TEXT = /^(\d+일 \d+시간|\d+시간 \d+분)$/;
// Under an hour (lib/time/remaining.ts): "25분 03초", "45초".
const SECOND_TEXT = /^(\d+분 \d{2}초|\d+초)$/;
const minuteOf = (ms) => Math.floor(ms / 60_000);

/** The first HTML's and the hydrated page's countdown texts, from one opening within one minute. */
async function countdowns(page, path) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
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
    const bold = [...html.matchAll(/<b(?:\s[^>]*)?>([^<]*)<\/b>/g)].map((m) => m[1].trim());
    return {
      first: bold.filter((t) => MINUTE_TEXT.test(t)),
      after: read.texts.filter((t) => MINUTE_TEXT.test(t)),
      seconds: bold.filter((t) => SECOND_TEXT.test(t)),
    };
  }
  return null;
}

for (const path of ["/", "/schedule"])
  test(`@A6 ${path} 남은 시간 글자가 첫 HTML과 하이드레이션 직후 같다 @regression`, async ({ page }) => {
    let seen = await countdowns(page, path);
    expect(seen, "분 경계를 세 번 다 넘김").not.toBeNull();
    // The home shows only the next rounds. When every one of them is within the
    // hour they all read in seconds ("53분 11초", by design; CI at 20:06 KST had
    // only 21:00 and 20:50 left) and there is no minute text to compare. The
    // server clock cannot be fixed per test (one shared server; page.clock moves
    // the browser only), so this run notes what it saw and compares /schedule
    // instead, which lists rounds hours or days away. A run with no minute text
    // on either page fails: the check never passes without comparing.
    if (path === "/" && seen.first.length === 0) {
      test.info().annotations.push({
        type: "홈: 분 단위 없음",
        description: `본 글자 ${seen.seconds.join(", ") || "남은 시간 없음"} → /schedule로 비교`,
      });
      seen = await countdowns(page, "/schedule");
      expect(seen, "분 경계를 세 번 다 넘김(/schedule)").not.toBeNull();
    }
    expect(seen.first.length, "첫 HTML에 분 단위 남은 시간이 있음").toBeGreaterThan(0);
    expect(seen.after, "하이드레이션 직후 남은 시간 = 첫 HTML").toEqual(seen.first);
  });
