// Official Lost Ark descriptions embed a small HTML-like markup (FONT colours, BR).
// Parse it into plain segments so the UI never injects source HTML and still keeps
// the meaning of increase/decrease colouring on a light background.

export type SourceTone = "positive" | "negative" | "emphasis";
export type SourceSegment = { text: string; tone: SourceTone | null };

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return entities[body.toLowerCase()] ?? match;
  });
}

function hexToHue(hex: string) {
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const [r, g, b] = [0, 2, 4].map(
    (i) => Number.parseInt(full.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta < 0.15) return null;
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}

export function toneOf(attributes: string): SourceTone {
  const match = /color\s*=\s*['"]?#([0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(attributes);
  const hue = match ? hexToHue(match[1]) : null;
  // Only clear red/green carry increase/decrease meaning; other source colours
  // (e.g. Ark Passive tree colours, gold highlights) become neutral emphasis.
  if (hue !== null && (hue <= 15 || hue >= 345)) return "negative";
  if (hue !== null && hue >= 100 && hue <= 140) return "positive";
  return "emphasis";
}

export function parseSourceText(input: string | null | undefined): SourceSegment[] {
  if (!input) return [];
  const segments: SourceSegment[] = [];
  const tones: SourceTone[] = [];
  const push = (raw: string) => {
    if (!raw) return;
    const text = decodeEntities(raw);
    const tone = tones.at(-1) ?? null;
    const last = segments.at(-1);
    if (last && last.tone === tone) last.text += text;
    else segments.push({ text, tone });
  };
  const tag = /<\s*(\/?)\s*([a-z][a-z0-9]*)\b([^<>]*)>/gi;
  let cursor = 0;
  for (let match = tag.exec(input); match; match = tag.exec(input)) {
    push(input.slice(cursor, match.index));
    cursor = tag.lastIndex;
    const closing = match[1] === "/";
    const name = match[2].toLowerCase();
    if (name === "br") push("\n");
    else if (name === "p" || name === "div") push(closing ? "\n" : "");
    else if (name === "font") {
      if (closing) tones.pop();
      else tones.push(toneOf(match[3]));
    }
    // Any other tag (img, span, etc.) is dropped; its inner text is kept.
  }
  push(input.slice(cursor));
  return normalizeWhitespace(segments);
}

function normalizeWhitespace(segments: SourceSegment[]) {
  const result = segments
    .map((segment) => ({
      ...segment,
      text: segment.text.replace(/[ \t]*\n[ \t]*/g, "\n").replace(/\n{3,}/g, "\n\n"),
    }))
    .filter((segment) => segment.text);
  if (result.length) {
    result[0].text = result[0].text.replace(/^\s+/, "");
    const last = result.at(-1)!;
    last.text = last.text.replace(/\s+$/, "");
  }
  return result.filter((segment) => segment.text);
}

export function sourcePlainText(input: string | null | undefined) {
  return parseSourceText(input)
    .map((segment) => segment.text)
    .join("");
}
