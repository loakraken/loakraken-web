// Backend side of class-builds.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// class-builds.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/class-builds.openapi.json";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { classBuildCellsSearch, setFix, type ClassBuildsEnvelope, type ClassBuildCellsEnvelope, type ClassBuildTopEnvelope, type ClassBuildsQuery, type RequestOptions, type ClassBuildCellsQuery } from "./class-builds";

const compile = <T>(ref: string) =>
  lazyValidator(() =>
    new Ajv2020({ strict: false, validateFormats: false }).compile<T>({
      $ref: `#/components/schemas/${ref}`,
      components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
    }),
  );

const validate = compile<ClassBuildsEnvelope>("ApiResponseClassBuildsResponse");

export const isClassBuildsEnvelope = (value: unknown): value is ClassBuildsEnvelope =>
  validate(value) && value.code === "STATS_CLASS_BUILDS_SUCCESS";

const validateCells = compile<ClassBuildCellsEnvelope>("ApiResponseClassBuildCellsResponse");

export const isClassBuildCellsEnvelope = (value: unknown): value is ClassBuildCellsEnvelope =>
  validateCells(value) && value.code === "STATS_CLASS_BUILDS_SUCCESS";

/** STATS_UNKNOWN_FIX: an engraving or card set fixed (an old link) that this class's statistics do not have. */
const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE", "STATS_UNKNOWN_FIX"],
  503: ["STATS_UNAVAILABLE"],
};

/** The backend address for one class's builds (or a path under it) with the page's conditions and fixes. */
function buildsUrl(query: ClassBuildsQuery, origin: string | undefined, path = "") {
  const url = backendUrl(origin, `/api/v1/stats/classes/${encodeURIComponent(query.className)}/builds${path}`);
  if (url) {
    if (query.classEngraving) url.searchParams.set("classEngraving", query.classEngraving);
    url.searchParams.set("activeDays", String(query.activeDays));
    setFix(url.searchParams, query.fix);
  }
  return url;
}

export function requestClassBuilds(
  query: ClassBuildsQuery,
  origin: string | undefined,
  options: RequestOptions = {},
): Promise<BackendResult<ClassBuildsEnvelope>> {
  return requestBackend(buildsUrl(query, origin), { ...options, isValid: isClassBuildsEnvelope, errorCodes });
}

const validateTop = compile<ClassBuildTopEnvelope>("ApiResponseClassBuildTopResponse");

export const isClassBuildTopEnvelope = (value: unknown): value is ClassBuildTopEnvelope =>
  validateTop(value) && value.code === "STATS_CLASS_BUILDS_SUCCESS";

/** The highest observed combat power among the characters the page's conditions and fixes keep (30 at most, none under 30). */
export function requestClassBuildTop(
  query: ClassBuildsQuery,
  origin: string | undefined,
  options: RequestOptions = {},
): Promise<BackendResult<ClassBuildTopEnvelope>> {
  return requestBackend(buildsUrl(query, origin, "/top"), { ...options, isValid: isClassBuildTopEnvelope, errorCodes });
}

const cellsErrorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_CACHED"],
  503: ["CHARACTER_STORAGE_UNAVAILABLE"],
};

/** No official call behind it: an unknown character is 404 CHARACTER_NOT_CACHED. */
export function requestClassBuildCells(
  query: ClassBuildCellsQuery,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<ClassBuildCellsEnvelope>> {
  const url = backendUrl(origin, `/api/v1/stats/classes/${encodeURIComponent(query.className)}/builds/character`);
  if (url) for (const [key, value] of classBuildCellsSearch(query)) url.searchParams.set(key, value);
  return requestBackend(url, { ...options, isValid: isClassBuildCellsEnvelope, errorCodes: cellsErrorCodes });
}
