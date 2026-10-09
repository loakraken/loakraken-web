// Crit / blunt thorn / supersonic calculator (#78, crit-speed-v1). The backend
// separates observed sources from assumptions; this module turns the screen's
// settings into the assumption payload and validates requests server-side.
import type { components } from "../api/crit-speed-schema";
import { characterNameError, normalizeCharacterName } from "../character/model";
import { rateLimitCopy } from "../api/rate-limit";

type Schemas = components["schemas"];
export type Assumptions = Schemas["CritSpeedAssumptions"];
export type CritSpeedRequest = { characterName: string; assumptions: Assumptions };
export type CritSpeed = Schemas["CritSpeedResponse"];
export type CritSource = Schemas["CritSpeedSourceResponse"];
export type CritTarget = Schemas["CritSpeedTargetResponse"];
export type SwiftnessRow = Schemas["CritSpeedSwiftnessRowResponse"];
export type CritSpeedEnvelope = { code: string; message: string; data: CritSpeed };

/** Crit-rate synergy classes (+10% each, the character's own class excluded). */
export const SYNERGY_CLASSES = [
  "배틀마스터",
  "건슬링어",
  "스트라이커",
  "데빌헌터",
  "기상술사",
  "아르카나",
] as const;
export const MAX_SYNERGY = 3;

/** Supporter weakness-exposure crit buff presets (%). */
export const SUPPORT_PRESETS = [0, 1.8, 2.1, 2.5] as const;

export const SPEED_BUFFS = [
  { id: "support", label: "서포터 버프", attack: 9, move: 9 },
  { id: "feast", label: "공이속 만찬", attack: 5, move: 5 },
  { id: "food", label: "공속 음식", attack: 3, move: 0 },
] as const;
export type SpeedBuff = (typeof SPEED_BUFFS)[number]["id"];

export type Settings = {
  backAttack: boolean;
  critPet: boolean;
  supportCritRate: number;
  synergy: string[];
  tripodCritRate: number;
  extraCritRate: number;
  /** Class engraving, tripod and bracelet speed the user adds by hand (%). */
  attackSpeed: number;
  moveSpeed: number;
  buffs: SpeedBuff[];
};

/** Same starting point as the common calculators: back attack and the usual party buffs. */
export const DEFAULT_SETTINGS: Settings = {
  backAttack: true,
  critPet: false,
  supportCritRate: 0,
  synergy: [],
  tripodCritRate: 0,
  extraCritRate: 0,
  attackSpeed: 0,
  moveSpeed: 0,
  buffs: ["support", "feast"],
};

const clamp = (value: number, max: number, min = 0) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : 0;
const round2 = (value: number) => Math.round(value * 100) / 100;

export function toAssumptions(settings: Settings, className?: string | null): Assumptions {
  const buffs = SPEED_BUFFS.filter((b) => settings.buffs.includes(b.id));
  const synergy = settings.synergy.filter(
    (name) => name !== className && (SYNERGY_CLASSES as readonly string[]).includes(name),
  );
  return {
    backAttack: settings.backAttack,
    critPet: settings.critPet,
    critSynergyCount: Math.min(MAX_SYNERGY, synergy.length),
    supportCritRate: round2(clamp(settings.supportCritRate, 30)),
    tripodCritRate: round2(clamp(settings.tripodCritRate, 100)),
    extraCritRate: round2(clamp(settings.extraCritRate, 100)),
    extraAttackSpeed: round2(
      clamp(settings.attackSpeed + buffs.reduce((s, b) => s + b.attack, 0), 100, -100),
    ),
    extraMoveSpeed: round2(
      clamp(settings.moveSpeed + buffs.reduce((s, b) => s + b.move, 0), 100, -100),
    ),
  };
}

const RANGES: Record<string, [number, number]> = {
  supportCritRate: [0, 30],
  tripodCritRate: [0, 100],
  extraCritRate: [0, 100],
  // crit-speed-v2: slowdowns are negative.
  extraAttackSpeed: [-100, 100],
  extraMoveSpeed: [-100, 100],
};

