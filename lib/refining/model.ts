// T4 refining expected cost (#70). The backend returns per-stage attempt
// statistics and the material/gold cost of the expected and worst case; every
// attempt of a stage costs the same, so other percentiles scale linearly.
import type { components } from "../api/refining-schema";
import type { Character } from "../character/model";
import type { MaterialPrice } from "../market/model";
import { rateLimitCopy } from "../api/rate-limit";

type Schemas = components["schemas"];
export type PlanRequest = Schemas["RefiningPlanRequest"];
export type Plan = Schemas["RefiningPlanResponse"];
export type PlanStage = Schemas["StageResponse"];
export type Quantity = Schemas["QuantityResponse"];
export type PlanEnvelope = { code: string; message: string; data: Plan };
export type Grade = PlanRequest["grade"];
export type EquipmentType = PlanRequest["equipmentType"];

export const MIN_STAGE = 10;
export const MAX_STAGE = 25;
/** Each refining stage adds 5 item level to one of the six parts. */
export const ITEM_LEVEL_PER_STAGE = 5;

export const GRADES: { value: Grade; label: string }[] = [
  { value: "UPHWA", label: "운명의 업화" },
  { value: "JEONYUL", label: "운명의 전율" },
];

export const PARTS = [
  { id: "weapon", slot: "무기", label: "무기", type: "WEAPON" },
  { id: "helmet", slot: "투구", label: "머리", type: "ARMOR" },
  { id: "chest", slot: "상의", label: "상의", type: "ARMOR" },
  { id: "pants", slot: "하의", label: "하의", type: "ARMOR" },
  { id: "gloves", slot: "장갑", label: "장갑", type: "ARMOR" },
  { id: "shoulder", slot: "어깨", label: "어깨", type: "ARMOR" },
] as const satisfies readonly {
  id: string;
  slot: string;
  label: string;
  type: EquipmentType;
}[];
export type PartId = (typeof PARTS)[number]["id"];

export type PartState = {
  /** Excluded parts are neither requested nor counted in the item level. */
  enabled: boolean;
  grade: Grade;
  current: number;
  target: number;
  artisanEnergy: number;
  failedAttempts: number;
};

export type Options = {
  weaponBreath: boolean;
  armorBreath: boolean;
  weaponBook: boolean;
  armorBook: boolean;
  growthSupport: boolean;
};

export const MODES = [
  {
    id: "expected",
    label: "평균",
    hint: "확률 분포의 평균이에요. 여러 번 해 보면 이 값에 가까워져요.",
  },
  {
    id: "median",
    label: "50%",
    hint: "단계마다 절반의 확률로 이 시도 안에 성공해요. 단계별 값을 더했어요.",
  },
  {
    id: "p90",
    label: "90%",
    hint: "단계마다 90% 확률로 이 시도 안에 성공해요. 단계별 값을 더했어요.",
  },
  {
    id: "max",
    label: "장인의 기운",
    hint: "모든 단계가 장인의 기운 100%로 확정될 때까지 실패한 경우예요.",
  },
] as const;
export type Mode = (typeof MODES)[number]["id"];

export function gradeFromName(name: string | null | undefined): Grade | null {
  if (!name) return null;
  if (name.includes("운명의 업화")) return "UPHWA";
  if (name.includes("운명의 전율")) return "JEONYUL";
  return null;
}

export const defaultPart = (grade: Grade = "UPHWA"): PartState => ({
  enabled: true,
  grade,
  current: 18,
  target: 18,
  artisanEnergy: 0,
  failedAttempts: 0,
});

export type CharacterParts = {
  parts: Record<PartId, PartState>;
  /** Parts that could not be read (not T4 업화/전율, or no refine level). */
  unsupported: string[];
  itemLevel: number | null;
};

