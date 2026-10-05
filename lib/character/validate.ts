import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/character.openapi.json";
import type { CharacterEnvelope } from "./model";
import siblingsContract from "../../contracts/siblings.openapi.json";
import historyContract from "../../contracts/history.openapi.json";
import type { components as SiblingsSchemas } from "../api/siblings-schema";
import type { components as HistorySchemas } from "../api/history-schema";

// The backend's generated OpenAPI is also the runtime shape contract.
const ajv = new Ajv2020({ strict: false, validateFormats: false });
const components = structuredClone(contract.components);
// A newly added rule must not hide an otherwise valid character response.
// Keep categories, evidence shape, and every other generated constraint strict.
Reflect.deleteProperty(
  components.schemas.DiagnosticFindingResponse.properties.code,
  "enum",
);
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
const validate = ajv.compile<CharacterEnvelope>({
  $ref: "#/components/schemas/ApiResponseCharacterResponse",
  components,
});

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
  return true;
}

// Siblings (#54) and observation history (#66) use their own captured contracts.

export type SiblingsEnvelope =
  SiblingsSchemas["schemas"]["ApiResponseCharacterSiblingsResponse"];
export type HistoryEnvelope =
  HistorySchemas["schemas"]["ApiResponseCharacterHistoryResponse"];
export type HistoryPoint = HistorySchemas["schemas"]["PointResponse"];

const compileWith = <T>(source: { components: object }, schema: string) =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<T>({
    $ref: `#/components/schemas/${schema}`,
    components: source.components,
  });
const siblings = compileWith<SiblingsEnvelope>(
  siblingsContract,
  "ApiResponseCharacterSiblingsResponse",
);
const history = compileWith<HistoryEnvelope>(
  historyContract,
  "ApiResponseCharacterHistoryResponse",
);
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