/** Server-side allow-list before any backend call; unknown keys are dropped. */
export function parseCritSpeedRequest(body: unknown): CritSpeedRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (typeof input.characterName !== "string" || characterNameError(input.characterName))
    return null;
  const raw = input.assumptions ?? {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const given = raw as Record<string, unknown>;
  const assumptions: Assumptions = {};
  for (const key of ["backAttack", "critPet"] as const) {
    if (given[key] === undefined) continue;
    if (typeof given[key] !== "boolean") return null;
    assumptions[key] = given[key] as boolean;
  }
  if (given.critSynergyCount !== undefined) {
    const count = given.critSynergyCount;
    if (!Number.isInteger(count) || (count as number) < 0 || (count as number) > MAX_SYNERGY)
      return null;
    assumptions.critSynergyCount = count as number;
  }
  for (const [key, [min, max]] of Object.entries(RANGES)) {
    const value = given[key];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
      return null;
    (assumptions as Record<string, number>)[key] = value;
  }
  return { characterName: normalizeCharacterName(input.characterName), assumptions };
}

export const CATEGORY_LABEL: Record<CritSource["category"], string> = {
  STAT: "특성",
  ENGRAVING: "각인",
  ARK_PASSIVE: "아크 패시브",
  ACCESSORY: "장신구",
  BRACELET: "팔찌",
  CARD: "카드",
  ASSUMPTION: "가정",
};

export const AXIS_LABEL: Record<CritSource["axis"], string> = {
  CRIT: "치명타 적중률",
  CRIT_DAMAGE: "치명타 피해",
  ATTACK_SPEED: "공격 속도",
  MOVE_SPEED: "이동 속도",
};

export const TARGET_LABEL: Record<string, { title: string; hint: string }> = {
  CRIT_100: {
    title: "치명타 적중률 100%",
    hint: "입식 타격가처럼 100%가 상한인 경우의 목표예요.",
  },
  BLUNT_THORN_OPTIMAL: {
    title: "뭉툭한 가시 최대",
    hint: "상한을 넘은 치명타 적중률이 진화형 피해로 바뀌어 최대가 되는 지점이에요.",
  },
};

/** Sources for one axis grouped by category, in first-seen order. */
export function groupSources(sources: CritSource[], axis: CritSource["axis"]) {
  const groups = new Map<CritSource["category"], CritSource[]>();
  for (const source of sources) {
    if (source.axis !== axis) continue;
    groups.set(source.category, [...(groups.get(source.category) ?? []), source]);
  }
  return [...groups].map(([category, items]) => ({
    category,
    items,
    total: round2(items.reduce((sum, item) => sum + item.value, 0)),
  }));
}

export const percent = (value: number) =>
  `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;

export function critSpeedFailureCopy(error: { code: string }) {
  switch (error.code) {
    case "INVALID_REQUEST":
      return {
        title: "입력값을 확인해 주세요",
        text: "캐릭터 이름이나 가정 값이 허용 범위를 벗어났어요.",
      };
    case "CHARACTER_NOT_FOUND":
      return {
        title: "캐릭터를 찾지 못했어요",
        text: "이름이 정확한지 확인한 뒤 다시 검색해 주세요.",
      };
    case "LOST_ARK_RATE_LIMITED":
      return rateLimitCopy();
    case "LOST_ARK_API_TIMEOUT":
      return {
        title: "응답이 늦어지고 있어요",
        text: "조회 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.",
      };
    case "FRONTEND_API_NOT_CONFIGURED":
    case "LOST_ARK_NOT_CONFIGURED":
      return {
        title: "계산 서비스 연결을 준비하고 있어요",
        text: "서비스 연결 설정이 끝나면 이용할 수 있어요.",
      };
    case "CHARACTER_CACHE_UNAVAILABLE":
      return {
        title: "캐릭터 정보를 잠시 불러올 수 없어요",
        text: "저장소에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
      };
    default:
      return {
        title: "계산하지 못했어요",
        text: "잠시 후 다시 시도해 주세요.",
      };
  }
}
