// 회귀(#418): 운영 엣지가 HTML의 메일 주소를 바꿔 써서, 하이드레이션 때 서버 HTML과 달라 React 오류가 났다.
// 문의·개인정보 화면과 개발자 노트의 주소는 첫 HTML에서 email_off 표시 안의 mailto 링크로 나오고(엣지가
// 건드리지 않는 형식), 화면에서도 그 링크이며, 콘솔 오류가 없다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const PAGES = [
  ["문의", "/contact", "contact@loakraken.gg"],
  ["개발자 노트", "/news/dev-notes/2026-10-19-test-release", "contact@loakraken.gg"],
];

for (const [name, path, address] of PAGES)
  test(`@메일 ${name}: 주소는 email_off 안의 mailto 링크, 콘솔 오류 없음 @regression`, async ({ page, request }) => {
    // The first HTML, as the edge sees it.
    const html = await (await request.get(path)).text();
    expect(html).toContain(`<!--email_off--><a href="mailto:${address}">${address}</a><!--/email_off-->`);
    // Not a bare address outside the marker in the page's own markup.
    expect(html.replace(/<!--email_off-->.*?<!--\/email_off-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "")).not.toContain(address);

    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await gotoReady(page, path);
    const link = page.getByRole("link", { name: address }).first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", new RegExp(`^mailto:${address.replace(".", "\\.")}`));
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
