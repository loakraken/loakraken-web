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
