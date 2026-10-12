#!/usr/bin/env node
// Guards against regressions the user has already pointed out once
// (vault: 30 PM/사용자 지적 회귀 점검표, rows A1 A2 A9 A11 A13 B2 B3).
// Fast and dependency-free: it reads the source, strips comments (a comment
// may name a rule; the screen may not) and fails CI with the
// file, line and the checklist row that was broken.
//
//   node scripts/check-regressions.mjs        # exit 1 on any violation
//
// Blocked names (other sites, real characters) are checked across every
// tracked file — docs, comments, tests, fixtures and file names too — against
// a list that is not in this public repository (scripts/blocked-terms.mjs:
// the BLOCKED_TERMS secret in CI, .blocked-terms locally). Hits are printed
// masked; with no list the check says 건너뜀.
//
// An exception is a path (and why) in ALLOW below. TEMP entries print a
// warning every run so they are removed when the owning PR lands.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { blockedPattern, kindOf, loadBlockedTerms, mask } from "./blocked-terms.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN = ["app", "components", "lib"];
const CODE = /\.(tsx?|jsx?|mjs)$/;
const STYLE = /\.css$/;
// Generated from the backend contract (its text belongs to the backend's own check).
const SKIP = [/\.d\.ts$/, /^app[\\/]zz-design-preview[\\/]/];

/** Paths allowed to break a rule, with the reason. TEMP = must go soon. */
const ALLOW = {
  A13: [
    { path: "app/contact/page.tsx", why: "공식 API 표기(점검표 A13 예외)" },
    { path: "components/tools/crit-speed.tsx", why: "능력치 출처 분해(점검표 A13 예외)" },
  ],
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      walk(full, out);
    } else out.push(full);
  }
  return out;
}

/**
 * Blank out comments, keeping line breaks so line numbers stay right.
 * Strings and template literals are kept (they are what the screen shows),
 * so a "//" inside a URL string is not mistaken for a comment.
 */
function stripComments(src, css = false) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\" && !css) {
        out += n ?? "";
        i += 2;
        continue;
      }
      // ' and " strings end at the line (only template strings span lines),
      // so a stray quote in JSX text cannot hide the lines after it.
      if (c === quote || (c === "\n" && quote !== "`")) quote = null;
      i++;
      continue;
    }
    if (c === "/" && n === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    if (!css && c === "/" && n === "/") {
      const end = src.indexOf("\n", i);
      const stop = end < 0 ? src.length : end;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    // An apostrophe inside a word (JSX text: don't, it's) opens no string —
    // a quote never follows a letter or digit in code.
    const inWord = c === "'" && !css && /[\p{L}\p{N}]/u.test(src[i - 1] ?? "");
    if (!inWord && (c === '"' || c === "'" || (!css && c === "`"))) quote = c;
    out += c;
    i++;
  }
  return out;
}

