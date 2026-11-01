// 수집품 icons (feedback #17, user 10-31): the official armory's own small
// collection icons, drawn from its sprite like the official page does.
// Source: the 전투정보실 stylesheet profile.pc.css, rules
// `.profile-collection #tab1 .lui-tab__content.<class> .field .count em`
// (background-position + size on sprite_profile.png, 257×255), read
// 2026-10-31. Hotlinked from the official CDN, never copied. 크림스네일 = the
// "chart" class, checked by eye against the official art. A type not listed
// here (a new one) keeps the API's badge icon.
import { safeGameImage } from "./model";

export const COLLECTIBLE_SPRITE = safeGameImage(
  "https://cdn-lostark.game.onstove.com/2018/obt/assets/images/pc/sprite/sprite_profile.png",
);
export const COLLECTIBLE_SPRITE_SIZE = { width: 257, height: 255 } as const;

export type SpriteIcon = { x: number; y: number; width: number; height: number };

const ICONS: Record<string, SpriteIcon> = {
  "거인의 심장": { x: -197, y: -171, width: 23, height: 22 },
  "섬의 마음": { x: -234, y: -23, width: 23, height: 22 },
  "모코코 씨앗": { x: -234, y: -92, width: 23, height: 22 },
  "위대한 미술품": { x: -173, y: -171, width: 23, height: 22 },
  "항해 모험물": { x: -234, y: -115, width: 23, height: 22 },
  "세계수의 잎": { x: -234, y: -46, width: 23, height: 22 },
  "이그네아의 징표": { x: -234, y: 0, width: 23, height: 22 },
  "오르페우스의 별": { x: -234, y: -69, width: 23, height: 22 },
  "기억의 오르골": { x: 0, y: -235, width: 20, height: 20 },
  "크림스네일의 해도": { x: 0, y: -216, width: 24, height: 18 },
  "누크만의 환영석": { x: -25, y: -216, width: 21, height: 17 },
};

/** The sprite icon for an official collection type (spaces ignored), or null. */
export function collectibleSpriteIcon(type: string | null | undefined): SpriteIcon | null {
  if (!type) return null;
  const key = type.replace(/\s+/g, "");
  const found = Object.entries(ICONS).find(([name]) => name.replace(/\s+/g, "") === key);
  return found ? found[1] : null;
}
