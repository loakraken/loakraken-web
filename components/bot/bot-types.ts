// The 18 bot bodies (bot-avatars' own type keys) with our Korean names, kept
// apart from the library so a page can list and validate them without
// loading its 65 KB canvas code.

export const BOT_TYPES = [
  "clover", "flower", "triangle", "square", "blob", "ghost",
  "circle", "drop", "star", "droid", "mech", "alien",
  "hexagon", "cat", "cloud", "pill", "pebble", "puddle",
] as const;

export type BotType = (typeof BOT_TYPES)[number];

/** What a bot is doing: waiting, busy (a search, an answer), resting. */
export type BotState = "default" | "working" | "sleeping";

export const DEFAULT_BOT: BotType = "clover";

export const BOT_NAMES: Record<BotType, string> = {
  clover: "클로버",
  flower: "꽃",
  triangle: "세모",
  square: "네모",
  blob: "말랑이",
  ghost: "유령",
  circle: "동그라미",
  drop: "물방울",
  star: "별",
  droid: "드로이드",
  mech: "메카",
  alien: "외계인",
  hexagon: "너트",
  cat: "고양이",
  cloud: "구름",
  pill: "알약",
  pebble: "조약돌",
  puddle: "웅덩이",
};

export const isBotType = (value: unknown): value is BotType =>
  typeof value === "string" && (BOT_TYPES as readonly string[]).includes(value);

/** What a bot can wear (bot-avatars' own option names, user 11-03): a hat
 *  and glasses, chosen in the picker beside the body. */
export const BOT_HATS = ["none", "beret", "beanie", "party", "crown"] as const;
export const BOT_GLASSES = ["none", "round", "square", "shades"] as const;
export type BotHat = (typeof BOT_HATS)[number];
export type BotGlasses = (typeof BOT_GLASSES)[number];
export type BotWear = { hat: BotHat; glasses: BotGlasses };
export const NO_WEAR: BotWear = { hat: "none", glasses: "none" };

export const HAT_NAMES: Record<BotHat, string> = {
  none: "없음",
  beret: "베레모",
  beanie: "비니",
  party: "고깔",
  crown: "왕관",
};
export const GLASSES_NAMES: Record<BotGlasses, string> = {
  none: "없음",
  round: "동그란 안경",
  square: "네모 안경",
  shades: "선글라스",
};

export const isBotHat = (value: unknown): value is BotHat =>
  typeof value === "string" && (BOT_HATS as readonly string[]).includes(value);
export const isBotGlasses = (value: unknown): value is BotGlasses =>
  typeof value === "string" && (BOT_GLASSES as readonly string[]).includes(value);
