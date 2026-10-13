// Roster combat power (checklist L19): the combat power LOAKraken has on record
// for each same-server roster character, and a button that reads the missing
// ones from the official profiles (up to 12 per press, then a 10-minute
// cooldown). The default view makes no official call; values are records.
//
// A character with no record and one the service may not record read the
// same, here and on screen: no different colour, mark or wording, and the
// refill result is never told in counts.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/roster-combat-power.openapi.json";
import type { components } from "../api/roster-combat-power-schema";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";

type Schemas = components["schemas"];
export type RosterPowerEnvelope = Schemas["ApiResponseRosterCombatPowerResponse"];
export type RosterPower = Schemas["RosterCombatPowerResponse"];
export type RosterPowerItem = Schemas["RosterCombatPowerItemResponse"];
export type RosterPowerRefreshEnvelope = Schemas["ApiResponseRosterCombatPowerRefreshResponse"];
export type RosterPowerRefresh = Schemas["RosterCombatPowerRefreshResponse"];

const compile = <T>(ref: string) =>
  lazyValidator(() =>
    new Ajv2020({ strict: false, validateFormats: false }).compile<T>({
      $ref: `#/components/schemas/${ref}`,
      components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
    }),
  );
const validateView = compile<RosterPowerEnvelope>("ApiResponseRosterCombatPowerResponse");
const validateRefresh = compile<RosterPowerRefreshEnvelope>("ApiResponseRosterCombatPowerRefreshResponse");
const isTime = (value: string | null | undefined) => value == null || Number.isFinite(Date.parse(value));
const itemsValid = (items: readonly RosterPowerItem[]) =>
  items.every(
    (item) =>
      (item.combatPower == null || (Number.isFinite(item.combatPower) && item.combatPower >= 0)) &&
      isTime(item.combatPowerObservedAt),
  );

export function isRosterPowerEnvelope(value: unknown): value is RosterPowerEnvelope {
  return (
    validateView(value) &&
    value.code === "CHARACTER_ROSTER_COMBAT_POWER_SUCCESS" &&
    itemsValid(value.data.items) &&
    isTime(value.data.refreshAvailableAt)
  );
}

export function isRosterPowerRefreshEnvelope(value: unknown): value is RosterPowerRefreshEnvelope {
  return (
    validateRefresh(value) &&
    value.code === "CHARACTER_ROSTER_COMBAT_POWER_REFRESH_SUCCESS" &&
    itemsValid(value.data.items) &&
    isTime(value.data.refreshAvailableAt)
  );
}
