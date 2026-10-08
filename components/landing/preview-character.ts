// Example character for the landing preview: a 블레이드 on the current top
// equipment tier (운명의 전율 T4, 고대 accessories, 10레벨 겁화·작열), with a few
// pieces one step below the maximum so the preview has something to point at.
// Icons are the official game CDN atlas entries for these exact items.
const ICON = "https://cdn-lostark.game.onstove.com/efui_iconatlas/";

export const previewCharacter = {
  name: "블레이드",
  className: "블레이드",
  server: "아만",
  combatLevel: 70,
  emblem: "https://cdn-lostark.game.onstove.com/2018/obt/assets/images/common/thumb/emblem_blade.png",
};

type Piece = { slot: string; name: string; refine: number; quality: number; grade: string; icon: string };

// Item level per piece: 1,800 at +25, 5 per refine step.
export const armor: Piece[] = [
  { slot: "무기", name: "운명의 전율 검", refine: 25, quality: 100, grade: "고대", icon: `${ICON}bl_item/bl_item_219.png` },
  { slot: "머리", name: "운명의 전율 머리장식", refine: 25, quality: 100, grade: "고대", icon: `${ICON}bl_item/bl_item_207.png` },
  { slot: "어깨", name: "운명의 전율 견갑", refine: 24, quality: 96, grade: "고대", icon: `${ICON}bl_item/bl_item_206.png` },
  { slot: "상의", name: "운명의 전율 상의", refine: 25, quality: 100, grade: "고대", icon: `${ICON}bl_item/bl_item_215.png` },
  { slot: "하의", name: "운명의 전율 하의", refine: 24, quality: 93, grade: "고대", icon: `${ICON}bl_item/bl_item_205.png` },
  { slot: "장갑", name: "운명의 전율 장갑", refine: 25, quality: 100, grade: "고대", icon: `${ICON}bl_item/bl_item_20.png` },
];

export const itemLevel = armor.reduce((sum, piece) => sum + 1675 + piece.refine * 5, 0) / armor.length;

export const accessories = [
  { slot: "목걸이", name: "도래한 결전의 목걸이", grade: "고대", quality: 95, icon: `${ICON}acc/acc_215.png` },
  { slot: "귀걸이", name: "도래한 결전의 귀걸이", grade: "고대", quality: 98, icon: `${ICON}acc/acc_115.png` },
  { slot: "귀걸이", name: "도래한 결전의 귀걸이", grade: "유물", quality: 84, icon: `${ICON}acc/acc_115.png` },
  { slot: "반지", name: "도래한 결전의 반지", grade: "고대", quality: 91, icon: `${ICON}acc/acc_22.png` },
  { slot: "반지", name: "도래한 결전의 반지", grade: "고대", quality: 88, icon: `${ICON}acc/acc_22.png` },
  { slot: "팔찌", name: "찬란한 구원자의 팔찌", grade: "고대", quality: null, icon: `${ICON}acc/acc_327.png` },
  { slot: "어빌리티 스톤", name: "위대한 비상의 돌", grade: "고대", quality: null, icon: `${ICON}ability/ability_246.png` },
];

const DAMAGE = { 10: `${ICON}use/use_12_105.png`, 9: `${ICON}use/use_12_104.png` } as const;
const COOLDOWN = { 10: `${ICON}use/use_12_115.png`, 9: `${ICON}use/use_12_114.png` } as const;
type Gem = { level: 9 | 10; kind: "겁화" | "작열"; skill: string; icon: string };
const gem = (kind: Gem["kind"], level: Gem["level"], skill: string): Gem => ({
  kind,
  level,
  skill,
  icon: (kind === "겁화" ? DAMAGE : COOLDOWN)[level],
});

export const gems: Gem[] = [
  gem("겁화", 10, "블레이드 댄스"),
  gem("겁화", 10, "윈드 컷"),
  gem("겁화", 10, "서프라이즈 어택"),
  gem("겁화", 10, "어퍼 슬래쉬"),
  gem("겁화", 10, "터닝 슬래쉬"),
  gem("겁화", 9, "마엘스톰"),
  gem("작열", 10, "블레이드 댄스"),
  gem("작열", 10, "윈드 컷"),
  gem("작열", 10, "서프라이즈 어택"),
  gem("작열", 10, "어퍼 슬래쉬"),
  gem("작열", 9, "터닝 슬래쉬"),
];

export const gemAverage = gems.reduce((sum, g) => sum + g.level, 0) / gems.length;
export const belowMaxGems = gems.filter((g) => g.level < 10);
