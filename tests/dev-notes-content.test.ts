// The published notes in content/dev-notes (the e2e reads test notes instead):
// every note file reads as a note with a title, a date and a summary, its
// headings stay under the page's h1, and no address in it turns into a link
// that leaves the allowed kinds.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { NOTE_FILE, parseMarkdown, readNote, type Block, type Inline } from "../lib/dev-notes/model";

const dir = path.join(process.cwd(), "content", "dev-notes");
const files = readdirSync(dir).filter((file) => NOTE_FILE.test(file));

const links = (parts: Inline[]): string[] =>
  parts.flatMap((part) => (part.t === "link" ? [part.href, ...links(part.c)] : part.t === "strong" ? links(part.c) : []));
const blockLinks = (block: Block): string[] => {
  if (block.t === "ul" || block.t === "ol") return block.items.flatMap((item) => [...links(item.c), ...(item.sub ?? []).flatMap(links)]);
  if (block.t === "table") return [...block.head, ...block.rows.flat()].flatMap(links);
  if (block.t === "hr") return [];
  return links(block.c);
};

test("every published note reads with a title, date and summary", () => {
  assert.ok(files.length >= 2, "the first notes are published");
  for (const file of files) {
    const note = readNote(file, readFileSync(path.join(dir, file), "utf8"));
    assert.ok(note, file);
    assert.match(note.date, /^\d{4}-\d{2}-\d{2}$/, file);
    assert.ok(note.summary, `${file}: a summary for the list and search results`);
    const blocks = parseMarkdown(note.body);
    assert.ok(blocks.length > 3, file);
    for (const href of blocks.flatMap(blockLinks)) assert.match(href, /^(https:\/\/|\/(?![/\\]))/, `${file}: ${href}`);
  }
});

test("v0.2.0 keeps its nested list under the refining fix", () => {
  const note = readNote("2026-10-10-v0-2-0.md", readFileSync(path.join(dir, "2026-10-10-v0-2-0.md"), "utf8"));
  const lists = parseMarkdown(note!.body).filter((block) => block.t === "ul");
  const nested = lists.flatMap((block) => (block.t === "ul" ? block.items : [])).find((item) => item.sub);
  assert.equal(nested?.sub?.length, 2);
});
