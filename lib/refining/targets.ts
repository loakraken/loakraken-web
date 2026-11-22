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
 * Targets for `stages` added stages over the slid parts' current stages, from the targets already set (each part's
 * floor is max(current, target), codex P2 on #1922 / PM-프론트): only the difference moves. Raising: each stage goes
 * to the part whose target is lowest (the first in the page's order on a tie), never past 25 — a part set higher by
 * hand stays as it is ('이미 더 높은 부위는 그대로'). Lowering below what is set: each stage comes off the part
 * whose target is highest (the last in the page's order on a tie), never under its current stage. Parts not slid
 * (excluded, 완갑) keep their targets.
 */
export function spreadStages(parts: Parts, stages: number): Parts {
  const ids = slid(parts).map((part) => part.id);
  const target: Record<string, number> = Object.fromEntries(
    ids.map((id) => [id, Math.max(parts[id].current, parts[id].target)]),
  );
  let delta = Math.max(0, Math.min(stages, sliderMax(parts))) - sliderValue(parts);
  while (delta > 0) {
    let lowest: PartId | null = null;
    for (const id of ids)
      if (target[id] < MAX_STAGE && (lowest === null || target[id] < target[lowest])) lowest = id;
    if (lowest === null) break;
    target[lowest] += 1;
    delta -= 1;
  }
  while (delta < 0) {
    let highest: PartId | null = null;
    for (const id of ids)
      if (target[id] > parts[id].current && (highest === null || target[id] >= target[highest])) highest = id;
    if (highest === null) break;
    target[highest] -= 1;
    delta += 1;
  }
  const next = { ...parts };
  for (const id of ids) next[id] = { ...parts[id], target: target[id] };
  return next;
}

/** Where a run of slider steps started, and what its last step made (the slider keeps it between steps). */
export type SlideAnchor = { base: Parts; made: Parts };

/**
 * Every field of every part equal (the page keeps the parts in the address, so they come back as a new object with
 * the same fields: equality, not identity). Codex P2 on #1930: comparing the targets alone took a grade or 장인의 기운
 * edited in a row for "still the last step" and the next step put the old one back.
 */
export const sameParts = (a: Parts, b: Parts) =>
  PARTS.every((part) => {
    const x = a[part.id];
    const y = b[part.id];
    return (
      x.enabled === y.enabled &&
      x.grade === y.grade &&
      x.current === y.current &&
      x.target === y.target &&
      x.artisanEnergy === y.artisanEnergy &&
      x.successRate === y.successRate
    );
  });

/**
 * One slider step from the targets the run started at (#1929, codex P3 on #1922): raising fills the lowest and
 * lowering drains the highest, so steps taken one at a time from each other's result do not undo each other when
 * targets tie (18/19/19… +1 −1 came back as 19/…/18). While the parts are still exactly what the last step made, every
 * step spreads from the run's base targets instead, so going back to a value gives back that value's targets. Only
 * the targets come from the base; everything else is the live parts'. Any other change (a row, '고른 부위 +1', a
 * chip, a new character) starts a new run from the parts as they are; the slider also drops its run as soon as it
 * sees one (refining-targets.tsx), so a change that lands back on the same parts still starts afresh.
 */
export function slideTargets(anchor: SlideAnchor | null, parts: Parts, stages: number): SlideAnchor {
  if (!anchor || !sameParts(parts, anchor.made)) return { base: parts, made: spreadStages(parts, stages) };
  const base = { ...parts };
  for (const part of PARTS) base[part.id] = { ...parts[part.id], target: anchor.base[part.id].target };
  return { base, made: spreadStages(base, stages) };
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
