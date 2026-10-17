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
/** One character's cells in the statistics (api #498): the same item names and keys. */
export type ClassBuildCellsEnvelope = Schemas["ApiResponseClassBuildCellsResponse"];
export type ClassBuildCellsResult = Schemas["ClassBuildCellsResponse"];
export type ClassBuildCells = Schemas["ClassBuildCells"];

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

export const BUILD_DAYS = [7, 30, 90] as const;
export type BuildDays = (typeof BUILD_DAYS)[number];

/** The six combat stats, in the statistics' fixed order. */
export const COMBAT_STATS = ["치명", "특화", "신속", "제압", "인내", "숙련"] as const;
const isCombatStat = (value: string) => (COMBAT_STATS as readonly string[]).includes(value);

/**
 * 고정 (M26 stage 2, api #503): keep only the characters that use these
 * settings and count every section again. Engravings and bracelet stats may
 * be several (each one a fix); the rest one each. Three fixes at most.
 */
export type BuildFix = {
  engravings: string[];
  cardSet?: string;
  topStat?: string;
  evolution?: number;
  enlightenment?: number;
  leap?: number;
  bracelet: string[];
};
export const MAX_FIXES = 3;
export type FixPoint = "evolution" | "enlightenment" | "leap";
/** One fix as the sections offer it: which item, which value. */
export type FixItem =
  | { kind: "engraving" | "bracelet"; value: string }
  | { kind: "cardSet" | "topStat"; value: string }
  | { kind: FixPoint; value: number };

export const NO_FIX: BuildFix = { engravings: [], bracelet: [] };
export const fixCount = (fix: BuildFix | undefined) =>
  !fix
    ? 0
    : fix.engravings.length +
      fix.bracelet.length +
      [fix.cardSet, fix.topStat, fix.evolution, fix.enlightenment, fix.leap].filter((value) => value != null).length;

export function hasFix(fix: BuildFix | undefined, item: FixItem) {
  if (!fix) return false;
  if (item.kind === "engraving") return fix.engravings.includes(item.value);
  if (item.kind === "bracelet") return fix.bracelet.includes(item.value);
  return fix[item.kind] === item.value;
}

/** Fixed or freed; adding past three changes nothing (the page says why). */
export function toggleFix(fix: BuildFix | undefined, item: FixItem): BuildFix {
  const base = fix ?? NO_FIX;
  const on = hasFix(base, item);
  if (!on && fixCount(base) >= MAX_FIXES) return base;
  if (item.kind === "engraving" || item.kind === "bracelet") {
    const key = item.kind === "engraving" ? "engravings" : "bracelet";
    return { ...base, [key]: on ? base[key].filter((v) => v !== item.value) : [...base[key], item.value] };
  }
  return { ...base, [item.kind]: on ? undefined : item.value };
}

/** Each fix in words, in the order the sections show them. */
export function fixItems(fix: BuildFix | undefined): (FixItem & { label: string })[] {
  if (!fix) return [];
  const points = { evolution: "진화", enlightenment: "깨달음", leap: "도약" } as const;
  return [
    ...fix.engravings.map((value) => ({ kind: "engraving" as const, value, label: value })),
    ...(fix.topStat ? [{ kind: "topStat" as const, value: fix.topStat, label: `주력 ${fix.topStat}` }] : []),
    ...(["evolution", "enlightenment", "leap"] as const).flatMap((kind) =>
      fix[kind] != null ? [{ kind, value: fix[kind]!, label: `${points[kind]} ${fix[kind]}` }] : [],
    ),
    ...(fix.cardSet ? [{ kind: "cardSet" as const, value: fix.cardSet, label: fix.cardSet }] : []),
    ...fix.bracelet.map((value) => ({ kind: "bracelet" as const, value, label: `팔찌 ${value}` })),
  ];
}

export type ClassBuildsQuery = { className: string; classEngraving?: string; activeDays: BuildDays; fix?: BuildFix };

/** Official class names are letters only (backend: 1~16). */
export const isClassName = (value: string) => value.length >= 1 && value.length <= 16 && /^\p{L}+$/u.test(value);
const isEngraving = (value: string) => value.length >= 1 && value.length <= 32 && /^[\p{L}\p{N} ]+$/u.test(value);
const isCardSet = (value: string) => value.length >= 1 && value.length <= 40 && /^[\p{L}\p{N} ]+$/u.test(value);
const point = (value: string | null) => {
  if (value == null || !/^\d{1,3}$/.test(value.trim())) return undefined;
  const n = Number(value);
  return n <= 300 ? n : undefined;
};