/** Current stage and grade per part from the character's equipment tooltips. */
export function partsFromCharacter(data: Character): CharacterParts {
  const parts = {} as Record<PartId, PartState>;
  const unsupported: string[] = [];
  for (const part of PARTS) {
    const item = data.loadout.equipment.find((e) => e.type === part.slot);
    const grade = gradeFromName(item?.name);
    const level = item?.detail?.refineLevel;
    if (grade && level != null && level >= MIN_STAGE && level <= MAX_STAGE)
      parts[part.id] = { ...defaultPart(grade), current: level, target: level };
    else {
      parts[part.id] = { ...defaultPart(), enabled: false };
      unsupported.push(part.label);
    }
  }
  return { parts, unsupported, itemLevel: data.itemLevel ?? null };
}

export function toRequest(
  part: (typeof PARTS)[number],
  state: PartState,
  options: Options,
): PlanRequest | null {
  if (!state.enabled || state.target <= state.current) return null;
  const weapon = part.type === "WEAPON";
  return {
    grade: state.grade,
    equipmentType: part.type,
    fromStage: state.current,
    toStage: state.target,
    useBreath: weapon ? options.weaponBreath : options.armorBreath,
    useBook:
      (weapon ? options.weaponBook : options.armorBook) &&
      state.grade === "UPHWA" &&
      state.current < 20,
    growthSupport: options.growthSupport && state.grade === "UPHWA",
    currentArtisanEnergy: state.artisanEnergy,
    currentFailedAttempts: state.failedAttempts,
  };
}

/** Stable cache key: identical armor plans are requested once. */
export const requestKey = (request: PlanRequest) =>
  JSON.stringify([
    request.grade,
    request.equipmentType,
    request.fromStage,
    request.toStage,
    request.useBreath,
    request.useBook,
    request.growthSupport,
    request.currentArtisanEnergy,
    request.currentFailedAttempts,
  ]);

const isInt = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/** Server-side allow-list before any backend call. */
export function parsePlanRequest(body: unknown): PlanRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  if (input.grade !== "UPHWA" && input.grade !== "JEONYUL") return null;
  if (input.equipmentType !== "WEAPON" && input.equipmentType !== "ARMOR")
    return null;
  if (!isInt(input.fromStage, MIN_STAGE, MAX_STAGE - 1)) return null;
  if (!isInt(input.toStage, MIN_STAGE + 1, MAX_STAGE)) return null;
  if ((input.toStage as number) <= (input.fromStage as number)) return null;
  const flag = (key: string) => {
    const value = input[key] ?? false;
    return typeof value === "boolean" ? value : null;
  };
  const useBreath = flag("useBreath");
  const useBook = flag("useBook");
  const growthSupport = flag("growthSupport");
  if (useBreath === null || useBook === null || growthSupport === null)
    return null;
  const energy = input.currentArtisanEnergy ?? 0;
  if (
    typeof energy !== "number" ||
    !Number.isFinite(energy) ||
    energy < 0 ||
    energy > 100
  )
    return null;
  const failed = input.currentFailedAttempts ?? 0;
  if (!isInt(failed, 0, 10)) return null;
  return {
    grade: input.grade,
    equipmentType: input.equipmentType,
    fromStage: input.fromStage as number,
    toStage: input.toStage as number,
    useBreath,
    useBook,
    growthSupport,
    currentArtisanEnergy: energy,
    currentFailedAttempts: failed as number,
  };
}

export function attemptsAt(stage: PlanStage, mode: Mode) {
  switch (mode) {
    case "expected":
      return stage.expectedAttempts;
    case "median":
      return stage.medianAttempts;
    case "p90":
      return stage.p90Attempts;
    case "max":
      return stage.maxAttempts;
  }
}

/** Fraction of the worst case a mode represents for one stage. */
const share = (stage: PlanStage, mode: Mode) =>
  stage.maxAttempts > 0 ? attemptsAt(stage, mode) / stage.maxAttempts : 0;

export function stageMaterials(stage: PlanStage, mode: Mode): Quantity[] {
  if (mode === "expected") return stage.expectedMaterials;
  if (mode === "max") return stage.worstCaseMaterials;
  const ratio = share(stage, mode);
  return stage.worstCaseMaterials.map((item) => ({
    name: item.name,
    amount: item.amount * ratio,
  }));
}