const RULES = [
  {
    row: "A1",
    what: "브라우저 기본 <select> — 공통 Select(components/ui/select.tsx)를 쓰세요",
    files: CODE,
    test: /<select[\s>]/,
    allow: (p) => /^components[\\/]ui[\\/]select/.test(p),
  },
  {
    row: "A2",
    what: 'role="tablist" 직접 작성 — PillTabs(components/ui/pill-tabs.tsx)를 쓰세요',
    files: CODE,
    test: /role\s*[=:]\s*\{?\s*["'`]tablist["'`]/,
    allow: (p) => /^components[\\/]ui[\\/]pill-tabs\.tsx$/.test(p),
  },
  {
    row: "A9",
    what: "숫자 굴림(카운트업·모핑) — 최종값을 한 번에 보이세요",
    files: CODE,
    test: /\b(useAnimatedNumber|CountUp|countUp|animateNumber|NumberFlow|useSpringNumber)\b/,
  },
  {
    row: "A11",
    what: "hover에 고정색 — 배경은 --hover-surface 등 토큰만",
    files: CODE,
    test: /hover:(bg|text|border|ring|shadow)-\[(#|rgb|hsl|oklch|oklab)/,
  },
  {
    row: "A13",
    what: "화면에 '출처' 표기 — 사용자 결정(10-12)으로 출처 표시를 쓰지 않습니다",
    files: CODE,
    test: /출처/,
    only: /^(app|components)[\\/]/,
    allowKey: "A13",
  },
  {
    row: "B2",
    what: "'다를 수 있' 같은 애매한 단서 — 원인을 고치고 확실한 문장으로",
    files: CODE,
    test: /다를 수 있/,
  },
  {
    row: "B3",
    what: "현금 거래(RMT) 환산 — 크리스탈 공식 경로만",
    files: CODE,
    test: /(디코 |100골드당|discordWon)/,
  },
];

/** A11 for CSS: a :hover rule whose colour declarations use a literal colour. */
function hoverLiterals(css) {
  const found = [];
  const re = /([^{}]*:hover[^{}]*)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const body = m[2];
    const decl = /(background(?:-color)?|color|border(?:-[a-z]+)?-color|border|box-shadow|outline-color|fill|stroke)\s*:\s*([^;]+)/g;
    let d;
    while ((d = decl.exec(body))) {
      const value = d[2].replace(/var\([^)]*\)/g, "");
      if (/#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla|oklch|oklab)\(\s*[\d.]/i.test(value)) {
        const offset = m.index + m[1].length + 1 + d.index;
        found.push({ offset, text: `${d[1]}: ${d[2].trim()}` });
      }
    }
  }
  return found;
}

const lineOf = (src, offset) => src.slice(0, offset).split("\n").length;

const errors = [];
const warnings = [];
const allowed = (key, path) => (ALLOW[key] ?? []).find((a) => a.path === path.split(sep).join("/"));

for (const top of SCAN) {
  for (const full of walk(join(ROOT, top))) {
    const path = relative(ROOT, full);
    if (SKIP.some((s) => s.test(path))) continue;
    const isCode = CODE.test(path);
    const isStyle = STYLE.test(path);
    if (!isCode && !isStyle) continue;
    const raw = readFileSync(full, "utf8");
    const src = stripComments(raw, isStyle);
    if (isStyle) {
      for (const hit of hoverLiterals(src)) {
        errors.push(`${path}:${lineOf(src, hit.offset)}  [A11] hover에 고정색 — 토큰(--hover-surface 등)만: ${hit.text}`);
      }
      continue;
    }
    const lines = src.split("\n");
    for (const rule of RULES) {
      if (!rule.files.test(path)) continue;
      if (rule.allow?.(path)) continue;
      if (rule.only && !rule.only.test(path)) continue;
      const exempt = rule.allowKey ? allowed(rule.allowKey, path) : null;
      lines.forEach((line, i) => {
        if (!rule.test.test(line)) return;
        const at = `${path}:${i + 1}  [${rule.row}] ${rule.what}`;
        if (exempt) {
          if (exempt.temp) warnings.push(`${at} (임시 예외: ${exempt.why})`);
          return;
        }
        errors.push(`${at}\n    ${line.trim().slice(0, 140)}`);
      });
    }
  }
}

// Blocked names: every tracked text file, raw (comments included), and every path.
// Game data keeps where each value came from (user rule 10-12): in data JSON
// the source fields (source, sources, sourceUrl…, checkedAt) are not checked,
// and when such a key opens an object or array ("sources": { id: { title,
// url, date } }), nothing inside it is either — up to its closing bracket.
// Every other field (what reaches the screen) is still checked.
const DATA_JSON = /^lib[\\/](.+[\\/])?data[\\/].+\.json$/;
const SOURCE_KEY = /^\s*"(source[A-Za-z]*|checkedAt)"\s*:/;
/** Net bracket depth of a JSON line, ignoring brackets inside strings. */
function depthOf(line) {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
  }
  return depth;
}
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|pdf|zip|gz|mp4|webm)$/i;
const blocked = loadBlockedTerms();
const blockedRe = blockedPattern(blocked.terms);
let blockedNote;
if (!blockedRe) {
  blockedNote = "금지 이름 검사 건너뜀 (BLOCKED_TERMS 비밀값도 .blocked-terms 파일도 없음)";
} else {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
  const label = (text) => (kindOf(blocked.terms, text) === "character" ? "실제 캐릭터명" : "다른 사이트 이름");
  for (const path of tracked) {
    blockedRe.lastIndex = 0;
    const inPath = blockedRe.exec(path);
    if (inPath) errors.push(`${mask(path, blockedRe)}  [공개 저장소] 파일 이름에 ${label(inPath[0])}`);
    if (BINARY.test(path)) continue;
    let raw;
    try {
      raw = readFileSync(join(ROOT, path), "utf8");
    } catch {
      continue; // deleted in the working tree
    }
    if (raw.includes("\0")) continue;
    const data = DATA_JSON.test(path);
    let sourceDepth = 0; // > 0 while inside a source object or array
    raw.split("\n").forEach((line, i) => {
      if (data) {
        if (sourceDepth > 0) {
          sourceDepth += depthOf(line);
          return;
        }
        if (SOURCE_KEY.test(line)) {
          sourceDepth = Math.max(0, depthOf(line));
          return;
        }
      }
      blockedRe.lastIndex = 0;
      const hit = blockedRe.exec(line);
      if (!hit) return;
      errors.push(`${mask(path, blockedRe)}:${i + 1}  [공개 저장소] ${label(hit[0])} — 이름 없이 쓰거나 익명 ID로\n    ${mask(line.trim(), blockedRe).slice(0, 140)}`);
    });
  }
  blockedNote = `금지 이름 ${blocked.terms.length}개 검사 (${blocked.source}, 파일 ${tracked.length}개)`;
}

for (const w of warnings) console.warn(`warning  ${w}`);
console.log(blockedNote);
if (errors.length) {
  console.error(`\n회귀 점검표 위반 ${errors.length}건 (30 PM/사용자 지적 회귀 점검표):\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`check-regressions: 위반 0건 (임시 예외 ${warnings.length}줄)`);
