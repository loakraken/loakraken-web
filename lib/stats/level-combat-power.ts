// 레벨별 전투력 (stats B3, api #784): the combat power median per 5-level item
// level bucket, over the same sample and filters as the other statistics.
// Only buckets with people come, ascending; a bucket under 30 has a count but
// no median, so it is not drawn (its count still shows on hover and in the table).
// Validation and the request live in level-combat-power.backend.ts (server only).
import type { components } from "../api/stats-level-combat-power-schema";
import { bestCombatPowerSearch } from "./best-combat-power";

type Schemas = components["schemas"];
export type LevelCombatPowerEnvelope = Schemas["ApiResponseStatsLevelCombatPowerResponse"];
export type LevelBucket = Schemas["StatsLevelCombatPowerBucketResponse"];

export const levelCombatPowerSearch = bestCombatPowerSearch;

export type LinePoint = { bucket: LevelBucket; x: number; y: number | null };

/**
 * Where each bucket sits in a width × height box: x by the bucket's middle
 * level across the whole level range, y by its median between the lowest and
 * highest median (a little room above and below). The line breaks at a
 * bucket without a median instead of joining across it.
 */
export function linePoints(buckets: readonly LevelBucket[], width: number, height: number, pad = 8) {
  const medians = buckets.flatMap((b) => (b.median == null ? [] : [b.median]));
  const lo = Math.min(...medians);
  const hi = Math.max(...medians);
  const span = hi - lo || 1;
  const first = buckets[0]?.from ?? 0;
  const last = buckets.at(-1)?.to ?? first + 1;
  const levels = last - first || 1;
  const points: LinePoint[] = buckets.map((bucket) => ({
    bucket,
    x: (((bucket.from + bucket.to) / 2 - first) / levels) * width,
    y: bucket.median == null ? null : pad + (1 - (bucket.median - lo) / span) * (height - pad * 2),
  }));
  let path = "";
  let open = false;
  for (const p of points) {
    if (p.y == null) {
      open = false;
      continue;
    }
    path += `${open ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    open = true;
  }
  return { points, path, lo: medians.length ? lo : null, hi: medians.length ? hi : null, first, last };
}
