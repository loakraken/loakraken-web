// The rest of each official item tooltip (backend #227): durability, "분해불가",
// descriptions, where to get it — lines the search response leaves out. Read
// from the backend's character cache only (no official call); keyed to the
// search response by equipment index + type, gem/card slot and skill name.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/item-tooltips.openapi.json";
import type { components } from "../api/item-tooltips-schema";
import { backendUrl, requestBackend, type BackendResult } from "../api/backend";
import { tolerantSchemas } from "../api/tolerant";
import { characterNameError, normalizeCharacterName } from "./model";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type ItemTooltipsEnvelope = Schemas["ApiResponseCharacterItemTooltipsResponse"];
export type ItemTooltips = Schemas["CharacterItemTooltipsResponse"];

// A backend before #286 has no extraLineSections (the lines then stay at the end).
const ROLLOUT: Record<string, string[]> = { EquipmentLinesResponse: ["extraLineSections"] };
const validate = lazyValidator(() => {
  const schemas = tolerantSchemas(contract.components.schemas) as Record<string, { required?: string[] }>;
  for (const [name, fields] of Object.entries(ROLLOUT))
    schemas[name] = { ...schemas[name], required: schemas[name].required?.filter((field) => !fields.includes(field)) };
  return new Ajv2020({ strict: false, validateFormats: false }).compile<ItemTooltipsEnvelope>({
    $ref: "#/components/schemas/ApiResponseCharacterItemTooltipsResponse",
    components: { ...contract.components, schemas },
  });
});

export function isItemTooltipsEnvelope(value: unknown): value is ItemTooltipsEnvelope {
  return validate(value) && value.code === "CHARACTER_ITEM_TOOLTIPS_SUCCESS";
}

const errorCodes: Record<number, readonly string[]> = {
  400: ["INVALID_REQUEST"],
  404: ["CHARACTER_NOT_FOUND", "CHARACTER_NOT_CACHED"],
  429: ["LOST_ARK_RATE_LIMITED"],
  503: ["CHARACTER_CACHE_UNAVAILABLE"],
};
const invalid = { ok: false as const, error: { code: "INVALID_REQUEST", status: 400 } };

export function requestItemTooltips(
  name: string,
  origin: string | undefined,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BackendResult<ItemTooltipsEnvelope>> {
  if (characterNameError(name)) return Promise.resolve(invalid);
  const url = backendUrl(origin, "/api/v1/characters/item-tooltips");
  url?.searchParams.set("characterName", normalizeCharacterName(name));
  return requestBackend(url, { ...options, isValid: isItemTooltipsEnvelope, errorCodes });
}

/** An equipment card's remaining lines with the section each one followed. */
export type ExtraLines = { lines: string[]; sections: string[] };
const NO_EXTRA: ExtraLines = { lines: [], sections: [] };

/**
 * Extra lines for the equipment at `index` (search order) — only if the type
 * still matches — with the official section title each line came after
 * (backend #286; empty for a cache in the older format).
 */
export function equipmentExtra(data: ItemTooltips | undefined, index: number, type: string | null): ExtraLines {
  const entry = data?.equipment.find((item) => item.index === index);
  if (!entry || (type != null && entry.type !== type)) return NO_EXTRA;
  return { lines: entry.extraLines, sections: entry.extraLineSections ?? [] };
}

export function equipmentLines(data: ItemTooltips | undefined, index: number, type: string | null) {
  return equipmentExtra(data, index, type).lines;
}

/**
 * Where each remaining line goes: most come after the tooltip's last section
 * (the card's end, as before), but a line that followed an earlier section —
 * a bracelet's "효과 부여 불가" after 팔찌 효과 — goes right after that section
 * when the card shows it. Without section data everything stays at the end.
 */
export function placeExtraLines({ lines, sections }: ExtraLines, shown: ReadonlySet<string>) {
  const after = new Map<string, string[]>();
  const tail: string[] = [];
  const last = sections.at(-1);
  lines.forEach((line, i) => {
    const section = sections.length === lines.length ? sections[i] : "";
    if (!section || section === last || !shown.has(section)) tail.push(line);
    else after.set(section, [...(after.get(section) ?? []), line]);
  });
  return { after, tail };
}

export type LineTone = "warn" | "craft" | "plain";

/**
 * Colour of an official tooltip line as the game (and the reference site)
 * shows it: "…불가" restrictions red, "[제작] …"-style sources cyan, the rest
 * plain (durability, descriptions).
 */
export function lineTone(line: string): LineTone {
  if (/불가/.test(line)) return "warn";
  if (/^\[[^\]]+\]/.test(line.trim())) return "craft";
  return "plain";
}

type LineKind = "warn" | "source" | "more" | "count" | "plain";
const kindOf = (line: string): LineKind =>
  /불가/.test(line)
    ? "warn"
    : /^\[[^\]]+\]/.test(line.trim())
      ? "source"
      : /^그 외에 획득처/.test(line)
        ? "more"
        : /^내구도\s/.test(line)
          ? "count"
          : "plain";

/**
 * The remaining lines as the reference site's sections (sheet v2.1 §2c): a
 * run of sources ("[가디언 토벌] …") with "그 외에 획득처가 더 존재합니다." is one
 * section, so are consecutive description sentences; a restriction, a single
 * "[제작] …" line and durability stand alone.
 */
export function groupExtraLines(lines: string[]): string[][] {
  const groups: { kind: LineKind; lines: string[] }[] = [];
  for (const line of lines) {
    const kind = kindOf(line);
    const last = groups.at(-1);
    const joins =
      last &&
      (kind === "more" ? last.kind === "source" : kind === last.kind && (kind === "source" || kind === "plain"));
    if (last && joins) last.lines.push(line);
    else groups.push({ kind, lines: [line] });
  }
  return groups.map((group) => group.lines);
}

/** Extra lines for the gem in `slot` (search response gems.items[].slot). */
export function gemLines(data: ItemTooltips | undefined, slot: number | null | undefined) {
  if (slot == null) return [];
  return data?.gems.find((gem) => gem.slot === slot)?.extraLines ?? [];
}
