// 소개 메뉴(사용자 11-08): '서비스 소개' 하나만, 펼침 창 없이 바로 /about#intro로. 소개 페이지의
// 다른 부분(캐릭터 미리보기·근거 보기·로드맵)은 메뉴 줄이 아니지만 헤더 검색으로는 찾는다.
import assert from "node:assert/strict";
import test from "node:test";
import { NAV_SECTIONS } from "../components/site/nav-data";
import { menuMatches } from "../lib/search/panel";

const about = NAV_SECTIONS.find((section) => section.id === "about")!;

test("소개는 한 페이지: 바로 가는 링크, 펼침 창의 줄은 없음", () => {
  assert.deepEqual([about.link?.label, about.link?.href], ["서비스 소개", "/about#intro"]);
  assert.equal(about.groups.flatMap((group) => group.links).length, 0);
});

test("소개 페이지의 다른 부분은 헤더 검색으로 찾는다", () => {
  assert.deepEqual(
    (about.search ?? []).map((link) => link.href),
    ["/about#intro", "/about#preview", "/about#evidence", "/about#roadmap"],
  );
  for (const word of ["서비스 소개", "캐릭터 미리보기", "근거 보기", "로드맵"])
    assert.ok(menuMatches(word, {}).some((hit) => hit.label === word), word);
});

test("한 페이지 섹션은 소개뿐(다른 섹션은 그대로 펼침 창)", () => {
  assert.deepEqual(NAV_SECTIONS.filter((section) => section.link).map((section) => section.id), ["about"]);
});
