import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/character.openapi.json";
import type { CharacterEnvelope } from "./model";
import { tolerantSchemas } from "../api/tolerant";
import siblingsContract from "../../contracts/siblings.openapi.json";
import historyContract from "../../contracts/history.openapi.json";
import viewsContract from "../../contracts/views.openapi.json";
import type { components as SiblingsSchemas } from "../api/siblings-schema";
import type { components as HistorySchemas } from "../api/history-schema";
import type { components as ViewsSchemas } from "../api/views-schema";
import { lazyValidator } from "@/lib/api/lazy-validator";

// The backend's generated OpenAPI is also the runtime shape contract. Response
// enums are loosened: a value added later shows as unknown instead of
// rejecting the whole response (#125).
const ajv = new Ajv2020({ strict: false, validateFormats: false });
const components = { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) };
// Fields added after the first backend release. A server deployed before them
// still passes validation; the missing values get neutral defaults so the UI
// can treat them as "not provided" instead of crashing.
const ROLLOUT: Record<string, Record<string, () => unknown>> = {
  CharacterResponse: {
    refreshAvailableAt: () => null,
    skillPoints: () => null,
    siblings: () => null,
    tendencies: () => [],
    decorations: () => null,
    honorPoint: () => null,
    townName: () => null,
    townLevel: () => null,
    guildMemberGrade: () => null,
    avatars: () => [],
    collectibles: () => [],
    // Bracelet efficiency (backend #350): how much the bracelet adds to combat power.
    braceletEfficiency: () => null,
    // Ark grid efficiency (backend #424): the same shape plus cores only.
    arkGridEfficiency: () => null,
    // Kraken score (backend #561). Not sent at all while its switch is off.
    krakenScore: () => null,
  },
  CharacterLoadoutResponse: { skills: () => [] },
  CharacterObservationCoverageResponse: {
    skills: () => "NOT_PROVIDED",
    avatars: () => "NOT_PROVIDED",
    collectibles: () => "NOT_PROVIDED",
  },
  CharacterAnalysisResponse: {
    position: () => null,
    positionEvidence: () => null,
    positionRuleVersion: () => "",
  },
  StatResponse: { tooltip: () => [] },
  PassiveEffectResponse: { effect: () => null },
  // Ark grid detail (F-4, backend #90).
  ArkGridResponse: { willpower: () => null },
  GridEffectResponse: { value: () => null, percent: () => null },
  GridSlotResponse: {
    coreType: () => null,
    supplyWillpower: () => null,
    usedWillpower: () => null,
    options: () => [],
    activeOptionCount: () => 0,
    optionCount: () => 0,
    conditions: () => [],
  },
  GridGemResponse: {
    name: () => null,
    gemType: () => null,
    gemPoint: () => null,
    corePoint: () => null,
    requiredWillpower: () => null,
    baseWillpower: () => null,
    willpowerEfficiency: () => null,
    options: () => [],
  },
  // Tooltip lines (backend #228) and advanced refining (backend #234).
  EquipmentDetailResponse: {
    titleLine: () => null,
    tradeLines: () => [],
    refineExp: () => null,
    advancedRefineLevel: () => null,
  },
  // Gem tooltip lines (backend #286).
  // Gem base attack % (backend, with the kraken score inputs).
  GemResponse: {
    titleLine: () => null,
    itemLevel: () => null,
    tier: () => null,
    tradeLines: () => [],
    baseAttackPct: () => null,
    baseAttackPctSource: () => null,
  },
  // Gem-adjusted cooldown (backend #378, K20).
  SkillResponse: { attackType: () => null, cooldown: () => null },
  TripodResponse: { effect: () => null },
  RuneResponse: { effect: () => null },
};
for (const [schema, fields] of Object.entries(ROLLOUT)) {
  const target = (components.schemas as Record<string, { required?: string[] }>)[schema];
  target.required = target.required?.filter((name) => !(name in fields));
}
const fill = (object: unknown, schema: string) => {
  if (!object || typeof object !== "object") return;
  for (const [name, value] of Object.entries(ROLLOUT[schema]))
    if (!(name in object)) (object as Record<string, unknown>)[name] = value();
};
const validate = lazyValidator(() => ajv.compile<CharacterEnvelope>({
  $ref: "#/components/schemas/ApiResponseCharacterResponse",
  components,
}));

