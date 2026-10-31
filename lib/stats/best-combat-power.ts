// Best combat power (backend #477·#480, checklist L5): for each character the
// highest combat power seen over its whole history (the ranking's
// bestCombatPower), counted overall and per class over the same sample and
// filters as the other statistics. A cell under 30 gives its count only. The
// combat power range filter applies to the current combat power, not the best.

import type { components } from "../api/best-combat-power-schema";

import { statsSearch, type StatsQuery } from "./model";

type Schemas = components["schemas"];
export type BestCombatPowerEnvelope = Schemas["ApiResponseStatsBestCombatPowerResponse"];
export type BestCombatPower = Schemas["StatsBestCombatPowerResponse"];
export type BestRow = Schemas["StatsBestCombatPowerRowResponse"];

/** The stats screen's filters, without the distribution's own (metric, width, percentile). */
export const bestCombatPowerSearch = (query: StatsQuery) =>
  statsSearch({ ...query, metric: undefined, width: undefined, percentileOf: undefined });
