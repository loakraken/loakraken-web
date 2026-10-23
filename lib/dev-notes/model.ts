// LOAKraken 개발자 노트 (user decision 10-18): notes are markdown files in the
// repository, read on the server. This file is the pure part — frontmatter
// and a small markdown subset (headings, paragraphs, lists, tables, quotes,
// bold, inline code, links) turned into a tree the page draws as React
// elements. Raw HTML is never passed through: it stays text.

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] }
  /** A plain address in the text, drawn as a mailto link the edge leaves alone. */
  | { t: "email"; v: string };

export type Block =
  | { t: "h2" | "h3"; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "ul" | "ol"; items: ListItem[] }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }
  | { t: "quote"; c: Inline[] }
  | { t: "hr" };

/** A list row; rows indented under it (two spaces or more) are its own list, one level deep. */
export type ListItem = { c: Inline[]; sub?: Inline[][] };

/** `pinned`: frontmatter `pinned: true` — kept at the top of the list, marked 고정. */
export type DevNoteMeta = { slug: string; title: string; date: string; summary: string; pinned: boolean };
export type DevNote = DevNoteMeta & { body: string };

/** "2026-10-19-v0-3-0.md": the date and the address part. Other files (README) are not notes. */
export const NOTE_FILE = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `---` key: value lines `---` at the top, then the body. Values may be quoted. */
export function splitFrontmatter(source: string): { data: Record<string, string>; body: string } {
  const text = source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { data: {}, body: text };
  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const pair = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!pair) continue;
    data[pair[1]] = pair[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return { data, body: text.slice(match[0].length) };
}

/** One note from its file name and text, or null when it is not a usable note (no title). */
export function readNote(fileName: string, source: string): DevNote | null {
  const file = NOTE_FILE.exec(fileName);
  if (!file) return null;
  const { data, body } = splitFrontmatter(source);
  const title = data.title?.trim();
  if (!title) return null;
  return {
    slug: fileName.slice(0, -".md".length),
    title,
    date: data.date && DATE.test(data.date) ? data.date : file[1],
    summary: data.summary?.trim() ?? "",
    pinned: data.pinned?.trim().toLowerCase() === "true",
    body,
  };
}

/** Pinned notes first, then newest first (pinned ones too, by date); the same day by address. */
export const byNewest = (a: DevNoteMeta, b: DevNoteMeta) =>
  Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug);

/**
 * Only web addresses and paths on this site become links; anything else stays
 * text. A path never starts "//" or "/\" and holds no "\": browsers read those
 * as another site.
 */
const safeHref = (href: string) => /^https:\/\/[^\s\\]+$/.test(href) || /^\/(?![/\\])[^\s\\]*$/.test(href);

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ t: "text", v: text });
    text = "";
  };
  for (let i = 0; i < source.length; ) {
    if (source.startsWith("**", i)) {
      const end = source.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: "strong", c: parseInline(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (source[i] === "`") {
      const end = source.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ t: "code", v: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // An address standing on its own (not the middle of a longer word).
    if (!/[A-Za-z0-9._%+-]/.test(source[i - 1] ?? "")) {
      const email = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/.exec(source.slice(i));
      if (email) {
        flush();
        out.push({ t: "email", v: email[0] });
        i += email[0].length;
        continue;
      }
    }
    if (source[i] === "[") {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(source.slice(i));
      if (link && safeHref(link[2])) {
        flush();
        out.push({ t: "link", href: link[2], c: parseInline(link[1]) });
        i += link[0].length;
        continue;
      }
    }
    text += source[i];
    i += 1;
  }
  flush();
  return out;
}

const HEADING = /^(#{1,3})\s+(.+)$/;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d+[.)]\s+(.*)$/;
const RULE = /^(-{3,}|\*{3,})$/;
const QUOTE = /^>\s?(.*)$/;
const TABLE_RULE = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => parseInline(cell.trim()));

const startsBlock = (line: string, next: string | undefined) =>
  HEADING.test(line) ||
  BULLET.test(line) ||
  NUMBERED.test(line) ||
  RULE.test(line) ||
  QUOTE.test(line) ||
  (line.startsWith("|") && next != null && TABLE_RULE.test(next.trim()));

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i].trim();
    if (!line) {
      i += 1;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      // The page title is the one h1; "#" and "##" are sections, "###" under them.
      blocks.push({ t: heading[1].length === 3 ? "h3" : "h2", c: parseInline(heading[2].trim()) });
      i += 1;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ t: "hr" });
      i += 1;
      continue;
    }
    if (line.startsWith("|") && lines[i + 1] != null && TABLE_RULE.test(lines[i + 1].trim())) {
      const head = cells(line);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = cells(lines[i]);
        // Every row as wide as the head: short rows get empty cells, long rows lose the extra.
        rows.push(head.map((_, n) => row[n] ?? []));
        i += 1;
      }
      blocks.push({ t: "table", head, rows });
      continue;
    }
    for (const [pattern, t] of [
      [BULLET, "ul"],
      [NUMBERED, "ol"],
    ] as const) {
      if (!pattern.test(line)) continue;
      const items: ListItem[] = [];
      while (i < lines.length) {
        const raw = lines[i];
        const row = raw.trim();
        const nested = /^\s{2,}/.test(raw) && items.length > 0;
        const sub = nested ? (BULLET.exec(row) ?? NUMBERED.exec(row)) : null;
        if (sub) {
          (items[items.length - 1].sub ??= []).push(parseInline(sub[1]));
        } else if (pattern.test(row)) {
          items.push({ c: parseInline(pattern.exec(row)![1]) });
        } else break;
        i += 1;
      }
      blocks.push({ t, items });
      break;
    }
    if (BULLET.test(line) || NUMBERED.test(line)) continue;
    if (QUOTE.test(line)) {
      const parts: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i].trim())) {
        parts.push(QUOTE.exec(lines[i].trim())![1]);
        i += 1;
      }
      blocks.push({ t: "quote", c: parseInline(parts.join(" ")) });
      continue;
    }
    // A paragraph runs to a blank line or the next block; its lines join with a space.
    const parts = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i].trim(), lines[i + 1])) {
      parts.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ t: "p", c: parseInline(parts.join(" ")) });
  }
  return blocks;
}
