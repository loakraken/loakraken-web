// Estate crafting recipes (E41): materials, gold, energy, time and unlock
// condition per recipe, from one allowed source (a public crafting database, checked
// 2026-10-13). Static data in data/craft-recipes.json; feeds the crafting
// profit calculator (M46·N10). Values neither source states — how many items
// one craft makes, what a great success adds, per-recipe success odds — stay
// null rather than guessed.
import raw from "./data/craft-recipes.json";

export type Recipe = {
  name: string;
  materials: { name: string; qty: number }[];
  gold: number | null;
  /** 활동력 spent per craft. */
  energy: number | null;
  /** "HH:MM:SS". */
  time: string | null;
  condition: string | null;
  /** Items one craft makes; null until a source states it. */
  outputQty: number | null;
};
export type CraftData = {
  version: string;
  checkedAt: string;
  sources: Record<string, { title: string; url: string; date: string }>;
  unknown: string[];
  categories: Record<string, Recipe[]>;
};

export const CRAFT_RECIPES = raw as CraftData;

/** Consistency problems in the data; the test suite expects none. */
export function checkCraftData(data: CraftData): string[] {
  const problems: string[] = [];
  for (const [key, source] of Object.entries(data.sources))
    if (!/^https:\/\//.test(source.url) || !source.date) problems.push(`${key}: source needs a URL and a date`);
  for (const [category, list] of Object.entries(data.categories)) {
    if (!list.length) problems.push(`${category}: empty`);
    for (const r of list) {
      const where = `${category}/${r.name}`;
      if (!r.materials.length) problems.push(`${where}: no materials`);
      for (const m of r.materials)
        if (!Number.isInteger(m.qty) || m.qty <= 0) problems.push(`${where}: bad qty ${m.name} ${m.qty}`);
      for (const value of [r.gold, r.energy])
        if (value !== null && (!Number.isInteger(value) || value < 0)) problems.push(`${where}: bad value ${value}`);
      if (r.time !== null && !/^\d{2}:\d{2}:\d{2}$/.test(r.time)) problems.push(`${where}: bad time ${r.time}`);
    }
  }
  return problems;
}
