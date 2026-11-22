// (ours, X3) Target controls for the 재련 계산기: a target item-level slider and '고른 부위 +1'. Our own model only —
// stages 10~25 (완갑 0~25), +5 item level per stage on one of the six item-level parts, the item level being their
// average (완갑 adds none, lib/refining/model.ts targetItemLevel). Costs stay the 일반 재련 plan the page already asks for.
import { ITEM_LEVEL_PER_STAGE, MAX_STAGE, PARTS, type PartId, type PartState } from "./model";

type Parts = Record<PartId, PartState>;

/** The parts the item level averages: the six that are not 완갑. */
const LEVEL_PARTS = PARTS.filter((part) => part.type !== "ARM_GUARD");

/** Parts the slider moves: counted in the plan (enabled) and in the item level. */
const slid = (parts: Parts) => LEVEL_PARTS.filter((part) => parts[part.id].enabled);

/** How far the slider goes: every slid part from its current stage up to the top. */
export function sliderMax(parts: Parts): number {
  return slid(parts).reduce((sum, part) => sum + (MAX_STAGE - parts[part.id].current), 0);
}

/** Where the slider sits for these targets: the stages added over the slid parts' current stages. */
export function sliderValue(parts: Parts): number {
  return slid(parts).reduce((sum, part) => sum + Math.max(0, parts[part.id].target - parts[part.id].current), 0);
}

/** The item level the slid stages add, in the average (each stage is +5 on one of six parts). */
export const levelGain = (stages: number) => (stages * ITEM_LEVEL_PER_STAGE) / LEVEL_PARTS.length;

/**
 * Targets for `stages` added stages, filled evenly: each stage goes to the slid part whose target is lowest (the
 * first in the page's order on a tie), never past 25. Parts not slid (excluded, 완갑) keep their targets.
 */
export function spreadStages(parts: Parts, stages: number): Parts {
  const ids = slid(parts).map((part) => part.id);
  const target: Record<string, number> = Object.fromEntries(ids.map((id) => [id, parts[id].current]));
  let left = Math.max(0, Math.min(stages, sliderMax(parts)));
  while (left > 0) {
    let lowest: PartId | null = null;
    for (const id of ids)
      if (target[id] < MAX_STAGE && (lowest === null || target[id] < target[lowest])) lowest = id;
    if (lowest === null) break;
    target[lowest] += 1;
    left -= 1;
  }
  const next = { ...parts };
  for (const id of ids) next[id] = { ...parts[id], target: target[id] };
  return next;
}

/** '고른 부위 +1': each picked part's target one stage higher, never past 25 (완갑 too, on its own table). */
export function bumpPicked(parts: Parts, picked: readonly PartId[]): Parts {
  const next = { ...parts };
  for (const id of picked) {
    const part = parts[id];
    if (!part?.enabled) continue;
    next[id] = { ...part, target: Math.min(MAX_STAGE, Math.max(part.target, part.current) + 1) };
  }
  return next;
}

/** Picked parts that can still go up (enabled, target below 25): the +1 button works only with some. */
export const raisable = (parts: Parts, picked: readonly PartId[]) =>
  picked.filter((id) => parts[id]?.enabled && Math.max(parts[id].target, parts[id].current) < MAX_STAGE);
