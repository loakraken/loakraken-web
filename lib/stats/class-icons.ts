// Official class icons (stats gap A1): the game site's own class SVGs, read
// from its stylesheet's .icon--<class> rules (checked 2026-10-25). Hotlinked
// from the official CDN, never copied. Fills differ (black, #222, white), so
// the theme flattens each to one colour. A class missing here (a new one) gets
// a text chip instead. 차원술사: dimension_master.svg in the same official
// folder (checked 2026-10-28, HTTP 200).
const BASE = "https://cdn-lostark.game.onstove.com/2018/obt/assets/images/common/class/";

const FILES: Record<string, string> = {
  디스트로이어: "destroyer",
  워로드: "warlord",
  버서커: "berserker",
  홀리나이트: "holyknight",
  슬레이어: "slayer",
  발키리: "valkyrie",
  배틀마스터: "battlemaster",
  인파이터: "infighter",
  기공사: "soulmaster",
  창술사: "lancemaster",
  스트라이커: "striker",
  브레이커: "breaker",
  데빌헌터: "devilhunter",
  블래스터: "blaster",
  호크아이: "hawkeye",
  스카우터: "scouter",
  건슬링어: "gunslinger",
  바드: "bard",
  서머너: "summoner",
  아르카나: "arcana",
  소서리스: "elementalmaster",
  블레이드: "blade",
  데모닉: "demonic",
  리퍼: "reaper",
  소울이터: "souleater",
  도화가: "artist",
  기상술사: "aeromancer",
  환수사: "wildsoul",
  가디언나이트: "dragon_knight",
  차원술사: "dimension_master",
};

/** The class's official icon address, or null for a class this build does not know. */
export function classIconUrl(className: string): string | null {
  const file = Object.hasOwn(FILES, className) ? FILES[className] : null;
  return file ? `${BASE}${file}.svg` : null;
}

/** The text chip for a class without an icon: its first two letters. */
export const classChip = (className: string) => [...className].slice(0, 2).join("");