export function stageGold(stage: PlanStage, mode: Mode) {
  if (mode === "expected") return stage.expectedGold;
  if (mode === "max") return stage.worstCaseGold;
  return stage.worstCaseGold * share(stage, mode);
}

/** Merge quantities by name, keeping first-seen order. */
export function sumQuantities(lists: Quantity[][]): Quantity[] {
  const totals = new Map<string, number>();
  for (const list of lists)
    for (const item of list)
      totals.set(item.name, (totals.get(item.name) ?? 0) + item.amount);
  return [...totals].map(([name, amount]) => ({ name, amount }));
}

export type PartPlan = { part: (typeof PARTS)[number]; plan: Plan };

export function summarize(plans: PartPlan[], mode: Mode) {
  const stages = plans.flatMap(({ plan }) => plan.stages);
  const materials = sumQuantities(
    stages.map((stage) => stageMaterials(stage, mode)),
  ).map((item) => ({ ...item, amount: Math.ceil(item.amount - 1e-9) }));
  const gold = Math.ceil(
    stages.reduce((sum, stage) => sum + stageGold(stage, mode), 0) - 1e-9,
  );
  const attempts = stages.reduce(
    (sum, stage) => sum + attemptsAt(stage, mode),
    0,
  );
  return { materials, gold, attempts, stageCount: stages.length };
}

/** Item level after refining: the average of six parts moves by 5 per stage. */
export function targetItemLevel(
  current: number | null,
  parts: Record<PartId, PartState>,
) {
  if (current == null) return null;
  const stages = PARTS.reduce(
    (sum, part) =>
      sum +
      (parts[part.id].enabled
        ? Math.max(0, parts[part.id].target - parts[part.id].current)
        : 0),
    0,
  );
  return Math.round((current + (stages * ITEM_LEVEL_PER_STAGE) / 6) * 100) / 100;
}

export const formatLevel = (value: number) =>
  value.toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function formatCount(value: number, digits = 0) {
  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function refiningFailureCopy(error: { code: string }) {
  switch (error.code) {
    case "INVALID_REQUEST":
      return {
        title: "단계 설정을 확인해 주세요",
        text: "현재 단계는 10~24, 목표 단계는 현재보다 높은 11~25로 입력해 주세요.",
      };
    case "FRONTEND_API_NOT_CONFIGURED":
      return {
        title: "계산 서비스 연결을 준비하고 있어요",
        text: "서비스 연결 설정이 완료되면 재련 비용을 계산할 수 있어요.",
      };
    case "LOST_ARK_RATE_LIMITED":
      return rateLimitCopy();
    case "LOST_ARK_API_TIMEOUT":
      return {
        title: "응답이 늦어지고 있어요",
        text: "계산 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.",
      };
    default:
      return {
        title: "재련 비용을 계산하지 못했어요",
        text: "잠시 후 다시 시도해 주세요. 자동으로 재요청하지 않아요.",
      };
  }
}

export type CostLine = {
  name: string;
  amount: number;
  owned: number;
  missing: number;
  price: MaterialPrice | null;
  /** Gold for the missing quantity; null when the material has no price. */
  cost: number | null;
};

/** Missing quantity × unit price (#76). Unpriced materials stay out of the total. */
export function costLines(
  materials: Quantity[],
  owned: Record<string, number>,
  prices: MaterialPrice[] | null,
) {
  const lines: CostLine[] = materials.map((item) => {
    const have = Math.max(0, owned[item.name] ?? 0);
    const missing = Math.max(0, item.amount - have);
    const price = prices?.find((p) => p.name === item.name) ?? null;
    const unit = price?.status === "PRICED" ? price.unitPriceGold : null;
    return {
      name: item.name,
      amount: item.amount,
      owned: have,
      missing,
      price,
      cost: missing === 0 ? 0 : unit == null ? null : missing * unit,
    };
  });
  const known = lines.reduce((sum, line) => sum + (line.cost ?? 0), 0);
  return {
    lines,
    materialGold: Math.ceil(known - 1e-9),
    unpriced: lines.filter((line) => line.cost === null).map((l) => l.name),
  };
}
