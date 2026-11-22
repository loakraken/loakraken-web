// (ours, M49) 아크 그리드 젬 바꾸기 in the combat-power simulator (api #1079, ARK_GRID_GEM): which gem types a core
// takes, the four options each type rolls from, and each type's base 의지력. The api checks the same table and owns
// the computation; the screen only offers what the api accepts.
// Source: the api contract's gemType description (api develop 6f81b43d, read 2026-11-22), which cites the official
// 확률 정보 and notice 13204 (https://lostark.game.onstove.com/News/Notice/Views/13204).

/** Order (질서) cores take 안정 · 견고 · 불변; chaos (혼돈) cores take 침식 · 왜곡 · 붕괴. */
export const GEM_SERIES = {
  질서: ["안정", "견고", "불변"],
  혼돈: ["침식", "왜곡", "붕괴"],
} as const;
export type GemSeries = keyof typeof GEM_SERIES;

const POOL_A = ["공격력", "추가 피해", "아군 피해 강화", "낙인력"] as const;
const POOL_B = ["공격력", "보스 피해", "아군 피해 강화", "아군 공격 강화"] as const;
const POOL_C = ["추가 피해", "보스 피해", "낙인력", "아군 공격 강화"] as const;

/** The four options a gem of each type rolls from (two of them, different, on one gem). */
export const GEM_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  안정: POOL_A,
  침식: POOL_A,
  견고: POOL_B,
  왜곡: POOL_B,
  불변: POOL_C,
  붕괴: POOL_C,
};

/** 필요 의지력 = the type's base − 의지력 효율. */
export const GEM_BASE_WILL: Readonly<Record<string, number>> = { 안정: 8, 침식: 8, 견고: 9, 왜곡: 9, 불변: 10, 붕괴: 10 };

/** The api's bounds for a new gem (point, 의지력 효율, option levels). */
export const GEM_MIN = 1;
export const GEM_MAX = 5;

export type GemOption = { name: string; level: number };
/** The gem the user swaps in. */
export type GemEdit = { gemType: string; willEfficiency: number; point: number; effects: [GemOption, GemOption] };

/** An equipped gem as the screen reads it (the character's arc grid): what a swap starts from. */
export type CurrentGem = {
  slotIndex: number;
  index: number;
  /** The core's name, for the gem's label. */
  core: string;
  series: GemSeries;
  active: boolean;
  edit: GemEdit;
};

export const gemKey = (gem: { slotIndex: number; index: number }) => `${gem.slotIndex}:${gem.index}`;

/**
 * A core's series: from its name (질서의 … / 혼돈의 …), as the api decides which types a core takes; from its gems'
 * types only when the name says neither.
 */
export function seriesOf(gemTypes: readonly (string | null | undefined)[], coreName: string): GemSeries | null {
  const name = coreName.trim();
  if (name.startsWith("질서")) return "질서";
  if (name.startsWith("혼돈")) return "혼돈";
  for (const type of gemTypes)
    for (const series of Object.keys(GEM_SERIES) as GemSeries[])
      if (type && (GEM_SERIES[series] as readonly string[]).includes(type)) return series;
  return null;
}

const inRange = (n: unknown) => Number.isInteger(n) && (n as number) >= GEM_MIN && (n as number) <= GEM_MAX;

/** Why a swap is not one the api takes (null when it is): the same checks as the api's 400. */
export function gemEditError(edit: GemEdit, series: GemSeries): string | null {
  if (!(GEM_SERIES[series] as readonly string[]).includes(edit.gemType)) return `${series} 코어에 넣을 수 없는 젬이에요.`;
  if (!inRange(edit.willEfficiency)) return "의지력 효율은 1~5예요.";
  if (!inRange(edit.point)) return "포인트는 1~5예요.";
  const pool = GEM_OPTIONS[edit.gemType] ?? [];
  const [a, b] = edit.effects;
  if (!pool.includes(a.name) || !pool.includes(b.name)) return `${edit.gemType} 젬에 없는 옵션이 있어요.`;
  if (a.name === b.name) return "두 옵션은 서로 달라야 해요.";
  if (!inRange(a.level) || !inRange(b.level)) return "옵션 레벨은 1~5예요.";
  return null;
}

