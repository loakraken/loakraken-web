import assert from "node:assert/strict";
import test from "node:test";
import { byNewest, parseInline, parseMarkdown, readNote, splitFrontmatter } from "../lib/dev-notes/model";

test("frontmatter: key: value lines, quotes dropped, CRLF and BOM tolerated", () => {
  const { data, body } = splitFrontmatter('﻿---\r\ntitle: "제목: 콜론"\r\ndate: 2026-10-19\r\n---\r\n본문');
  assert.deepEqual(data, { title: "제목: 콜론", date: "2026-10-19" });
  assert.equal(body, "본문");
  assert.deepEqual(splitFrontmatter("머리 없음"), { data: {}, body: "머리 없음" });
});

test("a note needs the file name shape and a title; the date falls back to the file name", () => {
  const note = readNote("2026-10-12-older-note.md", "---\ntitle: 지난 노트\nsummary: 요약\n---\n본문");
  assert.deepEqual(note, { slug: "2026-10-12-older-note", title: "지난 노트", date: "2026-10-12", summary: "요약", pinned: false, body: "본문" });
  assert.equal(readNote("2026-10-12-x.md", "---\ndate: 2026-10-13\n---\n제목 없음"), null);
  assert.equal(readNote("README.md", "---\ntitle: 안내\n---\n"), null);
  assert.equal(readNote("2026-10-12-Upper.md", "---\ntitle: 대문자 주소\n---\n"), null);
  assert.equal(readNote("2026-10-12-a.md", "---\ntitle: t\ndate: 10/13\n---\n")?.date, "2026-10-12");
});

test("newest first, the same day by address", () => {
  const notes = [
    { slug: "2026-10-12-a", title: "", date: "2026-10-12", summary: "", pinned: false },
    { slug: "2026-10-19-a", title: "", date: "2026-10-19", summary: "", pinned: false },
    { slug: "2026-10-19-b", title: "", date: "2026-10-19", summary: "", pinned: false },
  ];
  assert.deepEqual([...notes].sort(byNewest).map((n) => n.slug), ["2026-10-19-b", "2026-10-19-a", "2026-10-12-a"]);
});

// QA 11-02: "v0-3-6" sorted after "hotfix-v0-3-6-1" by address, so the newer
// hotfix sat below its release (also 10-18 and 10-28).
test("the same day by version: a hotfix above its release, the newer hotfix first", () => {
  const note = (slug: string) => ({ slug, title: "", date: slug.slice(0, 10), summary: "", pinned: false });
  const notes = [
    "2026-11-02-hotfix-v0-3-5-1",
    "2026-11-02-v0-3-6",
    "2026-11-02-hotfix-v0-3-6-1",
    "2026-11-01-v0-3-4",
    "2026-11-01-v0-3-5",
    "2026-10-28-hotfix-v0-3-3-1",
    "2026-10-28-v0-3-3",
    "2026-10-28-hotfix-v0-3-3-2",
    "2026-10-18-v0-3-1",
    "2026-10-18-hotfix-v0-3-1-2",
    "2026-10-18-hotfix-v0-3-10",
  ].map(note);
  assert.deepEqual([...notes].sort(byNewest).map((n) => n.slug), [
    "2026-11-02-hotfix-v0-3-6-1",
    "2026-11-02-v0-3-6",
    "2026-11-02-hotfix-v0-3-5-1",
    "2026-11-01-v0-3-5",
    "2026-11-01-v0-3-4",
    "2026-10-28-hotfix-v0-3-3-2",
    "2026-10-28-hotfix-v0-3-3-1",
    "2026-10-28-v0-3-3",
    "2026-10-18-hotfix-v0-3-10",
    "2026-10-18-hotfix-v0-3-1-2",
    "2026-10-18-v0-3-1",
  ]);
  // Without a version on one side, the address decides as before.
  const mixed = ["2026-10-19-hotfix-v0-3-1-3", "2026-10-19-roadmap"].map(note);
  assert.deepEqual([...mixed].sort(byNewest).map((n) => n.slug), ["2026-10-19-roadmap", "2026-10-19-hotfix-v0-3-1-3"]);
});

