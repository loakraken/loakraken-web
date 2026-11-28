// What 장신구 매물 검색 keeps in the address (M51 follow-up, PM 총괄 11-22 13:31): its search conditions, checked
// against the model, so a hand-edited or stale link falls back instead of asking for something the search does not
// take. Not the search itself: it reads the auction (rate-limited), so a shared link opens the conditions and the
// user presses 검색.
import {
  ENLIGHTENMENT_MAX,
  GRADES,
  LEVELS,
  POLISH_OPTIONS,
  ROLES,
  SLOTS,
  type Level,
  type PolishOption,
} from "../accessory-search/model";
import { oneOfCodec, type UrlCodec } from "./url-state";

/** The screen's 상관없음 / 연마 효과 상관없음 values (accessory-search.tsx). */
export const ACCESSORY_ANY = "ANY";
export const ACCESSORY_OFF = "OFF";
/** The 힘민지 범위 and 품질 steps the screen offers. */
export const ACCESSORY_RANGE_STEPS = [50, 60, 70, 80, 90] as const;
export const ACCESSORY_QUALITY_STEPS = [50, 70, 90] as const;

export const ACCESSORY_SLOT_CODEC = oneOfCodec(SLOTS.map((s) => s.id));
export const ACCESSORY_GRADE_CODEC = oneOfCodec(GRADES.map((g) => g.id));
export const ACCESSORY_ROLE_CODEC = oneOfCodec(ROLES.map((r) => r.id));

/** 깨달음 최소: 상관없음 or 1 up to the highest any slot takes (the screen clamps to the picked slot's). */
const enlightenmentTop = Math.max(...Object.values(ENLIGHTENMENT_MAX).flatMap((bySlot) => Object.values(bySlot)));
export const ACCESSORY_ENLIGHTENMENT_CODEC = oneOfCodec([
  ACCESSORY_ANY,
  ...Array.from({ length: enlightenmentTop }, (_, i) => String(i + 1)),
]);
export const ACCESSORY_RANGE_CODEC = oneOfCodec([ACCESSORY_ANY, ...ACCESSORY_RANGE_STEPS.map(String)]);
export const ACCESSORY_QUALITY_CODEC = oneOfCodec([ACCESSORY_ANY, ...ACCESSORY_QUALITY_STEPS.map(String)]);

export type PolishPick = Level | typeof ACCESSORY_ANY | typeof ACCESSORY_OFF;
export type PolishPicks = Partial<Record<PolishOption, PolishPick>>;

const isOption = (value: string): value is PolishOption => Object.hasOwn(POLISH_OPTIONS, value);
const kept = (value: string): value is Level | typeof ACCESSORY_ANY =>
  value === ACCESSORY_ANY || LEVELS.some((level) => level.id === value);

/**
 * 연마 효과: "OPTION:VALUE" pairs comma-joined, sorted by option so the same picks are the same address. 상관없음
 * (OFF, the default) is left out; only exactly two parts with an option and a value the model has are read.
 */
export const ACCESSORY_POLISH_CODEC: UrlCodec<PolishPicks> = {
  parse: (raw) =>
    Object.fromEntries(
      raw.split(",").flatMap((pair) => {
        const parts = pair.split(":");
        return parts.length === 2 && isOption(parts[0]) && kept(parts[1]) ? [[parts[0], parts[1]]] : [];
      }),
    ),
  format: (value) =>
    Object.entries(value)
      .filter(([option, pick]) => isOption(option) && pick != null && kept(pick))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([option, pick]) => `${option}:${pick}`)
      .join(","),
};
