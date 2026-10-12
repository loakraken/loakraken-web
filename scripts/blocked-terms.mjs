// Terms that must not appear anywhere in this public repository (other
// sites' names, real characters' names). The list itself would give away
// what it guards, so it is not in the repository — not even encoded
// (PM 총괄 10-12). It is read from:
//
//   CI     the Actions secret BLOCKED_TERMS (env), one term per line or comma
//   local  .blocked-terms at the repository root, kept out of Git by
//          .git/info/exclude (worktrees fall back to the main clone's copy)
//
// A line may carry a kind for the report: "site: <term>" or
// "character: <term>"; a bare line is a site. "#" starts a comment.
// With neither source the checks print "건너뜀" instead of passing silently.
//
// Shared by scripts/check-regressions.mjs, the no-site-names e2e and any
// other checker (e.g. the verification-fixture check) — import from here.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const BLOCKED_FILE = ".blocked-terms";

function parse(text) {
  const out = [];
  for (const raw of text.split(/\r?\n|,/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const m = /^(site|character)\s*:\s*(.+)$/.exec(line);
    out.push(m ? { kind: m[1], term: m[2].trim() } : { kind: "site", term: line });
  }
  return out;
}

function localFiles() {
  const files = [join(ROOT, BLOCKED_FILE)];
  try {
    const common = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: ROOT, encoding: "utf8" }).trim();
    files.push(join(dirname(isAbsolute(common) ? common : join(ROOT, common)), BLOCKED_FILE));
  } catch {
    // not a Git checkout: only the root copy
  }
  return files;
}

/**
 * The blocked terms and where they came from ("BLOCKED_TERMS" or the local
 * file), or source null when there is no list. Never prints the terms.
 */
export function loadBlockedTerms() {
  if (process.env.BLOCKED_TERMS?.trim()) {
    return { terms: dedupe(parse(process.env.BLOCKED_TERMS)), source: "BLOCKED_TERMS" };
  }
  const file = localFiles().find((f) => existsSync(f));
  if (file) return { terms: dedupe(parse(readFileSync(file, "utf8"))), source: BLOCKED_FILE };
  return { terms: [], source: null };
}

const dedupe = (terms) => [...new Map(terms.map((t) => [t.term.toLowerCase(), t])).values()];

/** A case-insensitive global pattern for the terms; ASCII terms match whole words only. */
export function blockedPattern(terms) {
  if (!terms.length) return null;
  const parts = terms
    .map((t) => t.term)
    .sort((a, b) => b.length - a.length)
    .map((term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return /^[\x20-\x7e]+$/.test(term) ? `(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])` : escaped;
    });
  return new RegExp(parts.join("|"), "gi");
}

/** The kind ("site" | "character") of a matched text. */
export function kindOf(terms, matched) {
  return terms.find((t) => t.term.toLowerCase() === matched.toLowerCase())?.kind ?? "site";
}

/** A line with every blocked term masked, safe for a public CI log. */
export const mask = (line, pattern) => line.replace(pattern, "＊＊＊");
