// Official armory page details (backend draft contract, 19:58): tripod
// levels, the skill code and life skills, read from the official armory page
// on the backend behind a flag that is off by default. Off, the backend still
// answers 200 with every field null (enabled: false) and the screen leaves no
// trace of them. The contract is a draft: the validator checks the shape the
// screen uses and is re-captured from the backend's OpenAPI when it ships.
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { characterNameError, normalizeCharacterName } from "./model";

export type ArmoryPageTripod = { tier: number | null; slot: number | null; name: string | null; level?: number | null };
export type ArmoryPage = {
  characterName: string;
  enabled: boolean;
  source: string | null;
  fetchedAt: string | null;
  skills: { name: string | null; tripods: ArmoryPageTripod[] }[] | null;
  skillCode: string | null;
  lifeSkills: { name: string | null; level?: number | null; grade?: string | null }[] | null;
};
export type ArmoryPageEnvelope = { code: string; message: string; data: ArmoryPage };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const nullableString = (value: unknown) => value === null || typeof value === "string";
const nullableNumber = (value: unknown) => value === null || value === undefined || typeof value === "number";

export function isArmoryPageEnvelope(value: unknown): value is ArmoryPageEnvelope {
  if (!isObject(value) || value.code !== "CHARACTER_ARMORY_PAGE_SUCCESS" || !isObject(value.data)) return false;
  const data = value.data;
  if (typeof data.characterName !== "string" || typeof data.enabled !== "boolean") return false;
  if (!nullableString(data.source) || !nullableString(data.fetchedAt) || !nullableString(data.skillCode)) return false;
  if (data.skills !== null) {
    if (!Array.isArray(data.skills)) return false;
    for (const skill of data.skills) {
      if (!isObject(skill) || !nullableString(skill.name) || !Array.isArray(skill.tripods)) return false;
      for (const tripod of skill.tripods)
        if (!isObject(tripod) || !nullableNumber(tripod.tier) || !nullableNumber(tripod.slot) || !nullableNumber(tripod.level))
          return false;
    }
  }
  if (data.lifeSkills !== null && !Array.isArray(data.lifeSkills)) return false;
  return true;
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_FOUND", "CHARACTER_NOT_CACHED"],
  503: ["CHARACTER_CACHE_UNAVAILABLE"],
};
const invalid = { ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } };

export function requestArmoryPage(
  name: string,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<ArmoryPageEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/armory-page");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  return requestBackend(url, { ...options, isValid: isArmoryPageEnvelope, errorCodes });
}

/** The level of the tripod at (tier, slot) of the skill named `name`, or null. */
export function tripodLevel(page: ArmoryPage | undefined, name: string | null, tier: number | null, slot: number | null) {
  if (!page?.enabled || !name) return null;
  const skill = page.skills?.find((item) => item.name === name);
  return skill?.tripods.find((tripod) => tripod.tier === tier && tripod.slot === slot)?.level ?? null;
}
