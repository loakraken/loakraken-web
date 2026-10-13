// Class builds (backend #468·#470, checklist M12 직업 통계): for one class,
// what its observed characters wear by their last equipment summary — class
// engravings, engraving sets and single engravings, ark passive points, tier 4
// gem levels, card sets, the main combat stat and the bracelet stats. Counts are
// over LOAKraken's sample (processing-stop characters excluded), never the game.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/class-builds.openapi.json";
import type { components } from "../api/class-builds-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type ClassBuildsEnvelope = Schemas["ApiResponseClassBuildsResponse"];
export type ClassBuilds = Schemas["ClassBuildsResponse"];
export type ClassBuildHidden = Schemas["ClassBuildHidden"];

const validate = lazyValidator(() =>
  new Ajv2020({ strict: false, validateFormats: false }).compile<ClassBuildsEnvelope>({
    $ref: "#/components/schemas/ApiResponseClassBuildsResponse",
    components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
  }),
);
export const isClassBuildsEnvelope = (value: unknown): value is ClassBuildsEnvelope =>
  validate(value) && value.code === "STATS_CLASS_BUILDS_SUCCESS";

export const BUILD_DAYS = [7, 30, 90] as const;
export type BuildDays = (typeof BUILD_DAYS)[number];
export type ClassBuildsQuery = { className: string; classEngraving?: string; activeDays: BuildDays };

/** Official class names are letters only (backend: 1~16). */
export const isClassName = (value: string) => value.length >= 1 && value.length <= 16 && /^\p{L}+$/u.test(value);
const isEngraving = (value: string) => value.length >= 1 && value.length <= 32 && /^[\p{L}\p{N} ]+$/u.test(value);

/** From the page address; unknown values fall back to every class engraving and 30 days. */
export function parseClassBuildsQuery(className: string, input: URLSearchParams): ClassBuildsQuery | null {
  if (!isClassName(className)) return null;
  const engraving = input.get("classEngraving")?.trim();
  const days = Number(input.get("activeDays") ?? 30);
  return {
    className,
    classEngraving: engraving && isEngraving(engraving) ? engraving : undefined,
    activeDays: (BUILD_DAYS as readonly number[]).includes(days) ? (days as BuildDays) : 30,
  };
}

/** The page's own parameters (the class is in the path); defaults left out. */
export function classBuildsSearch(query: ClassBuildsQuery) {
  const out = new URLSearchParams();
  if (query.classEngraving) out.set("classEngraving", query.classEngraving);
  if (query.activeDays !== 30) out.set("activeDays", String(query.activeDays));
  return out;
}

export const classBuildsPath = (className: string, query?: Partial<ClassBuildsQuery>) => {
  const search = query ? classBuildsSearch({ className, activeDays: 30, ...query }).toString() : "";
  return `/stats/classes/${encodeURIComponent(className)}${search ? `?${search}` : ""}`;
};

/**
 * Sections where one character counts in several cells (engravings, bracelet
 * stats) and the gems (counted per gem) hide cells whose sum is not people:
 * those say only that small cells are hidden (PM-프론트 10-13).
 */
export function hiddenText(hidden: ClassBuildHidden | null | undefined, people: boolean) {
  if (!hidden || hidden.count <= 0) return null;
  return people ? `표본이 적은 항목 ${hidden.count.toLocaleString("ko-KR")}명은 숨김` : "표본이 적은 항목은 숨김";
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE"],
  503: ["STATS_UNAVAILABLE"],
};

export function requestClassBuilds(
  query: ClassBuildsQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<ClassBuildsEnvelope>> {
  const url = backendUrl(origin, `/api/v1/stats/classes/${encodeURIComponent(query.className)}/builds`);
  if (url) {
    if (query.classEngraving) url.searchParams.set("classEngraving", query.classEngraving);
    url.searchParams.set("activeDays", String(query.activeDays));
  }
  return requestBackend(url, { ...options, isValid: isClassBuildsEnvelope, errorCodes });
}

export const classBuildsKey = (query: ClassBuildsQuery) =>
  ["class-builds", query.className, query.classEngraving ?? null, query.activeDays] as const;