/** The fixes in an address: the ones the backend takes, unique, the first three. */
function parseFix(input: URLSearchParams): BuildFix | undefined {
  const all = (key: string, valid: (value: string) => boolean) => [
    ...new Set(input.getAll(key).map((value) => value.trim()).filter(valid)),
  ];
  const one = (key: string, valid: (value: string) => boolean) => {
    const value = input.get(key)?.trim();
    return value && valid(value) ? value : undefined;
  };
  let fix: BuildFix = NO_FIX;
  const items: FixItem[] = [
    ...all("fixEngraving", isEngraving).map((value) => ({ kind: "engraving" as const, value })),
    ...[one("fixTopStat", isCombatStat)].flatMap((value) => (value ? [{ kind: "topStat" as const, value }] : [])),
    ...(["evolution", "enlightenment", "leap"] as const).flatMap((kind) => {
      const value = point(input.get(`fix${kind[0].toUpperCase()}${kind.slice(1)}`));
      return value != null ? [{ kind, value }] : [];
    }),
    ...[one("fixCardSet", isCardSet)].flatMap((value) => (value ? [{ kind: "cardSet" as const, value }] : [])),
    ...all("fixBracelet", isCombatStat).map((value) => ({ kind: "bracelet" as const, value })),
  ];
  for (const item of items) fix = toggleFix(fix, item);
  return fixCount(fix) ? fix : undefined;
}

/** The fixes as address (and backend) parameters, in a stable order. */
function setFix(out: URLSearchParams, fix: BuildFix | undefined) {
  if (!fix) return;
  for (const name of fix.engravings) out.append("fixEngraving", name);
  if (fix.cardSet) out.set("fixCardSet", fix.cardSet);
  if (fix.topStat) out.set("fixTopStat", fix.topStat);
  if (fix.evolution != null) out.set("fixEvolution", String(fix.evolution));
  if (fix.enlightenment != null) out.set("fixEnlightenment", String(fix.enlightenment));
  if (fix.leap != null) out.set("fixLeap", String(fix.leap));
  for (const stat of fix.bracelet) out.append("fixBracelet", stat);
}

/** From the page address; unknown values fall back to every class engraving, 30 days and no fix. */
export function parseClassBuildsQuery(className: string, input: URLSearchParams): ClassBuildsQuery | null {
  if (!isClassName(className)) return null;
  const engraving = input.get("classEngraving")?.trim();
  const days = Number(input.get("activeDays") ?? 30);
  const fix = parseFix(input);
  return {
    className,
    classEngraving: engraving && isEngraving(engraving) ? engraving : undefined,
    activeDays: (BUILD_DAYS as readonly number[]).includes(days) ? (days as BuildDays) : 30,
    ...(fix ? { fix } : {}),
  };
}

/** The page's own parameters (the class is in the path); defaults left out. */
export function classBuildsSearch(query: ClassBuildsQuery) {
  const out = new URLSearchParams();
  if (query.classEngraving) out.set("classEngraving", query.classEngraving);
  if (query.activeDays !== 30) out.set("activeDays", String(query.activeDays));
  setFix(out, query.fix);
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

/** STATS_UNKNOWN_FIX: an engraving or card set fixed (an old link) that this class's statistics do not have. */
const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST", "STATS_INVALID_RANGE", "STATS_UNKNOWN_FIX"],
  503: ["STATS_UNAVAILABLE"],
};

type RequestOptions = { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number };

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

const fixKey = (fix: BuildFix | undefined) => {
  const out = new URLSearchParams();
  setFix(out, fix);
  return out.toString() || null;
};

export const classBuildsKey = (query: ClassBuildsQuery) =>
  ["class-builds", query.className, query.classEngraving ?? null, query.activeDays, fixKey(query.fix)] as const;

// --- 이 세팅을 쓰는 상위 30명 (api #503) ----------------------------------------

export type ClassBuildTopEnvelope = Schemas["ApiResponseClassBuildTopResponse"];
export type ClassBuildTop = Schemas["ClassBuildTopResponse"];
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

export const classBuildTopKey = (query: ClassBuildsQuery) => ["class-build-top", ...classBuildsKey(query).slice(1)] as const;

/** One character's cells: the class, the character and the recent-check days (the rest at the statistics' defaults). */
export type ClassBuildCellsQuery = { className: string; characterName: string; activeDays: BuildDays };

/** From the web route's address; null when the class, the name or the days are not ones the page sends. */
export function parseClassBuildCellsQuery(className: string, input: URLSearchParams): ClassBuildCellsQuery | null {
  const characterName = input.get("characterName")?.trim().normalize("NFC") ?? "";
  const days = Number(input.get("activeDays") ?? 30);
  if (!isClassName(className) || !/^[\p{L}\p{N}]{1,16}$/u.test(characterName)) return null;
  if (!(BUILD_DAYS as readonly number[]).includes(days)) return null;
  return { className, characterName, activeDays: days as BuildDays };
}

export const classBuildCellsSearch = (query: ClassBuildCellsQuery) =>
  new URLSearchParams({ characterName: query.characterName, activeDays: String(query.activeDays) });

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

export const classBuildCellsKey = (query: ClassBuildCellsQuery) =>
  ["class-build-cells", query.className, query.characterName, query.activeDays] as const;