test("pinned: true keeps a note on top, several by date; anything else is not pinned", () => {
  const pinned = (value: string) => readNote("2026-10-12-x.md", `---\ntitle: t\npinned: ${value}\n---\n`)?.pinned;
  assert.equal(pinned("true"), true);
  assert.equal(pinned("\"true\""), true);
  assert.equal(pinned("TRUE"), true);
  for (const value of ["false", "yes", "1", ""]) assert.equal(pinned(value), false, value);
  assert.equal(readNote("2026-10-12-x.md", "---\ntitle: t\n---\n")?.pinned, false);
  const notes = [
    { slug: "2026-10-19-new", title: "", date: "2026-10-19", summary: "", pinned: false },
    { slug: "2026-10-01-old-pin", title: "", date: "2026-10-01", summary: "", pinned: true },
    { slug: "2026-10-12-mid", title: "", date: "2026-10-12", summary: "", pinned: false },
    { slug: "2026-10-15-new-pin", title: "", date: "2026-10-15", summary: "", pinned: true },
  ];
  assert.deepEqual(
    [...notes].sort(byNewest).map((n) => n.slug),
    ["2026-10-15-new-pin", "2026-10-01-old-pin", "2026-10-19-new", "2026-10-12-mid"],
  );
});

test("inline: bold, code, safe links; anything else stays text", () => {
  assert.deepEqual(parseInline("가 **굵게** `코드` [링크](/rankings)"), [
    { t: "text", v: "가 " },
    { t: "strong", c: [{ t: "text", v: "굵게" }] },
    { t: "text", v: " " },
    { t: "code", v: "코드" },
    { t: "text", v: " " },
    { t: "link", href: "/rankings", c: [{ t: "text", v: "링크" }] },
  ]);
  assert.deepEqual(parseInline("[밖](https://example.com/a)"), [{ t: "link", href: "https://example.com/a", c: [{ t: "text", v: "밖" }] }]);
  for (const unsafe of [
    "[x](javascript:alert(1))",
    "[x](//evil.example)",
    // Browsers read "/\" (and "\" anywhere in a path) as another site.
    "[x](/\\evil.example)",
    "[x](/a\\b)",
    "[x](https://ok.example\\@evil.example)",
    "[x](http://plain.example)",
    "<script>alert(1)</script>",
    "**닫히지 않음",
  ])
    assert.ok(parseInline(unsafe).every((part) => part.t === "text"), unsafe);
});

test("blocks: headings, joined paragraph lines, lists, table, quote, rule", () => {
  const blocks = parseMarkdown(
    [
      "# 첫 제목",
      "첫 줄",
      "둘째 줄",
      "",
      "### 작은 제목",
      "- 하나",
      "- 둘",
      "1. 첫째",
      "2) 둘째",
      "| a | b |",
      "|---|:-:|",
      "| 1 |",
      "| 2 | 3 | 4 |",
      "> 인용",
      "> 둘째 줄",
      "---",
    ].join("\n"),
  );
  assert.deepEqual(
    blocks.map((b) => b.t),
    ["h2", "p", "h3", "ul", "ol", "table", "quote", "hr"],
  );
  assert.deepEqual(blocks[1], { t: "p", c: [{ t: "text", v: "첫 줄 둘째 줄" }] });
  const table = blocks[5];
  assert.ok(table.t === "table");
  // Rows as wide as the head: short rows padded, long rows cut.
  assert.deepEqual(table.rows.map((row) => row.length), [2, 2]);
  assert.deepEqual(table.rows[0][1], []);
  assert.deepEqual(blocks[6], { t: "quote", c: [{ t: "text", v: "인용 둘째 줄" }] });
  // A "|" line without a rule under it is a paragraph, not a table.
  assert.equal(parseMarkdown("| 표 아님 |")[0].t, "p");
});

test("rows indented under a list row are its own list, one level deep", () => {
  const [list] = parseMarkdown(["- 위", "  - 아래 하나", "  1. 아래 둘", "- 다음"].join("\n"));
  assert.ok(list.t === "ul");
  assert.deepEqual(
    list.items.map((item) => [item.c, item.sub]),
    [
      [[{ t: "text", v: "위" }], [[{ t: "text", v: "아래 하나" }], [{ t: "text", v: "아래 둘" }]]],
      [[{ t: "text", v: "다음" }], undefined],
    ],
  );
});
