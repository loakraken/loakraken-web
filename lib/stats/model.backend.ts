// Backend side of model.ts: response validation (Ajv + the contract) and the
// requests that use it. Server code and tests only — the client imports
// model.ts for labels and helpers, which no longer pulls Ajv into the browser.
import Ajv2020 from "ajv/dist/2020";
import contract from "../../contracts/stats.openapi.json";
import { tolerantSchemas } from "../api/tolerant";
import { lazyValidator } from "@/lib/api/lazy-validator";
import { STATS_VIEWS, type StatsView, type StatsEnvelopes, type StatsMeta } from "./model";

const ajv = new Ajv2020({ strict: false, validateFormats: false });

ajv.addSchema({
  $id: "stats",
  components: { ...contract.components, schemas: tolerantSchemas(contract.components.schemas) },
});

const SCHEMA: Record<StatsView, [string, string]> = {
  summary: ["ApiResponseStatsSummaryResponse", "STATS_SUMMARY_SUCCESS"],
  classes: ["ApiResponseStatsClassesResponse", "STATS_CLASSES_SUCCESS"],
  servers: ["ApiResponseStatsServersResponse", "STATS_SERVERS_SUCCESS"],
  distribution: ["ApiResponseStatsDistributionResponse", "STATS_DISTRIBUTION_SUCCESS"],
};

const validators = Object.fromEntries(
  STATS_VIEWS.map((view) => [view, lazyValidator(() => ajv.compile({ $ref: `stats#/components/schemas/${SCHEMA[view][0]}` }))]),
) as Record<StatsView, (value: unknown) => value is unknown>;

export function isStatsEnvelope<V extends StatsView>(view: V, value: unknown): value is StatsEnvelopes[V] {
  if (!validators[view](value)) return false;
  const envelope = value as { code: string; data: { meta: StatsMeta } };
  return envelope.code === SCHEMA[view][1] && Number.isFinite(Date.parse(envelope.data.meta.aggregatedAt));
}
