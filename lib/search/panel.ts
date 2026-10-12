// Header search panel (PM 총괄 10-12 01:07·01:11): what the rows under the
// search pill are made of. Pure, so the component only wires state to it.
// Empty field: recent characters, popular characters, site features. Typed:
// matching menu entries, then "'이름' 캐릭터 정보 보기" and name suggestions.
import { NAV_SECTIONS, type NavFlags } from "@/components/site/nav-data";

export type MenuHit = { id: string; label: string; section: string; href: string };

const fold = (text: string) => text.toLowerCase().replace(/\s+/g, "");

/**
 * Menu entries whose label or description contains the typed text (spaces
 * ignored), live links only and only those whose flag is on, label matches
 * first. At most `limit`.
 */
export function menuMatches(query: string, flags: NavFlags, limit = 5): MenuHit[] {
  const q = fold(query);
  if (!q) return [];
  const hits: (MenuHit & { score: number })[] = [];
  const seen = new Set<string>();
  for (const section of NAV_SECTIONS)
    for (const group of section.groups)
      for (const link of group.links) {
        if (!link.href || (link.flag && flags[link.flag] !== true) || seen.has(link.href)) continue;
        const inLabel = fold(link.label).includes(q);
        if (!inLabel && !fold(link.description).includes(q)) continue;
        seen.add(link.href);
        hits.push({ id: `menu:${link.href}`, label: link.label, section: section.label, href: link.href, score: inLabel ? 0 : 1 });
      }
  return hits
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((hit) => ({ id: hit.id, label: hit.label, section: hit.section, href: hit.href }));
}

/** The next row id for ↑/↓, wrapping at the ends; nothing active → first or last. */
export function stepActive(ids: readonly string[], active: string | null, direction: 1 | -1) {
  if (!ids.length) return null;
  const at = active == null ? -1 : ids.indexOf(active);
  if (at < 0) return direction === 1 ? ids[0] : ids[ids.length - 1];
  return ids[(at + direction + ids.length) % ids.length];
}

/** Splits a suggested name into the typed prefix (shown bold) and the rest. */
export function splitPrefix(name: string, typed: string) {
  const q = typed.trim();
  return q && name.startsWith(q) ? { head: q, tail: name.slice(q.length) } : { head: "", tail: name };
}