/** Validates the envelope, then fills rollout defaults in place. */
export function isCharacterEnvelope(
  value: unknown,
): value is CharacterEnvelope {
  if (
    !validate(value) ||
    value.code !== "CHARACTER_SEARCH_SUCCESS" ||
    !Number.isFinite(Date.parse(value.data.fetchedAt))
  )
    return false;
  const data = value.data;
  fill(data, "CharacterResponse");
  fill(data.loadout, "CharacterLoadoutResponse");
  fill(data.coverage, "CharacterObservationCoverageResponse");
  fill(data.analysis, "CharacterAnalysisResponse");
  for (const stat of data.stats) fill(stat, "StatResponse");
  for (const effect of data.loadout.arkPassive?.effects ?? [])
    fill(effect, "PassiveEffectResponse");
  for (const item of data.loadout.equipment) if (item.detail) fill(item.detail, "EquipmentDetailResponse");
  for (const gem of data.loadout.gems?.items ?? []) fill(gem, "GemResponse");
  for (const skill of data.loadout.skills) {
    fill(skill, "SkillResponse");
    for (const tripod of skill.tripods) fill(tripod, "TripodResponse");
    if (skill.rune) fill(skill.rune, "RuneResponse");
  }
  const grid = data.loadout.arkGrid;
  if (grid) {
    fill(grid, "ArkGridResponse");
    for (const effect of grid.effects) fill(effect, "GridEffectResponse");
    for (const slot of grid.slots) {
      fill(slot, "GridSlotResponse");
      for (const gem of slot.gems) fill(gem, "GridGemResponse");
    }
  }
  return true;
}

// Siblings (#54) and observation history (#66) use their own captured contracts.

export type SiblingsEnvelope =
  SiblingsSchemas["schemas"]["ApiResponseCharacterSiblingsResponse"];
export type HistoryEnvelope =
  HistorySchemas["schemas"]["ApiResponseCharacterHistoryResponse"];
export type HistoryPoint = HistorySchemas["schemas"]["PointResponse"];
export type ViewsEnvelope =
  ViewsSchemas["schemas"]["ApiResponseCharacterViewsResponse"];
export type DailyViews = ViewsSchemas["schemas"]["CharacterDailyViewsResponse"];

const compileWith = <T>(source: { components: object }, schema: string) =>
  lazyValidator(() => new Ajv2020({ strict: false, validateFormats: false }).compile<T>({
    $ref: `#/components/schemas/${schema}`,
    components: { ...source.components, schemas: tolerantSchemas((source.components as { schemas: Record<string, unknown> }).schemas) },
  }));
const siblings = compileWith<SiblingsEnvelope>(
  siblingsContract,
  "ApiResponseCharacterSiblingsResponse",
);
const history = compileWith<HistoryEnvelope>(
  historyContract,
  "ApiResponseCharacterHistoryResponse",
);
const views = compileWith<ViewsEnvelope>(
  viewsContract,
  "ApiResponseCharacterViewsResponse",
);
const isDate = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isTime = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

export function isSiblingsEnvelope(value: unknown): value is SiblingsEnvelope {
  return (
    siblings(value) &&
    value.code === "CHARACTER_SIBLINGS_SUCCESS" &&
    isTime(value.data.fetchedAt)
  );
}

export function isHistoryEnvelope(value: unknown): value is HistoryEnvelope {
  return (
    history(value) &&
    value.code === "CHARACTER_HISTORY_SUCCESS" &&
    value.data.points.every(
      (point) => isTime(point.observedAt) && isTime(point.lastConfirmedAt),
    )
  );
}

// Views (F-8): every day from..to, oldest first, with non-negative counts.
export function isViewsEnvelope(value: unknown): value is ViewsEnvelope {
  if (!views(value) || value.code !== "CHARACTER_VIEWS_SUCCESS") return false;
  const { days, from, to } = value.data;
  return (
    isDate(from) &&
    isDate(to) &&
    days.every(
      (day, i) =>
        isDate(day.date) &&
        Number.isSafeInteger(day.count) &&
        day.count >= 0 &&
        (i === 0 || days[i - 1].date < day.date),
    )
  );
}