export const sameGem = (a: GemEdit, b: GemEdit) =>
  a.gemType === b.gemType &&
  a.willEfficiency === b.willEfficiency &&
  a.point === b.point &&
  a.effects.every((effect, i) => effect.name === b.effects[i].name && effect.level === b.effects[i].level);

/**
 * The type changes: options the new type does not roll are replaced by the first options of its pool that the gem
 * does not have yet (levels kept), so the gem stays one the api takes.
 */
export function withGemType(edit: GemEdit, gemType: string): GemEdit {
  const pool = GEM_OPTIONS[gemType] ?? [];
  const kept = edit.effects.map((effect) => (pool.includes(effect.name) ? effect.name : null));
  const free = pool.filter((name) => !kept.includes(name));
  const names = kept.map((name) => name ?? free.shift() ?? pool[0]);
  return {
    ...edit,
    gemType,
    effects: [
      { name: names[0], level: edit.effects[0].level },
      { name: names[1], level: edit.effects[1].level },
    ],
  };
}

/** One gem as words: '침식 · 추가 피해 Lv.3 · 공격력 Lv.2 · 의지력 효율 4 · 5P'. */
export const gemText = (edit: GemEdit) =>
  [
    edit.gemType,
    ...edit.effects.map((effect) => `${effect.name} Lv.${effect.level}`),
    `의지력 효율 ${edit.willEfficiency}`,
    `${edit.point}P`,
  ].join(" · ");

type SlotLike = {
  index: number | null;
  name: string | null;
  gems: {
    index: number | null;
    active: boolean | null;
    name: string | null;
    gemPoint: number | null;
    corePoint: number | null;
    requiredWillpower: number | null;
    willpowerEfficiency: number | null;
    options: { name: string; level: number | null }[];
  }[];
}[];

/**
 * The equipped gems a swap can start from, as the api reads them: the type is the name's part after ': '
 * ('질서의 젬 : 안정', as the api's own gemText), the point the gem's point, 의지력 효율 the tooltip's (or base −
 * required when it is missing). A gem with an unknown type, point or two options is left out (the api could not
 * take it either); the 혼돈의 별 무기 core waits with its core (isCoreOpen).
 */
export function currentGems(slots: SlotLike, isCoreOpen: (name: string) => boolean): CurrentGem[] {
  const out: CurrentGem[] = [];
  for (const slot of slots) {
    if (slot.index == null || !slot.name || !isCoreOpen(slot.name)) continue;
    const types = slot.gems.map((gem) => gem.name?.replace(/^.*:\s*/, "") ?? null);
    const series = seriesOf(types, slot.name);
    if (!series) continue;
    slot.gems.forEach((gem, i) => {
      const gemType = types[i];
      const point = gem.gemPoint ?? gem.corePoint;
      const [a, b] = gem.options;
      // A gem of the other series cannot be in this core: left out rather than offered as a swap the api refuses.
      if (gem.index == null || !gemType || !(GEM_SERIES[series] as readonly string[]).includes(gemType)) return;
      if (point == null || !a || !b) return;
      if (a.level == null || b.level == null) return;
      const willEfficiency =
        gem.willpowerEfficiency ?? (gem.requiredWillpower != null ? GEM_BASE_WILL[gemType] - gem.requiredWillpower : null);
      if (willEfficiency == null) return;
      out.push({
        slotIndex: slot.index!,
        index: gem.index,
        core: slot.name!,
        series,
        active: gem.active !== false,
        edit: {
          gemType,
          willEfficiency,
          point,
          effects: [
            { name: a.name, level: a.level },
            { name: b.name, level: b.level },
          ],
        },
      });
    });
  }
  return out;
}

/** The api's code when the core's 의지력 runs short after the swap (api #1079): not computed, not ranked. */
export const WILL_SHORT = "ARK_GRID_WILL_SHORT";
/** Our own words for it when the api's sentence is missing; never 'coming soon'. */
export const WILL_SHORT_TEXT = "젬을 바꾸면 그 코어의 의지력이 모자라 계산하지 않았어요.";
